use crate::{journal::authors, parse_metadata, project::Result, re};
use reqwest::blocking::Client;
use serde_json::{json, Value};
use std::{collections::HashMap, process::Command, time::Duration};

pub fn resolve_token(preference: &str) -> String {
    if !preference.is_empty() {
        return preference.into();
    }
    for key in ["GH_TOKEN", "GITHUB_TOKEN"] {
        if let Ok(token) = std::env::var(key) {
            if !token.is_empty() {
                return token;
            }
        }
    }
    Command::new("gh")
        .args(["auth", "token"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
        .unwrap_or_default()
}

pub fn comment_metadata(text: &str) -> (u64, String, String) {
    let mut lines: Vec<String> = text
        .split('\n')
        .map(|l| l.trim_end_matches('\r').to_owned())
        .collect();
    let pattern = re(r"\[[^\[\]\n]*\]");
    for i in 0..lines.len() {
        let line = &lines[i];
        let brackets: Vec<_> = pattern
            .find_iter(line)
            .filter(|m| {
                let content = &m.as_str()[1..m.as_str().len() - 1];
                !["", " ", "x", "X"].contains(&content) && !line[m.end()..].starts_with('(')
            })
            .collect();
        let mut k = 0;
        while k < brackets.len() {
            let start = brackets[k].start();
            let mut end = brackets[k].end();
            k += 1;
            while k < brackets.len()
                && line[end..brackets[k].start()]
                    .chars()
                    .all(|c| c == ' ' || c == '\t')
            {
                end = brackets[k].end();
                k += 1;
            }
            while end < line.len() && matches!(line.as_bytes()[end], b' ' | b'\t') {
                end += 1;
            }
            let run = &line[start..end];
            if !re(r"\[\s*[0-9]").is_match(run) {
                continue;
            }
            let m = parse_metadata(run);
            if m.duration == 0 && m.status.is_empty() {
                continue;
            }
            let rest = format!("{} {}", &line[..start], &line[end..]);
            lines[i] = re(r"\s+").replace_all(&rest, " ").trim().to_owned();
            let text = lines
                .iter()
                .enumerate()
                .filter(|(j, l)| *j != i || !l.is_empty())
                .map(|(_, l)| l.as_str())
                .collect::<Vec<_>>()
                .join("\n");
            return (m.duration, m.status, text.trim().to_owned());
        }
    }
    (0, String::new(), text.trim().to_owned())
}

fn fetch_pages(client: &Client, url: &str, token: &str, origin: &str) -> Result<Vec<Value>> {
    let mut next = Some(url.to_owned());
    let mut values = Vec::new();
    let mut visited = std::collections::HashSet::new();
    while let Some(url) = next.take() {
        // Never send authentication to an arbitrary pagination host.
        if !url.starts_with(origin) || !visited.insert(url.clone()) {
            return Err("Pagination GitHub invalide".into());
        }
        let mut req = client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");
        if !token.is_empty() {
            req = req.bearer_auth(token);
        }
        let response = req.send().map_err(|_| {
            "Impossible de joindre GitHub : vérifiez la connexion internet".to_owned()
        })?;
        if !response.status().is_success() {
            return Err(match response.status().as_u16() {
                401 => "Token GitHub invalide, expiré ou révoqué".into(),
                403 | 429
                    if response
                        .headers()
                        .get("x-ratelimit-remaining")
                        .is_some_and(|h| h == "0") =>
                {
                    "Limite de requêtes GitHub atteinte".into()
                }
                403 | 429 => "Permission GitHub Issues : Read-only requise".into(),
                404 => "Dépôt GitHub introuvable ou token sans accès".into(),
                s => format!("Erreur GitHub {s}"),
            });
        }
        next = response
            .headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .and_then(|link| {
                re(r#"<([^>]+)>;\s*rel="next""#)
                    .captures(link)
                    .map(|c| c[1].to_owned())
            });
        let page: Vec<Value> = response.json().map_err(|_| "Réponse GitHub invalide")?;
        values.extend(page);
    }
    Ok(values)
}

pub fn groom_comment(comment: &Value, issue: Option<&Value>) -> Value {
    let (duration, status, text) = comment_metadata(comment["body"].as_str().unwrap_or(""));
    let number = issue
        .and_then(|i| i["number"].as_u64())
        .or_else(|| {
            comment["issue_url"]
                .as_str()?
                .rsplit('/')
                .next()?
                .parse()
                .ok()
        })
        .unwrap_or(0);
    json!({"commentId":comment["id"],"source":if issue.is_some_and(|i| i["pull_request"].is_object()) {"pr"} else {"issue"},"issueNumber":number,
        "name":format!("#{number} {}",issue.and_then(|i|i["title"].as_str()).unwrap_or("")).trim(),"description":text,"date":comment["created_at"],"duration":duration,"status":status,"author":comment["user"]["login"].as_str().unwrap_or("?"),"url":comment["html_url"]})
}

pub fn read_comments(base: &str, project: &Value, token: &str) -> Result<Vec<Value>> {
    let Some(c) = re(r"(?i)^https?://github\.com/([^/]+)/([^/#?]+)$").captures(base) else {
        return Ok(vec![]);
    };
    let api = format!("https://api.github.com/repos/{}/{}", &c[1], &c[2]);
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("gitjournal")
        .build()
        .map_err(|e| e.to_string())?;
    let mut comments_url = reqwest::Url::parse(&format!(
        "{api}/issues/comments?per_page=100&sort=created&direction=asc"
    ))
    .map_err(|e| e.to_string())?;
    let mut issues_url = reqwest::Url::parse(&format!("{api}/issues?state=all&per_page=100"))
        .map_err(|e| e.to_string())?;
    let since = project["journalStartDate"]
        .as_str()
        .map(crate::project::parse_date)
        .transpose()
        .map_err(|_| "Date de début invalide")?;
    if let Some(since) = since {
        comments_url
            .query_pairs_mut()
            .append_pair("since", &since.to_rfc3339());
        issues_url
            .query_pairs_mut()
            .append_pair("since", &since.to_rfc3339());
    }
    let comments = fetch_pages(
        &client,
        comments_url.as_str(),
        token,
        "https://api.github.com/",
    )?;
    let issues = fetch_pages(
        &client,
        issues_url.as_str(),
        token,
        "https://api.github.com/",
    )?;
    filter_comments(&comments, &issues, project, since)
}

fn filter_comments(
    comments: &[Value],
    issues: &[Value],
    project: &Value,
    since: Option<chrono::DateTime<chrono::FixedOffset>>,
) -> Result<Vec<Value>> {
    for comment in comments {
        comment["created_at"]
            .as_str()
            .and_then(|date| chrono::DateTime::parse_from_rfc3339(date).ok())
            .ok_or("Commentaire GitHub invalide : date de création absente ou illisible")?;
    }
    let index: HashMap<_, _> = issues
        .iter()
        .filter_map(|i| Some((i["url"].as_str()?, i)))
        .collect();
    let users: Vec<_> = authors(&project["me"])
        .into_iter()
        .chain(authors(&project["githubUsers"]))
        .map(|s| s.to_lowercase())
        .collect();
    Ok(comments
        .iter()
        .filter(|c| {
            let author = c["user"]["login"].as_str().unwrap_or("").to_lowercase();
            (users.is_empty() || users.contains(&author))
                && since.is_none_or(|s| {
                    c["created_at"]
                        .as_str()
                        .and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok())
                        .is_some_and(|d| d >= s)
                })
        })
        .map(|c| {
            groom_comment(
                c,
                c["issue_url"]
                    .as_str()
                    .and_then(|url| index.get(url).copied()),
            )
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn markdown_keeps_links_checkboxes_and_discussions() {
        assert_eq!(
            comment_metadata("- [x] [doc](https://x.y)\nFait [2h wip]"),
            (120, "wip".into(), "- [x] [doc](https://x.y)\nFait".into())
        );
        assert_eq!(
            comment_metadata("[WIP] discussion"),
            (0, "".into(), "[WIP] discussion".into())
        );
        assert_eq!(
            comment_metadata("Texte\n[1][30][WIP]\nSuite"),
            (90, "WIP".into(), "Texte\nSuite".into())
        );
    }
}

#[cfg(test)]
mod transport_tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };
    fn mock(status: &str, body: &str, headers: &str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let response=format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n{body}",body.len());
        let task = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut bytes = [0; 8192];
            let n = socket.read(&mut bytes).unwrap();
            socket.write_all(response.as_bytes()).unwrap();
            String::from_utf8_lossy(&bytes[..n]).into_owned()
        });
        (url, task)
    }
    #[test]
    fn bearer_and_successful_response() {
        let (url, task) = mock("200 OK", r#"[{"id":42}]"#, "");
        let items = fetch_pages(&Client::new(), &url, "synthetic-token", &url).unwrap();
        assert_eq!(items[0]["id"], 42);
        assert!(task
            .join()
            .unwrap()
            .to_lowercase()
            .contains("authorization: bearer synthetic-token"));
    }
    #[test]
    fn github_errors_are_reported_without_response_or_credentials() {
        for (status, headers, expected) in [
            ("401 Unauthorized", "", "Token GitHub"),
            ("403 Forbidden", "x-ratelimit-remaining: 0\r\n", "Limite"),
            ("403 Forbidden", "", "Permission"),
            ("404 Not Found", "", "introuvable"),
        ] {
            let (url, task) = mock(status, r#"{"message":"private response"}"#, headers);
            let error = fetch_pages(&Client::new(), &url, "synthetic-token", &url).unwrap_err();
            assert!(error.contains(expected));
            assert!(!error.contains("synthetic-token"));
            assert!(!error.contains("private response"));
            task.join().unwrap();
        }
    }
    #[test]
    fn follows_pages_and_rejects_off_origin_links() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}/", listener.local_addr().unwrap());
        let task_base = base.clone();
        let task = thread::spawn(move || {
            for i in 1..=2 {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                let n = socket.read(&mut request).unwrap();
                assert!(n > 0);
                let body = format!("[{{\"id\":{i}}}]");
                let link = if i == 1 {
                    format!("Link: <{task_base}page2>; rel=\"next\"\r\n")
                } else {
                    String::new()
                };
                write!(socket,"HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n{link}\r\n{body}",body.len()).unwrap();
            }
        });
        assert_eq!(
            fetch_pages(&Client::new(), &base, "", &base).unwrap().len(),
            2
        );
        task.join().unwrap();
        let (url, task) = mock(
            "200 OK",
            "[]",
            "Link: <http://outside.invalid/>; rel=\"next\"\r\n",
        );
        assert!(fetch_pages(&Client::new(), &url, "", &url)
            .unwrap_err()
            .contains("Pagination"));
        task.join().unwrap();
    }
    #[test]
    fn filters_creation_date_and_authors_but_keeps_no_duration_comments() {
        let comments = vec![
            json!({"id":1,"body":"Discussion","created_at":"2026-02-01T10:00:00Z","user":{"login":"ALICE"},"issue_url":"u","html_url":"https://github.com/o/r/issues/1#1"}),
            json!({"id":2,"body":"[30m done] Test","created_at":"2020-01-01T10:00:00Z","user":{"login":"Alice"},"issue_url":"u"}),
            json!({"id":3,"body":"Other","created_at":"2026-02-01T10:00:00Z","user":{"login":"Bob"},"issue_url":"u"}),
        ];
        let issues = vec![json!({"url":"u","number":1,"title":"Pull request","pull_request":{}})];
        let entries = filter_comments(
            &comments,
            &issues,
            &json!({"me":"Alice"}),
            Some(crate::project::parse_date("2026-01-01").unwrap()),
        )
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0]["source"], "pr");
        assert_eq!(entries[0]["duration"], 0);
        assert_eq!(entries[0]["description"], "Discussion");
    }
}

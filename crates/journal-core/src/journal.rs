use crate::{parse_metadata, project::Result, re};
use serde_json::{json, Value};
use std::{collections::HashSet, path::Path, process::Command};

pub fn authors(v: &Value) -> Vec<String> {
    match v {
        Value::String(s) => vec![s.clone()],
        Value::Array(a) => a
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect(),
        _ => vec![],
    }
    .into_iter()
    .filter(|s| !s.is_empty())
    .collect()
}

pub fn git(repo: &Path, args: &[String]) -> Result<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| format!("Impossible de lancer Git : {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "Erreur Git : {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn groom(message: &str) -> Value {
    let lines: Vec<_> = message
        .split('\n')
        .filter(|s| !s.trim().is_empty())
        .collect();
    let mut name = lines.first().copied().unwrap_or("").to_owned();
    let mut description: Vec<String> = lines.iter().skip(1).map(|s| (*s).to_owned()).collect();
    let mut metadata = crate::Metadata::default();
    for (i, line) in lines.iter().enumerate() {
        let m = parse_metadata(line);
        if m.duration > 0 || !m.status.is_empty() {
            metadata = m;
            let brackets = re(r"\[(.*?)\]");
            let contents: Vec<_> = brackets.captures_iter(line).collect();
            let compact = contents.len() == 1
                && re(r"(?i)[0-9]+[hm]|^[0-9]+\s+[a-z][a-z0-9_]*$").is_match(&contents[0][1]);
            let stripped = if compact {
                re(r"\s*\[.*?\]\s*")
                    .replacen(line, 1, " ")
                    .trim()
                    .to_owned()
            } else {
                re(r"\s*\[.*?\]").replace_all(line, "").trim().to_owned()
            };
            if i == 0 {
                name = stripped;
            } else {
                description[i - 1] = stripped;
                description.retain(|s| !s.is_empty());
            }
            break;
        }
    }
    if name.is_empty() {
        name = message.split('\n').next().unwrap_or("").to_owned();
    }
    json!({"name":name,"description":description.join("\n"),"duration":metadata.duration,"status":metadata.status})
}

pub fn remote(repo: &Path) -> String {
    let raw = git(repo, &["remote".into(), "get-url".into(), "origin".into()]).unwrap_or_default();
    let raw = raw.trim();
    let ssh = re(r"^git@([^:]+):(.+)$");
    let url = if let Some(c) = ssh.captures(raw) {
        format!("https://{}/{}", &c[1], &c[2])
    } else {
        re(r"//[^/@]+@").replace(raw, "//").into_owned()
    };
    url.trim_end_matches('/')
        .trim_end_matches(".git")
        .to_owned()
}

pub fn apply_exceptions(entries: Vec<Value>, exceptions: &[Value]) -> Vec<Value> {
    let key = |v: &Value| {
        v["sha"]
            .as_str()
            .or(v["id"].as_str())
            .unwrap_or("")
            .trim()
            .to_lowercase()
    };
    let mut all = Vec::new();
    for e in entries {
        if exceptions
            .iter()
            .any(|x| x["excluded"] == true && key(x) == key(&e))
        {
            continue;
        }
        if let Some(x) = exceptions.iter().rev().find(|x| key(x) == key(&e)) {
            let mut patched = json!({"source":e["source"],"branch":e["branch"]});
            if let Some(obj) = x.as_object() {
                patched.as_object_mut().unwrap().extend(obj.clone());
            }
            all.push(patched);
        } else {
            all.push(e);
        }
    }
    for x in exceptions.iter().filter(|x| x["type"] == "commitless") {
        let mut x = x.clone();
        x["source"] = json!("manual");
        all.push(x);
    }
    all
}

pub fn collect_local(repo: &Path, project: &Value) -> Result<Value> {
    // Validate the repository before log: an empty history is not a command failure.
    git(repo, &["rev-parse".into(), "--git-dir".into()])?;
    let mut args: Vec<String> = [
        "log",
        "--exclude=refs/tags/*",
        "--exclude=refs/stash",
        "--all",
        "--source",
        "--date=iso-strict",
        "--format=format:%H%x1e%an%x1e%ad%x1e%S%x1e%B%x1d",
    ]
    .iter()
    .map(|s| (*s).into())
    .collect();
    if let Some(since) = project["journalStartDate"].as_str() {
        args.push(format!("--after={since}"));
    }
    let raw_users = git(repo, &args)?;
    let users: std::collections::BTreeSet<_> = raw_users
        .split('\u{1d}')
        .filter_map(|r| r.trim().split('\u{1e}').nth(1))
        .map(str::to_owned)
        .collect();
    for author in authors(&project["me"]) {
        args.push(format!("--author={author}"));
    }
    let raw = git(repo, &args)?;
    let base = remote(repo);
    let mut seen = HashSet::new();
    let mut entries = Vec::new();
    let mut count = 0;
    for record in raw.split('\u{1d}') {
        let fields: Vec<_> = record.trim().splitn(5, '\u{1e}').collect();
        if fields.len() != 5 || !seen.insert(fields[0]) {
            continue;
        }
        count += 1;
        if fields[1].ends_with("[bot]") {
            continue;
        }
        let mut e = groom(fields[4].trim());
        if e["duration"].as_u64().unwrap_or(0) == 0 {
            continue;
        }
        let branch = re(r"^refs/(?:heads|tags)/|^refs/remotes/[^/]+/")
            .replace(fields[3], "")
            .into_owned();
        e["sha"] = json!(fields[0]);
        e["author"] = json!(fields[1]);
        e["date"] = json!(fields[2]);
        e["source"] = json!("commit");
        e["branch"] = json!(branch);
        e["url"] = json!(if base.is_empty() {
            String::new()
        } else {
            format!("{base}/commit/{}", fields[0])
        });
        entries.push(e);
    }
    let with_metadata = entries.len();
    let exceptions = project["exceptions"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let after_exclusions = entries
        .iter()
        .filter(|e| {
            !exceptions.iter().any(|x| {
                x["excluded"] == true
                    && x["sha"]
                        .as_str()
                        .unwrap_or("")
                        .trim()
                        .eq_ignore_ascii_case(e["sha"].as_str().unwrap_or(""))
            })
        })
        .count();
    let manual = exceptions
        .iter()
        .filter(|x| x["type"] == "commitless")
        .count();
    let entries = apply_exceptions(entries, &exceptions);
    Ok(
        json!({"stats":{"gitUsers":users,"fromUser":count,"withMetadata":with_metadata,"afterExclusions":after_exclusions,"manualEntries":manual,"total":entries.len(),"issueComments":0,"issuesError":null},"entries":entries,"remoteBaseUrl":base}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn groom_text_and_first_metadata() {
        assert_eq!(
            groom("Title\n[30m done] descriptive\n[1h wip]"),
            json!({"name":"Title","description":"descriptive\n[1h wip]","duration":30,"status":"done"})
        );
    }
    #[test]
    fn empty_and_invalid_repository() {
        let dir = tempfile::tempdir().unwrap();
        assert!(collect_local(dir.path(), &json!({})).is_err());
        git(dir.path(), &["init".into(), "-q".into()]).unwrap();
        assert_eq!(
            collect_local(dir.path(), &json!({})).unwrap()["entries"],
            json!([])
        );
    }
    #[test]
    fn patches_replace_and_manual_entries_survive() {
        let e = vec![json!({"sha":"AAA","source":"commit","branch":"main","name":"old"})];
        let x = vec![
            json!({"sha":"aaa","name":"new"}),
            json!({"type":"commitless","name":"manual"}),
        ];
        let r = apply_exceptions(e, &x);
        assert_eq!(r[0]["name"], "new");
        assert_eq!(r[0]["branch"], "main");
        assert_eq!(r[1]["source"], "manual");
    }
}

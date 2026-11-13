//! Moteur de domaine partagé par la future application Tauri.
use regex::Regex;
use std::sync::LazyLock;
pub mod github;
pub mod journal;
pub mod project;

fn re(pattern: &'static str) -> Regex {
    // JavaScript \s includes BOM and excludes NEL; keep the source parser's grammar.
    let pattern = pattern.replace(r"\s", r"[\t\n\r\x0B\x0C \u{00A0}\u{1680}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]");
    Regex::new(&pattern).expect("expression régulière interne valide")
}

/// Durée déclarée en minutes et statut, sans normalisation de casse.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Metadata {
    pub duration: u64,
    pub status: String,
}

pub fn parse_compact(content: &str) -> Option<Metadata> {
    static COMPACT: LazyLock<Regex> = LazyLock::new(|| {
        re(r"(?i)^(?:([0-9]+)h(?:([0-9]+)m?)?|([0-9]+)m)(?:\s+((?-u:[a-z0-9_]+)))?$")
    });
    static IMPLICIT: LazyLock<Regex> =
        LazyLock::new(|| re(r"(?i)^([0-9]+)\s+((?-u:[a-z][a-z0-9_]*))$"));
    if let Some(c) = COMPACT.captures(content) {
        let num = |i| c.get(i).map_or(Some(0), |m| m.as_str().parse::<u64>().ok());
        return Some(Metadata {
            duration: num(1)?
                .checked_mul(60)?
                .checked_add(num(2)?.checked_add(num(3)?)?)?,
            status: c.get(4).map_or("", |m| m.as_str()).to_owned(),
        });
    }
    let c = IMPLICIT.captures(content)?;
    Some(Metadata {
        duration: c[1].parse().ok()?,
        status: c[2].to_owned(),
    })
}

pub fn parse_metadata(line: &str) -> Metadata {
    static BRACKETS: LazyLock<Regex> = LazyLock::new(|| re(r"\[([^\r\n\u{2028}\u{2029}]*?)\]"));
    static COMPACT_HINT: LazyLock<Regex> =
        LazyLock::new(|| re(r"(?i)[0-9]+[hm]|^[0-9]+\s+(?-u:[a-z][a-z0-9_]*)$"));
    static NUMBERS: LazyLock<Regex> = LazyLock::new(|| re(r"[0-9]+"));
    let brackets: Vec<_> = BRACKETS.captures_iter(line).collect();
    if brackets.len() == 1 && COMPACT_HINT.is_match(&brackets[0][1]) {
        return parse_compact(&brackets[0][1]).unwrap_or_default();
    }
    let mut result = Metadata::default();
    for bracket in brackets {
        let nums: Vec<_> = NUMBERS.find_iter(&bracket[1]).collect();
        if nums.is_empty() {
            result.status = bracket[1].to_owned();
        } else if nums.len() < 3 {
            for n in nums {
                let Some(duration) = n
                    .as_str()
                    .parse::<u64>()
                    .ok()
                    .and_then(|n| result.duration.checked_mul(60)?.checked_add(n))
                else {
                    return Metadata::default();
                };
                result.duration = duration;
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_javascript_corpus() {
        let cases: serde_json::Value =
            serde_json::from_str(include_str!("../../../doc/fixtures/metadata.json")).unwrap();
        for case in cases.as_array().unwrap() {
            let actual = parse_metadata(case["input"].as_str().unwrap());
            assert_eq!(
                actual.duration,
                case["duration"].as_u64().unwrap(),
                "{case}"
            );
            assert_eq!(actual.status, case["status"].as_str().unwrap(), "{case}");
        }
    }
}

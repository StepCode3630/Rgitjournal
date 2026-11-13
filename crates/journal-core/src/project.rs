use serde_json::{json, Value};
use std::{fs, io::Write, path::Path};

pub type Result<T> = std::result::Result<T, String>;

pub fn parse_date(date: &str) -> Result<chrono::DateTime<chrono::FixedOffset>> {
    chrono::DateTime::parse_from_rfc3339(date)
        .or_else(|_| {
            chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
                .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc().fixed_offset())
        })
        .map_err(|_| "Date invalide (ISO 8601 attendue)".into())
}

pub fn validate(p: &Value) -> Result<()> {
    if !p.is_object() || !p["projectName"].is_string() {
        return Err("Projet invalide : nom de projet requis".into());
    }
    let authors = super::journal::authors(&p["me"]);
    if authors.is_empty()
        || p["me"]
            .as_array()
            .is_some_and(|a| a.iter().any(|v| !v.is_string()))
        || !p["exceptions"].is_array()
        || p["columns"].as_array().is_none_or(Vec::is_empty)
    {
        return Err("Projet invalide : auteurs, colonnes et exceptions requis".into());
    }
    if let Some(date) = p["journalStartDate"].as_str() {
        parse_date(date)?;
    } else if !p["journalStartDate"].is_null() {
        return Err("Date de début invalide".into());
    }
    for column in p["columns"].as_array().unwrap() {
        if !column["label"].is_string() || !column["source"].is_string() {
            return Err("Chaque colonne doit définir label et source".into());
        }
    }
    for exception in p["exceptions"].as_array().unwrap() {
        if !exception.is_object() {
            return Err("Exception invalide".into());
        }
        if exception["excluded"] != true
            && ["commitless", "commitpatch"].contains(&exception["type"].as_str().unwrap_or(""))
        {
            parse_date(
                exception["date"]
                    .as_str()
                    .ok_or("Date de l’entrée requise")?,
            )?;
        }
    }
    Ok(())
}

pub fn load(path: &Path) -> Result<Value> {
    let data = fs::read(path).map_err(|e| format!("Lecture du projet : {e}"))?;
    let p = serde_json::from_slice(&data).map_err(|e| format!("JSON du projet invalide : {e}"))?;
    validate(&p)?;
    Ok(p)
}

/// Le temporaire est placé sur le même système de fichiers. Persist remplace
/// atomiquement la destination, également sous Windows ; Drop nettoie un échec.
pub fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut f = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    if let Ok(meta) = fs::metadata(path) {
        f.as_file()
            .set_permissions(meta.permissions())
            .map_err(|e| e.to_string())?;
    }
    f.write_all(data)
        .and_then(|_| f.as_file().sync_all())
        .map_err(|e| e.to_string())?;
    f.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

pub fn save(path: &Path, p: &Value) -> Result<()> {
    validate(p)?;
    atomic_write(
        path,
        &serde_json::to_vec_pretty(p).map_err(|e| e.to_string())?,
    )
}

pub fn new_project() -> Value {
    json!({"projectName":"", "me":"", "journalStartDate":null, "exceptions":[], "columns":[
        {"label":"Date","source":"date","format":"date","field":"date"},
        {"label":"Tâche","source":"name","field":"name"},
        {"label":"Description","source":"description","field":"description"},
        {"label":"Durée","source":"duration","format":"duration","field":"duration"},
        {"label":"Statut","source":"status","format":"badge","field":"status"},
        {"label":"Auteur","source":"author"}]})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_preserves_unknown_fields_and_replaces_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("projet é & '.gitj");
        let mut p = new_project();
        p["me"] = json!(["Zoé"]);
        p["custom"] = json!({"a":42});
        save(&path, &p).unwrap();
        p["projectName"] = json!("Nouveau");
        save(&path, &p).unwrap();
        assert_eq!(load(&path).unwrap(), p);
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn existing_documented_project_and_date_only_start_are_supported() {
        let project: Value =
            serde_json::from_str(include_str!("../../../doc/gitjournal.gitj")).unwrap();
        validate(&project).unwrap();
        assert_eq!(
            parse_date("2026-01-01").unwrap().to_rfc3339(),
            "2026-01-01T00:00:00+00:00"
        );
    }
}

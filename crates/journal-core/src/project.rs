use serde_json::{json, Value};
use std::{fs, io::Write, path::Path};

pub type Result<T> = std::result::Result<T, String>;

pub fn validate(p: &Value) -> Result<()> {
    if !p.is_object() || !p["projectName"].is_string() {
        return Err("Projet invalide : nom de projet requis".into());
    }
    let authors = super::journal::authors(&p["me"]);
    if authors.is_empty()
        || !p["exceptions"].is_array()
        || p["columns"].as_array().is_none_or(Vec::is_empty)
    {
        return Err("Projet invalide : auteurs, colonnes et exceptions requis".into());
    }
    if let Some(date) = p["journalStartDate"].as_str() {
        chrono::DateTime::parse_from_rfc3339(date).map_err(|_| "Date de début invalide")?;
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
}

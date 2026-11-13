use gitjournal_core::{project, project::Result};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub struct Session {
    pub path: Option<PathBuf>,
    pub project: Option<Value>,
    pub settings: Value,
    settings_path: PathBuf,
}
impl Session {
    pub fn new(settings_path: PathBuf, legacy: Option<PathBuf>) -> Result<Self> {
        let settings = if settings_path.exists() {
            serde_json::from_slice(&fs::read(&settings_path).map_err(|e| e.to_string())?)
                .map_err(|_| "Préférences corrompues")?
        } else if let Some(legacy) = legacy.filter(|p| p.is_file()) {
            serde_json::from_slice(&fs::read(legacy).map_err(|e| e.to_string())?)
                .map_err(|_| "Anciennes préférences corrompues")?
        } else {
            json!({"lastOpenedFile":null,"githubToken":null})
        };
        Ok(Self {
            path: None,
            project: None,
            settings,
            settings_path,
        })
    }
    pub fn save_settings(&self) -> Result<()> {
        let parent = self
            .settings_path
            .parent()
            .ok_or("Chemin des préférences invalide")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        project::atomic_write(
            &self.settings_path,
            &serde_json::to_vec_pretty(&self.settings).map_err(|e| e.to_string())?,
        )
    }
    pub fn open(&mut self, path: &Path) -> Result<Value> {
        let project = project::load(path)?;
        let previous = self.settings.clone();
        self.settings["lastOpenedFile"] = json!(path);
        if let Err(error) = self.save_settings() {
            self.settings = previous;
            return Err(error);
        }
        self.path = Some(path.into());
        self.project = Some(project.clone());
        Ok(project)
    }
    pub fn replace(&mut self, project: Value) -> Result<Value> {
        let path = self.path.as_ref().ok_or("Aucun projet ouvert")?;
        project::save(path, &project)?;
        self.project = Some(project.clone());
        Ok(project)
    }
    pub fn update(&mut self, entry: &Value, values: &Value) -> Result<Value> {
        if entry["commentId"].is_number() {
            return Err("Les commentaires sont à modifier sur GitHub".into());
        }
        let mut project = self.project.clone().ok_or("Aucun projet ouvert")?;
        let columns = project["columns"]
            .as_array()
            .ok_or("Colonnes invalides")?
            .clone();
        let mut patch = if entry["id"].is_string() {
            project["exceptions"]
                .as_array()
                .and_then(|a| a.iter().find(|e| e["id"] == entry["id"]))
                .cloned()
                .ok_or("Entrée introuvable")?
        } else if let Some(sha) = entry["sha"].as_str() {
            json!({"id":uuid::Uuid::new_v4().to_string(),"type":"commitpatch","sha":sha,"url":entry["url"],"author":entry["author"],"patch":true})
        } else {
            json!({"id":uuid::Uuid::new_v4().to_string(),"type":"commitless","author":project["me"]})
        };
        for column in columns {
            if let Some(field) = column["field"].as_str() {
                if let Some(value) = values.get(field) {
                    patch[field] = value.clone();
                }
            }
        }
        let date = patch["date"].as_str().ok_or("Date requise")?;
        chrono_date(date)?;
        if let Some(duration) = patch.get("duration") {
            if !duration.is_number() || duration.as_f64().is_none_or(|n| !n.is_finite()) {
                return Err("Durée invalide".into());
            }
        }
        let list = project["exceptions"]
            .as_array_mut()
            .ok_or("Exceptions invalides")?;
        if let Some(i) = list.iter().position(|e| e["id"] == patch["id"]) {
            list[i] = patch;
        } else {
            list.push(patch);
        }
        self.replace(project)
    }
    pub fn exclude(&mut self, sha: &str) -> Result<()> {
        if sha.is_empty() || sha == "-" {
            return Err("SHA invalide".into());
        }
        let mut p = self.project.clone().ok_or("Aucun projet ouvert")?;
        let list = p["exceptions"]
            .as_array_mut()
            .ok_or("Exceptions invalides")?;
        if let Some(e) = list.iter_mut().find(|e| {
            e["sha"]
                .as_str()
                .is_some_and(|s| s.trim().eq_ignore_ascii_case(sha.trim()))
        }) {
            e["excluded"] = json!(true);
        } else {
            list.push(json!({"sha":sha,"excluded":true}));
        }
        self.replace(p)?;
        Ok(())
    }
    pub fn delete(&mut self, id: &str) -> Result<()> {
        let mut p = self.project.clone().ok_or("Aucun projet ouvert")?;
        let list = p["exceptions"]
            .as_array_mut()
            .ok_or("Exceptions invalides")?;
        let Some(i) = list
            .iter()
            .position(|e| e["id"] == id && e["type"] == "commitless")
        else {
            return Err("Entrée manuelle introuvable".into());
        };
        list.remove(i);
        self.replace(p)?;
        Ok(())
    }
}
fn chrono_date(date: &str) -> Result<()> {
    // Reuse project validation without changing the stored date or timezone.
    let mut p = project::new_project();
    p["me"] = json!("validation");
    p["journalStartDate"] = json!(date);
    project::validate(&p)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn prepare(dir: &Path) -> (Session, PathBuf) {
        let file = dir.join("projet.gitj");
        let mut p = project::new_project();
        p["me"] = json!("Alice");
        project::save(&file, &p).unwrap();
        let mut session = Session::new(dir.join("config/settings.json"), None).unwrap();
        session.open(&file).unwrap();
        (session, file)
    }
    #[test]
    fn autosave_manual_edit_delete_and_restart() {
        let dir = tempfile::tempdir().unwrap();
        let (mut s, file) = prepare(dir.path());
        let p=s.update(&json!({}),&json!({"name":"Tâche éà","date":"2026-11-13T12:00:00Z","duration":30,"status":"WIP"})).unwrap();
        assert_eq!(project::load(&file).unwrap(), p);
        let entry = p["exceptions"][0].clone();
        let p = s
            .update(
                &entry,
                &json!({"name":"Corrigée","date":"2026-11-13T13:00:00Z","duration":45}),
            )
            .unwrap();
        assert_eq!(p["exceptions"].as_array().unwrap().len(), 1);
        s.delete(entry["id"].as_str().unwrap()).unwrap();
        assert!(project::load(&file).unwrap()["exceptions"]
            .as_array()
            .unwrap()
            .is_empty());
        let restored = Session::new(dir.path().join("config/settings.json"), None).unwrap();
        assert_eq!(restored.settings["lastOpenedFile"], json!(file));
    }
    #[test]
    fn failed_save_preserves_memory_and_invalid_input_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let (mut s, _) = prepare(dir.path());
        let previous = s.project.clone();
        assert!(s.update(&json!({"commentId":42}), &json!({})).is_err());
        assert!(s.update(&json!({}), &json!({"date":"invalid"})).is_err());
        s.path = Some(dir.path().join("missing/projet.gitj"));
        assert!(s.replace(project::new_project()).is_err());
        assert_eq!(s.project, previous);
    }
    #[test]
    fn legacy_project_in_subdirectory_opens_and_saves_without_data_loss() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path().join("doc/Journal");
        fs::create_dir_all(&folder).unwrap();
        let file = folder.join("ancien.gitj");
        let original = json!({
            "repoUrl":"https://example.invalid/legacy",
            "projectName":"Ancien", "branch":"old", "me":"Alice",
            "journalStartDate":null,
            "exceptions":[{"id":"manual", "type":"commitless", "author":"Alice",
                "date":"2026-01-02T12:00:00Z", "name":"Meeting", "duration":30}]
        });
        let bytes = serde_json::to_vec_pretty(&original).unwrap();
        fs::write(&file, &bytes).unwrap();
        let mut s = Session::new(dir.path().join("config/settings.json"), None).unwrap();
        let loaded = s.open(&file).unwrap();
        assert_eq!(fs::read(&file).unwrap(), bytes);
        assert_eq!(loaded["columns"], project::new_project()["columns"]);
        let entry = loaded["exceptions"][0].clone();
        s.update(&entry, &json!({"duration":45})).unwrap();
        let saved = project::load(&file).unwrap();
        assert_eq!(saved["exceptions"][0]["duration"], 45);
        assert_eq!(saved["exceptions"][0]["name"], "Meeting");
        for key in ["repoUrl", "branch", "me", "journalStartDate", "projectName"] {
            assert_eq!(saved[key], original[key]);
        }
        assert_eq!(saved["columns"], loaded["columns"]);
    }

    #[test]
    fn legacy_preferences_are_read_without_mutating_original() {
        let dir = tempfile::tempdir().unwrap();
        let legacy = dir.path().join("old.json");
        let bytes = br#"{"githubToken":null,"lastOpenedFile":null,"custom":42}"#;
        fs::write(&legacy, bytes).unwrap();
        let s = Session::new(dir.path().join("new/settings.json"), Some(legacy.clone())).unwrap();
        s.save_settings().unwrap();
        assert_eq!(s.settings["custom"], 42);
        assert_eq!(fs::read(legacy).unwrap(), bytes);
    }
}

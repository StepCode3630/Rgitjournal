#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod export;
mod session;
use gitjournal_core::{github, journal as engine, project, project::Result};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{Emitter, Manager, State};
type Shared = Arc<Mutex<session::Session>>;

fn project_argument(argument: &std::ffi::OsStr) -> Option<PathBuf> {
    if argument
        .to_str()
        .is_some_and(|s| s.starts_with("https://") || s.starts_with("http://"))
    {
        return None;
    }
    let path = if let Some(uri) = argument.to_str().filter(|s| s.starts_with("file:")) {
        tauri::Url::parse(uri).ok()?.to_file_path().ok()?
    } else {
        PathBuf::from(argument)
    };
    path.extension()
        .is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("gitj"))
        .then_some(path)
}
static ACTIVE_WRITES: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
static CLOSE_QUEUED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
struct WriteGuard;
impl Drop for WriteGuard {
    fn drop(&mut self) {
        ACTIVE_WRITES.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
    }
}
async fn durable<T: Send + 'static>(f: impl FnOnce() -> Result<T> + Send + 'static) -> Result<T> {
    ACTIVE_WRITES.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    work(move || {
        let _guard = WriteGuard;
        f()
    })
    .await
}

async fn work<T: Send + 'static>(f: impl FnOnce() -> Result<T> + Send + 'static) -> Result<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn initial_project(state: State<'_, Shared>) -> Result<Option<Value>> {
    let state = state.inner().clone();
    durable(move || {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        if s.project.is_some() {
            return Ok(s.project.clone());
        }
        let arg = std::env::args_os()
            .skip(1)
            .find_map(|arg| project_argument(&arg));
        let path = arg.or_else(|| s.settings["lastOpenedFile"].as_str().map(PathBuf::from));
        match path {
            Some(p) => s.open(&p).map(Some),
            None => Ok(None),
        }
    })
    .await
}
#[tauri::command]
fn current_project(
    window: tauri::WebviewWindow,
    state: State<'_, Shared>,
) -> Result<Option<Value>> {
    let project = state.lock().map_err(|e| e.to_string())?.project.clone();
    if let Some(project) = &project {
        let authors = engine::authors(&project["me"]).join(" / ");
        window
            .set_title(&format!(
                "Journal de travail - {} - {}",
                authors,
                project["projectName"].as_str().unwrap_or("")
            ))
            .map_err(|e| e.to_string())?;
    }
    Ok(project)
}
#[tauri::command]
async fn open_project(state: State<'_, Shared>) -> Result<Option<Value>> {
    let state = state.inner().clone();
    durable(move || {
        let directory = state
            .lock()
            .map_err(|e| e.to_string())?
            .path
            .as_ref()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf());
        let mut dialog = rfd::FileDialog::new()
            .set_title("Projet GitJournal")
            .add_filter("Projet GitJournal", &["gitj"]);
        if let Some(directory) = directory {
            dialog = dialog.set_directory(directory);
        }
        let Some(path) = dialog.pick_file() else {
            return Ok(None);
        };
        state
            .lock()
            .map_err(|e| e.to_string())?
            .open(&path)
            .map(Some)
    })
    .await
}
#[tauri::command]
async fn create_project(config: Value, state: State<'_, Shared>) -> Result<Option<Value>> {
    let state = state.inner().clone();
    durable(move || {
        let mut p = project::new_project();
        for k in ["projectName", "me", "journalStartDate"] {
            if let Some(v) = config.get(k) {
                p[k] = v.clone();
            }
        }
        if let Some(raw) = config["repoUrl"]
            .as_str()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            let url = engine::normalize_remote(raw);
            if url.is_empty() {
                return Err(
                    "URL du dépôt invalide. Exemple : https://github.com/groupe/projet".into(),
                );
            }
            p["repoUrl"] = json!(url);
        }
        project::validate(&p)?;
        if p["projectName"]
            .as_str()
            .is_none_or(|s| s.trim().is_empty())
        {
            return Err("Nom du projet requis".into());
        }
        let Some(path) = rfd::FileDialog::new()
            .set_title("Projet GitJournal")
            .add_filter("Projet GitJournal", &["gitj"])
            .set_file_name("projet.gitj")
            .save_file()
        else {
            return Ok(None);
        };
        project::save(&path, &p)?;
        state
            .lock()
            .map_err(|e| e.to_string())?
            .open(&path)
            .map(Some)
    })
    .await
}
#[tauri::command]
async fn save_project(state: State<'_, Shared>) -> Result<()> {
    let state = state.inner().clone();
    durable(move || {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        let p = s.project.clone().ok_or("Aucun projet ouvert")?;
        s.replace(p)?;
        Ok(())
    })
    .await
}
#[tauri::command]
async fn configure_project(project: Value, state: State<'_, Shared>) -> Result<Value> {
    let state = state.inner().clone();
    durable(move || state.lock().map_err(|e| e.to_string())?.replace(project)).await
}
#[tauri::command]
async fn update_entry(entry: Value, values: Value, state: State<'_, Shared>) -> Result<Value> {
    let state = state.inner().clone();
    durable(move || {
        state
            .lock()
            .map_err(|e| e.to_string())?
            .update(&entry, &values)
    })
    .await
}
#[tauri::command]
async fn exclude_entry(key: String, state: State<'_, Shared>) -> Result<()> {
    let state = state.inner().clone();
    durable(move || state.lock().map_err(|e| e.to_string())?.exclude(&key)).await
}
#[tauri::command]
async fn delete_entry(key: String, state: State<'_, Shared>) -> Result<()> {
    let state = state.inner().clone();
    durable(move || state.lock().map_err(|e| e.to_string())?.delete(&key)).await
}
#[tauri::command]
async fn journal(state: State<'_, Shared>) -> Result<Value> {
    let state = state.inner().clone();
    work(move || {
        let (path, p, token) = {
            let s = state.lock().map_err(|e| e.to_string())?;
            (
                s.path.clone().ok_or("Aucun projet ouvert")?,
                s.project.clone().ok_or("Aucun projet ouvert")?,
                s.settings["githubToken"].as_str().unwrap_or("").to_owned(),
            )
        };
        let mut data = engine::collect_local(path.parent().ok_or("Chemin invalide")?, &p)?;
        if p["includeIssues"] == true {
            let token = github::resolve_token(&token);
            match github::read_comments(data["remoteBaseUrl"].as_str().unwrap_or(""), &p, &token) {
                Ok(comments) => {
                    data["stats"]["issueComments"] = json!(comments.len());
                    data["entries"]
                        .as_array_mut()
                        .ok_or("Entrées invalides")?
                        .extend(comments);
                }
                Err(e) => data["stats"]["issuesError"] = json!(e),
            }
        }
        data["stats"]["total"] = json!(data["entries"].as_array().map_or(0, Vec::len));
        Ok(data)
    })
    .await
}
#[tauri::command]
fn preferences(state: State<'_, Shared>) -> Result<Value> {
    Ok(json!({"githubToken":state.lock().map_err(|e|e.to_string())?.settings["githubToken"]}))
}
#[tauri::command]
async fn set_preferences(token: String, state: State<'_, Shared>) -> Result<()> {
    let state = state.inner().clone();
    durable(move || {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        let previous = s.settings.clone();
        s.settings["githubToken"] = json!(token);
        if let Err(e) = s.save_settings() {
            s.settings = previous;
            return Err(e);
        }
        Ok(())
    })
    .await
}
#[tauri::command]
async fn open_link(url: String) -> Result<()> {
    work(move || {
        let parsed = tauri::Url::parse(&url).map_err(|_| "Lien invalide")?;
        if !["https", "http"].contains(&parsed.scheme()) {
            return Err("Seuls les liens HTTP(S) sont autorisés".into());
        }
        webbrowser::open(&url).map_err(|e| e.to_string())
    })
    .await
}
#[tauri::command]
async fn export_file(
    format: String,
    state: State<'_, Shared>,
    content: String,
    table: Value,
    title: String,
) -> Result<Option<String>> {
    let directory = state
        .lock()
        .map_err(|e| e.to_string())?
        .path
        .as_ref()
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf());
    durable(move || {
        if !["csv", "pdf", "md"].contains(&format.as_str()) {
            return Err("Format invalide".into());
        }
        let label = if format == "md" {
            "Markdown".to_owned()
        } else {
            format.to_uppercase()
        };
        let mut dialog =
            rfd::FileDialog::new().set_title(format!("Exporter le journal en {label}"));
        if let Some(directory) = directory {
            dialog = dialog.set_directory(directory);
        }
        let Some(path) = dialog
            .add_filter(&label, &[format.as_str()])
            .set_file_name(format!("journal.{format}"))
            .save_file()
        else {
            return Ok(None);
        };
        let data = if format == "pdf" {
            export::pdf(&title, &table)?
        } else {
            content.into_bytes()
        };
        project::atomic_write(&path, &data)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
}
#[cfg(target_os = "macos")]
fn show_main(app: &tauri::AppHandle) -> Result<()> {
    let window = if let Some(window) = app.get_webview_window("main") {
        window
    } else {
        let config = app
            .config()
            .app
            .windows
            .first()
            .ok_or("Configuration de fenêtre absente")?;
        tauri::WebviewWindowBuilder::from_config(app, config)
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?
    };
    window
        .show()
        .and_then(|_| window.set_focus())
        .map_err(|e| e.to_string())
}

fn main() {
    let context = tauri::generate_context!();
    // GTK 3 on KDE can use GLib's program name for xdg_toplevel.app_id even
    // when GtkApplication has an ID. Set it before GTK creates any window.
    #[cfg(target_os = "linux")]
    glib::set_prgname(Some(context.config().identifier.as_str()));
    let app = tauri::Builder::default()
        .setup(|app| {
            let settings = app.path().app_config_dir()?.join("settings.json");
            let legacy = dirs::config_dir().map(|p| p.join("GitJournal").join("settings.json"));
            let session = session::Session::new(settings, legacy).map_err(std::io::Error::other)?;
            app.manage(Arc::new(Mutex::new(session)));
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
            let item = |id, label, shortcut: Option<&str>| {
                MenuItem::with_id(app, id, label, true, shortcut)
            };
            let export = Submenu::with_items(
                app,
                "Exporter",
                true,
                &[
                    &item("pdf", "En PDF", Some("CmdOrCtrl+E"))?,
                    &item("markdown", "En Markdown", None)?,
                    &item("csv", "En CSV", Some("CmdOrCtrl+Shift+E"))?,
                ],
            )?;
            let file_menu = Submenu::with_items(
                app,
                "Fichier",
                true,
                &[
                    &item("new", "Nouveau projet", Some("CmdOrCtrl+N"))?,
                    &item("open", "Ouvrir un projet", Some("CmdOrCtrl+O"))?,
                    &item("save", "Enregistrer", Some("CmdOrCtrl+S"))?,
                    &export,
                    &item("print", "Imprimer", Some("CmdOrCtrl+P"))?,
                ],
            )?;
            let edit = Submenu::with_items(
                app,
                "Édition",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;
            let theme = Submenu::with_items(
                app,
                "Thème",
                true,
                &[
                    &item("theme-light", "Mode clair", None)?,
                    &item("theme-dark", "Mode sombre", None)?,
                    &item("theme-system", "Mode système", None)?,
                ],
            )?;
            let view = Submenu::with_items(
                app,
                "Affichage",
                true,
                &[
                    &item("refresh", "Actualiser", Some("CmdOrCtrl+R"))?,
                    &theme,
                    &MenuItem::with_id(
                        app,
                        "fullscreen",
                        "Mode plein écran",
                        true,
                        Some(if cfg!(target_os = "macos") {
                            "Cmd+Ctrl+F"
                        } else {
                            "F11"
                        }),
                    )?,
                ],
            )?;
            let token = Submenu::with_items(
                app,
                "Token",
                true,
                &[&item("preferences", "GitHub", Some("CmdOrCtrl+,"))?],
            )?;
            let configuration = Submenu::with_items(
                app,
                "Configuration",
                true,
                &[
                    &token,
                    &item("configure", "Structure JSON", None)?,
                    &item("configure-export", "Structure Export", None)?,
                ],
            )?;
            #[cfg(target_os = "macos")]
            {
                let application = Submenu::with_items(
                    app,
                    "GitJournal",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, None, None)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::quit(app, Some("Quitter"))?,
                    ],
                )?;
                app.set_menu(Menu::with_items(
                    app,
                    &[&application, &file_menu, &edit, &view, &configuration],
                )?)?;
            }
            #[cfg(not(target_os = "macos"))]
            app.set_menu(Menu::with_items(
                app,
                &[&file_menu, &edit, &view, &configuration],
            )?)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                use std::sync::atomic::Ordering::SeqCst;
                if ACTIVE_WRITES.load(SeqCst) > 0 {
                    api.prevent_close();
                    if !CLOSE_QUEUED.swap(true, SeqCst) {
                        let window = window.clone();
                        std::thread::spawn(move || {
                            while ACTIVE_WRITES.load(SeqCst) > 0 {
                                std::thread::sleep(std::time::Duration::from_millis(20));
                            }
                            CLOSE_QUEUED.store(false, SeqCst);
                            let _ = window.close();
                        });
                    }
                }
            }
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "fullscreen" {
                if let Some(window) = app.get_webview_window("main") {
                    let result = window
                        .is_fullscreen()
                        .and_then(|fullscreen| window.set_fullscreen(!fullscreen));
                    if let Err(error) = result {
                        let _ = app.emit("project-error", error.to_string());
                    }
                }
            } else {
                let _ = app.emit("menu-action", event.id().as_ref());
            }
        })
        .invoke_handler(tauri::generate_handler![
            initial_project,
            current_project,
            open_project,
            create_project,
            save_project,
            configure_project,
            update_entry,
            exclude_entry,
            delete_entry,
            journal,
            preferences,
            set_preferences,
            open_link,
            export_file
        ])
        .build(context)
        .expect("Impossible de démarrer GitJournal");
    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { api, code, .. } => {
            #[cfg(target_os = "macos")]
            if code.is_none() {
                api.prevent_exit();
                return;
            }
            #[cfg(not(target_os = "macos"))]
            let _ = code;
            use std::sync::atomic::Ordering::SeqCst;
            if ACTIVE_WRITES.load(SeqCst) > 0 {
                api.prevent_exit();
                let app = app.clone();
                std::thread::spawn(move || {
                    while ACTIVE_WRITES.load(SeqCst) > 0 {
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                    app.exit(0);
                });
            }
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if project_argument(path.as_os_str()).is_some() {
                        let state = app.state::<Shared>();
                        let result = state
                            .lock()
                            .map_err(|e| e.to_string())
                            .and_then(|mut s| s.open(&path));
                        match result {
                            Ok(_) => {
                                #[cfg(target_os = "macos")]
                                if let Err(error) = show_main(app) {
                                    let _ = app.emit("project-error", error);
                                }
                                let _ = app.emit("project-opened", ());
                            }
                            Err(e) => {
                                let _ = app.emit("project-error", e);
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod argument_tests {
    use super::*;
    #[test]
    fn file_associations_accept_paths_and_percent_encoded_uris() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("projet é & '.GITJ");
        let url = tauri::Url::from_file_path(&path).unwrap();
        assert_eq!(project_argument(path.as_os_str()), Some(path.clone()));
        assert_eq!(
            project_argument(std::ffi::OsStr::new(url.as_str())),
            Some(path)
        );
        assert_eq!(
            project_argument(std::ffi::OsStr::new("https://example.invalid/projet.gitj")),
            None
        );
    }
}

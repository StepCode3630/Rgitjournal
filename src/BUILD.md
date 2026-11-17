# Construction et vérifications — GitJournal Tauri

Toutes les commandes partent de la racine du dépôt. Utiliser Node.js 24, pnpm,
Rust stable et Git. Node/pnpm/Rust sont des outils de développement ; le bureau
installé utilise Rust et la webview du système, avec Git et éventuellement `gh`.

## Prérequis de développement

Les prérequis officiels diffèrent selon le système :
https://v2.tauri.app/start/prerequisites/

Sur Fedora (validation locale Fedora 44) :

```bash
sudo dnf install gcc gcc-c++ make pkgconf-pkg-config webkit2gtk4.1-devel openssl-devel librsvg2-devel libappindicator-gtk3-devel libxdo-devel
```

Sur Debian/Ubuntu, consulter la section correspondante de la documentation Tauri :
les noms de paquets diffèrent de ceux de Fedora (WebKitGTK 4.1, outils C/C++, OpenSSL,
Ayatana AppIndicator, librsvg et libxdo).

Sur Windows 10/11 : Microsoft C++ Build Tools, charge de travail C++ pour le bureau,
Rust avec la cible MSVC et WebView2. L’installateur Tauri peut installer WebView2 si absent.
Sur macOS : outils Xcode/Command Line Tools et Rust pour l’architecture ciblée.
Aucun test graphique Windows/macOS n’a été effectué dans cette session Fedora.

```bash
pnpm install
pnpm start
pnpm dev
```

`start` prépare les ressources puis lance Cargo. `dev` utilise le CLI Tauri et surveille
le code Rust. Après une modification des ressources web, relancer `pnpm desktop:prepare`
et actualiser, ou relancer `pnpm dev`. Aucun serveur Node n’est lancé par le bureau.

## Tests

```bash
pnpm test                 # 59 tests JavaScript : CLI, parsing, Markdown et modèle web
pnpm test:rust            # moteur, projets, API simulée, session et PDF
pnpm test:parity          # comparaison réelle JS/Rust sur un dépôt Git temporaire
pnpm desktop:check        # compilation du bureau
cargo fmt --manifest-path crates/journal-core/Cargo.toml --check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Les tests créent puis nettoient leurs données dans des dossiers temporaires.
Les tests HTTP GitHub n’utilisent ni compte réel ni token réel ; ils ouvrent une socket
sur 127.0.0.1. Si un bac à sable interdit ces sockets, exécuter ces tests avec les droits
appropriés plutôt que désactiver les assertions. Avec pnpm configuré pour installer
implicitement avant les scripts, `pnpm --config.verifyDepsBeforeRun=false test` évite
cette installation ; aucune vérification de test n’est contournée.

Pour reproduire les essais graphiques Fedora : installer `python3-gobject`, les bindings
AT-SPI, `libxdo`, `wmctrl` et `poppler-utils`, puis, depuis une session graphique :

```bash
pnpm desktop:prepare
cargo build --manifest-path src-tauri/Cargo.toml
python3 scripts/test-desktop-fedora.py
# ou : python3 scripts/test-desktop-fedora.py src-tauri/target/release/gitjournal-desktop
```

Le script ouvre une fenêtre X11/Xwayland, utilise un dépôt et des préférences isolés,
crée et vérifie un CSV/PDF, ouvre puis annule l’impression, teste l’édition et la restauration.
Il utilise le pointeur/clavier de la session graphique ; le laisser terminer sans saisie concurrente.
Il ne touche pas aux journaux ni aux préférences de l’utilisateur.
Le test PDF Rust vérifie la pagination et, si Poppler est disponible, l’extraction du texte.
L’extraction utilise explicitement `pdftotext -enc UTF-8` pour que la vérification
des accents ne dépende pas de l’encodage par défaut du système ou de l’outil,
notamment sous Windows. Le décodage UTF-8 reste strict.

## Paquets natifs

```bash
pnpm build                # tests puis packaging pour l’hôte
pnpm build:linux          # Linux : .deb et .rpm
pnpm build:mac            # macOS : .app et .dmg
pnpm build:win            # Windows : NSIS et MSI
```

Chaque commande ciblée vérifie le système hôte ; aucune compilation croisée n’est supposée.
Le format DEB/RPM ne garantit pas la compatibilité binaire entre distributions : construire
sur une base compatible avec la cible, puis tester l’installation. Le DEB produit sous Fedora
n’a pas été exécuté sur Debian.
Les paquets sont dans `src-tauri/target/release/bundle/`, et le binaire dans
`src-tauri/target/release/`. La signature Windows/macOS nécessite la configuration du
mainteneur et n’est pas réalisée ici. Aucun script ne publie de paquet ou de release.
L’AppImage reste accessible avec `pnpm exec tauri build --bundles appimage` après préparation
des ressources, mais ce format n’a pas été validé localement.

### Icônes Linux et identité Wayland

Le menu KDE utilise les PNG installés dans les tailles standard de `hicolor`
(32, 48, 128, 256 et 512 pixels). Une taille non déclarée dans l’index du thème
système ne suffit pas à faire reconnaître l’icône.
Le dessin source est `src-tauri/icons/RGitJIcon.svg`. Pour régénérer les PNG
Linux, l’icône de fenêtre et le fichier macOS `RGitJIcon.icns` :

```bash
pnpm icons:generate
```

Le SVG de 516 × 512 est centré dans un carré transparent sans rognage avec
`--fit contain`. Les fichiers intermédiaires sont créés dans un dossier temporaire
puis nettoyés ; seules les ressources de bureau nécessaires sont copiées dans
`src-tauri/icons/`. Les fichiers fournis dans `src/assets/` ne sont pas réécrits :
`icon.ico` est utilisé pour Windows, et `icon.png` reste le PNG source fourni.
Le PNG carré de 512 pixels sert d’icône de fenêtre Tauri. Les ressources générées
sont versionnées pour que la compilation ne nécessite pas de les régénérer.

Le lanceur visible est `com.gitjournal.desktop.desktop` : son nom sans le dernier
`.desktop` correspond à l’identifiant `com.gitjournal.desktop`. Le nom de programme
GLib est fixé avant l’initialisation GTK, en plus de `enableGTKAppId`, pour que
GTK 3 annonce cet identifiant à KDE via Wayland. `StartupWMClass` garde la même
valeur pour X11/Xwayland. L’ancien `GitJournal.desktop` est conservé avec
`NoDisplay=true` pour les raccourcis existants, sans deuxième entrée dans le menu.
La dépendance Linux directe `glib` réutilise la version déjà présente via GTK.

Sur Fedora, avec PySide6 (`python3-pyside6`) et `desktop-file-utils`, vérifier le
contenu préparé du DEB et lancer brièvement le binaire en **Wayland natif** :

```bash
python3 scripts/test-linux-icons.py src-tauri/target/release/bundle/deb/GitJournal_4.1.1_amd64/data src-tauri/target/release/gitjournal-desktop
```

Adapter le chemin à la version et à l’architecture construites. Le script vérifie
la résolution réelle de l’icône avec Qt et l’`app_id` envoyé au compositeur.
Il utilise des préférences, un thème de test et un bus D-Bus temporaires ;
il ne réécrit pas les préférences de l’utilisateur. Sans le dernier argument,
il vérifie uniquement les lanceurs et les icônes du paquet extrait.

Après remplacement d’une icône sous le même nom, `kbuildsycoca6` recharge les
lanceurs mais ne suffit pas toujours à rafraîchir les images conservées en mémoire
par Plasma. Depuis la session KDE, envoyer également le signal
`dbus-send --session --type=signal /KIconLoader org.kde.KIconLoader.iconChanged int32:0`.
Il utilise le mécanisme de rechargement de [KIconLoader](https://api.kde.org/kiconloader.html),
sans suppression de cache ni redémarrage de Plasma.

La CI `.github/workflows/desktop.yml` compile et teste sur Linux, Windows et macOS.
Sa matrice utilise `ubuntu-24.04`, `windows-latest` et `macos-15` (Apple Silicon).
Le runner `macos-14` a été remplacé après son
[retrait par GitHub le 2 novembre 2026](https://github.blog/changelog/2026-10-01-github-actions-macos-14-runner-image-retirement/).
Cette matrice ne couvre pas les Mac Intel ; ils nécessitent une validation distincte.
Elle ne déclenche aucun déploiement ni publication et n’a pas été exécutée depuis cette session.

## Dépendances et versions

Tauri gère fenêtres, menus et IPC ; rfd utilise les dialogues GTK sous Linux et les dialogues
natifs Windows/macOS ; reqwest/rustls lit GitHub ; tempfile assure les écritures atomiques ;
chrono valide les dates. printpdf produit le PDF sans navigateur auxiliaire ; Noto Sans est
embarquée avec sa licence OFL, et fontdb/ttf-parser permettent le repli sur les polices système.
Le frontend conserve la sémantique JavaScript des regex et partage le filtre de descriptions
avec le moteur CLI lors de la préparation des ressources.

La version du produit figure dans `package.json`, `src-tauri/Cargo.toml` et
`src-tauri/tauri.conf.json` et le pied de page de `desktop/index.html` : les mettre à jour ensemble. `src/version.js` lit `package.json`
pour la CLI. Les deux `Cargo.lock` et `pnpm-lock.yaml` sont versionnés ; pnpm est le
gestionnaire JavaScript retenu.

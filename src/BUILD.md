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
pnpm test                 # 56 tests JavaScript : CLI, parsing, Markdown et modèle web
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

# GitJournal

Application de bureau Tauri/Rust pour générer un journal de travail à partir des commits Git locaux et des commentaires d'issues GitHub.

Le même moteur est disponible en ligne de commande et comme GitHub Action, pour tenir un `journal.md` à jour automatiquement (voir [Journal automatique avec GitHub Actions](#journal-automatique-avec-github-actions)).

## Installer l’application

L’application installée ne nécessite ni Node.js, ni pnpm, ni Rust, ni Electron.
**Git doit être installé et accessible à l’application** pour lire les commits locaux.
Choisir un paquet correspondant au système et à l’architecture de la machine
(`x64`/`amd64`/`x86_64` pour Intel/AMD 64 bits, `arm64`/`aarch64` pour ARM).

Les installateurs sont produits par les commandes de compilation décrites plus bas,
dans `src-tauri/target/release/bundle/`. Ce dépôt ne publie pas automatiquement de
paquets : si vous n’avez pas reçu d’installateur, suivre **Compiler depuis les sources**.
La CI actuelle vérifie la compilation et les tests, sans fournir d’installateurs.

| Système | Format | Sous-dossier de sortie |
|---|---|---|
| Windows 10/11 | Installateur NSIS `.exe` ou Windows Installer `.msi` | `nsis/` ou `msi/` |
| macOS | Image `.dmg` ou application `.app` | `dmg/` ou `macos/` |
| Fedora et dérivées compatibles | Paquet `.rpm` | `rpm/` |
| Debian/Ubuntu et dérivées compatibles | Paquet `.deb` | `deb/` |

### Windows 10 et Windows 11

1. Installer [Git pour Windows](https://git-scm.com/downloads/win), avec Git accessible
   depuis les applications, puis vérifier `git --version` dans un nouveau terminal.
2. Exécuter l’installateur GitJournal `.exe` ou `.msi` et suivre l’assistant.
3. Si nécessaire, installer le [runtime Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/).
   L’installateur Tauri peut le télécharger s’il manque ; une connexion Internet est alors nécessaire.
4. Ouvrir **GitJournal** depuis le menu Démarrer.

### macOS

1. Vérifier `git --version` dans Terminal. Si Git manque, installer les outils Apple
   avec `xcode-select --install`, puis terminer leur installation.
2. Ouvrir le `.dmg`, puis glisser **GitJournal.app** dans **Applications**.
   Si vous disposez directement du `.app`, le copier dans **Applications**.
3. Lancer GitJournal depuis **Applications**.

Utiliser un paquet construit pour votre Mac : Apple Silicon ou Intel.
La signature et la notarisation macOS ne sont pas configurées dans le projet ;
un paquet local non signé peut être bloqué par macOS.

### Fedora

Depuis le dossier contenant le RPM, remplacer `GitJournal-VERSION-ARCH.rpm`
par son nom exact :

```bash
sudo dnf install ./GitJournal-VERSION-ARCH.rpm
```

DNF installe aussi les dépendances déclarées, dont Git, GTK et WebKitGTK.
Lancer ensuite **GitJournal** depuis le menu des applications, ou avec
`gitjournal-desktop` dans un terminal.

### Debian et Ubuntu

Depuis le dossier contenant le DEB, remplacer `GitJournal_VERSION_ARCH.deb`
par son nom exact :

```bash
sudo apt update
sudo apt install ./GitJournal_VERSION_ARCH.deb
```

APT installe les dépendances déclarées, dont Git, GTK et WebKitGTK 4.1.
Lancer ensuite **GitJournal** depuis le menu des applications, ou avec
`gitjournal-desktop` dans un terminal.

Le paquet doit être construit sur une base compatible avec la distribution cible.
Un DEB construit sous Fedora ne constitue pas une validation de compatibilité Debian.
Les autres distributions Linux nécessitent un paquet et des bibliothèques adaptés ;
aucune installation universelle Linux n’est fournie.

### Ouvrir votre journal après installation

Dans GitJournal, choisir **Fichier > Ouvrir projet** (`Ctrl+O`, ou `Cmd+O` sur macOS),
puis sélectionner le `.gitj` situé dans le dépôt local, y compris dans un sous-dossier
comme `doc/Journal/p_fun.gitj`. Aucun accès GitHub n’est nécessaire pour lire les commits.

### État des validations

L’application a été exécutée sous **Fedora 44 x86_64**. Les paquets RPM et DEB ont été
construits et inspectés, mais leur installation n’a pas été testée. Les installations
Windows, macOS et Debian/Ubuntu restent à valider ; les instructions correspondantes
s’appuient sur les formats configurés et la documentation Tauri.
Références : [installateurs Windows](https://v2.tauri.app/distribute/windows-installer/),
[DMG macOS](https://v2.tauri.app/distribute/dmg/) et
[paquets Debian](https://v2.tauri.app/distribute/debian/).

## Compiler depuis les sources

La compilation se fait sur le système cible : Windows pour Windows, macOS pour macOS,
Linux pour Linux. Les scripts du projet ne configurent pas de compilation croisée.

### 1. Installer les outils de développement

Installer [Node.js 24](https://nodejs.org/), [pnpm](https://pnpm.io/installation),
[Rust stable avec Cargo](https://www.rust-lang.org/tools/install) et Git.
Vérifier qu’ils sont accessibles avec `node --version`, `pnpm --version`,
`cargo --version` et `git --version`.

Ajouter les dépendances propres au système :

- **Windows** : Microsoft C++ Build Tools avec la charge **Développement Desktop en C++**,
  Rust avec la cible MSVC et WebView2. La génération du MSI nécessite aussi la
  fonctionnalité Windows VBScript.
- **macOS** : outils Xcode Command Line Tools (`xcode-select --install`).
- **Fedora** : installer les paquets ci-dessous.

```bash
sudo dnf install git gcc gcc-c++ make pkgconf-pkg-config webkit2gtk4.1-devel openssl-devel librsvg2-devel libappindicator-gtk3-devel libxdo-devel
```

Sur **Debian/Ubuntu**, utiliser :

```bash
sudo apt update
sudo apt install git build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev libxdo-dev
```

Les noms et la disponibilité des paquets dépendent de la version de la distribution.
Consulter les [prérequis officiels Tauri](https://v2.tauri.app/start/prerequisites/)
et [src/BUILD.md](src/BUILD.md) pour les détails.

### 2. Préparer et lancer le projet

Depuis la racine de votre copie des sources :

```bash
pnpm install
pnpm start
```

`pnpm start` lance l’application en développement ; cette commande ne l’installe pas
dans le système.

### 3. Construire et installer un paquet

Exécuter la commande correspondant au système de compilation :

```bash
pnpm build:win    # depuis Windows : .exe et .msi
pnpm build:mac    # depuis macOS : .app et .dmg
pnpm build:linux  # depuis Linux : .deb et .rpm
```

Chaque commande lance les tests avant de construire les paquets. Choisir ensuite
l’artefact dans `src-tauri/target/release/bundle/` et suivre les instructions
d’installation de votre système ci-dessus. Reconstruire le paquet après une mise
à jour des sources pour inclure les dernières corrections.

## Utilisation

### Créer un nouveau projet

1. Menu : **Fichier > Nouveau projet** (`Cmd+N` / `Ctrl+N`)
2. Choisir où sauvegarder le fichier `.gitj` — **dans le dépôt Git à analyser, à la racine ou dans un sous-dossier**, par exemple `doc/Journal/mon-projet.gitj`
3. Remplir le formulaire :
   - **Nom du projet** : affiché dans le journal et l'export
   - **Nom(s) d'utilisateur Git** : valeur(s) qui apparaissent dans `git log --author=…` (filtre vos commits). Séparer plusieurs noms par une virgule ou un point-virgule.
   - **Date de début** : optionnel, ignore les commits antérieurs

> Git retrouve le dépôt parent à partir du dossier du fichier `.gitj`. Les commits sont lus localement, sans téléchargement depuis GitHub. L'URL des liens de commits est détectée via `git remote get-url origin`.

### Format du fichier `.gitj`

```json
{
  "projectName": "Mon Projet",
  "me": ["Prénom Nom", "username"],
  "journalStartDate": "2024-01-01T00:00:00.000Z",
  "columns": [
    { "label": "Date", "source": "date", "format": "date", "field": "date" },
    { "label": "Tâche", "source": "name", "field": "name" },
    { "label": "Activité", "source": "activity", "field": "activity", "type": "select", "values": ["dev", "spec", "GP"] },
    { "label": "Description", "source": "description", "field": "description" },
    { "label": "Durée", "source": "duration", "format": "duration", "field": "duration" },
    { "label": "Statut", "source": "status", "format": "badge", "field": "status" },
    { "label": "Auteur", "source": "author" }
  ],
  "exceptions": []
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `projectName` | oui | Nom affiché dans le journal |
| `me` | oui | Nom d'auteur git, ou liste de noms, pour filtrer vos commits |
| `journalStartDate` | non | Date de début, format ISO 8601 |
| `columns` | non pour les anciens fichiers | Colonnes affichées ; le bureau utilise les colonnes standard si ce champ est absent |
| `exceptions` | oui | Entrées manuelles et modifications de commits |
| `includeIssues` | non | `true` pour ajouter les commentaires d'issues dans l'application (défaut : `false`) |
| `githubUsers` | non | Logins GitHub supplémentaires pour filtrer les commentaires d'issues |

> L'application scanne toutes les branches automatiquement (`git log --all`).

### Colonnes personnalisées

La propriété `columns` permet d'ajouter des colonnes au journal. Pour une colonne personnalisée éditable, utiliser le même nom libre dans `source` et `field` :

```json
{ "label": "Activité", "source": "activity", "field": "activity" }
```

Pour afficher une liste déroulante dans le formulaire d'ajout ou de modification, ajouter `type: "select"` ou `type: "dropdown"` avec les valeurs autorisées :

```json
{ "label": "Activité", "source": "activity", "field": "activity", "type": "select", "values": ["dev", "spec", "GP"] }
```

`options` peut aussi être utilisé à la place de `values`.

### Ouvrir un projet existant

Menu : **Fichier > Ouvrir projet** (`Cmd+O` / `Ctrl+O`)

Vous pouvez ouvrir un fichier placé dans un sous-dossier, par exemple
`P_FUN/doc/Journal/p_fun.gitj`. Les anciens fichiers sans `columns` sont pris en
charge : les colonnes standard sont ajoutées en mémoire, puis enregistrées lors
de la prochaine sauvegarde ou modification. L’ouverture seule ne réécrit pas le
fichier. Les propriétés historiques `repoUrl` et `branch` sont conservées ; elles
ne remplacent pas la lecture des commits du dépôt local contenant le fichier.
Les dates d’entrées anciennes sans fuseau (`2026-01-02T12:34`) sont également
acceptées et conservées ; elles sont interprétées dans le fuseau de la machine.

### Format des messages de commit

L'application extrait les métadonnées entre crochets **n'importe où** dans le message :

```
feat: add login [30m done]
```

ou sur une ligne séparée :

```
feat: add login
[30m done]
Description détaillée...
```

**Format compact (crochet unique) :**

| Syntaxe | Résultat |
|---|---|
| `[2h30]` ou `[2h30m]` | 2h30 |
| `[45m]` | 45 minutes |
| `[1h]` | 1 heure |
| `[5]` | 5 minutes (unité implicite) |
| `[2h30 done]` | 2h30, statut Done |
| `[45m wip]` | 45 min, statut WIP |

**Format classique (multi-crochets) :**

| Syntaxe | Résultat |
|---|---|
| `[2][30]` | 2h30 |
| `[90]` | 90 minutes |
| `[Done]` / `[WIP]` | statut |

### Commentaires d'issues

Les commentaires d'issues et de pull requests suivent le même formalisme que les commits :

```
[45m done] Tests concluants sur la régulation
```

Seuls les crochets commençant par un chiffre sont reconnus dans les commentaires, pour ne pas confondre les métadonnées avec les liens `[texte](url)` ou les cases à cocher `- [x]`.

Contrairement aux commits, **tous les commentaires sont inclus**, même sans durée : le journal sert aussi à retrouver ce qui a été discuté.

Les commentaires sont filtrés par auteur : leur login GitHub doit figurer dans `me` ou dans `githubUsers` (sans `.gitj`, tous les auteurs sont pris en compte).

Dans l'application, activer `"includeIssues": true` dans le `.gitj`. Le token GitHub se définit dans **Préférences** (token fine-grained avec la permission *Issues : Read-only*) ; à défaut, il est lu dans `GH_TOKEN` / `GITHUB_TOKEN`, puis via `gh auth token` (GitHub CLI). Un dépôt public fonctionne sans token, dans la limite de 60 requêtes par heure.

Les commentaires ne peuvent pas être modifiés ni exclus dans GitJournal (les exceptions du `.gitj` ne s'appliquent qu'aux commits) : pour corriger un commentaire, le modifier sur GitHub.

### Ajouter une entrée manuelle

1. Cliquer sur le bouton **+** en bas du tableau
2. Choisir la date avec le calendrier, puis l’heure locale dans le champ séparé.
3. Saisir la tâche ; le menu de préfixes propose `feat`, `fix`, `docs`, `chore`, etc.
   Le préfixe est facultatif et le texte reste libre. Changer le préfixe conserve
   un éventuel scope, par exemple `feat(interface): ...` devient `fix(interface): ...`.
4. Ajouter la description et la **durée en minutes** (par exemple `30`).
5. Choisir obligatoirement le statut **Done** ou **WIP**.
6. Cliquer sur **Enregistrer**.

Ces contrôles s’appliquent aussi à la modification d’une entrée. Les anciens statuts
`DONE` ou `done` sont présentés comme `Done` ; un autre statut doit être remplacé
par l’un des deux choix lors de l’enregistrement. Les entrées existantes restent
inchangées tant qu’elles ne sont pas enregistrées.

### Modifier ou exclure une entrée

Cliquer sur une ligne du tableau pour ouvrir le formulaire de modification.

- **Enregistrer** : sauvegarde les modifications
- **Exclure** : retire un commit du journal (sans le supprimer de Git)
- **Supprimer** : supprime une entrée manuelle

### Exporter

| Action | Raccourci |
|---|---|
| Exporter en PDF | `Cmd+E` / `Ctrl+E` |
| Exporter en CSV | `Cmd+Shift+E` / `Ctrl+Shift+E` |
| Imprimer | `Cmd+P` / `Ctrl+P` |

Le CSV reprend les colonnes et le texte affichés, en UTF-8 avec BOM et fins de ligne CRLF.
Le PDF est généré en Rust au format A4 paysage, avec pagination et en-têtes répétés.
L’impression passe par le dialogue système ; aucune impression n’est lancée sans confirmation.

### Sauvegarder

Menu : **Fichier > Enregistrer** (`Cmd+S` / `Ctrl+S`)

Les ajouts, modifications, exclusions et suppressions sont enregistrés immédiatement.
En cas d’échec d’écriture, l’erreur reste visible et l’état enregistré n’est pas remplacé.
Les écritures utilisent un temporaire dans le dossier cible et la fermeture attend les écritures en cours.
Le menu **Configuration** permet d’éditer le JSON du `.gitj`, y compris les colonnes personnalisées.

## Journal automatique avec GitHub Actions

GitJournal peut générer un journal Markdown dans le dépôt à journaliser, à chaque push (toutes branches), à chaque commentaire ou modification d'issue, ou manuellement.

Copier [doc/journal-workflow.yml](doc/journal-workflow.yml) dans `.github/workflows/journal.yml` du dépôt à journaliser. Le journal :

- rassemble les commits de **toutes les branches** (dédupliqués par SHA, avec le nom de la branche) et les commentaires d'issues ;
- est regroupé par jour (fuseau `Europe/Zurich`), du plus récent au plus ancien ;
- est écrit sur la branche par défaut, même quand le push concerne `develop`. Si `main` exige des pull requests, ajouter **GitHub Actions** aux exceptions (*Bypass list*) de la règle, ou écrire le journal sur une branche dédiée avec `branch: journal` ;
- utilise le `.gitj` à la racine du dépôt s'il existe (filtre d'auteur, date de début, exclusions de commits, entrées manuelles).

Le commit du journal est fait avec `GITHUB_TOKEN`, il ne redéclenche donc pas le workflow.

Paramètres de l'action (`with:`) :

| Paramètre | Défaut | Description |
|---|---|---|
| `output` | nom du `.gitj` en `.md` (`journal.md` sans `.gitj`) | Fichier généré |
| `gitj` | premier `*.gitj` à la racine | Configuration à utiliser |
| `timezone` | `Europe/Zurich` | Fuseau pour le regroupement par jour |
| `issues` | `true` | Inclure les commentaires d'issues |
| `commit` | `true` | Committer et pousser le journal |
| `branch` | branche extraite | Branche où committer le journal (créée si absente) |
| `commit-message` | `docs: update work journal` | Message du commit |

### En ligne de commande

```bash
node src/cli.js --repo ../mon-depot --output - # affiche le journal
node src/cli.js --help
```

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Cmd/Ctrl + N` | Nouveau projet |
| `Cmd/Ctrl + O` | Ouvrir projet |
| `Cmd/Ctrl + S` | Enregistrer |
| `Cmd/Ctrl + E` | Exporter en PDF |
| `Cmd/Ctrl + Shift + E` | Exporter en CSV |
| `Cmd/Ctrl + P` | Imprimer |
| `Cmd/Ctrl + R` | Actualiser |
| `Cmd/Ctrl + +/-` | Zoom |

## Versionner vos projets

Les fichiers `.gitj` peuvent être versionnés avec Git :

```bash
git add mon-projet.gitj
git commit -m "Mise à jour du journal"
git push
```

## Développement et build

Voir [src/BUILD.md](src/BUILD.md) pour les instructions détaillées.

```bash
pnpm dev          # mode développement Tauri
pnpm test         # lancer les tests
pnpm build        # build pour la plateforme courante
pnpm build:mac    # .app / .dmg, depuis macOS
pnpm build:win    # NSIS / MSI, depuis Windows
pnpm build:linux  # .deb / .rpm, depuis Linux
```

Les artefacts sont générés dans `src-tauri/target/release/bundle/`.

## Structure du projet

- `crates/journal-core/` : parsing, collecte Git, exceptions, projets et commentaires GitHub en Rust.
- `src-tauri/` : fenêtre, menus, commandes IPC, préférences, dialogues et export PDF.
- `desktop/` : interface HTML/CSS/JavaScript statique, sans serveur HTTP.
- `scripts/` : préparation des ressources, packaging natif et vérifications de parité.
- `src/cli.js` et `src/server/lib/` : CLI et moteur JavaScript conservés pour GitHub Actions.
- `doc/tauri-parity.md` : critères, preuves de validation et limites de plateforme.

## Dépannage

### L'app ne démarre pas

- Vérifier que les dépendances sont installées (`pnpm install` à la racine)
- Consulter les erreurs du terminal (`pnpm start`) et vérifier les prérequis système

### Icône absente dans KDE Plasma sous Wayland

Installer le paquet reconstruit après la correction des icônes. Pour remplacer
un RPM déjà installé de même version, depuis le dossier contenant ce paquet :

```bash
sudo dnf reinstall ./GitJournal-VERSION-ARCH.rpm
kbuildsycoca6 --noincremental
```

Remplacer le nom du RPM par son nom exact. Fermer puis relancer GitJournal depuis
le menu. Si une ancienne icône reste épinglée à la barre des tâches, la désépingler
puis épingler la nouvelle entrée **GitJournal**. Les fichiers `.gitj` et les
préférences sont conservés.

Les paquets installent les tailles d’icône usuelles et le lanceur correspondant
à l’identifiant Wayland. Voir [les vérifications Linux](src/BUILD.md#icônes-linux-et-identité-wayland).

### Le journal est vide

- Vérifier que le fichier `.gitj` est bien placé **dans le dépôt Git**, à la racine ou dans un sous-dossier
- Vérifier que le champ `me` correspond exactement au nom d'auteur dans vos commits (`git log --author=…`)
- Vérifier que vos commits contiennent une durée entre crochets

### Pas de liens GitHub dans le tableau

- Vérifier que le dépôt a un remote `origin` pointant vers GitHub (`git remote -v`)

## Support

Pour rapporter un bug ou demander une fonctionnalité, créer une issue sur GitHub.

## Préférences et compatibilité

Les fichiers `.gitj` existants sont conservés, y compris leurs champs personnalisés.
Les préférences Tauri sont dans le dossier de configuration de `com.gitjournal.desktop`.
Au premier lancement, les anciennes préférences Electron de `GitJournal/settings.json`
sont lues si aucune préférence Tauri n’existe. Le fichier d’origine reste intact.
La priorité du token reste : préférences, `GH_TOKEN`, `GITHUB_TOKEN`, puis `gh auth token`.

Les expressions régulières de colonnes restent exécutées en JavaScript, ce qui
préserve les options et groupes de capture existants. Les erreurs Git sont désormais
signalées explicitement au lieu de produire silencieusement un journal vide.
Le regroupement du bureau reste en UTC ; le Markdown CLI garde son fuseau configurable.

Pour les PDF, Noto Sans est embarquée sous licence OFL. Les autres caractères utilisent
les polices système disponibles. Une police manquante produit une erreur explicite,
avec possibilité d’utiliser le rendu système via **Imprimer**.

Fedora 44 a été testé localement. Windows/macOS disposent d’une CI de compilation et
de tests, sans publication ; son exécution et les essais graphiques natifs restent à faire.

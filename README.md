# <img src="src/assets/icon.png" alt="" width="48" /> RGitJournal

Application de bureau pour tenir un journal de travail à partir des commits
d’un dépôt Git local, d’entrées manuelles et de commentaires GitHub facultatifs.
Le bureau exporte en PDF, Markdown et CSV. La CLI et l’action GitHub peuvent
générer un journal Markdown automatiquement.

RGitJournal est un fork du projet '[gitjournal](https://github.com/ETML-INF/gitjournal)' basé sur la version 4.1.1.

## Table des matières

- [ RGitJournal](#-rgitjournal)
  - [Table des matières](#table-des-matières)
  - [Installer l’application](#installer-lapplication)
    - [Windows 10 et Windows 11](#windows-10-et-windows-11)
    - [macOS sur Apple Silicon](#macos-sur-apple-silicon)
    - [Fedora](#fedora)
    - [Ubuntu et Debian](#ubuntu-et-debian)
    - [Lancer sans installation](#lancer-sans-installation)
    - [Mettre à jour](#mettre-à-jour)
  - [Désinstaller](#désinstaller)
  - [Compiler depuis les sources](#compiler-depuis-les-sources)
    - [1. Installer les outils de développement](#1-installer-les-outils-de-développement)
    - [2. Préparer et lancer le projet](#2-préparer-et-lancer-le-projet)
    - [3. Construire et installer un paquet](#3-construire-et-installer-un-paquet)
  - [Utilisation](#utilisation)
    - [Créer un nouveau projet](#créer-un-nouveau-projet)
    - [Format du fichier `.gitj`](#format-du-fichier-gitj)
    - [Colonnes personnalisées](#colonnes-personnalisées)
    - [Ouvrir un projet existant](#ouvrir-un-projet-existant)
    - [Format des messages de commit](#format-des-messages-de-commit)
    - [Commentaires d'issues](#commentaires-dissues)
    - [Ajouter une entrée manuelle](#ajouter-une-entrée-manuelle)
    - [Modifier ou exclure une entrée](#modifier-ou-exclure-une-entrée)
    - [Consulter le journal et les statistiques](#consulter-le-journal-et-les-statistiques)
    - [Exporter](#exporter)
    - [Sauvegarder](#sauvegarder)
  - [Journal automatique avec GitHub Actions](#journal-automatique-avec-github-actions)
    - [En ligne de commande](#en-ligne-de-commande)
  - [Raccourcis clavier](#raccourcis-clavier)
  - [Versionner vos projets](#versionner-vos-projets)
  - [Tests](#tests)
  - [Préparer et publier une version](#préparer-et-publier-une-version)
  - [Contribuer](#contribuer)
  - [Structure du projet](#structure-du-projet)
  - [Dépannage](#dépannage)
    - [L'app ne démarre pas](#lapp-ne-démarre-pas)
    - [Icône absente dans KDE Plasma sous Wayland](#icône-absente-dans-kde-plasma-sous-wayland)
    - [Le journal est vide](#le-journal-est-vide)
    - [Pas de liens GitHub dans le tableau](#pas-de-liens-github-dans-le-tableau)
  - [Préférences et compatibilité](#préférences-et-compatibilité)

## Installer l’application

Ouvrir [GitHub Releases](https://github.com/StepCode3630/Rgitjournal/releases)
et choisir la version souhaitée. Dans **Assets**, télécharger le paquet adapté
à votre système.

| Système                                                 | Architecture          | Fichier à télécharger                       |
| ------------------------------------------------------- | --------------------- | ------------------------------------------- |
| Windows 10 ou 11                                        | x64 (Intel/AMD)       | `.exe` (NSIS) ou `.msi` (Windows Installer) |
| macOS                                                   | Apple Silicon (arm64) | `.dmg`                                      |
| Fedora                                                  | x64 (x86_64)          | `.rpm`                                      |
| Ubuntu ou Debian compatible avec la base de compilation | x64 (amd64)           | `.deb`                                      |

Les liens **Source code (zip)** et **Source code (tar.gz)** contiennent le code
du tag pour compiler l’application. GitHub les ajoute à chaque release.
La compilation Linux de publication utilise Ubuntu 24.04. La distribution
cible doit fournir WebKitGTK 4.1, GTK 3 et une version compatible de glibc.
[Archives de GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
· [Compatibilité des paquets Linux Tauri](https://v2.tauri.app/distribute/rpm/#limitations)

Git doit être installé et accessible à l’application pour lire les commits.
L’installation des paquets de bureau fonctionne sans Node.js, pnpm ni Rust.

### Windows 10 et Windows 11

1. Installer [Git pour Windows](https://git-scm.com/downloads/win), puis vérifier
   que `git --version` fonctionne dans un nouveau terminal.
2. Ouvrir le `.exe` ou le `.msi` téléchargé et suivre l’assistant. L’installateur
   peut télécharger WebView2 si le runtime est absent. Le runtime est aussi
   disponible auprès de Microsoft. [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)
3. Si SmartScreen affiche **Windows a protégé votre ordinateur**, vérifier que
   le fichier provient de la page Releases du projet. Si vous faites confiance
   au fichier, choisir **Informations complémentaires → Exécuter quand même**
   lorsque le bouton est disponible. Smart App Control ou une politique
   d’entreprise peut bloquer un installateur non signé.
   [SmartScreen](https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/development/ie-mode-blocks-addon)
   · [Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview)
4. Lancer **RGitJournal** depuis le menu Démarrer.

### macOS sur Apple Silicon

1. Vérifier `git --version` dans Terminal. Si Git manque, installer les outils
   de ligne de commande Apple avec `xcode-select --install`.
2. Ouvrir le `.dmg`, glisser **RGitJournal.app** dans **Applications**, puis
   essayer d’ouvrir l’application depuis ce dossier.
3. Si macOS indique qu’il ne peut pas vérifier le développeur, vérifier la
   provenance du fichier. Ouvrir **Réglages Système → Confidentialité et
   sécurité**, descendre à la section **Sécurité**, choisir **Ouvrir quand même**
   et confirmer l’ouverture. Ce bouton apparaît après la première tentative
   de lancement et reste disponible un temps limité. [Procédure Apple](https://support.apple.com/fr-fr/102445)

Le paquet Apple Silicon porte une signature ad hoc et reste sans certificat
Developer ID ni notarisation. L’autorisation ci-dessus s’applique à
RGitJournal. [Signature ad hoc dans Tauri](https://v2.tauri.app/distribute/sign/macos/#ad-hoc-signing)

### Fedora

Depuis le dossier de téléchargement, remplacer le nom d’exemple par celui
du RPM téléchargé.

```bash
sudo dnf install ./RGitJournal-VERSION-1.x86_64.rpm
```

Lancer **RGitJournal** depuis le menu des applications ou avec
`gitjournal-desktop`.

### Ubuntu et Debian

Depuis le dossier de téléchargement, remplacer le nom d’exemple par celui
du DEB téléchargé.

```bash
sudo apt update
sudo apt install ./RGitJournal_VERSION_amd64.deb
```

Lancer **RGitJournal** depuis le menu des applications ou avec
`gitjournal-desktop`. Si la distribution cible ne satisfait pas les
dépendances du DEB, utiliser une base compatible ou compiler sur la cible.

### Lancer sans installation

Dans les fichiers de la release, choisir celui qui se termine par le suffixe
correspondant à votre système.

| Système | Fichier | Lancement |
| --- | --- | --- |
| Windows x64 | `windows-x64-portable.exe` | Ouvrir directement le fichier. Git et le runtime WebView2 doivent être installés. |
| Linux x64 | `linux-x64-portable.tar.gz` | Extraire l’archive, puis lancer `./gitjournal-desktop` dans le dossier d’extraction. Git, GTK 3 et WebKitGTK 4.1 doivent être disponibles. |
| macOS Apple Silicon | `macos-arm64-portable.zip` | Extraire l’archive, puis ouvrir `RGitJournal.app` depuis le Finder. Les instructions d’autorisation macOS ci-dessus s’appliquent aussi à cette version. |

Ces versions utilisent le dossier de préférences habituel de l’application.

### Mettre à jour

Pour passer d’une installation de GitJournal 4.1.1 à RGitJournal 1.0.0,
désinstaller d’abord l’ancienne application avec l’outil utilisé pour l’installer,
puis installer le nouveau paquet. Si l’assistant de désinstallation propose de
supprimer les données utilisateur, choisir de les conserver.

Télécharger le nouveau paquet de la même plateforme depuis Releases et
relancer l’installation. Sur macOS, remplacer l’ancienne application dans
**Applications** quand le Finder le propose. Les fichiers `.gitj` restent
dans les dépôts où ils ont été enregistrés.

## Désinstaller

| Système          | Étape                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Windows          | Ouvrir **Paramètres → Applications**, sélectionner **RGitJournal**, puis **Désinstaller**.  |
| macOS            | Quitter RGitJournal, puis placer **RGitJournal.app** de **Applications** dans la Corbeille. |
| Fedora           | Exécuter `sudo dnf remove r-git-journal`.                                                   |
| Ubuntu ou Debian | Exécuter `sudo apt remove r-git-journal`.                                                   |

Les fichiers `.gitj` restent dans vos dépôts. Les préférences locales sont
décrites dans [Préférences et compatibilité](#préférences-et-compatibilité).

## Compiler depuis les sources

La compilation se fait sur le système cible : Windows pour Windows, macOS pour macOS,
Linux pour Linux. Les scripts du projet ne configurent pas de compilation croisée.
Télécharger une archive source depuis Releases ou cloner le dépôt.

### 1. Installer les outils de développement

Installer [Node.js 24](https://nodejs.org/), [pnpm 12](https://pnpm.io/installation),
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
pnpm install --frozen-lockfile
pnpm start
```

`pnpm start` prépare les ressources et lance l’application depuis les sources.
`pnpm dev` lance le mode développement du CLI Tauri.

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

La barre de menus native regroupe **Fichier**, **Édition**, **Affichage**
et **Configuration**. Au-dessus du journal, à droite, le graphique ouvre
**Statistiques** et le bouton **?** ouvre **Aide**. Pour exporter un rapport,
ouvrir **Fichier → Exporter** et choisir **En PDF**, **En Markdown** ou **En CSV**.

Dans **Affichage → Thème**, choisir **Mode clair** (par défaut), **Mode sombre**
ou **Mode système**. Le mode système suit l’apparence détectée par la vue web.
Le choix est mémorisé pour les prochains lancements. L’impression utilise le thème clair.
**Affichage → Mode plein écran** permet d’entrer et de sortir du plein écran.

**Configuration → Token → GitHub** ouvre le réglage du jeton.
**Configuration → Structure JSON** ouvre le fichier projet dans l’éditeur intégré.

### Créer un nouveau projet

1. Menu : **Fichier > Nouveau projet** (`Cmd+N` / `Ctrl+N`)
2. Remplir le formulaire :
   - **Nom du projet** : affiché dans le journal et l'export
   - **Nom(s) d'utilisateur Git** : valeur(s) qui apparaissent dans `git log --author=…` (filtre vos commits). Séparer plusieurs noms par une virgule ou un point-virgule.
   - **URL du dépôt Git** (facultative) pour ouvrir les commits dans un navigateur, par exemple `https://gitlab.com/groupe/projet`.
   - **Date de début** : optionnel, ignore les commits antérieurs
3. Enregistrer le fichier `.gitj` dans le dépôt local, à la racine ou dans un sous-dossier.

> Git retrouve le dépôt parent à partir du dossier du fichier `.gitj`. Les commits sont lus localement, sans téléchargement depuis GitHub. Les liens utilisent l’URL saisie ou, à défaut, celle du remote local `origin`. Sans l’une de ces adresses, les commits restent consultables dans le journal.

### Format du fichier `.gitj`

```json
{
  "projectName": "Mon Projet",
  "me": ["Prénom Nom", "username"],
  "journalStartDate": "2024-01-01T00:00:00.000Z",
  "columns": [
    { "label": "Date", "source": "date", "format": "date", "field": "date" },
    { "label": "Tâche", "source": "name", "field": "name" },
    {
      "label": "Activité",
      "source": "activity",
      "field": "activity",
      "type": "select",
      "values": ["dev", "spec", "GP"]
    },
    { "label": "Description", "source": "description", "field": "description" },
    {
      "label": "Durée",
      "source": "duration",
      "format": "duration",
      "field": "duration"
    },
    {
      "label": "Statut",
      "source": "status",
      "format": "badge",
      "field": "status"
    },
    { "label": "Auteur", "source": "author" }
  ],
  "exceptions": []
}
```

| Champ              | Obligatoire                   | Description                                                                                                              |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `projectName`      | oui                           | Nom affiché dans le journal                                                                                              |
| `me`               | oui                           | Nom d'auteur git, ou liste de noms, pour filtrer vos commits                                                             |
| `repoUrl`          | non                           | URL du dépôt utilisée par le bureau pour les liens vers les commits (GitHub, GitLab, Bitbucket Cloud, Codeberg ou Gitea) |
| `journalStartDate` | non                           | Date de début, format ISO 8601                                                                                           |
| `columns`          | non pour les anciens fichiers | Colonnes affichées ; le bureau utilise les colonnes standard si ce champ est absent                                      |
| `exceptions`       | oui                           | Entrées manuelles et modifications de commits                                                                            |
| `includeIssues`    | non                           | `true` pour ajouter les commentaires d'issues dans l'application (défaut : `false`)                                      |
| `githubUsers`      | non                           | Logins GitHub supplémentaires pour filtrer les commentaires d'issues                                                     |

> L'application scanne toutes les branches automatiquement (`git log --all`).

### Colonnes personnalisées

La propriété `columns` permet d'ajouter des colonnes au journal. Pour une colonne personnalisée éditable, utiliser le même nom libre dans `source` et `field` :

```json
{ "label": "Activité", "source": "activity", "field": "activity" }
```

Pour afficher une liste déroulante dans le formulaire d'ajout ou de modification, ajouter `type: "select"` ou `type: "dropdown"` avec les valeurs autorisées :

```json
{
  "label": "Activité",
  "source": "activity",
  "field": "activity",
  "type": "select",
  "values": ["dev", "spec", "GP"]
}
```

`options` peut aussi être utilisé à la place de `values`.

### Ouvrir un projet existant

Menu : **Fichier > Ouvrir un projet** (`Cmd+O` / `Ctrl+O`)

Vous pouvez ouvrir un fichier placé dans un sous-dossier, par exemple
`P_FUN/doc/Journal/p_fun.gitj`. Les anciens fichiers sans `columns` sont pris en
charge : les colonnes standard sont ajoutées en mémoire, puis enregistrées lors
de la prochaine sauvegarde ou modification. L’ouverture seule ne réécrit pas le
fichier. Les propriétés historiques `repoUrl` et `branch` sont conservées ; elles
ne remplacent pas la lecture des commits du dépôt local contenant le fichier.
Les dates d’entrées anciennes sans fuseau (`2026-01-02T12:34`) sont également
acceptées et conservées ; elles sont interprétées dans le fuseau de la machine.

### Format des messages de commit

Après avoir indexé vos modifications, créer un commit avec un titre, une
durée positive, un statut et une description.

```bash
git commit -m "feat(utilisateurs): exemple" -m "[45][DONE]" -m "Description"
```

`[45][DONE]` signifie 45 minutes et une tâche terminée. Utiliser `[WIP]`
pour une tâche en cours. Le bouton **?** de l’application montre le même
principe dans un client Git graphique. RGitJournal reconnaît les métadonnées
entre crochets dans le titre ou le corps du message.

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

| Syntaxe               | Résultat                    |
| --------------------- | --------------------------- |
| `[2h30]` ou `[2h30m]` | 2h30                        |
| `[45m]`               | 45 minutes                  |
| `[1h]`                | 1 heure                     |
| `[5]`                 | 5 minutes (unité implicite) |
| `[2h30 done]`         | 2h30, statut Done           |
| `[45m wip]`           | 45 min, statut WIP          |

**Format classique (multi-crochets) :**

| Syntaxe            | Résultat   |
| ------------------ | ---------- |
| `[2][30]`          | 2h30       |
| `[90]`             | 90 minutes |
| `[Done]` / `[WIP]` | statut     |

### Commentaires d'issues

Les commentaires d'issues et de pull requests suivent le même formalisme que les commits :

```
[45m done] Tests concluants sur la régulation
```

Seuls les crochets commençant par un chiffre sont reconnus dans les commentaires, pour ne pas confondre les métadonnées avec les liens `[texte](url)` ou les cases à cocher `- [x]`.

Contrairement aux commits, **tous les commentaires sont inclus**, même sans durée : le journal sert aussi à retrouver ce qui a été discuté.

Les commentaires sont filtrés par auteur : leur login GitHub doit figurer dans `me` ou dans `githubUsers` (sans `.gitj`, tous les auteurs sont pris en compte).

Dans l'application, activer `"includeIssues": true` dans le `.gitj`. Le token GitHub se définit dans **Configuration → Token → GitHub** (token fine-grained avec la permission _Issues : Read-only_) ; à défaut, il est lu dans `GH_TOKEN` / `GITHUB_TOKEN`, puis via `gh auth token` (GitHub CLI). Un dépôt public fonctionne sans token, dans la limite de 60 requêtes par heure.

Les commentaires ne peuvent pas être modifiés ni exclus dans RGitJournal (les exceptions du `.gitj` ne s'appliquent qu'aux commits) : pour corriger un commentaire, le modifier sur GitHub.

### Ajouter une entrée manuelle

1. Cliquer sur le bouton **+** en bas du tableau
2. Choisir la date avec le calendrier, puis l’heure locale dans le champ séparé.
3. Saisir la tâche ; le menu de préfixes propose `feat`, `fix`, `docs`, `chore`, etc.
   Le préfixe est facultatif et le texte reste libre. Changer le préfixe conserve
   un éventuel scope, par exemple `feat(interface): ...` devient `fix(interface): ...`.
4. Ajouter la description et la **durée en minutes** (par exemple `30`).
5. Choisir obligatoirement le statut **Done** ou **WIP** avec les boutons radio
   (un seul choix à la fois).
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

### Consulter le journal et les statistiques

Le tableau utilise des en-têtes sur une seule ligne, des lignes alternées et des
totaux distincts. Le tableau défile dans l’espace disponible, avec les en-têtes
visibles. Il défile aussi horizontalement si les colonnes dépassent la fenêtre.
**Ajouter une entrée**, **Statistiques** et **Aide** restent au-dessus du tableau.
Les boîtes de dialogue longues défilent dans leur propre fenêtre.
Les liens de commits affichent l’icône de GitHub, GitLab, Bitbucket, Codeberg ou
Gitea selon l’adresse ; les autres hébergeurs ont une icône Git générique avec
leur nom de domaine en infobulle. Les icônes sont embarquées et ne déclenchent
aucune requête réseau pour être affichées.

**Statistiques** permet de consulter la semaine en cours, le mois, un intervalle
de dates ou tout le journal. Les périodes suivent le calendrier UTC. Le mode
hebdomadaire compare les mêmes jours écoulés de la semaine précédente.
L’évolution regroupe les durées par jour ou par semaine selon la période.

La vue réunit la durée déclarée, les jours actifs, la couverture des durées et
les répartitions par statut, préfixe de tâche et source. Cliquer sur un préfixe
affiche ses entrées. La liste **WIP à revoir** présente les entrées de la plus
ancienne à la plus récente. Chaque entrée renvoie à sa ligne du journal.
Le détail de collecte du projet indique notamment les commits écartés faute
de durée après le filtrage d’auteur et de date et l’exclusion des bots.

### Exporter

| Action                       | Raccourci                                 |
| ---------------------------- | ----------------------------------------- |
| Exporter en PDF              | `Cmd+E` / `Ctrl+E`                        |
| Exporter en CSV              | `Cmd+Shift+E` / `Ctrl+Shift+E`            |
| Exporter en Markdown (`.md`) | Menu **Fichier → Exporter → En Markdown** |
| Imprimer                     | `Cmd+P` / `Ctrl+P`                        |

Dans **Configuration → Structure Export**, choisir les entrées à inclure
avant d’utiliser **Fichier → Exporter**. Les réglages sont enregistrés dans
`exportOptions` dans le fichier `.gitj` du projet.

- **Période** — toutes les dates, un intervalle inclusif, une semaine du lundi
  au dimanche ou un mois civil. Pour une semaine ou un mois, choisir une date
  qui en fait partie. Le filtrage suit le regroupement UTC du journal.
- **Filtres et colonnes** — combiner auteur, statut et source, puis choisir les
  colonnes à conserver. Le formulaire affiche le nombre d’entrées correspondant
  aux filtres.
- **Statistiques** — ajouter le nombre d’entrées, le nombre de jours actifs, la
  durée totale, la couverture des durées et les répartitions par période, type,
  source et statut. Ces valeurs portent sur la
  sélection exportée. En CSV, elles sont ajoutées à la fin du fichier sous forme
  de lignes avec le même nombre de colonnes que le tableau.
- **Markdown** — afficher ou masquer le titre du projet et ajouter une colonne
  avec les liens vers les commits ou commentaires dont l’adresse est disponible.
- **CSV** — choisir la virgule, le point-virgule ou la tabulation et activer ou
  désactiver la marque UTF-8 (BOM).
- **PDF** — choisir l’orientation A4 et la répétition des en-têtes sur les pages
  suivantes.

Sans réglage, le bureau exporte toutes les entrées et colonnes de son journal.
Le CSV utilise une virgule, un BOM et des fins de ligne CRLF. Le PDF utilise
l’A4 paysage, avec en-têtes répétés. Le PDF et le Markdown incluent les totaux.
Le journal Markdown de la CLI et de la GitHub Action suit ses propres réglages.
L’impression passe par le dialogue système ; aucune impression n’est lancée sans confirmation.

### Sauvegarder

Menu : **Fichier > Enregistrer** (`Cmd+S` / `Ctrl+S`)

Les ajouts, modifications, exclusions et suppressions sont enregistrés immédiatement.
En cas d’échec d’écriture, l’erreur reste visible et l’état enregistré n’est pas remplacé.
Les écritures utilisent un temporaire dans le dossier cible et la fermeture attend les écritures en cours.
**Configuration → Structure JSON** permet d’éditer le JSON du `.gitj`, y compris les colonnes personnalisées.

## Journal automatique avec GitHub Actions

RGitJournal peut générer un journal Markdown dans le dépôt à journaliser, à chaque push (toutes branches), à chaque commentaire ou modification d'issue, ou manuellement.

Copier [doc/journal-workflow.yml](doc/journal-workflow.yml) dans `.github/workflows/journal.yml` du dépôt à journaliser. Le journal :

- rassemble les commits de **toutes les branches** (dédupliqués par SHA, avec le nom de la branche) et les commentaires d'issues ;
- est regroupé par jour (fuseau `Europe/Zurich`), du plus récent au plus ancien ;
- est écrit sur la branche par défaut, même quand le push concerne `develop`. Si `main` exige des pull requests, ajouter **GitHub Actions** aux exceptions (_Bypass list_) de la règle, ou écrire le journal sur une branche dédiée avec `branch: journal` ;
- utilise le `.gitj` à la racine du dépôt s'il existe (filtre d'auteur, date de début, exclusions de commits, entrées manuelles).

Le commit du journal est fait avec `GITHUB_TOKEN`, il ne redéclenche donc pas le workflow.

Paramètres de l'action (`with:`) :

| Paramètre        | Défaut                                              | Description                                        |
| ---------------- | --------------------------------------------------- | -------------------------------------------------- |
| `output`         | nom du `.gitj` en `.md` (`journal.md` sans `.gitj`) | Fichier généré                                     |
| `gitj`           | premier `*.gitj` à la racine                        | Configuration à utiliser                           |
| `timezone`       | `Europe/Zurich`                                     | Fuseau pour le regroupement par jour               |
| `issues`         | `true`                                              | Inclure les commentaires d'issues                  |
| `commit`         | `true`                                              | Committer et pousser le journal                    |
| `branch`         | branche extraite                                    | Branche où committer le journal (créée si absente) |
| `commit-message` | `docs: update work journal`                         | Message du commit                                  |

### En ligne de commande

```bash
node src/cli.js --repo ../mon-depot --output - # affiche le journal
node src/cli.js --help
```

## Raccourcis clavier

| Raccourci                                       | Action                  |
| ----------------------------------------------- | ----------------------- |
| `Cmd/Ctrl + N`                                  | Nouveau projet          |
| `Cmd/Ctrl + O`                                  | Ouvrir un projet        |
| `Cmd/Ctrl + S`                                  | Enregistrer             |
| `Cmd/Ctrl + E`                                  | Exporter en PDF         |
| `Cmd/Ctrl + Shift + E`                          | Exporter en CSV         |
| `Cmd/Ctrl + P`                                  | Imprimer                |
| `Cmd/Ctrl + R`                                  | Actualiser              |
| `F11` (Windows/Linux), `Ctrl + Cmd + F` (macOS) | Basculer le plein écran |
| `Cmd/Ctrl + ,`                                  | Token GitHub            |
| `Cmd/Ctrl + +/-`                                | Zoom                    |

## Versionner vos projets

Les fichiers `.gitj` peuvent être versionnés avec Git :

```bash
git add mon-projet.gitj
git commit -m "Mise à jour du journal"
git push
```

## Tests

```bash
pnpm test           # CLI et modèle de l’interface
pnpm test:rust      # moteur, persistance et PDF
pnpm test:parity    # comparaison des moteurs JavaScript et Rust
```

Voir le [guide de construction et de vérification](src/BUILD.md) pour Clippy,
l’essai graphique Fedora et la régénération des icônes.

## Préparer et publier une version

1. Choisir `X.Y.Z` et mettre à jour la version dans `package.json`,
   `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et le pied de page de
   `desktop/index.html`. Le moteur `gitjournal-core` a sa propre version.
2. Préparer les ressources et laisser Cargo mettre à jour l’entrée
   `gitjournal-desktop` de `src-tauri/Cargo.lock`.

   ```bash
   pnpm desktop:prepare
   cargo check --manifest-path src-tauri/Cargo.toml
   python3 scripts/check-release-version.py v1.0.1
   ```

   Remplacer `v1.0.1` par le tag prévu. Le vérificateur utilise Python 3.11 ou
   plus récent et indique les fichiers à corriger si les versions divergent.

3. Exécuter les tests, versionner les changements et s’assurer que le commit de
   publication contient le workflow. Créer ensuite un tag annoté sur ce
   commit et pousser ce tag.

   ```bash
   git tag -a v1.0.1 -m "Résumé des changements de RGitJournal 1.0.1"
   git push origin v1.0.1
   ```

Les tags stables au format `vX.Y.Z` déclenchent les tests et les compilations
Windows x64, Linux x64 et macOS Apple Silicon si les versions concordent.
Le workflow réunit les cinq installateurs et les trois versions portables
avant de publier la release.
Le message du tag annoté sert de notes de version. GitHub ajoute les deux
archives des sources. [Workflow de publication](.github/workflows/release.yml)

En cas d’échec, consulter le job concerné dans **Actions**. Relancer le workflow
si l’échec est temporaire. Si le commit doit être corrigé, préparer une nouvelle
version et un nouveau tag. Une erreur lors du téléversement peut laisser une
release en brouillon à vérifier dans **Releases**.

## Contribuer

1. Ouvrir une [issue](https://github.com/StepCode3630/Rgitjournal/issues) avec
   la version utilisée, votre système et les étapes de reproduction pour un bug.
2. Créer un fork, cloner votre copie et travailler sur une branche dédiée.
   Les commandes de développement sont dans [Compiler depuis les sources](#compiler-depuis-les-sources).
3. Exécuter les tests pertinents, puis proposer une pull request avec le
   changement, les résultats des tests et les plateformes vérifiées.

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
sudo dnf reinstall ./RGitJournal-VERSION-ARCH.rpm
kbuildsycoca6 --noincremental
dbus-send --session --type=signal /KIconLoader org.kde.KIconLoader.iconChanged int32:0
```

Remplacer le nom du RPM par son nom exact. Les deux dernières commandes se lancent
dans la session KDE, sans `sudo` : la première recharge les applications, la seconde
demande au chargeur d’icônes KDE de relire les images en mémoire. Si les fichiers
installés sont déjà à jour mais que l’ancienne icône reste visible, relancer ces
deux commandes suffit à demander ce rafraîchissement, sans reconstruire le paquet
ni supprimer de cache.

Fermer puis relancer RGitJournal depuis
le menu. Si une ancienne icône reste épinglée à la barre des tâches, la désépingler
puis épingler la nouvelle entrée **RGitJournal**. Les fichiers `.gitj` et les
préférences sont conservés.

Les paquets installent les tailles d’icône usuelles et le lanceur correspondant
à l’identifiant Wayland. Voir [les vérifications Linux](src/BUILD.md#icônes-linux-et-identité-wayland).

### Le journal est vide

- Vérifier que le fichier `.gitj` est bien placé **dans le dépôt Git**, à la racine ou dans un sous-dossier
- Vérifier que le champ `me` correspond exactement au nom d'auteur dans vos commits (`git log --author=…`)
- Vérifier que vos commits contiennent une durée entre crochets

### Pas de liens GitHub dans le tableau

- Vérifier que le dépôt a un remote `origin` pointant vers GitHub (`git remote -v`)

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

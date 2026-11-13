# Parité du bureau Tauri

Référence : Electron 4.1.1 (`0cebde7`), début du portage Rust `b6b771b`.
Le bureau utilise désormais Rust/Tauri et un frontend statique, sans Express,
Electron ni processus Node auxiliaire. La CLI et l’action GitHub gardent leur moteur
JavaScript ; cette coexistence est volontaire et contrôlée par des tests de parité.

## Critères et preuves

| Fonctionnalité | État et vérification |
|---|---|
| Parsing | Corpus partagé JS/Rust : formats compact/classique, minutes implicites, casse et espaces JavaScript, caractères spéciaux ; première métadonnée reconnue et texte voisin conservés |
| Git | Comparaison réelle JS/Rust sur dépôt temporaire : branches, auteurs, date, déduplication, bots, durées, liens, exclusions, modifications et entrées manuelles |
| Erreurs | Dépôt vide distingué d’un chemin invalide ou d’un échec Git ; erreurs affichées explicitement |
| Interface | Modèle testé : regex JavaScript/groupes, regroupement UTC, totaux, CSV ; parcours graphique Fedora : tableau, formulaires, aide et statistiques |
| Projets | `.gitj` existants, date de début seule, champs inconnus préservés ; chargement/sauvegarde/édition/suppression testés ; création native testée sous Fedora |
| Intégration | Menus et raccourcis, titre du projet, zoom, liens HTTP(S), arguments chemin/URI ; association MIME Linux et métadonnées Windows/macOS dans les paquets |
| Persistance | Écriture atomique dans le dossier cible ; autosave, échec d’écriture, restauration, migration des préférences sans modification du fichier ancien testés ; fermeture attend les écritures |
| GitHub | Tests HTTP locaux : authentification factice, pagination, protection de l’origine, 401/403/404, quotas ; filtres auteur/date, PR et commentaires sans durée ; commentaires en lecture seule |
| CSV | BOM UTF-8, CRLF, guillemets, virgules et retours à la ligne testés ; export depuis la fenêtre réelle puis contenu vérifié |
| PDF | A4 paysage, pagination et en-têtes répétés ; extraction Unicode accentuée avec Poppler ; export depuis la fenêtre réelle ; renvois HTTP(S) conservés |
| Impression | Dialogue système ouvert et annulé sous Fedora ; aucune impression physique lancée |
| Distribution | Binaire optimisé et paquets RPM/DEB construits sous Fedora ; dépendance Git, fichier desktop, MIME et licences inspectés ; CI Linux/Windows/macOS sans publication ajoutée |

## Commandes reproductibles

Depuis la racine :

```bash
pnpm test
pnpm test:rust
pnpm test:parity
pnpm build
```

La suite comporte 54 tests JavaScript, 17 tests du cœur Rust et 6 tests du bureau.
Le corpus `doc/fixtures/metadata.json` contient des données synthétiques et ne
représente jamais des événements de journal réels. Les tests de parité créent des
commits dans un dépôt temporaire puis le suppriment.

Le script `scripts/test-desktop-fedora.py` effectue le parcours graphique avec
un dépôt et des préférences temporaires. Voir `src/BUILD.md` pour les prérequis et
les conditions d’exécution. Un chemin de binaire peut être passé en argument pour
vérifier directement `src-tauri/target/release/gitjournal-desktop`.

## Décisions et écarts explicites

- Les erreurs Git étaient masquées par une liste vide : le bureau les signale désormais.
- Le format `.gitj`, ses champs personnalisés et les sources des entrées sont préservés.
- Comme Electron sur `main`, la sauvegarde JSON utilise deux espaces et conserve
  l’ordre des propriétés, y compris dans les colonnes, exceptions et objets personnalisés.
  Les nouveaux projets suivent l’ordre `projectName`, `me`, `journalStartDate`,
  `columns`, `exceptions`. Un fichier déjà trié alphabétiquement conserve son ordre
  à l’ouverture : la sauvegarde ne réorganise plus ses champs.
  Ce format ne change pas la collecte : les commits sont lus dans le dépôt local,
  sans appel à GitHub. Les commentaires restent une option distincte (`includeIssues`).
- Les anciens projets sans `columns` reçoivent les colonnes standard en mémoire.
  L’ouverture ne réécrit pas le fichier ; les champs historiques et exceptions restent
  intacts. Un test de session couvre leur ouverture puis leur modification/sauvegarde.
  Le test de parité couvre aussi un `.gitj` sous `doc/Journal é`, sans colonnes,
  avec un ancien `repoUrl` inaccessible et une branche inexistante : mêmes commits
  locaux, exceptions et statistiques que depuis la racine.
  Les dates historiques `datetime-local` sans fuseau sont acceptées et conservées
  textuellement ; leur interprétation utilise le fuseau système, comme JavaScript.
- Les regex des colonnes restent en JavaScript ; elles ne sont pas traduites vers une autre grammaire.
- Le bureau garde son regroupement UTC, le Markdown CLI son fuseau configurable Europe/Zurich.
- Le CSV reprend les colonnes affichées. La colonne « Tâche (abrégé) » annoncée dans
  l’ancien README n’existait pas dans le code de référence et n’a pas été inventée.
- Le PDF a une mise en page propre au moteur Rust, avec les mêmes cellules visibles,
  les totaux et les renvois. Il n’utilise plus le moteur d’impression Chromium.
- Noto Sans est embarquée sous OFL ; les autres caractères utilisent les polices système.
  Une police manquante produit une erreur explicite plutôt qu’une perte silencieuse de texte.
- Les préférences Tauri sont séparées des anciennes préférences Electron ; ces dernières
  sont lues au premier lancement et restent intactes.
- Les paquets Linux par défaut sont DEB et RPM, pour les familles Debian et Fedora.
  L’AppImage reste une option du CLI Tauri, non validée ici.

## Limites de validation

Validation locale : Fedora 44 x86_64, GTK 3.24 et WebKitGTK 2.54. Les paquets n’ont pas
été installés sur le système de l’utilisateur. Le binaire optimisé a été exécuté directement.
Aucune imprimante physique n’a été utilisée. Les interactions GitHub ont été testées
avec un serveur simulé, sans compte privé ni token réel.

Windows 10/11, macOS et Debian n’ont pas été exécutés localement. La CI ajoutée compile
et teste les trois systèmes, mais n’a pas été déclenchée depuis cette session. Les essais
graphiques Windows/macOS, signatures et installations natives restent donc à effectuer.
Aucun push, tag, release ou déploiement n’est effectué par la migration.

# Parité de la migration de bureau

Référence : application Electron 4.1.1, commit `0cebde7`.
Electron reste disponible tant que tous les critères ci-dessous ne sont pas validés.
La CLI et l'action JavaScript restent indépendantes et fonctionnelles.

| Tranche | Critères d'acceptation | État |
|---|---|---|
| Parsing | Formats compact/classique, minutes implicites, casse conservée, première ligne reconnue, titre et description préservés ; corpus partagé JS/Rust | En cours |
| Git | Toutes branches hors tags/stash, déduplication SHA, filtres auteurs/date, dates d'auteur, liens origin, exclusion bots, seulement durées positives | À migrer |
| Erreurs | Distinguer dépôt vide, chemin invalide, Git absent et échec de commande ; aucun historique inventé | À migrer |
| Interface | Colonnes configurables, regex JS, champs select/dropdown, groupes UTC actuels, totaux, descriptions condensées et échappées, aide/statistiques | À migrer |
| Projets | Nouveau/ouvrir/enregistrer, .gitj existants et champs inconnus conservés, exclusions SHA, modifications et entrées manuelles | À migrer |
| Intégration | Menus/raccourcis, zoom, dialogues, ouverture de .gitj par le système, liens externes limités à HTTP(S) | À migrer |
| Persistance | Sauvegarde automatique et finale, écriture sûre dans le dossier cible, dernier projet, préférences et migration des anciennes préférences | À migrer |
| GitHub | Pagination, issues et conversations PR, filtre login/date, commentaires sans durée, lecture seule, erreurs visibles, token préférences/env/gh | À migrer |
| CSV | Colonnes du tableau, échappement guillemets/virgules/retours, BOM UTF-8 et CRLF | À migrer |
| PDF/impression | Export A4 paysage et impression du journal complet, caractères Unicode, pagination et totaux ; essai réel Fedora | À migrer |
| Distribution | Tests et construction Fedora ; CI Windows/macOS sans publication ; limites explicitement documentées | À migrer |

La colonne CSV « Tâche (abrégé) » annoncée par le README est absente du code de référence.
Le Markdown CLI groupe en Europe/Zurich, contrairement à l'interface UTC : ne pas modifier implicitement ces conventions.
Les erreurs Git actuellement masquées seront corrigées explicitement, sans confondre erreur et journal vide.

Le cœur Rust sera indépendant de Tauri ; le frontend web appellera des commandes de domaine.
Aucun processus Node n'est prévu pour l'application finale. La duplication temporaire du
parsing JavaScript/Rust sert à vérifier la parité tout en conservant la CLI.

## Vérification du cœur

Depuis la racine : `cargo test --manifest-path crates/journal-core/Cargo.toml`.
Le corpus `doc/fixtures/metadata.json` est aussi vérifié par `pnpm test`.
Le corpus contient des données synthétiques de test, jamais des événements de journal réels.

import argparse
import json
import re
import tomllib
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Vérifie que les versions de GitJournal correspondent au tag de publication."
    )
    parser.add_argument("tag", metavar="vX.Y.Z")
    tag = parser.parse_args().tag
    if not re.fullmatch(r"v(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2}", tag):
        parser.error("le tag doit être au format stable vX.Y.Z, sans suffixe ni zéros initiaux")

    root = Path(__file__).resolve().parents[1]

    def read(filename):
        return (root / filename).read_text(encoding="utf-8")

    footer = re.search(
        r'<p class="version">\s*GitJournal\s+([^<\s]+)\s*</p>',
        read("desktop/index.html"),
    )
    lock = tomllib.loads(read("src-tauri/Cargo.lock"))
    versions = {
        "package.json": json.loads(read("package.json")).get("version"),
        "src-tauri/tauri.conf.json": json.loads(read("src-tauri/tauri.conf.json")).get("version"),
        "src-tauri/Cargo.toml": tomllib.loads(read("src-tauri/Cargo.toml"))["package"].get("version"),
        "src-tauri/Cargo.lock (gitjournal-desktop)": next(
            (pkg["version"] for pkg in lock["package"] if pkg["name"] == "gitjournal-desktop"),
            None,
        ),
        "desktop/index.html (pied de page)": footer[1] if footer else None,
    }
    expected = tag[1:]
    mismatches = [
        f"{filename} indique {version or 'une version absente'}, attendu {expected}"
        for filename, version in versions.items()
        if version != expected
    ]
    if mismatches:
        parser.exit(1, f"Versions incompatibles avec {tag}\n" + "\n".join(mismatches) + "\n")
    print(f"{tag} correspond à la version de GitJournal dans tous les fichiers.")


if __name__ == "__main__":
    main()

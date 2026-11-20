// Comparaison de comportements réels sur un dépôt synthétique isolé.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { collectEntries } from "../src/server/lib/journal-generator.js";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitjournal-parity-"));
const git = (...args) =>
  execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
try {
  git("init", "-q", "-b", "main");
  const commit = (author, date, message) => {
    execFileSync(
      "git",
      [
        "-C",
        dir,
        "-c",
        "core.hooksPath=" + dir,
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=" + author,
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        message,
      ],
      {
        env: {
          ...process.env,
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        },
        stdio: "pipe",
      },
    );
    return git("rev-parse", "HEAD");
  };
  commit("Alice", "2020-01-01T10:00:00Z", "Ancien [1h]");
  const patched = commit(
    "Alice",
    "2026-02-01T10:00:00Z",
    "Titre éà [30m done]\nTexte <script>data</script>",
  );
  const excluded = commit("Zoé", "2026-02-02T10:00:00Z", "Exclu [45m]");
  commit("Alice", "2026-02-03T10:00:00Z", "Sans durée");
  commit("robot[bot]", "2026-02-04T10:00:00Z", "Bot [2h]");
  git("checkout", "-q", "-b", "autre");
  commit(
    "Zoé",
    "2026-02-05T10:00:00+02:00",
    "Branche\n[1][30][WIP] texte conservé",
  );
  git("checkout", "-q", "main");
  git("remote", "add", "origin", "git@github.com:example/parity.git");
  const project = {
    projectName: "Parité synthétique",
    me: ["Alice", "Zoé"],
    journalStartDate: "2026-01-01",
    columns: [{ source: "name", label: "Tâche" }],
    exceptions: [
      {
        sha: patched,
        type: "commitpatch",
        id: "patch",
        name: "Corrigé",
        date: "2026-02-01T10:00:00Z",
        duration: 25,
      },
      { sha: excluded, excluded: true },
      {
        type: "commitless",
        id: "manual",
        name: "Manuel",
        date: "2026-02-06T10:00:00Z",
        duration: 15,
      },
    ],
  };
  const file = path.join(dir, "projet.gitj");
  fs.writeFileSync(file, JSON.stringify(project));
  const expected = await collectEntries({ project, repoPath: dir });
  const executable = path.resolve(
    "crates/journal-core/target/debug/examples/snapshot" +
      (process.platform === "win32" ? ".exe" : ""),
  );
  const actual = JSON.parse(
    execFileSync(executable, [dir, file], { encoding: "utf8" }),
  );
  assert.deepEqual(actual.entries, expected.entries);
  expected.stats.gitUsers.sort();
  actual.stats.gitUsers.sort();
  const { withoutDuration, ...parityStats } = actual.stats;
  assert.equal(withoutDuration, 1);
  assert.deepEqual(parityStats, expected.stats);
  assert.equal(actual.remoteBaseUrl, expected.remoteBaseUrl);
  // Ancien projet situé sous doc/Journal : aucune colonne, ancien repoUrl et
  // branche obsolète. Les commits viennent toujours du dépôt local contenant le fichier.
  const nestedDirectory = path.join(dir, "doc", "Journal é");
  fs.mkdirSync(nestedDirectory, { recursive: true });
  const nestedFile = path.join(nestedDirectory, "ancien.gitj");
  const { columns, ...legacy } = project;
  legacy.repoUrl = "https://example.invalid/never-contact-this-repository";
  legacy.branch = "nonexistent-branch";
  const original = JSON.stringify(legacy, null, 2);
  fs.writeFileSync(nestedFile, original);
  const nested = JSON.parse(
    execFileSync(executable, [nestedDirectory, nestedFile], { encoding: "utf8" }),
  );
  assert.deepEqual(nested, {
    ...actual,
    entries: actual.entries.map((entry) =>
      entry.source === "commit"
        ? { ...entry, url: legacy.repoUrl + "/commit/" + entry.sha }
        : entry,
    ),
  });
  assert.equal(fs.readFileSync(nestedFile, "utf8"), original);
  console.log(
    "Parité Git JS/Rust validée : branches, auteurs, date, parsing, exclusions, modifications, entrées manuelles, statistiques et ancien projet dans un sous-dossier.",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

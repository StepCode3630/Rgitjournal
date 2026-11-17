import { test } from "node:test";
import assert from "node:assert/strict";
import {
  columnValue,
  groupEntries,
  csv,
  startDateIso,
  taskPrefix,
  withTaskPrefix,
  entryDateParts,
  entryDateIso,
  gitHost,
  journalSummary,
  minutesLabel,
  markdown,
} from "./model.js";

test("Markdown export preserves custom columns, Unicode and total rows", () => {
  assert.equal(
    markdown(
      "Projet éà",
      ["Tâche", "Activité", "Durée"],
      [["Conception", "spec", "1h 30m"], ["Total du projet : 1h 30m"]],
    ),
    "# Projet éà\n\n| Tâche | Activité | Durée |\n| --- | --- | --- |\n| Conception | spec | 1h 30m |\n| **Total du projet : 1h 30m** |  |  |\n",
  );
});
test("Markdown export escapes user markup and keeps safe HTTP links", () => {
  const output = markdown(
    "Projet\n# titre",
    ["Description"],
    [
      ["<script>x</script> & a|b\r\n[texte](javascript:x) *gras* `code`"],
      ["Suite"],
      ["Lien"],
    ],
    [
      [],
      ["javascript:alert(1)"],
      ["https://user:password@example.org/a(b)?x=1|2"],
    ],
  );
  assert.ok(output.startsWith("# Projet \\# titre\n"));
  assert.ok(
    output.includes(
      "&lt;script&gt;x&lt;/script&gt; &amp; a\\|b<br>\\[texte\\]\\(javascript:x\\) \\*gras\\* \\`code\\`",
    ),
  );
  assert.ok(output.includes("| Suite |"));
  assert.ok(output.includes("[Lien](https://example.org/a%28b%29?x=1%7C2)"));
  assert.ok(!output.includes("user:password"));
  assert.ok(!output.includes("](javascript:"));
});
test("Markdown export supports an empty journal and rejects missing columns", () => {
  assert.equal(
    markdown("Vide", ["Tâche"], []),
    "# Vide\n\n| Tâche |\n| --- |\n",
  );
  assert.throws(() => markdown("Vide", [], []), /colonne/);
});

test("commit host icons recognize providers without assuming unknown URLs are GitHub", () => {
  for (const [url, icon] of [
    ["https://github.com/team/repo/commit/123", "github"],
    ["https://gitlab.com/team/repo/-/commit/123", "gitlab"],
    ["https://gitlab.example.org/team/repo", "gitlab"],
    ["https://bitbucket.org/team/repo", "bitbucket"],
    ["https://codeberg.org/team/repo", "codeberg"],
    ["https://gitea.example.org/team/repo", "gitea"],
    ["https://github.com.example.org/team/repo", "git"],
    ["https://git.example.org/team/repo", "git"],
    ["javascript:alert(1)", "git"],
  ])
    assert.equal(gitHost(url).icon, icon);
  assert.equal(
    gitHost("https://git.example.org/team/repo").label,
    "git.example.org",
  );
});

test("statistics use filtered entries, UTC days and historical statuses without estimating durations", () => {
  const summary = journalSummary([
    { date: "2026-11-17T00:30:00+02:00", duration: 30, status: "DONE" },
    { date: "2026-11-17T12:00:00Z", duration: 45, status: "wip" },
    { date: "2026-11-17T13:00:00Z", status: "" },
    { date: "2026-11-17T14:00:00Z", duration: -5, status: "old" },
  ]);
  assert.equal(summary.totalMinutes, 70);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.entryCount, 4);
  assert.equal(summary.days.length, 7);
  assert.deepEqual(summary.days.slice(-2), [
    { day: "2026-11-16", minutes: 30 },
    { day: "2026-11-17", minutes: 40 },
  ]);
  assert.equal(summary.days[0].minutes, 0);
  assert.deepEqual(
    summary.statuses.map((s) => s.count),
    [1, 1, 2],
  );
  assert.equal(minutesLabel(90), "1h 30min");
  assert.equal(minutesLabel(-5), "−0h 5min");
});

test("statistics handle empty journals and invalid legacy numbers without NaN", () => {
  assert.deepEqual(journalSummary([]).days, []);
  assert.equal(journalSummary([]).totalMinutes, 0);
  const summary = journalSummary([{ date: "invalid", duration: "invalid" }]);
  assert.equal(summary.totalMinutes, 0);
  assert.equal(summary.activeDays, 0);
  assert.equal(summary.entryCount, 1);
});

test("task prefixes can be suggested, replaced and removed without duplicating the scope", () => {
  assert.equal(
    withTaskPrefix("Ajouter un filtre", "feat"),
    "feat: Ajouter un filtre",
  );
  assert.equal(
    withTaskPrefix("feat(ui)!: Corriger", "fix"),
    "fix(ui)!: Corriger",
  );
  assert.equal(withTaskPrefix("chore: Nettoyer", "chore"), "chore: Nettoyer");
  assert.equal(withTaskPrefix("feat(ui): Ajouter", ""), "Ajouter");
  assert.equal(
    withTaskPrefix("feat(ui): Ajouter (détail): suite", ""),
    "Ajouter (détail): suite",
  );
  assert.equal(taskPrefix("docs: Guide"), "docs");
  assert.equal(taskPrefix("Texte libre"), "");
  assert.equal(withTaskPrefix("Texte libre", ""), "Texte libre");
});
test("entry date and time use local calendar fields and retain the original instant on edit", () => {
  const original = "2026-01-02T12:34:56.789Z";
  const parts = entryDateParts(original);
  assert.equal(entryDateIso(parts.day, parts.time, original), original);
  const chosen = new Date(2026, 0, 4, 9, 15);
  const edited = entryDateParts(chosen);
  assert.equal(entryDateIso(edited.day, edited.time), chosen.toISOString());
  assert.equal(edited.day, "2026-01-04");
  assert.equal(edited.time, "09:15");
  assert.throws(() => entryDateIso("", "09:15"), /requises/);
  assert.throws(() => entryDateParts("invalide"), /invalide/);
});

test("project start dates retain UTC date-only semantics", () => {
  assert.equal(startDateIso("2026-01-01"), "2026-01-01T00:00:00.000Z");
  assert.equal(startDateIso(""), null);
});
test("custom regex and capture group retain JavaScript semantics", () => {
  assert.equal(
    columnValue(
      { name: "feat(écran)" },
      { source: "name", regex: "(?<=feat\\()(.*)(?=\\))", group: 1 },
    ),
    "écran",
  );
});
test("UTC grouping, chronological order, totals", () => {
  const groups = groupEntries([
    { date: "2026-11-13T00:30:00+02:00", duration: 30 },
    { date: "2026-11-12T20:00:00Z", duration: 15 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].day, "2026-11-12");
  assert.equal(groups[0].minutes, 45);
  assert.equal(groups[0].entries[0].duration, 15);
});
test("CSV includes BOM CRLF and escapes data without interpreting HTML", () => {
  assert.equal(
    csv(["Tâche"], [['a,"b"\nc'], ["<script>"]]),
    '\uFEFFTâche\r\n"a,""b""\nc"\r\n<script>',
  );
});

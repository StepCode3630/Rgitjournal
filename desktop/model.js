export function columnValue(entry, column) {
  let value = String(entry[column.source] ?? "");
  if (column.regex) {
    const match = value.match(new RegExp(column.regex, column.flags ?? "s"));
    value = match?.[column.group ?? 0] ?? "";
  }
  return value;
}

export function gitHost(value) {
  let host;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    host = url.hostname.toLowerCase();
  } catch {
    return { label: "Dépôt Git", icon: "git" };
  }
  for (const [domain, label, icon] of [
    ["github.com", "GitHub", "github"],
    ["gitlab.com", "GitLab", "gitlab"],
    ["bitbucket.org", "Bitbucket", "bitbucket"],
    ["codeberg.org", "Codeberg", "codeberg"],
  ]) {
    if (host === domain || host.endsWith("." + domain)) return { label, icon };
  }
  for (const [prefix, label, icon] of [
    ["gitlab.", "GitLab", "gitlab"],
    ["gitea.", "Gitea", "gitea"],
    ["bitbucket.", "Bitbucket", "bitbucket"],
  ]) {
    if (host.startsWith(prefix)) return { label, icon };
  }
  return { label: host, icon: "git" };
}

export function minutesLabel(value) {
  const minutes = Math.abs(value);
  return `${value < 0 ? "−" : ""}${Math.floor(minutes / 60)}h ${Math.round((minutes % 60) * 100) / 100}min`;
}

export function journalSummary(entries) {
  const totals = new Map();
  const statuses = new Map([
    ["Done", 0],
    ["WIP", 0],
    ["Autre / non renseigné", 0],
  ]);
  let totalMinutes = 0;
  for (const entry of entries) {
    const duration = Number(entry.duration ?? 0);
    const minutes = Number.isFinite(duration) ? duration : 0;
    totalMinutes += minutes;
    const date = new Date(entry.date);
    if (Number.isFinite(date.getTime())) {
      const day = date.toISOString().slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + minutes);
    }
    const status = String(entry.status ?? "")
      .trim()
      .toLowerCase();
    const key =
      status === "done"
        ? "Done"
        : status === "wip"
          ? "WIP"
          : "Autre / non renseigné";
    statuses.set(key, statuses.get(key) + 1);
  }
  const lastDay = [...totals.keys()].sort().at(-1);
  const days = lastDay
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date(lastDay + "T00:00:00Z");
        date.setUTCDate(date.getUTCDate() - 6 + i);
        const day = date.toISOString().slice(0, 10);
        return { day, minutes: totals.get(day) ?? 0 };
      })
    : [];
  return {
    totalMinutes,
    activeDays: totals.size,
    entryCount: entries.length,
    days,
    statuses: [...statuses].map(([label, count]) => ({ label, count })),
  };
}

// Date-only inputs use UTC, as in the original Electron creation form.
export function startDateIso(value) {
  return value ? new Date(value).toISOString() : null;
}
export const taskPrefixes = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];
export function taskPrefix(name) {
  const prefix = String(name).match(/^([a-z]+)(?:\([^()\r\n]*\))?!?:\s*/)?.[1];
  return taskPrefixes.includes(prefix) ? prefix : "";
}
export function withTaskPrefix(name, prefix) {
  const current = taskPrefix(name);
  if (current) {
    // Conserver le scope et le marqueur de rupture quand seul le type change.
    return prefix
      ? prefix + name.slice(current.length)
      : name.replace(/^[a-z]+(?:\([^()\r\n]*\))?!?:\s*/, "");
  }
  return prefix ? `${prefix}: ${name}` : name;
}
export function entryDateParts(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error("Date invalide");
  const pad = (n) => String(n).padStart(2, "0");
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
export function entryDateIso(day, time, original) {
  if (!day || !time) throw new Error("Date et heure requises");
  if (original) {
    const previous = entryDateParts(original);
    if (previous.day === day && previous.time === time)
      return new Date(original).toISOString();
  }
  const date = new Date(`${day}T${time}`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Date ou heure invalide");
  return date.toISOString();
}
export function formatCell(entry, column) {
  const value = columnValue(entry, column);
  if (column.format === "date")
    return new Date(value).toLocaleString("fr-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (column.format === "duration")
    return `${Math.floor(Number(value || 0) / 60)}h ${Number(value || 0) % 60}m`;
  return value;
}
export function groupEntries(entries) {
  const groups = new Map();
  for (const e of [...entries].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  )) {
    const key = new Date(e.date).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups].map(([day, entries]) => ({
    day,
    entries,
    minutes: entries.reduce((n, e) => n + Number(e.duration || 0), 0),
  }));
}
export function csv(headers, rows) {
  const escape = (value) =>
    /[",\r\n]/.test(String(value ?? ""))
      ? `"${String(value).replaceAll('"', '""')}"`
      : String(value ?? "");
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")
  );
}
export function exportTable(entries, columns) {
  return {
    headers: columns.map((c) => c.label),
    rows: groupEntries(entries).flatMap((g) =>
      g.entries.map((e) => columns.map((c) => formatCell(e, c))),
    ),
  };
}

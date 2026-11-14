export function columnValue(entry, column) {
  let value = String(entry[column.source] ?? "");
  if (column.regex) {
    const match = value.match(new RegExp(column.regex, column.flags ?? "s"));
    value = match?.[column.group ?? 0] ?? "";
  }
  return value;
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

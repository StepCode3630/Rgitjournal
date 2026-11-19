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
function utcDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export function exportPeriod({ period, start, end, reference }) {
  if (!period || period === "all") return {};
  if (period === "range") {
    if (!utcDay(start) || !utcDay(end) || start > end)
      throw new Error(
        "Indiquez une date de début et une date de fin dans l’ordre.",
      );
    return { start, end };
  }
  const first = utcDay(reference);
  if (!first)
    throw new Error("Choisissez une date dans la semaine ou le mois souhaité.");
  const last = new Date(first);
  if (period === "week") {
    first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    last.setTime(first.getTime());
    last.setUTCDate(last.getUTCDate() + 6);
  } else if (period === "month") {
    first.setUTCDate(1);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
  } else {
    throw new Error("Période d’export inconnue.");
  }
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  };
}

export function exportEntries(entries, options = {}) {
  const { start, end } = exportPeriod(options);
  return entries.filter((entry) => {
    const day = new Date(entry.date).toISOString().slice(0, 10);
    const status = String(entry.status ?? "")
      .trim()
      .toLowerCase();
    const author = Array.isArray(entry.author) ? entry.author : [entry.author];
    const source = ["issue", "pr"].includes(entry.source)
      ? "github"
      : entry.source;
    return (
      (!start || (day >= start && day <= end)) &&
      (!options.author || author.includes(options.author)) &&
      (!options.source || source === options.source) &&
      (!options.status ||
        (options.status === "other"
          ? !["done", "wip"].includes(status)
          : status === options.status))
    );
  });
}

export function csv(headers, rows, { separator = ",", bom = true } = {}) {
  const escape = (value) => {
    const cell = String(value ?? "");
    return /["\r\n]/.test(cell) || cell.includes(separator)
      ? `"${cell.replaceAll('"', '""')}"`
      : cell;
  };
  return (
    (bom ? "\uFEFF" : "") +
    [headers, ...rows]
      .map((row) => row.map(escape).join(separator))
      .join("\r\n")
  );
}

// Le bureau exporte ses colonnes personnalisées et son texte affiché. La CLI
// conserve son journal Markdown à colonnes fixes et son fuseau configurable.
export function markdown(
  title,
  headers,
  rows,
  links = [],
  { heading = true } = {},
) {
  if (!headers.length) throw new Error("Aucune colonne à exporter");
  const escape = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/[\\`*_[\]{}()#+.!|~]/g, "\\$&")
      .replace(/\r\n?|\n/g, "<br>");
  const safeLink = (value) => {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      url.username = "";
      url.password = "";
      return url.href.replace(
        /[()|<>\\]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    } catch {
      return null;
    }
  };
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [
    ...(heading
      ? [`# ${escape(String(title ?? "").replace(/\r\n?|\n/g, " "))}`, ""]
      : []),
    line(headers.map(escape)),
    line(headers.map(() => "---")),
    ...rows.map((row, index) =>
      line(
        headers.map((_, column) => {
          const value = escape(row[column]);
          const url = safeLink(links[index]?.[column]);
          if (url && value) return `[${value}](${url})`;
          return row.length === 1 && headers.length > 1 && column === 0
            ? `**${value}**`
            : value;
        }),
      ),
    ),
    "",
  ].join("\n");
}

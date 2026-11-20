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

function entryStatus(entry) {
  return String(entry.status ?? "")
    .trim()
    .toLowerCase();
}

function entrySource(entry) {
  return entry.commentId || ["issue", "pr"].includes(entry.source)
    ? "github"
    : entry.source;
}

export function journalSummary(entries) {
  const days = new Map();
  const statuses = new Map([
    ["Done", 0],
    ["WIP", 0],
    ["Autre / non renseigné", 0],
  ]);
  const types = new Map();
  const sources = new Map([
    [
      "commit",
      { label: "Commits Git", count: 0, minutes: 0, withoutDuration: 0 },
    ],
    [
      "manual",
      { label: "Entrées manuelles", count: 0, minutes: 0, withoutDuration: 0 },
    ],
    [
      "github",
      {
        label: "Commentaires GitHub",
        count: 0,
        minutes: 0,
        withoutDuration: 0,
      },
    ],
    [
      "other",
      { label: "Autres sources", count: 0, minutes: 0, withoutDuration: 0 },
    ],
  ]);
  const wip = [];
  let totalMinutes = 0;
  let withDuration = 0;
  for (const entry of entries) {
    const sourceKey = entrySource(entry);
    const duration = Number(entry.duration);
    const hasDuration =
      (typeof entry.duration === "number" ||
        (typeof entry.duration === "string" && entry.duration.trim() !== "")) &&
      Number.isFinite(duration) &&
      (sourceKey !== "github" ||
        duration !== 0 ||
        entry.durationDeclared === true);
    const minutes = hasDuration ? duration : 0;
    if (hasDuration) withDuration++;
    totalMinutes += minutes;
    const date = new Date(entry.date);
    if (Number.isFinite(date.getTime())) {
      const day = date.toISOString().slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + minutes);
    }
    const status = entryStatus(entry);
    const key =
      status === "done"
        ? "Done"
        : status === "wip"
          ? "WIP"
          : "Autre / non renseigné";
    statuses.set(key, statuses.get(key) + 1);
    if (status === "wip") wip.push(entry);
    const label = taskPrefix(entry.name) || "Sans préfixe";
    if (!types.has(label)) types.set(label, { label, minutes: 0, entries: [] });
    const type = types.get(label);
    type.minutes += minutes;
    type.entries.push(entry);
    const source = sources.get(sourceKey) ?? sources.get("other");
    source.count++;
    source.minutes += minutes;
    if (!hasDuration) source.withoutDuration++;
  }
  return {
    totalMinutes,
    activeDays: days.size,
    entryCount: entries.length,
    withDuration,
    days: [...days]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, minutes]) => ({ day, minutes })),
    statuses: [...statuses].map(([label, count]) => ({ label, count })),
    types: [...types.values()].sort(
      (a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label),
    ),
    sources: [...sources.values()].filter((item) => item.count),
    wip: wip.sort((a, b) => new Date(a.date) - new Date(b.date)),
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

function shiftDay(day, offset) {
  const date = utcDay(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function statisticsPeriod(options, today) {
  const range = exportPeriod({ ...options, reference: today });
  if (options.period !== "week") return { range };
  return {
    range,
    previous: { start: shiftDay(range.start, -7), end: shiftDay(today, -7) },
    elapsed: { start: range.start, end: today },
  };
}

export function durationTimeline(days, { start, end } = {}, byWeek = false) {
  if (!days.length) return [];
  start ??= days[0].day;
  end ??= days.at(-1).day;
  const span = (utcDay(end) - utcDay(start)) / 86400000;
  const weekly = byWeek || span > 30;
  const bucket = (day) => {
    if (!weekly) return day;
    const monday = exportPeriod({ period: "week", reference: day }).start;
    return monday < start ? start : monday;
  };
  const totals = new Map();
  // De très longues périodes affichent uniquement leurs semaines actives.
  if (span <= 62) {
    for (let offset = 0; offset <= span; offset++)
      totals.set(bucket(shiftDay(start, offset)), 0);
  }
  for (const { day, minutes } of days) {
    const key = bucket(day);
    totals.set(key, (totals.get(key) ?? 0) + minutes);
  }
  return [...totals].map(([day, minutes]) => ({
    start: day,
    end: weekly
      ? [end, exportPeriod({ period: "week", reference: day }).end].sort()[0]
      : day,
    minutes,
  }));
}

export function exportEntries(entries, options = {}) {
  const { start, end } = exportPeriod(options);
  return entries.filter((entry) => {
    const day = new Date(entry.date).toISOString().slice(0, 10);
    const status = entryStatus(entry);
    const author = Array.isArray(entry.author) ? entry.author : [entry.author];
    const source = entrySource(entry);
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

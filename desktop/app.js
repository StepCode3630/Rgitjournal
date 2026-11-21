import {
  groupEntries,
  formatCell,
  csv,
  markdown,
  exportEntries,
  exportPeriod,
  startDateIso,
  taskPrefixes,
  taskPrefix,
  withTaskPrefix,
  entryDateParts,
  entryDateIso,
  gitHost,
  journalSummary,
  statisticsPeriod,
  durationTimeline,
  minutesLabel,
} from "./model.js";
import { condenseDescription } from "./description-filter.js";
const invoke = (...args) => window.__TAURI__.core.invoke(...args);
const $ = (id) => document.getElementById(id);
let project = null,
  entries = [],
  stats = {},
  busy = false;
const journalRows = new Map();
const node = (tag, text, attributes = {}) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  return el;
};
function status(message, error = false) {
  $("status").textContent = message;
  $("status").title = message;
  $("status").classList.toggle("error", error);
}
async function run(fn) {
  if (busy) return;
  busy = true;
  try {
    await fn();
  } catch (e) {
    status(String(e), true);
  } finally {
    busy = false;
  }
}
function dialog(title, fields, submit, label = "Enregistrer") {
  $("modal").classList.remove("stats-dialog");
  $("dialog-title").textContent = title;
  $("fields").oninput = null;
  $("fields").replaceChildren(...fields);
  $("form-error").textContent = "";
  $("submit").textContent = label;
  $("submit").hidden = !submit;
  $("form").onsubmit = async (event) => {
    event.preventDefault();
    $("submit").disabled = true;
    try {
      if (submit) await submit(new FormData($("form")));
      $("modal").close();
    } catch (e) {
      $("form-error").textContent = String(e);
    } finally {
      $("submit").disabled = false;
    }
  };
  $("modal").showModal();
}
function field(label, name, value = "", type = "text", options) {
  const wrapper = node("label", label);
  let input;
  if (options) {
    input = node("select");
    for (const v of ["", ...options]) {
      const o = node("option", String(v), { value: String(v) });
      input.append(o);
    }
  } else {
    input = node(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.type = type;
  }
  input.name = name;
  input.value = value;
  wrapper.append(input);
  return wrapper;
}
function confirmAction(message) {
  return new Promise((resolve) => {
    const modal = node("dialog");
    const cancel = node("button", "Annuler", { type: "button" });
    const accept = node("button", "Confirmer", { type: "button" });
    const footer = node("footer");
    footer.append(cancel, accept);
    modal.append(node("p", message), footer);
    const finish = (accepted) => {
      modal.close();
      modal.remove();
      resolve(accepted);
    };
    cancel.onclick = () => finish(false);
    accept.onclick = () => finish(true);
    modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    document.body.append(modal);
    modal.showModal();
    cancel.focus();
  });
}
function link(url, label) {
  const a = node("a", label, { href: "#" });
  a.dataset.url = url;
  a.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    run(() => invoke("open_link", { url }));
  };
  return a;
}
function commitLink(entry) {
  const host = gitHost(entry.url);
  const label = `Voir ${entry.commentId ? "le commentaire" : "le commit"} sur ${host.label}`;
  const a = link(entry.url, undefined);
  a.className = "host-link";
  a.title = label;
  a.setAttribute("aria-label", label);
  a.append(
    node("img", undefined, {
      src: `icons/${host.icon}.svg`,
      alt: "",
      width: "20",
      height: "20",
    }),
  );
  return a;
}

function barChart(title, caption, items, format) {
  const figure = node("figure", undefined, {
    class: "stat-chart",
    "aria-label": title,
  });
  figure.append(
    node("figcaption", title),
    node("p", caption, { class: "chart-caption" }),
  );
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  const signed = items.some((item) => item.value < 0);
  const list = node("ul", undefined, { class: "chart-bars" });
  for (const item of items) {
    const row = node("li");
    const track = node("span", undefined, {
      class: `chart-track${signed ? " signed" : ""}`,
      "aria-hidden": "true",
    });
    const bar = node("span", undefined, {
      class: `chart-bar${item.value < 0 ? " negative" : ""}`,
    });
    bar.style.width = `${(Math.abs(item.value) / max) * (signed ? 50 : 100)}%`;
    track.append(bar);
    const content = item.activate
      ? node("button", undefined, {
          type: "button",
          class: "chart-trigger",
          "aria-label": item.label,
        })
      : row;
    if (item.activate) {
      content.onclick = item.activate;
      row.append(content);
    }
    content.append(
      node("span", item.label, { class: "chart-label" }),
      track,
      node("span", format(item.value), { class: "chart-value" }),
    );
    list.append(row);
  }
  figure.append(list);
  return figure;
}
function render() {
  $("title").textContent = project
    ? `Journal de travail — ${project.projectName}`
    : "Journal de travail";
  $("subtitle").textContent = project
    ? `${Array.isArray(project.me) ? project.me.join(" / ") : project.me}${project.journalStartDate ? " — Depuis le " + new Date(project.journalStartDate).toLocaleDateString("fr-CH") : ""}`
    : "Ouvrez ou créez un projet .gitj dans votre dépôt Git, à la racine ou dans un sous-dossier.";
  for (const id of ["title", "subtitle"]) $(id).title = $(id).textContent;
  $("add").hidden = !project;
  $("journal").replaceChildren();
  journalRows.clear();
  if (!project) return;
  const table = node("table"),
    head = node("thead"),
    hr = node("tr"),
    body = node("tbody");
  for (const c of project.columns)
    hr.append(node("th", c.label, { scope: "col" }));
  hr.append(node("th", "Actions", { class: "row-actions" }));
  head.append(hr);
  table.append(head, body);
  for (const group of groupEntries(entries)) {
    for (const entry of group.entries) {
      const row = node("tr");
      row.dataset.date = entry.date;
      if (!entry.commentId) {
        row.className = "editable";
        row.tabIndex = 0;
        row.onclick = () => edit(entry);
        row.onkeydown = (e) => {
          if (e.key === "Enter" && e.target === row) edit(entry);
        };
      }
      for (const column of project.columns) {
        const cell = node("td");
        if (["date", "duration", "name", "description"].includes(column.source))
          cell.classList.add(`cell-${column.source}`);
        if (column.field === "description") {
          const condensed = condenseDescription(
            formatCell(entry, column),
            entry.source,
          );
          condensed.lines.forEach((segments, i) => {
            if (i) cell.append(node("br"));
            segments.forEach((s, j) => {
              if (j) cell.append(document.createTextNode(" "));
              cell.append(
                s.tags
                  ? node("em", "(balises)")
                  : document.createTextNode(s.text),
              );
            });
          });

          if (condensed.more) {
            cell.append(
              node("br"),
              entry.url
                ? link(entry.url, condensed.more)
                : node("em", condensed.more),
            );
          }
        } else if (column.format === "badge")
          cell.append(
            node("span", formatCell(entry, column), {
              class: `badge ${column.source === "status" && /^(done|wip)$/i.test(entry.status ?? "") ? `badge-${entry.status.toLowerCase()}` : ""}`,
            }),
          );
        else cell.textContent = formatCell(entry, column);
        row.append(cell);
      }
      const actions = node("td", undefined, { class: "row-actions" });
      if (!entry.commentId) {
        const b = node("button", "Modifier");
        b.onclick = (e) => {
          e.stopPropagation();
          edit(entry);
        };
        actions.append(b);
      }
      if (entry.url) actions.append(commitLink(entry));

      row.append(actions);
      body.append(row);
      journalRows.set(entry, row);
    }
    const row = node("tr", undefined, { class: "total day-total" });
    row.append(
      node(
        "td",
        `${new Date(group.day).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })} — ${Math.floor(group.minutes / 60)}h ${group.minutes % 60}m`,
        { colspan: String(project.columns.length + 1) },
      ),
    );
    body.append(row);
  }
  const total = entries.reduce((n, e) => n + Number(e.duration || 0), 0),
    row = node("tr", undefined, { class: "total project-total" });
  row.append(
    node("td", `Total du projet : ${Math.floor(total / 60)}h ${total % 60}m`, {
      colspan: String(project.columns.length + 1),
    }),
  );
  body.append(row);
  $("journal").append(table);
}
async function refresh() {
  if (!project) return;
  project = await invoke("current_project");
  status("Lecture du journal…");
  const data = await invoke("journal");
  entries = data.entries;
  stats = data.stats;
  render();
  status(
    stats.issuesError
      ? `Commentaires GitHub non lus : ${stats.issuesError}`
      : `${entries.length} entrées — ${stats.withMetadata} commits avec durée`,
    !!stats.issuesError,
  );
}
async function accept(p) {
  if (p) {
    project = p;
    await refresh();
  }
}
function edit(entry = {}) {
  const columns = project.columns.filter((c) => c.field);
  if (!columns.some((c) => c.field === "status"))
    columns.push({ label: "Statut", field: "status" });
  const fields = columns.map((c) => {
    let value = entry[c.field] ?? "";
    if (c.field === "date") {
      const { day, time } = entryDateParts(
        entry.date ?? new Date().toISOString(),
      );
      const group = node("div", undefined, { class: "entry-date" });
      const dateField = field("Date", "_entryDay", day, "date");
      const timeField = field("Heure locale", "_entryTime", time, "time");
      dateField.querySelector("input").required = true;
      const timeInput = timeField.querySelector("input");
      timeInput.required = true;
      timeInput.step = "60";
      group.append(dateField, timeField);
      return group;
    }
    if (c.field === "name") {
      const group = node("div");
      const prefix = field(
        "Préfixe de la tâche (facultatif)",
        "_taskPrefix",
        taskPrefix(value),
        "text",
        taskPrefixes,
      );
      prefix.querySelector("option").textContent = "Sans préfixe";
      const task = field(c.label, c.field, value);
      const select = prefix.querySelector("select");
      const input = task.querySelector("input");
      input.placeholder = "feat(interface): ajouter un filtre";
      select.onchange = () => {
        input.value = withTaskPrefix(input.value, select.value);
      };
      input.oninput = () => {
        select.value = taskPrefix(input.value);
      };
      group.append(prefix, task);
      return group;
    }
    if (c.field === "status") {
      value = /^(done|wip)$/i.test(value)
        ? value.toUpperCase() === "WIP"
          ? "WIP"
          : "Done"
        : "";
      const statusField = node("fieldset", undefined, {
        class: "status-options",
      });
      statusField.append(node("legend", c.label));
      for (const option of ["Done", "WIP"]) {
        const label = node("label");
        const input = node("input", undefined, {
          type: "radio",
          name: "status",
          value: option,
          required: "",
        });
        input.checked = value === option;
        label.append(input, node("span", option));
        statusField.append(label);
      }
      return statusField;
    }
    const wrapper = field(
      c.field === "duration" ? `${c.label} (min)` : c.label,
      c.field,
      value,
      c.field === "duration"
        ? "number"
        : c.field === "description"
          ? "textarea"
          : "text",
      ["select", "dropdown"].includes(c.type)
        ? (c.values ?? c.options ?? [])
        : undefined,
    );
    if (c.field === "duration") {
      const input = wrapper.querySelector("input");
      if (input) input.placeholder = "Ex. : 30";
    }
    return wrapper;
  });
  if (entry.sha || entry.id) {
    const remove = node(
      "button",
      entry.sha ? "Exclure le commit" : "Supprimer l’entrée manuelle",
      { type: "button" },
    );
    remove.onclick = async () => {
      if (!(await confirmAction("Confirmer cette opération ?"))) return;
      try {
        await invoke(entry.sha ? "exclude_entry" : "delete_entry", {
          key: entry.sha ?? entry.id,
        });
        $("modal").close();
        await refresh();
      } catch (e) {
        $("form-error").textContent = String(e);
      }
    };
    fields.push(remove);
  }
  dialog(
    entry.sha || entry.id ? "Modifier une entrée" : "Ajouter une entrée",
    fields,
    async (form) => {
      const values = Object.fromEntries(form);
      if ("_entryDay" in values)
        values.date = entryDateIso(
          values._entryDay,
          values._entryTime,
          entry.date,
        );
      delete values._entryDay;
      delete values._entryTime;
      delete values._taskPrefix;
      if ("duration" in values) values.duration = Number(values.duration) || 0;
      project = await invoke("update_entry", { entry, values });
      await refresh();
    },
  );
}
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const themes = {
  light: "Mode clair",
  dark: "Mode sombre",
  system: "Mode système",
};
let selectedTheme = localStorage.getItem("theme") ?? "light";

function applyTheme() {
  document.documentElement.dataset.theme =
    selectedTheme === "system"
      ? systemTheme.matches
        ? "dark"
        : "light"
      : selectedTheme;
}

function setTheme(theme) {
  localStorage.setItem("theme", theme);
  selectedTheme = theme;
  applyTheme();
  status(themes[theme]);
}

systemTheme.addEventListener("change", applyTheme);
applyTheme();

const actions = {
  "theme-light": () => setTheme("light"),
  "theme-dark": () => setTheme("dark"),
  "theme-system": () => setTheme("system"),
  new: () => {
    dialog(
      "Nouveau projet",
      [
        field("Nom du projet", "projectName"),
        field("Auteur(s) Git (virgule ou point-virgule)", "me"),
        field("URL du dépôt Git (facultative)", "repoUrl"),
        field("Date de début (facultative)", "since", "", "date"),
      ],
      async (form) => {
        const config = Object.fromEntries(form);
        config.me = config.me
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        config.projectName = config.projectName.trim();
        if (!config.projectName || !config.me.length)
          throw new Error("Nom du projet et auteur Git requis");
        config.journalStartDate = startDateIso(config.since);
        await accept(await invoke("create_project", { config }));
      },
    );
  },
  open: async () => accept(await invoke("open_project")),
  save: async () => {
    await invoke("save_project");
    status("Projet enregistré");
  },
  refresh,
  configure: () => {
    if (!project) return;
    dialog(
      "Configuration du projet .gitj",
      [
        field(
          "Configuration JSON : auteurs, colonnes, filtres et commentaires GitHub",
          "json",
          JSON.stringify(project, null, 2),
          "textarea",
        ),
      ],
      async (form) => {
        await accept(
          await invoke("configure_project", {
            project: JSON.parse(form.get("json")),
          }),
        );
      },
    );
  },
  "configure-export": configureExport,
  preferences: async () => {
    const prefs = await invoke("preferences");
    dialog(
      "Token GitHub",
      [
        field(
          "Token GitHub (vide pour utiliser GH_TOKEN / GITHUB_TOKEN / gh)",
          "githubToken",
          prefs.githubToken ?? "",
          "password",
        ),
      ],
      async (form) => {
        await invoke("set_preferences", { token: form.get("githubToken") });
        await refresh();
      },
    );
  },
  csv: () => exportJournal("csv"),
  markdown: () => exportJournal("md"),
  pdf: () => exportJournal("pdf"),
  print: () => {
    if (project) window.print();
  },
  stats: showStatistics,
  help: () =>
    dialog(
      "Aide RGitJournal",
      [$("help-content").content.cloneNode(true)],
      null,
    ),
};
const statisticsDate = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function timelineLabel(start, end) {
  const first = statisticsDate.format(new Date(start));
  return start === end
    ? first
    : `${first} au ${statisticsDate.format(new Date(end))}`;
}

function statisticsEntries(list) {
  const items = node("ul", undefined, { class: "stat-entry-list" });
  for (const entry of list) {
    const date = statisticsDate.format(new Date(entry.date));
    const button = node(
      "button",
      `${date} · ${entry.name || "Entrée sans titre"}`,
      { type: "button" },
    );
    button.onclick = () => {
      const row = journalRows.get(entry);
      if (!row) return;
      $("modal").close();
      if (!row.hasAttribute("tabindex")) row.tabIndex = -1;
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "center" });
    };
    const item = node("li");
    item.append(button);
    items.append(item);
  }
  return items;
}

function showStatistics() {
  const today = new Date().toISOString().slice(0, 10);
  const period = node("select", undefined, {
    "aria-label": "Période des statistiques",
  });
  for (const [value, label] of [
    ["week", "Cette semaine"],
    ["month", "Ce mois"],
    ["range", "Période personnalisée"],
    ["all", "Tout le journal"],
  ])
    period.append(node("option", label, { value }));
  const start = field("Du (UTC)", "stats-start", today, "date");
  const end = field("Au (UTC)", "stats-end", today, "date");
  const controls = node("div", undefined, { class: "stats-period" });
  const periodLabel = node("label", "Période");
  periodLabel.append(period);
  controls.append(periodLabel, start, end);
  const dates = node("p", undefined, { role: "status" });
  const content = node("div");
  const list = node("dl");
  for (const [key, label] of [
    ["fromUser", "Commits correspondant aux filtres"],
    ["withMetadata", "Commits avec durée"],
    ["withoutDuration", "Commits écartés faute de durée"],
    ["afterExclusions", "Commits après exclusions"],
    ["manualEntries", "Entrées manuelles"],
    ["issueComments", "Commentaires GitHub"],
    ["total", "Total des entrées"],
  ]) {
    list.append(node("dt", label), node("dd", String(stats[key] ?? 0)));
  }
  const details = node("details", undefined, { class: "collection-details" });
  details.append(
    node("summary", "Détail de la collecte du projet"),
    list,
    node("p", "Auteurs Git trouvés : " + (stats.gitUsers ?? []).join(", ")),
  );

  function update() {
    const mode = period.value;
    start.hidden = end.hidden = mode !== "range";
    content.replaceChildren();
    let selection;
    try {
      selection = statisticsPeriod(
        {
          period: mode,
          start: start.querySelector("input").value,
          end: end.querySelector("input").value,
        },
        today,
      );
    } catch (error) {
      dates.textContent = error.message;
      return;
    }
    const { range, previous, elapsed } = selection;
    dates.textContent = range.start
      ? `${timelineLabel(range.start, range.end)} · UTC`
      : "Tout le journal · UTC";
    const summary = journalSummary(
      exportEntries(entries, {
        period: range.start ? "range" : "all",
        ...range,
      }),
    );
    const cards = node("div", undefined, { class: "stat-cards" });
    for (const [label, value] of [
      ["Durée déclarée", minutesLabel(summary.totalMinutes)],
      ["Jours avec entrées", String(summary.activeDays)],
      ["Entrées affichées", String(summary.entryCount)],
      [
        "Avec une durée renseignée",
        `${summary.withDuration} sur ${summary.entryCount}`,
      ],
    ]) {
      const card = node("div", undefined, { class: "stat-card" });
      card.append(node("span", label), node("strong", value));
      cards.append(card);
    }
    content.append(cards);
    if (previous) {
      const minutesFor = (range) =>
        journalSummary(exportEntries(entries, { period: "range", ...range }))
          .totalMinutes;
      const current = minutesFor(elapsed);
      const before = minutesFor(previous);
      const delta = current - before;
      content.append(
        node(
          "p",
          `Mêmes jours écoulés · ${timelineLabel(elapsed.start, elapsed.end)} : ${minutesLabel(current)} · ${timelineLabel(previous.start, previous.end)} : ${minutesLabel(before)} · Écart : ${delta > 0 ? "+" : ""}${minutesLabel(delta)}`,
          { class: "chart-caption" },
        ),
      );
    }
    if (!summary.entryCount) {
      content.append(node("p", "Aucune entrée sur cette période."));
      return;
    }

    const charts = node("div", undefined, { class: "stat-charts" });
    const breakdown = node("section", undefined, { class: "stat-chart" });
    breakdown.hidden = true;
    const timeline = durationTimeline(summary.days, range, mode === "month");
    charts.append(
      barChart(
        "Évolution de la durée",
        "Durées déclarées · regroupement UTC",
        timeline.map(({ start, end, minutes }) => ({
          label: timelineLabel(start, end),
          value: minutes,
        })),
        minutesLabel,
      ),
      barChart(
        "Temps par type de tâche",
        "Sélectionnez un préfixe pour voir ses entrées.",
        summary.types.map(({ label, minutes, entries: matching }) => ({
          label,
          value: minutes,
          activate: () => {
            const title = node("h3", `Entrées · ${label}`, { tabindex: "-1" });
            breakdown.replaceChildren(title, statisticsEntries(matching));
            breakdown.hidden = false;
            title.focus();
          },
        })),
        minutesLabel,
      ),
      barChart(
        "Répartition des statuts",
        "Nombre d’entrées, y compris celles sans durée",
        summary.statuses.map(({ label, count }) => ({ label, value: count })),
        String,
      ),
    );
    const sources = node("section", undefined, { class: "stat-chart" });
    const sourceList = node("ul");
    for (const { label, count, minutes, withoutDuration } of summary.sources) {
      sourceList.append(
        node(
          "li",
          `${label} · ${count} entrée(s) · ${minutesLabel(minutes)} · ${withoutDuration} sans durée renseignée`,
        ),
      );
    }
    sources.append(node("h3", "Répartition par source"), sourceList);
    charts.append(sources);
    const pending = node("section", undefined, {
      class: "stat-chart stats-wip",
    });
    pending.append(
      node("h3", `WIP à revoir (${summary.wip.length})`),
      summary.wip.length
        ? statisticsEntries(summary.wip)
        : node("p", "Aucune entrée WIP sur cette période."),
    );
    content.append(charts, breakdown, pending);
  }
  controls.oninput = update;
  dialog("Statistiques", [controls, dates, content, details], null);
  $("modal").classList.add("stats-dialog");
  update();
}

function exportColumns() {
  const occurrences = new Map();
  return project.columns.map((column, index) => {
    const key = JSON.stringify([
      column.source,
      column.label,
      column.field,
      column.regex,
      column.group,
    ]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { ...column, index, key: JSON.stringify([key, occurrence]) };
  });
}

function selectedColumns(columns, keys) {
  if (!Array.isArray(keys)) return columns;
  return columns.filter((column) => keys.includes(column.key));
}

function configureExport() {
  if (!project)
    throw new Error("Ouvrez un projet pour configurer ses exports.");
  const configuredProject = project;
  const saved = project.exportOptions ?? {};
  const columns = exportColumns();
  const chosen = new Set(
    selectedColumns(columns, saved.columns).map((column) => column.key),
  );
  const authors = [
    ...new Set(
      entries
        .flatMap((entry) => entry.author)
        .filter((author) => typeof author === "string" && author),
    ),
  ].sort((a, b) => a.localeCompare(b));
  if (saved.author && !authors.includes(saved.author))
    authors.push(saved.author);

  function choice(label, name, options, fallback) {
    const wrapper = node("label", label);
    const select = node("select", undefined, { name });
    for (const [value, text] of options)
      select.append(node("option", text, { value }));
    select.value = saved[name] ?? fallback;
    if (select.selectedIndex === -1) select.value = fallback;
    wrapper.append(select);
    return wrapper;
  }
  function checkbox(label, name, checked, value = "on") {
    const wrapper = node("label", undefined, { class: "export-checkbox" });
    const input = node("input", undefined, { type: "checkbox", name, value });
    input.checked = checked;
    wrapper.append(input, node("span", label));
    return wrapper;
  }
  function section(title, ...fields) {
    const group = node("fieldset", undefined, { class: "export-section" });
    group.append(node("legend", title), ...fields);
    return group;
  }
  const date = choice(
    "Période (UTC)",
    "period",
    [
      ["all", "Toutes les dates"],
      ["range", "Dates personnalisées"],
      ["week", "Une semaine (lundi à dimanche)"],
      ["month", "Un mois"],
    ],
    "all",
  );
  const reference = field(
    "Date dans la semaine ou le mois",
    "reference",
    saved.reference ?? new Date().toISOString().slice(0, 10),
    "date",
  );
  const start = field("Du (inclus)", "start", saved.start, "date");
  const end = field("Au (inclus)", "end", saved.end, "date");
  const preview = node("p", "", { role: "status", class: "export-preview" });
  function updatePreview() {
    const period = date.querySelector("select").value;
    reference.hidden = !["week", "month"].includes(period);
    start.hidden = end.hidden = period !== "range";
    const values = Object.fromEntries(new FormData($("form")));
    try {
      const range = exportPeriod(values);
      const count = exportEntries(entries, values).length;
      const dates = range.start
        ? ` · Du ${range.start} au ${range.end} (UTC)`
        : "";
      preview.textContent = `${count} entrée(s) à exporter${dates}`;
    } catch (error) {
      preview.textContent = error.message;
    }
  }
  dialog(
    "Structure Export",
    [
      node(
        "p",
        "Ces réglages s’appliquent aux commandes de Fichier → Exporter.",
      ),
      section(
        "Filtres",
        date,
        reference,
        start,
        end,
        choice(
          "Auteur",
          "author",
          [["", "Tous"], ...authors.map((author) => [author, author])],
          "",
        ),
        choice(
          "Statut",
          "status",
          [
            ["", "Tous"],
            ["done", "Done"],
            ["wip", "WIP"],
            ["other", "Autre / non renseigné"],
          ],
          "",
        ),
        choice(
          "Source",
          "source",
          [
            ["", "Toutes"],
            ["commit", "Commits Git"],
            ["manual", "Entrées manuelles"],
            ["github", "Commentaires GitHub"],
          ],
          "",
        ),
        preview,
      ),
      section(
        "Contenu",
        ...columns.map((column) =>
          checkbox(column.label, "columns", chosen.has(column.key), column.key),
        ),
        checkbox(
          "Inclure les statistiques des entrées exportées",
          "statistics",
          saved.statistics === true,
        ),
      ),
      section(
        "Markdown (.md)",
        checkbox(
          "Afficher le titre du projet",
          "heading",
          saved.heading !== false,
        ),
        checkbox(
          "Ajouter une colonne de liens vers les sources",
          "sourceLinks",
          saved.sourceLinks === true,
        ),
      ),
      section(
        "CSV (.csv)",
        choice(
          "Séparateur",
          "separator",
          [
            [",", "Virgule"],
            [";", "Point-virgule"],
            ["tab", "Tabulation"],
          ],
          ",",
        ),
        checkbox("Inclure la marque UTF-8 (BOM)", "bom", saved.bom !== false),
      ),
      section(
        "PDF (.pdf)",
        choice(
          "Orientation A4",
          "orientation",
          [
            ["landscape", "Paysage"],
            ["portrait", "Portrait"],
          ],
          "landscape",
        ),
        checkbox(
          "Répéter les en-têtes sur chaque page",
          "repeatHeaders",
          saved.repeatHeaders !== false,
        ),
      ),
    ],
    async (form) => {
      const {
        period,
        reference,
        start,
        end,
        author,
        status: entryStatus,
        source,
        separator,
        orientation,
      } = Object.fromEntries(form);
      const options = {
        period,
        ...(period === "range" ? { start, end } : {}),
        ...(["week", "month"].includes(period) ? { reference } : {}),
        author,
        status: entryStatus,
        source,
        separator,
        orientation,
      };
      exportPeriod(options);
      const checked = form.getAll("columns");
      if (!checked.length) throw new Error("Choisissez au moins une colonne.");
      if (checked.length !== columns.length) options.columns = checked;
      for (const name of [
        "statistics",
        "heading",
        "sourceLinks",
        "bom",
        "repeatHeaders",
      ])
        options[name] = form.has(name);
      if (project !== configuredProject)
        throw new Error("Le projet ouvert a changé.");
      project = await invoke("configure_project", {
        project: { ...project, exportOptions: options },
      });
      status("Structure d’export enregistrée.");
    },
  );
  $("fields").oninput = updatePreview;
  updatePreview();
}

function exportReport(format, options, included) {
  const columns = selectedColumns(exportColumns(), options.columns);
  if (!columns.length)
    throw new Error(
      "Choisissez des colonnes dans Configuration → Structure Export.",
    );
  const sourceLinks = format === "md" && options.sourceLinks === true;
  const headers = columns.map((column) => column.label);
  if (sourceLinks) headers.push("Lien source");
  const rows = [];
  const links = [];
  function addRow(values, urls = []) {
    rows.push(values);
    links.push(urls);
  }
  for (const group of groupEntries(included)) {
    for (const entry of group.entries) {
      const rendered = journalRows.get(entry);
      const cells = columns.map(({ index }) => rendered.cells[index]);
      const values = cells.map((cell) => cell.innerText.trim());
      const urls = cells.map(
        (cell) => cell.querySelector("a[data-url]")?.dataset.url,
      );
      if (sourceLinks) {
        values.push(entry.url ? "Voir la source" : "");
        urls.push(entry.url);
      }
      addRow(values, urls);
    }
    if (format !== "csv") {
      const day = new Date(group.day).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      addRow([
        `${day} — ${Math.floor(group.minutes / 60)}h ${group.minutes % 60}m`,
      ]);
    }
  }
  const summary = journalSummary(included);
  if (format !== "csv") {
    const scope =
      included.length === entries.length ? "du projet" : "de la sélection";
    const minutes = summary.totalMinutes;
    addRow([`Total ${scope} : ${Math.floor(minutes / 60)}h ${minutes % 60}m`]);
  }
  if (options.statistics) {
    addRow(["Statistiques"]);
    for (const [name, value] of [
      ["Entrées", summary.entryCount],
      ["Jours avec entrées", summary.activeDays],
      ["Durée totale (min)", summary.totalMinutes],
      ["Entrées avec une durée renseignée", summary.withDuration],
      ...durationTimeline(
        summary.days,
        exportPeriod(options),
        options.period === "month",
      ).map(({ start, end, minutes }) => [
        `Durée · ${timelineLabel(start, end)} (min)`,
        minutes,
      ]),
      ...summary.types.map(({ label, minutes }) => [
        `Type · ${label} (min)`,
        minutes,
      ]),
      ...summary.sources.flatMap(
        ({ label, count, minutes, withoutDuration }) => [
          [`${label} · Entrées`, count],
          [`${label} · Durée (min)`, minutes],
          [`${label} · Sans durée renseignée`, withoutDuration],
        ],
      ),
      ...summary.statuses.map(({ label, count }) => [label, count]),
    ]) {
      addRow(
        format === "csv" && headers.length > 1
          ? [name, String(value)]
          : [`${name} : ${value}`],
      );
    }
  }
  return {
    headers,
    rows,
    links,
    orientation: options.orientation,
    repeatHeaders: options.repeatHeaders,
  };
}

async function exportJournal(format) {
  if (!project) return;
  const options = project.exportOptions ?? {};
  const included = exportEntries(entries, options);
  if (entries.length && !included.length)
    throw new Error(
      "Aucune entrée ne correspond. Vérifiez Configuration → Structure Export.",
    );
  const table = exportReport(format, options, included);
  const title = project.projectName;
  let content = "";
  if (format === "csv") {
    const separator =
      { ",": ",", ";": ";", tab: "\t" }[options.separator] ?? ",";
    content = csv(
      table.headers,
      table.rows.map((row) => table.headers.map((_, index) => row[index])),
      { separator, bom: options.bom !== false },
    );
  } else if (format === "md") {
    content = markdown(title, table.headers, table.rows, table.links, {
      heading: options.heading !== false,
    });
  }
  const path = await invoke("export_file", { format, content, table, title });
  if (path)
    status(
      `${format === "md" ? "Markdown" : format.toUpperCase()} exporté : ${path}`,
    );
}
$("cancel").onclick = () => $("modal").close();
$("add").onclick = () => edit();
$("journal-stats").onclick = () => run(actions.stats);
$("journal-help").onclick = () => run(actions.help);
let zoom = 1;
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  const action = {
    n: "new",
    o: "open",
    s: "save",
    r: "refresh",
    e: event.shiftKey ? "csv" : "pdf",
    p: "print",
    ",": "preferences",
  }[key];
  if (action) {
    event.preventDefault();
    if (!$("modal").open) run(actions[action]);
  } else if (["+", "=", "-", "0"].includes(key)) {
    event.preventDefault();
    zoom =
      key === "0"
        ? 1
        : Math.max(0.5, Math.min(2, zoom + (key === "-" ? -0.1 : 0.1)));
    document.body.style.zoom = zoom;
  }
});
window.__TAURI__.event.listen("menu-action", (event) => {
  if (actions[event.payload] && !$("modal").open) run(actions[event.payload]);
});
window.__TAURI__.event.listen("project-error", (event) =>
  status(String(event.payload), true),
);
window.__TAURI__.event.listen("project-opened", () =>
  run(async () => accept(await invoke("current_project"))),
);
run(async () => accept(await invoke("initial_project")));

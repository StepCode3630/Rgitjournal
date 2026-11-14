import {
  groupEntries,
  formatCell,
  csv,
  exportTable,
  startDateIso,
  taskPrefixes,
  taskPrefix,
  withTaskPrefix,
  entryDateParts,
  entryDateIso,
} from "./model.js";
import { condenseDescription } from "./description-filter.js";
const invoke = (...args) => window.__TAURI__.core.invoke(...args);
const $ = (id) => document.getElementById(id);
let project = null,
  entries = [],
  stats = {},
  busy = false;
const node = (tag, text, attributes = {}) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  return el;
};
function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
async function run(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("nav button").forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    status(String(e), true);
  } finally {
    busy = false;
    document
      .querySelectorAll("nav button")
      .forEach((b) => (b.disabled = $("modal").open));
  }
}
function dialog(title, fields, submit, label = "Enregistrer") {
  $("dialog-title").textContent = title;
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
function render() {
  $("title").textContent = project
    ? `Journal de travail — ${project.projectName}`
    : "Journal de travail";
  $("subtitle").textContent = project
    ? `${Array.isArray(project.me) ? project.me.join(" / ") : project.me}${project.journalStartDate ? " — Depuis le " + new Date(project.journalStartDate).toLocaleDateString("fr-CH") : ""}`
    : "Ouvrez ou créez un projet .gitj dans votre dépôt Git, à la racine ou dans un sous-dossier.";
  $("add").hidden = !project;
  $("journal").replaceChildren();
  if (!project) return;
  const table = node("table"),
    head = node("thead"),
    hr = node("tr"),
    body = node("tbody");
  for (const c of project.columns) hr.append(node("th", c.label));
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
          if (e.key === "Enter") edit(entry);
        };
      }
      for (const column of project.columns) {
        const cell = node("td");
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
            node("span", formatCell(entry, column), { class: "badge" }),
          );
        else cell.textContent = formatCell(entry, column);
        row.append(cell);
      }
      const actions = node("td", undefined, { class: "row-actions" });
      if (entry.url)
        actions.append(
          link(entry.url, entry.commentId ? "GitHub ↗" : "Commit ↗"),
        );
      if (!entry.commentId) {
        const b = node("button", "Modifier");
        b.onclick = (e) => {
          e.stopPropagation();
          edit(entry);
        };
        actions.append(b);
      }
      row.append(actions);
      body.append(row);
    }
    const row = node("tr", undefined, { class: "total" });
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
    row = node("tr", undefined, { class: "total" });
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
      const statusField = field(c.label, c.field, value, "text", [
        "Done",
        "WIP",
      ]);
      const select = statusField.querySelector("select");
      select.required = true;
      select.options[0].textContent = "Choisir un statut";
      select.options[0].disabled = true;
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
const actions = {
  new: () => {
    dialog(
      "Nouveau projet",
      [
        field("Nom du projet", "projectName"),
        field("Auteur(s) Git (virgule ou point-virgule)", "me"),
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
  preferences: async () => {
    const prefs = await invoke("preferences");
    dialog(
      "Préférences",
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
  csv: async () => {
    if (!project) return;
    const table = tableForExport();
    const path = await invoke("export_file", {
      format: "csv",
      content: csv(table.headers, table.rows),
      table,
      title: project.projectName,
    });
    if (path) status("CSV exporté : " + path);
  },
  pdf: async () => {
    if (!project) return;
    const path = await invoke("export_file", {
      format: "pdf",
      content: "",
      table: tableForPdf(),
      title: project.projectName,
    });
    if (path) status("PDF exporté : " + path);
  },
  print: () => {
    if (project) window.print();
  },
  stats: () => {
    const list = node("dl");
    for (const [key, label] of [
      ["fromUser", "Commits correspondant aux filtres"],
      ["withMetadata", "Commits avec durée"],
      ["afterExclusions", "Commits après exclusions"],
      ["manualEntries", "Entrées manuelles"],
      ["issueComments", "Commentaires GitHub"],
      ["total", "Total des entrées"],
    ]) {
      list.append(node("dt", label), node("dd", String(stats[key] ?? 0)));
    }
    dialog(
      "Statistiques",
      [
        list,
        node("p", "Auteurs Git trouvés : " + (stats.gitUsers ?? []).join(", ")),
      ],
      null,
    );
  },
  help: () =>
    dialog(
      "Aide GitJournal",
      [
        node(
          "p",
          "Placez le fichier .gitj dans le dépôt, à la racine ou dans un sous-dossier (par exemple doc/Journal). Git retrouve automatiquement le dépôt parent. Les commits locaux de toutes les branches sont filtrés par auteur et date. Les durées proviennent exclusivement des métadonnées déclarées.",
        ),
        node(
          "p",
          "Formats : [2h30 done], [45m wip], [5], [2][30][Done]. La première ligne reconnue fait foi. Les commentaires GitHub sont en lecture seule et peuvent être inclus sans durée.",
        ),
        node(
          "p",
          "Configuration : colonnes personnalisées, source, field, regex, group, format, type select/dropdown et values/options. includeIssues active les commentaires ; githubUsers ajoute des logins.",
        ),
        node(
          "p",
          "Raccourcis : Ctrl/Cmd+N nouveau, O ouvrir, S enregistrer, R actualiser, E PDF, Maj+E CSV, P imprimer. Préférences : Ctrl/Cmd+virgule. Zoom : Ctrl/Cmd + / − / 0.",
        ),
      ],
      null,
    ),
};
function tableForPdf() {
  const table = tableForExport();
  const rows = [...document.querySelectorAll("tbody tr")];
  table.rows = rows.map((row) =>
    [...row.cells]
      .slice(0, project.columns.length)
      .map((c) => c.innerText.trim()),
  );
  table.links = rows.map((row) =>
    [...row.cells]
      .slice(0, project.columns.length)
      .map((cell) => cell.querySelector("a[data-url]")?.dataset.url ?? null),
  );
  return table;
}
function tableForExport() {
  // Export exactly the visible cell text, including condensed descriptions.
  const table = exportTable(entries, project.columns);
  table.rows = [...document.querySelectorAll("tbody tr[data-date]")].map(
    (row) =>
      [...row.cells]
        .slice(0, project.columns.length)
        .map((c) => c.innerText.trim()),
  );
  return table;
}
$("modal").addEventListener("close", () =>
  document.querySelectorAll("nav button").forEach((b) => (b.disabled = busy)),
);
$("cancel").onclick = () => $("modal").close();
$("add").onclick = () => edit();
for (const button of document.querySelectorAll("[data-action]"))
  button.onclick = () => run(actions[button.dataset.action]);
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

import { PATTERNS } from "@shadow-ai/core/detect";
import { aiServices } from "@shadow-ai/core/services";
import type { LocalStats } from "./stats";

function addRow(list: HTMLElement, label: string, count: number): void {
  const item = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("strong");
  value.textContent = String(count);
  item.append(name, value);
  list.append(item);
}

export function renderStats(root: HTMLElement, stats: LocalStats): void {
  root.replaceChildren();
  const since = document.createElement("p");
  since.textContent = `Counting since ${stats.since.slice(0, 10)}. These counts stay in this browser.`;
  root.append(since);

  const visits = Object.entries(stats.visitsByService).sort((left, right) => right[1] - left[1]);
  const visitHeading = document.createElement("h2");
  visitHeading.textContent = "AI site visits";
  root.append(visitHeading);
  if (visits.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No AI-site visits recorded in this browser yet.";
    root.append(empty);
  } else {
    const list = document.createElement("ul");
    for (const [id, count] of visits) {
      addRow(list, aiServices.find((service) => service.id === id)?.name ?? id, count);
    }
    root.append(list);
  }

  const warningHeading = document.createElement("h2");
  warningHeading.textContent = "Paste warnings";
  root.append(warningHeading);
  const warnings = Object.entries(stats.warningsByPattern);
  if (warnings.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No sensitive-pattern warnings yet.";
    root.append(empty);
  } else {
    const list = document.createElement("ul");
    for (const pattern of PATTERNS) {
      const count = stats.warningsByPattern[pattern.id] ?? 0;
      if (count > 0) addRow(list, pattern.label, count);
    }
    root.append(list);
  }
}

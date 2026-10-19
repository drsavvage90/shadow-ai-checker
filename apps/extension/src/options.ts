import type { LocalStats } from "./stats";
import { renderStats } from "./render";

const root = document.querySelector<HTMLElement>("#stats");
const reset = document.querySelector("#reset");

function load(): void {
  chrome.runtime.sendMessage({ type: "get-stats" }, (response: { ok?: boolean; stats?: LocalStats } | undefined) => {
    if (!root) return;
    if (!response?.ok || !response.stats) {
      root.textContent = "Counts are unavailable.";
      return;
    }
    renderStats(root, response.stats);
  });
}

reset?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reset" }, () => load());
});

load();

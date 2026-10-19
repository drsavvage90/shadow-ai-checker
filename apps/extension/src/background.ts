import { matchService } from "@shadow-ai/core/services";
import { reportAnonymousCounts } from "./report-counts";
import { emptyStats, parseStats, recordVisit, recordWarning, toSnapshot, type LocalStats } from "./stats";

const KEY = "shadowAiCounts";

async function readStats(): Promise<LocalStats> {
  const stored = await chrome.storage.local.get(KEY);
  return parseStats(stored[KEY]);
}

async function writeStats(stats: LocalStats): Promise<LocalStats> {
  await chrome.storage.local.set({ [KEY]: stats });
  await reportAnonymousCounts(toSnapshot(stats));
  return stats;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void handle(message)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false }));
  return true;
});

async function handle(message: unknown): Promise<unknown> {
  if (typeof message !== "object" || message === null || !("type" in message)) return { ok: false };
  const type = message.type;
  if (type === "get-stats") return { ok: true, stats: await readStats() };
  if (type === "reset") return { ok: true, stats: await writeStats(emptyStats()) };
  if (type === "visit" && "host" in message && typeof message.host === "string") {
    const service = matchService(message.host);
    if (!service) return { ok: true, ignored: true };
    return { ok: true, stats: await writeStats(recordVisit(await readStats(), service.id, new Date().toISOString())) };
  }
  if (type === "warning" && "patterns" in message && Array.isArray(message.patterns)) {
    const patterns = message.patterns.filter((id): id is string => typeof id === "string");
    return {
      ok: true,
      stats: await writeStats(recordWarning(await readStats(), patterns, new Date().toISOString())),
    };
  }
  return { ok: false };
}

import { PATTERN_IDS, type PatternId } from "@shadow-ai/core/detect";
import type { AnonymousCountSnapshot } from "@shadow-ai/core/report";

export type LocalStats = {
  schema: "shadow-ai-counts.v1";
  since: string;
  visitsByService: Record<string, number>;
  warningsByPattern: Record<string, number>;
  lastEventAt: string | null;
};

const knownPatterns = new Set<string>(PATTERN_IDS);

export function emptyStats(now = new Date().toISOString()): LocalStats {
  return {
    schema: "shadow-ai-counts.v1",
    since: now,
    visitsByService: {},
    warningsByPattern: {},
    lastEventAt: null,
  };
}

export function recordVisit(stats: LocalStats, serviceId: string, now: string): LocalStats {
  if (!/^[a-z0-9-]{2,40}$/.test(serviceId)) return stats;
  return {
    ...stats,
    lastEventAt: now,
    visitsByService: {
      ...stats.visitsByService,
      [serviceId]: (stats.visitsByService[serviceId] ?? 0) + 1,
    },
  };
}

export function recordWarning(stats: LocalStats, patternIds: readonly string[], now: string): LocalStats {
  const warnings = { ...stats.warningsByPattern };
  let changed = false;
  for (const id of patternIds) {
    if (!knownPatterns.has(id)) continue;
    warnings[id] = (warnings[id] ?? 0) + 1;
    changed = true;
  }
  if (!changed) return stats;
  return { ...stats, warningsByPattern: warnings, lastEventAt: now };
}

export function toSnapshot(stats: LocalStats, now = new Date().toISOString()): AnonymousCountSnapshot {
  return {
    schema: "shadow-ai-counts.v1",
    since: stats.since,
    generatedAt: now,
    visitsByService: { ...stats.visitsByService },
    warningsByPattern: { ...stats.warningsByPattern },
  };
}

function numericMap(value: unknown, allow: (key: string) => boolean): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (!allow(key) || typeof count !== "number" || !Number.isFinite(count) || count < 0) continue;
    counts[key] = count;
  }
  return counts;
}

export function parseStats(raw: unknown): LocalStats {
  if (typeof raw !== "object" || raw === null) return emptyStats();
  const value = raw as Partial<LocalStats>;
  if (value.schema !== "shadow-ai-counts.v1" || typeof value.since !== "string") return emptyStats();
  return {
    schema: "shadow-ai-counts.v1",
    since: value.since,
    visitsByService: numericMap(value.visitsByService, (key) => /^[a-z0-9-]{2,40}$/.test(key)),
    warningsByPattern: numericMap(value.warningsByPattern, (key) => knownPatterns.has(key)),
    lastEventAt: typeof value.lastEventAt === "string" ? value.lastEventAt : null,
  };
}

export function isKnownPattern(id: string): id is PatternId {
  return knownPatterns.has(id);
}

import { matchService, type Signal } from "@shadow-ai/core";
import type { ParsedLog } from "./log.js";

export type ScanHit = {
  serviceId: string;
  serviceName: string;
  signal: Signal;
  domain: string;
  queries: number;
  clients: number;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type ServiceRollup = {
  serviceId: string;
  serviceName: string;
  signal: Signal;
  queries: number;
  domains: string[];
};

export type ScanReport = {
  source: string;
  format: ParsedLog["format"];
  totalLines: number;
  parsedQueries: number;
  matchedQueries: number;
  hits: ScanHit[];
  byService: ServiceRollup[];
  generatedAt: string;
};

export function buildReport(input: {
  source: string;
  parsed: ParsedLog;
  generatedAt?: string;
}): ScanReport {
  const groups = new Map<string, { hit: ScanHit; clients: Set<string> }>();
  let matchedQueries = 0;
  for (const event of input.parsed.events) {
    const service = matchService(event.domain);
    if (!service) continue;
    matchedQueries += 1;
    const key = `${service.id}\t${event.domain}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        clients: new Set<string>(),
        hit: {
          serviceId: service.id,
          serviceName: service.name,
          signal: service.signal,
          domain: event.domain,
          queries: 0,
          clients: 0,
          firstSeen: event.seen,
          lastSeen: event.seen,
        },
      };
      groups.set(key, group);
    }
    group.hit.queries += 1;
    group.hit.lastSeen = event.seen;
    if (event.client) group.clients.add(event.client);
  }

  const hits = [...groups.values()]
    .map(({ hit, clients }) => ({ ...hit, clients: clients.size }))
    .sort(
      (left, right) =>
        right.queries - left.queries ||
        left.serviceName.localeCompare(right.serviceName) ||
        left.domain.localeCompare(right.domain),
    );

  const rollups = new Map<string, ServiceRollup>();
  for (const hit of hits) {
    const current = rollups.get(hit.serviceId);
    if (!current) {
      rollups.set(hit.serviceId, {
        serviceId: hit.serviceId,
        serviceName: hit.serviceName,
        signal: hit.signal,
        queries: hit.queries,
        domains: [hit.domain],
      });
      continue;
    }
    current.queries += hit.queries;
    current.domains.push(hit.domain);
  }
  const byService = [...rollups.values()].sort(
    (left, right) => right.queries - left.queries || left.serviceName.localeCompare(right.serviceName),
  );

  return {
    source: input.source,
    format: input.parsed.format,
    totalLines: input.parsed.totalLines,
    parsedQueries: input.parsed.events.length,
    matchedQueries,
    hits,
    byService,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function renderCsv(report: ScanReport): string {
  const header = ["service_id", "service_name", "signal", "domain", "queries", "clients", "first_seen", "last_seen"];
  const rows = report.hits.map((hit) =>
    [
      hit.serviceId,
      hit.serviceName,
      hit.signal,
      hit.domain,
      hit.queries,
      hit.clients,
      hit.firstSeen,
      hit.lastSeen,
    ]
      .map((value) => csvCell(value))
      .join(","),
  );
  return `${header.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

export function renderMarkdown(report: ScanReport): string {
  const lines = [
    "# Shadow AI DNS report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source}`,
    `Format: ${report.format}`,
    `Lines read: ${report.totalLines}`,
    `Parsed queries: ${report.parsedQueries}`,
    `Queries matched to an AI service: ${report.matchedQueries}`,
    "",
    "This report helps reduce risk. It only sees DNS queries that reached this resolver. It does not cover unmanaged or personal devices, cellular networks, or DNS-over-HTTPS that bypasses the resolver. A name on this list is a lead, not proof of what was typed into the tool.",
    "",
    "## By service",
    "",
  ];
  if (report.byService.length === 0) {
    lines.push("No queries matched the AI-service catalog.", "");
  } else {
    lines.push("| Service | Signal | Queries | Domains |", "| --- | --- | --- | --- |");
    for (const service of report.byService) {
      lines.push(`| ${service.serviceName} | ${service.signal} | ${service.queries} | ${service.domains.join(", ")} |`);
    }
    lines.push("", "## Query detail", "", "| Service | Domain | Queries | Clients | First seen | Last seen |", "| --- | --- | --- | --- | --- | --- |");
    for (const hit of report.hits) {
      lines.push(
        `| ${hit.serviceName} | ${hit.domain} | ${hit.queries} | ${hit.clients} | ${hit.firstSeen ?? ""} | ${hit.lastSeen ?? ""} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "Domains that are not in the catalog are omitted. The blocklist export is the full catalog, not only what this log contained.",
    "",
  );
  return lines.join("\n");
}

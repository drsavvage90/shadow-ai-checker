export type LogFormat = "auto" | "dnsmasq" | "pihole" | "bind" | "csv" | "pihole-db";

export type DnsEvent = {
  domain: string;
  client: string | null;
  seen: string | null;
};

export type ParsedLog = {
  format: Exclude<LogFormat, "auto" | "pihole">;
  totalLines: number;
  events: DnsEvent[];
};

const DNSMASQ = /query\[([^\]]+)\]\s+(\S+)\s+from\s+(\S+)/;
const BIND_QUERY = /query:\s+(\S+)\s+IN\s+/i;
const BIND_CLIENT = /client(?:\s+@\S+)?\s+([0-9a-f:.]+)#/i;

export function normalizeQuery(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.includes("/") || value.includes(" ")) return null;
  if (value.endsWith(".in-addr.arpa") || value.endsWith(".ip6.arpa")) return null;
  if (!/^[a-z0-9.-]+$/.test(value) || !value.includes(".") || value.includes("..")) return null;
  return value;
}

export function cleanClient(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value === "-" || value === "unknown") return null;
  return value;
}

function leadingTimestamp(line: string): string | null {
  const match =
    /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/.exec(line) ??
    /^(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(line) ??
    /^([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/.exec(line);
  return match?.[1] ?? null;
}

export function parseDnsmasqLine(line: string): DnsEvent | null {
  const match = DNSMASQ.exec(line);
  const domain = normalizeQuery(match?.[2] ?? "");
  if (!match || !domain) return null;
  return { domain, client: cleanClient(match[3] ?? ""), seen: leadingTimestamp(line) };
}

export function parseBindLine(line: string): DnsEvent | null {
  const query = BIND_QUERY.exec(line);
  const domain = normalizeQuery(query?.[1] ?? "");
  if (!query || !domain) return null;
  const client = BIND_CLIENT.exec(line);
  return { domain, client: cleanClient(client?.[1] ?? ""), seen: leadingTimestamp(line) };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = false;
      } else current += char ?? "";
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else current += char ?? "";
  }
  cells.push(current);
  return cells;
}

const DOMAIN_HEADERS = new Set(["domain", "query", "qname", "name", "host"]);
const CLIENT_HEADERS = new Set(["client", "source", "ip", "client_ip", "origin"]);
const TIME_HEADERS = new Set(["time", "timestamp", "date", "datetime"]);

export function looksLikeCsvHeader(line: string): boolean {
  const delimiter = line.includes("\t") && !line.includes(",") ? "\t" : ",";
  if (!line.includes(delimiter)) return false;
  return parseCsvLine(line, delimiter).some((cell) => DOMAIN_HEADERS.has(cell.trim().toLowerCase()));
}

export function parseCsv(text: string): DnsEvent[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  const headerLine = lines[0];
  if (!headerLine) throw new Error("CSV log is empty.");
  const delimiter = headerLine.includes("\t") && !headerLine.includes(",") ? "\t" : ",";
  const headers = parseCsvLine(headerLine, delimiter).map((cell) => cell.trim().toLowerCase());
  const domainIndex = headers.findIndex((header) => DOMAIN_HEADERS.has(header));
  if (domainIndex < 0) {
    throw new Error("CSV needs a domain, query, qname, name, or host column.");
  }
  const clientIndex = headers.findIndex((header) => CLIENT_HEADERS.has(header));
  const timeIndex = headers.findIndex((header) => TIME_HEADERS.has(header));
  const events: DnsEvent[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line, delimiter);
    const domain = normalizeQuery(cells[domainIndex] ?? "");
    if (!domain) continue;
    const seen = timeIndex >= 0 ? cells[timeIndex]?.trim() || null : null;
    events.push({
      domain,
      client: clientIndex >= 0 ? cleanClient(cells[clientIndex] ?? "") : null,
      seen,
    });
  }
  return events;
}

export function parseLogText(text: string, requested: LogFormat): ParsedLog {
  const format = requested === "pihole" ? "dnsmasq" : requested;
  if (format === "pihole-db") {
    throw new Error("Pi-hole database scans need a file path, not pasted text.");
  }
  const lines = text.split(/\r?\n/);
  if (format === "csv") return { format: "csv", totalLines: lines.length, events: parseCsv(text) };
  const firstContent = lines.find((line) => line.trim() && !line.trim().startsWith("#"));
  if (format === "auto" && firstContent && looksLikeCsvHeader(firstContent)) {
    return { format: "csv", totalLines: lines.length, events: parseCsv(text) };
  }

  const events: DnsEvent[] = [];
  let dnsmasqHits = 0;
  let bindHits = 0;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (format === "dnsmasq" || format === "auto") {
      const event = parseDnsmasqLine(line);
      if (event) {
        events.push(event);
        dnsmasqHits += 1;
        continue;
      }
    }
    if (format === "bind" || format === "auto") {
      const event = parseBindLine(line);
      if (event) {
        events.push(event);
        bindHits += 1;
      }
    }
  }
  const detected = format === "auto" ? (bindHits > dnsmasqHits ? "bind" : "dnsmasq") : format;
  return { format: detected, totalLines: lines.length, events };
}

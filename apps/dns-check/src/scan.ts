import { readFileSync } from "node:fs";
import { cleanClient, normalizeQuery, parseLogText, type DnsEvent, type LogFormat } from "./log.js";
import { buildReport, type ScanReport } from "./report.js";

type SqliteDatabase = {
  prepare(sql: string): { all(): Array<Record<string, unknown>> };
  close(): void;
};

function isSqlite(buffer: Buffer): boolean {
  return buffer.subarray(0, 15).toString("utf8") === "SQLite format 3";
}

async function readPiholeDb(filePath: string): Promise<DnsEvent[]> {
  const sqlite = (await import("node:sqlite")) as {
    DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;
  };
  const db = new sqlite.DatabaseSync(filePath, { readOnly: true });
  try {
    const rows = db.prepare("SELECT domain, timestamp, client FROM queries ORDER BY timestamp ASC").all();
    const events: DnsEvent[] = [];
    for (const row of rows) {
      const domain = normalizeQuery(String(row.domain ?? ""));
      if (!domain) continue;
      const seen = typeof row.timestamp === "number" ? new Date(row.timestamp * 1000).toISOString() : null;
      events.push({ domain, client: cleanClient(String(row.client ?? "")), seen });
    }
    return events;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `This SQLite file does not look like a Pi-hole FTL query database (expected a queries table with domain, timestamp, and client). ${reason}`,
    );
  } finally {
    db.close();
  }
}

export async function scanPath(filePath: string, requested: LogFormat, generatedAt?: string): Promise<ScanReport> {
  const buffer = readFileSync(filePath);
  if (requested === "pihole-db" || (requested === "auto" && isSqlite(buffer))) {
    if (!isSqlite(buffer)) throw new Error("That file is not a SQLite database.");
    const events = await readPiholeDb(filePath);
    return buildReport({
      source: filePath,
      generatedAt,
      parsed: { format: "pihole-db", totalLines: events.length, events },
    });
  }
  const parsed = parseLogText(buffer.toString("utf8"), requested);
  return buildReport({ source: filePath, parsed, generatedAt });
}

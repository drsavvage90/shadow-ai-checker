import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { renderAllowlist, renderBlocklist } from "./lists.js";
import type { LogFormat } from "./log.js";
import { renderCsv, renderMarkdown } from "./report.js";
import { scanPath } from "./scan.js";

const FORMATS = new Set<LogFormat>(["auto", "dnsmasq", "pihole", "bind", "csv", "pihole-db"]);

function flagString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const HELP = `Shadow AI Checker — DNS log scan
by Vault Systems (https://vaultsystems.ai)

The scan reads a log you already have. It does not send queries or results anywhere.
It helps reduce risk on resolvers the firm controls. It does not cover unmanaged or personal devices.

Usage:
  shadow-ai-dns scan --input <file> [--format auto|dnsmasq|pihole|bind|csv|pihole-db] [--out <dir>]
  shadow-ai-dns export-lists --out <dir>
  shadow-ai-dns help

--format pihole reads a Pi-hole or dnsmasq log (query[A] lines).
--format pihole-db reads a Pi-hole FTL SQLite database with a queries table.
--format csv expects a header with a domain column (domain, query, qname, name, or host).

scan writes shadow-ai-dns-report.md and shadow-ai-dns-report.csv.
export-lists writes shadow-ai-blocklist.txt and shadow-ai-allowlist.txt.
`;

export type Io = {
  log: (message: string) => void;
  error: (message: string) => void;
};

const defaultIo: Io = { log: (message) => console.log(message), error: (message) => console.error(message) };

export async function main(argv: string[], io: Io = defaultIo): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        input: { type: "string" },
        format: { type: "string", default: "auto" },
        out: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      } as const,
    });
  } catch (error) {
    io.error(error instanceof Error ? error.message : "Could not read arguments.");
    io.error(HELP);
    return 2;
  }

  const command = parsed.positionals[0] ?? "help";
  if (parsed.values.help || command === "help") {
    io.log(HELP);
    return 0;
  }

  const outDir = flagString(parsed.values.out) ?? process.cwd();
  if (command === "export-lists") {
    mkdirSync(outDir, { recursive: true });
    const block = path.join(outDir, "shadow-ai-blocklist.txt");
    const allow = path.join(outDir, "shadow-ai-allowlist.txt");
    writeFileSync(block, renderBlocklist());
    writeFileSync(allow, renderAllowlist());
    io.log(block);
    io.log(allow);
    return 0;
  }

  if (command === "scan") {
    const input = flagString(parsed.values.input);
    if (!input) {
      io.error("scan needs --input <file>.");
      return 2;
    }
    const format = flagString(parsed.values.format) ?? "auto";
    if (!FORMATS.has(format as LogFormat)) {
      io.error(`Unknown format "${format}".`);
      return 2;
    }
    try {
      const report = await scanPath(input, format as LogFormat);
      mkdirSync(outDir, { recursive: true });
      const markdown = path.join(outDir, "shadow-ai-dns-report.md");
      const csv = path.join(outDir, "shadow-ai-dns-report.csv");
      writeFileSync(markdown, renderMarkdown(report));
      writeFileSync(csv, renderCsv(report));
      io.log(`${report.matchedQueries} AI-service queries. Wrote ${markdown} and ${csv}.`);
      return 0;
    } catch (error) {
      io.error(error instanceof Error ? error.message : "Scan failed.");
      return 1;
    }
  }

  io.error(`Unknown command "${command}".`);
  io.error(HELP);
  return 2;
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("cli.js") || entry.endsWith("cli.ts")) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

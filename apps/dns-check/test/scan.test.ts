import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { renderAllowlist, renderBlocklist } from "../src/lists.js";
import { parseLogText } from "../src/log.js";
import { renderCsv, renderMarkdown } from "../src/report.js";
import { scanPath } from "../src/scan.js";

const examples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../examples");

describe("log parsers", () => {
  it("reads a Pi-hole/dnsmasq log and ignores replies and unrelated domains", () => {
    const text = readFileSync(path.join(examples, "dnsmasq.log"), "utf8");
    const parsed = parseLogText(text, "auto");
    expect(parsed.format).toBe("dnsmasq");
    expect(parsed.events.map((event) => event.domain)).toEqual([
      "chatgpt.com",
      "chatgpt.com",
      "claude.ai",
      "www.perplexity.ai",
      "example.com",
      "grammarly.com",
      "cdn.openai.com",
    ]);
  });

  it("reads a CSV with a header and quoted fields", () => {
    const parsed = parseLogText(readFileSync(path.join(examples, "queries.csv"), "utf8"), "auto");
    expect(parsed.format).toBe("csv");
    expect(parsed.events.map((event) => event.domain)).toEqual(["gemini.google.com", "news.example", "claude.ai"]);
    expect(parsed.events[2]?.client).toBe("10.0.0.9");
  });

  it("reads a BIND query log", () => {
    const parsed = parseLogText(readFileSync(path.join(examples, "bind.log"), "utf8"), "bind");
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]?.domain).toBe("copilot.microsoft.com");
    expect(parsed.events[0]?.client).toBe("10.1.1.5");
  });
});

describe("scan report", () => {
  it("rolls queries up to catalog services and skips domains that are too broad to list", async () => {
    const report = await scanPath(path.join(examples, "dnsmasq.log"), "pihole", "2026-10-19T00:00:00.000Z");
    expect(report.matchedQueries).toBe(5);
    expect(report.byService.map((service) => service.serviceName).sort()).toEqual(["ChatGPT", "Claude", "Grammarly", "Perplexity"]);
    const chatgpt = report.hits.find((hit) => hit.domain === "chatgpt.com");
    expect(chatgpt?.queries).toBe(2);
    expect(chatgpt?.clients).toBe(1);
    expect(report.hits.some((hit) => hit.domain === "cdn.openai.com")).toBe(false);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain("unmanaged or personal devices");
    expect(markdown).toContain("ChatGPT");
    const csv = renderCsv(report);
    expect(csv.split("\n")[0]).toBe("service_id,service_name,signal,domain,queries,clients,first_seen,last_seen");
    expect(csv).toContain("chatgpt,ChatGPT,high,chatgpt.com,2,1");
  });

  it("reads a Pi-hole FTL-style SQLite database", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const dir = mkdtempSync(path.join(tmpdir(), "shadow-ai-pihole-"));
    const file = path.join(dir, "pihole-FTL.db");
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE queries (id INTEGER PRIMARY KEY, timestamp INTEGER, domain TEXT, client TEXT)");
    db.prepare("INSERT INTO queries (timestamp, domain, client) VALUES (?, ?, ?)").run(
      1_760_000_000,
      "claude.ai",
      "192.168.1.10",
    );
    db.close();
    const report = await scanPath(file, "auto");
    expect(report.format).toBe("pihole-db");
    expect(report.hits[0]?.serviceName).toBe("Claude");
    expect(report.hits[0]?.clients).toBe(1);
  });
});

describe("pi-hole lists", () => {
  it("exports the catalog as a blocklist and an allowlist", () => {
    const block = renderBlocklist();
    const allow = renderAllowlist();
    expect(block).toContain("chatgpt.com");
    expect(block).toContain("claude.ai");
    expect(block).not.toContain("\ngoogle.com\n");
    expect(allow).toContain("chatgpt.com");
    expect(block.startsWith("#")).toBe(true);
  });
});

describe("cli", () => {
  it("prints help and writes a report for the sample log", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const io = { log: (message: string) => logs.push(message), error: (message: string) => errors.push(message) };
    expect(await main(["help"], io)).toBe(0);
    expect(logs.join("\n")).toContain("export-lists");
    expect(await main(["scan"], io)).toBe(2);
    expect(errors).toEqual(["scan needs --input <file>."]);
    errors.length = 0;

    const dir = mkdtempSync(path.join(tmpdir(), "shadow-ai-dns-"));
    const code = await main(["scan", "--input", path.join(examples, "dnsmasq.log"), "--format", "dnsmasq", "--out", dir], io);
    expect(code).toBe(0);
    expect(readFileSync(path.join(dir, "shadow-ai-dns-report.md"), "utf8")).toContain("ChatGPT");
    const listCode = await main(["export-lists", "--out", dir], io);
    expect(listCode).toBe(0);
    expect(readFileSync(path.join(dir, "shadow-ai-blocklist.txt"), "utf8")).toContain("perplexity.ai");
    expect(errors).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (/\.(ts|js|mjs|html)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("extension privacy boundary", () => {
  it("does not call the network from extension source", () => {
    const files = sourceFiles(path.join(root, "src")).concat(sourceFiles(path.join(root, "scripts")));
    const banned = [/fetch\s*\(/, /XMLHttpRequest/, /new WebSocket/, /sendBeacon/];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of banned) {
        expect(text, path.relative(root, file)).not.toMatch(pattern);
      }
    }
  });

  it("does not put paste contents into a message or into storage from the content script", () => {
    const content = readFileSync(path.join(root, "src/content.ts"), "utf8");
    expect(content).not.toContain("chrome.storage");
    expect(content).not.toContain("localStorage");
    for (const line of content.split("\n")) {
      if (!line.includes("sendMessage")) continue;
      expect(line).not.toMatch(/clipboard|getData|pasted/);
    }
  });
});

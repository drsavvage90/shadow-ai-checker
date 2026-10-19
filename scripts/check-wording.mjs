import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set(["node_modules", "dist", "out", ".next", "coverage", ".git"]);
const skipFiles = new Set([path.join(root, "scripts/check-wording.mjs")]);
const extensions = new Set([".md", ".ts", ".tsx", ".json", ".html", ".txt", ".yml", ".yaml", ".mjs", ".css"]);

const rules = [
  { name: "HIPAA compliant", re: /hipaa[-\s]?compliant/i },
  { name: "fully compliant", re: /fully compliant/i },
  { name: "ensure compliance", re: /ensure[sd]? compliance/i },
  { name: "guarantee", re: /guarantee[sd]?/i },
  { name: "prevent violations", re: /prevent(?:s|ed|ing)? violations/i },
  { name: "makes you compliant", re: /\bmakes? you compliant\b/i },
  { name: "makes the firm compliant", re: /\bmakes? (?:the|a) firm compliant\b/i },
  { name: "prevents sanctions", re: /prevent(?:s|ed|ing)? sanctions/i },
  { name: "makes you allowed", re: /makes you allowed/i },
  { name: "ensures you are allowed", re: /ensures? you are allowed/i },
  { name: "you are compliant", re: /\byou are compliant\b/i },
  { name: "achieves compliance", re: /achiev(?:e|es|ed|ing) compliance/i },
];

const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry)) || skipFiles.has(full)) continue;
    const text = readFileSync(full, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const rule of rules) {
        if (rule.re.test(lines[i])) {
          hits.push(`${path.relative(root, full)}:${i + 1}: ${rule.name}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

walk(root);

if (hits.length > 0) {
  console.error("Wording check failed. Found phrasing that overclaims what this toolkit can do.\n");
  for (const hit of hits) console.error(hit);
  process.exit(1);
}

console.log("Wording check passed.");

import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { extensionMatchPatterns } from "@shadow-ai/core/services";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(app, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const banner = "/* Shadow AI Checker — on-device only. Do not add a network call in this build. */";
for (const entry of ["background", "content", "popup", "options"]) {
  await build({
    entryPoints: [path.join(app, "src", `${entry}.ts`)],
    bundle: true,
    format: "iife",
    target: ["chrome114", "firefox115"],
    outfile: path.join(dist, `${entry}.js`),
    banner: { js: banner },
    legalComments: "none",
    logLevel: "silent",
  });
}

const matches = extensionMatchPatterns();
const manifest = {
  manifest_version: 3,
  name: "Shadow AI Checker",
  version: "0.1.0",
  description: "On-device warnings when a paste into an AI site looks sensitive. Counts stay in this browser.",
  permissions: ["storage"],
  host_permissions: matches,
  background: { service_worker: "background.js" },
  action: {
    default_popup: "popup.html",
    default_title: "Shadow AI Checker",
    default_icon: { 16: "icon-16.png", 32: "icon-32.png", 48: "icon-48.png" },
  },
  options_ui: { page: "options.html", open_in_tab: true },
  icons: { 16: "icon-16.png", 32: "icon-32.png", 48: "icon-48.png", 128: "icon-128.png" },
  content_scripts: [{ matches, js: ["content.js"], run_at: "document_idle", all_frames: false }],
  browser_specific_settings: {
    gecko: {
      id: "shadow-ai-checker@vaultsystems.ai",
      strict_min_version: "115.0",
    },
  },
};

writeFileSync(path.join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(path.join(app, "src", "popup.html"), path.join(dist, "popup.html"));
cpSync(path.join(app, "src", "options.html"), path.join(dist, "options.html"));
cpSync(path.join(app, "src", "panel.css"), path.join(dist, "panel.css"));
for (const size of [16, 32, 48, 128]) {
  cpSync(path.resolve(app, "../../brand", `icon-${size}.png`), path.join(dist, `icon-${size}.png`));
}

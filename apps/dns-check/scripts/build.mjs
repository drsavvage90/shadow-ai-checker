import { chmodSync } from "node:fs";
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/cli.js",
  banner: { js: "#!/usr/bin/env node" },
  external: ["node:sqlite"],
  logLevel: "silent",
});
chmodSync("dist/cli.js", 0o755);

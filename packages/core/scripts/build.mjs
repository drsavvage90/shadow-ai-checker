import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const entries = ["src/index.ts", "src/detect.ts", "src/services.ts", "src/report.ts"];
for (const entry of entries) {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: entry.replace("src/", "dist/").replace(/\.ts$/, ".js"),
    logLevel: "silent",
  });
}

execFileSync("tsc", ["-p", "tsconfig.json"], { stdio: "inherit" });

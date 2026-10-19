import { aiServices, CATALOG_VERSION, type Signal } from "@shadow-ai/core";

const ORDER: Signal[] = ["high", "medium", "low"];

const INTRO = [
  "# Shadow AI Checker — AI service domains",
  "# By Vault Systems (https://vaultsystems.ai)",
  `# Catalog version ${CATALOG_VERSION}`,
  "# One domain per line. Pi-hole accepts this format. Lines starting with # are comments.",
  "# This list helps reduce risk. It is not a finding that any duty was met.",
];

function body(): string[] {
  const lines: string[] = [];
  for (const signal of ORDER) {
    const services = aiServices.filter((service) => service.signal === signal);
    if (services.length === 0) continue;
    lines.push(`# ${signal}-signal domains`);
    for (const service of services) {
      if (service.note) lines.push(`# ${service.name}: ${service.note}`);
      for (const domain of service.domains) lines.push(domain);
    }
  }
  return lines;
}

export function renderBlocklist(): string {
  return [
    ...INTRO,
    "# Review before blocking. Blocking a domain can interrupt legitimate work.",
    "# Low-signal domains such as Notion are the whole product, not only its AI feature.",
    ...body(),
    "",
  ].join("\n");
}

export function renderAllowlist(): string {
  return [
    ...INTRO,
    "# Allowlist of the same catalog. Use it only for domains you have decided to permit.",
    "# Adding every domain here permits the whole catalog. That is not a recommendation.",
    ...body(),
    "",
  ].join("\n");
}

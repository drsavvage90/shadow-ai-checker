import servicesRaw from "./data/services.json";
import type { AiService, Channel, ServiceCategory, Signal } from "./types.js";

const CATEGORIES: readonly ServiceCategory[] = [
  "chat",
  "search",
  "writing",
  "coding",
  "meeting",
  "image",
  "platform",
];

const SIGNALS: readonly Signal[] = ["high", "medium", "low"];
const CHANNELS: readonly Channel[] = ["dns", "extension"];

const FORBIDDEN_EXACT_DOMAINS = new Set([
  "google.com",
  "microsoft.com",
  "github.com",
  "bing.com",
  "office.com",
  "live.com",
  "office365.com",
  "amazonaws.com",
  "cloudflare.com",
  "openai.com",
]);

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertDomain(domain: string, serviceId: string): void {
  if (domain !== domain.toLowerCase() || domain !== domain.trim()) {
    throw new CatalogError(`Domain ${domain} on ${serviceId} must be lowercase and trimmed.`);
  }
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".") || domain.includes("..")) {
    throw new CatalogError(`Domain ${domain} on ${serviceId} is not a hostname.`);
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("*") || domain.includes("/")) {
    throw new CatalogError(`Domain ${domain} on ${serviceId} must not include a scheme, wildcard, or dot edge.`);
  }
  if (FORBIDDEN_EXACT_DOMAINS.has(domain)) {
    throw new CatalogError(
      `Domain ${domain} is too broad for the catalog. List a product host instead.`,
    );
  }
}

export function parseServices(raw: unknown): { version: number; services: AiService[] } {
  if (!isRecord(raw) || !Array.isArray(raw.services) || typeof raw.version !== "number") {
    throw new CatalogError("Service catalog must be an object with version and services.");
  }
  const services: AiService[] = [];
  const ids = new Set<string>();
  const domains = new Set<string>();

  for (const entry of raw.services) {
    if (!isRecord(entry)) throw new CatalogError("Each service must be an object.");
    const id = entry.id;
    const name = entry.name;
    const vendor = entry.vendor;
    const category = entry.category;
    const signal = entry.signal;
    const channels = entry.channels;
    const domainList = entry.domains;
    if (typeof id !== "string" || !/^[a-z0-9-]{2,40}$/.test(id)) {
      throw new CatalogError(`Invalid service id: ${String(id)}`);
    }
    if (ids.has(id)) throw new CatalogError(`Duplicate service id: ${id}`);
    ids.add(id);
    if (typeof name !== "string" || name.trim().length < 2) {
      throw new CatalogError(`Service ${id} needs a name.`);
    }
    if (typeof vendor !== "string" || vendor.trim().length < 2) {
      throw new CatalogError(`Service ${id} needs a vendor.`);
    }
    if (typeof category !== "string" || !CATEGORIES.includes(category as ServiceCategory)) {
      throw new CatalogError(`Service ${id} has an unknown category.`);
    }
    if (typeof signal !== "string" || !SIGNALS.includes(signal as Signal)) {
      throw new CatalogError(`Service ${id} has an unknown signal.`);
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      throw new CatalogError(`Service ${id} needs at least one channel.`);
    }
    const parsedChannels: Channel[] = [];
    for (const channel of channels) {
      if (typeof channel !== "string" || !CHANNELS.includes(channel as Channel)) {
        throw new CatalogError(`Service ${id} has an unknown channel.`);
      }
      parsedChannels.push(channel as Channel);
    }
    if (!parsedChannels.includes("dns")) {
      throw new CatalogError(`Service ${id} must be visible to the DNS check.`);
    }
    if (!Array.isArray(domainList) || domainList.length === 0) {
      throw new CatalogError(`Service ${id} needs at least one domain.`);
    }
    const parsedDomains: string[] = [];
    for (const domain of domainList) {
      if (typeof domain !== "string") throw new CatalogError(`Service ${id} has a non-string domain.`);
      assertDomain(domain, id);
      if (domains.has(domain)) throw new CatalogError(`Duplicate domain: ${domain}`);
      domains.add(domain);
      parsedDomains.push(domain);
    }
    const note = entry.note;
    if (note !== undefined && (typeof note !== "string" || note.trim().length < 8)) {
      throw new CatalogError(`Service ${id} has an unusable note.`);
    }
    const service: AiService = {
      id,
      name: name.trim(),
      vendor: vendor.trim(),
      category: category as ServiceCategory,
      signal: signal as Signal,
      channels: parsedChannels,
      domains: parsedDomains,
    };
    if (typeof note === "string") service.note = note.trim();
    services.push(service);
  }

  if (services.length < 10) throw new CatalogError("Service catalog is unexpectedly small.");
  return { version: raw.version, services };
}

const loaded = parseServices(servicesRaw);

export const CATALOG_VERSION = loaded.version;
export const aiServices: readonly AiService[] = loaded.services;

function hostnameFromUrl(value: string): string | null {
  const match = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#]*)/i.exec(value);
  if (!match) return null;
  let host = match[1] ?? "";
  const at = host.lastIndexOf("@");
  if (at >= 0) host = host.slice(at + 1);
  if (!host || host.startsWith("[")) return null;
  const colon = host.indexOf(":");
  if (colon >= 0) host = host.slice(0, colon);
  return host.toLowerCase();
}

export function normalizeHost(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("://") || value.startsWith("//")) {
    const host = hostnameFromUrl(value.startsWith("//") ? `https:${value}` : value);
    if (!host) return null;
    value = host;
  }
  if (value.endsWith(".")) value = value.slice(0, -1);
  if (value.includes(":")) {
    const pieces = value.split(":");
    const host = pieces[0];
    const port = pieces[1];
    if (pieces.length !== 2 || !host || !port || !/^\d+$/.test(port)) return null;
    value = host;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  if (!value.includes(".") || value.startsWith(".") || value.endsWith(".") || value.includes("..")) {
    return null;
  }
  return value;
}

export function matchService(
  input: string,
  services: readonly AiService[] = aiServices,
): AiService | null {
  const host = normalizeHost(input);
  if (!host) return null;
  let best: { service: AiService; length: number } | null = null;
  for (const service of services) {
    for (const domain of service.domains) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        if (!best || domain.length > best.length) best = { service, length: domain.length };
      }
    }
  }
  return best?.service ?? null;
}

export function servicesForChannel(
  channel: Channel,
  services: readonly AiService[] = aiServices,
): AiService[] {
  return services.filter((service) => service.channels.includes(channel));
}

export function allDomains(services: readonly AiService[] = aiServices): string[] {
  return services.flatMap((service) => service.domains).sort();
}

export function extensionMatchPatterns(services: readonly AiService[] = aiServices): string[] {
  const patterns = new Set<string>();
  for (const service of servicesForChannel("extension", services)) {
    for (const domain of service.domains) {
      patterns.add(`*://${domain}/*`);
      patterns.add(`*://*.${domain}/*`);
    }
  }
  return [...patterns].sort();
}

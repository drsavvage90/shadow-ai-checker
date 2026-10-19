import { describe, expect, it } from "vitest";
import {
  aiServices,
  allDomains,
  extensionMatchPatterns,
  matchService,
  normalizeHost,
  parseServices,
  type AiService,
} from "../src/index.js";

const sample = {
  version: 1,
  services: [
    {
      id: "alpha",
      name: "Alpha Chat",
      vendor: "Alpha",
      category: "chat",
      signal: "high",
      channels: ["dns", "extension"],
      domains: ["alpha.example"],
    },
    {
      id: "alpha-api",
      name: "Alpha API",
      vendor: "Alpha",
      category: "platform",
      signal: "high",
      channels: ["dns"],
      domains: ["api.alpha.example"],
    },
  ],
};

describe("service catalog", () => {
  it("loads a catalog with unique product domains", () => {
    expect(aiServices.length).toBeGreaterThan(20);
    const ids = new Set(aiServices.map((service) => service.id));
    expect(ids.size).toBe(aiServices.length);
    expect(aiServices.some((service) => service.id === "chatgpt")).toBe(true);
    expect(aiServices.some((service) => service.id === "claude")).toBe(true);
    expect(aiServices.some((service) => service.id === "gemini")).toBe(true);
    expect(aiServices.some((service) => service.id === "copilot")).toBe(true);
    expect(aiServices.some((service) => service.id === "perplexity")).toBe(true);
    for (const domain of allDomains()) {
      expect(domain).toBe(domain.toLowerCase());
    }
    expect(allDomains()).not.toContain("google.com");
    expect(allDomains()).not.toContain("microsoft.com");
    expect(allDomains()).not.toContain("openai.com");
  });

  it("rejects a duplicate domain and a domain that is too broad", () => {
    const duplicate = structuredClone(sample);
    duplicate.services[1]?.domains.push("alpha.example");
    expect(() => parseServices(duplicate)).toThrow(/duplicate domain/i);
    const broad = structuredClone(sample);
    broad.services[0]?.domains.push("google.com");
    expect(() => parseServices(broad)).toThrow(/too broad/i);
  });
});

describe("normalizeHost", () => {
  it("accepts hosts, URLs, trailing dots, and ports", () => {
    expect(normalizeHost("ChatGPT.com.")).toBe("chatgpt.com");
    expect(normalizeHost("https://chat.openai.com/c/abc")).toBe("chat.openai.com");
    expect(normalizeHost("chat.openai.com:443")).toBe("chat.openai.com");
  });

  it("rejects values that are not hostnames", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("not a host")).toBeNull();
    expect(normalizeHost("http://")).toBeNull();
  });
});

describe("matchService", () => {
  it("matches a product host and its subdomains, and prefers the longer domain", () => {
    expect(matchService("chatgpt.com")?.id).toBe("chatgpt");
    expect(matchService("www.perplexity.ai")?.id).toBe("perplexity");
    expect(matchService("cdn.claude.ai")?.id).toBe("claude");
    expect(matchService("api.alpha.example", sample.services as AiService[])?.id).toBe("alpha-api");
    expect(matchService("alpha.example", sample.services as AiService[])?.id).toBe("alpha");
  });

  it("does not match lookalike or parent domains that are not listed", () => {
    expect(matchService("evilchatgpt.com")).toBeNull();
    expect(matchService("chatgpt.com.example")).toBeNull();
    expect(matchService("cdn.openai.com")).toBeNull();
    expect(matchService("google.com")).toBeNull();
    expect(matchService("chat.google.com")).toBeNull();
  });
});

describe("extensionMatchPatterns", () => {
  it("covers extension services and skips DNS-only products", () => {
    const patterns = extensionMatchPatterns();
    expect(patterns).toContain("*://chatgpt.com/*");
    expect(patterns).toContain("*://*.chatgpt.com/*");
    expect(patterns).toContain("*://claude.ai/*");
    expect(patterns.some((pattern) => pattern.includes("notion.so"))).toBe(false);
    expect(patterns.some((pattern) => pattern.includes("://google.com"))).toBe(false);
    expect(patterns.some((pattern) => pattern.includes("huggingface.co"))).toBe(false);
  });
});

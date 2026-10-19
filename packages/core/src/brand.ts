import type { CallToAction } from "./types.js";

export const BRAND = {
  name: "Shadow AI Checker",
  maker: "Vault Systems",
  makerUrl: "https://vaultsystems.ai",
} as const;

export const CTA_LABEL = "Get a free Shadow-AI Risk Check from Vault";

export const CTA_HREF =
  "https://vaultsystems.ai/?utm_source=shadow-ai-checker&utm_medium=quiz&utm_campaign=shadow-ai-risk-check";

export const SEGMENT_IDS = ["law", "cpa", "healthcare", "bank", "other"] as const;

export type SegmentId = (typeof SEGMENT_IDS)[number];

export const APPALACHIAN_STATE_IDS = ["oh", "ky", "wv"] as const;

export const PROFILE_QUESTION_IDS = {
  segment: "profile.segment",
  size: "profile.size",
  states: "profile.states",
} as const;

export const INVENTORY_QUESTION_ID = "tools.inventory";

export const LIMITATIONS = [
  "Shadow AI Checker helps reduce risk. It is not a legal opinion, and it does not decide whether a firm, practice, or bank has met HIPAA or any other duty.",
  "It does not cover unmanaged or personal devices, personal phones on a cellular network, or browsers where the extension is not installed.",
  "Domain lists and pattern matches are incomplete. A quiet result is not proof that sensitive information stayed inside the firm.",
] as const;

const SEGMENT_BLURBS: Record<SegmentId, string> = {
  law: "Vault works with small law firms on the controls behind this checklist: which tools are approved, what client information is off limits, and how access is turned off when someone leaves.",
  cpa: "Vault works with CPA firms on the controls behind this checklist, including client tax data, staff accounts, and what a preparer should keep out of a public AI tool.",
  healthcare:
    "Vault works with small practices on HIPAA-aligned controls for AI tools: approved accounts, what stays out of a prompt, and access when staff change. These steps do not, by themselves, settle a practice's HIPAA duties.",
  bank: "Vault works with community banks on the controls behind this checklist: customer information, approved tools, and accounts the bank can still close after someone leaves.",
  other:
    "Vault works with small regulated businesses on the controls behind this checklist: approved tools, sensitive data, and accounts the firm actually controls.",
};

const GENERIC_BLURB =
  "Vault works with small regulated businesses on the controls behind this checklist: approved tools, sensitive data, and accounts the firm actually controls.";

export function ctaForSegment(segment: SegmentId | null): CallToAction {
  return {
    label: CTA_LABEL,
    href: CTA_HREF,
    body: segment ? SEGMENT_BLURBS[segment] : GENERIC_BLURB,
  };
}

export function isSegmentId(value: string | null): value is SegmentId {
  return SEGMENT_IDS.some((id) => id === value);
}

export function sanitizePartner(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  if (/[<>\\/:]/.test(trimmed) || trimmed.includes("@")) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}&.,'’\- ]*$/u.test(trimmed)) return null;
  return trimmed;
}

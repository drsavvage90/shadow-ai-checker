import type { CallToAction } from "./types.js";

export const BRAND = {
  name: "Shadow AI Checker",
  maker: "Vault Systems",
  makerUrl: "https://vaultsystems.ai",
} as const;

export const CTA_LABEL = "Get a free AI Readiness Check from Vault";

export const CTA_HREF =
  "https://vaultsystems.ai/?utm_source=shadow-ai-checker&utm_medium=quiz&utm_campaign=ai-readiness-check";

export const SEGMENT_IDS = ["law", "cpa", "healthcare", "bank", "other"] as const;

export type SegmentId = (typeof SEGMENT_IDS)[number];

export const STATE_IDS = ["oh", "ky", "wv", "other"] as const;

export type StateId = (typeof STATE_IDS)[number];

export const APPALACHIAN_STATE_IDS = ["oh", "ky", "wv"] as const;

export const PROFILE_QUESTION_IDS = {
  segment: "profile.segment",
  size: "profile.size",
  states: "profile.states",
} as const;

export const INVENTORY_QUESTION_ID = "tools.inventory";

export const LIMITATIONS = [
  "Shadow AI Checker helps reduce risk. It is not legal advice, not an ethics opinion, and it does not decide whether a firm, practice, or bank has met HIPAA or any other duty.",
  "It does not cover unmanaged or personal devices, personal phones on a cellular network, or browsers where the extension is not installed.",
  "Domain lists and pattern matches are incomplete. A quiet result is not proof that sensitive information stayed inside the firm.",
] as const;

const SEGMENT_BLURBS: Record<SegmentId, string> = {
  law: "Vault works with small law firms on the readiness questions in this check: a written AI policy, consent where the rules expect it, training, and an approved tool staff will actually use.",
  cpa: "Vault works with accounting and CPA firms on the readiness questions in this check, including taxpayer information, vendor training terms, and review before a return goes out.",
  healthcare:
    "Vault works with small practices on HIPAA-aligned AI habits: an approved tool, what stays out of a prompt, and training. These steps do not, by themselves, settle a practice's HIPAA duties.",
  bank: "Vault works with banks and credit unions on the readiness questions in this check: customer information, an approved tool, and whether staff still have a personal-account path around it.",
  other:
    "Vault works with small regulated businesses on the readiness questions in this check: whether AI use is allowed in practice, and whether staff will use the approved tool.",
};

const GENERIC_BLURB =
  "Vault works with small regulated businesses on the readiness questions in this check: whether AI use is allowed in practice, and whether staff will use the approved tool.";

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

export function isStateId(value: string | null): value is StateId {
  return STATE_IDS.some((id) => id === value);
}

export function sanitizePartner(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  if (/[<>\\/:]/.test(trimmed) || trimmed.includes("@")) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}&.,'’\- ]*$/u.test(trimmed)) return null;
  return trimmed;
}

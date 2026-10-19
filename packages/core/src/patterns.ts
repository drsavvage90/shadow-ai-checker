import type { PatternId, PatternSeverity, SensitiveFinding } from "./types.js";

export const DEFAULT_SCAN_LIMIT = 20_000;

type PatternInfo = {
  id: PatternId;
  label: string;
  severity: PatternSeverity;
};

export const PATTERNS: readonly PatternInfo[] = [
  { id: "ssn", label: "SSN or ITIN", severity: "high" },
  { id: "credit_card", label: "Payment card number", severity: "high" },
  { id: "phi_hint", label: "Health-information hint", severity: "high" },
  { id: "client_matter", label: "Client or matter hint", severity: "high" },
  { id: "email", label: "Email address", severity: "low" },
  { id: "phone", label: "Phone number", severity: "low" },
];

export const PATTERN_IDS: readonly PatternId[] = PATTERNS.map((pattern) => pattern.id);

const REQUIRED: Record<PatternId, true> = {
  ssn: true,
  credit_card: true,
  email: true,
  phone: true,
  phi_hint: true,
  client_matter: true,
};

for (const id of Object.keys(REQUIRED) as PatternId[]) {
  if (!PATTERNS.some((pattern) => pattern.id === id)) {
    throw new Error(`Missing sensitive-data pattern: ${id}`);
  }
}

type Span = { start: number; end: number };

const CARD_PATTERNS = [
  /\b\d{4}(?:[ -]\d{4}){3}\b/g,
  /\b\d{4}[ -]\d{6}[ -]\d{5}\b/g,
  /\b\d{13,19}\b/g,
];

const SSN_PATTERN = /\b(\d{3})[- ](\d{2})[- ](\d{4})\b/g;

const PHONE_PATTERN =
  /(?:\+?1[\s.-])?\(\d{3}\)[\s.-]?\d{3}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{1,3}(?:[\s.-]\d{2,4}){2,3}\b/g;

const EMAIL_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

const PHI_RULES: RegExp[] = [
  /\b(?:mrn|medical record(?: number)?|patient id)\b[:\s#-]*[a-z0-9][a-z0-9-]{2,}/gi,
  /\b(?:icd-?10|icd-?9|cpt code|npi)\b/gi,
  /\b(?:protected health information|treatment plan|medication list|prescription|diagnosis|prognosis)\b/gi,
  /\b(?:date of birth|\bdob\b)\b/gi,
  /\bpatient(?:'s)?\b(?:\s+\w+){0,4}\s+\b(?:name|record|dob|ssn|address|diagnosis)\b/gi,
  /\b(?:name|record|dob|ssn)\b(?:\s+\w+){0,4}\s+\bpatient\b/gi,
];

const MATTER_RULES: RegExp[] = [
  /\battorney[\s-]client\b/gi,
  /\bprivileged and confidential\b/gi,
  /\bwork[\s-]product\b/gi,
  /\bmatter\s*(?:no\.?|number|#)\s*[:#-]?\s*[a-z0-9][a-z0-9-]{1,}/gi,
  /\b(?:file|case)\s*(?:no\.?|number|#)\s*[:#-]?\s*[a-z0-9][a-z0-9-]{1,}/gi,
  /\bconfidential client (?:information|data|matter)\b/gi,
];

export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function overlaps(left: Span, right: Span): boolean {
  return left.start < right.end && right.start < left.end;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function findCards(text: string): Span[] {
  const spans: Span[] = [];
  for (const pattern of CARD_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const raw = match[0];
      const digits = digitsOnly(raw);
      const start = match.index;
      const end = start + raw.length;
      const distinct = new Set(digits).size;
      const plausible =
        digits.length >= 13 &&
        digits.length <= 19 &&
        !digits.startsWith("0") &&
        distinct > 1 &&
        luhnValid(digits);
      if (plausible && !spans.some((span) => overlaps(span, { start, end }))) {
        spans.push({ start, end });
      }
      match = pattern.exec(text);
    }
  }
  return spans;
}

function findSsns(text: string): Span[] {
  const spans: Span[] = [];
  SSN_PATTERN.lastIndex = 0;
  let match = SSN_PATTERN.exec(text);
  while (match) {
    const area = Number(match[1]);
    const group = Number(match[2]);
    const serial = Number(match[3]);
    const valid =
      area !== 0 &&
      area !== 666 &&
      group !== 0 &&
      serial !== 0 &&
      area >= 1 &&
      area <= 999;
    if (valid) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
    match = SSN_PATTERN.exec(text);
  }
  return spans;
}

function findMatches(pattern: RegExp, text: string): Span[] {
  pattern.lastIndex = 0;
  const spans: Span[] = [];
  let match = pattern.exec(text);
  while (match) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    match = pattern.exec(text);
  }
  return spans;
}

function countRules(rules: RegExp[], text: string): number {
  let count = 0;
  for (const rule of rules) {
    count += findMatches(rule, text).length;
  }
  return count;
}

export function detectSensitiveData(
  text: string,
  options?: { maxChars?: number },
): SensitiveFinding[] {
  const limit = options?.maxChars ?? DEFAULT_SCAN_LIMIT;
  const source = text.length > limit ? text.slice(0, limit) : text;
  const cards = findCards(source);
  const ssns = findSsns(source).filter((span) => !cards.some((card) => overlaps(card, span)));
  const phones = findMatches(PHONE_PATTERN, source).filter(
    (span) => !cards.some((card) => overlaps(card, span)) && !ssns.some((ssn) => overlaps(ssn, span)),
  );
  const emails = findMatches(EMAIL_PATTERN, source);
  const counts: Record<PatternId, number> = {
    ssn: ssns.length,
    credit_card: cards.length,
    email: emails.length,
    phone: phones.length,
    phi_hint: countRules(PHI_RULES, source),
    client_matter: countRules(MATTER_RULES, source),
  };

  return PATTERNS.filter((pattern) => counts[pattern.id] > 0).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
    severity: pattern.severity,
    count: counts[pattern.id],
  }));
}

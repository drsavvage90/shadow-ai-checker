import { isSegmentId, isStateId, SEGMENT_IDS, type SegmentId, type StateId } from "./brand.js";
import rulesRaw from "./data/jurisdictions.json";
import { questionApplies, questionBank } from "./questions.js";
import { CatalogError } from "./services.js";
import type { CategoryId, RuleCitation, RuleExample, RuleGap, RuleNote, RulesReport } from "./types.js";

const CATEGORY_IDS: readonly CategoryId[] = ["permission", "behavior", "verification", "data"];

type Scope = {
  states: string[];
  professions: string[];
};

type Expectation = Scope &
  RuleCitation & {
    relatedQuestions: string[];
  };

type Note = Scope & RuleNote;

type WeightProfile = {
  id: string;
  professions: SegmentId[];
  weights: Partial<Record<CategoryId, number>>;
};

export type RulesCatalog = {
  version: number;
  notLegalAdvice: string;
  states: { id: StateId; name: string }[];
  professions: { id: SegmentId; name: string }[];
  weightProfiles: WeightProfile[];
  expectations: Expectation[];
  notes: Note[];
  example: Omit<RuleExample, "intro">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseScope(raw: Record<string, unknown>, id: string): Scope {
  if (!Array.isArray(raw.states) || raw.states.length === 0) {
    throw new CatalogError(`Rule ${id} needs states.`);
  }
  if (!Array.isArray(raw.professions) || raw.professions.length === 0) {
    throw new CatalogError(`Rule ${id} needs professions.`);
  }
  const states = raw.states.filter((state): state is string => typeof state === "string");
  const professions = raw.professions.filter((profession): profession is string => typeof profession === "string");
  if (states.length !== raw.states.length || professions.length !== raw.professions.length) {
    throw new CatalogError(`Rule ${id} has a non-string scope.`);
  }
  const starStates = states.includes("*");
  if (starStates && states.length !== 1) throw new CatalogError(`Rule ${id} mixes * with state ids.`);
  if (!starStates && states.some((state) => !isStateId(state))) {
    throw new CatalogError(`Rule ${id} has an unknown state.`);
  }
  const starProfessions = professions.includes("*");
  if (starProfessions && professions.length !== 1) throw new CatalogError(`Rule ${id} mixes * with professions.`);
  if (!starProfessions && professions.some((profession) => !isSegmentId(profession))) {
    throw new CatalogError(`Rule ${id} has an unknown profession.`);
  }
  return { states, professions };
}

function parseCitation(raw: Record<string, unknown>, id: string): RuleCitation {
  const summary = raw.summary;
  const citation = raw.citation;
  const url = raw.url;
  if (typeof summary !== "string" || summary.trim().length < 40) {
    throw new CatalogError(`Rule ${id} needs a longer summary.`);
  }
  if (typeof citation !== "string" || citation.trim().length < 8) {
    throw new CatalogError(`Rule ${id} needs a citation.`);
  }
  if (typeof url !== "string" || !/^https:\/\/[^\s]+$/.test(url)) {
    throw new CatalogError(`Rule ${id} needs an https URL.`);
  }
  return { id, summary: summary.trim(), citation: citation.trim(), url };
}

function scopeMatches(scope: Scope, stateId: string, professionId: string): boolean {
  const stateOk = scope.states.includes("*") || scope.states.includes(stateId);
  const professionOk = scope.professions.includes("*") || scope.professions.includes(professionId);
  return stateOk && professionOk;
}

export function parseRulesCatalog(raw: unknown, questionIds: ReadonlySet<string>): RulesCatalog {
  if (!isRecord(raw) || typeof raw.version !== "number") {
    throw new CatalogError("Rules catalog needs a version.");
  }
  if (typeof raw.notLegalAdvice !== "string" || !/not legal advice/i.test(raw.notLegalAdvice)) {
    throw new CatalogError("Rules catalog needs a not-legal-advice notice.");
  }
  if (!Array.isArray(raw.states) || !Array.isArray(raw.professions) || !Array.isArray(raw.weightProfiles)) {
    throw new CatalogError("Rules catalog needs states, professions, and weight profiles.");
  }
  if (!Array.isArray(raw.expectations) || !Array.isArray(raw.notes) || !isRecord(raw.example)) {
    throw new CatalogError("Rules catalog needs expectations, notes, and an example.");
  }

  const states: RulesCatalog["states"] = [];
  for (const entry of raw.states) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isStateId(entry.id)) {
      throw new CatalogError("Rules catalog has an unknown state.");
    }
    if (typeof entry.name !== "string" || entry.name.trim().length < 3) {
      throw new CatalogError(`State ${entry.id} needs a name.`);
    }
    states.push({ id: entry.id, name: entry.name.trim() });
  }
  if (states.map((state) => state.id).join(",") !== [...STATE_ORDER].join(",")) {
    throw new CatalogError("State list must be Ohio, Kentucky, West Virginia, and Other, in that order.");
  }

  const professions: RulesCatalog["professions"] = [];
  for (const entry of raw.professions) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isSegmentId(entry.id)) {
      throw new CatalogError("Rules catalog has an unknown profession.");
    }
    if (typeof entry.name !== "string" || entry.name.trim().length < 3) {
      throw new CatalogError(`Profession ${entry.id} needs a name.`);
    }
    professions.push({ id: entry.id, name: entry.name.trim() });
  }
  if (professions.map((profession) => profession.id).join(",") !== [...SEGMENT_IDS].join(",")) {
    throw new CatalogError("Profession list must match the segment ids.");
  }

  const weightProfiles: WeightProfile[] = [];
  const covered = new Set<string>();
  for (const entry of raw.weightProfiles) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !Array.isArray(entry.professions) || !isRecord(entry.weights)) {
      throw new CatalogError("A weight profile is incomplete.");
    }
    const profileProfessions: SegmentId[] = [];
    for (const profession of entry.professions) {
      if (typeof profession !== "string" || !isSegmentId(profession)) {
        throw new CatalogError(`Weight profile ${entry.id} has an unknown profession.`);
      }
      if (covered.has(profession)) throw new CatalogError(`Profession ${profession} is in two weight profiles.`);
      covered.add(profession);
      profileProfessions.push(profession);
    }
    const weights: Partial<Record<CategoryId, number>> = {};
    let sum = 0;
    for (const [key, value] of Object.entries(entry.weights)) {
      if (!CATEGORY_IDS.includes(key as CategoryId)) {
        throw new CatalogError(`Weight profile ${entry.id} has an unknown category.`);
      }
      if (typeof value !== "number" || value <= 0 || value > 1) {
        throw new CatalogError(`Weight profile ${entry.id} has a bad weight.`);
      }
      weights[key as CategoryId] = value;
      sum += value;
    }
    if (Math.abs(sum - 1) > 0.001) {
      throw new CatalogError(`Weight profile ${entry.id} must sum to 1.`);
    }
    weightProfiles.push({ id: entry.id, professions: profileProfessions, weights });
  }
  for (const profession of SEGMENT_IDS) {
    if (!covered.has(profession)) throw new CatalogError(`Profession ${profession} has no weight profile.`);
  }

  const expectations: Expectation[] = [];
  const seen = new Set<string>();
  for (const entry of raw.expectations) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !/^[a-z0-9-]{3,64}$/.test(entry.id)) {
      throw new CatalogError("An expectation has a bad id.");
    }
    if (seen.has(entry.id)) throw new CatalogError(`Duplicate expectation ${entry.id}.`);
    seen.add(entry.id);
    if (!Array.isArray(entry.relatedQuestions)) {
      throw new CatalogError(`Expectation ${entry.id} needs relatedQuestions.`);
    }
    const relatedQuestions: string[] = [];
    for (const questionId of entry.relatedQuestions) {
      if (typeof questionId !== "string" || !questionIds.has(questionId)) {
        throw new CatalogError(`Expectation ${entry.id} cites an unknown question.`);
      }
      relatedQuestions.push(questionId);
    }
    expectations.push({
      ...parseScope(entry, entry.id),
      ...parseCitation(entry, entry.id),
      relatedQuestions,
    });
  }

  const notes: Note[] = [];
  for (const entry of raw.notes) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.summary !== "string" || entry.summary.trim().length < 40) {
      throw new CatalogError("A rule note is incomplete.");
    }
    notes.push({ ...parseScope(entry, entry.id), id: entry.id, summary: entry.summary.trim() });
  }

  const exampleCitation = parseCitation(
    { ...raw.example, id: "example" },
    "example",
  );
  const newsSummary = raw.example.newsSummary;
  const newsCitation = raw.example.newsCitation;
  const newsUrl = raw.example.newsUrl;
  if (typeof newsSummary !== "string" || newsSummary.trim().length < 40) {
    throw new CatalogError("The example needs a news summary.");
  }
  if (typeof newsCitation !== "string" || newsCitation.trim().length < 8) {
    throw new CatalogError("The example needs a news citation.");
  }
  if (typeof newsUrl !== "string" || !/^https:\/\/[^\s]+$/.test(newsUrl)) {
    throw new CatalogError("The example needs a news URL.");
  }

  return {
    version: raw.version,
    notLegalAdvice: raw.notLegalAdvice.trim(),
    states,
    professions,
    weightProfiles,
    expectations,
    notes,
    example: {
      summary: exampleCitation.summary,
      citation: exampleCitation.citation,
      url: exampleCitation.url,
      newsSummary: newsSummary.trim(),
      newsCitation: newsCitation.trim(),
      newsUrl,
    },
  };
}

const STATE_ORDER: readonly StateId[] = ["oh", "ky", "wv", "other"];

export const rulesCatalog: RulesCatalog = parseRulesCatalog(
  rulesRaw,
  new Set(questionBank.questions.map((question) => question.id)),
);

export const NOT_LEGAL_ADVICE = rulesCatalog.notLegalAdvice;

export function weightsForProfession(professionId: string | null): Partial<Record<CategoryId, number>> {
  const id = isSegmentId(professionId) ? professionId : "other";
  const profile = rulesCatalog.weightProfiles.find((item) => item.professions.includes(id));
  return profile?.weights ?? {};
}

export function buildRulesReport(input: {
  professionId: string | null;
  stateId: string | null;
  questionRisk: (questionId: string) => number | null;
}): RulesReport {
  const profession = rulesCatalog.professions.find((item) => item.id === input.professionId);
  const state = rulesCatalog.states.find((item) => item.id === input.stateId);
  const base = {
    notLegalAdvice: rulesCatalog.notLegalAdvice,
    stateId: state?.id ?? null,
    stateName: state?.name ?? null,
    professionId: profession?.id ?? null,
    professionName: profession?.name ?? null,
  };
  if (!profession || !state) {
    return { ...base, expectations: [], gaps: [], notes: [], example: null };
  }

  const expectations = rulesCatalog.expectations.filter((item) =>
    scopeMatches(item, state.id, profession.id),
  );
  const gaps: RuleGap[] = [];
  for (const expectation of expectations) {
    const risks = expectation.relatedQuestions
      .map((questionId) => input.questionRisk(questionId))
      .filter((risk): risk is number => risk !== null);
    if (risks.length === 0 || !risks.some((risk) => risk >= 2)) continue;
    gaps.push({
      id: expectation.id,
      summary: expectation.summary,
      citation: expectation.citation,
      url: expectation.url,
      detail: "Your answer on this point does not yet line up with what this source describes.",
    });
  }

  const notes = rulesCatalog.notes
    .filter((item) => scopeMatches(item, state.id, profession.id))
    .map((item) => ({ id: item.id, summary: item.summary }));

  const intro =
    profession.id === "bank"
      ? "A 2026 community-bank disclosure is a concrete example of why an approved tool and a personal account are different questions."
      : "A 2026 community-bank disclosure is an example of the same behavior questions. It is not a rule for your profession.";

  return {
    ...base,
    expectations: expectations.map((item) => ({
      id: item.id,
      summary: item.summary,
      citation: item.citation,
      url: item.url,
    })),
    gaps,
    notes,
    example: { intro, ...rulesCatalog.example },
  };
}

export function assertWeightsCoverQuestions(): void {
  for (const profession of SEGMENT_IDS) {
    const weights = weightsForProfession(profession);
    for (const question of questionBank.questions) {
      if (question.role !== "scored" || !question.category) continue;
      if (!questionApplies(question, profession, "oh")) continue;
      const weight = weights[question.category] ?? 0;
      if (weight <= 0) {
        throw new CatalogError(`Profession ${profession} asks ${question.id} but does not weight ${question.category}.`);
      }
    }
  }
}

assertWeightsCoverQuestions();

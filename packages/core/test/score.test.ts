import { describe, expect, it } from "vitest";
import {
  CTA_LABEL,
  LIMITATIONS,
  questionBank,
  sanitizePartner,
  scoreAssessment,
  type Answers,
  type Choice,
  type Question,
} from "../src/index.js";

function lowestChoice(question: Question): Choice {
  const sorted = [...question.choices].sort((left, right) => (left.risk ?? 0) - (right.risk ?? 0));
  const choice = sorted[0];
  if (!choice) throw new Error(`Question ${question.id} has no choices`);
  return choice;
}

function highestChoice(question: Question): Choice {
  const sorted = [...question.choices].sort((left, right) => (right.risk ?? 0) - (left.risk ?? 0));
  const choice = sorted[0];
  if (!choice) throw new Error(`Question ${question.id} has no choices`);
  return choice;
}

function answerAll(pick: (question: Question) => Choice): Answers {
  const answers: Record<string, string | string[]> = {};
  for (const question of questionBank.questions) {
    const choice = pick(question);
    answers[question.id] = question.kind === "multi" ? [choice.id] : choice.id;
  }
  return answers;
}

describe("question bank", () => {
  it("has unique ids, a full weight budget, and the profile questions", () => {
    const ids = questionBank.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    const weight = questionBank.categories.reduce((sum, category) => sum + category.weight, 0);
    expect(weight).toBeCloseTo(1);
    expect(questionBank.questions).toHaveLength(20);
    expect(questionBank.questions.filter((question) => question.role === "scored").length).toBeGreaterThan(10);
  });
});

describe("scoreAssessment", () => {
  it("scores an all-low quiz as lower risk", () => {
    const result = scoreAssessment(answerAll(lowestChoice));
    expect(result.overallScore).toBe(0);
    expect(result.band).toBe("low");
    expect(result.fixes).toEqual([]);
    expect(result.scoredAnswered).toBe(result.scoredTotal);
    expect(result.cta.label).toBe(CTA_LABEL);
    expect(result.limitations.some((line) => line.includes("unmanaged or personal devices"))).toBe(true);
  });

  it("scores an all-high quiz as high risk with do-now fixes first", () => {
    const result = scoreAssessment(answerAll(highestChoice));
    expect(result.overallScore).toBe(100);
    expect(result.band).toBe("high");
    expect(result.fixes[0]?.priority).toBe("now");
    expect(result.fixes.some((fix) => fix.priority === "soon" || fix.priority === "later")).toBe(true);
    const ranks = result.fixes.map((fix) => fix.priority);
    const order = { now: 0, soon: 1, later: 2 };
    const values = ranks.map((priority) => order[priority]);
    expect([...values].sort((left, right) => left - right)).toEqual(values);
  });

  it("uses the max selected risk for multi-select and weights data more heavily", () => {
    const answers = answerAll(lowestChoice);
    const dataTypes = questionBank.questions.find((question) => question.id === "data.types");
    if (!dataTypes) throw new Error("missing data.types");
    const next = { ...answers, "data.types": ["public", "regulated"] };
    const mixed = scoreAssessment(next);
    const data = mixed.categories.find((category) => category.id === "data");
    expect(data?.score).toBeGreaterThan(0);
    expect(mixed.fixes.some((fix) => fix.id === "stop-regulated-pastes")).toBe(true);

    const onlyData = answerAll(lowestChoice) as Record<string, string | string[]>;
    for (const question of questionBank.questions) {
      if (question.category === "data") onlyData[question.id] = question.kind === "multi" ? [highestChoice(question).id] : highestChoice(question).id;
    }
    const weighted = scoreAssessment(onlyData);
    expect(weighted.categories.find((category) => category.id === "data")?.score).toBe(100);
    expect(weighted.overallScore).toBe(30);
    expect(weighted.band).toBe("moderate");
  });

  it("adds a healthcare note and an Appalachian note flag without changing the score math", () => {
    const answers = {
      ...answerAll(lowestChoice),
      "profile.segment": "healthcare",
      "profile.states": ["oh", "ky"],
    } as Answers;
    const result = scoreAssessment(answers);
    expect(result.hipaaNote).toMatch(/HIPAA-aligned/);
    expect(result.profile.appalachianStates).toBe(true);
    expect(result.profile.segmentLabel).toBe("Healthcare practice");
    expect(result.cta.body).toMatch(/HIPAA-aligned/);
    expect(result.overallScore).toBe(0);
  });

  it("renormalizes weights when only one scored question is answered", () => {
    const result = scoreAssessment({ "data.rule": "no" });
    expect(result.overallScore).toBe(100);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.id).toBe("data");
    expect(result.fixes.map((fix) => fix.id)).toContain("write-data-rule");
  });
});

describe("sanitizePartner", () => {
  it("keeps a plain co-brand label and rejects markup or links", () => {
    expect(sanitizePartner("  North   River MSP ")).toBe("North River MSP");
    expect(sanitizePartner("Smith & Co.")).toBe("Smith & Co.");
    expect(sanitizePartner("<script>")).toBeNull();
    expect(sanitizePartner("https://evil.test")).toBeNull();
    expect(sanitizePartner("a")).toBeNull();
    expect(sanitizePartner("x".repeat(81))).toBeNull();
    expect(sanitizePartner(null)).toBeNull();
  });
});

describe("limitations copy", () => {
  it("says the toolkit helps reduce risk and does not cover unmanaged devices", () => {
    expect(LIMITATIONS[0]).toMatch(/helps reduce risk/);
    expect(LIMITATIONS.join(" ")).toMatch(/unmanaged or personal devices/);
    expect(LIMITATIONS.join(" ").toLowerCase()).not.toContain("compliant");
  });
});

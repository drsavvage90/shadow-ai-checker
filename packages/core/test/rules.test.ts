import { describe, expect, it } from "vitest";
import {
  NOT_LEGAL_ADVICE,
  questionApplies,
  questionBank,
  questionsInFlow,
  rulesCatalog,
  scoreAssessment,
  weightsForProfession,
} from "../src/index.js";

function expectationText(state: "oh" | "ky" | "wv" | "other", profession: "law" | "cpa" | "healthcare" | "bank" | "other"): string {
  const result = scoreAssessment({ "profile.segment": profession, "profile.states": state });
  return result.rules.expectations.map((item) => item.summary).join(" ");
}

describe("jurisdiction rules", () => {
  it("encodes the four states and five professions as data", () => {
    expect(rulesCatalog.states.map((state) => state.id)).toEqual(["oh", "ky", "wv", "other"]);
    expect(rulesCatalog.professions.map((profession) => profession.id)).toEqual([
      "law",
      "cpa",
      "healthcare",
      "bank",
      "other",
    ]);
    expect(NOT_LEGAL_ADVICE).toMatch(/not legal advice/i);
    expect(rulesCatalog.version).toBe(1);
  });

  it("cites KBA E-457 for a Kentucky law firm and does not invent a general disclosure duty", () => {
    const text = expectationText("ky", "law");
    expect(text).toMatch(/KBA E-457/);
    expect(text).toMatch(/does not state a general duty|answers no to a general duty/);
    expect(text).toMatch(/policies and training/);
    expect(text.toLowerCase()).not.toMatch(/must disclose every/);
    expect(text.toLowerCase()).not.toMatch(/required to disclose all/);
    const result = scoreAssessment({ "profile.segment": "law", "profile.states": "ky" });
    expect(result.rules.expectations.some((item) => item.url.includes("KBA%20E-457"))).toBe(true);
    expect(result.rules.notes.some((note) => note.summary.includes("Mata v. Avianca"))).toBe(true);
    expect(result.rules.notLegalAdvice).toMatch(/not legal advice/i);
  });

  it("treats West Virginia L.E.O. 2024-01 as advisory and keeps written consent in should-language", () => {
    const text = expectationText("wv", "law");
    expect(text).toMatch(/2024-01/);
    expect(text).toMatch(/advisory/);
    expect(text).toMatch(/not binding/);
    expect(text).toMatch(/should be confirmed in writing/);
    expect(text).toMatch(/should obtain the client's approval/);
    const result = scoreAssessment({
      "profile.segment": "law",
      "profile.states": "wv",
      "permission.consent": "none",
    });
    expect(result.rules.gaps.some((gap) => gap.id === "wv-leo-consent")).toBe(true);
  });

  it("describes Ohio's guide as nonbinding staff guidance and does not require a written policy", () => {
    const text = expectationText("oh", "law");
    expect(text).toMatch(/nonbinding/i);
    expect(text).toMatch(/does not, by itself, require a written firm AI policy/);
    expect(text).toMatch(/ABA Formal Opinion 512/);
    const result = scoreAssessment({
      "profile.segment": "law",
      "profile.states": "oh",
      "permission.policy": "none",
    });
    expect(result.rules.gaps.some((gap) => gap.id === "oh-guide-nonbinding")).toBe(false);
    expect(result.rules.expectations.some((item) => item.summary.includes("Supreme Court of Ohio"))).toBe(true);
  });

  it("cites section 7216 and Circular 230 for accountants without banning AI", () => {
    const text = expectationText("ky", "cpa");
    expect(text).toMatch(/§7216/);
    expect(text).toMatch(/§10\.22/);
    expect(text).toMatch(/10\.35/);
    expect(text).toMatch(/does not decide whether a particular tool/);
    expect(text.toLowerCase()).not.toMatch(/may not use ai|ai is forbidden|prohibits the use of ai/);
    const result = scoreAssessment({
      "profile.segment": "cpa",
      "profile.states": "oh",
      "verification.return": "no",
      "permission.consent": "none",
    });
    expect(result.rules.gaps.map((gap) => gap.id)).toEqual(expect.arrayContaining(["irc-7216", "circular-230"]));
  });

  it("does not invent healthcare or banking AI statutes", () => {
    expect(expectationText("wv", "healthcare")).toMatch(/does not encode a state medical-board AI opinion/);
    expect(expectationText("oh", "bank")).toMatch(/does not encode a separate banking-agency AI regulation/);
    expect(expectationText("other", "other")).toMatch(/No profession-specific ethics rule is encoded/);
  });

  it("falls back safely when the state or profession is missing", () => {
    const result = scoreAssessment({});
    expect(result.rules.expectations).toEqual([]);
    expect(result.rules.example).toBeNull();
    expect(weightsForProfession(null).data).toBe(0.25);
    expect(weightsForProfession("nope").permission).toBe(0.42);
  });
});

describe("profession scoring", () => {
  it("asks law firms about citations and leaves that section out of a healthcare score", () => {
    const citations = questionBank.questions.find((question) => question.id === "verification.citations");
    if (!citations) throw new Error("missing verification question");
    expect(questionApplies(citations, "law", "ky")).toBe(true);
    expect(questionApplies(citations, "healthcare", "ky")).toBe(false);
    expect(questionsInFlow({ "profile.segment": "law", "profile.states": "ky" }).map((question) => question.id)).toContain(
      "verification.citations",
    );
    expect(
      questionsInFlow({ "profile.segment": "healthcare", "profile.states": "wv" }).some(
        (question) => question.category === "verification",
      ),
    ).toBe(false);

    const law = scoreAssessment({
      "profile.segment": "law",
      "profile.states": "ky",
      "verification.citations": "no",
    });
    const health = scoreAssessment({
      "profile.segment": "healthcare",
      "profile.states": "ky",
      "verification.citations": "no",
    });
    expect(law.categories.some((category) => category.id === "verification")).toBe(true);
    expect(health.categories.some((category) => category.id === "verification")).toBe(false);
    expect(law.rules.gaps.some((gap) => gap.id === "ky-e457-accuracy")).toBe(true);
    expect(health.rules.expectations.some((item) => item.summary.includes("KBA E-457"))).toBe(false);
    expect(law.scoredTotal).toBeGreaterThan(health.scoredTotal);
  });

  it("weights a law firm's verification answers more heavily than its data answers", () => {
    const lawWeights = weightsForProfession("law");
    const healthWeights = weightsForProfession("healthcare");
    expect(lawWeights.verification).toBeGreaterThan(lawWeights.data ?? 0);
    expect(healthWeights.verification).toBeUndefined();

    const answers: Record<string, string | string[]> = {};
    for (const question of questionBank.questions) {
      const low = [...question.choices].sort((left, right) => (left.risk ?? 0) - (right.risk ?? 0))[0];
      if (!low) continue;
      answers[question.id] = question.kind === "multi" ? [low.id] : low.id;
    }
    answers["profile.segment"] = "law";
    answers["profile.states"] = "ky";
    answers["data.rule"] = "no";
    answers["data.types"] = ["regulated"];
    const law = scoreAssessment(answers);
    expect(law.categories.find((category) => category.id === "data")?.score).toBe(100);
    expect(law.overallScore).toBe(18);

    answers["profile.segment"] = "healthcare";
    const health = scoreAssessment(answers);
    expect(health.overallScore).toBe(25);
  });

  it("raises the behavior score when staff keep using personal accounts and cites the bank example", () => {
    const calm = scoreAssessment({
      "profile.segment": "bank",
      "profile.states": "wv",
      "behavior.personal": "no",
    });
    const shadow = scoreAssessment({
      "profile.segment": "bank",
      "profile.states": "wv",
      "behavior.personal": "common",
    });
    expect(shadow.categories.find((category) => category.id === "behavior")?.score).toBe(100);
    expect(calm.categories.find((category) => category.id === "behavior")?.score).toBe(0);
    expect(shadow.rules.example?.summary).toMatch(/CB Financial/);
    expect(shadow.rules.example?.summary).toMatch(/unauthorized AI/);
    expect(shadow.rules.example?.newsSummary).toMatch(/personal account/);
    expect(shadow.rules.example?.newsSummary).toMatch(/not in the 8-K/);
    expect(shadow.fixes.some((fix) => fix.id === "close-personal-accounts")).toBe(true);
  });
});

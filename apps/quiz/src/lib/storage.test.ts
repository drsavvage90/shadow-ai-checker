import { describe, expect, it } from "vitest";
import { questionsInFlow } from "@shadow-ai/core";
import { firstOpenStep, isAnswered, parseStored } from "./storage";

describe("parseStored", () => {
  it("drops unknown ids and clamps the step", () => {
    const kept = questionsInFlow({}).find((question) => question.id === "profile.size");
    if (!kept) throw new Error("missing question");
    const choice = kept.choices[0];
    if (!choice) throw new Error("missing choice");
    const parsed = parseStored(
      JSON.stringify({
        version: 2,
        step: 99,
        answers: { [kept.id]: choice.id, "not.a.question": "x", "profile.segment": "nope" },
      }),
    );
    expect(parsed?.step).toBe(questionsInFlow(parsed?.answers ?? {}).length);
    expect(parsed?.answers[kept.id]).toBe(choice.id);
    expect(parsed?.answers["not.a.question"]).toBeUndefined();
    expect(parsed?.answers["profile.segment"]).toBeUndefined();
  });

  it("rejects other versions and broken JSON", () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored("{")).toBeNull();
    expect(parseStored(JSON.stringify({ version: 1, step: 0, answers: {} }))).toBeNull();
    expect(parseStored(JSON.stringify({ version: 3, step: 0, answers: {} }))).toBeNull();
  });
});

describe("firstOpenStep", () => {
  it("points at the first unanswered question", () => {
    const first = questionsInFlow({})[0];
    if (!first) throw new Error("missing question");
    const choice = first.choices[0];
    if (!choice) throw new Error("missing choice");
    expect(isAnswered(first, {})).toBe(false);
    expect(firstOpenStep({ [first.id]: choice.id })).toBe(1);
    expect(isAnswered(first, { [first.id]: choice.id })).toBe(true);
  });
});

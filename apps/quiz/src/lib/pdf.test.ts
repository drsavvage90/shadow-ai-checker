import { scoreAssessment } from "@shadow-ai/core";
import { describe, expect, it } from "vitest";
import { buildReportDocument } from "./pdf";

describe("buildReportDocument", () => {
  it("produces a PDF that includes the score and the Vault next step", () => {
    const result = scoreAssessment({
      "profile.segment": "healthcare",
      "profile.states": ["oh"],
      "data.rule": "no",
      "tools.inventory": ["chatgpt", "claude"],
    });
    const doc = buildReportDocument(result, {
      partner: "North River MSP",
      generatedAt: new Date("2026-10-19T12:00:00.000Z"),
    });
    const bytes = Buffer.from(doc.output("arraybuffer"));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(bytes.toString("latin1")).toContain("North River MSP");
    expect(bytes.toString("latin1")).toContain("Get a free Shadow-AI Risk Check from Vault");
  });
});
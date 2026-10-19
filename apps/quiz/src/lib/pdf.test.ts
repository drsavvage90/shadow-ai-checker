import { scoreAssessment } from "@shadow-ai/core";
import { describe, expect, it } from "vitest";
import { buildReportDocument } from "./pdf";

describe("buildReportDocument", () => {
  it("produces a PDF that includes the score and the Vault next step", () => {
    const result = scoreAssessment({
      "profile.segment": "healthcare",
      "profile.states": "oh",
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
    expect(bytes.toString("latin1")).toContain("Get a free AI Readiness Check from Vault");
    expect(bytes.toString("latin1")).toContain("not legal advice");
  });

  it("prints Kentucky law expectations and a West Virginia consent note", () => {
    const kentucky = buildReportDocument(
      scoreAssessment({
        "profile.segment": "law",
        "profile.states": "ky",
        "permission.policy": "none",
        "verification.citations": "no",
      }),
      { partner: null, generatedAt: new Date("2026-10-19T12:00:00.000Z") },
    );
    const kentuckyText = Buffer.from(kentucky.output("arraybuffer")).toString("latin1");
    expect(kentuckyText).toContain("KBA E-457");
    expect(kentuckyText).toContain("What your rules expect");

    const westVirginia = buildReportDocument(
      scoreAssessment({ "profile.segment": "law", "profile.states": "wv", "permission.consent": "none" }),
      { partner: null, generatedAt: new Date("2026-10-19T12:00:00.000Z") },
    );
    const westVirginiaText = Buffer.from(westVirginia.output("arraybuffer")).toString("latin1");
    expect(westVirginiaText).toContain("L.E.O. 2024-01");
    expect(westVirginiaText).toContain("CB Financial");
  });
});
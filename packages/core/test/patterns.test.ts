import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_LIMIT, detectSensitiveData, luhnValid, localOnlySink } from "../src/index.js";

describe("detectSensitiveData", () => {
  it("flags an SSN or ITIN and ignores invalid area, group, and serial numbers", () => {
    expect(detectSensitiveData("SSN 219-09-9999 on file").map((hit) => hit.id)).toContain("ssn");
    expect(detectSensitiveData("ITIN 900-70-1234").map((hit) => hit.id)).toContain("ssn");
    expect(detectSensitiveData("000-12-3456").some((hit) => hit.id === "ssn")).toBe(false);
    expect(detectSensitiveData("666-12-3456").some((hit) => hit.id === "ssn")).toBe(false);
    expect(detectSensitiveData("123-00-6789").some((hit) => hit.id === "ssn")).toBe(false);
    expect(detectSensitiveData("123-45-0000").some((hit) => hit.id === "ssn")).toBe(false);
  });

  it("flags Luhn-valid card numbers and ignores a one-digit change", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    const valid = detectSensitiveData("Card 4111-1111-1111-1111 for the deposit");
    expect(valid.find((hit) => hit.id === "credit_card")?.count).toBe(1);
    expect(detectSensitiveData("4111111111111111").some((hit) => hit.id === "credit_card")).toBe(true);
    expect(detectSensitiveData("4111 1111 1111 1112").some((hit) => hit.id === "credit_card")).toBe(false);
  });

  it("flags email, phone, health hints, and client-matter hints", () => {
    const email = detectSensitiveData("Write jane@firm.example when you can.");
    expect(email.find((hit) => hit.id === "email")?.severity).toBe("low");
    expect(detectSensitiveData("Call (304) 555-0134 tomorrow.").some((hit) => hit.id === "phone")).toBe(true);
    const phi = detectSensitiveData("Patient DOB 03/02/1980 and MRN 102938. Diagnosis of hypertension.");
    expect(phi.find((hit) => hit.id === "phi_hint")?.severity).toBe("high");
    expect(phi.find((hit) => hit.id === "phi_hint")?.count).toBeGreaterThan(0);
    const matter = detectSensitiveData("Attorney-client communication. Matter No. 24-1108");
    expect(matter.map((hit) => hit.id)).toEqual(expect.arrayContaining(["client_matter"]));
  });

  it("does not return the matched text and stays quiet on ordinary prose", () => {
    const hits = detectSensitiveData("Please review the Thursday lunch menu and reply if you want soup.");
    expect(hits).toEqual([]);
    const flagged = detectSensitiveData("SSN 219-09-9999");
    expect(JSON.stringify(flagged)).not.toContain("219-09-9999");
  });

  it("stops at the scan limit", () => {
    const padding = "a".repeat(DEFAULT_SCAN_LIMIT);
    const hits = detectSensitiveData(`${padding} 219-09-9999`, { maxChars: DEFAULT_SCAN_LIMIT });
    expect(hits.some((hit) => hit.id === "ssn")).toBe(false);
    expect(detectSensitiveData(`219-09-9999 ${padding}`, { maxChars: 20 }).some((hit) => hit.id === "ssn")).toBe(
      true,
    );
  });
});

describe("localOnlySink", () => {
  it("resolves without using the snapshot", async () => {
    await expect(
      localOnlySink.send({
        schema: "shadow-ai-counts.v1",
        since: "2026-01-01T00:00:00.000Z",
        generatedAt: "2026-01-02T00:00:00.000Z",
        visitsByService: { chatgpt: 2 },
        warningsByPattern: { ssn: 1 },
      }),
    ).resolves.toBeUndefined();
  });
});

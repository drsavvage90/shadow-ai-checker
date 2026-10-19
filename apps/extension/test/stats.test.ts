import { describe, expect, it } from "vitest";
import { emptyStats, parseStats, recordVisit, recordWarning, toSnapshot } from "../src/stats";

describe("anonymous counts", () => {
  it("counts visits and known warning patterns, and drops everything else", () => {
    const start = emptyStats("2026-01-01T00:00:00.000Z");
    const visited = recordVisit(
      recordVisit(recordVisit(start, "chatgpt", "2026-01-02T00:00:00.000Z"), "chatgpt", "2026-01-02T00:00:00.000Z"),
      "nope!",
      "2026-01-02T00:00:00.000Z",
    );
    const warned = recordWarning(visited, ["ssn", "email", "not-a-pattern"], "2026-01-03T00:00:00.000Z");
    expect(warned.visitsByService).toEqual({ chatgpt: 2 });
    expect(warned.warningsByPattern).toEqual({ ssn: 1, email: 1 });
    expect(JSON.stringify(warned)).not.toMatch(/clipboard|prompt|219-/);
    const snapshot = toSnapshot(warned, "2026-01-04T00:00:00.000Z");
    expect(snapshot.schema).toBe("shadow-ai-counts.v1");
    expect(snapshot.generatedAt).toBe("2026-01-04T00:00:00.000Z");
    expect(Object.keys(snapshot).sort()).toEqual([
      "generatedAt",
      "schema",
      "since",
      "visitsByService",
      "warningsByPattern",
    ]);
  });

  it("ignores stored fields that are not counts", () => {
    const parsed = parseStats({
      schema: "shadow-ai-counts.v1",
      since: "2026-01-01T00:00:00.000Z",
      visitsByService: { chatgpt: 3, "bad id": 1 },
      warningsByPattern: { ssn: 2, pastedText: 9 },
      lastEventAt: "2026-01-02T00:00:00.000Z",
      content: "should not survive",
    });
    expect(parsed.visitsByService).toEqual({ chatgpt: 3 });
    expect(parsed.warningsByPattern).toEqual({ ssn: 2 });
    expect(JSON.stringify(parsed)).not.toContain("should not survive");
  });
});

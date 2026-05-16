import { describe, expect, it } from "vitest";
import { extractRollNumber, getUserSet, hasOverlappingRanges } from "../../src/lib/utils/rolls";

describe("roll utilities", () => {
  it("extracts numeric roll values", () => {
    expect(extractRollNumber("17")).toBe(17);
    expect(extractRollNumber("P-09")).toBe(9);
  });

  it("returns the matching assignment set only", () => {
    const set = getUserSet("17", [
      { id: "a", label: "A", rollStart: 1, rollEnd: 25, description: "A" },
      { id: "b", label: "B", rollStart: 26, rollEnd: 50, description: "B" },
    ]);
    expect(set?.label).toBe("A");
  });

  it("detects overlapping ranges", () => {
    expect(hasOverlappingRanges([{ rollStart: 1, rollEnd: 10 }, { rollStart: 10, rollEnd: 20 }])).toBe(true);
    expect(hasOverlappingRanges([{ rollStart: 1, rollEnd: 10 }, { rollStart: 11, rollEnd: 20 }])).toBe(false);
  });
});

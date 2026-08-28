import { describe, expect, it } from "vitest";
import { extractRollNumber, getUserSet, hasOverlappingRanges } from "../../src/lib/utils/rolls";

describe("roll utilities", () => {
  it("extracts numeric roll values", () => {
    expect(extractRollNumber("17")).toBe(17);
    expect(extractRollNumber("001")).toBe(1);
    expect(extractRollNumber("002")).toBe(2);
    expect(extractRollNumber("059")).toBe(59);
    expect(extractRollNumber("108")).toBe(108);
    expect(extractRollNumber("187")).toBe(187);
    expect(extractRollNumber("P-09")).toBe(9);
    expect(extractRollNumber("P-187")).toBe(187);
  });

  it("returns the matching assignment set only", () => {
    const sets = [
      { id: "a", label: "Set 1", rollStart: 1, rollEnd: 30, description: "Page 1" },
      { id: "b", label: "Set 2", rollStart: 31, rollEnd: 60, description: "Page 2" },
      { id: "c", label: "Set 3", rollStart: 100, rollEnd: 200, description: "Page 3" },
    ];

    expect(getUserSet("001", sets)?.label).toBe("Set 1");
    expect(getUserSet("002", sets)?.label).toBe("Set 1");
    expect(getUserSet("059", sets)?.label).toBe("Set 2");
    expect(getUserSet("108", sets)?.label).toBe("Set 3");
    expect(getUserSet("187", sets)?.label).toBe("Set 3");
  });

  it("returns undefined when student roll is outside configured ranges", () => {
    const sets = [
      { id: "a", label: "Set 1", rollStart: 1, rollEnd: 30, description: "Page 1" },
      { id: "b", label: "Set 2", rollStart: 31, rollEnd: 60, description: "Page 2" },
    ];

    expect(getUserSet("108", sets)).toBeUndefined();
    expect(getUserSet("187", sets)).toBeUndefined();
  });

  it("detects overlapping ranges", () => {
    expect(hasOverlappingRanges([{ rollStart: 1, rollEnd: 10 }, { rollStart: 10, rollEnd: 20 }])).toBe(true);
    expect(hasOverlappingRanges([{ rollStart: 1, rollEnd: 10 }, { rollStart: 11, rollEnd: 20 }])).toBe(false);
  });
});

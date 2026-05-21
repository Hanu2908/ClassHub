import { describe, expect, it } from "vitest";
import { calculateAttendance, parseERPAttendance } from "../../src/lib/utils/attendance";

describe("attendance utilities", () => {
  it("parses ERP aggregate rows", () => {
    const rows = parseERPAttendance("1 DBMS201 Database Management Systems Lecture 24 0 1 5 83.33");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "DBMS201",
      name: "Database Management Systems",
      type: "Lecture",
      present: 24,
      makeup: 1,
      absent: 5,
      percentage: 83.33,
      total: 29, // present(24) + od(0) + absent(5) = 29
      canSkip: 4 // (25 attended - 0.75 * 29) / 0.75 = 4.33 -> 4
    });
  });

  it("calculates recovery classes below threshold", () => {
    expect(calculateAttendance(9, 5).needToAttend).toBeGreaterThan(0);
  });
});

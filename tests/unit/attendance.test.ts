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
      total: 30, // present(24) + od(0) + makeup(1) + absent(5) = 30
      canSkip: 3 // (25 attended - 0.75 * 30) / 0.75 = (25 - 22.5) / 0.75 = 2.5 / 0.75 = 3.33 -> 3
    });
  });

  it("calculates recovery classes below threshold", () => {
    expect(calculateAttendance(9, 5).needToAttend).toBeGreaterThan(0);
  });
});

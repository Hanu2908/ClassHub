import { describe, expect, it } from "vitest";
import { calculateAttendance, parseERPAttendance, getAttendanceFreshness } from "../../src/lib/utils/attendance";

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
      percentage: 86.21,
      total: 29, // present(24) + od(0) + absent(5) = 29 (makeup excluded)
      canSkip: 4 // (25 attended - 0.75 * 29) / 0.75 = (25 - 21.75) / 0.75 = 3.25 / 0.75 = 4.33 -> 4
    });
  });

  it("calculates recovery classes below threshold", () => {
    expect(calculateAttendance(9, 5).needToAttend).toBeGreaterThan(0);
  });

  describe("getAttendanceFreshness", () => {
    const baseNow = new Date('2026-08-28T12:00:00.000Z').getTime();

    it("returns 'Not synced yet' for null/undefined/invalid input", () => {
      expect(getAttendanceFreshness(null, baseNow).label).toBe("Not synced yet");
      expect(getAttendanceFreshness(undefined, baseNow).label).toBe("Not synced yet");
      expect(getAttendanceFreshness("invalid-date", baseNow).label).toBe("Not synced yet");
      expect(getAttendanceFreshness(null, baseNow).isStale).toBe(true);
    });

    it("returns 'Synced just now' when synced recently or slightly ahead", () => {
      // Exactly now
      const justNow = new Date(baseNow).toISOString();
      expect(getAttendanceFreshness(justNow, baseNow)).toMatchObject({
        label: "Synced just now",
        isStale: false,
        days: 0,
      });

      // 10 seconds in the future (clock drift / immediate paste)
      const slightlyFuture = new Date(baseNow + 10000).toISOString();
      expect(getAttendanceFreshness(slightlyFuture, baseNow)).toMatchObject({
        label: "Synced just now",
        isStale: false,
        days: 0,
      });

      // 30 minutes ago
      const thirtyMinsAgo = new Date(baseNow - 30 * 60 * 1000).toISOString();
      expect(getAttendanceFreshness(thirtyMinsAgo, baseNow)).toMatchObject({
        label: "Synced just now",
        isStale: false,
        days: 0,
      });
    });

    it("formats hours ago correctly within 24 hours", () => {
      const twoHoursAgo = new Date(baseNow - 2 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(twoHoursAgo, baseNow)).toMatchObject({
        label: "Synced 2h ago",
        isStale: false,
        days: 0,
      });

      const twentyThreeHoursAgo = new Date(baseNow - 23 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(twentyThreeHoursAgo, baseNow)).toMatchObject({
        label: "Synced 23h ago",
        isStale: false,
        days: 0,
      });
    });

    it("formats days ago correctly within 5 days", () => {
      const oneDayAgo = new Date(baseNow - 24 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(oneDayAgo, baseNow)).toMatchObject({
        label: "Synced 1d ago",
        isStale: false,
        days: 1,
      });

      const fiveDaysAgo = new Date(baseNow - 5 * 24 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(fiveDaysAgo, baseNow)).toMatchObject({
        label: "Synced 5d ago",
        isStale: false,
        days: 5,
      });
    });

    it("marks attendance as stale when > 5 days old", () => {
      const sixDaysAgo = new Date(baseNow - 6 * 24 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(sixDaysAgo, baseNow)).toMatchObject({
        label: "⚠️ Stale (6d ago)",
        isStale: true,
        days: 6,
      });

      const twentyDaysAgo = new Date(baseNow - 20 * 24 * 3600 * 1000).toISOString();
      expect(getAttendanceFreshness(twentyDaysAgo, baseNow)).toMatchObject({
        label: "⚠️ Stale (20d ago)",
        isStale: true,
        days: 20,
      });
    });
  });
});

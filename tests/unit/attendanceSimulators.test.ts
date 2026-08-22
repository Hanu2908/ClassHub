import { describe, expect, it } from 'vitest';
import {
  calculateAttendance,
  simulateBoost,
  simulateBunk,
  calculateTargetGoal,
  simulateOD,
  simulateMix,
  getAttendanceTier,
} from '../../src/lib/utils/attendance';

describe('attendanceSimulators — Target Goal Calculator', () => {
  it('returns 0 if target percentage is already reached or below current percentage', () => {
    // 80 attended / 100 total = 80%. Target 75% -> 0 needed
    expect(calculateTargetGoal(100, 80, 75)).toBe(0);
    // Target 80% -> 0 needed
    expect(calculateTargetGoal(100, 80, 80)).toBe(0);
  });

  it('calculates exact consecutive classes needed to reach 75% target', () => {
    // 70 attended / 100 total (70%). Target 75%:
    // (0.75 * 100 - 70) / (1 - 0.75) = (75 - 70) / 0.25 = 5 / 0.25 = 20 classes
    // Verification: (70 + 20) / (100 + 20) = 90 / 120 = 75.00%
    const needed75 = calculateTargetGoal(100, 70, 75);
    expect(needed75).toBe(20);
    expect((70 + needed75) / (100 + needed75)).toBeGreaterThanOrEqual(0.75);
  });

  it('calculates exact consecutive classes needed to reach 80% target', () => {
    // 70 attended / 100 total (70%). Target 80%:
    // (0.80 * 100 - 70) / (1 - 0.80) = (80 - 70) / 0.20 = 10 / 0.20 = 50 classes
    // Verification: (70 + 50) / (100 + 50) = 120 / 150 = 80.00%
    const needed80 = calculateTargetGoal(100, 70, 80);
    expect(needed80).toBe(50);
    expect((70 + needed80) / (100 + needed80)).toBeGreaterThanOrEqual(0.80);
  });

  it('calculates exact consecutive classes needed to reach 85% target with ceiling rounding', () => {
    // 16 attended / 20 total (80%). Target 85%:
    // (0.85 * 20 - 16) / (1 - 0.85) = (17 - 16) / 0.15 = 1 / 0.15 = 6.666... -> 7 classes
    // Verification: (16 + 7) / (20 + 7) = 23 / 27 = 85.185%
    const needed85 = calculateTargetGoal(20, 16, 85);
    expect(needed85).toBe(7);
    expect((16 + needed85) / (20 + needed85) * 100).toBeGreaterThanOrEqual(85);
  });

  it('handles target >= 100% safely without division by zero', () => {
    expect(calculateTargetGoal(100, 70, 100)).toBe(0);
    expect(calculateTargetGoal(100, 70, 105)).toBe(0);
  });
});

describe('attendanceSimulators — Boost Simulator', () => {
  it('calculates projected percentage and delta when attending future classes', () => {
    // 80 attended / 100 total = 80.00%. Boost +5 classes:
    // (80 + 5) / (100 + 5) = 85 / 105 = 80.95%. Delta: +0.95%
    const result = simulateBoost(100, 80, 5);
    expect(result.percent).toBe(80.95);
    expect(result.delta).toBe(0.95);
  });

  it('returns delta 0 for boost = 0', () => {
    const result = simulateBoost(100, 80, 0);
    expect(result.percent).toBe(80);
    expect(result.delta).toBe(0);
  });
});

describe('attendanceSimulators — Bunk Simulator', () => {
  it('calculates projected percentage, delta, and remainsSafe flag', () => {
    // 80 attended / 100 total = 80.00%. Bunk +4 classes:
    // 80 / (100 + 4) = 80 / 104 = 76.92%. Delta: -3.08%, remainsSafe: true
    const safeResult = simulateBunk(100, 80, 4);
    expect(safeResult.percent).toBe(76.92);
    expect(safeResult.delta).toBe(3.08);
    expect(safeResult.remainsSafe).toBe(true);

    // Bunk +10 classes: 80 / 110 = 72.73%. remainsSafe: false
    const unsafeResult = simulateBunk(100, 80, 10);
    expect(unsafeResult.percent).toBe(72.73);
    expect(unsafeResult.remainsSafe).toBe(false);
  });

  it('matches canSkip boundary precisely', () => {
    // 21 attended / 24 total (87.5%). canSkip = 4.
    const { canSkip } = calculateAttendance(24, 21);
    expect(canSkip).toBe(4);

    // Bunking exactly canSkip classes keeps attendance >= 75%
    const atBoundary = simulateBunk(24, 21, canSkip);
    expect(atBoundary.remainsSafe).toBe(true);
    expect(atBoundary.percent).toBe(75.0);

    // Bunking canSkip + 1 drops below 75%
    const pastBoundary = simulateBunk(24, 21, canSkip + 1);
    expect(pastBoundary.remainsSafe).toBe(false);
    expect(pastBoundary.percent).toBeLessThan(75.0);
  });
});

describe('attendanceSimulators — On-Duty (OD) Simulator', () => {
  it('calculates projected percentage when OD classes are claimed', () => {
    // 70 attended / 100 total = 70.00%. OD +5 classes:
    // (70 + 5) / 100 = 75 / 100 = 75.00%. Delta: +5.00%
    const result = simulateOD(100, 70, 5);
    expect(result.percent).toBe(75.0);
    expect(result.delta).toBe(5.0);
  });

  it('caps attendance at total classes held so OD cannot exceed 100%', () => {
    // 95 attended / 100 total. OD +10 (would be 105 attended if uncapped)
    const result = simulateOD(100, 95, 10);
    expect(result.percent).toBe(100.0);
    expect(result.delta).toBe(5.0);
  });
});

describe('attendanceSimulators — Mix Sandbox', () => {
  it('calculates projected percentage when both attending and bunking', () => {
    // 80 attended / 100 total (80.00%). Attend +4, Bunk +2:
    // (80 + 4) / (100 + 4 + 2) = 84 / 106 = 79.25%. Delta: -0.75%
    const result = simulateMix(100, 80, 4, 2);
    expect(result.percent).toBe(79.25);
    expect(result.delta).toBe(-0.75);
    expect(result.remainsSafe).toBe(true);
  });
});

describe('attendanceSimulators — Attendance Tier Badges', () => {
  it('assigns correct tier metadata based on standing threshold', () => {
    expect(getAttendanceTier(92.5).tier).toBe('zenith');
    expect(getAttendanceTier(90.0).tier).toBe('zenith');

    expect(getAttendanceTier(85.0).tier).toBe('gold');
    expect(getAttendanceTier(80.0).tier).toBe('gold');

    expect(getAttendanceTier(79.9).tier).toBe('silver');
    expect(getAttendanceTier(75.0).tier).toBe('silver');

    expect(getAttendanceTier(74.9).tier).toBe('warned');
    expect(getAttendanceTier(60.0).tier).toBe('warned');
  });
});

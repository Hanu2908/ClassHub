import { describe, expect, it, vi } from "vitest";
import { generateAnonymousToken } from "../../src/lib/utils";
import { pollSchema } from "../../src/lib/validation/polls.schema";
import { isExpired, TWO_DAYS_MS } from "../../src/store/appStore";

// ── generateAnonymousToken ───────────────────────────────────────────────────

describe("generateAnonymousToken", () => {
  it("produces a deterministic UUID-like string for the same inputs", () => {
    const a = generateAnonymousToken("user-1", "poll-abc");
    const b = generateAnonymousToken("user-1", "poll-abc");
    expect(a).toBe(b);
  });

  it("produces different tokens for different users", () => {
    const a = generateAnonymousToken("user-1", "poll-abc");
    const b = generateAnonymousToken("user-2", "poll-abc");
    expect(a).not.toBe(b);
  });

  it("produces different tokens for different polls", () => {
    const a = generateAnonymousToken("user-1", "poll-abc");
    const b = generateAnonymousToken("user-1", "poll-xyz");
    expect(a).not.toBe(b);
  });

  it("returns a 36-character UUID-like format (8-4-4-4-12)", () => {
    const token = generateAnonymousToken("user-1", "poll-abc");
    // 8-4-4-4-12 = 32 hex + 4 hyphens = 36 chars
    expect(token).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});

// ── isExpired (2-day grace period) ──────────────────────────────────────────

describe("isExpired", () => {
  it("returns false for null/undefined deadlines", () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });

  it("returns false for a deadline in the future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it("returns false for a deadline that just passed (within 2-day grace)", () => {
    const justPassed = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    expect(isExpired(justPassed)).toBe(false);
  });

  it("returns false at exactly 2 days after deadline", () => {
    const now = Date.now();
    const exactlyTwoDays = new Date(now - TWO_DAYS_MS).toISOString();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    expect(isExpired(exactlyTwoDays)).toBe(false);
    spy.mockRestore();
  });

  it("returns true more than 2 days after deadline", () => {
    const longGone = new Date(Date.now() - TWO_DAYS_MS - 1000).toISOString();
    expect(isExpired(longGone)).toBe(true);
  });

  it("returns true for a deadline 10 days in the past", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });
});

// ── Poll schema validation ──────────────────────────────────────────────────

describe("pollSchema", () => {
  it("validates a valid general poll (no options required)", () => {
    const result = pollSchema.safeParse({
      question: "Lunch preference?",
      type: "general",
    });
    expect(result.success).toBe(true);
  });

  it("validates a valid actionable poll with ≥2 options", () => {
    const result = pollSchema.safeParse({
      question: "Who is attending the review?",
      type: "actionable",
      options: ["Yes", "No"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an actionable poll with less than 2 options", () => {
    const result = pollSchema.safeParse({
      question: "Attending?",
      type: "actionable",
      options: ["Yes"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an actionable poll with no options at all", () => {
    const result = pollSchema.safeParse({
      question: "Attending?",
      type: "actionable",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question shorter than 3 characters", () => {
    const result = pollSchema.safeParse({
      question: "Hi",
      type: "general",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid poll type", () => {
    const result = pollSchema.safeParse({
      question: "Valid question text",
      type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("accepts actionable poll with many options (multi-select scenario)", () => {
    const result = pollSchema.safeParse({
      question: "Select your preferred slots",
      type: "actionable",
      options: ["9 AM", "10 AM", "11 AM", "12 PM", "1 PM"],
    });
    expect(result.success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { canManageSection, canSeeActionableVotes, isCR } from "../../src/lib/utils/permissions";

describe("isCR", () => {
  it("returns true for lowercase 'cr'", () => {
    expect(isCR("cr")).toBe(true);
  });

  it("returns true for uppercase 'CR'", () => {
    expect(isCR("CR")).toBe(true);
  });

  it("returns true for mixed case 'Cr'", () => {
    expect(isCR("Cr")).toBe(true);
  });

  it("returns false for 'student'", () => {
    expect(isCR("student")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCR(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCR(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCR("")).toBe(false);
  });
});

describe("canManageSection", () => {
  it("allows CR to manage sections", () => {
    expect(canManageSection("cr")).toBe(true);
    expect(canManageSection("CR")).toBe(true);
  });

  it("denies students from managing sections", () => {
    expect(canManageSection("student")).toBe(false);
  });

  it("denies null/undefined roles", () => {
    expect(canManageSection(null)).toBe(false);
    expect(canManageSection(undefined)).toBe(false);
  });

  it("denies arbitrary role strings", () => {
    expect(canManageSection("admin")).toBe(false);
    expect(canManageSection("teacher")).toBe(false);
  });
});

describe("canSeeActionableVotes", () => {
  it("allows CR to view actionable poll votes", () => {
    expect(canSeeActionableVotes("cr")).toBe(true);
  });

  it("allows teacher role to view actionable poll votes", () => {
    expect(canSeeActionableVotes("teacher")).toBe(true);
  });

  it("allows admin role to view actionable poll votes", () => {
    expect(canSeeActionableVotes("admin")).toBe(true);
  });

  it("denies student role from seeing actionable poll votes", () => {
    expect(canSeeActionableVotes("student")).toBe(false);
  });

  it("denies null role", () => {
    expect(canSeeActionableVotes(null)).toBe(false);
  });

  it("denies undefined role", () => {
    expect(canSeeActionableVotes(undefined)).toBe(false);
  });

  it("denies empty string", () => {
    expect(canSeeActionableVotes("")).toBe(false);
  });

  it("is case-insensitive for CR", () => {
    expect(canSeeActionableVotes("CR")).toBe(true);
    expect(canSeeActionableVotes("Cr")).toBe(true);
  });
});

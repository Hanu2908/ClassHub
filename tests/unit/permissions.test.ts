import { describe, expect, it } from "vitest";
import { canManageSection, canSeeActionableVotes, isCR } from "../../src/lib/utils/permissions";

describe("permission helpers", () => {
  it("allows only CR users to manage section data", () => {
    expect(isCR("cr")).toBe(true);
    expect(canManageSection("student")).toBe(false);
    expect(canSeeActionableVotes("cr")).toBe(true);
  });
});

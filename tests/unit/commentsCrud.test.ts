import { describe, expect, it } from "vitest";

// The validation logic matching AnnouncementCommentsDrawer's inline canEdit check
export function evaluateCanEdit({
  isSelf,
  isCommentVerified,
  createdAt,
  nowTime
}: {
  isSelf: boolean;
  isCommentVerified: boolean;
  createdAt: string;
  nowTime: number;
}) {
  const timeDifference = nowTime - new Date(createdAt).getTime();
  const isWithinWindow = timeDifference <= 15 * 60 * 1000;
  return isSelf && !isCommentVerified && isWithinWindow;
}

describe("Q&A Comment Editing Validation Logic", () => {
  it("allows self-editing of an unverified comment within 15 minutes", () => {
    const nowTime = Date.now();
    const createdAt = new Date(nowTime - 5 * 60 * 1000).toISOString(); // 5 minutes ago

    expect(
      evaluateCanEdit({
        isSelf: true,
        isCommentVerified: false,
        createdAt,
        nowTime
      })
    ).toBe(true);
  });

  it("blocks self-editing of an unverified comment older than 15 minutes", () => {
    const nowTime = Date.now();
    const createdAt = new Date(nowTime - 16 * 60 * 1000).toISOString(); // 16 minutes ago

    expect(
      evaluateCanEdit({
        isSelf: true,
        isCommentVerified: false,
        createdAt,
        nowTime
      })
    ).toBe(false);
  });

  it("blocks self-editing of a verified comment even under 15 minutes", () => {
    const nowTime = Date.now();
    const createdAt = new Date(nowTime - 2 * 60 * 1000).toISOString(); // 2 minutes ago

    expect(
      evaluateCanEdit({
        isSelf: true,
        isCommentVerified: true,
        createdAt,
        nowTime
      })
    ).toBe(false);
  });

  it("blocks editing of another user's comment even if under 15 minutes and unverified", () => {
    const nowTime = Date.now();
    const createdAt = new Date(nowTime - 2 * 60 * 1000).toISOString(); // 2 minutes ago

    expect(
      evaluateCanEdit({
        isSelf: false,
        isCommentVerified: false,
        createdAt,
        nowTime
      })
    ).toBe(false);
  });

  it("handles the exact boundary of 15 minutes", () => {
    const nowTime = Date.now();
    const createdAtBoundary = new Date(nowTime - 15 * 60 * 1000).toISOString(); // exactly 15 minutes ago
    const createdAtJustPast = new Date(nowTime - (15 * 60 * 1000 + 1000)).toISOString(); // 15 mins and 1 sec ago

    expect(
      evaluateCanEdit({
        isSelf: true,
        isCommentVerified: false,
        createdAt: createdAtBoundary,
        nowTime
      })
    ).toBe(true);

    expect(
      evaluateCanEdit({
        isSelf: true,
        isCommentVerified: false,
        createdAt: createdAtJustPast,
        nowTime
      })
    ).toBe(false);
  });
});

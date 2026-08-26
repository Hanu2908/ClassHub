import { describe, expect, it } from "vitest";
import { assignmentSchema } from "../../src/lib/validation/assignments.schema";
import { commentContentSchema, MAX_COMMENT_LENGTH } from "../../src/lib/validation/comments.schema";
import { joinHubSchema } from "../../src/lib/validation/onboarding.schema";
import { pollSchema } from "../../src/lib/validation/polls.schema";
import { timetableSlotSchema } from "../../src/lib/validation/timetable.schema";

describe("zod schemas", () => {
  it("validates onboarding roll and hub code", () => {
    expect(joinHubSchema.safeParse({ hubCode: "P2WXYZ", classRoll: "17", universityRoll: "25ESKCX089" }).success).toBe(true);
    expect(joinHubSchema.safeParse({ hubCode: "BAD", classRoll: "7", universityRoll: "x" }).success).toBe(false);
  });

  it("rejects overlapping assignment sets", () => {
    const result = assignmentSchema.safeParse({
      title: "DBMS Assignment",
      subjectId: "00000000-0000-4000-8000-000000000001",
      dueDate: "2026-05-16T12:00:00.000Z",
      sets: [
        { label: "A", rollStart: 1, rollEnd: 10, description: "Pages 1-2", pdfUrl: "" },
        { label: "B", rollStart: 10, rollEnd: 20, description: "Pages 3-4", pdfUrl: "" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty comment (0 characters)", () => {
    expect(commentContentSchema.safeParse("").success).toBe(false);
  });

  it("accepts a comment at exactly the max length", () => {
    const atLimit = "a".repeat(MAX_COMMENT_LENGTH);
    const result = commentContentSchema.safeParse(atLimit);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(MAX_COMMENT_LENGTH);
  });

  it("rejects a comment one character over the max length", () => {
    const overLimit = "a".repeat(MAX_COMMENT_LENGTH + 1);
    expect(commentContentSchema.safeParse(overLimit).success).toBe(false);
  });

  it("validates polls and timetable slots", () => {
    expect(pollSchema.safeParse({ question: "Who is attending?", type: "actionable", options: ["Yes", "No"] }).success).toBe(true);
    expect(timetableSlotSchema.safeParse({
      dayOfWeek: 1,
      subjectId: "00000000-0000-4000-8000-000000000001",
      startTime: "09:00",
      endTime: "09:50",
      room: "A-204",
      type: "lecture",
    }).success).toBe(true);
  });
});

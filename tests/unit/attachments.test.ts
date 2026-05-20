import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  isFileTooLarge,
  buildStoragePath,
  getFileCategory,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_COUNT,
} from "../../src/lib/utils/attachments";

// ── formatFileSize ───────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("returns '0 Bytes' for zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
  });

  it("formats bytes below 1 KB correctly", () => {
    expect(formatFileSize(512)).toBe("512 Bytes");
    expect(formatFileSize(1)).toBe("1 Bytes");
  });

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });
});

// ── isFileTooLarge ───────────────────────────────────────────────────────────

describe("isFileTooLarge", () => {
  it("rejects files exceeding default 10 MB limit", () => {
    expect(isFileTooLarge(MAX_FILE_SIZE_BYTES + 1)).toBe(true);
  });

  it("accepts files at exactly 10 MB", () => {
    expect(isFileTooLarge(MAX_FILE_SIZE_BYTES)).toBe(false);
  });

  it("accepts files well under the limit", () => {
    expect(isFileTooLarge(1024)).toBe(false);
  });

  it("supports custom max MB parameter", () => {
    const fiveMB = 5 * 1024 * 1024;
    expect(isFileTooLarge(fiveMB + 1, 5)).toBe(true);
    expect(isFileTooLarge(fiveMB, 5)).toBe(false);
  });
});

// ── buildStoragePath ─────────────────────────────────────────────────────────

describe("buildStoragePath", () => {
  it("returns path in format sectionId/parentType/parentId/ts_filename", () => {
    const path = buildStoragePath("sec-123", "announcement", "ann-456", "notes.pdf");
    expect(path).toMatch(/^sec-123\/announcement\/ann-456\/\d+_notes\.pdf$/);
  });

  it("sanitizes filenames with special characters", () => {
    const path = buildStoragePath("sec-1", "assignment", "asg-2", "my file (1).pdf");
    // special chars replaced with underscores
    expect(path).not.toContain(" ");
    expect(path).not.toContain("(");
    expect(path).not.toContain(")");
    expect(path).toContain("my_file__1_.pdf");
  });

  it("preserves allowed characters in filenames", () => {
    const path = buildStoragePath("sec-1", "assignment", "asg-2", "report-v2.1_final.pdf");
    expect(path).toContain("report-v2.1_final.pdf");
  });
});

// ── getFileCategory ──────────────────────────────────────────────────────────

describe("getFileCategory", () => {
  it("identifies PDF files", () => {
    expect(getFileCategory("application/pdf")).toBe("pdf");
  });

  it("identifies image files", () => {
    expect(getFileCategory("image/png")).toBe("image");
    expect(getFileCategory("image/jpeg")).toBe("image");
    expect(getFileCategory("image/webp")).toBe("image");
  });

  it("identifies spreadsheet files", () => {
    expect(getFileCategory("text/csv")).toBe("spreadsheet");
    expect(getFileCategory("application/vnd.ms-excel")).toBe("spreadsheet");
    expect(getFileCategory("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("spreadsheet");
  });

  it("identifies code files", () => {
    expect(getFileCategory("application/json")).toBe("code");
    expect(getFileCategory("application/javascript")).toBe("code");
    expect(getFileCategory("text/css")).toBe("code");
  });

  it("identifies plain text files", () => {
    expect(getFileCategory("text/plain")).toBe("text");
    expect(getFileCategory("text/html")).toBe("text");
  });

  it("returns 'other' for unknown types", () => {
    expect(getFileCategory("application/octet-stream")).toBe("other");
    expect(getFileCategory("application/zip")).toBe("other");
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe("attachment constants", () => {
  it("MAX_FILE_SIZE_MB is 10", () => {
    expect(MAX_FILE_SIZE_MB).toBe(10);
  });

  it("MAX_FILE_SIZE_BYTES equals 10 * 1024 * 1024", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("MAX_FILE_COUNT is 5", () => {
    expect(MAX_FILE_COUNT).toBe(5);
  });
});

import { describe, expect, it } from "vitest";

// YouTube parsing regex used in RichTextBody.tsx
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// Document & Drive URL parsing regex used in RichTextBody.tsx
const DOC_URL_REGEX = /(https?:\/\/(?:drive\.google\.com\/\S+|docs\.google\.com\/\S+|[^\s]+\.(?:pdf|docx?|xlsx?|pptx?|zip|csv)))(?=\s|$)/gi;

// Smart Task Detection rules used in RichTextBody.tsx
const TASK_ACTION_VERBS = [
  'submit', 'fill', 'complete', 'pay', 'bring', 'sign', 'upload', 'read',
  'register', 'download', 'attend', 'finish', 'solve', 'prepare', 'verify',
  'check', 'do', 'send', 'collect', 'write', 'get', 'create', 'deposit',
  'inform', 'join', 'print', 'attach', 'review', 'report', 'file', 'take',
  'clear', 'update', 'remember'
];
const TASK_HEADER_REGEX = /(?:tasks?|to-?dos?|action items?|instructions?|checklists?|steps?|things to do|deadlines?|requirements?):?/i;

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

function extractDocUrls(text: string): string[] {
  const matches = [...text.matchAll(DOC_URL_REGEX)];
  return matches.map((m) => m[1]);
}

function isTaskListItem(itemContent: string, lastNonEmptyLine = ''): boolean {
  const trimmedItem = itemContent.trim().toLowerCase();
  if (lastNonEmptyLine && TASK_HEADER_REGEX.test(lastNonEmptyLine)) {
    return true;
  }
  const firstWord = trimmedItem.split(/\s+/)[0];
  if (TASK_ACTION_VERBS.includes(firstWord)) {
    return true;
  }
  if (/\b(?:due by|submit before|deadline|by \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.test(trimmedItem)) {
    return true;
  }
  return false;
}

describe("YouTube URL Extraction Regex", () => {
  it("extracts ID from standard watch links", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from standard watch links with trailing parameters", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&t=10s")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&si=abcd1234efgh")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from short share links (youtu.be)", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("http://youtu.be/dQw4w9WgXcQ?si=abcd")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from mobile browser links (m.youtube.com)", () => {
    expect(extractVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("http://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from embed links", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtube.com/embed/dQw4w9WgXcQ?autoplay=1")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-youtube or invalid urls", () => {
    expect(extractVideoId("https://google.com")).toBeNull();
    expect(extractVideoId("https://vimeo.com/12345678")).toBeNull();
    expect(extractVideoId("https://youtube.com/")).toBeNull();
    expect(extractVideoId("https://youtu.be/")).toBeNull();
  });
});

describe("Document & Drive URL Extraction", () => {
  it("extracts Google Drive and Docs links", () => {
    const text = "Check file https://drive.google.com/file/d/123/view and https://docs.google.com/document/d/456/edit";
    const urls = extractDocUrls(text);
    expect(urls).toEqual([
      "https://drive.google.com/file/d/123/view",
      "https://docs.google.com/document/d/456/edit"
    ]);
  });

  it("extracts direct PDF and Document links", () => {
    const text = "Download assignment at https://skit.ac.in/manual.pdf and data https://skit.ac.in/data.xlsx";
    const urls = extractDocUrls(text);
    expect(urls).toEqual([
      "https://skit.ac.in/manual.pdf",
      "https://skit.ac.in/data.xlsx"
    ]);
  });
});

describe("Smart Task Auto-Detection Rules", () => {
  it("detects task list items starting with action verbs", () => {
    expect(isTaskListItem("Submit physics lab manual")).toBe(true);
    expect(isTaskListItem("Fill feedback form on portal")).toBe(true);
    expect(isTaskListItem("Pay lab fee before 5 PM")).toBe(true);
    expect(isTaskListItem("Bring registration slip")).toBe(true);
  });

  it("detects task items under task headers", () => {
    expect(isTaskListItem("Scientific calculator", "Instructions for tomorrow:")).toBe(true);
    expect(isTaskListItem("Lab manual", "Tasks:")).toBe(true);
  });

  it("does not flag plain subject or study topic lists as tasks", () => {
    expect(isTaskListItem("Data Structures", "Course Overview")).toBe(false);
    expect(isTaskListItem("Linear Algebra")).toBe(false);
  });
});

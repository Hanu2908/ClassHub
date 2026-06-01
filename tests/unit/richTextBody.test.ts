import { describe, expect, it } from "vitest";

// YouTube parsing regex used in RichTextBody.tsx
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
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

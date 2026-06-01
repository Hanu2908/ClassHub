# Spec: Dynamic YouTube In-Player and Notice Linkifier Design

This specification defines the client-side system to automatically format body text, auto-linkify secure URLs, detect YouTube links, and display a high-fidelity, on-demand embedded YouTube player inside the ClassHub PWA. It also addresses the text legibility issues on the main Announcements page.

---

## 1. Product Requirements & Design Goals

1. **Auto-Linkification:** Any standard URL (`http://` or `https://`) in an announcement description must be rendered as a clickable, styled anchor tag (`<a>`) across the entire app (both the dashboard drawer and the announcements page).
2. **On-Demand YouTube In-Player:**
   * Automatically detect YouTube links in description text.
   * Extract the Video ID securely.
   * Render a premium, responsive **Glassmorphic YouTube Preview Card** (16:9 aspect ratio) with the video's high-res thumbnail and title.
   * Do NOT load the heavy YouTube iframe player on mount to preserve scroll performance (INP, LCP).
   * Swaps the preview card with a `youtube-nocookie.com` iframe only after the user actively taps the Play button on the card.
3. **Typography & Legibility Enhancements:**
   * Improve the legibility of announcement descriptions on [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx).
   * Increase text color contrast from `var(--text-secondary)` to `var(--text-primary)`.
   * Increase line height to `1.625` and size to `14.5px` for a premium reading experience.

---

## 2. Technical Architecture & Components

We will create a new shared component **`RichTextBody.tsx`** to bundle the text auto-linkification, YouTube video detection, and player embed rendering.

### A. YouTube Link Detection & Video ID Extraction
The regular expression will match standard YouTube link variations:
```typescript
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
```
* Supports short links: `https://youtu.be/VIDEO_ID`
* Supports web browser links: `https://www.youtube.com/watch?v=VIDEO_ID`
* Supports mobile browser links: `https://m.youtube.com/watch?v=VIDEO_ID`
* Supports embed links: `https://youtube.com/embed/VIDEO_ID`

### B. Dynamic Title Resolution (No API Key oEmbed)
To display the actual YouTube video title instead of a generic fallback, we will fetch it asynchronously on mount using YouTube's official, open, and anonymous oEmbed endpoint:
```typescript
const fetchUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
```
This is fully cacheable, requires no Google Developer API keys, and has a clean loading shimmer fallback.

### C. Glassmorphic YouTube Preview Card (`YouTubePlayer.tsx` sub-component)
A beautiful 16:9 card that features:
* **Background:** Uses YouTube's official open image CDN: `https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg` (falls back to `hqdefault.jpg` if not available).
* **Overlay:** A dark semi-transparent scrim (`rgba(10, 11, 18, 0.45)`) paired with a blurry backdrop-filter for premium legibility.
* **Play Indicator:** A centered, smooth-hovering play button featuring the classic YouTube red play symbol, scaled to `transform: scale(1.08)` on hover/touch.
* **Inline Playback:** Swaps with an `iframe` with `autoplay=1` and `allowfullscreen` set. Uses `youtube-nocookie.com` for complete user privacy.

---

## 3. Detailed UI Design & Spacing System

Following the `ui-ux-pro-max` guidelines:
* **Text Contrast:** Body copy uses `var(--text-primary)` (clean off-white/high-contrast gray in dark mode) ensuring standard WCAG contrast ratios of `> 4.5:1`.
* **Play Target Hit Area:** Tapping the video preview card uses a full touch-target hit area spanning the entire card (min height `160px` on mobile, satisfying the touch size threshold).
* **Smooth Transitions:** Transitions for the hover effects (zoom, play button scaling, and iframe swap) use `all 0.25s cubic-bezier(0.16, 1, 0.3, 1)` to feel fluid.

---

## 4. Proposed File Changes

### 1. [NEW] [RichTextBody.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/RichTextBody.tsx)
Build a fully styled, robust linkifier and YouTube embed player.

### 2. [MODIFY] [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx)
Replace `ann.body` with the new `<RichTextBody>` component. Update description style tokens to higher contrast and comfortable sizing.

### 3. [MODIFY] [AnnouncementsScroll.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/AnnouncementsScroll.tsx)
Remove the locally duplicated `linkify` engine and replace the drawer description renderer (`{linkify(selectedAnn.body)}`) with `<RichTextBody text={selectedAnn.body} />`.

---

## 5. Automated & Manual Verification

1. **Unit Testing:** Write a test suite in `tests/unit/richTextBody.test.ts` verifying that:
   * Standard secure/insecure URLs are accurately linkified.
   * Standard and short YouTube links are correctly parsed, extracting the 11-character video ID.
2. **Visual Verification:** Ensure that:
   * URLs are fully clickable and functional inside both the dashboard drawer and the announcements page.
   * Playback works flawlessly on physical mobile and desktop browsers inside ClassHub without redirecting the user.
   * Text colors are deep and highly legible.

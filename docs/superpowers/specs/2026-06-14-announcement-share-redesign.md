# Announcement Share Feature Redesign Spec

## Goal
Improve the visual quality, customization, and functionality of the announcement sharing feature in ClassHub when sharing to WhatsApp. 

---

## Proposed Changes

### 1. [OffscreenSharePortal.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/announcement-qa/OffscreenSharePortal.tsx)
* **Dynamic Section Metadata:**
  * Call `useSection()` to retrieve the database-level section and college names.
  * In the top-right watermark, display `SECTION <NAME> | <COLLEGE>` (e.g. `SECTION P-2 | SKIT`), completely removing the hardcoded `"BETA"` prefix.
  * If the database is offline or not loaded, the section metadata row will remain empty.
* **ClassHub Circular Logo:**
  * Use `/app_icon.svg` instead of `/favicon.ico`.
  * Remove the dark circular wrapper background, border, and padding. Render the SVG logo directly at `28px` by `28px` with `border-radius: 50%` so it flows cleanly next to the "ClassHub" text.
* **Absolute Timestamp:**
  * Replace the relative time string (`timeAgo(postedAt)`) at the bottom of the card with an absolute formatted timestamp (e.g., `14 Jun · 02:15 PM`). This prevents the timestamp on static shared images from becoming incorrect over time.
* **Dynamic Bento Grid Collage (Approach 1):**
  * Arrange multiple image attachments inside a responsive collage grid inside the share card:
    * **1 Image:** Full-width card container (max-height: 320px).
    * **2 Images:** Side-by-side (2 columns, each taking 50% width).
    * **3 Images:** Split grid—1 large featured image on the left (50% width), and 2 stacked vertically on the right.
    * **4 Images:** Clean 2x2 grid.
    * **5+ Images:** 2x2 grid where the 4th cell contains a dark overlay with `+X more` text.

### 2. [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx) and [AnnouncementsScroll.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/AnnouncementsScroll.tsx)
* **Share Options Sheet UI:**
  * When a user taps **Share** on an announcement that has images, slide up a bottom sheet with two options:
    1. **Share as ClassHub Notice Card**
    2. **Share Original Photos Directly**
  * When selecting **Share Original Photos Directly**, show thumbnails of all attachments with checkboxes (all checked by default) and a "Share Selected" action button.
* **Direct Image Sharing Mechanism:**
  * When "Share Selected" is clicked, fetch the images as Blobs via their signed URLs (utilizing browser cache).
  * Convert them to JavaScript `File` objects: `new File([blob], filename, { type: blob.type })`.
  * Trigger the native share sheet: `navigator.share({ files: filesList })`.
  * On desktop or unsupported browsers, fallback to triggering direct browser downloads of the files sequentially.
  * Show a loading spinner (e.g. `"Preparing photos..."`) on the share button while this asynchronous fetching takes place.

---

## Verification Plan

### Automated/Build Verification
* Run `npm run build` and `npm run lint` to ensure no TypeScript or compilation errors are introduced.

### Manual Verification
* **Notice Card Capture:** Click "Share as ClassHub Notice Card" and verify the generated card image contains the circular `/app_icon.svg` without a box frame, dynamic section details, absolute timestamp, and the dynamic bento grid collage.
* **Direct Image Sharing:** Verify that clicking "Share Original Photos Directly" fetches the selected images and launches the native share sheet on mobile devices. Verify fallback sequential download triggers on desktop.

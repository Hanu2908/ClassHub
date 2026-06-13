# Announcement Share & File Upload Limits Redesign Spec

## Goal
1. Improve the visual quality, customization, and functionality of the announcement sharing feature in ClassHub when sharing to WhatsApp.
2. Upgrade the file upload system to support dynamic dual-limits (5 documents/PDFs and up to 20 images) for a much richer classroom experience.
3. Streamline file selection on mobile devices by introducing a WhatsApp-style upload source selection bottom sheet.

---

## Proposed Changes

### 1. [FileUploader.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/FileUploader.tsx)
* **Upload Source Selection Bottom Sheet (Option A.1):**
  * Import the reusable `<BottomSheet>` component.
  * When the upload zone is tapped on a mobile device (`window.innerWidth < 768`), slide up a bottom sheet titled `"Select Attachment Source"`.
  * The bottom sheet displays a horizontal row of 3 large circular buttons (`56px x 56px`) with matching labels:
    1. **📷 Camera (Take Photo)**
       * Background: Solid coral-red (`#ef4444`)
       * Icon: White `Camera` outline icon
       * Action: Triggers hidden input: `capture="environment" accept="image/*"`
    2. **🖼️ Gallery (Photos)**
       * Background: Solid emerald-green (`#10b981`)
       * Icon: White `Image` outline icon
       * Action: Triggers hidden input: `accept="image/*"`
    3. **📄 Document (PDF/Files)**
       * Background: Solid accent-blue (`#3b82f6`)
       * Icon: White `FileText` outline icon
       * Action: Triggers hidden input: `accept="application/pdf,text/*,.csv,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/msword,application/vnd.ms-powerpoint"`
  * Provide smooth touch interaction animations using Framer Motion (`whileTap={{ scale: 0.92 }}`).
  * For desktop clicks, bypass the sheet and directly open the document/all-media file input as it currently does.
* **Dynamic Dual Limits Configuration:**
  * Update `FileUploaderProps` to include:
    * `maxDocs?: number` (default: `5`)
    * `maxImages?: number` (default: `20`)
    * `maxFiles?: number` (default: `20` — global ceiling limit)
  * Update `processFiles` to dynamically categorize files during drag/drop or input selection:
    * Categorize added files into **Images** (using `isPreviewableImage`) and **Documents** (PDF, sheets, csv, text, doc, etc.).
    * Maintain separate running tallies of already-uploaded + new files.
    * If adding a document and count exceeds `maxDocs` (5), reject with: `"Maximum of 5 documents allowed."`
    * If adding an image and count exceeds `maxImages` (20), reject with: `"Maximum of 20 images allowed."`
    * If total count exceeds `maxFiles` (20), reject with: `"Maximum of 20 total attachments allowed."`
  * Update the title label on the UI from `Attachments (Max {maxFiles} files...)` to `Attachments (Max {maxImages} images, {maxDocs} documents...)` to clearly communicate these rules to users.

### 2. [OffscreenSharePortal.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/announcement-qa/OffscreenSharePortal.tsx)
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

### 3. [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx) and [AnnouncementsScroll.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/AnnouncementsScroll.tsx)
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
* **Upload Source Selector:** Tap the upload area on a mobile device (or responsive developer mode) and verify the blurred, native-looking bottom sheet slides up with options for Camera (coral-red), Gallery (emerald-green), and Document (accent-blue). Ensure clicking them triggers the correct native input.
* **Upload Limits:**
  * Try uploading 6 PDF files and verify that the 6th is rejected with `"Maximum of 5 documents allowed."`
  * Try uploading 21 image files and verify that the 21st is rejected with `"Maximum of 20 images allowed."`
  * Verify the UI label correctly states `Max 20 images, 5 documents`.
* **Notice Card Capture:** Click "Share as ClassHub Notice Card" and verify the generated card image contains the circular `/app_icon.svg` without a box frame, dynamic section details, absolute timestamp, and the dynamic bento grid collage.
* **Direct Image Sharing:** Verify that clicking "Share Original Photos Directly" fetches the selected images and launches the native share sheet on mobile devices. Verify fallback sequential download triggers on desktop.

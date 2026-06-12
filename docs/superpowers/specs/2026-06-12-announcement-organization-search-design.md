# Design Specification: Announcement Organization & Search Improvements

## 1. Overview
This design spec addresses the organization and discoverability of notices on the Announcements page of ClassHub. By introducing dynamic subject-based matching, highlighting search terms, adding search filters, and allowing optional announcement descriptions, we improve usability without modifying the backend database schema.

---

## 2. Goals & Success Criteria
*   **Organization**: Allow users to filter announcements by course subjects.
*   **Ease of Findability**: Provide clear visual cues on cards (subject badges, keyword highlighting) and quick toggle filters.
*   **Optimized Search**: Keep recent searches for fast reuse, and make search tools visible when search is active.
*   **Optional Descriptions**: Allow CRs to post notices with only a title (description optional).

---

## 3. Detailed Specifications

### 3.1. Dynamic Subject Matching (Client-Side)
*   **Subjects List**: Fetched on mount via the `useSubjects` React Query hook.
*   **Matching Algorithm (`matchSubject`)**:
    1.  **Explicit Tag**: Check if the message content contains an HTML comment: `<!-- subject_id:(UUID) -->`. If found, match that subject.
    2.  **Acronyms Heuristic**: Generate uppercase acronyms of multi-word subjects (e.g. "Database Management Systems" -> `DBMS`). Check if the title or body contains the acronym as a whole word.
    3.  **Code Heuristic**: Match subject codes flexibly (e.g. `CS-302` matches `cs-302`, `cs302`, or `cs 302`).
    4.  **Short-name Mapping**: Match common variations (e.g. "Maths", "Chemistry", "Physics", "Graphics" mapping to corresponding subject names).
*   **Card UI**:
    *   Prepend a colored badge containing the subject code (e.g., `DBMS`) to the announcement title.
    *   Style the badge with a soft 10% opacity background of the subject's accent color, matching borders, and bold text.

### 3.2. Create Announcement Composer Updates
*   **Optional Description**:
    *   Change client-side validation to only check `title.trim()`. The body (`message`) is optional.
    *   If empty, it saves as `""` (empty string) to prevent database null errors.
    *   Change label from `Message *` to `Message (Optional)`.
*   **Optional Dropdown**:
    *   Add an optional "Link Subject" dropdown selector.
    *   If a subject is selected, append `\n<!-- subject_id:${selectedSubjectId} -->` to the end of the message string during upload.

### 3.3. Expanded Search Panel & Quick Filters
When search is active (`showSearch` is true or search input is focused), slide down a sub-header panel containing:
1.  **Recent Searches**: Row of clickable text buttons for the last 3-5 searches (saved in `localStorage`).
2.  **Filter by Subject**: Horizontal scrollable list of subject pills styled with their respective accent colors.
3.  **Quick Filters**:
    *   `📎 Has Attachment` (only shows announcements with attached files/images).
    *   `⚡ Unacknowledged` (only shows announcements that are not acknowledged yet).

### 3.4. Keyword Highlighting (`HighlightText`)
*   Create a component to dynamically split text on search query matches (case-insensitive).
*   Wrap matching segments in a styled `<mark>` tag:
    ```tsx
    <mark style={{ backgroundColor: 'rgba(99, 102, 241, 0.3)', color: 'var(--accent-primary)', borderRadius: '2px', padding: '0 2px' }}>
      {match}
    </mark>
    ```

---

## 4. Verification Plan

### Manual Verification
1.  **Post Optional Description**:
    *   Verify you can post an announcement with just a title and no message text.
    *   Verify the card renders correctly without an empty description block.
2.  **Subject Matching**:
    *   Post a notice selecting a subject from the dropdown. Verify it has the correct color badge in front of the title.
    *   Post a notice without using the dropdown but mentioning "Maths" or "DBMS" in the text. Verify the heuristic successfully tags it with the correct subject.
3.  **Search Features**:
    *   Type in the search bar. Verify matching letters are highlighted in both the title and body.
    *   Perform a search, reload, and verify the term appears in the "Recent Searches" panel.
    *   Tap the "Has Attachment" or "Unacknowledged" chips. Verify the feed filters correctly.

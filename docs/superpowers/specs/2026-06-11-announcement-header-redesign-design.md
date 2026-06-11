# Announcement Header Redesign Design Spec

Streamline the Announcements page header by replacing the crowded horizontal tabs with a premium dropdown selector on Row 2, providing a spacious and balanced layout for action controls using Radix UI.

## User Review Required

> [!IMPORTANT]
> - The 4 horizontal scrolling tabs (`Active Feed`, `Exams`, `Schedule`, `Campus`) on Row 2 will be consolidated into a single dropdown trigger button.
> - The Category Selector, Sort selector, and Priority Filter will all use Radix UI's accessible `DropdownMenu` primitives, removing custom click-outside state hooks and refs.
> - The spacing between right-aligned action buttons on Row 2 will be increased to a spacious `16px` for touch target comfort and visual balance.

## Proposed Changes

### Pages Layer

#### [MODIFY] [AnnouncementsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AnnouncementsPage.tsx)
- **Row 1**:
  - Keep `[Back] Announcements` title on the left and the `[Polls]` button on the right.
- **Row 2**:
  - **Left Side**: Implement a **Category Dropdown Selector** using Radix UI's `DropdownMenu`.
    - Trigger button displays the active tab's icon, text label (e.g., "Active Feed"), and a `<ChevronDown size={14} />` icon.
    - Menu displays all 4 tabs (`Active Feed`, `Exams`, `Schedule`, `Campus`) with their respective icons, an active checkmark indicator on the right of the active option, and critical unread count badges.
  - **Right Side**: Clean up the actions container.
    - Align `[Search]`, `[Sort]`, `[Filter]`, `[Layout]` controls on the right.
    - Use a flex layout with `gap: 16px` (or `gap-4`) to make the buttons spacious.
    - Migrate the Sort and Priority dropdown menus to Radix UI's `DropdownMenu` component (or its Radix primitives) to match the category dropdown styling and get keyboard accessibility, animations, and boundary auto-positioning for free.
    - Remove the document event listeners for click-outside and `sortContainerRef` / `priorityContainerRef` refs, since Radix UI handles popover state and click-outside dismissal internally.

## Verification Plan

### Automated Tests
- Run `npm test` to ensure page navigation, filters, sorting, and other functional states remain perfectly green (116 tests).
- Run `npm run build` to verify the codebase compiles without any TypeScript or bundling issues.

### Manual Verification
- Deploy changes to local dev server (`npm run dev`).
- Open the Announcements page.
- Verify Row 1 contains the title and Polls button.
- Verify Row 2 displays the active category on the left with a dropdown chevron.
- Open the category dropdown: select another category, verify the feed updates, the dropdown closes, and the trigger button updates its icon and text.
- Verify the action buttons on the right are aligned and spaced out comfortably.
- Verify all dropdowns dismiss automatically when clicking outside or pressing the `Escape` key.

# Bottom Sheet Unification & Polish Design

Introduce a unified, premium bottom sheet framework across ClassHub. This design addresses interactive gestures (drag-to-dismiss), styling inconsistencies (glassmorphic vs solid charcoal), exit transitions (deferred unmounting), and layout alignment (desktop center constraint).

## User Review Required

> [!IMPORTANT]
> Parent components will be refactored to replace conditional rendering (e.g., `{isOpen && <BottomSheet />}`) with the `open` prop (e.g., `<BottomSheet open={isOpen} />`). This is necessary to keep the component mounted while the exit transitions run.

## Proposed Changes

### Core Component

#### [MODIFY] [BottomSheet.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/BottomSheet.tsx)
- Redesign the rendering lifecycle using an internal `shouldRender` state that stays `true` while the `isExiting` transition runs (~240ms).
- Add velocity (`velocityRef.current > 0.4` and `deltaY > 30`) and displacement (`deltaY > 100`) checks to drag-to-dismiss gesture tracking. If the drag release is below the threshold, smoothly snap the sheet back up to its open state.
- Update DOM output to apply transition classes (`active` / `exiting`) instead of triggering instant unmounting.

### Styling System

#### [MODIFY] [index.css](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/index.css)
- Replace `.sheet-backdrop` and `.sheet-panel` glassmorphism and animation settings with the new solid charcoal styling:
  - Background: `linear-gradient(180deg, rgba(18, 18, 22, 0.98) 0%, rgba(10, 10, 12, 1) 100%)` (prevents background clashing).
  - Border-top: `1px solid rgba(255, 255, 255, 0.08)`.
  - Border-radius: `24px 24px 0 0`.
  - Max-height: `85vh`.
  - Layout: `max-width: var(--frame-w)` and centered (`left: 50%; transform: translate3d(-50%, 100%, 0)`) to align perfectly inside the centered PWA mobile frame on desktop.
- Clean up duplicate `.bottom-sheet-drawer` and `.drawer-backdrop` styles.

### Component Re-integration

#### [MODIFY] [AnnouncementsScroll.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/AnnouncementsScroll.tsx)
- Remove custom backdrop/drawer markup and replace it with the unified `<BottomSheet open={Boolean(selectedAnn)} onClose={() => setSelectedAnn(null)} ...>` component.

#### [MODIFY] Parent Sheets and Pages
Refactor parent sheets/pages to use `open` props consistently:
- [SchedulePage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/SchedulePage.tsx)
- [ManageSubjectsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ManageSubjectsPage.tsx)
- [CRCommandPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/CRCommandPage.tsx)
- [AddTagSheet.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/AddTagSheet.tsx)
- [AcksTrackingSheet.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/AcksTrackingSheet.tsx)
- [AnnouncementCommentsDrawer.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/components/announcement-qa/AnnouncementCommentsDrawer.tsx)
- [NotificationSheet.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/NotificationSheet.tsx)

## Verification Plan

### Manual Verification
- Deploy changes to local dev server (`npm run dev`).
- Open a bottom sheet, drag it down slightly, and release it: verify it snaps back open smoothly.
- Drag down quickly or past the 100px threshold: verify it slides down to dismiss.
- Click the backdrop or action buttons: verify the sheet slides down and backdrop fades out over 240ms before unmounting.
- Verify bottom sheet widths on desktop are constrained correctly to the center mobile frame (480px width).

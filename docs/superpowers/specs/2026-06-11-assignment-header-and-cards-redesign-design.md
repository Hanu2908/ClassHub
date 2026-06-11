# Assignment Header & Cards Redesign Design Spec

Streamline the Assignments page header by consolidating status and subject filters into premium dropdown selectors on Row 2 using Radix UI, removing the Row 3 subject scrolling list, and improving the visual balance, spacing, the curated subject gradients, and the interactive states of the assignment cards.

## User Review Required

> [!IMPORTANT]
> - The horizontal scrolling status tabs on Row 2 will be replaced with a single Radix UI `DropdownMenu` trigger.
> - The swipeable Subject Scroller on Row 3 will be replaced by a scrollable Radix UI `DropdownMenu` selector on Row 2, saving significant vertical space.
> - The duplicate random HSL color generators for subject gradients will be refactored into a single, curated set of 6 premium theme-harmonious gradients in the centralized utility file.
> - Card interactive transitions (active scale feedback) and CR edit/delete touch targets (expanded hit area) will be standardized for premium mobile feel.

## Proposed Changes

### Core Utils Layer

#### [MODIFY] [utils.ts](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/lib/utils.ts)
- Add and export a centralized `generateGradient` function:
  ```typescript
  export function generateGradient(str: string): string {
    if (!str) return 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)', // Violet-to-Indigo
      'linear-gradient(135deg, #2dd4bf 0%, #10b981 100%)', // Teal-to-Emerald
      'linear-gradient(135deg, #fb923c 0%, #ef4444 100%)', // Orange-to-Red
      'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue-to-Cyan
      'linear-gradient(135deg, #f472b6 0%, #f43f5e 100%)', // Pink-to-Rose
      'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // Amber-to-Yellow
    ];
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }
  ```

### Pages & Sub-Components Layer

#### [MODIFY] [AssignmentsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/AssignmentsPage.tsx)
- Import `generateGradient` from `../../lib/utils` instead of defining it locally.
- **Header Structure**:
  - **Row 1**: Keep `[Back] Assignments` title.
  - **Row 2**:
    - **Left**: Status filter using Radix UI `DropdownMenu`. Trigger button displays the active status filter (`All`, `Pending`, `Submitted`, or `Overdue`) with a chevron down icon.
    - **Right**:
      - **Subject Dropdown**: A Radix UI `DropdownMenu` displaying `Subject: [Active Subject Name]`. Selectors open a scrollable dropdown listing all unique subjects with count badges.
      - **Sort Dropdown**: Migrate to Radix UI `DropdownMenu` displaying `Sort: [Due/Created]`.
  - **Row 3**: Completely remove the Horizontal Subject Scroller.
- **Card Refinement**:
  - Main header displays the Subject Name, styled with a single line limit (`truncate`) so long names do not wrap, and increase its bottom margin (`marginBottom: 6`).
  - CR Action container has spacing of `gap: 12px`.
  - Edit/Delete buttons are sized to `40×40px` for clear touch target compliance, containing their SVG icons.
  - Personalization banner (`hasSets`) is styled with `background: 'rgba(255, 171, 64, 0.03)'`, `border: '1px solid rgba(255, 171, 64, 0.15)'`, `backdrop-filter: 'blur(8px)'`, and standard `padding: '16px'` without a left accent stripe.
  - "Mark as Submitted" button is updated with Tailwind transition classes `active:scale-[0.98] transition-transform duration-150`.

#### [MODIFY] [ExamsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ExamsPage.tsx)
- Remove local `generateGradient` definition and import it from `../../lib/utils`.

#### [MODIFY] [ManageSubjectsPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ManageSubjectsPage.tsx)
- Remove local `generateGradient` definition and import it from `../../lib/utils`.

#### [MODIFY] [DashboardPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/DashboardPage.tsx)
- Remove local `generateGradient` definition and import it from `../../lib/utils`.

#### [MODIFY] [AssignmentsScroll.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/dashboard/AssignmentsScroll.tsx)
- Remove local `generateGradient` definition and import it from `../../../lib/utils`.

## Verification Plan

### Automated Tests
- Run `npm test` to verify that routing, filters, sorting, and user-roll assignments tests are fully green.
- Run `npm run build` to ensure compilation is clean.

### Manual Verification
- Deploy to local dev server (`npm run dev`).
- Open the Assignments Page.
- Verify that the dropdowns for status filter, subject selection, and sorting function correctly and click-outside dismissal behaves properly.
- Verify that subject acronym circles render using the new premium mapped gradients.
- Confirm the card layout is balanced, edit/delete actions are spaced out, and the personalization banner looks premium.
- Press the "Mark as Submitted" button and verify the scale-down press feedback.

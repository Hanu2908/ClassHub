# Spec: CR Command Center Mobile Polish

Visual and structural refinement spec for the collapsible panels inside the CR Command Center.

## Status: Approved
*   **Author:** Antigravity (AI Architect)
*   **Date:** 2026-05-22
*   **Target Page:** `src/pages/app/CRCommandPage.tsx`
*   **Approval Status:** Approved by Himanshu Saini (PM)

---

## 1. Context & Problem Statement

Currently, when the two principal list containers—**Submission Tracker** and **Section Members**—are collapsed on mobile screens, they suffer from three primary visual layout issues:

1.  **Asymmetric Margin Bleed:** The shared `<SectionHead>` sub-component enforces a hardcoded `marginBottom: 12` style. When collapsed, this bottom margin causes the parent container to extend further down, throwing off the vertical balance and making the closed cards look excessively thick.
2.  **Chevron Misalignment:** The parent trigger uses a vertical center flex row (`alignItems: 'center'`). Because the left column (`<SectionHead>`) contains a 12px bottom margin while the right column (the Chevron icon) does not, the Chevron aligns itself with the center of the *stretched* flex height, causing a visible vertical misalignment relative to the title text.
3.  **Visual Friction:** There is no distinct hover/active touch highlight state on the trigger rows, and no horizontal divider separating the trigger from the scrollable list when expanded.

---

## 2. Proposed Changes

### Component: `SectionHead`
*   **File:** [CRCommandPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/CRCommandPage.tsx)
*   **Change:** Remove the hardcoded `marginBottom: 12` from the outer `div` inside `SectionHead`. Instead, let `SectionHead` maintain `marginBottom: 0` so it remains a pure, centered row block.

### Component: `SubmissionTracker` & `ClassAttendance`
*   **File:** [CRCommandPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/CRCommandPage.tsx)
*   **Changes:**
    1.  Add `style={{ padding: 0 }}` to the outer card containers (`<div className="card">`) to allow full edge-to-edge styling controls.
    2.  Wrap the header triggers in a container styled with `padding: '14px 16px'`, `display: 'flex'`, `alignItems: 'center'`, and `justifyContent: 'space-between'`.
    3.  Apply an interactive class (or dynamic background highlight like `var(--bg-elevated)` on tap) to provide premium tactile feedback on mobile touches.
    4.  When expanded, render a thin separator (`borderTop: '1px solid var(--border-default)'`) followed by the content container wrapped in `padding: '16px'` (or appropriate internal scroll container paddings).

---

## 3. Verification & Polish Plan

### Manual Verification
*   **Layout Centering:** Confirm that the day badge, title text, and expand/collapse chevrons are perfectly vertically centered relative to each other when collapsed.
*   **Vertical Height Savings:** Verify that collapsed cards occupy ~60px of height instead of ~90px, saving ~60px of cumulative vertical space on load.
*   **Tactile Active Feedbacks:** Test tapping the header rows in mobile dev-tools to verify the press/hover backgrounds.

### Automated Checks
*   Run `npm run build` to guarantee compilation integrity.
*   Run `npm run lint` to audit lint purity.

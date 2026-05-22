# Design Spec: High-Contrast Announcement Stack & Schedule Gesture Overhaul

- **Author**: Antigravity AI & Himanshu Saini (PM)
- **Status**: APPROVED
- **Date**: 2026-05-22
- **Topic**: Dashboard Announcements Styling, Space Optimization, Schedule Timeline Slider, and Tactile Swipe-to-Delete Class Cards.

---

## 1. Problem Statement
The previous glassmorphic announcement card deck on the main student dashboard suffered from visual text bleed-through and overlap issues due to semi-transparency. Additionally, the announcement block occupied excessive vertical space on mobile screens. 

On the Schedule Page, day-switching via swipe was janky and lacked real-time pointer-tracking visual feedback. Furthermore, the swipe-to-delete class card mechanic for Class Representatives (CRs) was touch-only (failing desktop mouse interactions) and triggered an unpolished default browser `window.confirm` popup, breaking the premium product aesthetic.

---

## 2. Technical Design & Core Pillars

### Column A: Ultra-Compact Opaque Matte Cards (Dashboard)
- **Opaque Backdrop**: Replace glassmorphism with `#111318` (or `var(--bg-elevated)`) having 100% solid opacity. This completely blocks back-card text bleed-through.
- **Visual Boundaries**:
  - **Critical Announcements**: `1px solid rgba(239, 68, 68, 0.45)` with a subtle neon backing shadow.
  - **General Announcements**: `1px solid rgba(74, 158, 255, 0.35)`.
- **Vertical Spacing Optimization**: Reduce visual card height from `160px` to **`124px`**, adjust padding to `12px`, and tighten deck margins.
- **Universal Indicators**: Apply the pulsing neon-pulse unread indicator dot to **all unacknowledged notices** (both general and critical).
- **Auto-Linkifier Engine (Bottom Drawer)**: Run the notice message body inside the detail sheet through a regex linkifier:
  ```typescript
  function linkify(text: string): React.ReactNode[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Converts text blocks and wraps URLs in secure styled anchor tags
  }
  ```

---

## 3. Column B: Real-Time Day-Switching timeline Slider (Schedule)
- **Coordinate Drag Mechanics**: Add pointer listeners (`onPointerDown`, `onPointerMove`, `onPointerUp`) to track real-time pointer coordinates (`deltaX`).
- **Physical Timeline Sliding**: The active day's `.schedule-timeline` physically shifts horizontally following drag offsets (`transform: translateX(deltaX)`) with high-performance CSS transition overrides during drags.
- **Intertia & Threshold Snap**:
  - If drag exceeds **`80px`**, release switches the selected day, sliding the old day completely off-screen and sliding the new day's schedule in from the opposite edge.
  - If drag is under **`80px`**, the container springs back cleanly to `0px` with a bounce transition (`transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)`).

---

## 4. Column C: Tactile Swipe-to-Delete (CR Schedule Cards)
- **Pointer Cross-Platform Drag**: Enable pointer events on the schedule cards, allowing both desktop cursor clicks and mobile finger touch drags.
- **Drag-Reveal Trash Layout**: Dragging a card to the left reveals a rich crimson trash background indicator container behind it:
  - Capped translation offset at **`-80px`** to let CRs tap the delete button.
  - Dragging past **`-120px`** automatically fires the deletion drawer event.
- **Custom Bottom Sheet Confirmation**:
  - Replaces `window.confirm` with a beautiful slide-up confirmation sheet displaying card specifics.
  - Features Cancel and Confirmed buttons with animated loading spinners during backend mutations.

---

## 5. Scope & De-risking
- No changes will affect Supabase DB migrations since the schema tables (`announcements`, `acknowledgments`, `schedule_slots`) are fully operational.
- Auto-cleanups of expired deadlines will remain active to prevent data clutter.

# Spec: Dashboard Card Design Consistency & Accessibility Overhaul

This specification outlines the visual design changes to standardize and unify all dashboard widgets, cards, and list rows on the home page into a solid, opaque, and highly readable card system while upgrading muted text color contrast for WCAG AA compliance.

## Problem Statement
The dashboard home page currently lacks design consistency:
- Some widgets use glassmorphic blur with varying transparencies (e.g., Push CTA, Critical Carousel, hero right panel).
- Other widgets use solid backgrounds (e.g., Announcements stack items use `#111318 !important`).
- Several widgets use custom gradients, mismatched inline shadow values, and varying border widths.
- Muted labels (like `75% REQ` or date tags) use color token `#4A5268` which has a `2.3:1` contrast ratio against dark backgrounds, failing WCAG AA accessibility tests (requires `4.5:1` minimum).

---

## Proposed Changes

### 1. Typography & Contrast Upgrade (Accessibility)
We will upgrade the muted text token in `src/index.css` to be WCAG AA compliant against all dark surfaces.
- **Old token:** `var(--text-muted): #4A5268` (2.3:1 contrast - FAIL)
- **New token:** `var(--text-muted): #747C90` (4.52:1 contrast - PASS WCAG AA)

---

### 2. Opaque Card Base & Hover States
We will transition from glassmorphism to a solid, elevated charcoal aesthetic. All dashboard widgets will share uniform border-radius (`16px`), border thickness (`1px`), and identical drop shadows.

```css
/* Base Card */
.card {
  background: #121520; /* 100% Opaque solid dark charcoal */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
  position: relative;
  overflow: hidden;
  transition: 
    transform var(--transition-fast), 
    border-color var(--transition-fast), 
    box-shadow var(--transition-base), 
    background var(--transition-fast);
}

.card:hover {
  background: #171B27;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(96, 165, 250, 0.1);
  transform: translateY(-2px);
}
```

---

### 3. Themed/Colored Opaque Cards (Semantic Tints & Inner Glows)
Specialized widgets will use fully opaque custom backgrounds tinted by category, featuring a soft matching inner-shadow/glow for a tactile, elevated finish.

#### Critical Alerts Carousel
- **Class:** `.card-solid-critical`
- **Styling:** Opaque background `#181316`, border `rgba(248, 113, 113, 0.25)`, drop shadow, and inner glow `inset 0 0 10px rgba(248, 113, 113, 0.06)`.

#### CR Command Station (CR Hub)
- **Class:** `.card-solid-cr`
- **Styling:** Opaque background `#111624`, border `rgba(96, 165, 250, 0.25)`, drop shadow, and inner glow `inset 0 0 10px rgba(96, 165, 250, 0.06)`.

#### Push Permission CTA
- **Class:** `.card-solid-push`
- **Styling:** Opaque background `#111822`, border `rgba(74, 158, 255, 0.25)`, drop shadow, and inner glow `inset 0 0 10px rgba(74, 158, 255, 0.06)`.

#### Attendance Standing Tiers (Academic Hero Left Panel)
- **Classes:** `.attendance-zenith`, `.attendance-gold`, `.attendance-silver`, `.attendance-warned`
- **Styling:** Opaque backgrounds tinted with category colors, matched with custom borders and matching soft inset shadows (e.g., Amethyst `#151220` with purple border for Zenith).

---

### 4. Announcements Stack Opaque Overrides
The overlapping announcement stack items will use opaque styling to prevent text overlaps.
- **Base Announcement Card:** `.card-solid-charcoal` -> background `#121520`.
- **Critical Announcement Card:** `.card-critical-solid` -> background `#181316` (solid red tint), border `rgba(248, 113, 113, 0.25)`, inner glow.
- **General Announcement Card:** `.card-general-solid` -> background `#121520` (solid base), border `rgba(96, 165, 250, 0.25)`, inner glow.

---

### 5. Standardized List Rows
Row elements on the dashboard will use the solid card variables:
- **Class:** `.list-row`
- **Styling:** Opaque background `#121520`, border `1px solid rgba(255, 255, 255, 0.08)`, and interactive hover transitions.

---

## Component Modifications

### `src/pages/app/DashboardPage.tsx`
- Replace inline styles on left panel (Attendance) and right panel (Next Deadline / Next Exam) with CSS classes and standardized CSS properties.
- Remove inline box-shadows, gradients, and border-colors, relying on the class definitions.

### `src/pages/app/dashboard/CriticalAlerts.tsx`
- Apply `.card-solid-critical` to `CriticalCarousel` component.
- Apply `.card-solid-push` to `PushPermissionCTA` component.
- Remove inline custom background gradients and shadows.

### `src/pages/app/dashboard/CRDashboardStation.tsx`
- Apply `.card-solid-cr` to CR hub outer container instead of inline gradients/shadows.

### `src/pages/app/dashboard/ScheduleWidget.tsx`
- Let standard `.card` rule control the schedule widget card backdrop.
- Ensure rows match standard hover properties.

### `src/pages/app/dashboard/AnnouncementsScroll.tsx`
- Ensure stack cards use updated `.card-solid-charcoal`, `.card-critical-solid`, or `.card-general-solid` classes.
- Ensure the details bottom sheet elements utilize the upgraded `--text-muted` contrast value.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify there are no TypeScript compilation errors.
- Run `npm run lint` to verify that there are no style or syntax violations.
- Run `npm test` to verify no regressions in dashboard rendering or state logic.

### Manual Verification
- Inspect the dashboard page visually: verify all widgets align perfectly, share the same corner radius, and use solid opaque colors instead of glassmorphism.
- Hover over each card to verify smooth background color transitions and micro-shadow scale effects.
- Verify that muted text (dates, tags) is fully legible and high contrast.

# Spec: Sleek Deadline & Exam Widget Layout Refinements

This specification outlines the visual design changes to refine the **Next Deadline** and **Next Exam** dashboard widgets to make them look sleeker, more premium, and cohesive with the newly redesigned Attendance widget.

## Design Details

### 1. Typography & Spacing
- Keep the standard horizontal list card structure (no giant numbers on the left).
- **Header Row**:
  - **Left**: Metadata label `NEXT DEADLINE` or `NEXT EXAM` in small `10px var(--font-mono)` style with a muted color (`var(--text-muted)`).
  - **Right**: A lightweight, borderless countdown badge (e.g. `Due Tomorrow`, `Due in 2 days`, or ticking timer for exams) using the matching urgency text color (no colored background container).
- **Body Row**:
  - A clean horizontal flow featuring a Lucide icon (e.g. `ClipboardList` or `MapPin`) in status/urgency color, followed by the Subject name and Title (bold, regular size `14px`, `700` weight).

### 2. Progress Gauge & Whitespace
- **Bottom Row**:
  - An ultra-thin **`3px` linear progress bar** running across the bottom of the card, color-coded by urgency.
  - **Dynamic Scaling Window**: The percentage of the progress bar is calculated dynamically based on the remaining time to keep the bar active and visually meaningful:
    - If remaining time is `> 7 days`: Scale relative to a **14-day** window.
    - If remaining time is `3 to 7 days`: Scale relative to a **7-day** window.
    - If remaining time is `24h to 3 days`: Scale relative to a **3-day** window.
    - If remaining time is `< 24h`: Scale relative to a **24-hour** window.
  - All bottom status/urgency text labels (such as `Approaching` or `Due Soon`) are completely removed to maximize card whitespace and keep it clean.

### 3. Clear State (No Deadlines)
- Replace the `PartyPopper` icon with a simple, clean check icon (e.g. `CheckCircle` or `CheckCircle2` styled in muted green `var(--status-safe)`).
- Centered layout displaying: "You're All Clear!" with a simple message.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify there are no syntax or type checking errors.
- Run `npm run lint` to verify that there are no style or code standard violations.

### Manual Verification
- Review the layout of the Deadline and Exam cards on the dashboard to ensure they are visually balanced and align with the Attendance card.

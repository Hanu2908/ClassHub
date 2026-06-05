# ClassHub Handoff - Dashboard & Section Directory Simplification

This document summarizes the current status of the UI/UX simplification task for ClassHub to reduce visual complexity and user overwhelm.

## Context & Objectives
Students trials reported that the app felt visually complex and overwhelming. We are simplifying the dashboard (Home) and reorganizing navigation paths (relying less on the dashboard as a navigation hub and more as a pure info-glance page).

## Confirmed Dashboard Simplification Decisions
These decisions have been agreed upon by Himanshu:
1. **Header**: Remove the `BETA` badge and the `Polls` shortcut button (`polls-btn`/`BarChart2` icon).
2. **Critical Alerts**: Simplify styling in `CriticalAlerts.tsx`. Remove aggressive blinking/pulsing keyframe animations (like `pulsate-glow` and `pulsate-alert` on hover/pulse) to create a cleaner, static card style.
3. **Attendance Widget (Left Panel)**: 
   - Simplify to only show the circular progress ring, overall percentage, standing name, and class count (e.g., `12/16 classes attended`).
   - Remove the `isSyncOverdue` ERP banner and the diagnostic warning course list accordion drawer. These belong exclusively in the dedicated Attendance page.
4. **Deadline / Next Exam Widget (Right Panel)**: 
   - Remove the bottom "Jump Center" shortcuts row completely from all states (exam, deadlines, and all clear).
   - Keep the clean text/title, icon, thin progress bar, and deadline badge/labels.
5. **Poll Banner**: Remove the active poll widget (`<PollBanner />`) entirely from the dashboard (polls should be accessed via the Notices tab).
6. **Mobile Layout**: Stacking order on mobile remains with the Attendance card on top of the Deadline/Exam card.
7. **No Settings Toggles**: Visual items will be removed directly from the code to avoid settings bloating.
8. **CR Station**: The CR quick action station (`CRDashboardStation`) is kept as-is.

An initial plan was written to `implementation_plan.md` but is paused pending the Section Directory design decision.

## Active Brainstorming: Section Directory Placement
We are currently brainstorming how the **Section Directory** (`/app/members`) should be accessed and displayed (since it is currently only linked when tapping a tag pill from announcement comments). 

Three approaches have been proposed:
- **Approach A**: Add a link under **TOOLS** on the **Profile Page** (CGPA, Exams Hub, Resource Hub, etc.).
- **Approach B**: Display the directory in a slide-up **Bottom Sheet** on the Profile Page.
- **Approach C**: Make the **Section** row under **HUB INFO** clickable to navigate to `/app/members`.

We are awaiting the user's feedback/choice on these approaches.

## Suggested Skills for the Next Agent
- `brainstorming` (e:\HIMANSHU\1ST_YEAR_Project\ClassHub-1\.agents\skills\brainstorming\SKILL.md) - to finalize the Section Directory navigation design.
- `writing-plans` (e:\HIMANSHU\1ST_YEAR_Project\ClassHub-1\.agents\skills\writing-plans\SKILL.md) - to generate the final approved implementation plan.
- `frontend-design` (e:\HIMANSHU\1ST_YEAR_Project\ClassHub-1\.agents\skills\frontend-design\SKILL.md) - to implement the dashboard styling and layout changes.
- `vibe-security` - to ensure no security or RLS regressions are introduced.

## References
- Active dashboard page: [DashboardPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/DashboardPage.tsx)
- Directory page: [SectionDirectoryPage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/SectionDirectoryPage.tsx)
- Profile page: [ProfilePage.tsx](file:///e:/HIMANSHU/1ST_YEAR_Project/ClassHub-1/src/pages/app/ProfilePage.tsx)
- Active plan: [implementation_plan.md](file:///C:/Users/Priyanshu%20Saini/.gemini/antigravity-ide/brain/3494b330-5587-4f32-a419-9ce80e1c388a/implementation_plan.md)

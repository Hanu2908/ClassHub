# ClassHub — Antigravity Frontend Build Prompt
### Complete Frontend Specification: Design · Logic · Pages · Interactions
**Version:** 1.0 | **Target:** PWA, Mobile-First (375px base) | **Stack:** React + Vite + CSS Variables (no Tailwind, no Bootstrap)

---

## 0. MASTER CONTEXT (Read before writing a single line)

You are building **ClassHub** — a mobile-first PWA for college students in Section P2, SKIT Jaipur. Think of it as a **super-charged class WhatsApp group** that actually works: announcements with accountability, smart assignment sets, attendance prediction, polls, and timetable — all in one dark, sleek app.

**Persona you are designing for:**
- 19-year-old engineering student. Opens app first thing in the morning to check "what's due today, can I bunk, what did CR post?"
- Wants instant, scannable info. Zero tolerance for friction.
- Two roles exist: **Student** (read + submit) and **CR/Admin** (read + write + manage). All UI must be role-aware — CR creation buttons are completely invisible to students.

---

## 1. DESIGN SYSTEM

### 1.1 Aesthetic Direction
**"Dark Academic Control Room"** — Deep navy/charcoal backgrounds, precise neon-accent highlights (electric blue for primary, amber for warnings, crimson for critical), crisp geometric layout with card-based modularity. Think: Bloomberg Terminal meets a premium student planner. Dense but not cluttered. Every pixel earns its place.

### 1.2 Color Tokens (CSS Variables)
```css
:root {
  /* Backgrounds */
  --bg-base: #0D0F14;          /* deepest background */
  --bg-surface: #141720;       /* card/panel background */
  --bg-elevated: #1C2030;      /* elevated cards, modals */
  --bg-overlay: #242840;       /* tooltips, dropdowns */

  /* Primary Accent — Electric Blue */
  --accent-primary: #4A9EFF;
  --accent-primary-glow: rgba(74, 158, 255, 0.20);
  --accent-primary-muted: #1E3A5F;

  /* Status Colors */
  --status-critical: #FF4444;
  --status-critical-bg: rgba(255, 68, 68, 0.12);
  --status-warning: #FFB547;
  --status-warning-bg: rgba(255, 181, 71, 0.12);
  --status-safe: #34C97B;
  --status-safe-bg: rgba(52, 201, 123, 0.12);
  --status-info: #4A9EFF;
  --status-info-bg: rgba(74, 158, 255, 0.10);

  /* Announcements: deadline states */
  --ann-overdue: #FF4444;       /* due today or tomorrow */
  --ann-soon: #FFB547;          /* within 3 days */
  --ann-safe: #34C97B;          /* time to go */
  --ann-info: #4A9EFF;          /* no deadline */

  /* Text */
  --text-primary: #F0F2F8;
  --text-secondary: #8B93A8;
  --text-muted: #4A5268;
  --text-accent: #4A9EFF;

  /* Borders */
  --border-default: rgba(255,255,255,0.07);
  --border-active: rgba(74, 158, 255, 0.40);

  /* Shadows */
  --shadow-card: 0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-blue: 0 0 20px rgba(74, 158, 255, 0.15);
  --shadow-glow-red: 0 0 20px rgba(255, 68, 68, 0.20);

  /* Spacing Scale (8px base) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px; --space-12: 48px;

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 100px;

  /* Typography */
  --font-display: 'Space Grotesk', sans-serif; /* headings */
  --font-body: 'DM Sans', sans-serif;           /* body */
  --font-mono: 'JetBrains Mono', monospace;     /* codes, rolls */

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 1.3 Typography Scale
```css
/* Display — Page titles */
.text-display   { font: 700 28px/1.2 var(--font-display); letter-spacing: -0.5px; }
/* Heading — Section titles */
.text-heading   { font: 600 20px/1.3 var(--font-display); }
/* Subheading — Card titles */
.text-subhead   { font: 600 16px/1.4 var(--font-body); }
/* Body — Default content */
.text-body      { font: 400 14px/1.6 var(--font-body); }
/* Small — Labels, captions */
.text-small     { font: 400 12px/1.5 var(--font-body); }
/* Micro — Timestamps, codes */
.text-micro     { font: 500 11px/1.4 var(--font-mono); letter-spacing: 0.3px; }
```

### 1.4 Component Primitives

**Card:**
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.card:active { transform: scale(0.98); border-color: var(--border-active); }
```

**Pill Badge:**
```css
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
         border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; }
.badge-critical { background: var(--status-critical-bg); color: var(--status-critical); }
.badge-warning  { background: var(--status-warning-bg);  color: var(--status-warning); }
.badge-safe     { background: var(--status-safe-bg);     color: var(--status-safe); }
.badge-info     { background: var(--status-info-bg);     color: var(--status-info); }
```

**Input Field:**
```css
.input {
  width: 100%; padding: 14px 16px; background: var(--bg-elevated);
  border: 1.5px solid var(--border-default); border-radius: var(--radius-md);
  color: var(--text-primary); font: 400 15px var(--font-body);
  transition: border-color var(--transition-fast);
  outline: none;
}
.input:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--accent-primary-glow); }
```

**Button Primary:**
```css
.btn-primary {
  width: 100%; padding: 15px; background: var(--accent-primary);
  color: #fff; border: none; border-radius: var(--radius-md);
  font: 600 15px var(--font-body); cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  box-shadow: 0 4px 16px rgba(74,158,255,0.3);
}
.btn-primary:active { opacity: 0.85; transform: scale(0.98); }
```

### 1.5 Motion Principles
- Use `@keyframes fadeSlideUp` for page/card enter animations (translate Y 16px → 0, opacity 0 → 1, 350ms cubic-bezier(0.16,1,0.3,1))
- Stagger list items with `animation-delay: calc(var(--i) * 60ms)`
- Critical banner: pulse glow animation `box-shadow` cycling on 2s loop
- Tab bar active indicator: sliding pill underline with `transition: left 250ms cubic-bezier(0.16,1,0.3,1)`
- Page transitions: outgoing page slides left (translateX -20px, opacity → 0), incoming page slides in from right (translateX 20px → 0)
- All interactive elements: scale(0.97) on `:active` via `transition: transform 150ms ease`
- Attendance progress rings: SVG `stroke-dashoffset` animated on mount (600ms ease-out)
- Horizontal scroll carousels: momentum scroll via `-webkit-overflow-scrolling: touch`, `scroll-snap-type: x mandatory`

---

## 2. APP ARCHITECTURE & ROUTING

### 2.1 Route Map
```
/login                    → LoginPage (always public)
/onboarding               → OnboardingPage (first-time user only, redirect after join/create)
  └── /onboarding/choice  → JoinOrCreate screen
  └── /onboarding/join    → JoinHub form (student)
  └── /onboarding/create  → CreateHub form (CR)

/app                      → Shell with bottom NavBar (role-aware)
  ├── /app/home           → Dashboard (student) / CR Dashboard (cr)
  ├── /app/schedule       → SchedulePage
  ├── /app/polls          → PollsPage
  ├── /app/assignments    → AssignmentsPage
  └── /app/profile        → ProfilePage

/app/announcements        → AnnouncementsPage (full feed)
/app/attendance           → AttendancePage (paste + predictor)
```

### 2.2 Global State Shape (useContext / Zustand store)
```javascript
AppState = {
  auth: {
    user: { id, name, email, avatarUrl },
    role: 'student' | 'cr',        // drives ALL conditional UI
    isFirstTime: boolean,
  },
  hub: {
    hubCode: 'P2WXYZ',
    section: 'P2',
    hubName: 'Section P2',
    classRoll: '17',               // 2-digit class roll
    universityRoll: '25ESKCX089',  // alphanumeric university roll
  },
  attendance: {                    // parsed from ERP paste
    subjects: [
      { code, name, type, present, od, makeup, absent, percentage,
        canSkip, needToAttend }     // computed
    ],
    overallPercentage: number,
    lastUpdated: timestamp,
  },
  ui: {
    activeTab: 'home' | 'schedule' | 'polls' | 'profile',
    criticalAnnouncement: AnnouncementObject | null,  // pinned globally
  }
}
```

### 2.3 Role Guard Logic
```javascript
// Wrap CR-only components:
const CROnly = ({ children }) => {
  const { role } = useAuth();
  return role === 'cr' ? children : null;
};
// Never render, never show placeholder — CR sections are invisible to students.
```

### 2.4 Hub Code Logic
- Format: `[SECTION_PREFIX][4_RANDOM_ALPHA]` — e.g. `P2WXYZ`
  - First 2 chars = section prefix (e.g. `P2`)
  - Last 4 chars = random uppercase alphabets (generated on hub creation)
- Input validation regex: `/^[A-Z0-9]{2}[A-Z]{4}$/`
- On joining: extract section from first 2 chars, store full code in hub state
- On creating: generate 4 random letters, prefix with section code entered by CR, display generated code prominently for sharing

### 2.5 Roll Number Validations
```javascript
// Class Roll: exactly 2 digits
const classRollRegex = /^\d{2}$/;

// University Roll: alphanumeric, format like 25ESKCX089
// 2 digits + letters + digits, 8-12 chars
const uniRollRegex = /^[0-9]{2}[A-Z]{2,5}[0-9]{3,5}$/;
```

---

## 3. PAGE SPECIFICATIONS

---

### PAGE 1: LOGIN PAGE
**(Pre-built by developer — reference only for flow)**

**Flow:**
1. Google OAuth button (locked to `@skit.ac.in`)
2. On success → check if `hub_code` exists in user profile
3. If no hub → redirect to `/onboarding/choice`
4. If hub exists → redirect to `/app/home`

---

### PAGE 2: ONBOARDING — CHOICE SCREEN (`/onboarding/choice`)

**Layout:**
- Full-screen centered. App logo + name at top (30% height)
- Tagline: *"Your section, organized."*
- Two large cards below (60% height), stacked vertically:
  - **Join a Hub** — icon: door-enter — for students
  - **Create a Hub** — icon: plus-circle — for CR/admin
- Each card: icon (32px), bold title, subtitle line, chevron right
- Soft gradient background mesh behind cards

**Interactions:**
- Card tap → navigate to respective form
- Entrance animation: logo fades in (0ms), cards stagger in from bottom (200ms, 350ms)

---

### PAGE 3: ONBOARDING — JOIN HUB (`/onboarding/join`)

**Layout (single scrollable screen, no pagination):**
```
[Back Arrow]          Join a Hub
─────────────────────────────────
                  [Lock icon]
          "Enter your hub details"
     "Get the code from your Class Rep"

  Hub Code *
  [_ _ _ _ _ _]   ← 6-char input, monospace, uppercase auto
  "e.g. P2WXYZ — get this from your CR"

  Class Roll Number *
  [__]              ← 2-digit only, numeric keyboard
  "Your 2-digit class roll (e.g. 17)"

  University Roll Number *
  [__________]      ← alphanumeric, uppercase auto
  "e.g. 25ESKCX089"

  [         Join Hub          ]   ← primary button

  ─────────── Validation errors inline below each field ───────────
```

**Validation Logic (real-time on blur, final on submit):**
- Hub Code: 6 chars, format P2XXXX. Show error: "Enter a valid 6-character hub code"
- Class Roll: exactly 2 digits. Error: "Class roll must be 2 digits (01–99)"
- Uni Roll: match regex. Error: "Enter a valid university roll (e.g. 25ESKCX089)"

**Submit Logic:**
- Show loading spinner in button
- Mock API: store in localStorage `classHub_user` JSON
- Set role = 'student' (hub code match gives role; CR creates hub so they get role='cr')
- On success → navigate to `/app/home` with `isFirstTime = true` (show welcome toast)

**Hub Code field UX:**
- Auto-uppercase all input
- 6 character max, monospace display
- Each char box subtle — or single input with letter-spacing trick

---

### PAGE 4: ONBOARDING — CREATE HUB (`/onboarding/create`)

**Layout:**
```
[Back Arrow]          Create a Hub

  Section Code *
  [P2]              ← editable, 2 chars, uppercase
  "e.g. P2, A3, CS1"

  Hub Name *
  [Section P2 — SKIT]

  Your Name *
  [______________]

  Class Roll Number *
  [__]

  University Roll Number *
  [__________]

  [        Create Hub         ]

  ────── After submit ──────
  ┌──────────────────────────────┐
  │  🎉  Hub Created!            │
  │                              │
  │  Your Hub Code:              │
  │  ┌────────────────────────┐  │
  │  │   P 2 W X Y Z          │  │  ← monospace, big, copyable
  │  └────────────────────────┘  │
  │  [Copy Code]  [Share Code]   │
  │                              │
  │  Share this with students    │
  │  to invite them to your hub. │
  │                              │
  │  [  Go to Dashboard  ]       │
  └──────────────────────────────┘
```

**Logic:**
- Generate hub code: `sectionPrefix.toUpperCase() + randomAlpha(4)`
- `randomAlpha(4)`: `Array.from({length:4}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]).join('')`
- Store hub in localStorage, set role = 'cr'
- Display generated code in large monospace with copy-to-clipboard button
- Share button: Web Share API → fallback to clipboard

---

### PAGE 5: DASHBOARD — HOME (`/app/home`)

**Full layout (top to bottom, single scroll):**

---

#### 5.1 Top Header Bar
```
Hey, Priyanshu 👋          [🔔]  [💬]
```
- Left: "Hey, [FirstName]" in `text-heading`, 👋 emoji
- Right: Bell icon (notification dot if unread), Chat/Notice icon (goes to `/app/announcements`)
- Both icons: 40px tap target, icon inside 24px

---

#### 5.2 Critical Announcement Banner
**Only shown when `criticalAnnouncement !== null`**
```
┌──────────────────────────────────────────┐
│ ⚠  Critical Alert                         >  │
│   [Announcement title, 1 line truncate]       │
│   [subtitle/brief, 1 line]                    │
└──────────────────────────────────────────┘
```
- Background: `var(--status-critical-bg)`, left border: 3px solid `var(--status-critical)`
- Pulsing glow animation on box-shadow (2s infinite)
- Full width, tap → navigate to `/app/announcements` with critical ID highlighted
- Non-dismissible
- Icon: warning triangle in `var(--status-critical)`

---

#### 5.3 Today's Schedule Widget
```
Today's Schedule                           >
──────────────────────────────────────────
  09:00 AM  •  Operating Systems         [NOW]
            CS-304 • Block B

  11:00 AM  •  Database Lab            in 2hrs
            CS-318 • Lab 2
```
- Section title left, `>` chevron right → navigates to `/app/schedule`
- Show ONLY 2 classes: current (or next upcoming) + the one after it
- "NOW" badge: `var(--accent-primary)` bg, white text, animated subtle pulse
- "in Xhrs" text: `var(--text-secondary)` — calculated from current time
- If no class today: show "No classes scheduled today 🎉"
- Left dot color: green if NOW, blue if upcoming

**Time logic:**
```javascript
const getScheduleDisplay = (classes, now) => {
  const current = classes.find(c => c.startTime <= now && c.endTime >= now);
  const upcoming = classes.filter(c => c.startTime > now).sort(...);
  if (current) return [current, upcoming[0]].filter(Boolean);
  return upcoming.slice(0, 2);
};
const hoursUntil = (classTime, now) => {
  const diff = classTime - now;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;
};
```

---

#### 5.4 Attendance Overview
```
Attendance             This week ▾
──────────────────────────────────
[ Overall ]  [ DBMS ]  [ OS Lab ]  [ Math ]  → horizontal scroll
  92%          88%        75%         82%
```
- Horizontal scroll row of pill cards (scroll-snap)
- **First pill: "Overall"** — average across all subjects
- Each pill: subject code (abbreviated), donut/arc progress ring (SVG), percentage
- Color: green ≥75%, amber 65-74%, red <65%
- Tap any pill → navigates to `/app/attendance` with that subject focused
- Pills: `min-width: 90px`, card style, snap-to

---

#### 5.5 Announcements
```
Announcements                        View all >
──────────────────────────────────────────────
← horizontal scroll cards →

┌──────────────────┐  ┌──────────────────┐
│ 📣  DBMS Project  │  │ 📣  OS Lab Report │
│ Due today!        │  │ Due tomorrow      │
│ Submit by 6:00 PM │  │ Lab manual req.   │
│ [Due Today]       │  │ [Tomorrow]        │
└──────────────────┘  └──────────────────┘
```
- Cards slightly larger than assignment cards (160×140px min)
- Color coding:
  - **No deadline / general**: `--ann-info` blue tinted card border
  - **Due today or tomorrow**: `--ann-overdue` red tinted card border + badge
  - **Due in 2-3 days**: `--ann-soon` amber tinted
  - **Safe (4+ days)**: `--ann-safe` green tinted
- Each card: icon, title (2 lines max), brief (2 lines, truncate), deadline badge
- Tap card → open announcement detail modal (bottom sheet)
- Horizontal scroll, snap

---

#### 5.6 Active Poll Banner
```
Campus Poll              Closes in 2d 14h  >
──────────────────────────────────────────
Should campus network be upgraded to Wi-Fi 6E?

████████████████░░░░  Yes  68%  (342)
████████░░░░░░░░░░░░  No   32%  (161)

503 students voted           [Go to Polls →]
```
- Shows the **most recent active poll** only
- Two bars (highest voted first), animated fill on mount
- `>` navigates to `/app/polls`
- If no active poll: hide section entirely

---

#### 5.7 Assignments
```
Assignments                           View all >
────────────────────────────────────────────────
← horizontal scroll cards (same as reference) →

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ [DBMS icon]  │  │ [OS icon]    │  │ [AI icon]    │
│ DBMS Assign. │  │ OS Lab Report│  │ AI Project   │
│ Due today    │  │ Due tomorrow │  │ Due May 24   │
│ [Due Today]  │  │ [Upcoming]   │  │ [Submitted]  │
└──────────────┘  └──────────────┘  └──────────────┘
```
- 3 status badges: "Due Today" (red), "Upcoming" (blue), "Submitted" (green)
- Horizontal scroll, snap
- Tap → open assignment detail bottom sheet

---

#### 5.8 Bottom padding
- 80px padding-bottom to clear the fixed navbar

---

### PAGE 6: SCHEDULE PAGE (`/app/schedule`)

**Layout:**
```
← Schedule          [Week selector: Mon Tue Wed Thu Fri Sat]

Today — Wednesday, 14 May

09:00 AM │ ●  Operating Systems                    [NOW]
         │    CS-304 · Block B · Dr. Sharma
         │    09:00 – 10:00 AM
─────────┤
11:00 AM │ ○  Database Lab
         │    CS-318 · Lab 2 · Dr. Verma
         │    11:00 – 12:00 AM           in 2h 15m
─────────┤
02:00 PM │ ○  AI Fundamentals
         │    CS-210 · Block A
         │    02:00 – 03:00 PM           in 5h 15m
─────────┤
04:00 PM │ ○  Mentor Session
         │    Online
─────────┘

─── No more classes today ───
```
- Day selector: horizontal pill tabs (Mon–Sat), current day default
- Timeline view: vertical line on left with dots
- Current class: glowing blue dot, "NOW" badge
- Past classes: muted text, strikethrough subtle
- Upcoming: normal + time-until label

**CR ONLY — Add/Edit slot:**
- FAB button bottom right: `+` → opens bottom sheet to add/edit timetable slot
- Fields: Day, Start time, End time, Subject (dropdown), Room, Type (Lecture/Lab/Tutorial/Other)

---

### PAGE 7: POLLS PAGE (`/app/polls`)

**Layout:**
```
← Polls

[Active]  [Closed]   ← tab switcher

─────────────────────────────────────────────
┌──────────────────────────────────────────┐
│ 📊  Should campus upgrade to Wi-Fi 6E?   │
│ General Poll · Anonymous                 │
│ Closes in 2d 14h                         │
│                                          │
│  ○  Yes, upgrade it       [tap to vote]  │
│  ○  No, fine as is        [tap to vote]  │
│  ○  Don't care                           │
│                                          │
│  503 voted                               │
└──────────────────────────────────────────┘

─────────────────────────────────────────────
┌──────────────────────────────────────────┐
│ ⚠  Who is attending Project Expo?        │
│ Actionable Poll · CR can see your vote   │  ← warning badge!
│ Closes in 1d 2h                          │
│                                          │
│  ○  I'll be there                        │
│  ○  Can't make it                        │
│                                          │
│  28 voted                                │
└──────────────────────────────────────────┘
```

**Voting interaction:**
- Tap an option → option fills with color (blue), percentage bars animate in, vote count updates
- Once voted: all options show percentage bars, selected option has checkmark + blue fill
- No un-vote (by design)
- Actionable polls: show **yellow warning badge** BEFORE showing options: *"⚠ The CR can see your individual response"* — tap "I understand" to reveal options

**After voting display:**
```
│ ████████████████░░░  Yes  68%  (342)  ✓ │  ← your vote
│ ████████░░░░░░░░░░░  No   32%  (161)    │
```

**CR ONLY — Create Poll FAB:**
- `+` FAB → bottom sheet:
  - Question text input
  - Poll type toggle: [Anonymous] [CR-Visible]
  - Add options (min 2, max 5)
  - Set closing date/time
  - [Publish Poll] button

---

### PAGE 8: PROFILE PAGE (`/app/profile`)

**Layout:**
```
Profile

  ┌─── Avatar (80px circle, initials fallback) ───┐
  │  Priyanshu Sharma                             │
  │  25ESKCX089 · Roll 17 · Section P2            │
  │  [Student]  badge  / [Class Rep] badge for CR │
  └───────────────────────────────────────────────┘

  ─── Hub Info ───
  Hub Code: P2WXYZ     [Copy]
  Section: P2
  Institution: SKIT Jaipur

  ─── Attendance ───────────────────────────────
  [Update Attendance]  → goes to attendance page

  ─── Settings ───
  Notifications        [toggle]
  Theme                Dark ▾ (locked to dark for now)

  ─── Danger Zone ───
  [Leave Hub]   (shows confirm dialog)
  [Sign Out]
```

**CR ONLY section — "Command Center":**
```
  ─── CR Tools ───────────────────────────────────
  [📣 Post Announcement]
  [📋 Manage Assignments]
  [📊 Create Poll]
  [🗓 Edit Timetable]
  [👁 View Acknowledgments]
  [📈 Attendance Overview]
```
Each is a list row with icon, label, chevron.

---

### PAGE 9: ANNOUNCEMENTS PAGE (`/app/announcements`)

**Layout:**
```
← Announcements

[All]  [Critical]  [General]  ← filter tabs

─────────────────────────────────────────
⚠ CRITICAL — Pinned at top (if active)

DBMS Assignment Deadline Changed
Due: Today, 6:00 PM · Posted 2h ago
──────────────────────────────
Full announcement text here...

[✓ Acknowledge]  ← only shows if not yet acknowledged

─────────────────────────────────────────
📣 General

OS Lab Report Reminder
Due: Tomorrow, 11:59 PM · Posted 5h ago
──────────────────────────────
Brief text...

─────────────────────────────────────────
```
- Critical announcements always sorted to top
- Acknowledge button: on tap → button becomes "✓ Acknowledged" (disabled, green)
- Store acknowledgment in localStorage (for frontend-only phase)
- Critical announcement: red left border, subtle red bg tint

**CR ONLY — Post button:**
- Top-right `+ Post` button → bottom sheet with form:
  - Title, Body (textarea)
  - Priority toggle: [General] [Critical]
  - Deadline date picker (optional)
  - [Publish] button

---

### PAGE 10: ASSIGNMENTS PAGE (`/app/assignments`)

**Layout:**
```
← Assignments

[All]  [Pending]  [Submitted]  [Overdue]  ← filter tabs

─────────────────────────────────────────
📘 DBMS Assignment
Due: Today, 6:00 PM
[Due Today]  Subject: DBMS

Your Set: Set A
Roll 01–25: Complete Pages 4–5 of the assignment PDF.
[View PDF]

[Submit Link]

─────────────────────────────────────────
📗 OS Lab Report
Due: Tomorrow, 11:59 PM
[Upcoming]

[Submit Link]

─────────────────────────────────────────
📕 AI Project Proposal
Due: May 24, 11:59 PM
[Submitted] ✓ — link submitted 3 days ago
```

**Assignment card detail:**
- Subject color-coded icon
- Set-specific banner: shown only if sets exist AND user's roll falls in a set
  - "Your Set: [Label] — [description for your roll range]"
  - PDF link button if available
- Submit Link: tap → bottom sheet with URL input + [Submit] button
  - After submission: badge turns green "Submitted", link shown truncated

**Set Logic (frontend simulation):**
```javascript
const getUserSet = (classRoll, assignmentSets) => {
  const roll = parseInt(classRoll);
  return assignmentSets.find(set => roll >= set.rollStart && roll <= set.rollEnd);
};
// Only show the matching set. Never expose other sets.
```

**CR ONLY — Add Assignment FAB:**
- `+` → bottom sheet / full modal:
  - Title, Subject dropdown, Due date+time, Description
  - Toggle: "Has multiple sets?"
    - If yes: dynamic set builder — add rows of [Label] [Roll Start] [Roll End] [Description] [PDF Link]
    - Overlap validation: warn if roll ranges conflict
  - [Create Assignment] button

---

### PAGE 11: ATTENDANCE PAGE (`/app/attendance`)

**Layout:**
```
← Attendance

[Update from ERP]  ← prominent button at top

Last updated: 14 May 2026, 9:30 AM

─── Overall ────────────────────────────────
  [Big donut ring: 84%]
  "Safe — 5 subjects below 75%"

─── By Subject ─────────────────────────────

Engineering Chemistry                 90.63%
[●●●●●●●●●░]  Present: 29/32
  Can skip: 3 more classes
                                      [green]

Engineering Chemistry (Tutorial)      75.00%
[●●●●●●●●░░]  Present: 6/8
  Can skip: 0 — at threshold!
                                      [amber]

Engineering Chemistry Lab             76.92%
[●●●●●●●●░░]  Present: 20/26
  Can skip: 0 — at threshold!
                                      [amber]

DBMS                                  83.33%
...

Environmental Sciences                45.45%
  ⚠ Attend next 6 consecutively to recover
                                      [red]
```

**ERP Paste Flow:**
- "Update from ERP" → opens bottom sheet with:
  ```
  ┌─────────────────────────────────────────┐
  │ Paste your ERP Attendance Table below:  │
  │                                         │
  │ [large textarea]                        │
  │                                         │
  │ How to copy:                            │
  │ ERP → Student Info → Attendance Report  │
  │ → Select All → Copy → Paste here        │
  │                                         │
  │ [Parse & Update]                        │
  └─────────────────────────────────────────┘
  ```
- Parse function:

```javascript
const parseERPAttendance = (rawText) => {
  const lines = rawText.trim().split('\n');
  const subjects = [];
  for (const line of lines) {
    // Match lines starting with a number (row index)
    const match = line.match(
      /^\d+\s+(\S+)\s+(.+?)\s+(Lecture|Tutorial|Lab)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)$/
    );
    if (match) {
      const [, code, name, type, present, od, makeup, absent, percentage] = match;
      const attended = parseInt(present) + parseInt(od) + parseInt(makeup);
      const total = attended + parseInt(absent);
      const pct = parseFloat(percentage);

      // Skip/Recovery calculation (75% threshold)
      const canSkip = pct >= 75
        ? Math.floor((attended - 0.75 * total) / 0.75)
        : 0;
      const needToAttend = pct < 75
        ? Math.ceil((0.75 * total - attended) / 0.25)
        : 0;

      subjects.push({ code, name, type, present: attended, absent: parseInt(absent),
                       total, percentage: pct, canSkip, needToAttend });
    }
  }
  return subjects;
};
```

- After parsing: show preview of parsed subjects count → confirm → save to store
- Animate bars/rings in on update

**Color thresholds:**
- ≥ 85%: green (safe)
- 75–84%: amber (caution, canSkip shows 0-2)
- < 75%: red (danger, show recovery classes needed)

---

### PAGE 12: CR COMMAND CENTER (`/app/cr-dashboard` or accessible from Profile → CR Tools)

**Only rendered if `role === 'cr'`**

**Layout:**
```
Command Center                       P2WXYZ
──────────────────────────────────────────
Hub: Section P2 · 70 students · 2 active polls

Quick Actions:
[📣 Announcement]  [📋 Assignment]  [📊 Poll]  [🗓 Timetable]

─── Critical Acknowledgments ──────────────────
DBMS Deadline Change
[████████████████░░░░░░░]  47 / 70 acknowledged
[1-Click Nudge →]

─── Assignment Submissions ─────────────────────
OS Lab Report — Due Tomorrow
[Submitted: 38] [Pending: 32]
[View Details →]

─── Recent Polls ───────────────────────────────
Wi-Fi Upgrade Poll — 503 votes — Active
[View Results →]
```

**Acknowledgment tracker:**
- Progress bar showing X/70
- "1-Click Nudge" button → sends notification to unacknowledged (mock: shows "Nudge sent to 23 students" toast)
- Tap "View Details" → bottom sheet listing unacknowledged students by name + roll

---

## 4. NAVIGATION BAR

```
┌────┬──────────┬──────────┬──────────┬──────────┐
│ 🏠 │   📅     │    📊    │    👤    │          │
│Home│ Schedule │  Polls   │ Profile  │          │
└────┴──────────┴──────────┴──────────┴──────────┘
```
- Fixed bottom, 60px height, `background: var(--bg-surface)`, top border `1px solid var(--border-default)`
- 4 tabs (Home, Schedule, Polls, Profile) — no Assignments tab (accessed from dashboard widget + profile)
- Active tab: icon in `var(--accent-primary)` + label text, animated underline pill
- Inactive: `var(--text-muted)`, no label
- Active state transition: icon scale 1.15 + label fade in
- Safe area padding for iOS home bar: `padding-bottom: env(safe-area-inset-bottom)`

---

## 5. GLOBAL UI PATTERNS

### 5.1 Bottom Sheet (used throughout)
```javascript
// Slides up from bottom, overlay backdrop
// Spring animation: translateY(100%) → translateY(0)
// Dismiss: swipe down > 80px OR tap backdrop
// Handle bar: 32px×4px pill at top
// Max height: 90vh, overflow-y: auto
// Border-radius top: 20px
```

### 5.2 Toast Notifications
```javascript
// Top of screen, slides down
// Types: success (green), error (red), info (blue), warning (amber)
// Auto-dismiss: 3 seconds
// Max 3 visible at once, stacks
```

### 5.3 Loading States
- Skeleton screens (not spinners) for all card/list loads
- Skeleton: animated shimmer gradient from `var(--bg-elevated)` to `var(--bg-overlay)` to `var(--bg-elevated)`, 1.5s loop
- Inline loading for buttons: replace text with 3-dot pulse animation

### 5.4 Empty States
- Each section has a friendly empty state illustration (simple SVG or emoji-based)
- Examples: "No assignments yet 🎉", "No polls running right now", "Paste ERP data to see attendance"

### 5.5 Pull-to-Refresh
- Implement on Dashboard, Announcements, Polls
- Custom pull indicator: animated logo mark or subtle spinner

---

## 6. MOCK DATA LAYER

Since backend isn't ready, all data lives in:

### 6.1 `src/data/mockData.js`
```javascript
export const mockUser = {
  id: 'u001', name: 'Priyanshu Sharma', email: 'priyanshu@skit.ac.in',
  avatarUrl: null, role: 'student', classRoll: '17',
  universityRoll: '25ESKCX089',
};

export const mockHub = {
  hubCode: 'P2WXYZ', section: 'P2', hubName: 'Section P2',
  institution: 'SKIT Jaipur', totalStudents: 70,
};

export const mockSchedule = { /* array of timetable slots */ };
export const mockAssignments = { /* array with sets */ };
export const mockAnnouncements = { /* array with priority */ };
export const mockPolls = { /* array with options and votes */ };
export const mockAttendance = { /* parsed from sample ERP */ };
```

### 6.2 `src/data/sampleERPData.js`
- Include the full sample ERP paste string from the PRD
- Pre-parse it on first app load so attendance is visible immediately (demo mode)

### 6.3 `src/hooks/useLocalStorage.js`
- Persist user, hub, attendance, and acknowledged IDs to `localStorage`
- All store writes also write to localStorage for session persistence

---

## 7. FILE STRUCTURE
```
src/
├── main.jsx
├── App.jsx                    # Router, global providers
├── index.css                  # CSS variables, resets, global classes
│
├── context/
│   ├── AuthContext.jsx
│   ├── HubContext.jsx
│   └── UIContext.jsx
│
├── hooks/
│   ├── useLocalStorage.js
│   ├── useAttendanceParser.js
│   ├── useScheduleLogic.js
│   └── useTimeUntil.js
│
├── data/
│   ├── mockData.js
│   └── sampleERPData.js
│
├── components/
│   ├── layout/
│   │   ├── NavBar.jsx
│   │   ├── PageShell.jsx
│   │   └── BottomSheet.jsx
│   ├── common/
│   │   ├── Badge.jsx
│   │   ├── Card.jsx
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Toast.jsx
│   │   ├── Skeleton.jsx
│   │   ├── EmptyState.jsx
│   │   └── CROnly.jsx
│   ├── dashboard/
│   │   ├── CriticalBanner.jsx
│   │   ├── ScheduleWidget.jsx
│   │   ├── AttendancePills.jsx
│   │   ├── AnnouncementsScroll.jsx
│   │   ├── PollBanner.jsx
│   │   └── AssignmentsScroll.jsx
│   ├── attendance/
│   │   ├── SubjectCard.jsx
│   │   ├── DonutRing.jsx
│   │   └── ERPPasteSheet.jsx
│   ├── assignments/
│   │   ├── AssignmentCard.jsx
│   │   ├── SetBanner.jsx
│   │   └── SubmitLinkSheet.jsx
│   └── polls/
│       ├── PollCard.jsx
│       ├── PollOptionBar.jsx
│       └── ActionablePollWarning.jsx
│
└── pages/
    ├── LoginPage.jsx
    ├── onboarding/
    │   ├── ChoicePage.jsx
    │   ├── JoinHubPage.jsx
    │   └── CreateHubPage.jsx
    ├── app/
    │   ├── DashboardPage.jsx
    │   ├── SchedulePage.jsx
    │   ├── PollsPage.jsx
    │   ├── ProfilePage.jsx
    │   ├── AnnouncementsPage.jsx
    │   ├── AssignmentsPage.jsx
    │   ├── AttendancePage.jsx
    │   └── CRCommandCenter.jsx
    └── NotFoundPage.jsx
```

---

## 8. PWA CONFIGURATION

### `vite.config.js` — use `vite-plugin-pwa`:
```javascript
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'ClassHub',
    short_name: 'ClassHub',
    theme_color: '#0D0F14',
    background_color: '#0D0F14',
    display: 'standalone',
    orientation: 'portrait',
    icons: [/* 192, 512 */]
  }
})
```

### Service Worker:
- Cache shell + static assets (offline-first for dashboard)
- `index.html` always served from cache when offline
- API calls: network-first with cache fallback

---

## 9. PERFORMANCE GUIDELINES
- **Code split** each page with `React.lazy` + `Suspense`
- **Image optimization**: use WebP, lazy load avatars
- Horizontal carousels: `will-change: transform` for smooth scrolling
- Avoid layout shifts: reserve space for dynamic content with skeleton heights
- CSS animations: prefer `transform` and `opacity` (compositor-only, no repaints)
- `useMemo` for heavy computations (attendance parser, set matching)
- Debounce ERP paste parsing (300ms after last keystroke)

---

## 10. ACCESSIBILITY
- All interactive elements: minimum 44×44px tap target
- Color is never the **only** indicator (always paired with icon or text)
- Focus states: `outline: 2px solid var(--accent-primary)` with 2px offset
- ARIA labels on icon-only buttons
- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`
- Screen reader text for badge statuses: `<span class="sr-only">Due Today</span>`

---

## 11. IMPLEMENTATION ORDER (Sprint Sequence)

**Build in this exact order to always have a working demo:**

1. Design system CSS (`index.css` with all variables + global classes)
2. NavBar + PageShell + Router skeleton
3. LoginPage (static, button just sets mock auth)
4. Onboarding — Choice → JoinHub → CreateHub (full flow with validation)
5. Dashboard — all 7 sections with mock data
6. Attendance page + ERP parser (highest wow factor)
7. Assignments page + set routing logic
8. Announcements page + acknowledge flow
9. Polls page + voting interaction
10. Schedule page
11. Profile page
12. CR Command Center + all CR-only components
13. Animations, transitions, micro-interactions pass
14. PWA manifest + service worker
15. Mobile audit at 375px on real device

---

## 12. TESTING CHECKLIST (Before Handoff)

- [ ] All routes accessible and back-navigation works
- [ ] Role switching: toggle `mockUser.role` between `'student'` and `'cr'` — CR buttons appear/disappear correctly
- [ ] ERP paste: paste the sample data → attendance renders correctly
- [ ] Set routing: change `classRoll` to 10, 17, 30 → different assignment sets show
- [ ] Acknowledgment flow: tap acknowledge → button turns green, persists on refresh
- [ ] Poll voting: anonymous poll never shows who voted; actionable shows warning
- [ ] Critical banner appears on all pages when active
- [ ] Horizontal carousels scroll smoothly on mobile
- [ ] All forms validate inline before submit
- [ ] 375px layout: no horizontal overflow, no truncated buttons
- [ ] Dark theme only — no flash of white on load
- [ ] Bottom safe area respected (iPhone notch/home bar)

---

*End of Antigravity Prompt — ClassHub Frontend v1.0*
*Designed for Section P2, SKIT Jaipur · Built to make "I didn't see the message" extinct.*

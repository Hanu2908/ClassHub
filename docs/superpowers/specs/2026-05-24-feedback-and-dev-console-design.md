# Design Specification: Global Feedback System & Developer Console

## 1. Overview
ClassHub will implement a high-fidelity, end-to-end **Feedback/Bug Reporting System** paired with an interactive **Developer Console** (`/app/dev-console`). This global system allows regular students and CRs across all sections to report issues while giving core developers real-time performance telemetry, service health stats, and clean user-contextual bug tracking.

The system utilizes **Federated Hybrid Telemetry** (Approach 1):
* **Vercel Web Analytics & Speed Insights** capture aggregated Core Web Vitals (LCP, INP, CLS) at the edge.
* **Supabase Realtime Presence & Database** manage real-time online user tracking, feedback tables, and private developer work-notes.

---

## 2. Architectural & UX Flow

```
                                  [ STUDENT FLOW ]
Profile Page / Dashboard Link ---> Slide Up BottomSheet ---> Capture Diagnostics ---> INSERT to Supabase
                                                                                           |
                                  [ DEVELOPER FLOW ]                                       v
Profile Page (If Dev role)    ---> Navigate to /app/dev-console ----------------------------+---> View Reports Grid
                                             |
                                             +---> Sync Supabase Presence (Online Count)
                                             +---> Run On-Demand Latency Ping (SELECT 1)
                                             +---> Inspect SW & Caches (PWA Status)
                                             +---> Update Report Status & Write Private Notes
```

### A. Student Submission UI & Flow
1. **Access Points**:
   * A sleek glassmorphic row in `ProfilePage.tsx` labeled `💬 Send Feedback or Report a Bug`.
   * A small, minimalist monospaced link at the very bottom of the main Dashboard footer: `[ REPORT BUG ]`.
2. **The Form (Pointers-Physics BottomSheet)**:
   * **Category Selectors**: Large touch-friendly segment pills matching ClassHub's monospaced aesthetic: `[ 🐛 BUG ]` `[ 💡 SUGGESTION ]` `[ 💬 FEEDBACK ]`.
   * **Form Fields**: Simple, clean inputs for `Title` and `Description` with glowing border outlines on focus.
   * **Action Button**: A premium violet submit button with smooth scale transitions (`active:scale-98`) and visual loading spinner states.
3. **Silent Context Harvesting**:
   * On submit, the app gathers diagnostic metadata without interrupting the user. The `device_info` object captures:
     * User Agent (OS, Browser, Engine).
     * Screen resolution and viewport dimensions.
     * Active network type (e.g., `4g`, `wifi`, `unknown`).
     * PWA Display Mode (`standalone` vs `browser`).
     * The exact page route/URL where the user triggered the feedback.

### B. Developer Console (`/app/dev-console`)
1. **Access Rules**:
   * Locked behind the `'developer'` role in the database.
   * A clean `[ ⚙️ DEVELOPER HUB ]` button is visible in the profile settings only when the logged-in user's role is `'developer'`.
2. **Dashboard Bento Grid**:
   * **👥 Online Users Card**: Real-time counter connected to a Supabase Presence channel (`global-presence`). Shows active socket connections across the whole ClassHub application.
   * **⚡ DB Latency Card**: Measures the exact roundtrip millisecond count of an on-demand database ping (`performance.now()` before and after a lightweight select count query).
     * **Green**: `< 50ms` (Fast).
     * **Orange**: `50ms - 120ms` (Lagging).
     * **Red**: `> 120ms` (Congested).
     * Includes a manual `[ ↻ PING ]` button to trigger real-time updates.
   * **📦 PWA Cache Card**: Inspects the browser `window.caches` and service worker registrations, outputting:
     * Cache status (`INTEGRITY: OK`).
     * Number of compiled assets cached offline.
3. **Chronological Issue Board**:
   * Custom filter tabs: `[ All ]` `[ Bugs ]` `[ Suggestions ]` `[ Feedback ]`.
   * Status indicators: `[ Pending ]` (yellow), `[ Investigating ]` (orange), `[ In Progress ]` (blue), `[ Resolved ]` (green).
   * Expandable report cards showing full diagnostic logs, submitter identity details, and active page path.
4. **Developer Command Panel**:
   * **Status Dropdown**: Instantly updates status via a Supabase query.
   * **Developer Notes**: A private textarea synced to the database for developers to capture technical notes, root causes, or commit hashes.
   * **Spam Purge**: Safe action button to delete duplicate or spam reports.

---

## 3. Database Schema & RLS Policies

To implement this global system, we will write a migration containing the updated role constraints and the `feedback_reports` table structure.

### A. SQL Migration Script (`supabase/migrations/`)

```sql
-- 1. Safely update users role check constraint to support developers
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'cr', 'developer'));

-- 2. Create the global feedback reports table
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- preserves bug context even if user account is deleted
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'feedback')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  device_info JSONB NOT NULL, -- structured hardware + OS diagnostics
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'in_progress', 'resolved', 'closed')),
  developer_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;
```

### B. Row-Level Security (RLS) Policies

---
**RLS POLICY PROPOSED**
Table: `feedback_reports`

* **Policy Name**: `allow_student_insert_own`
  * **SQL**: 
    ```sql
    CREATE POLICY allow_student_insert_own ON feedback_reports 
      FOR INSERT TO authenticated 
      WITH CHECK (user_id = auth.uid());
    ```
  * **Plain English**: Allows any authenticated student to submit a feedback report under their own User ID.

* **Policy Name**: `allow_student_read_own`
  * **SQL**: 
    ```sql
    CREATE POLICY allow_student_read_own ON feedback_reports 
      FOR SELECT TO authenticated 
      USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer')
      );
    ```
  * **Plain English**: Allows students to view and track only their own reports, while developers can select and view all reports globally.

* **Policy Name**: `allow_developer_all`
  * **SQL**:
    ```sql
    CREATE POLICY allow_developer_all ON feedback_reports 
      FOR ALL TO authenticated 
      USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer'))
      WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer'));
    ```
  * **Plain English**: Grants core developers complete administrative access (select, insert, update, delete) to all rows in the feedback table.
---

## 4. Telemetry Tracking Specifications

### A. Vercel Edge Metrics
* **Installation**: We will install `@vercel/analytics` and `@vercel/speed-insights`.
* **Flow**:
  * On app initialization in `src/main.tsx`, we invoke `inject()` and `SpeedInsights()` respectively.
  * Captures real-time Core Web Vitals (LCP, INP, CLS) from our Skit beta students silently.
  * Visualizes edge traffic and performance directly inside your Vercel Project Dashboard.

### B. Supabase Real-Time Presence
* **Channel**: `room:global-presence`
* **Flow**:
  * On app load, standard client joins the presence channel.
  * On the Dev Console, we listen to `'sync'`, `'join'`, and `'leave'` events.
  * Real-time online counters update seamlessly using state tracking.

---

## 5. Verification Plan

### Automated Tests
1. **Developer Role Enforcement**:
   * Attempt accessing `/app/dev-console` with standard `'student'` and `'cr'` roles. Verify the app redirects safely to `/app/dashboard`.
   * Log in with a `'developer'` role account and verify full routing permission.
2. **RLS Database Tests**:
   * Attempt to SELECT a feedback report from another user's ID as a standard student. Verify Supabase returns empty rows.
   * Attempt to INSERT a feedback report spoofing another user's ID. Verify Supabase returns a `403 Forbidden` error.
   * Query all reports as a `'developer'` and verify complete data retrieval.

### Manual Verification
1. **Interactive Form Submission**:
   * Open the feedback BottomSheet from the profile page.
   * Submit a `[ BUG ]` and verify that `device_info` correctly captures the local environment.
2. **Real-time Live Console Performance**:
   * Open the Developer Hub, click `[ ↻ PING ]` and confirm that DB latency registers in milliseconds.
   * Check the Service Worker cache stats showing correct integrity.
   * Open ClassHub on a secondary device, and confirm that the "Online Users" count increments in real-time.

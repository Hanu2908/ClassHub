# ClassHub — Frontend Agent Context
Version: 1.0 | Stack locked. Do not deviate without PM approval.

---

## Who You Are
You are a senior React developer building the student-facing and
CR-facing frontend of SectionHub — a multi-tenant academic PWA.
You write TypeScript, use Tailwind CSS utility classes only, and
never put logic inside components that belongs in a hook.

---

## Tech Stack (locked)
- React 18 + Vite
- TypeScript (strict mode — no `any`, no `as unknown`)
- Tailwind CSS v3 (utility classes only, no arbitrary values unless necessary)
- React Router v6 (file-based routing pattern)
- TanStack Query v5 (all server state — no useEffect for fetching)
- Zustand (client-only state: active tab, modal open, UI preferences)
- Supabase JS Client v2
- Lucide React (icons — no other icon library)
- Vite PWA plugin (service worker, manifest)

---

## File Structure
```
src/
  main.tsx                  — React root, QueryClient provider, Router
  App.tsx                   — Route definitions, auth guard
  lib/
    supabase.ts             — SINGLE Supabase client export
    queryClient.ts          — TanStack QueryClient config
  components/
    student/                — Student-facing UI only
    cr/                     — CR admin UI only (role-gated)
    shared/                 — Used by both (NoticeCard, AssignmentRow)
    ui/                     — Design primitives (Button, Card, Badge, Input)
  hooks/
    useAuth.ts              — Current user, role, section_id
    useSection.ts           — Section data, subjects list
    useAnnouncements.ts     — Fetch + acknowledge
    useAssignments.ts       — Fetch + submit link
    useAttendance.ts        — Fetch + paste parse + UPSERT
    usePolls.ts             — Fetch + vote
    useTimetable.ts         — Today's schedule
  pages/
    Login.tsx               — Google OAuth entry point
    StudentDashboard.tsx    — Home for role=student
    CRDashboard.tsx         — Home for role=cr
    OnboardingInvite.tsx    — Invite code entry after first login
  styles/
    globals.css             — Tailwind directives, CSS vars, base reset
  types/
    database.types.ts       — Generated from Supabase: npx supabase gen types
```

---

## Design System

### Color Tokens (defined in tailwind.config.ts, use as classes)
```
bg-app        #0A0A0F   — page background
bg-card       #13131C   — card surfaces
bg-hover      #1A1A28   — hover state
border-faint  #1C1C2E   — barely visible dividers
border-mid    #2A2A40   — standard borders
accent        #8B5CF6   — electric violet, primary action
accent-faint  rgba(139,92,246,0.08)
text-primary  #F0F0FF   — headings, important text
text-muted    #9090B8   — secondary text
status-live   #4ADE80   — green, safe/submitted
status-urgent #F43F5E   — red, critical/debarment risk
status-warn   #FB923C   — orange, approaching deadline
status-audit  #A78BFA   — light violet, audit badge
```

### Typography Classes
```
font-mono     IBM Plex Mono — labels, codes, timestamps, metadata
font-sans     IBM Plex Sans — body, descriptions, form inputs
font-display  Bebas Neue    — large countdown numbers, hero stats
```

### Spacing and Sizing
- Mobile-first. Base viewport: 375px.
- Max content width: 480px, centered.
- Touch targets: minimum 44px height on all interactive elements.
- Bottom nav height: 64px + safe area inset.

---

## Hard Rules — Never Violate

1. **No inline styles.** Tailwind classes only. Exception: dynamic values
   that cannot be expressed as Tailwind classes (e.g., a progress bar
   width derived from a percentage calculation). Use `style={{ width: \`\${pct}%\` }}`.

2. **No data fetching in components.** All Supabase calls live in
   `hooks/`. Components receive data as props or consume a hook result.

3. **No direct Supabase import in components.** Always import the client
   from `lib/supabase.ts`. Never instantiate a second client.

4. **No `localStorage` for user data.** All persistence in Supabase.
   Zustand store is in-memory only — it resets on refresh by design.

5. **Role gate every CR component.** Before rendering anything in
   `components/cr/`, check `user.role === 'cr'`. If not, return null.

6. **General polls never expose `student_id`.** The fetch for a general
   poll result must aggregate server-side. Never fetch raw `votes` rows
   for a general poll and count them client-side — RLS prevents it, but
   don't architect around RLS failure.

7. **Loading and error states are required.** Every component that
   consumes a hook must handle `isLoading` and `isError`. No exceptions.
   Use the shared `<LoadingSkeleton />` and `<ErrorState />` components.

8. **PWA offline behavior.** If Supabase returns a network error, show
   a cached offline state (TanStack Query handles this with `staleTime`).
   Never show a blank screen on network failure.

---

## Auth Flow

```typescript
// After Google OAuth callback, IMMEDIATELY check domain
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    if (!session.user.email?.endsWith('@skit.ac.in')) {
      await supabase.auth.signOut()
      // Navigate to /login with error param: ?error=domain
      return
    }
    // Check if user has a row in public.users (profile complete)
    const { data: profile } = await supabase
      .from('users')
      .select('id, role, section_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) {
      // New user — redirect to /onboarding (invite code entry)
      navigate('/onboarding')
    } else if (!profile.section_id) {
      navigate('/onboarding')
    } else if (profile.role === 'cr') {
      navigate('/cr/dashboard')
    } else {
      navigate('/dashboard')
    }
  }
})
```

---

## Hook Pattern (use this structure for every hook)

```typescript
// hooks/useAnnouncements.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useAnnouncements() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['announcements', user?.section_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, acknowledgments(user_id)')
        .eq('section_id', user!.section_id)
        .eq('is_template', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user?.section_id,
    staleTime: 30_000, // 30 seconds
  })
}

export function useAcknowledge() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('acknowledgments')
        .upsert({ announcement_id: announcementId, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}
```

---

## Component Pattern

```typescript
// components/shared/NoticeCard.tsx
interface NoticeCardProps {
  id: string
  title: string
  content: string
  priority: 'general' | 'critical'
  acknowledged: boolean
  onAcknowledge: (id: string) => void
}

export function NoticeCard({ id, title, content, priority, acknowledged, onAcknowledge }: NoticeCardProps) {
  const isCritical = priority === 'critical'

  return (
    <div className={`
      rounded-lg p-4 border
      ${isCritical
        ? 'border-status-urgent bg-status-urgent/5'
        : 'border-border-mid bg-bg-card'
      }
    `}>
      {isCritical && (
        <span className="text-xs font-mono text-status-urgent tracking-widest">
          ◆ CRITICAL
        </span>
      )}
      <h3 className="text-text-primary font-semibold mt-1">{title}</h3>
      <p className="text-text-muted text-sm mt-2">{content}</p>
      {isCritical && !acknowledged && (
        <button
          onClick={() => onAcknowledge(id)}
          className="mt-4 w-full py-3 bg-accent text-white font-mono text-sm tracking-wider rounded-md min-h-[44px]"
        >
          ACKNOWLEDGE
        </button>
      )}
    </div>
  )
}
```

---

## What To Always Ask Before Writing Code
1. Which component / page / hook are you working on?
2. Is this the student view, CR view, or shared?
3. Does this component need to handle loading and error states?

## What To Never Do
- Do not write RLS policies — that is backend.md territory
- Do not modify the database schema
- Do not add npm packages without listing them and asking the PM first
- Do not write tests in the same turn as feature code — separate PR

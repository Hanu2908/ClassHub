# Design Specification — Day Scholar / Hosteler Status Integration

This document defines the design and schema mappings for collecting the user's commuter status (`day_scholar`) during onboarding, exposing a toggle on the profile settings page, displaying shortened badges in the class directory, and filtering class members by commuter status.

---

## 1. User Context & Scope
To improve class directory intelligence and set up the foundation for personalized commute/timing features, ClassHub will capture whether a student is a **Day Scholar (DS)** or a **Hosteler (H)**.

### Out of Scope for Phase 1 (Deferred to Future Roadmap)
- Real-time bus GPS tracking links or route countdowns.
- Hostel mess hours or automated curfew alerts.
- Gate pass request flow.

---

## 2. Interface Changes

### Onboarding Selection
- **Component:** `JoinHubPage` and `CreateHubPage`
- **UI Element:** A segmented control or horizontal chips selection:
  - `[ 🚌 Day Scholar ]` (defaults to active)
  - `[ 🏠 Hosteler ]`
- **State Capture:** Sets `dayScholar` field which is inserted as `day_scholar` (boolean) into `public.users`.

### Profile Control
- **Component:** `ProfilePage`
- **UI Element:** A list row item under the "Settings" card:
  - **Status:** `DS` or `Hostel`
- **Interactions:** Clicking toggles the value directly, calling Supabase update, syncing Zustand `authUser`, and showing a toast.

### Class Member List (CR Command Center)
- **Component:** `CRCommandPage.tsx`
- **Pills/Badges:** Simple, short badges next to names:
  - `DS` (slate-blue badge with `🚌` emoji)
  - `Hostel` (indigo badge with `🏠` emoji)
- **Filters:** Dropdown/toggle filter at the header:
  - `All` | `DS 🚌` | `Hostel 🏠`

---

## 3. Database & Store Mapping

### Supabase Query
```typescript
// useSupabaseQuery.ts -> useSectionMembers()
const { data, error } = await supabase
  .from('users')
  .select('id, name, email, section_roll, university_roll, role, avatar_url, day_scholar')
```

### Zustand Store
```typescript
export interface AuthUser {
  // ...
  dayScholar: boolean;
}
```

---

## 4. Verification Plan
- Verify compilation with `npm run build`.
- Verify database state updates in `users` table via Supabase dashboard logs or manual tests.
- Confirm filtering renders correctly in the attendance overview section of the CR Command Center.

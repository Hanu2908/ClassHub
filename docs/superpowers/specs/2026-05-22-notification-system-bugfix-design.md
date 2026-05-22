# Notification System Bugfix & Performance Overhaul

Fix critical bugs in the notification system and improve Edge Function performance.

## Background

The ClassHub notification system has two delivery channels:
1. **In-app notifications** via `notification_events` table (Postgres triggers auto-generate, Supabase Realtime syncs to client)
2. **Web Push** via Edge Functions (`send-critical-announcement`, `nudge-unacknowledged`, `send-assignment-reminders`, `send-custom-notification`)

Analysis revealed 3 bugs and 2 performance issues that this spec addresses.

## Scope

### Bug Fixes

#### 1. Duplicate Client-Side Notifications
**Problem**: `AuthProvider.tsx` subscribes to both raw tables (`announcements`, `assignments`, `polls`) AND `notification_events`. When an announcement is created, the DB trigger inserts into `notification_events` (triggering the realtime subscription), AND the raw-table subscription calls `addNotification()` — producing 2 toasts and 2 bell items.

**Fix**: Remove the `addNotification()` calls from the section-level realtime channel (lines ~288-323 in AuthProvider.tsx). Keep the `queryClient.invalidateQueries()` calls so TanStack Query cache still refreshes on raw table changes. All bell/toast notifications will come solely from the `notification_events` realtime subscription.

#### 2. send-custom-notification Silent DB Insert Failure
**Problem**: The insert payload uses `type: "system"` but the column is `kind` (a NOT NULL enum). The insert silently fails — custom notifications deliver as Web Push but never appear in the notification bell.

**Fix**:
1. Add `'custom'` as a new `notification_kind` enum value via migration
2. Fix the insert in `send-custom-notification/index.ts` to use `kind: "custom"` plus `section_id`, `actor_id`, and `target_table` fields

#### 3. Edge Functions Inline Shared Code
**Problem**: 3 Edge Functions each inline ~50 identical lines of `getContext()`, `requireCr()`, `sendPush()`, `getCors()`. The `_shared/` helpers exist but are unused.

**Fix**: Refactor all 3 functions to import from `_shared/auth.ts`, `_shared/cors.ts`, and `_shared/push.ts`. Update `send-custom-notification` to also use the shared helpers.

### Performance Improvements

#### 4. Sequential Push Delivery → Batched Concurrency
**Problem**: 3 Edge Functions use blocking sequential `for...of` loops for Web Push + DB insert. For 60+ students × 2 devices = 120+ sequential HTTP calls, risking Deno timeouts.

**Fix**: Convert to `Promise.allSettled()` with batch chunks of 10 for fault isolation. One failed push won't block others.

#### 5. Missing Compound Index
**Problem**: Client queries `notification_events WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50` without a compound index.

**Fix**: Add `(recipient_id, created_at DESC)` compound index via migration.

### Excluded from Scope
- Notification TTL / auto-cleanup (not needed for beta with 1 section)
- New notification types beyond `'custom'`
- Changes to the service worker or push subscription registration

## Files Changed

### Database Migration (1 new file)
- `supabase/migrations/YYYYMMDD_notification_system_fixes.sql`
  - Add `'custom'` to `notification_kind` enum
  - Add compound index on `(recipient_id, created_at DESC)`

### Edge Functions (4 files modified)
- `supabase/functions/send-custom-notification/index.ts` — Fix DB insert, use shared helpers
- `supabase/functions/send-critical-announcement/index.ts` — Use shared helpers, batched concurrency
- `supabase/functions/nudge-unacknowledged/index.ts` — Use shared helpers, batched concurrency
- `supabase/functions/send-assignment-reminders/index.ts` — Use shared helpers, batched concurrency

### Shared Helpers (up to 3 files modified)
- `supabase/functions/_shared/auth.ts` — Ensure `requireCr` returns all needed fields
- `supabase/functions/_shared/cors.ts` — Ensure matches the ALLOWED_ORIGINS pattern
- `supabase/functions/_shared/push.ts` — Already correct, no changes needed

### Client (1 file modified)
- `src/components/AuthProvider.tsx` — Remove `addNotification()` calls from section-level realtime channel

### Type Updates (1 file modified)
- `src/store/appStore.ts` — Add `'custom'` to `NotificationType` union

## Verification

1. **Duplicate notification fix**: Create an announcement → verify only 1 toast and 1 bell item appears (not 2)
2. **send-custom-notification fix**: Send a custom notification from CR Command → verify it appears in the notification bell
3. **Edge Function refactor**: Trigger each Edge Function → verify push delivery still works and `notification_events` rows are created
4. **Concurrency**: Send a critical announcement to full section → verify all pushes delivered without timeout
5. **Index**: Run `EXPLAIN ANALYZE` on the notification query to verify index scan is used

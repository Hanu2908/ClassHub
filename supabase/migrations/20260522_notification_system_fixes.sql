-- Notification system fixes migration
-- 1. Add 'custom' to notification_kind enum for CR custom notifications
-- 2. Add compound index for faster notification queries

-- Add new enum value
alter type public.notification_kind add value if not exists 'custom';

-- Add compound index for the primary client query pattern:
-- SELECT * FROM notification_events WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50
create index concurrently if not exists notification_events_recipient_created_idx
  on public.notification_events (recipient_id, created_at desc);

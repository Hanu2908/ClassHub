-- Migration: 20260529000002_add_notification_delete_policy
-- Adds RLS policy to allow users to delete their own notifications

create policy "Users can delete their own notifications"
on public.notification_events for delete to authenticated
using (recipient_id = (select auth.uid()));

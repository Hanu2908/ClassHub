-- Migration: 20260529000000_fix_reaction_update
-- Adds missing UPDATE RLS policy for announcement_reactions to allow users to change their emojis

DROP POLICY IF EXISTS "Enable reaction update for self" ON public.announcement_reactions;
CREATE POLICY "Enable reaction update for self"
ON public.announcement_reactions
FOR UPDATE
USING ( auth.uid() = user_id )
WITH CHECK ( auth.uid() = user_id );

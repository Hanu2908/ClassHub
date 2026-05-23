-- Fix "Users acknowledge as self" RLS policy to allow acknowledging both general and critical announcements in their section
DROP POLICY IF EXISTS "Users acknowledge as self" ON public.acknowledgments;

CREATE POLICY "Users acknowledge as self"
ON public.acknowledgments FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = announcement_id
      AND a.section_id = (SELECT public.current_user_section_id())
  )
);

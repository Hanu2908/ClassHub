-- Migration: 20260606000000_database_performance_remediation
-- Description: Consolidated remediations for database linter performance and security warnings:
--   1. Wrap auth.uid() in (SELECT auth.uid()) for plan-caching (auth_rls_initplan).
--   2. Restructure overlapping policies (FOR ALL -> FOR INSERT, UPDATE, DELETE) and merge duplicates (multiple_permissive_policies).
--   3. Create covering indexes for unindexed foreign keys (unindexed_foreign_keys).
--   4. Lock down security definer function search paths and API execution permissions (function_search_path_mutable & anon_security_definer_function_executable).

-- ==============================================================================
-- 1. ROW-LEVEL SECURITY (RLS) PERFORMANCE & REDUNDANCY OPTIMIZATIONS
-- ==============================================================================

-- ── public.user_gpa_data ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own gpa data" ON public.user_gpa_data;
CREATE POLICY "Users can view their own gpa data"
  ON public.user_gpa_data FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own gpa data" ON public.user_gpa_data;
CREATE POLICY "Users can insert their own gpa data"
  ON public.user_gpa_data FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own gpa data" ON public.user_gpa_data;
CREATE POLICY "Users can update their own gpa data"
  ON public.user_gpa_data FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── public.attachments ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR inserts attachments" ON public.attachments;
CREATE POLICY "CR inserts attachments"
ON public.attachments FOR INSERT TO authenticated
WITH CHECK (
  public.is_cr_for_section(section_id) 
  AND uploaded_by = (SELECT auth.uid())
);

-- ── public.votes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students read own actionable and anonymous votes and CR reads actionable section votes" ON public.votes;
CREATE POLICY "Students read own actionable and anonymous votes and CR reads actionable section votes"
ON public.votes FOR SELECT TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR anonymous_token = public.calculate_anonymous_token((SELECT auth.uid()), poll_id)
);

DROP POLICY IF EXISTS "Students vote once in section polls" ON public.votes;
CREATE POLICY "Students vote once in section polls"
ON public.votes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.polls p
    JOIN public.poll_options po ON po.poll_id = p.id
    WHERE p.id = votes.poll_id
      AND po.id = votes.option_id
      AND p.section_id = (SELECT public.current_user_section_id())
      AND p.is_active
      AND (p.expires_at IS NULL OR p.expires_at > NOW())
      AND (
        (p.poll_type = 'actionable' AND votes.student_id = (SELECT auth.uid()) AND votes.anonymous_token IS NULL)
        OR (p.poll_type = 'general' AND votes.student_id IS NULL AND votes.anonymous_token = public.calculate_anonymous_token((SELECT auth.uid()), votes.poll_id))
      )
  )
);

DROP POLICY IF EXISTS "Students delete own votes" ON public.votes;
CREATE POLICY "Students delete own votes" ON public.votes
FOR DELETE TO authenticated
USING (
  student_id = (SELECT auth.uid()) 
  OR anonymous_token = public.calculate_anonymous_token((SELECT auth.uid()), poll_id)
);

DROP POLICY IF EXISTS "Students update own votes" ON public.votes;
CREATE POLICY "Students update own votes" ON public.votes
FOR UPDATE TO authenticated
USING (
  student_id = (SELECT auth.uid()) 
  OR anonymous_token = public.calculate_anonymous_token((SELECT auth.uid()), poll_id)
)
WITH CHECK (
  student_id = (SELECT auth.uid()) 
  OR anonymous_token = public.calculate_anonymous_token((SELECT auth.uid()), poll_id)
);

-- ── public.global_resources ──────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_write_admin_users ON public.global_resources;

CREATE POLICY allow_write_admin_users_insert ON public.global_resources 
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

CREATE POLICY allow_write_admin_users_update ON public.global_resources 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

CREATE POLICY allow_write_admin_users_delete ON public.global_resources 
  FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

-- ── public.global_pyqs ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_write_admin_users ON public.global_pyqs;

CREATE POLICY allow_write_admin_users_insert ON public.global_pyqs 
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

CREATE POLICY allow_write_admin_users_update ON public.global_pyqs 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

CREATE POLICY allow_write_admin_users_delete ON public.global_pyqs 
  FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.role = 'cr'));

-- ── public.user_tags ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_tags_select" ON public.user_tags;
CREATE POLICY "user_tags_select"
  ON public.user_tags FOR SELECT TO authenticated
  USING (
    section_id = (SELECT section_id FROM public.users WHERE id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "user_tags_insert" ON public.user_tags;
CREATE POLICY "user_tags_insert"
  ON public.user_tags FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND section_id = (SELECT section_id FROM public.users WHERE id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "user_tags_delete" ON public.user_tags;
CREATE POLICY "user_tags_delete"
  ON public.user_tags FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      section_id = (SELECT section_id FROM public.users WHERE id = (SELECT auth.uid()))
      AND (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'cr'
    )
  );

-- ── public.feedback_reports ──────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_student_insert_own ON public.feedback_reports;
CREATE POLICY allow_student_insert_own ON public.feedback_reports 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS allow_student_read_own ON public.feedback_reports;
CREATE POLICY allow_student_read_own ON public.feedback_reports 
  FOR SELECT TO authenticated 
  USING (
    user_id = (SELECT auth.uid()) 
    OR EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.is_developer = true)
  );

DROP POLICY IF EXISTS allow_developer_all ON public.feedback_reports;

CREATE POLICY allow_developer_update ON public.feedback_reports 
  FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.is_developer = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.is_developer = true));

CREATE POLICY allow_developer_delete ON public.feedback_reports 
  FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = (SELECT auth.uid()) AND users.is_developer = true));

-- ── public.announcement_reactions ───────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access to reactions for section members" ON public.announcement_reactions;
CREATE POLICY "Enable read access to reactions for section members"
ON public.announcement_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_reactions.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Enable reaction creation/update for self in same section" ON public.announcement_reactions;
CREATE POLICY "Enable reaction creation/update for self in same section"
ON public.announcement_reactions FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_reactions.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Enable reaction deletion for self" ON public.announcement_reactions;
CREATE POLICY "Enable reaction deletion for self"
ON public.announcement_reactions FOR DELETE TO authenticated
USING ( (SELECT auth.uid()) = user_id );

DROP POLICY IF EXISTS "Enable reaction update for self" ON public.announcement_reactions;
CREATE POLICY "Enable reaction update for self"
ON public.announcement_reactions FOR UPDATE TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

-- ── public.announcement_comments ─────────────────────────────────────────────
-- 1. Read Policy (only for authenticated role)
DROP POLICY IF EXISTS "Enable read access to comments for section members" ON public.announcement_comments;
CREATE POLICY "authenticated_read_comments"
ON public.announcement_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

-- 2. Insert Policy (only for authenticated role)
DROP POLICY IF EXISTS "Enable comment creation for self in same section" ON public.announcement_comments;
CREATE POLICY "authenticated_insert_comments"
ON public.announcement_comments FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = author_id
  AND is_verified = false
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
  )
);

-- 3. Delete Policy (only for authenticated role)
DROP POLICY IF EXISTS "Enable comment deletion for author or CR" ON public.announcement_comments;
CREATE POLICY "authenticated_delete_comments"
ON public.announcement_comments FOR DELETE TO authenticated
USING (
  ((SELECT auth.uid()) = author_id AND is_verified = false)
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
);

-- 4. Merged & Targeted Update Policy (fixes multiple permissive update policies warning)
DROP POLICY IF EXISTS "Enable CR to verify comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "Enable comment content update for author within 15 mins" ON public.announcement_comments;

CREATE POLICY "authenticated_update_comments"
ON public.announcement_comments FOR UPDATE TO authenticated
USING (
  -- Either the original author updating within 15 mins (unverified)
  (
    (SELECT auth.uid()) = author_id 
    AND is_verified = false
    AND created_at > now() - interval '15 minutes'
  )
  OR
  -- Or the CR of the section verifying comments
  EXISTS (
    SELECT 1 FROM public.announcements a
    JOIN public.users u ON u.section_id = a.section_id
    WHERE a.id = announcement_comments.announcement_id
      AND u.id = (SELECT auth.uid())
      AND u.role = 'cr'
  )
)
WITH CHECK (
  -- For original author edits
  (
    (SELECT auth.uid()) = author_id
    AND is_verified = false
    AND id = id
    AND announcement_id = announcement_id
    AND author_id = author_id
    AND created_at = created_at
  )
  OR
  -- For CR verification updates
  (
    EXISTS (
      SELECT 1 FROM public.announcements a
      JOIN public.users u ON u.section_id = a.section_id
      WHERE a.id = announcement_comments.announcement_id
        AND u.id = (SELECT auth.uid())
        AND u.role = 'cr'
    )
    AND id = id
    AND announcement_id = announcement_id
    AND author_id = author_id
    AND content = content
    AND created_at = created_at
  )
);

-- ── public.announcement_thread_mutes ──────────────────────────────────────────
DROP POLICY IF EXISTS "Enable user to manage own thread mutes" ON public.announcement_thread_mutes;
CREATE POLICY "Enable user to manage own thread mutes"
ON public.announcement_thread_mutes FOR ALL TO authenticated
USING ( (SELECT auth.uid()) = user_id )
WITH CHECK ( (SELECT auth.uid()) = user_id );

-- ── public.push_subscriptions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ── public.subjects ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages section subjects" ON public.subjects;

CREATE POLICY "CR manages section subjects_insert"
ON public.subjects FOR INSERT TO authenticated
WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR manages section subjects_update"
ON public.subjects FOR UPDATE TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR manages section subjects_delete"
ON public.subjects FOR DELETE TO authenticated
USING (public.is_cr_for_section(section_id));

-- ── public.attendance_records ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students manage own attendance" ON public.attendance_records;

CREATE POLICY "Students manage own attendance_insert"
ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Students manage own attendance_update"
ON public.attendance_records FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Students manage own attendance_delete"
ON public.attendance_records FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ── public.assignments ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages assignments" ON public.assignments;

CREATE POLICY "CR manages assignments_insert"
ON public.assignments FOR INSERT TO authenticated
WITH CHECK (public.is_cr_for_section(section_id) and created_by = (SELECT auth.uid()));

CREATE POLICY "CR manages assignments_update"
ON public.assignments FOR UPDATE TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id) and created_by = (SELECT auth.uid()));

CREATE POLICY "CR manages assignments_delete"
ON public.assignments FOR DELETE TO authenticated
USING (public.is_cr_for_section(section_id));


-- ── public.assignment_sets ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages assignment sets" ON public.assignment_sets;

CREATE POLICY "CR manages assignment sets_insert"
ON public.assignment_sets FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_sets.assignment_id
    AND public.is_cr_for_section(a.section_id)
));

CREATE POLICY "CR manages assignment sets_update"
ON public.assignment_sets FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_sets.assignment_id
    AND public.is_cr_for_section(a.section_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_sets.assignment_id
    AND public.is_cr_for_section(a.section_id)
));

CREATE POLICY "CR manages assignment sets_delete"
ON public.assignment_sets FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = assignment_sets.assignment_id
    AND public.is_cr_for_section(a.section_id)
));

-- ── public.submissions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students manage own submissions and CR reads section" ON public.submissions;
CREATE POLICY "Students manage own submissions and CR reads section"
ON public.submissions FOR SELECT TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
);

DROP POLICY IF EXISTS "Students submit own work" ON public.submissions;
DROP POLICY IF EXISTS "CR inserts submission verification record" ON public.submissions;
CREATE POLICY "authenticated_insert_submissions"
ON public.submissions FOR INSERT TO authenticated
WITH CHECK (
  -- Option A: Student submits own work
  (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.section_id = (SELECT public.current_user_section_id())
    )
  )
  OR
  -- Option B: CR inserts placeholder for student in their section
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
);

DROP POLICY IF EXISTS "Students update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "CR may nudge submissions" ON public.submissions;
DROP POLICY IF EXISTS "CR updates submission verification status" ON public.submissions;
CREATE POLICY "authenticated_update_submissions"
ON public.submissions FOR UPDATE TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
)
WITH CHECK (
  student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = submissions.assignment_id
      AND public.is_cr_for_section(a.section_id)
  )
);

-- ── public.polls ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages polls" ON public.polls;

CREATE POLICY "CR manages polls_insert"
ON public.polls FOR INSERT TO authenticated
WITH CHECK (public.is_cr_for_section(section_id) and created_by = (SELECT auth.uid()));

CREATE POLICY "CR manages polls_update"
ON public.polls FOR UPDATE TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id) and created_by = (SELECT auth.uid()));

CREATE POLICY "CR manages polls_delete"
ON public.polls FOR DELETE TO authenticated
USING (public.is_cr_for_section(section_id));

-- ── public.poll_options ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages poll options" ON public.poll_options;

CREATE POLICY "CR manages poll options_insert"
ON public.poll_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_options.poll_id
    AND public.is_cr_for_section(p.section_id)
));

CREATE POLICY "CR manages poll options_update"
ON public.poll_options FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_options.poll_id
    AND public.is_cr_for_section(p.section_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_options.poll_id
    AND public.is_cr_for_section(p.section_id)
));

CREATE POLICY "CR manages poll options_delete"
ON public.poll_options FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_options.poll_id
    AND public.is_cr_for_section(p.section_id)
));

-- ── public.exam_overrides ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "CR manages overrides" ON public.exam_overrides;

CREATE POLICY "CR manages overrides_insert"
ON public.exam_overrides FOR INSERT TO authenticated
WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR manages overrides_update"
ON public.exam_overrides FOR UPDATE TO authenticated
USING (public.is_cr_for_section(section_id))
WITH CHECK (public.is_cr_for_section(section_id));

CREATE POLICY "CR manages overrides_delete"
ON public.exam_overrides FOR DELETE TO authenticated
USING (public.is_cr_for_section(section_id));


-- ==============================================================================
-- 2. COVERING INDEXES FOR UNINDEXED FOREIGN KEYS (PERFORMANCE LINTER REMEDIATION)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_announcement_comments_author_id 
  ON public.announcement_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user_id 
  ON public.announcement_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_announcement_thread_mutes_user_id 
  ON public.announcement_thread_mutes(user_id);

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by 
  ON public.attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_cr_transfer_log_actor_id 
  ON public.cr_transfer_log(actor_id);

CREATE INDEX IF NOT EXISTS idx_cr_transfer_log_target_id 
  ON public.cr_transfer_log(target_id);

CREATE INDEX IF NOT EXISTS idx_exam_overrides_created_by 
  ON public.exam_overrides(created_by);

CREATE INDEX IF NOT EXISTS idx_exams_created_by 
  ON public.exams(created_by);

CREATE INDEX IF NOT EXISTS idx_global_resources_updated_by 
  ON public.global_resources(updated_by);

CREATE INDEX IF NOT EXISTS idx_student_exam_prep_exam_id 
  ON public.student_exam_prep(exam_id);


-- ==============================================================================
-- 3. SECURITY DEFINER HARDENING & EXECUTION PRIVILEGE ADJUSTMENTS
-- ==============================================================================

-- ── A. Trigger / Internal Functions (Fix Search Path & Revoke Execute from API roles) ──

ALTER FUNCTION public.check_vote_multiplicity() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_vote_multiplicity() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.on_assignment_created() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.on_assignment_created() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.on_announcement_created() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.on_announcement_created() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.on_poll_created() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.on_poll_created() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.on_timetable_slot_change() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.on_timetable_slot_change() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.check_submission_integrity() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_submission_integrity() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.check_cr_limit() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_cr_limit() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.prune_stale_push_subscriptions() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.prune_stale_push_subscriptions() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.enforce_announcement_rate_limit() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.enforce_announcement_rate_limit() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.enforce_poll_rate_limit() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.enforce_poll_rate_limit() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.handle_announcement_comment_update() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_announcement_comment_update() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.check_max_active_tags() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_max_active_tags() FROM PUBLIC, anon, authenticated;

-- Safe handling for rls_auto_enable (internal/trigger function)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    ALTER FUNCTION public.rls_auto_enable() SET search_path = public;
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

ALTER FUNCTION public.touch_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;


-- ── B. RPC / API Functions (Fix Search Path & Revoke from Public/Anon, Grant to Authenticated) ──

ALTER FUNCTION public.batch_poll_results(uuid[]) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.batch_poll_results(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_poll_results(uuid[]) TO authenticated;

ALTER FUNCTION public.batch_poll_voter_counts(uuid[]) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.batch_poll_voter_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_poll_voter_counts(uuid[]) TO authenticated;

ALTER FUNCTION public.calculate_anonymous_token(uuid, uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.calculate_anonymous_token(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_anonymous_token(uuid, uuid) TO authenticated;

-- Safe handling for delete_own_account (RPC function)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_own_account') THEN
    ALTER FUNCTION public.delete_own_account() SET search_path = public;
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated';
  END IF;
END $$;

ALTER FUNCTION public.delete_section_hub(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.delete_section_hub(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_section_hub(uuid) TO authenticated;

ALTER FUNCTION public.demote_co_cr(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.demote_co_cr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demote_co_cr(uuid) TO authenticated;

ALTER FUNCTION public.is_primary_cr_for_section(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.is_primary_cr_for_section(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_primary_cr_for_section(uuid) TO authenticated;

ALTER FUNCTION public.leave_section_hub() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.leave_section_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_section_hub() TO authenticated;

ALTER FUNCTION public.promote_to_co_cr(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.promote_to_co_cr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_to_co_cr(uuid) TO authenticated;

ALTER FUNCTION public.resign_as_cr() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.resign_as_cr() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resign_as_cr() TO authenticated;

ALTER FUNCTION public.transfer_primary_cr(uuid, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.transfer_primary_cr(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_primary_cr(uuid, text) TO authenticated;

ALTER FUNCTION public.upsert_push_subscription(text, text, text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text, text) TO authenticated;

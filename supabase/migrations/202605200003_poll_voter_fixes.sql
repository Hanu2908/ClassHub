-- Migration: Fix poll voter aggregates and percentages for MCQ / Actionable polls
-- Creates a secure batch RPC for unique voter count aggregates per poll
-- Refactors single poll results to compute percentages relative to unique voter count

CREATE OR REPLACE FUNCTION public.batch_poll_voter_counts(target_polls uuid[])
RETURNS TABLE(poll_id uuid, voter_count bigint) AS $$
  SELECT p.poll_id, COALESCE(COUNT(DISTINCT COALESCE(v.student_id::text, v.anonymous_token::text)), 0)::bigint
  FROM unnest(target_polls) AS p(poll_id)
  LEFT JOIN public.votes v ON v.poll_id = p.poll_id
  GROUP BY p.poll_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.batch_poll_voter_counts(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.batch_poll_voter_counts(uuid[]) FROM anon;


-- Refactor poll_results to use unique voter count for percentages
CREATE OR REPLACE FUNCTION public.poll_results(target_poll uuid)
RETURNS TABLE(option_id uuid, label text, votes bigint, percentage numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_poll AS (
    SELECT p.id
    FROM public.polls p
    WHERE p.id = target_poll
      AND p.section_id = public.current_user_section_id()
  ),
  counts AS (
    SELECT po.id, po.label, COUNT(v.id)::bigint as vote_count
    FROM public.poll_options po
    JOIN visible_poll vp ON vp.id = po.poll_id
    LEFT JOIN public.votes v ON v.option_id = po.id
    GROUP BY po.id, po.label, po.sort_order
    ORDER BY po.sort_order, po.label
  ),
  voters AS (
    SELECT GREATEST(COUNT(DISTINCT COALESCE(v.student_id::text, v.anonymous_token::text)), 1)::numeric AS value
    FROM public.votes v
    WHERE v.poll_id = target_poll
  )
  SELECT c.id, c.label, c.vote_count, ROUND((c.vote_count::numeric / voters.value) * 100, 2)
  FROM counts c, voters;
$$;

-- Ensure correct grants
GRANT EXECUTE ON FUNCTION public.poll_results(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.poll_results(uuid) FROM anon;

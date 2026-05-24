-- Migration: Optimize feedback_reports queries using index search
-- Timestamp: 20260524132800

-- Create index on user_id to speed up standard user filtering
CREATE INDEX IF NOT EXISTS idx_feedback_reports_user_id ON public.feedback_reports(user_id);

-- Create index on created_at DESC to optimize Developer Console chronological listing
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at ON public.feedback_reports(created_at DESC);

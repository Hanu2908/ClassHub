-- Create the feedback reports table
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- preserves bug reports if users delete their accounts
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'feedback')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  device_info JSONB NOT NULL, -- browser diagnostics context
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'in_progress', 'resolved', 'closed')),
  developer_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- 1. Policy for students/CRs/devs to submit their own reports
CREATE POLICY allow_student_insert_own ON feedback_reports 
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- 2. Policy for students to read their own reports, and developers to read all reports
CREATE POLICY allow_student_read_own ON feedback_reports 
  FOR SELECT TO authenticated 
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer'::public.user_role)
  );

-- 3. Policy for core developers to have complete administrative privileges
CREATE POLICY allow_developer_all ON feedback_reports 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer'::public.user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'developer'::public.user_role));

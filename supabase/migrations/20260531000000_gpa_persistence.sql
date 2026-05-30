-- Migration: 20260531000000_gpa_persistence.sql
-- Description: Create user_gpa_data table and RLS policies for GPA calculator backend sync.

CREATE TABLE user_gpa_data (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gpa_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_gpa_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gpa data"
  ON user_gpa_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gpa data"
  ON user_gpa_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gpa data"
  ON user_gpa_data FOR UPDATE
  USING (auth.uid() = user_id);

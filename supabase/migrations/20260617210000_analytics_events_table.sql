-- Table: flat event log
CREATE TABLE analytics_events (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Composite index: equality on event_name, range on created_at (best practice)
CREATE INDEX idx_analytics_events_name_created
  ON analytics_events (event_name, created_at DESC);

-- Composite index: section-scoped time queries for dev console
CREATE INDEX idx_analytics_events_section_created
  ON analytics_events (section_id, created_at DESC);

-- Index for DAU/WAU: distinct user counting within time range
CREATE INDEX idx_analytics_events_user_created
  ON analytics_events (user_id, created_at DESC);

-- RLS: INSERT-only for authenticated users (own events only)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_insert_own ON analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

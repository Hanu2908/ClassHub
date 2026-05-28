-- Migration: 20260529000001_add_announcement_expiry
-- Adds expires_at column to announcements table for Flash Posts

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for querying active flash posts quickly
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at) WHERE expires_at IS NOT NULL;

-- Add 'developer' to the public.user_role ENUM in its own transaction block
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'developer';

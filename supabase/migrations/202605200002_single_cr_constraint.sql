-- Migration: Enforce at most one CR per section

-- 1. Create a unique partial index to guarantee database integrity
CREATE UNIQUE INDEX IF NOT EXISTS users_section_single_cr_idx 
ON public.users (section_id) 
WHERE (role = 'cr');

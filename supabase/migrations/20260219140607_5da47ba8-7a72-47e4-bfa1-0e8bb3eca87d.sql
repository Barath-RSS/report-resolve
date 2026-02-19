
-- 1. Add 'staff' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. Add completion_image_url column to reports
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS completion_image_url TEXT DEFAULT NULL;

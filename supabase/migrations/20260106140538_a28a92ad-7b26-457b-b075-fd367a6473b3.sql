-- Add landmark column to reports table for manual location input
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS landmark TEXT;
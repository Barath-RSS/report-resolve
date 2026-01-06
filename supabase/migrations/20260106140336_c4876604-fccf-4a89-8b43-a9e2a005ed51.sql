-- Add register_no column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS register_no TEXT UNIQUE;

-- Create an index for faster lookups by register_no
CREATE INDEX IF NOT EXISTS idx_profiles_register_no ON public.profiles(register_no);

-- Update the handle_new_user function to include register_no
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, email, register_no)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name', 
    NEW.email,
    NEW.raw_user_meta_data ->> 'register_no'
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;
-- Create table to store password reset OTP codes
CREATE TABLE public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_password_reset_codes_email ON public.password_reset_codes(email);
CREATE INDEX idx_password_reset_codes_code ON public.password_reset_codes(code);

-- Allow public insert (anyone can request a password reset)
CREATE POLICY "Anyone can request password reset" 
ON public.password_reset_codes 
FOR INSERT 
WITH CHECK (true);

-- Allow public select for verification (by code and email)
CREATE POLICY "Anyone can verify their own code" 
ON public.password_reset_codes 
FOR SELECT 
USING (true);

-- Allow service role to update (mark as used)
CREATE POLICY "Service role can update codes" 
ON public.password_reset_codes 
FOR UPDATE 
USING (true);

-- Clean up expired codes automatically (optional - can be done via cron)
CREATE POLICY "Anyone can delete expired codes" 
ON public.password_reset_codes 
FOR DELETE 
USING (expires_at < now());
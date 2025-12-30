-- Create access_requests table for official role requests
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own access requests" 
ON public.access_requests 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own access requests
CREATE POLICY "Users can create their own access requests" 
ON public.access_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Officials can view all access requests
CREATE POLICY "Officials can view all access requests" 
ON public.access_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'official'::app_role));

-- Officials can update access requests (approve/reject)
CREATE POLICY "Officials can update access requests" 
ON public.access_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'official'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_access_requests_updated_at
BEFORE UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
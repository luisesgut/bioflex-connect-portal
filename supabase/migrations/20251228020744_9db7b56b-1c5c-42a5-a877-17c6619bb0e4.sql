-- Create NCR status enum
CREATE TYPE public.ncr_status AS ENUM ('open', 'under_review', 'resolved', 'closed');

-- Create NCR priority enum
CREATE TYPE public.ncr_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create NCR submissions table
CREATE TABLE public.ncr_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  priority ncr_priority NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  status ncr_status NOT NULL DEFAULT 'open',
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ncr_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ncr_submissions
CREATE POLICY "Users can view their own NCRs"
ON public.ncr_submissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own NCRs"
ON public.ncr_submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NCRs"
ON public.ncr_submissions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own NCRs"
ON public.ncr_submissions
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ncr_submissions_updated_at
BEFORE UPDATE ON public.ncr_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ncr_submissions;
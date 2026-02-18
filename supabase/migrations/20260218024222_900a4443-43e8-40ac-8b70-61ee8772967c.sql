
-- Create dp_contacts table for Destiny Produce Sales/CSR contacts
CREATE TABLE public.dp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dp_contacts ENABLE ROW LEVEL SECURITY;

-- Admins can manage dp_contacts
CREATE POLICY "Admins can manage dp contacts"
ON public.dp_contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view dp_contacts
CREATE POLICY "Authenticated users can view dp contacts"
ON public.dp_contacts
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_dp_contacts_updated_at
BEFORE UPDATE ON public.dp_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

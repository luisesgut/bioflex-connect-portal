-- Create load_comments table for customer comments on loads
CREATE TABLE public.load_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  load_id UUID NOT NULL REFERENCES public.shipping_loads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.load_comments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all comments
CREATE POLICY "Admins can manage load comments" 
ON public.load_comments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view comments on loads they have access to
CREATE POLICY "Authenticated users can view load comments" 
ON public.load_comments 
FOR SELECT 
USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create load comments" 
ON public.load_comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own load comments" 
ON public.load_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_load_comments_updated_at
BEFORE UPDATE ON public.load_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create storage bucket for print card files
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-cards', 'print-cards', true);

-- Allow authenticated users to view print card files
CREATE POLICY "Authenticated users can view print cards"
ON storage.objects FOR SELECT
USING (bucket_id = 'print-cards');

-- Allow admins to upload print card files
CREATE POLICY "Admins can upload print cards"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'print-cards' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update print card files
CREATE POLICY "Admins can update print cards"
ON storage.objects FOR UPDATE
USING (bucket_id = 'print-cards' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete print card files
CREATE POLICY "Admins can delete print cards"
ON storage.objects FOR DELETE
USING (bucket_id = 'print-cards' AND has_role(auth.uid(), 'admin'::app_role));

-- Add column to store the file URL
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS print_card_url text;
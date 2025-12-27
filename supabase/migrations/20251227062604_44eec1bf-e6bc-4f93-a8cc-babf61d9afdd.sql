-- Create storage bucket for NCR attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ncr-attachments', 'ncr-attachments', true);

-- Allow authenticated users to upload files to ncr-attachments bucket
CREATE POLICY "Authenticated users can upload NCR attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ncr-attachments');

-- Allow authenticated users to view NCR attachments
CREATE POLICY "Authenticated users can view NCR attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'ncr-attachments');

-- Allow authenticated users to delete their own NCR attachments
CREATE POLICY "Authenticated users can delete NCR attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ncr-attachments');
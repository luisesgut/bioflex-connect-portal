
-- Drop the pre-existing policy that conflicts
DROP POLICY IF EXISTS "Authenticated users can update release documents" ON storage.objects;

-- Now recreate it
CREATE POLICY "Authenticated users can update release documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'release-documents');

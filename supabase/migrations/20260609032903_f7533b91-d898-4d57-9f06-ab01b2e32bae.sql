
-- Allow shared collaborators to read document files via storage
CREATE POLICY "Shared collaborators read document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = storage.objects.name
      AND public.has_share_access('item', d.item_id, 'viewer')
  )
);

-- Restrict has_share_access execution: only authenticated users need it
REVOKE EXECUTE ON FUNCTION public.has_share_access(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_share_access(text, uuid, text) TO authenticated, service_role;

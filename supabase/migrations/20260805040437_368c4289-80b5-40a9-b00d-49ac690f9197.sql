CREATE POLICY "receipts_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.can(NULLIF((storage.foldername(name))[1], '')::uuid, 'expenses.read'));
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND public.can(NULLIF((storage.foldername(name))[1], '')::uuid, 'expenses.write'));
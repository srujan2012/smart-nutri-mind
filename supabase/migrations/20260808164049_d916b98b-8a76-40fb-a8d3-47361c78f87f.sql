
CREATE POLICY "Users read own health files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own health files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own health files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own health files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'health-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

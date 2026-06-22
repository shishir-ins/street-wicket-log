CREATE POLICY "Public read player-photos" ON storage.objects FOR SELECT USING (bucket_id = 'player-photos');
CREATE POLICY "Public upload player-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'player-photos');
CREATE POLICY "Public update player-photos" ON storage.objects FOR UPDATE USING (bucket_id = 'player-photos');
CREATE POLICY "Public delete player-photos" ON storage.objects FOR DELETE USING (bucket_id = 'player-photos');
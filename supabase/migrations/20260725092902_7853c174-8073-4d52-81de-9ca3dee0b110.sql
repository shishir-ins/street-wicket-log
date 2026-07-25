-- Tighten write policies: only authenticated users can mutate data.
-- Public reads are intentional (spectator/viewer mode) and remain unchanged.

-- balls
DROP POLICY IF EXISTS "Public insert balls" ON public.balls;
DROP POLICY IF EXISTS "Public update balls" ON public.balls;
DROP POLICY IF EXISTS "Public delete balls" ON public.balls;

CREATE POLICY "Authenticated insert balls" ON public.balls
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update balls" ON public.balls
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete balls" ON public.balls
  FOR DELETE TO authenticated USING (true);

-- matches
DROP POLICY IF EXISTS "Public insert matches" ON public.matches;
DROP POLICY IF EXISTS "Public update matches" ON public.matches;
DROP POLICY IF EXISTS "Public delete matches" ON public.matches;

CREATE POLICY "Authenticated insert matches" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update matches" ON public.matches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete matches" ON public.matches
  FOR DELETE TO authenticated USING (true);

-- players
DROP POLICY IF EXISTS "Public insert players" ON public.players;
DROP POLICY IF EXISTS "Public update players" ON public.players;
DROP POLICY IF EXISTS "Public delete players" ON public.players;

CREATE POLICY "Authenticated insert players" ON public.players
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update players" ON public.players
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete players" ON public.players
  FOR DELETE TO authenticated USING (true);

-- Storage: player-photos bucket — restrict writes to authenticated
DROP POLICY IF EXISTS "Public upload to player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public update player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload player photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update player photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete player photos" ON storage.objects;

CREATE POLICY "Authenticated upload player-photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos');
CREATE POLICY "Authenticated update player-photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos')
  WITH CHECK (bucket_id = 'player-photos');
CREATE POLICY "Authenticated delete player-photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos');

-- PLAYERS
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'All-rounder',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON public.players FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete players" ON public.players FOR DELETE USING (true);

-- MATCHES
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  match_date timestamptz NOT NULL DEFAULT now(),
  total_overs int NOT NULL DEFAULT 6,
  team_a_name text NOT NULL DEFAULT 'Team A',
  team_b_name text NOT NULL DEFAULT 'Team B',
  team_a_players jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_b_players jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  fielder_players jsonb NOT NULL DEFAULT '[]'::jsonb,
  batting_first char(1) NOT NULL DEFAULT 'A',
  status text NOT NULL DEFAULT 'setup',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  player_of_match_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  winner_team char(1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Public insert matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update matches" ON public.matches FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete matches" ON public.matches FOR DELETE USING (true);
CREATE INDEX matches_match_date_idx ON public.matches (match_date DESC);

-- BALLS (ball-by-ball log)
CREATE TABLE public.balls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_number int NOT NULL,
  ball_index int NOT NULL,
  over_number int NOT NULL,
  ball_in_over int NOT NULL,
  bowler_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  striker_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  non_striker_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  runs int NOT NULL DEFAULT 0,
  extra_type text,
  extra_runs int NOT NULL DEFAULT 0,
  is_legal_ball boolean NOT NULL DEFAULT true,
  is_wicket boolean NOT NULL DEFAULT false,
  wicket_type text,
  out_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  fielder_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  new_batsman_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  commentary text,
  batting_team char(1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balls TO anon, authenticated;
GRANT ALL ON public.balls TO service_role;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read balls" ON public.balls FOR SELECT USING (true);
CREATE POLICY "Public insert balls" ON public.balls FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update balls" ON public.balls FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete balls" ON public.balls FOR DELETE USING (true);
CREATE INDEX balls_match_idx ON public.balls (match_id, innings_number, ball_index);
CREATE INDEX balls_striker_idx ON public.balls (striker_id);
CREATE INDEX balls_bowler_idx ON public.balls (bowler_id);

-- updated_at trigger for matches
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER matches_touch_updated_at BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Role system for admin-gated writes
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Replace permissive write policies with admin-gated ones
-- balls
DROP POLICY IF EXISTS "Authenticated insert balls" ON public.balls;
DROP POLICY IF EXISTS "Authenticated update balls" ON public.balls;
DROP POLICY IF EXISTS "Authenticated delete balls" ON public.balls;
CREATE POLICY "Admins insert balls" ON public.balls
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update balls" ON public.balls
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete balls" ON public.balls
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- matches
DROP POLICY IF EXISTS "Authenticated insert matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated update matches" ON public.matches;
DROP POLICY IF EXISTS "Authenticated delete matches" ON public.matches;
CREATE POLICY "Admins insert matches" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update matches" ON public.matches
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete matches" ON public.matches
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- players
DROP POLICY IF EXISTS "Authenticated insert players" ON public.players;
DROP POLICY IF EXISTS "Authenticated update players" ON public.players;
DROP POLICY IF EXISTS "Authenticated delete players" ON public.players;
CREATE POLICY "Admins insert players" ON public.players
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update players" ON public.players
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete players" ON public.players
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- storage.objects for player-photos
DROP POLICY IF EXISTS "Authenticated upload player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete player-photos" ON storage.objects;
CREATE POLICY "Admins upload player-photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update player-photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete player-photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_users (username, password_hash)
VALUES (
  'brajmaster',
  'f6412bd354418eb6e2bc75d56ba896d9b9f6d0047d6a0ee0d9782f6ec5528d65'
)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash;

GRANT ALL ON public.app_users TO service_role;
GRANT ALL ON public.app_sessions TO service_role;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public app user access" ON public.app_users;
DROP POLICY IF EXISTS "No public app session access" ON public.app_sessions;

CREATE POLICY "No public app user access"
  ON public.app_users
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No public app session access"
  ON public.app_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_app_sessions_token_hash
  ON public.app_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
  ON public.app_sessions (expires_at);

CREATE OR REPLACE FUNCTION public.login_app_user(
  p_username text,
  p_password_hash text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE(id uuid, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_user public.app_users%ROWTYPE;
BEGIN
  SELECT *
  INTO matched_user
  FROM public.app_users au
  WHERE au.username = p_username
    AND au.password_hash = p_password_hash;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.app_sessions (user_id, token_hash, expires_at)
  VALUES (matched_user.id, p_token_hash, p_expires_at);

  id := matched_user.id;
  username := matched_user.username;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_app_session(p_token_hash text)
RETURNS TABLE(id uuid, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.app_sessions
  WHERE expires_at <= now();

  RETURN QUERY
  SELECT au.id, au.username
  FROM public.app_sessions s
  JOIN public.app_users au ON au.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.expires_at > now()
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_app_session(p_token_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.app_sessions
  WHERE token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION public.login_app_user(text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_app_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_app_session(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_app_user(text, text, text, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_app_session(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_app_session(text) TO anon, authenticated, service_role;

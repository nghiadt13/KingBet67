-- Phase 14 multi-league bootstrap migration
-- Run in Supabase SQL editor if public.leagues does not exist.

CREATE TABLE IF NOT EXISTS public.leagues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(120) NOT NULL,
  country     VARCHAR(80),
  emblem_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id);

CREATE INDEX IF NOT EXISTS idx_matches_league_id ON public.matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_status_date ON public.matches(league_id, status, utc_date);

INSERT INTO public.leagues (code, name, country, is_active)
VALUES
  ('PL', 'Premier League', 'England', true),
  ('CL', 'UEFA Champions League', 'Europe', true),
  ('EL', 'UEFA Europa League', 'Europe', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  country = EXCLUDED.country,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read leagues" ON public.leagues;
CREATE POLICY "Everyone can read leagues"
  ON public.leagues FOR SELECT USING (true);

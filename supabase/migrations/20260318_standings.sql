-- ============================================
-- Standings table — League standings with group support
-- ============================================

CREATE TABLE IF NOT EXISTS public.standings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  group_name       VARCHAR(30) NOT NULL DEFAULT 'LEAGUE',
  stage            VARCHAR(30) NOT NULL DEFAULT 'REGULAR_SEASON',
  position         INTEGER NOT NULL DEFAULT 0,
  played_games     INTEGER NOT NULL DEFAULT 0,
  won              INTEGER NOT NULL DEFAULT 0,
  draw             INTEGER NOT NULL DEFAULT 0,
  lost             INTEGER NOT NULL DEFAULT 0,
  goals_for        INTEGER NOT NULL DEFAULT 0,
  goals_against    INTEGER NOT NULL DEFAULT 0,
  goal_difference  INTEGER NOT NULL DEFAULT 0,
  points           INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, team_id, group_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_standings_league ON standings(league_id, group_name, position);
CREATE INDEX IF NOT EXISTS idx_standings_team ON standings(team_id);

-- RLS
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read standings" ON public.standings;
CREATE POLICY "Everyone can read standings" ON public.standings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage standings" ON public.standings;
CREATE POLICY "Admin can manage standings" ON public.standings
  FOR ALL USING (is_admin());

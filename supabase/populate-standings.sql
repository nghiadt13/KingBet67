-- ============================================
-- Populate standings table from existing teams + matches data
-- Run this on Supabase SQL Editor AFTER creating the standings table
-- ============================================

-- First, clear any old data
TRUNCATE TABLE standings;

-- Populate standings by finding distinct team-league pairs from matches,
-- then using team stats from the teams table
INSERT INTO standings (
  league_id, team_id, group_name, stage,
  position, played_games, won, draw, lost,
  goals_for, goals_against, goal_difference, points,
  updated_at
)
SELECT DISTINCT ON (sub.league_id, sub.team_id)
  sub.league_id,
  sub.team_id,
  'LEAGUE' AS group_name,
  'REGULAR_SEASON' AS stage,
  COALESCE(t.position, 0),
  COALESCE(t.played_games, 0),
  COALESCE(t.won, 0),
  COALESCE(t.draw, 0),
  COALESCE(t.lost, 0),
  -- goals_for can be derived: (goal_difference + goals_against), but we don't have goals_against
  -- so approximate: goals_for = won*2 + draw (rough avg), goals_against = goals_for - goal_difference
  GREATEST(COALESCE(t.won, 0) * 2 + COALESCE(t.draw, 0), 0) AS goals_for,
  GREATEST(COALESCE(t.won, 0) * 2 + COALESCE(t.draw, 0) - COALESCE(t.goal_difference, 0), 0) AS goals_against,
  COALESCE(t.goal_difference, 0),
  COALESCE(t.points, 0),
  NOW()
FROM (
  -- Get all team-league pairs from matches
  SELECT m.league_id, m.home_team_id AS team_id
  FROM matches m
  WHERE m.home_team_id IS NOT NULL
  UNION
  SELECT m.league_id, m.away_team_id AS team_id
  FROM matches m
  WHERE m.away_team_id IS NOT NULL
) sub
INNER JOIN teams t ON t.id = sub.team_id
WHERE t.position IS NOT NULL AND t.position > 0
ON CONFLICT (league_id, team_id, group_name) DO UPDATE SET
  position = EXCLUDED.position,
  played_games = EXCLUDED.played_games,
  won = EXCLUDED.won,
  draw = EXCLUDED.draw,
  lost = EXCLUDED.lost,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  goal_difference = EXCLUDED.goal_difference,
  points = EXCLUDED.points,
  updated_at = NOW();

-- Verify: count standings per league
SELECT l.name, l.code, COUNT(*) AS teams
FROM standings s
JOIN leagues l ON l.id = s.league_id
GROUP BY l.name, l.code
ORDER BY l.code;

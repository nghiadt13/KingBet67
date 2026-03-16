# Phase 1: Edge Function Setup + Core Sync Logic

## Context

- [API Contract: sync-matches](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L296-L328)
- [DB Schema: teams table](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L30-L52)
- [DB Schema: matches table](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L54-L91)
- [Business Rules: Sync](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L128-L135)
- [Business Rules: Matches](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L88-L95)

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** ~2h

Tạo Edge Function `sync-matches` với logic core: fetch data từ football-data.org → transform → upsert vào DB.

## Requirements

### Functional
- Fetch `GET /v4/competitions/PL/matches` (all matches)
- Fetch `GET /v4/competitions/PL/standings` (standings table)
- Upsert 20 teams với: name, short_name, tla, crest_url, position, points, played_games, won, draw, lost, goal_difference
- Upsert matches với: external_id, matchday, utc_date, status, home_team_id, away_team_id, home_score, away_score, half_time_home, half_time_away
- Return `{ teams_updated, matches_updated }`

### Non-functional
- Rate limit: chỉ 2 API calls per sync (free tier = 10 req/min) (BR-J04)
- Resilience: nếu API fail → return error, không crash (BR-J05)
- Auth: service_role key để bypass RLS
- CORS: cho phép gọi từ app (admin "Sync Now") và từ cron

## Architecture

```
External Cron (cron-job.org)
        │
        ▼
┌──────────────────────────────────┐
│   Edge Function: sync-matches   │
│                                  │
│  1. Fetch /matches from API      │
│  2. Fetch /standings from API    │
│  3. Upsert teams (standings)     │
│  4. Upsert matches               │
│  5. Calculate odds (Phase 2)     │
│  6. Return summary               │
│                                  │
│  Uses: service_role key          │
│  Secrets: FOOTBALL_DATA_API_KEY  │
└──────────────────────────────────┘
```

## football-data.org API Response Format

### GET /v4/competitions/PL/matches

```json
{
  "matches": [
    {
      "id": 428289,
      "utcDate": "2025-01-15T20:00:00Z",
      "matchday": 21,
      "status": "FINISHED",
      "homeTeam": {
        "id": 57,
        "name": "Arsenal FC",
        "shortName": "Arsenal",
        "tla": "ARS",
        "crest": "https://crests.football-data.org/57.png"
      },
      "awayTeam": {
        "id": 61,
        "name": "Chelsea FC",
        "shortName": "Chelsea",
        "tla": "CHE",
        "crest": "https://crests.football-data.org/61.png"
      },
      "score": {
        "winner": "HOME_TEAM",
        "fullTime": { "home": 2, "away": 0 },
        "halfTime": { "home": 1, "away": 0 }
      }
    }
  ],
  "resultSet": { "count": 380 }
}
```

### GET /v4/competitions/PL/standings

```json
{
  "standings": [
    {
      "type": "TOTAL",
      "table": [
        {
          "position": 1,
          "team": {
            "id": 57,
            "name": "Arsenal FC",
            "shortName": "Arsenal",
            "tla": "ARS",
            "crest": "https://crests.football-data.org/57.png"
          },
          "playedGames": 21,
          "won": 15,
          "draw": 4,
          "lost": 2,
          "points": 49,
          "goalsFor": 45,
          "goalsAgainst": 18,
          "goalDifference": 27
        }
      ]
    }
  ]
}
```

## Related Code Files

### New files
- `supabase/functions/sync-matches/index.ts` — main Edge Function

### Existing files (reference only, no changes)
- [supabase.ts](file:///d:/works/vsc_test/lib/supabase.ts) — client pattern reference
- [database.ts](file:///d:/works/vsc_test/types/database.ts) — type definitions
- [schema.sql](file:///d:/works/vsc_test/supabase/schema.sql) — DB schema reference

## Implementation Steps

### 1. Initialize Edge Function directory

```bash
# Tạo structure thủ công (không cần supabase CLI init)
mkdir -p supabase/functions/sync-matches
```

### 2. Create `supabase/functions/sync-matches/index.ts`

```typescript
// Deno Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Init Supabase Admin Client (service_role bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY")!;
    const headers = { "X-Auth-Token": apiKey };

    // 2. Fetch standings
    const standingsRes = await fetch(
      "https://api.football-data.org/v4/competitions/PL/standings",
      { headers }
    );
    if (!standingsRes.ok) throw new Error(`Standings API error: ${standingsRes.status}`);
    const standingsData = await standingsRes.json();

    // 3. Fetch matches
    const matchesRes = await fetch(
      "https://api.football-data.org/v4/competitions/PL/matches",
      { headers }
    );
    if (!matchesRes.ok) throw new Error(`Matches API error: ${matchesRes.status}`);
    const matchesData = await matchesRes.json();

    // 4. Upsert teams from standings
    // 5. Upsert matches with team ID lookup
    // 6. Calculate odds (Phase 2)
    // 7. Return summary

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 3. Teams upsert logic

```typescript
// Extract TOTAL standings table
const table = standingsData.standings
  .find((s: any) => s.type === "TOTAL")?.table ?? [];

// Build team data for upsert
const teamsToUpsert = table.map((entry: any) => ({
  external_id: entry.team.id,
  name: entry.team.name,
  short_name: entry.team.shortName,
  tla: entry.team.tla,
  crest_url: entry.team.crest,
  position: entry.position,
  points: entry.points,
  played_games: entry.playedGames,
  won: entry.won,
  draw: entry.draw,
  lost: entry.lost,
  goal_difference: entry.goalDifference,
  updated_at: new Date().toISOString(),
}));

// Upsert using external_id as conflict key
const { error: teamsError } = await supabaseAdmin
  .from("teams")
  .upsert(teamsToUpsert, { onConflict: "external_id" });

if (teamsError) throw new Error(`Teams upsert failed: ${teamsError.message}`);
```

### 4. Build external_id → UUID lookup map

```typescript
// After teams upsert, get all teams to build ID map
const { data: dbTeams, error: lookupError } = await supabaseAdmin
  .from("teams")
  .select("id, external_id");

if (lookupError) throw new Error(`Team lookup failed: ${lookupError.message}`);

const teamIdMap = new Map<number, string>();
for (const t of dbTeams!) {
  teamIdMap.set(t.external_id, t.id);
}
```

### 5. Matches upsert logic

```typescript
const matchesToUpsert = matchesData.matches.map((m: any) => ({
  external_id: m.id,
  matchday: m.matchday,
  utc_date: m.utcDate,
  status: m.status,
  home_team_id: teamIdMap.get(m.homeTeam.id),
  away_team_id: teamIdMap.get(m.awayTeam.id),
  home_score: m.score?.fullTime?.home ?? null,
  away_score: m.score?.fullTime?.away ?? null,
  half_time_home: m.score?.halfTime?.home ?? null,
  half_time_away: m.score?.halfTime?.away ?? null,
  updated_at: new Date().toISOString(),
}));

// Filter out matches with missing team IDs
const validMatches = matchesToUpsert.filter(
  (m: any) => m.home_team_id && m.away_team_id
);

const { error: matchesError } = await supabaseAdmin
  .from("matches")
  .upsert(validMatches, { onConflict: "external_id" });

if (matchesError) throw new Error(`Matches upsert failed: ${matchesError.message}`);
```

### 6. Create CORS shared helper

```bash
mkdir -p supabase/functions/_shared
```

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

## Todo List

- [x] Create `supabase/functions/_shared/cors.ts`
- [x] Create `supabase/functions/sync-matches/index.ts`
- [x] Implement fetch standings + matches from football-data.org
- [x] Implement teams upsert (external_id conflict resolution)
- [x] Implement team ID lookup map (external_id → UUID)
- [x] Implement matches upsert (with team ID mapping)
- [x] Error handling: API failures, DB errors
- [x] Return summary JSON response

## Success Criteria

- Edge Function code compiles (Deno syntax)
- Handles CORS preflight
- Fetches data from football-data.org with API key auth
- Correctly maps API response fields → DB columns
- Upserts teams without duplicates (external_id unique)
- Upserts matches with correct team UUID references
- Returns `{ teams_updated, matches_updated }` on success
- Returns `{ error }` on failure

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API rate limit exceeded | Low | Medium | Only 2 calls per sync, well within limit |
| API response format change | Low | High | Pin to v4 endpoint, validate response |
| Team ID not found in map | Low | Medium | Filter out matches with missing team IDs |
| Supabase upsert failure | Low | High | Wrap in try/catch, return error detail |

## Security

- `FOOTBALL_DATA_API_KEY` stored as Supabase secret, never in code
- `SUPABASE_SERVICE_ROLE_KEY` auto-available in Edge Functions
- No user input validation needed (function fetches from trusted source)

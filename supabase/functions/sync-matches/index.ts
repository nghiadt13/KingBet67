// Deno Edge Function: sync-matches
// Fetches matches + standings from football-data.org → upserts into DB → calculates odds
// Runs via external cron (every 10 min) or admin "Sync Now" button

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// ODDS CALCULATION (Phase 2)
// ============================================================

const HOME_ADV = 0.1;
const MARGIN = 1.05;
const DRAW_BASE = 0.26; // ~26% of PL matches end in draw

function clampOdds(odds: number): number {
  return Math.round(Math.max(odds, 1.1) * 100) / 100;
}

// 1X2
function calcMatchResult(homePos: number, awayPos: number) {
  const homeStrength = (21 - homePos) / 20;
  const awayStrength = (21 - awayPos) / 20;
  const adjHome = homeStrength * (1 + HOME_ADV);
  const total = adjHome + awayStrength;

  const homeProb = (adjHome / total) * (1 - DRAW_BASE);
  const awayProb = (awayStrength / total) * (1 - DRAW_BASE);

  return {
    home: clampOdds(MARGIN / homeProb),
    draw: clampOdds(MARGIN / DRAW_BASE),
    away: clampOdds(MARGIN / awayProb),
  };
}

// Over/Under 2.5
function calcOverUnder(homePos: number, awayPos: number) {
  const avgStrength = ((21 - homePos) + (21 - awayPos)) / 40;
  const overProb = 0.45 + avgStrength * 0.15;
  const underProb = 1 - overProb;

  return {
    over: clampOdds(MARGIN / overProb),
    under: clampOdds(MARGIN / underProb),
  };
}

// BTTS
function calcBTTS(homePos: number, awayPos: number) {
  const posDiff = Math.abs(homePos - awayPos);
  const bttsProb = 0.52 - (posDiff / 20) * 0.15;

  return {
    yes: clampOdds(MARGIN / bttsProb),
    no: clampOdds(MARGIN / (1 - bttsProb)),
  };
}

// Half Time 1X2
function calcHalfTime(homePos: number, awayPos: number) {
  const matchResult = calcMatchResult(homePos, awayPos);

  return {
    home: clampOdds(matchResult.home * 1.35),
    draw: clampOdds(matchResult.draw / 1.6),
    away: clampOdds(matchResult.away * 1.5),
  };
}

// Correct Score (24 scores)
const CORRECT_SCORES = [
  "0-0", "1-0", "0-1", "2-0", "0-2", "2-1", "1-2",
  "3-0", "0-3", "3-1", "1-3", "3-2", "2-3",
  "4-0", "0-4", "4-1", "1-4", "4-2", "2-4", "4-3", "3-4",
  "1-1", "2-2", "3-3",
];

const BASE_FREQ: Record<string, number> = {
  "1-0": 0.10, "0-1": 0.08, "0-0": 0.07,
  "2-1": 0.09, "1-2": 0.06, "2-0": 0.06, "0-2": 0.04,
  "1-1": 0.11, "3-1": 0.04, "1-3": 0.02,
  "3-0": 0.03, "0-3": 0.02, "2-2": 0.04,
  "3-2": 0.02, "2-3": 0.01, "4-0": 0.01, "0-4": 0.01,
  "4-1": 0.01, "1-4": 0.005, "4-2": 0.005, "2-4": 0.005,
  "4-3": 0.003, "3-4": 0.002, "3-3": 0.005,
};

function calcCorrectScore(homePos: number, awayPos: number) {
  const matchResult = calcMatchResult(homePos, awayPos);
  const homeProb = 1 / matchResult.home;
  const result: Record<string, number> = {};

  for (const score of CORRECT_SCORES) {
    const [h, a] = score.split("-").map(Number);
    let freq = BASE_FREQ[score] ?? 0.005;

    if (h > a) freq *= homeProb * 1.5;
    else if (a > h) freq *= (1 - homeProb) * 1.5;

    result[score] = Math.round(Math.max(MARGIN / freq, 5.0) * 100) / 100;
  }

  return result;
}

function calculateOdds(homePos: number, awayPos: number) {
  return {
    match_result: calcMatchResult(homePos, awayPos),
    over_under: calcOverUnder(homePos, awayPos),
    btts: calcBTTS(homePos, awayPos),
    half_time: calcHalfTime(homePos, awayPos),
    correct_score: calcCorrectScore(homePos, awayPos),
  };
}

// ============================================================
// MAIN EDGE FUNCTION
// ============================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Init Supabase admin client (service_role bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
    if (!apiKey) {
      throw new Error("FOOTBALL_DATA_API_KEY secret not set");
    }
    const headers = { "X-Auth-Token": apiKey };

    // 2. Fetch standings from football-data.org
    const standingsRes = await fetch(
      "https://api.football-data.org/v4/competitions/PL/standings",
      { headers },
    );
    if (!standingsRes.ok) {
      throw new Error(`Standings API error: ${standingsRes.status}`);
    }
    const standingsData = await standingsRes.json();

    // 3. Fetch matches from football-data.org
    const matchesRes = await fetch(
      "https://api.football-data.org/v4/competitions/PL/matches",
      { headers },
    );
    if (!matchesRes.ok) {
      throw new Error(`Matches API error: ${matchesRes.status}`);
    }
    const matchesData = await matchesRes.json();

    // 4. Upsert teams from standings
    // deno-lint-ignore no-explicit-any
    const table = standingsData.standings
      ?.find((s: any) => s.type === "TOTAL")?.table ?? [];

    // deno-lint-ignore no-explicit-any
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

    const { error: teamsError } = await supabaseAdmin
      .from("teams")
      .upsert(teamsToUpsert, { onConflict: "external_id" });

    if (teamsError) {
      throw new Error(`Teams upsert failed: ${teamsError.message}`);
    }

    // 5. Build external_id → UUID lookup map
    const { data: dbTeams, error: lookupError } = await supabaseAdmin
      .from("teams")
      .select("id, external_id, position");

    if (lookupError) {
      throw new Error(`Team lookup failed: ${lookupError.message}`);
    }

    const teamIdMap = new Map<number, string>();
    const posMap = new Map<string, number>();
    for (const t of dbTeams!) {
      teamIdMap.set(t.external_id, t.id);
      posMap.set(t.id, t.position ?? 10);
    }

    // 6. Upsert matches
    // deno-lint-ignore no-explicit-any
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
    // deno-lint-ignore no-explicit-any
    const validMatches = matchesToUpsert.filter(
      (m: any) => m.home_team_id && m.away_team_id,
    );

    const { error: matchesError } = await supabaseAdmin
      .from("matches")
      .upsert(validMatches, { onConflict: "external_id" });

    if (matchesError) {
      throw new Error(`Matches upsert failed: ${matchesError.message}`);
    }

    // 7. Calculate odds for TIMED/SCHEDULED matches (BR-E07)
    const { data: scheduledMatches } = await supabaseAdmin
      .from("matches")
      .select("id, home_team_id, away_team_id")
      .in("status", ["TIMED", "SCHEDULED"]);

    let oddsCalculated = 0;
    for (const match of scheduledMatches ?? []) {
      const homePos = posMap.get(match.home_team_id) ?? 10;
      const awayPos = posMap.get(match.away_team_id) ?? 10;
      const odds = calculateOdds(homePos, awayPos);

      await supabaseAdmin
        .from("matches")
        .update({ odds })
        .eq("id", match.id);

      oddsCalculated++;
    }

    // 8. Auto-settle FINISHED and CANCELLED matches (BR-G03, BR-J03, BR-F04)
    const { data: unsettledMatches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .in("status", ["FINISHED", "CANCELLED"])
      .eq("is_settled", false);

    let matchesSettled = 0;
    let betsSettled = 0;
    let totalWinnings = 0;

    for (const match of unsettledMatches ?? []) {
      try {
        const { data } = await supabaseAdmin
          .rpc("settle_match_bets", { p_match_id: match.id });

        if (data) {
          matchesSettled++;
          betsSettled += (data.bets_won ?? 0) + (data.bets_lost ?? 0);
          totalWinnings += data.total_winnings ?? 0;
        }
      } catch (e) {
        console.error(`[sync-matches] settle ${match.id} failed:`, e);
      }
    }

    // 9. Return summary
    const summary = {
      teams_updated: teamsToUpsert.length,
      matches_updated: validMatches.length,
      odds_calculated: oddsCalculated,
      matches_settled: matchesSettled,
      bets_settled: betsSettled,
      total_winnings: totalWinnings,
      timestamp: new Date().toISOString(),
    };

    console.log("[sync-matches] Success:", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[sync-matches] Error:", error.message);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

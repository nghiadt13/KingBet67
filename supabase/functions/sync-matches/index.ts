// Deno Edge Function: sync-matches
// Fetches leagues + matches from football-data.org -> upserts DB -> calculates odds -> settles finished bets
// Runs via external cron or admin "Sync Now" button

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const HOME_ADV = 0.1;
const MARGIN = 1.05;
const DRAW_BASE = 0.26;

const COMPETITIONS_ENDPOINT = "https://api.football-data.org/v4/competitions";
const CORE_LEAGUE_CODES = ["PL", "CL", "BL1", "SA", "PD", "FL1"];
const API_THROTTLE_MS = 250;

// The Odds API integration
const ODDS_API_BASE = "https://api.the-odds-api.com/v4/sports";
const LEAGUE_TO_ODDS_SPORT: Record<string, string> = {
  PL: "soccer_epl",
  CL: "soccer_uefa_champs_league",
  EL: "soccer_uefa_europa_league",
  BL1: "soccer_germany_bundesliga",
  SA: "soccer_italy_serie_a",
  PD: "soccer_spain_la_liga",
  FL1: "soccer_france_ligue_one",
};

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/fc|cf|sc|afc|ssc|ac|as/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function fuzzyTeamMatch(apiName: string, dbName: string): boolean {
  const a = normalizeTeamName(apiName);
  const b = normalizeTeamName(dbName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Check if first 4 chars match (e.g. "arse" for Arsenal)
  if (a.length >= 4 && b.length >= 4 && a.substring(0, 4) === b.substring(0, 4)) return true;
  return false;
}

type LeagueRow = {
  id: string;
  code: string;
  name: string;
  country: string | null;
  is_active: boolean;
};

type TeamRow = {
  id: string;
  external_id: number;
  position: number | null;
};

function clampOdds(odds: number): number {
  return Math.round(Math.max(odds, 1.1) * 100) / 100;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`API error ${res.status} at ${url}`);
  }
  return res.json();
}

function isVietnamCompetition(comp: any): boolean {
  const name = `${comp?.name ?? ""} ${comp?.area?.name ?? ""}`.toLowerCase();
  return name.includes("viet") || name.includes("vietnam");
}

function calcMatchResult(homePos: number, awayPos: number) {
  const homeStrength = (21 - homePos) / 20;
  const awayStrength = (21 - awayPos) / 20;
  const adjHome = homeStrength * (1 + HOME_ADV);
  const total = adjHome + awayStrength;

  const posDiff = Math.abs(homePos - awayPos);
  const drawProb = DRAW_BASE + (1 - posDiff / 19) * 0.06 - 0.03;

  const homeProb = (adjHome / total) * (1 - drawProb);
  const awayProb = (awayStrength / total) * (1 - drawProb);

  return {
    home: clampOdds(MARGIN / homeProb),
    draw: clampOdds(MARGIN / drawProb),
    away: clampOdds(MARGIN / awayProb),
  };
}

function calcOverUnder(homePos: number, awayPos: number) {
  const avgStrength = ((21 - homePos) + (21 - awayPos)) / 40;
  const overProb = 0.45 + avgStrength * 0.15;
  const underProb = 1 - overProb;

  return {
    over: clampOdds(MARGIN / overProb),
    under: clampOdds(MARGIN / underProb),
  };
}

function calcBTTS(homePos: number, awayPos: number) {
  const posDiff = Math.abs(homePos - awayPos);
  const bttsProb = 0.52 - (posDiff / 20) * 0.15;

  return {
    yes: clampOdds(MARGIN / bttsProb),
    no: clampOdds(MARGIN / (1 - bttsProb)),
  };
}

function calcHalfTime(homePos: number, awayPos: number) {
  const matchResult = calcMatchResult(homePos, awayPos);

  return {
    home: clampOdds(matchResult.home * 1.35),
    draw: clampOdds(matchResult.draw / 1.6),
    away: clampOdds(matchResult.away * 1.5),
  };
}

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

function calcOverUnder15(homePos: number, awayPos: number) {
  const avgStrength = ((21 - homePos) + (21 - awayPos)) / 40;
  const overProb = 0.62 + avgStrength * 0.12;
  return {
    over: clampOdds(MARGIN / overProb),
    under: clampOdds(MARGIN / (1 - overProb)),
  };
}

function calcOverUnder35(homePos: number, awayPos: number) {
  const avgStrength = ((21 - homePos) + (21 - awayPos)) / 40;
  const overProb = 0.30 + avgStrength * 0.18;
  return {
    over: clampOdds(MARGIN / overProb),
    under: clampOdds(MARGIN / (1 - overProb)),
  };
}

function calcSpreads(homePos: number, awayPos: number) {
  const posDiff = awayPos - homePos;
  let line = 0;
  if (posDiff >= 8) line = -1.5;
  else if (posDiff >= 4) line = -1;
  else if (posDiff >= 1) line = -0.5;
  else if (posDiff <= -8) line = 1.5;
  else if (posDiff <= -4) line = 1;
  else if (posDiff <= -1) line = 0.5;

  const homeStrength = (21 - homePos) / 20;
  const awayStrength = (21 - awayPos) / 20;
  const adjHome = homeStrength * (1 + HOME_ADV);
  const total = adjHome + awayStrength;
  const homeProb = adjHome / total;

  return {
    home: clampOdds(MARGIN / homeProb),
    away: clampOdds(MARGIN / (1 - homeProb)),
    line,
  };
}

function calculateOdds(homePos: number, awayPos: number) {
  return {
    match_result: calcMatchResult(homePos, awayPos),
    over_under: calcOverUnder(homePos, awayPos),
    over_under_1_5: calcOverUnder15(homePos, awayPos),
    over_under_3_5: calcOverUnder35(homePos, awayPos),
    btts: calcBTTS(homePos, awayPos),
    half_time: calcHalfTime(homePos, awayPos),
    correct_score: calcCorrectScore(homePos, awayPos),
    spreads: calcSpreads(homePos, awayPos),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
    if (!apiKey) {
      throw new Error("FOOTBALL_DATA_API_KEY secret not set");
    }
    const headers = { "X-Auth-Token": apiKey };

    let competitions: any[] = [];
    try {
      const catalog = await fetchJson(COMPETITIONS_ENDPOINT, headers);
      competitions = catalog?.competitions ?? [];
    } catch (catalogErr) {
      console.warn("[sync-matches] competitions discovery failed, fallback to DB-only leagues", catalogErr);
    }

    const discoveredPreferred = competitions.filter((comp) =>
      CORE_LEAGUE_CODES.includes(comp?.code) || isVietnamCompetition(comp)
    );

    const leaguesToUpsert = discoveredPreferred.map((comp) => ({
      code: comp.code,
      name: comp.name,
      country: comp.area?.name ?? null,
      emblem_url: comp.emblem ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    // Ensure PL always exists and stays active as safe fallback
    leaguesToUpsert.push({
      code: "PL",
      name: "Premier League",
      country: "England",
      emblem_url: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    // Avoid duplicate codes (e.g. PL from discovery + fallback row)
    const dedupedLeaguesToUpsert = Array.from(
      new Map(leaguesToUpsert.map((row) => [row.code, row])).values(),
    );

    const { error: leagueUpsertError } = await supabaseAdmin
      .from("leagues")
      .upsert(dedupedLeaguesToUpsert, { onConflict: "code" });

    if (leagueUpsertError) {
      throw new Error(`Leagues upsert failed: ${leagueUpsertError.message}`);
    }

    const { data: activeLeagues, error: leagueLookupError } = await supabaseAdmin
      .from("leagues")
      .select("id, code, name, country, is_active")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (leagueLookupError) {
      throw new Error(`League lookup failed: ${leagueLookupError.message}`);
    }

    const leagues: LeagueRow[] = activeLeagues ?? [];
    if (leagues.length === 0) {
      throw new Error("No active leagues found after discovery/upsert");
    }

    let teamsUpdated = 0;
    let matchesUpdated = 0;
    let oddsCalculated = 0;
    const leagueSummaries: Array<{ code: string; teams: number; matches: number; odds: number; warning?: string }> = [];

    for (const league of leagues) {
      let leagueTeamsUpdated = 0;
      let leagueMatchesUpdated = 0;
      let leagueOddsCalculated = 0;

      try {
        // Standings: non-blocking — EL / CL may use groups instead of TOTAL table
        let standingsTable: any[] = [];
        let rawStandingsGroups: any[] = []; // preserve group info for standings table
        try {
          await sleep(API_THROTTLE_MS);
          const standingsData = await fetchJson(
            `https://api.football-data.org/v4/competitions/${league.code}/standings`,
            headers,
          );

          // Save raw standings with group info for the standings table
          rawStandingsGroups = (standingsData?.standings ?? []).filter(
            (s: any) => s.type === "TOTAL" && s.table && Array.isArray(s.table)
          );

          // Try TOTAL first (PL, single-league-phase EL 2024+), then fallback to first group
          standingsTable = standingsData?.standings
            ?.find((s: any) => s.type === "TOTAL")?.table ?? [];
          
          // Fallback: if no TOTAL standings (group-based tournaments), collect all groups
          if (standingsTable.length === 0 && standingsData?.standings?.length > 0) {
            for (const standing of standingsData.standings) {
              if (standing.table && Array.isArray(standing.table)) {
                standingsTable.push(...standing.table);
              }
            }
          }
        } catch (standingsErr) {
          console.warn(`[sync-matches] standings unavailable for ${league.code}, using defaults:`, 
            standingsErr instanceof Error ? standingsErr.message : String(standingsErr));
        }

        await sleep(API_THROTTLE_MS);
        const matchesData = await fetchJson(
          `https://api.football-data.org/v4/competitions/${league.code}/matches`,
          headers,
        );

        const positionByExternalTeamId = new Map<number, number>();
        const teamPayloadByExternalId = new Map<number, any>();

        for (const entry of standingsTable) {
          positionByExternalTeamId.set(entry.team.id, entry.position ?? 10);
          teamPayloadByExternalId.set(entry.team.id, {
            external_id: entry.team.id,
            name: entry.team.name,
            short_name: entry.team.shortName ?? entry.team.name,
            tla: entry.team.tla ?? "UNK",
            crest_url: entry.team.crest ?? null,
            position: entry.position ?? null,
            points: entry.points ?? 0,
            played_games: entry.playedGames ?? 0,
            won: entry.won ?? 0,
            draw: entry.draw ?? 0,
            lost: entry.lost ?? 0,
            goal_difference: entry.goalDifference ?? 0,
            updated_at: new Date().toISOString(),
          });
        }

        for (const m of matchesData?.matches ?? []) {
          const home = m?.homeTeam;
          const away = m?.awayTeam;
          if (home?.id && !teamPayloadByExternalId.has(home.id)) {
            teamPayloadByExternalId.set(home.id, {
              external_id: home.id,
              name: home.name,
              short_name: home.shortName ?? home.name,
              tla: home.tla ?? "UNK",
              crest_url: home.crest ?? null,
              position: null,
              points: 0,
              played_games: 0,
              won: 0,
              draw: 0,
              lost: 0,
              goal_difference: 0,
              updated_at: new Date().toISOString(),
            });
          }
          if (away?.id && !teamPayloadByExternalId.has(away.id)) {
            teamPayloadByExternalId.set(away.id, {
              external_id: away.id,
              name: away.name,
              short_name: away.shortName ?? away.name,
              tla: away.tla ?? "UNK",
              crest_url: away.crest ?? null,
              position: null,
              points: 0,
              played_games: 0,
              won: 0,
              draw: 0,
              lost: 0,
              goal_difference: 0,
              updated_at: new Date().toISOString(),
            });
          }
        }

        const teamsToUpsert = Array.from(teamPayloadByExternalId.values());
        if (teamsToUpsert.length > 0) {
          const { error: teamsError } = await supabaseAdmin
            .from("teams")
            .upsert(teamsToUpsert, { onConflict: "external_id" });

          if (teamsError) {
            throw new Error(`Teams upsert failed for ${league.code}: ${teamsError.message}`);
          }
          leagueTeamsUpdated = teamsToUpsert.length;
          teamsUpdated += teamsToUpsert.length;
        }

        const { data: dbTeams, error: lookupError } = await supabaseAdmin
          .from("teams")
          .select("id, external_id, position");

        if (lookupError) {
          throw new Error(`Team lookup failed for ${league.code}: ${lookupError.message}`);
        }

        const teamIdMap = new Map<number, string>();
        const fallbackPositionByTeamId = new Map<string, number>();
        for (const t of (dbTeams ?? []) as TeamRow[]) {
          teamIdMap.set(t.external_id, t.id);
          fallbackPositionByTeamId.set(t.id, t.position ?? 10);
        }

        const matchesToUpsert = (matchesData?.matches ?? []).map((m: any) => {
          const homeTeamId = teamIdMap.get(m.homeTeam.id);
          const awayTeamId = teamIdMap.get(m.awayTeam.id);

          const homePos = positionByExternalTeamId.get(m.homeTeam.id)
            ?? (homeTeamId ? fallbackPositionByTeamId.get(homeTeamId) : undefined)
            ?? 10;
          const awayPos = positionByExternalTeamId.get(m.awayTeam.id)
            ?? (awayTeamId ? fallbackPositionByTeamId.get(awayTeamId) : undefined)
            ?? 10;

          const isBettable = m.status === "TIMED" || m.status === "SCHEDULED";

          return {
            external_id: m.id,
            league_id: league.id,
            matchday: m.matchday ?? 0,
            utc_date: m.utcDate,
            status: m.status,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            half_time_home: m.score?.halfTime?.home ?? null,
            half_time_away: m.score?.halfTime?.away ?? null,
            odds: isBettable ? calculateOdds(homePos, awayPos) : null,
            updated_at: new Date().toISOString(),
          };
        });

        const validMatches = matchesToUpsert.filter((m: any) => m.home_team_id && m.away_team_id);

        if (validMatches.length > 0) {
          const { error: matchesError } = await supabaseAdmin
            .from("matches")
            .upsert(validMatches, { onConflict: "external_id" });

          if (matchesError) {
            throw new Error(`Matches upsert failed for ${league.code}: ${matchesError.message}`);
          }

          leagueMatchesUpdated = validMatches.length;
          matchesUpdated += validMatches.length;

          leagueOddsCalculated = validMatches.filter(
            (m: any) => m.status === "TIMED" || m.status === "SCHEDULED",
          ).length;
          oddsCalculated += leagueOddsCalculated;
        }

        // ---- Upsert standings with group info ----
        if (rawStandingsGroups.length > 0) {
          const standingsToUpsert: any[] = [];

          for (const standing of rawStandingsGroups) {
            const groupName = standing.group || "LEAGUE";
            const stage = standing.stage || "REGULAR_SEASON";

            for (const entry of standing.table ?? []) {
              const teamId = teamIdMap.get(entry.team.id);
              if (!teamId) continue;

              standingsToUpsert.push({
                league_id: league.id,
                team_id: teamId,
                group_name: groupName,
                stage,
                position: entry.position ?? 0,
                played_games: entry.playedGames ?? 0,
                won: entry.won ?? 0,
                draw: entry.draw ?? 0,
                lost: entry.lost ?? 0,
                goals_for: entry.goalsFor ?? 0,
                goals_against: entry.goalsAgainst ?? 0,
                goal_difference: entry.goalDifference ?? 0,
                points: entry.points ?? 0,
                updated_at: new Date().toISOString(),
              });
            }
          }

          if (standingsToUpsert.length > 0) {
            const { error: standingsError } = await supabaseAdmin
              .from("standings")
              .upsert(standingsToUpsert, { onConflict: "league_id,team_id,group_name" });

            if (standingsError) {
              console.warn(`[sync-matches] standings upsert failed for ${league.code}:`, standingsError.message);
            } else {
              console.log(`[sync-matches] standings upserted: ${standingsToUpsert.length} entries for ${league.code}`);
            }
          }
        }

        leagueSummaries.push({
          code: league.code,
          teams: leagueTeamsUpdated,
          matches: leagueMatchesUpdated,
          odds: leagueOddsCalculated,
        });
      } catch (leagueErr) {
        const errorMessage = leagueErr instanceof Error ? leagueErr.message : String(leagueErr);
        console.error(`[sync-matches] league ${league.code} failed:`, errorMessage);

        // If API returns 403 (not available on free tier), deactivate the league
        // so the UI doesn't show an empty filter chip
        if (errorMessage.includes("403")) {
          console.warn(`[sync-matches] Deactivating league ${league.code} — API 403 (not in subscription)`);
          await supabaseAdmin
            .from("leagues")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", league.id);
        }

        leagueSummaries.push({
          code: league.code,
          teams: leagueTeamsUpdated,
          matches: leagueMatchesUpdated,
          odds: leagueOddsCalculated,
          warning: errorMessage,
        });
      }
    }

    // ---- The Odds API: fetch real odds and merge ----
    const oddsApiKey = Deno.env.get("ODDS_API_KEY");
    let oddsApiRequestsUsed = 0;

    if (oddsApiKey) {
      for (const league of leagues) {
        const sportKey = LEAGUE_TO_ODDS_SPORT[league.code];
        if (!sportKey) continue;

        try {
          const oddsUrl = `${ODDS_API_BASE}/${sportKey}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
          const oddsRes = await fetch(oddsUrl);
          if (!oddsRes.ok) {
            console.warn(`[sync-matches] Odds API ${league.code} HTTP ${oddsRes.status}`);
            continue;
          }
          oddsApiRequestsUsed++;
          const oddsEvents: any[] = await oddsRes.json();

          // Fetch current DB matches for this league to match by team name
          const { data: dbMatches } = await supabaseAdmin
            .from("matches")
            .select("id, odds, home_team_id, away_team_id, status")
            .eq("league_id", league.id)
            .in("status", ["TIMED", "SCHEDULED"]);

          if (!dbMatches || dbMatches.length === 0) continue;

          // Build team name lookup
          const teamIds = [
            ...new Set(dbMatches.flatMap((m: any) => [m.home_team_id, m.away_team_id])),
          ];
          const { data: teamRows } = await supabaseAdmin
            .from("teams")
            .select("id, name, short_name")
            .in("id", teamIds);

          const teamNameById = new Map<string, { name: string; short_name: string }>();
          for (const t of teamRows ?? []) {
            teamNameById.set(t.id, { name: t.name, short_name: t.short_name });
          }

          // For each API event, find matching DB match
          for (const event of oddsEvents) {
            const apiHome = event.home_team ?? "";
            const apiAway = event.away_team ?? "";

            const matched = dbMatches.find((m: any) => {
              const dbHome = teamNameById.get(m.home_team_id);
              const dbAway = teamNameById.get(m.away_team_id);
              if (!dbHome || !dbAway) return false;
              return (
                (fuzzyTeamMatch(apiHome, dbHome.name) || fuzzyTeamMatch(apiHome, dbHome.short_name)) &&
                (fuzzyTeamMatch(apiAway, dbAway.name) || fuzzyTeamMatch(apiAway, dbAway.short_name))
              );
            });

            if (!matched) continue;

            const existingOdds = (matched.odds as any) ?? {};
            const bookmakers = event.bookmakers ?? [];
            if (bookmakers.length === 0) continue;

            // Use first bookmaker that has odds (usually the best coverage)
            const bk = bookmakers[0];

            for (const market of bk.markets ?? []) {
              if (market.key === "h2h") {
                const outcomes = market.outcomes ?? [];
                const homeOdd = outcomes.find((o: any) => o.name === apiHome);
                const awayOdd = outcomes.find((o: any) => o.name === apiAway);
                const drawOdd = outcomes.find((o: any) => o.name === "Draw");
                if (homeOdd && awayOdd && drawOdd) {
                  existingOdds.match_result = {
                    home: homeOdd.price,
                    draw: drawOdd.price,
                    away: awayOdd.price,
                  };
                }
              } else if (market.key === "totals") {
                const outcomes = market.outcomes ?? [];
                // Group by point value
                for (const oc of outcomes) {
                  const point = oc.point;
                  const key = oc.name === "Over" ? "over" : "under";

                  if (point === 1.5) {
                    existingOdds.over_under_1_5 = existingOdds.over_under_1_5 ?? {};
                    existingOdds.over_under_1_5[key] = oc.price;
                  } else if (point === 2.5) {
                    existingOdds.over_under = existingOdds.over_under ?? {};
                    existingOdds.over_under[key] = oc.price;
                  } else if (point === 3.5) {
                    existingOdds.over_under_3_5 = existingOdds.over_under_3_5 ?? {};
                    existingOdds.over_under_3_5[key] = oc.price;
                  }
                }
              } else if (market.key === "spreads") {
                const outcomes = market.outcomes ?? [];
                const homeSpread = outcomes.find((o: any) => o.name === apiHome);
                const awaySpread = outcomes.find((o: any) => o.name === apiAway);
                if (homeSpread && awaySpread) {
                  existingOdds.spreads = {
                    home: homeSpread.price,
                    away: awaySpread.price,
                    line: homeSpread.point ?? 0,
                  };
                }
              }
            }

            // Write merged odds back to DB
            await supabaseAdmin
              .from("matches")
              .update({ odds: existingOdds, updated_at: new Date().toISOString() })
              .eq("id", matched.id);
          }

          console.log(`[sync-matches] Odds API merged for ${league.code}: ${oddsEvents.length} events`);
        } catch (oddsErr) {
          console.warn(`[sync-matches] Odds API failed for ${league.code}:`, oddsErr);
        }
      }
    } else {
      console.log("[sync-matches] ODDS_API_KEY not set, using calculated odds only");
    }

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

    const summary = {
      leagues_active: leagues.length,
      leagues_discovered: discoveredPreferred.length,
      league_summaries: leagueSummaries,
      teams_updated: teamsUpdated,
      matches_updated: matchesUpdated,
      odds_calculated: oddsCalculated,
      odds_api_requests: oddsApiRequestsUsed,
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

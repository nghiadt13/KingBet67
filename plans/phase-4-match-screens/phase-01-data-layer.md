# Phase 1: Data Layer (Store + Types)

## Context

- [API Contract: Match queries](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L59-L105)
- [API Contract: Standings query](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L109-L116)
- [Existing authStore](file:///d:/works/vsc_test/stores/authStore.ts)
- [Existing types](file:///d:/works/vsc_test/types/database.ts)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** ~1h

Tạo Zustand store cho match data và thêm joined types.

## Files

### [NEW] `stores/matchStore.ts`

```typescript
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Match, Team, MatchOdds } from "@/types/database";

// Joined type: match with nested team objects
export interface MatchWithTeams extends Match {
  home_team: Pick<Team, "id" | "name" | "short_name" | "tla" | "crest_url">;
  away_team: Pick<Team, "id" | "name" | "short_name" | "tla" | "crest_url">;
}

// Full joined type for match detail
export interface MatchDetail extends Match {
  home_team: Team;
  away_team: Team;
}

type StatusFilter = "ALL" | "IN_PLAY" | "TIMED" | "FINISHED";

interface MatchState {
  // Match List (S-03)
  matches: MatchWithTeams[];
  currentMatchday: number;
  statusFilter: StatusFilter;
  isLoadingMatches: boolean;

  // Match Detail (S-04)
  selectedMatch: MatchDetail | null;
  isLoadingDetail: boolean;

  // Standings (S-06)
  teams: Team[];
  isLoadingTeams: boolean;

  error: string | null;

  // Actions
  fetchMatches: (matchday?: number) => Promise<void>;
  fetchMatchDetail: (id: string) => Promise<void>;
  fetchStandings: () => Promise<void>;
  setMatchday: (matchday: number) => void;
  setStatusFilter: (filter: StatusFilter) => void;
}
```

**Key queries (from API Contract):**

```typescript
// S-03: Match List — join teams, filter by matchday
fetchMatches: async (matchday) => {
  let query = supabase
    .from("matches")
    .select(`
      *,
      home_team:teams!home_team_id (id, name, short_name, tla, crest_url),
      away_team:teams!away_team_id (id, name, short_name, tla, crest_url)
    `)
    .order("utc_date", { ascending: true });

  if (matchday) query = query.eq("matchday", matchday);

  // Determine currentMatchday from first result if not set
}

// S-04: Match Detail — full team data
fetchMatchDetail: async (id) => {
  supabase
    .from("matches")
    .select(`
      *,
      home_team:teams!home_team_id (*),
      away_team:teams!away_team_id (*)
    `)
    .eq("id", id)
    .single();
}

// S-06: Standings
fetchStandings: async () => {
  supabase
    .from("teams")
    .select("*")
    .order("position", { ascending: true });
}
```

### [MODIFY] `types/database.ts`

Thêm export `MatchWithTeams` và `MatchDetail` types vào file. Hoặc define inline trong store — cả hai đều fine.

> **Quyết định:** Define types trong store file để keep types/database.ts chỉ cho raw DB types. Joined types là store concern.

## Todo List

- [ ] Create `stores/matchStore.ts` với states + actions
- [ ] Implement `fetchMatches` (join teams, filter matchday)
- [ ] Implement `fetchMatchDetail` (join teams, single)
- [ ] Implement `fetchStandings` (order by position)
- [ ] Implement `setMatchday`, `setStatusFilter`
- [ ] Error handling: set error state, loading states
- [ ] Determine `currentMatchday` from data nếu chưa set
- [ ] Helper: transform crest_url `.svg` → `.png` nếu cần

## Key Implementation Notes

### currentMatchday initialization (Red-Team finding)

```typescript
// Determine current matchday: find the smallest matchday with upcoming matches
const { data: upcoming } = await supabase
  .from("matches")
  .select("matchday")
  .in("status", ["TIMED", "SCHEDULED"])
  .order("matchday", { ascending: true })
  .limit(1);

const currentMatchday = upcoming?.[0]?.matchday ?? 1;
```

### Crest URL sanitization (Red-Team finding)

football-data.org trả về `.svg` URLs, React Native Image không hỗ trợ SVG native.
CDN có cả `.png` version → transform:

```typescript
export function getCrestUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/\.svg$/, ".png");
}
```

## Success Criteria

- Store khởi tạo OK, có thể import từ screens
- `fetchMatches()` trả về matches với team data (name, crest_url)
- `fetchMatchDetail(id)` trả về single match với full team info + odds
- `fetchStandings()` trả về 20 teams sorted by position
- Loading states toggle đúng

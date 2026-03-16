# Phase 2: Odds Calculation Algorithm

## Context

- [Business Rules: Odds](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L75-L84)
- [DB Schema: match.odds JSONB](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L78-L91)
- [DB Schema: Correct score list](file:///d:/works/vsc_test/docs/09_DB_SCHEMA.md#L488-L500)
- [API Contract: odds structure](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L310)

## Overview

- **Priority:** P1
- **Status:** Completed ✅
- **Effort:** ~1h

Implement odds calculation cho 5 bet types dựa trên standings (position 2 đội + home advantage).

## Requirements (from Business Rules)

- **BR-E01:** Odds tính tự động từ standings (thứ hạng 2 đội)
- **BR-E02:** Đội thứ hạng cao → odds thấp (dễ thắng, lời ít)
- **BR-E03:** Đội thứ hạng thấp → odds cao (khó thắng, lời nhiều)
- **BR-E04:** Đội nhà có lợi thế → odds giảm nhẹ
- **BR-E05:** Odds tối thiểu = 1.10
- **BR-E06:** Correct score odds: 5.0 - 50.0+
- **BR-E07:** Odds tính khi sync, lưu DB, không tính lại mỗi lần user xem

## Target JSONB Structure

```json
{
  "match_result":  { "home": 1.45, "draw": 3.20, "away": 2.80 },
  "over_under":    { "over": 1.85, "under": 1.95 },
  "btts":          { "yes": 1.70, "no": 2.10 },
  "half_time":     { "home": 2.10, "draw": 2.20, "away": 3.50 },
  "correct_score": { "1-0": 6.50, "2-1": 7.00, "0-0": 8.50, ... }
}
```

## Algorithm Design

### Core concept: Strength → Probability → Odds

```
Step 1: Compute team strength from position (1-20)
  strength = (21 - position) / 20
  → Position 1 = 1.0 (strongest)
  → Position 20 = 0.05 (weakest)

Step 2: Apply home advantage
  homeStrength *= (1 + HOME_ADVANTAGE)  // HOME_ADVANTAGE = 0.1

Step 3: Estimate probability
  homeProb = adjustedHomeStrength / (adjustedHome + awayStrength)
  awayProb = awayStrength / (adjustedHome + awayStrength)

Step 4: Convert to odds
  odds = MARGIN / probability
  → MARGIN = 1.05 (5% house edge)

Step 5: Clamp to minimum 1.10
```

### 1. match_result (1X2)

```typescript
function calcMatchResult(homePos: number, awayPos: number) {
  const homeStrength = (21 - homePos) / 20;
  const awayStrength = (21 - awayPos) / 20;
  const HOME_ADV = 0.1;
  const MARGIN = 1.05;
  const DRAW_BASE = 0.26; // ~26% of PL matches end in draw

  const adjHome = homeStrength * (1 + HOME_ADV);
  const total = adjHome + awayStrength;

  let homeProb = (adjHome / total) * (1 - DRAW_BASE);
  let awayProb = (awayStrength / total) * (1 - DRAW_BASE);
  let drawProb = DRAW_BASE;

  return {
    home: clampOdds(MARGIN / homeProb),
    draw: clampOdds(MARGIN / drawProb),
    away: clampOdds(MARGIN / awayProb),
  };
}

function clampOdds(odds: number): number {
  return Math.round(Math.max(odds, 1.10) * 100) / 100;
}
```

**Expected output examples:**
| Home (pos) | Away (pos) | Home odds | Draw | Away odds |
|-----------|-----------|-----------|------|-----------|
| 1 vs 20 | | ~1.20 | ~4.04 | ~8.00+ |
| 1 vs 2 | | ~1.65 | ~4.04 | ~2.90 |
| 10 vs 10 | | ~1.90 | ~4.04 | ~2.20 |
| 20 vs 1 | | ~3.50 | ~4.04 | ~1.30 |

### 2. over_under (Tài/Xỉu 2.5)

```typescript
function calcOverUnder(homePos: number, awayPos: number) {
  // Strong teams tend to have more goals
  const avgStrength = ((21 - homePos) + (21 - awayPos)) / 40;
  // Higher combined strength → more goals → over more likely
  const overProb = 0.45 + avgStrength * 0.15; // Range: 0.46 - 0.60
  const underProb = 1 - overProb;
  const MARGIN = 1.05;

  return {
    over: clampOdds(MARGIN / overProb),
    under: clampOdds(MARGIN / underProb),
  };
}
```

### 3. btts (Both Teams To Score)

```typescript
function calcBTTS(homePos: number, awayPos: number) {
  // Evenly matched teams → higher BTTS probability
  const posDiff = Math.abs(homePos - awayPos);
  const baseProb = 0.52; // ~52% of PL matches both teams score
  // Bigger position gap → less likely BTTS (one-sided)
  const bttsProb = baseProb - (posDiff / 20) * 0.15; // Range: 0.37 - 0.52
  const MARGIN = 1.05;

  return {
    yes: clampOdds(MARGIN / bttsProb),
    no: clampOdds(MARGIN / (1 - bttsProb)),
  };
}
```

### 4. half_time (HT 1X2)

```typescript
function calcHalfTime(homePos: number, awayPos: number) {
  // Half time has MORE draws (~35-40% matches 0-0 at HT)
  const matchResult = calcMatchResult(homePos, awayPos);
  const DRAW_HT_FACTOR = 1.6; // Draws more common at HT

  return {
    home: clampOdds(matchResult.home * 1.35), // Harder to be winning at HT
    draw: clampOdds(matchResult.draw / DRAW_HT_FACTOR), // More likely
    away: clampOdds(matchResult.away * 1.5),  // Even harder for away
  };
}
```

### 5. correct_score

```typescript
const CORRECT_SCORES = [
  "0-0","1-0","0-1","2-0","0-2","2-1","1-2",
  "3-0","0-3","3-1","1-3","3-2","2-3",
  "4-0","0-4","4-1","1-4","4-2","2-4","4-3","3-4",
  "1-1","2-2","3-3"
];

function calcCorrectScore(homePos: number, awayPos: number) {
  const matchResult = calcMatchResult(homePos, awayPos);
  const homeProb = 1 / matchResult.home;
  const result: Record<string, number> = {};

  // Base frequency for each score (approximate PL stats)
  const BASE_FREQ: Record<string, number> = {
    "1-0": 0.10, "0-1": 0.08, "0-0": 0.07,
    "2-1": 0.09, "1-2": 0.06, "2-0": 0.06, "0-2": 0.04,
    "1-1": 0.11, "3-1": 0.04, "1-3": 0.02,
    "3-0": 0.03, "0-3": 0.02, "2-2": 0.04,
    "3-2": 0.02, "2-3": 0.01, "4-0": 0.01, "0-4": 0.01,
    "4-1": 0.01, "1-4": 0.005, "4-2": 0.005, "2-4": 0.005,
    "4-3": 0.003, "3-4": 0.002, "3-3": 0.005,
  };

  for (const score of CORRECT_SCORES) {
    const [h, a] = score.split("-").map(Number);
    let freq = BASE_FREQ[score] ?? 0.005;

    // Adjust frequency based on team strength
    if (h > a) freq *= homeProb * 1.5;       // Home win score → boost if home stronger
    else if (a > h) freq *= (1 - homeProb) * 1.5; // Away win score
    // Draw score → slight adjustment

    const odds = 1.05 / freq;
    result[score] = Math.round(Math.max(odds, 5.0) * 100) / 100;
  }

  return result;
}
```

### Integration into sync-matches

```typescript
// After upserting teams and matches:
// For each match with status TIMED or SCHEDULED, calculate odds

const { data: dbTeamsWithPos } = await supabaseAdmin
  .from("teams")
  .select("id, position");

const posMap = new Map<string, number>();
for (const t of dbTeamsWithPos!) {
  posMap.set(t.id, t.position ?? 10); // default mid-table if no position
}

// Get matches that need odds calculation
const { data: scheduledMatches } = await supabaseAdmin
  .from("matches")
  .select("id, home_team_id, away_team_id")
  .in("status", ["TIMED", "SCHEDULED"]);

for (const match of scheduledMatches ?? []) {
  const homePos = posMap.get(match.home_team_id) ?? 10;
  const awayPos = posMap.get(match.away_team_id) ?? 10;

  const odds = {
    match_result: calcMatchResult(homePos, awayPos),
    over_under: calcOverUnder(homePos, awayPos),
    btts: calcBTTS(homePos, awayPos),
    half_time: calcHalfTime(homePos, awayPos),
    correct_score: calcCorrectScore(homePos, awayPos),
  };

  await supabaseAdmin
    .from("matches")
    .update({ odds })
    .eq("id", match.id);
}
```

> **Optimization note:** Dùng batch update thay vì loop nếu cần performance. Nhưng cho student project, loop đủ rồi (max 380 matches, thực tế chỉ ~10-20 scheduled).

## Todo List

- [x] Implement `clampOdds()` helper
- [x] Implement `calcMatchResult()` — 1X2 odds
- [x] Implement `calcOverUnder()` — Tài/Xỉu 2.5
- [x] Implement `calcBTTS()` — Both Teams To Score
- [x] Implement `calcHalfTime()` — HT 1X2
- [x] Implement `calcCorrectScore()` — 24 tỉ số chính xác
- [x] Integrate odds calculation into sync-matches flow
- [x] Only calculate odds for TIMED/SCHEDULED matches (BR-E07)

## Success Criteria

- Odds format matches JSONB structure in DB schema
- All 5 bet types calculated
- Correct score has 24 entries
- Min odds = 1.10 (BR-E05)
- Home team has lower odds than away for same-position matchup (BR-E04)
- Position 1 vs 20 → home odds very low (~1.2), away odds very high (~8+)
- Odds only calculated for future matches, not already-played ones

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Odds look unrealistic | Medium | Low | Tunable constants, can adjust later |
| Position is null | Low | Medium | Default to mid-table (position 10) |
| Too many DB updates in loop | Low | Low | Max ~20 scheduled matches |

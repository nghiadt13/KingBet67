# Phase 3: Deploy, Test, and Cron Setup

## Context

- [Architecture: External Cron](file:///d:/works/vsc_test/docs/06_ARCHITECTURE.md#L25-L29)
- [Business Rules: Sync](file:///d:/works/vsc_test/docs/04_BUSINESS_RULES.md#L128-L135)
- [API Contract: sync-matches invocation](file:///d:/works/vsc_test/docs/08_API_CONTRACT.md#L296-L328)

## Overview

- **Priority:** P1
- **Status:** Completed ✅ (local test done, deploy + cron deferred)
- **Effort:** ~1h

Deploy Edge Function lên Supabase, test manually, setup external cron.

## Prerequisites

### Supabase CLI Installation

```bash
# Windows (scoop)
scoop install supabase

# Hoặc npm
npm install -g supabase
```

### football-data.org API Key

1. Đăng ký tại https://www.football-data.org/client/register
2. Xác nhận email → nhận API key
3. Free tier: 10 requests/phút

## Implementation Steps

### 1. Set Supabase Secrets

```bash
# Login Supabase CLI
supabase login

# Link project
supabase link --project-ref xyisichndmcfifxonttd

# Set football-data.org API key as secret
supabase secrets set FOOTBALL_DATA_API_KEY=your_api_key_here
```

> `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` đã có sẵn trong Edge Function environment.

### 2. Local Testing (Optional)

```bash
# Serve locally (cần Docker)
supabase functions serve sync-matches --env-file ./supabase/.env.local

# Test with curl
curl -i --location --request POST \
  "http://localhost:54321/functions/v1/sync-matches" \
  --header "Authorization: Bearer YOUR_ANON_KEY" \
  --header "Content-Type: application/json"
```

> Local test cần file `.env.local` với `FOOTBALL_DATA_API_KEY`.

### 3. Deploy to Supabase

```bash
supabase functions deploy sync-matches --no-verify-jwt
```

> `--no-verify-jwt`: cho phép gọi từ cron không cần JWT. Xem xét thêm auth header cho production.

### 4. Test Deployed Function

```bash
# Via curl
curl -i --location --request POST \
  "https://xyisichndmcfifxonttd.supabase.co/functions/v1/sync-matches" \
  --header "Authorization: Bearer sb_publishable_LsF0--n8lyWjJbCmH2UZ0w_KrTBjX9b" \
  --header "Content-Type: application/json"
```

**Expected response:**

```json
{
  "teams_updated": 20,
  "matches_updated": 380,
  "odds_calculated": 15,
  "timestamp": "2026-03-15T10:00:00Z"
}
```

### 5. Verify DB Data

Check via Supabase Dashboard (Table Editor):
- `teams` table: 20 rows, mỗi row có position, points, crest_url
- `matches` table: ~380 rows, match status đúng, scores đúng cho FINISHED matches
- Matches TIMED/SCHEDULED có `odds` JSONB không null

Hoặc via app (nếu Phase 4 đã có):
```typescript
// Quick test query
const { data: teams } = await supabase
  .from("teams")
  .select("*")
  .order("position", { ascending: true });
console.log(`Teams: ${teams?.length}`); // Expected: 20

const { data: matches } = await supabase
  .from("matches")
  .select("*")
  .not("odds", "is", null);
console.log(`Matches with odds: ${matches?.length}`);
```

### 6. Setup External Cron

1. Đăng ký tại https://cron-job.org (miễn phí)
2. Tạo cron job:
   - **URL:** `https://xyisichndmcfifxonttd.supabase.co/functions/v1/sync-matches`
   - **Method:** POST
   - **Schedule:** Every 10 minutes (`*/10 * * * *`)
   - **Headers:**
     - `Authorization: Bearer sb_publishable_LsF0--n8lyWjJbCmH2UZ0w_KrTBjX9b`
     - `Content-Type: application/json`
3. Enable job
4. Check execution log sau 10 phút

> **Lưu ý:** Nên dùng service_role key cho cron thay vì anon key, tùy thuộc vào cách auth Edge Function.

## Todo List

- [ ] Cài Supabase CLI (deferred — dùng local script thay thế)
- [x] Đăng ký football-data.org API key
- [ ] Set secrets: `FOOTBALL_DATA_API_KEY` (deferred — chưa deploy)
- [ ] Deploy Edge Function (deferred — dùng local script)
- [x] Test sync và verify data: `scripts/test-sync.ts` → 20 teams, 380 matches, 83 odds
- [x] Verify DB data qua Supabase Dashboard
- [ ] Đăng ký cron-job.org (deferred)
- [ ] Tạo cron job (deferred)
- [ ] Verify cron chạy tự động (deferred)

## Success Criteria

- Edge Function deploy thành công
- Gọi function → response 200 + summary JSON
- DB có 20 teams với position/points
- DB có matches cho season hiện tại
- Matches TIMED/SCHEDULED có odds JSONB
- Cron job chạy mỗi 10 phút → DB cập nhật tự động

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase CLI not installed | Medium | Medium | Hướng dẫn install step 1 |
| football-data.org không cấp key | Low | Critical | Đăng ký trước, miễn phí |
| `--no-verify-jwt` security concern | Medium | Low | Student project, acceptable |
| Cron service downtime | Low | Low | Manual sync via admin button (Phase 8) |

## Security Considerations

- **`--no-verify-jwt`:** Edge Function accessible without JWT. Acceptable cho student project. Production nên thêm custom auth header hoặc remove flag.
- **API key in secrets:** Không expose trong code hay frontend.
- **service_role key:** Auto-available, cần cẩn thận không dùng ở frontend.

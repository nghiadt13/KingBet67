/**
 * KingBet67 — TypeScript types for Supabase DB
 * Matches schema.sql tables exactly
 */

// ---- Enums ----

export type UserRole = 'user' | 'admin';

export type MatchStatus =
  | 'TIMED'
  | 'SCHEDULED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export type BetType =
  | 'match_result'
  | 'correct_score'
  | 'over_under'
  | 'over_under_1_5'
  | 'over_under_3_5'
  | 'btts'
  | 'half_time'
  | 'spreads';

export type BetStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
export type DepositRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ---- Table Types ----

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  balance: number;
  is_banned: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  external_id: number;
  name: string;
  short_name: string;
  tla: string;
  crest_url: string | null;
  position: number | null;
  points: number;
  played_games: number;
  won: number;
  draw: number;
  lost: number;
  goal_difference: number;
  updated_at: string;
}

export interface League {
  id: string;
  code: string;
  name: string;
  country: string | null;
  emblem_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchOdds {
  match_result?: { home: number; draw: number; away: number };
  over_under?: { over: number; under: number };
  over_under_1_5?: { over: number; under: number };
  over_under_3_5?: { over: number; under: number };
  btts?: { yes: number; no: number };
  half_time?: { home: number; draw: number; away: number };
  correct_score?: Record<string, number>;
  spreads?: { home: number; away: number; line: number };
}

export interface Match {
  id: string;
  external_id: number;
  league_id: string | null;
  matchday: number;
  utc_date: string;
  status: MatchStatus;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  half_time_home: number | null;
  half_time_away: number | null;
  odds: MatchOdds | null;
  is_settled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  match_id: string;
  bet_type: BetType;
  bet_choice: string;
  amount: number;
  odds: number;
  status: BetStatus;
  winnings: number;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  status: DepositRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
}

// ---- Joined types (for queries with joins) ----

export interface MatchWithTeams extends Match {
  home_team: Team;
  away_team: Team;
  league?: League | null;
}

export interface BetWithMatch extends Bet {
  match: MatchWithTeams;
}

export interface DepositRequestWithUser extends DepositRequest {
  user?: Pick<User, 'id' | 'username' | 'email'> | null;
}

// ---- Parlay types ----

export interface ParlayBet {
  id: string;
  user_id: string;
  amount: number;
  total_odds: number;
  status: 'PENDING' | 'WON' | 'LOST';
  winnings: number;
  created_at: string;
  settled_at: string | null;
}

export interface ParlayBetItem {
  id: string;
  parlay_bet_id: string;
  match_id: string;
  bet_type: BetType;
  bet_choice: string;
  odds: number;
  result: 'PENDING' | 'WON' | 'LOST';
  // Joined
  match?: MatchWithTeams;
}

export interface ParlayBetWithItems extends ParlayBet {
  items: ParlayBetItem[];
}

export interface ParlaySelection {
  matchId: string;
  matchLabel: string;   // e.g. "Arsenal vs Chelsea"
  betType: BetType;
  betChoice: string;
  betLabel: string;     // e.g. "Arsenal thắng"
  odds: number;
}

// ---- RPC response types ----

export interface PlaceBetResponse {
  id: string;
  bet_type: BetType;
  bet_choice: string;
  amount: number;
  odds: number;
}

export interface DepositResponse {
  new_balance: number;
}

export interface ApproveDepositRequestResponse {
  request: DepositRequest;
  new_balance: number;
}

export interface UserStats {
  total_bets: number;
  won_count: number;
  lost_count: number;
  pending_count: number;
  win_rate: number;
  total_winnings: number;
}

export interface LeaderboardEntry {
  username: string;
  total: number;
}

export interface AdminStats {
  total_users: number;
  total_bets: number;
  total_money_circulation: number;
  pending_bets: number;
  hottest_match: {
    id: string;
    home_team_name: string;
    away_team_name: string;
    bet_count: number;
  } | null;
  top_users: {
    username: string;
    total_winnings: number;
  }[];
}

// ---- Supabase Database type (for createClient<Database>) ----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Partial<User>;
        Update: Partial<User>;
      };
      teams: {
        Row: Team;
        Insert: Partial<Team>;
        Update: Partial<Team>;
      };
      leagues: {
        Row: League;
        Insert: Partial<League>;
        Update: Partial<League>;
      };
      matches: {
        Row: Match;
        Insert: Partial<Match>;
        Update: Partial<Match>;
      };
      bets: {
        Row: Bet;
        Insert: Partial<Bet>;
        Update: Partial<Bet>;
      };
      deposit_requests: {
        Row: DepositRequest;
        Insert: Partial<DepositRequest>;
        Update: Partial<DepositRequest>;
      };
    };
    Functions: {
      place_bet: {
        Args: {
          p_match_id: string;
          p_bet_type: string;
          p_bet_choice: string;
          p_amount: number;
        };
        Returns: PlaceBetResponse;
      };
      deposit: {
        Args: { p_amount: number };
        Returns: DepositResponse;
      };
      create_deposit_request: {
        Args: { p_amount: number };
        Returns: DepositRequest;
      };
      approve_deposit_request: {
        Args: { p_request_id: string; p_admin_note?: string | null };
        Returns: ApproveDepositRequestResponse;
      };
      reject_deposit_request: {
        Args: { p_request_id: string; p_admin_note?: string | null };
        Returns: DepositRequest;
      };
      get_user_stats: {
        Args: Record<string, never>;
        Returns: UserStats;
      };
      get_leaderboard: {
        Args: { p_type?: string; p_limit?: number };
        Returns: LeaderboardEntry[];
      };
      get_admin_stats: {
        Args: Record<string, never>;
        Returns: AdminStats;
      };
      place_parlay_bet: {
        Args: {
          p_selections: { match_id: string; bet_type: string; bet_choice: string }[];
          p_amount: number;
        };
        Returns: {
          id: string;
          selections: number;
          total_odds: number;
          amount: number;
          potential_win: number;
        };
      };
    };
  };
}

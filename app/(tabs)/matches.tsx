import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { MatchWithTeams, MatchStatus, League } from '@/types/database';

type FilterTab = 'live' | 'scheduled' | 'all';
const ALL_LEAGUES_ID = '__all_leagues__';

// Date filter helpers — use UTC-aware range to match DB timestamps
function getDateRange(offset: number): { start: string; end: string; label: string } {
  // Create date in local timezone for label
  const local = new Date();
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() + offset);

  let label: string;
  if (offset === -1) label = 'Hôm qua';
  else if (offset === 0) label = 'Hôm nay';
  else if (offset === 1) label = 'Ngày mai';
  else {
    label = local.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  // Build start/end using local midnight boundaries → converts to UTC correctly
  const startLocal = new Date(local);
  startLocal.setHours(0, 0, 0, 0);
  const endLocal = new Date(local);
  endLocal.setHours(23, 59, 59, 999);

  return { start: startLocal.toISOString(), end: endLocal.toISOString(), label };
}

const DATE_OFFSETS = [-1, 0, 1, 2, 3, 4, 5];

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [selectedDateOffset, setSelectedDateOffset] = useState(0); // 0 = today
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(ALL_LEAGUES_ID);
  const [leagueFilterEnabled, setLeagueFilterEnabled] = useState(true);
  const [leaguesLoaded, setLeaguesLoaded] = useState(false);

  const dateRange = useMemo(() => getDateRange(selectedDateOffset), [selectedDateOffset]);
  const dateChips = useMemo(() => DATE_OFFSETS.map(o => ({ offset: o, ...getDateRange(o) })), []);

  // fetchLeagues: no dependencies — runs once on mount, does NOT reset date/filter state
  const fetchLeagues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;

      const leagueData = (data as League[]) || [];
      setLeagues(leagueData);
      setLeagueFilterEnabled(leagueData.length > 0);
      setLeaguesLoaded(true);
    } catch {
      setLeagues([]);
      setSelectedLeagueId(ALL_LEAGUES_ID);
      setLeagueFilterEnabled(false);
      setLeaguesLoaded(true);
    }
  }, []);

  const fetchMatches = useCallback(async (leagueId: string, range: { start: string; end: string }) => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        league:leagues(*)
      `)
      .gte('utc_date', range.start)
      .lte('utc_date', range.end)
      .order('utc_date', { ascending: true });

    if (leagueFilterEnabled && leagueId !== ALL_LEAGUES_ID) {
      query = query.eq('league_id', leagueId);
    }

    const { data, error } = await query;

    if (error) throw error;
    setMatches((data as unknown as MatchWithTeams[]) || []);
  }, [leagueFilterEnabled]);

  // Mount: load leagues once
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await fetchLeagues();
      } catch (err) {
        console.error('Error loading leagues:', err);
      }
    };
    init();
  }, [fetchLeagues]);

  // Fetch matches whenever league, date, or leagueFilter changes
  useEffect(() => {
    if (!leaguesLoaded) return; // wait for leagues to load first
    const run = async () => {
      try {
        setLoading(true);
        await fetchMatches(selectedLeagueId, dateRange);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedLeagueId, dateRange, fetchMatches, leagueFilterEnabled, leaguesLoaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLeagues(),
        fetchMatches(selectedLeagueId, dateRange),
      ]);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeagues, fetchMatches, selectedLeagueId, dateRange]);

  const isLive = (status: MatchStatus) => status === 'IN_PLAY' || status === 'PAUSED';
  const isScheduled = (status: MatchStatus) => status === 'TIMED' || status === 'SCHEDULED';
  const isFinished = (status: MatchStatus) => status === 'FINISHED';

  const sortedMatches = useMemo(() => {
    const statusPriority: Record<string, number> = {
      IN_PLAY: 0, PAUSED: 1, TIMED: 2, SCHEDULED: 3, FINISHED: 4, POSTPONED: 5, CANCELLED: 6,
    };
    return [...matches].sort((a, b) => {
      const pa = statusPriority[a.status] ?? 99;
      const pb = statusPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime();
    });
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (activeFilter === 'live') return sortedMatches.filter((m) => isLive(m.status));
    if (activeFilter === 'scheduled') return sortedMatches.filter((m) => isScheduled(m.status));
    return sortedMatches;
  }, [activeFilter, sortedMatches]);

  const filterTabs: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'all', label: 'Tất cả', icon: 'sports-soccer' },
    { key: 'live', label: 'Đang đá', icon: 'play-circle-filled' },
    { key: 'scheduled', label: 'Sắp đá', icon: 'schedule' },
  ];

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'IN_PLAY':
      case 'PAUSED':
        return { text: 'Trực tiếp', color: Colors.liveRed, bg: 'rgba(239,68,68,0.15)' };
      case 'FINISHED':
        return { text: 'Kết thúc', color: Colors.textMuted, bg: 'rgba(100,116,139,0.15)' };
      case 'POSTPONED':
        return { text: 'Hoãn', color: Colors.pendingYellow, bg: Colors.pendingYellowBg };
      case 'CANCELLED':
        return { text: 'Hủy', color: Colors.textMuted, bg: 'rgba(100,116,139,0.15)' };
      case 'TIMED':
      case 'SCHEDULED':
        return { text: 'Sắp đá', color: Colors.neonGreen, bg: Colors.neonGreenBg };
      default:
        return { text: status, color: Colors.textMuted, bg: 'rgba(100,116,139,0.15)' };
    }
  };

  const formatMatchTime = (utcDate: string) => {
    const date = new Date(utcDate);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMatchDate = (utcDate: string) => {
    const date = new Date(utcDate);
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const renderMatchCard = (match: MatchWithTeams) => {
    const badge = getStatusBadge(match.status);
    const live = isLive(match.status);
    const finished = isFinished(match.status);
    const scheduled = isScheduled(match.status);

    return (
      <TouchableOpacity
        key={match.id}
        style={[styles.matchCard, live && styles.matchCardLive]}
        onPress={() => router.push(`/match/${match.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.matchCardHeader}>
          <View style={styles.headerLeftGroup}>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}> 
              {live && <View style={styles.liveDot} />}
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
            {match.matchday > 0 && (
              <View style={styles.matchdayBadge}>
                <Text style={styles.matchdayBadgeText}>Vòng {match.matchday}</Text>
              </View>
            )}
          </View>
          <Text style={styles.matchTimeText}>
            {scheduled ? `${formatMatchTime(match.utc_date)} · ` : ''}
            {formatMatchDate(match.utc_date)}
          </Text>
        </View>

        <View style={styles.matchTeamsRow}>
          <View style={styles.matchTeamCol}>
            {match.home_team?.crest_url ? (
              <Image source={{ uri: match.home_team.crest_url }} style={styles.matchTeamLogo} />
            ) : (
              <View style={[styles.matchTeamLogo, styles.logoPlaceholder]}>
                <MaterialIcons name="shield" size={16} color={Colors.textMuted} />
              </View>
            )}
            <Text style={styles.matchTeamName} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
          </View>

          <View style={styles.matchScoreCol}>
            {finished || live ? (
              <Text style={[styles.matchScore, live && { color: Colors.liveRed }]}> 
                {match.home_score ?? 0} - {match.away_score ?? 0}
              </Text>
            ) : (
              <Text style={styles.matchVsText}>VS</Text>
            )}
          </View>

          <View style={styles.matchTeamCol}>
            {match.away_team?.crest_url ? (
              <Image source={{ uri: match.away_team.crest_url }} style={styles.matchTeamLogo} />
            ) : (
              <View style={[styles.matchTeamLogo, styles.logoPlaceholder]}>
                <MaterialIcons name="shield" size={16} color={Colors.textMuted} />
              </View>
            )}
            <Text style={styles.matchTeamName} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.leagueText}>{match.league?.name || 'League'}</Text>
          {scheduled && match.odds?.match_result && (
            <View style={styles.quickOddsRow}>
              <View style={styles.oddsChip}><Text style={styles.oddsValue}>{match.odds.match_result.home.toFixed(2)}</Text></View>
              <View style={styles.oddsChip}><Text style={styles.oddsValue}>{match.odds.match_result.draw.toFixed(2)}</Text></View>
              <View style={styles.oddsChip}><Text style={styles.oddsValue}>{match.odds.match_result.away.toFixed(2)}</Text></View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && matches.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="sports-soccer" size={24} color={Colors.neonGreen} />
        <Text style={styles.headerTitle}>Trận đấu</Text>
        <View style={{ width: 24 }} />
      </View>

      {(leagues.length > 0 || leagueFilterEnabled) && (
        <View style={styles.leagueContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueScroll}>
            <TouchableOpacity
              style={[styles.leagueChip, selectedLeagueId === ALL_LEAGUES_ID && styles.leagueChipActive]}
              onPress={() => setSelectedLeagueId(ALL_LEAGUES_ID)}
            >
              <Text style={[styles.leagueTextChip, selectedLeagueId === ALL_LEAGUES_ID && styles.leagueTextChipActive]}>
                Tất cả giải
              </Text>
            </TouchableOpacity>
            {leagues.map((league) => (
              <TouchableOpacity
                key={league.id}
                style={[styles.leagueChip, selectedLeagueId === league.id && styles.leagueChipActive]}
                onPress={() => setSelectedLeagueId(league.id)}
              >
                <Text style={[styles.leagueTextChip, selectedLeagueId === league.id && styles.leagueTextChipActive]}>
                  {league.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Date filter replacing matchday */}
      <View style={styles.dateContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          {dateChips.map((chip) => (
            <TouchableOpacity
              key={chip.offset}
              style={[styles.dateChip, selectedDateOffset === chip.offset && styles.dateChipActive]}
              onPress={() => setSelectedDateOffset(chip.offset)}
            >
              <Text style={[styles.dateChipText, selectedDateOffset === chip.offset && styles.dateChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, activeFilter === tab.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={14}
                color={activeFilter === tab.key ? Colors.neonGreen : Colors.textMuted}
              />
              <Text style={[styles.filterText, activeFilter === tab.key && styles.filterTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.neonGreen} colors={[Colors.neonGreen]} />}
      >
        {filteredMatches.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="sports-soccer" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Không có trận đấu</Text>
            <Text style={styles.emptySubText}>Thử chọn ngày khác hoặc giải khác</Text>
          </View>
        )}
        {filteredMatches.map(renderMatchCard)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 50,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.white, fontSize: 19, fontWeight: '700' },
  leagueContainer: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.2)' },
  leagueScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  leagueChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)', marginRight: 6,
  },
  leagueChipActive: { backgroundColor: Colors.neonGreenBg, borderColor: Colors.neonGreenBorder },
  leagueTextChip: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  leagueTextChipActive: { color: Colors.neonGreen },
  // Date filter chips
  dateContainer: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.2)' },
  dateScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)', marginRight: 6,
  },
  dateChipActive: { backgroundColor: Colors.neonGreenBg, borderColor: Colors.neonGreenBorder },
  dateChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  dateChipTextActive: { color: Colors.neonGreen },
  // Status filter
  filterContainer: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.1)' },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'transparent', marginRight: 4,
  },
  filterChipActive: { backgroundColor: 'rgba(173,255,47,0.08)' },
  filterText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: Colors.neonGreen },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },
  matchCard: {
    backgroundColor: Colors.cardBg, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)',
  },
  matchCardLive: { borderColor: 'rgba(239,68,68,0.3)' },
  matchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.liveRed },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  matchdayBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(100,116,139,0.12)',
  },
  matchdayBadgeText: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  matchTimeText: { color: Colors.textMuted, fontSize: 11 },
  matchTeamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchTeamCol: { flex: 1, alignItems: 'center', gap: 6 },
  matchTeamLogo: { width: 36, height: 36, borderRadius: 18 },
  logoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  matchTeamName: { color: Colors.white, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  matchScoreCol: { flex: 1, alignItems: 'center' },
  matchScore: { color: Colors.white, fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  matchVsText: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  metaRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueText: { color: Colors.textMuted, fontSize: 11, maxWidth: '45%' },
  quickOddsRow: { flexDirection: 'row', gap: 8 },
  oddsChip: {
    minWidth: 40,
    backgroundColor: 'rgba(30,41,59,0.5)',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.12)',
  },
  oddsValue: { color: Colors.neonGreen, fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  emptySubText: { color: Colors.textMuted, fontSize: 12 },
});

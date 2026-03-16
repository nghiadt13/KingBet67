import { useEffect, useState, useCallback } from 'react';
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
import { MatchWithTeams, MatchStatus } from '@/types/database';

type FilterTab = 'all' | 'live' | 'scheduled' | 'finished';

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [matchdays, setMatchdays] = useState<number[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);

  // Fetch all available matchdays
  const fetchMatchdays = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('matchday')
        .order('matchday', { ascending: true });

      if (error) throw error;

      const uniqueMatchdays = [...new Set((data || []).map((m) => m.matchday))];
      setMatchdays(uniqueMatchdays);

      // Default to latest matchday with matches
      if (uniqueMatchdays.length > 0 && selectedMatchday === null) {
        setSelectedMatchday(uniqueMatchdays[uniqueMatchdays.length - 1]);
      }
    } catch (err) {
      console.error('Error fetching matchdays:', err);
    }
  }, [selectedMatchday]);

  const fetchMatches = useCallback(async () => {
    if (selectedMatchday === null) return;
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        `)
        .eq('matchday', selectedMatchday)
        .order('utc_date', { ascending: true });

      if (error) throw error;
      setMatches((data as unknown as MatchWithTeams[]) || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMatchday]);

  useEffect(() => {
    fetchMatchdays();
  }, []);

  useEffect(() => {
    if (selectedMatchday !== null) {
      setLoading(true);
      fetchMatches();
    }
  }, [selectedMatchday, fetchMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [fetchMatches]);

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'live') return m.status === 'IN_PLAY' || m.status === 'PAUSED';
    if (activeFilter === 'scheduled') return m.status === 'TIMED' || m.status === 'SCHEDULED';
    if (activeFilter === 'finished') return m.status === 'FINISHED';
    return true;
  });

  const filterTabs: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'all', label: 'Tất cả', icon: 'sports-soccer' },
    { key: 'live', label: 'Đang đá', icon: 'play-circle-filled' },
    { key: 'scheduled', label: 'Sắp đá', icon: 'schedule' },
    { key: 'finished', label: 'Kết thúc', icon: 'check-circle' },
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

  if (loading && matches.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="sports-soccer" size={24} color={Colors.neonGreen} />
        <Text style={styles.headerTitle}>Trận đấu</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Matchday Selector */}
      <View style={styles.matchdayContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchdayScroll}>
          {matchdays.map((md) => (
            <TouchableOpacity
              key={md}
              style={[styles.matchdayChip, selectedMatchday === md && styles.matchdayChipActive]}
              onPress={() => setSelectedMatchday(md)}
            >
              <Text style={[styles.matchdayText, selectedMatchday === md && styles.matchdayTextActive]}>
                Vòng {md}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Tabs */}
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
              <Text style={[styles.filterText, activeFilter === tab.key && styles.filterTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Match List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={Colors.neonGreen} colors={[Colors.neonGreen]}
          />
        }
      >
        {filteredMatches.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="sports-soccer" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Không có trận đấu</Text>
          </View>
        )}

        {filteredMatches.map((match) => {
          const badge = getStatusBadge(match.status);
          const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
          const isFinished = match.status === 'FINISHED';
          const isScheduled = match.status === 'TIMED' || match.status === 'SCHEDULED';

          return (
            <TouchableOpacity
              key={match.id}
              style={[styles.matchCard, isLive && styles.matchCardLive]}
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.matchCardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  {isLive && <View style={styles.liveDot} />}
                  <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
                </View>
                <Text style={styles.matchTimeText}>
                  {isScheduled ? formatMatchTime(match.utc_date) : ''}
                  {isScheduled ? ' · ' : ''}
                  {formatMatchDate(match.utc_date)}
                </Text>
              </View>

              <View style={styles.matchTeamsRow}>
                {/* Home team */}
                <View style={styles.matchTeamCol}>
                  {match.home_team?.crest_url ? (
                    <Image source={{ uri: match.home_team.crest_url }} style={styles.matchTeamLogo} />
                  ) : (
                    <View style={[styles.matchTeamLogo, styles.logoPlaceholder]}>
                      <MaterialIcons name="shield" size={16} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.matchTeamName} numberOfLines={1}>
                    {match.home_team?.short_name || 'Home'}
                  </Text>
                </View>

                {/* Score / Time */}
                <View style={styles.matchScoreCol}>
                  {isFinished || isLive ? (
                    <Text style={[styles.matchScore, isLive && { color: Colors.liveRed }]}>
                      {match.home_score ?? 0} - {match.away_score ?? 0}
                    </Text>
                  ) : (
                    <Text style={styles.matchVsText}>VS</Text>
                  )}
                </View>

                {/* Away team */}
                <View style={styles.matchTeamCol}>
                  {match.away_team?.crest_url ? (
                    <Image source={{ uri: match.away_team.crest_url }} style={styles.matchTeamLogo} />
                  ) : (
                    <View style={[styles.matchTeamLogo, styles.logoPlaceholder]}>
                      <MaterialIcons name="shield" size={16} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.matchTeamName} numberOfLines={1}>
                    {match.away_team?.short_name || 'Away'}
                  </Text>
                </View>
              </View>

              {/* Quick odds for scheduled matches */}
              {isScheduled && match.odds?.match_result && (
                <View style={styles.quickOddsRow}>
                  <View style={styles.oddsChip}>
                    <Text style={styles.oddsLabel}>1</Text>
                    <Text style={styles.oddsValue}>{match.odds.match_result.home.toFixed(2)}</Text>
                  </View>
                  <View style={styles.oddsChip}>
                    <Text style={styles.oddsLabel}>X</Text>
                    <Text style={styles.oddsValue}>{match.odds.match_result.draw.toFixed(2)}</Text>
                  </View>
                  <View style={styles.oddsChip}>
                    <Text style={styles.oddsLabel}>2</Text>
                    <Text style={styles.oddsValue}>{match.odds.match_result.away.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 50,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.white, fontSize: 19, fontWeight: '700' },
  // Matchday selector
  matchdayContainer: {
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.2)',
  },
  matchdayScroll: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  matchdayChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)',
    marginRight: 6,
  },
  matchdayChipActive: {
    backgroundColor: Colors.neonGreenBg, borderColor: Colors.neonGreenBorder,
  },
  matchdayText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  matchdayTextActive: { color: Colors.neonGreen },
  // Filter tabs
  filterContainer: {
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.1)',
  },
  filterScroll: {
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'transparent', marginRight: 4,
  },
  filterChipActive: {
    backgroundColor: 'rgba(173,255,47,0.08)',
  },
  filterText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: Colors.neonGreen },
  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },
  // Match card
  matchCard: {
    backgroundColor: Colors.cardBg, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)',
  },
  matchCardLive: {
    borderColor: 'rgba(239,68,68,0.3)',
  },
  matchCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.liveRed },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  matchTimeText: { color: Colors.textMuted, fontSize: 11 },
  // Teams
  matchTeamsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  matchTeamCol: { flex: 1, alignItems: 'center', gap: 6 },
  matchTeamLogo: { width: 36, height: 36, borderRadius: 18 },
  logoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  matchTeamName: { color: Colors.white, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  matchScoreCol: { flex: 1, alignItems: 'center' },
  matchScore: { color: Colors.white, fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  matchVsText: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  // Quick odds
  quickOddsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  oddsChip: {
    flex: 1, backgroundColor: 'rgba(30,41,59,0.5)', paddingVertical: 8,
    borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.12)',
  },
  oddsLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  oddsValue: { color: Colors.neonGreen, fontSize: 13, fontWeight: '700', marginTop: 2 },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});

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
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { MatchWithTeams, League } from '@/types/database';

const PRIORITY_STATUSES = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED'] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { user, fetchUserProfile } = useAuthStore();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagueFilterEnabled, setLeagueFilterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      if (!selectedLeagueId && leagueData.length > 0) {
        const premier = leagueData.find((l) => l.code === 'PL');
        setSelectedLeagueId((premier || leagueData[0]).id);
      }
    } catch (err) {
      // Silent fallback for projects that have not applied multi-league migration yet.
      setLeagues([]);
      setSelectedLeagueId(null);
      setLeagueFilterEnabled(false);
    }
  }, [selectedLeagueId]);

  const fetchMatches = useCallback(async (leagueId: string | null) => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*)
      `)
      .in('status', [...PRIORITY_STATUSES])
      .order('utc_date', { ascending: true })
      .limit(30);

    if (leagueFilterEnabled && leagueId) {
      query = query
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*),
          league:leagues(*)
        `)
        .eq('league_id', leagueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data as unknown as MatchWithTeams[]) || [];
    const statusPriority: Record<string, number> = {
      IN_PLAY: 0,
      PAUSED: 1,
      TIMED: 2,
      SCHEDULED: 3,
    };

    rows.sort((a, b) => {
      const pa = statusPriority[a.status] ?? 99;
      const pb = statusPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime();
    });

    setMatches(rows);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await fetchLeagues();
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchLeagues]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (leagueFilterEnabled && !selectedLeagueId) return;

    const run = async () => {
      try {
        setLoading(true);
        await fetchMatches(selectedLeagueId);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedLeagueId, fetchMatches, leagueFilterEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUserProfile(),
        fetchLeagues(),
        fetchMatches(selectedLeagueId),
      ]);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeagues, fetchMatches, fetchUserProfile, selectedLeagueId]);

  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'),
    [matches],
  );
  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === 'TIMED' || m.status === 'SCHEDULED'),
    [matches],
  );

  const formatBalance = (balance: number) => new Intl.NumberFormat('vi-VN').format(balance) + 'đ';

  const formatMatchTime = (utcDate: string) => {
    const date = new Date(utcDate);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMatchDate = (utcDate: string) => {
    const date = new Date(utcDate);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hôm nay';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Ngày mai';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const featureCards = [
    { key: 'matches', title: 'Trận đấu', subtitle: 'Live + sắp diễn ra', icon: 'sports-soccer', route: '/matches' },
    { key: 'bets', title: 'Đơn cược', subtitle: 'Theo dõi vé đã đặt', icon: 'receipt-long', route: '/bets' },
    { key: 'leaderboard', title: 'BXH', subtitle: 'Top người chơi', icon: 'emoji-events', route: '/leaderboard' },
    { key: 'profile', title: 'Hồ sơ', subtitle: 'Số dư và thống kê', icon: 'person', route: '/profile' },
  ];

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
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <MaterialIcons name="sports-soccer" size={20} color={Colors.black} />
          </View>
          <Text style={styles.headerTitle}>KingBet67</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Số dư</Text>
            <Text style={styles.balanceValue}>{user ? formatBalance(user.balance) : '---'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.neonGreen}
            colors={[Colors.neonGreen]}
          />
        }
      >
        {leagues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giải đấu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueScroll}>
              {leagues.map((league) => (
                <TouchableOpacity
                  key={league.id}
                  style={[styles.leagueChip, selectedLeagueId === league.id && styles.leagueChipActive]}
                  onPress={() => setSelectedLeagueId(league.id)}
                >
                  <Text style={[styles.leagueChipText, selectedLeagueId === league.id && styles.leagueChipTextActive]}>
                    {league.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tính năng chính</Text>
          <View style={styles.featureGrid}>
            {featureCards.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.featureCard}
                activeOpacity={0.8}
                onPress={() => router.push(item.route as any)}
              >
                <MaterialIcons name={item.icon as any} size={20} color={Colors.neonGreen} />
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>Trực tiếp</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.linkText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {liveMatches.length === 0 && (
            <View style={styles.emptySection}>
              <MaterialIcons name="live-tv" size={20} color={Colors.textMuted} />
              <Text style={styles.emptySectionText}>Không có trận trực tiếp</Text>
            </View>
          )}

          {liveMatches.slice(0, 2).map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.liveCard}
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.liveCardHeader}>
                <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>Trực tiếp</Text></View>
                <Text style={styles.leagueLabel}>{match.league?.name || 'League'}</Text>
              </View>
              <View style={styles.liveTeamsRow}>
                <View style={styles.teamCol}>
                  {match.home_team?.crest_url ? (
                    <Image source={{ uri: match.home_team.crest_url }} style={styles.teamLogoLarge} />
                  ) : (
                    <View style={[styles.teamLogoLarge, styles.teamLogoPlaceholder]}>
                      <MaterialIcons name="shield" size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.teamNameLive} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
                </View>
                <View style={styles.scoreCenterCol}>
                  <Text style={styles.scoreText}>{match.home_score ?? 0} - {match.away_score ?? 0}</Text>
                </View>
                <View style={styles.teamCol}>
                  {match.away_team?.crest_url ? (
                    <Image source={{ uri: match.away_team.crest_url }} style={styles.teamLogoLarge} />
                  ) : (
                    <View style={[styles.teamLogoLarge, styles.teamLogoPlaceholder]}>
                      <MaterialIcons name="shield" size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.teamNameLive} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sắp diễn ra</Text>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.linkText}>Mở tab trận đấu</Text>
            </TouchableOpacity>
          </View>

          {upcomingMatches.length === 0 && (
            <View style={styles.emptySection}>
              <MaterialIcons name="event" size={20} color={Colors.textMuted} />
              <Text style={styles.emptySectionText}>Không có trận sắp diễn ra</Text>
            </View>
          )}

          {upcomingMatches.slice(0, 4).map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.upcomingCard}
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.upcomingLeft}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{formatMatchTime(match.utc_date)}</Text>
                  <Text style={styles.dateText}>{formatMatchDate(match.utc_date)}</Text>
                </View>
                <View style={styles.teamsColumnContainer}>
                  <View style={styles.teamRow}>
                    <Text style={styles.teamNameSmall} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
                  </View>
                  <View style={styles.teamRow}>
                    <Text style={styles.teamNameSmall} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.leagueCode}>{match.league?.code ?? '---'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: 'rgba(11,17,32,0.85)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: Colors.white, fontSize: 19, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
  balanceValue: { color: Colors.neonGreen, fontWeight: '700', fontSize: 15 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.liveRed },
  linkText: { color: Colors.neonGreen, fontSize: 12, fontWeight: '600' },
  leagueScroll: { paddingTop: 10, gap: 8 },
  leagueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
    backgroundColor: 'rgba(30,41,59,0.5)',
  },
  leagueChipActive: {
    borderColor: Colors.neonGreen,
    backgroundColor: 'rgba(173,255,47,0.12)',
  },
  leagueChipText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
  leagueChipTextActive: { color: Colors.neonGreen },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  featureCard: {
    width: '48.5%',
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.18)',
  },
  featureTitle: { color: Colors.white, fontSize: 14, fontWeight: '700', marginTop: 8 },
  featureSubtitle: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  liveCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveBadge: { backgroundColor: Colors.liveRed, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  leagueLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveTeamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamLogoLarge: { width: 48, height: 48, borderRadius: 24 },
  teamLogoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  teamNameLive: { color: Colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  scoreCenterCol: { flex: 1, alignItems: 'center' },
  scoreText: { color: Colors.white, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  upcomingCard: {
    backgroundColor: 'rgba(22,31,50,0.5)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.12)',
    marginBottom: 8,
  },
  upcomingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  timeBox: { width: 42, alignItems: 'center' },
  timeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  dateText: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  teamsColumnContainer: { flex: 1, gap: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamNameSmall: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  leagueCode: { color: Colors.neonGreen, fontWeight: '700', fontSize: 12 },
  emptySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    marginBottom: 12,
  },
  emptySectionText: { color: Colors.textMuted, fontSize: 13 },
});

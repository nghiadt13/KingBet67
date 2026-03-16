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
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { MatchWithTeams } from '@/types/database';

export default function HomeScreen() {
  const router = useRouter();
  const { user, fetchUserProfile } = useAuthStore();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        `)
        .order('utc_date', { ascending: true })
        .limit(20);

      if (error) throw error;
      setMatches((data as unknown as MatchWithTeams[]) || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMatches(), fetchUserProfile()]);
    setRefreshing(false);
  }, []);

  const liveMatches = matches.filter(
    (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'
  );
  const scheduledMatches = matches.filter((m) => m.status === 'TIMED' || m.status === 'SCHEDULED');
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED');

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('vi-VN').format(balance) + 'đ';
  };



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

  if (loading) {
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
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <MaterialIcons name="sports-soccer" size={20} color={Colors.black} />
          </View>
          <Text style={styles.headerTitle}>KingBet67</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Số dư</Text>
            <Text style={styles.balanceValue}>
              {user ? formatBalance(user.balance) : '---'}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifButton}>
            <MaterialIcons name="notifications" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
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
        {/* Live Matches */}
        {liveMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.liveDot} />
                <Text style={styles.sectionTitle}>Trực tiếp</Text>
              </View>
            </View>
            {liveMatches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={styles.liveCard}
                onPress={() => router.push(`/match/${match.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.liveCardHeader}>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>Trực tiếp</Text>
                  </View>
                  <Text style={styles.leagueLabel}>Premier League</Text>
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
                    <Text style={styles.scoreText}>
                      {match.home_score ?? 0} - {match.away_score ?? 0}
                    </Text>
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
                {/* Quick odds */}
                {match.odds?.match_result && (
                  <View style={styles.quickOddsRow}>
                    <View style={styles.oddsChip}>
                      <Text style={styles.oddsChipLabel}>Chủ nhà</Text>
                      <Text style={styles.oddsChipValue}>{match.odds.match_result.home.toFixed(2)}</Text>
                    </View>
                    <View style={styles.oddsChip}>
                      <Text style={styles.oddsChipLabel}>Hòa</Text>
                      <Text style={styles.oddsChipValue}>{match.odds.match_result.draw.toFixed(2)}</Text>
                    </View>
                    <View style={styles.oddsChip}>
                      <Text style={styles.oddsChipLabel}>Khách</Text>
                      <Text style={styles.oddsChipValue}>{match.odds.match_result.away.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* No live matches hint */}
        {liveMatches.length === 0 && matches.length > 0 && (
          <View style={styles.emptySection}>
            <MaterialIcons name="live-tv" size={20} color={Colors.textMuted} />
            <Text style={styles.emptySectionText}>Không có trận trực tiếp</Text>
          </View>
        )}

        {/* Upcoming Matches */}
        {scheduledMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sắp tới</Text>
            </View>
            {scheduledMatches.map((match) => (
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
                      {match.home_team?.crest_url ? (
                        <Image source={{ uri: match.home_team.crest_url }} style={styles.teamLogoSmall} />
                      ) : (
                        <View style={[styles.teamLogoSmall, styles.teamLogoPlaceholder]}>
                          <MaterialIcons name="shield" size={10} color={Colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.teamNameSmall} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
                    </View>
                    <View style={styles.teamRow}>
                      {match.away_team?.crest_url ? (
                        <Image source={{ uri: match.away_team.crest_url }} style={styles.teamLogoSmall} />
                      ) : (
                        <View style={[styles.teamLogoSmall, styles.teamLogoPlaceholder]}>
                          <MaterialIcons name="shield" size={10} color={Colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.teamNameSmall} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
                    </View>
                  </View>
                </View>
                {match.odds?.match_result && (
                  <View style={styles.miniOddsRow}>
                    <View style={styles.miniOddsChip}>
                      <Text style={styles.miniOddsValue}>{match.odds.match_result.home.toFixed(2)}</Text>
                    </View>
                    <View style={styles.miniOddsChip}>
                      <Text style={styles.miniOddsValue}>{match.odds.match_result.draw.toFixed(2)}</Text>
                    </View>
                    <View style={styles.miniOddsChip}>
                      <Text style={styles.miniOddsValue}>{match.odds.match_result.away.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* No upcoming matches hint */}
        {scheduledMatches.length === 0 && matches.length > 0 && (
          <View style={styles.emptySection}>
            <MaterialIcons name="event" size={20} color={Colors.textMuted} />
            <Text style={styles.emptySectionText}>Không có trận sắp diễn ra</Text>
          </View>
        )}

        {/* Finished Matches */}
        {finishedMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kết thúc</Text>
            </View>
            {finishedMatches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={[styles.upcomingCard, { opacity: 0.7 }]}
                onPress={() => router.push(`/match/${match.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.upcomingLeft}>
                  <View style={styles.timeBox}>
                    <Text style={[styles.timeText, { color: Colors.textMuted }]}>KT</Text>
                    <Text style={styles.dateText}>{formatMatchDate(match.utc_date)}</Text>
                  </View>
                  <View style={styles.teamsColumnContainer}>
                    <View style={styles.teamRow}>
                      {match.home_team?.crest_url ? (
                        <Image source={{ uri: match.home_team.crest_url }} style={styles.teamLogoSmall} />
                      ) : (
                        <View style={[styles.teamLogoSmall, styles.teamLogoPlaceholder]}>
                          <MaterialIcons name="shield" size={10} color={Colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.teamNameSmall}>{match.home_team?.short_name || 'Home'}</Text>
                    </View>
                    <View style={styles.teamRow}>
                      {match.away_team?.crest_url ? (
                        <Image source={{ uri: match.away_team.crest_url }} style={styles.teamLogoSmall} />
                      ) : (
                        <View style={[styles.teamLogoSmall, styles.teamLogoPlaceholder]}>
                          <MaterialIcons name="shield" size={10} color={Colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.teamNameSmall}>{match.away_team?.short_name || 'Away'}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.finishedScore}>
                  {match.home_score ?? 0} - {match.away_score ?? 0}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {matches.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="sports-soccer" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Chưa có trận đấu nào</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  // Header
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
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: Colors.white, fontSize: 19, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
  balanceValue: { color: Colors.neonGreen, fontWeight: '700', fontSize: 15 },
  notifButton: { position: 'relative' },
  // ScrollView
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  // Section
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.liveRed },
  // Live Card
  liveCard: {
    backgroundColor: Colors.cardBg, borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)',
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
  scoreText: { color: Colors.white, fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  // Quick odds
  quickOddsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  oddsChip: {
    flex: 1, backgroundColor: 'rgba(30,41,59,0.5)', padding: 8, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(100,116,139,0.15)',
  },
  oddsChipLabel: { color: Colors.textMuted, fontSize: 9 },
  oddsChipValue: { color: Colors.neonGreen, fontSize: 14, fontWeight: '700', marginTop: 2 },
  // Upcoming Card
  upcomingCard: {
    backgroundColor: 'rgba(22,31,50,0.5)', borderRadius: 16, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.12)', marginBottom: 8,
  },
  upcomingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  timeBox: { width: 42, alignItems: 'center' },
  timeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  dateText: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  teamsColumnContainer: { flex: 1, gap: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamLogoSmall: { width: 16, height: 16, borderRadius: 8 },
  teamNameSmall: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  // Mini odds
  miniOddsRow: { flexDirection: 'row', gap: 6 },
  miniOddsChip: {
    backgroundColor: Colors.darkBg, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)',
  },
  miniOddsValue: { color: Colors.neonGreen, fontSize: 12, fontWeight: '700' },
  // Finished
  finishedScore: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  emptySection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surfaceDark, borderRadius: 12, marginHorizontal: 16, marginBottom: 12,
  },
  emptySectionText: { color: Colors.textMuted, fontSize: 13 },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { League, StandingWithTeam } from '@/types/database';

export default function StandingsScreen() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const fetchLeagues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      const items = (data || []) as League[];
      setLeagues(items);
      if (items.length > 0 && !selectedLeague) {
        setSelectedLeague(items[0].id);
      }
    } catch (err) {
      console.error('Error fetching leagues:', err);
    }
  }, [selectedLeague]);

  const fetchStandings = useCallback(async (leagueId: string) => {
    setStandingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('standings')
        .select('*, team:teams(id, name, short_name, tla, crest_url)')
        .eq('league_id', leagueId)
        .order('group_name', { ascending: true })
        .order('position', { ascending: true });

      if (error) {
        console.error('Standings query error:', error.message, error.code, error.details);
        // Table might not exist yet
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setStandings([]);
          return;
        }
        throw error;
      }
      console.log(`Standings loaded: ${(data || []).length} entries for league ${leagueId}`);
      setStandings((data || []) as StandingWithTeam[]);
    } catch (err) {
      console.error('Error fetching standings:', err);
      setStandings([]);
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchLeagues();
      setLoading(false);
    };
    init();
  }, [fetchLeagues]);

  useEffect(() => {
    if (selectedLeague) {
      fetchStandings(selectedLeague);
    }
  }, [selectedLeague, fetchStandings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeagues();
    if (selectedLeague) {
      await fetchStandings(selectedLeague);
    }
    setRefreshing(false);
  }, [fetchLeagues, fetchStandings, selectedLeague]);

  // Group standings by group_name
  const groupedStandings = useMemo(() => {
    const groups = new Map<string, StandingWithTeam[]>();
    for (const s of standings) {
      const key = s.group_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    // Sort groups: LEAGUE first, then GROUP_A, GROUP_B, etc.
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'LEAGUE') return -1;
      if (b === 'LEAGUE') return 1;
      return a.localeCompare(b);
    });
  }, [standings]);

  const hasGroups = groupedStandings.length > 1 || (groupedStandings.length === 1 && groupedStandings[0][0] !== 'LEAGUE');

  const formatGroupName = (name: string): string => {
    if (name === 'LEAGUE') return 'Bảng xếp hạng';
    if (name === 'League phase') return 'Vòng bảng (League Phase)';
    // GROUP_A → Bảng A, GROUP_B → Bảng B, etc.
    const match = name.match(/GROUP_([A-Z])/);
    if (match) return `Bảng ${match[1]}`;
    // Fallback: capitalize
    return name.replace(/_/g, ' ');
  };

  const selectedLeagueObj = leagues.find((l) => l.id === selectedLeague);

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bảng xếp hạng</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* League Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.leagueFilterContainer}
        contentContainerStyle={styles.leagueFilterRow}
      >
        {leagues.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={[
              styles.leagueChip,
              selectedLeague === league.id && styles.leagueChipActive,
            ]}
            onPress={() => setSelectedLeague(league.id)}
          >
            {league.emblem_url ? (
              <Image source={{ uri: league.emblem_url }} style={styles.leagueEmblem} />
            ) : null}
            <Text
              style={[
                styles.leagueChipText,
                selectedLeague === league.id && styles.leagueChipTextActive,
              ]}
              numberOfLines={1}
            >
              {league.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Standings Content */}
      <ScrollView
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
        {standingsLoading ? (
          <ActivityIndicator size="large" color={Colors.neonGreen} style={{ marginTop: 48 }} />
        ) : standings.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="emoji-events" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Chưa có dữ liệu BXH</Text>
            <Text style={styles.emptySubtitle}>
              Hãy chạy Sync trên Admin Dashboard để cập nhật dữ liệu.
            </Text>
          </View>
        ) : (
          groupedStandings.map(([groupName, entries]) => (
            <View key={groupName} style={styles.groupSection}>
              {/* Group Header */}
              <View style={styles.groupHeader}>
                <MaterialIcons
                  name={hasGroups ? 'groups' : 'emoji-events'}
                  size={18}
                  color={Colors.neonGreen}
                />
                <Text style={styles.groupTitle}>{formatGroupName(groupName)}</Text>
                <Text style={styles.groupSubtitle}>
                  {selectedLeagueObj?.name || ''}
                </Text>
              </View>

              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colRank]}>#</Text>
                <Text style={[styles.tableHeaderCell, styles.colTeam]}>Đội</Text>
                <Text style={styles.tableHeaderCell}>Tr</Text>
                <Text style={styles.tableHeaderCell}>T</Text>
                <Text style={styles.tableHeaderCell}>H</Text>
                <Text style={styles.tableHeaderCell}>B</Text>
                <Text style={styles.tableHeaderCell}>HS</Text>
                <Text style={[styles.tableHeaderCell, styles.colPoints]}>Đ</Text>
              </View>

              {/* Table Rows */}
              {entries.map((entry, index) => {
                const isTop = entry.position <= (hasGroups ? 2 : 4);
                const isBottom = !hasGroups && entry.position >= entries.length - 2;

                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.tableRow,
                      index % 2 === 0 && styles.tableRowAlt,
                      isTop && styles.tableRowTop,
                      isBottom && styles.tableRowBottom,
                    ]}
                  >
                    {/* Rank */}
                    <View style={[styles.colRank, styles.rankCell]}>
                      <Text
                        style={[
                          styles.rankText,
                          entry.position === 1 && { color: Colors.gold },
                          entry.position === 2 && { color: Colors.silver },
                          entry.position === 3 && { color: Colors.bronze },
                        ]}
                      >
                        {entry.position}
                      </Text>
                    </View>

                    {/* Team */}
                    <View style={[styles.colTeam, styles.teamCell]}>
                      {entry.team?.crest_url ? (
                        <Image
                          source={{ uri: entry.team.crest_url }}
                          style={styles.teamCrest}
                        />
                      ) : (
                        <View style={styles.teamCrestPlaceholder}>
                          <MaterialIcons name="shield" size={14} color={Colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.teamName} numberOfLines={1}>
                        {entry.team?.short_name || entry.team?.tla || '?'}
                      </Text>
                    </View>

                    {/* Stats */}
                    <Text style={styles.statCell}>{entry.played_games}</Text>
                    <Text style={[styles.statCell, { color: Colors.successGreen }]}>{entry.won}</Text>
                    <Text style={styles.statCell}>{entry.draw}</Text>
                    <Text style={[styles.statCell, { color: Colors.errorRed }]}>{entry.lost}</Text>
                    <Text
                      style={[
                        styles.statCell,
                        {
                          color:
                            entry.goal_difference > 0
                              ? Colors.successGreen
                              : entry.goal_difference < 0
                                ? Colors.errorRed
                                : Colors.textSecondary,
                        },
                      ]}
                    >
                      {entry.goal_difference > 0 ? '+' : ''}
                      {entry.goal_difference}
                    </Text>
                    <Text style={[styles.statCell, styles.colPoints, styles.pointsText]}>
                      {entry.points}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* Legend */}
        {standings.length > 0 && !hasGroups && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(34,197,94,0.3)' }]} />
              <Text style={styles.legendText}>Champions League / Thăng hạng</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 'rgba(248,113,113,0.3)' }]} />
              <Text style={styles.legendText}>Xuống hạng</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.darkBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 8, borderRadius: 20 },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  // League filter
  leagueFilterContainer: {
    flexGrow: 0,
    flexShrink: 0,
  },
  leagueFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 24,
  },
  leagueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(30,41,59,0.45)',
    flexShrink: 0,
    alignSelf: 'center',
  },
  leagueChipActive: {
    backgroundColor: Colors.neonGreenBg,
    borderColor: Colors.neonGreen,
  },
  leagueChipText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  leagueChipTextActive: { color: Colors.neonGreen },
  leagueEmblem: { width: 18, height: 18, borderRadius: 4 },
  // Content
  scrollContent: { paddingBottom: 40 },
  // Group
  groupSection: {
    marginHorizontal: 12,
    marginBottom: 20,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  groupTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  groupSubtitle: { color: Colors.textMuted, fontSize: 12, marginLeft: 'auto' },
  // Table header
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  tableHeaderCell: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 28,
    textAlign: 'center',
  },
  colRank: { width: 28 },
  colTeam: { flex: 1 },
  colPoints: { width: 32 },
  // Table row
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  tableRowAlt: { backgroundColor: 'rgba(15,23,42,0.2)' },
  tableRowTop: { borderLeftWidth: 2.5, borderLeftColor: 'rgba(34,197,94,0.5)' },
  tableRowBottom: { borderLeftWidth: 2.5, borderLeftColor: 'rgba(248,113,113,0.5)' },
  // Rank
  rankCell: { justifyContent: 'center', alignItems: 'center' },
  rankText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  // Team
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamCrest: { width: 20, height: 20, borderRadius: 4 },
  teamCrestPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(100,116,139,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamName: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Stats
  statCell: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    width: 28,
    textAlign: 'center',
  },
  pointsText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Legend
  legend: {
    paddingHorizontal: 24,
    marginTop: 8,
    gap: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: { color: Colors.textMuted, fontSize: 11 },
});

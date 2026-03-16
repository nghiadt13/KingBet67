import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Team } from '@/types/database';

export default function MatchesScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStandings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching standings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandings();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStandings();
    setRefreshing(false);
  }, []);

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
        <MaterialIcons name="emoji-events" size={28} color={Colors.neonGreen} />
        <Text style={styles.headerTitle}>KingBet67</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab selector */}
      <View style={styles.tabContainer}>
        <View style={styles.tabActive}>
          <Text style={styles.tabActiveText}>Bảng xếp hạng</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.neonGreen}
            colors={[Colors.neonGreen]}
          />
        }
      >
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHash, styles.headerText]}>#</Text>
            <Text style={[styles.colClub, styles.headerText]}>Câu lạc bộ</Text>
            <Text style={[styles.colStat, styles.headerText]}>Trận</Text>
            <Text style={[styles.colStat, styles.headerText]}>HS</Text>
            <Text style={[styles.colStat, styles.headerText]}>Điểm</Text>
          </View>

          {/* Table Rows */}
          {teams.map((team, index) => {
            const rank = team.position || index + 1;
            const isTop4 = rank <= 4;
            const isBottom3 = rank >= 18;

            return (
              <View
                key={team.id}
                style={[
                  styles.tableRow,
                  isTop4 && styles.topRow,
                  isBottom3 && styles.bottomRow,
                ]}
              >
                <Text
                  style={[
                    styles.colHash,
                    styles.rankText,
                    isTop4 && { color: Colors.successGreen, fontWeight: '700' },
                    isBottom3 && { color: Colors.errorRed, fontWeight: '700' },
                  ]}
                >
                  {rank}
                </Text>
                <View style={[styles.colClub, styles.clubCell]}>
                  {team.crest_url ? (
                    <Image source={{ uri: team.crest_url }} style={styles.clubLogo} />
                  ) : (
                    <View style={[styles.clubLogo, styles.clubLogoPlaceholder]}>
                      <MaterialIcons name="shield" size={12} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.clubName} numberOfLines={1}>{team.short_name || team.name}</Text>
                </View>
                <Text style={[styles.colStat, styles.statText]}>{team.played_games}</Text>
                <Text style={[styles.colStat, styles.statTextMuted]}>
                  {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                </Text>
                <Text style={[styles.colStat, styles.pointsText]}>{team.points}</Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.successGreenBg, borderColor: Colors.successGreen }]} />
            <Text style={styles.legendText}>Champions League</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.errorRedBg, borderColor: Colors.errorRed }]} />
            <Text style={styles.legendText}>Xuống hạng</Text>
          </View>
        </View>
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
  // Tab
  tabContainer: {
    paddingHorizontal: 16, paddingVertical: 12,
  },
  tabActive: {
    backgroundColor: Colors.navBg, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  tabActiveText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '700' },
  // Table
  scrollView: { flex: 1 },
  tableContainer: {
    marginHorizontal: 16, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.1)',
  },
  topRow: { backgroundColor: 'rgba(34,197,94,0.06)' },
  bottomRow: { backgroundColor: 'rgba(239,68,68,0.06)' },
  // Columns
  colHash: { width: 30, textAlign: 'center' },
  colClub: { flex: 1 },
  colStat: { width: 45, textAlign: 'center' },
  clubCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubLogo: { width: 22, height: 22, borderRadius: 11 },
  clubLogoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  clubName: { color: Colors.white, fontSize: 13, fontWeight: '600', flex: 1 },
  rankText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  statText: { color: Colors.white, fontSize: 13 },
  statTextMuted: { color: Colors.textMuted, fontSize: 13 },
  pointsText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '700' },
  // Legend
  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
});

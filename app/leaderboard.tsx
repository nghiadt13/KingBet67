import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { LeaderboardEntry } from '@/types/database';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_type: 'top_winners', p_limit: 20 });
      if (error) throw error;
      setEntries((data as unknown as LeaderboardEntry[]) || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
  const formatPoints = (pts: number) => new Intl.NumberFormat('vi-VN').format(pts);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bảng xếp hạng</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={Colors.neonGreen} colors={[Colors.neonGreen]}
          />
        }
      >
        {/* Podium Top 3 */}
        {top3.length >= 3 && (
          <View style={styles.podium}>
            {/* Silver #2 */}
            <View style={[styles.podiumItem, { marginTop: 20 }]}>
              <View style={styles.rankBadgeSilver}>
                <Text style={styles.rankBadgeText}>2</Text>
              </View>
              <View style={[styles.podiumAvatar, styles.podiumAvatarSilver]}>
                <Text style={styles.podiumInitials}>{getInitials(top3[1].username)}</Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{top3[1].username}</Text>
              <Text style={styles.podiumPoints}>{formatPoints(top3[1].total)} pts</Text>
            </View>

            {/* Gold #1 */}
            <View style={styles.podiumItem}>
              <View style={styles.rankBadgeGold}>
                <Text style={styles.rankBadgeText}>1</Text>
              </View>
              <View style={[styles.podiumAvatar, styles.podiumAvatarGold]}>
                <Text style={styles.podiumInitials}>{getInitials(top3[0].username)}</Text>
              </View>
              <Text style={[styles.podiumName, { fontWeight: '700' }]} numberOfLines={1}>{top3[0].username}</Text>
              <Text style={[styles.podiumPoints, { color: Colors.gold }]}>{formatPoints(top3[0].total)} pts</Text>
            </View>

            {/* Bronze #3 */}
            <View style={[styles.podiumItem, { marginTop: 20 }]}>
              <View style={styles.rankBadgeBronze}>
                <Text style={styles.rankBadgeText}>3</Text>
              </View>
              <View style={[styles.podiumAvatar, styles.podiumAvatarBronze]}>
                <Text style={styles.podiumInitials}>{getInitials(top3[2].username)}</Text>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{top3[2].username}</Text>
              <Text style={styles.podiumPoints}>{formatPoints(top3[2].total)} pts</Text>
            </View>
          </View>
        )}

        {/* Ranking List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={[styles.colRank, styles.listHeaderText]}>Hạng</Text>
            <Text style={[styles.colName, styles.listHeaderText]}>Người chơi</Text>
            <Text style={[styles.colPoints, styles.listHeaderText]}>Điểm</Text>
          </View>
          {rest.map((entry, index) => (
            <View key={entry.username} style={styles.listRow}>
              <Text style={styles.colRankValue}>#{index + 4}</Text>
              <View style={[styles.colName, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <View style={styles.listAvatar}>
                  <Text style={styles.listAvatarText}>{getInitials(entry.username)}</Text>
                </View>
                <Text style={styles.listName}>{entry.username}</Text>
              </View>
              <Text style={styles.colPointsValue}>{formatPoints(entry.total)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky user rank footer */}
      {user && (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyCard}>
            <Text style={styles.stickyRank}>—</Text>
            <View style={styles.stickyUserInfo}>
              <View style={styles.stickyAvatar}>
                <MaterialIcons name="person" size={18} color={Colors.white} />
              </View>
              <Text style={styles.stickyName}>Bạn ({user.username})</Text>
            </View>
            <Text style={styles.stickyPoints}>{formatPoints(user.balance)} pts</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 50,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  scrollContent: { paddingBottom: 100 },
  // Podium
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 28, gap: 16 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumAvatar: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  podiumAvatarGold: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.gold, backgroundColor: 'rgba(251,191,36,0.15)' },
  podiumAvatarSilver: { borderWidth: 2, borderColor: Colors.silver, backgroundColor: 'rgba(148,163,184,0.15)' },
  podiumAvatarBronze: { borderWidth: 2, borderColor: Colors.bronze, backgroundColor: 'rgba(217,119,6,0.15)' },
  podiumInitials: { color: Colors.white, fontSize: 20, fontWeight: '700' },
  podiumName: { color: Colors.white, fontSize: 13, fontWeight: '600', textAlign: 'center', width: 80 },
  podiumPoints: { color: Colors.blueAccent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  rankBadgeGold: {
    position: 'absolute', top: -10, left: -6, zIndex: 1,
    backgroundColor: Colors.gold, width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.darkBg,
  },
  rankBadgeSilver: {
    position: 'absolute', top: 10, left: -4, zIndex: 1,
    backgroundColor: Colors.silver, width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.darkBg,
  },
  rankBadgeBronze: {
    position: 'absolute', top: 10, left: -4, zIndex: 1,
    backgroundColor: Colors.bronze, width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.darkBg,
  },
  rankBadgeText: { color: Colors.darkBg, fontSize: 11, fontWeight: '900' },
  // List
  listContainer: {
    marginHorizontal: 16, backgroundColor: Colors.cardBg, borderRadius: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)',
  },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  listHeaderText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.1)',
  },
  colRank: { width: 45 },
  colName: { flex: 1 },
  colPoints: { width: 60, textAlign: 'right' },
  colRankValue: { width: 45, color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  listAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(100,116,139,0.2)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)',
  },
  listAvatarText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  listName: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  colPointsValue: { width: 60, color: Colors.white, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  // Sticky footer
  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.8)',
  },
  stickyCard: {
    backgroundColor: Colors.blueAccent, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  stickyRank: { width: 36, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
  stickyUserInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  stickyAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(96,165,250,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  stickyName: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  stickyPoints: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});

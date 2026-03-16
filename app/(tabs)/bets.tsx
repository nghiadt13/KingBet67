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
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { BetWithMatch, BetStatus } from '@/types/database';

type FilterTab = 'all' | 'PENDING' | 'WON' | 'LOST';

export default function BetsScreen() {
  const { user } = useAuthStore();
  const [bets, setBets] = useState<BetWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchBets = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('bets')
        .select(`
          *,
          match:matches(
            *,
            home_team:teams!matches_home_team_id_fkey(*),
            away_team:teams!matches_away_team_id_fkey(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBets((data as unknown as BetWithMatch[]) || []);
    } catch (err) {
      console.error('Error fetching bets:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBets();
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBets();
    setRefreshing(false);
  }, [fetchBets]);

  const filteredBets = activeTab === 'all'
    ? bets
    : bets.filter((b) => b.status === activeTab);

  const pendingBets = bets.filter((b) => b.status === 'PENDING');
  const historyBets = bets.filter((b) => b.status !== 'PENDING');

  const getStatusConfig = (status: BetStatus) => {
    switch (status) {
      case 'PENDING': return { text: 'Đang chờ', color: Colors.pendingYellow, bg: Colors.pendingYellowBg };
      case 'WON': return { text: 'Thắng', color: Colors.neonGreen, bg: Colors.neonGreenBg };
      case 'LOST': return { text: 'Thua', color: Colors.errorRed, bg: Colors.errorRedBg };
    }
  };

  const getBetTypeLabel = (betType: string) => {
    switch (betType) {
      case 'match_result': return 'Kết quả trận';
      case 'correct_score': return 'Tỉ số chính xác';
      case 'over_under': return 'Tài/Xỉu';
      case 'btts': return 'Hai đội ghi bàn';
      case 'half_time': return 'Hiệp 1';
      default: return betType;
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'WON', label: 'Đã thắng' },
    { key: 'LOST', label: 'Đã thua' },
  ];

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
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>KingBet67</Text>
        <TouchableOpacity style={styles.searchButton}>
          <MaterialIcons name="search" size={22} color={Colors.neonGreen} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={Colors.neonGreen} colors={[Colors.neonGreen]}
          />
        }
      >
        <Text style={styles.sectionLabel}>Lịch sử đơn cược</Text>

        {filteredBets.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Chưa có đơn cược nào</Text>
          </View>
        )}

        {filteredBets.map((bet) => {
          const statusCfg = getStatusConfig(bet.status);
          const match = bet.match;
          const homeName = match?.home_team?.short_name || 'Home';
          const awayName = match?.away_team?.short_name || 'Away';
          const isWon = bet.status === 'WON';

          return (
            <View
              key={bet.id}
              style={[
                styles.betCard,
                isWon && styles.betCardWon,
              ]}
            >
              <View style={styles.betCardHeader}>
                <View>
                  <Text style={[styles.leagueLabel, isWon && { color: Colors.neonGreen }]}>
                    Premier League
                  </Text>
                  <Text style={styles.matchTitle}>{homeName} vs {awayName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                    {statusCfg.text}
                  </Text>
                </View>
              </View>

              <View style={styles.betCardMid}>
                <View>
                  <Text style={styles.midLabel}>Kết quả</Text>
                  <Text style={styles.midValue}>{getBetTypeLabel(bet.bet_type)}: {bet.bet_choice}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.midLabel}>Thời gian</Text>
                  <Text style={styles.midValueMuted}>{formatDate(bet.created_at)}</Text>
                </View>
              </View>

              <View style={styles.betCardFooter}>
                <View>
                  <Text style={styles.footLabel}>Điểm đặt</Text>
                  <Text style={styles.footValue}>{formatAmount(bet.amount)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.footLabel}>Điểm nhận</Text>
                  <Text style={[
                    styles.footValueBig,
                    { color: isWon ? Colors.neonGreen : bet.status === 'LOST' ? Colors.errorRed : Colors.white }
                  ]}>
                    {isWon ? `+${formatAmount(bet.winnings)}` : bet.status === 'LOST' ? '0' : 'Chờ'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
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
    borderBottomWidth: 1, borderBottomColor: 'rgba(173,255,47,0.12)',
  },
  headerTitle: { color: Colors.neonGreen, fontSize: 19, fontWeight: '700' },
  searchButton: { padding: 8 },
  // Tabs
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: Colors.transparent },
  tabActive: { borderBottomColor: Colors.neonGreen },
  tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: Colors.neonGreen },
  // Content
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },
  sectionLabel: { color: Colors.white, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  // Bet Card
  betCard: {
    backgroundColor: Colors.surfaceDark, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 12,
  },
  betCardWon: { borderColor: 'rgba(173,255,47,0.15)' },
  betCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  leagueLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  matchTitle: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  betCardMid: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)',
  },
  midLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 3 },
  midValue: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  midValueMuted: { color: Colors.textSecondary, fontSize: 12 },
  betCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  footLabel: { color: Colors.textMuted, fontSize: 11 },
  footValue: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  footValueBig: { fontSize: 17, fontWeight: '700' },
  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});

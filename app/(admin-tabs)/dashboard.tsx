import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { AdminStats } from '@/types/database';
import AdminHeader from '@/components/admin/AdminHeader';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      setStats(data as unknown as AdminStats);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.neonGreen} /></View>;
  }

  const cards = [
    { icon: 'people' as const, label: 'Tổng Users', value: fmt(stats?.total_users ?? 0), color: '#3b82f6' },
    { icon: 'receipt-long' as const, label: 'Tổng Bets', value: fmt(stats?.total_bets ?? 0), color: Colors.neonGreen },
    { icon: 'payments' as const, label: 'Tổng tiền', value: fmt(stats?.total_money_circulation ?? 0) + 'đ', color: '#f59e0b' },
    { icon: 'pending' as const, label: 'Pending Bets', value: fmt(stats?.pending_bets ?? 0), color: '#ef4444' },
  ];

  return (
    <View style={styles.container}>
      <AdminHeader title="📊 Admin Dashboard" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.cardsGrid}>
          {cards.map((card) => (
            <View key={card.label} style={styles.card}>
              <MaterialIcons name={card.icon} size={24} color={card.color} />
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        {stats?.hottest_match && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Trận hot nhất</Text>
            <View style={styles.hotCard}>
              <Text style={styles.hotMatch}>
                {stats.hottest_match.home_team_name} vs {stats.hottest_match.away_team_name}
              </Text>
              <Text style={styles.hotBets}>{stats.hottest_match.bet_count} bets</Text>
            </View>
          </View>
        )}

        {stats?.top_users && stats.top_users.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Top 5 Users</Text>
            {stats.top_users.map((u, i) => (
              <View key={u.username} style={styles.topUserRow}>
                <Text style={styles.topUserRank}>#{i + 1}</Text>
                <Text style={styles.topUserName}>{u.username}</Text>
                <Text style={styles.topUserWin}>{fmt(u.total_winnings)}đ</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loading: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 20 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', backgroundColor: Colors.surfaceDark, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  cardLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  cardValue: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  section: { marginTop: 24 },
  sectionTitle: { color: Colors.white, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  hotCard: {
    backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  hotMatch: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  hotBets: { color: Colors.neonGreen, fontSize: 14, fontWeight: '700' },
  topUserRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.1)',
  },
  topUserRank: { width: 30, color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  topUserName: { flex: 1, color: Colors.white, fontSize: 14, fontWeight: '500' },
  topUserWin: { color: Colors.neonGreen, fontSize: 14, fontWeight: '700' },
});

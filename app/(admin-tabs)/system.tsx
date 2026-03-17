import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/AdminHeader';

export default function AdminSystemScreen() {
  const [syncing, setSyncing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [settleResult, setSettleResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-matches');
      if (error) throw error;
      const leagueLine = Array.isArray(data?.league_summaries)
        ? `Leagues: ${data.league_summaries.length} | `
        : '';
      setSyncResult(
        `✅ Sync thành công: ${leagueLine}Matches ${data?.matches_updated ?? 0}, Odds ${data?.odds_calculated ?? 0}, Settled ${data?.matches_settled ?? 0}`,
      );
    } catch (err: any) {
      setSyncResult(`❌ Lỗi: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    setSettleResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('settle-bets');
      if (error) throw error;
      setSettleResult(`✅ Settle thành công: ${JSON.stringify(data).slice(0, 100)}`);
    } catch (err: any) {
      setSettleResult(`❌ Lỗi: ${err.message}`);
    } finally {
      setSettling(false);
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="⚙️ System Controls" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Sync */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="sync" size={24} color={Colors.neonGreen} />
            <Text style={styles.cardTitle}>Sync Matches</Text>
          </View>
          <Text style={styles.cardDesc}>
            Gọi Edge Function sync-matches để cập nhật trận đấu từ football-data.org
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, syncing && { opacity: 0.7 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.actionButtonText}>Sync Now</Text>
            )}
          </TouchableOpacity>
          {syncResult && <Text style={styles.resultText}>{syncResult}</Text>}
        </View>

        {/* Settle */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="gavel" size={24} color={Colors.pendingYellow} />
            <Text style={styles.cardTitle}>Settle Bets</Text>
          </View>
          <Text style={styles.cardDesc}>
            Xử lý kết quả bet cho các trận đã kết thúc — tự động WON/LOST + trả thưởng
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.settleButton, settling && { opacity: 0.7 }]}
            onPress={handleSettle}
            disabled={settling}
          >
            {settling ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.actionButtonText}>Settle Now</Text>
            )}
          </TouchableOpacity>
          {settleResult && <Text style={styles.resultText}>{settleResult}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.surfaceDark, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  cardDesc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  actionButton: {
    backgroundColor: Colors.neonGreen, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', ...Shadows.neonGlow,
  },
  settleButton: { backgroundColor: Colors.pendingYellow },
  actionButtonText: { color: Colors.black, fontSize: 15, fontWeight: '800' },
  resultText: { color: Colors.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 17 },
});

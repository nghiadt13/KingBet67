import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { MatchWithTeams, BetType } from '@/types/database';

interface OddOption {
  betType: BetType;
  label: string;
  choice: string;
  odds: number;
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, fetchUserProfile } = useAuthStore();
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [loading, setLoading] = useState(true);

  // Betting state
  const [selectedOdd, setSelectedOdd] = useState<OddOption | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    fetchMatch();
  }, [id]);

  const fetchMatch = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setMatch(data as unknown as MatchWithTeams);
    } catch (err) {
      console.error('Error fetching match:', err);
    } finally {
      setLoading(false);
    }
  };

  const canBet = match && (match.status === 'TIMED' || match.status === 'SCHEDULED');

  const getStatusLabel = () => {
    if (!match) return '';
    switch (match.status) {
      case 'IN_PLAY': return 'Đang diễn ra';
      case 'PAUSED': return 'Nghỉ giữa hiệp';
      case 'FINISHED': return 'Kết thúc';
      case 'TIMED':
      case 'SCHEDULED': return 'Sắp diễn ra';
      case 'POSTPONED': return 'Hoãn';
      case 'CANCELLED': return 'Hủy';
      default: return match.status;
    }
  };

  const handleSelectOdd = (odd: OddOption) => {
    setSelectedOdd(odd);
    setBetAmount('');
  };

  const handlePlaceBet = async () => {
    if (!selectedOdd || !betAmount || !match) return;
    const amount = parseInt(betAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Số tiền không hợp lệ');
      return;
    }
    if (user && amount > user.balance) {
      Alert.alert('Lỗi', 'Số dư không đủ');
      return;
    }

    setPlacing(true);
    try {
      const { error } = await supabase.rpc('place_bet', {
        p_match_id: match.id,
        p_bet_type: selectedOdd.betType,
        p_bet_choice: selectedOdd.choice,
        p_amount: amount,
      });
      if (error) throw error;

      Alert.alert('Thành công!', `Đã đặt ${new Intl.NumberFormat('vi-VN').format(amount)}đ vào ${selectedOdd.label}`);
      setSelectedOdd(null);
      setBetAmount('');
      await fetchUserProfile();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Đặt cược thất bại');
    } finally {
      setPlacing(false);
    }
  };

  const potentialWin = selectedOdd && betAmount
    ? Math.round(parseInt(betAmount || '0') * selectedOdd.odds)
    : 0;

  if (loading || !match) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  const odds = match.odds;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết trận đấu</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Scoreboard */}
        <View style={styles.scoreSection}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{getStatusLabel()}</Text>
          </View>
          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              {match.home_team?.crest_url ? (
                <View style={styles.teamLogoCircle}>
                  <Image source={{ uri: match.home_team.crest_url }} style={styles.teamLogo} />
                </View>
              ) : (
                <View style={[styles.teamLogoCircle, styles.teamLogoPlaceholder]}>
                  <MaterialIcons name="shield" size={28} color={Colors.textMuted} />
                </View>
              )}
              <Text style={styles.teamName}>{match.home_team?.short_name || 'Home'}</Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreDigits}>
                <Text>{match.home_score ?? '-'}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)' }}> - </Text>
                <Text>{match.away_score ?? '-'}</Text>
              </Text>
            </View>
            <View style={styles.teamCol}>
              {match.away_team?.crest_url ? (
                <View style={styles.teamLogoCircle}>
                  <Image source={{ uri: match.away_team.crest_url }} style={styles.teamLogo} />
                </View>
              ) : (
                <View style={[styles.teamLogoCircle, styles.teamLogoPlaceholder]}>
                  <MaterialIcons name="shield" size={28} color={Colors.textMuted} />
                </View>
              )}
              <Text style={styles.teamName}>{match.away_team?.short_name || 'Away'}</Text>
            </View>
          </View>
        </View>

        {/* Odds Section */}
        {canBet && odds && (
          <View style={styles.oddsSection}>
            <View style={styles.oddsSectionHeader}>
              <Text style={styles.oddsSectionTitle}>Dự đoán</Text>
              <Text style={styles.oddsSectionSub}>Tỉ lệ cược</Text>
            </View>

            {/* 1X2 */}
            {odds.match_result && (
              <View style={styles.oddsGrid}>
                {[
                  { label: 'Thắng', choice: 'HOME_TEAM', odds: odds.match_result.home },
                  { label: 'Hòa', choice: 'DRAW', odds: odds.match_result.draw },
                  { label: 'Thua', choice: 'AWAY_TEAM', odds: odds.match_result.away },
                ].map((item) => {
                  const isSelected = selectedOdd?.betType === 'match_result' && selectedOdd?.choice === item.choice;
                  return (
                    <TouchableOpacity
                      key={item.choice}
                      style={[styles.oddCard, isSelected && styles.oddCardSelected]}
                      onPress={() => handleSelectOdd({ betType: 'match_result', ...item })}
                    >
                      <Text style={styles.oddCardLabel}>{item.label}</Text>
                      <Text style={[styles.oddCardValue, isSelected && styles.oddCardValueSelected]}>
                        {item.odds.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Over/Under */}
            {odds.over_under && (
              <>
                <Text style={styles.oddsGroupTitle}>Tài / Xỉu 2.5</Text>
                <View style={styles.oddsGrid2}>
                  {[
                    { label: 'Tài', choice: 'OVER', odds: odds.over_under.over },
                    { label: 'Xỉu', choice: 'UNDER', odds: odds.over_under.under },
                  ].map((item) => {
                    const isSelected = selectedOdd?.betType === 'over_under' && selectedOdd?.choice === item.choice;
                    return (
                      <TouchableOpacity
                        key={item.choice}
                        style={[styles.oddCard, isSelected && styles.oddCardSelected]}
                        onPress={() => handleSelectOdd({ betType: 'over_under', ...item })}
                      >
                        <Text style={styles.oddCardLabel}>{item.label}</Text>
                        <Text style={[styles.oddCardValue, isSelected && styles.oddCardValueSelected]}>
                          {item.odds.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* BTTS */}
            {odds.btts && (
              <>
                <Text style={styles.oddsGroupTitle}>Hai đội cùng ghi bàn</Text>
                <View style={styles.oddsGrid2}>
                  {[
                    { label: 'Có', choice: 'YES', odds: odds.btts.yes },
                    { label: 'Không', choice: 'NO', odds: odds.btts.no },
                  ].map((item) => {
                    const isSelected = selectedOdd?.betType === 'btts' && selectedOdd?.choice === item.choice;
                    return (
                      <TouchableOpacity
                        key={item.choice}
                        style={[styles.oddCard, isSelected && styles.oddCardSelected]}
                        onPress={() => handleSelectOdd({ betType: 'btts', ...item })}
                      >
                        <Text style={styles.oddCardLabel}>{item.label}</Text>
                        <Text style={[styles.oddCardValue, isSelected && styles.oddCardValueSelected]}>
                          {item.odds.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        {/* Not bettable state */}
        {!canBet && (
          <View style={styles.noBetSection}>
            <MaterialIcons name="info-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.noBetText}>Trận đấu đã/đang diễn ra — không thể đặt cược</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bet Action */}
      {selectedOdd && (
        <View style={styles.betSheet}>
          <View style={styles.betSheetHeader}>
            <View>
              <Text style={styles.betSheetLabel}>Lựa chọn: {selectedOdd.label}</Text>
              <Text style={styles.betSheetOdds}>Tỉ lệ: {selectedOdd.odds.toFixed(2)}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedOdd(null)}>
              <MaterialIcons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.betInputRow}>
            <TextInput
              style={styles.betInput}
              placeholder="Nhập số tiền đặt..."
              placeholderTextColor={Colors.textMuted}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="number-pad"
            />
          </View>
          {potentialWin > 0 && (
            <Text style={styles.potentialWinText}>
              Tiền thắng dự kiến: <Text style={{ color: Colors.neonGreen, fontWeight: '700' }}>
                {new Intl.NumberFormat('vi-VN').format(potentialWin)}đ
              </Text>
            </Text>
          )}
          <TouchableOpacity
            style={[styles.placeBetButton, placing && { opacity: 0.7 }]}
            onPress={handlePlaceBet}
            disabled={placing}
          >
            {placing ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.placeBetText}>Đặt cược ngay</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Simple bet CTA when nothing selected */}
      {canBet && !selectedOdd && (
        <View style={styles.betCTA}>
          <Text style={styles.betCTAHint}>Chọn một kèo ở trên để đặt cược</Text>
        </View>
      )}
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
    backgroundColor: 'rgba(15,23,42,0.9)', borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingBottom: 120 },
  // Score
  scoreSection: {
    padding: 24, backgroundColor: Colors.surfaceDark,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  statusChip: {
    backgroundColor: Colors.neonGreenBg, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: 16,
  },
  statusChipText: { color: Colors.neonGreen, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  teamCol: { alignItems: 'center', gap: 10, flex: 1 },
  teamLogoCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: 6,
  },
  teamLogo: { width: '100%', height: '100%', borderRadius: 24 },
  teamLogoPlaceholder: {},
  teamName: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  scoreCol: { alignItems: 'center', flex: 1 },
  scoreDigits: { color: Colors.white, fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  // Odds
  oddsSection: { padding: 16, marginTop: 8 },
  oddsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  oddsSectionTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  oddsSectionSub: { color: Colors.textMuted, fontSize: 11 },
  oddsGrid: { flexDirection: 'row', gap: 10 },
  oddsGrid2: { flexDirection: 'row', gap: 10 },
  oddsGroupTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 10 },
  oddCard: {
    flex: 1, backgroundColor: Colors.surfaceDark,
    borderWidth: 1, borderColor: Colors.borderLight,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  oddCardSelected: { borderColor: Colors.neonGreenBorder, backgroundColor: Colors.neonGreenBg },
  oddCardLabel: { color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  oddCardValue: { color: Colors.neonGreen, fontSize: 17, fontWeight: '700' },
  oddCardValueSelected: { color: Colors.neonGreen },
  // No bet
  noBetSection: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 20, margin: 16, backgroundColor: Colors.surfaceDark,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight,
  },
  noBetText: { color: Colors.textMuted, fontSize: 13, flex: 1 },
  // Bet Sheet
  betSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.navBg, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, paddingBottom: 32,
  },
  betSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  betSheetLabel: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  betSheetOdds: { color: Colors.neonGreen, fontSize: 12, marginTop: 2 },
  betInputRow: { marginBottom: 8 },
  betInput: {
    backgroundColor: Colors.darkBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.white, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  potentialWinText: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12 },
  placeBetButton: {
    backgroundColor: Colors.neonGreen, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', ...Shadows.neonGlow,
  },
  placeBetText: { color: Colors.black, fontSize: 15, fontWeight: '800' },
  // CTA
  betCTA: { padding: 16, paddingBottom: 32, backgroundColor: Colors.navBg, borderTopWidth: 0.5, borderTopColor: Colors.border },
  betCTAHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});

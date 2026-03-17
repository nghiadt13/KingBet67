import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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

const DEFAULT_SCORES_COUNT = 6;
const MIN_BET = 10000;
const QUICK_AMOUNTS = [50000, 100000, 500000];

const mapErrorToVietnamese = (msg: string): string => {
  const map: Record<string, string> = {
    INSUFFICIENT_BALANCE: 'Số dư không đủ để đặt cược',
    MATCH_NOT_OPEN: 'Trận đấu không thể đặt cược lúc này',
    INVALID_BET: 'Lựa chọn cược không hợp lệ',
    USER_BANNED: 'Tài khoản của bạn đã bị khóa',
    USER_NOT_FOUND: 'Không tìm thấy tài khoản',
    MATCH_NOT_FOUND: 'Không tìm thấy trận đấu',
  };
  for (const [code, vietnamese] of Object.entries(map)) {
    if (msg.includes(code)) return vietnamese;
  }
  return msg;
};

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
  const [refreshing, setRefreshing] = useState(false);

  // Betting state
  const [selectedOdd, setSelectedOdd] = useState<OddOption | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [showAllScores, setShowAllScores] = useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatch();
    setRefreshing(false);
  }, [id]);

  const confirmAndPlaceBet = () => {
    if (!selectedOdd || !betAmount || !match) return;
    const amount = parseInt(betAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Số tiền không hợp lệ');
      return;
    }
    if (amount < MIN_BET) {
      Alert.alert('Lỗi', `Tối thiểu ${new Intl.NumberFormat('vi-VN').format(MIN_BET)}đ`);
      return;
    }
    if (user && amount > user.balance) {
      Alert.alert('Lỗi', 'Số dư không đủ');
      return;
    }

    const potWin = Math.round(amount * selectedOdd.odds);
    Alert.alert(
      'Xác nhận đặt cược',
      `${selectedOdd.label}\nSố tiền: ${new Intl.NumberFormat('vi-VN').format(amount)}đ\nTỉ lệ: ${selectedOdd.odds.toFixed(2)}\nThắng dự kiến: ${new Intl.NumberFormat('vi-VN').format(potWin)}đ`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đặt cược', style: 'default', onPress: () => executePlaceBet(amount) },
      ]
    );
  };

  const executePlaceBet = async (amount: number) => {
    if (!selectedOdd || !match) return;
    // Double-tap guard via ref
    if (placingRef.current) return;
    placingRef.current = true;
    setPlacing(true);
    try {
      const { error } = await supabase.rpc('place_bet', {
        p_match_id: match.id,
        p_bet_type: selectedOdd.betType,
        p_bet_choice: selectedOdd.choice,
        p_amount: amount,
      });
      if (error) throw error;

      Alert.alert('Thành công! 🎉', `Đã đặt ${new Intl.NumberFormat('vi-VN').format(amount)}đ vào ${selectedOdd.label}`);
      setSelectedOdd(null);
      setBetAmount('');
      await Promise.all([fetchUserProfile(), fetchMatch()]);
    } catch (err: any) {
      const msg = err.message || 'Đặt cược thất bại';
      Alert.alert('Lỗi', mapErrorToVietnamese(msg));
    } finally {
      setPlacing(false);
      placingRef.current = false;
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.neonGreen} colors={[Colors.neonGreen]} />}
      >
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
              <View style={styles.scoreRow}>
                <Text style={styles.scoreDigits}>{match.home_score ?? '-'}</Text>
                <Text style={styles.scoreSeparator}>-</Text>
                <Text style={styles.scoreDigits}>{match.away_score ?? '-'}</Text>
              </View>
              {/* Half-time score */}
              {(match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED') &&
                match.half_time_home != null && match.half_time_away != null && (
                <Text style={styles.halfTimeScore}>
                  HT: {match.half_time_home} - {match.half_time_away}
                </Text>
              )}
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
                  { label: 'Thắng', choice: 'home', odds: odds.match_result.home },
                  { label: 'Hòa', choice: 'draw', odds: odds.match_result.draw },
                  { label: 'Thua', choice: 'away', odds: odds.match_result.away },
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
                    { label: 'Tài', choice: 'over', odds: odds.over_under.over },
                    { label: 'Xỉu', choice: 'under', odds: odds.over_under.under },
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
                    { label: 'Có', choice: 'yes', odds: odds.btts.yes },
                    { label: 'Không', choice: 'no', odds: odds.btts.no },
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

            {/* Half Time Result */}
            {odds.half_time && (
              <>
                <Text style={styles.oddsGroupTitle}>Kết quả Hiệp 1</Text>
                <View style={styles.oddsGrid}>
                  {[
                    { label: 'Chủ nhà', choice: 'home', odds: odds.half_time.home },
                    { label: 'Hòa', choice: 'draw', odds: odds.half_time.draw },
                    { label: 'Khách', choice: 'away', odds: odds.half_time.away },
                  ].map((item) => {
                    const isSelected = selectedOdd?.betType === 'half_time' && selectedOdd?.choice === item.choice;
                    return (
                      <TouchableOpacity
                        key={item.choice}
                        style={[styles.oddCard, isSelected && styles.oddCardSelected]}
                        onPress={() => handleSelectOdd({ betType: 'half_time', ...item })}
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

            {/* Correct Score */}
            {odds.correct_score && Object.keys(odds.correct_score).length > 0 && (
              <>
                <Text style={styles.oddsGroupTitle}>Tỉ số chính xác</Text>
                <View style={styles.correctScoreGrid}>
                  {Object.entries(odds.correct_score)
                    .slice(0, showAllScores ? undefined : DEFAULT_SCORES_COUNT)
                    .map(([score, odd]) => {
                      const isSelected = selectedOdd?.betType === 'correct_score' && selectedOdd?.choice === score;
                      return (
                        <TouchableOpacity
                          key={score}
                          style={[styles.correctScoreCard, isSelected && styles.oddCardSelected]}
                          onPress={() => handleSelectOdd({ betType: 'correct_score', label: `Tỉ số ${score}`, choice: score, odds: odd })}
                        >
                          <Text style={styles.correctScoreLabel}>{score}</Text>
                          <Text style={[styles.oddCardValue, isSelected && styles.oddCardValueSelected]}>
                            {odd.toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
                {Object.keys(odds.correct_score).length > DEFAULT_SCORES_COUNT && (
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() => setShowAllScores(!showAllScores)}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllScores ? 'Thu gọn' : `Xem thêm (${Object.keys(odds.correct_score).length - DEFAULT_SCORES_COUNT})`}
                    </Text>
                    <MaterialIcons
                      name={showAllScores ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={18}
                      color={Colors.neonGreen}
                    />
                  </TouchableOpacity>
                )}
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
              placeholder={`Tối thiểu ${new Intl.NumberFormat('vi-VN').format(MIN_BET)}đ`}
              placeholderTextColor={Colors.textMuted}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="number-pad"
            />
          </View>
          {/* Quick amount buttons */}
          <View style={styles.quickAmountRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={styles.quickAmountBtn}
                onPress={() => setBetAmount(String(amt))}
              >
                <Text style={styles.quickAmountText}>{amt / 1000}K</Text>
              </TouchableOpacity>
            ))}
            {user && (
              <TouchableOpacity
                style={[styles.quickAmountBtn, styles.quickAmountAllIn]}
                onPress={() => setBetAmount(String(user.balance))}
              >
                <Text style={[styles.quickAmountText, { color: Colors.errorRed }]}>All-in</Text>
              </TouchableOpacity>
            )}
          </View>
          {potentialWin > 0 && (
            <Text style={styles.potentialWinText}>
              Thắng dự kiến: <Text style={{ color: Colors.neonGreen, fontWeight: '700' }}>
                {new Intl.NumberFormat('vi-VN').format(potentialWin)}đ
              </Text>
            </Text>
          )}
          <TouchableOpacity
            style={[styles.placeBetButton, placing && { opacity: 0.7 }]}
            onPress={confirmAndPlaceBet}
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
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  scoreDigits: { color: Colors.white, fontSize: 40, fontWeight: '900' },
  scoreSeparator: { color: 'rgba(255,255,255,0.3)', fontSize: 28, fontWeight: '400', marginHorizontal: 10 },
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
  quickAmountRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickAmountBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.surfaceDark, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  quickAmountAllIn: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)' },
  quickAmountText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '700' },
  potentialWinText: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12 },
  placeBetButton: {
    backgroundColor: Colors.neonGreen, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', ...Shadows.neonGlow,
  },
  placeBetText: { color: Colors.black, fontSize: 15, fontWeight: '800' },
  // CTA
  betCTA: { padding: 16, paddingBottom: 32, backgroundColor: Colors.navBg, borderTopWidth: 0.5, borderTopColor: Colors.border },
  betCTAHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  // Half-time score
  halfTimeScore: { color: Colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '500' },
  // Correct Score
  correctScoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  correctScoreCard: {
    width: '30%', backgroundColor: Colors.surfaceDark,
    borderWidth: 1, borderColor: Colors.borderLight,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  correctScoreLabel: { color: Colors.white, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  // Show more
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, marginTop: 4,
  },
  showMoreText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '600' },
});

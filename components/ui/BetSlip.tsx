import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { useParlayStore } from '@/stores/parlayStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_BET = 10000;
const QUICK_AMOUNTS = [50000, 100000, 500000];

const mapErrorToVi = (msg: string): string => {
  const map: Record<string, string> = {
    INSUFFICIENT_BALANCE: 'Số dư không đủ để đặt cược',
    MATCH_NOT_OPEN: 'Trận đấu không thể đặt cược lúc này',
    INVALID_BET: 'Lựa chọn cược không hợp lệ',
    USER_NOT_FOUND: 'Không tìm thấy tài khoản',
    INVALID_SELECTION_COUNT: 'Cần chọn 2-8 kèo',
  };
  for (const [code, vi] of Object.entries(map)) {
    if (msg.includes(code)) return vi;
  }
  return msg;
};

const getBetTypeLabel = (betType: string): string => {
  switch (betType) {
    case 'match_result': return 'Kết quả trận';
    case 'correct_score': return 'Tỉ số chính xác';
    case 'over_under': return 'Tài/Xỉu 2.5';
    case 'over_under_1_5': return 'Tài/Xỉu 1.5';
    case 'over_under_3_5': return 'Tài/Xỉu 3.5';
    case 'spreads': return 'Kèo chấp';
    case 'btts': return 'Hai đội ghi bàn';
    case 'half_time': return 'Hiệp 1';
    default: return betType;
  }
};

export default function BetSlip() {
  const router = useRouter();
  const { selections, isSlipOpen, toggleSlip, closeSlip, removeSelection, clearAll, totalOdds, canPlace } = useParlayStore();
  const { user, session, fetchUserProfile } = useAuthStore();
  const [betAmount, setBetAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleToggle = () => {
    if (isSlipOpen) {
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      setTimeout(() => closeSlip(), 250);
    } else {
      toggleSlip();
      Animated.timing(slideAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    setTimeout(() => closeSlip(), 250);
  };

  if (selections.length === 0) return null;

  const computedTotalOdds = totalOdds();
  const amount = parseInt(betAmount || '0');
  const potentialWin = amount > 0 ? Math.round(amount * computedTotalOdds) : 0;

  const confirmAndPlace = () => {
    if (!session || !user) {
      Alert.alert(
        'Đăng nhập để đặt cược',
        'Bạn cần tài khoản để đặt kèo xiên',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }
    if (!canPlace()) {
      Alert.alert('Lỗi', 'Cần chọn từ 2 đến 8 kèo');
      return;
    }
    if (!amount || amount < MIN_BET) {
      Alert.alert('Lỗi', `Tối thiểu ${new Intl.NumberFormat('vi-VN').format(MIN_BET)}đ`);
      return;
    }
    if (amount > user.balance) {
      Alert.alert('Lỗi', 'Số dư không đủ');
      return;
    }

    Alert.alert(
      'Xác nhận kèo xiên',
      `${selections.length} kèo · Tổng odds: ${computedTotalOdds.toFixed(2)}\nSố tiền: ${new Intl.NumberFormat('vi-VN').format(amount)}đ\nThắng dự kiến: ${new Intl.NumberFormat('vi-VN').format(potentialWin)}đ`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đặt kèo xiên', onPress: executePlaceBet },
      ],
    );
  };

  const executePlaceBet = async () => {
    if (placingRef.current) return;
    placingRef.current = true;
    setPlacing(true);

    try {
      const p_selections = selections.map((s) => ({
        match_id: s.matchId,
        bet_type: s.betType,
        bet_choice: s.betChoice,
      }));

      const { error } = await supabase.rpc('place_parlay_bet', {
        p_selections: p_selections as any,
        p_amount: amount,
      });

      if (error) throw error;

      Alert.alert(
        'Thành công! 🎫',
        `Đã đặt kèo xiên ${selections.length} trận\nTổng odds: ${computedTotalOdds.toFixed(2)}\nThắng dự kiến: ${new Intl.NumberFormat('vi-VN').format(potentialWin)}đ`,
      );

      clearAll();
      setBetAmount('');
      await fetchUserProfile();
    } catch (err: any) {
      const msg = err.message || 'Đặt kèo xiên thất bại';
      Alert.alert('Lỗi', mapErrorToVi(msg));
    } finally {
      setPlacing(false);
      placingRef.current = false;
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  // Floating badge
  if (!isSlipOpen) {
    return (
      <TouchableOpacity style={styles.floatingBadge} onPress={handleToggle} activeOpacity={0.8}>
        <MaterialIcons name="receipt" size={22} color={Colors.black} />
        <View style={styles.badgeCount}>
          <Text style={styles.badgeCountText}>{selections.length}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Full bet slip panel
  return (
    <Animated.View style={[styles.slipContainer, { transform: [{ translateY }] }]}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />

      {/* Panel */}
      <View style={styles.slipPanel}>
        {/* Header */}
        <View style={styles.slipHeader}>
          <View style={styles.slipHeaderLeft}>
            <MaterialIcons name="receipt" size={20} color={Colors.neonGreen} />
            <Text style={styles.slipTitle}>Kèo xiên ({selections.length} kèo)</Text>
          </View>
          <View style={styles.slipHeaderRight}>
            <TouchableOpacity onPress={() => { clearAll(); handleClose(); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Xóa hết</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose}>
              <MaterialIcons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Selections list */}
        <ScrollView style={styles.selectionsScroll} showsVerticalScrollIndicator={false}>
          {selections.map((sel) => (
            <View key={sel.matchId} style={styles.selectionCard}>
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionMatch} numberOfLines={1}>{sel.matchLabel}</Text>
                <Text style={styles.selectionBet}>{getBetTypeLabel(sel.betType)}: {sel.betLabel}</Text>
              </View>
              <View style={styles.selectionRight}>
                <Text style={styles.selectionOdds}>{sel.odds.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => removeSelection(sel.matchId)} style={styles.removeBtn}>
                  <MaterialIcons name="close" size={16} color={Colors.errorRed} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Total odds */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng odds</Text>
          <Text style={styles.totalValue}>×{computedTotalOdds.toFixed(2)}</Text>
        </View>

        {/* Amount input */}
        <TextInput
          style={styles.amountInput}
          placeholder={`Tối thiểu ${new Intl.NumberFormat('vi-VN').format(MIN_BET)}đ`}
          placeholderTextColor={Colors.textMuted}
          value={betAmount}
          onChangeText={setBetAmount}
          keyboardType="number-pad"
        />

        {/* Quick amounts */}
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((amt) => (
            <TouchableOpacity key={amt} style={styles.quickBtn} onPress={() => setBetAmount(String(amt))}>
              <Text style={styles.quickBtnText}>{amt / 1000}K</Text>
            </TouchableOpacity>
          ))}
          {user && (
            <TouchableOpacity
              style={[styles.quickBtn, styles.quickAllIn]}
              onPress={() => setBetAmount(String(user.balance))}
            >
              <Text style={[styles.quickBtnText, { color: Colors.errorRed }]}>All-in</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Potential win */}
        {potentialWin > 0 && (
          <Text style={styles.potentialWin}>
            Thắng dự kiến:{' '}
            <Text style={{ color: Colors.neonGreen, fontWeight: '700' }}>
              {new Intl.NumberFormat('vi-VN').format(potentialWin)}đ
            </Text>
          </Text>
        )}

        {/* Place button */}
        <TouchableOpacity
          style={[styles.placeBtn, (!canPlace() || placing) && { opacity: 0.5 }]}
          onPress={confirmAndPlace}
          disabled={!canPlace() || placing}
        >
          {placing ? (
            <ActivityIndicator color={Colors.black} />
          ) : (
            <Text style={styles.placeBtnText}>
              Đặt kèo xiên {canPlace() ? `(×${computedTotalOdds.toFixed(2)})` : `(cần ${2 - selections.length > 0 ? 2 - selections.length : 0} kèo nữa)`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Floating badge
  floatingBadge: {
    position: 'absolute',
    bottom: 85,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    ...Shadows.neonGlow,
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.liveRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: { color: Colors.white, fontSize: 11, fontWeight: '800' },

  // Slip container (full screen overlay)
  slipContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  slipPanel: {
    backgroundColor: Colors.navBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  slipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  slipHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slipTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  slipHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  clearBtnText: { color: Colors.errorRed, fontSize: 12, fontWeight: '600' },

  // Selections
  selectionsScroll: { maxHeight: 200, marginBottom: 12 },
  selectionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(173,255,47,0.12)',
  },
  selectionInfo: { flex: 1, marginRight: 10 },
  selectionMatch: { color: Colors.white, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  selectionBet: { color: Colors.textMuted, fontSize: 11 },
  selectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionOdds: { color: Colors.neonGreen, fontSize: 15, fontWeight: '700' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(248,113,113,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    marginBottom: 10,
  },
  totalLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  totalValue: { color: Colors.neonGreen, fontSize: 20, fontWeight: '900' },

  // Amount
  amountInput: {
    backgroundColor: Colors.darkBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },

  // Quick amounts
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quickAllIn: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)' },
  quickBtnText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '700' },

  // Potential win
  potentialWin: { color: Colors.textSecondary, fontSize: 13, marginBottom: 12 },

  // Place button
  placeBtn: {
    backgroundColor: Colors.neonGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    ...Shadows.neonGlow,
  },
  placeBtnText: { color: Colors.black, fontSize: 15, fontWeight: '800' },
});

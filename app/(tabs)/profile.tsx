import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import {
  DEPOSIT_REQUEST_DEPLOY_MESSAGE,
  isDepositRequestFeatureUnavailable,
} from '@/lib/depositRequestFeature';
import { DepositRequest, UserStats } from '@/types/database';

const REQUEST_STATUS_META = {
  PENDING: {
    label: 'Dang cho',
    icon: 'schedule' as const,
    textColor: Colors.pendingYellow,
    backgroundColor: Colors.pendingYellowBg,
  },
  APPROVED: {
    label: 'Da duyet',
    icon: 'check-circle' as const,
    textColor: Colors.successGreen,
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  REJECTED: {
    label: 'Tu choi',
    icon: 'cancel' as const,
    textColor: Colors.errorRed,
    backgroundColor: Colors.errorRedBg,
  },
} as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, session, signOut, fetchUserProfile } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositFeatureUnavailable, setDepositFeatureUnavailable] = useState(false);

  const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];
  const MAX_BALANCE = 50000000; // 50 triệu
  const MIN_DEPOSIT = 10000;
  const MAX_DEPOSIT = 10000000;

  const isGuest = !session || !user;

  const fetchStats = useCallback(async () => {
    if (isGuest) return;
    try {
      const { data, error } = await supabase.rpc('get_user_stats');
      if (error) throw error;
      setStats(data as unknown as UserStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [isGuest]);

  const fetchDepositRequests = useCallback(async () => {
    if (isGuest || !user) return;

    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setDepositFeatureUnavailable(false);
      setDepositRequests((data || []) as DepositRequest[]);
    } catch (err) {
      if (isDepositRequestFeatureUnavailable(err)) {
        setDepositFeatureUnavailable(true);
        setDepositRequests([]);
        return;
      }
      console.error('Error fetching deposit requests:', err);
    }
  }, [isGuest, user]);

  useEffect(() => {
    fetchStats();
    fetchDepositRequests();
  }, [fetchStats, fetchDepositRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isGuest) {
      await Promise.all([fetchStats(), fetchUserProfile(), fetchDepositRequests()]);
    }
    setRefreshing(false);
  }, [fetchDepositRequests, fetchStats, fetchUserProfile, isGuest]);

  const handleDepositAmountChange = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/[^0-9]/g, '');
    setDepositAmount(cleaned);
  };

  const selectQuickAmount = (amount: number) => {
    setDepositAmount(String(amount));
  };

  const formatInputDisplay = (val: string) => {
    if (!val) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(val));
  };

  const handleDeposit = async () => {
    if (depositFeatureUnavailable) {
      Alert.alert('Chưa deploy backend', DEPOSIT_REQUEST_DEPLOY_MESSAGE);
      return;
    }

    const amount = parseInt(depositAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (amount < MIN_DEPOSIT) {
      Alert.alert('Lỗi', `Tối thiểu ${formatBalance(MIN_DEPOSIT)}đ`);
      return;
    }
    if (amount > MAX_DEPOSIT) {
      Alert.alert('Lỗi', `Tối đa ${formatBalance(MAX_DEPOSIT)}đ mỗi lần nạp`);
      return;
    }
    if (user && user.balance + amount > MAX_BALANCE) {
      Alert.alert('Lỗi', `Số dư tối đa ${formatBalance(MAX_BALANCE)}đ. Bạn chỉ có thể nạp thêm ${formatBalance(MAX_BALANCE - user.balance)}đ`);
      return;
    }

    // Confirmation dialog
    Alert.alert(
      'Xác nhận gửi yêu cầu',
      `Gửi yêu cầu nạp ${formatBalance(amount)}đ?\n\nAdmin sẽ duyệt trước khi cộng số dư.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gửi yêu cầu', style: 'default', onPress: () => executeDeposit(amount) },
      ]
    );
  };

  const executeDeposit = async (amount: number) => {
    setDepositing(true);
    try {
      const { error } = await supabase.rpc('create_deposit_request', { p_amount: amount });
      if (error) throw error;
      setDepositFeatureUnavailable(false);
      setDepositAmount('');
      await fetchDepositRequests();
      Alert.alert('Đã gửi yêu cầu', `Yêu cầu nạp ${formatBalance(amount)}đ đã được gửi. Số dư sẽ chỉ tăng sau khi admin duyệt.`);
    } catch (err: any) {
      if (isDepositRequestFeatureUnavailable(err)) {
        setDepositFeatureUnavailable(true);
        Alert.alert('Chưa deploy backend', DEPOSIT_REQUEST_DEPLOY_MESSAGE);
        return;
      }

      const msg = err.message || 'Nạp tiền thất bại';
      Alert.alert(
        'Lỗi',
        msg.includes('INVALID_AMOUNT')
          ? 'Số tiền không hợp lệ'
          : msg.includes('USER_BANNED')
            ? 'Tài khoản đã bị khóa'
            : 'Không thể tạo yêu cầu nạp tiền'
      );
    } finally {
      setDepositing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);
  };

  const formatBalance = (balance: number) =>
    new Intl.NumberFormat('vi-VN').format(balance);

  const formatRequestTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
      hour12: false,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // --- Guest Mode ---
  if (isGuest) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeftGroup}>
            <MaterialIcons name="account-circle" size={24} color={Colors.neonGreen} />
            <Text style={styles.headerTitle}>Tài khoản</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.guestContainer}>
          <View style={styles.guestAvatarCircle}>
            <MaterialIcons name="person-outline" size={56} color={Colors.textMuted} />
          </View>
          <Text style={styles.guestTitle}>Khách</Text>
          <Text style={styles.guestSubtitle}>Đăng nhập để đặt cược, theo dõi vé cược và xem thống kê cá nhân</Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <MaterialIcons name="login" size={20} color={Colors.black} />
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <MaterialIcons name="person-add" size={20} color={Colors.neonGreen} />
            <Text style={styles.registerButtonText}>Tạo tài khoản mới</Text>
          </TouchableOpacity>

          <View style={styles.guestFeatures}>
            <Text style={styles.guestFeaturesTitle}>Bạn có thể làm gì khi chưa đăng nhập?</Text>
            {[
              { icon: 'sports-soccer', text: 'Xem danh sách trận đấu' },
              { icon: 'visibility', text: 'Xem tỉ lệ cược' },
              { icon: 'emoji-events', text: 'Xem bảng xếp hạng' },
            ].map((item) => (
              <View key={item.text} style={styles.guestFeatureRow}>
                <MaterialIcons name={item.icon as any} size={18} color={Colors.neonGreen} />
                <Text style={styles.guestFeatureText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // --- Logged-in Mode ---
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <MaterialIcons name="account-circle" size={24} color={Colors.neonGreen} />
          <Text style={styles.headerTitle}>Tài khoản</Text>
        </View>
        <TouchableOpacity style={styles.settingsButton}
          onPress={() => Alert.alert('Tính năng đang phát triển', 'Cài đặt sẽ sớm ra mắt!')}
        >
          <MaterialIcons name="settings" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={Colors.neonGreen} colors={[Colors.neonGreen]}
          />
        }
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <MaterialIcons name="person" size={48} color={Colors.neonGreen} />
          </View>
          <Text style={styles.username}>{user?.username || 'KingBet67'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardOverlay}>
            <MaterialIcons name="account-balance-wallet" size={80} color={Colors.white}
              style={{ opacity: 0.05, position: 'absolute', top: -10, right: -10 }}
            />
          </View>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
          <Text style={styles.balanceAmount}>
            {user ? formatBalance(user.balance) : '0'}{' '}
            <Text style={styles.balanceCurrency}>đ</Text>
          </Text>

          {/* Deposit Section */}
          <View style={styles.depositSection}>
            <Text style={styles.depositSectionTitle}>Yeu cau nap diem</Text>

            {/* Quick Amount Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickAmountRow}>
              {QUICK_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.quickAmountChip,
                    depositAmount === String(amt) && styles.quickAmountChipActive,
                  ]}
                  onPress={() => selectQuickAmount(amt)}
                >
                  <Text style={[
                    styles.quickAmountText,
                    depositAmount === String(amt) && styles.quickAmountTextActive,
                  ]}>
                    {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}K`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount Input */}
            <View style={styles.depositInputRow}>
              <View style={styles.depositInputWrapper}>
                <TextInput
                  style={styles.depositInput}
                  placeholder="Nhập số tiền..."
                  placeholderTextColor={Colors.textMuted}
                  value={depositAmount}
                  onChangeText={handleDepositAmountChange}
                  keyboardType="number-pad"
                />
                {depositAmount ? (
                  <Text style={styles.depositInputFormatted}>
                    = {formatInputDisplay(depositAmount)}đ
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.depositButton,
                  depositing && { opacity: 0.6 },
                  depositFeatureUnavailable && styles.depositButtonDisabled,
                ]}
                onPress={handleDeposit}
                disabled={depositing || !depositAmount}
              >
                {depositing ? (
                  <ActivityIndicator color={Colors.black} size="small" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color={Colors.black} />
                    <Text style={styles.depositButtonText}>Gửi yêu cầu</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.depositHelperText}>
              Yêu cầu sẽ được admin duyệt trước khi cộng số dư.
            </Text>

            {depositFeatureUnavailable ? (
              <Text style={styles.depositUnavailableText}>
                Tạm thời chưa khả dụng trên server hiện tại.
              </Text>
            ) : null}

            {/* Limits Info */}
            <View style={styles.depositLimitsRow}>
              <Text style={styles.depositLimitText}>
                Min: {formatBalance(MIN_DEPOSIT)}đ
              </Text>
              <Text style={styles.depositLimitText}>
                Max: {formatBalance(MAX_DEPOSIT)}đ/lần
              </Text>
              <Text style={styles.depositLimitText}>
                Trần: {formatBalance(MAX_BALANCE)}đ
              </Text>
            </View>
          </View>
        </View>

        {!depositFeatureUnavailable ? (
          <View style={styles.requestSection}>
            <View style={styles.requestSectionHeader}>
              <Text style={styles.requestSectionTitle}>Yêu cầu gần đây</Text>
              <Text style={styles.requestSectionSubtitle}>Lịch sử yêu cầu nạp tiền của bạn</Text>
            </View>

            {depositRequests.length === 0 ? (
              <View style={styles.requestEmptyState}>
                <MaterialIcons name="receipt-long" size={22} color={Colors.textMuted} />
                <Text style={styles.requestEmptyText}>Chưa có yêu cầu nạp tiền nào</Text>
              </View>
            ) : (
              depositRequests.map((request) => {
                const statusMeta = REQUEST_STATUS_META[request.status];

                return (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestCardTop}>
                      <View>
                        <Text style={styles.requestAmount}>{formatBalance(request.amount)}đ</Text>
                        <Text style={styles.requestDate}>Tạo lúc {formatRequestTime(request.created_at)}</Text>
                      </View>
                      <View style={[styles.requestBadge, { backgroundColor: statusMeta.backgroundColor }]}>
                        <MaterialIcons name={statusMeta.icon} size={14} color={statusMeta.textColor} />
                        <Text style={[styles.requestBadgeText, { color: statusMeta.textColor }]}>
                          {statusMeta.label}
                        </Text>
                      </View>
                    </View>

                    {request.reviewed_at ? (
                      <Text style={styles.requestMeta}>
                        Xử lý lúc {formatRequestTime(request.reviewed_at)}
                      </Text>
                    ) : null}

                    {request.admin_note ? (
                      <Text style={styles.requestMeta}>
                        Ghi chú admin: {request.admin_note}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <MaterialIcons name="sports-soccer" size={22} color={Colors.neonGreen} />
            </View>
            <View>
              <Text style={styles.statLabel}>Tổng kèo</Text>
              <Text style={styles.statValue}>{stats?.total_bets ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <MaterialIcons name="trending-up" size={22} color={Colors.neonGreen} />
            </View>
            <View>
              <Text style={styles.statLabel}>Tỷ lệ thắng</Text>
              <Text style={styles.statValue}>{stats?.win_rate ? `${Math.round(stats.win_rate)}%` : '0%'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <MaterialIcons name="check-circle" size={22} color={Colors.successGreen} />
            </View>
            <View>
              <Text style={styles.statLabel}>Thắng</Text>
              <Text style={[styles.statValue, { color: Colors.successGreen }]}>{stats?.won_count ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: Colors.errorRedBg }]}>
              <MaterialIcons name="cancel" size={22} color={Colors.errorRed} />
            </View>
            <View>
              <Text style={styles.statLabel}>Thua</Text>
              <Text style={[styles.statValue, { color: Colors.errorRed }]}>{stats?.lost_count ?? 0}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: Colors.pendingYellowBg }]}>
              <MaterialIcons name="schedule" size={22} color={Colors.pendingYellow} />
            </View>
            <View>
              <Text style={styles.statLabel}>Đang chờ</Text>
              <Text style={[styles.statValue, { color: Colors.pendingYellow }]}>{stats?.pending_count ?? 0}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <MaterialIcons name="payments" size={22} color={Colors.blueAccent} />
            </View>
            <View>
              <Text style={styles.statLabel}>Tổng thắng</Text>
              <Text style={[styles.statValue, { color: Colors.blueAccent }]}>
                {stats?.total_winnings ? formatBalance(stats.total_winnings) : '0'}đ
              </Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Cài đặt tài khoản</Text>

          <TouchableOpacity style={styles.menuItem}
            onPress={() => router.push('/profile/personal-info')}
          >
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="person" size={22} color={Colors.textSecondary} />
              <Text style={styles.menuItemText}>Thông tin cá nhân</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/leaderboard')}
          >
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="leaderboard" size={22} color={Colors.textSecondary} />
              <Text style={styles.menuItemText}>Bảng xếp hạng</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}
            onPress={() => router.push('/profile/support')}
          >
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="contact-support" size={22} color={Colors.textSecondary} />
              <Text style={styles.menuItemText}>Hỗ trợ & Góp ý</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.logoutItem} onPress={handleSignOut}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="logout" size={22} color={Colors.errorRed} />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 50,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  settingsButton: { padding: 8, borderRadius: 20 },
  scrollContent: { paddingBottom: 20 },
  // Guest mode
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  guestAvatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: Colors.textMuted, borderStyle: 'dashed',
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  guestTitle: { color: Colors.white, fontSize: 24, fontWeight: '800', marginBottom: 6 },
  guestSubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  loginButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.neonGreen, paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12, marginBottom: 12, width: '100%', justifyContent: 'center',
  },
  loginButtonText: { color: Colors.black, fontSize: 15, fontWeight: '800' },
  registerButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'transparent', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.neonGreenBorder,
    width: '100%', justifyContent: 'center',
  },
  registerButtonText: { color: Colors.neonGreen, fontSize: 15, fontWeight: '700' },
  guestFeatures: { marginTop: 32, width: '100%' },
  guestFeaturesTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  guestFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  guestFeatureText: { color: Colors.textSecondary, fontSize: 14 },
  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: Colors.neonGreen,
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  username: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  email: { color: Colors.textSecondary, fontSize: 13 },
  // Balance
  balanceCard: {
    marginHorizontal: 16, borderRadius: 16, padding: 20,
    backgroundColor: Colors.surfaceDark, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  balanceCardOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 100 },
  balanceLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceAmount: { color: Colors.white, fontSize: 28, fontWeight: '900', marginTop: 4, marginBottom: 18 },
  balanceCurrency: { color: Colors.neonGreen, fontSize: 17 },
  // Deposit
  depositSection: { marginTop: 18 },
  depositSectionTitle: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  quickAmountRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickAmountChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)',
    backgroundColor: 'rgba(30,41,59,0.6)',
  },
  quickAmountChipActive: {
    backgroundColor: Colors.neonGreenBg,
    borderColor: Colors.neonGreen,
  },
  quickAmountText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  quickAmountTextActive: { color: Colors.neonGreen },
  depositInputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  depositInputWrapper: { flex: 1 },
  depositInput: {
    backgroundColor: Colors.darkBg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: Colors.white, fontSize: 16,
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)', fontWeight: '700',
  },
  depositInputFormatted: {
    color: Colors.neonGreen, fontSize: 11, marginTop: 4, marginLeft: 4,
  },
  depositButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonGreen, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
  },
  depositButtonDisabled: {
    backgroundColor: 'rgba(173, 255, 47, 0.45)',
  },
  depositButtonText: { color: Colors.black, fontSize: 14, fontWeight: '700' },
  depositLimitsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
    paddingHorizontal: 4,
  },
  depositHelperText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  depositUnavailableText: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  depositLimitText: {
    color: Colors.textMuted, fontSize: 10, fontWeight: '500',
  },
  requestSection: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: 'rgba(30,41,59,0.35)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  requestSectionHeader: { gap: 4 },
  requestSectionTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  requestSectionSubtitle: { color: Colors.textMuted, fontSize: 12 },
  requestEmptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
  },
  requestEmptyText: { color: Colors.textMuted, fontSize: 13 },
  requestCard: {
    borderRadius: 12,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 6,
  },
  requestCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestAmount: { color: Colors.white, fontSize: 17, fontWeight: '800' },
  requestDate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  requestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestBadgeText: { fontSize: 11, fontWeight: '700' },
  requestMeta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  // Stats
  statsGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 20 },
  statCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
  },
  statIconBox: { backgroundColor: Colors.neonGreenBg, padding: 8, borderRadius: 10 },
  statLabel: { color: Colors.textSecondary, fontSize: 11 },
  statValue: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  // Menu
  menuSection: { paddingHorizontal: 16, marginTop: 28 },
  menuSectionTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, backgroundColor: 'rgba(30,41,59,0.2)', borderRadius: 12,
    marginBottom: 4,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8, opacity: 0.4 },
  logoutItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
  },
  logoutText: { color: Colors.errorRed, fontSize: 14, fontWeight: '700' },
});

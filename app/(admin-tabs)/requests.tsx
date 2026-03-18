import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import {
  DEPOSIT_REQUEST_DEPLOY_MESSAGE,
  isDepositRequestFeatureUnavailable,
} from '@/lib/depositRequestFeature';
import { DepositRequestWithUser } from '@/types/database';
import AdminHeader from '@/components/admin/AdminHeader';

const STATUS_META = {
  PENDING: {
    label: 'Đang chờ',
    icon: 'schedule' as const,
    textColor: Colors.pendingYellow,
    backgroundColor: Colors.pendingYellowBg,
  },
  APPROVED: {
    label: 'Đã duyệt',
    icon: 'check-circle' as const,
    textColor: Colors.successGreen,
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  REJECTED: {
    label: 'Từ chối',
    icon: 'cancel' as const,
    textColor: Colors.errorRed,
    backgroundColor: Colors.errorRedBg,
  },
} as const;

type FilterKey = 'PENDING' | 'ALL';

export default function AdminDepositRequestsScreen() {
  const [requests, setRequests] = useState<DepositRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('PENDING');
  const [banner, setBanner] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*, user:users!deposit_requests_user_id_fkey(id, username, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(((data || []) as DepositRequestWithUser[]).sort((a, b) => {
        if (a.status === b.status) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (a.status === 'PENDING') return -1;
        if (b.status === 'PENDING') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
    } catch (err) {
      if (isDepositRequestFeatureUnavailable(err)) {
        setRequests([]);
        setBanner(DEPOSIT_REQUEST_DEPLOY_MESSAGE);
        return;
      }
      console.error('Error fetching deposit requests:', err);
      setBanner('Không thể tải danh sách yêu cầu nạp');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const visibleRequests = useMemo(() => {
    if (filter === 'ALL') return requests;
    return requests.filter((request) => request.status === 'PENDING');
  }, [filter, requests]);

  const formatMoney = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);
  const formatTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
      hour12: false,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleApprove = (request: DepositRequestWithUser) => {
    Alert.alert(
      'Duyệt yêu cầu?',
      `Cộng ${formatMoney(request.amount)}đ cho ${request.user?.username || 'user'}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt',
          onPress: async () => {
            setProcessingId(request.id);
            setBanner(null);
            try {
              const { error } = await supabase.rpc('approve_deposit_request', {
                p_request_id: request.id,
                p_admin_note: null,
              });
              if (error) throw error;
              await fetchRequests();
              setBanner(`Đã duyệt ${formatMoney(request.amount)}đ cho ${request.user?.username || 'user'}`);
            } catch (err: any) {
              if (isDepositRequestFeatureUnavailable(err)) {
                setBanner(DEPOSIT_REQUEST_DEPLOY_MESSAGE);
                return;
              }
              setBanner(err.message || 'Không thể duyệt yêu cầu');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = (request: DepositRequestWithUser) => {
    Alert.alert(
      'Từ chối yêu cầu?',
      `Từ chối yêu cầu nạp ${formatMoney(request.amount)}đ của ${request.user?.username || 'user'}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(request.id);
            setBanner(null);
            try {
              const { error } = await supabase.rpc('reject_deposit_request', {
                p_request_id: request.id,
                p_admin_note: null,
              });
              if (error) throw error;
              await fetchRequests();
              setBanner(`Đã từ chối yêu cầu của ${request.user?.username || 'user'}`);
            } catch (err: any) {
              if (isDepositRequestFeatureUnavailable(err)) {
                setBanner(DEPOSIT_REQUEST_DEPLOY_MESSAGE);
                return;
              }
              setBanner(err.message || 'Không thể từ chối yêu cầu');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const renderRequest = ({ item }: { item: DepositRequestWithUser }) => {
    const status = STATUS_META[item.status];
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardUser}>
            <Text style={styles.username}>{item.user?.username || 'Unknown user'}</Text>
            <Text style={styles.email}>{item.user?.email || 'Không có email'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <MaterialIcons name={status.icon} size={14} color={status.textColor} />
            <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.amount}>{formatMoney(item.amount)}đ</Text>
        <Text style={styles.metaText}>Tạo lúc {formatTime(item.created_at)}</Text>

        {item.reviewed_at ? (
          <Text style={styles.metaText}>Xử lý lúc {formatTime(item.reviewed_at)}</Text>
        ) : null}

        {item.admin_note ? (
          <Text style={styles.metaText}>Ghi chú: {item.admin_note}</Text>
        ) : null}

        {item.status === 'PENDING' ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton, isProcessing && styles.disabledButton]}
              onPress={() => handleReject(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <MaterialIcons name="close" size={16} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Từ chối</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton, isProcessing && styles.disabledButton]}
              onPress={() => handleApprove(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={16} color={Colors.black} />
                  <Text style={[styles.actionButtonText, { color: Colors.black }]}>Duyệt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="💳 Deposit Requests" />

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'PENDING' && styles.filterChipActive]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.filterText, filter === 'PENDING' && styles.filterTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.neonGreen} style={styles.loader} />
      ) : (
        <FlatList
          data={visibleRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory-2" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {filter === 'PENDING' ? 'Không có yêu cầu đang chờ' : 'Chưa có yêu cầu nạp tiền'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(30,41,59,0.45)',
  },
  filterChipActive: {
    backgroundColor: Colors.neonGreenBg,
    borderColor: Colors.neonGreen,
  },
  filterText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: Colors.neonGreen },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerText: { color: Colors.white, fontSize: 13, lineHeight: 18 },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardUser: { flex: 1, gap: 2 },
  username: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  email: { color: Colors.textSecondary, fontSize: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  amount: { color: Colors.neonGreen, fontSize: 22, fontWeight: '800' },
  metaText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveButton: { backgroundColor: Colors.neonGreen },
  rejectButton: { backgroundColor: 'rgba(239,68,68,0.18)' },
  actionButtonText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.7 },
  emptyState: { alignItems: 'center', marginTop: 64, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});

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
import { FeedbackWithUser } from '@/types/database';
import AdminHeader from '@/components/admin/AdminHeader';

const STATUS_META = {
  NEW: {
    label: 'Mới',
    icon: 'fiber-new' as const,
    textColor: Colors.pendingYellow,
    backgroundColor: Colors.pendingYellowBg,
  },
  READ: {
    label: 'Đã đọc',
    icon: 'visibility' as const,
    textColor: Colors.blueAccent,
    backgroundColor: 'rgba(59,130,246,0.16)',
  },
  RESOLVED: {
    label: 'Đã xử lý',
    icon: 'check-circle' as const,
    textColor: Colors.textMuted,
    backgroundColor: 'rgba(100,116,139,0.16)',
  },
} as const;

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  general: { label: 'Chung', icon: 'chat' },
  bug: { label: 'Lỗi', icon: 'bug-report' },
  feature: { label: 'Tính năng', icon: 'lightbulb' },
  other: { label: 'Khác', icon: 'more-horiz' },
};

type FilterKey = 'NEW' | 'ALL';

export default function AdminFeedbacksScreen() {
  const [feedbacks, setFeedbacks] = useState<FeedbackWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('NEW');
  const [banner, setBanner] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*, user:users!feedbacks_user_id_fkey(id, username, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbacks((data || []) as FeedbackWithUser[]);
    } catch (err: any) {
      // Table might not exist yet
      if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
        setFeedbacks([]);
        setBanner('Bảng feedbacks chưa được tạo. Hãy chạy migration SQL trước.');
        return;
      }
      console.error('Error fetching feedbacks:', err);
      setBanner('Không thể tải danh sách góp ý');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const visibleFeedbacks = useMemo(() => {
    if (filter === 'ALL') return feedbacks;
    return feedbacks.filter((f) => f.status === 'NEW');
  }, [filter, feedbacks]);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString('vi-VN', {
      hour12: false,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleMarkRead = (feedback: FeedbackWithUser) => {
    Alert.alert(
      'Đánh dấu đã đọc?',
      `Đánh dấu góp ý từ ${feedback.user?.username || 'user'} là đã đọc?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đánh dấu',
          onPress: async () => {
            setProcessingId(feedback.id);
            setBanner(null);
            try {
              const { error } = await supabase
                .from('feedbacks')
                .update({ status: 'READ' })
                .eq('id', feedback.id);

              if (error) throw error;
              await fetchFeedbacks();
              setBanner(`Đã đánh dấu đã đọc góp ý từ ${feedback.user?.username || 'user'}`);
            } catch (err: any) {
              setBanner(err.message || 'Không thể cập nhật trạng thái');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkResolved = (feedback: FeedbackWithUser) => {
    Alert.alert(
      'Đánh dấu đã xử lý?',
      `Đánh dấu góp ý từ ${feedback.user?.username || 'user'} là đã xử lý?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Hoàn thành',
          onPress: async () => {
            setProcessingId(feedback.id);
            setBanner(null);
            try {
              const { error } = await supabase
                .from('feedbacks')
                .update({ status: 'RESOLVED' })
                .eq('id', feedback.id);

              if (error) throw error;
              await fetchFeedbacks();
              setBanner(`Đã xử lý góp ý từ ${feedback.user?.username || 'user'}`);
            } catch (err: any) {
              setBanner(err.message || 'Không thể cập nhật trạng thái');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const renderFeedback = ({ item }: { item: FeedbackWithUser }) => {
    const status = STATUS_META[item.status];
    const cat = CATEGORY_META[item.category] || CATEGORY_META.other;
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardUser}>
            <Text style={styles.username}>{item.user?.username || 'Unknown user'}</Text>
            <Text style={styles.email}>{item.user?.email || ''}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.backgroundColor }]}>
            <MaterialIcons name={status.icon} size={14} color={status.textColor} />
            <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
          </View>
        </View>

        {/* Category */}
        <View style={styles.categoryBadge}>
          <MaterialIcons name={cat.icon as any} size={14} color={Colors.textSecondary} />
          <Text style={styles.categoryText}>{cat.label}</Text>
        </View>

        {/* Message */}
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.metaText}>{formatTime(item.created_at)}</Text>

        {/* Actions */}
        {item.status !== 'RESOLVED' && (
          <View style={styles.actionRow}>
            {item.status === 'NEW' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.readButton, isProcessing && styles.disabledButton]}
                onPress={() => handleMarkRead(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <MaterialIcons name="visibility" size={16} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Đã đọc</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.resolveButton, isProcessing && styles.disabledButton]}
              onPress={() => handleMarkResolved(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={16} color={Colors.black} />
                  <Text style={[styles.actionButtonText, { color: Colors.black }]}>Đã xử lý</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="💬 Góp ý từ người dùng" />

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'NEW' && styles.filterChipActive]}
          onPress={() => setFilter('NEW')}
        >
          <Text style={[styles.filterText, filter === 'NEW' && styles.filterTextActive]}>Mới</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>Tất cả</Text>
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
          data={visibleFeedbacks}
          keyExtractor={(item) => item.id}
          renderItem={renderFeedback}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {filter === 'NEW' ? 'Không có góp ý mới' : 'Chưa có góp ý nào'}
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
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  message: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
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
  readButton: { backgroundColor: 'rgba(59,130,246,0.18)' },
  resolveButton: { backgroundColor: Colors.neonGreen },
  actionButtonText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.7 },
  emptyState: { alignItems: 'center', marginTop: 64, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});

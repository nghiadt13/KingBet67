import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/database';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      let query = supabase.from('users').select('*').order('created_at', { ascending: false });
      if (search.trim()) {
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [search, fetchUsers]);

  const toggleBan = async (u: User) => {
    const action = u.is_banned ? 'Unban' : 'Ban';
    Alert.alert(`${action} "${u.username}"?`, '', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: action, style: 'destructive',
        onPress: async () => {
          await supabase.from('users').update({ is_banned: !u.is_banned }).eq('id', u.id);
          fetchUsers();
        }
      },
    ]);
  };

  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <Text style={styles.balance}>Balance: {fmt(item.balance)}đ</Text>
      </View>
      <View style={styles.userActions}>
        <View style={[styles.statusBadge, item.is_banned ? styles.bannedBadge : styles.activeBadge]}>
          <Text style={[styles.statusText, item.is_banned ? styles.bannedText : styles.activeText]}>
            {item.is_banned ? 'Banned' : 'Active'}
          </Text>
        </View>
        {item.role !== 'admin' && (
          <TouchableOpacity
            style={[styles.actionBtn, item.is_banned ? styles.unbanBtn : styles.banBtn]}
            onPress={() => toggleBan(item)}
          >
            <Text style={styles.actionBtnText}>{item.is_banned ? 'Unban' : 'Ban'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 User Management</Text>
      </View>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm user..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.neonGreen} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Không tìm thấy user</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, backgroundColor: Colors.surfaceDark,
    borderRadius: 12, paddingHorizontal: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.white, fontSize: 14, paddingVertical: 12 },
  list: { padding: 16, paddingBottom: 20 },
  userCard: {
    backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  userInfo: { flex: 1, gap: 2 },
  username: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  email: { color: Colors.textSecondary, fontSize: 12 },
  balance: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  userActions: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  activeBadge: { backgroundColor: Colors.neonGreenBg },
  bannedBadge: { backgroundColor: Colors.errorRedBg },
  statusText: { fontSize: 10, fontWeight: '700' },
  activeText: { color: Colors.neonGreen },
  bannedText: { color: Colors.errorRed },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  banBtn: { backgroundColor: 'rgba(239,68,68,0.15)' },
  unbanBtn: { backgroundColor: Colors.neonGreenBg },
  actionBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
});

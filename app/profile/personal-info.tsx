import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, session } = useAuthStore();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleChangePassword = async () => {
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }

    Alert.alert(
      'Xác nhận đổi mật khẩu',
      'Bạn chắc chắn muốn đổi mật khẩu?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đổi mật khẩu',
          style: 'default',
          onPress: async () => {
            setChangingPassword(true);
            try {
              const { error } = await supabase.auth.updateUser({
                password: newPassword,
              });
              if (error) throw error;

              setNewPassword('');
              setConfirmPassword('');
              setShowPasswordForm(false);
              Alert.alert(
                'Thành công',
                'Mật khẩu đã được thay đổi thành công.'
              );
            } catch (err: any) {
              const msg = err.message || 'Đổi mật khẩu thất bại';
              if (msg.includes('should be different')) {
                setPasswordError('Mật khẩu mới phải khác mật khẩu cũ');
              } else {
                setPasswordError(msg);
              }
            } finally {
              setChangingPassword(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <MaterialIcons name="person" size={48} color={Colors.neonGreen} />
          </View>
          <Text style={styles.username}>{user?.username || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user?.role === 'admin' ? '👑 Admin' : '👤 User'}
            </Text>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>

          {/* Email */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardLeft}>
              <View style={styles.infoIconBox}>
                <MaterialIcons name="email" size={20} color={Colors.neonGreen} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{session?.user?.email || user?.email || '—'}</Text>
              </View>
            </View>
            <View style={styles.readOnlyBadge}>
              <MaterialIcons name="lock" size={12} color={Colors.textMuted} />
            </View>
          </View>

          {/* Password */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardLeft}>
              <View style={styles.infoIconBox}>
                <MaterialIcons name="vpn-key" size={20} color={Colors.neonGreen} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Mật khẩu</Text>
                <Text style={styles.infoValue}>••••••••</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => {
                setShowPasswordForm(!showPasswordForm);
                setPasswordError('');
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              <MaterialIcons
                name={showPasswordForm ? 'close' : 'edit'}
                size={16}
                color={Colors.neonGreen}
              />
              <Text style={styles.changeButtonText}>
                {showPasswordForm ? 'Hủy' : 'Đổi'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Join Date */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                <MaterialIcons name="calendar-today" size={20} color={Colors.blueAccent} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Ngày tham gia</Text>
                <Text style={styles.infoValue}>
                  {user?.created_at ? formatDate(user.created_at) : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Password Change Form */}
        {showPasswordForm && (
          <View style={styles.passwordSection}>
            <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu mới</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setPasswordError('');
                  }}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setPasswordError('');
                  }}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Validation hints */}
            <View style={styles.hintsRow}>
              <View style={styles.hintItem}>
                <MaterialIcons
                  name={newPassword.length >= 6 ? 'check-circle' : 'radio-button-unchecked'}
                  size={14}
                  color={newPassword.length >= 6 ? Colors.successGreen : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.hintText,
                    newPassword.length >= 6 && { color: Colors.successGreen },
                  ]}
                >
                  Tối thiểu 6 ký tự
                </Text>
              </View>
              <View style={styles.hintItem}>
                <MaterialIcons
                  name={
                    confirmPassword.length > 0 && newPassword === confirmPassword
                      ? 'check-circle'
                      : 'radio-button-unchecked'
                  }
                  size={14}
                  color={
                    confirmPassword.length > 0 && newPassword === confirmPassword
                      ? Colors.successGreen
                      : Colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.hintText,
                    confirmPassword.length > 0 &&
                      newPassword === confirmPassword && { color: Colors.successGreen },
                  ]}
                >
                  Mật khẩu khớp
                </Text>
              </View>
            </View>

            {passwordError ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={16} color={Colors.errorRed} />
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (changingPassword || !newPassword || !confirmPassword) && { opacity: 0.5 },
              ]}
              onPress={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <>
                  <MaterialIcons name="lock-reset" size={18} color={Colors.black} />
                  <Text style={styles.submitButtonText}>Đổi mật khẩu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 8, borderRadius: 20 },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: Colors.neonGreen,
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  roleBadge: {
    backgroundColor: Colors.neonGreenBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.neonGreenBorder,
  },
  roleBadgeText: { color: Colors.neonGreen, fontSize: 12, fontWeight: '600' },
  // Info section
  infoSection: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  infoCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  infoIconBox: {
    backgroundColor: Colors.neonGreenBg,
    padding: 8,
    borderRadius: 10,
  },
  infoLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  infoValue: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  readOnlyBadge: {
    backgroundColor: 'rgba(100,116,139,0.15)',
    borderRadius: 8,
    padding: 6,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neonGreenBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.neonGreenBorder,
  },
  changeButtonText: { color: Colors.neonGreen, fontSize: 12, fontWeight: '700' },
  // Password section
  passwordSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    backgroundColor: 'rgba(30,41,59,0.35)',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.darkBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  textInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  hintsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { color: Colors.textMuted, fontSize: 12 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorRedBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: Colors.errorRed, fontSize: 13, flex: 1 },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonGreen,
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitButtonText: { color: Colors.black, fontSize: 15, fontWeight: '700' },
});

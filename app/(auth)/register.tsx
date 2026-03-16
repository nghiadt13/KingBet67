import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleRegister = async () => {
    setLocalError('');
    clearError();

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setLocalError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setLocalError('Tên đăng nhập: 3-20 ký tự, chỉ chữ cái, số và _');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError('Email không hợp lệ');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (password.length < 6) {
      setLocalError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (!agreeTerms) {
      setLocalError('Bạn cần đồng ý với điều khoản sử dụng');
      return;
    }

    await signUp(email.trim(), password, username.trim());
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký tài khoản</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>Trải nghiệm đỉnh cao</Text>
            </View>
            <Text style={styles.heroTitle}>
              Gia nhập <Text style={styles.heroTitleAccent}>KingBet67</Text>
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {displayError ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={Colors.errorRed} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {/* Username */}
          <Text style={styles.label}>Tên người dùng</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nhập tên đăng nhập của bạn"
              placeholderTextColor={Colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="mail" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Nhập lại mật khẩu</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock-reset" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          {/* Terms */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreeTerms(!agreeTerms)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={agreeTerms ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={agreeTerms ? Colors.neonGreen : Colors.textMuted}
            />
            <Text style={styles.termsText}>
              Tôi đồng ý với các Điều khoản dịch vụ và Chính sách bảo mật của KingBet67.
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.submitButtonText}>ĐĂNG KÝ NGAY</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(11,17,32,0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  // Hero
  heroBanner: {
    height: 160,
    backgroundColor: Colors.navBg,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.neonGreenBg,
  },
  heroContent: {
    padding: 16,
  },
  heroTag: {
    backgroundColor: Colors.neonGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  heroTagText: {
    color: Colors.black,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  heroTitleAccent: {
    color: Colors.neonGreen,
  },
  // Form
  formSection: {
    paddingHorizontal: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorRedBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: Colors.errorRed,
    fontSize: 13,
    flex: 1,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.15)',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    paddingVertical: 13,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 18,
  },
  termsText: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  submitButton: {
    backgroundColor: Colors.neonGreen,
    paddingVertical: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.neonGlow,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.black,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: Colors.neonGreen,
    fontSize: 14,
    fontWeight: '700',
  },
});

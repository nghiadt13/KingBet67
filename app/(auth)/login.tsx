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
import { Colors } from '@/constants/colors';
import { Shadows } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    await signIn(email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient} />
          <View style={styles.logoContainer}>
            <View style={styles.logoBall}>
              <MaterialIcons name="sports-soccer" size={36} color={Colors.black} />
            </View>
            <Text style={styles.logoText}>
              KINGBET<Text style={styles.logoAccent}>67</Text>
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Chào mừng trở lại</Text>
            <Text style={styles.subtitle}>Đăng nhập để tham gia kèo tối nay</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={Colors.errorRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <MaterialIcons name="mail" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email hoặc Số điện thoại"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mật khẩu"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotLink}>
            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <>
                <Text style={styles.loginButtonText}>ĐĂNG NHẬP</Text>
                <MaterialIcons name="arrow-forward" size={20} color={Colors.black} />
              </>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <MaterialIcons name="verified-user" size={18} color={Colors.textSecondary} />
            <Text style={styles.badgeText}>Bảo mật</Text>
          </View>
          <View style={styles.badge}>
            <MaterialIcons name="support-agent" size={18} color={Colors.textSecondary} />
            <Text style={styles.badgeText}>Hỗ trợ 24/7</Text>
          </View>
          <View style={styles.badge}>
            <MaterialIcons name="payments" size={18} color={Colors.textSecondary} />
            <Text style={styles.badgeText}>Rút nhanh</Text>
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
  },
  // Hero
  heroSection: {
    height: 180,
    backgroundColor: Colors.navBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.neonGreenBg,
    opacity: 0.5,
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoBall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.neonGlow,
    borderWidth: 4,
    borderColor: Colors.darkBg,
  },
  logoText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 12,
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: Colors.neonGreen,
  },
  // Form
  formSection: {
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 6,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.darkBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.3)',
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: Colors.neonGreen,
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.neonGreen,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...Shadows.neonGlow,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.black,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  registerText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  registerLink: {
    color: Colors.neonGreen,
    fontSize: 14,
    fontWeight: '700',
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 28,
    paddingHorizontal: 20,
    opacity: 0.4,
  },
  badge: {
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

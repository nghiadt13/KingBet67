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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_ITEMS = [
  {
    question: 'Nạp điểm hoạt động thế nào?',
    answer:
      'Bạn vào phần Tài khoản, nhập số tiền muốn nạp và gửi yêu cầu. Admin sẽ duyệt yêu cầu và số dư sẽ được cộng sau khi được duyệt.',
  },
  {
    question: 'Yêu cầu nạp mất bao lâu để được duyệt?',
    answer:
      'Thông thường yêu cầu sẽ được duyệt trong vòng vài phút đến vài giờ, tùy vào thời gian admin trực.',
  },
  {
    question: 'Khi nào vé cược được thanh toán?',
    answer:
      'Vé cược sẽ tự động được thanh toán sau khi trận đấu kết thúc và hệ thống cập nhật kết quả. Tiền thắng sẽ được cộng trực tiếp vào số dư.',
  },
  {
    question: 'Tôi có thể đặt cược bao nhiêu trận cùng lúc?',
    answer:
      'Bạn có thể đặt cược không giới hạn số trận, miễn là số dư đủ cho mỗi lần đặt. Ngoài ra bạn có thể sử dụng tính năng Kèo xiên (Parlay) để gộp nhiều kèo vào một vé.',
  },
];

const CATEGORIES = [
  { value: 'general', label: 'Chung', icon: 'chat' as const },
  { value: 'bug', label: 'Lỗi', icon: 'bug-report' as const },
  { value: 'feature', label: 'Tính năng', icon: 'lightbulb' as const },
  { value: 'other', label: 'Khác', icon: 'more-horiz' as const },
];

export default function SupportScreen() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSubmitFeedback = async () => {
    if (message.trim().length < 10) {
      Alert.alert('Lỗi', 'Nội dung góp ý phải có ít nhất 10 ký tự');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_feedback', {
        p_category: category,
        p_message: message.trim(),
      });

      if (error) {
        if (error.message?.includes('MESSAGE_TOO_SHORT')) {
          Alert.alert('Lỗi', 'Nội dung góp ý quá ngắn (tối thiểu 10 ký tự)');
        } else {
          throw error;
        }
        return;
      }

      setSubmitted(true);
      setMessage('');
      setCategory('general');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi góp ý. Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hỗ trợ & Góp ý</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="help-outline" size={20} color={Colors.neonGreen} />
            <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
          </View>

          {FAQ_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqCard}
              onPress={() => toggleFaq(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <MaterialIcons
                  name={expandedFaq === index ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={Colors.textMuted}
                />
              </View>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback Form */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="rate-review" size={20} color={Colors.neonGreen} />
            <Text style={styles.sectionTitle}>Gửi góp ý</Text>
          </View>

          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIconCircle}>
                <MaterialIcons name="check" size={32} color={Colors.black} />
              </View>
              <Text style={styles.successTitle}>Đã gửi thành công!</Text>
              <Text style={styles.successSubtitle}>
                Cảm ơn bạn đã góp ý. Admin sẽ xem xét ý kiến của bạn.
              </Text>
              <TouchableOpacity
                style={styles.sendAnotherButton}
                onPress={() => setSubmitted(false)}
              >
                <MaterialIcons name="edit" size={16} color={Colors.neonGreen} />
                <Text style={styles.sendAnotherText}>Gửi góp ý khác</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formCard}>
              {/* Category Selection */}
              <Text style={styles.inputLabel}>Loại góp ý</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      category === cat.value && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <MaterialIcons
                      name={cat.icon}
                      size={16}
                      color={
                        category === cat.value ? Colors.neonGreen : Colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        category === cat.value && styles.categoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Message Input */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Nội dung</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Mô tả chi tiết ý kiến, góp ý hoặc lỗi bạn gặp phải... (tối thiểu 10 ký tự)"
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.charCount}>
                {message.length}/1000
              </Text>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (submitting || message.trim().length < 10) && { opacity: 0.5 },
                ]}
                onPress={handleSubmitFeedback}
                disabled={submitting || message.trim().length < 10}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.black} size="small" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color={Colors.black} />
                    <Text style={styles.submitButtonText}>Gửi góp ý</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // FAQ
  faqCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  faqQuestion: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // Form
  formCard: {
    backgroundColor: 'rgba(30,41,59,0.35)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.3)',
    backgroundColor: 'rgba(30,41,59,0.6)',
  },
  categoryChipActive: {
    backgroundColor: Colors.neonGreenBg,
    borderColor: Colors.neonGreen,
  },
  categoryText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: Colors.neonGreen },
  messageInput: {
    backgroundColor: Colors.darkBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonGreen,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  submitButtonText: { color: Colors.black, fontSize: 15, fontWeight: '700' },
  // Success
  successCard: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  successTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  successSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sendAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.neonGreenBorder,
  },
  sendAnotherText: { color: Colors.neonGreen, fontSize: 13, fontWeight: '600' },
});

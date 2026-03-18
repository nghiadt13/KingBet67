export function isDepositRequestFeatureUnavailable(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : '';

  return (
    (code === 'PGRST205' && message.includes('deposit_requests')) ||
    (code === 'PGRST202' && (
      message.includes('create_deposit_request') ||
      message.includes('approve_deposit_request') ||
      message.includes('reject_deposit_request')
    )) ||
    message.includes('deposit_requests') ||
    message.includes('create_deposit_request') ||
    message.includes('approve_deposit_request') ||
    message.includes('reject_deposit_request')
  );
}

export const DEPOSIT_REQUEST_DEPLOY_MESSAGE =
  'Tính năng yêu cầu nạp tiền chưa được deploy trên Supabase. Hãy chạy schema mới trong supabase/schema.sql.';

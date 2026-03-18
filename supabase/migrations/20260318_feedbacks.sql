-- ============================================
-- Feedbacks table — User support & feedback
-- ============================================

-- feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category    VARCHAR(30) NOT NULL DEFAULT 'general'
              CHECK (category IN ('general', 'bug', 'feature', 'other')),
  message     TEXT NOT NULL CHECK (length(message) >= 10),
  status      VARCHAR(15) NOT NULL DEFAULT 'NEW'
              CHECK (status IN ('NEW', 'READ', 'RESOLVED')),
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON feedbacks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status, created_at DESC);

-- RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can read own feedbacks" ON public.feedbacks
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can insert own feedbacks" ON public.feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update feedbacks" ON public.feedbacks;
CREATE POLICY "Admin can update feedbacks" ON public.feedbacks
  FOR UPDATE USING (is_admin());

-- submit_feedback RPC
CREATE OR REPLACE FUNCTION submit_feedback(
  p_category VARCHAR DEFAULT 'general',
  p_message TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_feedback public.feedbacks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF length(trim(p_message)) < 10 THEN RAISE EXCEPTION 'MESSAGE_TOO_SHORT'; END IF;

  INSERT INTO public.feedbacks (user_id, category, message)
  VALUES (v_user_id, p_category, trim(p_message))
  RETURNING * INTO v_feedback;

  RETURN to_jsonb(v_feedback);
END;
$$;

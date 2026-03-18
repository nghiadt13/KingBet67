-- KingBet67 deposit-request patch
-- Run this in Supabase SQL Editor for the new profile/admin deposit flow.

CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  status       VARCHAR(10) NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by  UUID REFERENCES public.users(id),
  reviewed_at  TIMESTAMPTZ,
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_created
  ON public.deposit_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_status_created
  ON public.deposit_requests(status, created_at DESC);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deposit requests" ON public.deposit_requests;
CREATE POLICY "Users can read own deposit requests"
  ON public.deposit_requests
  FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE OR REPLACE FUNCTION deposit(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'DEPOSIT_DISABLED_USE_REQUEST';
END;
$$;

CREATE OR REPLACE FUNCTION create_deposit_request(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.deposit_requests%ROWTYPE;
  v_banned BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT is_banned INTO v_banned
  FROM public.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_banned THEN RAISE EXCEPTION 'USER_BANNED'; END IF;

  INSERT INTO public.deposit_requests (user_id, amount)
  VALUES (v_user_id, p_amount)
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION approve_deposit_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_request public.deposit_requests%ROWTYPE;
  v_new_balance BIGINT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT *
  INTO v_request
  FROM public.deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_request.status <> 'PENDING' THEN RAISE EXCEPTION 'REQUEST_ALREADY_REVIEWED'; END IF;

  UPDATE public.users
  SET balance = balance + v_request.amount
  WHERE id = v_request.user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.deposit_requests
  SET
    status = 'APPROVED',
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), '')
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'request', to_jsonb(v_request),
    'new_balance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_deposit_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request public.deposit_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT *
  INTO v_request
  FROM public.deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_request.status <> 'PENDING' THEN RAISE EXCEPTION 'REQUEST_ALREADY_REVIEWED'; END IF;

  UPDATE public.deposit_requests
  SET
    status = 'REJECTED',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    admin_note = NULLIF(TRIM(COALESCE(p_admin_note, '')), '')
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

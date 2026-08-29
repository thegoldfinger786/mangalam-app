-- Security remediation 2026-08-23: findings #37 and #4.
-- See docs/SECURITY_REMEDIATION.md for the full evidence trail.
--
-- Scope is deliberately limited to these two fixes. It does NOT touch the TTS
-- RPCs (#23 — pending the #41 architecture decision), content_master,
-- audio_segments, the MEDIA_AUDIT tables, or any other policy.

-- ─────────────────────────────────────────────────────────────────────────────
-- #37 — activity_log was readable across users
--
-- The SELECT policy was `USING (true)` scoped to the `authenticated` role, so
-- any signed-in user could read every row of activity_log: every other user's
-- listening, bookmarking and sharing history (user_id, content_id,
-- content_type, action_type, created_at).
--
-- The INSERT policy was already correct (`user_id = auth.uid()`) and is left
-- untouched. The policy name is preserved to match existing conventions.
--
-- auth.uid() is wrapped in a scalar subquery so it is evaluated once per query
-- rather than per row, matching the pattern established by
-- 20260305_security_performance_hardening.sql.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view activities" ON public.activity_log;

CREATE POLICY "Users can view activities" ON public.activity_log
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- #4 — increment_daily_usage trusted a caller-supplied p_user_id
--
-- The function is SECURITY DEFINER, so it bypasses the (correct) RLS policies
-- on user_daily_usage. It accepted p_user_id from the caller and never compared
-- it to auth.uid(), so any caller could increment any user's counter for any
-- date — corrupting the usage/streak data.
--
-- The signature is preserved so the existing call site (src/lib/queries.ts)
-- keeps working unchanged: the app already passes session.user.id, which equals
-- auth.uid(). SECURITY DEFINER and the pinned search_path are both retained.
--
-- Fails closed on both unauthenticated callers and mismatched user ids.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'increment_daily_usage: authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM v_caller THEN
        RAISE EXCEPTION 'increment_daily_usage: cannot modify usage for another user'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.user_daily_usage (user_id, usage_date, sessions_used)
    VALUES (v_caller, p_date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET sessions_used = public.user_daily_usage.sessions_used + 1,
                  updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-assert the pinned search_path explicitly in the same migration that
-- redefines the body (CREATE OR REPLACE preserves it, but this keeps the
-- guarantee visible rather than implied).
ALTER FUNCTION public.increment_daily_usage(UUID, DATE) SET search_path = public;

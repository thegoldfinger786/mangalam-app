-- Harden increment_daily_usage against cross-user writes.
--
-- The function is SECURITY DEFINER, so it bypasses the (correct) RLS policies on
-- user_daily_usage installed by 20260305_security_performance_hardening.sql.
-- It previously accepted p_user_id from the caller without checking it against
-- auth.uid(), so the identity it wrote was caller-supplied rather than proven.
-- Usage rows feed the streak data the daily-habit loop depends on, so the
-- identity must be authoritative.
--
-- The signature is preserved so the existing call site keeps working, but the
-- supplied id is now validated rather than trusted. search_path stays pinned as
-- set by 20260305_security_performance_hardening.sql.

CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_caller UUID := auth.uid();
BEGIN
    -- Reject unauthenticated callers outright.
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'increment_daily_usage: authentication required'
            USING ERRCODE = '42501';
    END IF;

    -- The caller may only ever increment their own usage.
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

-- Re-assert the pinned search_path (CREATE OR REPLACE preserves it, but this
-- keeps the guarantee explicit in the same migration that redefines the body).
ALTER FUNCTION public.increment_daily_usage(UUID, DATE) SET search_path = public;

-- Atomic increment for user daily usage
CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_daily_usage (user_id, usage_date, sessions_used)
    VALUES (p_user_id, p_date, 1)
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET sessions_used = public.user_daily_usage.sessions_used + 1,
                  updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

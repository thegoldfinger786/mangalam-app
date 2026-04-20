CREATE OR REPLACE FUNCTION public.upsert_user_progress_resume(
    p_user_id uuid,
    p_book_id uuid,
    p_last_content_id uuid,
    p_content_type text,
    p_last_position_seconds double precision,
    p_playback_speed double precision,
    p_updated_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    INSERT INTO public.user_progress (
        user_id,
        book_id,
        last_content_id,
        content_type,
        last_position_seconds,
        playback_speed,
        updated_at
    )
    VALUES (
        p_user_id,
        p_book_id,
        p_last_content_id,
        p_content_type,
        p_last_position_seconds,
        p_playback_speed,
        p_updated_at
    )
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
        last_content_id = EXCLUDED.last_content_id,
        content_type = EXCLUDED.content_type,
        last_position_seconds = EXCLUDED.last_position_seconds,
        playback_speed = EXCLUDED.playback_speed,
        updated_at = EXCLUDED.updated_at
    WHERE public.user_progress.updated_at IS NULL
        OR EXCLUDED.updated_at >= public.user_progress.updated_at;
END;
$$;

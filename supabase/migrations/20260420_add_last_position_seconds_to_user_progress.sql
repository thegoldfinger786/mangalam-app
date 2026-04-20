ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS last_position_seconds double precision NOT NULL DEFAULT 0;

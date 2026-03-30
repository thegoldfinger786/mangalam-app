-- Create audio_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audio_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL, -- 'verse', 'narrative'
    content_id TEXT NOT NULL,   -- e.g., '1:1', '2:47'
    section TEXT NOT NULL,      -- 'full_narrative', 'commentary'
    language TEXT NOT NULL,     -- 'en', 'hi'
    voice_id TEXT NOT NULL,     -- 'en-US-Neural2-D', etc.
    engine TEXT NOT NULL,       -- 'google-tts'
    storage_path TEXT NOT NULL, -- bucket path
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In a production environment, you might want a composite unique constraint:
-- ALTER TABLE public.audio_cache ADD CONSTRAINT unique_audio_cache UNIQUE (content_type, content_id, section, language, voice_id, engine);

-- Ensure the bucket exists (this part usually requires administrative DB permissions or manual setup via dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio-content', 'audio-content', true) ON CONFLICT (id) DO NOTHING;

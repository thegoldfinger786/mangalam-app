-- Enable RLS on tables
ALTER TABLE public.audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verse_content ENABLE ROW LEVEL SECURITY;

-- Drop insecure "allow-all" policies if they exist
DROP POLICY IF EXISTS audio_cache_all_public ON public.audio_cache;
DROP POLICY IF EXISTS verse_content_all_public ON public.verse_content;

-- Create secure read-only policies for public access
CREATE POLICY audio_cache_read_public ON public.audio_cache
    FOR SELECT
    USING (true);

CREATE POLICY verse_content_read_public ON public.verse_content
    FOR SELECT
    USING (true);

-- Ensure authenticated users can still do everything on their own data or the cache if needed
-- (Though the app currently only reads via public anon key for these specific tables)

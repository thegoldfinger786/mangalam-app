-- Security remediation 2026-08-23: finding #42.
-- Remove anonymous write access to the audio-content storage bucket.
-- See docs/SECURITY_REMEDIATION.md for the full evidence trail.
--
-- storage.objects carried three policies, all granted to PUBLIC (which includes
-- the `anon` role, whose key is published in the mobile bundle and this
-- repository):
--
--   Public Read Access    SELECT  USING      (bucket_id = 'audio-content')
--   Public Write Access   INSERT  WITH CHECK (bucket_id = 'audio-content')
--   Public Update Access  UPDATE  USING      (bucket_id = 'audio-content')
--
-- The read policy is intentional: the app streams public audio URLs.
-- The write and update policies allow anyone holding the anon key to upload new
-- objects into audio-content and to modify all 3,544 existing objects — i.e.
-- overwrite the entire app narration catalogue. Both were verified exploitable
-- against production inside rolled-back transactions.
--
-- Nothing legitimate depends on them:
--   * the mobile app only reads storage (getPublicUrl); it never uploads
--   * every Edge Function that uploads uses SUPABASE_SERVICE_ROLE_KEY, which
--     bypasses RLS entirely and is unaffected by these policies
--
-- Only the audio-content bucket was ever exposed. The CONTENT_PRODUCTION and
-- MEDIA_AUDIT buckets (YTInstaContent, spotify-uploads, ArtWorks, Intro Static,
-- Spotify Podcast, background-audio) have no PUBLIC policy and already deny
-- anonymous writes — verified.
--
-- DELETE was already denied (no policy) and is left unchanged.
-- Public Read Access is deliberately retained so app playback is unaffected.

DROP POLICY IF EXISTS "Public Write Access" ON storage.objects;

DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;

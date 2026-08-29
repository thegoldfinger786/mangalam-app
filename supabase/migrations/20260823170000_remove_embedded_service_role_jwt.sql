-- Security remediation 2026-08-23: finding #38.
-- Remove the plaintext service_role JWT embedded in three retained TTS RPCs.
-- See docs/SECURITY_REMEDIATION.md for the full evidence trail.
--
-- generate_tts_filtered and both generate_tts_range overloads carried a literal
-- `Bearer eyJ...` in their bodies whose decoded claim is role=service_role,
-- valid to 2036. Any role able to read pg_proc could recover a full
-- service-role credential, and its presence blocks service-role key rotation:
-- rotating would silently break these functions.
--
-- The credential is already non-functional for its original purpose: it calls
-- /functions/v1/generate-tts-new, which since 2026-08-23 requires an
-- x-admin-secret header these functions do not send, so the request is refused
-- at the gateway regardless of the bearer token. Removing the literal therefore
-- costs no working capability.
--
-- The token is replaced with the placeholder `YOUR_SERVICE_ROLE_KEY`, matching
-- what generate_all_tts already contained — so all four functions now share one
-- consistent, credential-free shape as retained historical code.
--
-- Implementation note: rather than re-typing three function bodies (and risking
-- a transcription error in code that is deliberately being preserved), this
-- regenerates each definition from pg_get_functiondef and substitutes only the
-- bearer token. Nothing else in the bodies can change. The statement is
-- idempotent: it selects only functions that still contain a real JWT, so
-- re-running it is a no-op.
--
-- This does NOT rotate the service-role key. The leaked value remains valid
-- until rotated in the Supabase dashboard — tracked separately.

DO $do$
DECLARE
    r       record;
    newdef  text;
    n       integer := 0;
BEGIN
    FOR r IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
        WHERE nsp.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proname LIKE 'generate\_%tts%'
          AND pg_get_functiondef(p.oid) LIKE '%Bearer eyJ%'
    LOOP
        newdef := regexp_replace(
            pg_get_functiondef(r.oid),
            'Bearer eyJ[A-Za-z0-9_.-]+',
            'Bearer YOUR_SERVICE_ROLE_KEY',
            'g'
        );
        EXECUTE newdef;
        n := n + 1;
    END LOOP;

    RAISE NOTICE 'Removed embedded service_role JWT from % function(s).', n;
END
$do$;

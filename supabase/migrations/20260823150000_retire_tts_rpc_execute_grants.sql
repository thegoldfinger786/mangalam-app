-- Security remediation 2026-08-23: finding #23 / #41.
-- Retire the SQL-driven TTS RPC pipeline by removing its public execution
-- capability. See docs/SECURITY_REMEDIATION.md for the full evidence trail.
--
-- Decision: RETIRE, not repair. The pipeline shows no evidence of active use
-- (no repository callers, no triggers, no pg_cron, empty pg_net queue,
-- verse_audio unchanged since 2026-04-09 with 3,544 ready / 0 failed /
-- 0 processing). Repairing it would mean introducing a new secret-management
-- path into database code to keep a dormant pipeline alive.
--
-- The functions are deliberately NOT dropped. They are retained as historical
-- code that may be useful when the APP audio-generation architecture is
-- formally consolidated. Their bodies are NOT modified here — the hardcoded
-- service-role JWT they contain remains finding #38, tracked separately.
--
-- Observed ACL before this migration, identical on all four signatures:
--   =X/postgres , postgres=X/postgres , anon=X/postgres ,
--   authenticated=X/postgres , service_role=X/postgres
--
-- `=X/postgres` is the PostgreSQL default grant to PUBLIC. Revoking only anon
-- and authenticated would change nothing, because both inherit PUBLIC — so
-- PUBLIC must be revoked explicitly.
--
-- service_role holds its own explicit grant and is intentionally left in place,
-- so operator/service tooling can still invoke these functions if ever needed.

-- ─── generate_all_tts ────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.generate_all_tts(uuid)
    FROM PUBLIC, anon, authenticated;

-- ─── generate_tts_filtered ───────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.generate_tts_filtered(uuid, integer, integer)
    FROM PUBLIC, anon, authenticated;

-- ─── generate_tts_range — both overloads ─────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer)
    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer, integer)
    FROM PUBLIC, anon, authenticated;

-- Re-assert service_role explicitly. This is a no-op against the observed state
-- (service_role already holds a direct grant) and exists so the intended
-- end state is unambiguous and the migration is idempotent.
GRANT EXECUTE ON FUNCTION public.generate_all_tts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_filtered(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer, integer) TO service_role;

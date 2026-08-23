-- Restrict the TTS generation RPCs to service_role.
--
-- These functions trigger paid Google Cloud TTS work and are operator tooling,
-- not application surface. PostgreSQL grants EXECUTE to PUBLIC by default for
-- every new function, so client-facing roles inherit access unless it is
-- explicitly removed. This migration makes the intended audience explicit.
--
-- Signatures verified against production 2026-08-23: `book` is uuid, which
-- corrects database.types.ts (it renders the argument as `string`).
--
-- Nothing in src/ calls these functions, so this has no effect on the mobile
-- app. Function behaviour is deliberately unchanged and they are not dropped.

REVOKE EXECUTE ON FUNCTION public.generate_all_tts(uuid) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.generate_tts_filtered(uuid, integer, integer) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer) FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer, integer) FROM anon, authenticated, PUBLIC;

-- service_role retains EXECUTE: it is not a member of PUBLIC by way of these
-- grants being removed, and operator tooling continues to work.
GRANT EXECUTE ON FUNCTION public.generate_all_tts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_filtered(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_tts_range(uuid, integer, integer, integer) TO service_role;

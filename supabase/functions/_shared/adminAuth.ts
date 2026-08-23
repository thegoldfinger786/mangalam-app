// ─── Admin authorization for operator-only Edge Functions ──────────────────
// These functions spend money (Gemini / Google TTS) and write to the published
// catalogue with the service-role key. They are NOT user-facing: nothing in
// src/ invokes them.
//
// Supabase's `verify_jwt` gateway only proves that a caller holds *some* token
// signed by this project — and the anon key is exactly such a token, published
// in the mobile bundle. It is therefore authentication, not authorization, and
// must never be the only gate in front of paid or destructive work.
//
// This module is the single authorization mechanism for those functions.
// Import it rather than re-implementing the check per function.
// ───────────────────────────────────────────────────────────────────────────

const ADMIN_SECRET = Deno.env.get("ADMIN_API_SECRET") || "";

/** Header operators send. Deliberately not `Authorization`, which the gateway consumes. */
export const ADMIN_HEADER = "x-admin-secret";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * Constant-time string comparison.
 * Avoids leaking the secret's contents through response-time differences.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

/**
 * Returns a Response to send back when the caller is NOT authorized,
 * or null when the caller is a verified operator and the handler may proceed.
 *
 * Fails closed: if ADMIN_API_SECRET is unset in the function environment the
 * request is refused, so a missing secret can never silently reopen access.
 *
 * Call this as the first statement in the handler — before reading the body,
 * before any vendor API call, service-role write, or storage write.
 */
export function requireAdmin(req: Request): Response | null {
    if (!ADMIN_SECRET) {
        console.error("ADMIN_API_SECRET is not configured; refusing request.");
        return new Response(
            JSON.stringify({ error: "Server misconfigured" }),
            { status: 500, headers: jsonHeaders },
        );
    }

    const provided = req.headers.get(ADMIN_HEADER) || "";

    if (!timingSafeEqual(provided, ADMIN_SECRET)) {
        return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: jsonHeaders },
        );
    }

    return null;
}

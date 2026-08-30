import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── delete-account ──────────────────────────────────────────────────────────
// User-facing, self-service account deletion (tracker SET-06, App Store req.).
//
// This is NOT an operator function — there is no x-admin-secret. The only thing
// it trusts is the caller's own Supabase session JWT (the gateway enforces
// verify_jwt = true). The user id to delete is taken from that verified token
// and nowhere else, so a caller can only ever delete themselves — there is no
// request parameter that could name another user.
//
// What gets removed, verified against production 2026-08-30:
//   • auth.users row (this call) — signs every session out.
//   • profiles, user_progress, user_bookmarks, user_daily_usage — ON DELETE
//     CASCADE from auth.users, so they go automatically.
//   • activity_log — FK is ON DELETE SET NULL by design: the rows stay but are
//     de-linked from any user, so the Community aggregates remain correct while
//     no longer being personal data.
// No manual per-table deletes are needed; the schema already expresses the intent.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing bearer token" }, 401);
  }

  // Resolve the caller from THEIR token — this is the only identity we act on.
  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const userId = userData.user.id;

  // Service-role client: the only privileged operation, scoped to that id.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("delete-account: deleteUser failed", delErr.message);
    return json({ error: "Deletion failed. Please try again." }, 500);
  }

  return json({ ok: true });
});

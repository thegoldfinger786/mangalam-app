#!/usr/bin/env bash
# ─── generate-gita-titles runner ──────────────────────────────────────────────
# Invokes the deployed generate-gita-titles Edge Function.
#
# Two headers are always required:
#   • Authorization: Bearer <anon key>   — satisfies the Supabase gateway
#     (verify_jwt = true). The anon key is public (it ships in the app bundle
#     and .env); it is authentication, not authorization.
#   • x-admin-secret: <ADMIN_API_SECRET> — the real authorization check
#     (supabase/functions/_shared/adminAuth.ts).
#
# Usage, from the repo root:
#   export ADMIN_API_SECRET='...'          # the project's ADMIN_API_SECRET
#   ./supabase/functions/generate-gita-titles/run.sh sample     # dry-run, 8 verses
#   ./supabase/functions/generate-gita-titles/run.sh probe      # dry-run ch 9 + ch 18
#   ./supabase/functions/generate-gita-titles/run.sh run        # full resumable backfill
#   ./supabase/functions/generate-gita-titles/run.sh raw '{"dryRun":true,"limit":3}'
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FN_URL="https://yhuvjcmemsqjkttizxem.supabase.co/functions/v1/generate-gita-titles"

# Anon key: prefer the environment, else read it from .env (public value).
ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
if [[ -z "$ANON_KEY" && -f "$REPO_ROOT/.env" ]]; then
  ANON_KEY="$(grep -E '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')"
fi
if [[ -z "$ANON_KEY" ]]; then
  echo "error: EXPO_PUBLIC_SUPABASE_ANON_KEY not set and not found in .env" >&2
  exit 1
fi
if [[ -z "${ADMIN_API_SECRET:-}" ]]; then
  echo "error: export ADMIN_API_SECRET before running this script" >&2
  exit 1
fi

call() {
  curl -s -X POST "$FN_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "x-admin-secret: $ADMIN_API_SECRET" \
    -H "Content-Type: application/json" \
    -d "$1"
}

# Exit loudly on an auth / server error instead of silently treating it as "done".
guard() {
  local body="$1" err
  err="$(echo "$body" | jq -r '.error // .message // empty' 2>/dev/null || true)"
  if [[ -n "$err" ]]; then
    echo "$body" | jq . 2>/dev/null || echo "$body"
    case "$err" in
      Forbidden)
        echo "→ x-admin-secret does not match the project's ADMIN_API_SECRET." >&2
        echo "  Copy it from Supabase dashboard → Project Settings → Edge Functions → Secrets," >&2
        echo "  then: export ADMIN_API_SECRET='<exact value>'" >&2 ;;
      *AUTH_HEADER*|*authorization*)
        echo "→ gateway rejected the request; anon key missing or wrong." >&2 ;;
      "Server misconfigured")
        echo "→ ADMIN_API_SECRET is not set on the function itself." >&2 ;;
    esac
    exit 1
  fi
}

cmd="${1:-sample}"
case "$cmd" in
  check)
    out="$(call '{"dryRun": true, "limit": 1}')"; guard "$out"
    echo "auth OK"; echo "$out" | jq '{attempted, succeeded}'
    ;;
  sample)
    out="$(call '{"dryRun": true, "limit": 8}')"; guard "$out"; echo "$out" | jq
    ;;
  probe)
    for r in '9,9' '18,18'; do
      f="${r%,*}"; t="${r#*,}"
      out="$(call "{\"dryRun\": true, \"limit\": 4, \"chapterFrom\": $f, \"chapterTo\": $t}")"
      guard "$out"; echo "$out" | jq '.samples'
    done
    ;;
  run)
    for i in $(seq 1 25); do
      echo "--- batch $i ---"
      out="$(call '{"mode": "missing", "limit": 40}')"; guard "$out"
      echo "$out" | jq '{attempted, succeeded, updated, skipped, failures: (.failures | length)}'
      attempted="$(echo "$out" | jq -r '.attempted // 0')"
      [[ "$attempted" == "0" ]] && { echo "nothing left to do"; break; }
      sleep 2
    done
    ;;
  raw)
    call "${2:?usage: run.sh raw '<json body>'}" | jq
    ;;
  *)
    echo "usage: run.sh [check|sample|probe|run|raw '<json>']" >&2
    exit 1
    ;;
esac

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

cmd="${1:-sample}"
case "$cmd" in
  sample)
    call '{"dryRun": true, "limit": 8}' | jq
    ;;
  probe)
    call '{"dryRun": true, "limit": 4, "chapterFrom": 9, "chapterTo": 9}'   | jq '.samples'
    call '{"dryRun": true, "limit": 4, "chapterFrom": 18, "chapterTo": 18}' | jq '.samples'
    ;;
  run)
    for i in $(seq 1 25); do
      echo "--- batch $i ---"
      out="$(call '{"mode": "missing", "limit": 40}')"
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
    echo "usage: run.sh [sample|probe|run|raw '<json>']" >&2
    exit 1
    ;;
esac

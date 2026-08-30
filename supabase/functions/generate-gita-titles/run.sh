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

# Classify a response body:
#   ok      — a normal result JSON (has .attempted)
#   retry   — transient worker/gateway failure, safe to call again (resumable)
#   fatal   — auth / config error, stop
classify() {
  local body="$1" err
  if echo "$body" | jq -e 'has("attempted")' >/dev/null 2>&1; then echo ok; return; fi
  err="$(echo "$body" | jq -r '.error // .message // .code // empty' 2>/dev/null || true)"
  case "$err" in
    Forbidden|"Server misconfigured"|*AUTH_HEADER*|*authorization*) echo fatal ;;
    *) echo retry ;;   # WORKER_RESOURCE_LIMIT, 5xx, empty body, timeout
  esac
}

fatal_hint() {
  case "$(echo "$1" | jq -r '.error // .message // empty' 2>/dev/null)" in
    Forbidden)
      echo "→ x-admin-secret does not match the project's ADMIN_API_SECRET." >&2 ;;
    *AUTH_HEADER*|*authorization*)
      echo "→ gateway rejected the request; anon key missing or wrong." >&2 ;;
    "Server misconfigured")
      echo "→ ADMIN_API_SECRET is not set on the function itself." >&2 ;;
  esac
}

guard() {
  case "$(classify "$1")" in
    fatal) echo "$1" | jq . 2>/dev/null || echo "$1"; fatal_hint "$1"; exit 1 ;;
  esac
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
    # Each edge-worker invocation has a bounded CPU budget, and every verse is a
    # multi-second Gemini call — so keep the per-call limit small and loop a lot.
    # mode:"missing" makes every call resumable, so a transient
    # WORKER_RESOURCE_LIMIT / 5xx just means "call again".
    batch_limit="${2:-6}"
    empty_streak=0
    for i in $(seq 1 300); do
      out="$(call "{\"mode\": \"missing\", \"limit\": $batch_limit}")"
      case "$(classify "$out")" in
        fatal) guard "$out" ;;
        retry)
          echo "--- $i: transient ($(echo "$out" | jq -rc '.code // .message // .' 2>/dev/null | head -c 60)); retrying ---"
          sleep 5; continue ;;
      esac
      printf '%3d: ' "$i"
      echo "$out" | jq -c '{attempted, updated, skipped, failures: (.failures | length)}'
      efail="$(echo "$out" | jq -r '.failures | length')"
      [[ "$efail" != "0" ]] && echo "$out" | jq -c '.failures'
      attempted="$(echo "$out" | jq -r '.attempted')"
      if [[ "$attempted" == "0" ]]; then
        empty_streak=$((empty_streak + 1))
        [[ "$empty_streak" -ge 3 ]] && { echo "done — 3 consecutive empty passes"; break; }
      else
        empty_streak=0
      fi
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

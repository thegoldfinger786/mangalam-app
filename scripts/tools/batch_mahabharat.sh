#!/bin/bash

# Configuration
PROJECT_ID="yhuvjcmemsqjkttizxem"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodXZqY21lbXNxamt0dGl6eGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDQzMjEsImV4cCI6MjA4Nzg4MDMyMX0.G8UVQFfQhu0St4kcQeKF75GM5-bbC1xgFNTKHxI7uqM"
BASE_URL="https://$PROJECT_ID.supabase.co/functions/v1"

echo "🚀 Starting Mahabharat Batch Regeneration (84 Verses)..."

for i in {1..84}
do
  echo "--- Processing MB Ch 1 Verse $i ---"
  
  # 1. Regenerate Text Content
  echo "   📝 Generating content..."
  RESP_TEXT=$(curl -s -X POST "$BASE_URL/import-content" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"book\": \"mahabharat\", \"chapter\": 1, \"verse\": $i}")
  
  VERSE_ID=$(echo $RESP_TEXT | grep -o '"verse_id":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$VERSE_ID" ]; then
    echo "   ❌ Failed to generate content: $RESP_TEXT"
    continue
  fi
  
  echo "   ✅ Content saved (ID: $VERSE_ID)"
  
  # 2. Regenerate Audio (All 4 variants)
  for lang in "en" "hi"
  do
    for gender in "male" "female"
    do
      echo "   🔊 Generating TTS ($lang/$gender)..."
      curl -s -X POST "$BASE_URL/generate-tts" \
        -H "Authorization: Bearer $ANON_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"verse_id\": \"$VERSE_ID\", \"language\": \"$lang\", \"gender\": \"$gender\", \"force\": true}" > /dev/null
    done
  done
  
  echo "   ✅ Audio sequence triggered."
  echo "   Sleeping 2s to be kind to the API..."
  sleep 2
done

echo "🎉 ALL DONE!"

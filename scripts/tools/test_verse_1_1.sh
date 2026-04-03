#!/bin/bash

# Configuration
URL="https://yhuvjcmemsqjkttizxem.supabase.co/functions/v1/import-content"
# Use the ANON_KEY from .env or hardcoded for test
AUTH_HEADER="Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY"

# Verse 1.1 Data from CSV (Extracted manually for test)
TRANSLATION="In the ancient and hallowed Naimisha forest, a profound twelve-year sacrifice was underway, conducted by a multitude of revered sages under the sagacious leadership of the venerable Saunaka. The air vibrated with sacred chants, and the flickering flames of the sacrificial altars cast long shadows, illuminating the serene countenances of those devoted to spiritual pursuit. It was into this sanctified assembly that Sauti, the distinguished son of Lomaharshana, arrived. He carried an aura of wisdom and experience, his eyes reflecting the vastness of the lands he had traversed and the profound narratives he had absorbed."
COMMENTARY="This foundational episode highlights the timeless human quest for wisdom and the profound role of storytelling in preserving and transmitting spiritual knowledge."
DAILY_LIFE="In our busy lives, it is easy to become disconnected from narratives that offer deeper meaning beyond daily tasks. Actively seeking out profound stories can provide perspective and guidance."

PAYLOAD=$(cat <<EOF
{
  "chapter": 1,
  "verse": 1,
  "book": "mahabharat",
  "base_content": {
    "translation": "$TRANSLATION",
    "commentary": "$COMMENTARY",
    "daily_life_application": "$DAILY_LIFE"
  }
}
EOF
)

echo "Triggering import-content for Verse 1.1 with $URL..."
curl -v -X POST "$URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

# Mangalam — Testing & QA Notes

Concise, durable notes for running and testing the Mangalam app. Not a transcript.

**Before choosing how to verify a change, read the "Testing efficiency and token discipline" section of [`Project_instructions.md`](Project_instructions.md).** Short version: use the least expensive verification method that gives sufficient confidence, don't boot the simulator/emulator by default, and keep any live testing targeted to the affected screen or flow.

## Running the app locally

- Stack: Expo SDK 54 dev build (**not** Expo Go — native modules: `expo-apple-authentication`, Sentry, reanimated worklets). Native `ios/` and `android/` folders are committed (prebuilt).
- iOS: `npx expo run:ios` (set `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first — CocoaPods fails on an ASCII locale). Or launch the existing `Debug-iphonesimulator/Mangalam.app` from DerivedData with Metro (`npx expo start`) running.
- Android: `npx expo run:android` (emulator `Pixel_9_Pro` is configured).
- Backend: a **single Supabase project** (URL + anon key in `.env`). **There is no staging/dev environment** — the app always talks to production.

## Authenticated test account

A dedicated account exists for authorized UX / QA / assisted testing:

- **Email:** `claude.test@mangalam.com`
- **Password:** _not recorded here_ — supply it at runtime, or via a local secret / environment mechanism. Never commit it to source, docs, or any tracked file.

Guidance:

- Use this account for authenticated app walkthroughs (automated or manual). **Prefer it over any personal Google/Apple account.**
- User-facing auth is Google / Apple only. The email/password form (`src/screens/AuthScreen.tsx`) is implemented but intentionally unrouted (see `CLAUDE.md` §2). To sign in with the test account, temporarily point the `Auth` stack screen in `src/navigation/index.tsx` at `AuthScreen` instead of `LoginScreen`, then **revert that one-line change** when done. Do not build a new auth path.

## Test activity creates production data

Because there is only one Supabase environment, an authenticated walkthrough writes real, account-scoped rows:

- `user_daily_usage` — a session counter increments every time a verse screen opens.
- `user_progress` — resume position / playback speed per (user, book).
- `activity_log` — `listen` / `share` / `bookmark` events. **These feed the public "Community Wisdom" leaderboards** (`get_top_content`), so test listens/shares/bookmarks nudge cross-user rankings.
- `user_bookmarks` — bookmark toggles.
- `profiles` — a `display_name` row is created at onboarding.

None of this changes schema or app behaviour, but record any meaningful side effect (e.g. a test share that pushed a verse up the Community rankings) rather than assuming it is harmless.

## Known environment quirks (not app bugs)

- Simulator: `_UIKBFeedbackGenerator` / `hapticpatternlibrary.plist` and `FigFilePlayer err=-12864` log spam is simulator-only. Audio playback works despite the FigFilePlayer messages.
- A stale (months-old) `Debug-iphonesimulator` binary can have non-responsive touch handling — rebuild with `expo run:ios` if taps/inputs do nothing.

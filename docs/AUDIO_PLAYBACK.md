# Mangalam — Audio & Automotive Playback (state of the implementation)

Audit date: 2026-08-30. Purpose: record what the current code + config actually
support for background / lock-screen / CarPlay / Android Auto listening, so
future changes don't silently regress it and so we know what still needs a
real-device test. **No code was changed by this audit — nothing is broken.**

Read this before touching `src/store/useAudioStore.ts`, `App.tsx`'s audio init,
`app.json`, or anything to do with the Play screen's lifecycle.

## Stack

- `expo-audio@1.1.1` (migrated from `expo-av` — the app uses `createAudioPlayer`,
  not the `useAudioPlayer` hook). New architecture enabled.
- One narration player + one looping background-music player, both `AudioPlayer`
  instances managed in `useAudioStore`.
- The audio session is configured **once at startup** in `App.tsx`:
  ```ts
  setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
  })
  ```
  This is the single source of truth. Commit `7562d1f` ("Fix audio background
  playback and lock screen sync", 2026-04-05) removed a **duplicate** call from
  `useAudioStore.loadAudio` — the canonical `App.tsx` call was kept, so that was
  not a regression. **Do not remove the `App.tsx` call.** Without
  `shouldPlayInBackground: true`, expo-audio's native `OnAppEntersBackground`
  handler calls `pauseAllPlayers()` and everything stops on lock/background.

## What works (established from code + native module source)

| Capability | iOS | Android | How |
|---|---|---|---|
| Background playback of the current verse | ✅ | ✅ | `setAudioModeAsync({shouldPlayInBackground:true})` + `UIBackgroundModes:["audio"]` in `app.json`; on Android expo-audio ships a Media3 `MediaSessionService` foreground service (`foregroundServiceType="mediaPlayback"`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`) in its own manifest |
| Silent-switch / DND playback | ✅ | n/a | `playsInSilentMode: true` → AVAudioSession `.playback` category |
| Lock-screen controls + Now Playing metadata (title / "Chapter · Verse" / Mangalam / artwork) | ✅ | ✅ | `player.setActiveForLockScreen(true, buildLockScreenMetadata(content), { showSeekForward: true, showSeekBackward: true })` in `useAudioStore`; metadata refreshed on verse change via `updateLockScreenMetadata` |
| Remote **play / pause / toggle** | ✅ | ✅ | expo-audio `MediaController` registers `playCommand` / `pauseCommand` / `togglePlayPauseCommand` |
| Remote **scrubber** + **skip ±10 s** | ✅ | ✅ | `changePlaybackPositionCommand` + `skipForward/BackwardCommand` (enabled by the `showSeekForward/Backward` options above) |
| **CarPlay "Now Playing" screen** | ✅ (automatic) | — | Any iOS app playing background audio with a populated `MPNowPlayingInfoCenter` gets the CarPlay Now Playing template for free. **No `com.apple.developer.carplay-audio` entitlement is required** for this — that entitlement is only for a *custom CarPlay browse UI*, which we do not build and do not need. |
| **Android Auto** | — | ✅ | expo-audio's Media3 `MediaSessionService` is what Android Auto surfaces |
| Phone-call / other-audio interruptions | ✅ | ✅ | expo-audio native `setupInterruptionHandling` + `interruptionMode: 'doNotMix'`; background music pauses/resumes with the narration in `useAudioStore`'s status listener |
| App background → foreground resync | ✅ | ✅ | `AppState` listener forces a remote-progress sync on background; `setIsAudioActiveAsync(true)` re-activates the session on resume |

## Known gaps (not regressions)

1. **No remote next / previous-track buttons.** expo-audio's iOS `MediaController`
   does not register `nextTrackCommand` / `previousTrackCommand` — only play /
   pause / seek / skip±10 s. The in-app prev/next buttons work; the lock screen
   and CarPlay do not offer them. Adding them would require patching expo-audio
   or a native module.

2. **No auto-advance to the next verse while backgrounded (PLAY-14).** When a
   verse ends, continuation to the next verse is driven by
   `PlayScreen.navigateToVerse`, which **early-returns when
   `!navigation.isFocused()`** — the deliberate PLAY-01 fix that stopped a stale,
   unfocused screen from collapsing the nav stack. So in the foreground the next
   verse plays automatically; with the app backgrounded / on another tab / on
   CarPlay, playback stops at the end of the current verse. PLAY-14 was reviewed
   and accepted under "daily habit over binge consumption" (`CLAUDE.md` §3), and
   its note prescribes the fix if it is ever wanted: *"driven by the audio store
   (loading the next verse's audio) — never by screen navigation."* Building that
   is a deliberate change to the playback flow and needs a product decision +
   real-device testing; it is **not** a config regression.

## Needs a real-device / CarPlay-simulator test (cannot be confirmed from code)

- CarPlay Now Playing renders correctly (artwork, title, the seek/skip buttons)
  in an actual car / the Xcode CarPlay Simulator.
- Whether, on CarPlay, the app's screen counts as "focused" behind the CarPlay
  UI — if it does, `navigateToVerse` may actually advance verses there today; if
  not, playback stops at each verse end (gap #2).
- Android Auto head-unit surface shows the MediaSession with working controls.

## Sleep timer (PLAY-10)

**Deferred.** To be revisited only after the continuous / automotive listening
experience above is confirmed on a device. When built, it must not be able to
interrupt an in-progress continuous session by accident — no player teardown,
no navigation side effects; a pure "stop after N minutes" scheduled pause.

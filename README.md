# Backlog

A minimal, **LightOS-inspired video game tracker for the Light Phone III** — a
stripped-down [Backloggd](https://backloggd.com) experience. Track your games by
status, rate them, browse by console, write them into custom lists, and read
game descriptions & screenshots — all in a distraction-free black & white
interface. Game data comes from [IGDB](https://www.igdb.com) (by Twitch).

Built on top of [light-template](https://github.com/vandamd/light-template)
(Expo + expo-router).

## Features

- **Library** — your collection, filterable by **status** (Playing / Played /
  Backlog / Wishlist) and by **console**. Both filters are remembered. A
  **full-screen grid** mode hides the chrome for a pure cover wall.
- **Ratings** — half-star ratings, kept monochrome to match the LightOS look.
- **Games** — browse popular titles **by console** (PlayStation, Xbox, Nintendo,
  Sega, PC, retro & arcade — Switch 2, Playdate, Game Boy, Neo Geo…). Endless
  scroll, and the chosen console is remembered between sessions.
- **Quick add** — double-tap a cover in a console's grid to add/remove it
  instantly (tagged with that console); a ✓ badge marks games already in your
  library.
- **Per-console filing** — when adding a game you pick which of *its* available
  consoles to file it under, Backloggd-style. The choice is remembered.
- **Search** — find any game in the IGDB database and add it to your library.
- **Game detail** — cover, platforms, status, rating, **description**
  (auto-translated to French when the app is in French) and a **full-screen
  screenshot viewer** (swipe, rotate, tap for controls).
- **Lists** — create custom lists and add games to them.
- **Bilingual** — English / French, switchable in Settings (defaults to the
  device language).
- Covers and screenshots are shown in colour; everything else stays minimal
  black & white.

## IGDB credentials

Search and browsing need free IGDB credentials (a Twitch application):

1. Go to <https://dev.twitch.tv/console/apps/create> and register an app
   (any name; OAuth redirect URL `https://localhost`; client type
   **Confidential**).
2. Copy the **Client ID** and generate a **Client Secret**.
3. In the app: **Settings → IGDB Credentials**, paste both, and save.

Credentials are stored on-device with `expo-secure-store` and never leave it.
Your library and lists are stored locally (`AsyncStorage`) and work offline.

> French descriptions are produced by machine-translating the (English-only)
> IGDB summary through a free, keyless service — the summary text is sent to
> that service for translation. It falls back to English if unavailable.

## Install (APK)

Grab the latest `app-release.apk` from the
[Releases](https://github.com/Alexis-NM/light-backlog/releases) page and install
it over USB:

```bash
adb install -r app-release.apk
```

The release APK is signed with the Android **debug** key — fine for personal
sideloading, not for the Play Store.

## Development

Requires [Bun](https://bun.sh) and the Android SDK. The native build needs
**JDK 17** (React Native 0.83).

```bash
bun install
bun dev          # build the debug app and run it on a device/emulator
```

The `android/` and `ios/` folders are **not** committed — they are generated
from `app.json` and the config plugins by `expo prebuild` (or by EAS in CI).

To produce a standalone, installable APK locally:

```bash
bunx expo prebuild --platform android   # generates android/
cd android
JAVA_HOME=<path-to-jdk-17> ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

### Commands

```bash
bun dev                # Build and run
bun run check          # Lint (ultracite / biome)
bun run fix            # Auto-fix lint issues
bun run sync-version   # Sync version across files
bun run generate-icon  # Generate icon from app name
```

## Releases (CI)

`.github/workflows/build.yml` builds an APK with EAS and creates a GitHub
release on manual dispatch (Actions tab). It requires an `EXPO_TOKEN` repo
secret and an Expo account. Alternatively, attach a locally-built
`app-release.apk` to a release by hand.

## Tech stack

Expo · expo-router · React Native · TypeScript · IGDB API (Twitch OAuth) ·
expo-secure-store · expo-screen-orientation · ultracite/biome.

## Detailed docs

See [AGENTS.md](./AGENTS.md) for the component reference and template patterns.

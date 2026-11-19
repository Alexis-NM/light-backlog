# App Template
Expo template with pre-built components and patterns.

## Rules
- Use `n()` for all numeric style values
- Use bun instead of npm
- Minimise `useEffect` - see [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- Readable code > comments

## Commands
- `bun dev` - Build and run
- `bun run sync-version` - Sync version from app.json to package.json + build.gradle
- `bun run generate-icon` - Generate app icon from first letter of app name
- `bun run generate-readme-image` - Generate README example image (requires A.png, B.png, C.png, D.png in assets/images/)
- `bun run check` - Lint
- `bun run fix` - Automatically fix linting issues
- `bun run typecheck` - Type-check (`tsc --noEmit`)
- `bun test` - Unit tests (`*.test.ts`, run with `bun:test`)
- `bun run test:import` - Live check of the list-import matcher against IGDB (needs `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET`)

## Pure logic (`core/`)
`core/` holds what needs neither React Native nor Expo: data types, IGDB client, list import, backup format and validation, translations, consoles, sort orders, the sync protocol (`sync.ts`: types, validation, most-recent-change rule) and the app's side of it (`syncClient.ts`: what to send, batches, merge, HTTP; `syncRunner.ts`: when to sync: one at a time, a moment after the user's changes, when a screen comes into view at most every 30 s, and again after a failure while changes wait). It is also read from outside this app.
- Plain TypeScript: no package import, not even React.
- Relative imports between core files, never `@/` (the alias means something else outside this app). The app imports core as `@/core/...`.
- `bun run check` enforces both rules (override in `biome.jsonc`).
- Device code stays out of core: storage, secure store, file pickers (`services/libraryStorage.ts`, `services/listStorage.ts`, `services/backupFile.ts`, `contexts/`). Each library entry and each list has its own storage key (`entry:<game id>`, `list:<id>`): a change rewrites only what it touches. Saved data that cannot be read is never taken for no data: the library and the lists then refuse changes (`unreadable`) and nothing is written over them. A save nobody waits for goes through `saveInBackground` (`services/saveFailures.ts`), so that its failure shows on every screen. `plugins/withAsyncStorageSize.js` raises AsyncStorage's limit from 6 MB to 50 MB; a single value (one list, with its games) still has to stay under 2 MB to be read back. For sync, `services/syncStore.ts` keeps the cursor, the versions the server has and the deletion markers (recorded only while sync is on), and passes the user's changes and the screens coming into view (`hooks/useSyncOnFocus.ts`) on to the sync; `contexts/SyncContext.tsx` holds the server, the triggers and the status.

## Setup
Update `app.json`:
```json
{
  "expo": {
    "name": "App Name",
    "slug": "appname",
    "icon": "./assets/icon.png",
    "android": {
      "package": "com.vandam.appname"
    }
  }
}
```
Delete `/android` folder before first build (regenerates with your config).

## GitHub Actions
Workflow at `.github/workflows/build.yml` builds APK and creates release:
1. Triggered manually via `workflow_dispatch`
2. Lints, type-checks and runs the tests: a failure stops the release
3. Generates the Android project with `expo prebuild`, then builds the release APK with Gradle
4. Creates GitHub release with changelog, in a second job: the only one allowed to write to the repository

No Expo account or repo secret is needed.

Actions are pinned to a commit SHA, with the version in a comment. To update one, replace both; never go back to a tag such as `@v5`.

## Styling with `n()`
**Always use `n()` for sizes** - normalises across screen densities:
```tsx
import { n } from "@/utils/scaling";

const styles = StyleSheet.create({
  container: { padding: n(16) },
  text: { fontSize: n(18) },
  icon: { width: n(24), height: n(24) }
});
```

## ContentContainer
Wrap screen content in `ContentContainer` - handles scrolling, theming, padding, and scroll indicators automatically. No styling needed on children.
```tsx
import ContentContainer from "@/components/ContentContainer";

export default function MyScreen() {
  return (
    <ContentContainer headerTitle="My Screen">
      <MyComponent />
      <AnotherComponent />
    </ContentContainer>
  );
}
```

Props:
- `headerTitle` - Shows header with title (omit to hide)
- `hideBackButton` - Hide back arrow (default: false)
- `rightAction` - Header icon button: `{ icon: "share", onPress: () => {} }`
- `contentWidth` - `"normal"` (default) or `"wide"` for more horizontal space
- `contentGap` - Gap between children (default: 47)

For screens whose content is a grid of games, use `GameGridContainer` instead: same header/sticky/indicator chrome, but the grid is a virtualised `FlatList` (only rows near the viewport are mounted). Anything above the grid goes in `header`; `empty` and `footer` cover the empty and loading states.

## Tabs
To add a new tab:

1. Create screen file `app/(tabs)/search.tsx`
2. Add to `TABS_CONFIG` in `app/(tabs)/_layout.tsx`:
```tsx
export const TABS_CONFIG: ReadonlyArray<TabConfigItem> = [
  { name: "Home", screenName: "index", iconName: "home" },
  { name: "Search", screenName: "search", iconName: "search" },  // new
  { name: "Settings", screenName: "settings", iconName: "settings" },
] as const;
```
3. Add `<Tabs.Screen>` entry:
```tsx
<Tabs.Screen name="index" />
<Tabs.Screen name="search" />  // new
<Tabs.Screen name="settings" />
```

Icons: Use [MaterialIcons](https://icons.expo.fyi/Index) names.

## Settings Pattern
Settings use nested routes:
```
app/(tabs)/settings.tsx         → Main settings page
app/settings/customise.tsx      → Customise options
app/settings/option-example.tsx → Options page (example)
```

Use `SelectorButton` + `OptionsSelector` for option pickers:
```tsx
// In settings page
<SelectorButton
    label="Option Example"
    value={currentValue}
    href="/settings/option-example"
/>

// In options page (app/settings/option-example.tsx)
<OptionsSelector
    title="Option Example"
    options={[{ label: "Standard", value: "standard" }, ...]}
    selectedValue={optionValue}
    onSelect={(value) => setOptionValue(value)}
/>
```

## Confirmation Screen
For destructive actions, ask with `useConfirm`. The confirm screen runs `onConfirm` from its button's press handler, so no Effect is needed:
```tsx
const confirm = useConfirm();

confirm({
  title: t("delete"),
  message: t("list_delete_confirm"),
  confirmText: t("delete"),
  onConfirm: () => deleteList(id),
});
```

## Contexts
Wrapped in `app/_layout.tsx`:
- `InvertColorsContext` - Theme toggle (black/white), persists to AsyncStorage
- `OptionExampleContext` - Example setting context (see `app/settings/option-example.tsx`)

Use: `const { invertColors } = useInvertColors();`

## Haptic Feedback
Use `HapticPressable` instead of `Pressable` for automatic haptic feedback on press.

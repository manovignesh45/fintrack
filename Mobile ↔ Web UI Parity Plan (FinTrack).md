# Mobile ↔ Web UI Parity Plan (FinTrack)

## Context

The mobile app (`apps/mobile`, Expo/React Native + expo-router + NativeWind v4) has drifted from the web
app (`apps/frontend`, React + Vite + Tailwind) on several UI features. The user wants the mobile app to
match the web app's look and behavior, plus a native gesture (swipe between tabs). Both apps share
`@fintrack/shared` (types, constants, API client) and talk to the same Go backend, so most fixes are
mobile-only presentation changes that reuse existing shared logic — not new business logic.

Decisions confirmed with the user:
- **All 10 issues**, delivered in phases (quick wins → medium → the two large items).
- **Swap the tab navigator** to a swipeable one to get real left/right swipe between tabs.
- **Categories**: add the missing edit toggle only (enables the existing add/delete). No rename flow.

Reference behavior lives in the web app; the target is visual + behavioral parity, adapted to RN primitives.

---

## Root causes (verified)

| # | User complaint | Root cause | Fix location |
|---|----------------|-----------|--------------|
| 1 | Filter shows text, web shows icon-only | Mobile trigger renders icon + "Filters" text | `apps/mobile/src/components/TransactionFilter.tsx` |
| 2 | Applied filter shows raw from/to, web shows "This month" | Preset taps set `date_from/date_to` but never `datePreset`; header pills render raw dates | Mobile filter + `app/(tabs)/index.tsx` |
| 3 | Templates not grouped Home/Personal | Mobile renders a flat `FlatList`; web groups by `entity` | `app/(tabs)/templates.tsx` |
| 4 | No dark theme | No `darkMode` config, no theme provider; screens hardcode light classes | app-wide (Phase 3) |
| 5 | Profile icon logs out directly | `HeaderRight` avatar `onPress={logout}`; no menu | `app/(tabs)/_layout.tsx` (`HeaderRight`) |
| 6 | Filter opens full-screen | `Modal presentationStyle="pageSheet"` → full-screen on Android | Mobile filter (Phase 2) |
| 7 | Filter doesn't look like web | Missing bottom-sheet layout + Category/Sub-category/TRANSFER/All-Time options | Mobile filter (Phase 2) |
| 8 | Account Details "no previous months" | It *has* month nav but defaults to current month with tiny chevrons; web defaults to an "All Time" view | `app/accounts/[id].tsx` |
| 9 | Categories: no edit toggle, can't add | Categories is a stack screen whose header has no edit toggle; global toggle only lives on tab headers | `app/categories/index.tsx` |
| 10 | No swipe between tabs | `@react-navigation/bottom-tabs` has no swipe | tab navigator swap (Phase 4) |

**Reusable shared logic (already RN-safe, do NOT reimplement):** `DATE_PRESET_LABELS`, `getPresetDates`,
`DEFAULT_FILTERS`, `countActiveFilters`, `FilterState` from `@fintrack/shared`
(`packages/shared/src/{constants,types}.ts`). The mobile filter already imports these.

---

## Phase 1 — Quick parity fixes (no new architecture)

### 1.1 Filter trigger = icon only (#1)
In `apps/mobile/src/components/TransactionFilter.tsx` trigger button (`~L49-57`): drop the `<Text>Filters</Text>`,
keep the funnel `Ionicons` + the blue count badge (`countActiveFilters`). Match web's icon-only button.

### 1.2 Friendly applied-filter label (#2)
- Mobile filter preset `onPress` (`~L83`): also set `datePreset: key` (currently sets only `date_from`/`date_to`).
  When the user manually edits a From/To date picker, set `datePreset: 'custom'` so the label falls back to dates.
- `app/(tabs)/index.tsx` `ListHeader` / `FilterPill` (`~L220-290`): render one date pill using
  `DATE_PRESET_LABELS[filters.datePreset] ?? …` when `datePreset` is set and not `custom`; only fall back to
  `From <date>`/`To <date>` when there is no preset. Mirror web `apps/frontend/src/pages/TransactionsPage.tsx:185-196`.

### 1.3 Group templates by entity (#3)
In `app/(tabs)/templates.tsx`: replace the flat list with entity-grouped sections. Reduce templates into
`Record<entity, Template[]>`, sort keys, render an uppercase section heading (HOME / PERSONAL) per group, then
the group's cards. Mirror web `apps/frontend/src/pages/TemplatesPage.tsx:68-79`. (A `SectionList` is the natural
RN fit; a grouped `.map` inside a `ScrollView` is also fine given small counts.) Also add TRANSFER to the local
`natureLabels` for consistency.

### 1.4 Account Details "All Time" view (#8)
In `app/accounts/[id].tsx`: add a `period: 'month' | 'all'` state defaulting to `'all'` (like web
`AccountDetailsPage.tsx:17`). Add a small period selector (All Time / Monthly) in the header; show the existing
prev/next month controls only when `period === 'month'`. In the fetch effect, when `period === 'all'` call
`accountsApi.get(id)` + `transactionsApi.list({ account_id, per_page: '1000' })` with opening balance =
`initial_balance`; keep the current monthly branch otherwise. Reuse the existing `calculateStatement`.
This fixes the perception that history is missing by defaulting to the full statement.

### 1.5 Categories edit toggle (#9)
In `app/categories/index.tsx` in-content header row (`~L69-74`, next to the "Categories" title): add an
edit-mode toggle switch identical to the one in `HeaderRight`, bound to `editMode`/`setEditMode` from
`useAuth()` (already imported). This makes the existing add (`+`, `+ Sub`) and delete affordances reachable
without needing to enable edit mode on a tab screen first. No backend/rename changes.

---

## Phase 2 — Filter bottom-sheet + Profile menu (medium)

### 2.1 Filter as a half-screen bottom sheet with web-parity options (#6, #7)
Rebuild the modal in `apps/mobile/src/components/TransactionFilter.tsx` to mirror web's
`apps/frontend/src/components/TransactionFilter.tsx`:
- Use `<Modal transparent animationType="slide">` with a full-screen dark backdrop (`bg-black/40`, tap to
  close) and a panel pinned to the bottom (`rounded-t-2xl`, `maxHeight: '90%'`, drag-handle pill, header with
  title + close, scrollable body, sticky footer with Reset All + Apply). This replaces `presentationStyle="pageSheet"`
  so it is a true half-sheet on both iOS and Android.
- Add the missing options to reach parity: **Category** and **Sub-category** selects (fetch via
  `categoriesApi.list()` once, guarded), **TRANSFER** in the nature options, and a **date preset select** that
  includes an all-time/custom option. Keep cascade-resets (changing entity clears nature/category/sub; changing
  nature clears category/sub) as web does.

Note (optional, non-blocking): the offline transactions read `transactionRepo.getAll` does not yet filter by
`category_id`/`account_id`. Category filtering will work online (API) but be a no-op offline until that repo is
extended. Flag but do not block Phase 2 on it.

### 2.2 Profile menu (#5)
Refactor the `HeaderRight` avatar in `app/(tabs)/_layout.tsx` from `onPress={logout}` into a menu (a small
absolutely-positioned dropdown, or a `Modal`/popover) mirroring web `apps/frontend/src/App.tsx:96-168`:
- Header: **"Signed in as `<username>`"**.
- **Settings** row → opens a submenu; wire the **Theme** (light/dark/system) submenu in Phase 3 (stub the row
  until then).
- **Logout** (red) → `logout()`.
Keep the Edit toggle beside the avatar. Because `HeaderRight` is a self-contained component using only
`useAuth()`, it is unaffected by the Phase 4 header relocation.

---

## Phase 3 — App-wide dark theme (large)

Approach: NativeWind v4 class-based dark mode + a theme provider mirroring web's `{ theme, setTheme }` API.

1. `apps/mobile/tailwind.config.js`: add `darkMode: 'class'`. Keep `app.json` `userInterfaceStyle: "automatic"`.
2. New `apps/mobile/src/context/ThemeContext.tsx`: `theme: 'light'|'dark'|'system'` persisted in **SecureStore**
   (already a dep) under key `fintrack-theme`; apply with `colorScheme.set(theme)` from the `nativewind` package
   on load + change. Same public API as `apps/frontend/src/context/ThemeContext.tsx`.
3. New `apps/mobile/src/theme/colors.ts`: `useThemeColors()` (reads NativeWind's resolved `useColorScheme()`)
   returning a light/dark palette for the **non-NativeWind JS color props** (Ionicons `color`, `ActivityIndicator`,
   `placeholderTextColor`, and React Navigation header/tab-bar colors).
4. New `apps/mobile/src/theme/tw.ts`: semantic className tokens bundling light+dark (e.g.
   `card: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'`,
   `textPrimary: 'text-gray-800 dark:text-gray-100'`, `screen: 'flex-1 bg-gray-50 dark:bg-gray-900'`). Screens
   compose these instead of hand-editing ~220 individual class tokens, keeping the light↔dark mapping in one place.
5. Wrap the app in `<ThemeProvider>` in `apps/mobile/app/_layout.tsx` (outermost) and theme `expo-status-bar`
   (`style` driven by resolved scheme, not `"auto"`).
6. Migrate screens/components to `tw.*` + `useThemeColors()`. Order by churn:
   `src/components/{TransactionFilter,TransactionForm}.tsx`, `app/accounts/[id].tsx`, `app/(tabs)/{summary,index,accounts,templates,more}.tsx`,
   `app/categories/{index,new}.tsx`, `app/{tally,login,add}.tsx`, `app/edit/[id].tsx`,
   `app/categories/[catId]/sub/new.tsx`, `app/templates/new.tsx`. (`SyncStatusBar.tsx` has no hardcoded tokens.)
7. Wire the **Theme** submenu into the Phase 2 profile menu (light/dark/system with a ✓ on the active choice),
   matching web `App.tsx:145-165`.

Nav chrome (header + tab bar) colors are applied in Phase 4, where the header lands in its final location.

---

## Phase 4 — Swipe navigation between tabs (large)

Replace `@react-navigation/bottom-tabs` with `@react-navigation/material-top-tabs` positioned at the bottom
(`tabBarPosition="bottom"`, `swipeEnabled`), exposed to expo-router via `withLayoutContext`. This is the reliable,
expo-router-native way to get swipe while keeping file-based routing and the same 5 tabs/icons.

1. `npx expo install @react-navigation/material-top-tabs react-native-pager-view react-native-tab-view`
   (`react-native-gesture-handler` + `react-native-reanimated` already installed). Use `expo install` for
   version alignment with Expo 54 / RN 0.81 / New Arch.
2. Rewrite `apps/mobile/app/(tabs)/_layout.tsx` to a `MaterialTopTabs` navigator
   (`withLayoutContext(createMaterialTopTabNavigator().Navigator)`), `tabBarPosition="bottom"`, `swipeEnabled: true`,
   `lazy: true`, `tabBarShowIcon`+`tabBarShowLabel` for icon-over-label parity, small label style, and
   `tabBarIndicatorStyle` positioned at the top edge (or hidden). Colors come from `useThemeColors()` (Phase 3).
3. **Move the header to the root Stack**: in `apps/mobile/app/_layout.tsx`, set `headerShown: true`,
   `headerTitle: 'FinTrack'`, `headerRight: () => <HeaderRight />`, and themed `headerStyle`/`headerTitleStyle`
   on the `(tabs)` `Stack.Screen`. Relocate the `HeaderRight` component (edit toggle + Phase 2 profile menu) there
   verbatim — material-top-tabs render no header, and the title is a constant, so one shared Stack header above the
   swipeable body matches web (one header, swipe the body).
4. `apps/mobile/components/haptic-tab.tsx` is a bottom-tabs button and becomes unused — retire it, or fold its
   haptics into a custom `tabBar` if pixel/haptic parity is desired.

**Top risks & mitigations:** (a) lost header/edit-toggle/profile → mitigated by step 3 relocation; (b) horizontal
gesture conflict with any horizontal child list → screens are vertical today, scope `swipeEnabled` off per-screen
if it appears; (c) Android/New-Arch perf → keep `lazy: true`, install via `expo install`; (d) bottom indicator
artifact → style/hide it. Data is safe on swipe because screens read from SQLite via `useFocusEffect`, which
material-top-tabs fires identically.

---

## Critical files

- Filter: `apps/mobile/src/components/TransactionFilter.tsx`, `apps/mobile/app/(tabs)/index.tsx`
- Templates: `apps/mobile/app/(tabs)/templates.tsx`
- Account details: `apps/mobile/app/accounts/[id].tsx`
- Categories: `apps/mobile/app/categories/index.tsx`
- Header / profile / tabs: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/_layout.tsx`
- Theme (new): `apps/mobile/src/context/ThemeContext.tsx`, `apps/mobile/src/theme/colors.ts`,
  `apps/mobile/src/theme/tw.ts`, `apps/mobile/tailwind.config.js`
- Web references (read-only, mirror behavior): `apps/frontend/src/components/TransactionFilter.tsx`,
  `apps/frontend/src/pages/{TransactionsPage,TemplatesPage,AccountDetailsPage}.tsx`, `apps/frontend/src/App.tsx`,
  `apps/frontend/src/context/ThemeContext.tsx`
- Reuse (do not modify): `packages/shared/src/{constants,types}.ts`

---

## Verification

Run the mobile app and drive each flow against the web app side-by-side.

- Launch: `pnpm --filter @fintrack/mobile start` (or the repo's Expo start script) and open in Expo Go / a
  simulator. Point `apps/mobile/.env*` at the same backend the web app uses.
- **Phase 1:** filter button shows icon only with a count badge; applying "This month" shows a "This month" pill
  (not raw dates), and a custom date range still shows From/To; Templates render HOME/PERSONAL sections;
  Account Details opens on an "All Time" statement and Monthly still navigates months; Categories screen shows an
  edit toggle and, when on, add/delete work.
- **Phase 2:** the filter opens as a bottom half-sheet with a dim backdrop (both iOS and Android), including
  Category/Sub-category/TRANSFER and preset options; tapping the profile avatar opens a menu ("Signed in as …",
  Settings, Logout) instead of logging out immediately.
- **Phase 3:** toggle light/dark/system from the profile menu; every screen (lists, cards, inputs, filter sheet,
  header, tab bar, status bar) restyles with no white flashes; the choice persists across app restarts and
  'system' follows the OS.
- **Phase 4:** swipe left/right moves between Transactions ↔ Templates ↔ Loans ↔ Summary ↔ More; the FinTrack
  header with edit toggle + profile menu stays put; bottom bar respects the safe-area inset; verify smoothness on
  Android.
- Typecheck after each phase: `pnpm --filter @fintrack/mobile exec tsc --noEmit` (and `pnpm --filter @fintrack/shared build` if the shared package is touched — not expected here).
- After code changes, run `graphify update .` to keep the knowledge graph current.

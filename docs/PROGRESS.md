# Progress

## Session 1 — Planning and documentation

**Date:** 11 October 2026 (Asia/Kolkata)  
**Status:** Planning documents created; SPEC reconciliation pending.  
**Scope:** Documentation only. No application implementation or migration was written or installed.

### Inputs and decisions

- Read project `AGENTS.md` and referenced `/Users/mayank/.codex/RTK.md` fully. Inspected `package.json`, `app.json`, `tsconfig.json`, existing routes/files, and repository status. Current project uses Expo `~57.0.27`, React Native `0.86.3`, Expo Router `~57.0.25`, npm and `package-lock.json`.
- `docs/SPEC.md` and the entire `docs/` directory were absent at the start. The user subsequently instructed creation to proceed. The draft covers supplied requirements and explicitly marks the route/screen inventory and product semantics as provisional. No replacement SPEC was fabricated. Exhaustive SPEC feature/screen coverage cannot be verified until the actual SPEC is available.
- Read requested `gpt-taste`. Requested `building-native-ui` was unavailable after searching installed skills. Used `expo:expo-native-ui` as the documented substitute, with Expo overview/UI/router/animation and project glass-effect guidance. Adapted web-only taste prescriptions to a native utility; no GSAP/AIDA landing page implementation is planned.
- Checked SDK 57 documentation, Expo's LLM index, NativeTabs, SQLite/Drizzle, glass/blur, notifications, AuthSession, pickers, haptics, and React Native accessibility references. Source links are included with the relevant architecture/design/roadmap guidance.
- Proposed four NativeTabs: Today, Subjects, Files, Insights. Timetable and Settings are pushed screens. Proposed weighted attendance ledger, no automatic absences, neutral/holiday exclusion, immutable historical snapshots, semester-relative parity, local-first core, reviewed AI imports, and optional accounts.

### Deliverables

- [ARCHITECTURE.md](ARCHITECTURE.md): target `src/app/` layout, four-tab route map, subject segments, full proposed modal/sheet inventory, all **18** requested Drizzle tables, indexes/FKs/checks, transactional invariants, occurrence expansion, formulas and edge cases, backup/notification boundaries, and verification examples.
- [DESIGN.md](DESIGN.md): light/dark tokens with one accent, status palette, type/spacing/radii, native glass/blur/opaque fallback rules, Reduce Transparency/Motion behavior, duration/spring specifications, haptics, component states, **39 proposed screen layouts**, and every proposed editor sheet.
- [ROADMAP.md](ROADMAP.md): **34 provisional feature rows** mapped to Sessions **2–13**, screen ownership, session acceptance gates, Expo Go versus development-build matrix, optional account scope, and eight decisions with recommended defaults.
- This Session 1 entry closes the documentation package and records outstanding evidence honestly.

### Verification

| Check | Result |
|---|---|
| Requested schema table inventory | Passed: exact match of all 18 supplied table names |
| Proposed screen layout inventory | Passed: S01–S39 each has a layout entry |
| Session inventory | Passed: Sessions 2–13 all present |
| Markdown fences | Passed: balanced in architecture/design/roadmap |
| Documented schema TypeScript syntax | Passed using installed TypeScript transpilation; Drizzle semantic type checking and actual migration execution deferred to Session 2 |
| Attendance formulas | Passed exact-integer checks across 6,020 valid combinations of attended/held totals and targets; endpoint/zero-history cases documented separately |
| Opaque text palette | Passed 58 foreground/background pairs, minimum 4.73:1 after darkening light-mode muted text; native/composited glass still requires device visual QA |
| `git diff --check` | Passed for tracked working-tree changes; document whitespace reviewed separately at close |
| Typecheck (`npx --no-install tsc --noEmit`, through RTK) | Failed on two existing starter CSS declaration errors: `src/components/animated-icon.web.tsx:5` cannot resolve `./animated-icon.module.css`; `src/constants/theme.ts:6` cannot resolve side-effect import `@/global.css` |
| Lint (`expo lint --no-cache`, offline through RTK) | Could not complete: no ESLint configuration/dependencies. Expo began automatic bootstrap; stopped it, reverted its two `package.json` dependency additions, and verified no remaining tracked configuration/manifest changes |
| SPEC traceability | Unverified: `docs/SPEC.md` missing |
| Device/UI/build validation | Not run; this session is planning only |

### Handoff to Session 2

1. Reconcile the actual SPEC with the provisional feature, route, and screen inventories; confirm the eight roadmap decisions as needed.
2. Resolve the existing CSS type declaration errors and configure ESLint intentionally as foundation work. Session 1 does not change app code to resolve these.
3. Validate the schema against a selected SDK-compatible Drizzle integration and run real SQLite migration/FK/index/transaction checks before building feature UIs.
4. Build the foundation only when an implementation session is authorized. Document route-based sheet APIs against SDK 57 and use real native control exports.

Remaining uncertainties are recorded in `ROADMAP.md`; planning work does not imply approval of a provider, backend deployment, native dependency, account feature, or release submission.

## Session 2 — Foundation implementation

**Date:** 11 October 2026 (Asia/Kolkata)  
**Status:** Foundation implemented; automated checks pass, iOS visual checks pass, Android runtime launched. Physical-device checks and Android visual QA remain open.  
**Authorization:** User explicitly said “go” after the foundation-only request. No further implementation approval was required.

### Scope and reconciliation

- Read `AGENTS.md`, its referenced RTK instructions, SPEC, ARCHITECTURE, DESIGN, ROADMAP, and the prior progress entry. There was no `design/refs/` directory to match.
- Used Expo SDK 57 versioned documentation and the Expo docs index before implementation. Read the requested `gpt-taste` and available Expo overview/native-UI/router/UI/animation guidance. `building-native-ui` remains unavailable; used the documented `expo:expo-native-ui` substitute. Native conventions and DESIGN tokens take precedence over web-specific taste instructions.
- Implemented the user's four tabs: **Subjects, Daily Log, Timetable, Settings**. Routes stay in `src/app/` per current AGENTS instructions. Added precedence notes to the planning documents and corrected SPEC's stale root-level route proposal. Later feature screens, AI, accounts, deployment, notifications, and file workflows were not implemented.
- For the overlapping status-color wording, below-target values are red; defined values from the target through three percentage points above it are amber; higher values are green. An undefined percentage stays neutral. Exact target comparison determines eligibility independently of display rounding.

### What was built

- Installed the required runtime and development packages through `rtk npx expo install`, preserving SDK-compatible native versions. Added Jest, ESLint, Drizzle Kit, SQL import tooling, and Prettier configuration support. Fixed the starter CSS declaration errors and obsolete starter routes/tab components.
- **App shell:** NativeTabs with SF Symbols on iOS and Material icons on Android; per-tab native stacks; thin route files; safe areas; Subjects/Daily Log/Timetable empty placeholders; functional foundation preferences in Settings.
- **`src/ui/`:** exact light/dark tokens; system/forced ThemeProvider; accessibility preference listeners; GradientBackground; adaptive GlassCard (supported GlassView, blur fallback, opaque for Reduce Transparency/contrast); SVG/Reanimated ProgressRing; Button; IconButton; Chip; native SegmentedControl; native BottomSheet; Toast with guarded asynchronous Undo; EmptyState; Skeleton; optional preference-aware haptics.
- **Development showcase:** reachable from Settings only in `__DEV__`; every shared component, both themes, no-data/disabled/loading states, ring values, selection, sheet presentation, sample mutations with Undo, and haptic feedback controls. Native appearance and glass follow the forced showcase theme. Reduce Effects disables motion and selects opaque surfaces.
- **Database:** `src/db/schema.ts` copied verbatim from ARCHITECTURE's complete 18-table TypeScript schema; first migration and journal; foreign keys, WAL, and migrations before screens mount; bootstrap loading/error/retry states that preserve the database; typed create/get/list/update/remove repositories per table; typed settings; optimistic revision guards; transactional semantic validation; canonical occurrence upsert/reset and frozen snapshots. New slots/extras copy class-type default weights without later propagation.
- **Demo seed:** additive, deterministic, development-only demo semester with six subjects, 21 non-overlapping weekly slots covering all seven weekdays, and 63 weighted present/absent/neutral records spanning three complete past weeks. Repeated load is idempotent. Undo preserves unrelated data and refuses to delete changed demo data.
- **`src/lib/attendance/`:** exact integer target/needed/skip calculations; zero-history and 0%/100% target outcomes; rounding labels; weighted totals and every chronological ledger prefix; occurrence deltas and forecasts; calendar/semester-relative parity/version/holiday/extra expansion with historical snapshots; per-day precedence; syllabus, marks/coverage, deadline, study, and ready-file-size formulas.

### Files touched

- Application: `src/app/**`, `src/features/{shell,settings,showcase}/**`, `src/ui/**`, `src/lib/attendance/**`, `src/db/**`, and `src/types/assets.d.ts`.
- Tooling/configuration: `package.json`, `package-lock.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `drizzle.config.ts`, `jest.config.js`, `eslint.config.js`, `scripts/sql-transformer.js`, `.gitignore`, and the starter web color-scheme hook. Removed obsolete starter screens and tab components.
- Documentation: SPEC route correction, implementation precedence notes in ARCHITECTURE/DESIGN/ROADMAP, migration-generator note, and this append-only entry. The documented schema was not changed.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero warnings/errors |
| `rtk npx jest --runInBand --coverage` | Passed: **98 tests**, four suites |
| Pure attendance tests | **77 tests**, **100% statements, branches, functions, and lines**; enforced coverage thresholds |
| SQLite integration tests | **21 tests** using the actual Expo Drizzle adapter/migrator against native SQLite; schema equality, all 18 tables, FKs/checks/indexes, migration rerun, rollback, revisions, source snapshots, schedule conflicts, default weights, folder scope/cycles, settings, historical prefix reset, demo/idempotence/Undo |
| Android production export | Passed; Hermes bundle and bundled assets generated outside the repository |
| Installed Expo dependency map | Passed local SDK compatibility check; online well-known endpoint was unavailable, so this is not a full online doctor result |
| iOS Expo Go | Opened on iPhone 17 Pro / iOS 26.5; four routes render; tab switching exercised; light/dark showcase, readable dark glass/native sheet, Reduce Effects, persisted preference after relaunch, demo load and Undo verified |
| Android Expo Go | Installed SDK-compatible Expo Go on existing Pixel 6a / API 35 emulator; app bundle loaded, `Running main` logged, and bridgeless React Native inspector connected. No app JavaScript exception observed. Emulator window was unavailable to the UI inspection tool, so Android layout, gestures, and theme visuals remain unverified |
| `rtk git diff --check` | Passed |

### Known limitations and implementation notes

- Drizzle Kit 0.31.11 misquotes `coalesce` expressions when generating `folders_sibling_uq`. Corrected that SQL in the unshipped first migration to match the documented NULL-scope uniqueness contract; the real SQLite test verifies it. `src/db/migrations/README.md` records the correction for future migration reviews.
- SQLite integration tests use Node's built-in `node:sqlite`, tested with **Node 26.11.0**. Use Node 26 for the same test runner environment. The mobile app itself does not depend on Node SQLite.
- Repository-wide semantic validation intentionally checks one consistent transaction snapshot at foundation scale. Later feature commands can narrow queries while preserving these invariants. An explicit conflict-review option exists at the command layer; the actual review UI belongs to later feature work.
- Expo Go on Android logged headless task-loader initialization warnings before `Running main`; this foundation does not use background tasks. No corresponding application exception was observed.
- Physical haptics, VoiceOver/TalkBack traversal, large accessibility text, older-iOS blur fallback, Android API <31 opaque fallback, and Android sheet/back behavior require the phone checks below. No native build or store submission was created.
- Metro is available on **port 8085** for both platforms. The local emulator uses `exp://10.0.2.2:8085`; an iOS simulator uses `exp://127.0.0.1:8085`. For phones on the same Wi-Fi, use Expo's LAN URL/QR (this session: `exp://192.168.1.10:8085`). Restart with `rtk npx expo start --port 8085` if the server is stopped or the host address changes.

### Phone checklist — iOS and Android

- [ ] Open the project in SDK-compatible Expo Go on each physical phone; confirm the workspace opens without a red error screen, including after a cold relaunch.
- [ ] Tap Subjects, Daily Log, Timetable, and Settings repeatedly; verify labels/icons, selected state, safe areas, and native back behavior.
- [ ] In Settings, choose System, Light, and Dark; relaunch and confirm the choice persists. Test Undo on preferences and the haptics toggle.
- [ ] Open Design showcase and switch both themes. Inspect text, status swatches, adaptive/solid cards, ring, buttons, chips, segmented controls, skeletons, and empty state. Android visual QA is still outstanding.
- [ ] Select no data, 0%, 75%, and 100% for the ring; verify smooth updates and stable text. Confirm disabled/loading buttons cannot mutate the preview.
- [ ] Open the sheet, expand/scroll it, add a sample, Undo, reopen, and dismiss using Done, swipe, and Android Back as appropriate.
- [ ] Load demo data: expect **6 subjects · 21 weekly slots · 63 records**. Tap again and confirm no duplication. On a fresh load, use Undo and confirm only that unchanged demo dataset is removed.
- [ ] Turn on OS Reduce Motion and Reduce Transparency where supported, and test app Reduce Effects. Cards must remain readable/opaque and animations must settle immediately. Check blur fallback on older iOS and opaque fallback on older Android if available.
- [ ] Enable VoiceOver/TalkBack and large text. Check meaningful labels, focus order, toast announcements/Undo, scrollable sheets, no clipped controls, and minimum touch targets.
- [ ] Check physical haptics on/off, background/foreground recovery, offline relaunch with existing data, and Android light/dark status/navigation bars.

## Session 3 — Timetable implementation

**Date:** 11 October 2026 (Asia/Kolkata)  
**Status:** Implemented; automated checks and iOS simulator flows pass. Physical-device checks, Android visual QA, and the remaining interaction checks below are open.  
**Authorization:** Read the project instructions and all existing `docs/*.md`, presented the implementation plan, and waited for the user's explicit “go”.

### What was built

- Used the requested `building-native-ui` skill (located in the installed Expo plugin's temporary skill directory), `gpt-taste`, and matching Expo SDK 57 documentation. Native mobile conventions and the existing DESIGN tokens take precedence over the taste skill's web-specific layout/motion rules.
- **Subjects manager:** active/archive filtering, search, add/edit/archive/restore, name, short code, six accessible subject colors, icon, teacher, and optional target override. Blank overrides inherit the semester target. Archive keeps existing slots and attendance; mutations offer guarded Undo and refresh open managers immediately.
- **Timetable:** Week/List toggle, horizontally scrollable Monday–Saturday grid, blocks positioned and sized by duration, today highlight, current-time line, previous/today/next navigation, semester-relative odd/even labels, semester selector, and version history. List shows chronological classes by day and includes Sunday when an existing Sunday schedule is present.
- **Slot sheet:** tap a class or an empty hour to select subject, class type, weekday, native start/end times, venue, teacher, and every/odd/even pattern. Add, edit, and remove operate on a complete validated schedule. Save/Cancel stay in the native header; dirty forms ask before discarding. Archived semesters are read-only.
- **Class types:** explicit setup of missing Lecture/Lab/Tutorial defaults, each initially counting as 1; add/edit custom types and positive whole-number weights. Existing defaults are retained (including the demo Lab's weight of 2). Changes affect new slots; saved slots and attendance retain their weights.
- **Versioning:** after any attendance exists, save/remove asks **Apply from today** or **Apply to whole semester**. Today splits the active range; whole-semester starts at the semester start. Each edit creates a version, supersedes affected schedules through semester end, and retains original ranges/slots for historical references. Stable slot lineage prevents duplicate occurrences or duplicate marks across version clones. Attendance rows and frozen details/totals remain unchanged. Stale editors and unsafe Undo attempts fail without partial writes.
- **Validation:** same-day overlapping times reject when week patterns can coincide; adjacent times and odd/even alternatives are allowed. Friendly errors cover invalid times, duplicates, target percentages, weights, unavailable references, and stale saves.
- **First run/export:** Add manually can create the necessary semester, subjects, and classes. Empty states include **Import with AI** and **Add manually**. AI import is a Session 6 placeholder. JSON export opens the native share sheet; web has share/download fallback. No `IMPORT_FORMAT.md` existed, so [TIMETABLE_EXPORT.md](TIMETABLE_EXPORT.md) records the provisional contract and Session 6 reconciliation work.

### Files touched

- Thin routes in `src/app/`: Timetable tab, Subjects manager/editor, Class types manager/editor, Slot editor, Semester setup, and root stack registrations.
- Feature implementation: `src/features/timetable/**`; shared date/version/overlap helpers and tests in `src/lib/timetable.ts` and `src/lib/__tests__/`.
- Persistence: `src/db/schema.ts`, `validation.ts`, timetable/write/attendance commands, additive migration `0001_timetable_history`, migration metadata/readme, and SQLite integration tests. Added subject color, slot teacher/lineage, and version supersession; synchronized ARCHITECTURE's schema block.
- Historical expansion: `src/lib/attendance/calendar.ts` and its regression tests. Export format has a separate pure regression test.
- Dependencies/config: SDK-compatible `expo-file-system` and `expo-sharing`, package lock, and Expo's sharing config plugin. Temporary simulator navigation helpers were removed.
- Documentation: ARCHITECTURE, TIMETABLE_EXPORT, migration README, and this entry/checklist.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero warnings/errors |
| `rtk npx jest --runInBand --coverage` | Passed: **130 tests**, six suites |
| Attendance coverage | **100% statements, branches, functions, and lines**, enforced thresholds |
| Version/overlap tests | Date boundaries, exclusive ends, superseded versions, all nine week-pattern pairs, adjacency, contained overlaps, different weekdays, invalid ranges, and target override boundaries |
| SQLite regression tests | Today/whole-semester saves, repeated same-date versions, frozen attendance preservation, clone-lineage marking/deduplication, guarded Undo, stale-save rollback, scope requirements, overlap rollback, default types, archive retention, and real populated foundation-to-0001 migration/rerun |
| Export regression | Correct references/metadata/parity; excludes attendance, superseded schedules, lineage, and revision metadata |
| iOS production export | Passed; Hermes bundle and assets generated outside the repository |
| Android production export | Passed; Hermes bundle and assets generated outside the repository |
| iPhone 17 Pro / iOS 26.5 Expo Go | Week grid and empty-cell slot sheet render; native time wheel opens; attendance-aware prompt offers both scopes; Apply from today saves and the new class appears in the following week. Subject add/archive and immediate save Undo exercised; class types render with retained weights. JSON share sheet displays a 20 KB JSON file preview and dismisses successfully without sharing externally |
| `rtk git diff --check` | Passed for tracked files; new feature files formatted with Prettier |

### Implementation notes and remaining validation

- The version migration is additive and preserves existing attendance rows. Superseded versions remain available for historical foreign keys; only active versions participate in schedule selection and interval validation. An edited week replaces any later planned schedule through semester end, as stated in the save prompt.
- `TIMETABLE_EXPORT.md` is provisional. Session 6 must establish and validate the canonical import format before promising round-trip imports. Attendance, holidays, extras, and historical superseded schedules are outside this timetable export.
- Browser preview encountered the foundation's unresolved `expo-sqlite` WASM Metro asset configuration. Native validation and production exports succeeded; web runtime/export interaction remains unverified.
- The simulator inspection tool exposes accessible buttons/forms but cannot reliably send coordinate scrolls or operate the native segmented control. List switching, full grid scrolling, accessibility scaling, and current-time visuals need the phone checks below. Android UI was not visually inspected this session.
- Simulator interaction checks used the development demo. A test Monday 08:00 class and an archived test subject remain in that local demo; original attendance was preserved. The dedicated subject save/Undo check removed its temporary subject successfully.
- No AI import, account/backend work, development build, store submission, or deployment was performed.

### Phone checklist — Timetable, iOS and Android

- [ ] Cold-launch offline on each phone; open Timetable and verify safe areas, light/dark themes, Reduce Effects, and native back behavior.
- [ ] On a fresh local dataset, confirm **Import with AI** explains Session 6 and **Add manually** leads through semester setup, subject creation, and the first class. Cancel/discard dirty sheets and retry invalid fields.
- [ ] Add/edit a subject with code, teacher, icon, color, and 0%, 75.25%, 100%, or blank target. Reject duplicate names and out-of-range targets. Archive/restore it and confirm existing classes/attendance remain. Exercise Undo without leaving the manager.
- [ ] Confirm Lecture/Lab/Tutorial exist. Set Lab to 2, add a Lab slot, then change the default to 3: the saved slot must remain 2; a new slot must use 3.
- [ ] Toggle Week/List. Swipe the grid through Saturday and scroll its full time range. Compare 30-, 60-, and 120-minute block heights; confirm all details remain reachable in List. Check existing Sunday classes in List.
- [ ] On a Monday–Saturday, verify today's column/day highlight and current-time line in the semester timezone. Background/foreground the app and confirm the clock refreshes. Navigate across odd/even weeks and a midweek version boundary.
- [ ] Tap a class and an empty hour. Check native pickers, keyboard avoidance, header Save/Cancel, teacher/venue, every/odd/even, midnight end, and Android Back. Save, remove, and Undo each mutation.
- [ ] Attempt a same-day overlapping every/odd slot and confirm a friendly error with no saved change. Confirm adjacent slots and overlapping odd/even alternatives are accepted; invalid/reversed times reject.
- [ ] Without attendance, save without a scope prompt. With attendance (use the demo or future Daily Log), exercise both scope choices and cancellation. Verify the selected effective date, correct past/future week schedules, unchanged recorded details/totals, and no duplicate occurrence after repeated saves.
- [ ] Attempt Undo after a later edit or attendance mark and confirm it preserves newer data with a friendly error. Confirm an archived semester cannot be edited.
- [ ] Export JSON, save through the share sheet, inspect subject/type/version/slot references, and compare with TIMETABLE_EXPORT.md. Cancel sharing and confirm the export button becomes available again.
- [ ] Relaunch after edits to verify persistence. Enable VoiceOver/TalkBack and large text; check form labels, focus order, color-independent class labels, small-duration blocks, toast Undo, native sheets, and physical haptics.

## Session 4 — Daily Log implementation

**Date:** 11 October 2026 (Asia/Kolkata)  
**Status:** Implemented; lint, typecheck, tests, native exports, and the iOS checks listed below pass. Physical-device acceptance and Android visual QA remain open.  
**Authorization:** Read AGENTS.md, its referenced RTK instructions, and all six existing docs/*.md; presented a plan and waited for the user's explicit “go”.

### What was built

- Applied the requested `building-native-ui` (installed Expo plugin temporary skill directory) and `gpt-taste`. Read SDK 57 references before touching native APIs. Existing native conventions and DESIGN tokens take precedence over web-specific taste instructions.
- **Day resolution:** `src/lib/daily-log.ts` is a pure resolver with explicit date input, no clock/database side effects, and unit tests. It selects the effective active timetable version, weekday and semester-relative odd/even pattern; merges extras and frozen historical records; deduplicates cloned slots by lineage; sorts classes chronologically; and enforces inclusive semester bounds. Holiday classes remain visible as neutral. Existing forecast expansion continues to exclude holiday capacity.
- **Navigation/calendar:** date title, previous/next buttons, native horizontal paging between three neighboring day pages, Today chip, and a month sheet. Calendar dots and accessible labels distinguish all marked, partly marked, holiday, no classes, pending, unconfigured, and outside-semester days. Day completeness counts rows rather than attendance weights. Native paging handles movement without per-frame React updates; offscreen cached pages are hidden from accessibility. Route date parameters stay synchronized with button/swipe navigation.
- **Attendance rows:** subject color bar/name, saved class type, time, venue, weighted-unit label when relevant, current cumulative subject percentage, Present/Absent/Neutral controls, optional note, and past “Not marked” badge. Re-tapping the selected status clears it. Rows and the Subjects tab share canonical record-derived totals and refresh after commits/Undo. Future and archived days are read-only; outside-semester days show a grey message and calendar treatment.
- **Top actions:** Mark all present previews the affected class/unit count and replaces eligible outcomes in one transaction. Mark day as holiday previews neutral conversion and changes the holiday/records atomically. Removing a day from an existing holiday range splits only that day out, including overlapping ranges. Explicit holiday-override extras retain their eligibility. Removing a holiday keeps saved neutral marks for review; Undo restores the prior outcomes/ranges.
- **Sheets:** native Add extra class form with subject/type, native start/end time pickers, venue, and optional note. New extras copy the chosen class type's weight and reject invalid times or conflicts. The form initially offers an available time after existing classes when possible. A separate class-note sheet supports add/edit/remove independently of attendance. Both retain drafts on errors and use the existing dirty-form dismissal protection.
- **Subjects:** replaced its placeholder with a minimal active-subject attendance list showing percentage, attended/held units, inherited/override target, target status, and needed/can-skip units. Manage subjects opens the existing manager. Full subject detail/history/adjustment editors remain outside this request.
- **Persistence/Undo:** generated additive migration `0002_daily_log` adds `class_notes` plus semester/lineage slot indexes; there are now 19 application tables. Notes follow original slot lineage/date or extra ID, so clearing attendance preserves them. Daily Log writes use scoped transactions, validated sources, read-only/date guards, SQLite constraints, and indexed validation of every affected subject ledger prefix. Undo restores only changed rows, advances restored revisions, rejects stale/newer changes, and leaves unrelated rows untouched. Haptics and Undo toasts use the existing preference-aware adapters.
- **Performance:** indexed semester/day queries for attendance, extras and notes; indexed semester slot reads; SQL-derived subject totals; a bounded six-entry month cache with neighboring-month prefetch and one-day boundary coverage; virtualized class/subject lists; no per-row blur. General repository writes and bootstrap retain full database validation.
- **Shared fix:** simulator inspection exposed poor contrast on the native filled Save action. The shared Editor now uses a plain accent-colored, semibold native Save button; the corrected note-sheet appearance was visually verified.

### Files touched

- Thin routes: Daily Log and Subjects tab entries, root stack registrations, and `daily-log-calendar.tsx`, `daily-log-extra.tsx`, `daily-log-note.tsx`.
- Feature UI/state: `src/features/daily-log/**`; shared timetable invalidation subscription and Editor Save styling in `src/features/timetable/{hooks,form-controls}.tsx/ts`.
- Domain/tests: `src/lib/daily-log.ts`, `src/lib/__tests__/daily-log.test.ts`, SQLite integration additions in `src/db/__tests__/repositories.test.ts`, and resolver inclusion in Jest coverage reporting.
- Persistence: `src/db/repositories/daily-log.ts`, `src/db/schema.ts`, note date-bound validation in `src/db/validation.ts`, generated migration 0002/snapshot/journal/bundle, and migration README.
- Documentation: synchronized ARCHITECTURE's schema and Session 4 precedence note, plus this append-only entry/checklist. No dependencies or native projects were added in this session.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero warnings/errors |
| `rtk npx jest --runInBand --coverage` | Passed: **148 tests**, seven suites |
| Pure attendance coverage | **100% statements, branches, functions and lines**, enforced thresholds retained |
| New Daily Log resolver coverage | **100% lines/functions, 98.14% statements, 89.47% branches**; included in coverage reporting |
| Resolver cases | Effective/exclusive version boundaries, semester bounds, weekday/parity, holidays/scopes/union, extras/cancellations/overrides, gaps, frozen snapshots, clone deduplication, stable notes, completeness and leap/year month arithmetic |
| SQLite command cases | Mark/clear, notes preserved, batch/holiday/extra Undo, stale/future/archived/outside rejection, historical-prefix rollback, holiday range splitting, copied weights/conflicts, frozen clones, unrelated-row preservation, semester isolation, fresh/upgrade/rerun migrations |
| Query plans | EXPLAIN confirms attendance day, note day and semester slot indexes are used |
| Large ledger regression | Scoped day read, mark, subject-prefix validation and totals pass with **10,000 existing records**. Local Node SQLite measurements ranged roughly **32–54 ms** across verification runs; this is not mobile frame-time evidence |
| Native production export | Final combined iOS/Android Hermes export passed: `rtk proxy env EXPO_OFFLINE=1 npx expo export --platform ios --platform android --output-dir /private/tmp/attendance-daily-log-native` |
| iPhone 17 Pro / iOS 26.5 Expo Go | Cold launch after migration; Daily Log layout; present/clear changing Mathematics **90.9% → 91.7% → 90.9%**; holiday prompt/conversion/removal and Undo; calendar labels/day selection; future controls disabled; Today and past-day arrows; “Not marked” and 2-unit lab labels; note/extra forms render; note text entry; improved Save contrast |
| Local demo cleanup | Test holiday removed and its three neutral marks cleared. Relaunch verified today at **0 of 3 classes marked** with original subject percentages. Temporary note text was an unsaved draft and was discarded by test relaunch; no extra class was saved |
| `rtk git diff --check` | Passed; new/changed feature files formatted with Prettier |

### Known limits and remaining validation

- Native day paging is implemented, but the simulator UI tool cannot send coordinate scroll/drag input reliably (`noWindowsAvailable`). Physical swipe feel, cancellation, rapid month-boundary navigation, and release-build frame timing remain unverified.
- The simulator's accessibility bridge exposes form fields but omits the native sheet header actions; coordinate Save input also fails through that tool. Sheet persistence/Undo and rollback are verified at the SQLite command layer. Complete note/extra Save, keyboard, Cancel/discard, and Android Back flows on phones.
- Android production bundling passes; Android layout, native controls, accessibility and interaction behavior were not visually checked this session. Physical haptics, large text, dark mode, Reduce Motion/Transparency and screen-reader traversal need the checklist below.
- The prior web SQLite WASM/SharedArrayBuffer setup limitation remains; web runtime interaction was not verified. This session targets the requested native mobile workflow.
- Metro remains loopback-only on port **8085**, using IPv4-first DNS for simulator access: `rtk proxy env EXPO_OFFLINE=1 NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --port 8085 --localhost`. An attempted LAN binding was rejected by automatic approval review because it would expose the development server to other devices. The safer loopback binding succeeded; no network exposure was enabled.

### Phone checklist — Daily Log, iOS and Android

- [ ] Cold-launch offline with existing data and a fresh semester. Verify migration preservation, safe areas, empty/loading/error/retry states, and both themes.
- [ ] Use arrows and horizontal swipes across weekdays, month/year changes, Sunday/Monday, parity changes and timetable version boundaries. Try rapid/reversed swipes, interrupt a swipe, and return with Today. Confirm no duplicate or flashing classes and smooth scrolling on slower hardware.
- [ ] Open the month view; compare all marked, partly marked, holiday, no classes, pending, unconfigured and outside-semester days. Select a future day, return to Today, then reselect that same future date to exercise route synchronization.
- [ ] Mark Present, Absent and Neutral; tap each selected option again to clear. Check the row percentage and Subjects tab immediately, including a 2-unit lab, no counted history and target endpoints. Confirm past unmarked rows stay “Not marked” after relaunch.
- [ ] Mark all present over mixed outcomes; inspect the preview count/units, then Undo. Confirm every prior mark returns without duplication. Try stale Undo after a newer change and confirm newer data is preserved.
- [ ] Mark a mixed day as holiday; verify all affected rows remain visible as neutral and totals exclude them. Undo to restore marks. Remove the holiday and verify explicit neutral marks remain. Check overlapping/scoped holiday ranges and existing holiday-override extras if available.
- [ ] Add an extra class with subject/type, native times, venue and note; reject reversed/overlapping times; confirm copied weight, correct date/order, immediate appearance and Undo. Test an extra on a holiday and a date with no recurring timetable.
- [ ] Add/edit/remove a class note, save and relaunch. Clear attendance and verify the note survives. Test long text, keyboard reachability, Save/Cancel, dirty discard, swipe dismissal and Android Back.
- [ ] Confirm future, archived and outside-semester days cannot change attendance, holidays, notes or extras. Grey outside dates must explain the semester bounds.
- [ ] Change a timetable version after marking a class. Verify historical time/type/venue/weight, notes and totals remain stable, with one row per class lineage.
- [ ] Exercise a historical adjustment-dependent day if such fixture data exists: an unsafe clear/holiday/Undo must reject with no partial data change.
- [ ] Enable VoiceOver/TalkBack, 200% text, Reduce Motion, Reduce Transparency and app Reduce Effects. Check only the selected day is announced, 48pt controls, meaningful selected/disabled labels, calendar legend, readable Save, scrollable sheets and toast Undo.
- [ ] Verify one preference-aware haptic per committed change/Undo on physical hardware. Check foreground/midnight refresh, device timezone differing from semester timezone, persistence and release-build swipe performance with a large ledger.

## Session 5 — Subjects tab and subject detail shell

**Date:** 11 October 2026 (Asia/Kolkata)  
**Status:** Requested Subjects tab and detail shell implemented. Automated checks and native exports pass; iOS list/detail rendering inspected. Interactive simulator checks, Android visual QA, and physical-device acceptance remain open.  
**Authorization:** Read AGENTS.md, its referenced RTK instructions, and all six docs/*.md; presented the plan and waited for the user's explicit “go”.

### What was built

- Read both requested skills, `building-native-ui` (found in the Expo plugin's temporary skill directory) and `gpt-taste`, plus current Expo overview/native UI/UI/router/animation guidance. Checked SDK 57 documentation and installed types before using native APIs. Applied native conventions and DESIGN tokens over web-specific layout/motion prescriptions.
- **Subjects:** virtualized, searchable active-subject list; compact overall percentage banner; “Safe in X of Y subjects”; native Add/Manage header actions. Overall is the ratio of all semester attended/held units, including archived subject history. Safe counts active subjects with counted history meeting their own exact targets, including amber subjects at/near target; subjects without counted history remain in Y and do not count as safe.
- **Cards:** shared solid GlassCard surfaces follow DESIGN's prohibition on per-row blur. Name, code, identity-color dot, animated ProgressRing with canonical one-decimal percentage, attended/missed/total units, inherited/override target, next class, and smart needed/skip recommendations. Status accents and rings use the existing exact rule: below target red, target through three percentage points above amber, higher green, undefined neutral. Weighted recommendations explicitly say attendance units; empty history, 0% targets, and unreachable exact 100% have honest copy. Rings retain Reduce Motion support.
- **Adjustments:** attended plus/minus append `(±1, ±1)` records; missed plus/minus append `(0, ±1)` records. Each record includes a reason; source class marks stay unchanged. Scoped SQLite transactions validate the subject/semester, displayed totals/revision, and every chronological ledger prefix. Decrement controls disable at zero and commands reject invalid totals independently. Same-day timestamps order rapid adjustments deterministically. Adjustments use semester-local today, or semester end for completed terms; future and archived terms/subjects are read-only. Accepted changes provide preference-aware haptics and Undo. Undo removes only its inserted adjustment, preserves other subjects, and rejects changed subject history or repeated Undo.
- **Sort/actions:** native sort menu for name, percentage ascending, and next class; typed `subjectSort` setting persists with guarded Undo. Undefined percentages and missing next classes sort last. Next classes resolve actual version/parity/holiday/extra occurrences through semester end. Native iOS Link menus expose edit/change color/archive; Android long press and visible Subject actions open a native sheet. Color changes and confirmed archive have haptics and guarded Undo; archive retains attendance/timetable references. Restore remains available in Manage subjects. Identity colors do not replace attendance status accents.
- **Countdown:** indexed, semester-scoped query reads the existing deadlines table for incomplete due instants from now through seven days inclusive. The nearest deadline/exam becomes a card chip and a detail summary, with today/tomorrow/day labels calculated in semester timezone. No sample deadlines or deadline editor were added.
- **Detail:** thin `/subjects/[subjectId]` route with native back/title; large ring header, stats, adjustment controls, target message, teacher, and weekly slot metadata for the applicable timetable version. Files, Topics, Notes, Deadlines, Marks, Links, History, and Timer use a native section picker with clear future-feature states. Existing class notes remain in Daily Log. Archived subject deep links remain readable; unavailable/cross-semester IDs show recovery UI.
- **Live data:** both list and detail subscribe to the shared Daily Log/timetable invalidation used after commits and Undo. Clock/foreground refresh updates time-sensitive data. Schedule metadata queries skip attendance/note history; counts come from the same SQL aggregation as Daily Log. Loading, error/retry, no-semester, empty-list, no-results, and save-error states are included.

### Files touched

- New feature files: `src/features/subjects/{hooks,subjects-screen,subject-card,subject-actions,subject-detail-screen}.ts/tsx`.
- Routing: `src/app/(tabs)/(subjects)/index.tsx`, `src/app/subjects/[subjectId].tsx`, and root stack registration in `src/app/_layout.tsx`. Removed the superseded minimal `src/features/daily-log/subjects-screen.tsx`.
- Domain/persistence: `src/lib/subjects.ts`, `src/db/repositories/subject-attendance.ts`, optional history suppression in `src/db/repositories/daily-log.ts`, and the `subjectSort` validator in `src/db/validation.ts`.
- Shared ring: `src/ui/progress-ring.tsx` now accepts optional status color and canonical display label without changing existing callers' defaults.
- Verification: `src/lib/__tests__/subjects.test.ts`, additions to `src/db/__tests__/repositories.test.ts`, and subject-model coverage inclusion in `jest.config.js`.
- Documentation: this append-only progress entry. No package, native-project, database-schema, or migration change was needed.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero warnings/errors |
| `rtk npx jest --runInBand --coverage` | Passed: **161 tests**, eight suites; 13 new tests |
| Attendance module coverage | **100% statements, branches, functions, and lines**, enforced thresholds retained |
| New subject model coverage | 96.96% statements, 85.54% branches, 95.45% functions, 98.21% lines |
| Domain regression | Weighted aggregate/archive inclusion, exact safe count, no-data/0%/100% recommendations, weighted units, stable sorts, missing values, next-class start/version/parity/holiday/extra/bounds, nearest deadline/completion/seven-day boundary/timezone midnight |
| SQLite regression | All four append-only adjustments, same-millisecond ordering, source preservation, zero/stale/archive/future/cross-semester rejection, completed-term dates, scoped/repeated/stale Undo, Daily Log refresh and unsafe-prefix rollback, persisted/validated sort, reversible color/archive and retained totals, deadline query isolation |
| iOS/Android production export | Combined Hermes export passed with React Compiler: `/private/tmp/attendance-subjects-native-final` |
| iPhone 17 Pro / iOS 26.5 Expo Go rendering | Inspected simulator captures of final native Subjects header, **80.6% overall · Safe in 5 of 6**, first card with status ring and stats, and Mathematics detail with **90.9% · 10 attended / 1 missed / 11 total**, target/skip message and both adjustment rows |
| Formatting/whitespace | Changed feature files formatted with Prettier; `rtk git diff --check` passed |

### Known limits and remaining validation

- All eight requested detail sections are shells. Files/topics/subject notes/deadline/marks/link/history/timer editors and workflows remain future work, matching this session's requested scope.
- Expo Go initially displayed a runtime error about `ExpoAsset`; restarting the existing app cleared it and both screens rendered. Dependency inspection showed the SDK 57 asset/module versions; no dependency change was made to address a transient stale runtime.
- Computer-use interaction was unavailable because the Mac was locked. Simulator CLI launch and screenshots allowed static rendering checks. Long press, card-tap navigation, native sort/section menus, actions/color/archive sheets, editor handoff, UI-level adjustment/Undo, large text, screen-reader traversal, and haptic timing were not exercised. Database mutations and rollback were verified in the integration suite. No simulator test data was changed by this session.
- Android bundling passed; Android visual/interaction QA remains open. Release-build performance and physical haptics require devices. The prior web SQLite/WASM limitation remains outside this native session.
- Metro remains on loopback port 8085. No development build, store submission, deployment, or external service work was performed.

### Phone checklist — Subjects, iOS and Android

- [ ] Cold-launch offline with existing data and a fresh semester. Check native tabs/header/back, loading/error/retry/empty states, Add/Manage actions, and persisted data after relaunch.
- [ ] Compare overall attendance with summed units across subjects, including archived history. Verify Safe X/Y against each active subject target; no-history subjects stay neutral. Check exact target, target +3 percentage points, below target, and target overrides.
- [ ] Inspect every card's name/code, ring, attended/missed/total, target, and needed/skip message. Test long names, 0%/100% targets, weighted labs, empty history, light/dark, and 200% text without clipped controls.
- [ ] Tap attended and missed plus/minus independently, including rapid repeated taps. Confirm one adjustment per accepted tap, one haptic, correct totals/ring/banner, persistence, and disabled decrement at zero. Undo each change; try stale Undo after a newer same-subject change and confirm newer data is preserved.
- [ ] Mark/clear Present, Absent, and Neutral in Daily Log, then return to Subjects/detail. Verify live totals and recommendations after commit/Undo, including a weighted class and a history that depends on an adjustment.
- [ ] Select every sort option, relaunch, and confirm it persists. Check percentage ties/no data and next-class ties/no schedule, holidays, parity, extras and future timetable versions. Test sort Undo and search by name/code/no results.
- [ ] Long-press a card and use its visible Subject actions alternative. Edit fields, change each color, archive, Undo, and restore from Manage. Confirm identity color changes leave status accent intact and archive retains overall history. Verify native sheet-to-editor handoff and Android Back.
- [ ] Open a subject from its card. Check the large ring, stats, teacher/missing-teacher state, weekly day/time/type/parity/venue/weight and each of the eight section placeholders. Test native back, unavailable ID, archived subject and semester isolation.
- [ ] Once deadlines exist, check nearest exam/assignment at now, tomorrow, exactly seven days, just beyond seven days, completed and overdue states. Verify timezone/midnight/foreground refresh and the absence of invented chips on an empty deadlines table.
- [ ] Enable VoiceOver/TalkBack, Reduce Motion, Reduce Transparency and app Reduce Effects. Verify clear status/adjustment labels, 48pt targets, menu alternatives, ring labels, opaque surfaces, toast Undo focus, and physical haptics on/off. Confirm smooth updates with a large ledger in a release build.


## Session 6 — External AI timetable import and first-launch onboarding

**Date:** 12 October 2026 (Asia/Kolkata)  
**Status:** Implemented. Lint, typecheck, all tests and native exports pass; iPhone simulator import/welcome layouts inspected. Interactive device acceptance remains open.  
**Authorization:** Read AGENTS.md, RTK instructions, all six existing docs/*.md, the requested taste skill and relevant Expo skills; presented a plan and waited for the user's explicit “go”.

### What was built

- **Contract:** `IMPORT_FORMAT.md` was absent. Defined a strict version-1 external-AI subject/slot contract and the canonical prompt. The bundled Copy prompt text is tested byte-for-byte against the document. This compact readable import format is separate from Session 3's linked/versioned timetable export; export re-import is not claimed.
- **Skills/API references:** `building-native-ui` was unavailable after searching installed skills and temporary directories. Used the documented `expo:expo-native-ui` substitute, Expo overview/UI/router guidance, and `gpt-taste` visual intent. Native conventions, existing tokens and system typography take precedence over web-only GSAP/hero prescriptions. Checked installed Expo SDK 57 and its versioned Router, Clipboard and Linking documentation. Installed SDK-compatible `expo-clipboard` through Expo CLI; no custom native build is required for this bundled module.
- **Import instructions:** Timetable and onboarding now open a real Import with AI screen: four step cards, exact prompt copying, ChatGPT/Gemini HTTPS links using Linking, multiline paste box, explicit clipboard-paste action, inline errors and loading states. HTTPS links can open a provider's associated app or website according to device configuration. No AI runs in this app; it makes no provider calls or uploads. Provider work happens entirely in the external service the student opens.
- **Parser:** pure code under `src/features/timetable/import/` extracts one JSON value from fences/surrounding prose while respecting quoted braces/escapes, validates strict Zod objects, rejects unknown keys and unsupported versions, and normalizes times, full/abbreviated days, Unicode/case/spacing subject variants. Duplicate subject metadata merges only when compatible. Errors identify the subject/slot and exact problem, including `Slot 4: end time before start`. Empty, truncated, malformed, oversized, ambiguous multi-object and invalid-reference input rejects visibly. Limits are documented.
- **Preview:** virtualized classes grouped Monday–Sunday; new/existing subject summaries; Replace timetable/Merge; From today/Whole semester scope; effective date and future-version replacement explanation; exact duplicate summaries; textual overlap flags. Adjacency and odd/even alternatives are allowed. Conflicts include recurring classes and retained extra classes over the affected range. Archived or ambiguous existing subject/type matches reject rather than silently creating competing names. Return to the pasted JSON to correct errors; unresolved overlaps block Save.
- **Persistence/history:** imported subjects, class types, timetable version and onboarding completion-step update share one validated transaction. Refactored existing timetable/semester commands to expose transaction-aware helpers, preserving their public APIs. Matching subjects retain saved metadata; unchanged classes reuse stable lineage; attendance remains frozen. Merge reuses existing subjects and deduplicates exact classes. Every accepted save creates a version. Stale previews reject before writes. Haptics/Undo use existing adapters; Undo rolls back atomically and preserves newer academic data or linked content. Timetable fingerprints now also include extra classes.
- **Onboarding:** welcome → semester name/dates/timezone → target → Import with AI or the existing manual timetable builder → done. Manual setup includes Finish setup and access to existing subject/class editors. Drafts persist; imported setup resumes at done, and retries reuse the same semester. Skip/Done permanently store `onboardingVersion=1`; existing installations with semesters and no onboarding draft bypass automatic setup. Invalid dates/timezones/targets cannot leave a partial semester. Bounded draft-only writes avoid scanning the attendance ledger during typing. Pasted import drafts persist with a short debounce and are saved immediately before preview.
- **Native layout:** reused solid cards, native headers/pickers, system text, accessible buttons and existing reduced-effects feedback; enabled automatic keyboard insets for shared scrollable forms. Added thin routes only under `src/app/`. No schema migration or hand-authored native project was needed.

### Files touched

- New contract: `docs/IMPORT_FORMAT.md`; precedence/reconciliation notes in ARCHITECTURE, DESIGN, ROADMAP and TIMETABLE_EXPORT; this append-only entry.
- Import: `src/features/timetable/import/{parser,prompt,preview,scope,draft-store,import-screen,preview-screen}.ts/tsx` and parser tests.
- Setup: `src/features/onboarding/{model,first-launch,onboarding-screen,manual-screen}.ts/tsx` and model tests.
- Database: new `src/db/repositories/{timetable-import,onboarding}.ts`, transaction-aware helpers and extra-class fingerprinting in timetable-commands, typed draft settings in validation, and SQLite integration regressions.
- Routes: root stack registrations, `onboarding.tsx`, `onboarding-manual.tsx`, `timetable-import.tsx`, `timetable-import-preview.tsx`; Timetable's former placeholder now navigates to import and supports manual setup context.
- Shared/tooling: keyboard insets in `src/features/shell/screen.tsx`, export test fixture's extra-class field, Jest coverage inventory, package.json and package-lock.json for expo-clipboard. Preserved prior working-tree changes.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero warnings/errors |
| `rtk npx jest --runInBand --coverage` | Passed: **216 tests**, ten suites (55 additional tests since Session 5) |
| Parser coverage | **100% statements/functions/lines, 98.86% branches**; exact prompt/document equality included |
| Attendance coverage | **100% statements, branches, functions and lines**, enforced thresholds retained |
| Import/setup database regressions | Atomic subject/type/version creation and Undo, frozen attendance/lineage, exact duplicates, repeated merges, parity/adjacency, overlap rollback, extra-class conflicts, stale previews, archived/ambiguous references, linked-content Undo rollback, persisted setup/target/selection, one-semester retries, completion/skip and correct-draft import completion |
| iOS/Android production export | Passed with React Compiler and Hermes; latest native export at `/private/tmp/attendance-import-native-final` includes the manual setup route. The subsequent small surrounding-prose parser hardening is covered by the final lint/typecheck/216-test run |
| iPhone 17 Pro / iOS 26.5 Expo Go | Opened actual import and onboarding routes; inspected simulator screenshots showing four instruction cards, readable prompt-copy action, native headers, welcome content, Get started and Skip setup. No academic data was changed for these visual checks |
| Formatting/whitespace | Changed source formatted with Prettier; `rtk git diff --check` passed |

### Known limits

- Computer-use controls could not bind to the Simulator app, although simctl could open routes and capture screenshots. UI-level typing/scrolling, clipboard prompts, service-link handling, successful preview/save navigation, manual-building interactions, keyboard behavior and failure recovery were not exercised interactively. Their pure/SQLite logic is tested; do the phone checklist below before release.
- Android native bundling passes; Android layout/back/pickers, physical haptics, accessibility and release-build performance remain unverified. Existing web SQLite/WASM runtime limitations remain outside this native feature.
- Clipboard copying/pasting is user-triggered. Empty/denied/unavailable clipboard text gives recovery guidance; manual paste remains available. An external AI service needs its own access/network; local validation, preview, saving and attendance work offline.
- A paste draft is debounced by 500 ms and flushed before preview. An immediate process kill during that debounce may lose the last edit; onboarding drafts save on each edit using scoped settings writes.
- No backend, account, AI service, deployment, OTA update or store submission was created. The simulator is left on Import with AI; the existing loopback Metro server remains on port 8085.

### Phone checklist — Import and onboarding, iOS and Android

- [ ] On a fresh installation, follow welcome → semester dates/name → target → choice. Try invalid/reversed dates, blank names, invalid timezone, targets 0%, 75.25% and 100%, and an invalid target. Restart mid-setup and confirm the draft resumes without duplicate semesters.
- [ ] Skip at each pre-completion step, then cold-launch repeatedly. Setup must never appear automatically again. Complete each branch, tap Done and verify the same behavior. Existing configured installs must bypass first-launch setup.
- [ ] Choose Build manually, add a subject and class through the existing editors, return, use Finish setup and then Done. Confirm the target, active semester, subjects and classes survive relaunch. Test Cancel/discard and Android Back.
- [ ] Open Import with AI from both Timetable and onboarding. Inspect all four cards. Copy prompt, paste it externally and compare with IMPORT_FORMAT.md. Open both provider links with and without their apps installed; return to the same draft. Check offline/open-failure recovery.
- [ ] Paste JSON manually and from the clipboard. Test empty clipboard, denied permission and retry. Check the keyboard, scrolling and reachability of Preview. Relaunch after the draft-save debounce and confirm text is retained.
- [ ] Paste fenced JSON with surrounding prose. Check `9`, `9:00`, `09:00 AM`, noon/midnight, day abbreviations, case/spacing duplicates and end-only `24:00`. Try malformed/truncated JSON, unknown keys/subjects/days, invalid weights and reversed Slot 4; errors must be precise and input must remain editable.
- [ ] Inspect day sections including Sunday, new/existing subject counts, metadata/weights, and duplicate removal. Existing subject details must remain unchanged. Archived/ambiguous matches must offer a clear corrective error.
- [ ] Try recurring overlaps and retained-extra-class overlaps. Verify text flags and disabled Save. Adjacent classes and odd/even alternatives should pass. Return to JSON, correct a conflict, and preview again.
- [ ] Exercise Replace and Merge, From today and Whole semester, including an ended semester. Review the effective date and future-version warning. Save, check the new version, repeat Merge, and confirm no duplicate subjects or active classes.
- [ ] With recorded attendance and class notes, import a changed timetable. Historical time/type/weight, original marks, notes and totals must remain intact. Undo immediately; then attempt Undo after a newer edit/mark or linked content and verify no partial change or data loss.
- [ ] Finish an onboarding import and confirm return to the done step for the correct semester. Cancel import and retry without creating another semester. Check rapid repeated Save taps and native back/swipe while saving.
- [ ] Cold-launch offline; test light/dark, 200% text, long subject names, VoiceOver/TalkBack, Reduce Motion/Transparency, app Reduce Effects, touch targets and physical haptics. Verify preview scrolling with a large timetable on a slower device.


## Subject-detail sections and study timer — 12 October 2026

### Scope and preparation

Implemented the six sections from the approved plan after the user's **go**. Read AGENTS.md, RTK.md and all seven `docs/*.md` files. Used `gpt-taste` with the documented native adaptation; `building-native-ui` was not installed, so used the DESIGN.md-authorized `expo:expo-native-ui` substitute plus Expo overview/UI/animation guidance. Checked Expo SDK 57, React Native 0.86 and versioned API documentation before implementation. Existing Files and History scope was preserved; History remains the earlier placeholder. Preserved the pre-existing working tree. No dependencies, native project directories or external services were added.

### Implemented

- **Topics:** native collapsible units and virtualized topic rows; add/rename; separate unit/topic reorder modes with long-press drag handles and accessible Move up/down alternatives; Done checks with a short Reanimated pulse, reduced-motion fallback, haptics and Undo. Important stars and Important-only filtering. Topic-weighted completion bars per unit/subject and completion percentage/count on Subjects cards. Filtering never changes the denominator; empty syllabi say No topics.
- **Notes:** title/body, pinned-first ordering, title/body search, selection toolbar for bold/bullets/checklists, Preview, formatted reader, and tappable checklist items. The simple formatting subset is stored losslessly as text. Native editor forms provide validation, keyboard insets, dirty-draft discard guards and Save/Cancel; mutations use guarded Undo.
- **Deadlines & exams:** assignment, quiz, mid-sem, end-sem and other, with legacy exam support; title, native date/time input, Done/reopen, upcoming/overdue and Done lists, and countdown chips. Writes feed the Session 5 seven-day subject-card chip. Semester-timezone conversion rejects DST gaps and chooses the earlier repeated local time for a new selection; changing only a title retains the original exact instant.
- **Marks:** assessment name, earned/max marks and date; validated nonnegative marks, positive maxima and earned ≤ maximum. Running earned/max total and percentage use graded entries only; legacy ungraded entries remain visible. Existing weights remain stored.
- **Links:** title and validated HTTP/HTTPS URL; local YouTube/Drive/PDF icon detection and browser opening with failure recovery. Reject embedded credentials and unsafe schemes. No remote thumbnails or link-preview requests.
- **Study timer:** editable 25/5 defaults (focus 1–180, break 0–60 minutes), optional topic, Pause/Resume, explicit next phase, Finish & save and confirmed Discard. One global active timer with a link to its subject. Timestamp-based recovery survives backgrounding/relaunch without background JavaScript. Focus is capped at the current phase boundary, and the next phase starts on user action. Pauses/breaks add no focus. Backward clock changes require Pause then Resume. Completed-session history and Monday–Sunday focus minutes use the semester timezone and session start date; discarded/active sessions do not enter totals. Large-text/narrow-screen countdowns reflow into labeled minute/second groups.
- **Persistence:** subject-scoped queries and atomic commands validate scope, archive state, revisions, references and Undo. Referenced units/topics cannot be silently deleted. Content mutations avoid attendance-ledger validation scans. Migration 0003 adds Important and expands deadline categories while preserving IDs, metadata, note formatting, notification handles and study references. Corrected the existing notification-ID validator to treat OS handles as opaque strings.

### Files touched

- Subject features: `content-model.ts`, `content-hooks.ts`, `content-ui.tsx`, `drag-row.tsx`, `topics-section.tsx`, `content-section.tsx`, `content-editor-screen.tsx`, `note-screen.tsx`, `study-section.tsx`, subject detail/card/list integration, and content-model tests under `src/features/subjects/`.
- Persistence: new `src/db/repositories/{subject-content,study-timer}.ts`; syllabus query in subject-attendance; schema/validation; migration 0003, journal/snapshot/bundle and migration README; SQLite regression additions in `src/db/__tests__/repositories.test.ts`.
- Routing/domain: thin `/subject-content-editor` and `/subject-note` routes, root stack registrations, expanded exam countdown handling in `src/lib/subjects.ts`.
- Documentation/tooling: ARCHITECTURE schema and implementation notes, DESIGN behavior notes, this entry, and Jest coverage inventory for the new pure model.

### Verification

| Check | Result |
|---|---|
| `rtk npx tsc --noEmit` | Passed, zero errors |
| `rtk npx expo lint --no-cache` | Passed, zero errors; two pre-existing exhaustive-deps warnings in files/browser.tsx and files/preview-screen.tsx |
| `rtk npx jest --runInBand --coverage` | **253 tests / 11 suites passed**, 37 new tests since the previous 216-test baseline |
| Attendance coverage | **100% statements, branches, functions and lines**, enforced thresholds retained |
| Subject pure-model coverage | **97.7% statements, 94.52% branches, 92% functions, 98.71% lines** |
| Pure regressions | Empty/topic-weighted progress; countdown boundaries; URL schemes/domain spoofing/PDF detection; formatting/selection/checklist round trips; academic timezone/DST boundaries; background time caps, pauses, breaks, backward clocks and local weekly boundaries |
| SQLite regressions | Scoped CRUD, pinned ordering, card syllabus/deadlines, stale revisions, archived state, validated marks/URLs, sibling reorder/fingerprints, atomic Undo and later-edit protection, referenced content retention, one active timer, pause/resume/phase/finish/discard and Undo, invalid transitions/durations, populated upgrade/FK integrity and migration rerun |
| Native production export | iOS and Android Hermes export passed with React Compiler: `/private/tmp/attendance-subject-tools-native-final` |
| Formatting/whitespace | Changed source formatted with Prettier; `rtk git diff --check` passed |

### Known limits and remaining validation

- Simulator computer-use binding repeatedly failed with `noWindowsAvailable`/`timeoutReached` after opening Expo Go. **No subject-tool screen interaction or visual QA is claimed.** Automated pure/SQLite tests and native bundling pass; complete the phone checklist below before release. Android interaction, screen readers, physical haptics and release-build performance remain unverified.
- Drag commits on release and has no viewport-edge auto-scroll. Use Move up/down repeatedly for moves beyond the visible window; test drag stacking, cancellation and scroll handoff on both platforms.
- Note editing exposes the small text-formatting syntax; Preview and the reader render it. It is not a full WYSIWYG/HTML editor.
- Timer phases wait at zero for explicit continuation; there are no automatic repeated cycles or timer notifications. Weekly minutes include saved, completed focus only. Session time is attributed to its start date, including sessions spanning midnight/week boundaries.
- Deadline editing retains existing notification metadata but does not add notification scheduling. Link opening needs connectivity for remote content. Existing web SQLite/WASM runtime validation remains outside this native change.
- Loopback-only Metro remains available on port 8085 for local review. No academic simulator data was changed during this session's UI attempt.

### Phone checklist — Subject tools, iOS and Android

- [ ] Cold-launch an existing populated database and a fresh semester offline. Confirm Important defaults off; original notes, deadlines, notification metadata, marks and topic-linked study sessions survive. Open each subject and verify semester isolation and archived read-only behavior.
- [ ] Add two units and several topics; rename, collapse/expand, drag in each reorder mode and use Move up/down. Check release, cancellation, scroll handoff, persistence after relaunch, Undo, and stale Undo after a later edit. Drag must not alter other units' topic order.
- [ ] Tick/reopen topics and feel the haptic/check pulse. Star/unstar and enable Important only. Confirm unit/subject bars and Subjects-card percentages use the full syllabus, update after navigation and show No topics when empty. Try deleting referenced content and inspect the explanation.
- [ ] Create/edit notes with bold selections, multiple bullet/checklist lines and plain text. Preview, read, tick checklist items, pin/unpin and search titles/body. Test multiline selection, keyboard scrolling, long notes, Save/Cancel, dirty discard, Android Back and Undo after pin/edit/delete.
- [ ] Create all five deadline types; edit date/time, mark done/reopen and Undo. Check countdowns, overdue/due-now boundaries, seven-day Subjects-card chips, midnight and semester timezone differing from device time. Test DST gaps/repeated times where applicable and title-only edits of an existing deadline.
- [ ] Add zero/full/fractional marks; reject blank, negative, over-maximum and zero-max values. Confirm dates, running totals/percentages and Undo after edit/delete. Original ungraded or weighted records must remain intact.
- [ ] Add YouTube, Drive, PDF and ordinary web URLs; verify icons, browser return and persisted titles. Reject invalid/unsafe URLs; inspect offline/browser-open failure recovery and delete/Undo.
- [ ] Start 25/5, change durations, link a topic, pause/resume, complete focus/break and start the next phase. Background, lock, relaunch and cross a phase boundary; credit must cap correctly, pauses/breaks must not add focus. Open another subject to resume the same global timer.
- [ ] Finish/save, discard/cancel, Undo and attempt stale Undo after another action or a new timer. Verify session history and weekly completed-focus minutes across local midnight and Sunday/Monday. Test zero-minute breaks and backward clock recovery.
- [ ] On both platforms test light/dark, 200% text, narrow widths, long titles, VoiceOver/TalkBack, logical focus/expanded/checked/selected announcements, native picker/sheet behavior, 48-point controls, Reduce Motion/Transparency and app Reduce Effects. Check long-list scrolling and release-build drag/check/timer performance on a slower phone.


## Attendance history, what-if planner and semester management — 12 October 2026

### Scope and preparation

Implemented the approved plan after **go**, including the clarification that RESET clears every current-semester datum and restarts setup. Read AGENTS.md, RTK.md and all seven project Markdown documents before planning. Used `building-native-ui` from the installed Expo plugin skill and `gpt-taste`, adapting web-only layout/motion prescriptions to the existing native design as explained in the design plan. Checked Expo SDK 57 versioned UI, Router, filesystem, sharing, crypto and picker documentation. Preserved the pre-existing working tree. No dependency, migration, native project directory or external service was added.

### Implemented

- **Subject History:** month calendar heatmap with present, absent, neutral, holiday, mixed, pending and no-class states; textual symbols and accessible day descriptions supplement color. Tapping a day opens Daily Log with explicit semester, subject and date, including calendar/note navigation. Scoped views hide whole-day bulk actions. Archived and future dates stay read-only. The month’s records use a FlatList.
- **What-if:** native sliders in subject detail and Subjects overall for independent skip/attend-next-N scenarios, with accessible one-class adjustment buttons. Pure functions enumerate actual future sessions from timetable versions, semester parity, holiday unions and eligible extras, honor the local clock and inclusive end date, sum actual class weights and return the Nth date. Already-recorded classes are excluded from the UI horizon; unmarked past classes are not invented. Zero/insufficient capacity is explicit.
- **Attendance trend:** small subject cumulative percentage chart across semester dates, dashed target, true 0–100% scale and dated textual values. Frozen ledger adjustments remain authoritative; undefined denominators break the line rather than becoming fictional zeroes.
- **Semester settings:** name, inclusive start/end, global target, named single-day/range holidays and guarded Undo. Changing the start week with an existing timetable is rejected to preserve odd/even history. Holiday confirmation previews recorded-class impact, converts affected marks to neutral and preserves allowed holiday extras. Removing a holiday retains explicit neutral marks for review.
- **New semester:** dates/name then target; optionally copy active subjects and the currently effective weekly timetable/class types with fresh IDs. The prior semester archives only at final atomic commit. Attendance, study content, extras, holidays and future timetable versions stay in its history. Running/paused timers must be finished or discarded first. Undo refuses newer changes.
- **Reset:** complete-backup option or explicit decline, followed by exact RESET typing. Atomically clears all selected-semester rows, including subjects, timetable, attendance, study content, folders/files and timers; preserves other semesters, their active selection and app preferences. Retains a completion screen and restarts name/date/target setup. Explicit semester setup is exempt from first-launch redirection.
- **History and recovery:** archived terms display final weighted overall and subject percentages, including archived subjects; detail/day routes remain read-only and never switch the active semester. Generic writes cannot change archived semester snapshots. A versioned JSON backup includes all scoped rows and attachment bytes, verifies sizes/checksums and is saved durably before sharing. Recovery previews counts and adds a deleted semester as archived history; existing semester IDs are never replaced.
- **File safety:** lifecycle work runs through the attachment queue, settling imports/deferred deletes first. Durable reset/restore cleanup manifests survive interruption. Cleanup checks database references before deleting bytes, preserves rolled-back resets/committed restores and retries disk failures on relaunch. Recovery uses fresh canonical subject file paths.

### Files touched

- Domain: `src/lib/attendance/insights.ts`, `src/lib/subject-history.ts` and their attendance/Daily Log tests.
- Features: new `src/features/semesters/` screens, backup validation/export/recovery and cleanup modules/tests; subject insights/history and detail/list integration; scoped Daily Log hooks/screens/editors/calendar; Settings entry and first-launch route guard.
- Persistence: `semester-data.ts`, `semester-commands.ts`, `semester-restore.ts`, archived guard in `write.ts`, today-only planner records in `subject-attendance.ts`, bootstrap cleanup and repository integration tests.
- Routing/shared: thin semester/history/attendance-day routes, root Stack registrations, asynchronous shared save support and attachment queue lifecycle support/test. Updated ARCHITECTURE, DESIGN and this entry.

### Verification

| Check | Result |
|---|---|
| Typecheck | `rtk proxy npx tsc --noEmit` passed |
| Lint | `rtk proxy npx expo lint --no-cache` passed with zero errors; two existing exhaustive-deps warnings in files/browser.tsx and files/preview-screen.tsx |
| Full Jest/coverage | `rtk proxy npm test -- --runInBand --coverage`: **272 tests / 14 suites passed** |
| Attendance coverage | **100% statements, branches, functions and lines**, including the pure planner/trend functions |
| Calendar/planner regressions | Weighted sessions, independent scenarios, actual Nth dates, same-time ordering, effective version boundaries, parity, holidays/overrides/cancellation, timetable gaps, local minute boundary, inclusive semester bounds, capacity shortfall, zero denominator, invalid inputs, safe-integer overflow and cumulative corrections |
| Lifecycle/backup regressions | Copy with new IDs, untouched frozen records, archive write rejection, atomic rollback, stale Undo, scoped full reset, nested-folder/file restore, active timer handling, isolated validation rollback, wrong format/table/scope/path, incomplete/duplicate attachments, malformed padding and a 1 MiB payload |
| Interrupted-file regressions | Queue waits for import; deferred deletes settle before lifecycle changes; reset crash cleanup, rollback preservation, referenced restored bytes, retry after disk failure, repeated recovery and unsafe-manifest rejection |
| Native production export | iOS and Android Hermes exports passed with React Compiler; output `/private/tmp/attendance-semester-native-final` |
| Whitespace | `rtk git diff --check` passed |

### Known limits

- The Mac was locked when Device Hub UI inspection was attempted. **No visual/touch interaction QA is claimed for these screens.** No live academic data was reset or archived for testing. Android interaction, physical haptics, screen readers, large text and device performance need the checklist below.
- Backups support up to **50 MiB of attachment content**, 100,000 rows per table and 10,000 attachments. They are saved in the app document directory; keep an external copy using the share sheet, since uninstalling the app removes local backups. Missing/not-ready/damaged files block a complete backup with corrective guidance. JSON import is bounded at 80 MiB. Recovery requires this backup format/schema and adds read-only history, rather than merging/replacing a live semester.
- Active timers block backup/new-semester archival; reset can delete them after the explicit destructive confirmation. There is no notification scheduling/reconciliation in this feature.
- Native exports pass. Existing web SQLite/WASM runtime limitations remain outside this native scope. No deployment, OTA update or store submission was performed.

### Phone checklist — History, planner and semesters, iOS and Android

- [ ] Open Subject History with mixed weights, present/absent/neutral marks and holidays. Check every heatmap symbol, month/year/leap-day boundaries, pending/no-timetable/outside dates, and refresh after editing. Tap a day, edit only that subject’s rows, add a note, choose another date and return; verify the selected semester/subject never changes and whole-day bulk actions stay hidden.
- [ ] Move both sliders and use ±1 class in subject detail and overall. Compare N=0/1/multiple with hand-calculated weighted percentages and actual timetable dates. Check same-day premarked classes, odd/even weeks, future versions, holidays, cancelled/allowed extras, gaps, ended semesters and no remaining classes. Scenarios must remain independent and make no saved attendance changes.
- [ ] Check the trend after adding marks, neutral days and balance corrections. Compare the dated text values with the ledger, verify zero-denominator gaps and the target line, and inspect a single point and long semesters.
- [ ] Edit semester name/dates/target; test blank/reversed/out-of-history dates, start-week changes, 0%, 75.25% and 100%. Subject target overrides must stay intact. Add named single-day/range holidays, overlapping ranges and allowed extras; review recorded impact, Undo and removal behavior.
- [ ] Start a new semester with no copy, subjects only and subjects+timetable. Cancel on both setup steps, then save. Verify fresh IDs/empty attendance, correct copied parity/times/weights, retained overrides, archived old content and final percentages. Attempt with a running/paused timer. Test immediate Undo and refusal after later edits.
- [ ] On a disposable test semester, create a complete backup including nested-folder files. Keep an external copy. Cancel sharing and retry, test missing-file and size-limit guidance, then attempt wrong RESET text. Decline/cancel the no-backup warning. Finally type RESET and confirm every current-semester item is gone, other history/preferences survive and name/date/target setup restarts without duplicate semesters.
- [ ] Recover that backup into read-only history; compare all rows/final percentages and open/share recovered files. Reject a duplicate semester, corrupt JSON, unsupported version, missing attachment and wrong checksum. Interrupt reset/recovery around file work, relaunch and retry cleanup; referenced bytes must remain safe.
- [ ] Browse archived semesters and subject/day history without changing the active semester. All edit/mark/content actions must stay disabled or reject stale writes, including an old editor/Undo opened before archival.
- [ ] Check light/dark, 200%+ text, narrow phone widths, long names, VoiceOver/TalkBack slider values and day labels, button contrast, Reduce Motion/Transparency/Effects, keyboard/native sheets, Android Back, offline cold-launch and large-history scrolling on a slower phone.


## Simulator connection repair — 12 October 2026

The simulator reported “There was a problem running the requested project / Could not connect to the server.” No Expo server was listening. The restricted shell returned `EPERM` when binding localhost; after approved unrestricted startup, Node resolved localhost to IPv6 only, while Expo Go used IPv4. Restarted with `rtk proxy env EXPO_OFFLINE=1 NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --localhost --port 8087` outside the sandbox and reopened `exp://127.0.0.1:8087`.

Verified `/status` returns `packager-status:running`, iOS development bundling succeeds, and Device Hub displays the actual Subjects screen with demo attendance and both native what-if sliders. Left that server running for review. No application code or academic data changed. Typecheck passes; lint passes with the same two existing Files hook warnings. This verifies app launch and the visible overall screen; the detailed phone checklist above remains pending.

- [x] Reopen the simulator and confirm Subjects replaces the connection error.
- [ ] Continue the History/planner/semester phone checklist above.


## Settings — notifications, backup, export, appearance, privacy and About — 12 October 2026

### Preparation and authorization

Read AGENTS.md, its referenced RTK.md and all seven existing `docs/*.md` files. Read `building-native-ui` from the installed Expo plugin and the project `gpt-taste` skill, plus Expo overview/native UI/universal UI guidance. Presented a plan and waited for **go**. Native system typography, grouped controls, accessible targets and existing shared components took precedence over web-only landing-page/GSAP prescriptions. Checked the installed Expo major (57) and matching documentation before using native APIs. Preserved the pre-existing working tree and did not create native project directories, submit a build, deploy or send feedback.

### Implemented

- **Settings hub:** native FieldGroup sections and navigation rows for Semester, Notifications, Appearance, Privacy, Backup & restore, Export attendance and About. Detail screens use existing shared themes/cards, native switches/pickers, error presentation and guarded preference Undo.
- **Local notifications:** permission request/system-settings/test controls; editable 0–1440-minute class lead and subject muting; chosen-time attendance nudge skipping holidays, no-class and fully marked days; exact weighted low-target comparison with persisted crossing deduplication; incomplete-deadline reminders 24 hours and 1 hour before. All scheduling is local; no push token or remote service is requested.
- **Rolling schedule:** selected active semester, semester timezone, effective versions/parity, holidays/allowed extras/cancellations, saved marks and archived subjects are honored. A seven-calendar-day plan chooses the nearest reminders up to 64 minus unrelated OS requests. It displays overflow and errors, cancels stale schedules and keeps matching signatures. Refreshes on open/foreground, timetable/attendance/content/preferences changes and long foreground sessions. Android exact-alarm permission is configured; its OS permission remains user-controlled.
- **Present/Absent actions:** registered notification category opens the app, waits for app lock, validates subject/key/time/type/weight and uses the existing guarded Daily Log mark with haptic/Undo. Marked, changed, holiday, future or archived rows cannot be overwritten. Rejected stale marks open Daily Log for review. Responses check a shared background timestamp to prevent authentication races.
- **App backup:** strict version-1/schema-4 JSON and optional ZIP across every semester, academic table and portable preference. JSON omits file bytes; ZIP includes available bytes with size/SHA-256 verification. Zod/container bounds, safe names, duplicate/extra/missing inventory rejection and a rolled-back SQLite validation precede the preview. Final confirmation, unchanged fingerprint, verified local safety copy, fresh canonical paths, cleanup journal and atomic replacement protect the old workspace. Active timer snapshots restore paused. Lock/permissions/runtime state are not imported.
- **Weekly backups:** enabled by default, optionally include files, keep the latest four successful local copies, display failure/last success and provide share/preview actions. OS background work requests a seven-day minimum when supported; app-open/foreground checks catch up overdue work. Success is recorded only after durable readback verification. The previous-workspace safety copy is separately previewable.
- **Attendance exports:** per-semester CSV includes every saved occurrence/adjustment with quoting, UTF-8 BOM, formula-safe text, signed numeric balances and timezone. An escaped, printable A4 `expo-print` report includes weighted overall/subject attendance, targets, archived history and separate monthly physical session counts. Pending classes are never invented as absent. Both use the system share sheet.
- **Appearance:** persisted light/dark/system, Indigo/Blue/Teal/Rose/Violet accent pairs, reduce transparency, existing reduce effects and haptics. Preferences load before workspace presentation and propagate across shared components/native hosts. System accessibility preferences remain respected.
- **Privacy:** optional enrolled Face ID/Touch ID/fingerprint lock with device fallback where offered, cold-launch authentication and a lock after at least one minute in the background. A full-screen cover hides underlying navigation, sheets and toasts; cancellation remains locked. Enable/disable/Undo authenticate. App lock does not encrypt SQLite or backup files.
- **About:** configured app version/build, a user-reviewed mailto feedback action, local-data privacy note and searchable offline license notices for installed production packages. `npm run settings:licenses` regenerates the bundled notices. No owner feedback address was supplied; About can configure it, and the mail action stays disabled until a valid address is saved.

### Files and dependencies

- Settings implementation: `src/features/settings/` model, preference adapter, native controls/hub/detail screens, notification planner/service/runtime, backup format/archive/service, export/report model, background task, app-lock gate and license inventory.
- Persistence/integration: `src/db/repositories/app-backup.ts`, typed settings registry, provider appearance initialization, shared theme provider, root authentication/runtime integration and eight thin Settings routes.
- SDK-compatible packages installed with `expo install`: `expo-notifications`, `expo-print`, `expo-local-authentication`, `expo-background-task`, `expo-task-manager`, `fflate`. Native behavior is configured through `app.json` plugins/permissions only.
- Documentation: `APP_BACKUP.md` specifies the versioned format and restore/retention contracts; ARCHITECTURE and DESIGN describe the final native implementation.

### Verification

| Check | Result |
|---|---|
| Typecheck | `rtk npx tsc --noEmit` passed |
| Lint | `rtk npx expo lint --no-cache` passed: zero errors, the same two existing Files exhaustive-deps warnings |
| Full tests/coverage | `rtk npx jest --runInBand --coverage`: **303 tests / 18 suites passed** |
| Attendance engine coverage | **100% statements, branches, functions and lines** retained |
| New Settings tests | **27 tests** across pure planner/lock/CSV/report/container models, notification reconciliation and real temporary-file backup lifecycle; plus **4 new SQLite integration tests** |
| Reminder regressions | Semester timezone/lead, mute, global/scoped holiday, fully marked/no-class/cancelled days, deadline offsets/past/completed, 64-capacity overflow, unrelated requests, next-window class lead, archived terms/subjects, DST gap, exact target equality, deduplication/recovery, permission denial, idempotence, changed schedules, native failure/retry, foreground lock race and stale class snapshot |
| Backup/report regressions | Strict format/settings/columns/IDs, unsafe/extra/duplicate ZIP entries, missing manifest/inventory, size bounds, checksum corruption, whole-dataset rollback, stale preview, nested folders, preserved lock, missing attachment metadata, paused timer snapshot, ZIP byte round-trip, safety copy before commit, rollback/disk-full preservation, weekly serialization and four-copy retention; CSV quoting/formulas/signed values and escaped weighted PDF HTML |
| Dependency diagnostics | `rtk npx expo-doctor`: **21/21 checks passed** |
| Native configuration | `expo config --type introspect` confirms Face ID usage text, background processing modes/task identifier and Android exact-alarm permission without writing native directories |
| Native production bundle | Both iOS and Android Hermes exports passed with React Compiler; `/private/tmp/attendance-settings-final` |
| Formatting/whitespace | Prettier completed for touched implementation files; `rtk git diff --check` passed |

### Known limits and build requirements

- **Local notifications and Present/Absent categories do not require a development build in SDK 57 Expo Go.** Actions intentionally foreground the app before a save. Face ID testing **does require a development build**. Use a physical development/production build to verify background work; TaskManager is unavailable in Android Expo Go and does not support iOS Expo Go background execution. The foreground backup catch-up remains available.
- Weekly execution is best effort, not an exact weekly alarm; force-quit, OS battery rules and device scheduling can defer it. The reminder window does not extend indefinitely while the app remains closed: reopen regularly. iOS may hold only 64 future requests, and Android may delay delivery without Alarms & reminders permission. These limits are shown in the relevant Settings flows.
- JSON is bounded at 20 MiB, ZIP/expanded content at 71 MiB, available files at 50 MiB, academic rows at 100,000 total and attachments at 10,000. Exports are unencrypted. Local weekly/manual/safety copies are deleted by uninstalling; save an external copy through the share sheet. Corrupt ready files or storage failure block a complete safety backup/restore before academic changes.
- Simulator UI inspection could read the existing app, but coordinate actions returned `noWindowsAvailable` and subsequent automatic approval review repeatedly failed with **429 Too Many Requests**. No Settings visual/touch, native PDF/share-sheet delivery, biometric prompt, notification delivery or actual OS background execution is claimed. Automated review did not determine the actions unsafe; the review could not complete. No real academic data was replaced for testing.
- The owner still needs to configure the desired feedback recipient. Existing web SQLite/WASM limitations remain outside this native implementation.

### Phone checklist — Settings, iOS and Android

- [ ] Cold-launch fresh and populated offline workspaces. Open every Settings row and return; check grouped scrolling, safe areas, back gestures/Android Back, long names, narrow widths, 200%+ text and VoiceOver/TalkBack focus. Verify developer tools are absent from a production build.
- [ ] Allow, deny and later revoke notifications. Send a test and inspect Settings permission/error status. Schedule more than 64 candidates, confirm nearest-first overflow and preserved unrelated requests, change lead/mutes/timetable, relaunch and check no duplicates or stale pending requests. On Android test both allowed and denied Alarms & reminders.
- [ ] Receive and expand a class reminder; try Present and Absent, inspect the scoped Daily Log mark and Undo. Repeat a delivered action after changing time/type/weight, marking, cancelling, adding a holiday or archiving: it must open review without overwriting data. Test a reminder that arrives before tomorrow's class with a long lead.
- [ ] Check the chosen daily nudge on an unmarked day, then fully mark the day before the trigger and confirm cancellation. Check global/scoped holidays, no-class days, permitted holiday extras, semester boundaries and a semester timezone different from the device. Leave the app open across midnight, then closed beyond the window and reopen.
- [ ] Cross a subject target, verify one low-attendance alert, equality/no-held behavior, recovery and another drop; change a target and archive a subject. Create/edit/complete/reopen/delete deadlines and confirm the one-day/one-hour requests update, past triggers are omitted and stale reminders do not mutate records. Exercise DST gaps/repeated times where applicable.
- [ ] Export JSON and ZIP containing several semesters, nested folders and files. Save through Files/iCloud Drive/Google Drive, cancel sharing, retry and verify the external copy opens. Preview without changing data, cancel, then restore **disposable test data** after final confirmation. Compare all counts/weights/content, open files, delete/Undo a restored file, verify timers are paused and the current lock remains intact. Preview/restore the previous-workspace safety copy.
- [ ] Reject malformed/unsupported JSON, duplicate or unsafe ZIP entries, missing bytes, wrong hash, oversized content and a stale preview. Interrupt file writing/restore, relaunch and check reference-aware cleanup. Simulate insufficient storage on disposable data: original rows/bytes and the verified safety copy must survive.
- [ ] Verify one overdue weekly copy on opening, no second same-week copy, last-four retention, include-files choice and visible errors without advancing success. Exercise the native background worker on a physical development build, force-quit and reopen to confirm catch-up. Keep an external copy before uninstalling.
- [ ] Export both CSV and PDF from active and archived semesters. Check Unicode, commas/quotes/newlines, formula-like text, numeric negative adjustments, neutral/pending classes and timezone. Compare weighted totals by hand; inspect A4 pagination, repeated table headers, long names and print/share output on both platforms.
- [ ] Change system/light/dark and every accent, relaunch and navigate all tabs. Check selected indicators, text/button contrast, status colors, Reduce Transparency/Effects, OS Reduce Motion/Transparency, haptics and preference Undo/stale Undo.
- [ ] In a development build, enable biometrics, cancel and retry, cold-launch, background for under and over one minute, and test device fallback where offered. Check the app-switcher cover with a sheet/toast open, no Back/swipe bypass and no data flash. Open a Present/Absent action while locked: no mark or navigation should execute before successful authentication. Disabling or Undoing lock must authenticate.
- [ ] Verify app version/build, configure the correct feedback recipient, open the draft without sending automatically, and check no academic data is attached. Search/open/select license text offline and review the privacy note and export explanation.


## Mockup revamp — all four tabs — 12 October 2026

Rebuilt the presentation layer to match the 15 Claude Design mockups in `design/refs/mockups/` (map in `design/refs/README.md`). Repositories, attendance math, notifications, backup and import validation are unchanged except where noted below.

### Implemented

- **Shared kit** (`src/ui/kit.tsx`): cards, status pills, filter/choice chips, stat grids, round icon buttons, action buttons, grouped list/switch rows, radio cards, checkboxes, banners, target ring and progress line. The background is now flat (the gradient was removed). Root stack hides the header hairline.
- **Subjects:** overall card (percentage, target pill, bar with target tick, attended/missed/total, “Today · N classes” link), All/At risk/On the line/Safe chips with counts, compact subject cards with target-tick rings, status pill, 4-stat row and ± steppers.
- **Subject detail:** Topics / Files / Study (old Notes, Deadlines, Marks, Links and Timer deep links map to Study; History opens as “Attendance log”). Topics has unit checklist cards, Important/Pending filters and inline “Add a topic”; reorder moved into the unit long-press menu. Files has search, folder grid, recent list with type badges and an add sheet with destination chips. Study has countdown deadlines, bunk planner, focus timer presets, notes, links, marks and when & where.
- **Daily Log:** day card with previous/next *class day*, progress summary, Mark all present (confirms only when it would overwrite marks) and Mark holiday with an Undo banner, Present/Absent/Neutral segments, per-class subject percentage with ▲/▼ change, note button, Extra class. The horizontal day pager was removed. Jump-to-date sheet has a marked month grid, legend, selected-day summary and month totals.
- **Timetable:** import banner, Mon–Sat(+Sun) chips with counts, day agenda with type rails/tags, alternating-week tags and free gaps, Manage list (subjects, class types, semester dates, JSON export, versions, semester switcher). The week grid was removed. Slot editor uses grouped rows, compact native time pickers, a live overlap check and inline “From today / Whole semester” instead of an alert.
- **Import:** four-step guide (ChatGPT/Gemini/Claude links, prompt preview, copy, Paste reply). Review screen holds the editable reply, parses live, offers Keep A / Keep B for overlapping imported classes (with Undo), subject Matches/New tags, week counts, Replace/Merge and scope.
- **Settings:** local data/backup status card, Semester / Notifications / Your data / Appearance (inline theme + haptics) / About groups and Reset semester. Notifications, Attendance history (semester chips, weekly cumulative chart vs. target, per-subject two-week trend, recent days) and Reset semester follow their mockups.

### Behaviour changes and additions

- `clearSemesterAttendance` (new, with Undo that refuses to overwrite newer marks) backs “Clear attendance only”. Reset now offers Clear attendance only / Start a new semester / Delete this semester; all require a backup or explicit decline plus typed RESET.
- Import parser retries with straight quotes when a reply only fails because iOS smart punctuation produced curly quotes; `withoutSlot` drops one misread class from a reply.
- `nextClasses` now carries the class room; `neutralCount` reports neutral marks for the detail card.
- Tests: **306 passed** (3 new: clear attendance, curly quotes, slot removal). Typecheck clean; lint has the one pre-existing Files preview warning.

### Mockup items intentionally not built

The mockups' account card, iCloud sync, Log out and Delete account, “Week starts on Monday”, “Ask after class” notifications, low-attendance margin chips and weekly report have no backing feature in this local-only app; inventing them would mislead. The Settings card shows on-device storage and backup status instead. Status amber stays at target + 3 points per DESIGN.md (the mockups used + 2). Native large titles and native segmented controls/pickers were kept where the mockups drew custom ones.

### Verification

Checked on the iPhone 17 Pro simulator (Expo Go, light and dark): Subjects, subject Topics/Files/Study and add sheet, Daily Log and calendar sheet, Timetable, slot editor, import guide and review (including overlap resolution), Settings, Notifications, Attendance history and Reset. Not checked: Android, physical devices, VoiceOver, large Dynamic Type, real clipboard paste on device (the simulator clipboard read empty), and the Files pickers.

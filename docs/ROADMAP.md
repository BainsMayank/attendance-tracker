# Attendance Tracker implementation roadmap

Session 1 planning draft · 11 October 2026

**Session 6 scope update:** the user's approved flow is external ChatGPT/Gemini → copy JSON → local validation/preview → versioned save, plus skippable first-launch onboarding. No AI runs in the app. The provider/backend/upload proposals throughout this early roadmap are superseded by `IMPORT_FORMAT.md` and Session 6 in `PROGRESS.md`; they are not remaining implementation tasks.

## Scope and sequencing

**Session 2 implementation note:** SPEC is now present and the foundation is implemented under `src/app/` with **Subjects, Daily Log, Timetable, Settings**. See `PROGRESS.md` for checks and remaining device QA. All later sessions remain unapproved future scope; AI services, paid APIs, analytics, and ads conflict with SPEC and must not be implemented from this provisional inventory.

This plan assigns every feature named in the user's request and every proposed screen in `DESIGN.md` to Sessions 2–13. `docs/SPEC.md` is absent; exhaustive SPEC traceability is **not yet verified**. Session 2 begins by reconciling this inventory with the actual SPEC, preserving the requested session order. Until then, screen labels, study details, AI sources, and account scope are proposed defaults.

Session 1 produces documentation only. Sessions are work packages, not promises that every package fits a single conversation. Each implementation session ends with lint, typecheck, relevant behavioral verification, and a factual `PROGRESS.md` entry. Later sessions may refine earlier components, but primary ownership is explicit below. Optional Accounts can be skipped without blocking release.

## Feature-to-session traceability

| ID | Feature / acceptance scope | Primary session | Follow-through |
|---|---|---|---|
| F01 | Expo SDK 57 foundation; `src/app/` routes; four NativeTabs; native Stack, links and form sheets | 2 | 12 accessibility; 13 deep-link/back QA |
| F02 | Theme tokens, system/light/dark, native controls, safe-area and shared loading/error/empty patterns | 2 | 10 appearance preferences; 12 full polish |
| F03 | SQLite/Drizzle schema, migrations, repositories, foreign keys, transactions, revisions | 2 | Each feature session; 10 restore; 13 upgrade fixtures |
| F04 | Semester creation, active selection, bounds/timezone/week anchor | 2 minimal | 6 onboarding; 9 archive/history; 10 settings |
| F05 | Semester default target and subject override, endpoints 0% and 100% | 2 domain | 4 stats; 5 editor; 9 aggregate views |
| F06 | Timetable versions/effective dates and frozen attendance history | 3 | 4 snapshot integration; 9 projections |
| F07 | Slot editor: subject, class type, weekday/time/room/positive countsAs | 3 | 6 reviewed AI mapping |
| F08 | Odd/even/all recurrence and stable semester week parity | 3 | 9 future projections; 13 boundary QA |
| F09 | Extra classes, cancellations, holiday override, duplicate/conflict handling | 3 | 4 logging and history |
| F10 | Holidays: inclusive ranges, semester/subject scope, union, marked-record impact preview | 3 | 4 explicit neutral conversion; 10 reminder reconciliation |
| F11 | Today/day calendar, daily log, present/absent/neutral/unmarked, batch marking, reset and undo | 4 | 12 interaction polish; 13 persistence QA |
| F12 | Manual signed attendance adjustments, reasons, before/after, chronological prefix validation | 4 | 5 history UI; 10 restore validation |
| F13 | Percentage, weighted counts, classes needed, can skip, exact target arithmetic, no-data states | 4 | 5 subject views; 9 aggregate/forecasts |
| F14 | Per-day pending/mixed/neutral/holiday/noClasses/outside/unconfigured statuses | 4 | 9 insight calendar |
| F15 | Subject CRUD/archive, searchable list, detail segments and target editing | 5 | 9 historical semester access |
| F16 | Units/topics ordering and syllabus completion | 5 | 8 study-topic linking |
| F17 | Notes, reader/editor, pinning and unit/topic associations | 5 | 8 study integration; 12 editor accessibility |
| F18 | Deadlines CRUD/type/completion and due/overdue views | 5 | 8 cross-subject agenda; 10 reminders |
| F19 | Marks earned/max and optional weighting, partial grading | 5 | 9 insights; GPA deferred pending grading policy |
| F20 | Subject links CRUD/open/share with URL validation | 5 | 12 long-content/accessibility checks |
| F21 | AI import input, upload consent, backend adapter, parsing, schema validation, confidence/conflict review, atomic commit | 6 | 13 network/retry/security/duplicate QA |
| F22 | Resumable onboarding, manual/import/restore paths, semester/subjects/timetable/review | 6 | Restore integration in 10; 13 first-run tests |
| F23 | Folders/files, import/copy/hash, browse/search/sort/rename/move/share/delete, missing-file recovery | 7 | 10 backup attachments; 13 lifecycle/storage QA |
| F24 | File preview with OS fallback; unsupported MIME handling | 7 | Custom native PDF preview only if chosen; 12 polish |
| F25 | Study setup/timer, focus/break/pause/resume/finish, persisted recovery and history | 8 | 9 totals; 10 local completion reminders; 13 lifecycle QA |
| F26 | Study summary/topic association and active-focus totals | 8 | 9 insights; start-date attribution v1 |
| F27 | Overall weighted percentage, subject comparisons, history/calendar, range filtering, capacity forecasts | 9 | 12 accessible charts; 13 correctness/performance |
| F28 | Semester management/archive/reactivation/switching and historical summaries | 9 | 10 settings entry points; 13 isolation tests |
| F29 | Settings, appearance, haptics, Reduce Effects, privacy, validated preferences | 10 | 12 all-screen audit |
| F30 | Local notification permissions/rules/quiet hours/deadline and class reminders/reconciliation | 10 | 13 real-device permissions/delivery checks |
| F31 | Versioned offline backup/export and staged restore with attachment/checksum/FK validation/rollback | 10 | 13 corrupt/old/new-format QA |
| F32 | Optional account/auth/session management, sign out/deletion; explicit cloud-backup scope if selected | 11 optional | 13 callback/account failure tests |
| F33 | Glass capability/blur/opaque and Reduce Transparency fallbacks, motion/haptics/keyboard/accessibility | 2 baseline | 12 full visual/device polish |
| F34 | Performance, release-build feel, offline reliability, migrations, regression suite, EAS release | 13 | Smoke tests and release checklist |

Feature rows F01–F34 are the provisional inventory, not invented SPEC section numbers. When the SPEC arrives, add its exact headings/IDs and reconcile omissions, priorities, and conflicting assumptions before building dependent features.

## Session 2 — Foundation

**Deliver:** reconcile the SPEC, pin versioned API references, establish the planned directories without unrelated restructuring, and replace the starter route shell with four native tabs and the root Stack. Build shared native controls and surface/accessibility adapters. Add SQLite + Drizzle, generated migrations for the approved schema, repository boundaries, revision-aware commands, validated settings, and bootstrap/recovery UI. Support minimal manual semester/subject creation so Session 3 has real parents; implement pure date/target domain primitives.

**Screens:** S01–S04 tab shells, S24 settings shell, S39 bootstrap; minimal semester/subject editors and switcher. Native sheet infrastructure is owned here; full editors arrive with their features.

**Acceptance:** clean install migrates successfully, reopening preserves selection/data, failed migration does not erase data, FK/cross-semester rejection works, routes contain screens/layouts only, back and direct-link anchors work, themes and opaque accessibility fallbacks render. Domain tests establish zero denominator, endpoints, safe-integer input, and date bounds. Configure ESLint deliberately here if missing; do not silently install it in Session 1.

**Build flags:** Expo Go baseline. Custom app icon/splash/scheme configuration must later be verified in a real app build.

## Session 3 — Timetable

**Deliver:** version management, clone and split effective intervals, recurring slots, class types and weights, weekday/time/room editors, parity, semester-relative week anchor, extras, holiday scopes, cancellations, conflict previews, and deterministic occurrence expansion. Freeze referenced versions and retain historical slots. Define marked-record holiday correction commands even before the Daily Log UI is complete.

**Screens:** S15 timetable; timetable-version, timetable-slot, class-type, extra-class, and holiday sheets.

**Acceptance:** no overlapping versions, no cross-semester references, parity remains stable through version changes, holiday ranges union correctly, extras add exactly once, outside-semester dates yield no schedule, invalid time/weights fail visibly. Verify semester start/end, Sunday→Monday, odd/even, timezone/DST, timetable gaps, and explicit holiday override cases.

**Build flags:** Expo Go baseline; no native calendar integration required by the known brief.

## Session 4 — Daily Log

**Deliver:** functional Today/day navigation, daily log, calendar states, pending classes, occurrence snapshots, status upsert/reset, batch marking preview, undo, signed manual adjustments with reason and historical-prefix checks, canonical percentages, needed/can-skip units, target boundaries and weighted-session explanations. Never auto-mark elapsed classes absent.

**Screens:** S01 full daily workflow, S16 daily log; attendance, adjustment, and attendance-history sheets.

**Acceptance:** repeated taps cannot duplicate a class; committed data survives restart; failed saves preserve prior state/draft; resetting one source cannot leave invalid adjustment totals; neutral/holidays do not inflate denominator. Exercise all numerical examples in `ARCHITECTURE.md`, multi-unit labs, pending days, mixed days, adjustment-only days, and historical timetable changes.

**Build flags:** Expo Go baseline; haptics depend on device capability and settings.

## Session 5 — Subjects

**Deliver:** subjects list/detail/archive, search/filter, per-subject overrides, all subject detail segments, units/topics, completion statistics, notes and reader/editor, deadlines and completion, marks and grading coverage, links and external-open recovery. Connect history/actions from the daily ledger. Subject Files and Study segments link to upcoming feature shells with clear unavailable states until their sessions ship.

**Screens:** S02, S05–S14; subject/target/unit/topic/note/deadline/marks/link editors. Core attendance history remains shared with Session 4.

**Acceptance:** CRUD and archive preserve referenced attendance, no accidental semester leakage, unit/topic associations reject mismatch, zero topics/grades have honest empty states, long text reflows, invalid URLs and earned>maximum fail inline. Marks aggregation identifies partial or missing weights.

**Build flags:** Expo Go baseline. No custom rich-text editor native dependency planned; plain text/approved lightweight formatting first.

## Session 6 — AI import + onboarding

**Deliver:** a resumable onboarding draft, manual/import/restore entry paths, semester/subject/timetable steps, and final atomic setup review. AI supports **proposed v1 sources: selected image, selected PDF/document, and pasted timetable text** through a backend adapter. Validate source size/type, obtain upload consent, show progress/cancel/retry, validate returned data, flag low confidence/unknown subjects/time/parity/weights, allow corrections, preview conflicts and effective date, then commit once with an idempotent request ID.

**Screens:** S29–S35; native source picker and upload-consent/cancel confirmations. Restore entry is wired fully in Session 10.

**Acceptance:** manual setup works offline; AI failures never create partial academic records; rejected/oversized inputs are actionable; repeated commit does not duplicate a timetable; closing/reopening restores an uncommitted draft; users can correct every extracted field. Backend contract tests cover malformed JSON, timeouts, duplicate submission, credential isolation, and retention cleanup. If backend/provider access is unavailable, ship manual setup plus clearly disabled AI with an explicit dependency entry, never simulated extraction.

**Build flags:** picker + remote AI can use Expo Go with internet and a reachable server. **On-device OCR/document scanning via a native library absent from Expo Go requires a development build** and is deferred unless explicitly selected. AI service cost/provider and accepted source formats remain open decisions.

## Session 7 — Files

**Deliver:** semester/subject folders, nested navigation, source import, durable app-local copies, metadata/checksums, staged-copy reconciliation, browse/search/sort/rename/move/share/delete, duplicate warnings, file details, MIME-sensitive previews, and missing attachment recovery. Reject cycles, cross-semester parentage, unsafe paths, and inconsistent destination scope. Add subject Files integration.

**Screens:** S03, S12, S17–S18; folder editor, file import/move/details sheets and native share/open/source pickers.

**Acceptance:** imports survive loss of source URI permission, large copies have progress and cancellation, app termination during copy recovers safely, duplicate hashes do not delete user files, moving folders cannot create cycles, missing bytes are visible, unsupported previews offer a working external-open/share path. Confirm local file permissions on both platforms.

**Build flags:** Expo document/image picker, filesystem, and OS share baseline can use Expo Go. **A third-party native PDF viewer, custom scanner, share extension, or extra cloud-storage entitlement needs a development build.** Default v1 uses OS fallback for unsupported in-app formats rather than committing to a native viewer now.

## Session 8 — Study tools

**Deliver:** subject/topic-aware study setup, focus/break durations, timer, pause/resume/finish/discard, durable checkpoints, interrupted-session recovery, session notes/history, active-focus totals, and a combined deadline agenda. Keep the timer correct from saved timestamps without requiring continuous background JS; uncertain restored time is reviewed. Start-date attribution for daily study statistics is the proposed v1 contract.

**Screens:** S13, S19–S21; study setup/summary sheets. Reuse syllabus/notes/deadlines; do not create separate copies of academic data.

**Acceptance:** only one running/paused session exists, breaks and pauses never count as focus, restart/foreground restores correctly, clock-change anomalies are detected, start/finish commands are idempotent, completed/discarded sessions are correctly included/excluded. Cross-midnight attribution is labeled; timer controls remain reachable with large text.

**Build flags:** timestamp-driven timer and local data can use Expo Go. No guaranteed continuous background execution. **Widgets, Live Activities, foreground services, custom alarm/exact background timer modules require a development build** and are outside known v1 scope unless the SPEC requires them.

## Session 9 — Insights + semester

**Deliver:** aggregate weighted attendance, per-subject comparisons, date/range trends and day status calendar, missing-log indicators, remaining-capacity forecasts over actual versions/parity/holidays/extras, study summaries, semester list/detail/switch/archive/reactivation. Historical views explicitly select a semester and never mutate current setup accidentally. Overall target and individual overrides are presented separately.

**Screens:** S04, S22–S23; final semester editor/switcher, chart selection and filter menus.

**Acceptance:** aggregate ratio is not the mean of subject percentages; archived subjects remain in historical semester totals; unconfigured ranges do not imply zero capacity; forecast says when the current schedule cannot reach target; date boundaries and 100% exactness hold. Charts have data-table alternatives; study metrics exclude pauses/breaks/discards.

**Build flags:** Expo Go baseline with approved compatible chart primitives. A new custom native chart engine must be assessed before adding it; none is required by this plan.

## Session 10 — Settings + notifications + backup

**Deliver:** settings hub, appearance/haptics/Reduce Effects preferences, privacy and AI controls, local reminder permissions/rules/quiet hours, class/deadline/study reminders, system-settings recovery, schedule reconciliation, versioned local export, archive manifest, consistent DB snapshot, attachments/checksums, and reviewed staged replacement restore with rollback. Wire onboarding Restore. No account needed for local backup.

**Screens:** S24–S28; backup-restore sheet; system permission dialogs and data-delete/restore impact confirmations.

**Acceptance:** settings persist and have visible effects; revoked notification permission does not destroy saved rules; modified holidays/timetable/deadlines remove stale reminders; quiet hours and timezone behavior are deterministic. Test OS scheduling limits, elapsed times, canceled deadlines, and deep-link payload validation. Backup round trip reproduces academic totals and files; corrupt/newer/incomplete archives reject safely; failed restore preserves original data; credentials/caches/temporary AI files are excluded.

**Build flags:** local notifications have an Expo Go path. **Android remote push requires a development build; configured sounds, icon/entitlement behavior, exact-alarm settings, and production delivery require an actual app build.** SQLCipher encryption is optional and requires a development build; no encryption claim for plain SQLite or an ordinary ZIP export. Add explicit encrypted export design if selected.

## Session 11 — Accounts (optional)

**Deliver if selected:** actual provider/backend auth, custom redirect/callback handling, secure token storage, expired-session/offline recovery, status/management, sign out, deletion impact and backend confirmation. Decide cloud backup separately; if chosen, upload versioned backups with encryption/access control and show actual operation state. Multi-device row sync stays deferred until a reviewed conflict protocol/schema expansion is approved.

**Screens:** S36–S38 and optional auth browser/callback route; update the architecture route map with the provider's verified redirect scheme.

**Acceptance:** no account is required for core features; cancel/failed auth returns safely; callback state/PKCE/provider checks are correct; no tokens in SQLite/logs/backups; sign-out behavior explicitly preserves local data by default; account deletion distinguishes remote data and local copies.

**Build flags:** **OAuth/OIDC redirects using this app's custom scheme require a development build for representative native testing.** Any unbundled native auth SDK, associated-domain entitlement, or app extension also needs a build. Expo Go is not the final auth acceptance environment.

**Skip path:** remove dormant account entry points; do not leave nonfunctional sign-in controls. Reallocate time to Session 12/13 without changing core release criteria.

## Session 12 — Polish

**Deliver:** audit every S01–S39 screen that is in the approved scope and every sheet/component state against `DESIGN.md`. Complete light/dark contrast, native chrome, glass/blur/opaque fallbacks, Reduce Transparency/Motion, Dynamic Type, VoiceOver/TalkBack focus, icon labels, keyboard access, gesture alternatives, haptics timing, list virtualization, long-text reflow, accessible charts, offline/error/retry copy, and empty-state consistency. Complete real interaction polish rather than adding unrelated features.

**Acceptance:** each screen's primary action and failure/recovery path work; forms cannot hide Save under the keyboard; all data controls have enabled behavior; no color-only state; no jank from per-frame JS updates or per-row blur. Check unsupported-glass iOS and Android paths, slower hardware, 200% text, dark/high-contrast mode, interruption mid-gesture, and back/dismiss with drafts.

**Build flags:** **Release-build performance, native app branding, custom permissions, auth, and extension checks need real builds.** Basic UI can continue in Expo Go. A development build cannot add iOS glass to an unsupported OS.

## Session 13 — QA + release

**Deliver:** cross-platform regression, cold start/upgrade/migration tests, offline and storage failure tests, corrupt restore tests, source-import and auth backend failure tests, historical correctness fixtures, large-dataset performance checks, notification/device lifecycle checks, privacy/permission copy, app metadata/assets, EAS build profiles, internal testing and production submission preparation. Use CNG configuration/plugins; never manually author generated native projects.

**Acceptance:** no unresolved data-loss, wrong-percentage, broken-navigation, migration, or restore defects. Required lint/typecheck and relevant tests pass. Record device/OS/build/profile and tested behavior; separate simulator from physical-device evidence. Use development/internal release builds before production. Confirm signing, provider/server configuration, store disclosures, and installed runtime compatibility for any OTA update.

**Release commands:** use project-local Expo commands and `npx eas-cli@latest <command>` in this npm project. If later adopting Bun, use `bunx` and a consistent lockfile transition. Do not deploy backend, publish OTA, submit stores, or change native configuration during Session 1.

**Build flags:** app binaries, custom native configurations and store installation cannot be delivered through Expo Go. EAS Build/Submit are the release path; EAS Update only ships compatible JS/assets, not new native modules or entitlements.

## Screen ownership cross-check

| Design screen IDs | First complete implementation |
|---|---|
| S01 | 4 (shell 2) |
| S02, S05–S11, S14 | 5 |
| S03, S12, S17–S18 | 7 |
| S04, S22–S23 | 9 |
| S13, S19–S21 | 8 |
| S15 | 3 |
| S16 | 4 |
| S24–S28 | 10 (hub shell 2) |
| S29–S35 | 6 (Restore completion 10) |
| S36–S38 | 11 optional |
| S39 | 2 |
| Every approved screen/sheet | 12 polish, 13 QA |

## Expo Go / development-build matrix

**GO** means the module is bundled or JS-only in the matching SDK; it does not mean behavior has been tested in this session. Use an Expo Go binary compatible with SDK 57. Dependencies named here are candidates, not installed by Session 1.

| Capability | Expo Go expectation | Build / platform condition |
|---|---|---|
| Router NativeTabs, stacks, native forms via bundled `@expo/ui` | GO baseline | Verify installed SDK export names in Session 2; native iOS/Android styling differs |
| Plain `expo-sqlite` + Drizzle | GO baseline | SQLCipher/build-time SQLite configuration needs a development build |
| Reanimated/worklets and bundled gesture handler | GO baseline | Test performance in release build |
| `expo-glass-effect` | Bundled, eligible iOS only | iOS 26+ and runtime/compiler capability; older OS/Android use fallback even in custom builds |
| `expo-blur`, haptics | GO baseline | Platform/device accessibility/performance fallback still required |
| Document/image pickers, local files, sharing | GO baseline | Extra provider entitlements/custom scanner/extensions need build |
| AI via server request | GO with network/server | On-device unbundled native OCR requires build; remote API does not intrinsically require one |
| Local reminders | GO baseline | Physical device QA and custom configuration in real build |
| Remote push on Android | **Not in Expo Go** | Development build + configured credentials/backend |
| Custom notification sounds/icons/entitlements | Not representative in Expo Go | Development/production build to validate app-specific config |
| Timestamp study timer | GO baseline | No guarantee of background JS execution; save/recover timestamps |
| Widgets/Live Activities/native background services | **Not in Expo Go** | Development build + native targets/config; not selected for v1 |
| Native third-party PDF/OCR/auth module absent from Expo Go | **Not in Expo Go** | Development build; choose approved fallback if optional |
| App-specific OAuth redirect scheme | Expo Go unsuitable for final test | Development build with provider-configured redirect |
| App icon/splash/associated domains/custom permissions | Expo Go cannot represent final app | Built app |
| Local unencrypted backup files | GO baseline | Encrypted SQLite needs SQLCipher build; encrypted export is a separate design choice |
| Cloud backup / multi-device sync | Backend-dependent | No inherent build need for HTTPS; auth/native SDK may require one; sync not designed here |
| Store release / compatible OTA updates | Not an Expo Go deliverable | EAS Build/Submit; EAS Update requires installed compatible runtime |

Verified module/platform references: [SDK 57 glass](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/), [blur](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/), [SQLite / SQLCipher](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), [AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/), [DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), and [haptics](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/). Recheck version-pinned docs before each API implementation.

## Decisions to confirm

1. **Missing SPEC:** should the supplied requirements and proposed inventory be the baseline until the SPEC is available? **Default:** yes; reconcile with the actual SPEC at Session 2 before feature implementation.
2. **Four tabs:** which labels belong in the bottom bar? **Default:** Today, Subjects, Files, Insights; timetable and settings open from headers/shortcuts.
3. **Weighted attendance:** should a lab count as multiple attendance units? **Default:** positive integer `countsAs`, per class; show both sessions and units.
4. **Neutral and unmarked classes:** do these reduce attendance? **Default:** neutral/holiday excluded, unmarked remains pending, never auto-absent.
5. **Week parity:** where does odd/even start? **Default:** week 1 is the week containing semester start, anchored Monday; no reset on version changes.
6. **AI import:** preferred provider and source types? **Default:** backend-mediated image/PDF/text drafts with required user review; manual setup always available.
7. **Accounts:** what should Session 11 include? **Default:** defer accounts for v1; local-only with manual backup. Add auth/cloud backup explicitly later; multi-device sync is separate.
8. **Restore and encryption:** replace or merge, and is encrypted storage mandatory? **Default:** reviewed replacement restore with rollback; plain local SQLite and clearly labeled unencrypted exports for v1, pending an explicit encryption requirement.

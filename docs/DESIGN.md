# Attendance Tracker design

**Calm redesign (12 October 2026), supersedes the palette, radius and component notes below:** the indigo/blue-gray palette is replaced by a warm neutral ramp (`#F5F5F2` canvas, `#1C1C1A` text; dark `#111111`/`#EDEDEA`) with one quiet ink accent (`#2F5276` / `#9DB6D3`). Status colors are muted (present `#2E6B4F`, absent `#A63D35`, warning `#8A5A12`) and every text pair clears 4.5:1. Radii are 12 for cards and groups, 14 for the one summary surface, 8 to 10 for controls; capsules are gone except true circles. Target markers no longer stick out of rings or bars (the target is stated in text). Status pills render as a tone dot plus text with no fill. Settings rows use naked icons instead of tinted tiles. Subject cards drop the four-stat grid (the status line already says how many to attend or skip) and use neutral steppers that show the counts. Accent keys stay `indigo/blue/teal/rose/violet` for persisted settings; their display names are now Ink, Blue, Pine, Clay and Plum. Values live in `src/ui/tokens.ts` and `src/features/settings/model.ts`. Subject identity colors (`subjectColors` in `src/lib/timetable.ts`) and the PDF report CSS still use the old saturated values.

**Android glass (12 October 2026):** iOS keeps system Liquid Glass (NativeTabs, native toolbar buttons, sheets). Android has no Liquid Glass, so it gets frosted glass instead: each tab's content renders inside a `BlurTargetView` registered under the tab's name (`GlassScope` in `src/ui/glass.tsx`, wired in `GradientBackground`), and a floating pill tab bar (`src/features/shell/floating-tab-bar.tsx`, JS `Tabs` on Android only) blurs that content live. The app bar is deliberately not glass, because a blurred header behind large titles made content collide with the title. It is a Material 3 app bar instead: page-colored at rest, tinted (`surfaceRaised` light, `surface` dark) once content scrolls under it, driven by `useHeaderScrollEdge()`. This needs Android 12+ and turns off under Reduce Transparency or high contrast, falling back to opaque surfaces. Tab content pads for the floating tab bar with `useChromeInsets()`. Header buttons go through `HeaderActions` (`src/ui/header-actions.tsx`) because Android's native toolbar can't draw symbol icons. Android editors open as full-screen dialogs with an × and Save instead of sheets. Switches are Material 3, seeded with the accent. On iOS the toast is an inverse-surface snackbar with Undo. On Android, undoable confirmations show nothing, because every action has a direct reverse on screen (steppers, re-marking, restore); they are only announced to TalkBack. Errors and plain notices use the native `ToastAndroid`, with no buttons. Glass layers and blur sources are keyed by color scheme so live theme switches don't leave stale tints.

**Mockup revamp (12 October 2026):** all four tabs now follow `design/refs/mockups/` using the shared kit in `src/ui/kit.tsx` on a flat background: 16/20/24 radius opaque cards, status pills with text labels, inverted filter chips and accent choice chips, 4-stat grids on the canvas colour, target-tick rings, and grouped rows with 30-point icon tiles. Native large titles, segmented controls, pickers, switches and sheets are kept. See PROGRESS.md for the screen-by-screen notes and the mockup items deliberately not built.

**Settings update (12 October 2026):** the hub uses native `@expo/ui` FieldGroup sections and ListItem navigation rows for Semester, Preferences, Your data and About. Detail screens keep the existing system typography, shared cards, native switches/pickers and semantic tokens. Five named accent choices show a labeled selection ring, and light/dark/system plus transparency/motion choices apply app-wide. Backup preview describes replacement and missing bytes before a separate final confirmation; errors remain visible without losing the preview. App lock presents an opaque full-screen authentication cover and hides underlying accessibility content. License notices use a searchable virtualized list. `building-native-ui` was found in the installed Expo plugin and read; its native patterns take precedence over the web-only AIDA/GSAP/randomized layout portions of `gpt-taste`. The original indigo remains the default accent.

**History, planner and semester update (12 October 2026):** History uses a labeled month heatmap (P/A/N/H, mixed, pending and no-class symbols) with direct, scoped Daily Log navigation. A small cumulative attendance line includes the target, honest empty/undefined states and a dated text alternative. Subject detail and Subjects overall use native sliders with accessible ±1-class alternatives for independent skip/attend scenarios; each result includes weighted units and the actual Nth scheduled date. Settings > Semester uses existing native editor sheets for name/dates, target and named holiday ranges. New-semester setup previews what is copied before archival. Reset offers a complete backup or an explicit decline, then exact RESET typing. Archived history remains visibly read-only and never changes the active semester. Native system typography, semantic status colors and existing tokens take precedence over web-specific gpt-taste layout/motion rules.

Session 1 planning draft · 11 October 2026

**Session 6 implementation update:** onboarding uses welcome → semester dates/name → target → external AI import or the existing manual timetable builder → done. Import shows four instruction cards, service links, exact prompt copying, and pasted JSON; preview uses virtualized day sections, new/existing subjects, Replace/Merge, effective scope, duplicate summaries and text-labeled conflicts. Unresolved overlaps block saving. This supersedes proposed upload/consent/progress interfaces below: no AI executes in the app. Native system typography and existing tokens prevail over web-specific `gpt-taste` prescriptions.

**Subject-detail implementation update (12 October 2026):** native section selection opens Topics by default. Native Collapsible headers sit above virtualized topic rows, with unit and subject progress. Reorder mode offers a long-press drag handle plus accessible Move up/down buttons; Important filtering never changes the completion denominator. Checks use a short Reanimated scale pulse and the existing haptic/Undo adapter, respecting Reduce Motion. Notes use a selection formatting toolbar with Preview and a formatted reader; checklist rows are directly tappable. Pinned notes precede unpinned notes, and search covers titles and body text. Deadline countdowns remain text-labeled; link icons identify YouTube, Drive and PDF without remote thumbnails. Timer numerals use tabular figures and reflow into labeled minute/second groups on narrow screens or large font settings. All editor forms reuse native sheets, keyboard insets, validation and discard guards. Existing system typography, indigo tokens and native behavior take precedence over the web-specific portions of `gpt-taste`.

## Scope and direction

**Session 2 implementation note:** SPEC is now present. The implemented foundation uses **Subjects, Daily Log, Timetable, Settings**; those tabs supersede the earlier proposal below. Light/dark tokens and shared components are implemented, with a development-only showcase. The remaining screen inventory is future design guidance, not shipped functionality.

`docs/SPEC.md` is missing. This document defines layouts for every screen and sheet in the proposed route inventory in `ARCHITECTURE.md`; screen completeness against the SPEC remains unverified. The four proposed NativeTabs are **Today, Subjects, Files, Insights**.

The requested `gpt-taste` skill was read and informs typography, restrained composition, clear hierarchy, legible controls, and avoidance of decorative badges. Its web landing-page prescriptions (AIDA sections, GSAP, hover, randomized heroes, and cinematic page spacing) do not fit this native utility. This session writes no UI code, so its UI-code preflight is not triggered. Apply its visual intent through a calm academic workspace: a strong attendance number, ordered rows, generous but useful spacing, and one precise accent. No stock photography, ornamental charts, artificial “SECTION 01” labels, or endless card grids.

The requested `building-native-ui` skill is not installed. The available `expo:expo-native-ui` skill is the implementation substitute, supported by `expo:expo-ui`, `expo:expo-router`, `expo:expo-animation`, and `expo-glass-effect`. Use genuine platform navigation and controls: iOS large-title stacks/SF Symbols, Android Material headers/icons, and native NativeTabs. Native implementation takes precedence over web-specific visual prescriptions.

## Color tokens

One product accent: **indigo**. Status colors communicate outcomes only and never serve as alternate branding. Subject identity uses icons and names rather than a rainbow of unrelated card colors. These are explicit light/dark design targets; resolve native semantic equivalents where appropriate and retain these tokens for forced theme mode, charts, and string-only animated color APIs.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F6F7FB` | `#101116` | App canvas |
| `surface` | `#FFFFFF` | `#1B1D26` | Rows, forms, sheets |
| `surfaceRaised` | `#ECEEF5` | `#272A36` | Nested controls/selected groups |
| `textPrimary` | `#171923` | `#F5F6FC` | Main labels and data |
| `textSecondary` | `#52586A` | `#B3B8CB` | Supporting text |
| `textMuted` | `#62697C` | `#949CB3` | Metadata; never disabled-only semantics |
| `separator` | `#D9DDE8` | `#383D4D` | Decorative row dividers |
| `controlBorder` | `#71798E` | `#8992AB` | Required input boundaries/focusable outlines |
| `accent` | `#4144D8` | `#B2B4FF` | Selection, primary action, interactive links |
| `onAccent` | `#FFFFFF` | `#18194A` | Primary action text |
| `accentSubtle` | `#EEEEFF` | `#292B4E` | Selected control fill |
| `present` | `#176640` | `#7ED6A3` | Present / achieved |
| `presentSubtle` | `#E8F5ED` | `#173728` | Present background |
| `absent` | `#B42338` | `#FF9CA9` | Absent / validation error / destructive |
| `absentSubtle` | `#FDECEF` | `#45222B` | Absent background |
| `warning` | `#805800` | `#F1CA72` | Below target, overdue, attention |
| `warningSubtle` | `#FFF4D8` | `#3D321D` | Warning background |
| `neutral` | `#535D73` | `#B6BFD5` | Neutral / excluded |
| `neutralSubtle` | `#EEF0F5` | `#292F3C` | Neutral background |
| `scrim` | `rgba(14,16,28,0.32)` | `rgba(0,0,0,0.56)` | Custom overlay only; native sheets own theirs |

Mixed days use the warning token plus a split present/absent symbol; holiday uses neutral with a calendar symbol; pending uses an outlined circle plus text. Do not invent another accent. Status labels/icons accompany every colored control or chart point. Regular text target contrast is at least 4.5:1; large text and meaningful control graphics at least 3:1. Test actual composited surfaces and system increased-contrast mode. Decorative separators need not masquerade as sufficient control boundaries.

## Typography

Use platform system UI fonts for body, controls, navigation, and all accessibility-sensitive text. Use **Geist** only for large editorial attendance numerals if bundled with an appropriate license; system font is the immediate and loading fallback. This preserves the `gpt-taste` typography direction without replacing native control typography. Tabular numerals for ratios, percentages, dates in rows, and the timer; selectable text for meaningful statistics and errors. Do not use Inter or all-caps tracking as a default visual identity.

| Role | Size / line height at default scale | Weight | Notes |
|---|---|---|---|
| Native large title | Platform default, approximately 34/41 on iOS | Bold | Navigator-managed; Android uses native app bar |
| Hero statistic | 48/56 | Semibold | One attendance figure; reflow at large text |
| Timer | 56/64 | Medium | Tabular; constrain by available width, no truncation |
| Screen section heading | 22/28 | Semibold | Actual content title, not meta-label |
| Card/row title | 17/24 | Semibold | Subject or task name |
| Body/control | 17/24 | Regular/medium | Minimum comfortable main reading size |
| Secondary | 15/21 | Regular | Date, room, rationale |
| Caption | 13/18 | Medium | Supplementary metadata only |

Honor Dynamic Type / font scaling without a restrictive maximum. At 200%+, move trailing controls below titles, wrap labels, and replace wide multi-column summaries with a vertical list. Do not force native large titles into custom 2-line typography rules. Short product headings normally fit one or two lines at default size; long subject names wrap naturally.

## Spacing, shape, and elevation

- Spacing scale in logical points/dp: **4, 8, 12, 16, 20, 24, 32, 40, 48**. Default screen gutter 20, compact width gutter 16; section gap 24–32, row padding 16, inline gap 8, label-to-field gap 8.
- Content width follows safe available width; centered readable column capped at 680 on tablet. Timetable may use a wider dedicated canvas; forms remain readable. Use flexbox and live window dimensions; no device-model assumptions.
- Radius tokens: 8 small input accessories, 12 fields, 16 grouped surfaces, 24 occasional summary surface. Capsules only for true segmented/chip controls. Continuous curves where supported. Native sheets/menus/tabs keep platform radius.
- Group related rows under one surface with inset separators. Put standalone actions outside content cards. At most one dominant summary surface per screen; no giant decorative empty spaces or web bento layout.
- Prefer flat surfaces. Raised custom overlay shadow: light `0 4px 16px rgba(17,19,30,0.08)`, dark `0 4px 16px rgba(0,0,0,0.24)` as `boxShadow`. No shadow on every row, no animated shadows, and no custom shadow on native glass.
- Minimum touch area 44×44 points on iOS and 48×48 dp on Android. Minimum practical row height 56, expanding with content. Add hit slop to small icon visuals; adjacent targets must not overlap.

## Glass and fallback policy

Glass is reserved for transient chrome: an optional floating Today action bar and small overlay tools. Content tables, forms, chart plot backgrounds, notes, and attendance rows use opaque surfaces. Native tabs/headers/sheets own their platform effects; avoid adding another glass layer behind them.

For custom surfaces use `expo-glass-effect` only when both `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()` permit it, on supported iOS. Use `GlassView` regular style, stable `isInteractive`, and theme-aware foregrounds. Avoid opacity animation on glass or its ancestors; prefer native effect transitions. Check Reduce Transparency separately because capability checks do not reflect that preference. [SDK 57 glass reference](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/).

Fallback order:

1. **Reduce Transparency, increased contrast, or app Reduce Effects:** opaque `surface`/`surfaceRaised`, meaningful border, no glass or blur. Start opaque until accessibility preferences are known to prevent a flash.
2. **Eligible glass device:** regular native glass with tested foreground contrast. No stacked glass over glass; normally one custom effect region visible.
3. **Blur fallback:** `expo-blur`, static intensity 40 light / 55 dark with a tinted legibility layer. On Android use a `BlurTargetView` reference and `dimezisBlurViewSdk31Plus`; use an opaque surface when the platform takes the no-blur path. Render the background before its blur overlay. [SDK 57 blur reference](https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/).
4. **Unsupported, slow, or untested surface:** opaque fallback with identical geometry, controls, and accessible labels.

Listen for `reduceTransparencyChanged` and `reduceMotionChanged`, refresh on foreground, and clean up subscriptions. An in-app Reduce Effects preference may strengthen system settings, never weaken them. Reduce Transparency and Reduce Motion are independent. [React Native accessibility reference](https://reactnative.dev/docs/accessibilityinfo).

## Motion specifications

Native transitions own pushes, tab changes, sheets, menus, pickers, and keyboard movement. Do not rebuild them with GSAP or web scroll effects. Tabs do not slide between peers. Custom motion serves feedback or continuity; repeated data screens do not replay entrance animations.

| Interaction | Custom specification | Reduced Motion |
|---|---|---|
| Button press | Scale 1 → 0.97, 100 ms; release 120 ms, ease-out | Background/opacity feedback, no scale |
| Full-width row press | Background highlight, 100 ms; no row scale | Same instantaneous highlight |
| Attendance state change | Icon/fill crossfade 150 ms; no moving row | Immediate icon + label update |
| Summary value after a save | 180 ms crossfade; no slot-machine number roll | Immediate number update |
| Filter/chip content replacement | Container crossfade 150 ms; preserve scroll | Immediate replacement |
| Toast | Fade 180 ms in / 150 ms out; visible 4 s, longer with screen reader | Fade ≤100 ms or immediate |
| Native sheet/modal | Platform defaults; detents fit content and large text | System accessibility behavior |
| Custom drag snap, only if native component cannot meet need | `{ duration: 400, dampingRatio: 0.8, velocity }` | Snap without translation/overshoot |
| Custom sheet gesture, exceptional fallback | `{ duration: 300, dampingRatio: 0.8, velocity }` | Immediate settle; retain dismissal affordance |
| Default spring settle without bounce | `{ duration: 400, dampingRatio: 1 }` | Immediate final position |
| Hard-edge boundary | Add `overshootClamping: true` | Immediate final position |
| Onboarding step change | Native push or 200 ms content fade | Immediate or short fade |
| Import progress | Determinate progress when measured; native spinner otherwise | No shimmer/pulse; static progress label |

Custom ease-out is `(0.23,1,0.32,1)`; on-screen morph uses `(0.77,0,0.175,1)`. With Reanimated 4.5.1, use `cubicBezier(...)` for CSS-style transitions and `Easing.bezier(...)` for timing worklets, not raw cubic-bezier strings. Use UI-thread transforms/opacity for gestures; no React state or RN-runtime callback every frame. Avoid animation of layout dimensions and blur intensity. Motion with a velocity handoff uses springs. Component presses use simple transitions. No decorative continuous animation in the daily workflow.

Respect `ReduceMotion.System`. Interrupted gestures resume with velocity; user cancellation returns to the prior state. Virtualized rows do not animate on every recycled mount. Judge motion on release builds on a slower supported Android and real iPhone, not Expo Go alone. Gesture and haptic feel remain future QA work.

## Haptics map

Use `expo-haptics` behind a preference-aware adapter. One haptic per deliberate action, with visible feedback; never per frame, during background updates, or on every render. Native controls that already provide feedback do not get duplicate haptics. Missing hardware or denied feedback never blocks an action.

| Action | Feedback | Moment |
|---|---|---|
| Custom date/segment selection | `selectionAsync()` | Selection changes |
| Present/absent/neutral mark | Light impact | Accepted local mark; show pending/save error separately |
| Undo attendance | Light impact | Undo commits |
| Topic/deadline completion | Selection | Committed state change |
| Custom drag reorder | Light impact | Drop commits; never during every move |
| Study start/pause/resume | Light impact | User action accepted |
| Study completion | Success notification | Completion acknowledged, once |
| AI import / backup / restore success | Success notification | Durable operation succeeds |
| Failed save or invalid adjustment | Error notification | Visible error appears, once |
| Confirmed destructive action | Medium impact | Operation commits, not initial menu opening |
| Navigation, scrolling, typing, background reminders | None | Platform behavior only |

## Shared interaction and state contract

Every data surface has distinct loading, content, empty, error, and retry states. Initial loading must not flash “No subjects.” Local DB errors differ from network errors; AI upload errors preserve drafts. Forms support pristine, edited, invalid, saving, failed, saved, and discard-confirmation states. Save disables only while a save is in flight or input is invalid; errors are inline and focus the first invalid field. Prevent duplicate submissions with command IDs/revisions.

Scrolling screens use automatic native content inset adjustment and safe bottom padding. Virtualized lists are their own scroll container. Short grouped settings/forms prefer `@expo/ui` controls inside `Host`; large file/history lists use virtualization. Native date/time, switch, menu, picker, and segmented controls are the first choice. Search filters real content; it is not a decorative field. Async saves retain drafts and dismiss only after commit.

Forms keep primary actions above the keyboard or in native keyboard-safe chrome. Use the platform keyboard-inset behavior first; adopt a verified keyboard controller only if necessary. `keyboardShouldPersistTaps="handled"` for scrolling forms. Back gestures and swipe dismiss preserve or explicitly discard unsaved edits. On Android, hardware/predictive back first closes the current presentation. Accessibility focus moves to the new title/error and returns to the triggering control on dismiss.

## Component inventory

| Component | Required states / variants |
|---|---|
| App bootstrap / recovery boundary | Opening, migrating, ready, migration failed, recovery/export |
| NativeTabs + stack header | Selected/unselected, long labels, dark/light, accessibility, inactive semester badge |
| Semester selector | Active, archived, no semester, switching, unavailable ID |
| Attendance summary | No classes, below/at/above target, 0% target, unreachable 100%, pending-log caveat |
| Subject row | No data, healthy, warning, archived, long name, selected/search match |
| Class row | Upcoming, pending, present, absent, neutral, holiday-suppressed, extra, weighted, saving, failed |
| Attendance control | Unmarked, three outcomes, disabled future/outside semester, save pending/error, undo |
| Day cell / calendar | Today, selected, pending, present, absent, mixed, neutral, holiday, noClasses, outside, unconfigured |
| Target editor | Default/override, 0/100 endpoints, invalid, preview, saving |
| Adjustment preview | Positive/negative deltas, opening balance, valid, invalid historical prefix, stale revision |
| Timetable cell | All/odd/even, selected version, holiday, conflict, extra, long labels, weight >1 |
| Unit/topic row | Expanded/collapsed, incomplete/complete, empty unit, editing/reordering, error |
| Note row/editor | Untitled validation, pinned, linked topic, long body, draft, saving, failed |
| Deadline row | Upcoming, due today, overdue, complete, reminder disabled/denied |
| Marks row/summary | Ungraded, graded, invalid max, partial weight coverage, empty |
| Link row | Valid, invalid URL, open failed, copied, long title |
| Folder/file row | Root/nested, staged, ready, missing, duplicate warning, unsupported preview, error |
| Import source/progress/review | Consent, selecting, uploading, parsing, low confidence, conflict, corrected, committing, failed/cancelled |
| Chart / legend / text table | No data, partial data, selected point, dark/light, accessible equivalent, zero denominator |
| Study timer | Idle/setup, focus, break, paused, interrupted/recovered, complete, discarded |
| Settings row | Native switch/selection/disclosure, unavailable permission, managed by system |
| Backup card/review | Never backed up, running, success, invalid/newer format, missing attachment, restore failure/rollback |
| Account card (optional) | Local only, signing in, signed in, offline, auth expired, sign-out/deletion pending |
| Sheet shell / confirmation | Compact/full, keyboard open, large text, saving, unsaved draft, dismiss blocked with reason |
| Button / icon action | Default, pressed, focus, disabled, loading, destructive, accessible name |
| Search/filter/empty/error/toast | Input/no results, filters active, clear, offline, retry, undo and timeout accessible |

## Layout notes for every proposed full screen

These are the screen IDs used by the roadmap. Subject detail segments share one route and independently retain scroll position. Do not create nine more bottom tabs.

| ID | Screen | Layout and primary task |
|---|---|---|
| S01 | Today NativeTab | Native title + semester/settings actions; selected date strip; one compact overall summary; chronological class rows with immediate attendance actions; upcoming deadline/study shortcuts below. No attendance available before a semester is configured. |
| S02 | Subjects NativeTab | Native search; rows show name, ratio, percentage, target message; add in header; archive filter in menu. Empty explains creating/importing subjects. |
| S03 | Files NativeTab | Scope selector, search, folders before files, list/grid toggle only if both useful; import action in header. Show local storage state and missing-file recovery inline. |
| S04 | Insights NativeTab | Semester/range filters; weighted overall summary, subject comparisons, trend/calendar, study summary; text equivalents below charts; pending logs warning visible before forecasts. |
| S05 | Subject detail: Overview | Native title; ratio and target message; compact attendance summary, next class/deadline, syllabus/study preview; horizontally scrollable native segment selector with accessible labels. |
| S06 | Subject detail: Attendance | Percentage + counts; needed/can-skip in units and next-session weight; date/history list; adjustment and target actions. Keep balance adjustments separate from physical sessions. |
| S07 | Subject detail: Syllabus | Ordered unit disclosure rows with topic check controls; completion text; add unit/topic actions in context. Expanded content reflows with text size. |
| S08 | Subject detail: Notes | Searchable note rows, pinned first, add action; previews wrap to two lines at default size. |
| S09 | Subject detail: Deadlines | Upcoming/complete segments; due-date grouped rows with overdue text; create action; permission state beside reminder option. |
| S10 | Subject detail: Marks | Graded/ungraded rows; earned/max, clearly labeled aggregation and coverage; add/edit action. No invented GPA ring. |
| S11 | Subject detail: Links | Simple titled URL rows, label metadata, open/share/edit menu; descriptive link accessibility text. |
| S12 | Subject detail: Files | Same file browser scoped to this subject; destination pinned during import; folder breadcrumb and import action. |
| S13 | Subject detail: Study | Focus totals and recent sessions, topic-aware Start; empty promotes a first session. Start-date attribution stated in history. |
| S14 | Note reader | Native title/actions; readable body with generous line height; unit/topic metadata; edit/share; body scroll position preserved. |
| S15 | Timetable | Version/effective-date selector; week/parity indicator; compact width defaults to day agenda with week strip, optional horizontally scrollable week grid; add slot/extra/holiday actions; conflicts explicit. |
| S16 | Daily Log | Date header and calendar expansion; occurrence rows and batch preview action; legend and day state; adjustments as separate rows; future/outside dates read-only. |
| S17 | Folder contents | Native folder title, breadcrumb, nested list, sort/search, import/create-folder actions; back follows folder hierarchy. |
| S18 | File preview | Safe-area-aware document/image preview, filename and share/details actions; unsupported type has Open externally; missing bytes has Locate/Reimport. Native PDF viewer choice remains a build decision. |
| S19 | Study overview | Start control, subject/topic selector, focus totals, history; resume banner for existing active session; no decorative ticking graphs. |
| S20 | Active study session | Centered tabular timer, focus/break label, subject/topic, large pause/resume and finish controls; safe secondary discard; keep screen readable with dynamic text and background/recovery state. |
| S21 | All deadlines | Date sections with subject labels and open/complete filter; search and add action; empty complete state distinct from no setup. |
| S22 | Semesters | Active first, then archived with dates/summary; switch/create actions; archive menu with impact preview. |
| S23 | Semester detail | Dates/target, subject counts and aggregate ratio, timetable version summary, archive/reactivate action; historical browsing is explicit. |
| S24 | Settings hub | Native grouped sections: semester, appearance, reminders, backup, privacy, optional account; app/version footer. |
| S25 | Notification settings | Permission status + system-settings recovery; rule switches and timing; quiet hours, sample schedule, test local notification; denied state retains saved rules. |
| S26 | Backup settings | Last successful export, included counts/storage, Export and Restore; operation progress and recoverable errors; local versus optional cloud scope explicit. |
| S27 | Appearance settings | System/light/dark picker, live preview, haptics toggle, Reduce Effects; system accessibility preferences shown read-only. |
| S28 | Privacy settings | AI upload explanation/control, local storage statement, export/delete data impact entry, optional account deletion entry; short readable sections. |
| S29 | Onboarding welcome | Native full-screen introduction, concise value statement, Start manually / Import timetable / Restore backup actions; local-only path clear. |
| S30 | Onboarding semester | Name, dates, timezone, target; explanatory week anchor; Continue above keyboard; validation inline. |
| S31 | Onboarding subjects | Editable subject rows, add/import, class-type defaults; Continue can proceed with a clearly documented empty state if user skips. |
| S32 | Onboarding timetable | Week/day editor with all/odd/even selector; import shortcut; skip supported; no fabricated schedule. |
| S33 | Onboarding review | Human-readable semester/subject/timetable summary, warnings, edit links; single atomic Finish commit. Permission requests follow context after setup. |
| S34 | AI import source/progress | File/image/text sources, privacy consent, preview and crop if supported, explicit progress stages and cancel; manual path remains reachable. |
| S35 | AI import review | Original source accessible alongside draft on tablet, stacked switch on phone; editable extracted rows; low-confidence/conflict markers; effective date/parity/weights review; Commit with row count. |
| S36 | Account status (optional) | Local-only explanation, benefits/scope of account, sign-in action; no blocking gate over offline features. |
| S37 | Sign in (optional) | Native auth browser/provider flow; progress, cancellation, retry, callback recovery; privacy/terms before submit. |
| S38 | Account management (optional) | Identity, explicit cloud-backup status if implemented, last operation, sign-out and deletion impact previews; local-data retention choice clear. |
| S39 | Bootstrap/recovery | Native splash only while startup progresses; in-app progress for migration/recovery; error details, retry, export recovery, no automatic erase. |

## Layout notes for every proposed sheet

All editor sheets use a native title, Cancel, and Save/Done; compact detents grow to full height for keyboard and Dynamic Type. Never truncate a form merely to preserve a half-height design. Destructive actions sit separately from Save. Read-only lists may begin half-height but expand for long content.

| Sheet | Specific layout and states |
|---|---|
| Subject editor | Identity fields first, credits/teacher below, target override link; duplicate normalized-name error inline; archive separate from Save. |
| Class-type editor | Name and positive integer default weight; example “Lab counts as 2 attendance units”; changing defaults warns existing classes remain unchanged. |
| Timetable version | Effective-date field and clone choice, followed by before/after affected-date summary; reject history conflicts before save. |
| Timetable slot | Subject/type selectors, weekday/parity, start/end, room, weight; conflict summary above Save; full-height on small screens. |
| Extra class | Date/time first, subject/type/weight, holiday override with explicit explanation; distinguish addition from replacement. |
| Holiday | Inclusive date range and semester/subject scope; affected class/record count; conversion-to-neutral preview if records exist. |
| Attendance | Subject/time/weight context, three labeled status controls, note, reset action; persisted status visible; unmarked is a separate state. |
| Adjustment | Signed attended/held inputs, required reason, effective date, current→proposed ratios; invalid prefix/date error; no slider for signed ledger changes. |
| Attendance history | Date-grouped ledger, source/type/weight, adjustment badges, filter, edit action; virtualized at full height. |
| Target | Numeric percent input plus native slider if useful, default/override choice; explicit 0%/100% explanations and live projection. |
| Unit editor | Title/order; delete impact lists contained topics and links; simple keyboard-safe compact form. |
| Topic editor | Unit selector, title, completed control; preserve completion date unless deliberately reset. |
| Note editor | Title, optional unit/topic, full-height multiline body, saved/draft indicator; reader/editor switch does not lose input. |
| Deadline editor | Title/category, native date/time, reminder offset, completion; timezone shown; past-due and denied-permission warnings inline. |
| Marks editor | Assessment title/date, earned/max side by side when space allows, optional weight and note; live validity/coverage message. |
| Link editor | Title, URL with URL keyboard, label; validated scheme and preview; no automatic navigation while typing. |
| Folder editor | Name, destination hierarchy, subject scope; root clearly named; invalid cyclic move blocked. |
| File import | Destination, selected sources and byte totals, copy progress, cancel/retry; ready appears only after durable copy/checksum. |
| File move | Destination tree, current location disabled, scope-change preview; confirm once destination is valid. |
| File details | Filename/edit, MIME/size/source, share and reimport; delete below a separator with actual impact. |
| Study setup | Subject/topic selection, focus/break durations, Start; offer resume if another session exists. |
| Study summary | Active focus duration and completion state, optional note, Save; discard confirmation separate. |
| Semester editor | Dates/timezone/target, week anchor explanation, affected-history preview on edit; archived read-only unless reactivated. |
| Semester switcher | Active checkmark, date ranges, archived disclosure, Create semester; switching preserves unfinished edits or prompts to save/discard. |
| Backup restore | File manifest, version, counts/checksums, missing/incompatible errors, replacement impact, final restore confirmation; progress prevents accidental double start. |

Local action sheets, pickers, permission prompts, import-consent prompts, and confirmations listed in `ARCHITECTURE.md` use native components. Each confirmation names the affected resource and count, offers a clear cancel action, and distinguishes archive from delete. OS share/auth/picker surfaces retain native design. No custom glass wrapper around system UI.

## Accessibility and responsive acceptance

VoiceOver/TalkBack labels announce subject, date, outcome, weighted units, and pending state. Charts have a navigable textual data table and a legend. Focus order follows visual order; gestures always have visible button alternatives. No color-only signals, auto-playing celebrations, or haptic-only confirmations. Respect bold text, increased contrast, Reduce Motion, Reduce Transparency, and device orientation/size changes supported by app configuration.

Verify 320-point compact widths, keyboard open, 200%+ text, long subject/folder names, many subjects, offline import, denied notifications, empty semester, missing files, and archived history. Phone defaults to one column; tablet uses list/detail or source/review side by side only when enough width remains for accessible controls. The current app is portrait-only; changing supported orientations is a later explicit product decision.

Design acceptance is a future implementation gate: complete a primary task and a failure/recovery path on every screen; inspect both themes and all fallback surfaces; measure contrast; test screen-reader focus; inspect real release-build motion and keyboard reachability. This planning session does not claim rendered UI validation.

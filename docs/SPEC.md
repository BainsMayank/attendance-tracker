# Attendance Tracker

Working name: Attendance Tracker.

## Product

A free, offline-first attendance tracker for college students on Android and iOS. All core functionality must work fully offline. No paid APIs, AI calls, analytics, or ads.

## Stack

Do not change the stack without asking the user.

- Expo, latest SDK, with React Native and strict TypeScript. The initial project uses Expo SDK 57.
- Expo Router for navigation, using NativeTabs: Subjects, Daily Log, Timetable, Settings.
- expo-sqlite with Drizzle ORM. Migrations live in `src/db/migrations/`.
- Zustand for state.
- Reanimated and Gesture Handler for animation and gestures.
- react-native-svg for attendance rings.
- expo-glass-effect `GlassView` when `isGlassEffectAPIAvailable()`; otherwise expo-blur. Respect Reduce Transparency in either case.
- zod for validation, date-fns for dates, jest-expo for tests.

## Folder layout

```text
src/app/                   Thin route screens and navigator layouts only
src/features/<area>/       Feature components, hooks, and logic
src/db/                    Schema, migrations, and repositories
src/db/migrations/         Database migrations
src/lib/attendance/        Pure attendance math with 100% unit-test coverage
src/ui/                    Design tokens and shared UI components
docs/SPEC.md               Product and implementation requirements
docs/PROGRESS.md           Append-only session log
```

Shared UI components: GlassCard, Ring, Button, Sheet, Toast, EmptyState.

Routes remain in `src/app/` as required by the current `AGENTS.md`. This supersedes the earlier root-level `app/` proposal.

## Navigation and feature areas

The app has four native tabs:

- **Subjects:** subject attendance and target information.
- **Daily Log:** attendance records by date.
- **Timetable:** class slots and timetable versions.
- **Settings:** app preferences.

Detailed screen flows and fields beyond the requirements below are not yet specified.

## Attendance data rules

- Attendance totals are computed from records. Never store running totals as counters.
- A record has status `present`, `absent`, or `neutral`.
- Manual plus/minus changes create adjustment records.
- A record links to a subject, date, and timetable slot, or represents an extra class.
- Timetables have versions with `effectiveFrom` dates. Past records keep their original slot.
- Class types have a `countsAs` weight; for example, a lab may count as two classes.

### Attendance calculations

Use a target ratio `t` in the formulas below; for example, 75% is `0.75`. Let `a` be attended and `T` be total, derived from records.

- **Classes needed:** the smallest nonnegative integer `n` for which `(a + n) / (T + n) >= t`.
- **Can skip:** the largest nonnegative integer `k` for which `a / (T + k) >= t`.

Keep calculations pure in `src/lib/attendance/` and cover them with unit tests, targeting 100% coverage for that module.

### Data decisions still to resolve

- How neutral records affect the denominator.
- How signed adjustment records represent changes to attended and total values.
- Whether class recommendations count unit-weight classes or a selected class type's weight.
- Empty-history display, rounding, invalid-input handling, and representation of impossible or unbounded recommendations.
- Behavior when a subject is already below target and no nonnegative skip count satisfies the formula.
- Record uniqueness, deletion behavior, and timetable editing details.

## Visual and interaction requirements

- Use the gpt-taste skill for visual direction and the Expo native UI skill for screen implementation. Native conventions win when they conflict.
- Calm, premium, iOS-26-style direction: glass surfaces over a soft gradient background, generous spacing on an 8pt grid, one accent color, and an SF-style type scale.
- Support dark mode.
- Status colors: green for safe, amber within 3% of target, red below target. The exact amber boundary needs clarification because the wording overlaps with the below-target rule.
- Every tap that changes data provides haptic feedback and an Undo toast.
- Respect Reduce Motion and Reduce Transparency.
- Minimum touch target: 44pt.
- Every list has an empty state.
- Every async action has a loading state.
- Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Development workflow

- Start every session by reading `AGENTS.md`, `docs/SPEC.md`, and `docs/PROGRESS.md`, including instructions referenced by `AGENTS.md`.
- Write a short session plan and wait for the user's go before implementation, unless the user directly authorizes immediate work.
- Keep changes inside the session's scope. List other work as follow-ups.
- Before touching Expo or React Native APIs, check the installed Expo major version and read its matching versioned Expo documentation. Use the Expo docs index for other relevant pages.
- Install packages with `npx expo install`, never plain npm for Expo packages. Use `bunx` instead of `npx` if the project adopts Bun and has `bun.lock`.
- Prefer libraries available in Expo Go and flag anything requiring a development build.
- Do not manually create or edit generated `ios/` or `android/` projects; use app configuration and config plugins.
- Run lint, `npx tsc --noEmit`, and `npx jest` before declaring a session done. Record unavailable checks or failures explicitly.
- End every session by appending to `docs/PROGRESS.md`: what was built, files touched, known issues, and a phone test checklist.

## Scope of this specification

This file captures the user's supplied brief. Open decisions above are intentionally unresolved; additional features such as accounts, cloud sync, notifications, import/export, or widgets have not been approved.

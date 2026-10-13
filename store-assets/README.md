# BunkBuddy — Google Play branding kit

Ready-to-upload assets are in this directory. See `preview-contact-sheet.png` for the six phone graphics together and `feature-1024x500.png` for the feature graphic.

## Files

| Files | Use |
| --- | --- |
| `icon-512.png` | Google Play icon, 512 × 512, opaque square canvas in a 32-bit PNG, under 1 MiB |
| `icon-1024.png` | App icon, 1024 × 1024; referenced by `app.json` |
| `adaptive-foreground.png` | Transparent Android foreground, 1024 × 1024 |
| `adaptive-monochrome.png` | Transparent single-color Android themed icon, 1024 × 1024 |
| `adaptive-background.txt` | Android background color: `#2F5276` |
| `icon-preview-48.png` | Actual 48 × 48 readability preview |
| `feature-1024x500.png` | Google Play feature graphic, RGB PNG |
| `shot-1.png` … `shot-6.png` | Phone listing graphics, 1080 × 1920, RGB PNG, in upload order |
| `preview-contact-sheet.png` | Review sheet; do not upload as a phone screenshot |
| `preview-launcher.png` | Circular adaptive and themed launcher previews; do not upload |
| `raw/01-overview.png` | Unedited Subjects overview capture |
| `raw/02-subjects.png` | Same route, scrolled to show safe, near-target and below-target subjects |
| `raw/03-daily-log.png` | Daily Log capture |
| `raw/04-timetable.png` | Timetable capture |
| `raw/05-semester-summary.png` | Attendance history capture from `/semester-summary` |
| `raw/06-backup.png` | Backup & restore capture; offline JSON creation verified |
| `source/icon.svg`, `source/mark.svg` | Editable vector icon and transparent mark |
| `source/adaptive-foreground.svg`, `source/adaptive-monochrome.svg` | Editable launcher vectors |
| `source/feature-1024x500.html`, `source/shot-1.html` … `source/shot-6.html` | Editable graphic templates with local font/image references |
| `source/fonts/` | Exact Android Roboto font, embedded copyright notice and Apache 2.0 license |
| `brand.json` | Extracted palette, type, spacing, radii and composition decisions |
| `listing.md` | Title, short/full descriptions, ten research phrases and asset alt text |
| `capture-manifest.json` | Capture provenance, image hashes, offline test and restoration evidence |
| `verification.md`, `verification.json` | Human-readable and machine-readable asset checks |
| `package.json`, `package-lock.json` | Isolated, locked asset-tool dependencies |
| `scripts/` | Rendering, token extraction, verification and temporary capture helpers |

## Design decisions

The current `src/ui/tokens.ts`, default Ink accent in `src/features/settings/model.ts`, and superseding calm redesign in `docs/DESIGN.md` take precedence over older mockups in `design/`. The implemented app uses native system typography. Android captures and graphics use Roboto; no custom app font is invented. Corners use the real 6/8/12/14-point token family, with square Play icon artwork.

The palette is warm off-white `#F5F5F2`, near-black `#1C1C1A`, Ink `#2F5276`, green `#2E6B4F`, amber `#8A5A12` and red `#A63D35`. The feature ring's mint `#8CC7A6` is the real dark-theme present token. Its 82% is an illustrative brand graphic; the real demo overview is 85.1%.

The check is cut out of one speech-bubble silhouette. The Play canvas has no rounded outer corners, shadow or text. Launcher artwork fits within the central 50% bounding square and the central 66% circular safe zone. The mark was reviewed at 48px and at full size.

Each phone graphic uses the complete real screenshot, uniformly resized to about 78% width. No UI pixels were retouched, redrawn or cropped, and no device mask clips the capture. The frame is a thin outline. Scrolling content and the floating tab bar behave exactly as in the app; content naturally continues below the viewport.

## Capture assumptions and checks

- Captured on the existing Pixel 6a Android emulator, Android 15 / API 35. No iOS substitution was needed. Display size was temporarily set to 1080 × 1920 at density 420; all captures use light theme and a 09:41 demo status bar.
- `npx expo run:android --no-bundler --no-install` succeeded with the installed JDK 17 after overriding a stale `JAVA_HOME`. No native source was edited.
- A clean disposable database used the app's migrated SQLite schema and its migration bookkeeping. Six fictional subjects, 20 weekly classes and 202 real timetable occurrences cover August 3 through October 12, 2026. Records include safe, near-limit and below-target subjects and a class note. The fixture database is not included or committed. No academic rows were copied from the original database.
- The home and subjects list share a route. Shots 1 and 2 therefore use two genuine positions in that screen. The home implements a progress bar, so its screenshot was kept as-is.
- `/semester-summary` renders Attendance history, including a semester trend and subject breakdown. Shot 5 uses “Your semester, at a glance” to match it.
- For the offline test, Wi-Fi and mobile data settings were both zero. Tapping Share JSON backup created a local file containing one semester, six subjects and 202 attendance records and opened Android's share sheet. No destination was selected and nothing was sent. The data file itself stayed temporary; its hash is recorded in `capture-manifest.json`.
- The original database and local backups were restored while the app was stopped. All four original files matched their saved content hashes byte-for-byte. Display size and network were reset, demo status mode exited, and the restored emulator state was saved.
- Optional tablet variants were omitted because no tablet layout was captured. All six requested phone features are included.

## Rebuild the kit

From the repository root:

```sh
rtk proxy npm ci --prefix store-assets
rtk proxy node store-assets/scripts/extract-brand.mjs
rtk proxy node store-assets/scripts/render.mjs
rtk proxy node store-assets/scripts/verify.mjs
```

Rendering uses Playwright with installed Google Chrome, or its installed Chromium runtime. Set `CHROME_PATH` to an alternative Chromium executable if necessary. Rendering needs no remote fonts or images. `render.mjs` regenerates the editable vectors/templates, PNGs and preview sheets from `brand.json` and `raw/`. The exact dependencies are locked inside `store-assets/`; the app's dependency files were not changed for the kit.

`scripts/create-demo.py` accepts an existing migrated schema database and a new destination path. It refuses to overwrite a database, copies only schema and migration bookkeeping, and inserts the fixed fictional fixture. Keep both paths outside the repository. `scripts/capture.mjs` opens a route, checks its native screen title, dismisses known development notices and captures directly through adb. `SNAPSHOT_ONLY=1` captures the current screen; `SCROLL=1` scrolls first; `WAIT_MS`, `ADB` and `ANDROID_SERIAL` can be set. `scripts/launch-capture.mjs --emulator --metro` starts a local capture session and prints process IDs for cleanup. Back up and restore the emulator's database and local backups when reusing a device that holds existing work.

`scripts/record-captures.mjs` records this session's evidence and current raw-image hashes. Its fixed provenance fields describe this completed session; update those fields if making new captures.

## Validation

The verifier checks every PNG's format, channel depth, sRGB color space, dimensions and relevant file-size limits. It also checks icon opacity, transparent adaptive layers, circular safe-zone fit, monochrome channels, app configuration paths and listing character limits. Google Play listing graphics are 24-bit RGB with no alpha; the Play icon is 32-bit RGBA. Launcher and raw assets use separate verification profiles. The report records the official requirement sources.

Every final PNG was opened and reviewed. Headlines, the wordmark and tagline are spelled correctly, fit their bands and stay inside the composition. The entire screenshot remains visible within each frame. The 48px mark is legible. Transparent launcher layers were also reviewed on contrasting circular backgrounds. No generated raster image tool was needed; the requested SVG and headless HTML workflow produced the final assets.

Project validation after the icon configuration change:

- `npx expo lint`: passed, zero errors; one existing `react-hooks/exhaustive-deps` warning in `src/features/files/preview-screen.tsx:23`.
- `npx tsc --noEmit`: passed.
- Asset-tool install audit: zero vulnerabilities after using patched Sharp 0.35.5.

## Manual release steps

1. Upload `icon-512.png`, `feature-1024x500.png` and `shot-1.png` through `shot-6.png` to the English Google Play listing in that order. Paste only the title, short description and full description from `listing.md`; keyword phrases are research notes, not a Play Console field. Use the supplied alt text where supported.
2. Complete the BunkBuddy product rename before release. Only icon fields were authorized for app configuration changes here, so `expo.name`, existing installed display names, internal “Attendance Tracker” wording, splash artwork, slug and application ID remain unchanged. Preserve the existing application ID if updating the same Play app.
3. Build a fresh Android release so the new adaptive icon configuration is applied. This repo ignores its generated native directories; let Expo prebuild/CNG regenerate them for the release. An already-built debug APK still has its previous launcher resources.
4. If also releasing on iOS, update the existing explicit `ios.icon` Icon Composer override separately; it currently takes precedence over the generic PNG icon. This kit targets Google Play.
5. Complete the Play Console release requirements outside this asset task, including a public privacy policy URL, support contact, Data safety answers, content rating and a signed app bundle. Core offline tracking and local backups are represented; optional external services and share destinations may require internet access.

Requirements consulted: [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151), [Play icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications), and [Expo SDK 57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/).

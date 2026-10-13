// Low-level Android capture helper. All captures come from the installed app.
// Usage: node store-assets/scripts/capture.mjs ROUTE raw/01-overview.png
// Optional: SCROLL=1; ADB=/path/to/adb; ANDROID_SERIAL=emulator-5554.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adb = process.env.ADB ?? resolve(homedir(), 'Library/Android/sdk/platform-tools/adb');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const run = (...args) => execFileSync(adb, ['-s', serial, ...args]);
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const [route = '/', output = 'raw/01-overview.png'] = process.argv.slice(2);
if (process.env.SNAPSHOT_ONLY !== '1') {
  // A unique parameter avoids duplicate-link suppression during repeated captures.
  const path = route.replace(/^\//, '');
  run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `attendancetracker:///${path}${path.includes('?') ? '&' : '?'}capture=${Date.now()}`, 'com.bainsmayank.attendancetracker');
}
await pause(Number(process.env.WAIT_MS ?? 2500));
function state() {
  run('shell', 'uiautomator', 'dump', '/data/local/tmp/bunkbuddy-capture.xml');
  return run('exec-out', 'cat', '/data/local/tmp/bunkbuddy-capture.xml').toString();
}
let xml = state();
if (/Open debugger to view warnings|Can.t perform a React state update/.test(xml)) {
  run('shell', 'input', 'tap', '996', '1729');
  await pause(600);
  xml = state();
}
const title = { '/': /text="Subjects"/, 'daily-log': /text="Daily Log"/, 'timetable': /text="Timetable"/, 'semester-summary': /text="Attendance history"/, 'settings-backup': /text="Backup &amp; restore"/ }[route];
if (title && !title.test(xml)) throw new Error(`Expected screen title missing for ${route}; refusing to overwrite the capture.`);
if (/Unable to load script|Open debugger to view warnings|Can.t perform a React state update/.test(xml)) throw new Error('Development notice still visible; dismiss it before capture.');
if (process.env.SCROLL === '1') {
  run('shell', 'input', 'swipe', '520', '1500', '520', '650', '500');
  await pause(1500);
}
writeFileSync(resolve(root, output), run('exec-out', 'screencap', '-p'));
console.log(`Captured ${route} → ${output}`);

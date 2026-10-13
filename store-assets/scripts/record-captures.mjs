// Record reproducible capture provenance without saving the disposable demo DB.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const names=['01-overview','02-subjects','03-daily-log','04-timetable','05-semester-summary','06-backup'];
const routes=['/','/ (scrolled)','/daily-log','/timetable','/semester-summary','/settings-backup'];
const manifest={
  capturedOn:'2026-10-12',timezone:'Asia/Kolkata',platform:'Android',
  device:{avd:'Pixel_6a',systemImage:'Android 15 / API 35, Google Play arm64-v8a',physicalResolution:[1080,2400],captureResolution:[1080,1920],density:420,theme:'light',statusBar:{time:'09:41',battery:100,notifications:'hidden',wifi:'full demo indicator'}},
  app:{expoSDK:57,package:'com.bainsmayank.attendancetracker',build:'Debug APK built with npx expo run:android; JAVA_HOME overridden to installed JDK 17',sourceChangedForCaptures:false},
  fixture:{method:'Clean disposable SQLite DB created from existing migrated schema and migration bookkeeping; loaded only into the emulator while the app was stopped',script:'scripts/create-demo.py',semester:'Autumn semester',dates:['2026-08-03','2026-12-18'],target:75,subjectCount:6,weeklyClasses:20,loggedOccurrences:202,attended:172,overallPercentage:85.14851485148515,attendanceRange:[73.33333333333333,90],nearLimit:{subject:'Creative Systems',attended:24,held:31,percentage:77.41935483870968},containsPersonalData:false,fixtureDBCommitted:false},
  offlineBackup:{verified:true,wifiSetting:0,mobileDataSetting:0,action:'Tapped Share JSON backup; observed Android share sheet and parsed the newly created local file',format:'attendance-tracker/app',schemaVersion:4,semesterCount:1,subjectCount:6,occurrenceCount:202,backupSHA256:'a11c1a1da3750d281841a00bc9e5860bb4d67f16de3f4fc2366aea6b25a16afb',note:'No share destination was selected. No file was sent to another app or person.'},
  restoration:{originalDatabaseAndBackupsRestored:true,originalFilesVerifiedByteForByte:4,displaySizeReset:true,networkRestored:true,demoStatusBarExited:true},
  captures:names.map((name,i)=>({file:`raw/${name}.png`,route:routes[i],sha256:createHash('sha256').update(readFileSync(resolve(root,`raw/${name}.png`))).digest('hex'),treatment:'Raw adb screencap PNG; no pixel edits'})),
  omissions:{tablet:'Optional tablet variants omitted; no tablet layout was captured.',home:'Home and subjects are one route; two genuine scroll positions are shown.',summary:'The semester-summary route is Attendance history; shot 5 headline adjusted to match.'},
};
writeFileSync(resolve(root,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Recorded six capture hashes and offline / restoration evidence.');

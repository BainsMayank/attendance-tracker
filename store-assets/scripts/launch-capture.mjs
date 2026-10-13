// Start a disposable, detached capture session; print PIDs for explicit cleanup.
// No app source or native project files are modified.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const logs=resolve(tmpdir(),'bunkbuddy-capture-runtime');
mkdirSync(logs,{recursive:true});
function start(command,args,name) {
  const fd=openSync(resolve(logs,`${name}.log`),'a');
  const child=spawn(command,args,{cwd:repo,detached:true,stdio:['ignore',fd,fd]});
  child.unref();
  console.log(`${name}: PID ${child.pid}; ${resolve(logs,`${name}.log`)}`);
}
if(process.argv.includes('--emulator')) start(resolve(homedir(),'Library/Android/sdk/emulator/emulator'),['-avd','Pixel_6a','-no-window','-no-audio','-no-boot-anim'],'emulator');
if(process.argv.includes('--metro')) start(process.execPath,[resolve(repo,'node_modules/expo/bin/cli'),'start','--lan','--port','8081'],'metro');

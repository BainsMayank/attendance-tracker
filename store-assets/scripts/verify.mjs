import sharp from 'sharp';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MB=1024*1024;
const results=[];
function assert(ok, message, errors) { if (!ok) errors.push(message); }
function pngs(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'?[]:e.isDirectory()?pngs(resolve(dir,e.name)):e.name.endsWith('.png')?[resolve(dir,e.name)]:[]);
}
const required = ['icon-512.png','icon-1024.png','icon-preview-48.png','adaptive-foreground.png','adaptive-monochrome.png','feature-1024x500.png',...Array.from({length:6},(_,i)=>`shot-${i+1}.png`),...['01-overview','02-subjects','03-daily-log','04-timetable','05-semester-summary','06-backup'].map(n=>`raw/${n}.png`)];
const inventory = pngs(root);
for (const name of required) if (!inventory.includes(resolve(root,name))) results.push({file:name,profile:'required',dimensions:'missing',KiB:0,result:'FAIL',detail:'Missing file'});
for (const path of inventory) {
  const name=relative(root,path),bytes=readFileSync(path),errors=[];
  try {
    const meta=await sharp(bytes).metadata();
    const {width:w,height:h}=meta;
    const colorType=bytes[25], bitDepth=bytes[24];
    assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'PNG signature',errors);
    assert(meta.format==='png' && bitDepth===8,'8-bit PNG channels required',errors);
    assert(meta.space==='srgb','sRGB required',errors);
    let profile='preview / source';
    if (name==='icon-512.png') {
      profile='Play icon';
      assert(w===512&&h===512,'Must be 512×512',errors);
      assert(bytes.length<=MB,'Must be ≤1024 KiB',errors);
      assert(colorType===6,'Must be 32-bit RGBA PNG',errors);
      const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();
      let opaque=true;
      for(let p=3;p<raw.length;p+=4) if(raw[p]!==255) {opaque=false;break;}
      assert(opaque,'Square icon canvas must be fully opaque',errors);
    } else if(name==='feature-1024x500.png'||/^shot-[1-6]\.png$/.test(name)) {
      profile=name.startsWith('feature')?'Play feature':'Play phone';
      assert(colorType===2 && !meta.hasAlpha,'Must be 24-bit RGB with no alpha',errors);
      assert(bytes.length<=8*MB,'Must be ≤8 MiB (conservative upload cap)',errors);
      if(name.startsWith('feature')) assert(w===1024&&h===500,'Must be 1024×500',errors);
      else {
        assert(w===1080&&h===1920,'Requested phone size is 1080×1920',errors);
        assert(Math.min(w,h)>=320&&Math.max(w,h)<=3840,'Play dimensions 320–3840',errors);
        assert(Math.max(w,h)<=2*Math.min(w,h),'Aspect ratio must be ≤2:1',errors);
      }
    } else if(name.startsWith('raw/')) {
      profile='Android raw capture';
      assert(w===1080&&h===1920,'Consistent 1080×1920 device required',errors);
      assert(bytes.length<=8*MB,'Capture size ≤8 MiB',errors);
    } else if(name.startsWith('adaptive-')) {
      profile='Android launcher';
      assert(w===1024&&h===1024,'Must be 1024×1024',errors);
      assert(meta.hasAlpha&&colorType===6,'Transparent RGBA required',errors);
      const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let minX=w,minY=h,maxX=-1,maxY=-1, outsideCircle=false, monochrome=true;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const i=(y*w+x)*info.channels;
        if(data[i+3]===0) continue;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        if(Math.hypot(x+.5-w/2,y+.5-h/2)>w*.33) outsideCircle=true;
        if(data[i]!==data[i+1]||data[i+1]!==data[i+2]) monochrome=false;
      }
      assert(minX>=w*.17&&maxX<w*.83&&minY>=h*.17&&maxY<h*.83,'Symbol must be inside central 66%',errors);
      assert(!outsideCircle,'Symbol must also fit circular safe zone',errors);
      if(name.includes('monochrome')) assert(monochrome,'Monochrome channels must match',errors);
    } else if(name==='icon-1024.png') assert(w===1024&&h===1024,'App icon must be 1024×1024',errors);
    else if(name==='icon-preview-48.png') assert(w===48&&h===48,'Preview must be 48×48',errors);
    else if(name==='preview-contact-sheet.png') assert(w===1080&&h===1280,'Contact sheet must be 1080×1280',errors);
    else if(name==='preview-launcher.png') assert(w===1024&&h===512,'Launcher preview must be 1024×512',errors);
    else assert(false,'Unclassified PNG; assign a verification profile',errors);
    results.push({file:name,profile,dimensions:`${w}×${h}`,KiB:+(statSync(path).size/1024).toFixed(1),result:errors.length?'FAIL':'PASS',detail:errors.join('; ')||`${colorType===6?'RGBA':'RGB'}, sRGB`});
  } catch(e) { results.push({file:name,profile:'decode',dimensions:'unknown',KiB:+(bytes.length/1024).toFixed(1),result:'FAIL',detail:e.message}); }
}
const listing=readFileSync(resolve(root,'listing.md'),'utf8');
for(const [section,limit] of [['Title',30],['Short description',80],['Full description',4000]]) {
  const text=listing.split(`## ${section}\n`)[1]?.split('\n## ')[0].trim()??'';
  results.push({file:`listing.md: ${section}`,profile:'Play copy',dimensions:`${[...text].length}/${limit} chars`,KiB:'—',result:text.length&&[...text].length<=limit?'PASS':'FAIL',detail:text.length?'Character count':'Missing section'});
}
const config=JSON.parse(readFileSync(resolve(root,'../app.json'))).expo;
const appPaths=[config.icon, config.android.adaptiveIcon.foregroundImage,config.android.adaptiveIcon.monochromeImage];
const configOK=appPaths.every(p=>typeof p==='string'&&p.startsWith('./store-assets/')&&inventory.includes(resolve(root,'..',p)))&&config.android.adaptiveIcon.backgroundColor==='#2F5276'&&!config.android.adaptiveIcon.backgroundImage;
results.push({file:'app.json',profile:'Icon configuration',dimensions:'3 asset paths',KiB:'—',result:configOK?'PASS':'FAIL',detail:'Background image must not override the chosen color'});
console.table(results);
const report={checkedAt:new Date().toISOString(),sources:['https://support.google.com/googleplay/android-developer/answer/9866151','https://developer.android.com/distribute/google-play/resources/icon-design-specifications','https://docs.expo.dev/versions/v57.0.0/config/app/'],notes:['8 MiB is a conservative kit cap for graphic uploads; icon hard limit is 1024 KiB.','Raw captures and launcher assets are not Play listing uploads; their profiles are checked separately.','Visual review is recorded separately in README.md.'],results};
writeFileSync(resolve(root,'verification.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(root,'verification.md'),'# Asset verification\n\n| File | Profile | Dimensions / copy count | KiB | Result |\n| --- | --- | --- | ---: | --- |\n'+results.map(r=>`| ${r.file} | ${r.profile} | ${r.dimensions} | ${r.KiB} | ${r.result} |`).join('\n')+'\n\nRequirements: [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151). Launcher and raw capture files are checked against their own profiles.\n');
if(results.some(r=>r.result==='FAIL')) process.exitCode=1;

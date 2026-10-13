import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'source');
mkdirSync(source, { recursive: true });
const brand = JSON.parse(readFileSync(resolve(root, 'brand.json')));
const c = brand.colors;
const body = `<path d="M340 256H684A84 84 0 0 1 768 340V596A84 84 0 0 1 684 680H454L292 768V670A84 84 0 0 1 256 596V340A84 84 0 0 1 340 256Z"/>`;
const check = `<path d="M401 470L482 549L628 393" fill="none" stroke="black" stroke-width="76" stroke-linecap="round" stroke-linejoin="round"/>`;
function symbol(fill) {
  return `<defs><mask id="check"><rect width="1024" height="1024" fill="white"/>${check}</mask></defs><g fill="${fill}" mask="url(#check)">${body}</g>`;
}
const svg = (contents) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${contents}</svg>`;
const icon = svg(`<rect width="1024" height="1024" fill="${c.accent}"/>${symbol(c.surface)}`);
const foreground = svg(symbol(c.surface));
const monochrome = svg(symbol('#000000'));
writeFileSync(resolve(source, 'icon.svg'), icon);
writeFileSync(resolve(source, 'mark.svg'), foreground);
writeFileSync(resolve(source, 'adaptive-foreground.svg'), foreground);
writeFileSync(resolve(source, 'adaptive-monochrome.svg'), monochrome);
writeFileSync(resolve(root, 'adaptive-background.txt'), c.accent+'\n');
const svgInput = (s) => Buffer.from(s);
await sharp(svgInput(icon)).resize(512).ensureAlpha().png({ compressionLevel: 9 }).toFile(resolve(root, 'icon-512.png'));
await sharp(svgInput(icon)).ensureAlpha().png({ compressionLevel: 9 }).toFile(resolve(root, 'icon-1024.png'));
await sharp(svgInput(icon)).resize(48).ensureAlpha().png().toFile(resolve(root, 'icon-preview-48.png'));
await sharp(svgInput(foreground)).ensureAlpha().png({ compressionLevel: 9 }).toFile(resolve(root, 'adaptive-foreground.png'));
await sharp(svgInput(monochrome)).ensureAlpha().png({ compressionLevel: 9 }).toFile(resolve(root, 'adaptive-monochrome.png'));
const previewParts = [
  { input: await sharp(svgInput(svg(`<circle cx="512" cy="512" r="512" fill="${c.accent}"/>${symbol(c.surface)}`))).resize(512).toBuffer(), left: 0, top: 0 },
  { input: await sharp(svgInput(svg(`<circle cx="512" cy="512" r="512" fill="${brand.graphicMint}"/>${symbol(c.textPrimary)}`))).resize(512).toBuffer(), left: 512, top: 0 },
];
await sharp({create:{width:1024,height:512,channels:3,background:c.background}}).composite(previewParts).removeAlpha().png().toFile(resolve(root,'preview-launcher.png'));
const iconURL = '../icon-512.png';
const styles = `@font-face{font-family:Roboto;src:url('./fonts/Roboto-Regular.ttf') format('truetype');font-weight:100 900}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Roboto,sans-serif;color:${c.textPrimary};background:${c.background};font-variant-numeric:tabular-nums}h1,p{margin:0}`;
const template = (css, contents) => `<!doctype html><html lang="en"><meta charset="utf-8"><style>${styles}${css}</style><body>${contents}</body></html>`;
const defaultChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH ?? (existsSync(chromium.executablePath()) ? chromium.executablePath() : defaultChrome);
const browser = await chromium.launch({ executablePath, headless: true });
async function render(name, html, width, height) {
  writeFileSync(resolve(source, `${name}.html`), html);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(resolve(source, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    const overflow = await page.locator('h1, .tagline, .brand').evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth+1 || n.scrollHeight > n.clientHeight+1).map(n=>n.textContent));
    if (overflow.length) throw new Error(`Text overflow in ${name}: ${overflow.join(', ')}`);
    const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
    await sharp(screenshot).removeAlpha().toColourspace('srgb').png({ compressionLevel: 9 }).toFile(resolve(root, `${name}.png`));
    console.log(`Rendered ${name}.png (${width} × ${height})`);
  } finally { await page.close(); }
}
try {
  const circumference = 2*Math.PI*84;
  const gauge = `<svg width="208" height="208" viewBox="0 0 208 208" aria-label="Illustrative 82 percent attendance gauge"><circle cx="104" cy="104" r="84" fill="none" stroke="${c.separator}" stroke-width="15"/><circle cx="104" cy="104" r="84" fill="none" stroke="${brand.graphicMint}" stroke-width="15" stroke-dasharray="${circumference*.82} ${circumference*.18}" stroke-linecap="round" transform="rotate(-90 104 104)"/><text x="104" y="111" text-anchor="middle" fill="${c.textPrimary}" font-family="Roboto" font-size="47" font-weight="600">82%</text><text x="104" y="137" text-anchor="middle" fill="${c.textSecondary}" font-family="Roboto" font-size="13">Attendance</text></svg>`;
  const calendar = Array.from({length:20}, (_,i)=>`<span class="cell ${[0,1,2,5,6,7,10,11,12,15,16].includes(i)?'marked':''}">${[0,1,2,5,6,7,10,11,12,15,16].includes(i)?'<svg width="16" height="16" viewBox="0 0 24 24"><path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</span>`).join('');
  await render('feature-1024x500', template(`.brand{position:absolute;left:82px;top:144px;display:flex;align-items:center;gap:18px;height:56px;white-space:nowrap;font-weight:600;font-size:45px;letter-spacing:-1.5px}.brand img{width:52px;height:52px}.tagline{position:absolute;left:82px;top:232px;font-size:31px;line-height:40px;letter-spacing:-.6px}.descriptor{position:absolute;left:82px;top:302px;font-size:18px;color:${c.textSecondary}}.gauge{position:absolute;left:548px;top:146px}.calendar{position:absolute;left:791px;top:164px;width:151px}.calendar-head{font-size:14px;font-weight:500;color:${c.textSecondary};padding-bottom:18px}.grid{display:grid;grid-template-columns:repeat(5,23px);gap:9px}.cell{width:23px;height:23px;border-radius:${brand.radii.small}px;background:${c.surfaceRaised};display:grid;place-items:center}.marked{background:${c.presentSubtle};color:${c.present}}`, `<div class="brand"><img src="${iconURL}" alt="BunkBuddy check and speech bubble mark"><span>BunkBuddy</span></div><p class="tagline">Know your safe skips.</p><p class="descriptor">Student attendance tracker</p><div class="gauge">${gauge}</div><div class="calendar"><div class="calendar-head">Your week, in view</div><div class="grid">${calendar}</div></div>`), 1024, 500);
  const shots = [
    ['01-overview', 'Know your<br>safe skips'],
    ['02-subjects', 'Every subject,<br>one view'],
    ['03-daily-log', 'Mark attendance<br>in a tap'],
    ['04-timetable', 'Your timetable,<br>sorted'],
    ['05-semester-summary', 'Your semester,<br>at a glance'],
    ['06-backup', 'Private, offline,<br>yours'],
  ];
  for (let i=0;i<shots.length;i++) {
    const [name, headline] = shots[i];
    const rawPath = resolve(root, `raw/${name}.png`);
    const meta = await sharp(rawPath).metadata();
    if (meta.width !== 1080 || meta.height !== 1920) throw new Error(`Unexpected capture dimensions: ${name}`);
    await render(`shot-${i+1}`, template(`.brand{position:absolute;left:119px;top:49px;display:flex;gap:12px;align-items:center;font-size:28px;font-weight:500;line-height:36px;color:${c.accent}}.brand img{width:32px;height:32px}h1{position:absolute;left:119px;top:116px;width:850px;height:168px;font-size:76px;line-height:82px;letter-spacing:-2px;font-weight:600}.device{position:absolute;left:111px;top:342px;width:858px;height:1513px;border:2px solid ${c.controlBorder};border-radius:${brand.radii.summary}px;padding:6px;background:${c.surface}}.screen{display:block;width:842px;height:auto}`, `<div class="brand"><img src="${iconURL}" alt=""><span>BunkBuddy</span></div><h1>${headline}</h1><div class="device"><img class="screen" src="../raw/${name}.png" alt="Unedited app screenshot"></div>`),1080,1920);
  }
  const previews=[];
  for(let i=1;i<=6;i++) previews.push({input:await sharp(resolve(root,`shot-${i}.png`)).resize(360,640).toBuffer(),left:((i-1)%3)*360,top:Math.floor((i-1)/3)*640});
  await sharp({create:{width:1080,height:1280,channels:3,background:c.background}}).composite(previews).png().toFile(resolve(root,'preview-contact-sheet.png'));
} finally { await browser.close(); }

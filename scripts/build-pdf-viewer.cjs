// PDF.js runs inside the WebView, never in Hermes. Rebuild after changing its pinned version.
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "..");
const bundle = name => esbuild.transformSync(fs.readFileSync(path.join(root, "node_modules/pdfjs-dist/build", name), "utf8"), { format: "iife", target: "es2020", minify: true }).code.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; worker-src blob:"><style>
html{color-scheme:light dark}body{margin:0;background:#e8e9ee;color:#171923;font:17px -apple-system,system-ui,sans-serif}header{position:sticky;top:0;z-index:2;background:#fff;padding:8px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px}button{min-width:48px;min-height:48px;background:#eeeeff;color:#4144d8;border:0;border-radius:8px;font:inherit;padding:8px}button:disabled{opacity:.4}#pages{overflow:auto;padding:12px;text-align:center}canvas{background:white;display:block;margin:auto}#error{padding:20px}#status{font-variant-numeric:tabular-nums}@media(prefers-color-scheme:dark){body{background:#101116;color:#f5f6fc}header{background:#1b1d26}button{background:#292b4e;color:#b2b4ff}}
</style></head><body><header><button id="prev" aria-label="Previous page">‹</button><span id="status" role="status">Opening PDF…</span><button id="next" aria-label="Next page">›</button><button id="minus" aria-label="Zoom out">−</button><button id="plus" aria-label="Zoom in">+</button></header><p id="error" role="alert" hidden></p><main id="pages"><canvas id="page" aria-label="PDF page"></canvas></main><script>
if(!Promise.withResolvers)Promise.withResolvers=function(){var resolve,reject;var promise=new Promise(function(a,b){resolve=a;reject=b});return{promise:promise,resolve:resolve,reject:reject}};
${bundle("pdf.worker.mjs")}
${bundle("pdf.mjs")}
</script><script>
const bytes=Uint8Array.from(atob(__PDF_DATA__),c=>c.charCodeAt(0));
let doc,page=1,zoom=1,busy=false;
function fail(e){const message=String(e.message||e);document.getElementById('error').hidden=false;document.getElementById('error').textContent=message;document.getElementById('status').textContent='Preview unavailable';window.ReactNativeWebView?.postMessage(JSON.stringify({error:message}));}
async function render(){if(!doc||busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{const p=await doc.getPage(page);const base=p.getViewport({scale:1});const width=Math.min(innerWidth-24,1000)*zoom;const view=p.getViewport({scale:width/base.width});const canvas=document.getElementById('page');const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(view.width*ratio);canvas.height=Math.floor(view.height*ratio);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';await p.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:[ratio,0,0,ratio,0,0]}).promise;p.cleanup();document.getElementById('status').textContent=page+' / '+doc.numPages;canvas.setAttribute('aria-label','PDF page '+page+' of '+doc.numPages);window.ReactNativeWebView?.postMessage(JSON.stringify({ready:true,page,pages:doc.numPages}));}catch(e){fail(e)}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);document.getElementById('prev').disabled=page<=1;document.getElementById('next').disabled=page>=doc.numPages;}}
document.getElementById('prev').onclick=()=>{if(page>1){page--;render()}};document.getElementById('next').onclick=()=>{if(page<doc.numPages){page++;render()}};document.getElementById('minus').onclick=()=>{zoom=Math.max(.5,zoom-.25);render()};document.getElementById('plus').onclick=()=>{zoom=Math.min(3,zoom+.25);render()};
const task=pdfjsLib.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true});task.onPassword=()=>{task.destroy();fail(new Error('Password-protected PDFs can be opened through Share.'))};task.promise.then(d=>{doc=d;render()}).catch(fail);
</script></body></html>`;
fs.mkdirSync(path.join(root, "assets/files"), { recursive: true });
fs.writeFileSync(path.join(root, "assets/files/pdf-viewer.html"), html);
fs.copyFileSync(path.join(root, "node_modules/pdfjs-dist/LICENSE"), path.join(root, "assets/files/PDFJS-LICENSE.txt"));
console.log(`Offline PDF viewer: ${Buffer.byteLength(html)} bytes`);

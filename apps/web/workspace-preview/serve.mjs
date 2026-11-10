import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const names=['index.html','styles.css','app.js','data.js','store.js','ui.js','editors.js','pages/home.js','pages/manage.js','pages/study.js','pages/learning.js','pages/about.js'];
// Preview equivalent of build-time metadata injection; no business API or database.
const [product,manifest]=await Promise.all(['../../../product-info.json','../../../package.json'].map(path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse)));
const productModule=`export const productInfo = ${JSON.stringify({...product,version:manifest.version})};\n`;
const routes=new Map(names.map(n=>['/'+n,new URL(n,import.meta.url)]));
routes.set('/',new URL('index.html',import.meta.url));
routes.set('/assets/logo.svg',new URL('../../../memory-bank/logo/题匣-logo-透明版.svg',import.meta.url));
routes.set('/assets/serif.woff2',new URL('../dashboard-lab/fonts/SourceHanSerifCN-VF.woff2',import.meta.url));
createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost'),file=routes.get(url.pathname);if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}if(url.pathname==='/product-info.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:productModule);return;}if(!file){res.writeHead(404).end('Not found');return;}try{const body=await readFile(file);const ext=file.pathname.split('.').pop();res.writeHead(200,{'Content-Type':({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',woff2:'font/woff2'})[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500).end('Unable to load preview');}}).listen(4177,'127.0.0.1',()=>console.log('Quarry workspace: http://127.0.0.1:4177/'));

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const allowed = new Set(['style-explorer.html', 'a-desk.html', 'b-instrument.html', 'c-trail.html', 'manifest.json', 'content.json', 'fonts/SourceHanSerifCN-VF.woff2', 'fonts/LICENSE.txt']);
const contentType = name => name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.json') ? 'application/json; charset=utf-8' : name.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8';
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'style-explorer.html';
  if (name === 'favicon.ico') { response.writeHead(204).end(); return; }
  if (!allowed.has(name)) { response.writeHead(404).end('Not found'); return; }
  try {
    const body = await readFile(new URL(name, import.meta.url));
    response.writeHead(200, { 'Content-Type': contentType(name), 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500).end('Unable to read preview'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4176, '127.0.0.1', () => console.log('Quarry dashboard preview: http://127.0.0.1:4176/'));

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// This server exposes only the design artifacts, never the workspace directory.
const files = new Map([
  ['/', ['style-explorer.html', 'text/html']],
  ['/style-explorer.html', ['style-explorer.html', 'text/html']],
  ['/a-archive.html', ['a-archive.html', 'text/html']],
  ['/b-folios.html', ['b-folios.html', 'text/html']],
  ['/c-studio.html', ['c-studio.html', 'text/html']],
  ['/manifest.json', ['manifest.json', 'application/json']],
  ['/content.json', ['content.json', 'application/json']],
]);

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(new URL(entry[0], import.meta.url));
    response.writeHead(200, {
      'Content-Type': `${entry[1]}; charset=utf-8`,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end('Unable to read preview file');
  }
});
server.on('error', error => {
  console.error(`Preview server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(4175, '127.0.0.1', () => {
  console.log('Quarry style lab: http://127.0.0.1:4175/');
});

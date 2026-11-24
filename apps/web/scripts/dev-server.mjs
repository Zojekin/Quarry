import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

export async function startVite() {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 5173, strictPort: false },
  });
  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('Vite did not provide a local URL');
    server.printUrls();
    return { url, stop: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}

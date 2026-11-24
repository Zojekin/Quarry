export async function runDevelopment(start) {
  const shutdown = new AbortController();
  const interrupt = () => shutdown.abort();
  const cleanup = [];
  const stopped = new Promise(resolve => shutdown.signal.addEventListener('abort', resolve, { once: true }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, interrupt);
  try {
    await start(shutdown.signal, stop => cleanup.unshift(stop), stopped);
  } finally {
    for (const stop of cleanup) {
      try { await stop(); }
      catch (error) { console.error(error); process.exitCode = 1; }
    }
    for (const signal of ['SIGINT', 'SIGTERM']) process.off(signal, interrupt);
  }
}

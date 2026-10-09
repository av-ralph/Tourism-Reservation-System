import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Run Vite and Nest in one process so Windows loopback restrictions do not
// isolate the frontend proxy from a separately started backend.
const backendDirectory = fileURLToPath(new URL('..', import.meta.url));
process.chdir(backendDirectory);
let app, vite, stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await vite?.close();
  await app?.close();
}
process.on('SIGINT', () => stop().then(() => process.exit(0)));
process.on('SIGTERM', () => stop().then(() => process.exit(0)));
try {
  console.log('Preparing the reservation system…');
  await promisify(execFile)(process.execPath, [resolve('node_modules/@nestjs/cli/bin/nest.js'), 'build'], { cwd: backendDirectory, maxBuffer: 1024 * 1024 });
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../dist/app.module.js');
  const { RecordStore } = await import('../dist/record-store.js');
  const { createServer } = await import('../../frontend/node_modules/vite/dist/node/index.js');
  const { default: websiteConfig } = await import('../../frontend/vite.config.js');
  app = await NestFactory.create(AppModule, { logger: ['warn', 'error'] });
  await app.listen(Number(process.env.PORT || 3001), '127.0.0.1');
  const backendUrl = await app.getUrl();
  vite = await createServer({
    root: resolve('../frontend'), configFile: resolve('../frontend/vite.config.js'),
    server: { host: '127.0.0.1', port: Number(process.env.DEV_WEB_PORT || 5174), strictPort: true,
      proxy: { '/api': { ...websiteConfig.server.proxy['/api'], target: backendUrl } } },
  });
  await vite.listen();
  const webUrl = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const response = await fetch(webUrl + '/api/records', { headers: { 'X-User-Session': randomUUID() }, signal: AbortSignal.timeout(10000) });
  if (!response.ok || !Array.isArray((await response.json()).reservations)) throw new Error('The website could not reach the reservation backend.');
  const schedule = await fetch(webUrl + '/api/schedule', { signal: AbortSignal.timeout(10000) });
  if (!schedule.ok || !Array.isArray(await schedule.json())) throw new Error('The facility schedule check failed.');
  const facilities = await fetch(webUrl + '/api/facilities', { signal: AbortSignal.timeout(10000) });
  if (!facilities.ok || !Array.isArray(await facilities.json())) throw new Error('The facility list check failed.');
  if (process.env.HM_ADMIN_KEY) {
    const admin = await fetch(webUrl + '/api/admin/records', { headers: { Authorization: 'Bearer ' + process.env.HM_ADMIN_KEY }, signal: AbortSignal.timeout(10000) });
    if (!admin.ok || !Array.isArray((await admin.json()).reservations)) throw new Error('The administrator connection check failed.');
  }
  console.log(`Website ready: ${webUrl}/`);
  console.log(`Admin portal: ${webUrl}/admin`);
  console.log(`Storage: ${app.get(RecordStore).mode}. Website-to-backend checks passed.`);
} catch (error) {
  await stop();
  const code = error?.code;
  console.error(code === 'EADDRINUSE' ? 'A reservation server is already using this port. Stop the previous server before restarting.'
    : 'The reservation system could not start. Check backend configuration and database connectivity. Credentials were not printed.');
  process.exitCode = 1;
}

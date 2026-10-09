import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js';
import websiteConfig from '../../frontend/vite.config.js';
let app, vite;
try {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  vite = await createServer({ root: resolve('../frontend'), configFile: resolve('../frontend/vite.config.js'), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: true, proxy: { '/api': { ...websiteConfig.server.proxy['/api'], target: await app.getUrl() } } } });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}/api`;
  const user = await fetch(base + '/records', { headers: { 'X-User-Session': randomUUID() } });
  assert.equal(user.status, 200); assert.ok(Array.isArray((await user.json()).reservations));
  const denied = await fetch(base + '/admin/records'); assert.equal(denied.status, 401); await denied.json();
  const admin = await fetch(base + '/admin/records', { headers: { Authorization: 'Bearer ' + process.env.HM_ADMIN_KEY } });
  assert.equal(admin.status, 200); assert.ok(Array.isArray((await admin.json()).reports));
  await app.close(); app = undefined;
  const outage = await fetch(base + '/schedule'); assert.equal(outage.status, 502); assert.ok((await outage.json()).message);
  console.log('Live website/backend and outage checks passed: valid records, admin access checks, and a readable JSON response when the backend stops. No records changed.');
} catch {
  console.error('Live HTTP verification failed. Credentials and record contents were not printed.'); process.exitCode = 1;
} finally { await vite?.close(); await app?.close(); }

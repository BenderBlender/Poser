import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import express from 'express';
import { createApp } from './backend/app.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) loadEnvFile(envFile);
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
if (process.argv.includes('--print-port')) { console.log(port); process.exit(0); }
const app = createApp({ root });
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
if (production) {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Сначала выполните npm run build.');
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () => console.log(`Pose Studio: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => {
  app.locals.closeSubscription(); server.close(); setTimeout(() => process.exit(0),250).unref();
});

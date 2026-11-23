// Explicit opt-in only. This test spends subscription image-generation usage.
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const status = await (await fetch('http://127.0.0.1:3000/api/status')).json();
if (!status.codex?.ready) throw new Error(status.codex?.message || 'Мост Codex не подключён.');
const character = await fs.readFile(path.join(root,'docs/examples/direct-vs-guided/reference-character.png'));
const pose = await fs.readFile(path.join(root,'docs/examples/direct-vs-guided/reference-pose.jpg'));
const started = Date.now();
console.log('Запущен сквозной тест через локальный поузер и перенесённый мост Codex.');
const response = await fetch('http://127.0.0.1:3000/api/codex/generate-pose', {
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    characterBase64:character.toString('base64'),characterMimeType:'image/png',
    poseImageDataUrl:`data:image/jpeg;base64,${pose.toString('base64')}`,
    workflow:'direct',aspectRatio:'1:1',count:1,
  }),signal:AbortSignal.timeout(16*60*1000),
});
const body = await response.json();
if(!response.ok) throw new Error(body.error || String(response.status));
const dataUrl = body.results?.[0]?.imageUrl;
if(typeof dataUrl !== 'string') throw new Error('Нет результата изображения.');
const output = path.join(root,'output/test-subscription-bridge.png');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output,Buffer.from(dataUrl.split(',')[1],'base64'));
const report = { passed:true,transport:'HTTP /api/codex/generate-pose → packaged ImageBridge → codex exec → built-in image generation',apiKeyConfigured:status.configured,subscriptionReady:status.codex.ready,codexVersion:status.codex.version,elapsedSeconds:Math.round((Date.now()-started)/1000),output };
await fs.writeFile(path.join(root,'output/subscription-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

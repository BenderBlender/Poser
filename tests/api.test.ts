import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../backend/app.ts';
import { createImageEditor } from '../backend/openai.ts';
import type { ImageEditRequest } from '../backend/openai.ts';
import { collectSourceFiles } from '../backend/archive.ts';
import { createSubscriptionService } from '../backend/subscription.ts';
import { parseOptions, HttpError } from '../backend/validation.ts';
import { ASPECT_RATIOS, IMAGE_SIZES, resolveDimensions } from '../shared/imageSettings.ts';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6WQAAAAASUVORK5CYII=';
const image = `data:image/png;base64,${png}`;
const jpeg = `data:image/jpeg;base64,${Buffer.from([255,216,255,224,0,16,74,70,73,70,0]).toString('base64')}`;
const input = { characterBase64: png, characterMimeType: 'image/png', poseImageDataUrl: jpeg };

async function fixture(t: TestContext, configured = true, root = process.cwd()) {
  const calls: ImageEditRequest[] = [];
  const app = createApp({ root, apiKey: () => configured ? 'test-only-key' : undefined,
    subscription: { status: async () => ({ready:true,message:'Test bridge'}), edit: async (req: ImageEditRequest) => { calls.push(req); return Array.from({length:req.options.count},(_,i) => ({id:String(i),imageUrl:image,text:null})); } },
    ...(configured ? { editor: async (req: ImageEditRequest) => { calls.push(req); return Array.from({ length: req.options.count }, (_, i) => ({ id: String(i), imageUrl: image, text: null })); } } : {}),
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (route: string, body: unknown) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { calls, base, post };
}

test('direct transfer uses character then pose, with one default output', async t => {
  const { calls, post } = await fixture(t);
  const res = await post('/api/openai/generate-pose', input);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).results.length, 1);
  assert.deepEqual(calls[0].images, [image, jpeg]);
  assert.equal(calls[0].options.model, 'gpt-image-2.6-sunburst');
  assert.match(calls[0].prompt, /Do not copy the person/);
});
test('guided transfer first extracts wireframe, then uses only character and guide', async t => {
  const { calls, post } = await fixture(t);
  const guide = await post('/api/openai/extract-pose-skeleton', { poseImageBase64: jpeg.split(',')[1], poseMimeType: 'image/jpeg', mode: 'perspective-wireframe', count: 3, imageSize: '4K' });
  assert.equal(guide.status, 200);
  const result = await guide.json();
  const res = await post('/api/openai/generate-pose', { ...input, skeletonDataUrl: result.base64, workflow: 'guided', count: 2 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).results.length, 2);
  assert.equal(calls[0].options.count, 1);
  assert.equal(calls[0].options.imageSize, '1K');
  assert.match(calls[0].prompt, /surface wireframe.*ground grid/);
  assert.deepEqual(calls[1].images, [image, image]);
  assert.match(calls[1].prompt, /neutral mannequin/);
  assert.ok(!calls[1].images.includes(jpeg));
});
test('refinement retains image/reference order and forces one output', async t => {
  const { calls, post } = await fixture(t);
  const res = await post('/api/openai/enhance-image', { imageToEnhanceDataUrl: image, userPrompt: 'Fix the sleeve', referenceImages: [{ label: 'ORIGINAL_CHARACTER_STYLE', dataUrl: jpeg }], count: 3 });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).result.imageUrl);
  assert.deepEqual(calls[0].images, [image, jpeg]);
  assert.equal(calls[0].options.count, 1);
  assert.match(calls[0].prompt, /Image 2.*ORIGINAL_CHARACTER_STYLE/);
});
test('missing key allows prompt export, but reports generation unavailable', async t => {
  const { base, post } = await fixture(t, false);
  assert.equal((await (await fetch(base + '/api/status')).json()).configured, false);
  const prompt = await post('/api/chatgpt-prompt', { workflow: 'guided', mode: 'perspective-wireframe', referenceCount: 2 });
  assert.equal(prompt.status, 200);
  const data = await prompt.json();
  assert.match(data.skeletonPrompt, /surface wireframe/);
  assert.match(data.prompt, /Images 3 through 4/);
  assert.equal((await post('/api/openai/generate-pose', input)).status, 503);
});
test('invalid inputs and cross-site requests are rejected before paid work', async t => {
  const { calls, base, post } = await fixture(t);
  for (const change of [
    { count: 4 }, { model: 'gemini-2.5-flash-image' }, { aspectRatio: '4:1' }, { quality: 'bogus' },
    { generationPrompt: {} }, { referenceImages: Array(9).fill({ data: png, mimeType: 'image/png' }) },
    { poseImageDataUrl: 'https://example.com/image.png' }, { characterBase64: 'bm90YW5pbWFnZQ==' },
    { workflow: 'guided' },
  ]) assert.equal((await post('/api/openai/generate-pose', { ...input, ...change })).status, 400);
  const crossSite = await fetch(base + '/api/chatgpt-prompt', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(crossSite.status, 403);
  assert.equal((await post('/api/gemini/generate-pose', input)).status, 404);
  assert.equal(calls.length, 0);
});
test('all UI dimension presets obey API bounds and advertised aspect ratio', () => {
  for (const ratio of ASPECT_RATIOS) for (const size of IMAGE_SIZES) {
    const [w,h] = resolveDimensions(ratio,size).split('x').map(Number);
    const [rw,rh] = ratio.split(':').map(Number);
    assert.equal(w%16,0); assert.equal(h%16,0); assert.equal(w*rh,h*rw);
    assert.ok(Math.max(w,h)<=3840); assert.ok(w*h>=655360 && w*h<=8294400);
  }
});
test('OpenAI adapter sends documented JSON images edit request without legacy parameters', async () => {
  let body: any;
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(init?.method, 'POST');
    body = JSON.parse(String(init?.body));
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-only');
    return Response.json({ data: [{ b64_json: png }] });
  };
  const result = await createImageEditor(() => 'test-only', fetcher)({ images: [image,jpeg], prompt: 'pose transfer', options: parseOptions({}) });
  assert.deepEqual(body.images, [{ image_url: image }, { image_url: jpeg }]);
  assert.equal(body.size, '1024x1024'); assert.equal(body.n,1);
  assert.equal(body.output_format,'png'); assert.equal(body.input_fidelity,undefined);
  assert.equal(result[0].imageUrl,image);
});
test('OpenAI errors are sanitized and never automatically retried', async () => {
  let attempts = 0;
  const fetcher: typeof fetch = async () => { attempts++; return Response.json({ error: { message: 'sensitive upstream text' } }, { status: 401 }); };
  await assert.rejects(createImageEditor(() => 'test-only', fetcher)({ images:[image], prompt:'test', options:parseOptions({}) }), (error: HttpError) => error.status === 401 && !error.message.includes('sensitive'));
  assert.equal(attempts,1);
});
test('empty, partial and timed-out upstream replies produce explicit errors', async () => {
  for (const data of [[], [{}]]) {
    const fetcher: typeof fetch = async () => Response.json({ data });
    await assert.rejects(createImageEditor(() => 'test',fetcher)({images:[image],prompt:'test',options:parseOptions({})}), (error:HttpError) => error.status === 502);
  }
  const fetcher: typeof fetch = async () => { throw new DOMException('timeout','TimeoutError'); };
  await assert.rejects(createImageEditor(() => 'test',fetcher)({images:[image],prompt:'test',options:parseOptions({})}), (error:HttpError) => error.status === 504);
});
test('source export excludes secrets and generated assets', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'pose-export-test-'));
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + 'pose-export-test-'));
    fs.rmSync(dir,{recursive:true,force:true});
  });
  fs.writeFileSync(path.join(dir,'App.tsx'),'source');
  for (const file of ['.env','.env.local','.env.production','private-key.pem','test.png']) fs.writeFileSync(path.join(dir,file),'private');
  const exported = collectSourceFiles(dir);
  assert.deepEqual(Object.keys(exported),['App.tsx']);
});

test('subscription endpoints generate, extract and refine without an API key', async t => {
  const { base, calls, post } = await fixture(t,false);
  const status = await (await fetch(base+'/api/status')).json();
  assert.equal(status.configured,false); assert.equal(status.codex.ready,true);
  assert.equal((await post('/api/codex/generate-pose',input)).status,200);
  assert.equal((await post('/api/codex/extract-pose-skeleton',{poseImageBase64:png,poseMimeType:'image/png',mode:'perspective-wireframe'})).status,200);
  assert.equal((await post('/api/codex/enhance-image',{imageToEnhanceDataUrl:image})).status,200);
  assert.equal(calls.length,3); assert.match(calls[1].prompt,/surface wireframe/);
  assert.equal((await post('/api/openai/generate-pose',input)).status,503);
});
test('subscription adapter writes ordered references and returns bridge result without API settings', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'pose-subscription-test-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'pose-subscription-test-')); fs.rmSync(root,{recursive:true,force:true}); });
  const output = path.join(root,'result.png'); fs.writeFileSync(output,Buffer.from(png,'base64'));
  const starts: any[] = [];
  const bridge = { status: async () => ({ready:true,message:'ready',version:'test'}),
    start: async (request: any) => { starts.push(request); return {job_id:String(starts.length)}; },
    result: async () => ({status:'completed',images:[{path:output,mime_type:'image/png'}]}), close: () => {},
  };
  const subscription = createSubscriptionService(root,bridge as any);
  const result = await subscription.edit({images:[image,jpeg],prompt:'Exact brief',options:parseOptions({count:2})});
  assert.equal(result.length,2); assert.equal(starts.length,2);
  assert.equal(starts[0].prompt,'Exact brief');
  assert.equal(starts[0].reference_images.length,2);
  assert.ok(starts[0].reference_images[0].endsWith('reference-1.png'));
  assert.ok(starts[0].reference_images[1].endsWith('reference-2.jpg'));
  assert.equal(starts[0].model,undefined); assert.equal(starts[0].quality,undefined);
  assert.equal(result[0].imageUrl,image);
});

test('subscription quota exhaustion is reported as 429 without retrying', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'pose-quota-test-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'pose-quota-test-')); fs.rmSync(root,{recursive:true,force:true}); });
  let starts=0;
  const bridge = { status:async()=>({ready:true,message:'ready'}),start:async()=>{starts++;return {job_id:'test'};},result:async()=>({status:'failed',message:'You have hit your usage limit.'}),close:()=>{} };
  const service=createSubscriptionService(root,bridge as any);
  await assert.rejects(service.edit({images:[image,jpeg],prompt:'test',options:parseOptions({count:3})}), (error:HttpError)=>error.status===429 && error.message.includes('Лимит'));
  assert.equal(starts,1);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageBridge, generationArgs, subscriptionEnv, isWithin, run } from '../vendor/codex-image-bridge/bridge.js';
const base = path.resolve('tmp/tests');
await mkdir(base, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfmcAAAAASUVORK5CYII=', 'base64');
const thread = '00000000-0000-0000-0000-000000000001';
async function fixture(mode = 'ok') {
  const root = await mkdtemp(path.join(base, 'bridge-'));
  let starts = 0;
  const runner = async (command, args, opts = {}) => {
    if (args[0] === 'login') return { code: 0, stdout: mode === 'api' ? 'Logged in using an API key: sk-secret' : '', stderr: mode === 'api' ? '' : 'Logged in using ChatGPT' };
    if (args[0] === '--version') return { code: 0, stdout: 'codex-cli fixture', stderr: '' };
    starts++;
    if (mode === 'cancel') return new Promise((resolve, reject) => {
      const abort = () => reject(new Error('cancelled'));
      if (opts.signal.aborted) abort(); else opts.signal.addEventListener('abort', abort, { once: true });
    });
    opts.onEvent({ type: 'thread.started', thread_id: mode === 'traversal' ? '../private' : thread });
    if (mode === 'failed') { opts.onEvent({ type: 'turn.failed', error: { message: 'quota exceeded' } }); return { code: 1 }; }
    if (mode !== 'no-image') {
      const dir = path.join(root, 'generated_images', thread);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'output.png'), png);
    }
    opts.onEvent({ type: 'turn.completed' });
    return { code: 0, stdout: '', stderr: '' };
  };
  const bridge = new ImageBridge({ codexPath: process.execPath, codexHome: root, outputDir: path.join(root, 'output'), runner });
  return { bridge, root, starts: () => starts };
}
test('subscription environment does not leak API credentials to Codex', () => {
  assert.deepEqual(subscriptionEnv({ OPENAI_API_KEY: 'secret', CODEX_API_KEY: 'secret', OPENAI_BASE_URL: 'bad', CODEX_THREAD_ID: 'old', PATH: 'ok', CODEX_HOME: 'home' }), { PATH: 'ok', CODEX_HOME: 'home' });
});
test('generated paths reject sibling and parent escapes', () => {
  const root = path.resolve('tmp/a');
  assert.equal(isWithin(root, path.join(root, 'image.png')), true);
  assert.equal(isWithin(root, path.resolve('tmp/ab/image.png')), false);
  assert.equal(isWithin(root, root), false);
});
test('CLI arguments force subscription and disable shell execution', () => {
  const args = generationArgs('C:/with spaces', ['C:/refs/a.png']);
  assert.ok(args.includes('forced_login_method="chatgpt"'));
  assert.ok(args.includes('--ignore-user-config'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args[args.indexOf('--image') + 1], 'C:/refs/a.png');
  assert.equal(args.at(-1), '-');
});
test('API login rejected without disclosing key or starting generation', async () => {
  const f = await fixture('api');
  const status = await f.bridge.status();
  assert.equal(status.ready, false);
  assert.ok(!JSON.stringify(status).includes('sk-secret'));
  await assert.rejects(f.bridge.start({ prompt: 'test' }), /ChatGPT/);
  assert.equal(f.starts(), 0);
});
test('actual output bytes copied under unique names and polling never generates again', async () => {
  const f = await fixture();
  const job = await f.bridge.start({ prompt: 'a robot' });
  const result = await f.bridge.result(job.job_id, 20);
  assert.equal(result.status, 'completed');
  assert.deepEqual(await readFile(result.images[0].path), png);
  await f.bridge.result(job.job_id, 0);
  assert.equal(f.starts(), 1);
  const job2 = await f.bridge.start({ prompt: 'another robot' });
  const result2 = await f.bridge.result(job2.job_id, 20);
  assert.notEqual(result.images[0].path, result2.images[0].path);
});
test('failed and missing-image runs never report success', async () => {
  for (const mode of ['failed', 'no-image', 'traversal']) {
    const f = await fixture(mode);
    const job = await f.bridge.start({ prompt: 'test' });
    const result = await f.bridge.result(job.job_id, 20);
    assert.equal(result.status, 'failed', mode);
    assert.equal(result.images, undefined);
  }
});
test('concurrent start rejected and cancellation stops active request', async () => {
  const f = await fixture('cancel');
  const first = f.bridge.start({ prompt: 'first' });
  await assert.rejects(f.bridge.start({ prompt: 'second' }), /Уже идёт/);
  const job = await first;
  f.bridge.cancel(job.job_id);
  const result = await f.bridge.result(job.job_id, 20);
  assert.equal(result.status, 'cancelled');
  assert.equal(f.starts(), 1);
});
test('invalid references and prompts do not invoke generation', async () => {
  const f = await fixture();
  await assert.rejects(f.bridge.start({ prompt: ' ' }));
  await assert.rejects(f.bridge.start({ prompt: 'x', reference_images: ['relative.png'] }));
  assert.equal(f.starts(), 0);
});
test('runner preserves literal stdin and handles fragmented JSONL', async () => {
  const result = await run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: '$(secret) `hello` & кот' });
  assert.equal(result.stdout, '$(secret) `hello` & кот');
  const events = [];
  await run(process.execPath, ['-e', 'process.stdout.write("{\\"type\\":");setTimeout(()=>process.stdout.write("\\"done\\"}\\n"),20)'], { onEvent: event => events.push(event) });
  assert.deepEqual(events, [{ type: 'done' }]);
});
test('runner timeout terminates process', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 50 }), /время/);
});

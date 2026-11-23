import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ImageBridge } from '../vendor/codex-image-bridge/bridge.js';
import { HttpError } from './validation.ts';
import type { ImageEditor } from './openai.ts';
import type { GeneratedResult } from '../types.ts';

export function createSubscriptionService(root: string, bridge = new ImageBridge({ outputDir: path.join(root,'output','subscription'), codexPath: process.env.CODEX_IMAGE_CODEX_PATH })) {
  let busy = false;
  let cachedStatus: { value: { ready: boolean; message: string; version?: string }; time: number } | undefined;
  const status = async (refresh = false) => {
    if (!refresh && cachedStatus && Date.now() - cachedStatus.time < 15_000) return cachedStatus.value;
    let value: { ready: boolean; message: string; version?: string };
    try { const current = await bridge.status(); value = { ready: current.ready, message: current.ready ? 'Вход через ChatGPT подтверждён. Доступный лимит проверяется при генерации.' : current.message, version: current.version }; }
    catch (error) { value = { ready: false, message: error instanceof Error ? error.message : 'Не удалось проверить Codex.' }; }
    cachedStatus = { value, time: Date.now() }; return value;
  };
  const edit: ImageEditor = async ({ images, prompt, options }) => {
    if (busy) throw new HttpError(409,'В поузере уже идёт генерация через подписку. Дождитесь её завершения.');
    busy = true;
    try {
      const directory = path.join(root,'.codex-inputs',randomUUID());
      await fs.mkdir(directory,{recursive:true});
      const references: string[] = [];
      for (let i=0; i<images.length; i++) {
        const [head,base64] = images[i].split(',');
        const ext = head.includes('image/jpeg') ? 'jpg' : head.includes('image/webp') ? 'webp' : 'png';
        const file = path.join(directory,`reference-${i+1}.${ext}`);
        await fs.writeFile(file,Buffer.from(base64,'base64')); references.push(file);
      }
      // Keep the exact prompt shared with the built-in visual experiment.
      await fs.writeFile(path.join(directory,'prompt.txt'),prompt);
      const results: GeneratedResult[] = [];
      for(let index=0; index<options.count; index++) {
        const job = await bridge.start({ prompt, reference_images: references, transparent_background:false });
        let current = await bridge.result(job.job_id,20);
        while (current.status === 'running') current = await bridge.result(job.job_id,20);
        if(current.status !== 'completed' || !current.images?.length) {
          if (/usage limit|quota exceeded|rate.limit/i.test(current.message || '')) throw new HttpError(429,'Лимит подписки Codex исчерпан. Дождитесь восстановления лимита или проверьте его в настройках Codex / ChatGPT. Автоматического повтора нет.');
          throw new HttpError(502,current.message || 'Codex не вернул изображение.');
        }
        const file = current.images[0];
        const bytes = await fs.readFile(file.path);
        results.push({ id:randomUUID(), imageUrl:`data:${file.mime_type};base64,${bytes.toString('base64')}`, text:'Создано через подписку Codex' });
      }
      return results;
    } catch(error) {
      if(error instanceof HttpError) throw error;
      throw new HttpError(502,error instanceof Error ? error.message : 'Ошибка моста Codex.');
    } finally { busy = false; }
  };
  return { status, edit, close: () => bridge.close() };
}

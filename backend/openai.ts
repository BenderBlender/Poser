import { randomUUID } from 'node:crypto';
import type { GeneratedResult, GenerationOptions } from '../types.ts';
import { resolveDimensions } from '../shared/imageSettings.ts';
import { HttpError } from './validation.ts';
export interface ImageEditRequest { images: string[]; prompt: string; options: Required<GenerationOptions>; }
export type ImageEditor = (request: ImageEditRequest) => Promise<GeneratedResult[]>;
// Injection exercises the real HTTP contract in tests without paid generations.
export function createImageEditor(apiKey: () => string | undefined, fetcher: typeof fetch = fetch): ImageEditor {
  return async ({ images, prompt, options }) => {
    const key = apiKey();
    if (!key) throw new HttpError(503, 'Для генерации в приложении добавьте OPENAI_API_KEY в .env.local и перезапустите сервер. Подготовка задания для ChatGPT доступна без ключа.');
    let response: Response;
    try {
      response = await fetcher('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, images: images.map(image_url => ({ image_url })), prompt,
          size: resolveDimensions(options.aspectRatio, options.imageSize), quality: options.quality, n: options.count, output_format: 'png' }),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (error) {
      if (error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)) throw new HttpError(504, 'Ожидание OpenAI превысило 4 минуты. Запрос мог завершиться у провайдера; автоматический повтор отключён.');
      throw new HttpError(502, 'Не удалось связаться с OpenAI. Проверьте подключение к сети.');
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const hints: Record<number,string> = {
        400: 'OpenAI отклонил параметры или содержимое запроса.',
        401: 'OpenAI не принял API-ключ. Проверьте OPENAI_API_KEY на сервере.',
        403: 'Нет доступа к выбранной модели. Проверьте разрешения проекта и доступность OpenAI API.',
        404: 'Выбранная модель недоступна для этого проекта OpenAI.',
        429: 'Достигнут лимит запросов или баланса OpenAI API.',
      };
      throw new HttpError(response.status >= 400 && response.status < 600 ? response.status : 502, hints[response.status] ?? 'Ошибка на стороне OpenAI. Попробуйте позже.');
    }
    const items = payload?.data;
    if (!Array.isArray(items) || !items.length || items.some(item => typeof item?.b64_json !== 'string' || !item.b64_json)) throw new HttpError(502, 'OpenAI не вернул готовые изображения.');
    if (items.length !== options.count) throw new HttpError(502, `OpenAI вернул ${items.length} из ${options.count} изображений. Автоматический повтор отключён.`);
    return items.map(item => ({ id: randomUUID(), imageUrl: `data:image/png;base64,${item.b64_json}`, text: null }));
  };
}

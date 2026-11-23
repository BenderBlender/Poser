import { ASPECT_RATIOS, DEFAULT_MODEL, IMAGE_SIZES, MODEL_OPTIONS } from '../shared/imageSettings.ts';
import { POSE_MODES } from '../shared/prompts.ts';
import type { GenerationOptions, PoseExtractionMode } from '../types.ts';
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Ожидался объект с параметрами.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, fallback = '', maxLength = 8000): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > maxLength) throw new HttpError(400, `Текст должен содержать не более ${maxLength} символов.`);
  return value;
}
function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) throw new HttpError(400, `Недопустимое значение настройки: ${String(value).slice(0,80)}`);
  return value as T;
}
export function parseOptions(body: Record<string, unknown>): Required<GenerationOptions> {
  const count = body.count ?? 1;
  if (![1,2,3].includes(count as number)) throw new HttpError(400, 'Выберите от 1 до 3 вариантов.');
  return {
    model: choice(body.model, MODEL_OPTIONS.map(m => m.id), DEFAULT_MODEL),
    aspectRatio: choice(body.aspectRatio, ASPECT_RATIOS, '1:1'),
    imageSize: choice(body.imageSize, IMAGE_SIZES, '1K'),
    quality: choice(body.quality, ['low', 'medium', 'high'], 'medium'),
    workflow: choice(body.workflow, ['direct', 'guided'], 'direct'),
    count: count as 1|2|3,
  };
}
export function parseMode(value: unknown): PoseExtractionMode { return choice(value, POSE_MODES, 'perspective-wireframe'); }
export function boolean(value: unknown): boolean {
  if (value !== undefined && typeof value !== 'boolean') throw new HttpError(400, 'Ожидалось логическое значение.');
  return value === true;
}
export function array(value: unknown, max = 8): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, `Допускается не более ${max} дополнительных референсов.`);
  return value;
}
export function imageDataUrl(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Не загружено обязательное изображение.');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new HttpError(400, 'Используйте PNG, JPEG/JFIF или WebP в формате base64.');
  if (match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new HttpError(413, 'Каждое изображение должно быть не больше 12 МБ.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) throw new HttpError(400, 'Повреждённые данные изображения.');
  const valid = match[1] === 'image/png'
    ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw new HttpError(400, 'Содержимое файла не соответствует формату изображения.');
  return value;
}
export function rawImage(data: unknown, mimeType: unknown): string {
  if (typeof data !== 'string' || typeof mimeType !== 'string') throw new HttpError(400, 'Не загружено обязательное изображение.');
  return imageDataUrl(`data:${mimeType};base64,${data}`);
}
export function checkTotal(images: string[]) {
  const total = images.reduce((sum, image) => sum + Buffer.byteLength(image.split(',')[1], 'base64'), 0);
  if (total > MAX_TOTAL_BYTES) throw new HttpError(413, 'Суммарный размер изображений должен быть не больше 60 МБ.');
}

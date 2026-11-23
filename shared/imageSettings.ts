import type { AspectRatio, ImageSize } from '../types.ts';
export const MODEL_OPTIONS = [
  { id: 'gpt-image-2.6-sunburst', label: 'GPT Image 2.6 · Sunburst' },
  { id: 'gpt-image-2.6-flare', label: 'GPT Image 2.6 · Flare' },
] as const;
export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];
export const IMAGE_SIZES: ImageSize[] = ['1K', '2K', '4K'];
export const DEFAULT_MODEL = MODEL_OPTIONS[0].id;
// Obey the Images API pixel budget, 16-pixel alignment and 3:1 ratio limit.
const DIMENSIONS: Record<ImageSize, Record<AspectRatio, string>> = {
  '1K': { '1:1': '1024x1024', '3:4': '864x1152', '4:3': '1152x864', '9:16': '864x1536', '16:9': '1536x864' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048', '16:9': '2048x1152' },
  '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840', '16:9': '3840x2160' },
};
export const resolveDimensions = (ratio: AspectRatio = '1:1', size: ImageSize = '1K') => DIMENSIONS[size][ratio];

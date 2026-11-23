import express from 'express';
import path from 'node:path';
import type { ErrorRequestHandler } from 'express';
import { buildPosePrompt, buildSkeletonPrompt, buildRefinePrompt } from '../shared/prompts.ts';
import { DEFAULT_MODEL } from '../shared/imageSettings.ts';
import { createImageEditor } from './openai.ts';
import type { ImageEditor } from './openai.ts';
import { array, boolean, checkTotal, HttpError, imageDataUrl, object, parseMode, parseOptions, rawImage, text } from './validation.ts';
import { sourceZip } from './archive.ts';
import { createSubscriptionService } from './subscription.ts';

export function createApp(config: { root: string; editor?: ImageEditor; apiKey?: () => string | undefined;
  subscription?: { status: (refresh?: boolean) => Promise<{ ready: boolean; message: string; version?: string }>; edit: ImageEditor; close?: () => void } }) {
  const apiKey = config.apiKey ?? (() => process.env.OPENAI_API_KEY);
  const editor = config.editor ?? createImageEditor(apiKey);
  const app = express();
  const subscription = config.subscription ?? createSubscriptionService(config.root);
  app.locals.closeSubscription = () => subscription.close?.();
  app.disable('x-powered-by');
  // This is a local single-user application; reject cross-site browser requests.
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
      res.status(403).json({ error: 'Запрос разрешён только со страницы этого приложения.' }); return;
    }
    next();
  });
  app.use(express.json({ limit: '90mb' }));
  app.get('/api/health', (_req,res) => res.json({ app: 'pose-studio', pid: process.pid }));
  app.use('/.codex-inputs', (_req,res) => { res.sendStatus(404); });
  app.get('/api/status', async (req, res) => res.json({ configured: Boolean(apiKey()?.trim()), model: DEFAULT_MODEL, codex: await subscription.status(req.query.refresh === '1') }));
  app.post('/api/chatgpt-prompt', (req, res) => {
    const body = object(req.body);
    const options = parseOptions(body);
    const count = body.referenceCount ?? 0;
    if (!Number.isInteger(count) || Number(count) < 0 || Number(count) > 8) throw new HttpError(400, 'Допускается до 8 дополнительных референсов.');
    res.json({
      prompt: buildPosePrompt({ generationPrompt: text(body.generationPrompt), useArtisticIntegration: boolean(body.useArtisticIntegration), aspectRatio: options.aspectRatio, referenceCount: Number(count), hasSkeleton: options.workflow === 'guided' }),
      ...(options.workflow === 'guided' ? { skeletonPrompt: buildSkeletonPrompt(parseMode(body.mode)) } : {}),
    });
  });
  app.post(['/api/openai/extract-pose-skeleton','/api/codex/extract-pose-skeleton'], async (req, res) => {
    const edit = req.path.startsWith('/api/codex/') ? subscription.edit : editor;
    const body = object(req.body);
    const options = parseOptions(body);
    const images = [rawImage(body.poseImageBase64, body.poseMimeType)];
    const results = await edit({ images, prompt: buildSkeletonPrompt(parseMode(body.mode)), options: { ...options, count: 1, imageSize: '1K' } });
    if (!results[0]) throw new HttpError(502, 'Не удалось подготовить направляющую.');
    res.json({ base64: results[0].imageUrl, mimeType: 'image/png' });
  });
  app.post(['/api/openai/generate-pose','/api/codex/generate-pose'], async (req, res) => {
    const edit = req.path.startsWith('/api/codex/') ? subscription.edit : editor;
    const body = object(req.body);
    const options = parseOptions(body);
    const character = rawImage(body.characterBase64, body.characterMimeType);
    // Two distinct workflows, matching the side-by-side visual experiment.
    const pose = imageDataUrl(options.workflow === 'guided' ? body.skeletonDataUrl : body.poseImageDataUrl);
    const refs = array(body.referenceImages).map(value => {
      const ref = object(value); return rawImage(ref.data, ref.mimeType);
    });
    const images = [character, pose, ...refs];
    checkTotal(images);
    const prompt = buildPosePrompt({ generationPrompt: text(body.generationPrompt), useArtisticIntegration: boolean(body.useArtisticIntegration), aspectRatio: options.aspectRatio, referenceCount: refs.length, hasSkeleton: options.workflow === 'guided' });
    res.json({ results: await edit({ images, prompt, options }) });
  });
  app.post(['/api/openai/enhance-image','/api/codex/enhance-image'], async (req, res) => {
    const edit = req.path.startsWith('/api/codex/') ? subscription.edit : editor;
    const body = object(req.body);
    const options = parseOptions(body);
    const refs = array(body.referenceImages, 11).map(value => {
      const ref = object(value); return { label: text(ref.label, 'Character detail', 100), dataUrl: imageDataUrl(ref.dataUrl) };
    });
    const images = [imageDataUrl(body.imageToEnhanceDataUrl), ...refs.map(ref => ref.dataUrl)];
    checkTotal(images);
    const prompt = text(body.userPrompt);
    const results = await edit({ images, prompt: buildRefinePrompt(prompt, refs.map(ref => ref.label)), options: { ...options, count: 1 } });
    if (!results[0]) throw new HttpError(502, 'Не удалось получить доработанное изображение.');
    res.json({ result: { ...results[0], text: prompt.trim() ? 'Улучшено с правками' : 'Детали улучшены' } });
  });
  app.get('/api/download-source', (_req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="chatgpt-pose-generator-source.zip"');
    res.send(Buffer.from(sourceZip(config.root)));
  });
  const comparisonFiles = new Set(['/', '/comparison.html', '/test-direct.png', '/test-guided.png', '/test-wireframe.png', '/reference-character.png', '/reference-pose.jpg', '/test-direct-prompt.txt', '/test-guided-prompt.txt', '/test-wireframe-prompt.txt']);
  app.use('/comparison', (req,res,next) => { if (!comparisonFiles.has(req.path)) { res.sendStatus(404); return; } next(); }, express.static(path.join(config.root,'docs','examples','direct-vs-guided'), { index: 'comparison.html', dotfiles: 'deny' }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Такого API-маршрута нет.' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Слишком большой запрос. Уменьшите изображения.' }); return; }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Повреждённый JSON-запрос.' }); return; }
    // Do not return raw upstream errors or request bodies (may contain credentials/images).
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'Внутренняя ошибка приложения.' });
  };
  app.use(errors);
  return app;
}

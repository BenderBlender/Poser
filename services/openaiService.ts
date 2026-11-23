import type { AspectRatio, GeneratedResult, ImageModelId, ImageSize, ImageQuality } from '../types';
import type { PoseExtractionMode } from '../App';

interface ReferenceImage { data: string; mimeType: string; }
export interface ReferenceInput { label: string; dataUrl: string; }
export interface GenerationOptions {
    model?: ImageModelId; aspectRatio?: AspectRatio; imageSize?: ImageSize;
    quality?: ImageQuality; count?: 1 | 2 | 3; workflow?: 'direct' | 'guided';
    provider?: 'codex' | 'api';
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data?.error === 'string' && data.error.trim() ? data.error : `Ошибка сервера (${response.status})`);
    return data as T;
}

export const getApiStatus = async (refresh = false) => {
    const response = await fetch(`/api/status${refresh ? '?refresh=1' : ''}`);
    if (!response.ok) throw new Error('Не удалось проверить подключение к генератору.');
    return response.json() as Promise<{ configured: boolean; model: string; codex: { ready: boolean; message: string; version?: string } }>;
};

export const createChatGptPrompt = (body: { generationPrompt: string; useArtisticIntegration: boolean; aspectRatio: AspectRatio; referenceCount: number; workflow: 'direct' | 'guided'; mode: PoseExtractionMode }) =>
    postJson<{ prompt: string; skeletonPrompt?: string }>('/api/chatgpt-prompt', body);

const apiPrefix = (options?: GenerationOptions) => options?.provider === 'codex' ? '/api/codex' : '/api/openai';
const bodyOptions = (options?: GenerationOptions) => {
    const body = { ...(options || {}) };
    delete body.provider;
    return body;
};

export const extractPoseSkeleton = (poseImageBase64: string, poseMimeType: string, mode: PoseExtractionMode, options?: GenerationOptions) =>
    postJson<{ base64: string; mimeType: string }>(`${apiPrefix(options)}/extract-pose-skeleton`, { poseImageBase64, poseMimeType, mode, ...bodyOptions(options) });

export const generatePose = async (
    characterBase64: string, characterMimeType: string, poseImageDataUrl: string,
    skeletonDataUrl: string | undefined, skeletonMimeType: string | undefined,
    mode: PoseExtractionMode, useArtisticIntegration: boolean, generationPrompt: string,
    referenceImages: ReferenceImage[], options?: GenerationOptions
): Promise<GeneratedResult[]> => {
    const data = await postJson<{ results: GeneratedResult[] }>(`${apiPrefix(options)}/generate-pose`, {
        characterBase64, characterMimeType, poseImageDataUrl, skeletonDataUrl, skeletonMimeType,
        mode, useArtisticIntegration, generationPrompt, referenceImages, ...bodyOptions(options),
    });
    return data.results;
};

export const enhanceImageDetails = async (imageToEnhanceDataUrl: string, userPrompt: string, referenceImages: ReferenceInput[], options?: GenerationOptions) => {
    const data = await postJson<{ result: GeneratedResult }>(`${apiPrefix(options)}/enhance-image`, { imageToEnhanceDataUrl, userPrompt, referenceImages, ...bodyOptions(options) });
    return data.result;
};

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { SkeletonDisplay } from './components/SkeletonDisplay';
import { Spinner } from './components/Spinner';
import { generatePose, extractPoseSkeleton, enhanceImageDetails, getApiStatus, createChatGptPrompt } from './services/openaiService';
import { fileToBase64, fileToDataUrl, normalizedMimeType, validateImageFile, MAX_REFERENCE_COUNT, MAX_TOTAL_IMAGE_BYTES } from './utils/fileUtils';
import type { AspectRatio, GeneratedResult, ImageModelId, ImageSize, ImageQuality } from './types';
import { MagicWandIcon } from './components/IconComponents';
import { PoseExtractionModeSelector } from './components/PoseExtractionModeSelector';
import { GenerationSettings } from './components/GenerationSettings';
import { RefineModal } from './components/RefineModal';
import { CharacterReferenceUploader } from './components/CharacterReferenceUploader';
import { ZoomModal } from './components/ZoomModal';

export type PoseExtractionMode = 'stickman' | 'mannequin' | 'perspective' | 'wireframe' | 'perspective-wireframe';
type Provider = 'codex' | 'api';

const App: React.FC = () => {
    const [characterImage, setCharacterImage] = useState<File | null>(null);
    const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
    const [poseImage, setPoseImage] = useState<File | null>(null);
    const [poseImageUrl, setPoseImageUrl] = useState<string | null>(null);
    const [skeletonImage, setSkeletonImage] = useState<string | null>(null);
    const [generatedResults, setGeneratedResults] = useState<GeneratedResult[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [poseExtractionMode, setPoseExtractionMode] = useState<PoseExtractionMode>('perspective-wireframe');
    const [selectedModel, setSelectedModel] = useState<ImageModelId>('gpt-image-2.6-sunburst');
    const [workflow, setWorkflow] = useState<'direct' | 'guided'>('direct');
    const [quality, setQuality] = useState<ImageQuality>('medium');
    const [count, setCount] = useState<1 | 2 | 3>(1);
    const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
    const [generationStage, setGenerationStage] = useState<string | null>(null);
    const [chatGptPrompt, setChatGptPrompt] = useState('');
    const [isPreparingPrompt, setIsPreparingPrompt] = useState(false);
    const [provider, setProvider] = useState<Provider>('codex');
    const [codexStatus, setCodexStatus] = useState<{ ready: boolean; message: string; version?: string } | null>(null);
    const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [imageSize, setImageSize] = useState<ImageSize>('1K');
    const [enhancingImageId, setEnhancingImageId] = useState<string | null>(null);
    const [imageToRefine, setImageToRefine] = useState<GeneratedResult | null>(null);
    const [useArtisticIntegration, setUseArtisticIntegration] = useState<boolean>(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    // Новое состояние для дополнительных референсов и текстового промпта
    const [generationPrompt, setGenerationPrompt] = useState<string>('');
    const [characterReferences, setCharacterReferences] = useState<File[]>([]);
    const [characterReferenceUrls, setCharacterReferenceUrls] = useState<string[]>([]);
    const characterReadId = useRef(0);
    const poseReadId = useRef(0);
    const inputsLocked = isLoading || !!enhancingImageId;
    const generationOptions = { model: selectedModel, aspectRatio, imageSize, quality, count, workflow, provider };

    const refreshConnectionStatus = useCallback(async () => {
        setIsRefreshingStatus(true);
        try {
            const status = await getApiStatus(true);
            setApiConfigured(status.configured);
            setCodexStatus(status.codex);
        } catch (e) {
            setCodexStatus({ ready: false, message: e instanceof Error ? e.message : 'Не удалось проверить подключение Codex.' });
            setApiConfigured(false);
        } finally { setIsRefreshingStatus(false); }
    }, []);
    useEffect(() => { getApiStatus().then(status => { setApiConfigured(status.configured); setCodexStatus(status.codex); }).catch(e => setCodexStatus({ ready: false, message: e instanceof Error ? e.message : 'Не удалось проверить подключение Codex.' })); }, []);

    const reportFileError = (message: string) => setError(message);
    const downloadPrompt = () => {
        const url = URL.createObjectURL(new Blob([chatGptPrompt], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'pose-studio-chatgpt-prompt.txt'; link.click();
        URL.revokeObjectURL(url);
    };

    const handleCharacterImageSelect = async (file: File) => {
        const validation = validateImageFile(file); if (validation) { setError(validation); return; }
        if (file.size + (poseImage?.size || 0) + characterReferences.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_IMAGE_BYTES) { setError('Суммарный размер исходных изображений не должен превышать 60 МиБ.'); return; }
        const readId = ++characterReadId.current;
        let url: string;
        try { url = await fileToDataUrl(file); } catch { setError('Не удалось прочитать изображение персонажа.'); return; }
        if (readId !== characterReadId.current) return;
        setCharacterImage(file);
        setGeneratedResults(null);
        setSkeletonImage(null);
        setError(null);
        setCharacterImageUrl(url);
    };

    const handlePoseImageSelect = async (file: File) => {
        const validation = validateImageFile(file); if (validation) { setError(validation); return; }
        if (file.size + (characterImage?.size || 0) + characterReferences.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_IMAGE_BYTES) { setError('Суммарный размер исходных изображений не должен превышать 60 МиБ.'); return; }
        const readId = ++poseReadId.current;
        let url: string;
        try { url = await fileToDataUrl(file); } catch { setError('Не удалось прочитать изображение позы.'); return; }
        if (readId !== poseReadId.current) return;
        setPoseImage(file);
        setGeneratedResults(null);
        setSkeletonImage(null);
        setError(null);
        setPoseImageUrl(url);
    };

    const handleAddReferences = (files: FileList) => {
        const fileArray = Array.from(files);
        for (const file of fileArray) { const err = validateImageFile(file); if (err) { setError(err); return; } }
        const incomingSize = fileArray.reduce((sum, file) => sum + file.size, 0);
        if (characterReferences.length + fileArray.length > MAX_REFERENCE_COUNT) { setError('Можно добавить не более 8 дополнительных референсов.'); return; }
        if ((characterImage?.size || 0) + (poseImage?.size || 0) + characterReferences.reduce((sum, f) => sum + f.size, 0) + incomingSize > MAX_TOTAL_IMAGE_BYTES) { setError('Суммарный размер исходных изображений не должен превышать 60 МиБ.'); return; }
        setError(null);
        setCharacterReferences(prev => [...prev, ...fileArray]);
        const urls = fileArray.map(file => URL.createObjectURL(file));
        setCharacterReferenceUrls(prev => [...prev, ...urls]);
    };

    const handleRemoveReference = (indexToRemove: number) => {
        URL.revokeObjectURL(characterReferenceUrls[indexToRemove]);
        setCharacterReferences(prev => prev.filter((_, i) => i !== indexToRemove));
        setCharacterReferenceUrls(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const handleGenerate = useCallback(async () => {
        if (provider === 'api' && !apiConfigured) { setError('OpenAI API не настроен. Укажите OPENAI_API_KEY или выберите подключённую подписку Codex.'); return; }
        if (provider === 'codex' && !codexStatus?.ready) { setError(codexStatus?.message || 'Codex пока не подключён. Проверьте статус подключения.'); return; }
        if (!characterImage || !poseImage) {
            setError("Пожалуйста, загрузите оба изображения.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedResults(null);
        setSkeletonImage(null);
        setGenerationStage(workflow === 'guided' ? 'Подготовка направляющей' : 'Перенос позы');

        try {
            // Step 1: Extract skeleton
            const poseBase64 = await fileToBase64(poseImage);
            const poseDataUrl = await fileToDataUrl(poseImage);
            const skeletonResult = workflow === 'guided' ? await extractPoseSkeleton(
                poseBase64,
                normalizedMimeType(poseImage),
                poseExtractionMode,
                generationOptions
            ) : null;
            if (skeletonResult) setSkeletonImage(skeletonResult.base64);
            setGenerationStage('Перенос позы');

            // Step 2: Generate final poses
            const characterBase64 = await fileToBase64(characterImage);

            const referenceImagesBase64 = await Promise.all(
                characterReferences.map(async file => ({
                    data: await fileToBase64(file),
                    mimeType: normalizedMimeType(file)
                }))
            );

            const finalResults = await generatePose(
                characterBase64,
                normalizedMimeType(characterImage),
                poseDataUrl,
                skeletonResult?.base64,
                skeletonResult?.mimeType,
                poseExtractionMode,
                useArtisticIntegration,
                generationPrompt,
                referenceImagesBase64,
                generationOptions
            );
            setGeneratedResults(finalResults);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : "Произошла неизвестная ошибка.";
            setError(`Не удалось сгенерировать изображение. ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setGenerationStage(null);
        }
    }, [
        characterImage,
        poseImage,
        poseExtractionMode,
        useArtisticIntegration,
        generationPrompt,
        characterReferences,
        selectedModel,
        aspectRatio,
        imageSize, quality, count, workflow, apiConfigured, codexStatus, provider, generationOptions
    ]);

    const handleStartRefine = useCallback((resultToRefine: GeneratedResult) => {
        setImageToRefine(resultToRefine);
    }, []);

    const handleCancelRefine = () => {
        if (enhancingImageId) return;
        setImageToRefine(null);
    };

    const handleConfirmRefine = useCallback(async (
        prompt: string,
        selectedReferences: { character: boolean; pose: boolean; skeleton: boolean; },
        newReferences: File[]
    ) => {
        if (!imageToRefine) return;

        setEnhancingImageId(imageToRefine.id);
        setError(null);

        try {
            const referenceImages: { label: string; dataUrl: string; }[] = [];

            if (selectedReferences.character && characterImageUrl) {
                referenceImages.push({ label: 'ORIGINAL_CHARACTER_STYLE', dataUrl: characterImageUrl });
            }
            if (selectedReferences.pose && poseImageUrl) {
                referenceImages.push({ label: 'ORIGINAL_POSE_REFERENCE', dataUrl: poseImageUrl });
            }
            if (selectedReferences.skeleton && skeletonImage) {
                referenceImages.push({ label: 'INTERMEDIATE_SKELETON_GUIDE', dataUrl: skeletonImage });
            }

            for (let i = 0; i < newReferences.length; i++) {
                const dataUrl = await fileToDataUrl(newReferences[i]);
                referenceImages.push({ label: `USER_UPLOADED_REFERENCE_${i + 1}`, dataUrl });
            }

            const enhancedResult = await enhanceImageDetails(
                imageToRefine.imageUrl,
                prompt,
                referenceImages,
                generationOptions
            );
            
            setGeneratedResults(prevResults => 
                prevResults 
                    ? prevResults.map(r => r.id === imageToRefine.id ? { 
                        ...r,
                        imageUrl: enhancedResult.imageUrl, 
                        text: enhancedResult.text,
                        previousImageUrl: imageToRefine.imageUrl
                      } : r) 
                    : null
            );

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : "Произошла неизвестная ошибка.";
            setError(`Не удалось улучшить изображение. ${errorMessage}`);
        } finally {
            setEnhancingImageId(null);
            setImageToRefine(null);
        }

    }, [imageToRefine, characterImageUrl, poseImageUrl, skeletonImage, selectedModel, aspectRatio, imageSize, quality, count, workflow]);

    const handleUndoRefine = useCallback((resultId: string) => {
        setGeneratedResults(prevResults => {
            if (!prevResults) return null;
            return prevResults.map(r => {
                if (r.id === resultId && r.previousImageUrl) {
                    return {
                        ...r,
                        imageUrl: r.previousImageUrl,
                        previousImageUrl: null,
                        text: null
                    };
                }
                return r;
            });
        });
    }, []);

    const handleZoomIn = (imageUrl: string) => {
        setZoomedImageUrl(imageUrl);
    };

    const handleZoomOut = () => {
        setZoomedImageUrl(null);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <Header />
            <main className="container mx-auto p-4 md:p-8">
                <p className="text-center text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
                    Подготовьте персонажа и референс позы для новой композиции. Результат может отличаться в мелких деталях и точности позы.
                </p>

                <section className="max-w-5xl mx-auto mb-8 bg-gray-800 border border-gray-700 rounded-2xl p-5">
                    <h2 className="text-lg font-semibold text-purple-300 mb-3">Способ генерации</h2>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" disabled={inputsLocked} onClick={() => setProvider('codex')} aria-pressed={provider === 'codex'} className={`px-4 py-2 rounded-lg border ${provider === 'codex' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'}`}>Через подписку Codex</button>
                        <button type="button" disabled={inputsLocked} onClick={() => setProvider('api')} aria-pressed={provider === 'api'} className={`px-4 py-2 rounded-lg border ${provider === 'api' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'}`}>OpenAI API</button>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                        {provider === 'codex' ? <><span className={codexStatus?.ready ? 'text-emerald-300' : 'text-amber-300'}>{codexStatus?.ready ? 'Через подписку Codex — подключено' : codexStatus?.message || 'Проверяем подключение Codex…'}</span>{!codexStatus?.ready && <button type="button" disabled={isRefreshingStatus} onClick={refreshConnectionStatus} className="text-purple-300 underline disabled:opacity-50">{isRefreshingStatus ? 'Проверка…' : 'Обновить статус'}</button>}</> : <span className={apiConfigured ? 'text-emerald-300' : 'text-amber-300'}>{apiConfigured ? 'OpenAI API — подключён' : 'Для API режима требуется OPENAI_API_KEY в .env.local'}</span>}
                    </div>
                </section>

                <fieldset disabled={inputsLocked} className="contents">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <ImageUploader
                        onImageSelect={handleCharacterImageSelect}
                        previewUrl={characterImageUrl}
                        title="1. Загрузите персонажа"
                        description="Изображение вашего оригинального персонажа."
                        disabled={inputsLocked} onError={reportFileError}
                    />
                    <ImageUploader
                        onImageSelect={handlePoseImageSelect}
                        previewUrl={poseImageUrl}
                        title="2. Загрузите позу"
                        description="Изображение с позой, которую вы хотите применить."
                        disabled={inputsLocked} onError={reportFileError}
                    />
                </div>

                <div className="grid grid-cols-1 gap-8 mb-8 max-w-6xl mx-auto">
                    <CharacterReferenceUploader
                        referenceUrls={characterReferenceUrls}
                        onAddReferences={handleAddReferences}
                        onRemoveReference={handleRemoveReference}
                        disabled={inputsLocked}
                    />
                    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <label htmlFor="generation-prompt" className="block text-xl font-bold mb-2 text-purple-300">
                            Опишите детали (необязательно)
                        </label>
                        <p className="text-gray-400 mb-4 text-sm">
                            Помогите ИИ, предоставив текстовые подсказки. Например: "на ногах высокие коричневые сапоги", "длинный пушистый хвост".
                        </p>
                        <textarea
                            id="generation-prompt"
                            value={generationPrompt}
                            onChange={(e) => setGenerationPrompt(e.target.value)}
                            placeholder="Введите здесь ваши подсказки..."
                            className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg p-3 focus:border-purple-500 focus:ring-purple-500 transition-colors text-gray-200 resize-none"
                            rows={3}
                            aria-label="Поле для ввода текстовых подсказок для генерации"
                        />
                    </div>
                </div>
                
                {workflow === 'guided' && <PoseExtractionModeSelector
                    selectedMode={poseExtractionMode}
                    onModeChange={setPoseExtractionMode}
                />}

                <div className="max-w-5xl mx-auto mb-6 bg-gray-800 p-4 rounded-xl">
                    <h3 className="font-semibold text-purple-300 mb-2">Способ подготовки</h3>
                    <div className="flex gap-3">
                        <button type="button" disabled={inputsLocked} onClick={() => setWorkflow('direct')} className={`px-4 py-2 rounded-lg ${workflow === 'direct' ? 'bg-purple-600' : 'bg-gray-700'}`}>Прямой</button>
                        <button type="button" disabled={inputsLocked} onClick={() => setWorkflow('guided')} className={`px-4 py-2 rounded-lg ${workflow === 'guided' ? 'bg-purple-600' : 'bg-gray-700'}`}>С направляющей</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">В режиме с направляющей сначала создаётся манекен с сеткой тела и пола, а финальный перенос выполняется по этому манекену. Прямой режим использует исходное фото позы.</p>
                </div>

                <GenerationSettings
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={setAspectRatio}
                    imageSize={imageSize}
                    onImageSizeChange={setImageSize}
                    quality={quality} onQualityChange={setQuality} count={count} onCountChange={setCount} disabled={inputsLocked}
                    chatMode={provider === 'codex'}
                />

                <div className="text-center mb-4 max-w-5xl mx-auto">
                    <label htmlFor="artistic-integration-checkbox" className="flex items-center justify-center cursor-pointer p-3 bg-gray-800 rounded-lg border-2 border-gray-700 hover:border-purple-600 transition-colors">
                        <input
                            type="checkbox"
                            id="artistic-integration-checkbox"
                            checked={useArtisticIntegration}
                            onChange={(e) => setUseArtisticIntegration(e.target.checked)}
                            className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 transition-colors"
                            disabled={inputsLocked}
                        />
                        <div className="ml-3 text-left">
                            <span className="font-semibold text-gray-200">Включить художественную интеграцию</span>
                            <p className="text-xs text-gray-400">
                                Художественная интеграция помогает согласовать стиль; поза и мелкие детали могут отличаться от референса.
                            </p>
                        </div>
                    </label>
                </div>

                </fieldset>
                <div className="text-center mb-8">
                    <button
                        onClick={handleGenerate}
                        disabled={(provider === 'api' ? !apiConfigured : !codexStatus?.ready) || !characterImage || !poseImage || isLoading || !!enhancingImageId}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center mx-auto"
                        aria-live="polite"
                    >
                        {isLoading ? (
                            <>
                                <Spinner />
                                <span className="ml-2">{generationStage || 'Генерация...'}</span>
                            </>
                        ) : (
                            <>
                               <MagicWandIcon className="w-5 h-5 mr-2" />
                                <span>Сгенерировать позу</span>
                            </>
                        )}
                    </button>
                </div>

                {provider === 'api' && apiConfigured === false && <p className="text-center text-amber-300 mb-6">OpenAI API не настроен. Для генерации введите ключ в .env.local.</p>}

                {error && <div className="text-center text-red-400 p-4 bg-red-900/50 rounded-lg max-w-3xl mx-auto" role="alert">{error}</div>}
                
                <div className="space-y-8 mt-8">
                    <SkeletonDisplay skeletonImage={workflow === 'guided' ? skeletonImage : null} isLoading={isLoading && workflow === 'guided'} />
                    <ResultDisplay 
                        results={generatedResults} 
                        isLoading={isLoading}
                        onEnhance={handleStartRefine}
                        onUndo={handleUndoRefine}
                        onZoomIn={handleZoomIn}
                        enhancingImageId={enhancingImageId}
                        isEnhanceDisabled={isLoading || !!enhancingImageId}
                    />
                </div>

                <section className="max-w-5xl mx-auto mt-10 bg-gray-800 p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-purple-300 mb-2">Подготовить для ChatGPT</h3>
                    <p className="text-sm text-gray-400 mb-4">Создаст промпт для ручного использования в ChatGPT. Изображения нужно приложить самостоятельно.</p>
                    <button type="button" disabled={isPreparingPrompt} onClick={async () => { setIsPreparingPrompt(true); setError(null); try { const result = await createChatGptPrompt({ generationPrompt, useArtisticIntegration, aspectRatio, referenceCount: characterReferences.length, workflow, mode: poseExtractionMode }); const output = workflow === 'direct' ? `ИНСТРУКЦИЯ\nПриложите персонажа первым, фото позы вторым, затем дополнительные референсы.\n\nПРОМПТ\n${result.prompt}` : `ЗАДАНИЕ 1 — СОЗДАТЬ МАНЕКЕН\nЗагрузите только исходное фото позы. Сохраните созданный манекен для следующего этапа.\n\n${result.skeletonPrompt || ''}\n\nЗАДАНИЕ 2 — ПЕРЕНОС НА ПЕРСОНАЖА\nОткройте новый чат. Приложите персонажа первым, созданный манекен вторым, затем дополнительные референсы. Не прикладывайте исходное фото позы на втором этапе.\n\n${result.prompt}`; setChatGptPrompt(output); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось подготовить промпт.'); } finally { setIsPreparingPrompt(false); } }} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg">{isPreparingPrompt ? 'Подготовка...' : 'Подготовить для ChatGPT'}</button>
                    {chatGptPrompt && <div className="mt-4 space-y-3">
                        <p className="text-sm text-gray-300">{workflow === 'direct' ? 'В ChatGPT приложите персонажа первым, исходное фото позы вторым, затем дополнительные референсы.' : 'Для guided выполните два задания: сначала сохраните манекен по фото позы, затем начните новый чат с персонажем первым и манекеном вторым; исходную позу к этапу переноса не прикладывайте.'}</p>
                        <textarea readOnly value={chatGptPrompt} rows={8} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200" />
                        <div className="flex gap-3"><button type="button" onClick={() => navigator.clipboard.writeText(chatGptPrompt)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">Копировать</button><button type="button" onClick={downloadPrompt} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">Скачать .txt</button></div>
                    </div>}
                </section>

            </main>
             <footer className="text-center p-4 mt-8 text-gray-500 text-sm">
                <p>Pose Studio · ChatGPT</p>
            </footer>
            <RefineModal 
                isOpen={!!imageToRefine}
                onClose={handleCancelRefine}
                onRefine={handleConfirmRefine}
                imageToRefine={imageToRefine}
                isRefining={!!enhancingImageId}
                characterImageUrl={characterImageUrl}
                poseImageUrl={poseImageUrl}
                skeletonImageUrl={skeletonImage}
            />
            <ZoomModal 
                isOpen={!!zoomedImageUrl}
                imageUrl={zoomedImageUrl}
                onClose={handleZoomOut}
            />
        </div>
    );
};

export default App;

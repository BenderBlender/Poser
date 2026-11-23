import React from 'react';
import type { GeneratedResult } from '../types';
import { ImageIcon, SparklesIcon, UndoIcon, MagnifyingGlassIcon } from './IconComponents';
import { Spinner } from './Spinner';

interface ResultDisplayProps {
    results: GeneratedResult[] | null;
    isLoading: boolean;
    onEnhance: (result: GeneratedResult) => void;
    onUndo: (resultId: string) => void;
    onZoomIn: (imageUrl: string) => void;
    enhancingImageId: string | null;
    isEnhanceDisabled: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ results, isLoading, onEnhance, onUndo, onZoomIn, enhancingImageId, isEnhanceDisabled }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg min-h-[300px] flex flex-col justify-center items-center w-full max-w-6xl mx-auto">
             <div className="w-full text-left mb-4">
                <h3 className="text-2xl font-bold text-purple-300">3. Результат</h3>
                {results && <p className="text-sm text-gray-400">Выберите лучший вариант и перейдите к улучшению, чтобы добавить детали или внести правки.</p>}
             </div>
            {results && results.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                   {results.map((result) => (
                        <div key={result.id} className="relative bg-gray-700/50 rounded-lg overflow-hidden shadow-xl group">
                             <img src={result.imageUrl} alt={`Сгенерированное изображение ${result.id}`} className="w-full h-auto object-contain aspect-square" />
                             
                             {enhancingImageId === result.id && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                                    <Spinner />
                                    <span className="mt-2">Улучшение...</span>
                                </div>
                             )}

                             <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="flex items-center justify-center gap-2">
                                    {result.previousImageUrl && (
                                        <button
                                            onClick={() => onUndo(result.id)}
                                            disabled={isEnhanceDisabled}
                                            className="flex-shrink-0 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm font-semibold p-2 rounded-md flex items-center justify-center transition-all duration-200"
                                            aria-label="Отменить улучшение"
                                        >
                                            <UndoIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onZoomIn(result.imageUrl)}
                                        disabled={isEnhanceDisabled}
                                        className="flex-shrink-0 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm font-semibold p-2 rounded-md flex items-center justify-center transition-all duration-200"
                                        aria-label="Увеличить изображение"
                                    >
                                        <MagnifyingGlassIcon className="w-4 h-4" />
                                    </button>
                                    <a href={result.imageUrl} download={`pose-${result.id}.png`} className="flex-shrink-0 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold p-2 rounded-md" aria-label="Скачать изображение" title="Скачать изображение">↓</a>
                                    <button
                                        onClick={() => onEnhance(result)}
                                        disabled={isEnhanceDisabled}
                                        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-3 rounded-md flex items-center justify-center transition-all duration-200"
                                    >
                                        <SparklesIcon className="w-4 h-4 mr-2" />
                                        Улучшить детали
                                    </button>
                                </div>
                             </div>

                             {result.text && <p className="text-gray-400 p-2 text-xs text-center italic">{result.text}</p>}
                        </div>
                   ))}
                </div>
            ) : (
                isLoading ? (
                    <div className="text-center text-purple-300 py-12"><Spinner /><p className="mt-3">Перенос позы…</p></div>
                ) : (
                    <div className="text-center text-gray-500">
                        <ImageIcon className="w-20 h-20 mx-auto mb-4" />
                        <p className="text-lg">Здесь появятся ваши сгенерированные изображения</p>
                        <p className="text-sm">Загрузите изображения и нажмите "Сгенерировать"</p>
                    </div>
                )
            )}
        </div>
    );
};

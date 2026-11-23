import React from 'react';
import { resolveDimensions } from '../shared/imageSettings';
import type { AspectRatio, ImageModelId, ImageSize, ImageQuality } from '../types';

interface GenerationSettingsProps {
    selectedModel: ImageModelId;
    onModelChange: (model: ImageModelId) => void;
    aspectRatio: AspectRatio;
    onAspectRatioChange: (ratio: AspectRatio) => void;
    imageSize: ImageSize;
    onImageSizeChange: (size: ImageSize) => void;
    quality: ImageQuality;
    onQualityChange: (quality: ImageQuality) => void;
    count: 1 | 2 | 3;
    onCountChange: (count: 1 | 2 | 3) => void;
    disabled?: boolean;
    chatMode?: boolean;
}

const MODELS: { id: ImageModelId; label: string; badge: string; description: string }[] = [
    {
        id: 'gpt-image-2.6-sunburst', label: 'GPT Image Sunburst', badge: 'Высокое качество', description: 'Для детальной генерации и редактирования.',
    },
    {
        id: 'gpt-image-2.6-flare', label: 'GPT Image Flare', badge: 'Быстрая', description: 'Для быстрых вариантов и итераций.',
    },
];

const STANDARD_RATIOS: { id: AspectRatio; label: string; hint: string }[] = [
    { id: '1:1', label: '1:1', hint: 'Квадрат' },
    { id: '3:4', label: '3:4', hint: 'Портрет' },
    { id: '4:3', label: '4:3', hint: 'Альбом' },
    { id: '9:16', label: '9:16', hint: 'Сторис' },
    { id: '16:9', label: '16:9', hint: 'Широкий' },
];


const SIZES: { id: ImageSize; label: string; desc: string }[] = [
    { id: '1K', label: '1K', desc: 'Стандартное' },
    { id: '2K', label: '2K', desc: 'Высокое' },
    { id: '4K', label: '4K', desc: 'Ультра детализация' },
];

export const GenerationSettings: React.FC<GenerationSettingsProps> = ({
    selectedModel,
    onModelChange,
    aspectRatio,
    onAspectRatioChange,
    imageSize,
    onImageSizeChange,
    quality, onQualityChange, count, onCountChange, disabled = false, chatMode = false,
}) => {
    const availableRatios = STANDARD_RATIOS;

    const handleModelSelect = (modelId: ImageModelId) => {
        onModelChange(modelId);
    };

    return (
        <div className="max-w-5xl mx-auto mb-8 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700/70 space-y-6">
            {!chatMode && <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">
                    Модель генерации:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODELS.map((m) => {
                        const isSelected = selectedModel === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => handleModelSelect(m.id)}
                                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-purple-600/30 border-purple-500 shadow-md'
                                        : 'bg-gray-900/60 border-gray-700 hover:border-purple-600/70'
                                }`}
                                aria-pressed={isSelected}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-bold text-white text-sm">{m.label}</span>
                                        <span
                                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                                m.id === 'gpt-image-2.6-flare'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                            }`}
                                        >
                                            {m.badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{m.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-gray-700/60">
                <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Пропорции изображения (Aspect Ratio):
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {availableRatios.map((r) => {
                            const active = aspectRatio === r.id;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => onAspectRatioChange(r.id)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                        active
                                            ? 'bg-purple-600/40 border-purple-400 text-white'
                                            : 'bg-gray-900/70 border-gray-700 text-gray-300 hover:border-purple-500/60'
                                    }`}
                                >
                                    <span className="font-bold">{r.label}</span>
                                    <span className="text-gray-400 ml-1.5">({r.hint})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {!chatMode && <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-300">
                            Разрешение рендера:
                        </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {SIZES.map((s) => {
                            const sizeDisabled = disabled;
                            const active = imageSize === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    disabled={sizeDisabled}
                                    onClick={() => onImageSizeChange(s.id)}
                                    className={`p-2 rounded-lg border text-center transition-all ${
                                        active
                                            ? 'bg-purple-600/40 border-purple-400 text-white'
                                            : sizeDisabled
                                            ? 'bg-gray-900/30 border-gray-800 text-gray-600 cursor-not-allowed'
                                            : 'bg-gray-900/70 border-gray-700 text-gray-300 hover:border-purple-500/60'
                                    }`}
                                >
                                    <div className="font-bold text-sm">{s.label}</div>
                                    <div className="text-[11px] text-gray-400">{s.desc}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>}
            </div>
            {chatMode ? <p className="text-xs text-gray-400">При генерации через Codex точные модель и размер пикселей не выбираются. Пропорции остаются ориентиром.</p> : <p className="text-xs text-gray-400">Размер результата: {resolveDimensions(aspectRatio, imageSize)} пикселей. Профиль 4K ограничен общим числом пикселей; квадрат — 2880 × 2880.</p>}
            <div className="grid grid-cols-2 gap-4 border-t border-gray-700/60 pt-4">
                {!chatMode && <label className="text-sm text-gray-300">Качество
                    <select value={quality} disabled={disabled} onChange={e => onQualityChange(e.target.value as ImageQuality)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2">
                        <option value="low">Быстрое</option><option value="medium">Среднее</option><option value="high">Высокое</option>
                    </select>
                </label>}
                <label className="text-sm text-gray-300">Вариантов
                    <select value={count} disabled={disabled} onChange={e => onCountChange(Number(e.target.value) as 1 | 2 | 3)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2">
                        <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                    </select>
                </label>
            </div>
        </div>
    );
};

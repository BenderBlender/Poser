import React, { useState, useEffect, useRef } from 'react';
import type { GeneratedResult } from '../types';
import { SparklesIcon, XMarkIcon, UploadIcon } from './IconComponents';
import { Spinner } from './Spinner';
import { validateImageFile, MAX_REFERENCE_COUNT, MAX_TOTAL_IMAGE_BYTES } from '../utils/fileUtils';

interface SelectedReferences {
    character: boolean;
    pose: boolean;
    skeleton: boolean;
}

interface RefineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefine: (
        prompt: string,
        selectedReferences: SelectedReferences,
        newReferences: File[]
    ) => void;
    imageToRefine: GeneratedResult | null;
    isRefining: boolean;
    characterImageUrl: string | null;
    poseImageUrl: string | null;
    skeletonImageUrl: string | null;
}

export const RefineModal: React.FC<RefineModalProps> = ({ 
    isOpen, onClose, onRefine, imageToRefine, isRefining,
    characterImageUrl, poseImageUrl, skeletonImageUrl
}) => {
    const [prompt, setPrompt] = useState('');
    const [selectedReferences, setSelectedReferences] = useState<SelectedReferences>({
        character: false,
        pose: false,
        skeleton: false,
    });
    const [newReferences, setNewReferences] = useState<File[]>([]);
    const [newReferencePreviews, setNewReferencePreviews] = useState<string[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const newRefInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPrompt('');
            setUploadError(null);
            setSelectedReferences({ character: false, pose: false, skeleton: false });
            // Clean up old object URLs before clearing the arrays
            newReferencePreviews.forEach(url => URL.revokeObjectURL(url));
            setNewReferences([]);
            setNewReferencePreviews([]);
        }
    }, [isOpen]);
    
    if (!isOpen || !imageToRefine) return null;

    const handleRefineClick = () => {
        onRefine(prompt, selectedReferences, newReferences);
    };

    const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        const dataUrlSize = (url: string | null) => url?.startsWith('data:') ? Math.floor(((url.split(',')[1] || '').length * 3) / 4) : 0;
        const next = { ...selectedReferences, [name]: checked };
        const selectedBytes = (next.character ? dataUrlSize(characterImageUrl) : 0)
            + (next.pose ? dataUrlSize(poseImageUrl) : 0)
            + (next.skeleton ? dataUrlSize(skeletonImageUrl) : 0);
        const newBytes = newReferences.reduce((sum, file) => sum + file.size, 0);
        if (dataUrlSize(imageToRefine?.imageUrl || null) + selectedBytes + newBytes > MAX_TOTAL_IMAGE_BYTES) {
            setUploadError('Суммарный размер изображения для правки, выбранных референсов и новых файлов не должен превышать 60 МиБ.');
            return;
        }
        setUploadError(null);
        setSelectedReferences(next);
    };

    const handleNewReferenceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const files = Array.from(event.target.files);
            const invalid = files.map(validateImageFile).find(Boolean);
            const current = newReferences.reduce((sum, file) => sum + file.size, 0);
            const addition = files.reduce((sum, file) => sum + file.size, 0);
            const dataUrlSize = (url: string | null) => {
                if (!url?.startsWith('data:')) return 0;
                const payload = url.split(',')[1] || '';
                return Math.floor(payload.length * 3 / 4);
            };
            const selectedBytes = (selectedReferences.character ? dataUrlSize(characterImageUrl) : 0)
                + (selectedReferences.pose ? dataUrlSize(poseImageUrl) : 0)
                + (selectedReferences.skeleton ? dataUrlSize(skeletonImageUrl) : 0);
            const targetBytes = dataUrlSize(imageToRefine?.imageUrl || null);
            if (invalid) { setUploadError(invalid); event.target.value = ''; return; }
            if (newReferences.length + files.length > MAX_REFERENCE_COUNT) { setUploadError('Можно добавить не более 8 новых референсов.'); event.target.value = ''; return; }
            if (targetBytes + selectedBytes + current + addition > MAX_TOTAL_IMAGE_BYTES) { setUploadError('Суммарный размер изображения для правки, выбранных референсов и новых файлов не должен превышать 60 МиБ.'); event.target.value = ''; return; }
            setUploadError(null);
            setNewReferences(prev => [...prev, ...files]);
            const previews = files.map(file => URL.createObjectURL(file as Blob));
            setNewReferencePreviews(prev => [...prev, ...previews]);
            // Reset file input value to allow uploading the same file again
            if (event.target) {
                event.target.value = '';
            }
        }
    };
    
    const removeNewReference = (indexToRemove: number) => {
        URL.revokeObjectURL(newReferencePreviews[indexToRemove]); // Cleanup
        setNewReferences(prev => prev.filter((_, i) => i !== indexToRemove));
        setNewReferencePreviews(prev => prev.filter((_, i) => i !== indexToRemove));
        setUploadError(null);
    };

    const existingReferences = [
        { name: 'character', label: 'Персонаж (Стиль)', imageUrl: characterImageUrl },
        { name: 'pose', label: 'Поза (Оригинал)', imageUrl: poseImageUrl },
        { name: 'skeleton', label: 'Поза (Скелет)', imageUrl: skeletonImageUrl },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row gap-6 p-6 relative">
                
                {/* Left Column: Target Image */}
                <div className="md:w-1/2 flex-shrink-0 flex flex-col">
                    <h3 className="text-2xl font-bold text-purple-300 mb-4">4. Уточнение результата</h3>
                    <div className="w-full aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center">
                      <img src={imageToRefine.imageUrl} alt="Изображение для уточнения" className="max-w-full max-h-full object-contain rounded-lg" />
                    </div>
                </div>

                {/* Right Column: Controls */}
                <div className="md:w-1/2 flex flex-col space-y-4 overflow-y-auto pr-2">
                    <div>
                        <label htmlFor="refine-prompt" className="block text-gray-400 mb-2 font-semibold">Ваш запрос:</label>
                        <textarea
                            disabled={isRefining}
                            id="refine-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Например: 'добавь пиратскую повязку на глаз' или 'переодень в красный плащ' (необязательно)..."
                            className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg p-3 focus:border-purple-500 focus:ring-purple-500 transition-colors text-gray-200 resize-none"
                            rows={4}
                            aria-label="Поле для ввода правок"
                        />
                    </div>

                    <div>
                        <h4 className="text-lg font-semibold text-gray-300 mb-2">Использовать референсы</h4>
                        <p className="text-sm text-gray-500 mb-3">Выберите, какие изображения использовать как дополнительную информацию для ИИ.</p>
                        <div className="space-y-2">
                            {existingReferences.map(ref => ref.imageUrl && (
                                <label key={ref.name} className="flex items-center p-2 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        disabled={isRefining}
                                        name={ref.name}
                                        checked={selectedReferences[ref.name as keyof SelectedReferences]}
                                        onChange={handleCheckboxChange}
                                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
                                    />
                                    <img src={ref.imageUrl} alt={ref.label} className="w-12 h-12 object-cover rounded-md mx-3" />
                                    <span className="text-gray-300">{ref.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-lg font-semibold text-gray-300 mb-2">Добавить новые референсы</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {newReferencePreviews.map((preview, index) => (
                                <div key={preview} className="relative group aspect-square">
                                    <img src={preview} alt={`Новый референс ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                    <button disabled={isRefining} onClick={() => removeNewReference(index)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Удалить референс ${index + 1}`}>
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                disabled={isRefining}
                                onClick={() => newRefInputRef.current?.click()}
                                className="flex flex-col items-center justify-center w-full aspect-square bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 transition-colors text-gray-500"
                                aria-label="Добавить новый референс"
                            >
                                <UploadIcon className="w-8 h-8" />
                                <span className="text-xs mt-1 text-center">Добавить</span>
                            </button>
                            <input
                                type="file"
                                multiple
                                accept="image/png, image/jpeg, image/webp,.jfif"
                                disabled={isRefining}
                                ref={newRefInputRef}
                                onChange={handleNewReferenceUpload}
                                className="hidden"
                            />
                        </div>
                        {uploadError && <p className="text-sm text-red-300 mt-2" role="alert">{uploadError}</p>}
                    </div>
                    
                    <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            onClick={handleRefineClick}
                            disabled={isRefining}
                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center transition-all duration-300"
                        >
                            {isRefining ? (
                                <><Spinner /><span className="ml-2">Улучшение...</span></>
                            ) : (
                                <><SparklesIcon className="w-5 h-5 mr-2" /><span>Улучшить</span></>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={isRefining}
                            className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600/50 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            Отмена
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    disabled={isRefining}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                    aria-label="Закрыть модальное окно"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

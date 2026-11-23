import React, { useRef } from 'react';
import { UploadIcon, XMarkIcon } from './IconComponents';

interface CharacterReferenceUploaderProps {
    referenceUrls: string[];
    onAddReferences: (files: FileList) => void;
    onRemoveReference: (index: number) => void;
    disabled?: boolean;
}

export const CharacterReferenceUploader: React.FC<CharacterReferenceUploaderProps> = ({
    referenceUrls,
    onAddReferences,
    onRemoveReference,
    disabled = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onAddReferences(event.target.files);
            event.target.value = ''; // Позволяет повторно загружать тот же файл
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold mb-2 text-purple-300">1.5. Добавьте детали (необязательно)</h3>
            <p className="text-gray-400 mb-4 text-sm">
                Загрузите дополнительные изображения, чтобы показать детали, которых нет на основном фото (например, обувь, спину персонажа).
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {referenceUrls.map((url, index) => (
                    <div key={index} className="relative group aspect-square">
                        <img src={url} alt={`Референс ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                        <button
                            onClick={() => onRemoveReference(index)}
                            disabled={disabled}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Удалить референс ${index + 1}`}
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    disabled={disabled}
                    className="flex flex-col items-center justify-center w-full aspect-square bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 transition-colors text-gray-500"
                    aria-label="Добавить новый референс"
                >
                    <UploadIcon className="w-8 h-8" />
                    <span className="text-xs mt-1 text-center">Добавить</span>
                </button>
                <input
                    type="file"
                    disabled={disabled}
                    multiple
                    accept="image/png, image/jpeg, image/webp,.jfif"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
        </div>
    );
};

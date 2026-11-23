
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './IconComponents';
import { normalizedMimeType } from '../utils/fileUtils';

interface ImageUploaderProps {
    onImageSelect: (file: File) => void;
    title: string;
    description: string;
    disabled?: boolean;
    onError?: (message: string) => void;
    previewUrl?: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, title, description, disabled = false, onError, previewUrl }) => {
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file: File) => {
        if (disabled) return;
        if (file.size > 12 * 1024 * 1024) { onError?.(`${file.name}: размер файла превышает 12 МиБ.`); return; }
        const mime = normalizedMimeType(file);
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) { onError?.(`${file.name}: поддерживаются PNG, JPG/JFIF и WEBP.`); return; }
        onImageSelect(file);
    };
    
    const openFileDialog = () => {
        if (!disabled) fileInputRef.current?.click();
    };

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);
    
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg h-full flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-purple-300">{title}</h3>
            <p className="text-gray-400 mb-4 text-sm">{description}</p>
            <div
                onClick={openFileDialog}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed border-gray-600 rounded-xl flex-grow flex items-center justify-center ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} transition-all duration-300 ${isDragging ? 'border-purple-500 bg-gray-700/50' : 'hover:border-purple-500'}`}
            >
                <input
                    type="file"
                    disabled={disabled}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/webp,.jfif"
                    className="hidden"
                />
                {previewUrl ? (
                    <img src={previewUrl} alt={title} className="max-h-96 max-w-full object-contain rounded-lg p-2" />
                ) : (
                    <div className="text-center text-gray-500 p-4">
                        <UploadIcon className="w-12 h-12 mx-auto mb-2" />
                        <p>
                            <span className="font-semibold text-purple-400">Нажмите</span> для загрузки
                            <br />
                            или перетащите файл
                        </p>
                        <p className="text-xs mt-1">PNG, JPG, WEBP</p>
                    </div>
                )}
            </div>
        </div>
    );
};

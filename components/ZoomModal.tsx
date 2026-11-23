import React, { useEffect } from 'react';
import { XMarkIcon } from './IconComponents';

interface ZoomModalProps {
    isOpen: boolean;
    imageUrl: string | null;
    onClose: () => void;
}

export const ZoomModal: React.FC<ZoomModalProps> = ({ isOpen, imageUrl, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !imageUrl) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-fade-in" 
            onClick={onClose}
            aria-modal="true" 
            role="dialog"
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-[110]"
                aria-label="Закрыть"
            >
                <XMarkIcon className="w-8 h-8" />
            </button>
            <div 
                className="relative max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()} // Предотвращает закрытие при клике на само изображение
            >
                <img 
                    src={imageUrl} 
                    alt="Увеличенное изображение" 
                    className="block max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
                />
            </div>
        </div>
    );
};
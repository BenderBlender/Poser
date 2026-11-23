import React from 'react';
import { Spinner } from './Spinner';

interface SkeletonDisplayProps {
    skeletonImage: string | null;
    isLoading: boolean;
}

export const SkeletonDisplay: React.FC<SkeletonDisplayProps> = ({ skeletonImage, isLoading }) => {
    // Показываем этот блок только если загрузка началась
    if (!isLoading && !skeletonImage) {
        return null;
    }

    return (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-xl mx-auto flex flex-col items-center">
            <h3 className="text-xl font-bold mb-4 text-purple-300 w-full text-left">2.5. Направляющая позы</h3>
            <div className="w-full h-64 bg-gray-700/50 rounded-lg flex justify-center items-center">
                {isLoading && !skeletonImage ? (
                    <div className="text-center text-gray-400">
                        <Spinner />
                        <p className="mt-2">Извлекаем позу...</p>
                    </div>
                ) : skeletonImage ? (
                    <img
                        src={skeletonImage}
                        alt="Сгенерированный скелет позы"
                        className="max-h-full max-w-full object-contain rounded-md"
                    />
                ) : null}
            </div>
             <p className="text-xs text-gray-500 mt-2 text-center">Это дополнительный ориентир; итог может отличаться от исходной позы.</p>
        </div>
    );
};

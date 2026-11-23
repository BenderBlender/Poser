import React from 'react';
import type { PoseExtractionMode } from '../App';

interface PoseExtractionModeSelectorProps {
    selectedMode: PoseExtractionMode;
    onModeChange: (mode: PoseExtractionMode) => void;
}

export const PoseExtractionModeSelector: React.FC<PoseExtractionModeSelectorProps> = ({ selectedMode, onModeChange }) => {
    const modes: { id: PoseExtractionMode; label: string, description: string }[] = [
        { id: 'stickman', label: 'Стикмен', description: 'Простая схема для ориентировочной передачи 2D-позы.' },
        { id: 'mannequin', label: '3D-манекен', description: 'Лучше передает объем и стандартные ракурсы.' },
        { id: 'perspective', label: 'Перспективная сетка', description: 'Для сложных ракурсов (вид сверху/снизу).' },
        { id: 'wireframe', label: 'Каркасная сетка', description: 'Дополнительный ориентир объёма для сложных поз.' },
        { id: 'perspective-wireframe', label: 'Перспектива + Каркас', description: 'Дополнительные ориентиры для ракурсов с перспективой.' }
    ];

    return (
        <div className="max-w-5xl mx-auto mb-8">
            <h3 className="text-lg font-semibold text-center mb-4 text-gray-300">Выберите метод извлечения позы:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {modes.map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`p-4 rounded-lg border-2 transition-all duration-200 text-left h-full flex flex-col justify-between ${
                            selectedMode === mode.id
                                ? 'bg-purple-600/30 border-purple-500'
                                : 'bg-gray-800 border-gray-700 hover:border-purple-600'
                        }`}
                        aria-pressed={selectedMode === mode.id}
                    >
                        <span className="font-bold text-white block">{mode.label}</span>
                        <span className="text-sm text-gray-400 mt-1">{mode.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

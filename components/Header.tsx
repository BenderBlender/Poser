import React from 'react';
import { PersonRunningIcon } from './IconComponents';

export const Header: React.FC = () => {
    return (
        <header className="py-6 md:py-10">
            <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 max-w-6xl">
                <div className="flex justify-center items-center gap-4">
                    <PersonRunningIcon className="w-12 h-12 text-purple-400" />
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-500 text-transparent bg-clip-text">
                        Pose Studio · ChatGPT
                    </h1>
                </div>
                <a
                    href="/api/download-source"
                    download="chatgpt-pose-generator-source.zip"
                    className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-purple-300 border border-purple-500/50 hover:border-purple-400 font-semibold text-sm py-2.5 px-4 rounded-xl shadow transition-all"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                    </svg>
                    <span>Скачать исходный код (.zip)</span>
                </a>
            </div>
        </header>
    );
};

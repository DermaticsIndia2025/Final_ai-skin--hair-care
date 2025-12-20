

import React from 'react';

export const AppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.243 14.243L12 12 7.757 16.243 5.636 14.12l4.243-4.243L5.636 5.636 7.757 3.515 12 7.758l4.243-4.243 2.121 2.121-4.243 4.243 4.243 4.243-2.121 2.12z" />
        <path d="M12 10.586L9.879 8.464l-1.414 1.414L10.586 12l-2.121 2.121 1.414 1.414L12 13.414l2.121 2.121 1.414-1.414L13.414 12l2.121-2.121-1.414-1.414L12 10.586z" />
    </svg>
);

export const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm0 2c2.11 0 3.84.59 5 1H7c1.16-.41 2.89-1 5-1z" />
    </svg>
);

export const BotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8V6a3 3 0 00-3-3H8a3 3 0 00-3 3v2H4v2h1v4a3 3 0 003 3h1v1.33a2 2 0 003.36 1.49L14 17h2a3 3 0 003-3v-4h1V8h-1zM8 5h5a1 1 0 011 1v2H7V6a1 1 0 011-1zm8 8a1 1 0 01-1 1h-2.59l-1.7 1.7a.3.3 0 01-.48-.25V14H8a1 1 0 01-1-1v-4h9v4z" />
        <circle cx="9" cy="11.5" r="1" />
        <circle cx="14" cy="11.5" r="1" />
    </svg>
);

export const CameraIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5 mr-2"} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H4zm10 5a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
);

export const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const SkinIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-8 w-8 text-blue-500"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 9.75h.008v.008H9v-.008zm6 0h.008v.008H15v-.008z" />
    </svg>
);

export const HairIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-8 w-8 text-purple-500"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9c.5-3 3-5 6-5s5.5 2 6 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 13c.5-3 3-5 6-5s5.5 2 6 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 17c.5-3 3-5 6-5s5.5 2 6 5" />
    </svg>
);

export const LoadingDots = () => (
    <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
    </div>
);

export const UploadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5 mr-2"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

export const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

export const CartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

export const AnalyzeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10h.01" />
    </svg>
);
export const GoalAcneIcon = () => <span className="text-xl">😡</span>;
export const GoalOilIcon = () => <span className="text-xl">💧</span>;
export const GoalTextureIcon = () => <span className="text-xl">✨</span>;
export const GoalPoresIcon = () => <span className="text-xl">🎯</span>;
export const GoalToneIcon = () => <span className="text-xl">🎨</span>;
export const GoalHydrationIcon = () => <span className="text-xl">💧</span>;
export const GoalAgingIcon = () => <span className="text-xl">⏳</span>;
export const GoalRednessIcon = () => <span className="text-xl">😊</span>;
export const GoalBarrierIcon = () => <span className="text-xl">🛡️</span>;
export const GoalHealthyIcon = () => <span className="text-xl">❤️</span>;
export const GoalNoneIcon = () => <span className="text-xl">-</span>;

export const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);
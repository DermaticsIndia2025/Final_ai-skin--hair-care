import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sender, MessageType, ConversationStep, type Message, type SkinConditionCategory, type Goal, type ProductRecommendation, type HairQuestion, type Product, type HairProfileData, type UserInfo } from './types';
import { CameraIcon, CheckCircleIcon, LoadingDots, UploadIcon, TrashIcon, CartIcon, AnalyzeIcon, GoalAcneIcon, GoalOilIcon, GoalTextureIcon, GoalPoresIcon, GoalToneIcon, GoalHydrationIcon, GoalAgingIcon, GoalRednessIcon, GoalBarrierIcon, GoalHealthyIcon, GoalNoneIcon, PlusIcon, AppIcon, UserIcon, BotIcon, DownloadIcon } from './components/icons';
import { analyzeSkin, analyzeHair, getSkincareRoutine, getHairCareRoutine, chatWithAI } from './services/geminiService';
import { generatePDF } from './utils/pdfGenerator';
import { CameraCapture } from './components/CameraCapture';

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });

// --- Data for Male Hair Flow ---
const maleHairQuestions: HairQuestion[] = [
    {
        id: 1,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "How much hair do you lose on an average day?",
        options: [
            { label: "Less than 50 strands" },
            { label: "50-100 strands" },
            { label: "100-200 strands" },
            { label: "More than 200 strands / In clumps" }
        ]
    },
    {
        id: 2,
        totalQuestions: 10,
        type: MessageType.HairQuestionImageGrid,
        question: "Which image best describes your hair loss?",
        options: [
            { label: "Stage - 1", image: "/Stage - 01.png" },
            { label: "Stage - 2", image: "/Stage - 02.png" },
            { label: "Stage - 3", image: "/Stage - 03.png" },
            { label: "Stage - 4", image: "/Stage - 04.png" },
            { label: "Stage - 5", image: "/Stage - 05.png" },
            { label: "Stage - 6", image: "/Stage - 06.png" },
            { label: "Coin Size Patch", image: "/Stage - 07.png" },
            { label: "Heavy Hair Fall", image: "/Stage - 08.png" }
        ]
    },
    {
        id: 3,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "Where are you primarily experiencing hair loss?",
        options: [
            { label: "Hairline/Temples" },
            { label: "Crown/Top of head" },
            { label: "Overall thinning" },
            { label: "All of the above" }
        ]
    },
    {
        id: 4,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "Do you have a family history of baldness (from either parent's side)?",
        options: [
            { label: "Yes" },
            { label: "No" },
            { label: "I'm not sure" }
        ]
    },
    {
        id: 5,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "Do you experience dandruff?",
        options: [
            { label: "Never" },
            { label: "Occasionally" },
            { label: "Frequently (visible flakes)" }
        ]
    },
    {
        id: 6,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "How would you describe your scalp?",
        options: [
            { label: "Oily (gets greasy within a day)" },
            { label: "Dry and flaky" },
            { label: "Normal (balanced)" },
            { label: "Itchy or irritated" }
        ]
    },
    {
        id: 7,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "How would you rate your current stress levels?",
        options: [
            { label: "Low" },
            { label: "Moderate" },
            { label: "High" },
            { label: "Very High" }
        ]
    },
    {
        id: 8,
        totalQuestions: 10,
        type: MessageType.HairQuestionCheckbox,
        question: "Have you experienced any of the following recently?",
        options: [
            { label: "Major illness or surgery" },
            { label: "Significant weight loss or gain" },
            { label: "Started or stopped new medication" },
            { label: "None of the above" }
        ]
    },
    {
        id: 9,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "What is your typical diet like?",
        options: [
            { label: "Rich in protein (meat, fish, eggs, legumes)" },
            { label: "Balanced diet" },
            { label: "Mostly vegetarian/vegan" },
            { label: "High in processed/junk food" }
        ]
    },
    {
        id: 10,
        totalQuestions: 10,
        type: MessageType.HairQuestionRadio,
        question: "How often do you wash your hair?",
        options: [
            { label: "Daily" },
            { label: "Every 2-3 days" },
            { label: "Once a week" },
            { label: "Less than once a week" }
        ]
    },
];

// --- Data for Female Hair Flow ---
const femaleHairQuestions: HairQuestion[] = [
    {
        id: 1,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How much hairfall do you experience while oiling, combing or washing your hair?",
        options: [
            { label: "Normal hairfall ~20 strands", image: "/01.png" },
            { label: "I notice a bigger clump than normal ~40-50 strands", image: "/02.png" },
            { label: "I get very big clumps of hair, more than 100 hair strands", image: "/03.png" },
        ]
    },
    {
        id: 2,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How long have you been experiencing increased hairfall?",
        options: [
            { label: "Less than 6 months" },
            { label: "6 months to 2 years" },
            { label: "2 years to 5 years" },
            { label: "More than 5 years" },
            { label: "Not Applicable" },
        ]
    },
    {
        id: 3,
        totalQuestions: 14,
        type: MessageType.HairQuestionCheckbox,
        question: "What does your hair feel like, when you touch it?",
        options: [
            { label: "Feels frizzy, dry, or rough to touch" },
            { label: "Breaks easily" },
            { label: "Smooth or Silky" },
            { label: "Limp or flat" }
        ]
    },
    {
        id: 4,
        totalQuestions: 14,
        type: MessageType.HairQuestionCheckbox,
        question: "What hair treatments have you done in the past 2 years?",
        options: [
            { label: "None" },
            { label: "Smoothening or Straightening treatment" },
            { label: "Hair repair treatment" },
            { label: "Chemical hair coloring" },
            { label: "Natural hair coloring" },
            { label: "Other hair treatments" }
        ]
    },
    {
        id: 5,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "What is your experience with dandruff these days?",
        options: [
            { label: "No dandruff at all" },
            { label: "No dandruff on wash day, but appears 2-3 days after" },
            { label: "Always see visible dandruff flakes or powder on hair or shoulder" },
            { label: "Scalp is always itchy (sticky dandruff under nails upon scratching)" },
            { label: "Persistent red, dry patches on your scalp" }
        ]
    },
    {
        id: 6,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "Are you going through any of these life stages currently?",
        options: [
            { label: "None" },
            { label: "Planning to get pregnant sometime soon" },
            { label: "Currently pregnant" },
            { label: "Post pregnancy (My baby is less than 1 year old)" },
            { label: "I don't get my periods anymore" }
        ]
    },
    {
        id: 7,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How well do you sleep these days?",
        options: [
            { label: "Peacefully for 6-8 hours" },
            { label: "I have difficulty falling asleep" },
            { label: "Disturbed sleep (I wake up at least once a night)" },
            { label: "I sleep for less than 5 hours, as I am very busy" },
            { label: "It varies (Some days I get good sleep, some days I don't)" }
        ]
    },
    {
        id: 8,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How would you describe your stress level these days?",
        options: [
            { label: "I feel calm and relaxed most days, with no major worries" },
            { label: "I feel tensed 1-2 times a week, but it's manageable" },
            { label: "I feel tensed 3-5 times a week, and it affects my mood or focus" },
            { label: "I feel tensed almost every day, and it disrupts my sleep or daily life" }
        ]
    },
    {
        id: 9,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How would you describe your typical energy during the day?",
        options: [
            { label: "I always feel energetic" },
            { label: "Energetic during the day, but low/tired by evening/night" },
            { label: "Low/tired when I wake up, but gradually feel more energetic" },
            { label: "Experience occasional instances of low energy" },
            { label: "I always feel tired and low on energy" }
        ]
    },
    {
        id: 10,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "How often do you wash your hair?",
        options: [
            { label: "Daily" },
            { label: "Every 2-3 days" },
            { label: "Once a week" },
            { label: "Less than once a week" }
        ]
    },
    {
        id: 11,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "Which of these best describe your food habits on most days?",
        options: [
            { label: "I mostly eat healthy homely meals, on time" },
            { label: "I mostly eat healthy homely food, but often skip meals" },
            { label: "I often eat junk food (more than 5 times a week)" }
        ]
    },
    {
        id: 12,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "Do you experience scalp itching or redness frequently?",
        options: [
            { label: "Never" },
            { label: "Occasionally (once in a while)" },
            { label: "Frequently (at least once a week)" },
            { label: "Almost every day" }
        ]
    },
    {
        id: 13,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "Do you notice any flakes, buildup, or oily patches on your scalp?",
        options: [
            { label: "No flakes or buildup" },
            { label: "Mild flakes occasionally" },
            { label: "Frequent flakes or oiliness" },
            { label: "Thick buildup and greasy scalp" }
        ]
    },
    {
        id: 14,
        totalQuestions: 14,
        type: MessageType.HairQuestionRadio,
        question: "Do you feel your scalp is dry or tight after washing?",
        options: [
            { label: "Never" },
            { label: "Sometimes, especially in winter" },
            { label: "Always" }
        ]
    }
];

const allGoals: Goal[] = [
    { id: 'suggestion-acne', text: 'Clear Acne & Breakouts', icon: <GoalAcneIcon />, isSuggestion: false },
    { id: 'suggestion-oil', text: 'Control Oil & Shine', icon: <GoalOilIcon />, isSuggestion: false },
    { id: 'suggestion-texture', text: 'Refine Skin Texture', icon: <GoalTextureIcon />, isSuggestion: false },
    { id: 'suggestion-pores', text: 'Minimize Pore Appearance', icon: <GoalPoresIcon />, isSuggestion: false },
    { id: 'tone', text: 'Even Skin tone & Brighten', icon: <GoalToneIcon />, isSuggestion: false },
    { id: 'hydration', text: 'Boost Hydration', icon: <GoalHydrationIcon />, isSuggestion: false },
    { id: 'aging', text: 'Reduce Fine Lines & Wrinkles', icon: <GoalAgingIcon />, isSuggestion: false },
    { id: 'firmness', text: 'Improve Firmness & Elasticity', icon: <GoalBarrierIcon />, isSuggestion: false },
    { id: 'redness', text: 'Soothe Redness & Irritation', icon: <GoalRednessIcon />, isSuggestion: false },
    { id: 'barrier', text: 'Strengthen Skin Barrier', icon: <GoalBarrierIcon />, isSuggestion: false },
    { id: 'healthy', text: 'Maintain Healthy Skin', icon: <GoalHealthyIcon />, isSuggestion: false },
    { id: 'none', text: 'None of these', icon: <GoalNoneIcon />, isSuggestion: false },
];

const getDynamicSuggestions = (analysis: SkinConditionCategory[]): Goal[] => {
    const suggestions: Goal[] = [];
    const analysisText = analysis.flatMap(cat => cat.conditions.flatMap(c => c.name.toLowerCase())).join(' ');

    const suggestionMap = [
        { keywords: ['acne', 'pustule', 'comedone', 'pimple', 'breakout'], goal: allGoals.find(g => g.id === 'suggestion-acne') },
        { keywords: ['oil', 'oily', 'sebum', 'shine'], goal: allGoals.find(g => g.id === 'suggestion-oil') },
        { keywords: ['texture', 'rough', 'bumpy'], goal: allGoals.find(g => g.id === 'suggestion-texture') },
        { keywords: ['pore', 'enlarged'], goal: allGoals.find(g => g.id === 'suggestion-pores') },
        { keywords: ['spot', 'pigmentation', 'dark', 'tone', 'uneven'], goal: allGoals.find(g => g.id === 'tone') },
        { keywords: ['dry', 'hydration', 'dehydration'], goal: allGoals.find(g => g.id === 'hydration') },
        { keywords: ['wrinkle', 'line', 'aging', 'crow', 'fine line'], goal: allGoals.find(g => g.id === 'aging') },
        { keywords: ['firmness', 'sagging'], goal: allGoals.find(g => g.id === 'firmness') },
        { keywords: ['redness', 'irritation', 'rosacea', 'inflamed'], goal: allGoals.find(g => g.id === 'redness') },
    ];

    suggestionMap.forEach(({ keywords, goal }) => {
        if (goal && keywords.some(kw => analysisText.includes(kw))) {
            suggestions.push({ ...goal, isSuggestion: true });
        }
    });

    return suggestions.length > 0 ? suggestions : [allGoals.find(g => g.id === 'healthy')!];
};

type UploadedImage = { name: string; url: string; base64: string; };

interface CartItem extends Product {
    quantity: number;
}

const ProductSelector: React.FC<{ onSelect: (product: string) => void, prompt: string, disabled?: boolean, selectedProduct?: string, isUser?: boolean }> = ({ onSelect, prompt, disabled = false, selectedProduct, isUser = false }) => {
    const [showOtherInput, setShowOtherInput] = useState(false);
    const [otherValue, setOtherValue] = useState('');

    const products = ["Broad-Spectrum Sunscreen SPF 50", "Gentle Hydrating Cleanser", "Lightweight Moisturizer", "Hyaluronic Acid Serum", "Salicylic Acid Cleanser", "Glycolic Acid Toner", "Niacinamide Serum", "Vitamin C Serum", "Rich Moisturizer", "Retinol Cream", "Other", "None of these"];

    if (selectedProduct) {
        return <p>{selectedProduct}</p>;
    }

    if (showOtherInput) {
        return (
            <div className="p-4">
                <form onSubmit={(e) => { e.preventDefault(); if (otherValue.trim()) onSelect(otherValue.trim()); }} className="flex gap-2">
                    <input
                        type="text"
                        value={otherValue}
                        onChange={(e) => setOtherValue(e.target.value)}
                        placeholder="Enter product name..."
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black"
                        autoFocus
                        disabled={disabled}
                    />
                    <button type="submit" className="px-4 py-2 font-semibold rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700" disabled={disabled}>Submit</button>
                </form>
            </div>
        )
    }
    return (
        <div className="p-4">
            <div className="mb-4">
                <p className={`font-bold ${isUser ? 'text-blue-600' : 'text-gray-800'}`}>{prompt}</p>
                <p className="text-sm mt-1 text-red-500">This helps us avoid recommending things that didn't work for you.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {products.map(p => {
                    let btnClass = "";
                    if (selectedProduct === p) {
                        btnClass = 'bg-blue-600 text-white hover:bg-blue-700';
                    } else {
                        btnClass = 'bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed';
                    }

                    return (
                        <button
                            key={p}
                            onClick={() => p === "Other" ? setShowOtherInput(true) : onSelect(p)}
                            disabled={disabled}
                            className={`px-4 py-2 text-sm rounded-full transition-colors ${btnClass}`}
                        >
                            {p}
                        </button>
                    )
                })}
            </div>
        </div>
    );
};

const UserInfoForm: React.FC<{ onSubmit: (info: UserInfo) => void }> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name && age && phone && email) {
            onSubmit({ name, age, phone, email });
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-md mx-auto my-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Personal Information</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter your name"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                        type="number"
                        required
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter your age"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter your phone number"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Enter your email"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 mt-2"
                >
                    Start Assessment
                </button>
            </form>
        </div>
    );
};

const AnalysisResultView: React.FC<{
    images: UploadedImage[],
    analysis: SkinConditionCategory[],
    onReAnalyze: () => void,
    onNext: () => void,
    nextLabel?: string
}> = ({ images, analysis, onReAnalyze, onNext, nextLabel = "Next: Set My Goals" }) => {
    const [showLabels, setShowLabels] = useState(true);
    const [activeConditionName, setActiveConditionName] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const mainImage = images[activeImageIndex];

    const getCategoryStyles = (category: string) => {
        const catLower = category.toLowerCase();

        // Skin Categories
        if (catLower.includes('acne') || catLower.includes('breakout')) return { color: 'red', textColor: 'text-red-700', borderColor: 'border-red-500', bgColor: 'bg-red-500', bgLight: 'bg-red-50' };
        if (catLower.includes('oil') || catLower.includes('sebum')) return { color: 'yellow', textColor: 'text-yellow-700', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500', bgLight: 'bg-yellow-50' };
        if (catLower.includes('texture') || catLower.includes('pore') || catLower.includes('smooth')) return { color: 'green', textColor: 'text-green-700', borderColor: 'border-green-500', bgColor: 'bg-green-500', bgLight: 'bg-green-50' };
        if (catLower.includes('wrinkle') || catLower.includes('aging') || catLower.includes('line')) return { color: 'blue', textColor: 'text-blue-700', borderColor: 'border-blue-500', bgColor: 'bg-blue-500', bgLight: 'bg-blue-50' };
        if (catLower.includes('pigmentation') || catLower.includes('spot') || catLower.includes('dark')) return { color: 'purple', textColor: 'text-purple-700', borderColor: 'border-purple-500', bgColor: 'bg-purple-500', bgLight: 'bg-purple-50' };

        // Hair Categories (Dynamic Matching)
        if (catLower.includes('loss') || catLower.includes('alopecia') || catLower.includes('balding') || catLower.includes('receding') || catLower.includes('thinning')) return { color: 'red', textColor: 'text-red-700', borderColor: 'border-red-500', bgColor: 'bg-red-500', bgLight: 'bg-red-50' };
        if (catLower.includes('scalp') || catLower.includes('dandruff') || catLower.includes('dermatitis') || catLower.includes('flake') || catLower.includes('inflammation')) return { color: 'yellow', textColor: 'text-yellow-700', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500', bgLight: 'bg-yellow-50' };
        if (catLower.includes('damage') || catLower.includes('breakage') || catLower.includes('quality') || catLower.includes('frizz') || catLower.includes('structure')) return { color: 'orange', textColor: 'text-orange-700', borderColor: 'border-orange-500', bgColor: 'bg-orange-500', bgLight: 'bg-orange-50' };
        if (catLower.includes('type') || catLower.includes('density') || catLower.includes('volume')) return { color: 'blue', textColor: 'text-blue-700', borderColor: 'border-blue-500', bgColor: 'bg-blue-500', bgLight: 'bg-blue-50' };
        if (catLower.includes('healthy')) return { color: 'green', textColor: 'text-green-700', borderColor: 'border-green-500', bgColor: 'bg-green-500', bgLight: 'bg-green-50' };

        return { color: 'gray', textColor: 'text-gray-700', borderColor: 'border-gray-500', bgColor: 'bg-gray-500', bgLight: 'bg-gray-50' };
    };

    const getCategoryIcon = (category: string, color: string) => {
        if (color === 'red') return (
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        );
        if (color === 'yellow') return (
            <svg className="w-5 h-5 text-yellow-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
        );
        if (color === 'green') return (
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
        );

        return <div className={`w-2 h-2 rounded-full bg-${color}-500`}></div>;
    }

    return (
        <div className="p-1 space-y-3">
            <div className="flex justify-between items-center px-2 pt-1">
                <div className="flex items-center gap-2">
                    <div className="text-green-500"><CheckCircleIcon /></div>
                    <span className="font-bold text-gray-800 text-sm">Analysis Complete!</span>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showLabels}
                            onChange={(e) => setShowLabels(e.target.checked)}
                            className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                        />
                        Show labels
                    </label>
                    <button onClick={onReAnalyze} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-semibold hover:bg-blue-700 transition-colors">
                        Re-analyze
                    </button>
                </div>
            </div>

            <p className="px-2 text-xs text-blue-500">
                To see highlights on the image, click the problems listed below.
            </p>

            {mainImage && (
                <div className="relative rounded-xl overflow-hidden bg-gray-50 mx-1 flex justify-center">
                    <div className="relative inline-block">
                        <img src={mainImage.url} alt="Analyzed skin" className="max-h-96 w-auto max-w-full block" />

                        {analysis.flatMap(cat =>
                            cat.conditions.flatMap((cond, condIdx) => {
                                const styles = getCategoryStyles(cat.category);
                                const isSelected = activeConditionName === cond.name;
                                const isVisible = showLabels || isSelected;

                                if (!isVisible) return null;

                                const opacityClass = (showLabels && activeConditionName && !isSelected) ? 'opacity-40' : 'opacity-100';

                                return cond.boundingBoxes.map((box, boxIdx) => {
                                    if (box.imageId !== activeImageIndex) return null;

                                    const left = box.box.x1 * 100;
                                    const top = box.box.y1 * 100;
                                    const width = (box.box.x2 - box.box.x1) * 100;
                                    const height = (box.box.y2 - box.box.y1) * 100;

                                    return (
                                        <div
                                            key={`${cond.name}-${boxIdx}`}
                                            className={`absolute border-2 rounded-lg ${styles.borderColor} z-10 box-border transition-opacity duration-300 ${opacityClass}`}
                                            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                                        >
                                            {boxIdx === 0 && (
                                                <div className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-md text-xs font-bold text-white whitespace-nowrap shadow-md z-20 ${styles.bgColor} flex items-center gap-1`}>
                                                    <span>{cond.name}</span>
                                                    <span className="opacity-90">({Math.round(cond.confidence)}%)</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })
                        )}
                    </div>
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar w-full max-w-full px-1">
                {images.map((img, idx) => (
                    <div key={idx} onClick={() => setActiveImageIndex(idx)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${idx === activeImageIndex ? 'border-blue-500 ring-2 ring-blue-500' : 'border-transparent'}`}>
                        <img src={img.url} alt="thumbnail" className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>

            <div className="px-2 pb-2 space-y-4 mt-2 max-h-64 overflow-y-auto custom-scrollbar">
                {analysis.map((cat, i) => {
                    const styles = getCategoryStyles(cat.category);

                    return (
                        <div key={i}>
                            <div className="flex items-center gap-2 mb-2">
                                {getCategoryIcon(cat.category, styles.color)}
                                <span className={`font-bold text-sm ${styles.textColor}`}>{cat.category}</span>
                            </div>

                            <div className="space-y-3 pl-1">
                                {cat.conditions.map((cond, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex justify-between items-start border-b border-gray-50 pb-2 cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors ${activeConditionName === cond.name ? 'bg-blue-50' : ''}`}
                                        onClick={() => setActiveConditionName(activeConditionName === cond.name ? null : cond.name)}
                                    >
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{cond.name}</p>
                                            <p className="text-xs text-gray-500">{cond.location}</p>
                                        </div>
                                        <div className={`font-bold text-sm ${styles.textColor}`}>
                                            {Math.round(cond.confidence)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            <button onClick={onNext} className="w-full mt-2 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                {nextLabel}
            </button>
        </div>
    );
};

const CartView: React.FC<{
    items: CartItem[];
    onClose: () => void;
    onRemove: (index: number) => void;
    onUpdateQuantity: (index: number, delta: number) => void;
}> = ({ items, onClose, onRemove, onUpdateQuantity }) => {
    const checkoutUrl = useMemo(() => {
        if (items.length === 0) return 'https://dermatics.in/account/login';

        // Convert variant GIDs (gid://shopify/ProductVariant/123) to numeric IDs if needed
        const itemsString = items
            .map(item => {
                const variantId = item.variantId?.includes('ProductVariant/')
                    ? item.variantId.split('ProductVariant/')[1]
                    : item.variantId;
                return `${variantId}:${item.quantity}`;
            })
            .join(',');

        const cartPath = `/cart/${itemsString}`;
        return `https://dermatics.in/account/login?checkout_url=${encodeURIComponent(cartPath)}`;
    }, [items]);

    return (
        <div className="absolute inset-0 z-50 bg-black bg-opacity-50 flex justify-end">
            <div className="w-4/5 max-w-sm bg-white h-full shadow-xl flex flex-col animate-fadeIn">
                <div className="p-4 border-b flex justify-between items-center bg-blue-600 text-white">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <CartIcon /> My Cart ({items.reduce((sum, item) => sum + item.quantity, 0)})
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-full">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {items.length === 0 ? (
                        <div className="text-center text-gray-500 mt-10">
                            <CartIcon />
                            <p className="mt-2">Your bucket is empty</p>
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <div key={item.name} className="flex gap-3 border-b pb-3">
                                <div className="w-16 h-16 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm line-clamp-2">{item.name}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{item.price}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="flex items-center border rounded bg-gray-50">
                                            <button onClick={() => onUpdateQuantity(idx, -1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-200 font-medium">-</button>
                                            <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(idx, 1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-200 font-medium">+</button>
                                        </div>
                                        <button onClick={() => onRemove(idx)} className="text-red-500 text-xs font-medium hover:text-red-700">Remove</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50">
                    <a
                        href={items.length > 0 ? checkoutUrl : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block w-full py-3 bg-blue-600 text-white text-center font-bold rounded-lg hover:bg-blue-700 transition-colors ${items.length === 0 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                        Checkout Now
                    </a>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const [skinAnalysisResult, setSkinAnalysisResult] = useState<SkinConditionCategory[] | null>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    // Cart State
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [conversationState, setConversationState] = useState({
        assessmentType: null as 'skin' | 'hair' | null,
        step: ConversationStep.UserDetails,
        hairQuestionIndex: 0,
        hairAnswers: {} as Record<number, string | string[]>,
        skinProducts: [] as { name: string, currentlyUsing?: boolean, duration?: string }[],
        skinGoals: [] as string[],
    });

    const chatEndRef = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const conversationStateRef = useRef(conversationState);
    useEffect(() => { conversationStateRef.current = conversationState; }, [conversationState]);
    const uploadedImagesRef = useRef(uploadedImages);
    useEffect(() => { uploadedImagesRef.current = uploadedImages; }, [uploadedImages]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (sender: Sender, type: MessageType, content: any, payload?: any, step?: ConversationStep) => {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender, type, content, payload, step }]);
    };

    const addToCart = (product: Product) => {
        setCartItems(prev => {
            const existingIndex = prev.findIndex(item => item.name === product.name);
            if (existingIndex > -1) {
                const newCart = [...prev];
                newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + 1 };
                return newCart;
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setIsCartOpen(true);
    };

    const removeFromCart = (index: number) => {
        setCartItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleQuantityChange = (index: number, delta: number) => {
        setCartItems(prev => {
            const newCart = [...prev];
            const item = newCart[index];
            const newQuantity = item.quantity + delta;

            if (newQuantity < 1) {
                return prev.filter((_, i) => i !== index);
            }

            newCart[index] = { ...item, quantity: newQuantity };
            return newCart;
        });
    };

    const advanceConversation = useCallback((nextStep: ConversationStep, payload?: any) => {
        setConversationState(s => ({ ...s, step: nextStep }));

        switch (nextStep) {
            case ConversationStep.Skin_ProductUsage_Start:
                addMessage(Sender.Bot, MessageType.Text,
                    <div className="space-y-1">
                        <p className="font-bold">
                            <span className="text-blue-700">Step 1:</span>
                            <span className="text-gray-800"> Past Product Usage</span>
                        </p>
                        <p className="text-sm text-gray-600">Tell us about products you've used. This helps us avoid recommending things that didn't work for you.</p>
                    </div>
                );
                setTimeout(() => addMessage(Sender.User, MessageType.ProductOptions, "Tell us about products you've used."), 200);
                break;
            case ConversationStep.Skin_ProductUsage_Loop:
                addMessage(Sender.User, MessageType.ProductOptions, "What other product have you used?");
                break;
            case ConversationStep.Skin_ProductUsage_AskCurrentlyUsing:
                setTimeout(() => addMessage(Sender.Bot, MessageType.YesNo, "Are you currently using it?"), 500);
                break;
            case ConversationStep.Skin_ProductUsage_AskDuration:
                setTimeout(() => addMessage(Sender.Bot, MessageType.DurationOptions, "How long have you used it?"), 500);
                break;
            case ConversationStep.Skin_ProductUsage_AskOther:
                setTimeout(() => addMessage(Sender.Bot, MessageType.YesNo, "Using any other products?"), 500);
                break;
            case ConversationStep.Skin_Analysis:
                addMessage(Sender.Bot, MessageType.ImageUpload, null);
                break;
            case ConversationStep.Skin_Goals:
                addMessage(Sender.User, MessageType.Text, "Set My Goals");
                setTimeout(() => addMessage(Sender.Bot, MessageType.GoalSelection, null), 500);
                break;
            case ConversationStep.Hair_Gender:
                addMessage(Sender.Bot, MessageType.Text, "AI Haircare Treatment Finder");
                setTimeout(() => addMessage(Sender.Bot, MessageType.Text, "We'd love to personalize your care experience. Could you tell us your gender?"), 300);
                setTimeout(() => addMessage(Sender.Bot, MessageType.GenderOptions, "Please select your gender."), 800);
                break;
            case ConversationStep.Hair_Questioning:
                addMessage(Sender.User, MessageType.Text, payload.gender);

                let firstQuestion;
                if (payload.gender === 'Male') {
                    firstQuestion = maleHairQuestions[0];
                } else {
                    // Trigger Female Flow
                    firstQuestion = femaleHairQuestions[0];
                }
                setConversationState(s => ({ ...s, hairQuestionIndex: 0 }));
                setTimeout(() => addMessage(Sender.Bot, firstQuestion.type, firstQuestion), 500);
                break;
        }
    }, []);

    const runSkinAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        addMessage(Sender.Bot, MessageType.Loading, "Analyzing your skin...");
        const result = await analyzeSkin(uploadedImages.map(img => img.base64));
        setSkinAnalysisResult(result);

        setMessages(prev => prev.filter(msg => msg.type !== MessageType.Loading));

        setMessages(prev => prev.map(msg =>
            msg.type === MessageType.ImageUpload
                ? { ...msg, payload: { ...msg.payload, submitted: true } }
                : msg
        ));

        addMessage(Sender.User, MessageType.Image, uploadedImages);

        addMessage(Sender.Bot, MessageType.AnalysisResult, { images: uploadedImages, analysis: result });
        setIsAnalyzing(false);
    }, [uploadedImages]);

    const runHairAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        addMessage(Sender.Bot, MessageType.Loading, "Analyzing your hair & scalp...");
        const response = await analyzeHair(uploadedImages.map(img => img.base64));

        const result = response.analysis || [];
        setSkinAnalysisResult(result);

        setMessages(prev => prev.filter(msg => msg.type !== MessageType.Loading));

        setMessages(prev => prev.map(msg =>
            msg.type === MessageType.ImageUpload
                ? { ...msg, payload: { ...msg.payload, submitted: true } }
                : msg
        ));

        addMessage(Sender.User, MessageType.Image, uploadedImages);

        // Reusing AnalysisResultView as the structure is compatible
        addMessage(Sender.Bot, MessageType.AnalysisResult, { images: uploadedImages, analysis: result });
        setIsAnalyzing(false);
    }, [uploadedImages]);

    const handleReAnalyze = useCallback(() => {
        setUploadedImages([]);
        setSkinAnalysisResult(null);
        setIsAnalyzing(false);
        setActiveImageIndex(0);
        // Determine if we were in Skin or Hair flow to restart correctly
        if (conversationStateRef.current.assessmentType === 'hair') {
            // Re-trigger Hair Upload Step. Correctly passing payload.
            addMessage(Sender.Bot, MessageType.ImageUpload, null, { isHair: true });
        } else {
            advanceConversation(ConversationStep.Skin_Analysis);
        }
    }, [advanceConversation]);

    const handleReset = useCallback(() => {
        // Reset all state variables to initial values
        setUploadedImages([]);
        setSkinAnalysisResult(null);
        setIsAnalyzing(false);
        setActiveImageIndex(0);
        setCartItems([]); // Reset Cart too
        setUserInfo(null);
        setIsCartOpen(false);
        setConversationState({
            assessmentType: null,
            step: ConversationStep.UserDetails,
            hairQuestionIndex: 0,
            hairAnswers: {},
            skinProducts: [],
            skinGoals: [],
        });

        // Reset messages manually
        setMessages([
            { id: Date.now(), sender: Sender.Bot, type: MessageType.Text, content: "Hello! I'm your AI Dermatologist assistant." }
        ]);

        // Re-trigger the user info form
        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now(), sender: Sender.Bot, type: MessageType.UserInfo, content: null }]);
        }, 600);
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const files = Array.from(e.target.files);
        const newImagesBase64 = await Promise.all(files.map(fileToBase64));
        const newImages = files.map((file: File, index) => ({
            name: file.name,
            url: URL.createObjectURL(file),
            base64: newImagesBase64[index],
        }));

        const allImages = [...uploadedImagesRef.current, ...newImages];
        setUploadedImages(allImages);
        setActiveImageIndex(allImages.length - 1);
        e.target.value = '';
    }, []);

    const handleCameraCapture = useCallback(async (file: File) => {
        const base64 = await fileToBase64(file);
        const newImage = {
            name: file.name,
            url: URL.createObjectURL(file),
            base64: base64,
        };

        const allImages = [...uploadedImagesRef.current, newImage];
        setUploadedImages(allImages);
        setActiveImageIndex(allImages.length - 1);
    }, []);

    const handleRemoveImage = (indexToRemove: number) => {
        const updatedImages = uploadedImages.filter((_, index) => index !== indexToRemove);
        setUploadedImages(updatedImages);
        if (activeImageIndex >= updatedImages.length) {
            setActiveImageIndex(Math.max(0, updatedImages.length - 1));
        } else if (activeImageIndex === indexToRemove) {
            setActiveImageIndex(Math.max(0, activeImageIndex - 1));
        }
    };

    const handleNextStep = useCallback(async (step: ConversationStep | string, payload?: any) => {
        setMessages(prev => prev.filter(msg => msg.type !== MessageType.NextStep));

        switch (step) {
            case ConversationStep.Skin_Goals:
                advanceConversation(ConversationStep.Skin_Goals);
                break;
            case ConversationStep.Skin_Recommendations:
                const selectedGoals = payload.goals.filter((g: string) => g !== 'None of these');
                if (selectedGoals.length > 0) {
                    addMessage(Sender.User, MessageType.Text, `My goals: ${selectedGoals.join(', ')}`);
                } else {
                    addMessage(Sender.User, MessageType.Text, `No specific goals selected.`);
                }
                setConversationState(s => ({ ...s, skinGoals: payload.goals }));
                addMessage(Sender.Bot, MessageType.Loading, "Generating your personalized skincare...");
                const recs = await getSkincareRoutine(skinAnalysisResult!, payload.goals);
                setMessages(prev => prev.filter(msg => msg.type !== MessageType.Loading));
                addMessage(Sender.Bot, MessageType.ProductRecommendation, recs);
                break;
            case ConversationStep.Hair_Gender:
                advanceConversation(ConversationStep.Hair_Gender);
                break;
            case ConversationStep.Hair_Questioning:
                advanceConversation(ConversationStep.Hair_Questioning, payload);
                break;
            case ConversationStep.Hair_Analysis:
                // Trigger Hair Analysis Upload Step. Correctly passing payload.
                addMessage(Sender.Bot, MessageType.ImageUpload, null, { isHair: true });
                break;
            case ConversationStep.Hair_Recommendations:
                addMessage(Sender.Bot, MessageType.Loading, "Generating your personalized hair care routine...");

                const hairProfile: Partial<HairProfileData> = {
                    ...conversationState.hairAnswers
                };

                const hairRecs = await getHairCareRoutine(hairProfile, skinAnalysisResult || [], []);
                setMessages(prev => prev.filter(msg => msg.type !== MessageType.Loading));
                addMessage(Sender.Bot, MessageType.ProductRecommendation, hairRecs);
                break;
            case ConversationStep.Skin_Report:
                addMessage(Sender.User, MessageType.Text, "AI Doctor's Report");
                setConversationState(s => ({ ...s, step: ConversationStep.Skin_Report }));
                setTimeout(() => addMessage(Sender.Bot, MessageType.DoctorReport, null), 500);
                break;
        }
    }, [skinAnalysisResult, conversationState, advanceConversation]);

    const handleProductSelection = useCallback((product: string) => {
        setMessages(prev => {
            const lastOptionsIndex = prev.map(m => m.type).lastIndexOf(MessageType.ProductOptions);
            if (lastOptionsIndex > -1) {
                const newMessages = [...prev];
                const originalMessage = newMessages[lastOptionsIndex];
                newMessages[lastOptionsIndex] = {
                    ...originalMessage,
                    payload: { ...originalMessage.payload, disabled: true, selectedProduct: product }
                };
                return newMessages;
            }
            return prev;
        });

        if (product === "None of these") {
            advanceConversation(ConversationStep.Skin_Analysis);
        } else {
            setConversationState(s => ({
                ...s,
                skinProducts: [...s.skinProducts, { name: product }],
            }));
            advanceConversation(ConversationStep.Skin_ProductUsage_AskCurrentlyUsing);
        }
    }, [advanceConversation]);

    const handleInteractiveResponse = useCallback((value: string) => {
        const { step } = conversationStateRef.current;
        // Instead of removing the message, convert it to a Text message to preserve history
        setMessages(prev => prev.map(msg => {
            if (msg.type === MessageType.YesNo || msg.type === MessageType.DurationOptions) {
                return { ...msg, type: MessageType.Text };
            }
            return msg;
        }));

        addMessage(Sender.User, MessageType.Text, value);

        switch (step) {
            case ConversationStep.Skin_ProductUsage_AskCurrentlyUsing:
                const isCurrentlyUsing = value === 'Yes';
                setConversationState(s => {
                    const updatedProducts = [...s.skinProducts];
                    const lastProductIndex = updatedProducts.length - 1;
                    if (lastProductIndex >= 0) {
                        updatedProducts[lastProductIndex].currentlyUsing = isCurrentlyUsing;
                    }
                    return { ...s, skinProducts: updatedProducts };
                });

                if (isCurrentlyUsing) {
                    advanceConversation(ConversationStep.Skin_ProductUsage_AskDuration);
                } else {
                    advanceConversation(ConversationStep.Skin_ProductUsage_AskOther);
                }
                break;
            case ConversationStep.Skin_ProductUsage_AskDuration:
                setConversationState(s => {
                    const updatedProducts = [...s.skinProducts];
                    const lastProductIndex = updatedProducts.length - 1;
                    if (lastProductIndex >= 0) {
                        updatedProducts[lastProductIndex].duration = value;
                    }
                    return { ...s, skinProducts: updatedProducts };
                });
                advanceConversation(ConversationStep.Skin_ProductUsage_AskOther);
                break;
            case ConversationStep.Skin_ProductUsage_AskOther:
                if (value === 'Yes') {
                    advanceConversation(ConversationStep.Skin_ProductUsage_Loop);
                } else {
                    advanceConversation(ConversationStep.Skin_Analysis);
                }
                break;
        }
    }, [advanceConversation]);

    const handleChatSubmit = useCallback(async (query: string) => {
        // Replace ChatInput with User Text
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg.type === MessageType.ChatInput) {
                newMessages[newMessages.length - 1] = { ...lastMsg, type: MessageType.Text, content: query, sender: Sender.User };
            } else {
                // Fallback if for some reason the last message wasn't ChatInput
                newMessages.push({ id: Date.now(), sender: Sender.User, type: MessageType.Text, content: query });
            }
            return newMessages;
        });

        addMessage(Sender.Bot, MessageType.Loading, "Thinking...");

        // Gather context
        const recommendationsMsg = messages.find(m => m.type === MessageType.ProductRecommendation);
        const recommendations = recommendationsMsg ? recommendationsMsg.content : null;

        const context = {
            analysis: skinAnalysisResult,
            recommendations: recommendations
        };

        const response = await chatWithAI(query, context);

        setMessages(prev => prev.filter(msg => msg.type !== MessageType.Loading));
        addMessage(Sender.Bot, MessageType.Text, response);
        addMessage(Sender.Bot, MessageType.ChatInput, null);

    }, [messages, skinAnalysisResult]);

    const handleUserInfoSubmit = (info: UserInfo) => {
        setUserInfo(info);
        addMessage(Sender.User, MessageType.UserInfo, info);
        setTimeout(() => {
            addMessage(Sender.Bot, MessageType.Text, `Thank you, ${info.name.split(' ')[0]}! Now, please select a concern to begin.`);
            setTimeout(() => {
                addMessage(Sender.Bot, MessageType.AssessmentOptions, null);
            }, 600);
        }, 500);
        setConversationState(s => ({ ...s, step: ConversationStep.Initial }));
    };

    const handleInitialChoice = (choice: 'skin' | 'hair') => {
        // Clear previous analysis data when switching context
        setUploadedImages([]);
        setSkinAnalysisResult(null);
        setConversationState({ ...conversationState, assessmentType: choice, step: choice === 'skin' ? ConversationStep.Skin_ProductUsage_Start : ConversationStep.Hair_Gender });
        const content = choice === 'skin' ? 'Skin Assessment' : 'Hair Assessment';
        const image = choice === 'skin' ? '/skin_assessment.png' : '/hair_assessment.png';

        if (choice === 'hair') {
            // Show the specific Hair Assessment Card
            addMessage(Sender.User, MessageType.HairAssessmentStart, null);
        } else {
            addMessage(Sender.User, MessageType.AssessmentOptions, { content, image });
        }

        const nextStep = choice === 'skin' ? ConversationStep.Skin_ProductUsage_Start : ConversationStep.Hair_Gender;
        setTimeout(() => advanceConversation(nextStep), 500);
    };

    const handleHairAnswer = (questionId: number, answer: string | string[]) => {
        const answerText = Array.isArray(answer) ? answer.join(', ') : answer;
        addMessage(Sender.User, MessageType.Text, answerText);
        const newAnswers = { ...conversationState.hairAnswers, [questionId]: answer };
        setConversationState(s => ({ ...s, hairAnswers: newAnswers }));

        // Check gender from state/history to pick correct question set
        const genderMessage = messages.find(m => m.type === MessageType.Text && (m.content === 'Male' || m.content === 'Female'));
        const gender = genderMessage ? genderMessage.content : 'Male';

        const activeQuestions = gender === 'Female' ? femaleHairQuestions : maleHairQuestions;

        const nextQuestionIndex = conversationState.hairQuestionIndex + 1;
        if (nextQuestionIndex < activeQuestions.length) {
            setConversationState(s => ({ ...s, hairQuestionIndex: nextQuestionIndex }));
            const nextQuestion = activeQuestions[nextQuestionIndex];
            setTimeout(() => addMessage(Sender.Bot, nextQuestion.type, nextQuestion), 500);
        } else {
            // End of Questions, proceed to Hair Analysis Upload DIRECTLY
            setConversationState(s => ({ ...s, step: ConversationStep.Hair_Analysis }));
            setTimeout(() => addMessage(Sender.Bot, MessageType.ImageUpload, null, { isHair: true }), 500);
        }
    };

    const FormattedText: React.FC<{ text: string }> = ({ text }) => {
        const lines = text.split('\n');
        return (
            <div className="space-y-2">
                {lines.map((line, i) => {
                    // Handle headers (###)
                    if (line.trim().startsWith('###')) {
                        return <h3 key={i} className="text-md font-bold text-blue-700 mt-2">{line.replace('###', '').trim()}</h3>;
                    }
                    // Handle bullet points
                    if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                        const content = line.trim().substring(1).trim();
                        return (
                            <div key={i} className="flex gap-2 ml-2">
                                <span className="text-blue-500">•</span>
                                <span className="flex-1">{renderInline(content)}</span>
                            </div>
                        );
                    }
                    // Regular line
                    return (
                        <p key={i} className="leading-relaxed">
                            {renderInline(line)}
                        </p>
                    );
                })}
            </div>
        );
    };

    const renderInline = (content: string) => {
        // Handle Bold (**text**)
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    const MessageContent: React.FC<{ message: Message }> = ({ message }) => {
        switch (message.type) {
            case MessageType.Text:
                if (typeof message.content === 'string') {
                    return <FormattedText text={message.content} />;
                }
                return <div>{message.content}</div>;
            case MessageType.Loading: return <div className="flex items-center gap-2"><LoadingDots /> <p>{message.content}</p></div>;
            case MessageType.UserInfo:
                if (message.sender === Sender.User) {
                    return (
                        <div className="space-y-1">
                            <p className="font-semibold">{message.content.name}</p>
                            <p className="text-xs opacity-80">{message.content.age} years | {message.content.phone}</p>
                            <p className="text-xs opacity-80">{message.content.email}</p>
                        </div>
                    );
                }
                return <UserInfoForm onSubmit={handleUserInfoSubmit} />;
            case MessageType.AssessmentOptions:
                if (message.sender === Sender.User) {
                    return (
                        <div className="flex items-center gap-3">
                            <img src={message.content.image} alt={message.content.content} className="w-10 h-10 rounded-full" />
                            <span className="font-semibold">{message.content.content}</span>
                        </div>
                    );
                }
                return (
                    <div>
                        <p className="mb-4 text-center font-semibold">Please select a concern to begin.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleInitialChoice('skin')} className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
                                <img src="/skin_assessment.png" alt="Skin Assessment" className="w-20 h-20 mb-2" />
                                <span className="font-semibold">Skin Assessment</span>
                            </button>
                            <button onClick={() => handleInitialChoice('hair')} className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
                                <img src="/hair_assessment.png" alt="Hair Assessment" className="w-20 h-20 mb-2" />
                                <span className="font-semibold">Hair Assessment</span>
                            </button>
                        </div>
                    </div>
                );
            // New Hair Assessment Start Card
            case MessageType.HairAssessmentStart:
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-200">
                            <img src="/hair_assessment.png" alt="Hair Assessment" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-semibold text-white">Hair Assessment</span>
                    </div>
                );
            case MessageType.ProductOptions: {
                return <ProductSelector
                    onSelect={handleProductSelection}
                    prompt={message.content}
                    disabled={message.payload?.disabled}
                    selectedProduct={message.payload?.selectedProduct}
                    isUser={message.sender === Sender.User}
                />;
            }
            case MessageType.YesNo:
                return (
                    <div className="space-y-3 p-2">
                        <p className="font-semibold">{message.content}</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => handleInteractiveResponse('Yes')} className="px-4 py-2.5 text-center border-2 border-gray-200 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">Yes</button>
                            <button onClick={() => handleInteractiveResponse('No')} className="px-4 py-2.5 text-center border-2 border-gray-200 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">No</button>
                        </div>
                    </div>
                );
            case MessageType.DurationOptions:
                const durations = ["1 Week", "2 Weeks", "1 Month", "3 Months", "6 Months", "1 Year", "2 Years", "More than 2 years"];
                return (
                    <div className="p-1">
                        <p className="font-semibold mb-3">{message.content}</p>
                        <div className="flex flex-wrap gap-2">
                            {durations.map(d =>
                                <button key={d} onClick={() => handleInteractiveResponse(d)} className="px-4 py-2 text-sm rounded-full transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100">{d}</button>
                            )}
                        </div>
                    </div>
                );
            case MessageType.ImageUpload:
                if (message.payload?.submitted) {
                    return (
                        <div className="space-y-2 p-3">
                            <p className="font-bold">
                                <span className="text-blue-700">Step 2:</span>
                                <span className="text-gray-800"> AI Face Analysis</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                For best results, upload clear, well-lit photos from different angles. <span className="text-blue-600 font-semibold">More images ensure a more accurate analysis.</span>
                            </p>
                        </div>
                    );
                }

                if (uploadedImages.length > 0) {
                    // UPDATED: Check message.payload.isHair from the context of the original message
                    const isHairContext = message.payload?.isHair;

                    return (
                        <div className="space-y-3 p-2 w-full">
                            <p className="font-bold">
                                <span className="text-blue-700">Step 2:</span>
                                <span className="text-gray-800"> {isHairContext ? 'AI Hair & Scalp Analysis' : 'AI Face Analysis'}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                For best results, upload clear, well-lit photos from different angles. <span className="text-blue-600 font-semibold cursor-pointer">More images ensure a more accurate analysis.</span>
                            </p>

                            <div className="relative w-full bg-gray-100 rounded-xl overflow-hidden flex justify-center">
                                <div className="relative">
                                    <img src={uploadedImages[activeImageIndex]?.url} alt="Main preview" className="max-h-96 w-auto max-w-full object-contain" />
                                    {!isAnalyzing && (
                                        <button onClick={() => handleRemoveImage(activeImageIndex)} className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors z-30">
                                            <TrashIcon />
                                        </button>
                                    )}
                                    {isAnalyzing && (
                                        <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden">
                                            <div className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_20px_2px_rgba(59,130,246,0.8)] animate-scan"></div>
                                            <div className="absolute inset-0 bg-blue-900/10"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar w-full max-w-full">
                                {uploadedImages.map((img, idx) => (
                                    <div key={idx} onClick={() => setActiveImageIndex(idx)} className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${idx === activeImageIndex ? 'border-blue-500 ring-2 ring-blue-500' : 'border-transparent'}`}>
                                        <img src={img.url} alt="thumbnail" className="w-full h-full object-cover" />
                                    </div>
                                ))}

                                <button disabled={isAnalyzing} onClick={() => uploadInputRef.current?.click()} className="flex-shrink-0 w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <PlusIcon />
                                    <span className="text-[10px] font-medium mt-0.5">Add</span>
                                </button>

                                <button disabled={isAnalyzing} onClick={() => setIsCameraOpen(true)} className="flex-shrink-0 w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <CameraIcon className="w-5 h-5 text-gray-400 mb-0" />
                                    <span className="text-[10px] font-medium mt-0.5">Camera</span>
                                </button>
                            </div>

                            {/* UPDATED: Dynamic Button Logic */}
                            <button
                                disabled={isAnalyzing}
                                onClick={isHairContext ? runHairAnalysis : runSkinAnalysis}
                                className="w-full mt-2 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-base flex justify-center items-center disabled:bg-blue-400 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <LoadingDots /> <span className="ml-2">Scanning...</span>
                                    </>
                                ) : (
                                    isHairContext ? "Analyze My Hair" : "Analyze My Skin"
                                )}
                            </button>
                        </div>
                    );
                }

                if (message.payload?.isHair) {
                    return (
                        <div className="space-y-3 p-2">
                            <p className="font-bold">
                                <span className="text-blue-700">Hair & Scalp Analysis</span>
                            </p>
                            <p className="text-sm text-gray-600">Upload photos for our AI to analyze, or skip to continue.</p>
                            <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-2">
                                <p><strong>Photo upload is optional</strong></p>
                                <p>No photo? No problem. We can generate a personalized plan based on your questionnaire answers. Simply use the "Skip & Continue" button below to proceed.</p>
                            </div>

                            {/* UPDATED: Dual buttons for Upload/Camera clarity */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={() => uploadInputRef.current?.click()} className="flex-1 w-full text-blue-600 font-semibold py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                                    <UploadIcon /> Upload Photos
                                </button>
                                <button onClick={() => setIsCameraOpen(true)} className="flex-1 w-full text-blue-600 font-semibold py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                                    <CameraIcon /> Use Camera
                                </button>
                            </div>

                            <div className="pt-2 border-t border-gray-100 mt-2">
                                <button onClick={() => handleNextStep(ConversationStep.Hair_Recommendations)} className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors flex items-center justify-center text-sm">
                                    Skip & Continue
                                </button>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="space-y-3 p-2">
                        <p className="font-bold">
                            <span className="text-blue-700">Step 2:</span>
                            <span className="text-gray-800"> AI Face Analysis</span>
                        </p>
                        <p className="text-sm text-gray-600">For best results, upload clear, well-lit photos of your face — including front, left, and right views. <span className="text-red-500">Adding multiple images will help ensure more accurate results.</span></p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => uploadInputRef.current?.click()} className="flex-1 w-full text-blue-600 font-semibold py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                                <UploadIcon /> Upload Photos
                            </button>
                            <button onClick={() => setIsCameraOpen(true)} className="flex-1 w-full text-blue-600 font-semibold py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                                <CameraIcon /> Use Camera
                            </button>
                        </div>
                    </div>
                );
            case MessageType.Image:
                const images = message.content as UploadedImage[];
                return (
                    <div className="flex flex-wrap gap-2 p-2">
                        {images.map((image, index) => (
                            <div key={index} className="relative w-14 h-14 rounded-lg overflow-hidden border border-blue-200 shadow-sm bg-white">
                                <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                );
            case MessageType.AnalysisResult:
                const { images: analysisImages, analysis } = message.content as { images: UploadedImage[], analysis: SkinConditionCategory[] };
                const isHairAssessment = conversationState.assessmentType === 'hair';

                return <AnalysisResultView
                    images={analysisImages}
                    analysis={analysis}
                    onReAnalyze={handleReAnalyze}
                    onNext={() => handleNextStep(isHairAssessment ? ConversationStep.Hair_Recommendations : ConversationStep.Skin_Goals)}
                    nextLabel={isHairAssessment ? "Next: Get My Routine" : "Next: Set My Goals"}
                />;
            case MessageType.GoalSelection:
                const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
                const dynamicSuggestions = getDynamicSuggestions(skinAnalysisResult || []);
                const otherGoals = allGoals.filter(g => !dynamicSuggestions.some(s => s.id === g.id));

                const toggleGoal = (id: string) => {
                    if (id === 'None of these') {
                        setSelectedGoals(['None of these']);
                        return;
                    }
                    setSelectedGoals(prev => {
                        const filtered = prev.filter(g => g !== 'None of these');
                        return filtered.includes(id) ? filtered.filter(g => g !== id) : [...filtered, id]
                    });
                };
                return (
                    <div className="p-1">
                        <p className="font-bold mb-1">
                            <span className="text-blue-700">Step 3:</span>
                            <span className="text-gray-800"> Select Your Skincare Goals</span>
                        </p>
                        <p className="text-sm text-gray-600 mb-4">Choose what you'd like to focus on. We've highlighted a few suggestions based on your skin analysis.</p>

                        <p className="text-xs font-bold text-yellow-600 mb-2">⭐ SUGGESTION</p>
                        <div className="space-y-2 mb-4">
                            {dynamicSuggestions.map(goal => (
                                <button key={goal.id} onClick={() => toggleGoal(goal.text)} className={`w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-all ${selectedGoals.includes(goal.text) ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
                                    {goal.icon}
                                    <span className="font-medium text-sm flex-1">{goal.text}</span>
                                    <span className="text-yellow-500 text-lg">⭐</span>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            {otherGoals.map(goal => (
                                <button key={goal.id} onClick={() => toggleGoal(goal.text)} className={`w-full p-3 border rounded-lg text-left flex items-center gap-3 transition-all ${selectedGoals.includes(goal.text) ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}>
                                    {goal.icon}
                                    <span className="font-medium text-sm">{goal.text}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleNextStep(ConversationStep.Skin_Recommendations, { goals: selectedGoals })} className="mt-4 w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-base">Submit</button>
                    </div>
                );
            case MessageType.ProductRecommendation:
                const recommendations = message.content as ProductRecommendation[];

                const handleAddAll = () => {
                    setCartItems(prev => {
                        let newCart = [...prev];
                        recommendations.forEach(cat => {
                            cat.products.forEach(p => {
                                const existingIndex = newCart.findIndex(item => item.name === p.name);
                                if (existingIndex > -1) {
                                    newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + 1 };
                                } else {
                                    newCart.push({ ...p, quantity: 1 });
                                }
                            });
                        });
                        return newCart;
                    });
                    setIsCartOpen(true);
                };

                return (
                    <div className="space-y-5 p-1">
                        <p className="font-bold text-lg text-gray-800">Your Personalized Skincare</p>
                        {recommendations.map(rec => (
                            <div key={rec.category}>
                                <h4 className="font-semibold text-md mb-3 text-gray-700">{rec.category}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {rec.products.map((product, index) => (
                                        <div key={`${product.name}-${index}`} className="border rounded-xl p-3 flex flex-col gap-2 bg-white relative">
                                            {/* Recommendation Tag */}
                                            {product.recommendationType && (
                                                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider z-10 shadow-sm ${product.recommendationType === 'Recommended'
                                                    ? 'bg-blue-600 text-white border border-blue-400'
                                                    : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                                    }`}>
                                                    {product.recommendationType}
                                                </div>
                                            )}

                                            {/* Make image clickable */}
                                            <a href={product.url} target="_blank" rel="noopener noreferrer" className="block">
                                                <img src={product.image} alt={product.name} className="w-full h-24 object-cover rounded-md" />
                                            </a>
                                            <div className="flex-1">
                                                {/* Make name clickable */}
                                                <a href={product.url} target="_blank" rel="noopener noreferrer" className="block hover:text-blue-600 hover:underline">
                                                    <p className="font-bold text-sm leading-tight">{product.name}</p>
                                                </a>
                                                <p className="text-sm text-gray-700 my-1">{product.price}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {product.tags.map((tag, i) => (
                                                        <span key={`${tag}-${i}`} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag === 'On Sale' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-50 text-green-700 border border-green-100'
                                                            }`}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={() => addToCart(product)} className="w-full mt-1 py-2 bg-green-50 text-green-700 font-bold rounded-lg text-sm border border-green-200 hover:bg-green-100 transition-colors">ADD</button>
                                        </div>
                                    ))}
                                </div>
                            </div >
                        ))}
                        <div className="space-y-3 pt-3">
                            <button onClick={handleAddAll} className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-base">Add All to Cart</button>
                            <button onClick={() => addMessage(Sender.Bot, MessageType.ChatInput, null)} className="w-full px-4 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors text-base flex items-center justify-center gap-2">
                                <BotIcon /> Chat with AI Expert
                            </button>
                            <button onClick={() => generatePDF(skinAnalysisResult, recommendations, conversationState.goals, userInfo, uploadedImages[0]?.base64)} className="w-full px-4 py-3 bg-blue-50 text-blue-700 font-bold rounded-lg border-2 border-blue-200 hover:bg-blue-100 transition-colors text-base flex items-center justify-center gap-2">
                                <DownloadIcon /> Download Report (PDF)
                            </button>
                            <button onClick={() => handleNextStep(ConversationStep.Skin_Report)} className="w-full px-4 py-3 bg-gray-100 text-gray-800 font-bold rounded-lg hover:bg-gray-200 transition-colors text-base">Next: AI Doctor's Report</button>
                        </div>
                    </div >
                );
            case MessageType.NextStep:
                return <button onClick={() => handleNextStep(message.payload.nextStep, message.payload)} className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">{message.payload.buttonText}</button>;
            case MessageType.GenderOptions:
                return (
                    <div>
                        <p className="mb-2 text-center font-semibold">{message.content}</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleNextStep(ConversationStep.Hair_Questioning, { gender: 'Male' })} className="px-6 py-2 border rounded-lg hover:bg-gray-100 flex flex-col items-center">
                                <div className="w-12 h-12 mb-1 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                                    <img src="/gender_male.png" alt="Male" className="w-full h-full object-cover" />
                                </div>
                                <span className="font-semibold text-sm">Male</span>
                            </button>
                            <button onClick={() => handleNextStep(ConversationStep.Hair_Questioning, { gender: 'Female' })} className="px-6 py-2 border rounded-lg hover:bg-gray-100 flex flex-col items-center">
                                <div className="w-12 h-12 mb-1 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden">
                                    <img src="/gender_female.png" alt="Female" className="w-full h-full object-cover" />
                                </div>
                                <span className="font-semibold text-sm">Female</span>
                            </button>
                        </div>
                    </div>
                );
            case MessageType.DoctorReport:
                const recommendationsMsg = messages.find(m => m.type === MessageType.ProductRecommendation);
                const recs = recommendationsMsg ? recommendationsMsg.content as ProductRecommendation[] : [];

                return (
                    <div className="p-4 space-y-4 text-center">
                        <p className="font-bold text-lg">
                            <span className="text-blue-700">Step 5:</span>
                            <span className="text-gray-800"> AI Doctor's Report</span>
                        </p>
                        <p className="text-sm text-gray-600 px-4">Here is a summary of your analysis and personalized plan.</p>
                        <button
                            onClick={() => generatePDF(skinAnalysisResult, recs, conversationState.goals, userInfo, uploadedImages[0]?.base64)}
                            className="w-full max-w-xs mx-auto mt-2 px-4 py-3 bg-white text-green-600 font-bold rounded-lg border-2 border-green-500 hover:bg-green-50 transition-colors text-base flex items-center justify-center gap-2"
                        >
                            <DownloadIcon /> Download Report (PDF)
                        </button>
                    </div>
                );
            case MessageType.Final:
                const finalContent = message.content as { title: string, content: string };
                return (
                    <div className="p-2">
                        <p className="font-bold text-lg">{finalContent.title}</p>
                        <p className="text-sm mt-2">{finalContent.content}</p>
                    </div>
                );
            case MessageType.HairQuestionRadio: {
                const q = message.content as HairQuestion;
                const isAnswered = conversationState.hairAnswers[q.id] !== undefined;

                return (
                    <div className="p-2">
                        <div className="mb-3">
                            <span className="text-blue-600 text-xs font-bold block mb-1">
                                Question {q.id} of {q.totalQuestions}
                            </span>
                            <p className="font-bold text-gray-800">{q.question}</p>
                        </div>
                        {!isAnswered && (
                            <div className="flex flex-col gap-2">
                                {q.options.map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => handleHairAnswer(q.id, opt.label)}
                                        className={`p-3 text-left bg-white border rounded-xl shadow-sm font-medium transition-colors flex items-center gap-3 ${opt.image ? '' : 'hover:bg-blue-50 border-gray-100 text-blue-600'}`}
                                    >
                                        {opt.image && (
                                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                                                <img src={opt.image} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <span className="text-gray-700">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
            case MessageType.HairQuestionImageGrid: {
                const q = message.content as HairQuestion;
                const isAnswered = conversationState.hairAnswers[q.id] !== undefined;

                return (
                    <div className="p-2">
                        <div className="mb-3">
                            <span className="text-blue-600 text-xs font-bold block mb-1">
                                Question {q.id} of {q.totalQuestions}
                            </span>
                            <p className="font-bold text-gray-800">{q.question}</p>
                        </div>
                        {!isAnswered && (
                            <div className="grid grid-cols-2 gap-3">
                                {q.options.map(opt => (
                                    <button key={opt.label} onClick={() => handleHairAnswer(q.id, opt.label)} className="p-2 border rounded-lg hover:bg-blue-50 transition-colors flex flex-col items-center bg-white">
                                        <img src={opt.image} alt={opt.label} className="w-full h-24 object-contain mb-2 rounded-md" />
                                        <span className="text-xs font-medium text-center text-gray-700">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
            case MessageType.HairQuestionCheckbox: {
                const q = message.content as HairQuestion;
                const isAnswered = conversationState.hairAnswers[q.id] !== undefined;
                const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

                const toggleOption = (label: string) => {
                    if (label === "None of the above" || label === "None") {
                        setSelectedOptions([label]);
                        return;
                    }
                    setSelectedOptions(prev => {
                        const filtered = prev.filter(o => o !== "None of the above" && o !== "None");
                        if (filtered.includes(label)) {
                            return filtered.filter(o => o !== label);
                        } else {
                            return [...filtered, label];
                        }
                    });
                };

                return (
                    <div className="p-2">
                        <div className="mb-3">
                            <span className="text-blue-600 text-xs font-bold block mb-1">
                                Question {q.id} of {q.totalQuestions}
                            </span>
                            <p className="font-bold text-gray-800">{q.question}</p>
                        </div>
                        {!isAnswered && (
                            <>
                                <div className="space-y-2 mb-3">
                                    {q.options.map(opt => {
                                        const isSelected = selectedOptions.includes(opt.label);
                                        return (
                                            <button
                                                key={opt.label}
                                                onClick={() => toggleOption(opt.label)}
                                                className={`w-full p-3 text-left border rounded-xl flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-800'}`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white border-white' : 'border-gray-300'}`}>
                                                    {isSelected && <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>}
                                                </div>
                                                <span className="font-medium text-sm">{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => handleHairAnswer(q.id, selectedOptions)}
                                    disabled={selectedOptions.length === 0}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue
                                </button>
                            </>
                        )}
                    </div>
                );
            }
            case MessageType.ChatInput:
                return (
                    <div className="p-2">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const input = (e.target as any).elements.chatInput;
                            if (input.value.trim()) {
                                handleChatSubmit(input.value.trim());
                                input.value = '';
                            }
                        }} className="flex gap-2">
                            <input
                                name="chatInput"
                                type="text"
                                placeholder="Ask a question..."
                                className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700">
                                Send
                            </button>
                        </form>
                    </div>
                );
            default: return null;
        }
    };

    const initializedRef = useRef(false);
    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            addMessage(Sender.Bot, MessageType.Text, "Hello! I'm your AI Dermatologist assistant.");
            setTimeout(() => {
                addMessage(Sender.Bot, MessageType.UserInfo, null);
            }, 600);
        }
    }, []);

    return (
        <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-900 relative">
            <div className="w-full max-w-4xl mx-auto h-full flex flex-col bg-white shadow-2xl overflow-hidden relative sm:my-4 sm:rounded-xl sm:h-[95vh]">
                {/* Header */}
                <div className="bg-blue-600 p-4 text-white flex items-center justify-between shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center overflow-hidden">
                            <img src="/app_logo.png" alt="Dermatics AI" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">Dermatics AI</h1>
                            <div className="flex items-center gap-1.5 opacity-90">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span className="text-xs font-medium">Online</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative cursor-pointer p-2 hover:bg-blue-700 rounded-full transition-colors" onClick={() => setIsCartOpen(true)}>
                            <CartIcon />
                            {cartItems.length > 0 && (
                                <span className="absolute top-1 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-blue-600">
                                    {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                                </span>
                            )}
                        </div>
                        <button onClick={handleReset} className="p-2 hover:bg-blue-700 rounded-full transition-colors opacity-80 hover:opacity-100" title="Restart">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Cart Overlay */}
                {isCartOpen && <CartView items={cartItems} onClose={() => setIsCartOpen(false)} onRemove={removeFromCart} onUpdateQuantity={handleQuantityChange} />}

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 scroll-smooth custom-scrollbar">
                    {messages.map((msg) => {
                        // Check if this is the ProductOptions message type
                        const isProductCard = msg.type === MessageType.ProductOptions;

                        return (
                            <div key={msg.id} className={`flex ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                                <div className={`flex gap-3 max-w-[85%] ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm overflow-hidden`}>
                                        <img src={msg.sender === Sender.User ? '/user_avatar.png' : '/bot_avatar.png'} alt={msg.sender === Sender.User ? 'User' : 'Bot'} className="w-full h-full object-cover" />
                                    </div>

                                    {/* Message Bubble */}
                                    <div className={`flex flex-col rounded-2xl shadow-sm overflow-hidden ${msg.sender === Sender.User && !isProductCard
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                        <div className={msg.type === MessageType.Image ? "p-1" : "px-4 py-3"}>
                                            <MessageContent message={msg} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={chatEndRef} />
                </div>

                {/* Hidden Inputs */}
                {isCameraOpen && (
                    <CameraCapture
                        onCapture={handleCameraCapture}
                        onClose={() => setIsCameraOpen(false)}
                    />
                )}
                <input
                    type="file"
                    ref={uploadInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                />
                <input
                    type="file"
                    ref={cameraInputRef}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                />
            </div>
        </div>
    );
};

export default App;

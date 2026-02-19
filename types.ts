import React from 'react';

export enum Sender {
  Bot = 'bot',
  User = 'user',
}

export enum MessageType {
  // Common
  Text = 'text',
  YesNo = 'yesNo',
  NextStep = 'nextStep',
  Final = 'final',
  Loading = 'loading',

  // Initial choice
  AssessmentOptions = 'assessmentOptions',
  UserInfo = 'userInfo',

  // Skin Flow
  ProductOptions = 'productOptions',
  DurationOptions = 'durationOptions',
  ImageUpload = 'imageUpload',
  Image = 'image',
  AnalysisResult = 'analysisResult',
  GoalSelection = 'goalSelection',
  ProductRecommendation = 'productRecommendation',
  DoctorReport = 'doctorReport',

  // Hair Flow
  HairAssessmentStart = 'hairAssessmentStart', // New: For the blue card
  GenderOptions = 'genderOptions',
  HairQuestionRadio = 'hairQuestionRadio',
  HairQuestionImageGrid = 'hairQuestionImageGrid',
  HairQuestionCheckbox = 'hairQuestionCheckbox', // New: For Q8
  ChatInput = 'chatInput',
}


export enum ConversationStep {
  UserDetails,
  Initial,
  // Skin Flow
  Skin_ProductUsage_Start,
  Skin_ProductUsage_Loop,
  Skin_ProductUsage_AskCurrentlyUsing,
  Skin_ProductUsage_AskDuration,
  Skin_ProductUsage_AskOther,
  Skin_Analysis,
  Skin_Analysis_Complete,
  Skin_Goals,
  Skin_Recommendations,
  Skin_Report,
  // Hair Flow
  Hair_Gender,
  Hair_Questioning,
  Hair_Analysis,
  Hair_Recommendations,
  // End State
  Done,
}


export interface Message {
  id: number;
  sender: Sender;
  type: MessageType;
  content: any;
  step?: ConversationStep;
  payload?: any;
}

export interface BoundingBox {
  imageId: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface SkinCondition {
  name: string;
  confidence: number;
  location: string;
  description?: string;
  boundingBoxes: BoundingBox[];
}

export interface SkinConditionCategory {
  category: string;
  conditions: SkinCondition[];
}

export interface Goal {
  id: string;
  text: string;
  icon: React.ReactNode;
  isSuggestion?: boolean;
}

export interface Product {
  id?: string; // Standard Shopify GraphQL ID
  productId?: string; // Product ID (e.g. gid://shopify/Product/...)
  variantId?: string;
  name: string;
  price: string;
  compareAtPrice?: string;
  tags: string[];
  image: string;
  url?: string;
  recommendationType?: 'Recommended' | 'Alternative';
  when?: string;
  howToUse?: string;
  frequency?: string;
  duration?: string;
  purpose?: string;
}

export interface ProductRecommendation {
  category: string;
  products: Product[];
}

export interface HairQuestion {
  id: number;
  question: string;
  totalQuestions?: number; // To show "Question X of Y"
  type: MessageType.HairQuestionRadio | MessageType.HairQuestionImageGrid | MessageType.HairQuestionCheckbox;
  options: { label: string; image?: string }[];
}

export interface RoutineProduct {
  stepType: string;
  productId?: string;
  variantId?: string;
  productName: string;
  productUrl?: string;
  productImageUrl?: string;
  purpose: string;
  price?: string;
  compareAtPrice?: string;
  originalPrice?: string; // Legacy field, keeping for compatibility
  keyIngredients: string[];
  alternatives?: { productName: string }[];
}

export interface SkincareRoutine {
  introduction?: string;
  am: RoutineProduct[];
  pm: RoutineProduct[];
  keyIngredients?: string[];
  lifestyleTips: string[];
  disclaimer?: string;
}

export interface HairProfileData {
  gender: string;
  [key: string]: any;
}

export interface UserInfo {
  name: string;
  age: string;
  phone: string;
  email: string;
}

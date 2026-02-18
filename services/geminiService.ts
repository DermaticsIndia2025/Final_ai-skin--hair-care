
import { SkinConditionCategory, ProductRecommendation, SkincareRoutine, HairProfileData } from '../types';
import { GoogleGenAI, Type, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { getAllProducts } from "../productData";

const rawApiKeys = import.meta.env?.VITE_API_KEY || (typeof process !== 'undefined' ? process.env?.API_KEY || process.env?.VITE_API_KEY : undefined);

if (!rawApiKeys) {
    throw new Error("API key environment variable is not set. Define VITE_API_KEY or API_KEY.");
}

const apiKeys = rawApiKeys.split(',')
    .map(key => key.trim())
    .filter(key => key);

if (apiKeys.length === 0) {
    throw new Error("API key environment variable is set, but contains no valid keys.");
}

// Create an array of GoogleGenAI instances for failover
const aiInstances = apiKeys.map(apiKey => new GoogleGenAI({ apiKey }));

/**
 * Attempts to generate content using a pool of AI instances, failing over to the next key on specific errors.
 * @param params - The parameters for the generateContent call.
 * @returns A promise that resolves with the GenerateContentResponse.
 * @throws An error if all API keys fail.
 */
async function generateContentWithFailover(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    let lastError: Error | null = null;

    for (let i = 0; i < aiInstances.length; i++) {
        const ai = aiInstances[i];
        try {
            const response = await ai.models.generateContent(params);
            // If the call is successful, return the response immediately.
            return response;
        } catch (error) {
            lastError = error as Error;
            console.warn(`API key ${i + 1}/${aiInstances.length} failed: ${lastError.message}`);

            const errorMessage = lastError.message.toLowerCase();
            // Check for specific, retriable error messages
            const isRetriable =
                errorMessage.includes('api key not valid') ||
                errorMessage.includes('quota') ||
                errorMessage.includes('internal error') ||
                errorMessage.includes('500') || // server error
                errorMessage.includes('503'); // service unavailable

            if (!isRetriable) {
                // If the error is not something a key switch can fix (e.g., bad request), throw it immediately.
                throw lastError;
            }
            // Otherwise, the loop will continue and try the next key.
        }
    }

    // If the loop completes without returning, all keys have failed.
    throw new Error(`All ${aiInstances.length} API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

// Re-export types if needed for consistency across files
export interface AnalysisResponse {
    analysis: SkinConditionCategory[] | null;
    error?: 'irrelevant_image' | string | null;
    message?: string | null;
}

// --- Skin Analysis (Face) ---
export const analyzeSkin = async (imagesBase64: string[]): Promise<SkinConditionCategory[]> => {
    console.log(`Starting skin analysis...`);
    const imageParts = imagesBase64.map(base64 => ({
        inlineData: { mimeType: 'image/jpeg', data: base64 },
    }));

    const prompt = `You are an expert dermatologist. Analyze these facial images VERY CAREFULLY and detect ALL visible skin conditions.
    
    **CRITICAL INSTRUCTIONS:**
    1. Look at EVERY visible area of the skin - forehead, cheeks, nose, chin, temples, jaw.
    2. Detect EVERYTHING visible - even minor issues count.
    3. Do NOT skip or miss any visible skin problems.
    4. Provide accurate bounding boxes for EVERY condition you detect.
    
    **Conditions to look for (be thorough):**
    - Acne, pustules, comedones, whiteheads, blackheads, pimples
    - Redness, inflammation, irritation, rosacea
    - Wrinkles, fine lines, crow's feet, forehead lines
    - Dark circles, under-eye bags, puffiness
    - Dark spots, hyperpigmentation, sun spots, melasma
    - Texture issues, rough patches, bumps, enlarged pores
    - Dryness, flakiness, dehydration, dry patches
    - Oiliness, shine, sebum buildup
    - Scarring, post-acne marks, depressed scars
    - Uneven skin tone, patches of different color
    - Other visible conditions (BUT EXCLUDE normal facial hair)

    **EXCLUSIONS (Do NOT report these as conditions):**
    - Normal facial hair, beard, mustache, stubble.
    - Do NOT tag "Facial Hair" or "Stubble" as a skin condition unless it is specifically folliculitis or ingrown hairs.
    
    **For EACH condition you find:**
    1. Create a descriptive name (e.g., "Acne Pustules", "Deep Forehead Wrinkles", "Dark Spots on Cheeks")
    2. Rate confidence 0-100 (how sure are you)
    3. Specify exact location (Forehead, Left Cheek, Right Cheek, Nose, Chin, Under Eyes, Temple, Jaw, etc.)
    4. MANDATORY: A very short, one-sentence description of the problem.
    5. MANDATORY: Draw a bounding box around EVERY visible instance using normalized coordinates (0.0-1.0)
       - x1, y1 = top-left corner
       - x2, y2 = bottom-right corner
       - Example: if acne is on left cheek, draw box around that area
    
    **Grouping Strategy:**
    - Group similar conditions into categories (e.g., "Acne & Blemishes", "Signs of Aging", "Pigmentation Issues", "Texture & Pores")
    - Create new categories as needed based on what you see
    
    Provide output in JSON format. Do NOT return empty arrays for boundingBoxes - every condition MUST have visible boxes.`;

    try {
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            conditions: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        confidence: { type: Type.NUMBER },
                                        location: { type: Type.STRING },
                                        boundingBoxes: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    imageId: { type: Type.NUMBER },
                                                    box: {
                                                        type: Type.OBJECT,
                                                        properties: { x1: { type: Type.NUMBER }, y1: { type: Type.NUMBER }, x2: { type: Type.NUMBER }, y2: { type: Type.NUMBER } },
                                                        required: ["x1", "y1", "x2", "y2"]
                                                    }
                                                },
                                                required: ["imageId", "box"]
                                            }
                                        }
                                    },
                                    required: ["name", "confidence", "location", "boundingBoxes"]
                                }
                            }
                        },
                        required: ["category", "conditions"]
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error analyzing skin:", error);
        return [];
    }
};

// --- Hair Analysis (AI Trichologist) ---
export const analyzeHair = async (imagesBase64: string[]): Promise<AnalysisResponse> => {
    const imageParts = imagesBase64.map(base64 => ({
        inlineData: { mimeType: 'image/jpeg', data: base64 },
    }));

    const textPart = {
        text: `You are an expert AI trichologist. Your task is to analyze images of a person's hair and scalp in detail.

**Step 1: Image Validity Check**
First, determine if the uploaded image(s) clearly show a human head, hair, or scalp. 
- If images are NOT relevant (e.g., objects, flowers, blurry, unrecognizable), return a JSON object with "error": "irrelevant_image".
- If images ARE relevant, proceed to Step 2.

**Step 2: Detailed Analysis**
Analyze the relevant images for specific hair and scalp conditions.

**Reference List of Conditions to Detect:**
Use these specific medical/cosmetic terms where applicable, but rely on your vision.

1. **Hair Loss Types:**
   - **Androgenetic Alopecia:** Look for receding hairline (M-shape) or vertex thinning in men; widening part line or diffuse thinning in women.
   - **Telogen Effluvium:** General diffuse thinning without distinct bald patches.
   - **Alopecia Areata:** Distinct, round, smooth bald patches.
   - **Traction Alopecia:** Hair loss along the hairline due to tension.
   - **Cicatricial Alopecia:** Signs of scarring or inflammation associated with hair loss.

2. **Scalp Conditions:**
   - **Seborrheic Dermatitis:** Redness, greasy yellow scales/flakes.
   - **Pityriasis Capitis (Dandruff):** Dry, white flakes, non-inflamed.
   - **Folliculitis:** Red, inflamed bumps around hair follicles.
   - **Psoriasis:** Thick, silvery scales on red patches.

3. **Hair Shaft & Quality:**
   - **Trichorrhexis Nodosa / Breakage:** Visible snapping or white nodes on the hair shaft.
   - **Split Ends:** Fraying at the tips.
   - **Frizz / Dryness:** Lack of definition, rough texture.

**Dynamic Categorization Strategy:**
- Group your findings dynamically based on what you detect (e.g., "Hair Loss Patterns", "Scalp Health", "Hair Quality").
- **Male vs Female:** Explicitly look for gender-specific patterns (e.g., Receding Hairline vs Widening Part) and name them accordingly.

**Output Requirements for each Condition:**
1. **Name:** Use specific terms from the reference list above (e.g., "Androgenetic Alopecia (Stage 2)", "Severe Dandruff", "Receding Hairline").
2. **Confidence:** 0-100 score.
3. **Location:** Specific area (e.g., "Left Temple", "Crown", "Nape", "Part Line").
4. **Bounding Boxes:** 
   - **MANDATORY VISUALIZATION TASK:** If you detect any Hair Loss (including Receding Hairline, Thinning, or Alopecia), you **MUST** return a bounding box.
   - Draw the box around the entire receding area or bald spot.
   - Use normalized coordinates (0.0 - 1.0).
   - Do NOT return empty bounding boxes for visible conditions.

Provide the output strictly in JSON format according to the provided schema.
`
    };

    try {
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.ARRAY,
                            nullable: true,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    category: { type: Type.STRING, description: "Dynamic category name based on finding." },
                                    conditions: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING, description: "Specific condition name." },
                                                confidence: { type: Type.NUMBER, description: "Confidence 0-100." },
                                                location: { type: Type.STRING, description: "Location on scalp/hair." },
                                                boundingBoxes: {
                                                    type: Type.ARRAY,
                                                    items: {
                                                        type: Type.OBJECT,
                                                        properties: {
                                                            imageId: { type: Type.NUMBER },
                                                            box: {
                                                                type: Type.OBJECT,
                                                                properties: { x1: { type: Type.NUMBER }, y1: { type: Type.NUMBER }, x2: { type: Type.NUMBER }, y2: { type: Type.NUMBER } },
                                                                required: ["x1", "y1", "x2", "y2"]
                                                            }
                                                        },
                                                        required: ["imageId", "box"]
                                                    }
                                                }
                                            },
                                            required: ["name", "confidence", "location", "boundingBoxes"]
                                        }
                                    }
                                },
                                required: ["category", "conditions"]
                            }
                        },
                        error: { type: Type.STRING, nullable: true },
                        message: { type: Type.STRING, nullable: true }
                    }
                }
            }
        });

        return JSON.parse(response.text.trim());

    } catch (error) {
        console.error("Error analyzing hair:", error);
        throw new Error("Failed to analyze hair & scalp image.");
    }
};

export const getSkincareRoutine = async (analysis: SkinConditionCategory[], goals: string[]): Promise<ProductRecommendation[]> => {
    // Fetch all products from Shopify
    const allProducts = await getAllProducts();

    // STRICT FILTERING: Exclude hair products from skincare routines
    const skincareCatalog = allProducts.filter(p => {
        const lowerName = p.name.toLowerCase();
        // Remove known hair terms
        if (lowerName.includes('shampoo') ||
            lowerName.includes('conditioner') ||
            lowerName.includes('scalp') ||
            lowerName.includes('minoxidil') ||
            lowerName.includes('follihair') ||
            lowerName.includes('mintop') ||
            lowerName.includes('anaboom') ||
            (lowerName.includes('hair') && !lowerName.includes('remove')) // Allow "Hair removal cream" if exists, but generally block hair items
        ) {
            return false;
        }
        return true;
    });

    const analysisString = analysis.map(cat =>
        `${cat.category}: ${cat.conditions.map(c => `${c.name} (${c.confidence}%)`).join(', ')}`
    ).join('; ');

    const goalsString = goals.join(', ');

    // CRITICAL: We pass the variantId so the AI can return it.
    const productCatalogString = JSON.stringify(skincareCatalog.map(p => ({
        id: p.variantId,
        name: p.name,
        tags: p.suitableFor,
        productType: p.productType,
        price: p.price
    })), null, 2);

    const prompt = `
        **ROLE:** Expert AI Dermatologist for "Dermatics India".
        **TASK:** Create a highly effective, personalized skincare routine (Morning & Evening) based on the user's specific analysis and goals. For each step type (e.g., Cleanser, Serum), provide one "Recommended" product and one "Alternative" product if available.
        
        **INPUT DATA:**
        - **USER ANALYSIS (Conditions Detected):** ${analysisString || 'None provided'}
        - **USER GOALS:** ${goalsString}
        
        **PRODUCT CATALOG:** 
        ${productCatalogString}
        
        **MEDICAL LOGIC & STRATEGY:**
        1. **Analyze Conditions:** Look at the detected conditions (e.g., Acne, Pigmentation, Wrinkles).
        2. **Identify Ingredients:** Determine which active ingredients are needed.
        3. **Design Two Routines:**
           - **AM Routine (Morning):** Focus on Gentle Cleansing + Antioxidants (e.g. Vit C) + Hydration + Sun Protection.
           - **PM Routine (Evening):** Focus on Deep Cleansing + Treatments (Actives like Retinol/Exfoliants) + Repair/Moisturize.
        4. **Select Products:** Search the provided "PRODUCT CATALOG" and select products for each step.
        5. **Provide Usage Details:** For EACH product, suggest:
           - **When:** (e.g., "Morning", "Night", "During bath")
           - **How to Use:** (e.g., "Apply to wet face, massage for 30s, rinse")
           - **Frequency:** (e.g., "Once daily", "Twice daily", "3-4 times per week")
           - **Duration:** (e.g., "Ongoing", "8-12 weeks", "Until resolved")
        
        **CONSTRAINTS:**
        - **MANDATORY:** You MUST select products available in the catalog.
        - **MANDATORY:** For each product, you MUST return the exact 'productId' (which is the variantId in the catalog) from the catalog.
        - **NO HALLUCINATIONS:** If the catalog does not have a suitable product for a specific step (e.g., no Vitamin C serum), skip that step.
     `;

    try {
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        am: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    stepType: { type: Type.STRING, description: "e.g. Cleanser, Serum, Moisturizer" },
                                    productId: { type: Type.STRING, description: "The exact variantId from the product catalog." },
                                    name: { type: Type.STRING, description: "Name of the product" },
                                    recommendationType: { type: Type.STRING, enum: ["Recommended", "Alternative"] },
                                    when: { type: Type.STRING },
                                    howToUse: { type: Type.STRING },
                                    frequency: { type: Type.STRING },
                                    duration: { type: Type.STRING }
                                },
                                required: ["stepType", "productId", "name", "recommendationType", "when", "howToUse", "frequency", "duration"]
                            }
                        },
                        pm: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    stepType: { type: Type.STRING, description: "e.g. Cleanser, Treatment, Moisturizer" },
                                    productId: { type: Type.STRING, description: "The exact variantId from the product catalog." },
                                    name: { type: Type.STRING, description: "Name of the product" },
                                    recommendationType: { type: Type.STRING, enum: ["Recommended", "Alternative"] },
                                    when: { type: Type.STRING },
                                    howToUse: { type: Type.STRING },
                                    frequency: { type: Type.STRING },
                                    duration: { type: Type.STRING }
                                },
                                required: ["stepType", "productId", "name", "recommendationType", "when", "howToUse", "frequency", "duration"]
                            }
                        }
                    },
                    required: ["am", "pm"]
                }
            }
        });

        const recommendations = JSON.parse(response.text.trim());

        // Helper to hydrate products
        const hydrate = (list: any[]) => list.map((p: any) => {
            // Try finding by variantId first (most robust)
            let fullProduct = skincareCatalog.find(prod => prod.variantId === p.productId);
            // Fallback to name match if variantId fails or AI hallucinated a slightly different ID
            if (!fullProduct) {
                fullProduct = skincareCatalog.find(prod => prod.name === p.name);
            }

            if (!fullProduct) return null; // Filter out hallucinated items

            return {
                name: fullProduct.name,
                price: fullProduct.price,
                tags: Array.from(new Set([p.stepType, ...fullProduct.suitableFor.slice(0, 2)])),
                image: fullProduct.imageUrl,
                url: fullProduct.url,
                variantId: fullProduct.variantId,
                recommendationType: p.recommendationType,
                when: p.when,
                howToUse: p.howToUse,
                frequency: p.frequency,
                duration: p.duration
            };
        }).filter(p => p !== null);

        const result: ProductRecommendation[] = [];

        if (recommendations.am && recommendations.am.length > 0) {
            result.push({
                category: "Morning Routine",
                products: hydrate(recommendations.am)
            });
        }

        if (recommendations.pm && recommendations.pm.length > 0) {
            result.push({
                category: "Evening Routine",
                products: hydrate(recommendations.pm)
            });
        }

        return result;

    } catch (error) {
        console.error("Error generating skincare routine:", error);
        // Fallback to basic list if AI fails
        return [{
            category: 'Recommended Products',
            products: allProducts.slice(0, 4).map(p => ({
                name: p.name,
                price: p.price,
                tags: ['Bestseller'],
                image: p.imageUrl,
                url: p.url,
                variantId: p.variantId,
                recommendationType: 'Recommended' as const
            }))
        }];
    }
};

export const getHairCareRoutine = async (
    hairProfile: Partial<HairProfileData>,
    analysis: SkinConditionCategory[],
    goals: string[]
): Promise<ProductRecommendation[]> => {

    // Fetch all products from Shopify
    const allProducts = await getAllProducts();

    // STRICT POSITIVE FILTERING: Only include explicit hair/scalp products
    // This ensures no face washes slip through.
    const hairCatalog = allProducts.filter(p => {
        const lowerName = p.name.toLowerCase();
        const lowerTags = p.suitableFor.join(' ').toLowerCase();

        // Positive Match: Must be relevant to hair
        const isHairRelated =
            lowerName.includes('hair') ||
            lowerName.includes('scalp') ||
            lowerName.includes('shampoo') ||
            lowerName.includes('conditioner') ||
            lowerName.includes('minoxidil') ||
            lowerName.includes('follihair') ||
            lowerName.includes('mintop') ||
            lowerName.includes('anaboom') ||
            lowerTags.includes('hair') ||
            lowerTags.includes('scalp');

        // Negative Match: Explicitly exclude face items even if they accidentally trigger a hair match (rare, but possible)
        const isFaceRelated =
            lowerName.includes('face wash') ||
            lowerName.includes('facial') ||
            lowerName.includes('body wash') ||
            lowerName.includes('soap') ||
            lowerName.includes('sunscreen') ||
            lowerName.includes('under eye') ||
            lowerName.includes('lip balm') ||
            (lowerName.includes('serum') && !isHairRelated) || // Exclude face serums unless they also say hair/scalp
            lowerName.includes('actame'); // Brand exclusion requested

        return isHairRelated && !isFaceRelated;
    });

    const analysisString = analysis.map(cat =>
        `${cat.category}: ${cat.conditions.map(c => `${c.name} (${c.confidence}%)`).join(', ')}`
    ).join('; ');

    const goalsString = goals.join(', ');
    const productCatalogString = JSON.stringify(hairCatalog.map(p => ({
        id: p.variantId,
        name: p.name,
        tags: p.suitableFor,
        price: p.price
    })), null, 2);

    const prompt = `
        **ROLE:** Expert AI Trichologist for "Dermatics India".
        **TASK:** Create a clinical-grade hair care routine based on the provided analysis. For each step type (e.g., Shampoo, Serum, Treatment), provide one "Recommended" product and one "Alternative" product if available.
        
        **INPUT DATA:**
        - **ANALYSIS:** ${analysisString || 'None'}
        - **PROFILE:** ${JSON.stringify(hairProfile)}
        - **GOALS:** ${goalsString}
        
        **PRODUCT CATALOG:** ${productCatalogString}
        
        **MEDICAL LOGIC & STRATEGY:**
        1. **Diagnose:** Identify the core issues (e.g., Male Pattern Baldness, Seborrheic Dermatitis, Dry Damage).
        2. **Prescribe Ingredients:**
           - **Hair Loss:** Look for Minoxidil, Redensyl, Procapil, Capixyl, Anagain, Saw Palmetto, Biotin.
           - **Dandruff:** Look for Ketoconazole, Zinc Pyrithione (ZPTO), Piroctone Olamine, Salicylic Acid, Coal Tar.
           - **Damage/Frizz:** Look for Keratin, Argan Oil, Shea Butter, Silk Protein.
        3. **Match Products:** Scan the catalog names/tags for these ingredients.
        4. **Select:** Pick products for each step.
        5. **Provide Usage Details:** For EACH product, suggest:
           - **When:** (e.g., "Morning", "Night", "During bath")
           - **How to Use:** (e.g., "Apply to wet scalp, massage gently for 1–2 minutes, then rinse thoroughly")
           - **Frequency:** (e.g., "3–4 times per week", "Once daily", "Twice daily")
           - **Duration:** (e.g., "Ongoing", "12-16 weeks", "Until resolved")
        
        **CONSTRAINTS:**
        - **STRICT ID MATCHING:** You MUST return the exact 'productId' (which is the variantId in the catalog) from the provided catalog.
        - **NO HALLUCINATIONS:** If no product exists for a specific concern (e.g., no Minoxidil available), omit that step.
        - **NO FACE PRODUCTS:** Do NOT recommend face washes or skin creams.
    `;

    const productSchema = {
        type: Type.OBJECT,
        properties: {
            stepType: { type: Type.STRING },
            productId: { type: Type.STRING, description: "The exact variantId from the product catalog." },
            productName: { type: Type.STRING },
            recommendationType: { type: Type.STRING, enum: ["Recommended", "Alternative"] },
            when: { type: Type.STRING },
            howToUse: { type: Type.STRING },
            frequency: { type: Type.STRING },
            duration: { type: Type.STRING }
        },
        required: ["stepType", "productName", "productId", "recommendationType", "when", "howToUse", "frequency", "duration"]
    };

    try {
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        am: { type: Type.ARRAY, items: productSchema },
                        pm: { type: Type.ARRAY, items: productSchema }
                    },
                    required: ["am", "pm"]
                }
            }
        });

        const recommendations = JSON.parse(response.text.trim());

        // Helper to hydrate product data
        const hydrate = (items: any[]) => {
            return items.map((item: any) => {
                let fullProduct = hairCatalog.find(p => p.variantId === item.productId);
                if (!fullProduct) fullProduct = hairCatalog.find(p => p.name === item.name || p.name === item.productName);

                if (!fullProduct) return null;

                return {
                    name: fullProduct.name,
                    price: fullProduct.price,
                    tags: [item.stepType],
                    image: fullProduct.imageUrl,
                    url: fullProduct.url,
                    variantId: fullProduct.variantId,
                    recommendationType: item.recommendationType,
                    when: item.when,
                    howToUse: item.howToUse,
                    frequency: item.frequency,
                    duration: item.duration
                };
            }).filter((item: any) => item !== null);
        };

        const result: ProductRecommendation[] = [];

        if (recommendations.am && recommendations.am.length > 0) {
            result.push({
                category: "Morning Routine",
                products: hydrate(recommendations.am)
            });
        }

        if (recommendations.pm && recommendations.pm.length > 0) {
            result.push({
                category: "Evening Routine",
                products: hydrate(recommendations.pm)
            });
        }

        return result;

    } catch (error) {
        console.error("Error generating hair routine:", error);
        throw new Error("Failed to generate haircare routine.");
    }
};

export const chatWithAI = async (query: string, context: { analysis: any, recommendations: any }): Promise<string> => {
    const prompt = `
    You are a helpful AI assistant for a skin and hair care application.
    
    CONTEXT:
    User Analysis: ${JSON.stringify(context.analysis)}
    User Recommendations: ${JSON.stringify(context.recommendations)}
    
    USER QUESTION: ${query}
    
    Please answer the user's question based on the provided context. Keep the answer concise and helpful.
    `;

    try {
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error in chatWithAI:", error);
        return "I'm sorry, I'm having trouble answering that right now.";
    }
};

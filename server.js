process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const SchemaType = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    OBJECT: 'object',
    ARRAY: 'array'
};

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large base64 payloads

// Environment check
const rawApiKeys = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;

if (!rawApiKeys) {
    console.error("CRITICAL ERROR: No API Key found in .env or environment variables.");
    process.exit(1);
}

const apiKeys = rawApiKeys.split(',').map(key => key.trim()).filter(key => key);
const aiInstances = apiKeys.map(apiKey => new GoogleGenAI({ apiKey }));

/**
 * Attempts to generate content using a pool of AI instances, failing over to the next key on specific errors.
 */
async function generateContentWithFailover(params) {
    let lastError = null;
    for (let i = 0; i < aiInstances.length; i++) {
        const ai = aiInstances[i];
        try {
            return await ai.models.generateContent(params);
        } catch (error) {
            lastError = error;
            console.warn(`API key ${i + 1}/${aiInstances.length} failed: ${lastError.message}`);
            const errorMessage = lastError.message.toLowerCase();
            const isRetriable =
                errorMessage.includes('api key not valid') ||
                errorMessage.includes('quota') ||
                errorMessage.includes('internal error') ||
                errorMessage.includes('500') ||
                errorMessage.includes('503');
            if (!isRetriable) throw lastError;
        }
    }
    throw new Error(`All ${aiInstances.length} API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Shopify Config
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_DOMAIN || !ACCESS_TOKEN) {
    console.warn("WARNING: SHOPIFY_DOMAIN or SHOPIFY_ACCESS_TOKEN is missing in environment variables. Product catalog will not work.");
}

let cachedProducts = null;

async function getAllProducts() {
    if (cachedProducts) return cachedProducts;
    const allEdges = [];
    let hasNextPage = true;
    let endCursor = null;

    try {
        while (hasNextPage) {
            const query = `
            {
              products(first: 250${endCursor ? `, after: "${endCursor}"` : ''}) {
                pageInfo { hasNextPage, endCursor }
                edges {
                  node {
                    id, title, description, productType, handle, onlineStoreUrl,
                    images(first: 1) { edges { node { url } } }
                    variants(first: 1) { edges { node { id, price { amount, currencyCode }, compareAtPrice { amount, currencyCode } } } }
                    tags
                  }
                }
              }
            }
            `;
            const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Storefront-Access-Token': ACCESS_TOKEN,
                },
                body: JSON.stringify({ query }),
            });
            const json = await response.json();
            const pageInfo = json.data?.products?.pageInfo || {};
            const edges = json.data?.products?.edges || [];
            allEdges.push(...edges);
            hasNextPage = pageInfo.hasNextPage || false;
            endCursor = pageInfo.endCursor || null;
        }
        cachedProducts = allEdges.map((edge) => {
            const node = edge.node;
            const price = node.variants.edges[0]?.node?.price;
            const compareAtPrice = node.variants.edges[0]?.node?.compareAtPrice;
            return {
                productId: node.id,
                name: node.title,
                url: node.onlineStoreUrl || `https://${SHOPIFY_DOMAIN}/products/${node.handle}`,
                imageUrl: node.images.edges[0]?.node?.url || 'https://placehold.co/200x200?text=No+Image',
                variantId: node.variants.edges[0]?.node?.id,
                price: price ? `${price.currencyCode} ${parseFloat(price.amount).toFixed(2)}` : 'N/A',
                compareAtPrice: compareAtPrice ? `${compareAtPrice.currencyCode} ${parseFloat(compareAtPrice.amount).toFixed(2)}` : 'N/A',
                tags: node.tags || []
            };
        });
        return cachedProducts;
    } catch (error) {
        console.error("Shopify Fetch Error:", error);
        return [];
    }
}

// Helper: Convert Base64 to Gemini Part
const base64ToPart = (base64String, mimeType = 'image/jpeg') => {
    return {
        inlineData: {
            mimeType,
            data: base64String
        }
    };
};

/**
 * Endpoint: /api/analyze-skin
 * Method: POST
 * Body: { images: ["base64_string_1", "base64_string_2", ...] }
 */
app.post('/api/analyze-skin', async (req, res) => {
    try {
        const { images } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: "Please provide an array of base64 images in the 'images' field." });
        }

        const imageParts = images.map(img => base64ToPart(img));

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

        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            category: { type: SchemaType.STRING },
                            conditions: {
                                type: SchemaType.ARRAY,
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        name: { type: SchemaType.STRING },
                                        confidence: { type: SchemaType.NUMBER },
                                        location: { type: SchemaType.STRING },
                                        description: { type: SchemaType.STRING },
                                        boundingBoxes: {
                                            type: SchemaType.ARRAY,
                                            items: {
                                                type: SchemaType.OBJECT,
                                                properties: {
                                                    imageId: { type: SchemaType.NUMBER },
                                                    box: {
                                                        type: SchemaType.OBJECT,
                                                        properties: { x1: { type: SchemaType.NUMBER }, y1: { type: SchemaType.NUMBER }, x2: { type: SchemaType.NUMBER }, y2: { type: SchemaType.NUMBER } },
                                                        required: ["x1", "y1", "x2", "y2"]
                                                    }
                                                },
                                                required: ["imageId", "box"]
                                            }
                                        }
                                    },
                                    required: ["name", "confidence", "location", "description", "boundingBoxes"]
                                }
                            }
                        },
                        required: ["category", "conditions"]
                    }
                }
            }
        });

        const result = response.text ? JSON.parse(response.text.trim()) : [];
        res.json(result);

    } catch (error) {
        console.error("Error analyzing skin:", error);
        res.status(500).json({ error: "Failed to analyze skin", details: error.message });
    }
});

/**
 * Endpoint: /api/analyze-hair
 * Method: POST
 * Body: { images: ["base64_string_1", ...] }
 */
app.post('/api/analyze-hair', async (req, res) => {
    try {
        const { images } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: "Please provide an array of base64 images in the 'images' field." });
        }

        const imageParts = images.map(img => base64ToPart(img));

        const prompt = `You are an expert AI trichologist. Your task is to analyze images of a person's hair and scalp in detail.

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
        4. **Description:** A very short, one-sentence description of the problem.
        5. **Bounding Boxes:** 
           - **MANDATORY VISUALIZATION TASK:** If you detect any Hair Loss (including Receding Hairline, Thinning, or Alopecia), you **MUST** return a bounding box.
           - Draw the box around the entire receding area or bald spot.
           - Use normalized coordinates (0.0 - 1.0).
           - Do NOT return empty bounding boxes for visible conditions.
        
        Provide the output strictly in JSON format according to the provided schema.`;

        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        analysis: {
                            type: SchemaType.ARRAY,
                            nullable: true,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    category: { type: SchemaType.STRING, description: "Dynamic category name based on finding." },
                                    conditions: {
                                        type: SchemaType.ARRAY,
                                        items: {
                                            type: SchemaType.OBJECT,
                                            properties: {
                                                name: { type: SchemaType.STRING, description: "Specific condition name." },
                                                confidence: { type: SchemaType.NUMBER, description: "Confidence 0-100." },
                                                location: { type: SchemaType.STRING, description: "Location on scalp/hair." },
                                                description: { type: SchemaType.STRING, description: "One-sentence description of the problem." },
                                                boundingBoxes: {
                                                    type: SchemaType.ARRAY,
                                                    items: {
                                                        type: SchemaType.OBJECT,
                                                        properties: {
                                                            imageId: { type: SchemaType.NUMBER },
                                                            box: {
                                                                type: SchemaType.OBJECT,
                                                                properties: { x1: { type: SchemaType.NUMBER }, y1: { type: SchemaType.NUMBER }, x2: { type: SchemaType.NUMBER }, y2: { type: SchemaType.NUMBER } },
                                                                required: ["x1", "y1", "x2", "y2"]
                                                            }
                                                        },
                                                        required: ["imageId", "box"]
                                                    }
                                                }
                                            },
                                            required: ["name", "confidence", "location", "description", "boundingBoxes"]
                                        }
                                    }
                                },
                                required: ["category", "conditions"]
                            }
                        },
                        error: { type: SchemaType.STRING, nullable: true },
                        message: { type: SchemaType.STRING, nullable: true }
                    },
                    required: ["analysis"]
                }
            }
        });

        const result = response.text ? JSON.parse(response.text.trim()) : {};
        res.json(result);

    } catch (error) {
        console.error("Error analyzing hair:", error);
        res.status(500).json({ error: "Failed to analyze hair", details: error.message });
    }
});

/**
 * Endpoint: /api/recommend-skin
 * Body: { analysis: [], goals: [] }
 */
app.post('/api/recommend-skin', async (req, res) => {
    try {
        const { analysis, goals } = req.body;
        const allProducts = await getAllProducts();

        const skincareCatalog = allProducts.filter(p => {
            const lowerName = p.name.toLowerCase();
            return !['shampoo', 'conditioner', 'scalp', 'minoxidil', 'follihair', 'mintop', 'anaboom'].some(term => lowerName.includes(term));
        });

        const analysisString = JSON.stringify(analysis);
        // const goalsString = goals.join(', '); // old updated on 19-02-2026
        const goalsString = (goals || []).join(", "); // new updated on 19-02-2026
        const productCatalogString = JSON.stringify(skincareCatalog.map(p => ({ id: p.variantId, name: p.name })));

        const prompt = `Create a highly effective, personalized skincare routine (Morning & Evening) based on the user's specific analysis and goals.
        
        **INPUT DATA:**
        - **USER ANALYSIS:** ${analysisString}
        - **USER GOALS:** ${goalsString}
        
        **PRODUCT CATALOG:** 
        ${productCatalogString}

        **MEDICAL LOGIC:**
        1. AM Routine: Focus on Gentle Cleansing + Antioxidants + Hydration + Sun Protection.
        2. PM Routine: Focus on Deep Cleansing + Treatments (Actives) + Repair/Moisturize.
        3. Match the single best product for each step using only the catalog.
        4. For each step, you can recommend one "Recommended" product and optionally one "Alternative" product if suitable.
        5. MANDATORY: For each product, provide a short "reason" (max 10 words) explaining why it's recommended for this specific user.

        **CONSTRAINTS:**
        - Return the exact 'productId' (which is the variantId in the catalog).
        - No hallucinations. If no product fits, skip that step.
        - Set 'recommendationType' to either "Recommended" or "Alternative".
        - Return JSON format only.`;
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        am: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    productId: { type: SchemaType.STRING },
                                    name: { type: SchemaType.STRING },
                                    stepType: { type: SchemaType.STRING },
                                    reason: { type: SchemaType.STRING },
                                    recommendationType: { type: SchemaType.STRING }
                                },
                                required: ["productId", "name", "stepType", "reason", "recommendationType"]
                            }
                        },
                        pm: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    productId: { type: SchemaType.STRING },
                                    name: { type: SchemaType.STRING },
                                    stepType: { type: SchemaType.STRING },
                                    reason: { type: SchemaType.STRING },
                                    recommendationType: { type: SchemaType.STRING }
                                },
                                required: ["productId", "name", "stepType", "reason", "recommendationType"]
                            }
                        }
                    },
                    required: ["am", "pm"]
                }
            }
        });

        const recommendations = JSON.parse(response.text.trim());
        const hydrate = (list) => (list || []).map(p => {
            const full = skincareCatalog.find(prod => prod.variantId === p.productId || prod.name === p.name);
            if (!full) return null;
            return {
                name: full.name,
                productId: full.productId,
                price: full.price,
                compareAtPrice: full.compareAtPrice,
                image: full.imageUrl,
                url: full.url,
                variantId: full.variantId,
                recommendationType: p.recommendationType || 'Recommended',
                tags: [p.stepType],
                reason: p.reason
            };
        }).filter(Boolean);
        const result = [];
        if (recommendations.am?.length > 0) {
            result.push({ category: "Morning Routine", products: hydrate(recommendations.am) });
        }
        if (recommendations.pm?.length > 0) {
            result.push({ category: "Evening Routine", products: hydrate(recommendations.pm) });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: /api/recommend-hair
 * Body: { analysis: [], profile: {}, goals: [] }
 */
app.post('/api/recommend-hair', async (req, res) => {
    try {
        const { analysis, profile, goals } = req.body;
        const allProducts = await getAllProducts();

        const hairCatalog = allProducts.filter(p => {
            const lowerName = p.name.toLowerCase();
            return ['hair', 'scalp', 'shampoo', 'conditioner', 'minoxidil', 'follihair', 'mintop', 'anaboom', 'oil', 'serum', 'tablet', 'capsule', 'solution'].some(term => lowerName.includes(term));
        });

        console.log(`- INFO: hairCatalog size: ${hairCatalog.length} products`);

        const prompt = `Create a clinical-grade hair care routine based on the provided analysis.

        **INPUT DATA:**
        - **ANALYSIS:** ${JSON.stringify(analysis)}
        - **PROFILE:** ${JSON.stringify(profile || {})}
        - **GOALS:** ${(goals || []).join(', ')}

        **PRODUCT CATALOG:** ${JSON.stringify(hairCatalog.map(p => ({ id: p.variantId, name: p.name })))}

        **MEDICAL LOGIC:**
        1. Identify issues (e.g., Pattern Baldness, Dandruff, Damage).
        2. Match the most potent product for each step using only the catalog.
        3. For each step, you can recommend one "Recommended" product and optionally one "Alternative" product if suitable.
        4. MANDATORY: For each product, provide a short "reason" (max 10 words) explaining why it's recommended for this specific user.

        **CONSTRAINTS:**
        - Return the exact 'productId' (which is the variantId in the catalog).
        - No hallucinations. If no product fits, skip that step.
        - Set 'recommendationType' to either "Recommended" or "Alternative".
        - Return JSON format only.`;
        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        am: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    productId: { type: SchemaType.STRING },
                                    name: { type: SchemaType.STRING },
                                    stepType: { type: SchemaType.STRING },
                                    reason: { type: SchemaType.STRING },
                                    recommendationType: { type: SchemaType.STRING }
                                },
                                required: ["productId", "name", "stepType", "reason", "recommendationType"]
                            }
                        },
                        pm: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    productId: { type: SchemaType.STRING },
                                    name: { type: SchemaType.STRING },
                                    stepType: { type: SchemaType.STRING },
                                    reason: { type: SchemaType.STRING },
                                    recommendationType: { type: SchemaType.STRING }
                                },
                                required: ["productId", "name", "stepType", "reason", "recommendationType"]
                            }
                        }
                    },
                    required: ["am", "pm"]
                }
            }
        });

        const recommendations = JSON.parse(response.text.trim());
        console.log("- INFO: AI hair response parsed successfully");

        const hydrate = (list) => (list || []).map(item => {
            const full = hairCatalog.find(p => p.variantId === item.productId || p.name === item.name);
            if (!full) return null;
            return {
                name: full.name,
                productId: full.productId,
                price: full.price,
                compareAtPrice: full.compareAtPrice,
                image: full.imageUrl,
                url: full.url,
                variantId: full.variantId,
                recommendationType: item.recommendationType || 'Recommended',
                tags: [item.stepType],
                reason: item.reason
            };
        }).filter(Boolean);
        const result = [];
        if (recommendations.am?.length > 0) {
            result.push({ category: "Morning Routine", products: hydrate(recommendations.am) });
        }
        if (recommendations.pm?.length > 0) {
            result.push({ category: "Evening Routine", products: hydrate(recommendations.pm) });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: /api/doctor-report
 * Method: POST
 * Body: { analysis: [], recommendations: [], type: 'skin' | 'hair' }
 */
app.post('/api/doctor-report', async (req, res) => {
    try {
        const { analysis, recommendations, type } = req.body;

        // 1. Generate AI Summary
        const prompt = `You are a senior dermatologist/trichologist. Based on this ${type} analysis: ${JSON.stringify(analysis)}, 
        generate a professional medical report summary. Include Clinical Observations and Professional Recommendations. 
        Format it neatly.`;

        const aiResponse = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] }
        });
        const summaryText = aiResponse.text.trim();

        // 2. Format Analysis HTML (like web)
        const analysisHtml = (analysis || []).map(cat => `
            <div class="category">
                <h3>${cat.category}</h3>
                <ul>
                    ${(cat.conditions || []).map(c => `
                        <li>
                            <strong>${c.name}</strong> (${Math.round(c.confidence)}%) - ${c.location}
                            ${c.description ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">${c.description}</p>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('') || '<p>No specific conditions detected.</p>';

        // 3. Format Recommendations HTML (like web)
        const recommendationsHtml = (recommendations || []).map(rec => `
            <div class="routine-section">
                <h3>${rec.category}</h3>
                <div class="products-grid">
                    ${(rec.products || []).map(p => `
                        <div class="product">
                            <img src="${p.image}" />
                            <div class="product-details">
                                <h4>${p.name}</h4>
                                <p class="price">${p.price}</p>
                                ${p.reason ? `<p style="margin: 4px 0 8px 0; font-size: 11px; color: #1d4ed8; font-style: italic;">Why: ${p.reason}</p>` : ''}
                                <div class="tags">
                                    ${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('') || '<p>No recommendations provided.</p>';

        const reportId = `report_${Date.now()}.html`;
        const reportPath = path.join(reportsDir, reportId);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dermatics AI Report</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
                h3 { color: #374151; margin-top: 20px; }
                .category { margin-bottom: 20px; }
                .routine-section { margin-bottom: 30px; }
                .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .product { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; display: flex; gap: 15px; align-items: start; page-break-inside: avoid; background: #fff; }
                .product img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; }
                .product-details h4 { margin: 0 0 5px 0; font-size: 14px; }
                .price { color: #4b5563; font-size: 13px; margin: 0 0 8px 0; }
                .tags { display: flex; flex-wrap: wrap; gap: 5px; }
                .tag { background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
                @media print {
                    body { padding: 0; }
                    .products-grid { display: block; }
                    .product { margin-bottom: 10px; }
                }
            </style>
        </head>
        <body>
            <h1>Dermatics AI Report</h1>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            
            <h2>Analysis Results</h2>
            ${analysisHtml}

            <h2>Recommended Routine</h2>
            ${recommendationsHtml}

            <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #6b7280;">
                <p>Generated by Dermatics AI. This report is for informational purposes only and does not constitute medical advice.</p>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => { window.print(); }, 500);
                }
            </script>
        </body>
        </html>
        `;

        fs.writeFileSync(reportPath, htmlContent);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        res.json({ url: `${protocol}://${host}/reports/${reportId}` });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Endpoint: /api/chat
 * Method: POST
 * Body: { query: "", context: { analysis: [], recommendations: [] } }
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { query, context } = req.body;
        const prompt = `You are the Lead Aesthetic & Scalp Consultant at Dermatics AI, powered by Dermatics India. 
        Your goal is to provide professional, empathetic, and scientifically-grounded advice.

        **USER DATA:**
        ${JSON.stringify(context)}

        **USER QUESTION:**
        "${query}"

        **GUIDELINES:**
        1. **Tone**: Be professional, warm, and authoritative. Use "we" to represent Dermatics.
        2. **Structure**: 
           - Start with a brief, friendly acknowledgement.
           - Use ### Headings for different sections.
           - Use * Bullet points for lists.
           - Use **bold text** for important keywords, product names, or skin/hair conditions.
        3. **Expertise**: Synthesize their analysis data with the products we've recommended.
        4. **Safety**: If a condition looks severe or requires medical intervention (e.g. deep scarring, severe hair loss), always advise booking a consultation with our in-house dermatologists.
        5. **Conciseness**: Keep responses under 150 words. Avoid generic fluff.
        
        Answer directly and professionally:`;

        const response = await generateContentWithFailover({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] }
        });

        res.json({ response: response.text.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure reports directory exists
const reportsDir = path.join(__dirname, 'public', 'reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// Serve static files from the React build folder
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/reports', express.static(reportsDir));

// Handle any other requests by serving index.html

// app.get('*all', (req, res) => { old updated on 19-02-2026
// app.get('/*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`- POST /api/analyze-skin`);
    console.log(`- POST /api/analyze-hair`);
    console.log(`- POST /api/recommend-skin`);
    console.log(`- POST /api/recommend-hair`);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, SchemaType } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large base64 payloads

// Environment check
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;

if (!apiKey) {
    console.error("CRITICAL ERROR: No API Key found in .env or environment variables.");
    console.error("Please set GEMINI_API_KEY in a .env file.");
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

// Shopify Config
const SHOPIFY_DOMAIN = 'dermatics-in.myshopify.com';
const ACCESS_TOKEN = '8a3075ce39ed30c5d2f04ff9e1aa13ed';

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
                    variants(first: 1) { edges { node { id, price { amount, currencyCode } } } }
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
            return {
                id: node.id,
                name: node.title,
                url: node.onlineStoreUrl || `https://${SHOPIFY_DOMAIN}/products/${node.handle}`,
                imageUrl: node.images.edges[0]?.node?.url || 'https://placehold.co/200x200?text=No+Image',
                description: node.description,
                suitableFor: node.tags || [],
                price: price ? `${price.currencyCode} ${parseFloat(price.amount).toFixed(2)}` : 'N/A',
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
        4. MANDATORY: Draw a bounding box around EVERY visible instance using normalized coordinates (0.0-1.0)
           - x1, y1 = top-left corner
           - x2, y2 = bottom-right corner
           - Example: if acne is on left cheek, draw box around that area
        
        **Grouping Strategy:**
        - Group similar conditions into categories (e.g., "Acne & Blemishes", "Signs of Aging", "Pigmentation Issues", "Texture & Pores")
        - Create new categories as needed based on what you see
        
        Provide output in JSON format. Do NOT return empty arrays for boundingBoxes - every condition MUST have visible boxes.`;

        const response = await genAI.models.generateContent({
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
                                    required: ["name", "confidence", "location", "boundingBoxes"]
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
        4. **Bounding Boxes:** 
           - **MANDATORY VISUALIZATION TASK:** If you detect any Hair Loss (including Receding Hairline, Thinning, or Alopecia), you **MUST** return a bounding box.
           - Draw the box around the entire receding area or bald spot.
           - Use normalized coordinates (0.0 - 1.0).
           - Do NOT return empty bounding boxes for visible conditions.
        
        Provide the output strictly in JSON format according to the provided schema.`;

        const response = await genAI.models.generateContent({
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
                                            required: ["name", "confidence", "location", "boundingBoxes"]
                                        }
                                    }
                                },
                                required: ["category", "conditions"]
                            }
                        },
                        error: { type: SchemaType.STRING, nullable: true },
                        message: { type: SchemaType.STRING, nullable: true }
                    }
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
        const goalsString = goals.join(', ');
        const productCatalogString = JSON.stringify(skincareCatalog.map(p => ({ id: p.id, name: p.name, description: p.description?.substring(0, 200) })));

        const prompt = `Create a skincare routine for:
        Analysis: ${analysisString}
        Goals: ${goalsString}
        Catalog: ${productCatalogString}
        Return JSON with am/pm routines. Use productId from catalog.`;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        am: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { productId: { type: SchemaType.STRING }, name: { type: SchemaType.STRING }, stepType: { type: SchemaType.STRING }, reason: { type: SchemaType.STRING } } } },
                        pm: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { productId: { type: SchemaType.STRING }, name: { type: SchemaType.STRING }, stepType: { type: SchemaType.STRING }, reason: { type: SchemaType.STRING } } } }
                    }
                }
            }
        });

        const recommendations = JSON.parse(response.text.trim());
        const hydrate = (list) => list.map(p => {
            const full = skincareCatalog.find(prod => prod.id === p.productId || prod.name === p.name);
            return full ? { ...p, ...full } : null;
        }).filter(Boolean);

        res.json({ am: hydrate(recommendations.am), pm: hydrate(recommendations.pm) });
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
            return ['hair', 'scalp', 'shampoo', 'conditioner', 'minoxidil', 'follihair', 'mintop', 'anaboom'].some(term => lowerName.includes(term));
        });

        const prompt = `Create a hair care routine for:
        Analysis: ${JSON.stringify(analysis)}
        Profile: ${JSON.stringify(profile)}
        Goals: ${goals.join(', ')}
        Catalog: ${JSON.stringify(hairCatalog.map(p => ({ id: p.id, name: p.name, description: p.description?.substring(0, 200) })))}
        Return JSON with title, introduction, am/pm routines, lifestyleTips. Use productId from catalog.`;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        title: { type: SchemaType.STRING },
                        introduction: { type: SchemaType.STRING },
                        am: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { productId: { type: SchemaType.STRING }, productName: { type: SchemaType.STRING }, purpose: { type: SchemaType.STRING } } } },
                        pm: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { productId: { type: SchemaType.STRING }, productName: { type: SchemaType.STRING }, purpose: { type: SchemaType.STRING } } } },
                        lifestyleTips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                    }
                }
            }
        });

        const result = JSON.parse(response.text.trim());
        const hydrate = (list) => list.map(item => {
            const full = hairCatalog.find(p => p.id === item.productId || p.name === item.productName);
            return full ? { ...item, ...full } : null;
        }).filter(Boolean);

        result.am = hydrate(result.am);
        result.pm = hydrate(result.pm);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`- POST /api/analyze-skin`);
    console.log(`- POST /api/analyze-hair`);
    console.log(`- POST /api/recommend-skin`);
    console.log(`- POST /api/recommend-hair`);
});

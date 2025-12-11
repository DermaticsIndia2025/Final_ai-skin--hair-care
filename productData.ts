
export interface ProductData {
    id: string;
    name: string;
    url: string;
    imageUrl: string;
    description: string;
    suitableFor: string[];
    keyIngredients: string[];
    variantId: string;
    price: string;
    originalPrice?: string;
}

const SHOPIFY_DOMAIN = 'dermatics-in.myshopify.com';
const ACCESS_TOKEN = '8a3075ce39ed30c5d2f04ff9e1aa13ed';

let cachedProducts: ProductData[] | null = null;

export async function getAllProducts(): Promise<ProductData[]> {
    if (cachedProducts) return cachedProducts;

    const query = `
    {
      products(first: 250) {
        edges {
          node {
            id
            title
            description
            handle
            onlineStoreUrl
            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
            tags
          }
        }
      }
    }
    `;

    try {
        const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': ACCESS_TOKEN,
            },
            body: JSON.stringify({ query }),
        });

        const json = await response.json();
        
        if (json.errors) {
            console.error("Shopify GraphQL Errors:", json.errors);
            return [];
        }

        const edges = json.data?.products?.edges || [];
        
        cachedProducts = edges.map((edge: any) => {
            const node = edge.node;
            const price = node.variants.edges[0]?.node?.price;
            const compareAtPrice = node.variants.edges[0]?.node?.compareAtPrice;
            const image = node.images.edges[0]?.node?.url;

            // Extract ingredients from tags or description if possible, otherwise leave empty for AI to infer
            // We pass tags as 'suitableFor' to help AI context
            return {
                id: node.id,
                name: node.title,
                url: node.onlineStoreUrl || `https://${SHOPIFY_DOMAIN}/products/${node.handle}`,
                imageUrl: image || 'https://placehold.co/200x200?text=No+Image',
                description: node.description,
                suitableFor: node.tags || [],
                keyIngredients: [], // AI will infer from description/tags in the prompt
                variantId: node.variants.edges[0]?.node?.id,
                price: price ? `${price.currencyCode} ${parseFloat(price.amount).toFixed(2)}` : 'N/A',
                originalPrice: compareAtPrice ? `${compareAtPrice.currencyCode} ${parseFloat(compareAtPrice.amount).toFixed(2)}` : undefined
            };
        });

        return cachedProducts || [];
    } catch (error) {
        console.error("Failed to fetch products from Shopify:", error);
        return [];
    }
}

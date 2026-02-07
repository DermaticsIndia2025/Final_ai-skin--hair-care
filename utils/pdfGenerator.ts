import { SkinConditionCategory, ProductRecommendation } from '../types';

export const generatePDF = (
    analysis: SkinConditionCategory[] | null, 
    recommendations: ProductRecommendation[], 
    goals: string[] = [],
    userInfo: { name?: string } = {},
    userImage?: string
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow popups to download the report.');
        return;
    }

    // 1. Title Generation (Personalized)
    const firstName = userInfo.name ? userInfo.name.split(' ')[0] : 'User';
    const mainConcern = analysis && analysis.length > 0 ? analysis[0].category : 'Skin & Hair';
    const reportTitle = `${firstName}'s Personalized ${mainConcern} Plan`;

    // Handle user image prefix if missing
    let formattedUserImage = userImage;
    if (userImage && !userImage.startsWith('data:')) {
        formattedUserImage = `data:image/jpeg;base64,${userImage}`;
    }

    // 2. Analysis HTML
    const analysisHtml = analysis ? analysis.map(cat => `
        <div class="section-item">
            <h4 style="margin: 0 0 5px 0; color: #374151;">${cat.category}</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                ${(cat.conditions || []).map(c => `
                    <li style="margin-bottom: 4px;">
                        <strong>${c.name}</strong> (${Math.round(c.confidence)}%) - ${c.location}
                    </li>
                `).join('')}
            </ul>
        </div>
    `).join('') : '<p>No analysis data available.</p>';

    // 3. Goals HTML
    const goalsHtml = goals.length > 0 
        ? goals.map(g => `<span class="goal-tag">${g}</span>`).join('')
        : '<p style="font-size: 14px;">Maintenance and general health.</p>';

    // 4. Routine HTML (Text-only as requested)
    const recommendationsHtml = (recommendations || []).map(rec => `
        <div class="routine-section">
            <h3 style="color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 15px;">
                ${rec.category === 'Morning Routine' ? 'AM Routine ☀️' : rec.category === 'Evening Routine' ? 'PM Routine 🌙' : rec.category}
            </h3>
            <div class="products-text-list">
                ${(rec.products || []).map(p => `
                    <div class="product-text-item">
                        <p style="margin: 0; font-size: 15px;">
                            <strong>${p.tags[0] || 'Step'}:</strong> ${p.name}
                        </p>
                        ${p.reason ? `<p class="product-explanation">${p.reason}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // 5. Additional Advice Logic
    const allTags = Array.from(new Set(recommendations.flatMap(r => r.products.flatMap(p => p.tags))));
    const ingredients = allTags.filter(t => !['Cleanser', 'Serum', 'Moisturizer', 'Sunscreen', 'Morning Routine', 'Evening Routine', 'Treatment'].includes(t));
    
    const ingredientsHtml = ingredients.length > 0 
        ? ingredients.map(i => `<li style="margin-bottom: 5px;">${i}</li>`).join('')
        : '<li style="margin-bottom: 5px;">Hyaluronic Acid</li><li style="margin-bottom: 5px;">Niacinamide</li>';

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dermatics AI Doctor's Report</title>
            <style>
                body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px; color: #333; max-width: 850px; margin: 0 auto; line-height: 1.6; background: #fff; }
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
                .header-text { flex: 1; }
                .user-image { width: 100px; height: 100px; object-fit: cover; border-radius: 12px; border: 2px solid #2563eb; margin-left: 20px; }
                h1 { color: #2563eb; margin: 0 0 10px 0; font-size: 28px; }
                .date { color: #6b7280; font-size: 14px; }
                h2 { color: #1e40af; margin: 30px 0 15px 0; font-size: 20px; border-left: 4px solid #2563eb; padding-left: 15px; }
                .section-box { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
                .goal-tag { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; margin: 0 8px 8px 0; }
                .routine-section { margin-bottom: 30px; }
                .product-text-item { margin-bottom: 20px; }
                .product-explanation { font-size: 14px; color: #4b5563; margin: 5px 0 0 0; text-align: justify; line-height: 1.5; }
                .advice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
                .disclaimer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
                @media print {
                    body { padding: 0; }
                    .section-box { border: 1px solid #eee; }
                    .product-text-item { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="header-text">
                    <h1>${reportTitle}</h1>
                    <div class="date">Report Generated on: ${new Date().toLocaleDateString()}</div>
                </div>
                ${userImage ? `<img src="${userImage}" class="user-image" />` : ''}
            </div>

            <div class="section-box">
                <h2 style="margin-top: 0;">AI Skin Analysis Findings</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    ${analysisHtml}
                </div>
            </div>

            <div class="section-box">
                <h2 style="margin-top: 0;">Your Skincare Goals</h2>
                <div style="padding-top: 5px;">
                    ${goalsHtml}
                </div>
            </div>

            <h2>Recommended Routine</h2>
            <p style="margin-bottom: 25px; font-size: 15px; color: #4b5563;">
                Welcome to your tailored skincare journey! This routine is meticulously crafted based on your AI analysis and goals. Consistency is key to achieving a clearer, more radiant complexion.
            </p>
            ${recommendationsHtml}

            <div class="section-box" style="background: #eff6ff; border-color: #bfdbfe;">
                <h2 style="margin-top: 0; color: #1d4ed8;">Additional Advice</h2>
                <div class="advice-grid">
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #1e40af;">Key Ingredients</h4>
                        <ul style="font-size: 14px; margin: 0; padding-left: 20px;">
                            ${ingredientsHtml}
                        </ul>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0; color: #1e40af;">Lifestyle Tips</h4>
                        <ul style="font-size: 14px; margin: 0; padding-left: 20px;">
                            <li style="margin-bottom: 5px;">Stay hydrated by drinking plenty of water.</li>
                            <li style="margin-bottom: 5px;">Maintain a balanced diet rich in antioxidants.</li>
                            <li style="margin-bottom: 5px;">Prioritize 7-9 hours of quality sleep.</li>
                            <li style="margin-bottom: 5px;">Manage stress through meditation or exercise.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="disclaimer">
                <p><strong>Disclaimer:</strong> This report is generated by AI for informational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always seek the advice of a dermatologist or other qualified health provider with any questions you may have regarding a medical condition.</p>
                <p>&copy; ${new Date().getFullYear()} Dermatics India</p>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(() => { window.print(); }, 500);
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
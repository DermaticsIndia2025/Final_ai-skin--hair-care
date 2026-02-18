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

    // 3. Additional Advice Logic
    const allTags = Array.from(new Set(recommendations.flatMap(r => r.products.flatMap(p => p.tags))));
    const ingredients = allTags.filter(t => !['Cleanser', 'Serum', 'Moisturizer', 'Sunscreen', 'Morning Routine', 'Evening Routine', 'Treatment'].includes(t));

    const ingredientsHtml = ingredients.length > 0
        ? ingredients.map(i => `<li style="margin-bottom: 5px;">${i}</li>`).join('')
        : '<li style="margin-bottom: 5px;">Hyaluronic Acid</li><li style="margin-bottom: 5px;">Niacinamide</li>';

    // Helper function to generate prescription instructions
    const generatePrescription = (products: any[], routineType: 'AM' | 'PM') => {
        const sortedProducts = [...(products || [])].sort((a, b) => {
            if (a.recommendationType === 'Recommended' && b.recommendationType === 'Alternative') return -1;
            if (a.recommendationType === 'Alternative' && b.recommendationType === 'Recommended') return 1;
            return 0;
        });
        return sortedProducts.map((p) => {
            const when = p.when || (routineType === 'AM' ? 'Morning' : 'Night');
            const howToUse = p.howToUse || 'Apply as directed.';
            const frequency = p.frequency || 'Once daily';
            const duration = p.duration || 'Ongoing';

            const tagColor = p.recommendationType === 'Recommended' ? '#059669' : '#6b7280';
            const tagBg = p.recommendationType === 'Recommended' ? '#ecfdf5' : '#f3f4f6';

            return `
            <div class="prescription-item">
                <div class="prescription-header">
                    <span class="rx-product">${p.name}</span>
                    <span class="recommendation-tag" style="background: ${tagBg}; color: ${tagColor};">${p.recommendationType}</span>
                </div>

                <div class="rx-details">
                    <div><strong>When:</strong> ${when}</div>
                    <div><strong>How to Use:</strong> ${howToUse}</div>
                    <div><strong>Frequency:</strong> ${frequency}</div>
                    <div><strong>Duration:</strong> ${duration}</div>
                    ${p.purpose ? `<div><strong>Purpose:</strong> ${p.purpose}</div>` : ''}
                </div>
            </div>
        `;
        }).join('');
    };


    // Final HTML Template
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dermatics Personalized Plan</title>

            <style>
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                margin: 40px;
                color: #1f2937;
                line-height: 1.6;
                font-size: 14px;
            }

            .report-header {
                text-align: center;
                margin-bottom: 35px;
                padding-bottom: 20px;
                border-bottom: 2px solid #1e3a8a;
            }

            .brand {
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 1px;
                color: #1e3a8a;
            }

            .brand-sub {
                font-size: 12px;
                font-weight: 500;
                color: #6b7280;
                margin-top: 3px;
            }

            .report-title {
                font-size: 22px;
                font-weight: 600;
                margin-top: 15px;
                color: #111827;
            }

            .report-meta {
                margin-top: 10px;
                font-size: 12px;
                color: #4b5563;
            }

            .section-title {
                font-size: 16px;
                font-weight: 600;
                border-bottom: 1px solid #d1d5db;
                padding-bottom: 6px;
                margin-top: 30px;
                margin-bottom: 15px;
            }

            .analysis-container {
                display: flex;
                justify-content: space-between;
                gap: 30px;
            }

            .analysis-left {
                flex: 2;
            }

            .analysis-right {
                flex: 1;
            }

            .user-image {
                width: 100%;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }

            .routine-container {
                display: flex;
                gap: 40px;
            }

            .routine-column {
                flex: 1;
            }

            .routine-column h3 {
                font-size: 16px;
                color: #1e40af;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .prescription-item {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #f3f4f6;
                page-break-inside: avoid;
            }

            .prescription-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 6px;
            }

            .rx-product {
                font-size: 14px;
                font-weight: 600;
                color: #111827;
                flex: 1;
            }

            .recommendation-tag {
                font-size: 10px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 999px;
                text-transform: uppercase;
                margin-left: 10px;
                white-space: nowrap;
            }

            .rx-details {
                font-size: 12px;
                color: #4b5563;
                line-height: 1.5;
            }

            .rx-details div {
                margin-bottom: 2px;
            }

            .advice-container {
                display: flex;
                gap: 40px;
                margin-top: 10px;
            }

            .advice-column {
                flex: 1;
            }

            ul {
                padding-left: 18px;
            }

            .disclaimer {
                margin-top: 40px;
                font-size: 11px;
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
                padding-top: 10px;
            }

            @media print {
                body { margin: 20px; }
                .report-header { margin-bottom: 20px; }
            }
            </style>
        </head>

        <body>
            <div class="report-header">
                <div class="brand">
                    DERMATICS INDIA
                    <div class="brand-sub">Advanced AI Dermatology Report</div>
                </div>
                <div class="report-title">${reportTitle}</div>
                <div class="report-meta">
                    <div><strong>Report Type:</strong> Personalized Treatment Plan</div>
                    <div><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</div>
                </div>
            </div>

            <div class="section-title">AI Skin Analysis Findings</div>
            <div class="analysis-container">
                <div class="analysis-left">${analysisHtml}</div>
                <div class="analysis-right">
                    ${formattedUserImage ? `<img src="${formattedUserImage}" class="user-image" />` : ''}
                </div>
            </div>

            <div class="section-title">Your Skincare Goals</div>
            ${goals.length > 0
            ? goals.map(g => `<div style="margin-bottom: 4px;">• ${g}</div>`).join('')
            : '<div>• Maintain healthy, balanced skin</div>'
        }

            <div class="section-title">Recommended Routine</div>
            <p style="font-size:13px; color:#4b5563; margin-bottom: 20px;">
                Welcome to your personalized skincare journey! Based on your analysis, we’ve created a targeted routine designed to address your concerns effectively. Consistency and patience are key to visible results.
            </p>

            <div class="routine-container">
                <div class="routine-column">
                    <h3>AM Routine ☀️</h3>
                    ${generatePrescription(
            recommendations.find(r => r.category === 'Morning Routine')?.products || [],
            'AM'
        )}
                </div>

                <div class="routine-column">
                    <h3>PM Routine 🌙</h3>
                    ${generatePrescription(
            recommendations.find(r => r.category === 'Evening Routine')?.products || [],
            'PM'
        )}
                </div>
            </div>

            <div class="section-title">Additional Advice</div>
            <div class="advice-container">
                <div class="advice-column">
                    <strong>Key Ingredients</strong>
                    <ul>${ingredientsHtml}</ul>
                </div>
                <div class="advice-column">
                    <strong>Lifestyle Tips</strong>
                    <ul>
                        <li>Maintain a balanced diet rich in antioxidants.</li>
                        <li>Stay hydrated by drinking adequate water daily.</li>
                        <li>Manage stress through meditation or exercise.</li>
                        <li>Change pillowcases regularly to reduce bacterial buildup.</li>
                        <li>Avoid picking active breakouts to prevent scarring.</li>
                    </ul>
                </div>
            </div>

            <div class="disclaimer">
            This skincare routine is a personalized AI-based recommendation. Individual results may vary. Always perform a patch test before introducing new products. Consult a dermatologist if irritation or adverse reactions occur. This is not a substitute for professional medical advice.
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

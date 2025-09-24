 // Renders the "Summary Report" tab
 // js/summaryView.js

import * as state from './state.js';
import { getProductTrainId, calculateScores } from './utils.js';

export function renderSummaryReport() {
    const topRpnBody = document.getElementById('topRpnTableBody');
    const criticalBody = document.getElementById('criticalProductsTableBody');
    const topRpnTableContainer = document.getElementById('topRpnTableContainer');
    const criticalProductsTableContainer = document.getElementById('criticalProductsTableContainer');
    const noRpnMsg = document.getElementById('noTopRpnMessage');
    const noCriticalMsg = document.getElementById('noCriticalMessage');
    
    topRpnBody.innerHTML = '';
    criticalBody.innerHTML = '';
    
    const top10Rpn = state.products.flatMap(product => {
        const trainId = getProductTrainId(product);
        return product.activeIngredients.map(ing => ({
            productName: product.name,
            ingredientName: ing.name,
            rpn: calculateScores(ing).rpn,
            trainId: trainId !== 'N/A' ? `T${trainId}` : ''
        }))
    }).sort((a, b) => b.rpn - a.rpn).slice(0, 10);

    if (top10Rpn.length > 0) {
        noRpnMsg.style.display = 'none';
        topRpnTableContainer.style.display = 'block';
        top10Rpn.forEach((item, index) => {
            const row = topRpnBody.insertRow();
            row.innerHTML = `<td class="px-4 py-3">${index + 1}</td><td class="px-4 py-3">${item.productName}</td><td class="px-4 py-3">${item.trainId || 'N/A'}</td><td class="px-4 py-3">${item.ingredientName}</td><td class="px-4 py-3 font-bold" style="color: var(--gradient-mid);">${item.rpn}</td>`;
        });
    } else {
        noRpnMsg.style.display = 'block';
        topRpnTableContainer.style.display = 'none';
    }

    const criticalProductsList = state.products.filter(p => p.isCritical);

    if (criticalProductsList.length > 0) {
        noCriticalMsg.style.display = 'none';
        criticalProductsTableContainer.style.display = 'block';
        criticalProductsList.forEach(p => {
            const row = criticalBody.insertRow();
            row.innerHTML = `<td class="px-4 py-3">${p.name}</td><td class="px-4 py-3" style="white-space: pre-wrap; word-break: break-word;">${p.criticalReason || 'No reason provided'}</td>`;
        });
    } else {
        noCriticalMsg.style.display = 'block';
        criticalProductsTableContainer.style.display = 'none';
    }
}
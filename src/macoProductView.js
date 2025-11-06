// Renders the "MACO for Trains" tab
// js/macoProductView.js

import * as state from './state.js';
import { hideLoader } from './ui.js';
import { getTrainData, getWorstCaseProductType, getRpnRatingClass, getTrainsGroupedByLine, getLargestEssaForLineAndDosageForm, getToxicityPreference, getConsistentTrainOrder, calculateScores, getRpnRatingText } from './utils.js';

// Smart number formatting that avoids showing 0 when there's actually a value
function formatSmallNumber(value, unit = '') {
    if (value === 0 || value === null || value === undefined || isNaN(value)) {
        return `0${unit ? ' ' + unit : ''}`;
    }
    
    const absValue = Math.abs(value);
    
    // For very small values, use scientific notation
    if (absValue < 0.0001) {
        return `${value.toExponential(3)}${unit ? ' ' + unit : ''}`;
    }
    // For small values, show enough decimal places to see the value
    else if (absValue < 0.01) {
        return `${value.toFixed(6)}${unit ? ' ' + unit : ''}`;
    }
    // For regular values, use 4 decimal places
    else {
        return `${value.toFixed(4)}${unit ? ' ' + unit : ''}`;
    }
}

export function renderMacoForTrains(lineFilter = null) {
    const container = document.getElementById('trainsContainer');
    const noTrainsMsg = document.getElementById('noTrainsMessage');
    container.innerHTML = '';

    let linesWithTrains = getTrainsGroupedByLine(); // pre-numbered trains per line with proper dosage form separation

    // Filter by line if specified
    if (lineFilter) {
        linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === lineFilter);
    }

    if (!linesWithTrains || linesWithTrains.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noTrainsMsg.style.display = 'none';
    container.style.display = 'block';

    // Get full train data for calculations and merge it properly
    const fullTrainData = getTrainData();
    const fullTrainByKey = {};
    fullTrainData.forEach(t => { if (t.key) fullTrainByKey[t.key] = t; });

    // Flatten trains and enhance with calculated metrics while preserving dosage form separation
    const enhancedTrains = [];
    linesWithTrains.forEach(lineObj => {
        lineObj.trains.forEach(train => {
            // Find full train data by key, but keep dosage form separation
            const fullTrain = fullTrainByKey[train.key];
            
            if (!fullTrain) return; // Skip if no calculated data available
            
            // Create enhanced train with calculated metrics but filtered products
            const enhancedTrain = {
                ...train,  // Keep dosage form separation and numbering from getTrainsGroupedByLine
                id: fullTrain.id,  // Use ID from full train data
                essa: fullTrain.essa,
                lowestLtd: null,
                lowestPde: null, 
                lowestLd50: null,
                minBsMddRatio: null,
                minMbsKg: null,
                assumedSsa: fullTrain.assumedSsa || 25,
                // Products are already filtered by dosage form in getTrainsGroupedByLine
            };
            
            // Calculate metrics for this specific dosage form's products
            let lowestLtd = Infinity;
            let lowestLtdProductId = null;
            let lowestPde = Infinity;
            let lowestLd50 = Infinity;
            let minMbsKg = Infinity;
            let minMbsProductId = null;
            let minRatioProductId = null;
            let worstProductByRpn = null;
            let maxRpn = -1;
            
            const productRatios = [];
            
            enhancedTrain.products.forEach(product => {
                // Find min batch size
                if (product.batchSizeKg < minMbsKg) {
                    minMbsKg = product.batchSizeKg;
                    minMbsProductId = product.id;
                }
                
                // Calculate product ratio and find ingredients data
                product.activeIngredients.forEach(ingredient => {
                    // Lowest therapeutic dose
                    if (ingredient.therapeuticDose < lowestLtd) {
                        lowestLtd = ingredient.therapeuticDose;
                        lowestLtdProductId = product.id;
                    }
                    
                    // Lowest PDE
                    if (ingredient.pde && ingredient.pde < lowestPde) {
                        lowestPde = ingredient.pde;
                    }
                    
                    // Lowest LD50
                    if (ingredient.ld50 && ingredient.ld50 < lowestLd50) {
                        lowestLd50 = ingredient.ld50;
                    }
                    
                    // Calculate BS/MDD ratio
                    const ratio = (product.batchSizeKg * 1000) / (ingredient.mdd / 1000);
                    productRatios.push({ productId: product.id, ratio });
                    
                    // Calculate RPN for worst-case product identification
                    try {
                        const scores = calculateScores(ingredient);
                        const rpn = scores?.rpn || 0;
                        if (rpn > maxRpn) {
                            maxRpn = rpn;
                            worstProductByRpn = { 
                                productName: product.name, 
                                ingredientName: ingredient.name, 
                                rpn: maxRpn, 
                                rating: getRpnRatingText(maxRpn) 
                            };
                        }
                    } catch (error) {
                        console.warn('Error calculating RPN for ingredient:', ingredient, error);
                    }
                });
            });
            
            // Set calculated values
            enhancedTrain.lowestLtd = isFinite(lowestLtd) ? lowestLtd : 0;
            enhancedTrain.lowestLtdProductId = lowestLtdProductId;
            enhancedTrain.lowestPde = isFinite(lowestPde) ? lowestPde : null;
            enhancedTrain.lowestLd50 = isFinite(lowestLd50) ? lowestLd50 : null;
            enhancedTrain.minMbsKg = isFinite(minMbsKg) ? minMbsKg : 0;
            enhancedTrain.minMbsProductId = minMbsProductId;
            enhancedTrain.worstProductRpn = worstProductByRpn; // Add RPN data
            
            // Find minimum ratio
            if (productRatios.length > 0) {
                const minRatio = productRatios.reduce((min, current) => 
                    current.ratio < min.ratio ? current : min
                );
                enhancedTrain.minBsMddRatio = minRatio.ratio;
                enhancedTrain.minRatioProductId = minRatio.productId;
            } else {
                enhancedTrain.minBsMddRatio = 0;
                enhancedTrain.minRatioProductId = null;
            }
            
            enhancedTrains.push(enhancedTrain);
        });
    });

    // Apply consistent train ordering
    const orderedTrains = getConsistentTrainOrder(enhancedTrains);

    // Filter based on printSelectedTrain if required (support either numeric train.id or new train.number)
    let trainsToRender = orderedTrains;
    if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
        if (Array.isArray(window.printSelectedTrain)) {
            trainsToRender = orderedTrains.filter(train => window.printSelectedTrain.includes(String(train.id)) || window.printSelectedTrain.includes(String(train.number)));
        } else {
            trainsToRender = orderedTrains.filter(train => String(train.id) === String(window.printSelectedTrain) || String(train.number) === String(window.printSelectedTrain));
        }
    }

    if (trainsToRender.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    // Render grouped by line and dosage for visual grouping
    const groupedByLine = {};
    trainsToRender.forEach(t => {
        if (!groupedByLine[t.line]) groupedByLine[t.line] = [];
        groupedByLine[t.line].push(t);
    });

    Object.keys(groupedByLine).forEach(lineName => {
        const lineSection = document.createElement('div');
        lineSection.className = 'mb-6';
        lineSection.innerHTML = `<h3 class="text-lg font-bold mb-2">${lineName}</h3>`;
        container.appendChild(lineSection);

        // group trains by dosage
        const byDosage = {};
        groupedByLine[lineName].forEach(t => {
            if (!byDosage[t.dosageForm]) byDosage[t.dosageForm] = [];
            byDosage[t.dosageForm].push(t);
        });

        // Sort dosage forms by their lowest train number
        const sortedDosageForms = Object.keys(byDosage).sort((a, b) => {
            const aTrains = byDosage[a];
            const bTrains = byDosage[b];
            const aMinNumber = Math.min(...aTrains.map(t => t.number));
            const bMinNumber = Math.min(...bTrains.map(t => t.number));
            return aMinNumber - bMinNumber;
        });
        
        sortedDosageForms.forEach(dosage => {
            const dosageHeader = document.createElement('div');
            dosageHeader.className = 'pl-4 mb-3';
            dosageHeader.innerHTML = `<h4 class="text-md font-semibold">${dosage}</h4>`;
            container.appendChild(dosageHeader);

            // Find the train with largest ESSA in this dosage group
            const trainsInDosage = byDosage[dosage];
            const largestEssaTrain = trainsInDosage.reduce((max, train) => 
                train.essa > max.essa ? train : max, trainsInDosage[0]);
            
            // Calculate MACO for each train first to find the lowest
            const trainsWithMaco = trainsInDosage.map(train => {
                const sfConfig = state.safetyFactorConfig[getWorstCaseProductType(train.products.map(p => p.productType))] || state.safetyFactorConfig['Other'];
                const sf = sfConfig.max;
                
                const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
                const maco10ppm = 10 * train.minMbsKg;
                let macoHealth = Infinity;
                let macoNoel = Infinity;
                
                // Check toxicity data visibility preferences
                const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
                const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
                
                // Calculate PDE-based MACO if PDE is available and not hidden
                if (train.lowestPde !== null && !pdeHidden) {
                    macoHealth = train.lowestPde * train.minBsMddRatio;
                }
                
                // Calculate NOEL-based MACO if LD50 is available and not hidden
                if (train.lowestLd50 !== null && !ld50Hidden) {
                    // NOEL = (LD50 g/kg × 70 kg) ÷ 2000
                    const noel = (train.lowestLd50 * 70) / 2000; // NOEL in g
                    // Find minimum MDD from all ingredients in the train
                    const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000)); // Convert mg to g
                    const minMdd = Math.min(...allMdds);
                    // MACO = (NOEL g × min batch size g × 1000) ÷ (safety factor × MDD g)
                    macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
                }
                
                // Calculate line-specific largest ESSA for this train
                const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainsInDosage);
                const macoVisual = 0.004 * lineLargestEssa;
                
                // Build MACO values array conditionally based on toxicity data visibility
                const allMacoValues = [
                    { name: '0.1% Therapeutic Dose', value: macoDose },
                    { name: '10 ppm Criterion', value: maco10ppm }
                ];
                
                // Add PDE equation only if PDE is available and not hidden
                if (train.lowestPde !== null && !pdeHidden) {
                    allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
                }
                
                // Add NOEL equation only if LD50 is available and not hidden
                if (train.lowestLd50 !== null && !ld50Hidden) {
                    allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
                }
                
                // Always add visual clean limit
                allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
                
                // Find the minimum MACO
                const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
                const finalMaco = finalMacoResult.value;
                
                // Calculate MACO per swab
                const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
                const macoPerSwab = macoPerArea * train.assumedSsa;
                
                return { ...train, finalMaco: macoPerSwab };
            });
            
            // Find the train with lowest MACO in this dosage group
            const lowestMacoTrain = trainsWithMaco.reduce((min, train) => {
                return train.finalMaco < min.finalMaco ? train : min;
            }, trainsWithMaco[0]);
            
            byDosage[dosage].forEach(train => {
                const isCollapsed = true;
                const productTypesInTrain = train.products.map(p => p.productType);
                const worstCaseType = getWorstCaseProductType(productTypesInTrain);
                const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];

                const trainCard = document.createElement('div');
                trainCard.className = 'train-card';
                // Create unique ID that includes dosage form to avoid conflicts
                const uniqueTrainId = `${train.id}-${train.dosageForm || 'unknown'}`;
                trainCard.id = `product-maco-train-${uniqueTrainId}`;

                const machineNames = formatTrainDisplayForMaco(train.machineIds);

                // Function to display individual machines (no grouping)
                function formatTrainDisplayForMaco(machineIds) {
                    return machineIds.map(machineId => {
                        const machine = state.machines.find(m => m.id === machineId);
                        const machineName = machine ? machine.name : `Unknown (ID: ${machineId})`;
                        const machineArea = machine ? machine.area : 0;
                        return `<span class="individual-machine" title="Machine: ${machineName} - Area: ${machineArea.toLocaleString()} cm²">${machineName}</span>`;
                    }).join(' → ');
                }

                const productTableRows = train.products.map(p => {
                    const minRatioForProduct = p.activeIngredients.length > 0
                        ? Math.min(...p.activeIngredients.map(ing => (p.batchSizeKg * 1000) / (ing.mdd / 1000)))
                        : Infinity;

                    const isMinBatchSize = p.id === train.minMbsProductId;
                    const isMinRatio = p.id === train.minRatioProductId;

                    return `
                            <tr class="product-main-row">
                                <td class="px-4 py-3 whitespace-nowrap">${p.productCode}</td>
                                <td class="px-4 py-3 font-medium">${p.name}<p class="text-xs italic" style="color:var(--text-secondary);">${p.productType}</p></td>
                                <td class="px-4 py-3 whitespace-nowrap ${isMinBatchSize ? 'font-bold' : ''}" style="${isMinBatchSize ? 'color: var(--gradient-start);' : ''}">${p.batchSizeKg} ${isMinBatchSize ? '<span class="text-xs ml-1" title="Minimum Batch Size in Train">★</span>' : ''}</td>
                                <td class="px-4 py-3 whitespace-nowrap ${isMinRatio ? 'font-bold' : ''}" style="${isMinRatio ? 'color: var(--gradient-end);' : ''}">${isFinite(minRatioForProduct) ? minRatioForProduct.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'} ${isMinRatio ? '<span class="text-xs ml-1" title="Minimum BS/MDD Ratio in Train">★</span>' : ''}</td>
                            </tr>
                            <tr class="ingredients-sub-row">
                                <td colspan="4" class="!pb-0">
                                    <div class="p-3 ingredients-sub-table">
                                         <ul class="text-xs list-disc list-inside">
                                         ${p.activeIngredients.map(ing => `<li><b>${ing.name}</b> (TD: ${ing.therapeuticDose}mg, MDD: ${ing.mdd / 1000}g)</li>`).join('')}
                                         </ul>
                                    </div>
                                </td>
                            </tr>`}).join('');

                const rpnInfo = train.worstProductRpn ?
                    `<p><b class="text-sm" >${train.worstProductRpn.productName}</b> (Ingredient: ${train.worstProductRpn.ingredientName})</p>
                         <p class="mt-0.4">RPN: <span class="font-bold text-sm" style="color:var(--gradient-mid);">${train.worstProductRpn.rpn}</span> <span class="rpn-rating-badge ${getRpnRatingClass(train.worstProductRpn.rating)}">${train.worstProductRpn.rating}</span></p>`
                    : '<p style="color:var(--text-secondary);">N/A</p>';

                const lowestLtdProduct = state.products.find(p => p.id === train.lowestLtdProductId) || { name: 'N/A' };
                const minRatioProduct = state.products.find(p => p.id === train.minRatioProductId) || { name: 'N/A' };
                const minMbsProduct = state.products.find(p => p.id === train.minMbsProductId) || { name: 'N/A' };

                trainCard.innerHTML = `
                            <div class="train-header" onclick="toggleTrain('pm-${uniqueTrainId}')">
                                <span>Train ${train.number} - ${train.dosageForm || 'Unknown'}</span>
                                <div class="flex items-center gap-2">
                                    ${train.id === largestEssaTrain.id ? `
                                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 border border-gray-300">
                                            🏆 Largest ESSA: ${train.essa.toLocaleString()} cm²
                                        </span>
                                    ` : ''}
                                    ${train.id === lowestMacoTrain.id ? `
                                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-700 border border-blue-300">
                                            🎯 Lowest MACO: ${formatSmallNumber(lowestMacoTrain.finalMaco, 'mg/Swab')}
                                        </span>
                                    ` : ''}
                                    <button class="train-toggle" id="toggle-pm-${uniqueTrainId}">${isCollapsed ? '▶' : '▼'}</button>
                                </div>
                            </div>
                            <div class="train-content ${isCollapsed ? 'collapsed' : ''}" id="content-pm-${uniqueTrainId}">
                                <div class="train-content-inner space-y-6">
                                    <!-- Train Details -->
                                    <div>
                                        <div class="flex justify-between items-start gap-4">
                                            <div>
                                                <h3 class="text-lg font-bold">Train ${train.number} Details</h3>
                                                <div class="flex items-center gap-x-2 mt-1" id="train-badges-${train.id}"></div>
                                            </div>
                                            <div class="text-right flex-shrink-0">
                                                <p class="text-sm uppercase font-semibold" style="color: var(--text-secondary);">Train Area (ESSA)</p>
                                                <p class="text-lg font-bold" style="color: var(--gradient-mid);">${train.essa.toLocaleString()} cm²</p>
                                            </div>
                                        </div>
                                        <div class="mt-4 p-3 rounded-md" style="background-color:var(--bg-accent);">
                                            <p class="text-xs uppercase font-semibold mb-1" style="color: var(--text-secondary);">Machines in Train</p>
                                            <p class="text-sm">${machineNames}</p>
                                        </div>
                                    </div>

                                    <!-- Products Table -->
                                    <div class="space-y-2">
                                        <h4 class="text-lg font-semibold">Products in Train</h4>
                                        <div class="overflow-hidden rounded-md border" style="border-color: var(--border-color);">
                                            <table class="w-full text-sm">
                                                <thead class="border-b" style="border-color: var(--border-color);">
                                                    <tr>
                                                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Code</th>
                                                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Product Name</th>
                                                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Batch Size (Kg)</th>
                                                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">BS/MDD Ratio</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y" style="border-color: var(--border-color);">${productTableRows}</tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <!-- Analysis & Calculations Grid -->
                                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t" style="border-color: var(--border-color);">
                                        <!-- Left Column: RPN & MACO Limits -->
                                        <div class="space-y-6">
                                            <div class="p-4 rounded-lg" style="background-color:var(--bg-accent);">
                                                <div class="flex items-center gap-2 mb-2">
                                                           <div class="relative group">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16" style="color: var(--text-secondary);" title="Information">
                                                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                                            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                                                        </svg>
                                            
                                                    </div>
                                                    <h5 class="text-sm font-semibold">Worst-Case Product for Cleaning Study (by RPN)</h5>

                                                </div>
                                                ${rpnInfo}
                                            </div>
                                          
                                        </div>

                                        <!-- Right Column: MACO Calculation Details -->
                                        <div class="space-y-4">

                                             <h4 class="text-md font-semibold">MACO Calculation Breakdown</h4>
                                             <button id="breakdown-toggle-btn-${uniqueTrainId}" onclick="toggleMacoBreakdown('${uniqueTrainId}')" class="w-full text-sm py-2 px-4 rounded-md border" style="color: var(--gradient-mid); border-color: var(--gradient-mid);">Show MACO Calculation Breakdown</button>
                                             
                                             <div id="maco-breakdown-details-${uniqueTrainId}" class="hidden space-y-4">
                                                 <div class="p-4 rounded-lg" style="background-color: var(--bg-accent);">
                                                    <p class="text-sm"><b>Worst-Case Dosage Form:</b> ${worstCaseType}</p>
                                                    <p class="text-xs mt-1" style="color:var(--text-secondary);">Range for ${sfConfig.route} route: ${sfConfig.min.toLocaleString()} - ${sfConfig.max.toLocaleString()}</p>
                                                    <label for="product-sf-input-train-${train.id}" class="block text-sm font-small mt-2 mb-1">Safety Factor (SF)</label>
                                                    <input type="number" id="product-sf-input-train-${train.id}" class="w-full px-2 py-2 border rounded-lg" value="${sfConfig.max}" min="${sfConfig.min}" max="${sfConfig.max}" oninput="recalculateProductMacoForTrain(${train.id})" onchange="clampSafetyFactor(this, ${train.id})">
                                                 </div>
                                                 <ul class="text-sm space-y-1 p-3 border-l-4 rounded-r-md" style="border-color:var(--gradient-mid); background-color:var(--bg-accent);">
                                                    <li><b>Minimum Batch Size (MBS):</b> ${train.minMbsKg} kg <span class="text-xs" style="color:var(--text-secondary);">(from ${minMbsProduct.name})</span></li>
                                                    <li><b>Lowest LTD:</b> ${train.lowestLtd} mg <span class="text-xs" style="color:var(--text-secondary);">(from ${lowestLtdProduct.name})</span></li>
                                                    <li><b>Minimum BS(g)/MDD(g) Ratio:</b> ${train.minBsMddRatio.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span class="text-xs" style="color:var(--text-secondary);">(from ${minRatioProduct.name})</span></li>
                                                    <li><b>Lowest PDE:</b> ${train.lowestPde !== null ? train.lowestPde + ' mg' : 'N/A'}</li>
                                                    <li><b>Lowest LD50:</b> ${train.lowestLd50 !== null ? train.lowestLd50 + ' mg/kg' : 'N/A'}</li>
                                                    ${train.lowestLd50 !== null ? `<li><b>NOEL Calculation:</b> (${train.lowestLd50} × 70) ÷ 2000 = <span class="font-semibold">${((train.lowestLd50 * 70) / 2000).toFixed(6)} g</span></li>` : ''}
                                                    <li><b>Line Largest ESSA:</b> ${(() => {
                                                        const largestEssa = getLargestEssaForLineAndDosageForm(train, trainsToRender);
                                                        const trainWithLargestEssa = trainsToRender.find(t => t.line === train.line && t.essa === largestEssa);
                                                        const trainLabel = trainWithLargestEssa && trainWithLargestEssa.number ? `Train ${trainWithLargestEssa.number}` : '';
                                                        return `${largestEssa.toLocaleString()} cm² ${trainLabel ? `(from ${trainLabel})` : '(same line & dosage form)'}`;
                                                    })()} </li>
                                                 </ul>
                                                 <div id="maco-breakdown-container-${uniqueTrainId}" class="divide-y rounded-md border" style="border-color: var(--border-color);"></div>
                                            </div>
                                            
                                            <!-- Always visible MACO / Swab value - always at the bottom -->
                                            <div class="p-4 rounded-lg border mt-4" style="border-color:var(--gradient-mid);">
                                                <div class="text-center">
                                                    <p class="text-sm" style="color:var(--text-secondary);">MACO / Swab (assuming ${train.assumedSsa} cm² area)</p>
                                                    <p class="text-lg font-bold" id="maco-per-swab-main-${uniqueTrainId}" style="color:var(--gradient-mid);">...</p>
                                                </div>
                                            </div>
                                            </div>
                                    </div>
                                </div>
                            </div>
                        `;
                
                container.appendChild(trainCard);
                recalculateProductMacoForTrain(train.id, undefined, train.dosageForm);
            });
        });
    });

    const finalTrainData = trainsToRender.map(train => {
        const uniqueTrainId = `${train.id}-${train.dosageForm || 'unknown'}`;
        const finalMacoElement = document.getElementById(`final-maco-val-${uniqueTrainId}`);
        if (finalMacoElement && finalMacoElement.dataset.value) {
            return { ...train, finalMaco: parseFloat(finalMacoElement.dataset.value) };
        }
        return { ...train, finalMaco: 0 };
    });

    if (finalTrainData.length > 0) {
        const trainWithLowestMaco = finalTrainData.reduce((minT, currentT) => currentT.finalMaco < minT.finalMaco ? currentT : minT);
        const lowestMacoBadge = document.getElementById(`train-badges-${trainWithLowestMaco.id}`);
        
        if (lowestMacoBadge) {
            lowestMacoBadge.innerHTML += `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 ml-2">Lowest MACO</span>`;
        }
    }
    
    // Update dropdown options after rendering
    populateMacoTrainOptions();
    
    // Hide loader when rendering is complete
    hideLoader();
}

export function recalculateProductMacoForTrain(trainId, lineLargestEssa, dosageForm) {
    // Find the train from the enhanced trains that match both ID and dosage form
    const trainLines = getTrainsGroupedByLine();
    let train = null;
    
    for (const lineObj of trainLines) {
        for (const t of lineObj.trains) {
            if (t.id === trainId && t.dosageForm === dosageForm) {
                // Re-calculate metrics for this specific dosage form
                const fullTrainData = getTrainData();
                const fullTrain = fullTrainData.find(ft => ft.key === t.key);
                
                if (fullTrain) {
                    // Create enhanced train with calculated metrics for this dosage form
                    train = {
                        ...t,
                        id: fullTrain.id,
                        essa: fullTrain.essa,
                        assumedSsa: fullTrain.assumedSsa || 25,
                    };
                    
                    // Calculate metrics for this specific dosage form's products
                    let lowestLtd = Infinity;
                    let lowestPde = Infinity;
                    let lowestLd50 = Infinity;
                    let minMbsKg = Infinity;
                    let minMbsProductId = null;
                    
                    const productRatios = [];
                    
                    train.products.forEach(product => {
                        if (product.batchSizeKg < minMbsKg) {
                            minMbsKg = product.batchSizeKg;
                            minMbsProductId = product.id;
                        }
                        
                        product.activeIngredients.forEach(ingredient => {
                            if (ingredient.therapeuticDose < lowestLtd) {
                                lowestLtd = ingredient.therapeuticDose;
                            }
                            if (ingredient.pde && ingredient.pde < lowestPde) {
                                lowestPde = ingredient.pde;
                            }
                            if (ingredient.ld50 && ingredient.ld50 < lowestLd50) {
                                lowestLd50 = ingredient.ld50;
                            }
                            
                            const ratio = (product.batchSizeKg * 1000) / (ingredient.mdd / 1000);
                            productRatios.push(ratio);
                        });
                    });
                    
                    // Calculate RPN for worst-case product identification
                    let worstProductByRpn = null;
                    let maxRpn = -1;
                    
                    train.products.forEach(product => {
                        product.activeIngredients.forEach(ingredient => {
                            try {
                                const scores = calculateScores(ingredient);
                                const rpn = scores?.rpn || 0;
                                if (rpn > maxRpn) {
                                    maxRpn = rpn;
                                    worstProductByRpn = { 
                                        productName: product.name, 
                                        ingredientName: ingredient.name, 
                                        rpn: maxRpn, 
                                        rating: getRpnRatingText(maxRpn) 
                                    };
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ingredient, error);
                            }
                        });
                    });
                    
                    train.lowestLtd = isFinite(lowestLtd) ? lowestLtd : 0;
                    train.lowestPde = isFinite(lowestPde) ? lowestPde : null;
                    train.lowestLd50 = isFinite(lowestLd50) ? lowestLd50 : null;
                    train.minMbsKg = isFinite(minMbsKg) ? minMbsKg : 0;
                    train.minMbsProductId = minMbsProductId;
                    train.minBsMddRatio = productRatios.length > 0 ? Math.min(...productRatios) : 0;
                    train.worstProductRpn = worstProductByRpn; // Add RPN data
                }
                break;
            }
        }
        if (train) break;
    }
    
    if (!train) return;

    // Create unique train ID that includes dosage form to match DOM elements
    const uniqueTrainId = `${trainId}-${dosageForm || 'unknown'}`;

    // Get the train number from the original train data
    let trainNumber = trainId; // fallback to trainId if not found
    for (const lineObj of trainLines) {
        const foundTrain = lineObj.trains.find(t => t.id === trainId);
        if (foundTrain && foundTrain.number) {
            trainNumber = foundTrain.number;
            break;
        }
    }

    if (lineLargestEssa === undefined) {
        const allTrains = getTrainData();
        // Calculate largest ESSA for trains in the same line and dosage form
        lineLargestEssa = getLargestEssaForLineAndDosageForm(train, allTrains);
    }

    const sfInput = document.getElementById(`product-sf-input-train-${train.id}`);
    const sf = parseFloat(sfInput?.value) || 1000; // Default safety factor

    if (isNaN(sf)) return;

    const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
    const maco10ppm = 10 * train.minMbsKg;
    let macoHealth = Infinity;
    let macoNoel = Infinity;
    
    // Check toxicity preference to determine which equations to show
    const toxicityPreference = getToxicityPreference();
    const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
    const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
    
    // Calculate PDE-based MACO if PDE is available and not hidden
    if (train.lowestPde !== null && !pdeHidden) {
        macoHealth = train.lowestPde * train.minBsMddRatio;
    }
    
    // Calculate NOEL-based MACO if LD50 is available and not hidden
    if (train.lowestLd50 !== null && !ld50Hidden) {
        // NOEL = (LD50 g/kg × 70 kg) ÷ 2000
        const noel = (train.lowestLd50 * 70) / 2000; // NOEL in g
        // Find minimum MDD from all ingredients in the train
        const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000)); // Convert mg to g
        const minMdd = Math.min(...allMdds);
        // MACO = (NOEL g × min batch size g × 1000) ÷ (safety factor × MDD g)
        macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
    }
    
    const macoVisual = 0.004 * lineLargestEssa;

    // Build MACO values array conditionally based on toxicity data visibility
    const allMacoValues = [
        { name: '0.1% Therapeutic Dose', value: macoDose },
        { name: '10 ppm Criterion', value: maco10ppm }
    ];
    
    // Add PDE equation only if PDE is available and not hidden
    if (train.lowestPde !== null && !pdeHidden) {
        allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
    }
    
    // Add NOEL equation only if LD50 is available and not hidden
    if (train.lowestLd50 !== null && !ld50Hidden) {
        allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
    }
    
    // Always add visual clean limit
    allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });

    const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
    const finalMaco = finalMacoResult.value;
    const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
    const macoPerSwab = macoPerArea * train.assumedSsa;

    // Debug logging for MACO calculation comparison
    console.log(`🔧 MacoProductView MACO calculation for Train ${trainId} (${dosageForm}):`, {
        finalMaco: finalMaco,
        lineLargestEssa: lineLargestEssa,
        assumedSsa: train.assumedSsa,
        macoPerArea: macoPerArea,
        macoPerSwab: macoPerSwab,
        macoDose: macoDose,
        maco10ppm: maco10ppm,
        macoHealth: macoHealth,
        macoNoel: macoNoel,
        macoVisual: macoVisual,
        selectedLimit: finalMacoResult.name
    });

    // Update the always-visible MACO / Swab element
    const macoPerSwabMainElement = document.getElementById(`maco-per-swab-main-${uniqueTrainId}`);
    if (macoPerSwabMainElement) {
        macoPerSwabMainElement.textContent = formatSmallNumber(macoPerSwab, 'mg/Swab');
    }

    const breakdownContainer = document.getElementById(`maco-breakdown-container-${uniqueTrainId}`);
    if (breakdownContainer) {
        breakdownContainer.innerHTML = allMacoValues.map(({ value, name }) => {
            let equation = '';
            if (name === '0.1% Therapeutic Dose') {
                equation = 'MACO = (<span title="Lowest Therapeutic Dose (mg)">LTD</span> × <span title="Batch Size / Maximum Daily Dose Ratio">BS/MDD Ratio</span>) / <span title="Safety Factor">SF</span>';
            } else if (name === '10 ppm Criterion') {
                equation = 'MACO = 10 × <span title="Minimum Batch Size (kg)">MBS(kg)</span>';
            } else if (name === 'Health-Based Limit (PDE)') {
                equation = 'MACO = <span title="Permitted Daily Exposure (mg)">PDE</span> × <span title="Batch Size / Maximum Daily Dose Ratio">BS/MDD Ratio</span>';
            } else if (name === 'Health-Based Limit (NOEL)') {
                equation = 'MACO = (<span title="No Observed Effect Level (g)">NOEL</span> × <span title="Minimum Batch Size (kg)">MBS(kg)</span> × 1000) / (<span title="Safety Factor">SF</span> × <span title="Minimum Daily Dose (g)">MDD(g)</span>)';
            } else if (name === 'Visual Clean Limit') {
                equation = 'MACO = 0.004 × <span title="Equipment Surface Shared Area (cm²)">Largest ESSA</span>';
            }
            
            return `
                    <div class="p-3 ${finalMacoResult.value === value ? 'font-bold' : ''}" style="${finalMacoResult.value === value ? 'background-color: #dcfce7; color: #166534;' : ''}">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium">${name}</span>
                            <span class="text-sm text-right">${isFinite(value) ? formatSmallNumber(value, 'mg') : 'N/A'} ${finalMacoResult.value === value ? '<span class="text-xs ml-2">✓</span>' : ''}</span>
                        </div>
                        <div class="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1" style="color: var(--text-secondary);">
                            ${equation}
                        </div>
                    </div>
                `;
        }).join('');
    }

    // Add both Final MACO Limits and Selected Limit cards to the breakdown section
    if (breakdownContainer) {
        // Find the 10 ppm Criterion value
        const ppmCriterion = allMacoValues.find(item => item.name === '10 ppm Criterion');
        const ppmValue = ppmCriterion ? ppmCriterion.value : 0;
        
        // Add Selected Limit card first
        const selectedLimitCard = document.createElement('div');
        selectedLimitCard.className = 'p-3 border-t-2 border-dashed mt-4';
        selectedLimitCard.style.borderColor = 'var(--gradient-mid)';
        selectedLimitCard.innerHTML = `
            <div class="text-center">
                <p class="text-sm font-semibold mb-2" style="color:var(--text-secondary);">Selected Limit: ${finalMacoResult.name}</p>
                <p class="text-lg font-extrabold" style="color:var(--gradient-mid);" id="final-maco-val-${uniqueTrainId}" data-value="${finalMaco}">${formatSmallNumber(finalMaco, 'mg')}</p>
                ${finalMacoResult.name === '10 ppm Criterion' ? `<p class="text-sm mt-1" style="color:var(--text-secondary);">10 ppm Criterion: ${formatSmallNumber(ppmValue, 'mg')}</p>` : ''}
            </div>
        `;
        breakdownContainer.appendChild(selectedLimitCard);
        
        // Add Final MACO Limits card (only MACO / Area, since MACO / Swab is always visible) - now at the bottom
        const finalMacoCard = document.createElement('div');
        finalMacoCard.className = 'p-4 rounded-lg mt-4';
        finalMacoCard.style.backgroundColor = 'var(--bg-accent)';
        finalMacoCard.innerHTML = `
            <h5 class="text-sm font-semibold mb-2">Final MACO Limits for Train ${trainNumber}</h5>
            <div class="space-y-3">
                <div><p class="text-sm" style="color:var(--text-secondary);">MACO / Area</p><p class="text-md font-bold" id="maco-per-area-val-${uniqueTrainId}">${macoPerArea.toExponential(3)} mg/cm²</p></div>
            </div>
        `;
        breakdownContainer.appendChild(finalMacoCard);
    }
}

// Toggle function for MACO breakdown
window.toggleMacoBreakdown = function(trainId) {
    const breakdown = document.getElementById(`maco-breakdown-details-${trainId}`);
    const button = document.getElementById(`breakdown-toggle-btn-${trainId}`);
    
    if (breakdown.classList.contains('hidden')) {
        breakdown.classList.remove('hidden');
        button.textContent = 'Hide MACO Calculation Breakdown';
    } else {
        breakdown.classList.add('hidden');
        button.textContent = 'Show MACO Calculation Breakdown';
    }
};

// Dropdown toggle functions for MACO export and print
export function toggleMacoExportDropdown() {
    const dropdown = document.getElementById('macoExportDropdown');
    dropdown.classList.toggle('hidden');
    populateMacoTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#macoExportDropdown') && !e.target.closest('button[onclick="toggleMacoExportDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

export function toggleMacoPrintDropdown() {
    const dropdown = document.getElementById('macoPrintDropdown');
    dropdown.classList.toggle('hidden');
    populateMacoTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#macoPrintDropdown') && !e.target.closest('button[onclick="toggleMacoPrintDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function populateMacoTrainOptions() {
    import('./utils.js').then(utils => {
        const { getTrainData, getTrainIdToLineNumberMap } = utils;
        const trainData = getTrainData();
        const idMap = getTrainIdToLineNumberMap();
        
        // Populate export dropdown with checkboxes
        const exportContainer = document.getElementById('macoExportTrainOptions');
        if (exportContainer) {
            exportContainer.innerHTML = '';
            trainData.forEach(train => {
                const labelElement = document.createElement('label');
                labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                labelElement.style.color = 'var(--text-primary)';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'mr-2 export-maco-train-checkbox';
                checkbox.value = train.id;
                checkbox.onchange = () => updateAllMacoTrainsCheckbox('export');
                
                const span = document.createElement('span');
                const mapped = idMap.get(String(train.id));
                span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${train.id}`;
                
                labelElement.appendChild(checkbox);
                labelElement.appendChild(span);
                exportContainer.appendChild(labelElement);
            });
        }
        
        // Populate print dropdown with checkboxes
        const printContainer = document.getElementById('macoPrintTrainOptions');
        if (printContainer) {
            printContainer.innerHTML = '';
            trainData.forEach(train => {
                const labelElement = document.createElement('label');
                labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                labelElement.style.color = 'var(--text-primary)';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'mr-2 print-maco-train-checkbox';
                checkbox.value = train.id;
                checkbox.onchange = () => updateAllMacoTrainsCheckbox('print');
                
                const span = document.createElement('span');
                const mapped = idMap.get(String(train.id));
                span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${train.id}`;
                
                labelElement.appendChild(checkbox);
                labelElement.appendChild(span);
                printContainer.appendChild(labelElement);
            });
        }
    });
}

// Multi-select train functions for MACO
export function toggleAllMacoTrainsSelection(type) {
    const allCheckbox = document.getElementById(`${type}MacoAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-maco-train-checkbox`);
    
    trainCheckboxes.forEach(checkbox => {
        checkbox.checked = allCheckbox.checked;
    });
}

export function updateAllMacoTrainsCheckbox(type) {
    const allCheckbox = document.getElementById(`${type}MacoAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-maco-train-checkbox`);
    const checkedBoxes = document.querySelectorAll(`.${type}-maco-train-checkbox:checked`);
    
    // Update "All" checkbox based on individual selections
    if (checkedBoxes.length === 0) {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = false;
    } else if (checkedBoxes.length === trainCheckboxes.length) {
        allCheckbox.checked = true;
        allCheckbox.indeterminate = false;
    } else {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = true;
    }
}

export function executeMacoExportSelection() {
    // Import UI functions dynamically to avoid circular dependency
    import('./ui.js').then(ui => {
        const allCheckbox = document.getElementById('exportMacoAllTrainsCheckbox');
        const selectedTrains = [];
        
        if (allCheckbox.checked) {
            // Export all trains
            ui.exportProductMacoToExcel('all');
        } else {
            // Get selected individual trains
            const checkedBoxes = document.querySelectorAll('.export-maco-train-checkbox:checked');
            checkedBoxes.forEach(checkbox => {
                selectedTrains.push(checkbox.value);
            });
            
            if (selectedTrains.length === 0) {
                ui.showCustomAlert("No Selection", "Please select at least one train to export.");
                return;
            }
            
            // Export selected trains
            ui.exportProductMacoToExcel(selectedTrains);
        }
        
        // Close dropdown
        document.getElementById('macoExportDropdown').classList.add('hidden');
    }).catch(error => {
        console.error('Error loading export function:', error);
        alert('Error loading export function');
    });
}

export function executeMacoPrintSelection() {
    // Import UI functions dynamically to avoid circular dependency
    import('./ui.js').then(ui => {
        const allCheckbox = document.getElementById('printMacoAllTrainsCheckbox');
        const selectedTrains = [];
        
        if (allCheckbox.checked) {
            // Print all trains
            ui.printCurrentView('macoForTrains', 'all');
        } else {
            // Get selected individual trains
            const checkedBoxes = document.querySelectorAll('.print-maco-train-checkbox:checked');
            checkedBoxes.forEach(checkbox => {
                selectedTrains.push(checkbox.value);
            });
            
            if (selectedTrains.length === 0) {
                ui.showCustomAlert("No Selection", "Please select at least one train to print.");
                return;
            }
            
            // Print selected trains
            ui.printCurrentView('macoForTrains', selectedTrains);
        }
        
        // Close dropdown
        document.getElementById('macoPrintDropdown').classList.add('hidden');
    }).catch(error => {
        console.error('Error loading print function:', error);
        alert('Error loading print function');
    });
}

// Make new functions globally available
window.toggleMacoExportDropdown = toggleMacoExportDropdown;
window.toggleMacoPrintDropdown = toggleMacoPrintDropdown;
window.toggleAllMacoTrainsSelection = toggleAllMacoTrainsSelection;
window.updateAllMacoTrainsCheckbox = updateAllMacoTrainsCheckbox;
window.executeMacoExportSelection = executeMacoExportSelection;
window.executeMacoPrintSelection = executeMacoPrintSelection;
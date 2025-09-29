// Renders the "MACO for Trains" tab
// js/macoProductView.js

import * as state from './state.js';
import { hideLoader } from './ui.js';
import { getTrainData, getWorstCaseProductType, getRpnRatingClass, consolidateMachinesByGroup } from './utils.js';

export function renderMacoForTrains() {
    const container = document.getElementById('trainsContainer');
    const noTrainsMsg = document.getElementById('noTrainsMessage');
    container.innerHTML = '';

    const trainData = getTrainData();

    if (trainData.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    // Filter trains if specific trains are selected for printing
    let trainsToRender = trainData;
    if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
        if (Array.isArray(window.printSelectedTrain)) {
            // Multiple trains selected
            trainsToRender = trainData.filter(train => window.printSelectedTrain.includes(String(train.id)));
        } else {
            // Single train selected (backward compatibility)
            trainsToRender = trainData.filter(train => String(train.id) === String(window.printSelectedTrain));
        }
    }

    if (trainsToRender.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    if (trainsToRender.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noTrainsMsg.style.display = 'none';
    container.style.display = 'block';

    const largestEssaTrain = trainData.reduce((maxT, currentT) => currentT.essa > maxT.essa ? currentT : maxT);
    const globalLargestEssa = largestEssaTrain.essa;

    trainsToRender.forEach((train, index) => {
        const isCollapsed = true; // All trains start collapsed
        const productTypesInTrain = train.products.map(p => p.productType);
        const worstCaseType = getWorstCaseProductType(productTypesInTrain);
    const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];

        const trainCard = document.createElement('div');
        trainCard.className = 'train-card';
        trainCard.id = `product-maco-train-${train.id}`;

        const machineNames = formatTrainGroupDisplayForMaco(train.machineIds);

// Custom function for MACO view without "x" notation
function formatTrainGroupDisplayForMaco(machineIds) {
    const consolidatedMachines = consolidateMachinesByGroup(machineIds);
    
    return consolidatedMachines.map(machine => {
        if (machine.isGroup) {
            // Get the names of all machines in the group
            const machineNames = machine.machines.map(m => m.name).join(', ');
            return `<span class="group-indicator" title="Group: ${machine.group} - ${machineNames} - Max area: ${machine.area.toLocaleString()} cm²">
                <strong>${machine.group}</strong>
            </span>`;
        } else {
            return `<span class="individual-machine" title="Individual machine: ${machine.name}">${machine.name}</span>`;
        }
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

        const lowestLtdProduct = state.products.find(p => p.id === train.lowestLtdProductId);
        const minRatioProduct = state.products.find(p => p.id === train.minRatioProductId);
        const minMbsProduct = state.products.find(p => p.id === train.minMbsProductId);

        trainCard.innerHTML = `
                    <div class="train-header" onclick="toggleTrain('pm-${train.id}')">
                        <span>Train ${train.id} - Product MACO Calculation</span>
                        <button class="train-toggle" id="toggle-pm-${train.id}">${isCollapsed ? '▶' : '▼'}</button>
                    </div>
                    <div class="train-content ${isCollapsed ? 'collapsed' : ''}" id="content-pm-${train.id}">
                        <div class="train-content-inner space-y-6">
                            <!-- Train Details -->
                            <div>
                                <div class="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 class="text-lg font-bold">Train ${train.id} Details</h3>
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
                                     <button id="breakdown-toggle-btn-${train.id}" onclick="toggleMacoBreakdown(${train.id})" class="w-full text-sm py-2 px-4 rounded-md border" style="color: var(--gradient-mid); border-color: var(--gradient-mid);">Show MACO Calculation Breakdown</button>
                                     <div id="maco-breakdown-details-${train.id}" class="hidden space-y-4">
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
                                            <li><b>Lowest PDE (ADE):</b> ${train.lowestPde !== null ? train.lowestPde + ' mg' : 'N/A'}</li>
                                            <li><b>Global Largest ESSA:</b> ${globalLargestEssa.toLocaleString()} cm² (from Train ${largestEssaTrain.id})</li>
                                         </ul>
                                         <div id="maco-breakdown-container-${train.id}" class="divide-y rounded-md border" style="border-color:var(--border-color);"></div>
                                    </div>
                                    <div id="final-maco-container-${train.id}" class="p-3 rounded-md text-center" style="background-color:var(--bg-secondary); border: 2px solid var(--gradient-mid);"></div>
                                                                    <div class="p-4 rounded-lg border" style="border-color:var(--gradient-mid);">
                                        <h5 class="text-sm font-semibold mb-2">Final MACO Limits for Train ${train.id}</h5>
                                        <div class="space-y-3">
                                            <div><p class="text-sm" style="color:var(--text-secondary);">MACO / Area</p><p class="text-md font-bold" id="maco-per-area-val-${train.id}">...</p></div>
                                            <div><p class="text-sm" style="color:var(--text-secondary);">MACO / Swab (assuming ${train.assumedSsa} cm² area)</p><p class="text-md font-bold" id="maco-per-swab-val-${train.id}">...</p></div>
                                        </div>
                                    </div>
                                    </div>
                            </div>
                        </div>
                    </div>
                `;
        container.appendChild(trainCard);
        recalculateProductMacoForTrain(train.id, globalLargestEssa);
    });

    const finalTrainData = trainsToRender.map(train => {
        const finalMacoElement = document.getElementById(`final-maco-val-${train.id}`);
        if (finalMacoElement && finalMacoElement.dataset.value) {
            return { ...train, finalMaco: parseFloat(finalMacoElement.dataset.value) };
        }
        return { ...train, finalMaco: 0 };
    });

    if (finalTrainData.length > 0) {
        const trainWithLowestMaco = finalTrainData.reduce((minT, currentT) => currentT.finalMaco < minT.finalMaco ? currentT : minT);
        const largestEssaBadge = document.getElementById(`train-badges-${largestEssaTrain.id}`);
        const lowestMacoBadge = document.getElementById(`train-badges-${trainWithLowestMaco.id}`);
        
        if (largestEssaBadge) {
            largestEssaBadge.innerHTML += `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">Largest ESSA</span>`;
        }
        if (lowestMacoBadge) {
            lowestMacoBadge.innerHTML += `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 ml-2">Lowest MACO</span>`;
        }
    }
    
    // Update dropdown options after rendering
    populateMacoTrainOptions();
    
    // Hide loader when rendering is complete
    hideLoader();
}

export function recalculateProductMacoForTrain(trainId, globalLargestEssa) {


    const train = getTrainData().find(t => t.id === trainId);
    if (!train) return;

    if (globalLargestEssa === undefined) {
        const allTrains = getTrainData();
        globalLargestEssa = allTrains.length > 0 ? Math.max(...allTrains.map(t => t.essa)) : 0;
    }

    const sfInput = document.getElementById(`product-sf-input-train-${train.id}`);
    const sf = parseFloat(sfInput.value);

    if (isNaN(sf)) return;

    const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
    const maco10ppm = 10 * train.minMbsKg;
    let macoHealth = Infinity;
    if (train.lowestPde !== null) {
        macoHealth = train.lowestPde * train.minBsMddRatio;
    }
    const macoVisual = 0.004 * globalLargestEssa;

    const allMacoValues = [
        { name: '0.1% Therapeutic Dose', value: macoDose },
        { name: '10 ppm Criterion', value: maco10ppm },
        { name: 'Health-Based Limit (ADE)', value: macoHealth },
        { name: 'Visual Clean Limit', value: macoVisual }
    ];

    const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
    const finalMaco = finalMacoResult.value;
    const macoPerArea = globalLargestEssa > 0 ? finalMaco / globalLargestEssa : 0;
    const macoPerSwab = macoPerArea * train.assumedSsa;

    // Update UI elements
    document.getElementById(`maco-per-area-val-${train.id}`).textContent = `${macoPerArea.toExponential(3)} mg/cm²`;
    document.getElementById(`maco-per-swab-val-${train.id}`).textContent = `${macoPerSwab.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} mg/Swab`;

    const breakdownContainer = document.getElementById(`maco-breakdown-container-${train.id}`);
    if (breakdownContainer) {
        breakdownContainer.innerHTML = allMacoValues.map(({ value, name }) => {
            let equation = '';
            if (name === '0.1% Therapeutic Dose') {
                equation = 'MACO = (<span title="Lowest Therapeutic Dose (mg)">LTD</span> × <span title="Batch Size / Maximum Daily Dose Ratio">BS/MDD Ratio</span>) / <span title="Safety Factor">SF</span>';
            } else if (name === '10 ppm Criterion') {
                equation = 'MACO = 10 × <span title="Minimum Batch Size (kg)">MBS(kg)</span>';
            } else if (name === 'Health-Based Limit (ADE)') {
                equation = 'MACO = <span title="Acceptable Daily Exposure (mg)">ADE</span> × <span title="Batch Size / Maximum Daily Dose Ratio">BS/MDD Ratio</span>';
            } else if (name === 'Visual Clean Limit') {
                equation = 'MACO = 0.004 × <span title="Equipment Surface Shared Area (cm²)">Largest ESSA</span>';
            }
            
            return `
                    <div class="p-3 ${finalMacoResult.value === value ? 'font-bold' : ''}" style="${finalMacoResult.value === value ? 'background-color: #dcfce7; color: #166534;' : ''}">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium">${name}</span>
                            <span class="text-sm text-right">${isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' mg' : 'N/A'} ${finalMacoResult.value === value ? '<span class="text-xs ml-2">✓</span>' : ''}</span>
                        </div>
                        <div class="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1" style="color: var(--text-secondary);">
                            ${equation}
                        </div>
                    </div>
                `;
        }).join('');
    }

    const finalContainer = document.getElementById(`final-maco-container-${train.id}`);
    finalContainer.innerHTML = `
                <p class="text-sm" style="color:var(--text-secondary);">Selected Limit: ${finalMacoResult.name}</p>
                <p class="text-lg font-extrabold" style="color:var(--gradient-mid);" id="final-maco-val-${train.id}" data-value="${finalMaco}">${finalMaco.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mg</p>
            `;
}

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
        const { getTrainData } = utils;
        const trainData = getTrainData();
        
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
                span.textContent = `Train ${train.id}`;
                
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
                span.textContent = `Train ${train.id}`;
                
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
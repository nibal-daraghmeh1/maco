// Renders the "Detergent MACO" tab
// js/macoDetergentView.js

import * as state from './state.js';
import { getTrainData, getWorstCaseProductType, getTrainsGroupedByLine, getLargestEssaForLineAndDosageForm, getConsistentTrainOrder } from './utils.js';
import * as utils from './utils.js';

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

export function renderDetergentMaco(lineFilter = null) {
    const container = document.getElementById('detergentMacoResults');
    const noTrainsMsg = document.getElementById('noTrainsForDetergentMessage');
    container.innerHTML = '';

    // Initialize detergent ingredients list when tab loads
    renderDetergentIngredientsList();

    const baseTrainData = getTrainData(); // computed train metrics keyed by consolidated path
    let linesWithTrains = getTrainsGroupedByLine(); // pre-numbered trains per line

    // Filter by line if specified
    if (lineFilter) {
        linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === lineFilter);
    }

    if (!linesWithTrains || linesWithTrains.length === 0) {
        noTrainsMsg.style.display = 'block';
        return;
    }
    noTrainsMsg.style.display = 'none';

    // map baseTrainData by key for merging
    const trainByKey = {};
    baseTrainData.forEach(t => { if (t.key) trainByKey[t.key] = t; });

    // Note: ESSA will be calculated per train based on line and dosage form

    // Flatten trains for optional filtering later
    const mergedTrains = [];
    linesWithTrains.forEach(lineObj => {
        lineObj.trains.forEach(t => {
            const computed = trainByKey[t.key];
            if (!computed || !computed.id) return; // skip trains that have no computed data / id
            const merged = { ...t, ...computed }; // keep t.number and t.line, but include computed metrics and id
            mergedTrains.push(merged);
        });
    });

    // Apply consistent train ordering
    const orderedTrains = getConsistentTrainOrder(mergedTrains);

    // Filter based on printSelectedTrain if required (support either numeric train.id or new train.number)
    let trainsToRender = orderedTrains;
    if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
        if (Array.isArray(window.printSelectedTrain)) {
            trainsToRender = orderedTrains.filter(train => window.printSelectedTrain.includes(String(train.id)));
        } else {
            trainsToRender = orderedTrains.filter(train => String(train.id) === String(window.printSelectedTrain));
        }
    }

    if (trainsToRender.length === 0) {
        noTrainsMsg.style.display = 'block';
        return;
    }

    const idMap = utils.getTrainIdToLineNumberMap();

    // Group trains by line and dosage form for consistent display
    const groupedByLine = {};
    trainsToRender.forEach(train => {
        const line = train.line || 'Unassigned';
        const dosageForm = train.dosageForm || 'Other';
        
        if (!groupedByLine[line]) {
            groupedByLine[line] = {};
        }
        if (!groupedByLine[line][dosageForm]) {
            groupedByLine[line][dosageForm] = [];
        }
        groupedByLine[line][dosageForm].push(train);
    });

    Object.keys(groupedByLine).forEach(lineName => {
        const lineSection = document.createElement('div');
        lineSection.className = 'mb-6';
        lineSection.innerHTML = `<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">${lineName}</h3>`;
        container.appendChild(lineSection);

        const byDosage = groupedByLine[lineName];
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
            dosageHeader.className = 'mb-4';
            dosageHeader.innerHTML = `<h4 class="text-md font-medium mb-3" style="color: var(--text-secondary);">${dosage}</h4>`;
            container.appendChild(dosageHeader);

            byDosage[dosage].forEach(train => {
        const isCollapsed = true; // All trains start collapsed
        const productTypesInTrain = train.products.map(p => p.productType);
        const worstCaseType = getWorstCaseProductType(productTypesInTrain);
        const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];

        const card = document.createElement('div');
        card.className = 'train-card'; // Use train-card for consistent collapsible behavior
        const mapped = idMap.get(String(train.id));
        const trainHeaderLabel = mapped ? `Train ${mapped.number}` : `Train ${train.id}`;
        // Create unique ID that includes dosage form to avoid conflicts
        const uniqueTrainId = `${train.id}-${train.dosageForm || 'unknown'}`;

        card.innerHTML = `
                    <div class="train-header" onclick="toggleTrain('dm-${uniqueTrainId}')">
                        <span>${trainHeaderLabel} - ${train.dosageForm || 'Unknown'}</span>
                        <button class="train-toggle" id="toggle-dm-${uniqueTrainId}">${isCollapsed ? '▶' : '▼'}</button>
                    </div>
                    <div class="train-content ${isCollapsed ? 'collapsed' : ''}" id="content-dm-${uniqueTrainId}">
                        <div class="train-content-inner space-y-3">
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                               
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">
                                    Based on products in the train, the minimum (Batch Size / MDD) ratio is: <b>${train.minBsMddRatio.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>.
                                </p>
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">
                                    Min LD50 = <b><span id="min-ld50-train-${uniqueTrainId}">...</span> mg/kg</b>
                                </p>
                            </div>

                            <div class="p-3 rounded-md border" style="border-color:var(--border-color)">
                                <label for="sf-input-train-${uniqueTrainId}" class="block text-sm font-small mb-1">Safety Factor (SF)</label>
                                <input type="number" 
                                    id="sf-input-train-${uniqueTrainId}" 
                                    class="w-full px-2 py-2 border rounded-md text-sm"
                                    value="${sfConfig.max}" 
                                    min="${sfConfig.min}" 
                                    max="${sfConfig.max}" 
                                    oninput="recalculateDetergentMacoForTrain(${train.id}, undefined, '${train.dosageForm || 'unknown'}')"
                                    onchange="clampSafetyFactor(this, ${train.id})">
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">Range for ${sfConfig.route} route: ${sfConfig.min.toLocaleString()} - ${sfConfig.max.toLocaleString()}</p>
                            </div>
                            
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">ADI = (5e-4 * LD50 * BW) / SF</p>
                                <p><b  class="text-sm">Acceptable Daily Intake (ADI):</b> <span  class="text-sm" id="adi-value-train-${uniqueTrainId}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO = (ADI * Min BS/MDD Ratio)</p>
                                <p><b  class="text-sm">MACO:</b> <span  class="text-sm" id="maco-value-train-${uniqueTrainId}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO/Area = MACO / Global Largest ESSA</p>
                                <p><b  class="text-sm">MACO per Area:</b> <span class="text-sm"id="macoarea-value-train-${uniqueTrainId}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO/Swab = (MACO/Area) * SSA</p>
                                <p><b class="text-sm">MACO per Swab:</b> <span  class="text-sm" id="macoswab-value-train-${uniqueTrainId}">...</span></p>
                            </div>
                        </div>
                    </div>
                `;
        container.appendChild(card);
        recalculateDetergentMacoForTrain(train.id, undefined, train.dosageForm || 'unknown'); // Initial calculation
            });
        });
    });
}

export function recalculateDetergentMacoForTrain(trainId, lineLargestEssa, dosageForm) {
    const train = getTrainData().find(t => t.id === trainId);
    if (!train) return;
    
    // Create unique train ID that includes dosage form
    const uniqueTrainId = `${trainId}-${dosageForm || 'unknown'}`;

    if (lineLargestEssa === undefined) {
        const allTrains = getTrainData();
        // Calculate largest ESSA for trains in the same line and dosage form
        lineLargestEssa = getLargestEssaForLineAndDosageForm(train, allTrains);
    }

    const ld50Values = state.detergentIngredients.map(i => parseFloat(i.ld50)).filter(ld50 => !isNaN(ld50));
    const minLd50 = ld50Values.length > 0 ? Math.min(...ld50Values) : 0;
    const bodyWeight = parseFloat(document.getElementById('bodyWeight')?.value) || 70; // Default to 70 if not found
    const sf = parseFloat(document.getElementById(`sf-input-train-${uniqueTrainId}`)?.value) || 1;

    console.log(`=== DETERGENT MACO CALCULATION DEBUG - Train ${trainId} ===`);
    console.log(`Detergent ingredients:`, state.detergentIngredients);
    console.log(`LD50 values:`, ld50Values);
    console.log(`Min LD50: ${minLd50}`);
    console.log(`Body weight: ${bodyWeight}`);
    console.log(`Safety factor: ${sf}`);
    console.log(`Train minBsMddRatio: ${train.minBsMddRatio}`);
    console.log(`Line largest ESSA: ${lineLargestEssa}`);
    console.log(`Train assumedSsa: ${train.assumedSsa}`);

    const adi = (5e-4 * minLd50 * bodyWeight) / sf;
    console.log(`ADI calculation: (5e-4 * ${minLd50} * ${bodyWeight}) / ${sf} = ${adi}`);
    
    const maco = adi * train.minBsMddRatio;
    console.log(`MACO calculation: ${adi} * ${train.minBsMddRatio} = ${maco}`);
    
    const macoPerArea = lineLargestEssa > 0 ? maco / lineLargestEssa : 0;
    console.log(`MACO per Area: ${maco} / ${lineLargestEssa} = ${macoPerArea}`);
    
    const macoPerSwab = macoPerArea * train.assumedSsa;
    console.log(`MACO per Swab: ${macoPerArea} * ${train.assumedSsa} = ${macoPerSwab}`);
    console.log(`=== END DETERGENT MACO CALCULATION DEBUG ===`);

    // Check if elements exist before updating
    const minLd50Element = document.getElementById(`min-ld50-train-${uniqueTrainId}`);
    const adiElement = document.getElementById(`adi-value-train-${uniqueTrainId}`);
    const macoElement = document.getElementById(`maco-value-train-${uniqueTrainId}`);
    const macoAreaElement = document.getElementById(`macoarea-value-train-${uniqueTrainId}`);
    const macoSwabElement = document.getElementById(`macoswab-value-train-${uniqueTrainId}`);

    if (minLd50Element) minLd50Element.textContent = minLd50.toLocaleString();
    if (adiElement) adiElement.textContent = `${adi.toFixed(4)} mg`;
    if (macoElement) macoElement.textContent = formatSmallNumber(maco, 'mg');
    if (macoAreaElement) macoAreaElement.textContent = `${macoPerArea.toExponential(3)} mg/cm²`;
    if (macoSwabElement) macoSwabElement.textContent = formatSmallNumber(macoPerSwab, 'mg/swab');

    // Log if elements are missing
    if (!minLd50Element) console.warn(`Element min-ld50-train-${uniqueTrainId} not found`);
    if (!adiElement) console.warn(`Element adi-value-train-${uniqueTrainId} not found`);
    if (!macoElement) console.warn(`Element maco-value-train-${uniqueTrainId} not found`);
    if (!macoAreaElement) console.warn(`Element macoarea-value-train-${uniqueTrainId} not found`);
    if (!macoSwabElement) console.warn(`Element macoswab-value-train-${uniqueTrainId} not found`);

}

export function renderDetergentIngredientsList() {
    const container = document.getElementById('detergentIngredientsContainer');
    container.innerHTML = '';
    if (state.detergentIngredients.length === 0) {
        container.innerHTML = `<p class="text-sm text-center p-2" style="color:var(--text-secondary);">Please add at least one detergent ingredient.</p>`;
    }
    state.detergentIngredients.forEach(ing => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-x-2 mb-2';
        div.innerHTML = `
                    <input type="text" oninput="updateDetergentIngredient(${ing.id}, 'name', this.value)" value="${ing.name}" placeholder="Ingredient Name" class="flex-1 px-3 py-2 border rounded-lg text-sm">
                    <input type="number" oninput="updateDetergentIngredient(${ing.id}, 'ld50', this.value)" value="${ing.ld50}" placeholder="LD50 (mg/kg)" class="w-32 px-3 py-2 border rounded-lg text-sm" min="0">
                    <div class="w-8 px-3 py-2 flex items-center justify-center">
                        <button onclick="removeDetergentIngredient(${ing.id})" class="text-red-500 hover:bg-red-50 rounded p-1" title="Remove Ingredient">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg>
                        </button>
                    </div>
                `;
        container.appendChild(div);
    });
}

export function addDetergentIngredient() {
    const newIngredients = [...state.detergentIngredients, { id: state.nextDetergentIngredientId, name: '', ld50: '' }];
    state.setNextDetergentIngredientId(state.nextDetergentIngredientId + 1);
    state.setDetergentIngredients(newIngredients);
    renderDetergentIngredientsList();
    renderDetergentMaco();
}

export function removeDetergentIngredient(id) {
    const newIngredients = state.detergentIngredients.filter(ing => ing.id !== id);
    state.setDetergentIngredients(newIngredients);
    renderDetergentIngredientsList();
    renderDetergentMaco();
}

export function updateDetergentIngredient(id, field, value) {
    const ingredient = state.detergentIngredients.find(ing => ing.id === id);
    if (ingredient) {
        ingredient[field] = value;
        renderDetergentMaco();
    }
}

// Populate detergent train selection dropdowns for export/print
export function populateDetergentTrainOptions() {
    import('./utils.js').then(utils => {
        const { getTrainData, getTrainIdToLineNumberMap } = utils;
        const trainData = getTrainData();
        const idMap = getTrainIdToLineNumberMap();

        // Export options
        const exportContainer = document.getElementById('detergentExportTrainOptions');
        if (exportContainer) {
            exportContainer.innerHTML = '';
            trainData.forEach(train => {
                const labelElement = document.createElement('label');
                labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                labelElement.style.color = 'var(--text-primary)';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'mr-2 export-detergent-train-checkbox';
                checkbox.value = train.id;
                checkbox.onchange = () => updateAllDetergentTrainsCheckbox('export');

                const span = document.createElement('span');
                const mapped = idMap.get(String(train.id));
                span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${train.id}`;

                labelElement.appendChild(checkbox);
                labelElement.appendChild(span);
                exportContainer.appendChild(labelElement);
            });
        }

        // Print options
        const printContainer = document.getElementById('detergentPrintTrainOptions');
        if (printContainer) {
            printContainer.innerHTML = '';
            trainData.forEach(train => {
                const labelElement = document.createElement('label');
                labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                labelElement.style.color = 'var(--text-primary)';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'mr-2 print-detergent-train-checkbox';
                checkbox.value = train.id;
                checkbox.onchange = () => updateAllDetergentTrainsCheckbox('print');

                const span = document.createElement('span');
                const mapped = idMap.get(String(train.id));
                span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${train.id}`;

                labelElement.appendChild(checkbox);
                labelElement.appendChild(span);
                printContainer.appendChild(labelElement);
            });
        }
    }).catch(error => console.error('Error populating detergent train options:', error));
}

// Toggle all checkboxes for detergent trains
export function toggleAllDetergentTrainsSelection(type) {
    const allCheckbox = document.getElementById(`${type}DetergentAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-detergent-train-checkbox`);
    trainCheckboxes.forEach(checkbox => { checkbox.checked = allCheckbox.checked; });
}

export function updateAllDetergentTrainsCheckbox(type) {
    const allCheckbox = document.getElementById(`${type}DetergentAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-detergent-train-checkbox`);
    const checkedBoxes = document.querySelectorAll(`.${type}-detergent-train-checkbox:checked`);

    if (!allCheckbox) return;

    if (checkedBoxes.length === 0) {
        allCheckbox.checked = false; allCheckbox.indeterminate = false;
    } else if (checkedBoxes.length === trainCheckboxes.length) {
        allCheckbox.checked = true; allCheckbox.indeterminate = false;
    } else {
        allCheckbox.checked = false; allCheckbox.indeterminate = true;
    }
}

export function executeDetergentExportSelection() {
    import('./ui.js').then(ui => {
        const allCheckbox = document.getElementById('exportDetergentAllTrainsCheckbox');
        const selectedTrains = [];

        if (allCheckbox && allCheckbox.checked) {
            ui.exportDetergentMacoToExcel();
        } else {
            const checkedBoxes = document.querySelectorAll('.export-detergent-train-checkbox:checked');
            checkedBoxes.forEach(checkbox => selectedTrains.push(checkbox.value));

            if (selectedTrains.length === 0) {
                ui.showCustomAlert("No Selection", "Please select at least one train to export.");
                return;
            }

            // Call export with selected trains
            // We'll adapt exportDetergentMacoToExcel to accept selectedTrain if needed; for now, store selection globally and call export
            window.exportSelectedDetergentTrains = selectedTrains;
            ui.exportDetergentMacoToExcel(selectedTrains);
        }

        // Close dropdown
        const dd = document.getElementById('detergentExportDropdown'); if (dd) dd.classList.add('hidden');
    }).catch(error => console.error('Error executing detergent export selection:', error));
}

export function executeDetergentPrintSelection() {
    import('./ui.js').then(ui => {
        const allCheckbox = document.getElementById('printDetergentAllTrainsCheckbox');
        const selectedTrains = [];

        if (allCheckbox && allCheckbox.checked) {
            ui.printCurrentView('detergentMaco', 'all');
        } else {
            const checkedBoxes = document.querySelectorAll('.print-detergent-train-checkbox:checked');
            checkedBoxes.forEach(checkbox => selectedTrains.push(checkbox.value));

            if (selectedTrains.length === 0) {
                ui.showCustomAlert("No Selection", "Please select at least one train to print.");
                return;
            }

            window.printSelectedTrain = selectedTrains;
            ui.printCurrentView('detergentMaco', selectedTrains);
        }

        // Close dropdown
        const dd = document.getElementById('detergentPrintDropdown'); if (dd) dd.classList.add('hidden');
    }).catch(error => console.error('Error executing detergent print selection:', error));
}

// Toggle dropdown visibility helpers
export function toggleDetergentExportDropdown() {
    const dd = document.getElementById('detergentExportDropdown'); if (!dd) return; dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) {
        populateDetergentTrainOptions();
        // Attach click-outside handler
        setTimeout(() => {
            function outsideHandler(e) {
                if (!e.target.closest('#detergentExportDropdown') && !e.target.closest('[onclick="toggleDetergentExportDropdown()"]')) {
                    dd.classList.add('hidden');
                    document.removeEventListener('click', outsideHandler);
                }
            }
            document.addEventListener('click', outsideHandler);
        }, 10);
    }
}

export function toggleDetergentPrintDropdown() {
    const dd = document.getElementById('detergentPrintDropdown'); if (!dd) return; dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) {
        populateDetergentTrainOptions();
        setTimeout(() => {
            function outsideHandler(e) {
                if (!e.target.closest('#detergentPrintDropdown') && !e.target.closest('[onclick="toggleDetergentPrintDropdown()"]')) {
                    dd.classList.add('hidden');
                    document.removeEventListener('click', outsideHandler);
                }
            }
            document.addEventListener('click', outsideHandler);
        }, 10);
    }
}

// Expose to window
window.toggleDetergentExportDropdown = toggleDetergentExportDropdown;
window.toggleDetergentPrintDropdown = toggleDetergentPrintDropdown;
window.toggleAllDetergentTrainsSelection = toggleAllDetergentTrainsSelection;
window.updateAllDetergentTrainsCheckbox = updateAllDetergentTrainsCheckbox;
window.executeDetergentExportSelection = executeDetergentExportSelection;
window.executeDetergentPrintSelection = executeDetergentPrintSelection;

// Expose detergent ingredient functions
window.renderDetergentIngredientsList = renderDetergentIngredientsList;
window.addDetergentIngredient = addDetergentIngredient;
window.removeDetergentIngredient = removeDetergentIngredient;
window.updateDetergentIngredient = updateDetergentIngredient;
window.recalculateDetergentMacoForTrain = recalculateDetergentMacoForTrain;
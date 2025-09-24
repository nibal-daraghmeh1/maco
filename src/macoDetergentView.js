// Renders the "Detergent MACO" tab
// js/macoDetergentView.js

import * as state from './state.js';
import { getTrainData, getWorstCaseProductType } from './utils.js';

export function renderDetergentMaco() {
    const container = document.getElementById('detergentMacoResults');
    const noTrainsMsg = document.getElementById('noTrainsForDetergentMessage');
    container.innerHTML = '';

    let trainData = getTrainData();

    // If a print filter is set (from UI.printCurrentView), apply it
    let trainsToRender = trainData;
    if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
        if (Array.isArray(window.printSelectedTrain)) {
            trainsToRender = trainData.filter(train => window.printSelectedTrain.includes(String(train.id)));
        } else {
            trainsToRender = trainData.filter(train => String(train.id) === String(window.printSelectedTrain));
        }
    }

    if (trainsToRender.length === 0) {
        noTrainsMsg.style.display = 'block';
        return;
    }
    noTrainsMsg.style.display = 'none';

    const allTrains = getTrainData();
    const globalLargestEssa = allTrains.length > 0 ? Math.max(...allTrains.map(t => t.essa)) : 0;

    trainsToRender.forEach((train, index) => {
        const isCollapsed = true; // All trains start collapsed
        const productTypesInTrain = train.products.map(p => p.productType);
        const worstCaseType = getWorstCaseProductType(productTypesInTrain);
        const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];

        const card = document.createElement('div');
        card.className = 'train-card'; // Use train-card for consistent collapsible behavior
        card.innerHTML = `
                    <div class="train-header" onclick="toggleTrain('dm-${train.id}')">
                        <span>Train ${train.id} - Detergent MACO Calculation</span>
                        <button class="train-toggle" id="toggle-dm-${train.id}">${isCollapsed ? '▶' : '▼'}</button>
                    </div>
                    <div class="train-content ${isCollapsed ? 'collapsed' : ''}" id="content-dm-${train.id}">
                        <div class="train-content-inner space-y-3">
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                               
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">
                                    Based on products in the train, the minimum (Batch Size / MDD) ratio is: <b>${train.minBsMddRatio.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>.
                                </p>
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">
                                    Min LD50 = <b><span id="min-ld50-train-${train.id}">...</span> mg/kg</b>
                                </p>
                            </div>

                            <div class="p-3 rounded-md border" style="border-color:var(--border-color)">
                                <label for="sf-input-train-${train.id}" class="block text-sm font-small mb-1">Safety Factor (SF)</label>
                                <input type="number" 
                                    id="sf-input-train-${train.id}" 
                                    class="w-full px-2 py-2 border rounded-md text-sm"
                                    value="${sfConfig.max}" 
                                    min="${sfConfig.min}" 
                                    max="${sfConfig.max}" 
                                    oninput="recalculateDetergentMacoForTrain(${train.id})"
                                    onchange="clampSafetyFactor(this, ${train.id})">
                                <p class="text-xs mt-1" style="color:var(--text-secondary);">Range for ${sfConfig.route} route: ${sfConfig.min.toLocaleString()} - ${sfConfig.max.toLocaleString()}</p>
                            </div>
                            
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">ADI = (5e-4 * LD50 * BW) / SF</p>
                                <p><b  class="text-sm">Acceptable Daily Intake (ADI):</b> <span  class="text-sm" id="adi-value-train-${train.id}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO = (ADI * Min BS/MDD Ratio)</p>
                                <p><b  class="text-sm">MACO:</b> <span  class="text-sm" id="maco-value-train-${train.id}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO/Area = MACO / Global Largest ESSA</p>
                                <p><b  class="text-sm">MACO per Area:</b> <span class="text-sm"id="macoarea-value-train-${train.id}">...</span></p>
                            </div>
                            <div class="p-3 rounded-md" style="background-color: var(--bg-accent);">
                                <p class="font-mono text-xs" style="color:var(--text-secondary);">MACO/Swab = (MACO/Area) * SSA</p>
                                <p><b class="text-sm">MACO per Swab:</b> <span  class="text-sm" id="macoswab-value-train-${train.id}">...</span></p>
                            </div>
                        </div>
                    </div>
                `;
        container.appendChild(card);
        recalculateDetergentMacoForTrain(train.id, globalLargestEssa); // Initial calculation
    });
}

export function recalculateDetergentMacoForTrain(trainId, globalLargestEssa) {
    const train = getTrainData().find(t => t.id === trainId);
    if (!train) return;

    if (globalLargestEssa === undefined) {
        const allTrains = getTrainData();
        globalLargestEssa = allTrains.length > 0 ? Math.max(...allTrains.map(t => t.essa)) : 0;
    }

    const ld50Values = state.detergentIngredients.map(i => parseFloat(i.ld50)).filter(ld50 => !isNaN(ld50));
    const minLd50 = ld50Values.length > 0 ? Math.min(...ld50Values) : 0;
    const bodyWeight = parseFloat(document.getElementById('bodyWeight').value) || 0;
    const sf = parseFloat(document.getElementById(`sf-input-train-${trainId}`).value) || 1;

    const adi = (5e-4 * minLd50 * bodyWeight) / sf;
    const maco = adi * train.minBsMddRatio;
    const macoPerArea = globalLargestEssa > 0 ? maco / globalLargestEssa : 0;
    const macoPerSwab = macoPerArea * train.assumedSsa;

    document.getElementById(`min-ld50-train-${trainId}`).textContent = minLd50.toLocaleString();
    document.getElementById(`adi-value-train-${trainId}`).textContent = `${adi.toFixed(4)} mg`;
    document.getElementById(`maco-value-train-${trainId}`).textContent = `${maco.toFixed(2)} mg`;
    document.getElementById(`macoarea-value-train-${trainId}`).textContent = `${macoPerArea.toExponential(3)} mg/cm²`;
    document.getElementById(`macoswab-value-train-${trainId}`).textContent = `${macoPerSwab.toFixed(4)} mg/swab`;

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
        const { getTrainData } = utils;
        const trainData = getTrainData();

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
                span.textContent = `Train ${train.id}`;

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
                span.textContent = `Train ${train.id}`;

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
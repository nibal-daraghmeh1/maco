// Renders the "Worst Case Products" tab
// js/worstCaseView.js
// THE FIX: Import the state module
import * as state from './state.js'; 
import { hideLoader, updateToggleIcons, showCustomAlert } from './ui.js';
import { getProductTrainId, calculateScores, getRpnRatingClass, getToxicityPreference, getTrainsGroupedByLine, getConsistentTrainOrder } from './utils.js';


export function handleSearchAndFilter(tabId, lineFilter = null) {
   if (tabId !== 'worstCaseProducts') return;

    const productNameFilter = document.getElementById('worstCaseProductNameFilter');
    const nameFilter = productNameFilter ? productNameFilter.value.toLowerCase() : '';
    
    // THE FIX: Prefix 'products' and 'viewProducts' with 'state.'
    state.viewProducts[tabId] = state.products.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(nameFilter);
        const lineMatch = !lineFilter || product.line === lineFilter;
        return nameMatch && lineMatch;
    });
    renderWorstCaseByTrain(true, lineFilter);
}

export function handleWorstCaseProductFilter() {
    handleSearchAndFilter('worstCaseProducts');
}

export function sortData(key, tabId) {
    if (tabId !== 'worstCaseProducts') return;
    
    if (state.sortState.key === key) {
        state.sortState.direction = state.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortState.key = key;
        state.sortState.direction = (key === 'rpn') ? 'desc' : 'asc';
    }
    
    renderWorstCaseByTrain(false);
}

export function updateSortIndicators(tabId) {
    const tabContainer = document.getElementById(tabId);
    if (!tabContainer) return;
    
    tabContainer.querySelectorAll('.mainTable th.sortable').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        const key = th.dataset.key;
        indicator.textContent = '';
        
        if (key === state.sortState.key) {
            indicator.textContent = state.sortState.direction === 'asc' ? '▲' : '▼';
        }
    });
}


export function renderWorstCaseByTrain(collapsed=true, lineFilter = null) {
    const container = document.getElementById('worstCaseTrainsContainer');
    const noResultsMessage = document.getElementById('noWorstCaseMessage');
    container.innerHTML = '';

    // Ensure viewProducts exists
    if (!state.viewProducts['worstCaseProducts']) {
        state.viewProducts['worstCaseProducts'] = [...state.products];
    }

    const productsToRender = [...state.viewProducts['worstCaseProducts']];
    if (productsToRender.length === 0) {
        noResultsMessage.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    // Build pre-numbered trains grouped by Line and Dosage Form
    let linesWithTrains = getTrainsGroupedByLine();
    
    // Filter by line if specified
    if (lineFilter) {
        linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === lineFilter);
    }

    if (!linesWithTrains || linesWithTrains.length === 0) {
        noResultsMessage.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noResultsMessage.style.display = 'none';
    container.style.display = 'block';

    // Flatten all trains and apply consistent ordering
    const allTrains = [];
    linesWithTrains.forEach(lineObj => {
        lineObj.trains.forEach(train => {
            allTrains.push({
                ...train,
                line: train.line
            });
        });
    });

    // Apply consistent train ordering
    const orderedTrains = getConsistentTrainOrder(allTrains);

    // Group trains by line and dosage form for display
    const groupedByLine = {};
    orderedTrains.forEach(train => {
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

    // Iterate lines (outer loop)
    Object.keys(groupedByLine).forEach(lineName => {
        const lineHeader = document.createElement('div');
        lineHeader.className = 'mb-4';
        lineHeader.innerHTML = `<h3 class="text-lg font-bold">${lineName}</h3>`;
        container.appendChild(lineHeader);

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
            const dosageDiv = document.createElement('div');
            dosageDiv.className = 'pl-4 mb-3';
            dosageDiv.innerHTML = `<h4 class="text-md font-semibold">${dosage}</h4>`;
            container.appendChild(dosageDiv);

            // find trains for this dosage and render pre-numbered cards
            byDosage[dosage].forEach(train => {
                // Skip if printing specific trains and this one isn't selected
                if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
                    if (Array.isArray(window.printSelectedTrain)) {
                        if (!window.printSelectedTrain.includes(String(train.number))) return;
                    } else {
                        if (String(train.number) !== String(window.printSelectedTrain)) return;
                    }
                }

                const isPrintMode = document.body.classList.contains('printing-worstCaseProducts');
                const isCollapsed = isPrintMode || !collapsed ? false : true;

                // calculate worst-case values within this train
                train.products.forEach(p => {
                    const toxicityPreference = getToxicityPreference();
                    const values = p.activeIngredients.map(ing => calculateScores(ing, toxicityPreference).rpn);
                    p.sortValue = values.length > 0 ? Math.max(...values) : 0;
                });

                train.products.sort((a,b) => {
                    const key = state.sortState.key;
                    const dir = state.sortState.direction === 'asc' ? 1 : -1;
                    let valA, valB;
                    switch (key) {
                        case 'productCode': valA = a.productCode; valB = b.productCode; break;
                        case 'name': valA = a.name; valB = b.name; break;
                        default: valA = a.sortValue; valB = b.sortValue;
                    }
                    if (valA < valB) return -1 * dir;
                    if (valA > valB) return 1 * dir;
                    return 0;
                });

                // Build train card HTML (simplified from maco view)
                const trainCard = document.createElement('div');
                trainCard.className = 'train-card mb-3';
                // Create unique ID that includes dosage form to avoid conflicts
                const uniqueTrainId = `${train.line}-${train.number}-${train.dosageForm || 'unknown'}`;
                let html = `
                    <div class="train-header" onclick="toggleTrain('wc-${uniqueTrainId}')">
                        <span>Train ${train.number} - ${train.dosageForm || 'Unknown'}</span>
                        <button class="train-toggle" id="toggle-wc-${uniqueTrainId}">${isCollapsed ? '\u25B6' : '\u25BC'}</button>
                    </div>
                    <div class="train-content ${isCollapsed ? 'collapsed' : ''}" id="content-wc-${uniqueTrainId}">
                        <div class="train-content-inner">
                            <table class="w-full text-sm mainTable">
                                <thead style="background: var(--bg-accent);">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider sortable" data-key="productCode">Code <span class="sort-indicator"></span></th>
                                        <th class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider sortable" data-key="name">Product Name <span class="sort-indicator"></span></th>
                                        <th class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider">Highest RPN</th>
                                        <th class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider">Special Case</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y" style="border-color: var(--border-color);">
                `;

                train.products.forEach(product => {
                    const criticalText = product.isCritical ? 'Yes' : 'No';
                    const criticalClass = product.isCritical ? 'text-red-600 font-bold' : '';
                    html += `
                        <tr class="product-main-row">
                            <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top">${product.productCode}</td>
                            <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top">
                                <span class="product-name">${product.name}</span>
                                <p class="text-xs italic" style="color: var(--text-secondary);">${product.productType || 'N/A'}</p>
                            </td>
                            <td class="px-3 py-3 text-sm font-bold whitespace-nowrap align-top" style="color: var(--gradient-mid);">${product.sortValue}</td>
                            <td class="px-3 py-3 text-sm align-top">
                                <span class="${criticalClass}">${criticalText}</span>
                                ${product.isCritical && product.criticalReason ? `<p class="text-xs italic" style="color: var(--text-secondary); max-width: 150px; white-space: normal;">${product.criticalReason}</p>` : ''}
                            </td>
                        </tr>`;
                });

                html += `</tbody></table></div></div>`;
                trainCard.innerHTML = html;
                container.appendChild(trainCard);

                // attach sort handlers
                const sortableHeaders = trainCard.querySelectorAll('th.sortable[data-key]');
                sortableHeaders.forEach(header => {
                    header.addEventListener('click', function(event) {
                        event.stopPropagation();
                        const key = this.getAttribute('data-key');
                        sortData(key, 'worstCaseProducts');
                    });
                });
            });
        });
    });

    updateToggleIcons('worstCaseProducts');
    updateSortIndicators('worstCaseProducts');
    hideLoader();

    // Update dropdown options after rendering
    populateWorstCaseTrainOptions();
}

export function renderRpnChart() {
    const canvas = document.getElementById('rpnChartCanvas');
    const placeholder = document.getElementById('rpnChartPlaceholder');
    const colorMap = { 'low': { bg: 'rgba(74, 222, 128, 0.6)', border: 'rgba(34, 197, 94, 1)' }, 'medium': { bg: 'rgba(250, 204, 21, 0.6)', border: 'rgba(234, 179, 8, 1)' }, 'high': { bg: 'rgba(239, 68, 68, 0.6)', border: 'rgba(220, 38, 38, 1)' }, 'default': { bg: 'rgba(156, 163, 175, 0.6)', border: 'rgba(107, 114, 128, 1)' } };

    // Initialize viewProducts if it doesn't exist
    if (!state.viewProducts['worstCaseProducts']) {
        state.viewProducts['worstCaseProducts'] = [...state.products];
    }
    
    const productsForChart = state.viewProducts['worstCaseProducts'] || [];
  
    const toxicityPreference = getToxicityPreference();
    const flatData = productsForChart.flatMap(p => 
        p.activeIngredients.map(ing => {
            const scores = calculateScores(ing, toxicityPreference);
            const trainId = getProductTrainId(p);
            return {
                productName: p.name,
                ingredientName: ing.name,
                rpn: scores.rpn,
                ratingKey: scores.rpnRatingText.toLowerCase(),
                trainId: trainId !== 'N/A' ? `T${trainId}` : ''
            };
        })
    );

    if (flatData.length === 0) {
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        if (state.rpnChartInstance) state.rpnChartInstance.destroy();
        return;
    } else {
        canvas.style.display = 'block';
        placeholder.style.display = 'none';
    }

    flatData.sort((a, b) => b.rpn - a.rpn);

    const labels = flatData.map(d => `${d.productName} (${d.ingredientName}) ${d.trainId}`);
    const rpnData = flatData.map(d => d.rpn);
    const backgroundColors = flatData.map(d => (colorMap[d.ratingKey] || colorMap['default']).bg);
    const borderColors = flatData.map(d => (colorMap[d.ratingKey] || colorMap['default']).border);

    if (state.rpnChartInstance) state.rpnChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    const newChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'RPN',
                data: rpnData,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) { label += context.parsed.y; }
                            return label;
                        }
                    }
                }
            }
        }
    });
    state.setRpnChartInstance(newChartInstance);
}

// Dropdown toggle functions for worst case export and print
export function toggleWorstCaseExportDropdown() {
    const dropdown = document.getElementById('worstCaseExportDropdown');
    dropdown.classList.toggle('hidden');
    populateWorstCaseTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#worstCaseExportDropdown') && !e.target.closest('button[onclick="toggleWorstCaseExportDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

export function toggleWorstCasePrintDropdown() {
    const dropdown = document.getElementById('worstCasePrintDropdown');
    dropdown.classList.toggle('hidden');
    populateWorstCaseTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#worstCasePrintDropdown') && !e.target.closest('button[onclick="toggleWorstCasePrintDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function populateWorstCaseTrainOptions() {
    // Get current filtered products
    const productsToRender = state.viewProducts['worstCaseProducts'] || state.products;
    
    // Get unique train IDs
    const trainIds = new Set();
    productsToRender.forEach(p => {
        const trainId = getProductTrainId(p);
        if (trainId !== 'N/A') {
            trainIds.add(String(trainId));
        }
    });

    const sortedTrainIds = Array.from(trainIds).sort((a, b) => parseInt(a) - parseInt(b));

    // Get mapping for friendly labels
    const idMap = getTrainIdToLineNumberMap();
    
    // Populate export dropdown with checkboxes
    const exportContainer = document.getElementById('worstCaseExportTrainOptions');
    if (exportContainer) {
        exportContainer.innerHTML = '';
        sortedTrainIds.forEach(trainId => {
            const labelElement = document.createElement('label');
            labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            labelElement.style.color = 'var(--text-primary)';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-2 export-train-checkbox';
            checkbox.value = trainId;
            checkbox.onchange = () => updateAllTrainsCheckbox('export');
            
            const span = document.createElement('span');
            const mapped = idMap.get(String(trainId));
            span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${trainId}`;
            
            labelElement.appendChild(checkbox);
            labelElement.appendChild(span);
            exportContainer.appendChild(labelElement);
        });
    }
    
    // Populate print dropdown with checkboxes
    const printContainer = document.getElementById('worstCasePrintTrainOptions');
    if (printContainer) {
        printContainer.innerHTML = '';
        sortedTrainIds.forEach(trainId => {
            const labelElement = document.createElement('label');
            labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            labelElement.style.color = 'var(--text-primary)';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-2 print-train-checkbox';
            checkbox.value = trainId;
            checkbox.onchange = () => updateAllTrainsCheckbox('print');
            
            const span = document.createElement('span');
            const mapped = idMap.get(String(trainId));
            span.textContent = mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${trainId}`;
            
            labelElement.appendChild(checkbox);
            labelElement.appendChild(span);
            printContainer.appendChild(labelElement);
        });
    }
}

// Multi-select train functions
export function toggleAllTrainsSelection(type) {
    const allCheckbox = document.getElementById(`${type}AllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-train-checkbox`);
    
    trainCheckboxes.forEach(checkbox => {
        checkbox.checked = allCheckbox.checked;
    });
}

export function updateAllTrainsCheckbox(type) {
    const allCheckbox = document.getElementById(`${type}AllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-train-checkbox`);
    const checkedBoxes = document.querySelectorAll(`.${type}-train-checkbox:checked`);
    
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

export function executeExportSelection() {
    const allCheckbox = document.getElementById('exportAllTrainsCheckbox');
    const selectedTrains = [];
    
    if (allCheckbox.checked) {
        // Export all trains
        exportWorstCaseToExcel('all');
    } else {
        // Get selected individual trains
        const checkedBoxes = document.querySelectorAll('.export-train-checkbox:checked');
        checkedBoxes.forEach(checkbox => {
            selectedTrains.push(checkbox.value);
        });
        
        if (selectedTrains.length === 0) {
            showCustomAlert("No Selection", "Please select at least one train to export.");
            return;
        }
        
        // Export selected trains
        exportWorstCaseToExcel(selectedTrains);
    }
    
    // Close dropdown
    document.getElementById('worstCaseExportDropdown').classList.add('hidden');
}

export function executePrintSelection() {
    const allCheckbox = document.getElementById('printAllTrainsCheckbox');
    const selectedTrains = [];
    
    if (allCheckbox.checked) {
        // Print all trains
        printCurrentView('worstCaseProducts', 'all');
    } else {
        // Get selected individual trains
        const checkedBoxes = document.querySelectorAll('.print-train-checkbox:checked');
        checkedBoxes.forEach(checkbox => {
            selectedTrains.push(checkbox.value);
        });
        
        if (selectedTrains.length === 0) {
            showCustomAlert("No Selection", "Please select at least one train to print.");
            return;
        }
        
        // Print selected trains
        printCurrentView('worstCaseProducts', selectedTrains);
    }
    
    // Close dropdown
    document.getElementById('worstCasePrintDropdown').classList.add('hidden');
}

// Make new functions globally available
window.toggleAllTrainsSelection = toggleAllTrainsSelection;
window.updateAllTrainsCheckbox = updateAllTrainsCheckbox;
window.executeExportSelection = executeExportSelection;
window.executePrintSelection = executePrintSelection;

// Make functions globally available
window.toggleWorstCaseExportDropdown = toggleWorstCaseExportDropdown;
window.toggleWorstCasePrintDropdown = toggleWorstCasePrintDropdown;
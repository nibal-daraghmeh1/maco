// Renders the main product tables and handles CRUD operations
// js/productView.js

import * as state from './state.js';
import { fullAppRender } from './app.js';
import { showLoader, hideLoader, showCustomAlert, hideModal, saveStateForUndo, updateToggleIcons } from './ui.js';
import { getProductTrainId, getProductTrainNumber, calculateScores, populateSelectWithOptions, getUniqueProductLines } from './utils.js';
import { renderWorstCaseByTrain } from './worstCaseView.js';

export function renderProducts(tabId) {
    if (tabId === 'worstCaseProducts') {
        renderWorstCaseByTrain();
        return;
    }

    const tabContainer = document.getElementById(tabId);
    if (!tabContainer) return;
    
    // Clear only the table content, not the entire container (to preserve filters and buttons)
    const existingTables = tabContainer.querySelectorAll('.line-table');
    existingTables.forEach(table => table.remove());

let dataToRender = [...state.viewProducts[tabId]];

    // Group products by line
    const productsByLine = {};
    dataToRender.forEach(product => {
        const line = product.line || 'Unassigned';
        if (!productsByLine[line]) {
            productsByLine[line] = [];
        }
        productsByLine[line].push(product);
    });

    // Create separate table for each line
    Object.keys(productsByLine).sort().forEach(line => {
        const products = productsByLine[line];
        
        // Sort products within this line
        products.sort((a, b) => {
            // Primary sort: by the selected sort key
            let valA, valB;
            const key = state.sortState.key;
            switch (key) {
                case 'productCode': valA = a.productCode; valB = b.productCode; break;
                case 'name': valA = a.name; valB = b.name; break;
                case 'productType': valA = a.productType || 'Other'; valB = b.productType || 'Other'; break;
                case 'batchSizeKg': valA = a.batchSizeKg; valB = b.batchSizeKg; break;
                case 'date': valA = new Date(a.date); valB = new Date(b.date); break;
                default: return 0;
            }

            const dir = state.sortState.direction === 'asc' ? 1 : -1;

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            
            // Secondary sort: by dosage form if primary sort is equal
            const dosageA = a.productType || 'Other';
            const dosageB = b.productType || 'Other';
            if (dosageA !== dosageB) {
                return dosageA.localeCompare(dosageB);
            }
            
            return 0;
        });

        // Create table container for this line
        const lineContainer = document.createElement('div');
        lineContainer.className = 'mb-8 line-table';
        const lineId = line.replace(/\s+/g, '_').toLowerCase();
        
        // Add event listeners for sorting after table is created
        setTimeout(() => {
            const sortableHeaders = lineContainer.querySelectorAll('th.sortable');
            sortableHeaders.forEach(th => {
                th.addEventListener('click', function() {
                    const onclickAttr = this.getAttribute('onclick');
                    if (onclickAttr) {
                        const keyMatch = onclickAttr.match(/'(.*?)'/);
                        if (keyMatch) {
                            const key = keyMatch[1];
                            sortData(key, 'productRegister');
                        }
                    }
                });
            });
        }, 100);
        lineContainer.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between cursor-pointer" onclick="toggleLineTable('${lineId}')">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-1">${line} Line</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${products.length} product${products.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="flex items-center">
                        <span class="text-sm text-gray-500 dark:text-gray-400 mr-2"></span>
                        <svg id="toggle-icon-${lineId}" class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
            </div>
            <div id="table-${lineId}" class="overflow-hidden rounded-lg border transition-all duration-300" style="border-color: var(--border-color);">
                <table class="w-full text-sm">
                    <thead class="bg-gray-200 dark:bg-gray-700">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important;">#</th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important;">Date</th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider sortable bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary);font-weight: bold !important; cursor: pointer;" onclick="sortData('productCode', 'productRegister')">Product Code <span class="sort-indicator"></span></th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider sortable bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important; cursor: pointer;" onclick="sortData('name', 'productRegister')">Product Name <span class="sort-indicator"></span></th>
                        
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important;">Train No.</th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider sortable bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary);font-weight: bold !important; cursor: pointer;" onclick="sortData('productType', 'productRegister')">Dosage Form <span class="sort-indicator"></span></th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider sortable bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important; cursor: pointer;" onclick="sortData('batchSizeKg', 'productRegister')">Batch Size <span class="sort-indicator"></span></th>
                            <th class="px-3 py-3 text-left text-xs text-center font-medium uppercase tracking-wider bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important;">Critical</th>
                            <th class="px-3 py-3 text-center text-xs text-center font-medium uppercase tracking-wider bg-gray-200 dark:bg-gray-700" style="color: var(--text-secondary); font-weight: bold !important;">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="productsTable" style="border-color: var(--border-color); background-color: var(--bg-secondary);">
                    </tbody>
                </table>
            </div>
        `;
        
        tabContainer.appendChild(lineContainer);
        
        // Get the tbody for this line's table
        const tbody = lineContainer.querySelector('.productsTable');

        // Render products for this line
        products.forEach((product, index) => {
        const productRow = document.createElement('tr');
        productRow.className = "product-main-row";
        const criticalText = product.isCritical ? 'Yes' : 'No';
        const criticalClass = product.isCritical ? 'text-red-600 font-bold' : '';
        const trainNumber = getProductTrainNumber(product);
        const trainIdDisplay = trainNumber !== 'N/A' ? 'T' + trainNumber : 'N/A';

        productRow.innerHTML = `
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top text-center" >${index + 1}</td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top text-center" >${new Date(product.date).toLocaleDateString()}</td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top text-center">${product.productCode}</td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top text-center">
                        <span class="product-name">${product.name}</span>
                    </td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top text-center" >${trainIdDisplay}</td>
                      <td class="px-3 py-3 text-sm whitespace-nowrap align-top text-center" >${product.productType || 'N/A'}</td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top text-center" >${product.batchSizeKg}</td>
                    <td class="px-3 py-3 text-sm align-top text-center">
                         <span class="${criticalClass}">${criticalText}</span>
                         ${product.isCritical && product.criticalReason ? `<p class="text-xs italic" style=" max-width: 200px; white-space: normal;">${product.criticalReason}</p>` : ''}
                    </td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top">
                        <div class="flex items-center gap-x-2 no-print">
                           <button onclick="showAssignMachinesModal(${product.id})" class="p-1" style="color: var(--text-secondary);" title="Assign Machines">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16"><path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.62 1.105l-.09.282c-.273.85-.92 1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.09-.282c-.268-1.135.925-1.824 1.62-1.105l.205.211a.96.96 0 0 0 1.622-.434L7.068.727zM12.973 8.5H8.25l-1.03-1.03a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l2.5-2.5a1 1 0 0 0-1.414-1.414L12.973 8.5z"/><path d="M.242 4.753a.626.626 0 0 1 .884 0l.058.058a.96.96 0 0 0 1.353-.14l.17-.186c.695-.761 1.888.06 1.62 1.204l-.066.261c-.273.85-.92 1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.066-.261c-.268-1.144.925-1.965 1.62-1.204l.17.186a.96.96 0 0 0 1.353.14l.058-.058a.626.626 0 0 1 0-.884zM15.758 4.753a.626.626 0 0 1 .884 0l.058.058a.96.96 0 0 0 1.353.14l.17-.186c.695.761-.925 1.965-1.62 1.204l-.066-.261c-.273-.85-.92-1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.066.261c-.268 1.144 1.888.443 1.62-1.204l.17-.186a.96.96 0 0 0 1.353-.14l.058-.058a.626.626 0 0 1 0 .884z"/></svg>
                            </button>
                             <button onclick="showEditProductModal(${product.id})" class="p-1" style="color: var(--text-secondary);" title="Edit Product"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zM12.879 4.379L11 2.5 4.939 8.561a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121L12.879 4.379z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg></button>
                            <button onclick="deleteProduct(${product.id})" class="p-1 text-red-500" title="Delete Product">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1h-11z"/></svg>
                            </button>
                        </div>
                    </td>
                `;

        const ingredientsRow = document.createElement('tr');
        ingredientsRow.className = "ingredients-sub-row";
        const ingredientsCell = document.createElement('td');
        ingredientsCell.colSpan = 10;

        let subTableHTML = `
                    <div class="p-4 ingredients-sub-table rounded-b-lg">
                        <table class="w-full text-xs">
                            <thead class="bg-transparent">
                                <tr class="border-b" style="border-color: var(--border-color); background-color: rgb(188 194 208 / 45%)">
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">Ingredient</th>
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">TD (mg)</th>
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">MDD (g/day)</th>
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">Solubility</th>
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">Cleanability</th>
                                    <th class="pde-col px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">PDE (mg/day)</th>
                                    <th class="ld50-col px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">LD50 (mg/kg)</th>
                                    <th class="px-3 py-2 text-left font-semibold uppercase tracking-wider" style="font-size: 12px !important;">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-transparent">`;

        product.activeIngredients.forEach(ing => {
            subTableHTML += `
                        <tr>
                            <td class="px-3 py-2 font-semibold">${ing.name}</td>
                            <td class="px-3 py-2" style="color: var(--text-secondary);">${ing.therapeuticDose}</td>
                            <td class="px-3 py-2" style="color: var(--text-secondary);">${ing.mdd / 1000}</td>
                            <td class="px-3 py-2" style="color: var(--text-secondary);">${ing.solubility}</td>
                            <td class="px-3 py-2" style="color: var(--text-secondary);">${ing.cleanability}</td>
                            <td class="pde-col px-3 py-2" style="color: var(--text-secondary);">${ing.pde ?? 'N/A'}</td>
                            <td class="ld50-col px-3 py-2" style="color: var(--text-secondary);">${ing.ld50 ?? 'N/A'}</td>
                            <td class="px-3 py-2">
                                <div class="flex items-center gap-x-2 no-print">
                                    <button onclick="showEditIngredientModal(${product.id}, ${ing.id})" class="p-1" style="color: var(--text-secondary);" title="Edit Ingredient"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zM12.879 4.379L11 2.5 4.939 8.561a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121L12.879 4.379z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg></button>
                                    <button onclick="deleteIngredient(${product.id}, ${ing.id})" class="p-1 text-red-500" title="Remove Ingredient"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>
                                </div>
                            </td>
                        </tr>`;
        });

        subTableHTML += `</tbody></table></div>`;
        ingredientsCell.innerHTML = subTableHTML;
        ingredientsRow.appendChild(ingredientsCell);

        tbody.appendChild(productRow);
        tbody.appendChild(ingredientsRow);
        });
    });

    updateSortIndicators(tabId);
    updateToggleIcons(tabId);
    hideLoader();
}

// Toggle function for line tables
window.toggleLineTable = function(lineId) {
    const table = document.getElementById(`table-${lineId}`);
    const icon = document.getElementById(`toggle-icon-${lineId}`);
    
    if (table && icon) {
        if (table.style.display === 'none') {
            table.style.display = 'block';
            icon.style.transform = 'rotate(0deg)';
        } else {
            table.style.display = 'none';
            icon.style.transform = 'rotate(-90deg)';
        }
    }
};

export function handleSearchAndFilter(tabId) {
    showLoader();
    const tabContainer = document.getElementById(tabId);

    if (tabId === 'worstCaseProducts') {
        const productNameFilter = document.getElementById('worstCaseProductNameFilter');
        const nameFilter = productNameFilter ? productNameFilter.value.toLowerCase() : '';
        
    
        state.viewProducts[tabId] = state.products.filter(product => {
            return product.name.toLowerCase().includes(nameFilter);
        });
        renderProducts(tabId);
        return;
    }

    // Get filter elements from the original HTML structure, not from the dynamically created tables
    const codeFilter = document.querySelector('.filterColProductCode')?.value?.toLowerCase() || '';
    const nameFilter = document.querySelector('.filterColProductName')?.value?.toLowerCase() || '';
    const lineFilter = document.querySelector('.filterColLine')?.value || 'all';
    const trainNoFilter = document.querySelector('.filterColTrainNo')?.value || 'all';
    const productTypeFilter = document.querySelector('.filterColProductType')?.value || 'all';
    const isCriticalFilter = document.querySelector('.filterColIsCritical')?.value || 'all';
    
    // Update train number options based on selected line and dosage form
    updateTrainNumberOptions(lineFilter, productTypeFilter);
    
    // Add event listeners to Line and Dosage Form filters to update Train No. options
    const lineSelect = document.querySelector('.filterColLine');
    const productTypeSelect = document.querySelector('.filterColProductType');
    
    if (lineSelect && !lineSelect.hasAttribute('data-listener-added')) {
        lineSelect.addEventListener('change', function() {
            const selectedLine = this.value;
            const selectedDosageForm = document.querySelector('.filterColProductType')?.value || 'all';
            updateTrainNumberOptions(selectedLine, selectedDosageForm);
        });
        lineSelect.setAttribute('data-listener-added', 'true');
    }
    
    if (productTypeSelect && !productTypeSelect.hasAttribute('data-listener-added')) {
        productTypeSelect.addEventListener('change', function() {
            const selectedDosageForm = this.value;
            const selectedLine = document.querySelector('.filterColLine')?.value || 'all';
            updateTrainNumberOptions(selectedLine, selectedDosageForm);
        });
        productTypeSelect.setAttribute('data-listener-added', 'true');
    }

    
    state.viewProducts[tabId] = state.products.filter(product => {
        const productCodeMatch = product.productCode.toLowerCase().includes(codeFilter);
        const productNameMatch = product.name.toLowerCase().includes(nameFilter);

        const trainNumber = getProductTrainNumber(product);
        const trainIdDisplay = trainNumber !== 'N/A' ? 'T' + trainNumber : 'N/A';
        const trainNoMatch = (trainNoFilter === 'all') || (trainIdDisplay === trainNoFilter);
        
        const lineMatch = (lineFilter === 'all') || (product.line === lineFilter);
        const productTypeMatch = (productTypeFilter === 'all') || (product.productType === productTypeFilter);

        const isCriticalMatch = (isCriticalFilter === 'all') || (String(product.isCritical) === isCriticalFilter);

        return productCodeMatch && productNameMatch && trainNoMatch && lineMatch && productTypeMatch && isCriticalMatch;
    });
     
    renderProducts(tabId);
}

// Function to update train number options based on selected line and dosage form
export function updateTrainNumberOptions(selectedLine, selectedDosageForm) {
    const trainNoSelect = document.querySelector('.filterColTrainNo');
    if (!trainNoSelect) return;
    
    // Get all products that match the selected line and dosage form
    let filteredProducts = state.products;
    
    if (selectedLine !== 'all') {
        filteredProducts = filteredProducts.filter(product => product.line === selectedLine);
    }
    
    if (selectedDosageForm !== 'all') {
        filteredProducts = filteredProducts.filter(product => product.productType === selectedDosageForm);
    }
    
    // Get unique train numbers from filtered products
    const trainNumbers = new Set();
    filteredProducts.forEach(product => {
        const trainNumber = getProductTrainNumber(product);
        if (trainNumber !== 'N/A') {
            trainNumbers.add('T' + trainNumber);
        }
    });
    
    // Convert to array and sort
    const sortedTrainNumbers = Array.from(trainNumbers).sort((a, b) => {
        const numA = parseInt(a.replace('T', ''));
        const numB = parseInt(b.replace('T', ''));
        return numA - numB;
    });
    
    // Update the select options
    const currentValue = trainNoSelect.value;
    trainNoSelect.innerHTML = '<option value="all">All</option>';
    
    sortedTrainNumbers.forEach(trainNo => {
        const option = document.createElement('option');
        option.value = trainNo;
        option.textContent = trainNo;
        trainNoSelect.appendChild(option);
    });
    
    // Restore the selected value if it's still valid
    if (sortedTrainNumbers.includes(currentValue)) {
        trainNoSelect.value = currentValue;
    } else {
        trainNoSelect.value = 'all';
    }
}

export function sortData(key, tabId) {
    if (state.sortState.key === key) {
        state.sortState.direction = state.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortState.key = key;
        state.sortState.direction = (key === 'rpn') ? 'desc' : 'asc';
    }

    // You don't need to call setSortState if you're modifying the object directly
    // state.setSortState(state.sortState); 
    
    if (tabId === 'worstCaseProducts') {
        renderWorstCaseByTrain();
    } else if (tabId === 'productRegister') {
        // For product register, re-render all line tables with sorting
        renderProducts(tabId);
        updateSortIndicators(tabId);
    } else {
        renderProducts(tabId);
        updateSortIndicators(tabId);
    }
}


export function updateSortIndicators(tabId) {
    const tabContainer = document.getElementById(tabId);
    if (!tabContainer || tabId === 'worstCaseProducts') return; 
    
    // Update indicators for both main table and line tables
    const allTables = tabContainer.querySelectorAll('table');
    allTables.forEach(table => {
        table.querySelectorAll('th.sortable').forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) {
                const onclickAttr = th.getAttribute('onclick');
                if (onclickAttr) {
                    const keyMatch = onclickAttr.match(/'(.*?)'/);
                    if (keyMatch) {
                        const key = keyMatch[1];
                        if (key === state.sortState.key) {
                            indicator.textContent = state.sortState.direction === 'asc' ? '▲' : '▼';
                        } else {
                            indicator.textContent = '';
                        }
                    }
                }
            }
        });
    });
}

export function showAddForm() {
    const form = document.getElementById('addProductForm');
    form.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div><label class="block text-sm font-medium mb-1">Product Code</label><input type="text" id="addProductCode" class="w-full px-3 py-2 border rounded-lg no-proper-case" required placeholder="e.g. 1ABC12345DE"></div>
                                  <div><label class="block text-sm font-medium mb-1">Product Name</label><input type="text" id="addProductName" class="w-full px-3 py-2 border rounded-lg" required></div>
                                  <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="addProductDate" class="w-full px-3 py-2 border rounded-lg" required></div>
                              </div>
                             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div><label class="block text-sm font-medium mb-1">Batch Size (Kg)</label><input type="number" step="0.01" id="addBatchSize" class="w-full px-3 py-2 border rounded-lg" min="0" required></div>
                                
                                  <div>
                                    <label class="block text-sm font-medium mb-1">Line</label>
                                                                        <select id="addProductLine" class="w-full px-3 py-2 border rounded-lg" required onchange="document.getElementById('addOtherLineContainer').style.display = this.value === 'Other' ? 'block' : 'none'; document.getElementById('addOtherLine').required = this.value === 'Other'; updateDosageFormOptions('add')">
                                        <option value="" disabled selected>Select a line...</option>
                                        <option value="Solids">Solids</option>
                                        <option value="Semisolid">Semisolid</option>
                                        <option value="Liquids">Liquids</option>
                                        <option value="Other">Other</option>
                                    </select>
                                                                        <div id="addOtherLineContainer" style="display:none;margin-top:6px;">
                                                                                <label class="block text-sm font-medium mb-1">Specify Other Line</label>
                                                                                <input type="text" id="addOtherLine" class="w-full px-3 py-2 border rounded-lg no-proper-case" />
                                                                        </div>
                                                                        </div>
                                  <div>
                                      <div class="">
                                        <div>
                                            <label class="block text-sm font-medium mb-1">Dosage Form</label>
                                            <select id="addProductType" class="w-full px-3 py-2 border rounded-lg" required onchange="document.getElementById('addOtherTypeContainer').style.display = this.value === 'Other' ? 'block' : 'none'; document.getElementById('addOtherProductType').required = this.value === 'Other';">
                                            <option value="" disabled selected>Select a form...</option>
                                            </select>
                                        </div>
                                        <div id="addOtherTypeContainer" style="display: none;">
                                            <label class="block text-sm font-medium mb-1">Specify Other Form</label>
                                            <input type="text" id="addOtherProductType" class="w-full px-3 py-2 border rounded-lg no-proper-case">
                                        </div>
                                      </div>
                                  </div>
                                  <div>
                    <label class="block text-sm font-medium mb-1">Special Case Product</label>
                    <select id="editIsCritical" onchange="document.getElementById('editCriticalReasonContainer2').style.display = this.value === 'true' ? 'block' : 'none';" class="w-full px-3 py-2 border rounded-lg">
                        <option value="false" 'selected' >No</option>
                        <option value="true">Yes</option>
                    </select>
                </div>
                <div id="editCriticalReasonContainer2" style="display: none">
                    <label class="block text-sm font-medium mb-1">Reason for Special Case Status</label>
                    <textarea id="editCriticalReason" class="w-full px-3 py-2 border rounded-lg" placeholder="Enter reason..."></textarea>
                </div>
                              </div>
                              <div><div class="flex justify-between items-center mb-4"><h4 class="text-lg font-medium">Active Ingredients</h4><button type="button" onclick="addIngredientFormFields('ingredientsContainer')" class="text-white px-3 py-1 rounded-lg text-sm btn-gradient">+ Add Ingredient</button></div><div id="ingredientsContainer"></div></div>`;
    document.getElementById('ingredientsContainer').innerHTML = '';
    state.setIngredientFormCounter(0);
    addIngredientFormFields('ingredientsContainer');
    document.getElementById('addProductDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('addProductModal').style.display = 'flex';
    
    // Initialize proper case for dynamically created inputs
    import('./utils.js').then(utils => {
        utils.initializeProperCaseInputs();
    }).catch(error => console.error('Error initializing proper case:', error));
}

export function addIngredientFormFields(containerId, ingredient = null) {
const isEdit = !!ingredient;
    state.setIngredientFormCounter(state.ingredientFormCounter + 1);
    
    const container = document.getElementById(containerId); 
    const ingredientDiv = document.createElement('div');
    ingredientDiv.className = 'border rounded-lg p-4 mb-4 relative ingredient-edit-row';
    ingredientDiv.style.borderColor = 'var(--border-color)';
    
    // THE FIX IS HERE: Change the onclick handler
    const removeButton = (isEdit || container.id === 'editIngredientsContainer' || container.children.length > 0) 
        ? `<button type="button" onclick="this.closest('.ingredient-edit-row').remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1" title="Remove Ingredient"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg></button>`
        : '';

    ingredientDiv.innerHTML = `
        ${removeButton}
        <input type="hidden" name="ingredientId" value="${ingredient?.id || ''}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="md:col-span-2"><label class="block text-xs font-medium mb-1">Ingredient Name</label><input type="text" name="ingredientName" value="${ingredient?.name || ''}" class="w-full px-3 py-2 border rounded-lg text-sm" required></div>
            <div><label class="block text-xs font-medium mb-1">TD (mg)</label><input type="number" step="any" name="therapeuticDose" value="${ingredient?.therapeuticDose || ''}" class="w-full px-3 py-2 border rounded-lg text-sm" min="0" required></div>
            <div><label class="block text-xs font-medium mb-1">MDD (g/day)</label><input type="number" step="any" name="mdd" value="${ingredient ? ingredient.mdd / 1000 : ''}" class="w-full px-3 py-2 border rounded-lg text-sm" min="0" required></div>
            <div><label class="block text-xs font-medium mb-1">Solubility</label><select name="solubility" class="w-full px-3 py-2 border rounded-lg text-sm"></select></div>
            <div><label class="block text-xs font-medium mb-1">Cleanability</label><select name="cleanability" class="w-full px-3 py-2 border rounded-lg text-sm" required></select></div>
            <div><label class="block text-xs font-medium mb-1">PDE (mg/day)</label><input type="number" step="any" name="pde" value="${ingredient?.pde ?? ''}" class="w-full px-3 py-2 border rounded-lg text-sm" min="0" placeholder="Optional"></div>
            <div><label class="block text-xs font-medium mb-1">LD50 (mg/kg)</label><input type="number" step="any" name="ld50" value="${ingredient?.ld50 ?? ''}" class="w-full px-3 py-2 border rounded-lg text-sm" min="0" placeholder="Optional"></div>
        </div>`; 
    container.appendChild(ingredientDiv); 
    populateDynamicSelectsForElement(ingredientDiv); 
    if (ingredient) {
        ingredientDiv.querySelector('select[name="solubility"]').value = ingredient.solubility;
        ingredientDiv.querySelector('select[name="cleanability"]').value = ingredient.cleanability;
    }
    
    // Populate the product line dropdowns with all available lines
    populateProductLineDropdowns();
    
    // Initialize proper case for dynamically created inputs
    import('./utils.js').then(utils => {
        utils.initializeProperCaseInputs();
    }).catch(error => console.error('Error initializing proper case:', error));
}

export function populateDynamicSelectsForElement(element) {
    populateSelectWithOptions(element.querySelector('select[name="solubility"], #editSolubility'), 'solubility');
    populateSelectWithOptions(element.querySelector('select[name="cleanability"], #editCleanability'), 'cleanability');
}

export function showEditProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const form = document.getElementById('editProductForm');
    const dateValue = product.date ? new Date(product.date).toISOString().split('T')[0] : '';
    form.innerHTML = `
                <input type="hidden" id="editProductId" value="${product.id}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label class="block text-sm font-medium mb-1">Product Code</label><input type="text" id="editProductCode" value="${product.productCode}" class="w-full px-3 py-2 border rounded-lg no-proper-case" required></div>
                    <div><label class="block text-sm font-medium mb-1">Product Name</label><input type="text" id="editProductName" value="${product.name}" class="w-full px-3 py-2 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="editProductDate" value="${dateValue}" class="w-full px-3 py-2 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium mb-1">Batch Size (Kg)</label><input type="number" step="0.01" id="editBatchSize" value="${product.batchSizeKg}" class="w-full px-3 py-2 border rounded-lg" min="0" required></div>
  
                    </div>
    
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                    <label class="block text-sm font-medium mb-1">Line</label>
                    <select id="editProductLine" class="w-full px-3 py-2 border rounded-lg" required onchange="document.getElementById('editOtherLineContainer').style.display = this.value === 'Other' ? 'block' : 'none'; document.getElementById('editOtherLine').required = this.value === 'Other'; updateDosageFormOptions('edit')">
                        <option value="" disabled selected>Select a line...</option>
                        <option value="Solids">Solids</option>
                        <option value="Semisolid">Semisolid</option>
                        <option value="Liquids">Liquids</option>
                        <option value="Other">Other</option>
                    </select>
                    <div id="editOtherLineContainer" style="display:none;margin-top:6px;">
                        <label class="block text-sm font-medium mb-1">Specify Other Line</label>
                        <input type="text" id="editOtherLine" class="w-full px-3 py-2 border rounded-lg no-proper-case">
                    </div>
                    </div>
                    <div>
                        <label>Dosage Form</label>
                        <select id="editProductType" class="w-full px-3 py-2 border rounded-lg" required onchange="document.getElementById('editOtherTypeContainer').style.display = this.value === 'Other' ? 'block' : 'none'; document.getElementById('editOtherProductType').required = this.value === 'Other';">
                        <option value="" disabled selected>Select a form...</option>
                        </select>
                    </div>
                    <div id="editOtherTypeContainer" style="display: none;">
                        <label class="block text-sm font-medium mb-1">Specify Other Form</label>
                        <input type="text" id="editOtherProductType" class="w-full px-3 py-2 border rounded-lg no-proper-case">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Special Case Product</label>
                    <select id="editIsCritical" onchange="document.getElementById('editCriticalReasonContainer').style.display = this.value === 'true' ? 'block' : 'none';" class="w-full px-3 py-2 border rounded-lg">
                        <option value="false" ${!product.isCritical ? 'selected' : ''}>No</option>
                        <option value="true" ${product.isCritical ? 'selected' : ''}>Yes</option>
                    </select>
                </div>
                <div id="editCriticalReasonContainer" style="display: ${product.isCritical ? 'block' : 'none'};">
                    <label class="block text-sm font-medium mb-1">Reason for Special Case Status</label>
                    <textarea id="editCriticalReason" class="w-full px-3 py-2 border rounded-lg" placeholder="Enter reason...">${product.criticalReason || ''}</textarea>
                </div>
                <div class="border-t pt-4 mt-4" style="border-color:var(--border-color);">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-medium">Add New Ingredients</h4>
                        <button type="button" onclick="addIngredientFormFields('editIngredientsContainer')" class="text-white px-3 py-1 rounded-lg text-sm btn-gradient">+ Add Ingredient</button>
                    </div>
                    <div id="editIngredientsContainer" class="space-y-4"></div>
                </div>
            `;

    // Clear ingredients container so only new ones can be added
    const ingredientsContainer = form.querySelector('#editIngredientsContainer');
    ingredientsContainer.innerHTML = '';

    // Pre-populate product line and then product type/dosage form
    const lineSelect = form.querySelector('#editProductLine');
    const typeSelect = form.querySelector('#editProductType');
    const otherInput = form.querySelector('#editOtherProductType');
    const otherContainer = form.querySelector('#editOtherTypeContainer');

    // If the product has a saved line, use it. Otherwise try to infer the line
    // from the saved productType (this helps older records that lack 'line').
    if (!product.line && product.productType) {
        const solids = ['Tablets', 'Capsules', 'Powder'];
        const semisolids = ['Ointment', 'Cream', 'Gel'];
        const liquids = ['Syrup', 'Solution', 'Suspension'];
        if (solids.includes(product.productType)) product.line = 'Solids';
        else if (semisolids.includes(product.productType)) product.line = 'Semisolid';
        else if (liquids.includes(product.productType)) product.line = 'Liquids';
        else product.line = '';
    }

    // Line selection will be handled after populateProductLineDropdowns() is called

    // Populate dosage form options for the currently selected line
    try { updateDosageFormOptions('edit'); } catch (e) { /* ignore if not available */ }

    // Now set the dosage form value (or 'Other' handling) after options are populated
    const standardTypes = Array.from(typeSelect.options).map(opt => opt.value).filter(Boolean);
    if (product.productType && standardTypes.includes(product.productType)) {
        typeSelect.value = product.productType;
        otherContainer.style.display = 'none';
        otherInput.required = false;
    } else if (product.productType) {
        // saved productType isn't in standard list, treat as Other
        if (!standardTypes.includes('Other')) {
            typeSelect.innerHTML += '<option value="Other">Other</option>';
        }
        typeSelect.value = 'Other';
        otherInput.value = product.productType || '';
        otherContainer.style.display = 'block';
        otherInput.required = true;
    } else {
        // No saved productType, ensure Other is hidden
        otherContainer.style.display = 'none';
        otherInput.required = false;
    }

    document.getElementById('editProductModalTitle').textContent = `Edit Product: ${product.name}`;
    document.getElementById('editProductModal').style.display = 'flex';

    // Populate the product line dropdowns with all available lines
    populateProductLineDropdowns();
    
    // Now handle line selection for edit modal
    if (product.line) {
        const lineSelect = form.querySelector('#editProductLine');
        if (lineSelect) {
            const availableLines = Array.from(lineSelect.options).map(o => o.value).filter(Boolean);
            if (availableLines.includes(product.line)) {
                lineSelect.value = product.line;
                // Hide the "Other" line field since we found the line in the dropdown
                const editOtherLineContainer = form.querySelector('#editOtherLineContainer');
                if (editOtherLineContainer) {
                    editOtherLineContainer.style.display = 'none';
                }
            } else {
                lineSelect.value = 'Other';
                const editOtherLine = form.querySelector('#editOtherLine');
                if (editOtherLine) {
                    editOtherLine.value = product.line;
                    form.querySelector('#editOtherLineContainer').style.display = 'block';
                    editOtherLine.required = true;
                }
            }
        }
    }
    
    // Initialize proper case for dynamically created inputs
    import('./utils.js').then(utils => {
        utils.initializeProperCaseInputs();
    }).catch(error => console.error('Error initializing proper case:', error));
}

export function saveProductChanges(event) {
    event.preventDefault();
    const productId = parseInt(document.getElementById('editProductId').value);
    const product = state.products.find(p => p.id === productId);
    if (!product) { showCustomAlert("Error", "Could not find product to update."); return; }

    // Update product-level details
    let productType = document.getElementById('editProductType').value;
    if (productType === 'Other') {
        const otherType = document.getElementById('editOtherProductType').value.trim();
        if (!otherType) {
            showCustomAlert("Validation Error", "Please specify the 'Other' dosage form.");
            return;
        }
        productType = otherType;
    }

    // Save edited line (handle 'Other' custom value)
    let editedLine = document.getElementById('editProductLine').value;
    if (editedLine === 'Other') {
        editedLine = document.getElementById('editOtherLine').value.trim();
        if (!editedLine) { showCustomAlert('Validation Error', 'Please specify the Other Line.'); return; }
    }
    product.line = editedLine;

    product.productCode = document.getElementById('editProductCode').value;
    product.name = document.getElementById('editProductName').value;
    product.date = new Date(document.getElementById('editProductDate').value).toISOString();
    product.batchSizeKg = parseFloat(document.getElementById('editBatchSize').value);
    product.productType = productType;
    product.isCritical = document.getElementById('editIsCritical').value === 'true';
    product.criticalReason = product.isCritical ? document.getElementById('editCriticalReason').value : '';

    // Check for duplicate product code (excluding the current product)
    const existingProduct = state.products.find(p => 
        p.id !== productId && p.productCode.toLowerCase() === product.productCode.toLowerCase()
    );
    if (existingProduct) {
        showCustomAlert("Validation Error", `Product code "${product.productCode}" already exists. Please use a unique product code.`);
        return;
    }

    // Process and append newly added ingredients
    const newlyAddedIngredients = [];
    const ingredientRows = document.querySelectorAll('#editIngredientsContainer .ingredient-edit-row');
    let allValid = true;

    ingredientRows.forEach(row => {
        if (!allValid) return;
        const ing = { id: state.nextIngredientId };

        ing.name = row.querySelector('[name="ingredientName"]').value.trim();
        ing.therapeuticDose = parseFloat(row.querySelector('[name="therapeuticDose"]').value);
        ing.mdd = parseFloat(row.querySelector('[name="mdd"]').value) * 1000; // Convert g to mg for storage 
        ing.solubility = row.querySelector('[name="solubility"]').value;
        ing.cleanability = row.querySelector('[name="cleanability"]').value;
        const pdeVal = row.querySelector('[name="pde"]').value;
        const ld50Val = row.querySelector('[name="ld50"]').value;
        ing.pde = pdeVal ? parseFloat(pdeVal) : null;
        ing.ld50 = ld50Val ? parseFloat(ld50Val) : null;

        if (!ing.name || isNaN(ing.therapeuticDose) || isNaN(ing.mdd) || !ing.solubility || !ing.cleanability || (ing.pde === null && ing.ld50 === null)) {
            allValid = false;
        } else {
            newlyAddedIngredients.push(ing);
            state.setNextDetergentIngredientId(state.nextIngredientId+1);
        }
    });

    if (!allValid) {
        showCustomAlert("Validation Error", "Please fill all required fields for each newly added ingredient.");
        // Decrement counter for failed adds
        nextIngredientId -= newlyAddedIngredients.length;
        return;
    }

    // Append new ingredients to the existing list
    product.activeIngredients.push(...newlyAddedIngredients);

    saveStateForUndo();
    fullAppRender();
    hideModal('editProductModal');
    showCustomAlert('Success', 'Product updated successfully.');

}

export function showEditIngredientModal(productId, ingredientId) {
    const product = state.products.find(p => p.id === productId);
    const ingredient = product?.activeIngredients.find(i => i.id === ingredientId);
    if (!ingredient) { showCustomAlert("Error", "Could not find ingredient to edit."); return; }
    const form = document.getElementById('editIngredientForm');
    form.innerHTML = `<input type="hidden" id="editIngredientProductId" value="${productId}"><input type="hidden" id="editIngredientId" value="${ingredientId}"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="md:col-span-2"><label class="block text-sm font-medium mb-1">Ingredient Name</label><input type="text" id="editIngredientName" class="w-full px-3 py-2 border rounded-lg" required></div><div><label class="block text-sm font-medium mb-1">TD (mg)</label><input type="number" step="any" id="editTherapeuticDose" class="w-full px-3 py-2 border rounded-lg" min="0" required></div><div><label class="block text-sm font-medium mb-1">MDD (g/day)</label><input type="number" step="any" id="editMdd" class="w-full px-3 py-2 border rounded-lg" min="0" required></div><div><label class="block text-sm font-medium mb-1">Solubility</label><select id="editSolubility" class="w-full px-3 py-2 border rounded-lg"></select></div><div><label class="block text-sm font-medium mb-1">Cleanability</label><select id="editCleanability" class="w-full px-3 py-2 border rounded-lg" required></select></div><div><label class="block text-sm font-medium mb-1">PDE (mg/day)</label><input type="number" step="any" id="editPde" class="w-full px-3 py-2 border rounded-lg" min="0" placeholder="Optional"></div><div><label class="block text-sm font-medium mb-1">LD50 (mg/kg)</label><input type="number" step="any" id="editLd50" class="w-full px-3 py-2 border rounded-lg" min="0" placeholder="Optional"></div></div>`;
    document.getElementById('editIngredientModalTitle').textContent = `Edit: ${ingredient.name}`;
    document.getElementById('editIngredientName').value = ingredient.name;
    document.getElementById('editTherapeuticDose').value = ingredient.therapeuticDose;
    document.getElementById('editMdd').value = ingredient.mdd / 1000;
    document.getElementById('editPde').value = ingredient.pde ?? '';
    document.getElementById('editLd50').value = ingredient.ld50 ?? '';
    populateDynamicSelectsForElement(form);
    document.getElementById('editSolubility').value = ingredient.solubility;
    document.getElementById('editCleanability').value = ingredient.cleanability;
    document.getElementById('editIngredientModal').style.display = 'flex';
}


export function saveIngredientChanges(event) {
    event.preventDefault();
    const productId = parseInt(document.getElementById('editIngredientProductId').value);
    const ingredientId = parseInt(document.getElementById('editIngredientId').value);
    const product = state.products.find(p => p.id === productId);
    const ingredient = product?.activeIngredients.find(i => i.id === ingredientId);
    if (!ingredient) { showCustomAlert("Error", "Save failed. Could not find original ingredient."); return; }
    const pdeVal = document.getElementById('editPde').value; const ld50Val = document.getElementById('editLd50').value;
    ingredient.name = document.getElementById('editIngredientName').value.trim();
    ingredient.therapeuticDose = parseFloat(document.getElementById('editTherapeuticDose').value);
    ingredient.mdd = parseFloat(document.getElementById('editMdd').value) * 1000;
    ingredient.solubility = document.getElementById('editSolubility').value;
    ingredient.cleanability = document.getElementById('editCleanability').value;
    ingredient.pde = pdeVal ? parseFloat(pdeVal) : null;
    ingredient.ld50 = ld50Val ? parseFloat(ld50Val) : null;
    if (!ingredient.name || isNaN(ingredient.therapeuticDose) || isNaN(ingredient.mdd) || !ingredient.solubility || !ingredient.cleanability || (ingredient.pde === null && ingredient.ld50 === null)) { showCustomAlert("Validation Error", "Please fill all required fields."); return; }
    saveStateForUndo();
    hideModal('editIngredientModal');
    fullAppRender();
    showCustomAlert("Success", `${ingredient.name} was updated successfully.`);

}

export function deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this entire product?")) {
        const newProducts = state.products.filter(product => product.id !== productId);
        state.setProducts(newProducts);
        saveStateForUndo();
        fullAppRender();
    }
}

export function deleteIngredient(productId, ingredientId) {
    const product = state.products.find(p => p.id === productId);

    if (product) {
        if (product.activeIngredients.length === 1) {
            showCustomAlert('Cannot Remove', 'A product must have at least one ingredient. To remove this, please delete the entire product.');
            return;
        }
        if (confirm("Are you sure you want to remove this ingredient?")) {
            product.activeIngredients = product.activeIngredients.filter(ing => ing.id !== ingredientId);
            saveStateForUndo();
            fullAppRender();
        }
    }
}

export function populateFilterSelects() {
    const productTypeOptions = [...new Set(state.products.map(p => p.productType))].sort();
    populateSelectWithOptions(document.querySelector('.filterColProductType'), null, true, productTypeOptions);

    // Line Filter - FORCE UPDATE with all available lines
    const lineFilterSelect = document.querySelector('.filterColLine');
    if (lineFilterSelect) {
        // Get ALL possible lines from both sources
        const allProductLines = state.products.map(p => p.line).filter(Boolean);
        const allMachineLines = state.machines.map(m => m.line).filter(Boolean);
        const allLines = [...new Set([...allProductLines, ...allMachineLines, 'Solids', 'Semisolid', 'Liquids'])].sort();
        
        // FORCE clear and rebuild
        lineFilterSelect.innerHTML = '<option value="all">All</option>';
        
        allLines.forEach(line => {
            if (line && line !== 'Shared') {
                lineFilterSelect.innerHTML += `<option value="${line}">${line}</option>`;
            }
        });
        
        lineFilterSelect.innerHTML += '<option value="Other">Other</option>';
    }

    // Train No. Filter - Initialize with all train numbers
    const trainNoSelect = document.querySelector('.filterColTrainNo');
    if (trainNoSelect) {
        const trainIds = [...new Set(state.products.map(p => getProductTrainNumber(p))
            .filter(id => id !== 'N/A'))]
            .sort((a, b) => a - b);
        trainNoSelect.innerHTML = '<option value="all">All</option>';
        trainIds.forEach(id => {
            trainNoSelect.innerHTML += `<option value="T${id}">T${id}</option>`;
        });
    }
    
    // Initialize train number options based on current filter values
    const currentLine = document.querySelector('.filterColLine')?.value || 'all';
    const currentDosageForm = document.querySelector('.filterColProductType')?.value || 'all';
    updateTrainNumberOptions(currentLine, currentDosageForm);
}

// Populate product line dropdowns in add/edit modals
export function populateProductLineDropdowns() {
    // Use EXACT same logic as machine line dropdown
    const productLines = getUniqueProductLines(state.products);
    const machineLines = [...new Set(state.machines.map(m => m.line).filter(Boolean))];
    
    // Combine and deduplicate lines (same as machine dropdown)
    const allLines = [...new Set([...productLines, ...machineLines])].sort();
    
    console.log('=== PRODUCT LINE DROPDOWN DEBUG ===');
    console.log('Product lines:', productLines);
    console.log('Machine lines:', machineLines);
    console.log('All lines:', allLines);
    
    // Update add product line dropdown
    const addLineSelect = document.getElementById('addProductLine');
    if (addLineSelect) {
        const currentValue = addLineSelect.value;
        addLineSelect.innerHTML = '<option value="" disabled selected>Select a Line</option>';
        
        // Add all lines except Shared
        allLines.forEach(line => {
            if (line !== 'Shared') { // Don't add Shared to product line dropdown
                addLineSelect.innerHTML += `<option value="${line}">${line}</option>`;
            }
        });
        
        // Add Other option
        addLineSelect.innerHTML += '<option value="Other">Other</option>';
        
        // Restore selection if still valid
        if (currentValue && Array.from(addLineSelect.options).some(opt => opt.value === currentValue)) {
            addLineSelect.value = currentValue;
        }
    }
    
    // Update edit product line dropdown
    const editLineSelect = document.getElementById('editProductLine');
    if (editLineSelect) {
        const currentValue = editLineSelect.value;
        editLineSelect.innerHTML = '<option value="" disabled selected>Select a Line</option>';
        
        // Add all lines except Shared
        allLines.forEach(line => {
            if (line !== 'Shared') { // Don't add Shared to product line dropdown
                editLineSelect.innerHTML += `<option value="${line}">${line}</option>`;
            }
        });
        
        // Add Other option
        editLineSelect.innerHTML += '<option value="Other">Other</option>';
        
        // Restore selection if still valid
        if (currentValue && Array.from(editLineSelect.options).some(opt => opt.value === currentValue)) {
            editLineSelect.value = currentValue;
        }
    }
}

export function resetFilters(tabId) {
    const tabContainer = document.getElementById(tabId);
    tabContainer.querySelectorAll('.filter-row input[type="text"], .filter-row input[type="number"]').forEach(input => input.value = '');
    tabContainer.querySelectorAll('.filter-row select').forEach(select => select.value = 'all');
    
    // THE FIX IS HERE:
    state.sortState.key = 'rpn';
    state.sortState.direction = 'desc';

    handleSearchAndFilter(tabId); 
}

export function addNewProduct(event) {
    event.preventDefault(); 
    const productCode = document.getElementById('addProductCode').value.trim(); 
    const productName = document.getElementById('addProductName').value.trim(); 
    const batchSize = parseFloat(document.getElementById('addBatchSize').value); 
    const date = new Date(document.getElementById('addProductDate').value).toISOString(); 
    
    let productType = document.getElementById('addProductType').value;
    let productLine = document.getElementById('addProductLine').value;
    if (productLine === 'Other') {
        const otherLineVal = document.getElementById('addOtherLine').value.trim();
        if (!otherLineVal) { showCustomAlert('Validation Error', 'Please specify the Other Line.'); return; }
        productLine = otherLineVal;
    }
    if (productType === 'Other') {
        const otherType = document.getElementById('addOtherProductType').value.trim();
        if (!otherType) {
            showCustomAlert("Validation Error", "Please specify the 'Other' dosage form or choose a different option.");
            return;
        }
        productType = otherType;
    }
    
    if (!productCode || !productName || !date || isNaN(batchSize) || batchSize <= 0 || !productType) { 
        showCustomAlert("Validation Error", "Please fill all required product fields, including Dosage Form."); return; 
    }
    
    // Check for duplicate product code
    const existingProduct = state.products.find(p => p.productCode.toLowerCase() === productCode.toLowerCase());
    if (existingProduct) {
        showCustomAlert("Validation Error", `Product code "${productCode}" already exists. Please use a unique product code.`);
        return;
    } 
    
    const ingredientDivs = document.querySelectorAll('#ingredientsContainer > div'); 
    const activeIngredients = []; let allValid = true; 
    ingredientDivs.forEach((div) => { 
        if (!allValid) return; 
        const ing = { id: state.nextIngredientId }; 
        state.setNextIngredientId(state.nextIngredientId + 1);
        ing.name = div.querySelector('[name="ingredientName"]').value.trim(); 
        ing.therapeuticDose = parseFloat(div.querySelector('[name="therapeuticDose"]').value); 
        ing.mdd = parseFloat(div.querySelector('[name="mdd"]').value) * 1000;
        ing.solubility = div.querySelector('[name="solubility"]').value; 
        ing.cleanability = div.querySelector('[name="cleanability"]').value; 
        const pdeVal = div.querySelector('[name="pde"]').value; 
        const ld50Val = div.querySelector('[name="ld50"]').value; 
        ing.pde = pdeVal ? parseFloat(pdeVal) : null; 
        ing.ld50 = ld50Val ? parseFloat(ld50Val) : null; 
        if (!ing.name || isNaN(ing.therapeuticDose) || isNaN(ing.mdd) || !ing.solubility || !ing.cleanability || (ing.pde === null && ing.ld50 === null)) { allValid = false; } else { activeIngredients.push(ing); } 
    }); 
    if (!allValid) { 
        showCustomAlert("Validation Error", "Please fill all required fields for each ingredient."); 
        state.setNextIngredientId(state.nextIngredientId - activeIngredients.length); // Roll back ID increments
        return; 
    } 
    const newProduct = { id: state.nextProductId, productCode: productCode, name: productName, batchSizeKg: batchSize, date: date, productType: productType, line: productLine, machineIds: [], activeIngredients: activeIngredients, isCritical: false, criticalReason: '' };
    state.setNextProductId(state.nextProductId + 1);
    
    const newProducts = [...state.products, newProduct];
    state.setProducts(newProducts);
    saveStateForUndo(); 
    fullAppRender(); 
    hideModal('addProductModal'); 
}
window.updateDosageFormOptions = function(mode) {
    let line = document.getElementById(mode === 'add' ? 'addProductLine' : 'editProductLine').value;
    // If the selected value is a custom line (not one of the standard values),
    // treat it as 'Other' for dosage form population.
    const standardLines = ['Solids','Semisolid','Liquids','Other','Others'];
    if (!standardLines.includes(line)) {
        // show the Other Line input and set the select to 'Other'
        try {
            if (mode === 'add') {
                document.getElementById('addOtherLineContainer').style.display = 'block';
                document.getElementById('addOtherLine').value = line;
                document.getElementById('addProductLine').value = 'Other';
            } else {
                document.getElementById('editOtherLineContainer').style.display = 'block';
                document.getElementById('editOtherLine').value = line;
                document.getElementById('editProductLine').value = 'Other';
            }
            line = 'Other';
        } catch (e) { /* ignore DOM errors */ }
    }
  const formSelect = document.getElementById(mode === 'add' ? 'addProductType' : 'editProductType');
  let options = [];
  if (line === 'Solids') {
    options = ['Tablets', 'Capsules', 'Powder', 'Other'];
  } else if (line === 'Semisolid') {
    options = ['Ointment', 'Cream', 'Gel', 'Other'];
  } else if (line === 'Liquids') {
    options = ['Syrup', 'Solution', 'Suspension', 'Other'];
    } else if (line === 'Other') {
        options = ['Other'];
  }
  formSelect.innerHTML = '<option value=\"\" disabled selected>Select a form...</option>' +
    options.map(opt => `<option value=\"${opt}\">${opt}</option>`).join('');
};
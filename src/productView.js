// Renders the main product tables and handles CRUD operations
// js/productView.js

import * as state from './state.js';
import { fullAppRender } from './app.js';
import { showLoader, hideLoader, showCustomAlert, hideModal, saveStateForUndo, updateToggleIcons } from './ui.js';
import { getProductTrainId, calculateScores, populateSelectWithOptions } from './utils.js';
import { renderWorstCaseByTrain } from './worstCaseView.js';

export function renderProducts(tabId) {
    if (tabId === 'worstCaseProducts') {
        renderWorstCaseByTrain();
        return;
    }

    const tabContainer = document.getElementById(tabId);
    if (!tabContainer) return;
    const tbody = tabContainer.querySelector('.productsTable');
    const noResultsMessage = tabContainer.querySelector('.noResultsMessage');

let dataToRender = [...state.viewProducts[tabId]];

    dataToRender.sort((a, b) => {
        let valA, valB;
        const key = state.sortState.key;
        switch (key) {
            case 'productCode': valA = a.productCode; valB = b.productCode; break;
            case 'name': valA = a.name; valB = b.name; break;
            case 'batchSizeKg': valA = a.batchSizeKg; valB = b.batchSizeKg; break;
            case 'date': valA = new Date(a.date); valB = new Date(b.date); break;
            default: return 0;
        }

        const dir = state.sortState.direction === 'asc' ? 1 : -1;

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    tbody.innerHTML = '';
    noResultsMessage.style.display = dataToRender.length > 0 ? 'none' : 'block';
    tbody.style.display = dataToRender.length > 0 ? '' : 'none';

    dataToRender.forEach((product, index) => {
        const productRow = document.createElement('tr');
        productRow.className = "product-main-row";
        const criticalText = product.isCritical ? 'Yes' : 'No';
        const criticalClass = product.isCritical ? 'text-red-600 font-bold' : '';
        const trainId = getProductTrainId(product);
        const trainIdDisplay = trainId !== 'N/A' ? 'T' + trainId : 'N/A';

        productRow.innerHTML = `
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top" style="color: var(--text-secondary);">${index + 1}</td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top" style="color: var(--text-secondary);">${new Date(product.date).toLocaleDateString()}</td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top">${product.productCode}</td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top">
                        <span class="product-name">${product.name}</span>
                    </td>
                    <td class="px-3 py-3 text-sm font-medium whitespace-nowrap align-top text-center" style="color: var(--text-secondary);">${trainIdDisplay}</td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top" style="color: var(--text-secondary);">${product.productType || 'N/A'}</td>
                    <td class="px-3 py-3 text-sm whitespace-nowrap align-top" style="color: var(--text-secondary);">${product.batchSizeKg}</td>
                    <td class="px-3 py-3 text-sm align-top">
                         <span class="${criticalClass}">${criticalText}</span>
                         ${product.isCritical && product.criticalReason ? `<p class="text-xs italic" style="color: var(--text-secondary); max-width: 200px; white-space: normal;">${product.criticalReason}</p>` : ''}
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
        ingredientsCell.colSpan = 9;

        let subTableHTML = `
                    <div class="p-4 ingredients-sub-table rounded-b-lg">
                        <table class="w-full text-xs">
                            <thead class="bg-transparent">
                                <tr class="border-b" style="border-color: var(--border-color);">
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

    updateSortIndicators(tabId);
    updateToggleIcons(tabId);
    hideLoader();
}

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

    const codeFilter = tabContainer.querySelector('.filterColProductCode').value.toLowerCase();
    const nameFilter = tabContainer.querySelector('.filterColProductName').value.toLowerCase();
    const trainNoFilter = tabContainer.querySelector('.filterColTrainNo').value;
    const productTypeFilter = tabContainer.querySelector('.filterColProductType').value;
    const isCriticalFilter = tabContainer.querySelector('.filterColIsCritical').value;

    
    state.viewProducts[tabId] = state.products.filter(product => {
        const productCodeMatch = product.productCode.toLowerCase().includes(codeFilter);
        const productNameMatch = product.name.toLowerCase().includes(nameFilter);

        const trainId = getProductTrainId(product);
        const trainIdDisplay = trainId !== 'N/A' ? 'T' + trainId : 'N/A';
        const trainNoMatch = (trainNoFilter === 'all') || (trainIdDisplay === trainNoFilter);
        
        const productTypeMatch = (productTypeFilter === 'all') || (product.productType === productTypeFilter);

        const isCriticalMatch = (isCriticalFilter === 'all') || (String(product.isCritical) === isCriticalFilter);

        return productCodeMatch && productNameMatch && trainNoMatch && productTypeMatch && isCriticalMatch;
    });
     
    renderProducts(tabId);
}

export function sortData(key, tabId) {
  // THE FIX IS HERE: Add 'state.' prefix to all uses of 'sortState'
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
    } else {
        renderProducts(tabId);
    }
}

export function updateSortIndicators(tabId) {
  const tabContainer = document.getElementById(tabId);
    if (!tabContainer || tabId === 'worstCaseProducts') return; 
    tabContainer.querySelectorAll('.mainTable th.sortable').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        const key = th.getAttribute('onclick').match(/'(.*?)'/)[1];

        // THE FIX IS HERE:
        if (key === state.sortState.key) {
            indicator.textContent = state.sortState.direction === 'asc' ? '▲' : '▼';
        } else {
            indicator.textContent = '';
        }
    });
}

export function showAddForm() {
    const form = document.getElementById('addProductForm');
    form.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div><label class="block text-sm font-medium mb-1">Product Code</label><input type="text" id="addProductCode" class="w-full px-3 py-2 border rounded-lg" required placeholder="e.g. 1ABC12345DE" pattern="[0-9]{1}[A-Z]{3}[0-9]{5}[A-Z]{2}"></div>
                                  <div><label class="block text-sm font-medium mb-1">Product Name</label><input type="text" id="addProductName" class="w-full px-3 py-2 border rounded-lg" required></div>
                                  <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="addProductDate" class="w-full px-3 py-2 border rounded-lg" required></div>
                              </div>
                              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                  <div><label class="block text-sm font-medium mb-1">Batch Size (Kg)</label><input type="number" step="0.01" id="addBatchSize" class="w-full px-3 py-2 border rounded-lg" min="0" required></div>
                                  <div class="md:col-span-2">
                                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium mb-1">Dosage Form</label>
                                            <select id="addProductType" class="w-full px-3 py-2 border rounded-lg" required onchange="toggleOtherProductType(this, 'addOtherTypeContainer')">
                                                <option value="" disabled selected>Select a form...</option>
                                                <option value="Tablets">Tablets</option>
                                                <option value="Capsules">Capsules</option>
                                                <option value="Liquids">Liquids</option>
                                                <option value="Semisolids">Semisolids</option>
                                                <option value="Sterile Products">Sterile Products</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div id="addOtherTypeContainer" style="display: none;">
                                            <label class="block text-sm font-medium mb-1">Specify Other Form</label>
                                            <input type="text" id="addOtherProductType" class="w-full px-3 py-2 border rounded-lg">
                                        </div>
                                      </div>
                                  </div>
                              </div>
                              <div><div class="flex justify-between items-center mb-4"><h4 class="text-lg font-medium">Active Ingredients</h4><button type="button" onclick="addIngredientFormFields('ingredientsContainer')" class="text-white px-3 py-1 rounded-lg text-sm btn-gradient">+ Add Ingredient</button></div><div id="ingredientsContainer"></div></div>`;
    document.getElementById('ingredientsContainer').innerHTML = '';
    state.setIngredientFormCounter(0);
    addIngredientFormFields('ingredientsContainer');
    document.getElementById('addProductDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('addProductModal').style.display = 'flex';
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
                    <div><label class="block text-sm font-medium mb-1">Product Code</label><input type="text" id="editProductCode" value="${product.productCode}" class="w-full px-3 py-2 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium mb-1">Product Name</label><input type="text" id="editProductName" value="${product.name}" class="w-full px-3 py-2 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium mb-1">Date</label><input type="date" id="editProductDate" value="${dateValue}" class="w-full px-3 py-2 border rounded-lg" required></div>
                    <div><label class="block text-sm font-medium mb-1">Batch Size (Kg)</label><input type="number" step="0.01" id="editBatchSize" value="${product.batchSizeKg}" class="w-full px-3 py-2 border rounded-lg" min="0" required></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div>
                        <label class="block text-sm font-medium mb-1">Dosage Form</label>
                        <select id="editProductType" class="w-full px-3 py-2 border rounded-lg" required onchange="toggleOtherProductType(this, 'editOtherTypeContainer')">
                            <option value="Tablets">Tablets</option>
                            <option value="Capsules">Capsules</option>
                            <option value="Liquids">Liquids</option>
                            <option value="Semisolids">Semisolids</option>
                            <option value="Sterile Products">Sterile Products</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div id="editOtherTypeContainer" style="display: none;">
                        <label class="block text-sm font-medium mb-1">Specify Other Form</label>
                        <input type="text" id="editOtherProductType" class="w-full px-3 py-2 border rounded-lg">
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

    // Pre-populate product type/dosage form
    const typeSelect = form.querySelector('#editProductType');
    const otherInput = form.querySelector('#editOtherProductType');
    const otherContainer = form.querySelector('#editOtherTypeContainer');
    const standardTypes = Array.from(typeSelect.options).map(opt => opt.value);

    if (standardTypes.includes(product.productType)) {
        typeSelect.value = product.productType;
        otherContainer.style.display = 'none';
        otherInput.required = false;
    } else {
        typeSelect.value = 'Other';
        otherInput.value = product.productType || '';
        otherContainer.style.display = 'block';
        otherInput.required = true;
    }

    document.getElementById('editProductModalTitle').textContent = `Edit Product: ${product.name}`;
    document.getElementById('editProductModal').style.display = 'flex';

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

    // Train No. Filter
    const trainNoSelect = document.querySelector('.filterColTrainNo');
    if (trainNoSelect) {
        const trainIds = [...new Set(state.products.map(p => getProductTrainId(p))
            .filter(id => id !== 'N/A'))]
            .sort((a, b) => a - b);
        trainNoSelect.innerHTML = '<option value="all">All</option>';
        trainIds.forEach(id => {
            trainNoSelect.innerHTML += `<option value="T${id}">T${id}</option>`;
        });
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
    const newProduct = { id: state.nextProductId, productCode: productCode, name: productName, batchSizeKg: batchSize, date: date, productType: productType, machineIds: [], activeIngredients: activeIngredients, isCritical: false, criticalReason: '' };
    state.setNextProductId(state.nextProductId + 1);
    
    const newProducts = [...state.products, newProduct];
    state.setProducts(newProducts);
    saveStateForUndo(); 
    fullAppRender(); 
    hideModal('addProductModal'); 
}
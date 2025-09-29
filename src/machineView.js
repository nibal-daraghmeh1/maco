// Renders the machine management table and its modals
// js/machineView.js

import * as state from './state.js';
import { fullAppRender } from './app.js';
import { showCustomAlert, hideModal, saveStateForUndo } from './ui.js';
import { getProductTrainId, getToxicityPreference, calculateScores, getRpnRatingClass } from './utils.js';

export function sortMachines(key) {
    if (state.machineSortState.key === key) {
        state.machineSortState.direction = state.machineSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.machineSortState.key = key;
        state.machineSortState.direction = 'asc';
    }
    state.setMachineSortState(state.machineSortState);
    renderMachinesTable();
}

function updateMachineSortIndicators() {
    const container = document.getElementById('machineManagement');
    if (!container) return;
    container.querySelectorAll('.card th.sortable').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        const key = th.getAttribute('onclick').match(/'(.*?)'/)[1];
        if (key === state.machineSortState.key) {
            indicator.textContent = state.machineSortState.direction === 'asc' ? '▲' : '▼';
        } else {
            indicator.textContent = '';
        }
    });
}

export function renderMachinesTable() {
    const container = document.getElementById('machinesContainer');
    const noMachinesMsg = document.getElementById('noMachinesMessage');
    container.innerHTML = '';

    if (state.machines.length === 0) {
        noMachinesMsg.style.display = 'block';
        return;
    }
    noMachinesMsg.style.display = 'none';

    // Group machines by stage, maintaining display order
    const machinesByStage = {};
    state.machineStageDisplayOrder.forEach(stage => {
        if (stage !== 'Other') {
            machinesByStage[stage] = [];
        }
    });
    
    // Add machines to their respective stages and collect custom stages
    const customStages = [];
    state.machines.forEach(machine => {
        if (state.machineStageDisplayOrder.includes(machine.stage)) {
            if (machine.stage !== 'Other') {
                machinesByStage[machine.stage].push(machine);
            }
        } else {
            // Custom stage
            if (!machinesByStage[machine.stage]) {
                machinesByStage[machine.stage] = [];
                customStages.push(machine.stage);
            }
            machinesByStage[machine.stage].push(machine);
        }
    });

    // Create tables for each stage that has machines
    Object.keys(machinesByStage).forEach(stage => {
        const stageKey = stage.toLowerCase().replace(/\s+/g, '');
        const stageHidden = localStorage.getItem(`machineStage-${stageKey}-hidden`) === 'true';
        const stageMachines = machinesByStage[stage];
        
        if (stageMachines.length === 0) return;

        // Sort machines within this stage
        const sortedMachines = [...stageMachines].sort((a, b) => {
            const key = state.machineSortState.key;
            const dir = state.machineSortState.direction === 'asc' ? 1 : -1;
            let valA, valB;
            if (key === 'area') {
                valA = a.area;
                valB = b.area;
            } else {
                valA = String(a[key] || '').toLowerCase();
                valB = String(b[key] || '').toLowerCase();
            }
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });

        const tableCard = document.createElement('div');
        tableCard.className = 'card p-6';
        
        let tableHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold">${stage} Machines (${stageMachines.length})</h3>
                <button onclick="toggleStageSection('${stageKey}')" class="text-sm px-3 py-1 rounded border" style="border-color: var(--border-color); color: var(--text-secondary);">
                    ${stageHidden ? 'Show' : 'Hide'}
                </button>
            </div>
            <div id="stage-${stageKey}" ${stageHidden ? 'style="display: none;"' : ''}>
                <div class="overflow-x-auto overflow-hidden rounded-md border" style="border-color: var(--border-color);">
                    <table class="w-full text-sm">
                        <thead class="border-b" style="border-color: var(--border-color);">
                            <tr>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider sortable" onclick="sortMachines('machineNumber')">Number <span class="sort-indicator"></span></th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider sortable" onclick="sortMachines('name')">Name <span class="sort-indicator"></span></th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider sortable" onclick="sortMachines('group')">Group <span class="sort-indicator"></span></th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider sortable" onclick="sortMachines('area')">Area (cm²) <span class="sort-indicator"></span></th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider sortable" onclick="sortMachines('cleaningSOP')">Cleaning SOP <span class="sort-indicator"></span></th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Products</th>
                                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y" style="border-color: var(--border-color);">`;

        sortedMachines.forEach(machine => {
            const assignedProducts = state.products.filter(p => p.machineIds && p.machineIds.includes(machine.id));
            const productCount = assignedProducts.length;

            let productsCellHTML = `<div class="flex items-center gap-x-2">`;
            if (productCount > 0) {
                productsCellHTML += `
                    <span class="text-xs font-semibold px-2 py-1 rounded-full" style="background-color: var(--bg-accent); color: var(--text-primary);">${productCount}</span>
                    <button onclick="showMachineProductsModal(${machine.id})" class="p-1" style="color: var(--text-secondary);" title="View ${productCount} Product(s)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>
                    </button>`;
            } else {
                productsCellHTML += `<span class="text-xs" style="color: var(--text-secondary);">None</span>`;
            }
            productsCellHTML += `</div>
                <div class="only-print text-xs" style="display: none; white-space: normal; word-break: break-word;">
                    ${assignedProducts.map(p => p.name).join(', ') || 'None'}
                </div>`;
            
            // Format group cell with appropriate styling
            const groupCellClass = machine.group ? 'machine-group-cell grouped' : 'machine-group-cell individual';
            const groupCellContent = machine.group || '<span style="color: var(--text-secondary); font-style: italic;">Individual</span>';
            
            tableHTML += `
                <tr>
                    <td class="px-4 py-3 whitespace-nowrap">${machine.machineNumber}</td>
                    <td class="px-4 py-3 font-medium">${machine.name}</td>
                    <td class="px-4 py-3 whitespace-nowrap ${groupCellClass}">${groupCellContent}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${machine.area.toLocaleString()}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${machine.cleaningSOP || ''}</td>
                    <td class="px-4 py-3">${productsCellHTML}</td>
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center gap-x-2 no-print">
                            <button onclick="showAddProductsToMachineModal(${machine.id})" class="p-1 text-blue-500" title="Assign Products to this Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-square" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg></button>
                            <button onclick="showMachineModal(${machine.id})" class="p-1" style="color: var(--text-secondary);" title="Edit Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zM12.879 4.379L11 2.5 4.939 8.561a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121L12.879 4.379z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg></button>
                            <button onclick="deleteMachine(${machine.id})" class="p-1 text-red-500" title="Delete Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1h-11z"/></svg></button>
                        </div>
                    </td>
                </tr>`;
        });

        tableHTML += `</tbody></table></div></div>`;
        tableCard.innerHTML = tableHTML;
        container.appendChild(tableCard);
    });

    updateMachineSortIndicators();
}

export function showMachineModal(id = null) {
      const form = document.getElementById('machineForm');
            form.reset();
            const modalTitle = document.getElementById('machineModalTitle');
            const machineIdInput = document.getElementById('machineId');
            const machineNumberInput = document.getElementById('machineNumber');
            const machineNameInput = document.getElementById('machineName');
            const machineAreaInput = document.getElementById('machineArea');
            const cleaningSOPInput = document.getElementById('cleaningSOP');
            const machineStageSelect = document.getElementById('machineStage');
            const machineGroupSelect = document.getElementById('machineGroup');

            // Populate stage select, ensuring "Other" is handled correctly
            machineStageSelect.innerHTML = `<option value="" disabled selected>Select a Stage</option>`;
            state.machineStageDisplayOrder.forEach(stage => {
                const displayText = stage === 'Other' ? 'Other (Add New Stage)' : stage;
                machineStageSelect.innerHTML += `<option value="${stage}">${displayText}</option>`;
            });

            // Populate group select
            machineGroupSelect.innerHTML = `<option value="">No Group (Individual Machine)</option>`;
            state.machineGroups.forEach(group => {
                machineGroupSelect.innerHTML += `<option value="${group}">${group}</option>`;
            });
            machineGroupSelect.innerHTML += `<option value="Other">Other (Create New Group)</option>`;

            if (id) {
                const machine = state.machines.find(m => m.id === id);
                if (machine) {
                    modalTitle.textContent = 'Edit Machine';
                    machineIdInput.value = machine.id;
                    machineNumberInput.value = machine.machineNumber;
                    machineNameInput.value = machine.name;
                    machineAreaInput.value = machine.area;
                    cleaningSOPInput.value = machine.cleaningSOP || '';
                    
                    const otherContainer = document.getElementById('otherStageContainer');
                    const otherInput = document.getElementById('otherMachineStage');
                    
                    // Check if the machine's stage is one of the standard options (excluding 'Other')
                    if (state.machineStageDisplayOrder.filter(s => s !== 'Other').includes(machine.stage)) {
                        machineStageSelect.value = machine.stage;
                        otherContainer.style.display = 'none';
                        otherInput.required = false;
                    } else { // It's a custom stage
                        machineStageSelect.value = 'Other';
                        otherInput.value = machine.stage;
                        otherContainer.style.display = 'block';
                        otherInput.required = true;
                    }

                    // Handle machine group selection
                    const otherGroupContainer = document.getElementById('otherGroupContainer');
                    const otherGroupInput = document.getElementById('otherMachineGroup');
                    
                    if (!machine.group || machine.group === '') {
                        machineGroupSelect.value = '';
                        otherGroupContainer.style.display = 'none';
                        otherGroupInput.required = false;
                    } else if (state.machineGroups.includes(machine.group)) {
                        machineGroupSelect.value = machine.group;
                        otherGroupContainer.style.display = 'none';
                        otherGroupInput.required = false;
                    } else { // It's a custom group
                        machineGroupSelect.value = 'Other';
                        otherGroupInput.value = machine.group;
                        otherGroupContainer.style.display = 'block';
                        otherGroupInput.required = true;
                    }
                }
            } else {
                modalTitle.textContent = 'Add Machine';
                machineIdInput.value = '';
                document.getElementById('otherStageContainer').style.display = 'none';
                document.getElementById('otherMachineStage').required = false;
                document.getElementById('otherGroupContainer').style.display = 'none';
                document.getElementById('otherMachineGroup').required = false;
            }
            document.getElementById('machineModal').style.display = 'flex';
      
}

export function saveMachine(event) {
   event.preventDefault();
            const id = document.getElementById('machineId').value;
            const number = document.getElementById('machineNumber').value.trim();
            const name = document.getElementById('machineName').value.trim();
            let stage = document.getElementById('machineStage').value;
            const area = parseInt(document.getElementById('machineArea').value, 10);
            const cleaningSOP = document.getElementById('cleaningSOP').value.trim();
            let group = document.getElementById('machineGroup').value;

            // Handle custom stage
            if (stage === 'Other') {
                const customStage = document.getElementById('otherMachineStage').value.trim();
                if (!customStage) {
                    showCustomAlert('Validation Error', 'Please specify the new stage name.');
                    return;
                }
                stage = customStage;
                
                // Add the new stage to the display order if it doesn't exist, right before "Other"
                if (!state.machineStageDisplayOrder.includes(stage)) {
                    const otherIndex = state.machineStageDisplayOrder.indexOf('Other');
                    if (otherIndex > -1) {
                        state.machineStageDisplayOrder.splice(otherIndex, 0, stage);
                    } else {
                        state.machineStageDisplayOrder.push(stage); // Fallback
                    }
                    localStorage.setItem('machineStageDisplayOrder', JSON.stringify(state.machineStageDisplayOrder));
                }
            }

            // Handle custom group
            if (group === 'Other') {
                const customGroup = document.getElementById('otherMachineGroup').value.trim();
                if (!customGroup) {
                    showCustomAlert('Validation Error', 'Please specify the new group name.');
                    return;
                }
                group = customGroup;
                
                // Add the new group to the list if it doesn't exist
                if (!state.machineGroups.includes(group)) {
                    state.machineGroups.push(group);
                    localStorage.setItem('machineGroups', JSON.stringify(state.machineGroups));
                }
            }

            // Validate group-stage compatibility
            if (group && group !== '') {
                const existingMachinesInGroup = state.machines.filter(m => 
                    m.group === group && (!id || m.id !== parseInt(id))
                );
                
                if (existingMachinesInGroup.length > 0) {
                    const existingStages = [...new Set(existingMachinesInGroup.map(m => m.stage))];
                    if (existingStages.length > 0 && !existingStages.includes(stage)) {
                        const stageList = existingStages.join(', ');
                        showCustomAlert(
                            'Group Stage Mismatch', 
                            `Cannot assign this machine to group "${group}". All machines in a group must belong to the same stage.\n\nCurrent group stage(s): ${stageList}\nNew machine stage: ${stage}\n\nPlease either:\n• Change the machine's stage to match the group\n• Choose a different group\n• Create a new group for this stage`
                        );
                        return;
                    }
                }
            }

            if (!number || !name || !stage || isNaN(area) || !cleaningSOP) {
                showCustomAlert('Error', 'All fields are required.');
                return;
            }
                 // Check for duplicate machine number
            const isDuplicate = state.machines.some(machine => {
                const currentId = id ? parseInt(id, 10) : null;
                // If editing, exclude the current machine from the check.
                // If adding, currentId is null, so the first part of the AND is always true.
                return machine.id !== currentId && machine.machineNumber.toLowerCase() === number.toLowerCase();
            });

            if (isDuplicate) {
                showCustomAlert('Validation Error', 'A machine with this number already exists.');
                return;
            }
            
            
            if (id) { // Edit
                const machine = state.machines.find(m => m.id === parseInt(id));
                if (machine) {
                    machine.machineNumber = number;
                    machine.name = name;
                    machine.stage = stage;
                    machine.area = area;
                    machine.cleaningSOP = cleaningSOP;
                    machine.group = group || '';
                }
            } else { // Add
                state.setNextMachineId(state.nextMachineId+1);
                state.machines.push({ id: state.nextMachineId, machineNumber: number, name: name, stage: stage, area: area, cleaningSOP: cleaningSOP, group: group || '' });
            }
            saveStateForUndo();
            fullAppRender();
            hideModal('machineModal');
               console.log('Saving machines to Firestore');
            // Save to Firestore after add/edit
            // if (window.saveAllDataToFirestore && window.orgId) {
            //     console.log('Saving machines to Firestore');
            //     window.saveAllDataToFirestore(window.orgId);
            // } else {
            //     console.warn('Firestore save function or orgId not available');
            // }
}

export function deleteMachine(id) {
    if (confirm("Are you sure you want to delete this machine? It will be removed from all products that use it.")) {
        const newMachines = state.machines.filter(m => m.id !== id);
        state.setMachines(newMachines);
        // Remove the machine ID from all products
        state.products.forEach(p => {
            if (p.machineIds) {
                p.machineIds = p.machineIds.filter(mid => mid !== id);
            }
        });
        saveStateForUndo();
        fullAppRender();
    }
}

// Store current machine data for export/print
let currentMachineForModal = null;

export function showMachineProductsModal(machineId) {
     const machine = state.machines.find(m => m.id === machineId);
            if (!machine) return;

            // Store machine data for export/print functions
            currentMachineForModal = machine;

            const modalTitle = document.getElementById('machineProductsModalTitle');
            const listContainer = document.getElementById('machineProductsList');

            modalTitle.textContent = `Products on: ${machine.name} (${machine.machineNumber})`;
            
            const assignedProducts = state.products.filter(p => p.machineIds && p.machineIds.includes(machineId));
            
            if (assignedProducts.length > 0) {
                let productListHTML = '<div class="divide-y" style="border-color: var(--border-color);">';
                assignedProducts.forEach((p, index) => {
                    const trainId = getProductTrainId(p);
                    const trainIdDisplay = trainId !== 'N/A' ? 'T' + trainId : 'N/A';
                    const criticalText = p.isCritical ? 'Yes' : 'No';
                    const criticalClass = p.isCritical ? 'text-red-600 font-bold' : '';
                    const dateFormatted = new Date(p.date).toLocaleDateString();
                    
                    // Calculate highest RPN for the product
                    const toxicityPreference = getToxicityPreference();
                    let highestRPN = 0;
                    let highestRPNRating = 'N/A';
                    
                    p.activeIngredients.forEach(ing => {
                        const scores = calculateScores(ing, toxicityPreference);
                        if (scores.rpn > highestRPN) {
                            highestRPN = scores.rpn;
                            highestRPNRating = scores.rpnRatingText;
                        }
                    });
                    
                    const rpnClass = getRpnRatingClass(highestRPNRating);
                    
                    productListHTML += `
                        <div class="py-3 px-2">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-semibold text-lg">${p.name}</h4>
                                <span class="text-xs px-2 py-1 rounded" style="background-color: var(--bg-accent); color: var(--text-secondary);">${p.productCode}</span>
                            </div>
                            <div class="text-xs flex flex-wrap gap-4">
                                <span ><strong>Highest RPN:</strong> <span class="${rpnClass}" style="font-weight: bold;">${highestRPN.toFixed(1)}</span></span>
                                <span><strong>Special Case Product:</strong> <span class="${criticalClass}">${criticalText}</span></span>
                                ${p.isCritical && p.criticalReason ? `<span class="text-xs italic" style="color: var(--text-secondary);">Reason: ${p.criticalReason}</span>` : ''}
                            </div>
                        </div>
                    `;
                });
                productListHTML += '</div>';
                listContainer.innerHTML = productListHTML;
            } else {
                listContainer.innerHTML = `<p style="color:var(--text-secondary);">No products are currently assigned to this machine.</p>`;
            }
            
            document.getElementById('machineProductsModal').style.display = 'flex';
       
}

// Export machine products to Excel
export function exportMachineProductsToExcel() {
    if (!currentMachineForModal) {
        console.error('No machine data available for export');
        return;
    }

    const machine = currentMachineForModal;
    const assignedProducts = state.products.filter(p => p.machineIds && p.machineIds.includes(machine.id));
    
    if (assignedProducts.length === 0) {
        alert('No products to export for this machine.');
        return;
    }

    const toxicityPreference = getToxicityPreference();
    
    // Prepare data for export
    const data = assignedProducts.map(p => {
        const criticalText = p.isCritical ? 'Yes' : 'No';
        
        // Calculate highest RPN for the product
        let highestRPN = 0;
        
        p.activeIngredients.forEach(ing => {
            const scores = calculateScores(ing, toxicityPreference);
            if (scores.rpn > highestRPN) {
                highestRPN = scores.rpn;
            }
        });

        return {
            'Product Name': p.name,
            'Highest RPN': highestRPN.toFixed(1),
            'Special Case Product': criticalText
        };
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const sheetName = `${machine.name} Products`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Auto-fit columns
    const colWidths = Object.keys(data[0] || {}).map(key => {
        return {
            wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 2
        };
    });
    ws['!cols'] = colWidths;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
    const filename = `Machine_${machine.machineNumber}_Products_${timestamp}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, filename);
}

// Print machine products
export function printMachineProducts() {
    if (!currentMachineForModal) {
        alert('No machine selected for printing');
        return;
    }

    try {
        const machine = currentMachineForModal;
        const products = state.products.filter(p => p.machineIds && p.machineIds.includes(machine.id));
        
        if (!products || products.length === 0) {
            alert('No products found for this machine');
            return;
        }

        // Create print content
        let printContent = `
            <html>
            <head>
                <title>Machine Products Report</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px;
                        font-size: 12px;
                    }
                    h1 { 
                        color: #333; 
                        border-bottom: 2px solid #ddd; 
                        padding-bottom: 10px;
                    }
                    .info-table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-bottom: 20px;
                    }
                    .info-table th, .info-table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    .info-table th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    @media print {
                        body { margin: 0; }
                        h1 { page-break-after: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>Machine Products Report</h1>
                
                <table class="info-table">
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Highest RPN</th>
                            <th>Special Case</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        products.forEach(product => {
            const criticalText = product.isCritical ? 'Yes' : 'No';
            
            // Calculate highest RPN for the product
            const toxicityPreference = getToxicityPreference();
            let highestRPN = 0;
            
            product.activeIngredients.forEach(ing => {
                const scores = calculateScores(ing, toxicityPreference);
                if (scores.rpn > highestRPN) {
                    highestRPN = scores.rpn;
                }
            });
            
            printContent += `
                <tr>
                    <td>${product.name}</td>
                    <td>${highestRPN.toFixed(1)}</td>
                    <td>${criticalText}</td>
                </tr>
            `;
        });
        
        printContent += `
                    </tbody>
                </table>
                
                <div style="margin-top: 30px; font-size: 10px; color: #666;">
                    Generated on: ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        
        // Create a temporary iframe for printing without opening new window
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.write(printContent);
        iframeDoc.close();
        
        // Print the iframe content
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Clean up - remove iframe after printing
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
        
    } catch (error) {
        console.error('Error printing machine products:', error);
        alert('Failed to generate print report. Please try again.');
    }
}


// --- Product-Machine Assignment Functions ---
export function showAssignMachinesModal(productId) {
  const product = state.products.find(p => p.id === productId);
            if (!product) return;

            document.getElementById('assignMachineProductId').value = productId;
            document.getElementById('assignMachinesModalTitle').textContent = `Assign Machines to: ${product.name}`;
            
            const listContainer = document.getElementById('assignMachinesList');
            listContainer.innerHTML = ''; // Clear previous content

            state.machineStageDisplayOrder.forEach(stage => {
                let machinesInStage = state.machines.filter(m => m.stage === stage);
                
                // Custom sorting logic
                if (stage === 'Mixing') {
                    machinesInStage.sort((a, b) => {
                        const aIsBin = a.name.toLowerCase().includes('bin');
                        const bIsBin = b.name.toLowerCase().includes('bin');
                        if (aIsBin && !bIsBin) return -1;
                        if (!aIsBin && bIsBin) return 1;
                        if (aIsBin && bIsBin) {
                            const aNum = parseInt((a.name.match(/\d+/) || [0])[0], 10);
                            const bNum = parseInt((b.name.match(/\d+/) || [0])[0], 10);
                            return aNum - bNum;
                        }
                        return a.name.localeCompare(b.name);
                    });
                } else {
                    machinesInStage.sort((a, b) => a.name.localeCompare(b.name));
                }

                if (machinesInStage.length > 0) {
                    const groupDiv = document.createElement('div');
                    
                    const stageHeader = document.createElement('h4');
                    stageHeader.className = 'text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b';
                    stageHeader.style.borderColor = 'var(--border-color)';
                    stageHeader.style.color = 'var(--text-secondary)';
                    stageHeader.textContent = stage === 'Other' ? 'Other / Custom Stages' : stage;
                    groupDiv.appendChild(stageHeader);

                    const machinesGrid = document.createElement('div');
                    machinesGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pl-2';

                    machinesInStage.forEach(machine => {
                        const isChecked = product.machineIds && product.machineIds.includes(machine.id);
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'flex items-center';
                        itemDiv.innerHTML = `
                            <input type="checkbox" id="machine-check-${machine.id}" value="${machine.id}" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                            <label for="machine-check-${machine.id}" class="ml-2 text-sm font-medium" style="color: var(--text-primary);">${machine.name} <span class="text-xs" style="color:var(--text-secondary)">(${machine.machineNumber})</span></label>
                        `;
                        machinesGrid.appendChild(itemDiv);
                    });
                    
                    groupDiv.appendChild(machinesGrid);
                    listContainer.appendChild(groupDiv);
                }
            });

            document.getElementById('assignMachinesModal').style.display = 'flex';
      
}

export function saveProductMachines(event) {
     event.preventDefault();
            const productId = parseInt(document.getElementById('assignMachineProductId').value);
            const product = state.products.find(p => p.id === productId);
            if (!product) return;
            
            const selectedIds = [];
            document.querySelectorAll('#assignMachinesList input[type="checkbox"]:checked').forEach(checkbox => {
                selectedIds.push(parseInt(checkbox.value));
            });
            
            product.machineIds = selectedIds;
            saveStateForUndo();
            hideModal('assignMachinesModal');
            fullAppRender();
            showCustomAlert('Success', 'Product machines updated successfully.');
        }
     

export function showAddProductsToMachineModal(machineId) {
            const machine = state.machines.find(m => m.id === machineId);
            if (!machine) return;

            document.getElementById('addProductsMachineId').value = machineId;
            document.getElementById('addProductsToMachineModalTitle').textContent = `Assign Products to: ${machine.name}`;
            
            const listContainer = document.getElementById('addProductsToMachineList');
            const noProductsMsg = document.getElementById('noAvailableProductsMessage');
            const saveBtn = document.getElementById('addProductsToMachineSaveBtn');
            listContainer.innerHTML = '';

            if (state.products.length > 0) {
                noProductsMsg.style.display = 'none';
                listContainer.style.display = 'block';
                saveBtn.style.display = 'block';

                state.products.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
                    const isAssignedToThisMachine = p.machineIds && p.machineIds.includes(machineId);
                    const isAssignedToAnyOtherMachine = p.machineIds && p.machineIds.some(id => id !== machineId);

                    let otherAssignmentIndicator = '';
                    if (isAssignedToAnyOtherMachine) {
                         otherAssignmentIndicator = `<span class="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded" style="background-color: var(--bg-accent); color: var(--text-secondary);" title="This product is also assigned to other machines.">Linked</span>`;
                    }
                    
                    const div = document.createElement('div');
                    div.className = 'flex items-center';
                    div.innerHTML = `
                        <input type="checkbox" id="product-assign-check-${p.id}" value="${p.id}" ${isAssignedToThisMachine ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <label for="product-assign-check-${p.id}" class="ml-3 flex-1 flex items-center text-sm font-medium" style="color: var(--text-primary);">
                            <span>${p.name} <span class="text-xs" style="color:var(--text-secondary)">(${p.productCode})</span></span>
                            ${otherAssignmentIndicator}
                        </label>
                    `;
                    listContainer.appendChild(div);
                });
            } else {
                noProductsMsg.textContent = 'There are no products registered in the system.';
                noProductsMsg.style.display = 'block';
                listContainer.style.display = 'none';
                saveBtn.style.display = 'none';
            }
            
            document.getElementById('addProductsToMachineModal').style.display = 'flex';
      
}

export function saveProductsToMachine(event) {
     event.preventDefault();
            const machineId = parseInt(document.getElementById('addProductsMachineId').value);
            if (isNaN(machineId)) return;

            const selectedProductIds = [];
            document.querySelectorAll('#addProductsToMachineList input[type="checkbox"]:checked').forEach(checkbox => {
                selectedProductIds.push(parseInt(checkbox.value));
            });

            // Iterate through ALL products to sync assignments for this machine
            state.products.forEach(product => {
                if (!product.machineIds) {
                    product.machineIds = [];
                }
                const isCurrentlyAssigned = product.machineIds.includes(machineId);
                const isSelected = selectedProductIds.includes(product.id);

                if (isSelected && !isCurrentlyAssigned) {
                    // Add assignment if selected but not currently assigned
                    product.machineIds.push(machineId);
                } else if (!isSelected && isCurrentlyAssigned) {
                    // Remove assignment if not selected but currently assigned
                    product.machineIds = product.machineIds.filter(id => id !== machineId);
                }
            });

            saveStateForUndo();
            fullAppRender();
            hideModal('addProductsToMachineModal');
            showCustomAlert('Success', 'Machine assignments updated.');
}

// Make functions globally available
window.exportMachineProductsToExcel = exportMachineProductsToExcel;
window.printMachineProducts = printMachineProducts;
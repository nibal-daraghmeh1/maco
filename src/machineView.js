// Renders the machine management table and its modals
// js/machineView.js

import * as state from './state.js';
import { getSafetyFactorForDosageForm } from './state.js';
import { fullAppRender } from './app.js';
import { showCustomAlert, hideModal, showModal, saveStateForUndo } from './ui.js';
import { getProductTrainId, getProductTrainNumber, getToxicityPreference, calculateScores, getRpnRatingClass, getUniqueProductLines } from './utils.js';
import * as db from './indexedDB.js';
import { storeSOPFile, getSOPFile, deleteSOPFile } from './indexedDB.js';

// Global variables for SOP file management
let currentSOPFile = null;
let currentSOPData = null;

// Track active machine line tab
let activeMachineLineTab = null;

/**
 * Populate the machine line dropdown with current product lines
 */
export function populateMachineLineOptions() {
    const machineLineSelect = document.getElementById('machineLine');
    if (!machineLineSelect) return;
    
    // Get lines from both products and machines
    const productLines = getUniqueProductLines(state.products);
    const machineLines = [...new Set(state.machines.map(m => m.line).filter(Boolean))];
    
    // Combine and deduplicate lines
    const allLines = [...new Set([...productLines, ...machineLines])].sort();
    const currentValue = machineLineSelect.value; // Preserve current selection
    
    // Clear existing options except the first placeholder
    machineLineSelect.innerHTML = '<option value="" disabled selected>Select Primary Line</option>';
    
    // Add all lines
    allLines.forEach(line => {
        machineLineSelect.innerHTML += `<option value="${line}">${line}</option>`;
    });
    
    // Add "Other" option for custom lines
    machineLineSelect.innerHTML += '<option value="Other">Other</option>';
    
    // Restore previous selection if it still exists
    if (currentValue && Array.from(machineLineSelect.options).some(opt => opt.value === currentValue)) {
        machineLineSelect.value = currentValue;
    }
    
    // Populate additional lines checkboxes
    populateAdditionalLinesCheckboxes();
    
    // Add event listener to primary line dropdown
    machineLineSelect.addEventListener('change', updateAdditionalLinesCheckboxes);
}

/**
 * Populate additional lines checkboxes
 */
export function populateAdditionalLinesCheckboxes() {
    const container = document.getElementById('additionalLinesContainer');
    if (!container) return;
    
    // Get lines from both products and machines
    const productLines = getUniqueProductLines(state.products);
    const machineLines = [...new Set(state.machines.map(m => m.line).filter(Boolean))];
    const allLines = [...new Set([...productLines, ...machineLines])].sort();
    
    container.innerHTML = '';
    
    allLines.forEach(line => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'flex items-center';
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="additionalLine_${line}" value="${line}" class="mr-2" onchange="updateAdditionalLinesCheckboxes()">
            <label for="additionalLine_${line}" class="text-sm">${line}</label>
        `;
        container.appendChild(checkboxDiv);
    });
    
    // Update checkboxes based on primary line selection
    updateAdditionalLinesCheckboxes();
}

/**
 * Update additional lines checkboxes based on primary line selection
 */
window.updateAdditionalLinesCheckboxes = function() {
    const primaryLineSelect = document.getElementById('machineLine');
    const additionalCheckboxes = document.querySelectorAll('#additionalLinesContainer input[type="checkbox"]');
    
    if (!primaryLineSelect || !additionalCheckboxes.length) return;
    
    const selectedPrimaryLine = primaryLineSelect.value;
    
    additionalCheckboxes.forEach(checkbox => {
        const lineValue = checkbox.value;
        const isPrimaryLine = lineValue === selectedPrimaryLine;
        
        if (isPrimaryLine) {
            checkbox.disabled = true;
            checkbox.checked = false;
            checkbox.parentElement.style.opacity = '0.5';
            checkbox.parentElement.style.cursor = 'not-allowed';
        } else {
            checkbox.disabled = false;
            checkbox.parentElement.style.opacity = '1';
            checkbox.parentElement.style.cursor = 'pointer';
        }
    });
}

/**
 * Toggle machine line options based on radio button selection
 */
window.toggleMachineLineOptions = function() {
    const specificOptions = document.getElementById('specificLineOptions');
    const lineTypeRadios = document.querySelectorAll('input[name="machineLineType"]');
    
    if (!specificOptions || !lineTypeRadios.length) return;
    
    const selectedType = Array.from(lineTypeRadios).find(radio => radio.checked)?.value;
    
    if (selectedType === 'shared') {
        specificOptions.style.display = 'none';
    } else {
        specificOptions.style.display = 'block';
    }
}

/**
 * Update machine line options if the machine modal is currently open
 * This is called automatically when products are saved to keep the dropdown in sync
 */
export function updateMachineLineOptionsIfModalOpen() {
    const modal = document.getElementById('machineModal');
    if (modal && modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
        populateMachineLineOptions();
    }
}

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
    console.log('renderMachinesTable: Starting render...');
    console.log('renderMachinesTable: Machine count:', state.machines.length);
    
    const container = document.getElementById('machinesContainer');
    const noMachinesMsg = document.getElementById('noMachinesMessage');
    const tabNavigation = document.getElementById('machineTabNavigation');
    
    if (!container) {
        console.error('renderMachinesTable: machinesContainer not found in DOM!');
        return;
    }
    
    container.innerHTML = '';

    if (state.machines.length === 0) {
        console.log('renderMachinesTable: No machines to display');
        noMachinesMsg.style.display = 'block';
        if (tabNavigation) tabNavigation.style.display = 'none';
        return;
    }
    console.log('renderMachinesTable: Rendering', state.machines.length, 'machines');
    noMachinesMsg.style.display = 'none';

    // Group machines by line instead of stage
    const machinesByLine = {};
    
    // Add machines to their respective lines
    state.machines.forEach(machine => {
        const primaryLine = machine.line || 'Unassigned';
        
        // Add to primary line
        if (!machinesByLine[primaryLine]) {
            machinesByLine[primaryLine] = [];
        }
        machinesByLine[primaryLine].push(machine);
        
        // Add to additional lines if they exist
        if (machine.additionalLines && machine.additionalLines.length > 0) {
            machine.additionalLines.forEach(additionalLine => {
                if (!machinesByLine[additionalLine]) {
                    machinesByLine[additionalLine] = [];
                }
                machinesByLine[additionalLine].push(machine);
            });
        }
    });

    const lines = Object.keys(machinesByLine).filter(line => machinesByLine[line].length > 0);
    
    // If only one line or no lines, don't show tabs
    if (lines.length <= 1) {
        if (tabNavigation) tabNavigation.style.display = 'none';
        // Render single line without tabs (fallback to old behavior)
        lines.forEach(line => {
            renderLineTable(container, line, machinesByLine[line]);
        });
        updateMachineSortIndicators();
        return;
    }

    // Show tab navigation
    if (tabNavigation) {
        tabNavigation.style.display = 'block';
        const nav = tabNavigation.querySelector('nav');
        nav.innerHTML = '';
        
        // Create tab buttons
        lines.forEach((line, index) => {
        const lineKey = line.toLowerCase().replace(/\s+/g, '');
            const isActive = index === 0 || activeMachineLineTab === lineKey;
            if (isActive) {
                activeMachineLineTab = lineKey;
            }
            
            const button = document.createElement('button');
            button.onclick = () => changeMachineLineTab(lineKey, button);
            button.className = `machine-line-tab-button py-3 px-1 text-sm font-medium ${isActive ? 'active-machine-line-tab' : ''}`;
            button.textContent = `${line} (${machinesByLine[line].length})`;
            nav.appendChild(button);
        });
    }

    // Create tab content for each line
    lines.forEach((line, index) => {
        const lineKey = line.toLowerCase().replace(/\s+/g, '');
        const isActive = index === 0 || activeMachineLineTab === lineKey;
        
        const tabContent = document.createElement('div');
        tabContent.id = `machine-tab-${lineKey}`;
        tabContent.className = 'machine-line-tab-content';
        tabContent.style.display = isActive ? 'block' : 'none';
        
        renderLineTable(tabContent, line, machinesByLine[line]);
        container.appendChild(tabContent);
    });

    updateMachineSortIndicators();
}

function renderLineTable(container, line, lineMachines) {
        // Sort machines within this line
        const sortedMachines = [...lineMachines].sort((a, b) => {
            const key = state.machineSortState.key;
            const dir = state.machineSortState.direction === 'asc' ? 1 : -1;
            
            // If sorting by stage, use the stage display order
            if (key === 'stage') {
                const stageOrder = state.machineStageDisplayOrder;
                const aIndex = stageOrder.indexOf(a.stage || '');
                const bIndex = stageOrder.indexOf(b.stage || '');
                
                // If both stages are in the order, sort by their position
                if (aIndex !== -1 && bIndex !== -1) {
                    return (aIndex - bIndex) * dir;
                }
                // If only one is in the order, prioritize it
                if (aIndex !== -1 && bIndex === -1) return -1 * dir;
                if (aIndex === -1 && bIndex !== -1) return 1 * dir;
                // If neither is in the order, sort alphabetically
                return String(a.stage || '').localeCompare(String(b.stage || '')) * dir;
            }
            
            // Default sorting: first by stage order, then by the selected key
            const stageOrder = state.machineStageDisplayOrder;
            const aStageIndex = stageOrder.indexOf(a.stage || '');
            const bStageIndex = stageOrder.indexOf(b.stage || '');
            
            // If both have stages in the order, sort by stage first
            if (aStageIndex !== -1 && bStageIndex !== -1) {
                if (aStageIndex !== bStageIndex) {
                    return aStageIndex - bStageIndex;
                }
            }
            // If only one has a stage in the order, prioritize it
            else if (aStageIndex !== -1 && bStageIndex === -1) return -1;
            else if (aStageIndex === -1 && bStageIndex !== -1) return 1;
            
            // Then sort by the selected key
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
                <h3 class="text-xl font-bold">${line} Line Machines (${lineMachines.length})</h3>
                <div class="flex items-center gap-2">
                    <button onclick="showMachineSummary('${line}')" class="text-sm px-3 py-1 rounded border" style="border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-accent);" title="Show Machine Summary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                        </svg>
                        Summary
                    </button>
                </div>
            </div>
                <div class="overflow-x-auto overflow-hidden rounded-md border" style="border-color: var(--border-color);">
                    <table class="w-full text-sm">
                        <thead class="border-b" style="border-color: var(--border-color); background-color: var(--bg-accent);">
                            <tr>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('machineNumber')" style="color: var(--text-primary);">
                                    Machine Number
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('name')" style="color: var(--text-primary);">
                                    Machine Name
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('stage')" style="color: var(--text-primary);">
                                    Production Stage
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('group')" style="color: var(--text-primary);">
                                    Machine Group
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('area')" style="color: var(--text-primary);">
                                    Surface Area (cm²)
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide sortable" onclick="sortMachines('cleaningSOP')" style="color: var(--text-primary);">
                                    Cleaning SOP
                                    <span class="sort-indicator"></span>
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide" style="color: var(--text-primary);">
                                    Assigned Products
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide" style="color: var(--text-primary);">
                                    Sample Locations
                                </th>
                                <th class="px-4 py-3 text-left text-sm font-semibold tracking-wide" style="color: var(--text-primary);">
                                    Quick Actions
                                </th>
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
            
            // Format stage cell with appropriate styling
            const stageCellContent = machine.stage || '<span style="color: var(--text-secondary); font-style: italic;">Not Assigned</span>';
            
            tableHTML += `
                <tr>
                    <td class="px-4 py-3 whitespace-nowrap">${machine.machineNumber}</td>
                    <td class="px-4 py-3 font-medium">${machine.name}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${stageCellContent}</td>
                    <td class="px-4 py-3 whitespace-nowrap ${groupCellClass}">${groupCellContent}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${machine.area.toLocaleString()}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${formatSOPDisplay(machine.cleaningSOP, machine.id)}</td>
                    <td class="px-4 py-3">${productsCellHTML}</td>
                    <td class="px-4 py-3">${formatSampleLocationsDisplay(machine)}</td>
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center gap-x-2 no-print">
                            <button onclick="showAddProductsToMachineModal(${machine.id})" class="p-1 text-blue-500" title="Assign Products to this Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-square" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg></button>
                            <button onclick="generateSampleLocationReport(${machine.id})" class="p-1 text-purple-600" title="Generate Cleaning Protocol"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/><path d="M3 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/></svg></button>
                            <button onclick="showMachineModal(${machine.id})" class="p-1" style="color: var(--text-secondary);" title="Edit Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zM12.879 4.379L11 2.5 4.939 8.561a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121L12.879 4.379z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg></button>
                            <button onclick="deleteMachine(${machine.id})" class="p-1 text-red-500" title="Delete Machine"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1h-11z"/></svg></button>
                        </div>
                    </td>
                </tr>`;
        });

    tableHTML += `</tbody></table></div>`;
        tableCard.innerHTML = tableHTML;
        container.appendChild(tableCard);
}

// Change active machine line tab
export function changeMachineLineTab(lineKey, element) {
    activeMachineLineTab = lineKey;
    
    // Update tab button styles
    document.querySelectorAll('.machine-line-tab-button').forEach(btn => {
        btn.classList.remove('active-machine-line-tab');
    });
    if (element) {
        element.classList.add('active-machine-line-tab');
    }
    
    // Show/hide tab content
    document.querySelectorAll('.machine-line-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    const activeTabContent = document.getElementById(`machine-tab-${lineKey}`);
    if (activeTabContent) {
        activeTabContent.style.display = 'block';
    }
}

// Make function available globally
window.changeMachineLineTab = changeMachineLineTab;

export function showMachineModal(id = null) {
      const form = document.getElementById('machineForm');
            form.reset();
            const modalTitle = document.getElementById('machineModalTitle');
            const machineIdInput = document.getElementById('machineId');
            const machineNumberInput = document.getElementById('machineNumber');
            const machineNameInput = document.getElementById('machineName');
            const machineDescriptionInput = document.getElementById('machineDescription');
            const machineLineSelect = document.getElementById('machineLine');
            
            // Check if the element exists (for backward compatibility)
            if (!machineLineSelect) {
                console.error('Machine line select element not found. Please refresh the page.');
                showCustomAlert('Error', 'Machine line field not found. Please refresh the page to load the updated interface.');
                return;
            }
            
            // Populate line options dynamically based on current product lines
            populateMachineLineOptions();
            
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
                    if (machineDescriptionInput) {
                        machineDescriptionInput.value = machine.description || '';
                    }
                    
                    // Line selection will be handled after populateMachineLineOptions() is called
                    
                    // Handle line assignment type and additional lines
                    if (machine.line === 'Shared') {
                        document.querySelector('input[name="machineLineType"][value="shared"]').checked = true;
                        document.getElementById('specificLineOptions').style.display = 'none';
                    } else {
                        document.querySelector('input[name="machineLineType"][value="specific"]').checked = true;
                        document.getElementById('specificLineOptions').style.display = 'block';
                        
                        // Set primary line
                        if (machineLineSelect.options.length > 0) {
                            const lineOption = Array.from(machineLineSelect.options).find(opt => opt.value === machine.line);
                            if (lineOption) {
                                machineLineSelect.value = machine.line;
                            } else {
                                // Custom line not in dropdown
                                machineLineSelect.value = 'Other';
                                document.getElementById('machineOtherLineContainer').style.display = 'block';
                                document.getElementById('machineOtherLine').value = machine.line;
                                document.getElementById('machineOtherLine').required = true;
                            }
                        }
                        
                        // Set additional lines
                        if (machine.additionalLines && machine.additionalLines.length > 0) {
                            machine.additionalLines.forEach(line => {
                                const checkbox = document.getElementById(`additionalLine_${line}`);
                                if (checkbox) {
                                    checkbox.checked = true;
                                }
                            });
                        }
                        
                        // Update checkboxes after setting values
                        setTimeout(() => {
                            updateAdditionalLinesCheckboxes();
                        }, 100);
                    }
                    
                    machineAreaInput.value = machine.area;
                    
                    // Initialize SOP handlers and load SOP data
                    initializeSOPHandlers();
                    loadSOPData(machine);
                    
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
                
                // Reset "Other" line container for new machine
                const otherLineContainer = document.getElementById('machineOtherLineContainer');
                const otherLineInput = document.getElementById('machineOtherLine');
                if (otherLineContainer && otherLineInput) {
                    otherLineContainer.style.display = 'none';
                    otherLineInput.value = '';
                    otherLineInput.required = false;
                }
                
                // Initialize SOP handlers for new machine
                initializeSOPHandlers();
                loadSOPData({}); // Empty object for new machine
            }
            
            // Now handle line selection for edit modal (after dropdown is populated)
            if (id) {
                const machine = state.machines.find(m => m.id === id);
                if (machine && machine.line) {
                    const machineLine = machine.line;
                    const machineLineSelect = document.getElementById('machineLine');
                    if (machineLineSelect) {
                        const availableLines = Array.from(machineLineSelect.options).map(o => o.value).filter(Boolean);
                        if (availableLines.includes(machineLine)) {
                            machineLineSelect.value = machineLine;
                            // Hide the "Other" line field since we found the line in the dropdown
                            const otherLineContainer = document.getElementById('machineOtherLineContainer');
                            if (otherLineContainer) {
                                otherLineContainer.style.display = 'none';
                            }
                        } else {
                            machineLineSelect.value = 'Other';
                            const otherLineContainer = document.getElementById('machineOtherLineContainer');
                            const otherLineInput = document.getElementById('machineOtherLine');
                            if (otherLineContainer && otherLineInput) {
                                otherLineContainer.style.display = 'block';
                                otherLineInput.value = machineLine;
                                otherLineInput.required = true;
                            }
                        }
                    }
                }
            }
            
            document.getElementById('machineModal').style.display = 'flex';
}

export async function saveMachine(event) {
   event.preventDefault();
            const id = document.getElementById('machineId').value;
            const number = document.getElementById('machineNumber').value.trim();
            const name = document.getElementById('machineName').value.trim();
            const description = document.getElementById('machineDescription') ? document.getElementById('machineDescription').value.trim() : '';
            // Get line assignment type
            const lineTypeRadios = document.querySelectorAll('input[name="machineLineType"]');
            const selectedType = Array.from(lineTypeRadios).find(radio => radio.checked)?.value;
            
            let line = '';
            let additionalLines = [];
            
            if (selectedType === 'shared') {
                line = 'Shared';
            } else {
                const lineElement = document.getElementById('machineLine');
                if (!lineElement) {
                    showCustomAlert('Error', 'Machine line field not found. Please refresh the page to load the updated interface.');
                    return;
                }
                line = lineElement.value;
                
                // Handle custom line
                if (line === 'Other') {
                    const customLine = document.getElementById('machineOtherLine').value.trim();
                    if (!customLine) {
                        showCustomAlert('Validation Error', 'Please specify the custom line name.');
                        return;
                    }
                    line = customLine;
                }
                
                // Get additional lines
                const additionalCheckboxes = document.querySelectorAll('#additionalLinesContainer input[type="checkbox"]:checked');
                additionalLines = Array.from(additionalCheckboxes).map(cb => cb.value);
            }
            let stage = document.getElementById('machineStage').value;
            const area = parseInt(document.getElementById('machineArea').value, 10);
            
            // Get SOP data using the new enhanced functionality
            let cleaningSOPData;
            try {
                cleaningSOPData = getCurrentSOPData();
            } catch (error) {
                showCustomAlert('SOP Error', error.message);
                return;
            }
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
                    db.setItem('machineStageDisplayOrder', JSON.stringify(state.machineStageDisplayOrder)).catch(e => console.error('Error saving machine stage order:', e));
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
                    db.setItem('machineGroups', JSON.stringify(state.machineGroups)).catch(e => console.error('Error saving machine groups:', e));
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

            if (!number || !name || !line || !stage || isNaN(area) || !cleaningSOPData) {
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
            
            
            // Handle SOP file data
            const machineId = id ? parseInt(id, 10) : state.nextMachineId + 1;
            // Store SOP file in IndexedDB if it's an upload
            if (cleaningSOPData.attachmentType === 'upload' && cleaningSOPData.fileData && cleaningSOPData.fileName) {
                try {
                    console.log('Storing SOP file in IndexedDB for machine:', machineId);
                    await storeSOPFile(machineId.toString(), cleaningSOPData.fileName, cleaningSOPData.fileData);
                    
                    // Don't store fileData in the main machine object to keep it clean
                    // fileData is stored separately in IndexedDB sopFilesStore
                    delete cleaningSOPData.fileData;
                } catch (error) {
                    console.error('Error storing SOP file in IndexedDB:', error);
                }
            } else if (cleaningSOPData.attachmentType !== 'upload') {
                // Delete SOP file from IndexedDB if attachment type changed from upload
                try {
                    await deleteSOPFile(machineId.toString());
                } catch (error) {
                    console.error('Error deleting SOP file from IndexedDB:', error);
                }
            }
            
            // Ensure cleaningSOP object has all required fields before saving
            if (cleaningSOPData.attachmentType === 'upload' && !cleaningSOPData.fileName && cleaningSOPData.attachmentValue) {
                cleaningSOPData.fileName = cleaningSOPData.attachmentValue;
            }
            
            // IMPORTANT: Create a clean copy of SOP data WITHOUT fileData for the machine object
            // fileData is stored separately in IndexedDB sopFilesStore
            const cleanSOPDataForMachine = {
                sopName: cleaningSOPData.sopName,
                attachmentType: cleaningSOPData.attachmentType,
                attachmentValue: cleaningSOPData.attachmentValue,
                fileName: cleaningSOPData.fileName
                // DO NOT include fileData here - it's stored separately
            };
            
            if (id) { // Edit
                const machine = state.machines.find(m => m.id === parseInt(id));
                if (machine) {
                    // Preserve existing sampleLocations if they exist
                    const existingSampleLocations = machine.sampleLocations || [];
                    
                    machine.machineNumber = number;
                    machine.name = name;
                    machine.description = description;
                    machine.line = line;
                    machine.additionalLines = additionalLines;
                    machine.stage = stage;
                    machine.area = area;
                    machine.cleaningSOP = cleanSOPDataForMachine; // Use clean copy without fileData
                    machine.group = group || '';
                    machine.sampleLocations = existingSampleLocations; // Preserve sample locations
                    
                    console.log('Machine edited:', machine);
                } else {
                    console.error('Machine not found for editing:', id);
                    showCustomAlert('Error', 'Machine not found. Please refresh and try again.');
                    return;
                }
            } else { // Add
                state.setNextMachineId(state.nextMachineId+1);
                const newMachine = { 
                    id: state.nextMachineId, 
                    machineNumber: number, 
                    name: name,
                    description: description,
                    line: line, 
                    additionalLines: additionalLines,
                    stage: stage, 
                    area: area, 
                    cleaningSOP: cleanSOPDataForMachine, // Use clean copy without fileData
                    group: group || '',
                    sampleLocations: [] // Initialize empty array for new machines
                };
                state.machines.push(newMachine);
                console.log('Machine added:', newMachine);
            }
            
            // Log state before saving
            console.log('Machines state before save:', state.machines.length, 'machines');
            console.log('Machine being saved:', state.machines.find(m => id ? m.id === parseInt(id) : m.id === state.nextMachineId));
            
            // Save state (this calls saveAllDataToLocalStorage internally)
            saveStateForUndo();
            
            // Explicitly save to IndexedDB to ensure SOP files and sample locations are persisted
            // Make sure it's awaited so data is saved before continuing
            const ui = await import('./ui.js');
            console.log('Saving to IndexedDB...');
            await ui.saveAllDataToLocalStorage();
            console.log('Save to IndexedDB completed');
            
            // Verify save by reading back
            const savedMachines = await db.getItem('macoMachines');
            if (savedMachines) {
                const parsed = JSON.parse(savedMachines);
                console.log('Verified: Saved machines count:', parsed.length);
                const savedMachine = parsed.find(m => id ? m.id === parseInt(id) : m.id === state.nextMachineId);
                console.log('Verified: Saved machine:', savedMachine);
            }
            
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

export async function deleteMachine(id) {
    if (confirm("Are you sure you want to delete this machine? It will be removed from all products that use it.")) {
        // Delete SOP file from IndexedDB
        try {
            await deleteSOPFile(id.toString());
        } catch (error) {
            console.error('Error deleting SOP file from IndexedDB:', error);
        }
        
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
                // First, calculate the overall highest RPN among all products on this machine
                const toxicityPreference = getToxicityPreference();
                let overallHighestRPN = 0;
                
                assignedProducts.forEach(p => {
                    p.activeIngredients.forEach(ing => {
                        const scores = calculateScores(ing, toxicityPreference);
                        if (scores.rpn > overallHighestRPN) {
                            overallHighestRPN = scores.rpn;
                        }
                    });
                });
                
                let productListHTML = '<div class="divide-y" style="border-color: var(--border-color);">';
                assignedProducts.forEach((p, index) => {
                    const trainNumber = getProductTrainNumber(p);
                    const trainIdDisplay = trainNumber !== 'N/A' ? 'T' + trainNumber : 'N/A';
                    const criticalText = p.isCritical ? 'Yes' : 'No';
                    const criticalClass = p.isCritical ? 'text-red-600 font-bold' : '';
                    const dateFormatted = new Date(p.date).toLocaleDateString();
                    
                    // Calculate highest RPN for the product
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
                    const isHighestRPN = (highestRPN === overallHighestRPN);
                    
                    productListHTML += `
                        <div class="py-3 px-2">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-semibold text-lg">${p.name}</h4>
                                <span class="text-xs px-2 py-1 rounded" style="background-color: var(--bg-accent); color: var(--text-secondary);">${p.productCode}</span>
                            </div>
                            <div class="text-xs flex flex-wrap gap-4">
                                <span ><strong>${isHighestRPN ? 'Highest RPN:' : 'RPN:'}</strong> <span class="${rpnClass}" style="font-weight: bold;">${highestRPN.toFixed(1)}</span></span>
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

            // If machines have a 'line' property and the product has an assigned line,
            // only show machines belonging to that line. If no machines declare lines,
            // fall back to previous behavior.
            const machinesHaveLine = state.machines.some(m => m.line !== undefined && m.line !== null);
            const productLine = product.line ? String(product.line).trim() : null;

            state.machineStageDisplayOrder.forEach(stage => {
                let machinesInStage = state.machines.filter(m => m.stage === stage);
                if (machinesHaveLine && productLine) {
                    // Show machines from the same line OR shared machines OR machines with additional lines
                    machinesInStage = machinesInStage.filter(m => {
                        const machineLine = String(m.line || '').trim();
                        const isShared = machineLine === "Shared";
                        const isSameLine = machineLine === productLine;
                        const hasAdditionalLine = m.additionalLines && m.additionalLines.includes(productLine);
                        return isSameLine || isShared || hasAdditionalLine;
                    });
                }
                
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

            // Filter products by line if both machines and products have line properties
            const machinesHaveLine = state.machines.some(m => m.line !== undefined && m.line !== null);
            const machineLine = machine.line ? String(machine.line).trim() : null;
            
            let availableProducts = state.products;
            if (machinesHaveLine && machineLine) {
                // Only show products from the same line, or products without a line (for backward compatibility)
                availableProducts = state.products.filter(p => {
                    const productLine = p.line ? String(p.line).trim() : null;
                    return !productLine || productLine === machineLine || machineLine === "Shared";
                });
            }

            if (availableProducts.length > 0) {
                noProductsMsg.style.display = 'none';
                listContainer.style.display = 'block';
                saveBtn.style.display = 'block';

                availableProducts.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
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
                const message = state.products.length === 0 
                    ? 'There are no products registered in the system.'
                    : `No products available for line "${machineLine}". Products must be from the same line as the machine.`;
                noProductsMsg.textContent = message;
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

// Toggle line section visibility
window.toggleLineSection = function(lineKey) {
    const lineElement = document.getElementById(`line-${lineKey}`);
    const button = event.target;
    
    if (lineElement.style.display === 'none') {
        lineElement.style.display = 'block';
        button.textContent = 'Hide';
        db.setItem(`machineLine-${lineKey}-hidden`, 'false').catch(e => console.error('Error saving line visibility:', e));
    } else {
        lineElement.style.display = 'none';
        button.textContent = 'Show';
        db.setItem(`machineLine-${lineKey}-hidden`, 'true').catch(e => console.error('Error saving line visibility:', e));
    }
};

// Show machine summary modal
window.showMachineSummary = function(line) {
    const modal = document.getElementById('machineSummaryModal');
    const modalTitle = document.getElementById('machineSummaryModalTitle');
    const modalContent = document.getElementById('machineSummaryContent');
    
    // Set modal title
    modalTitle.textContent = `${line} - Machine Summary`;
    
    // Get machines for this line
    const lineMachines = state.machines.filter(machine => machine.line === line);
    
    if (lineMachines.length === 0) {
        modalContent.innerHTML = '<p class="text-center text-gray-500">No machines found for this line.</p>';
        showModal('machineSummaryModal');
        return;
    }
    
    // Calculate summary data
    const summaryData = calculateMachineSummary(lineMachines);
    
    // Generate summary HTML
    let summaryHTML = `
        <!-- Shared Worst Case Groups -->
        <div class="card p-4 mb-6">
            <h4 class="text-lg font-semibold mb-4 text-blue-600">Machines Sharing Same Worst Case Products</h4>
            <div class="overflow-hidden rounded-lg border" style="border-color: var(--border-color);">
                <table class="w-full text-sm">
                    <thead class="bg-gray-200 dark:bg-gray-700">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Product</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Ingredient</th>
                            <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">RPN</th>
                            <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Shared Machines</th>
                        </tr>
                    </thead>
                    <tbody style="border-color: var(--border-color); background-color: var(--bg-secondary);">
    `;
    
    if (summaryData.sharedWorstCaseGroups.length > 0) {
        summaryData.sharedWorstCaseGroups.forEach(group => {
            summaryHTML += `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50" style="border-color: var(--border-color);">
                    <td class="px-4 py-3 font-semibold" style="color: var(--text-primary);">${group.productName}</td>
                    <td class="px-4 py-3" style="color: var(--text-primary);">${group.ingredient}</td>
                    <td class="px-4 py-3 text-center" style="color: var(--text-primary);">
                        <span class="px-2 py-1 rounded text-sm font-bold" style="background-color: var(--bg-accent); color: var(--text-primary);">
                            ${group.isHighestRpn ? 'Highest RPN: ' : 'RPN: '}${group.rpn}
                        </span>
                    </td>
                    <td class="px-4 py-3" style="color: var(--text-primary);">
                        <div class="flex flex-wrap gap-1">
                            ${group.machines.map(machineName => {
                                const machine = lineMachines.find(m => m.name === machineName);
                                const groupInfo = machine && machine.group ? ` (${machine.group})` : '';
                                return `<span class="px-2 py-1 rounded border text-xs" style="border-color: var(--border-color); background-color: var(--bg-secondary);">${machineName}<strong>${groupInfo}</strong></span>`;
                            }).join('')}
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        summaryHTML += `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">No shared groups found</td>
            </tr>
        `;
    }
    
    summaryHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    modalContent.innerHTML = summaryHTML;
    showModal('machineSummaryModal');
};

// Calculate machine summary data
function calculateMachineSummary(machines) {
    const summary = {
        worstCaseProducts: [],
        specialCases: [],
        totalMachines: machines.length,
        totalArea: 0,
        avgProductsPerMachine: 0,
        machineWorstCases: {},
        sharedWorstCaseGroups: []
    };
    
    let totalProducts = 0;
    
    machines.forEach(machine => {
        summary.totalArea += machine.area;
        
        const assignedProducts = state.products.filter(p => p.machineIds && p.machineIds.includes(machine.id));
        totalProducts += assignedProducts.length;
        
        // Find worst case product for this machine
        let worstProduct = null;
        let maxRpn = -1;
        
        assignedProducts.forEach(product => {
            product.activeIngredients.forEach(ingredient => {
                const { rpn } = calculateScores(ingredient);
                if (rpn > maxRpn) {
                    maxRpn = rpn;
                    worstProduct = {
                        name: product.name,
                        rpn: rpn,
                        ingredient: ingredient.name,
                        productId: product.id
                    };
                }
            });
        });
        
        if (worstProduct) {
            summary.machineWorstCases[machine.id] = worstProduct;
        }
    });
    
    // Group machines by their worst case product
    const productGroups = {};
    Object.keys(summary.machineWorstCases).forEach(machineId => {
        const worstCase = summary.machineWorstCases[machineId];
        const key = `${worstCase.productId}-${worstCase.ingredient}`;
        
        if (!productGroups[key]) {
            productGroups[key] = {
                productName: worstCase.name,
                ingredient: worstCase.ingredient,
                rpn: worstCase.rpn,
                machines: []
            };
        }
        
        const machine = machines.find(m => m.id == machineId);
        if (machine) {
            productGroups[key].machines.push(machine.name);
        }
    });
    
    // Convert to array and sort by RPN
    summary.sharedWorstCaseGroups = Object.values(productGroups)
        .sort((a, b) => b.rpn - a.rpn);
    
    // Mark the highest RPN groups (all groups with the same highest RPN value)
    if (summary.sharedWorstCaseGroups.length > 0) {
        const highestRpn = summary.sharedWorstCaseGroups[0].rpn;
        summary.sharedWorstCaseGroups.forEach(group => {
            group.isHighestRpn = (group.rpn === highestRpn);
        });
    }
    
    // Collect all worst case products
    const allWorstCases = Object.values(summary.machineWorstCases);
    summary.worstCaseProducts = allWorstCases.sort((a, b) => b.rpn - a.rpn);
    
    // Find special cases (high RPN products)
    summary.specialCases = summary.worstCaseProducts.filter(product => product.rpn >= 100);
    
    summary.avgProductsPerMachine = totalProducts / machines.length;
    
    return summary;
}

// ========== SOP MANAGEMENT FUNCTIONS ==========

/**
 * Format Sample Locations display for machine table
 */
function formatSampleLocationsDisplay(machine) {
    const locations = machine.sampleLocations || [];
    const locationCount = locations.length;
    
    let html = `<div class="flex items-center justify-center">`;
    if (locationCount > 0) {
        html += `
            <button onclick="openSampleLocationsManager(${machine.id})" class="p-1 text-purple-600" title="Manage Sample Locations (${locationCount} location${locationCount !== 1 ? 's' : ''})">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <!-- Horizontal Serpentine Scan Pattern -->
                    <path d="M2 2 L14 2 M14 2 L14 5 M14 5 L2 5 M2 5 L2 8 M2 8 L14 8 M14 8 L14 11 M14 11 L2 11 M2 11 L2 14 M2 14 L14 14"/>
                    <!-- Right arrows -->
                    <path d="M12 2 L14 2" stroke-width="1.5"/>
                    <polygon points="13,1 14,2 13,3" fill="currentColor"/>
                    <path d="M12 8 L14 8" stroke-width="1.5"/>
                    <polygon points="13,7 14,8 13,9" fill="currentColor"/>
                    <path d="M12 14 L14 14" stroke-width="1.5"/>
                    <polygon points="13,13 14,14 13,15" fill="currentColor"/>
                    <!-- Left arrows -->
                    <path d="M4 5 L2 5" stroke-width="1.5"/>
                    <polygon points="3,4 2,5 3,6" fill="currentColor"/>
                    <path d="M4 11 L2 11" stroke-width="1.5"/>
                    <polygon points="3,10 2,11 3,12" fill="currentColor"/>
                </svg>
            </button>`;
    } else {
        html += `
            <button onclick="openSampleLocationsManager(${machine.id})" class="p-1 text-purple-600" title="Add Sample Locations">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    <!-- Horizontal Serpentine Scan Pattern -->
                    <path d="M2 2 L14 2 M14 2 L14 5 M14 5 L2 5 M2 5 L2 8 M2 8 L14 8 M14 8 L14 11 M14 11 L2 11 M2 11 L2 14 M2 14 L14 14"/>
                    <!-- Right arrows -->
                    <path d="M12 2 L14 2" stroke-width="1.5"/>
                    <polygon points="13,1 14,2 13,3" fill="currentColor"/>
                    <path d="M12 8 L14 8" stroke-width="1.5"/>
                    <polygon points="13,7 14,8 13,9" fill="currentColor"/>
                    <path d="M12 14 L14 14" stroke-width="1.5"/>
                    <polygon points="13,13 14,14 13,15" fill="currentColor"/>
                    <!-- Left arrows -->
                    <path d="M4 5 L2 5" stroke-width="1.5"/>
                    <polygon points="3,4 2,5 3,6" fill="currentColor"/>
                    <path d="M4 11 L2 11" stroke-width="1.5"/>
                    <polygon points="3,10 2,11 3,12" fill="currentColor"/>
                </svg>
            </button>`;
    }
    html += `</div>`;
    return html;
}

/**
 * Format SOP display for machine table
 */
function formatSOPDisplay(sopData, machineId) {
    if (!sopData) return '';
    
    // Handle legacy string format
    if (typeof sopData === 'string') {
        return sopData;
    }
    
    // Handle new format with sopName + attachment
    if (sopData.sopName) {
        let display = sopData.sopName;
        let clickableContent = '';
        
        switch (sopData.attachmentType) {
            case 'upload':
                if (sopData.fileName) {
                    clickableContent = `<span class="sop-attachment-link" onclick="openMachineSOPFile(${machineId})" title="Click to open: ${sopData.fileName}" style="cursor: pointer; color: #1976d2; text-decoration: none;"> 📎</span>`;
                    display += clickableContent;
                }
                break;
            case 'link':
                if (sopData.attachmentValue) {
                    clickableContent = `<span class="sop-attachment-link" onclick="openMachineSOPFile(${machineId})" title="Click to open link" style="cursor: pointer; color: #1976d2; text-decoration: none;"> 🔗</span>`;
                    display += clickableContent;
                }
                break;
            // 'none' or no attachment - just show the name
        }
        
        return display;
    }
    
    // Handle old object format (backwards compatibility)
    switch (sopData.type) {
        case 'text':
            return sopData.value || '';
        case 'upload':
            const fileName = sopData.fileName || 'File Attached';
            return `<span class="sop-attachment-link" onclick="openMachineSOPFile(${machineId})" title="Click to open: ${fileName}" style="cursor: pointer; color: #1976d2; text-decoration: none;">📎</span> ${fileName}`;
        case 'link':
            const linkText = sopData.value || '';
            const shortLink = linkText.length > 30 ? linkText.substring(0, 30) + '...' : linkText;
            return `<span class="sop-attachment-link" onclick="openMachineSOPFile(${machineId})" title="Click to open link" style="cursor: pointer; color: #1976d2; text-decoration: none;">🔗</span> ${shortLink}`;
        default:
            return sopData.value || '';
    }
}

/**
 * Initialize SOP method selection handlers
 */
export function initializeSOPHandlers() {
    const attachmentMethodRadios = document.querySelectorAll('input[name="sopAttachmentMethod"]');
    
    attachmentMethodRadios.forEach(radio => {
        radio.addEventListener('change', handleSOPAttachmentMethodChange);
    });
}

/**
 * Handle SOP attachment method selection change
 */
function handleSOPAttachmentMethodChange(event) {
    const selectedMethod = event.target.value;
    
    // Hide all sections
    document.getElementById('sopNoAttachmentSection').style.display = 'none';
    document.getElementById('sopUploadSection').style.display = 'none';
    document.getElementById('sopLinkSection').style.display = 'none';
    
    // Show selected section and manage required fields
    switch (selectedMethod) {
        case 'none':
            document.getElementById('sopNoAttachmentSection').style.display = 'block';
            document.getElementById('sopFileUpload').required = false;
            document.getElementById('sopFileLink').required = false;
            break;
        case 'upload':
            document.getElementById('sopUploadSection').style.display = 'block';
            document.getElementById('sopFileUpload').required = false; // Will validate manually
            document.getElementById('sopFileLink').required = false;
            break;
        case 'link':
            document.getElementById('sopLinkSection').style.display = 'block';
            document.getElementById('sopFileUpload').required = false;
            document.getElementById('sopFileLink').required = true;
            break;
    }
}

/**
 * Handle SOP file upload
 */
function handleSOPFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
        showCustomAlert('Invalid File Type', 
            'Please upload a PDF, DOC, DOCX, or TXT file.');
        event.target.value = '';
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showCustomAlert('File Too Large', 
            'File size must be less than 10MB.');
        event.target.value = '';
        return;
    }
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = function(e) {
        currentSOPFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            data: e.target.result
        };
        
        // Update UI
        document.getElementById('sopUploadArea').style.display = 'none';
        document.getElementById('sopUploadedFile').style.display = 'block';
        document.getElementById('sopFileName').textContent = file.name;
    };
    reader.onerror = function() {
        showCustomAlert('Upload Error', 'Failed to read the file.');
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

/**
 * Remove uploaded SOP file
 */
function removeSOPFile() {
    currentSOPFile = null;
    document.getElementById('sopFileUpload').value = '';
    document.getElementById('sopUploadArea').style.display = 'block';
    document.getElementById('sopUploadedFile').style.display = 'none';
    document.getElementById('sopFileName').textContent = '';
}

/**
 * Load existing SOP data into the form
 */
async function loadSOPData(machine) {
    // Reset form
    document.getElementById('sopAttachmentNone').checked = true;
    document.getElementById('currentSOPDisplay').style.display = 'none';
    handleSOPAttachmentMethodChange({ target: { value: 'none' } });
    
    // Clear any previous data
    currentSOPFile = null;
    currentSOPData = null;
    removeSOPFile();
    
    if (!machine.cleaningSOP) {
        // New machine - set empty values
        document.getElementById('sopName').value = '';
        return;
    }
    
    if (typeof machine.cleaningSOP === 'string') {
        // Legacy format - convert to new format
        document.getElementById('sopName').value = machine.cleaningSOP;
        return;
    }
    
    // Handle new format
    const sopData = machine.cleaningSOP;
    currentSOPData = sopData;
    
    // Set SOP name (always required)
    document.getElementById('sopName').value = sopData.sopName || '';
    
    // Set attachment method and data
    switch (sopData.attachmentType) {
        case 'none':
            document.getElementById('sopAttachmentNone').checked = true;
            handleSOPAttachmentMethodChange({ target: { value: 'none' } });
            break;
            
        case 'upload':
            if (sopData.fileName) {
                document.getElementById('sopAttachmentUpload').checked = true;
                handleSOPAttachmentMethodChange({ target: { value: 'upload' } });
                
                // Try to load file from IndexedDB first, then fall back to machine object
                let fileData = sopData.fileData;
                if (!fileData && machine.id) {
                    try {
                        const sopFile = await getSOPFile(machine.id.toString());
                        if (sopFile && sopFile.fileData) {
                            fileData = sopFile.fileData;
                            // Update machine object with file data for immediate access
                            sopData.fileData = fileData;
                        }
                    } catch (error) {
                        console.error('Error loading SOP file from IndexedDB:', error);
                    }
                }
                
                if (fileData) {
                    // Show existing file
                    currentSOPFile = {
                        name: sopData.fileName,
                        data: fileData
                    };
                    document.getElementById('sopUploadArea').style.display = 'none';
                    document.getElementById('sopUploadedFile').style.display = 'block';
                    document.getElementById('sopFileName').textContent = sopData.fileName;
                } else {
                    // File not found - show warning but allow editing
                    console.warn('SOP file data not found for machine', machine.id);
                }
            }
            break;
            
        case 'link':
            document.getElementById('sopAttachmentLink').checked = true;
            document.getElementById('sopFileLink').value = sopData.attachmentValue || '';
            handleSOPAttachmentMethodChange({ target: { value: 'link' } });
            break;
            
        default:
            // Legacy or text format
            document.getElementById('sopAttachmentNone').checked = true;
            handleSOPAttachmentMethodChange({ target: { value: 'none' } });
    }
    
    // Show current SOP display if editing
    if (sopData.sopName || sopData.fileName || sopData.attachmentValue) {
        showCurrentSOPDisplay(sopData);
    }
}

/**
 * Show current SOP display for existing machines
 */
function showCurrentSOPDisplay(sopData) {
    const currentSOPDisplay = document.getElementById('currentSOPDisplay');
    const currentSOPText = document.getElementById('currentSOPText');
    const openSOPBtn = document.getElementById('openSOPBtn');
    
    currentSOPDisplay.style.display = 'block';
    
    // Handle new format
    if (sopData.sopName) {
        let displayText = `SOP: ${sopData.sopName}`;
        
        switch (sopData.attachmentType) {
            case 'upload':
                if (sopData.fileName) {
                    displayText += ` (📎 ${sopData.fileName})`;
                    openSOPBtn.style.display = 'inline-block';
                } else {
                    openSOPBtn.style.display = 'none';
                }
                break;
            case 'link':
                if (sopData.attachmentValue) {
                    displayText += ` (🔗 Link attached)`;
                    openSOPBtn.style.display = 'inline-block';
                } else {
                    openSOPBtn.style.display = 'none';
                }
                break;
            default:
                openSOPBtn.style.display = 'none';
        }
        
        currentSOPText.textContent = displayText;
        return;
    }
    
    // Handle legacy format
    if (typeof sopData === 'string') {
        currentSOPText.textContent = `SOP: ${sopData}`;
        openSOPBtn.style.display = 'none';
        return;
    }
    
    // Handle old format (backwards compatibility)
    switch (sopData.type) {
        case 'text':
            currentSOPText.textContent = `SOP Reference: ${sopData.value}`;
            openSOPBtn.style.display = 'none';
            break;
        case 'upload':
            currentSOPText.textContent = `Uploaded File: ${sopData.fileName}`;
            openSOPBtn.style.display = 'inline-block';
            break;
        case 'link':
            currentSOPText.textContent = `File Link: ${sopData.value}`;
            openSOPBtn.style.display = 'inline-block';
            break;
        default:
            currentSOPText.textContent = `SOP: ${sopData}`;
            openSOPBtn.style.display = 'none';
    }
}

/**
 * Get current SOP data from form
 */
function getCurrentSOPData() {
    // Get SOP name (always required)
    const sopName = document.getElementById('sopName').value.trim();
    if (!sopName) {
        throw new Error('Please enter a SOP name/reference.');
    }
    
    // Get attachment method
    const selectedAttachmentMethod = document.querySelector('input[name="sopAttachmentMethod"]:checked').value;
    
    const sopData = {
        sopName: sopName,
        attachmentType: selectedAttachmentMethod
    };
    
    switch (selectedAttachmentMethod) {
        case 'none':
            sopData.attachmentValue = null;
            sopData.fileName = null;
            sopData.fileData = null;
            break;
            
        case 'upload':
            if (!currentSOPFile) {
                throw new Error('Please upload a SOP file.');
            }
            sopData.attachmentValue = currentSOPFile.name;
            sopData.fileName = currentSOPFile.name;
            sopData.fileData = currentSOPFile.data;
            break;
            
        case 'link':
            const linkValue = document.getElementById('sopFileLink').value.trim();
            if (!linkValue) {
                throw new Error('Please enter a file link or path.');
            }
            sopData.attachmentValue = linkValue;
            sopData.fileName = null;
            sopData.fileData = null;
            break;
            
        default:
            throw new Error('Please select an attachment method.');
    }
    
    return sopData;
}

/**
 * Open current SOP (for files and links)
 */
function openCurrentSOP() {
    if (!currentSOPData) return;
    
    // Handle new format
    if (currentSOPData.attachmentType) {
        switch (currentSOPData.attachmentType) {
            case 'upload':
                if (currentSOPData.fileData) {
                    try {
                        // Determine MIME type based on file extension
                        const fileName = currentSOPData.fileName || '';
                        const extension = fileName.toLowerCase().split('.').pop();
                        let mimeType = 'application/octet-stream'; // Default fallback
                        
                        switch (extension) {
                            case 'pdf':
                                mimeType = 'application/pdf';
                                break;
                            case 'doc':
                                mimeType = 'application/msword';
                                break;
                            case 'docx':
                                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                break;
                            case 'txt':
                                mimeType = 'text/plain';
                                break;
                        }
                        
                        // Create blob URL and open in new tab
                        const byteCharacters = atob(currentSOPData.fileData.split(',')[1]);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        
                        // Clean up the URL after a delay
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                    } catch (error) {
                        console.error('Error opening SOP file:', error);
                        showCustomAlert('Error', 'Unable to open the SOP file. The file may be corrupted.');
                    }
                }
                break;
                
            case 'link':
                if (currentSOPData.attachmentValue) {
                    // Try to open as URL first
                    try {
                        if (currentSOPData.attachmentValue.startsWith('http://') || currentSOPData.attachmentValue.startsWith('https://')) {
                            window.open(currentSOPData.attachmentValue, '_blank');
                        } else {
                            // For file paths, try to open with file protocol
                            window.open('file:///' + currentSOPData.attachmentValue.replace(/\\/g, '/'), '_blank');
                        }
                    } catch (error) {
                        showCustomAlert('Cannot Open File', 
                            'Unable to open the linked file. Please check the file path or URL.');
                    }
                }
                break;
        }
        return;
    }
    
    // Handle old format (backwards compatibility)
    switch (currentSOPData.type) {
        case 'upload':
            if (currentSOPData.fileData) {
                try {
                    // Determine MIME type based on file extension
                    const fileName = currentSOPData.fileName || '';
                    const extension = fileName.toLowerCase().split('.').pop();
                    let mimeType = 'application/octet-stream'; // Default fallback
                    
                    switch (extension) {
                        case 'pdf':
                            mimeType = 'application/pdf';
                            break;
                        case 'doc':
                            mimeType = 'application/msword';
                            break;
                        case 'docx':
                            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                            break;
                        case 'txt':
                            mimeType = 'text/plain';
                            break;
                    }
                    
                    // Create blob URL and open in new tab
                    const byteCharacters = atob(currentSOPData.fileData.split(',')[1]);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    
                    // Clean up the URL after a delay
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                } catch (error) {
                    console.error('Error opening SOP file:', error);
                    showCustomAlert('Error', 'Unable to open the SOP file. The file may be corrupted.');
                }
            }
            break;
            
        case 'link':
            if (currentSOPData.value) {
                // Try to open as URL first
                try {
                    if (currentSOPData.value.startsWith('http://') || currentSOPData.value.startsWith('https://')) {
                        window.open(currentSOPData.value, '_blank');
                    } else {
                        // For file paths, try to open with file protocol
                        window.open('file:///' + currentSOPData.value.replace(/\\/g, '/'), '_blank');
                    }
                } catch (error) {
                    showCustomAlert('Cannot Open File', 
                        'Unable to open the linked file. Please check the file path or URL.');
                }
            }
            break;
    }
}

/**
 * Edit current SOP
 */
function editCurrentSOP() {
    document.getElementById('currentSOPDisplay').style.display = 'none';
}

/**
 * Open SOP file for a specific machine (from the machine table)
 */
window.openMachineSOPFile = async function(machineId) {
    const machine = state.machines.find(m => m.id === machineId);
    if (!machine || !machine.cleaningSOP) {
        showCustomAlert('No SOP Found', 'No SOP file is attached to this machine.');
        return;
    }
    
    const sopData = machine.cleaningSOP;
    
    // Handle new format
    if (sopData.attachmentType) {
        switch (sopData.attachmentType) {
            case 'upload':
                // Try to get file data from machine object first, then IndexedDB
                let fileData = sopData.fileData;
                if (!fileData) {
                    try {
                        const sopFile = await getSOPFile(machineId.toString());
                        if (sopFile && sopFile.fileData) {
                            fileData = sopFile.fileData;
                            // Update machine object for future access
                            sopData.fileData = fileData;
                        }
                    } catch (error) {
                        console.error('Error loading SOP file from IndexedDB:', error);
                    }
                }
                
                if (fileData) {
                    try {
                        // Determine MIME type based on file extension
                        const fileName = sopData.fileName || '';
                        const extension = fileName.toLowerCase().split('.').pop();
                        let mimeType = 'application/octet-stream'; // Default fallback
                        
                        switch (extension) {
                            case 'pdf':
                                mimeType = 'application/pdf';
                                break;
                            case 'doc':
                                mimeType = 'application/msword';
                                break;
                            case 'docx':
                                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                break;
                            case 'txt':
                                mimeType = 'text/plain';
                                break;
                        }
                        
                        // Create blob URL and open in new tab
                        const byteCharacters = atob(fileData.split(',')[1]);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        
                        // Clean up the URL after a delay
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                    } catch (error) {
                        console.error('Error opening SOP file:', error);
                        showCustomAlert('Error', 'Unable to open the SOP file. The file may be corrupted.');
                    }
                } else {
                    showCustomAlert('No File Found', 'No file data is available for this SOP.');
                }
                break;
                
            case 'link':
                if (sopData.attachmentValue) {
                    try {
                        // Try to open as URL first
                        if (sopData.attachmentValue.startsWith('http://') || sopData.attachmentValue.startsWith('https://')) {
                            window.open(sopData.attachmentValue, '_blank');
                        } else {
                            // For file paths, try to open with file protocol
                            window.open('file:///' + sopData.attachmentValue.replace(/\\/g, '/'), '_blank');
                        }
                    } catch (error) {
                        console.error('Error opening SOP link:', error);
                        showCustomAlert('Cannot Open Link', 
                            'Unable to open the linked file. Please check the file path or URL.');
                    }
                } else {
                    showCustomAlert('No Link Found', 'No link is available for this SOP.');
                }
                break;
                
            case 'none':
            default:
                showCustomAlert('No Attachment', 'This SOP has no attached file or link.');
                break;
        }
        return;
    }
    
    // Handle old format (backwards compatibility)
    switch (sopData.type) {
        case 'upload':
            if (sopData.fileData) {
                try {
                    // Determine MIME type based on file extension
                    const fileName = sopData.fileName || '';
                    const extension = fileName.toLowerCase().split('.').pop();
                    let mimeType = 'application/octet-stream'; // Default fallback
                    
                    switch (extension) {
                        case 'pdf':
                            mimeType = 'application/pdf';
                            break;
                        case 'doc':
                            mimeType = 'application/msword';
                            break;
                        case 'docx':
                            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                            break;
                        case 'txt':
                            mimeType = 'text/plain';
                            break;
                    }
                    
                    // Create blob URL and open in new tab
                    const byteCharacters = atob(sopData.fileData.split(',')[1]);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    
                    // Clean up the URL after a delay
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                } catch (error) {
                    console.error('Error opening SOP file:', error);
                    showCustomAlert('Error', 'Unable to open the SOP file. The file may be corrupted.');
                }
            } else {
                showCustomAlert('No File Found', 'No file data is available for this SOP.');
            }
            break;
            
        case 'link':
            if (sopData.value) {
                try {
                    // Try to open as URL first
                    if (sopData.value.startsWith('http://') || sopData.value.startsWith('https://')) {
                        window.open(sopData.value, '_blank');
                    } else {
                        // For file paths, try to open with file protocol
                        window.open('file:///' + sopData.value.replace(/\\/g, '/'), '_blank');
                    }
                } catch (error) {
                    console.error('Error opening SOP link:', error);
                    showCustomAlert('Cannot Open Link', 
                        'Unable to open the linked file. Please check the file path or URL.');
                }
            } else {
                showCustomAlert('No Link Found', 'No link is available for this SOP.');
            }
            break;
            
        case 'text':
        default:
            showCustomAlert('No Attachment', 'This SOP is a text reference only with no attached file.');
            break;
    }
};

// Calculate RPN for a sample location
function calculateLocationRPN(location) {
    // RPN = Hard to Clean × Accessibility × Visibility
    // Support both old format (accessibilityForCleaning/accessibilityForSampling) and new format (accessibility)
    const accessibility = location.accessibility || (location.accessibilityForCleaning && location.accessibilityForSampling ? 
        Math.max(location.accessibilityForCleaning, location.accessibilityForSampling) : 2);
    return (location.hardToClean || 2) * accessibility * (location.visibility || 2);
}

// Determine number of samples based on RPN using the scoring criteria
function getNumberOfSamples(rpn) {
    // Synchronous fallback based on standard ranges
    if (rpn >= 1 && rpn <= 27) return 1;
    else if (rpn >= 36 && rpn <= 54) return 2;
    else if (rpn >= 81) return 3;
    else return 1; // Default
}

// Generate Cleaning Protocol for a machine
export async function generateSampleLocationReport(machineId) {
    import('./ui.js').then(async ui => {
        const { showLoader, hideLoader, showCustomAlert } = ui;
        
        showLoader();
        
        try {
            const machine = state.machines.find(m => m.id === parseInt(machineId));
            if (!machine) {
                throw new Error('Machine not found');
            }
            
            if (!machine.sampleLocations || machine.sampleLocations.length === 0) {
                showCustomAlert("No Sample Locations", `No sample locations defined for ${machine.name}. Please add sample locations first.`);
                hideLoader();
                return;
            }
            
            // Get products assigned to this machine
            const assignedProducts = state.products.filter(p => p.machineIds && p.machineIds.includes(parseInt(machineId)));
            
            // Calculate worst-case product (highest RPN)
            let worstCaseProduct = null;
            let worstCaseRPN = 0;
            let worstCaseAPI = '';
            const productsWithRPN = assignedProducts.map(product => {
                let maxRPN = 0;
                let worstIngredient = null;
                if (product.activeIngredients && product.activeIngredients.length > 0) {
                    product.activeIngredients.forEach(ing => {
                        try {
                            const scores = calculateScores(ing);
                            if (scores.rpn > maxRPN) {
                                maxRPN = scores.rpn;
                                worstIngredient = ing;
                            }
                        } catch (e) {
                            console.warn('Error calculating RPN:', e);
                        }
                    });
                }
                if (maxRPN > worstCaseRPN) {
                    worstCaseRPN = maxRPN;
                    worstCaseProduct = product;
                    worstCaseAPI = worstIngredient?.name || '';
                }
                return { ...product, rpn: maxRPN, worstIngredient };
            });
            
            // Get sample guidelines from scoring system
            const sampleGuidelines = state.scoringCriteria.numberOfSamples?.criteria || [];
            const guidelinesText = sampleGuidelines.map(criterion => {
                if (criterion.rpnMin === criterion.rpnMax) {
                    return `${criterion.rpnMin} RPN = ${criterion.samples} Sample${criterion.samples !== 1 ? 's' : ''}`;
                } else {
                    return `${criterion.rpnMin}-${criterion.rpnMax} RPN = ${criterion.samples} Sample${criterion.samples !== 1 ? 's' : ''}`;
                }
            }).join(' | ');
            
            // Get SOP information
            const sopName = machine.cleaningSOP?.sopName || 'Not specified';
            const sopAttachment = machine.cleaningSOP?.attachmentType || 'none';
            const sopValue = machine.cleaningSOP?.value || machine.cleaningSOP?.attachmentValue || '';
            
            // Protocol settings (defaults - can be configured later)
            const protocolSettings = {
                companyName: 'Pharmaceutical Company',
                companyAddress: 'Address not specified',
                docNo: `CLV-${machine.machineNumber || machine.id.toString().padStart(3, '0')}`,
                formNo: 'F1-VD-006',
                issuedNo: '01',
                preparedByName: 'Validation Engineer',
                preparedByTitle: 'Validation Engineer',
                reviewedByName: 'Validation Manager',
                reviewedByTitle: 'Validation Manager',
                qcManagerName: 'QC Manager',
                productionManagerName: 'Production Manager',
                qaManagerName: 'QA Manager',
                detergentName: 'Alconox',
                detergentConcentration: '1% w/v',
                detergentSupplier: 'Alconox Inc.',
                acceptanceCriteria: {
                    visualInspection: 'No visible residue',
                    residualAPI: 'As per MAC calculation',
                    cleansingAgent: '≤ 10 ppm',
                    phMin: '6.0',
                    phMax: '8.0',
                    conductivity: '< 5 μS/cm',
                    toc: '< 500 ppb',
                    microbial: '< 10 CFU/25 cm²'
                }
            };
            
            // Calculate MACO if worst-case product exists
            let macoCalculation = null;
            let macoValue = null;
            let macoMethod = 'Not calculated';
            if (worstCaseProduct && worstCaseProduct.activeIngredients && worstCaseProduct.activeIngredients.length > 0) {
                const worstIngredient = worstCaseProduct.activeIngredients.find(ing => ing.name === worstCaseAPI) || worstCaseProduct.activeIngredients[0];
                const swabArea = 25; // cm² (standard)
                const sharedArea = machine.area || 1;
                
                // Get safety factor based on product type
                const sfConfig = getSafetyFactorForDosageForm(worstCaseProduct.productType || 'Tablets');
                const safetyFactor = sfConfig.max;
                
                // Find minimum batch size from other products
                const otherProducts = assignedProducts.filter(p => p.id !== worstCaseProduct.id);
                const minBatchSize = otherProducts.length > 0 
                    ? Math.min(...otherProducts.map(p => p.batchSizeKg * 1000)) 
                    : worstCaseProduct.batchSizeKg * 1000;
                
                // Calculate MACO using HBEL method if PDE available
                if (worstIngredient.pde !== null && worstIngredient.pde !== undefined) {
                    macoValue = (worstIngredient.pde * minBatchSize * swabArea) / (safetyFactor * sharedArea);
                    macoMethod = 'HBEL Method';
                    macoCalculation = {
                        method: 'HBEL',
                        formula: `MAC = (HBEL × Min Batch Size × Swab Area) / (Safety Factor × Shared Surface Area)`,
                        calculation: `MAC = (${worstIngredient.pde} × ${minBatchSize.toLocaleString()} × ${swabArea}) / (${safetyFactor} × ${sharedArea.toLocaleString()})`,
                        result: macoValue,
                        hbel: worstIngredient.pde,
                        minBatchSize: minBatchSize,
                        swabArea: swabArea,
                        safetyFactor: safetyFactor,
                        sharedArea: sharedArea
                    };
                } else {
                    // Use therapeutic dose method
                    const macoDose = (worstIngredient.therapeuticDose * minBatchSize) / (safetyFactor * worstIngredient.mdd);
                    macoValue = (macoDose * swabArea) / sharedArea;
                    macoMethod = 'Therapeutic Dose Method';
                    macoCalculation = {
                        method: 'Therapeutic',
                        formula: `MAC = (TD × Min Batch Size × Swab Area) / (Safety Factor × MDD × Shared Surface Area)`,
                        calculation: `MAC = (${worstIngredient.therapeuticDose} × ${minBatchSize.toLocaleString()} × ${swabArea}) / (${safetyFactor} × ${worstIngredient.mdd} × ${sharedArea.toLocaleString()})`,
                        result: macoValue,
                        therapeuticDose: worstIngredient.therapeuticDose,
                        minBatchSize: minBatchSize,
                        swabArea: swabArea,
                        safetyFactor: safetyFactor,
                        mdd: worstIngredient.mdd,
                        sharedArea: sharedArea
                    };
                }
            }
            
            // Calculate RPN and samples for each location
            const processedLocations = machine.sampleLocations.map(location => {
                const rpn = calculateLocationRPN(location);
                const samples = getNumberOfSamples(rpn);
                
                // Get rating text from score
                const getRatingText = (score) => {
                    if (score === 1) return 'Low';
                    if (score === 2) return 'Medium';
                    if (score === 3) return 'High';
                    return score;
                };
                
                const hardToClean = location.hardToClean || (location.hardToClean || 2);
                const accessibility = location.accessibility || (location.accessibilityForCleaning || 2);
                const visibility = location.visibility || 2;
                
                return {
                    ...location,
                    rpn: rpn,
                    numberOfSamples: samples,
                    hardToCleanText: getRatingText(hardToClean),
                    accessibilityText: getRatingText(accessibility),
                    visibilityText: getRatingText(visibility)
                };
            });
            
            // Calculate totals
            const totalLocations = processedLocations.length;
            const totalSamples = processedLocations.reduce((sum, loc) => sum + loc.numberOfSamples, 0);
            
            // Generate dates
            const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const issuedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            
            // Format MACO value for display
            const macoDisplay = macoValue ? macoValue.toFixed(4) + ' mg' : 'Not calculated';
            const macoResidualAPI = macoValue ? `≤ ${macoDisplay}` : protocolSettings.acceptanceCriteria.residualAPI;
            
            // Create a new window for the protocol
            const formWindow = window.open('', '_blank', 'width=1200,height=800');
            
            // Generate HTML protocol form matching template structure (Word-compatible)
            const formHTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word">
    <meta name="Originator" content="Microsoft Word">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Cleaning Protocol - ${machine.name}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 20px;
            background-color: #f9f9f9;
            font-size: 11pt;
            line-height: 1.4;
        }
        .protocol-container {
            max-width: 210mm;
            margin: 0 auto;
            background-color: white;
            padding: 20mm;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .protocol-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .protocol-title {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .protocol-subtitle {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 5px;
        }
        .info-section {
            margin-bottom: 25px;
        }
        .info-row {
            display: flex;
            margin-bottom: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .info-label {
            font-weight: bold;
            width: 200px;
            min-width: 200px;
        }
        .info-value {
            flex: 1;
        }
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            text-transform: uppercase;
        }
        .protocol-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10pt;
        }
        .protocol-table th,
        .protocol-table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: top;
        }
        .protocol-table th {
            background-color: #e0e0e0;
            font-weight: bold;
            text-align: center;
            font-size: 9pt;
        }
        .protocol-table td {
            background-color: white;
        }
        .location-cell {
            font-weight: bold;
            min-width: 150px;
        }
        .rpn-cell {
            text-align: center;
            font-weight: bold;
            background-color: #fff9c4;
        }
        .samples-cell {
            text-align: center;
            font-weight: bold;
            background-color: #c5e1f5;
        }
        .center-cell {
            text-align: center;
        }
        .summary-box {
            border: 2px solid #000;
            padding: 10px;
            margin: 20px 0;
            background-color: #f5f5f5;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .print-btn {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 20px;
            font-size: 12pt;
        }
        .print-btn:hover {
            background-color: #1d4ed8;
        }
        .notes-section {
            margin-top: 20px;
            font-size: 10pt;
            line-height: 1.6;
        }
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-around;
        }
        .signature-box {
            width: 250px;
            border-top: 1px solid #000;
            padding-top: 5px;
            text-align: center;
        }
        @media print {
            .print-btn { display: none; }
            body { background-color: white; margin: 0; }
            .protocol-container { 
                box-shadow: none; 
                padding: 15mm;
                max-width: none;
            }
            @page {
                margin: 15mm;
            }
        }
    </style>
</head>
<body>
    <div class="protocol-container">
        <div style="margin-bottom: 20px; text-align: center;">
            <button class="print-btn" onclick="window.print()" style="margin-right: 10px;">🖨️ Print Protocol</button>
            <button class="print-btn" onclick="downloadProtocol()" style="background-color: #10b981;">📥 Download as Word Document</button>
        </div>
        
        <!-- Cover Page & Header -->
        <div class="protocol-header">
            <div class="protocol-title">Cleaning Validation Protocol</div>
            <div class="protocol-subtitle">Equipment Cleaning and Sampling Protocol</div>
            <div style="margin-top: 15px; font-size: 10pt;">
                <div><strong>Document No:</strong> ${protocolSettings.docNo}</div>
                <div><strong>Form No:</strong> ${protocolSettings.formNo}</div>
                <div><strong>Issued Date:</strong> ${issuedDate}</div>
                <div><strong>Issued No:</strong> ${protocolSettings.issuedNo}</div>
            </div>
        </div>
        
        <!-- Company Information -->
        <div class="info-section" style="margin-bottom: 15px; padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd;">
            <div><strong>Company:</strong> ${protocolSettings.companyName}</div>
            <div><strong>Address:</strong> ${protocolSettings.companyAddress}</div>
        </div>
        
        <!-- Equipment Information -->
        <div class="info-section">
            <div class="section-title">1. Equipment Information</div>
            <div class="info-row">
                <div class="info-label">Equipment Name ({{EQUIPMENT_NAME}}):</div>
                <div class="info-value">${machine.name}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Equipment Number ({{EQUIPMENT_NO}} / {{MACHINE_NO}}):</div>
                <div class="info-value">${machine.machineNumber || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Manufacturer ({{EQUIPMENT_MANUFACTURER}} / {{MANUFACTURER}}):</div>
                <div class="info-value">${machine.manufacturer || 'Not specified'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Model ({{EQUIPMENT_MODEL}}):</div>
                <div class="info-value">${machine.model || 'Not specified'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Serial Number ({{EQUIPMENT_SERIAL}}):</div>
                <div class="info-value">${machine.serialNumber || 'Not specified'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Production Stage:</div>
                <div class="info-value">${machine.stage || 'N/A'}</div>
            </div>
            ${machine.group ? `
            <div class="info-row">
                <div class="info-label">Machine Group ({{EQUIPMENT_GROUP}}):</div>
                <div class="info-value">${machine.group}</div>
            </div>
            ` : ''}
            <div class="info-row">
                <div class="info-label">Production Line ({{MACHINE_LOCATION}}):</div>
                <div class="info-value">${machine.line || 'N/A'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Surface Area ({{EQUIPMENT_AREA}}):</div>
                <div class="info-value">${machine.area ? machine.area.toLocaleString() + ' cm²' : 'N/A'}</div>
            </div>
            ${machine.description ? `
            <div class="info-row">
                <div class="info-label">Description ({{EQUIPMENT_DESCRIPTION}}):</div>
                <div class="info-value">${machine.description}</div>
            </div>
            ` : ''}
            <div class="info-row">
                <div class="info-label">Installation Date ({{INSTALLATION_DATE}}):</div>
                <div class="info-value">${machine.installationDate || 'Not specified'}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Cleaning SOP ({{CLEANING_SOP_NO}}):</div>
                <div class="info-value">${sopName}${sopAttachment === 'link' && sopValue ? ' (Link: ' + sopValue + ')' : ''}${sopAttachment === 'upload' ? ' (File attached)' : ''}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Protocol Date ({{ISSUED_DATE}}):</div>
                <div class="info-value">${currentDate}</div>
            </div>
        </div>
        
        <!-- Scope and Purpose -->
        <div class="info-section">
            <div class="section-title">2. Scope and Purpose</div>
            <div style="margin-bottom: 10px; font-size: 10pt; line-height: 1.6;">
                <p><strong>Scope ({{SCOPE_TEXT}}):</strong> This protocol describes the cleaning validation for ${machine.name} used in the production of pharmaceutical products at ${protocolSettings.companyName}.</p>
                <p><strong>Purpose ({{PURPOSE_TEXT}}):</strong> To establish documented evidence that the cleaning procedure for the equipment is effective and reproducible.</p>
            </div>
        </div>
        
        <!-- Products List & Worst-Case Product -->
        ${assignedProducts.length > 0 ? `
        <div class="info-section">
            <div class="section-title">3. Products List and Worst-Case Product</div>
            <div style="margin-bottom: 10px; font-size: 10pt;">
                <p><strong>Total Products ({{TOTAL_PRODUCTS}}):</strong> ${assignedProducts.length}</p>
            </div>
            <table class="protocol-table">
                <thead>
                    <tr>
                        <th>Product Code</th>
                        <th>Product Name</th>
                        <th>Product Type</th>
                        <th>Batch Size (Kg)</th>
                        <th>RPN</th>
                    </tr>
                </thead>
                <tbody>
                    ${productsWithRPN.map(product => `
                        <tr>
                            <td>${product.productCode || 'N/A'}</td>
                            <td>${product.name || 'N/A'}</td>
                            <td class="center-cell">${product.productType || 'N/A'}</td>
                            <td class="center-cell">${product.batchSizeKg ? product.batchSizeKg.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'N/A'}</td>
                            <td class="center-cell rpn-cell">${product.rpn || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${worstCaseProduct ? `
            <div class="summary-box" style="margin-top: 15px;">
                <div class="section-title" style="margin-top: 0; border: none; padding: 0;">Worst-Case Product</div>
                <div class="summary-row">
                    <span>Worst-Case Product ({{WORST_CASE_PRODUCT}}):</span>
                    <span>${worstCaseProduct.name}</span>
                </div>
                <div class="summary-row">
                    <span>Worst-Case RPN ({{WORST_CASE_RPN}}):</span>
                    <span>${worstCaseRPN}</span>
                </div>
                <div class="summary-row">
                    <span>Worst-Case API ({{WORST_CASE_API}}):</span>
                    <span>${worstCaseAPI}</span>
                </div>
                <div class="summary-row">
                    <span>Dosage Form ({{WORST_CASE_DOSAGE_FORM}}):</span>
                    <span>${worstCaseProduct.productType || 'N/A'}</span>
                </div>
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Cleaning Procedure -->
        <div class="info-section">
            <div class="section-title">4. Cleaning Procedure</div>
            <div style="margin-bottom: 10px; font-size: 10pt; line-height: 1.6;">
                <div class="info-row">
                    <div class="info-label">SOP Number ({{CLEANING_SOP_NO}}):</div>
                    <div class="info-value">${sopName}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">SOP Title ({{CLEANING_SOP_TITLE}}):</div>
                    <div class="info-value">Cleaning Procedure for ${machine.name}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Detergent Name ({{DETERGENT_NAME}}):</div>
                    <div class="info-value">${protocolSettings.detergentName}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Detergent Concentration ({{DETERGENT_CONCENTRATION}}):</div>
                    <div class="info-value">${protocolSettings.detergentConcentration}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Detergent Supplier ({{DETERGENT_SUPPLIER}}):</div>
                    <div class="info-value">${protocolSettings.detergentSupplier}</div>
                </div>
            </div>
        </div>
        
        <!-- MAC Calculation -->
        ${macoCalculation ? `
        <div class="info-section">
            <div class="section-title">5. Maximum Allowable Carryover (MAC) Calculation</div>
            <div style="margin-bottom: 10px; font-size: 10pt; line-height: 1.6;">
                <div class="info-row">
                    <div class="info-label">Product Name ({{MAC_PRODUCT_NAME}}):</div>
                    <div class="info-value">${worstCaseProduct.name}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">API ({{MAC_API}}):</div>
                    <div class="info-value">${worstCaseAPI}</div>
                </div>
                ${macoCalculation.hbel ? `
                <div class="info-row">
                    <div class="info-label">HBEL ({{MAC_HBEL}}):</div>
                    <div class="info-value">${macoCalculation.hbel} mg/day</div>
                </div>
                ` : ''}
                <div class="info-row">
                    <div class="info-label">Safety Factor ({{MAC_SAFETY_FACTOR}}):</div>
                    <div class="info-value">${macoCalculation.safetyFactor}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Batch Size ({{MAC_BATCH_SIZE}}):</div>
                    <div class="info-value">${worstCaseProduct.batchSizeKg ? (worstCaseProduct.batchSizeKg * 1000).toLocaleString() + ' units' : 'N/A'}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Min Batch Size ({{MAC_MIN_BATCH}}):</div>
                    <div class="info-value">${macoCalculation.minBatchSize.toLocaleString()} units</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Shared Surface Area ({{MAC_SHARED_AREA}}):</div>
                    <div class="info-value">${macoCalculation.sharedArea.toLocaleString()} cm²</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Swab Area ({{MAC_SWAB_AREA}}):</div>
                    <div class="info-value">${macoCalculation.swabArea} cm²</div>
                </div>
                <div class="summary-box" style="margin-top: 15px;">
                    <div><strong>MAC Calculation ({{MAC_CALCULATION}} / {{MAC_METHOD}}):</strong></div>
                    <div style="margin-top: 10px; font-family: 'Courier New', monospace; font-size: 9pt;">
                        <div>${macoCalculation.formula}</div>
                        <div style="margin-top: 5px;">${macoCalculation.calculation}</div>
                        <div style="margin-top: 10px; font-weight: bold; font-size: 11pt;">
                            MAC = ${macoDisplay}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Sample Locations Table -->
        <div class="info-section">
            <div class="section-title">6. Sample Locations and Number of Samples</div>
            <div style="margin-bottom: 10px; font-size: 10pt;">
                <strong>Purpose:</strong> Determine the number of samples that must be taken from each location in this equipment according to RPN study.
            </div>
            <table class="protocol-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">Location</th>
                        <th style="width: 10%;">Area (cm²)</th>
                        <th style="width: 12%;">Hard to Clean</th>
                        <th style="width: 12%;">Accessibility</th>
                        <th style="width: 12%;">Visibility</th>
                        <th style="width: 10%;">RPN</th>
                        <th style="width: 10%;">No. of Samples</th>
                    </tr>
                </thead>
                <tbody>
                    ${processedLocations.map(location => `
                        <tr>
                            <td class="location-cell">${location.location || ''}</td>
                            <td class="center-cell">${location.area ? location.area.toLocaleString() : '-'}</td>
                            <td class="center-cell">${location.hardToCleanText}</td>
                            <td class="center-cell">${location.accessibilityText}</td>
                            <td class="center-cell">${location.visibilityText}</td>
                            <td class="rpn-cell">${location.rpn}</td>
                            <td class="samples-cell">${location.numberOfSamples}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="summary-box">
                <div class="summary-row">
                    <span>Total Number of Locations:</span>
                    <span>${totalLocations}</span>
                </div>
                <div class="summary-row">
                    <span>Total Number of Samples Required:</span>
                    <span>${totalSamples}</span>
                </div>
            </div>
        </div>
        
        <!-- Acceptance Criteria -->
        <div class="info-section">
            <div class="section-title">7. Acceptance Criteria</div>
            <table class="protocol-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">Test Parameter</th>
                        <th style="width: 60%;">Acceptance Criteria</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Visual Inspection</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.visualInspection}</td>
                    </tr>
                    <tr>
                        <td><strong>Residual API ({{AC_RESIDUAL_API}})</strong></td>
                        <td>${macoResidualAPI}</td>
                    </tr>
                    <tr>
                        <td><strong>Cleansing Agent ({{AC_CLEANSING_AGENT}})</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.cleansingAgent}</td>
                    </tr>
                    <tr>
                        <td><strong>pH ({{AC_PH_MIN}} - {{AC_PH_MAX}})</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.phMin} - ${protocolSettings.acceptanceCriteria.phMax}</td>
                    </tr>
                    <tr>
                        <td><strong>Conductivity ({{AC_CONDUCTIVITY}})</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.conductivity}</td>
                    </tr>
                    <tr>
                        <td><strong>TOC ({{AC_TOC}})</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.toc}</td>
                    </tr>
                    <tr>
                        <td><strong>Microbial ({{AC_MICROBIAL}})</strong></td>
                        <td>${protocolSettings.acceptanceCriteria.microbial}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- Notes and Guidelines -->
        <div class="notes-section">
            <div class="section-title">8. Notes and Guidelines</div>
            <p><strong>RPN Calculation:</strong> Risk Priority Number (RPN) is calculated as: Hard to Clean × Accessibility × Visibility</p>
            <p><strong>Sample Guidelines ({{SAMPLE_GUIDELINES}}):</strong> ${guidelinesText}</p>
            <p><strong>Rating Scale:</strong></p>
            <ul style="margin-left: 20px; margin-top: 5px;">
                <li><strong>Hard to Clean:</strong> Low (1) = Easy to clean, Medium (2) = Moderate difficulty, High (3) = Difficult to clean</li>
                <li><strong>Accessibility:</strong> Low (1) = Easily accessible, Medium (2) = Moderately accessible, High (3) = Hard to access</li>
                <li><strong>Visibility:</strong> Low (1) = Easily visible, Medium (2) = Moderately visible, High (3) = Hard to see</li>
            </ul>
        </div>
        
        <!-- Approval Signatures -->
        <div class="signature-section">
            <div class="signature-box">
                <div style="margin-bottom: 30px;"><strong>Prepared By ({{PREPARED_BY_NAME}}):</strong></div>
                <div style="margin-bottom: 10px;">${protocolSettings.preparedByName}</div>
                <div style="margin-bottom: 30px;"><strong>Title:</strong> ${protocolSettings.preparedByTitle}</div>
                <div style="margin-bottom: 30px;">Signature: _______________</div>
                <div>Date: _______________</div>
            </div>
            <div class="signature-box">
                <div style="margin-bottom: 30px;"><strong>Reviewed By ({{REVIEWED_BY_NAME}}):</strong></div>
                <div style="margin-bottom: 10px;">${protocolSettings.reviewedByName}</div>
                <div style="margin-bottom: 30px;"><strong>Title:</strong> ${protocolSettings.reviewedByTitle}</div>
                <div style="margin-bottom: 30px;">Signature: _______________</div>
                <div>Date: _______________</div>
            </div>
            <div class="signature-box">
                <div style="margin-bottom: 30px;"><strong>Approved By:</strong></div>
                <div style="margin-bottom: 10px;"><strong>QC Manager ({{QC_MANAGER_NAME}}):</strong> ${protocolSettings.qcManagerName}</div>
                <div style="margin-bottom: 10px;"><strong>Production Manager ({{PRODUCTION_MANAGER_NAME}}):</strong> ${protocolSettings.productionManagerName}</div>
                <div style="margin-bottom: 10px;"><strong>QA Manager ({{QA_MANAGER_NAME}}):</strong> ${protocolSettings.qaManagerName}</div>
                <div style="margin-top: 20px;">Signatures: _______________</div>
                <div>Date: _______________</div>
            </div>
        </div>
    </div>
</body>
</html>`;
            
            // Write HTML to the window
            formWindow.document.write(formHTML);
            formWindow.document.close();
            
            // Also download as Word document
            const blob = new Blob(['\ufeff', formHTML], { 
                type: 'application/msword' 
            });
            const url = URL.createObjectURL(blob);
            const fileName = `Cleaning_Protocol_${machine.machineNumber || machine.id}_${issuedDate.replace(/-/g, '')}.doc`;
            
            // Create download link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('Error generating cleaning protocol:', error);
            showCustomAlert("Error", "Failed to generate cleaning protocol: " + error.message);
        } finally {
            hideLoader();
        }
    });
}

// ========== SAMPLE LOCATIONS MANAGEMENT ==========

let currentSampleLocationsData = [];
let currentMachineForLocations = null;

/**
 * Open the sample locations manager modal
 */
export function openSampleLocationsManager(machineId) {
    console.log('🔄 OPENING SAMPLE LOCATIONS MANAGER');
    console.log('Machine ID:', machineId);
    
    const machine = state.machines.find(m => m.id === parseInt(machineId));
    if (!machine) {
        console.error('❌ Machine not found for ID:', machineId);
        showCustomAlert('Error', 'Machine not found.');
        return;
    }
    
    console.log('✅ Machine found:', machine.name);
    console.log('Sample locations in machine:', machine.sampleLocations?.length || 0);
    if (machine.sampleLocations && machine.sampleLocations.length > 0) {
        console.log('Sample locations data:', machine.sampleLocations);
    } else {
        console.log('📍 No sample locations found for this machine');
    }
    
    currentMachineForLocations = machine;
    document.getElementById('sampleLocationsManagerMachineId').value = machineId;
    document.getElementById('sampleLocationsManagerModalTitle').textContent = `Manage Sample Locations - ${machine.name}`;
    
    // Load existing locations
    currentSampleLocationsData = machine.sampleLocations ? JSON.parse(JSON.stringify(machine.sampleLocations)) : [];
    console.log('✅ Loaded', currentSampleLocationsData.length, 'sample locations into manager');
    
    // Hide form initially
    hideLocationForm();
    
    // Render locations
    renderLocationsTable();
    
    // Update button visibility
    updateModalButtons();
    
    // Show modal
    showModal('sampleLocationsManagerModal');
    
    console.log('🎉 Sample locations manager opened successfully');
}

/**
 * Render locations table
 */
function renderLocationsTable() {
    const tableContainer = document.getElementById('locationsTableContainer');
    const tableBody = document.getElementById('locationsTableBody');
    const noLocationsMsg = document.getElementById('noLocationsMessage');
    
    if (currentSampleLocationsData.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (noLocationsMsg) noLocationsMsg.style.display = 'block';
        return;
    }
    
    if (noLocationsMsg) noLocationsMsg.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    
    if (tableBody) {
        let totalSamples = 0;
        
        tableBody.innerHTML = currentSampleLocationsData.map((loc, index) => {
            const rpn = calculateLocationRPN(loc);
            const samples = getNumberOfSamples(rpn);
            totalSamples += samples;
            
            // Get RPN color class
            let rpnClass = '';
            if (rpn >= 1 && rpn <= 20) rpnClass = 'text-green-700 bg-green-50';
            else if (rpn >= 21 && rpn <= 50) rpnClass = 'text-yellow-700 bg-yellow-50';
            else rpnClass = 'text-red-700 bg-red-50';
            
            // Get rating text from score
            const getRatingText = (score) => {
                if (score === 1) return 'Low';
                if (score === 2) return 'Medium';
                if (score === 3) return 'High';
                return score;
            };
            
            const hardToClean = loc.hardToClean || 2;
            const accessibility = loc.accessibility || (loc.accessibilityForCleaning || 2);
            const visibility = loc.visibility || 2;
            
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3 font-semibold" style="color: var(--text-primary);">${loc.location || ''}</td>
                    <td class="p-3 text-center" style="color: var(--text-primary);">${loc.area ? loc.area.toLocaleString() : '-'}</td>
                    <td class="p-3 text-center" style="color: var(--text-primary);">${getRatingText(hardToClean)}</td>
                    <td class="p-3 text-center" style="color: var(--text-primary);">${getRatingText(accessibility)}</td>
                    <td class="p-3 text-center" style="color: var(--text-primary);">${getRatingText(visibility)}</td>
                    <td class="p-3 text-center">
                        <span class="px-3 py-1 rounded-full font-bold ${rpnClass}">${rpn}</span>
                    </td>
                    <td class="p-3 text-center">
                        <span class="px-3 py-1 rounded-full font-bold" style="background-color: #dbeafe; color: #1e40af;">${samples}</span>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="editSampleLocation(${index})" class="text-blue-500 hover:text-blue-700 mr-2" title="Edit">✏️</button>
                        <button onclick="deleteSampleLocation(${index})" class="text-red-500 hover:text-red-700" title="Delete">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Update summary
        document.getElementById('summaryTotalLocations').textContent = currentSampleLocationsData.length;
        document.getElementById('summaryTotalSamples').textContent = totalSamples;
    }
}

/**
 * Show add location form
 */
function showAddLocationForm() {
    document.getElementById('locationFormContainer').classList.remove('hidden');
    document.getElementById('locationFormTitle').textContent = '➕ Add New Sample Location';
    document.getElementById('locationEditIndex').value = '-1';
    
    // Reset form
    document.getElementById('locationNameInput').value = '';
    document.getElementById('locationAreaInput').value = '';
    document.getElementById('hardToCleanSelect').value = '2';
    document.getElementById('accessibilitySelect').value = '2';
    document.getElementById('visibilitySelect').value = '2';
    
    updateLocationCalculation();
}

/**
 * Hide location form
 */
function hideLocationForm() {
    document.getElementById('locationFormContainer').classList.add('hidden');
}

/**
 * Edit a sample location
 */
function editSampleLocation(index) {
    const loc = currentSampleLocationsData[index];
    if (!loc) return;
    
    document.getElementById('locationFormContainer').classList.remove('hidden');
    document.getElementById('locationFormTitle').textContent = '✏️ Edit Sample Location';
    document.getElementById('locationEditIndex').value = index;
    
    // Populate form
    document.getElementById('locationNameInput').value = loc.location || '';
    document.getElementById('locationAreaInput').value = loc.area || '';
    document.getElementById('hardToCleanSelect').value = loc.hardToClean || '2';
    document.getElementById('accessibilitySelect').value = loc.accessibility || (loc.accessibilityForCleaning || '2');
    document.getElementById('visibilitySelect').value = loc.visibility || '2';
    
    updateLocationCalculation();
    
    // Scroll to form
    document.getElementById('locationFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Update RPN and samples calculation
 */
function updateLocationCalculation() {
    const hardToClean = parseInt(document.getElementById('hardToCleanSelect').value);
    const accessibility = parseInt(document.getElementById('accessibilitySelect').value);
    const visibility = parseInt(document.getElementById('visibilitySelect').value);
    
    const rpn = hardToClean * accessibility * visibility;
    const samples = getNumberOfSamples(rpn);
    
    document.getElementById('calculatedRPN').textContent = rpn;
    document.getElementById('calculatedSamples').textContent = samples;
    
    // Update RPN color
    const rpnElement = document.getElementById('calculatedRPN');
    if (rpn >= 1 && rpn <= 20) {
        rpnElement.style.backgroundColor = '#10b981';
    } else if (rpn >= 21 && rpn <= 50) {
        rpnElement.style.backgroundColor = '#eab308';
    } else {
        rpnElement.style.backgroundColor = '#ef4444';
    }
}

/**
 * Handle save location (add or edit)
 */
async function handleSaveLocation(event) {
    event.preventDefault();
    
    const name = document.getElementById('locationNameInput').value.trim();
    const area = document.getElementById('locationAreaInput').value.trim();
    const hardToClean = parseInt(document.getElementById('hardToCleanSelect').value);
    const accessibility = parseInt(document.getElementById('accessibilitySelect').value);
    const visibility = parseInt(document.getElementById('visibilitySelect').value);
    const editIndex = parseInt(document.getElementById('locationEditIndex').value);
    
    if (!name) {
        showCustomAlert('Validation Error', 'Please enter location name.');
        return;
    }
    
    const locationData = {
        location: name,
        area: area ? parseFloat(area) : null,
        hardToClean: hardToClean,
        accessibility: accessibility,
        visibility: visibility
    };
    
    if (editIndex >= 0 && editIndex < currentSampleLocationsData.length) {
        // Update existing
        currentSampleLocationsData[editIndex] = locationData;
    } else {
        // Add new
        currentSampleLocationsData.push(locationData);
    }
    
    // Hide form and re-render (don't save yet - user will click Save button)
    hideLocationForm();
    renderLocationsTable();
    
    // Update button visibility
    updateModalButtons();
}

/**
 * Delete a sample location
 */
async function deleteSampleLocation(index) {
    if (confirm('Are you sure you want to delete this sample location?')) {
        currentSampleLocationsData.splice(index, 1);
        
        // Re-render (don't save yet - user will click Save button)
        renderLocationsTable();
        
        // Update button visibility
        updateModalButtons();
    }
}

/**
 * Save all sample locations to machine and IndexedDB
 */
async function saveSampleLocations() {
    if (!currentMachineForLocations) {
        showCustomAlert('Error', 'No machine selected.');
        return;
    }
    
    try {
        console.log('🔄 SAVING SAMPLE LOCATIONS - START');
        console.log('Machine:', currentMachineForLocations.name, 'ID:', currentMachineForLocations.id);
        console.log('Sample locations to save:', currentSampleLocationsData.length, 'locations');
        console.log('Sample locations data:', JSON.stringify(currentSampleLocationsData, null, 2));
        
        // Save to machine state - CRITICAL: Update the actual machine in the state array
        console.log('🔄 Before update: currentMachineForLocations is reference?', currentMachineForLocations === state.machines.find(m => m.id === currentMachineForLocations.id));
        
        currentMachineForLocations.sampleLocations = JSON.parse(JSON.stringify(currentSampleLocationsData));
        console.log('✅ Updated currentMachineForLocations.sampleLocations:', currentMachineForLocations.sampleLocations);
        
        // CRITICAL: Make sure the machine in the state array is actually updated
        const machineInState = state.machines.find(m => m.id === currentMachineForLocations.id);
        if (machineInState) {
            // Force update the machine in state
            machineInState.sampleLocations = JSON.parse(JSON.stringify(currentSampleLocationsData));
            console.log('✅ FORCED UPDATE: Machine in state updated, sample locations count:', machineInState.sampleLocations?.length || 0);
            console.log('✅ FORCED UPDATE: Machine in state sampleLocations:', machineInState.sampleLocations);
            
            // Verify the update worked
            const verifyMachine = state.machines.find(m => m.id === currentMachineForLocations.id);
            if (verifyMachine && verifyMachine.sampleLocations && verifyMachine.sampleLocations.length > 0) {
                console.log('✅ VERIFICATION: Machine in state definitely has sample locations:', verifyMachine.sampleLocations.length);
            } else {
                console.error('❌ VERIFICATION FAILED: Machine in state still has no sample locations!');
            }
        } else {
            console.error('❌ Machine not found in state!');
        }
        
        // Save state for undo/redo
        console.log('🔄 About to call saveStateForUndo...');
        saveStateForUndo();
        console.log('✅ State saved for undo/redo');
        
        // CHECK: Verify machine state AFTER saveStateForUndo
        const machineAfterUndo = state.machines.find(m => m.id === currentMachineForLocations.id);
        if (machineAfterUndo && machineAfterUndo.sampleLocations && machineAfterUndo.sampleLocations.length > 0) {
            console.log('✅ AFTER UNDO: Machine in state still has sample locations:', machineAfterUndo.sampleLocations.length);
        } else {
            console.error('❌ AFTER UNDO: Machine in state lost sample locations after saveStateForUndo!');
            if (machineAfterUndo) {
                console.error('❌ AFTER UNDO: Machine found but sampleLocations:', machineAfterUndo.sampleLocations);
            }
        }
        
        // FINAL CHECK: Verify machine state just before saving to IndexedDB
        const finalCheckMachine = state.machines.find(m => m.id === currentMachineForLocations.id);
        if (finalCheckMachine && finalCheckMachine.sampleLocations && finalCheckMachine.sampleLocations.length > 0) {
            console.log('✅ FINAL CHECK: Machine in state HAS sample locations before IndexedDB save:', finalCheckMachine.sampleLocations.length);
            console.log('✅ FINAL CHECK: Sample locations:', finalCheckMachine.sampleLocations);
        } else {
            console.error('❌ FINAL CHECK: Machine in state has NO sample locations before IndexedDB save!');
            console.error('❌ FINAL CHECK: This means the state was not updated properly!');
            if (finalCheckMachine) {
                console.error('❌ FINAL CHECK: Machine found but sampleLocations:', finalCheckMachine.sampleLocations);
            } else {
                console.error('❌ FINAL CHECK: Machine not found in state at all!');
            }
        }
        
        // Save to IndexedDB
        const ui = await import('./ui.js');
        console.log('🔄 Starting save to IndexedDB...');
        await ui.saveAllDataToLocalStorage();
        console.log('✅ Data saved to IndexedDB successfully');
        
        // Verification: Check if data was actually saved
        const db = await import('./indexedDB.js');
        const savedMachines = await db.getItem('macoMachines');
        if (savedMachines) {
            const parsedMachines = JSON.parse(savedMachines);
            const savedMachine = parsedMachines.find(m => m.id === currentMachineForLocations.id);
            if (savedMachine && savedMachine.sampleLocations && savedMachine.sampleLocations.length > 0) {
                console.log('✅ VERIFICATION: Machine saved in IndexedDB with', savedMachine.sampleLocations.length, 'sample locations');
                console.log('✅ VERIFICATION: Sample locations:', savedMachine.sampleLocations);
            } else {
                console.error('❌ VERIFICATION FAILED: Machine not found in IndexedDB or no sample locations');
                if (savedMachine) {
                    console.error('❌ VERIFICATION: Machine found but sampleLocations:', savedMachine.sampleLocations);
                } else {
                    console.error('❌ VERIFICATION: Machine not found at all');
                }
            }
        } else {
            console.error('❌ VERIFICATION FAILED: No machines data in IndexedDB');
        }
        
        // IMMEDIATE RELOAD TEST: Try to load the data back immediately
        console.log('🔄 IMMEDIATE TEST: Trying to load data back from IndexedDB...');
        try {
            const testLoad = await db.getItem('macoMachines');
            if (testLoad) {
                const testParsed = JSON.parse(testLoad);
                const testMachine = testParsed.find(m => m.id === currentMachineForLocations.id);
                if (testMachine && testMachine.sampleLocations && testMachine.sampleLocations.length > 0) {
                    console.log('✅ IMMEDIATE TEST: Successfully loaded machine with', testMachine.sampleLocations.length, 'sample locations');
                } else {
                    console.error('❌ IMMEDIATE TEST: Failed to load sample locations');
                }
            } else {
                console.error('❌ IMMEDIATE TEST: No data found');
            }
        } catch (error) {
            console.error('❌ IMMEDIATE TEST: Error loading data:', error);
        }
        
        // Update UI
        console.log('🔄 Updating UI...');
        fullAppRender();
        console.log('✅ UI updated');
        
        showCustomAlert('Success', 'Sample locations saved successfully!');
        
        // Close the modal
        hideModal('sampleLocationsManagerModal');
        
        console.log('🎉 SAVING SAMPLE LOCATIONS - COMPLETED SUCCESSFULLY');
        
    } catch (error) {
        console.error('❌ Error saving sample locations:', error);
        showCustomAlert('Error', 'Failed to save sample locations: ' + error.message);
    }
}

/**
 * Update modal button visibility
 */
function updateModalButtons() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const saveLocationsBtn = document.getElementById('saveLocationsBtn');
    
    if (generateReportBtn) {
        generateReportBtn.style.display = currentSampleLocationsData.length > 0 ? 'inline-block' : 'none';
    }
    
    if (saveLocationsBtn) {
        // Always show save button if there are locations
        saveLocationsBtn.style.display = currentSampleLocationsData.length > 0 ? 'inline-block' : 'none';
    }
}

/**
 * Generate form from manager modal
 */
function generateReportFromManager() {
    const machineId = parseInt(document.getElementById('sampleLocationsManagerMachineId').value);
    hideModal('sampleLocationsManagerModal');
    setTimeout(() => {
        generateSampleLocationReport(machineId);
    }, 100);
}

// Make functions globally available
window.exportMachineProductsToExcel = exportMachineProductsToExcel;
window.printMachineProducts = printMachineProducts;
window.handleSOPFileUpload = handleSOPFileUpload;
window.removeSOPFile = removeSOPFile;
window.openCurrentSOP = openCurrentSOP;
window.editCurrentSOP = editCurrentSOP;
window.generateSampleLocationReport = generateSampleLocationReport;
window.openSampleLocationsManager = openSampleLocationsManager;
window.showAddLocationForm = showAddLocationForm;
window.hideLocationForm = hideLocationForm;
window.updateLocationCalculation = updateLocationCalculation;
window.handleSaveLocation = handleSaveLocation;
window.editSampleLocation = editSampleLocation;
window.deleteSampleLocation = deleteSampleLocation;
window.generateReportFromManager = generateReportFromManager;
window.saveSampleLocations = saveSampleLocations;
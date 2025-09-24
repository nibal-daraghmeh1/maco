// Renders the "Train Summary" tab
// js/trainSummaryView.js

import * as state from './state.js';
import { hideLoader } from './ui.js';
import { getTrainData, calculateScores, getMacoPerSwabForTrain } from './utils.js';
import * as utils from './utils.js';

// Helper function to find the worst case product (highest RPN) in a train
function getWorstCaseProductForTrain(train) {
    let worstProduct = null;
    let highestRPN = 0;
    
    try {
        if (!train || !train.products || !Array.isArray(train.products)) {
            return null;
        }
        
        for (const product of train.products) {
            // Check if product has activeIngredients and if it's an array
            if (!product || !product.activeIngredients || !Array.isArray(product.activeIngredients)) {
                continue;
            }
            
            for (const ingredient of product.activeIngredients) {
                if (!ingredient) continue;
                
                try {
                    const scores = calculateScores(ingredient);
                    if (scores && scores.rpn > highestRPN) {
                        highestRPN = scores.rpn;
                        worstProduct = {
                            productCode: product.productCode || 'Unknown',
                            productName: product.name || 'Unknown Product',
                            ingredientName: ingredient.name || 'Unknown Ingredient',
                            rpn: scores.rpn
                        };
                    }
                } catch (scoreError) {
                    console.warn('Error calculating scores for ingredient:', ingredient, scoreError);
                    continue;
                }
            }
        }
    } catch (error) {
        console.error('Error in getWorstCaseProductForTrain:', error);
        return null;
    }
    
    return worstProduct;
}

// Helper function to get MACO value for a train
function getMacoValueForTrain(train) {
    try {
        if (!train) {
            return 0;
        }
        
        // Get the global largest ESSA from all trains
        const allTrains = getTrainData();
        if (!allTrains || !Array.isArray(allTrains)) {
            return 0;
        }
        
        const globalLargestEssa = Math.max(...allTrains.map(t => t.essa || 0));
        
        if (globalLargestEssa <= 0) {
            return 0;
        }
        
        const macoPerSwab = getMacoPerSwabForTrain(train, globalLargestEssa);
        return macoPerSwab || 0;
    } catch (error) {
        console.error('Error calculating MACO for train:', train?.id || 'unknown', error);
        return 0;
    }
}

export function renderTrainSummary() {
    const container = document.getElementById('trainSummaryContainer');
    const noTrainsMsg = document.getElementById('noTrainSummaryMessage');
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
        console.log('Filtering trains for print:', window.printSelectedTrain);
        console.log('Available trains:', trainData.map(t => t.id));
        
        if (Array.isArray(window.printSelectedTrain)) {
            // Multiple trains selected
            trainsToRender = trainData.filter(train => window.printSelectedTrain.includes(String(train.id)));
        } else {
            // Single train selected (backward compatibility)
            trainsToRender = trainData.filter(train => String(train.id) === String(window.printSelectedTrain));
        }
        
        console.log('Filtered trains:', trainsToRender.map(t => t.id));
    }

    if (trainsToRender.length === 0) {
        console.log('No trains to render after filtering');
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noTrainsMsg.style.display = 'none';
    container.style.display = 'block';

    // Create a single comprehensive table with columns
    const tableRows = trainsToRender.map(train => {
        // Get machine details
        const machines = train.machineIds.map(id => {
            const machine = state.machines.find(m => m.id === id);
            return machine ? machine : { id, name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
        });

        // Format machines display
        const machinesDisplay = machines.map(m => {
            const groupInfo = m.group ? ` [${m.group}]` : '';
            return `${m.name}${groupInfo}`;
        }).join(', ');

        // Format products display
        const productsDisplay = train.products.map(p => p.name).join(', ');

        // Combine machines and products
        const machinesAndProducts = `
            <div class="mb-2">
                <span class="font-semibold text-blue-600">Machines:</span><br>
                <span class="text-sm">${machinesDisplay}</span>
            </div>
            <div>
                <span class="font-semibold text-purple-600">Products:</span><br>
                <span class="text-sm">${productsDisplay}</span>
            </div>
        `;

        // Get worst case product for this train
        const worstCaseProduct = getWorstCaseProductForTrain(train);
        const worstCaseDisplay = worstCaseProduct 
            ? `
                <div class="text-sm">
                    <div class="font-semibold text-orange-600">${worstCaseProduct.productName}</div>
                    <div class="text-xs text-gray-600">Ingredient: ${worstCaseProduct.ingredientName}</div>
                    <div class="text-xs font-bold text-red-600">RPN: ${worstCaseProduct.rpn.toFixed(2)}</div>
                </div>
            `
            : '<span class="text-gray-500 text-sm">No data available</span>';

        // Get MACO value for this train
        const macoValue = getMacoValueForTrain(train);
        const macoDisplay = macoValue > 0 
            ? `<span class="font-semibold text-green-600">${macoValue.toFixed(4)} mg/swab</span>`
            : '<span class="text-gray-500">Not calculated</span>';

        return `
            <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50" style="border-color: var(--border-color);">
                <td class="px-4 py-4 text-center font-bold text-lg" style="color: var(--text-primary);">T${train.id}</td>
                <td class="px-4 py-4" style="color: var(--text-primary);">
                    ${machinesAndProducts}
                </td>
                <td class="px-4 py-4" style="color: var(--text-primary);">
                    ${worstCaseDisplay}
                </td>
                <td class="px-4 py-4 text-center" style="color: var(--text-primary);">
                    ${macoDisplay}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="overflow-hidden rounded-lg border" style="border-color: var(--border-color);">
            <table class="w-full text-sm">
                <thead class="bg-gray-200 dark:bg-gray-700">
                    <tr>
                        <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider w-20" style="color: var(--text-secondary);">Train</th>
                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">Machines & Products</th>
                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider w-64" style="color: var(--text-secondary);">Worst Case Product</th>
                        <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider w-32" style="color: var(--text-secondary);">MACO</th>
                    </tr>
                </thead>
                <tbody style="border-color: var(--border-color); background-color: var(--bg-secondary);">
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
    
    // Update dropdown options after rendering
    populateTrainSummaryTrainOptions();
    
    // Hide loader when rendering is complete
    hideLoader();
}

// Dropdown toggle functions for Train Summary export and print
export function toggleTrainSummaryExportDropdown() {
    const dropdown = document.getElementById('trainSummaryExportDropdown');
    dropdown.classList.toggle('hidden');
    populateTrainSummaryTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#trainSummaryExportDropdown') && !e.target.closest('button[onclick="toggleTrainSummaryExportDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

export function toggleTrainSummaryPrintDropdown() {
    const dropdown = document.getElementById('trainSummaryPrintDropdown');
    dropdown.classList.toggle('hidden');
    populateTrainSummaryTrainOptions();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!e.target.closest('#trainSummaryPrintDropdown') && !e.target.closest('button[onclick="toggleTrainSummaryPrintDropdown()"]')) {
            dropdown.classList.add('hidden');
            document.removeEventListener('click', closeDropdown);
        }
    });
}

function populateTrainSummaryTrainOptions() {
    const trainData = getTrainData();
    
    // Populate export dropdown with checkboxes
    const exportContainer = document.getElementById('trainSummaryExportTrainOptions');
    if (exportContainer) {
        exportContainer.innerHTML = '';
        trainData.forEach(train => {
            const labelElement = document.createElement('label');
            labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            labelElement.style.color = 'var(--text-primary)';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-2 export-trainsummary-train-checkbox';
            checkbox.value = train.id;
            checkbox.onchange = () => updateAllTrainSummaryTrainsCheckbox('export');
            
            const span = document.createElement('span');
            span.textContent = `Train ${train.id}`;
            
            labelElement.appendChild(checkbox);
            labelElement.appendChild(span);
            exportContainer.appendChild(labelElement);
        });
    }
    
    // Populate print dropdown with checkboxes
    const printContainer = document.getElementById('trainSummaryPrintTrainOptions');
    if (printContainer) {
        printContainer.innerHTML = '';
        trainData.forEach(train => {
            const labelElement = document.createElement('label');
            labelElement.className = 'flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
            labelElement.style.color = 'var(--text-primary)';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mr-2 print-trainsummary-train-checkbox';
            checkbox.value = train.id;
            checkbox.onchange = () => updateAllTrainSummaryTrainsCheckbox('print');
            
            const span = document.createElement('span');
            span.textContent = `Train ${train.id}`;
            
            labelElement.appendChild(checkbox);
            labelElement.appendChild(span);
            printContainer.appendChild(labelElement);
        });
    }
}

// Multi-select train functions for Train Summary
export function toggleAllTrainSummaryTrainsSelection(type) {
    const allCheckbox = document.getElementById(`${type}TrainSummaryAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-trainsummary-train-checkbox`);
    
    trainCheckboxes.forEach(checkbox => {
        checkbox.checked = allCheckbox.checked;
    });
}

export function updateAllTrainSummaryTrainsCheckbox(type) {
    const allCheckbox = document.getElementById(`${type}TrainSummaryAllTrainsCheckbox`);
    const trainCheckboxes = document.querySelectorAll(`.${type}-trainsummary-train-checkbox`);
    const checkedBoxes = document.querySelectorAll(`.${type}-trainsummary-train-checkbox:checked`);
    
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

export function executeTrainSummaryExportSelection() {
    import('./ui.js').then(ui => {
        const { showCustomAlert, exportTrainSummaryToExcel } = ui;
        const allCheckbox = document.getElementById('exportTrainSummaryAllTrainsCheckbox');
        const selectedTrains = [];
        
        if (allCheckbox.checked) {
            // Export all trains
            exportTrainSummaryToExcel('all');
        } else {
            // Get selected individual trains
            const checkedBoxes = document.querySelectorAll('.export-trainsummary-train-checkbox:checked');
            checkedBoxes.forEach(checkbox => {
                selectedTrains.push(checkbox.value);
            });
            
            if (selectedTrains.length === 0) {
                showCustomAlert("No Selection", "Please select at least one train to export.");
                return;
            }
            
            // Export selected trains
            exportTrainSummaryToExcel(selectedTrains);
        }
        
        // Close dropdown
        document.getElementById('trainSummaryExportDropdown').classList.add('hidden');
    }).catch(error => {
        console.error('Error loading export function:', error);
        alert('Error loading export function');
    });
}

export function executeTrainSummaryPrintSelection() {
    try {
        const allCheckbox = document.getElementById('printTrainSummaryAllTrainsCheckbox');
        const checkedBoxes = document.querySelectorAll('.print-trainsummary-train-checkbox:checked');
        
        // Debug: Check what we have
        console.log('All checkbox checked:', allCheckbox ? allCheckbox.checked : 'not found');
        console.log('Individual checkboxes found:', checkedBoxes.length);
        
        if (!allCheckbox) {
            alert('Print dropdown elements not found. Please try refreshing the page.');
            return;
        }
        
        import('./ui.js').then(ui => {
            const { showCustomAlert, printCurrentView } = ui;
            const selectedTrains = [];
            
            if (allCheckbox.checked) {
                console.log('Printing all trains');
                // Print all trains
                printCurrentView('trainSummary', 'all');
            } else {
                // Get selected individual trains
                checkedBoxes.forEach(checkbox => {
                    selectedTrains.push(checkbox.value);
                });
                
                console.log('Selected trains for printing:', selectedTrains);
                
                if (selectedTrains.length === 0) {
                    showCustomAlert("No Selection", "Please select at least one train to print.");
                    return;
                }
                
                // Print selected trains
                printCurrentView('trainSummary', selectedTrains);
            }
            
            // Close dropdown
            const dropdown = document.getElementById('trainSummaryPrintDropdown');
            if (dropdown) {
                dropdown.classList.add('hidden');
            }
        }).catch(error => {
            console.error('Error loading print function:', error);
            alert('Error loading print function: ' + error.message);
        });
    } catch (error) {
        console.error('Error in executeTrainSummaryPrintSelection:', error);
        alert('Print function error: ' + error.message);
    }
}

// Make new functions globally available
window.toggleTrainSummaryExportDropdown = toggleTrainSummaryExportDropdown;
window.toggleTrainSummaryPrintDropdown = toggleTrainSummaryPrintDropdown;
window.toggleAllTrainSummaryTrainsSelection = toggleAllTrainSummaryTrainsSelection;
window.updateAllTrainSummaryTrainsCheckbox = updateAllTrainSummaryTrainsCheckbox;
window.executeTrainSummaryExportSelection = executeTrainSummaryExportSelection;
window.executeTrainSummaryPrintSelection = executeTrainSummaryPrintSelection;

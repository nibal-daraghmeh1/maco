// Renders the "Train Summary" tab
// js/trainSummaryView.js

import * as state from './state.js';
import { hideLoader } from './ui.js';
import { getTrainData, calculateScores, getMacoPerSwabForTrain, getTrainsGroupedByLine } from './utils.js';
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

// Helper function to calculate number of studies needed for a train
function calculateStudiesNeeded(train) {
    if (!train || !train.products || train.products.length === 0) {
        return 0;
    }

    // Get all machines in this train
    const allMachines = new Set(train.machineIds);
    if (allMachines.size === 0) {
        return 0;
    }

    // Get all trains grouped by line and dosage form to calculate studies incrementally
    const linesWithTrains = getTrainsGroupedByLine();
    const allTrains = [];
    linesWithTrains.forEach(lineObj => {
        lineObj.trains.forEach(t => allTrains.push({
            ...t,
            line: lineObj.line
        }));
    });

    // Find trains with same line and dosage form as current train
    const trainLine = train.line || 'Unassigned';
    const trainDosageForms = [...new Set(train.products.map(p => p.productType || 'Unknown'))];
    
    const relatedTrains = allTrains.filter(t => {
        const tLine = t.line || 'Unassigned';
        const tDosageForms = [...new Set(t.products.map(p => p.productType || 'Unknown'))];
        return tLine === trainLine && 
               tDosageForms.some(df => trainDosageForms.includes(df));
    });

    // Calculate RPN for each related train and sort by RPN (highest first)
    const trainsWithRPN = relatedTrains.map(t => {
        let highestRPN = 0;
        if (t.products && t.products.length > 0) {
            t.products.forEach(product => {
                if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                    product.activeIngredients.forEach(ingredient => {
                        try {
                            const scores = calculateScores(ingredient);
                            if (scores && scores.rpn > highestRPN) {
                                highestRPN = scores.rpn;
                            }
                        } catch (error) {
                            console.warn('Error calculating RPN for ingredient:', ingredient, error);
                        }
                    });
                }
            });
        }
        return { train: t, rpn: highestRPN };
    }).sort((a, b) => b.rpn - a.rpn); // Sort by RPN descending (highest first)

    // Find the position of current train in the RPN-sorted list
    const currentTrainIndex = trainsWithRPN.findIndex(t => t.train.id === train.id);
    if (currentTrainIndex === -1) {
        return 0;
    }

    // Calculate studies needed for this train based on its RPN ranking
    // Train with highest RPN gets study 1, second highest gets study 2, etc.
    return currentTrainIndex + 1;
}

// Helper function to get MACO value for a train using exact same logic as Product MACO Calculation
function getMacoValueForTrain(train) {
    try {
        // Use getTrainData() to get the same train structure as Product MACO Calculation
        const trainData = getTrainData();
        const matchingTrain = trainData.find(t => t.id === train.id);
        
        if (!matchingTrain) {
            return { value: 0, display: 'Not calculated' };
        }
        
        // Calculate global largest ESSA from all trains (same as Product MACO Calculation)
        const globalLargestEssa = trainData.length > 0 ? Math.max(...trainData.map(t => t.essa)) : 0;
        
        if (globalLargestEssa <= 0) {
            return { value: 0, display: 'Not calculated' };
        }
        
        // Use the exact same MACO calculation logic as Product MACO Calculation
        const sfConfig = state.safetyFactorConfig[getWorstCaseProductType(matchingTrain.products.map(p => p.productType))] || state.safetyFactorConfig['Other'];
        const sf = sfConfig.max;
        
        const macoDose = (matchingTrain.lowestLtd * matchingTrain.minBsMddRatio) / sf;
        const maco10ppm = 10 * matchingTrain.minMbsKg;
        let macoHealth = Infinity;
        if (matchingTrain.lowestPde !== null) {
            macoHealth = matchingTrain.lowestPde * matchingTrain.minBsMddRatio;
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
        const macoPerSwab = macoPerArea * matchingTrain.assumedSsa;
        
        // Use the exact same display format as Product MACO Calculation
        const display = macoPerSwab > 0 
            ? `${macoPerSwab.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} mg/Swab`
            : 'Not calculated';
            
        return { value: macoPerSwab, display };
    } catch (error) {
        console.error('Error calculating MACO for train:', train?.id || 'unknown', error);
        return { value: 0, display: 'Not calculated' };
    }
}


export function renderTrainSummary() {
    const container = document.getElementById('trainSummaryContainer');
    const noTrainsMsg = document.getElementById('noTrainSummaryMessage');
    container.innerHTML = '';

    // Use the same train generation logic as Worst Case view
    const linesWithTrains = getTrainsGroupedByLine();
    
    // Flatten all trains from all lines
    const allTrains = [];
    linesWithTrains.forEach(lineObj => {
        lineObj.trains.forEach(train => {
            allTrains.push({
                ...train,
                line: lineObj.line
            });
        });
    });

    if (allTrains.length === 0) {
        noTrainsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    // Filter trains if specific trains are selected for printing
    let trainsToRender = allTrains;
    if (window.printSelectedTrain && window.printSelectedTrain !== 'all') {
        console.log('Filtering trains for print:', window.printSelectedTrain);
        console.log('Available trains:', allTrains.map(t => t.id));
        
        if (Array.isArray(window.printSelectedTrain)) {
            // Multiple trains selected
            trainsToRender = allTrains.filter(train => window.printSelectedTrain.includes(String(train.id)));
        } else {
            // Single train selected (backward compatibility)
            trainsToRender = allTrains.filter(train => String(train.id) === String(window.printSelectedTrain));
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
    // Build a mapping of legacy train id -> { line, number } for friendly labels
    const idMap = utils.getTrainIdToLineNumberMap();

    // Sort trains by line first, then by train ID
    const sortedTrains = trainsToRender.sort((a, b) => {
        if (a.line !== b.line) {
            return a.line.localeCompare(b.line);
        }
        return a.id - b.id;
    });

    // Group trains by line and dosage form
    const groupedTrains = {};
    sortedTrains.forEach(train => {
        const line = train.line || 'Unassigned';
        const dosageForms = [...new Set(train.products.map(p => p.productType || 'Unknown'))];
        const dosageFormKey = dosageForms.join(', ');
        const groupKey = `${line}|${dosageFormKey}`;
        
        if (!groupedTrains[groupKey]) {
            groupedTrains[groupKey] = {
                line,
                dosageForm: dosageFormKey,
                trains: [],
                totalStudies: 0
            };
        }
        groupedTrains[groupKey].trains.push(train);
    });

    // Calculate total studies for each group and create study breakdown
    Object.keys(groupedTrains).forEach(groupKey => {
        const group = groupedTrains[groupKey];
        const trainsInGroup = group.trains;
        
        // Calculate RPN for each train and sort by RPN (highest first)
        const trainsWithRPN = trainsInGroup.map(t => {
            let highestRPN = 0;
            let worstProduct = null;
            let worstIngredient = null;
            
            if (t.products && t.products.length > 0) {
                t.products.forEach(product => {
                    if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                        product.activeIngredients.forEach(ingredient => {
                            try {
                                const scores = calculateScores(ingredient);
                                if (scores && scores.rpn > highestRPN) {
                                    highestRPN = scores.rpn;
                                    worstProduct = product;
                                    worstIngredient = ingredient;
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ingredient, error);
                            }
                        });
                    }
                });
            }
            return { 
                train: t, 
                rpn: highestRPN, 
                worstProduct, 
                worstIngredient 
            };
        }).sort((a, b) => b.rpn - a.rpn);
        
        // Create study breakdown with machine coverage logic (using RPN-sorted trains for studies)
        const allMachinesInGroup = new Set();
        trainsInGroup.forEach(train => {
            train.machineIds.forEach(id => allMachinesInGroup.add(id));
        });
        
        // For study calculation, we still need RPN-sorted trains
        const trainsWithRPNForStudies = trainsInGroup.map(t => {
            let highestRPN = 0;
            let worstProduct = null;
            let worstIngredient = null;
            
            if (t.products && t.products.length > 0) {
                t.products.forEach(product => {
                    if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                        product.activeIngredients.forEach(ingredient => {
                            try {
                                const scores = calculateScores(ingredient);
                                if (scores && scores.rpn > highestRPN) {
                                    highestRPN = scores.rpn;
                                    worstProduct = product;
                                    worstIngredient = ingredient;
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ingredient, error);
                            }
                        });
                    }
                });
            }
            return { train: t, rpn: highestRPN, worstProduct, worstIngredient };
        }).sort((a, b) => b.rpn - a.rpn); // Sort by RPN for study calculation
        
        const coveredMachines = new Set();
        group.studyBreakdown = trainsWithRPNForStudies.map(({ train, rpn, worstProduct, worstIngredient }, index) => {
            const studyNumber = index + 1;
            const mapped = idMap.get(String(train.id));
            const trainLabel = mapped ? `Train ${mapped.number}` : `T${train.id}`;
            
            // Calculate which machines this study covers (machines not covered by previous studies)
            const newMachines = train.machineIds.filter(machineId => 
                allMachinesInGroup.has(machineId) && !coveredMachines.has(machineId)
            );
            
            // Add these machines to the covered set
            newMachines.forEach(machineId => coveredMachines.add(machineId));
            
            // Get machine names for covered machines only
            const coveredMachineNames = newMachines.map(id => {
                const machine = state.machines.find(m => m.id === id);
                return machine ? machine.name : `Unknown (ID: ${id})`;
            }).join(', ');
            
            return {
                studyNumber,
                trainLabel,
                productName: worstProduct ? worstProduct.name : 'Unknown',
                ingredientName: worstIngredient ? worstIngredient.name : 'Unknown',
                rpn: rpn.toFixed(2),
                machines: coveredMachineNames
            };
        });
        
        // Total studies = number of trains in the group
        group.totalStudies = trainsInGroup.length;
    });

    // Generate table rows grouped by dosage form
    const tableRows = Object.keys(groupedTrains).map(groupKey => {
        const group = groupedTrains[groupKey];
        const trainsInGroup = group.trains;
        
        // Sort trains by train ID for proper order (Train 1, Train 2, Train 3)
        const trainsWithRPN = trainsInGroup.map(t => {
            let highestRPN = 0;
            if (t.products && t.products.length > 0) {
                t.products.forEach(product => {
                    if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                        product.activeIngredients.forEach(ingredient => {
                            try {
                                const scores = calculateScores(ingredient);
                                if (scores && scores.rpn > highestRPN) {
                                    highestRPN = scores.rpn;
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ingredient, error);
                            }
                        });
                    }
                });
            }
            return { train: t, rpn: highestRPN };
        }).sort((a, b) => a.train.id - b.train.id); // Sort by train ID instead of RPN
        
        // Generate rows for each train in the group
        const trainRows = trainsWithRPN.map(({ train }, index) => {
            // Get machine details
            const machines = train.machineIds.map(id => {
                const machine = state.machines.find(m => m.id === id);
                return machine ? machine : { id, name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
            });

            // Format machines display (individual machines only)
            const machinesDisplay = machines.map(m => m.name).join(', ');

            // Format products display (product names only)
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
            const macoResult = getMacoValueForTrain(train);
            const macoDisplay = macoResult.value > 0 
                ? `<span class="font-semibold text-green-600">${macoResult.display}</span>`
                : `<span class="text-gray-500">${macoResult.display}</span>`;

            const mapped = idMap.get(String(train.id));
            const trainLabel = mapped ? `Train ${mapped.number}` : `T${train.id}`;

            // Only show studies cell on the first row, with rowspan for the entire group
            const studiesCell = index === 0 
                ? `<td class="px-4 py-4 text-center align-middle" style="color: var(--text-primary); border-left: 2px solid var(--border-color);" rowspan="${group.trains.length}">
                    <div class="text-center">
                        <div class="font-bold text-orange-600 text-lg mb-2">${group.totalStudies} Studies</div>
                        <button 
                            onclick="toggleStudyBreakdown('${groupKey}')" 
                            class="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors duration-200 mb-2"
                        >
                            <span id="toggle-text-${groupKey}">Show Details</span>
                        </button>
                        <div id="breakdown-${groupKey}" class="text-xs space-y-1 hidden">
                            ${group.studyBreakdown.map(study => `
                                <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded border" style="border-color: var(--border-color);">
                                    <div class="font-semibold text-blue-600">Study ${study.studyNumber}: ${study.trainLabel}</div>
                                    <div class="text-gray-600 dark:text-gray-400">
                                        <div><strong>Product:</strong> ${study.productName}</div>
                                        <div><strong>Machines:</strong> ${study.machines}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                   </td>`
                : '';

            return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50" style="border-color: var(--border-color);">
                    <td class="px-4 py-4 text-center" style="color: var(--text-primary);">
                        <span class="font-semibold text-indigo-600">${group.line} - ${group.dosageForm}</span>
                    </td>
                    <td class="px-4 py-4 text-center font-bold text-lg" style="color: var(--text-primary);">${trainLabel}</td>
                    <td class="px-4 py-4" style="color: var(--text-primary);">
                        ${machinesAndProducts}
                    </td>
                    <td class="px-4 py-4" style="color: var(--text-primary);">
                        ${worstCaseDisplay}
                    </td>
                    <td class="px-4 py-4 text-center" style="color: var(--text-primary);">
                        ${macoDisplay}
                    </td>
                    ${studiesCell}
                </tr>
            `;
        }).join('');
        
        return trainRows;
    }).join('');

    container.innerHTML = `
        <div class="overflow-hidden rounded-lg border" style="border-color: var(--border-color);">
            <table class="w-full text-sm">
                <thead class="bg-gray-200 dark:bg-gray-700">
                    <tr>
                        <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); width: 15%;">Line - Dosage Form</th>
                        <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); width: 10%;">Train</th>
                               <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); width: 35%;">Machines & Products</th>
                        <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); width: 20%;">Worst Case Product</th>
                        <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); width: 12%;">MACO</th>
                               <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary); border-left: 2px solid var(--border-color); width: 8%;">Studies Needed</th>
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

// Toggle function for study breakdown details
window.toggleStudyBreakdown = function(groupKey) {
    const breakdown = document.getElementById(`breakdown-${groupKey}`);
    const toggleText = document.getElementById(`toggle-text-${groupKey}`);
    
    if (breakdown.classList.contains('hidden')) {
        breakdown.classList.remove('hidden');
        toggleText.textContent = 'Hide Details';
    } else {
        breakdown.classList.add('hidden');
        toggleText.textContent = 'Show Details';
    }
};

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

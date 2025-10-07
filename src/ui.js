// --- LocalStorage integration only ---
// (localStorage save/load functions should already exist below)
// General UI interaction functions (dark mode, modals, etc.)
// js/ui.js

import * as state from './state.js';
import { fullAppRender } from './app.js'; // Use a forward declaration if needed, or better, pass it as an argument. For simplicity, we import it.
import { generateTrainMap } from './utils.js';
import { toggleScoringEditMode } from './scoringView.js';
import { renderRpnChart } from './worstCaseView.js';
import { renderMacoChart } from './dashboardView.js';

const loader = document.getElementById('loader');

export const showLoader = () => loader.style.display = 'flex';
export const hideLoader = () => loader.style.display = 'none';

export function showCustomAlert(title, message) {
    document.getElementById('customAlertTitle').textContent = title;
    document.getElementById('customAlertMessage').textContent = message;
    document.getElementById('customAlertModal').style.display = 'flex';
}

export const hideModal = (modalId) => document.getElementById(modalId).style.display = 'none';
export const showModal = (modalId) => document.getElementById(modalId).style.display = 'flex';

export function saveAllDataToLocalStorage() {
    try {
        localStorage.setItem('macoProducts', JSON.stringify(state.products));
        localStorage.setItem('macoMachines', JSON.stringify(state.machines));
        localStorage.setItem('macoScoringCriteria', JSON.stringify(state.scoringCriteria));
        localStorage.setItem('macoDetergentIngredients', JSON.stringify(state.detergentIngredients));
        localStorage.setItem('machineStageDisplayOrder', JSON.stringify(state.machineStageDisplayOrder));
    } catch (e) {
        console.error("Failed to save data to localStorage", e);
        showCustomAlert("Save Error", "Could not save data. Storage might be full.");
    }
}

export function loadAllDataFromLocalStorage() {
    const savedProducts = localStorage.getItem('macoProducts');
    const savedMachines = localStorage.getItem('macoMachines');
    const savedCriteria = localStorage.getItem('macoScoringCriteria');
    const savedDetergents = localStorage.getItem('macoDetergentIngredients');
    const savedStageOrder = localStorage.getItem('machineStageDisplayOrder');

    if (savedProducts) { try { state.setProducts(JSON.parse(savedProducts)); } catch (e) { console.error("Error loading products", e); } }
    if (savedMachines) { try { state.setMachines(JSON.parse(savedMachines)); } catch (e) { console.error("Error loading machines", e); } }
    if (savedCriteria) { try { state.setScoringCriteria(JSON.parse(savedCriteria)); } catch (e) { console.error("Error loading scoring criteria", e); } }
    if (savedDetergents) { try { state.setDetergentIngredients(JSON.parse(savedDetergents)); } catch (e) { console.error("Error loading detergent ingredients", e); } }
    if (savedStageOrder) { try { state.setMachineStageDisplayOrder(JSON.parse(savedStageOrder)); } catch (e) { console.error("Error loading machine stage order", e); } }
}

// --- Undo/Redo Functions ---
export function saveStateForUndo() {
    generateTrainMap();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    const currentState = {
        products: JSON.parse(JSON.stringify(state.products)),
        machines: JSON.parse(JSON.stringify(state.machines)),
        scoringCriteria: JSON.parse(JSON.stringify(state.scoringCriteria)),
        detergentIngredients: JSON.parse(JSON.stringify(state.detergentIngredients))
    };
    newHistory.push(currentState);
    state.setHistory(newHistory, newHistory.length - 1);
    updateUndoRedoButtons();
    saveAllDataToLocalStorage();
}

export function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

export function undoChange() {
    if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const prevState = state.history[newIndex];
        state.setProducts(JSON.parse(JSON.stringify(prevState.products)));
        state.setMachines(JSON.parse(JSON.stringify(prevState.machines)));
        state.setScoringCriteria(JSON.parse(JSON.stringify(prevState.scoringCriteria)));
        state.setDetergentIngredients(JSON.parse(JSON.stringify(prevState.detergentIngredients)));
        state.setHistory(state.history, newIndex);
        
        // Force scoring view out of edit mode to properly reflect changes
        if (state.scoringInEditMode) {
            toggleScoringEditMode(false);
        }
        
        fullAppRender();
        updateUndoRedoButtons();
        saveAllDataToLocalStorage();
    }
}

export function redoChange() {
    if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const nextState = state.history[newIndex];
        state.setProducts(JSON.parse(JSON.stringify(nextState.products)));
        state.setMachines(JSON.parse(JSON.stringify(nextState.machines)));
        state.setScoringCriteria(JSON.parse(JSON.stringify(nextState.scoringCriteria)));
        state.setDetergentIngredients(JSON.parse(JSON.stringify(nextState.detergentIngredients)));
        state.setHistory(state.history, newIndex);
        
        // Force scoring view out of edit mode to properly reflect changes
        if (state.scoringInEditMode) {
            toggleScoringEditMode(false);
        }
        
        fullAppRender();
        updateUndoRedoButtons();
        saveAllDataToLocalStorage();
    }
}

// --- THEME & PRINT ---
export function toggleDarkMode(isDark) {
    const lightIcon = document.getElementById('theme-toggle-light-icon');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    if (isDark) {
        document.documentElement.classList.add('dark');
        if (lightIcon) lightIcon.classList.add('hidden');
        if (darkIcon) darkIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        if (lightIcon) lightIcon.classList.remove('hidden');
        if (darkIcon) darkIcon.classList.add('hidden');
    }
    if (state.rpnChartInstance) { renderRpnChart(); }
    if (state.macoChartInstance) { renderMacoChart(); }
}

export function printCurrentView(viewName, selectedTrain = 'all') {
    if (viewName === 'scoring-system' && state.scoringInEditMode) {
        state.setScoringWasInEditModeForPrint(true);
        toggleScoringEditMode(false);
    }
    if (viewName === 'machines') {
        // viewName = 'machineManagement';
    }
    console.log('Printing view:', viewName, 'Train:', selectedTrain);
    document.body.classList.add(`printing-${viewName}`);

    // For worst case view, re-render to expand all trains for printing
    if (viewName === 'worstCaseProducts') {
        // Import and call the render function to expand trains
        import('./worstCaseView.js').then(worstCaseView => {
            // Store the selected train(s) for filtering during print
            window.printSelectedTrain = selectedTrain;
            worstCaseView.renderWorstCaseByTrain();
            setTimeout(() => {
                window.print();
            }, 200);
        });
    } else if (viewName === 'macoForTrains') {
        // Store the selected train(s) for filtering during print
        window.printSelectedTrain = selectedTrain;
        
        // For MACO view, expand all trains before printing and re-render with filter
        import('./macoProductView.js').then(macoProductView => {
            macoProductView.renderMacoForTrains();
            
            const allTrainContents = document.querySelectorAll('#macoForTrains .train-content.collapsed');
            const collapsedTrainIds = [];
            
            // Track which trains were collapsed so we can restore them after printing
            allTrainContents.forEach(content => {
                const match = content.id.match(/content-pm-(\d+)/);
                if (match) {
                    collapsedTrainIds.push(match[1]);
                    // Expand the train
                    content.classList.remove('collapsed');
                    const toggle = document.getElementById(`toggle-pm-${match[1]}`);
                    if (toggle) toggle.textContent = '▼';
                }
            });
            
            // Also expand any MACO breakdown details that are hidden
            const hiddenBreakdowns = document.querySelectorAll('#macoForTrains [id^="maco-breakdown-details-"].hidden');
            const hiddenBreakdownIds = [];
            hiddenBreakdowns.forEach(breakdown => {
                const match = breakdown.id.match(/maco-breakdown-details-(\d+)/);
                if (match) {
                    hiddenBreakdownIds.push(match[1]);
                    breakdown.classList.remove('hidden');
                    const toggle = document.getElementById(`breakdown-toggle-btn-${match[1]}`);
                    if (toggle) toggle.textContent = 'Hide MACO Calculation Breakdown';
                }
            });
            
            setTimeout(() => {
                window.print();
                
                // Restore collapsed states after printing
                setTimeout(() => {
                    collapsedTrainIds.forEach(trainId => {
                        const content = document.getElementById(`content-pm-${trainId}`);
                        const toggle = document.getElementById(`toggle-pm-${trainId}`);
                        if (content) content.classList.add('collapsed');
                        if (toggle) toggle.textContent = '▶';
                    });
                    
                    hiddenBreakdownIds.forEach(trainId => {
                        const breakdown = document.getElementById(`maco-breakdown-details-${trainId}`);
                        const toggle = document.getElementById(`breakdown-toggle-btn-${trainId}`);
                        if (breakdown) breakdown.classList.add('hidden');
                        if (toggle) toggle.textContent = 'Show MACO Calculation Breakdown';
                    });
                }, 1000);
            }, 200);
        });
    } else if (viewName === 'detergentMaco') {
        // Store the selected train(s) for filtering during print
        window.printSelectedTrain = selectedTrain;

        // Re-render Detergent MACO with filter
        import('./macoDetergentView.js').then(macoDetergentView => {
            macoDetergentView.renderDetergentMaco();

            // For Detergent MACO view, expand displayed trains before printing
            const allTrainContents = document.querySelectorAll('#detergentMaco .train-content.collapsed');
            const collapsedTrainIds = [];

            // Track which trains were collapsed so we can restore them after printing
            allTrainContents.forEach(content => {
                const match = content.id.match(/content-dm-(\d+)/);
                if (match) {
                    collapsedTrainIds.push(match[1]);
                    // Expand the train
                    content.classList.remove('collapsed');
                    const toggle = document.getElementById(`toggle-dm-${match[1]}`);
                    if (toggle) toggle.textContent = '▼';
                }
            });

            setTimeout(() => {
                window.print();

                // Restore collapsed states after printing
                setTimeout(() => {
                    collapsedTrainIds.forEach(trainId => {
                        const content = document.getElementById(`content-dm-${trainId}`);
                        const toggle = document.getElementById(`toggle-dm-${trainId}`);
                        if (content) content.classList.add('collapsed');
                        if (toggle) toggle.textContent = '▶';
                    });
                }, 1000);
            }, 200);
        }).catch(error => {
            console.error('Error loading detergent view for print:', error);
            window.print();
        }).finally(() => {
            // Clear printSelectedTrain and re-render detergent view to restore full list
            setTimeout(() => {
                window.printSelectedTrain = null;
                import('./macoDetergentView.js').then(m => m.renderDetergentMaco()).catch(() => {});
            }, 1200);
        });
    } else if (viewName === 'trainSummary') {
        // Store the selected train(s) for filtering during print
        window.printSelectedTrain = selectedTrain;
        console.log('Setting printSelectedTrain to:', selectedTrain);
        
        // Re-render Train Summary with filter
        import('./trainSummaryView.js').then(trainSummaryView => {
            trainSummaryView.renderTrainSummary();
            
            // Wait a bit longer and also check if content is visible
            setTimeout(() => {
                const container = document.getElementById('trainSummaryContainer');
                const noTrainsMsg = document.getElementById('noTrainSummaryMessage');
                
                console.log('Container display:', container ? container.style.display : 'not found');
                console.log('No trains message display:', noTrainsMsg ? noTrainsMsg.style.display : 'not found');
                console.log('Container has content:', container ? container.innerHTML.length > 0 : false);
                
                if (!container || container.style.display === 'none') {
                    console.warn('Train summary container is hidden or missing');
                    alert('No train data to print. Please ensure you have created trains first.');
                    return;
                }
                
                window.print();
                
                // Clear the filter after printing and re-render to show all trains
                setTimeout(() => {
                    window.printSelectedTrain = null;
                    trainSummaryView.renderTrainSummary();
                }, 1000);
            }, 500); // Increased timeout to give more time for rendering
        }).catch(error => {
            console.error('Error loading train summary view:', error);
            alert('Error loading train summary: ' + error.message);
        });
    } else {
        setTimeout(() => {
            window.print();
        }, 100);
    }
}

// --- COLUMN VISIBILITY ---
export function toggleColumn(col, tabId) {
    // For toxicity columns (pde/ld50), synchronize between Product Register and Worst Case views
    if (col === 'pde' || col === 'ld50') {
        // Toggle on both Product Register and Worst Case views
        ['productRegister', 'worstCaseProducts'].forEach(targetTabId => {
            document.querySelectorAll(`#${targetTabId} .mainTable, #${targetTabId} .ingredients-sub-table`).forEach(table => {
                table.classList.toggle(`hide-${col}`);
            });
            
            // Also apply to the tab container and train content for worst case view
            document.querySelectorAll(`#${targetTabId}, #${targetTabId} .train-content-inner`).forEach(element => {
                if (element) {
                    element.classList.toggle(`hide-${col}`);
                }
            });
        });
        
        // Store the state using productRegister as the master reference
        const anyTableHidden = document.querySelector(`#productRegister .mainTable.hide-${col}`) !== null;
        localStorage.setItem(`productRegister-${col}Hidden`, anyTableHidden);
        
        // Update toggle icons for both tabs
        updateToggleIcons('productRegister');
        updateToggleIcons('worstCaseProducts');
        
        // Re-render worst case view to update RPN calculations with new toxicity preference
        import('./worstCaseView.js').then(worstCaseModule => {
            worstCaseModule.renderWorstCaseByTrain();
        });
        
        // Re-render RPN chart if visible
        import('./worstCaseView.js').then(worstCaseModule => {
            if (worstCaseModule.renderRpnChart) {
                worstCaseModule.renderRpnChart();
            }
        });
    } else {
        // For other columns, only toggle on the specific tab
        document.querySelectorAll(`#${tabId} .mainTable, #${tabId} .ingredients-sub-table`).forEach(table => {
            table.classList.toggle(`hide-${col}`);
        });
        
        const anyTableHidden = document.querySelector(`#${tabId} .mainTable.hide-${col}`) !== null;
        localStorage.setItem(`${tabId}-${col}Hidden`, anyTableHidden);
        updateToggleIcons(tabId);
    }
}

export function toggleColumnVisibilityDropdown() {
    const dropdown = document.getElementById('columnVisibilityDropdown');
    dropdown.classList.toggle('hidden');

    if (!dropdown.classList.contains('hidden')) {
        document.addEventListener('click', function closeDropdown(e) {
            if (!e.target.closest('#columnVisibilityDropdown') && !e.target.closest('button[onclick="toggleColumnVisibilityDropdown()"]')) {
                dropdown.classList.add('hidden');
                document.removeEventListener('click', closeDropdown);
            }
        });
    }
}

export function updateToggleIcons(tabId) {
    const tabContainer = document.getElementById(tabId);
    if (!tabContainer) return;

    // For toxicity columns, always use productRegister as the master reference
    let pdeHidden, ld50Hidden;
    if (tabId === 'worstCaseProducts') {
        // Use productRegister state as master for toxicity columns
        // Default to false (visible) if no localStorage value exists
        const pdeStorage = localStorage.getItem('productRegister-pdeHidden');
        const ld50Storage = localStorage.getItem('productRegister-ld50Hidden');
        
        // If no localStorage values exist (first visit), both should be visible
        if (pdeStorage === null && ld50Storage === null) {
            pdeHidden = false;
            ld50Hidden = false;
        } else {
            const masterPdeHidden = pdeStorage === 'true';
            const masterLd50Hidden = ld50Storage === 'true';
            
            // Special case: if both are hidden in Product Register, show PDE in worst case view
            if (masterPdeHidden && masterLd50Hidden) {
                pdeHidden = false; // Show PDE in worst case view
                ld50Hidden = true;  // Hide LD50 in worst case view
            } else {
                // Otherwise, mirror the Product Register settings
                pdeHidden = masterPdeHidden;
                ld50Hidden = masterLd50Hidden;
            }
        }
    } else {
        // For productRegister or other tabs, check localStorage values, defaulting to false (visible)
        const pdeStorage = localStorage.getItem(`${tabId}-pdeHidden`);
        const ld50Storage = localStorage.getItem(`${tabId}-ld50Hidden`);
        pdeHidden = pdeStorage === 'true';
        ld50Hidden = ld50Storage === 'true';
    }

    const pdeToggle = tabContainer.querySelector('.toggle-pde');
    const ld50Toggle = tabContainer.querySelector('.toggle-ld50');

    if (pdeToggle) pdeToggle.innerHTML = pdeHidden ? `Show PDE` : `Hide PDE`;
    if (ld50Toggle) ld50Toggle.innerHTML = ld50Hidden ? `Show LD50` : `Hide LD50`;

    // Apply hide classes to all relevant elements in the tab
    const tables = document.querySelectorAll(`#${tabId} .mainTable, #${tabId} .ingredients-sub-table`);
    tables.forEach(table => {
        if (table) {
            table.classList.toggle('hide-pde', pdeHidden);
            table.classList.toggle('hide-ld50', ld50Hidden);
        }
    });
    
    // Also apply to the tab container and train content
    const containers = document.querySelectorAll(`#${tabId}, #${tabId} .train-content-inner`);
    containers.forEach(element => {
        if (element) {
            element.classList.toggle('hide-pde', pdeHidden);
            element.classList.toggle('hide-ld50', ld50Hidden);
        }
    });
}

// --- DATA I/O ---
export function exportToExcel() {
    showLoader();
    
    // Import required functions (they should already be available since they're used elsewhere)
    import('./utils.js').then(utils => {
        const { getProductTrainId, calculateScores } = utils;
        
        const dataForExport = [];
        // Use ALL products, not the filtered view
        const productsToExport = state.products;

        productsToExport.forEach(product => {
            let criticalText = 'No';
            if (product.isCritical) {
                criticalText = `Yes${product.criticalReason ? `: ${product.criticalReason}` : ''}`;
            }
            
            const trainId = getProductTrainId(product);
            const productDate = product.date ? new Date(product.date).toLocaleDateString() : '';
            
            // Add main product row with basic info and no ingredient details
            dataForExport.push({
                "Date": productDate,
                "Product Code": product.productCode,
                "Product Name": product.name,
                "Train No.": trainId,
                "Dosage Form": product.productType || '',
                "Batch Size (Kg)": product.batchSizeKg,
                "Special Case Product": criticalText,
                "Active Ingredient": '',
                "Solubility": '',
                "Therapeutic Dose (mg/day)": '',
                "Cleanability": '',
                "PDE (µg/day)": '',
                "LD50 (mg/kg)": '',
                "Solubility Score": '',
                "Therapeutic Dose Score": '',
                "Cleanability Score": '',
                "Toxicity Score": '',
                "RPN": '',
                "RPN Rating": ''
            });

            // Add separate rows for each ingredient under this product
            product.activeIngredients.forEach(ing => {
                const scores = calculateScores(ing);
                
                dataForExport.push({
                    "Date": '',
                    "Product Code": '',
                    "Product Name": `  └─ ${ing.name}`, // Indented ingredient name
                    "Train No.": '',
                    "Dosage Form": '',
                    "Batch Size (Kg)": '',
                    "Special Case Product": '',
                    "Active Ingredient": ing.name,
                    "Solubility": ing.solubility || '',
                    "Therapeutic Dose (mg/day)": ing.therapeuticDose || '',
                    "Cleanability": ing.cleanability || '',
                    "PDE (µg/day)": ing.pde || '',
                    "LD50 (mg/kg)": ing.ld50 || '',
                    "Solubility Score": scores.solubilityScore || '',
                    "Therapeutic Dose Score": scores.therapeuticDoseScore || '',
                    "Cleanability Score": scores.cleanabilityScore || '',
                    "Toxicity Score": scores.pdeScore || scores.ld50Score || '',
                    "RPN": scores.rpn,
                    "RPN Rating": scores.rpnRatingText
                });
            });
        });
        
        if (dataForExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There is no data in the current view to export.");
            return;
        }
        
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MACO Report");
        
        // Set column widths
        const headerKeys = Object.keys(dataForExport[0]);
        const colWidths = headerKeys.map(key => ({
            wch: Math.max(key.length, ...dataForExport.map(row => String(row[key] || '').length)) + 2
        }));
        worksheet["!cols"] = colWidths;
        
        XLSX.writeFile(workbook, "MACO_All_Products_Report.xlsx");
        hideLoader();
    }).catch(error => {
        console.error('Error exporting to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export data to Excel.");
    });
}
export function exportAllToJson() {
    showLoader();
    try {
        const exportData = {
            exportDate: new Date().toISOString(),
            scoringCriteria: state.scoringCriteria,
            products: state.products,
            machines: state.machines,
            detergentIngredients: state.detergentIngredients
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'maco_data_export.json';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    catch (error) {
        showCustomAlert("Error", "Failed to export data to JSON."+error.message);
    } finally {
        hideLoader();
    }
}

export function importFromJson(event) {
    // ... (code is identical, but calls `fullAppRender` and `saveStateForUndo` which are in other modules)
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function (e) { try { const data = JSON.parse(e.target.result); if (data && data.products && data.scoringCriteria && data.machines) { state.setProducts(data.products); state.setMachines(data.machines); state.setScoringCriteria(data.scoringCriteria); if (data.detergentIngredients) state.setDetergentIngredients(data.detergentIngredients); saveStateForUndo(); fullAppRender(); showCustomAlert("Success", "Data imported successfully."); } else { showCustomAlert("Error", "Invalid JSON file structure."); } } catch (err) { showCustomAlert("Error", "Failed to parse JSON file."); } finally { event.target.value = ''; } }; reader.readAsText(file);
}


// --- FORM HELPERS ---
export function toggleOtherProductType(selectElement, containerId) {
    const container = document.getElementById(containerId);
    const input = container.querySelector('input');
    if (selectElement.value === 'Other') {
        container.style.display = 'block';
        input.required = true;
    } else {
        container.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

export function toggleOtherMachineStage(selectElement, containerId) {
    const container = document.getElementById(containerId);
    const input = container.querySelector('input');
    if (selectElement.value === 'Other') {
        container.style.display = 'block';
        input.required = true;
    } else {
        container.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

export function toggleOtherMachineGroup(selectElement, containerId) {
    const container = document.getElementById(containerId);
    const input = container.querySelector('input');
    if (selectElement.value === 'Other') {
        container.style.display = 'block';
        input.required = true;
    } else {
        container.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

export function clampSafetyFactor(inputElement, trainId) {
    // This function is called from two different tabs, making it a good utility
    // It will need to call the recalculate functions from the respective view modules
    // This is a bit tricky. A better architecture might use custom events, but for now, we can check the element's ID.
    const min = parseFloat(inputElement.min);
    const max = parseFloat(inputElement.max);
    let value = parseFloat(inputElement.value);

    if (isNaN(value)) {
        value = min; // Default to min if input is invalid
    }

    if (value < min) {
        value = min;
    } else if (value > max) {
        value = max;
    }

    if (parseFloat(inputElement.value) !== value) {
        inputElement.value = value;
    }

    if (inputElement.id.startsWith('product-sf-input')) {
        recalculateProductMacoForTrain(trainId);
    } else if (inputElement.id.startsWith('sf-input-train')) {
        recalculateDetergentMacoForTrain(trainId);
    }
}

// --- COLLAPSIBLE CONTENT ---
export function toggleTrain(trainId) {
    const content = document.getElementById(`content-${trainId}`);
    const toggle = document.getElementById(`toggle-${trainId}`);

    if (content && toggle) {
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            toggle.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            toggle.textContent = '▶';
        }
    }
}

export function toggleMacoBreakdown(trainId) {
    const details = document.getElementById(`maco-breakdown-details-${trainId}`);
    const btn = document.getElementById(`breakdown-toggle-btn-${trainId}`);
    const isHidden = details.classList.contains('hidden');

    if (isHidden) {
        details.classList.remove('hidden');
        btn.textContent = 'Hide MACO Calculation Breakdown';
    } else {
        details.classList.add('hidden');
        btn.textContent = 'Show MACO Calculation Breakdown';
    }
}

export function exportWorstCaseToExcel(selectedTrain = 'all') {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getProductTrainId, calculateScores, getToxicityPreference } = utils;
        
        const dataForExport = [];
        
        // Get the current filtered products from worst case view
        let productsToExport = state.viewProducts['worstCaseProducts'] || state.products;
        
        if (productsToExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no products in the worst case view to export.");
            return;
        }
        
        // Group products by train for export
        const productsByTrain = {};
        productsToExport.forEach(product => {
            const trainId = getProductTrainId(product);
            if (trainId === 'N/A') return;
            if (!productsByTrain[trainId]) {
                productsByTrain[trainId] = [];
            }
            productsByTrain[trainId].push(product);
        });
        
        // Filter by selected trains
        let trainsToExport = productsByTrain;
        if (selectedTrain !== 'all') {
            trainsToExport = {};
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                selectedTrain.forEach(trainId => {
                    if (productsByTrain[trainId]) {
                        trainsToExport[trainId] = productsByTrain[trainId];
                    }
                });
            } else {
                // Single train selected (backward compatibility)
                if (productsByTrain[selectedTrain]) {
                    trainsToExport = { [selectedTrain]: productsByTrain[selectedTrain] };
                }
            }
            
            if (Object.keys(trainsToExport).length === 0) {
                hideLoader();
                const trainText = Array.isArray(selectedTrain) ? `Trains ${selectedTrain.join(', ')}` : `Train ${selectedTrain}`;
                showCustomAlert("No Data", `${trainText} not found or has no products.`);
                return;
            }
        }
        
        const toxicityPreference = getToxicityPreference();
        
        // Sort trains by ID
        const sortedTrainIds = Object.keys(trainsToExport).sort((a, b) => a - b);
        
        sortedTrainIds.forEach(trainId => {
            const trainProducts = trainsToExport[trainId];
            
            // Add train header row
            dataForExport.push({
                "Train": `Train ${trainId} - Worst Case Analysis`,
                "Product Code": '',
                "Product Name": '',
                "Highest RPN": '',
                "Special Case Product": '',
                "Ingredient": '',
                "TD Score": '',
                "Solubility Score": '',
                "Cleanability Score": '',
                "PDE Score": '',
                "LD50 Score": '',
                "RPN": '',
                "Rating": ''
            });
            
            // Sort products by RPN (highest first)
            trainProducts.forEach(product => {
                const values = product.activeIngredients.map(ing => calculateScores(ing, toxicityPreference).rpn);
                product.sortValue = values.length > 0 ? Math.max(...values) : 0;
            });
            
            trainProducts.sort((a, b) => b.sortValue - a.sortValue);
            
            trainProducts.forEach(product => {
                const criticalText = product.isCritical ? 'Yes' : 'No';
                
                // Add product header row
                dataForExport.push({
                    "Train": '',
                    "Product Code": product.productCode,
                    "Product Name": product.name,
                    "Highest RPN": product.sortValue,
                    "Special Case Product": criticalText,
                    "Ingredient": '',
                    "TD Score": '',
                    "Solubility Score": '',
                    "Cleanability Score": '',
                    "PDE Score": '',
                    "LD50 Score": '',
                    "RPN": '',
                    "Rating": ''
                });
                
                // Sort ingredients by RPN (highest first)
                const sortedIngredients = product.activeIngredients.sort((a, b) => 
                    calculateScores(b, toxicityPreference).rpn - calculateScores(a, toxicityPreference).rpn
                );
                
                // Add ingredient rows
                sortedIngredients.forEach(ingredient => {
                    const scores = calculateScores(ingredient, toxicityPreference);
                    
                    dataForExport.push({
                        "Train": '',
                        "Product Code": '',
                        "Product Name": '',
                        "Highest RPN": '',
                        "Special Case Product": '',
                        "Ingredient": ingredient.name,
                        "TD Score": scores.therapeuticDoseScore,
                        "Solubility Score": scores.solubilityScore,
                        "Cleanability Score": scores.cleanabilityScore,
                        "PDE Score": scores.pdeScore ?? 'N/A',
                        "LD50 Score": scores.ld50Score ?? 'N/A',
                        "RPN": scores.rpn,
                        "Rating": scores.rpnRatingText
                    });
                });
                
                // Add empty row between products
                dataForExport.push({
                    "Train": '', "Product Code": '', "Product Name": '', "Highest RPN": '', 
                    "Special Case Product": '', "Ingredient": '', "TD Score": '', 
                    "Solubility Score": '', "Cleanability Score": '', "PDE Score": '', 
                    "LD50 Score": '', "RPN": '', "Rating": ''
                });
            });
        });
        
        if (dataForExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There is no data in the worst case view to export.");
            return;
        }
        
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Worst Case Products");
        
        // Set column widths
        const headerKeys = Object.keys(dataForExport[0]);
        const colWidths = headerKeys.map(key => ({
            wch: Math.max(key.length, ...dataForExport.map(row => String(row[key] || '').length)) + 2
        }));
        worksheet["!cols"] = colWidths;
        
        const timestamp = new Date().toISOString().split('T')[0];
        let trainSuffix = '';
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                trainSuffix = `_Trains_${selectedTrain.join('_')}`;
            } else {
                trainSuffix = `_Train_${selectedTrain}`;
            }
        }
        XLSX.writeFile(workbook, `MACO_Worst_Case_Products${trainSuffix}_${timestamp}.xlsx`);
        hideLoader();
    }).catch(error => {
        console.error('Error exporting worst case to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export worst case data to Excel.");
    });
}

export function exportMachinesToExcel() {
    showLoader();
    
    try {
        if (state.machines.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no machines to export.");
            return;
        }
        
        const dataForExport = [];
        
        // Group machines by stage for better organization
        const machinesByStage = {};
        state.machines.forEach(machine => {
            if (!machinesByStage[machine.stage]) {
                machinesByStage[machine.stage] = [];
            }
            machinesByStage[machine.stage].push(machine);
        });
        
        // Sort stages according to the display order
        state.machineStageDisplayOrder.forEach(stage => {
            if (machinesByStage[stage]) {
                machinesByStage[stage].forEach(machine => {
                    // Get products assigned to this machine
                    const assignedProducts = state.products.filter(product => 
                        product.machineIds && product.machineIds.includes(machine.id)
                    );
                    
                    const productNames = assignedProducts.map(p => p.name).join(', ') || 'None';
                    const productCount = assignedProducts.length;
                    
                    dataForExport.push({
                        'Machine Number': machine.machineNumber,
                        'Machine Name': machine.name,
                        'Stage': machine.stage,
                        'Area (sq cm)': machine.area,
                        'Assigned Products Count': productCount,
                        'Assigned Products': productNames
                    });
                });
            }
        });
        
        // Create Excel workbook
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Machines");
        
        // Auto-size columns
        const columnWidths = [
            { wch: 15 }, // Machine Number
            { wch: 20 }, // Machine Name
            { wch: 15 }, // Stage
            { wch: 15 }, // Area
            { wch: 20 }, // Product Count
            { wch: 50 }  // Assigned Products
        ];
        worksheet['!cols'] = columnWidths;
        
        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().split('T')[0];
        
        XLSX.writeFile(workbook, `MACO_Machines_${timestamp}.xlsx`);
        
        hideLoader();
        showCustomAlert("Success", "Machines data exported to Excel successfully!");
        
    } catch (error) {
        console.error('Error exporting machines to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export machines data to Excel.");
    }
}

export function exportProductMacoToExcel(selectedTrain = 'all') {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getTrainData, getWorstCaseProductType, getMacoPerSwabForTrain, getLargestEssaForLineAndDosageForm } = utils;
        
        const trainData = getTrainData();
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export. Assign machines to products first.");
            return;
        }
        
        // Filter trains based on selection
        let trainsToExport = trainData;
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                trainsToExport = trainData.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                // Single train selected (backward compatibility)
                trainsToExport = trainData.filter(train => String(train.id) === String(selectedTrain));
            }
        }
        
        if (trainsToExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "No trains match the selected criteria.");
            return;
        }
        
        const dataForExport = [];
        
        // Note: ESSA will be calculated per train based on line and dosage form
        
        trainsToExport.forEach(train => {
            const worstCaseType = getWorstCaseProductType(train.products.map(p => p.productType));
            const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];
            
            // Calculate MACO values using the same logic as in the view
            const sf = sfConfig.max;
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            let macoNoel = Infinity;
            
            // Check toxicity preference to determine which equations to show
            const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
            const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
            
            // Calculate PDE-based MACO if PDE is available and not hidden
            if (train.lowestPde !== null && !pdeHidden) {
                macoHealth = train.lowestPde * train.minBsMddRatio;
            }
            
            // Calculate NOEL-based MACO if LD50 is available and not hidden
            if (train.lowestLd50 !== null && !ld50Hidden) {
                // NOEL = (LD50 g/kg × 70 kg) ÷ 2000
                const noel = (train.lowestLd50 * 70) / 2000; // NOEL in g
                // Find minimum MDD from all ingredients in the train
                const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000)); // Convert mg to g
                const minMdd = Math.min(...allMdds);
                // MACO = (NOEL g × min batch size g × 1000) ÷ (safety factor × MDD g)
                macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
            }
            
            // Calculate line-specific largest ESSA for this train
            const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
            const macoVisual = 0.004 * lineLargestEssa;
            
            // Build MACO values array conditionally based on toxicity data visibility
            const allMacoValues = [
                { name: '0.1% Therapeutic Dose', value: macoDose },
                { name: '10 ppm Criterion', value: maco10ppm }
            ];
            
            // Add PDE equation only if PDE is available and not hidden
            if (train.lowestPde !== null && !pdeHidden) {
                allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
            }
            
            // Add NOEL equation only if LD50 is available and not hidden
            if (train.lowestLd50 !== null && !ld50Hidden) {
                allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
            }
            
            // Always add visual clean limit
            allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
            
            const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
            const finalMaco = finalMacoResult.value;
            const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
            const macoPerSwab = macoPerArea * train.assumedSsa;
            
            // Get machine details with group-based formatting
            const machines = train.machineIds.map(id => {
                const machine = state.machines.find(m => m.id === id);
                return machine ? machine : { name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
            });
            
            // Create plain text version of machines for Excel export
            const machinesListPlainText = train.machineIds.map(machineId => {
                const machine = state.machines.find(m => m.id === machineId);
                return machine ? machine.name : `Unknown (ID: ${machineId})`;
            }).join(', ');
            
            const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
            
            // Get worst-case product info
            const worstRpnInfo = train.worstProductRpn ? 
                `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                'N/A';
            
            // Add train summary row
            dataForExport.push({
                'Train': `T${train.id}`,
                'Total Products': train.products.length,
                'Total Machines': machines.length,
                'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                'Products': productsList,
                'Machines': machinesListPlainText, // Use plain text version for Excel
                'Worst-Case Dosage Form': worstCaseType,
                'Safety Factor': sf,
                'Lowest LTD (mg)': train.lowestLtd,
                'Min Batch Size (kg)': train.minMbsKg,
                'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                'Lowest PDE (mg)': train.lowestPde !== null ? train.lowestPde : 'N/A',
                'Worst-Case Product (by RPN)': worstRpnInfo,
                'MACO - Therapeutic Dose (mg)': macoDose.toFixed(2),
                'MACO - 10 ppm (mg)': maco10ppm.toFixed(2),
                'MACO - Health-Based (mg)': typeof macoHealth === 'number' ? macoHealth.toFixed(2) : 'N/A',
                'MACO - Visual Clean (mg)': macoVisual.toFixed(2),
                'Selected MACO Method': finalMacoResult.name,
                'Final MACO (mg)': finalMaco.toFixed(2),
                'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                'MACO per Swab (mg/Swab)': macoPerSwab.toFixed(4)
            });
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Product MACO Report");
        
        // Set column widths for better readability
        const colWidths = [
            { wch: 8 },   // Train
            { wch: 12 },  // Total Products
            { wch: 12 },  // Total Machines
            { wch: 15 },  // Total Area
            { wch: 50 },  // Products
            { wch: 50 },  // Machines
            { wch: 15 },  // Worst-Case Form
            { wch: 12 },  // Safety Factor
            { wch: 12 },  // Lowest LTD
            { wch: 12 },  // Min Batch Size
            { wch: 12 },  // Min BS/MDD Ratio
            { wch: 12 },  // Lowest PDE
            { wch: 40 },  // Worst-Case Product
            { wch: 18 },  // MACO Therapeutic
            { wch: 15 },  // MACO 10 ppm
            { wch: 18 },  // MACO Health
            { wch: 15 },  // MACO Visual
            { wch: 20 },  // Selected Method
            { wch: 15 },  // Final MACO
            { wch: 18 },  // MACO per Area
            { wch: 18 }   // MACO per Swab
        ];
        worksheet['!cols'] = colWidths;
        
        const timestamp = new Date().toISOString().split('T')[0];
        let filename = 'Product_MACO_Report';
        
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple specific trains
                const trainIds = selectedTrain.sort((a, b) => a - b);
                filename += `_Trains_${trainIds.join('_')}`;
            } else {
                // Single specific train
                filename += `_Train_${selectedTrain}`;
            }
        }
        
        filename += `_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        hideLoader();
        showCustomAlert("Success", "Product MACO data exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting Product MACO to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export Product MACO data to Excel.");
    });
}

export function exportDetergentMacoToExcel(selectedTrain = 'all') {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getTrainData, getWorstCaseProductType } = utils;
        
        let trainData = getTrainData();

        // Filter trains if a selection was provided
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                trainData = trainData.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                trainData = trainData.filter(train => String(train.id) === String(selectedTrain));
            }
        }
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export. Assign machines to products first.");
            return;
        }
        
        if (state.detergentIngredients.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no detergent ingredients configured. Add detergent ingredients first.");
            return;
        }
        
        const dataForExport = [];
        
        // Note: ESSA will be calculated per train based on line and dosage form
        
        // Get detergent calculation parameters
        const bodyWeight = parseFloat(document.getElementById('bodyWeight')?.value) || 70; // Default 70kg
        const ld50Values = state.detergentIngredients.map(i => parseFloat(i.ld50)).filter(ld50 => !isNaN(ld50));
        const minLd50 = ld50Values.length > 0 ? Math.min(...ld50Values) : 0;
        const detergentNames = state.detergentIngredients.map(i => i.name).filter(name => name.trim() !== '').join(', ');
        
        trainData.forEach(train => {
            const worstCaseType = getWorstCaseProductType(train.products.map(p => p.productType));
            const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];
            
            // Get current safety factor from UI or use default max
            const sfInput = document.getElementById(`sf-input-train-${train.id}`);
            const sf = sfInput ? parseFloat(sfInput.value) || sfConfig.max : sfConfig.max;
            
            // Calculate detergent MACO values using the same logic as in the view
            const adi = (5e-4 * minLd50 * bodyWeight) / sf;
            const maco = adi * train.minBsMddRatio;
            // Calculate line-specific largest ESSA for this train
            const lineLargestEssa = utils.getLargestEssaForLineAndDosageForm(train, trainData);
            const macoPerArea = lineLargestEssa > 0 ? maco / lineLargestEssa : 0;
            const macoPerSwab = macoPerArea * train.assumedSsa;
            
            // Get machine details
            const machines = train.machineIds.map(id => {
                const machine = state.machines.find(m => m.id === id);
                return machine ? machine : { name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
            });
            
            // Create plain text version of machines for Excel export
            const machinesListPlainText = train.machineIds.map(machineId => {
                const machine = state.machines.find(m => m.id === machineId);
                return machine ? machine.name : `Unknown (ID: ${machineId})`;
            }).join(', ');
            
            const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
            
            // Get worst-case product info
            const worstRpnInfo = train.worstProductRpn ? 
                `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                'N/A';
            
            // Add train summary row
            dataForExport.push({
                'Train': `T${train.id}`,
                'Total Products': train.products.length,
                'Total Machines': machines.length,
                'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                'Products': productsList,
                'Machines': machinesListPlainText, // Use plain text version for Excel
                'Worst-Case Dosage Form': worstCaseType,
                'Safety Factor Range': `${sfConfig.min} - ${sfConfig.max}`,
                'Applied Safety Factor': sf,
                'Detergent Ingredients': detergentNames,
                'Body Weight (kg)': bodyWeight,
                'Minimum LD50 (mg/kg)': minLd50,
                'Min Batch Size (kg)': train.minMbsKg,
                'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                'Worst-Case Product (by RPN)': worstRpnInfo,
                'ADI (mg)': adi.toFixed(4),
                'MACO (mg)': maco.toFixed(2),
                'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                'MACO per Swab (mg/Swab)': macoPerSwab.toFixed(4)
            });
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Detergent MACO Report");
        
        // Set column widths for better readability
        const colWidths = [
            { wch: 8 },   // Train
            { wch: 12 },  // Total Products
            { wch: 12 },  // Total Machines
            { wch: 15 },  // Total Area
            { wch: 50 },  // Products
            { wch: 50 },  // Machines
            { wch: 15 },  // Worst-Case Form
            { wch: 15 },  // Safety Factor Range
            { wch: 15 },  // Applied Safety Factor
            { wch: 30 },  // Detergent Ingredients
            { wch: 12 },  // Body Weight
            { wch: 15 },  // Minimum LD50
            { wch: 12 },  // Min Batch Size
            { wch: 12 },  // Min BS/MDD Ratio
            { wch: 40 },  // Worst-Case Product
            { wch: 12 },  // ADI
            { wch: 12 },  // MACO
            { wch: 18 },  // MACO per Area
            { wch: 18 }   // MACO per Swab
        ];
        worksheet['!cols'] = colWidths;
        
        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Detergent_MACO_Report_${timestamp}.xlsx`);
        
        hideLoader();
        showCustomAlert("Success", "Detergent MACO data exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting Detergent MACO to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export Detergent MACO data to Excel.");
    });
}

export function exportTrainSummaryToExcel(selectedTrain = 'all') {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getTrainData } = utils;
        
        const trainData = getTrainData();
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export. Assign machines to products first.");
            return;
        }
        
        // Filter trains based on selection
        let trainsToExport = trainData;
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                trainsToExport = trainData.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                // Single train selected (backward compatibility)
                trainsToExport = trainData.filter(train => String(train.id) === String(selectedTrain));
            }
        }
        
        if (trainsToExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "No trains match the selected criteria.");
            return;
        }
        
        const dataForExport = [];
        
        trainsToExport.forEach(train => {
            // Get machine details
            const machines = train.machineIds.map(id => {
                const machine = state.machines.find(m => m.id === id);
                return machine ? machine : { id, name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
            });
            
            // Create plain text version of machines for Excel export
            const machinesListPlainText = train.machineIds.map(machineId => {
                const machine = state.machines.find(m => m.id === machineId);
                return machine ? machine.name : `Unknown (ID: ${machineId})`;
            }).join(', ');
            
            const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
            
            // Detailed products list for separate columns
            const productsDetailed = train.products.map(p => `${p.productCode}: ${p.name}`).join('\n');
            const machinesDetailed = machines.map(m => `${m.machineNumber}: ${m.name}`).join('\n');
            
            // Add train summary row
            dataForExport.push({
                'Train ID': `T${train.id}`,
                'Products Count': train.products.length,
                'Machines Count': machines.length,
                'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                'Products (Code - Name)': productsList,
                'Machines (Number - Name)': machinesListPlainText, // Use plain text version for Excel
                'Products Detailed': productsDetailed,
                'Machines Detailed': machinesDetailed,
                'Min Batch Size (kg)': train.minMbsKg,
                'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                'Assumed SSA (cm²)': train.assumedSsa,
                'Lowest LTD (mg)': train.lowestLtd,
                'Lowest PDE (mg)': train.lowestPde !== null ? train.lowestPde : 'N/A',
                'Worst RPN Product': train.worstProductRpn ? 
                    `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                    'N/A'
            });
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Train Summary Report");
        
        // Set column widths for better readability
        const colWidths = [
            { wch: 10 },  // Train ID
            { wch: 12 },  // Products Count
            { wch: 12 },  // Machines Count
            { wch: 15 },  // Total Area
            { wch: 60 },  // Products (Code - Name)
            { wch: 60 },  // Machines (Number - Name)
            { wch: 40 },  // Products Detailed
            { wch: 40 },  // Machines Detailed
            { wch: 15 },  // Min Batch Size
            { wch: 15 },  // Min BS/MDD Ratio
            { wch: 15 },  // Assumed SSA
            { wch: 12 },  // Lowest LTD
            { wch: 12 },  // Lowest PDE
            { wch: 50 }   // Worst RPN Product
        ];
        worksheet['!cols'] = colWidths;
        
        const timestamp = new Date().toISOString().split('T')[0];
        let filename = 'Train_Summary_Report';
        
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple specific trains
                const trainIds = selectedTrain.sort((a, b) => a - b);
                filename += `_Trains_${trainIds.join('_')}`;
            } else {
                // Single specific train
                filename += `_Train_${selectedTrain}`;
            }
        }
        
        filename += `_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        hideLoader();
        showCustomAlert("Success", "Train Summary data exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting Train Summary to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export Train Summary data to Excel.");
    });
}

export function exportSummaryToExcel() {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getProductTrainId, calculateScores } = utils;
        
        // Prepare Top 10 RPN data
        const top10Rpn = state.products.flatMap(product => {
            const trainId = getProductTrainId(product);
            return product.activeIngredients.map(ing => ({
                productName: product.name,
                productCode: product.productCode,
                ingredientName: ing.name,
                rpn: calculateScores(ing).rpn,
                trainId: trainId !== 'N/A' ? `T${trainId}` : 'N/A',
                scores: calculateScores(ing)
            }))
        }).sort((a, b) => b.rpn - a.rpn).slice(0, 10);

        // Prepare Critical Products data
        const criticalProductsList = state.products.filter(p => p.isCritical);

        if (top10Rpn.length === 0 && criticalProductsList.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no summary data to export. Add products and ingredients first.");
            return;
        }

        const workbook = XLSX.utils.book_new();

        // Create Top 10 RPN worksheet
        if (top10Rpn.length > 0) {
            const top10Data = top10Rpn.map((item, index) => ({
                'Rank': index + 1,
                'Product Code': item.productCode,
                'Product Name': item.productName,
                'Train': item.trainId,
                'Ingredient': item.ingredientName,
                'RPN': item.rpn
            }));

            const top10Worksheet = XLSX.utils.json_to_sheet(top10Data);
            
            // Set column widths for Top 10 RPN
            const top10ColWidths = [
                { wch: 8 },   // Rank
                { wch: 15 },  // Product Code
                { wch: 30 },  // Product Name
                { wch: 10 },  // Train
                { wch: 25 },  // Ingredient
                { wch: 8 }    // RPN
            ];
            top10Worksheet['!cols'] = top10ColWidths;
            
            XLSX.utils.book_append_sheet(workbook, top10Worksheet, "Top 10 RPN");
        }

        // Create Critical Products worksheet
        if (criticalProductsList.length > 0) {
            const criticalData = criticalProductsList.map(product => ({
                'Product Code': product.productCode,
                'Product Name': product.name,
                'Product Type': product.productType,
                'Batch Size (kg)': product.batchSizeKg,
                'MDD (mg)': product.mddMg,
                'Critical Reason': product.criticalReason || 'No reason provided',
                'Train': getProductTrainId(product) !== 'N/A' ? `T${getProductTrainId(product)}` : 'N/A'
            }));

            const criticalWorksheet = XLSX.utils.json_to_sheet(criticalData);
            
            // Set column widths for Critical Products
            const criticalColWidths = [
                { wch: 15 },  // Product Code
                { wch: 30 },  // Product Name
                { wch: 15 },  // Product Type
                { wch: 12 },  // Batch Size
                { wch: 12 },  // MDD
                { wch: 50 },  // Critical Reason
                { wch: 10 }   // Train
            ];
            criticalWorksheet['!cols'] = criticalColWidths;
            
            XLSX.utils.book_append_sheet(workbook, criticalWorksheet, "Critical Products");
        }

        // Create All Products Summary worksheet
        const allProductsData = state.products.map(product => {
            const trainId = getProductTrainId(product);
            const highestRpnIngredient = product.activeIngredients.reduce((max, ing) => {
                const rpn = calculateScores(ing).rpn;
                return rpn > max.rpn ? { ...ing, rpn } : max;
            }, { rpn: 0, name: 'N/A' });

            return {
                'Product Code': product.productCode,
                'Product Name': product.name,
                'Product Type': product.productType,
                'Batch Size (kg)': product.batchSizeKg,
                'MDD (mg)': product.mddMg,
                'Train': trainId !== 'N/A' ? `T${trainId}` : 'N/A',
                'Is Critical': product.isCritical ? 'Yes' : 'No',
                'Critical Reason': product.criticalReason || 'N/A',
                'Ingredients Count': product.activeIngredients.length,
                'Highest RPN Ingredient': highestRpnIngredient.name,
                'Highest RPN Value': highestRpnIngredient.rpn || 0
            };
        });

        const allProductsWorksheet = XLSX.utils.json_to_sheet(allProductsData);
        
        // Set column widths for All Products
        const allProductsColWidths = [
            { wch: 15 },  // Product Code
            { wch: 30 },  // Product Name
            { wch: 15 },  // Product Type
            { wch: 12 },  // Batch Size
            { wch: 12 },  // MDD
            { wch: 10 },  // Train
            { wch: 10 },  // Is Critical
            { wch: 40 },  // Critical Reason
            { wch: 12 },  // Ingredients Count
            { wch: 25 },  // Highest RPN Ingredient
            { wch: 12 }   // Highest RPN Value
        ];
        allProductsWorksheet['!cols'] = allProductsColWidths;
        
        XLSX.utils.book_append_sheet(workbook, allProductsWorksheet, "All Products");

        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `MACO_Summary_Report_${timestamp}.xlsx`);
        
        hideLoader();
        showCustomAlert("Success", "Summary report data exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting Summary to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export Summary report data to Excel.");
    });
}

export function exportAllTabsToExcel() {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getTrainData, getWorstCaseProductType, getProductTrainId, calculateScores } = utils;
        
        const trainData = getTrainData();
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export. Assign machines to products first.");
            return;
        }
        
        const workbook = XLSX.utils.book_new();
        
        // 1. Product MACO Report
        try {
            // Note: ESSA will be calculated per train based on line and dosage form
            
            const productMacoData = [];
            trainData.forEach(train => {
                const worstCaseType = getWorstCaseProductType(train.products.map(p => p.productType));
                const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];
                
                const sf = sfConfig.max;
                const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
                const maco10ppm = 10 * train.minMbsKg;
                let macoHealth = Infinity;
                let macoNoel = Infinity;
                
                // Check toxicity preference to determine which equations to show
                const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
                const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
                
                // Calculate PDE-based MACO if PDE is available and not hidden
                if (train.lowestPde !== null && !pdeHidden) {
                    macoHealth = train.lowestPde * train.minBsMddRatio;
                }
                
                // Calculate NOEL-based MACO if LD50 is available and not hidden
                if (train.lowestLd50 !== null && !ld50Hidden) {
                    // NOEL = (LD50 g/kg × 70 kg) ÷ 2000
                    const noel = (train.lowestLd50 * 70) / 2000; // NOEL in g
                    // Find minimum MDD from all ingredients in the train
                    const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000)); // Convert mg to g
                    const minMdd = Math.min(...allMdds);
                    // MACO = (NOEL g × min batch size g × 1000) ÷ (safety factor × MDD g)
                    macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
                }
                
                // Calculate line-specific largest ESSA for this train
                const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
                const macoVisual = 0.004 * lineLargestEssa;
                
                // Build MACO values array conditionally based on toxicity data visibility
                const allMacoValues = [
                    { name: '0.1% Therapeutic Dose', value: macoDose },
                    { name: '10 ppm Criterion', value: maco10ppm }
                ];
                
                // Add PDE equation only if PDE is available and not hidden
                if (train.lowestPde !== null && !pdeHidden) {
                    allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
                }
                
                // Add NOEL equation only if LD50 is available and not hidden
                if (train.lowestLd50 !== null && !ld50Hidden) {
                    allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
                }
                
                // Always add visual clean limit
                allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
                
                const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
                const finalMaco = finalMacoResult.value;
                const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
                const macoPerSwab = macoPerArea * train.assumedSsa;
                
                const machines = train.machineIds.map(id => {
                    const machine = state.machines.find(m => m.id === id);
                    return machine ? machine : { name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
                });
                
                // Create plain text version of machines for Excel export
                const machinesListPlainText = train.machineIds.map(machineId => {
                const machine = state.machines.find(m => m.id === machineId);
                return machine ? machine.name : `Unknown (ID: ${machineId})`;
            }).join(', ');
                
                const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
                
                const worstRpnInfo = train.worstProductRpn ? 
                    `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                    'N/A';
                
                productMacoData.push({
                    'Train': `T${train.id}`,
                    'Total Products': train.products.length,
                    'Total Machines': machines.length,
                    'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                    'Products': productsList,
                    'Machines': machinesListPlainText, // Use plain text version for Excel
                    'Worst-Case Dosage Form': worstCaseType,
                    'Safety Factor': sf,
                    'Lowest LTD (mg)': train.lowestLtd,
                    'Min Batch Size (kg)': train.minMbsKg,
                    'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                    'Lowest PDE (mg)': train.lowestPde !== null ? train.lowestPde : 'N/A',
                    'Worst-Case Product (by RPN)': worstRpnInfo,
                    'MACO - Therapeutic Dose (mg)': macoDose.toFixed(2),
                    'MACO - 10 ppm (mg)': maco10ppm.toFixed(2),
                    'MACO - Health-Based (mg)': typeof macoHealth === 'number' ? macoHealth.toFixed(2) : 'N/A',
                    'MACO - Visual Clean (mg)': macoVisual.toFixed(2),
                    'Selected MACO Method': finalMacoResult.name,
                    'Final MACO (mg)': finalMaco.toFixed(2),
                    'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                    'MACO per Swab (mg/Swab)': macoPerSwab.toFixed(4)
                });
            });
            
            const productMacoWorksheet = XLSX.utils.json_to_sheet(productMacoData);
            XLSX.utils.book_append_sheet(workbook, productMacoWorksheet, "Product MACO");
        } catch (error) {
            console.error('Error creating Product MACO sheet:', error);
        }
        
        // 2. Detergent MACO Report
        try {
            if (state.detergentIngredients.length > 0) {
                // Note: ESSA will be calculated per train based on line and dosage form
                const bodyWeight = parseFloat(document.getElementById('bodyWeight')?.value) || 70;
                const ld50Values = state.detergentIngredients.map(i => parseFloat(i.ld50)).filter(ld50 => !isNaN(ld50));
                const minLd50 = ld50Values.length > 0 ? Math.min(...ld50Values) : 0;
                const detergentNames = state.detergentIngredients.map(i => i.name).filter(name => name.trim() !== '').join(', ');
                
                const detergentMacoData = [];
                trainData.forEach(train => {
                    const worstCaseType = getWorstCaseProductType(train.products.map(p => p.productType));
                    const sfConfig = state.safetyFactorConfig[worstCaseType] || state.safetyFactorConfig['Other'];
                    
                    const sfInput = document.getElementById(`sf-input-train-${train.id}`);
                    const sf = sfInput ? parseFloat(sfInput.value) || sfConfig.max : sfConfig.max;
                    
                    const adi = (5e-4 * minLd50 * bodyWeight) / sf;
                    const maco = adi * train.minBsMddRatio;
                    // Calculate line-specific largest ESSA for this train
                    const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
                    const macoPerArea = lineLargestEssa > 0 ? maco / lineLargestEssa : 0;
                    const macoPerSwab = macoPerArea * train.assumedSsa;
                    
                    const machines = train.machineIds.map(id => {
                        const machine = state.machines.find(m => m.id === id);
                        return machine ? machine : { name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
                    });
                    
                    // Create plain text version of machines for Excel export
                    const machinesListPlainText = train.machineIds.map(machineId => {
                        const machine = state.machines.find(m => m.id === machineId);
                        return machine ? machine.name : `Unknown (ID: ${machineId})`;
                    }).join(', ');
                    
                    const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
                    
                    const worstRpnInfo = train.worstProductRpn ? 
                        `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                        'N/A';
                    
                    detergentMacoData.push({
                        'Train': `T${train.id}`,
                        'Total Products': train.products.length,
                        'Total Machines': machines.length,
                        'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                        'Products': productsList,
                        'Machines': machinesListPlainText, // Use plain text version for Excel
                        'Worst-Case Dosage Form': worstCaseType,
                        'Safety Factor Range': `${sfConfig.min} - ${sfConfig.max}`,
                        'Applied Safety Factor': sf,
                        'Detergent Ingredients': detergentNames,
                        'Body Weight (kg)': bodyWeight,
                        'Minimum LD50 (mg/kg)': minLd50,
                        'Min Batch Size (kg)': train.minMbsKg,
                        'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                        'Worst-Case Product (by RPN)': worstRpnInfo,
                        'ADI (mg)': adi.toFixed(4),
                        'MACO (mg)': maco.toFixed(2),
                        'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                        'MACO per Swab (mg/Swab)': macoPerSwab.toFixed(4)
                    });
                });
                
                const detergentMacoWorksheet = XLSX.utils.json_to_sheet(detergentMacoData);
                XLSX.utils.book_append_sheet(workbook, detergentMacoWorksheet, "Detergent MACO");
            }
        } catch (error) {
            console.error('Error creating Detergent MACO sheet:', error);
        }
        
        // 3. Train Summary Report
        try {
            const trainSummaryData = [];
            trainData.forEach(train => {
                const machines = train.machineIds.map(id => {
                    const machine = state.machines.find(m => m.id === id);
                    return machine ? machine : { id, name: `Unknown (ID: ${id})`, machineNumber: 'N/A' };
                });
                
                // Create plain text version of machines for Excel export
                const machinesListPlainText = train.machineIds.map(machineId => {
                const machine = state.machines.find(m => m.id === machineId);
                return machine ? machine.name : `Unknown (ID: ${machineId})`;
            }).join(', ');
                
                const productsList = train.products.map(p => `${p.productCode} - ${p.name}`).join('; ');
                const productsDetailed = train.products.map(p => `${p.productCode}: ${p.name}`).join('\n');
                const machinesDetailed = machines.map(m => `${m.machineNumber}: ${m.name}`).join('\n');
                
                trainSummaryData.push({
                    'Train ID': `T${train.id}`,
                    'Products Count': train.products.length,
                    'Machines Count': machines.length,
                    'Total Area (ESSA) cm²': train.essa.toLocaleString(),
                    'Products (Code - Name)': productsList,
                    'Machines (Number - Name)': machinesListPlainText, // Use plain text version for Excel
                    'Products Detailed': productsDetailed,
                    'Machines Detailed': machinesDetailed,
                    'Min Batch Size (kg)': train.minMbsKg,
                    'Min BS/MDD Ratio': train.minBsMddRatio.toFixed(2),
                    'Assumed SSA (cm²)': train.assumedSsa,
                    'Lowest LTD (mg)': train.lowestLtd,
                    'Lowest PDE (mg)': train.lowestPde !== null ? train.lowestPde : 'N/A',
                    'Worst RPN Product': train.worstProductRpn ? 
                        `${train.worstProductRpn.productName} (${train.worstProductRpn.ingredientName}) - RPN: ${train.worstProductRpn.rpn}` : 
                        'N/A'
                });
            });
            
            const trainSummaryWorksheet = XLSX.utils.json_to_sheet(trainSummaryData);
            XLSX.utils.book_append_sheet(workbook, trainSummaryWorksheet, "Train Summary");
        } catch (error) {
            console.error('Error creating Train Summary sheet:', error);
        }
        
        // 4. Top 10 RPN
        try {
            const top10Rpn = state.products.flatMap(product => {
                const trainId = getProductTrainId(product);
                return product.activeIngredients.map(ing => ({
                    productName: product.name,
                    productCode: product.productCode,
                    ingredientName: ing.name,
                    rpn: calculateScores(ing).rpn,
                    trainId: trainId !== 'N/A' ? `T${trainId}` : 'N/A'
                }))
            }).sort((a, b) => b.rpn - a.rpn).slice(0, 10);

            if (top10Rpn.length > 0) {
                const top10Data = top10Rpn.map((item, index) => ({
                    'Rank': index + 1,
                    'Product Code': item.productCode,
                    'Product Name': item.productName,
                    'Train': item.trainId,
                    'Ingredient': item.ingredientName,
                    'RPN': item.rpn
                }));

                const top10Worksheet = XLSX.utils.json_to_sheet(top10Data);
                XLSX.utils.book_append_sheet(workbook, top10Worksheet, "Top 10 RPN");
            }
        } catch (error) {
            console.error('Error creating Top 10 RPN sheet:', error);
        }
        
        // 5. Critical Products
        try {
            const criticalProductsList = state.products.filter(p => p.isCritical);
            if (criticalProductsList.length > 0) {
                const criticalData = criticalProductsList.map(product => ({
                    'Product Code': product.productCode,
                    'Product Name': product.name,
                    'Product Type': product.productType,
                    'Batch Size (kg)': product.batchSizeKg,
                    'MDD (mg)': product.mddMg,
                    'Critical Reason': product.criticalReason || 'No reason provided',
                    'Train': getProductTrainId(product) !== 'N/A' ? `T${getProductTrainId(product)}` : 'N/A'
                }));

                const criticalWorksheet = XLSX.utils.json_to_sheet(criticalData);
                XLSX.utils.book_append_sheet(workbook, criticalWorksheet, "Critical Products");
            }
        } catch (error) {
            console.error('Error creating Critical Products sheet:', error);
        }
        
        // 6. All Products Overview
        try {
            const allProductsData = state.products.map(product => {
                const trainId = getProductTrainId(product);
                const highestRpnIngredient = product.activeIngredients.reduce((max, ing) => {
                    const rpn = calculateScores(ing).rpn;
                    return rpn > max.rpn ? { ...ing, rpn } : max;
                }, { rpn: 0, name: 'N/A' });

                return {
                    'Product Code': product.productCode,
                    'Product Name': product.name,
                    'Product Type': product.productType,
                    'Batch Size (kg)': product.batchSizeKg,
                    'MDD (mg)': product.mddMg,
                    'Train': trainId !== 'N/A' ? `T${trainId}` : 'N/A',
                    'Is Critical': product.isCritical ? 'Yes' : 'No',
                    'Critical Reason': product.criticalReason || 'N/A',
                    'Ingredients Count': product.activeIngredients.length,
                    'Highest RPN Ingredient': highestRpnIngredient.name,
                    'Highest RPN Value': highestRpnIngredient.rpn || 0
                };
            });

            const allProductsWorksheet = XLSX.utils.json_to_sheet(allProductsData);
            XLSX.utils.book_append_sheet(workbook, allProductsWorksheet, "All Products");
        } catch (error) {
            console.error('Error creating All Products sheet:', error);
        }
        
        // 7. Product Register (Detailed Product Information)
        try {
            const productRegisterData = [];
            state.products.forEach(product => {
                const trainId = getProductTrainId(product);
                
                // Add main product row
                const baseProductData = {
                    'Product Code': product.productCode,
                    'Product Name': product.name,
                    'Product Type': product.productType,
                    'Batch Size (kg)': product.batchSizeKg,
                    'MDD (mg)': product.mddMg,
                    'Train': trainId !== 'N/A' ? `T${trainId}` : 'N/A',
                    'Is Critical': product.isCritical ? 'Yes' : 'No',
                    'Critical Reason': product.criticalReason || 'N/A',
                    'Ingredient Type': 'PRODUCT',
                    'Ingredient Name': '',
                    'LTD (mg)': '',
                    'PDE (mg)': '',
                    'LD50 (mg/kg)': '',
                    'Severity': '',
                    'Occurrence': '',
                    'Detection': '',
                    'RPN': ''
                };
                
                productRegisterData.push(baseProductData);
                
                // Add ingredient rows
                product.activeIngredients.forEach(ingredient => {
                    const scores = calculateScores(ingredient);
                    productRegisterData.push({
                        'Product Code': '',
                        'Product Name': '',
                        'Product Type': '',
                        'Batch Size (kg)': '',
                        'MDD (mg)': '',
                        'Train': '',
                        'Is Critical': '',
                        'Critical Reason': '',
                        'Ingredient Type': 'INGREDIENT',
                        'Ingredient Name': ingredient.name,
                        'LTD (mg)': ingredient.ltdMg || 'N/A',
                        'PDE (mg)': ingredient.pdeMg || 'N/A',
                        'LD50 (mg/kg)': ingredient.ld50 || 'N/A',
                        'Severity': scores.severity,
                        'Occurrence': scores.occurrence,
                        'Detection': scores.detection,
                        'RPN': scores.rpn
                    });
                });
            });

            const productRegisterWorksheet = XLSX.utils.json_to_sheet(productRegisterData);
            XLSX.utils.book_append_sheet(workbook, productRegisterWorksheet, "Product Register");
        } catch (error) {
            console.error('Error creating Product Register sheet:', error);
        }
        
        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Complete_MACO_Report_${timestamp}.xlsx`);
        
        hideLoader();
        showCustomAlert("Success", "Complete report with all tabs exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting all tabs to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export complete report to Excel.");
    });
}

export function toggleStageSection(stageKey) {
    const section = document.getElementById(`stage-${stageKey}`);
    const isHidden = section.style.display === 'none';
    
    section.style.display = isHidden ? '' : 'none';
    
    // Save the state to localStorage
    localStorage.setItem(`machineStage-${stageKey}-hidden`, !isHidden);
    
    // Update the toggle button text
    const button = section.parentElement.querySelector('button');
    if (button) {
        button.textContent = isHidden ? 'Hide' : 'Show';
    }
}
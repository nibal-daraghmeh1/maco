// --- IndexedDB integration ---
// General UI interaction functions (dark mode, modals, etc.)
// js/ui.js

import * as state from './state.js';
import { getSafetyFactorForDosageForm } from './state.js';
import { fullAppRender } from './app.js'; // Use a forward declaration if needed, or better, pass it as an argument. For simplicity, we import it.
import { generateTrainMap, getTrainIdToLineNumberMap, getProductTrainNumber } from './utils.js';
import { toggleScoringEditMode } from './scoringView.js';
import * as db from './indexedDB.js';
import { renderRpnChart } from './worstCaseView.js';

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

export async function saveAllDataToLocalStorage() {
    try {
        console.log('🔄 INDEXEDDB SAVE: Starting save...');
        console.log('INDEXEDDB SAVE: Machines count:', state.machines.length);
        
        // Debug: Log sample locations before saving
        let machinesWithSampleLocations = 0;
        state.machines.forEach(machine => {
            if (machine.sampleLocations && machine.sampleLocations.length > 0) {
                machinesWithSampleLocations++;
                console.log(`💾 INDEXEDDB SAVE: Machine ${machine.name} (ID: ${machine.id}) with ${machine.sampleLocations.length} sample locations:`, machine.sampleLocations);
            }
        });
        console.log(`📊 INDEXEDDB SAVE: ${machinesWithSampleLocations} machines have sample locations`);
        
        const machinesJson = JSON.stringify(state.machines);
        console.log('INDEXEDDB SAVE: Machines JSON length:', machinesJson.length);
        
        await db.setItem('macoProducts', JSON.stringify(state.products));
        await db.setItem('macoMachines', machinesJson);
        await db.setItem('macoScoringCriteria', JSON.stringify(state.scoringCriteria));
        await db.setItem('macoDetergentIngredients', JSON.stringify(state.detergentIngredients));
        await db.setItem('machineStageDisplayOrder', JSON.stringify(state.machineStageDisplayOrder));
        
        console.log('✅ INDEXEDDB SAVE: All data saved to IndexedDB');
        
        // Verify the save
        const verify = await db.getItem('macoMachines');
        if (verify) {
            const parsed = JSON.parse(verify);
            console.log('✅ INDEXEDDB SAVE: Verification - saved machines count:', parsed.length);
            
            // Verify sample locations were saved
            const savedMachinesWithSampleLocations = parsed.filter(m => m.sampleLocations && m.sampleLocations.length > 0).length;
            console.log(`✅ INDEXEDDB SAVE: Verification - ${savedMachinesWithSampleLocations} machines have sample locations in IndexedDB`);
            
        } else {
            console.error('❌ INDEXEDDB SAVE: Verification failed - no data found after save!');
        }
    } catch (e) {
        console.error("❌ Failed to save data to IndexedDB", e);
        showCustomAlert("Save Error", "Could not save data. Storage might be full.");
        throw e; // Re-throw to allow caller to handle
    }
}

// Global flag to prevent concurrent loading
let isLoadingData = false;

export async function loadAllDataFromLocalStorage() {
    // Prevent concurrent loading
    if (isLoadingData) {
        console.log('⏳ INDEXEDDB LOAD: Already loading, skipping...');
        return;
    }
    
    isLoadingData = true;
    
    try {
        console.log('🔄 INDEXEDDB LOAD: Starting from IndexedDB...');
        const savedProducts = await db.getItem('macoProducts');
        const savedMachines = await db.getItem('macoMachines');
        const savedCriteria = await db.getItem('macoScoringCriteria');
        const savedDetergents = await db.getItem('macoDetergentIngredients');
        const savedStageOrder = await db.getItem('machineStageDisplayOrder');

        if (savedProducts) { try { state.setProducts(JSON.parse(savedProducts)); } catch (e) { console.error("Error loading products", e); } }
        if (savedMachines) { 
            try { 
                const machines = JSON.parse(savedMachines);
                console.log('🔄 INDEXEDDB LOAD: Loading', machines.length, 'machines from IndexedDB');
                
                // Debug: Log sample locations for each machine
                let machinesWithSampleLocations = 0;
                machines.forEach(machine => {
                    if (machine.sampleLocations && machine.sampleLocations.length > 0) {
                        machinesWithSampleLocations++;
                        console.log(`🧪 INDEXEDDB LOAD: Machine ${machine.name} (ID: ${machine.id}) loaded with ${machine.sampleLocations.length} sample locations:`, machine.sampleLocations);
                    } else {
                        console.log(`📍 INDEXEDDB LOAD: Machine ${machine.name} (ID: ${machine.id}) has no sample locations`);
                    }
                });
                console.log(`📊 INDEXEDDB LOAD: ${machinesWithSampleLocations} machines loaded with sample locations`);
                
                // CRITICAL: Check machines BEFORE setting in state
                console.log('🔄 BEFORE state.setMachines():');
                const beforeMachinesWithSampleLocations = machines.filter(m => m.sampleLocations && m.sampleLocations.length > 0).length;
                console.log(`📊 BEFORE: ${beforeMachinesWithSampleLocations} machines from IndexedDB have sample locations`);
                if (beforeMachinesWithSampleLocations > 0) {
                    machines.forEach(machine => {
                        if (machine.sampleLocations && machine.sampleLocations.length > 0) {
                            console.log(`🧪 BEFORE: Machine ${machine.name} (ID: ${machine.id}) from IndexedDB has ${machine.sampleLocations.length} sample locations`);
                        }
                    });
                }
                
                // Set machines directly without merging defaults
                state.setMachines(machines);
                console.log('✅ INDEXEDDB LOAD: Machines set in state. Count:', state.machines.length);
                
                // CRITICAL: Check machines AFTER setting in state
                console.log('🔄 AFTER state.setMachines():');
                const afterMachinesWithSampleLocations = state.machines.filter(m => m.sampleLocations && m.sampleLocations.length > 0).length;
                console.log(`📊 AFTER: ${afterMachinesWithSampleLocations} machines in state have sample locations`);
                if (afterMachinesWithSampleLocations > 0) {
                    state.machines.forEach(machine => {
                        if (machine.sampleLocations && machine.sampleLocations.length > 0) {
                            console.log(`🧪 AFTER: Machine ${machine.name} (ID: ${machine.id}) in state has ${machine.sampleLocations.length} sample locations`);
                        }
                    });
                } else if (beforeMachinesWithSampleLocations > 0) {
                    console.error('❌ CRITICAL: Sample locations were LOST during state.setMachines()!');
                    console.error('❌ This means state.setMachines() is not working correctly!');
                }
                
                // Verify that state was updated correctly
                console.log(`✅ INDEXEDDB LOAD: STATE VERIFICATION - ${afterMachinesWithSampleLocations} machines in state have sample locations`);
                
            } catch (e) { 
                console.error("❌ Error loading machines", e); 
            } 
        } else {
            console.log('⚠️ INDEXEDDB LOAD: No saved machines found in IndexedDB');
        }
        
        // Load saved criteria from IndexedDB
        if (savedCriteria) { 
            try { 
                const parsedCriteria = JSON.parse(savedCriteria);
                console.log('🔄 SCORING CRITERIA: Loading from IndexedDB');
                console.log('🔄 SCORING CRITERIA: Loaded criteria keys:', Object.keys(parsedCriteria));
                
                // Always load saved criteria - user modifications should be preserved
                state.setScoringCriteria(parsedCriteria);
                console.log('✅ SCORING CRITERIA: Loaded successfully from IndexedDB');
                
            } catch (e) { 
                console.error("❌ Error loading scoring criteria from IndexedDB, using defaults:", e);
            } 
        } else {
            console.log('📍 SCORING CRITERIA: No saved criteria found, using defaults from state.js');
        }
        
        if (savedDetergents) { try { state.setDetergentIngredients(JSON.parse(savedDetergents)); } catch (e) { console.error("Error loading detergent ingredients", e); } }
        if (savedStageOrder) { try { state.setMachineStageDisplayOrder(JSON.parse(savedStageOrder)); } catch (e) { console.error("Error loading machine stage order", e); } }
        
        console.log('🎉 INDEXEDDB LOAD: Completed successfully');
    } catch (e) {
        console.error("❌ Error loading data from IndexedDB", e);
    } finally {
        isLoadingData = false;
    }
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
    
    console.log('🔄 saveStateForUndo: Creating undo state WITHOUT saving to IndexedDB');
    console.log('📊 saveStateForUndo: Machines in undo state:', currentState.machines.length);
    const machinesWithSampleLocations = currentState.machines.filter(m => m.sampleLocations && m.sampleLocations.length > 0).length;
    console.log(`📊 saveStateForUndo: ${machinesWithSampleLocations} machines have sample locations in undo state`);
    
    // DON'T save to IndexedDB during undo state creation
    // Only save during actual user actions
    // saveAllDataToLocalStorage();
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
    } else if (viewName === 'machineCoverage') {
        // Machine Coverage printing - ensure content is loaded first
        console.log('Printing machine coverage');
        
        // Check if machine coverage container has content
        const container = document.getElementById('machineCoverageContainer');
        if (!container || container.innerHTML.trim() === '') {
            console.warn('Machine coverage container is empty, regenerating...');
            
            // Regenerate the machine coverage table
            import('./machineCoverageView.js').then(machineCoverageView => {
                const tableHTML = machineCoverageView.createHorizontalMachineCoverageTable();
                if (container) {
                    container.innerHTML = tableHTML;
                }
                
                // Wait for content to render, then print
                setTimeout(() => {
                    const updatedContainer = document.getElementById('machineCoverageContainer');
                    if (updatedContainer && updatedContainer.innerHTML.trim() !== '') {
                        console.log('Machine coverage content loaded, printing...');
                        window.print();
                    } else {
                        console.error('Machine coverage content still empty');
                        alert('No machine coverage data to print. Please ensure you have created trains first.');
                    }
                }, 500);
            }).catch(error => {
                console.error('Error loading machine coverage for print:', error);
                alert('Error loading machine coverage data for printing.');
            });
        } else {
            // Content exists, print after short delay
            setTimeout(() => {
                console.log('Machine coverage content found, printing...');
                window.print();
            }, 200);
        }
    } else if (viewName === 'lineReport' || viewName === 'report') {
        // Line Report printing - ensure content is loaded and properly rendered
        console.log('Printing line report');
        
        // Check if line report container has content
        const container = document.getElementById('lineReportContainer');
        if (!container || container.innerHTML.trim() === '') {
            console.warn('Line report container is empty, checking for current line filter...');
            
            // Check if we have a current line filter to regenerate the report
            const currentLine = window.currentLineFilter;
            if (!currentLine || currentLine === 'all') {
                alert('No line report data to print. Please select a line from the left menu first.');
                return;
            }
            
            console.log('Regenerating line report for:', currentLine);
            
            // Import and regenerate the line report
            import('./lineReportView.js').then(lineReportModule => {
                lineReportModule.renderLineReport(currentLine);
                
                // Wait for content to render, then print
                setTimeout(() => {
                    const updatedContainer = document.getElementById('lineReportContainer');
                    if (updatedContainer && updatedContainer.innerHTML.trim() !== '') {
                        console.log('Line report content regenerated, printing...');
                        
                        // Add report-specific print class for styling
                        document.body.classList.add('printing-report');
                        
                        setTimeout(() => {
                            window.print();
                            
                            // Remove print class after printing
                            setTimeout(() => {
                                document.body.classList.remove('printing-report');
                            }, 1000);
                        }, 300);
                    } else {
                        console.error('Line report content still empty after regeneration');
                        alert('Unable to generate line report for printing. Please try selecting the line again.');
                    }
                }, 500);
            }).catch(error => {
                console.error('Error loading line report for print:', error);
                alert('Error loading line report for printing.');
            });
        } else {
            // Content exists, add print class and print
            console.log('Line report content found, printing...');
            
            // Add report-specific print class for styling
            document.body.classList.add('printing-report');
            
            setTimeout(() => {
                window.print();
                
                // Remove print class after printing
                setTimeout(() => {
                    document.body.classList.remove('printing-report');
                }, 1000);
            }, 300);
        }
    } else {
        setTimeout(() => {
            window.print();
        }, 100);
    }
}

// --- COLUMN VISIBILITY ---
export async function toggleColumn(col, tabId) {
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
        await db.setItem(`productRegister-${col}Hidden`, anyTableHidden);
        
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
        await db.setItem(`${tabId}-${col}Hidden`, anyTableHidden);
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
        // Use async with fallback to localStorage for immediate access
        (async () => {
            const pdeStorage = await db.getItem('productRegister-pdeHidden').catch(() => null);
            const ld50Storage = await db.getItem('productRegister-ld50Hidden').catch(() => null);
            
            // If no storage values exist (first visit), both should be visible
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
            
            // Update icons after getting data
            const pdeToggle = tabContainer.querySelector('.toggle-pde');
            const ld50Toggle = tabContainer.querySelector('.toggle-ld50');
            if (pdeToggle) pdeToggle.innerHTML = pdeHidden ? `Show PDE` : `Hide PDE`;
            if (ld50Toggle) ld50Toggle.innerHTML = ld50Hidden ? `Show LD50` : `Hide LD50`;
        })();
        
        // Fallback for immediate display
        pdeHidden = false;
        ld50Hidden = false;
    } else {
        // For productRegister or other tabs, use async loading
        (async () => {
            const pdeStorage = await db.getItem(`${tabId}-pdeHidden`).catch(() => null);
            const ld50Storage = await db.getItem(`${tabId}-ld50Hidden`).catch(() => null);
            pdeHidden = pdeStorage === 'true';
            ld50Hidden = ld50Storage === 'true';
            
            // Update icons after getting data
            const pdeToggle = tabContainer.querySelector('.toggle-pde');
            const ld50Toggle = tabContainer.querySelector('.toggle-ld50');
            if (pdeToggle) pdeToggle.innerHTML = pdeHidden ? `Show PDE` : `Hide PDE`;
            if (ld50Toggle) ld50Toggle.innerHTML = ld50Hidden ? `Show LD50` : `Hide LD50`;
        })();
        
        // Fallback for immediate display
        pdeHidden = false;
        ld50Hidden = false;
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
            
            const trainId = getProductTrainNumber(product);
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

// Reset scoring criteria to defaults (includes new criteria)
export async function resetScoringCriteriaToDefaults() {
    showLoader();
    try {
        // Remove the storage item to force using new defaults
        await db.removeItem('macoScoringCriteria');
        
        // The criteria will be loaded from state.js defaults
        import('./state.js').then(stateModule => {
            // Force reload the page to apply the new criteria
            showCustomAlert("Reset Complete", "Scoring criteria has been reset to include new criteria. The page will refresh.");
            setTimeout(() => {
                location.reload();
            }, 1500);
        });
    } catch (error) {
        console.error('Error resetting scoring criteria:', error);
        showCustomAlert("Error", "Failed to reset scoring criteria. Please try refreshing the page manually.");
    } finally {
        hideLoader();
    }
}

// Merge sample locations from default state.js into loaded machines
// Removed automatic merging - users will manage sample locations manually

// Debug function to test sample locations persistence
export async function testSampleLocationsPersistence() {
    console.log('\n🔍 === TESTING SAMPLE LOCATIONS PERSISTENCE ===');
    
    // Check current state
    console.log('📊 Current machines in state:', state.machines.length);
    let stateCount = 0;
    state.machines.forEach(machine => {
        if (machine.sampleLocations && machine.sampleLocations.length > 0) {
            stateCount++;
            console.log(`✅ STATE: ${machine.name} (ID: ${machine.id}) has ${machine.sampleLocations.length} sample locations`);
        } else {
            console.log(`❌ STATE: ${machine.name} (ID: ${machine.id}) has no sample locations`);
        }
    });
    console.log(`📈 STATE SUMMARY: ${stateCount}/${state.machines.length} machines have sample locations`);
    
    // Check IndexedDB
    try {
        const savedMachines = await db.getItem('macoMachines');
        if (savedMachines) {
            const parsed = JSON.parse(savedMachines);
            console.log('\n📊 Machines in IndexedDB storage:', parsed.length);
            let storageCount = 0;
            parsed.forEach(machine => {
                if (machine.sampleLocations && machine.sampleLocations.length > 0) {
                    storageCount++;
                    console.log(`✅ STORAGE: ${machine.name} (ID: ${machine.id}) has ${machine.sampleLocations.length} sample locations`);
                } else {
                    console.log(`❌ STORAGE: ${machine.name} (ID: ${machine.id}) has no sample locations`);
                }
            });
            console.log(`📈 STORAGE SUMMARY: ${storageCount}/${parsed.length} machines have sample locations`);
        } else {
            console.log('❌ No machines found in IndexedDB storage');
        }
    } catch (error) {
        console.error('❌ Error reading from IndexedDB storage:', error);
    }
    
    console.log('🎯 === TEST COMPLETED ===\n');
}

// Complete diagnostic function
export async function fullSampleLocationsDiagnostic() {
    console.log('\n🩺 === FULL SAMPLE LOCATIONS DIAGNOSTIC ===');
    
    try {
        // 1. Test IndexedDB availability
        console.log('1️⃣ Testing IndexedDB availability...');
        if ('indexedDB' in window) {
            console.log('✅ IndexedDB is available');
        } else {
            console.log('❌ IndexedDB is NOT available');
            return;
        }
        
        // 2. Test database connection
        console.log('2️⃣ Testing IndexedDB connection...');
        try {
            await db.getItem('test');
            console.log('✅ IndexedDB connection working');
        } catch (error) {
            console.log('❌ IndexedDB connection failed:', error);
            return;
        }
        
        // 3. Check current state vs storage
        await testSampleLocationsPersistence();
        
        // 4. Manual save test
        console.log('3️⃣ Testing manual save...');
        try {
            await saveAllDataToLocalStorage();
            console.log('✅ Manual save completed');
        } catch (error) {
            console.log('❌ Manual save failed:', error);
        }
        
        // 5. Manual load test
        console.log('4️⃣ Testing manual load...');
        try {
            // Reset loading flag
            isLoadingData = false;
            await loadAllDataFromLocalStorage();
            console.log('✅ Manual load completed');
        } catch (error) {
            console.log('❌ Manual load failed:', error);
        }
        
        console.log('🎯 === FULL DIAGNOSTIC COMPLETED ===\n');
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
    }
}

// Force reset sample locations to defaults from state.js
export async function clearAllSampleLocations() {
    if (!confirm('⚠️ This will clear ALL sample locations from all machines. Are you sure?')) {
        return;
    }
    
    try {
        showLoader();
        console.log('🧹 Clearing all sample locations...');
        
        // Clear sample locations from all machines
        const currentMachines = state.machines.map(machine => ({
            ...machine,
            sampleLocations: []
        }));
        
        // Update state and save
        state.setMachines(currentMachines);
        await saveAllDataToLocalStorage();
        
        // Refresh UI
        const { fullAppRender } = await import('./app.js');
        fullAppRender();
        
        showCustomAlert('Success', 'All sample locations have been cleared from all machines.');
        console.log('✅ Sample locations cleared successfully');
        
    } catch (error) {
        console.error('❌ Error clearing sample locations:', error);
        showCustomAlert('Error', 'Failed to clear sample locations: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Force clear all data and reload from defaults (nuclear option)
export async function forceResetAllData() {
    if (!confirm('⚠️ This will clear ALL saved data and reload from defaults. Are you sure?')) {
        return;
    }
    
    try {
        showLoader();
        console.log('🧹 Force reset: Clearing all IndexedDB data...');
        
        // Clear all IndexedDB data
        await db.clear();
        console.log('✅ All IndexedDB data cleared');
        
        // Clear localStorage as fallback
        localStorage.clear();
        console.log('✅ LocalStorage cleared');
        
        showCustomAlert('Reset Complete', 'All data cleared. The page will reload with fresh default data.');
        
        // Reload the page to start fresh
        setTimeout(() => {
            location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error during force reset:', error);
        showCustomAlert('Error', 'Failed to clear data: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Quick fix for persistent sample location issues
export async function quickFixSampleLocations() {
    try {
        showLoader();
        console.log('🔧 Quick fix: Forcing sample locations update...');
        
        // Force reload the data without cache
        isLoadingData = false; // Reset the flag
        
        // Clear current state
        state.setMachines([]);
        
        // Force reload and re-render
        await loadAllDataFromLocalStorage();
        
        console.log('✅ Quick fix completed');
        
    } catch (error) {
        console.error('❌ Quick fix failed:', error);
        showCustomAlert('Error', 'Quick fix failed: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Function to check what's actually in IndexedDB right now
export async function checkIndexedDBContents() {
    console.log('\n🔍 === CHECKING INDEXEDDB CONTENTS ===');
    
    try {
        const db = await import('./indexedDB.js');
        const savedMachines = await db.getItem('macoMachines');
        
        if (savedMachines) {
            const machines = JSON.parse(savedMachines);
            console.log('📊 IndexedDB contains', machines.length, 'machines');
            
            const machinesWithSampleLocations = machines.filter(m => m.sampleLocations && m.sampleLocations.length > 0);
            console.log(`📊 ${machinesWithSampleLocations.length} machines have sample locations in IndexedDB:`);
            
            machinesWithSampleLocations.forEach(machine => {
                console.log(`🧪 IndexedDB: ${machine.name} (ID: ${machine.id}) has ${machine.sampleLocations.length} sample locations:`, machine.sampleLocations);
            });
            
            if (machinesWithSampleLocations.length === 0) {
                console.log('📍 No machines with sample locations found in IndexedDB');
            }
        } else {
            console.log('❌ No machine data found in IndexedDB');
        }
        
        console.log('🎯 === INDEXEDDB CHECK COMPLETE ===\n');
        
    } catch (error) {
        console.error('❌ Error checking IndexedDB:', error);
    }
}

// Create a test function to directly test sample location saving
export async function directSampleLocationTest() {
    console.log('\n🧪 === DIRECT SAMPLE LOCATION TEST ===');
    
    try {
        // Find a machine to test with
        const testMachine = state.machines[0];
        if (!testMachine) {
            console.error('❌ No machines found for testing');
            return;
        }
        
        console.log('🔄 Testing with machine:', testMachine.name, 'ID:', testMachine.id);
        
        // Create test sample location
        const testSampleLocation = {
            id: Date.now(),
            location: 'Direct Test Location',
            material: 'Stainless Steel',
            area: 999,
            hardToClean: 3,
            accessibility: 2,
            visibility: 1,
            rpn: 6,
            numberOfSamples: 1
        };
        
        console.log('🔄 Adding test sample location:', testSampleLocation);
        
        // Update machine directly in state
        const machineInState = state.machines.find(m => m.id === testMachine.id);
        if (!machineInState) {
            console.error('❌ Machine not found in state');
            return;
        }
        
        machineInState.sampleLocations = machineInState.sampleLocations || [];
        machineInState.sampleLocations.push(testSampleLocation);
        
        console.log('✅ Machine updated in state with', machineInState.sampleLocations.length, 'sample locations');
        
        // Save to IndexedDB
        console.log('🔄 Saving to IndexedDB...');
        await saveAllDataToLocalStorage();
        console.log('✅ Save completed');
        
        // Verify save
        const db = await import('./indexedDB.js');
        const savedData = await db.getItem('macoMachines');
        if (savedData) {
            const machines = JSON.parse(savedData);
            const savedMachine = machines.find(m => m.id === testMachine.id);
            if (savedMachine && savedMachine.sampleLocations && savedMachine.sampleLocations.length > 0) {
                console.log('✅ VERIFICATION: Machine saved with', savedMachine.sampleLocations.length, 'sample locations');
                return true;
            } else {
                console.error('❌ VERIFICATION FAILED: No sample locations found in saved data');
                return false;
            }
        } else {
            console.error('❌ VERIFICATION FAILED: No data found in IndexedDB');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Expose functions globally
window.resetScoringCriteriaToDefaults = resetScoringCriteriaToDefaults;
window.testSampleLocationsPersistence = testSampleLocationsPersistence;
window.fullSampleLocationsDiagnostic = fullSampleLocationsDiagnostic;
window.checkIndexedDBContents = checkIndexedDBContents;
window.directSampleLocationTest = directSampleLocationTest;
window.clearAllSampleLocations = clearAllSampleLocations;
window.forceResetAllData = forceResetAllData;
window.quickFixSampleLocations = quickFixSampleLocations;
window.comprehensiveDataDiagnostic = comprehensiveDataDiagnostic;


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
        const { getTrainsGroupedByLine, getConsistentTrainOrder, calculateScores, getToxicityPreference } = utils;
        
        const dataForExport = [];
        
        // Use the same data source as renderWorstCaseByTrain
        let linesWithTrains = getTrainsGroupedByLine();
        
        // Apply the same line filtering logic as the view
        const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
        if (currentLine) {
            linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === currentLine);
        }
        
        if (!linesWithTrains || linesWithTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current line selection.");
            return;
        }
        
        // Flatten all trains and apply consistent ordering (same as view)
        const allTrains = [];
        linesWithTrains.forEach(lineObj => {
            lineObj.trains.forEach(train => {
                allTrains.push({
                    ...train,
                    line: train.line
                });
            });
        });
        
        // Apply consistent train ordering (same as view)
        const orderedTrains = getConsistentTrainOrder(allTrains);
        
        // Sort trains by number for consistent Excel export
        orderedTrains.sort((a, b) => (a.number || a.id) - (b.number || b.id));
        
        if (orderedTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current selection.");
            return;
        }
        
        // Filter by selected trains if specified
        let trainsToExport = orderedTrains;
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                trainsToExport = orderedTrains.filter(train => selectedTrain.includes(String(train.number)));
            } else {
                // Single train selected (backward compatibility)
                trainsToExport = orderedTrains.filter(train => String(train.number) === String(selectedTrain));
            }
            
            if (trainsToExport.length === 0) {
                hideLoader();
                const trainText = Array.isArray(selectedTrain) ? `Trains ${selectedTrain.join(', ')}` : `Train ${selectedTrain}`;
                showCustomAlert("No Data", `${trainText} not found in current line selection.`);
                return;
            }
        }
        
        const toxicityPreference = getToxicityPreference();
        
        trainsToExport.forEach(train => {
            const trainProducts = train.products;
            
            // Add train header row
            dataForExport.push({
                "Train": `Train ${train.number} - Worst Case Analysis`,
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
        const { getTrainData, getTrainsGroupedByLine, getWorstCaseProductType, getMacoPerSwabForTrain, getLargestEssaForLineAndDosageForm, getConsistentTrainOrder } = utils;
        
        // Use the same data source as renderMacoForTrains
        let linesWithTrains = getTrainsGroupedByLine();
        
        // Apply the same line filtering logic as the view
        const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
        if (currentLine) {
            linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === currentLine);
        }
        
        if (!linesWithTrains || linesWithTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current line selection.");
            return;
        }
        
        // Get full train data for calculations and merge it properly (same as view)
        const fullTrainData = getTrainData();
        const fullTrainByKey = {};
        fullTrainData.forEach(t => { if (t.key) fullTrainByKey[t.key] = t; });
        
        // Flatten trains and enhance with calculated metrics (same as view)
        const enhancedTrains = [];
        linesWithTrains.forEach(lineObj => {
            lineObj.trains.forEach(train => {
                const fullTrain = fullTrainByKey[train.key];
                if (!fullTrain) return;
                
                const enhancedTrain = {
                    ...train,
                    id: fullTrain.id,
                    essa: fullTrain.essa,
                    // Add other properties from fullTrain as needed
                    ...fullTrain
                };
                enhancedTrains.push(enhancedTrain);
            });
        });
        
        // Apply consistent train ordering (same as view)
        let trainsToExport = getConsistentTrainOrder(enhancedTrains);
        
        // Sort trains by number for consistent Excel export
        trainsToExport.sort((a, b) => (a.number || a.id) - (b.number || b.id));
        
        // Filter trains based on selection
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                trainsToExport = trainsToExport.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                // Single train selected (backward compatibility)
                trainsToExport = trainsToExport.filter(train => String(train.id) === String(selectedTrain));
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
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
            
            // Calculate MACO values using the same logic as in the view
            const sf = sfConfig.max;
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            let macoNoel = Infinity;
            
            // Check toxicity preference to determine which equations to show
            // Check toxicity preference from localStorage
            const pdeStorage = localStorage.getItem('productRegister-pdeHidden');
            const ld50Storage = localStorage.getItem('productRegister-ld50Hidden');
            const pdeHidden = pdeStorage === 'true';
            const ld50Hidden = ld50Storage === 'true';
            
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
                'Train': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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
                'MACO - Therapeutic Dose (mg)': formatSmallNumber(macoDose),
                'MACO - 10 ppm (mg)': formatSmallNumber(maco10ppm),
                'MACO - Health-Based (mg)': typeof macoHealth === 'number' ? formatSmallNumber(macoHealth) : 'N/A',
                'MACO - Visual Clean (mg)': formatSmallNumber(macoVisual),
                'Selected MACO Method': finalMacoResult.name,
                'Final MACO (mg)': formatSmallNumber(finalMaco),
                'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                'MACO per Swab (mg/Swab)': formatSmallNumber(macoPerSwab)
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
        const { getTrainData, getTrainsGroupedByLine, getWorstCaseProductType, getConsistentTrainOrder } = utils;
        
        // Use the same data source as renderDetergentMaco
        const baseTrainData = getTrainData();
        let linesWithTrains = getTrainsGroupedByLine();

        // Apply the same line filtering logic as the view
        const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
        if (currentLine) {
            linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === currentLine);
        }

        if (!linesWithTrains || linesWithTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current line selection.");
            return;
        }

        // Map baseTrainData by key for merging (same as view)
        const trainByKey = {};
        baseTrainData.forEach(t => { if (t.key) trainByKey[t.key] = t; });

        // Flatten trains for processing (same as view)
        const mergedTrains = [];
        linesWithTrains.forEach(lineObj => {
            lineObj.trains.forEach(t => {
                const computed = trainByKey[t.key];
                if (!computed || !computed.id) return;
                const merged = { ...t, ...computed };
                mergedTrains.push(merged);
            });
        });

        // Apply consistent train ordering (same as view)
        let trainsToExport = getConsistentTrainOrder(mergedTrains);

        // Sort trains by number for consistent Excel export
        trainsToExport.sort((a, b) => (a.number || a.id) - (b.number || b.id));

        // Filter trains if a selection was provided
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                trainsToExport = trainsToExport.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                trainsToExport = trainsToExport.filter(train => String(train.id) === String(selectedTrain));
            }
        }
        
        if (trainsToExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current selection.");
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
        
        trainsToExport.forEach(train => {
            const worstCaseType = getWorstCaseProductType(train.products.map(p => p.productType));
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
            
            // Get current safety factor from UI or use default max
            const sfInput = document.getElementById(`sf-input-train-${train.id}`);
            const sf = sfInput ? parseFloat(sfInput.value) || sfConfig.max : sfConfig.max;
            
            // Calculate detergent MACO values using the same logic as in the view
            const adi = (5e-4 * minLd50 * bodyWeight) / sf;
            const maco = adi * train.minBsMddRatio;
            // Calculate line-specific largest ESSA for this train
            const lineLargestEssa = utils.getLargestEssaForLineAndDosageForm(train, trainsToExport);
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
                'Train': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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
                'MACO (mg)': formatSmallNumber(maco),
                'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                'MACO per Swab (mg/Swab)': formatSmallNumber(macoPerSwab)
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
        const { getTrainData, getTrainsGroupedByLine, getConsistentTrainOrder } = utils;
        
        // Use the same filtering logic as other export functions
        let linesWithTrains = getTrainsGroupedByLine();
        
        // Apply current line filter
        const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
        if (currentLine) {
            linesWithTrains = linesWithTrains.filter(lineGroup => lineGroup.line === currentLine);
        }
        
        if (!linesWithTrains || linesWithTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current line selection.");
            return;
        }
        
        // Get full train data for merging
        const fullTrainData = getTrainData();
        const fullTrainByKey = {};
        fullTrainData.forEach(t => { if (t.key) fullTrainByKey[t.key] = t; });
        
        // Flatten and get enhanced trains
        const enhancedTrains = [];
        linesWithTrains.forEach(lineObj => {
            lineObj.trains.forEach(train => {
                const fullTrain = fullTrainByKey[train.key];
                if (fullTrain) {
                    const enhancedTrain = { ...train, id: fullTrain.id, ...fullTrain };
                    enhancedTrains.push(enhancedTrain);
                }
            });
        });
        
        if (enhancedTrains.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export for the current line selection.");
            return;
        }
        
        // Order and sort trains
        let trainsToExport = getConsistentTrainOrder(enhancedTrains);
        trainsToExport.sort((a, b) => (a.number || a.id) - (b.number || b.id)); // Sort by train number
        
        // Filter trains based on selection
        if (selectedTrain !== 'all') {
            if (Array.isArray(selectedTrain)) {
                // Multiple trains selected
                trainsToExport = trainsToExport.filter(train => selectedTrain.includes(String(train.id)));
            } else {
                // Single train selected (backward compatibility)
                trainsToExport = trainsToExport.filter(train => String(train.id) === String(selectedTrain));
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
                'Train ID': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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

export function exportMachineCoverageToExcel() {
    showLoader();
    
    Promise.all([
        import('./utils.js'),
        import('./machineCoverageView.js')
    ]).then(([utils, machineCoverageModule]) => {
        const { getTrainData } = utils;
        const { createHorizontalMachineCoverageTable } = machineCoverageModule;
        
        let trainData = getTrainData();
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "There are no trains to export. Assign machines to products first.");
            return;
        }
        
        // Apply current line filter if exists
        const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
        if (currentLine) {
            trainData = trainData.filter(t => (t.line || t.productLine) === currentLine);
        }
        
        if (trainData.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "No trains found for the selected line.");
            return;
        }
        
        const dataForExport = [];
        
        // Get all machines
        const allMachineIds = new Set();
        trainData.forEach(t => (t.machineIds || []).forEach(id => allMachineIds.add(id)));
        
        const machineList = Array.from(allMachineIds).map(id => {
            const machine = state.machines.find(m => m.id === id);
            return machine ? { id: machine.id, name: machine.name } : null;
        }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
        
        // Process train data by dosage form
        trainData.forEach(train => {
            const dosageForms = [...new Set((train.products || []).map(p => p.productType || 'Unknown'))];
            
            dosageForms.forEach(dosageForm => {
                // Find worst case product for this dosage form
                let worstProduct = '-';
                let highestRpn = 0;
                
                const productsInDosageForm = (train.products || []).filter(p => (p.productType || 'Unknown') === dosageForm);
                
                productsInDosageForm.forEach(product => {
                    if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                        product.activeIngredients.forEach(ingredient => {
                            try {
                                const scores = utils.calculateScores(ingredient);
                                const rpn = scores?.rpn || 0;
                                if (rpn > highestRpn) {
                                    highestRpn = rpn;
                                    worstProduct = product.name;
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ingredient, error);
                            }
                        });
                    }
                });
                
                // Get machine usage for this train
                const trainMachines = (train.machineIds || []).map(id => {
                    const machine = state.machines.find(m => m.id === id);
                    return machine ? machine.name : null;
                }).filter(Boolean);
                
                const rowData = {
                    'Train ID': `Train ${train.number || train.id}`,
                    'Line': train.line || train.productLine || 'Unassigned',
                    'Dosage Form': dosageForm,
                    'Worst Case Product': worstProduct,
                    'RPN': highestRpn,
                    'Used Machines': trainMachines.join(', '),
                    'Products': productsInDosageForm.map(p => p.name).join(', ')
                };
                
                // Add machine coverage columns (Y/N for each machine)
                machineList.forEach(machine => {
                    rowData[`Machine: ${machine.name}`] = trainMachines.includes(machine.name) ? 'Y' : 'N';
                });
                
                dataForExport.push(rowData);
            });
        });
        
        if (dataForExport.length === 0) {
            hideLoader();
            showCustomAlert("No Data", "No machine coverage data available for export.");
            return;
        }
        
        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(dataForExport);
        
        XLSX.utils.book_append_sheet(workbook, worksheet, "Machine Coverage Report");
        
        // Set column widths for better readability
        const colWidths = [
            { wch: 12 },  // Train ID
            { wch: 15 },  // Line
            { wch: 15 },  // Dosage Form
            { wch: 25 },  // Worst Case Product
            { wch: 8 },   // RPN
            { wch: 40 },  // Used Machines
            { wch: 40 },  // Products
            ...machineList.map(() => ({ wch: 15 })) // Machine columns
        ];
        worksheet['!cols'] = colWidths;
        
        // Generate filename
        const timestamp = new Date().toISOString().split('T')[0];
        let filename = 'Machine_Coverage_Report';
        
        if (currentLine) {
            filename += `_${currentLine.replace(/\s+/g, '_')}`;
        }
        
        filename += `_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        hideLoader();
        showCustomAlert("Success", "Machine Coverage data exported to Excel successfully!");
        
    }).catch(error => {
        console.error('Error exporting Machine Coverage to Excel:', error);
        hideLoader();
        showCustomAlert("Error", "Failed to export Machine Coverage data to Excel.");
    });
}

export function exportSummaryToExcel() {
    showLoader();
    
    import('./utils.js').then(utils => {
        const { getProductTrainId, calculateScores } = utils;
        
        // Prepare Top 10 RPN data
        const top10Rpn = state.products.flatMap(product => {
            const trainId = getProductTrainNumber(product);
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
                'Train': getProductTrainNumber(product) !== 'N/A' ? `T${getProductTrainNumber(product)}` : 'N/A'
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
            const trainId = getProductTrainNumber(product);
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
                const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
                
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
                    'Train': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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
                    'MACO - Therapeutic Dose (mg)': formatSmallNumber(macoDose),
                    'MACO - 10 ppm (mg)': formatSmallNumber(maco10ppm),
                    'MACO - Health-Based (mg)': typeof macoHealth === 'number' ? formatSmallNumber(macoHealth) : 'N/A',
                    'MACO - Visual Clean (mg)': formatSmallNumber(macoVisual),
                    'Selected MACO Method': finalMacoResult.name,
                    'Final MACO (mg)': formatSmallNumber(finalMaco),
                    'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                    'MACO per Swab (mg/Swab)': formatSmallNumber(macoPerSwab)
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
                    const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
                    
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
                        'Train': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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
                        'MACO (mg)': formatSmallNumber(maco),
                        'MACO per Area (mg/cm²)': macoPerArea.toExponential(3),
                        'MACO per Swab (mg/Swab)': formatSmallNumber(macoPerSwab)
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
                    'Train ID': `T${getTrainIdToLineNumberMap().get(String(train.id))?.number || train.id}`,
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
                const trainId = getProductTrainNumber(product);
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
                    'Train': getProductTrainNumber(product) !== 'N/A' ? `T${getProductTrainNumber(product)}` : 'N/A'
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
                const trainId = getProductTrainNumber(product);
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
                const trainId = getProductTrainNumber(product);
                
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
    
    // Save the state to IndexedDB
    db.setItem(`machineStage-${stageKey}-hidden`, !isHidden).catch(e => console.error('Error saving machine stage visibility:', e));
    
    // Update the toggle button text
    const button = section.parentElement.querySelector('button');
    if (button) {
        button.textContent = isHidden ? 'Hide' : 'Show';
    }
}

/**
 * Comprehensive data persistence diagnostic
 */
export async function comprehensiveDataDiagnostic() {
    console.log('🏥 COMPREHENSIVE DATA PERSISTENCE DIAGNOSTIC');
    console.log('==========================================');
    
    const report = {
        timestamp: new Date().toISOString(),
        indexedDbAvailable: false,
        dataTypes: {},
        issues: [],
        recommendations: []
    };
    
    try {
        // Check IndexedDB availability
        report.indexedDbAvailable = typeof indexedDB !== 'undefined';
        console.log(`🔧 IndexedDB Available: ${report.indexedDbAvailable}`);
        
        if (!report.indexedDbAvailable) {
            report.issues.push('IndexedDB not available - falling back to localStorage');
            report.recommendations.push('Use a modern browser with IndexedDB support');
        }
        
        // Check all data types
        const dataChecks = [
            { name: 'Products', key: 'macoProducts', stateData: state.products },
            { name: 'Machines', key: 'macoMachines', stateData: state.machines },
            { name: 'Scoring Criteria', key: 'macoScoringCriteria', stateData: state.scoringCriteria },
            { name: 'Detergent Ingredients', key: 'macoDetergentIngredients', stateData: state.detergentIngredients },
            { name: 'Machine Stage Display Order', key: 'machineStageDisplayOrder', stateData: state.machineStageDisplayOrder }
        ];
        
        for (const check of dataChecks) {
            console.log(`\n📋 Checking ${check.name}...`);
            
            const checkResult = {
                hasStateData: false,
                stateCount: 0,
                hasStoredData: false,
                storedCount: 0,
                synced: false,
                sampleData: null
            };
            
            // Check state data
            if (check.stateData) {
                if (Array.isArray(check.stateData)) {
                    checkResult.hasStateData = check.stateData.length > 0;
                    checkResult.stateCount = check.stateData.length;
                } else if (typeof check.stateData === 'object') {
                    checkResult.hasStateData = Object.keys(check.stateData).length > 0;
                    checkResult.stateCount = Object.keys(check.stateData).length;
                }
            }
            
            // Check stored data
            try {
                const storedData = await db.getItem(check.key);
                if (storedData) {
                    const parsed = JSON.parse(storedData);
                    checkResult.hasStoredData = true;
                    
                    if (Array.isArray(parsed)) {
                        checkResult.storedCount = parsed.length;
                    } else if (typeof parsed === 'object') {
                        checkResult.storedCount = Object.keys(parsed).length;
                    }
                    
                    // Check if data is synced
                    checkResult.synced = checkResult.stateCount === checkResult.storedCount;
                    
                    // Sample data for verification
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        checkResult.sampleData = {
                            firstItem: parsed[0].name || parsed[0].id || parsed[0].productCode || 'Unknown',
                            lastItem: parsed[parsed.length - 1].name || parsed[parsed.length - 1].id || parsed[parsed.length - 1].productCode || 'Unknown'
                        };
                    }
                }
            } catch (e) {
                console.error(`❌ Error checking stored ${check.name}:`, e);
                report.issues.push(`Failed to read stored ${check.name}: ${e.message}`);
            }
            
            report.dataTypes[check.name] = checkResult;
            
            // Log results
            console.log(`   State: ${checkResult.hasStateData ? '✅' : '❌'} (Count: ${checkResult.stateCount})`);
            console.log(`   Storage: ${checkResult.hasStoredData ? '✅' : '❌'} (Count: ${checkResult.storedCount})`);
            console.log(`   Synced: ${checkResult.synced ? '✅' : '⚠️'}`);
            
            if (checkResult.sampleData) {
                console.log(`   Sample: ${checkResult.sampleData.firstItem} ... ${checkResult.sampleData.lastItem}`);
            }
            
            // Identify issues
            if (!checkResult.hasStateData && !checkResult.hasStoredData) {
                report.issues.push(`No ${check.name} data found in state or storage`);
            } else if (!checkResult.synced) {
                report.issues.push(`${check.name} data not synced: State(${checkResult.stateCount}) vs Storage(${checkResult.storedCount})`);
                report.recommendations.push(`Save ${check.name} data to ensure synchronization`);
            }
        }
        
        // Special checks for complex data
        console.log('\n🔍 Special Data Checks...');
        
        // Check sample locations specifically
        const machinesWithSampleLocations = state.machines.filter(m => m.sampleLocations && m.sampleLocations.length > 0);
        console.log(`   Sample Locations: ${machinesWithSampleLocations.length} machines have sample locations`);
        report.dataTypes['Sample Locations'] = {
            machinesWithSampleLocations: machinesWithSampleLocations.length,
            totalSampleLocations: machinesWithSampleLocations.reduce((sum, m) => sum + m.sampleLocations.length, 0)
        };
        
        // Check SOP files
        const machinesWithSOPs = state.machines.filter(m => m.cleaningSOP && (m.cleaningSOP.attachmentValue || m.cleaningSOP.sopName));
        console.log(`   SOP Files: ${machinesWithSOPs.length} machines have SOP data`);
        report.dataTypes['SOP Files'] = {
            machinesWithSOPs: machinesWithSOPs.length
        };
        
        // Check scoring criteria completeness
        const scoringKeys = ['solubility', 'therapeuticDose', 'cleanability', 'toxicity', 'hardToClean', 'accessibility', 'visibility', 'numberOfSamples'];
        const missingScoringKeys = scoringKeys.filter(key => !state.scoringCriteria[key]);
        if (missingScoringKeys.length > 0) {
            report.issues.push(`Missing scoring criteria: ${missingScoringKeys.join(', ')}`);
            report.recommendations.push('Reset scoring criteria to defaults to ensure all criteria are available');
        }
        
        // Check localStorage usage (should be minimal)
        const localStorageKeys = Object.keys(localStorage);
        const macoKeys = localStorageKeys.filter(key => key.startsWith('maco') || key.includes('product'));
        if (macoKeys.length > 0) {
            console.log(`   ⚠️ localStorage still has ${macoKeys.length} MACO-related keys: ${macoKeys.join(', ')}`);
            report.issues.push(`localStorage contains ${macoKeys.length} MACO-related keys that should be in IndexedDB`);
            report.recommendations.push('Consider migrating remaining localStorage data to IndexedDB');
        }
        
        // Overall assessment
        console.log('\n📊 OVERALL ASSESSMENT:');
        const totalDataTypes = Object.keys(report.dataTypes).length;
        const syncedDataTypes = Object.values(report.dataTypes).filter(dt => dt.synced !== false).length;
        const dataIntegrity = (syncedDataTypes / totalDataTypes) * 100;
        
        console.log(`   Data Integrity: ${dataIntegrity.toFixed(1)}% (${syncedDataTypes}/${totalDataTypes} synchronized)`);
        console.log(`   Issues Found: ${report.issues.length}`);
        console.log(`   Recommendations: ${report.recommendations.length}`);
        
        if (report.issues.length === 0) {
            console.log('✅ All data appears to be properly synchronized!');
        } else {
            console.log('⚠️ Some issues detected. See recommendations below.');
        }
        
        // Display issues and recommendations
        if (report.issues.length > 0) {
            console.log('\n❌ ISSUES FOUND:');
            report.issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
        }
        
        if (report.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            report.recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
        }
        
        console.log('\n🎯 DATA PERSISTENCE STATUS: ' + (report.issues.length === 0 ? 'EXCELLENT' : report.issues.length <= 2 ? 'GOOD' : 'NEEDS ATTENTION'));
        
        return report;
        
    } catch (error) {
        console.error('❌ Error during diagnostic:', error);
        report.issues.push(`Diagnostic failed: ${error.message}`);
        return report;
    }
}
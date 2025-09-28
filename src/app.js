// js/app.js
// This is the main orchestrator for the application. It imports all other modules
// and coordinates their actions.

// --- 1. IMPORTS ---
// Import all modules. The `* as name` syntax is useful for grouping functions.
import * as state from './state.js';
import * as ui from './ui.js';
import * as utils from './utils.js';
import * as productView from './productView.js';
import * as machineView from './machineView.js';
import * as worstCaseView from './worstCaseView.js';
import * as macoProductView from './macoProductView.js';
import * as macoDetergentView from './macoDetergentView.js';
import * as dashboardView from './dashboardView.js';
import * as summaryView from './summaryView.js';
import * as trainSummaryView from './trainSummaryView.js';
import * as scoringView from './scoringView.js';
// Firestore functions removed; use only localStorage functions from ui.js if needed

// --- 2. ORCHESTRATION ---
// Attach functions to window for live testing with script modules
window.changeTab = changeTab;
window.printTrain = printTrain;
/**
 * Adds a print button to each train container in the MACO view.
 */
function addPrintButtonsToTrains() {
    const trainContainers = document.querySelectorAll('#maco-product-trains-container .train-container');
    trainContainers.forEach(container => {
        // Avoid adding duplicate buttons
        if (container.querySelector('.print-train-btn')) return;

        const trainId = container.id; // Assumes container has an id like 'train-1'
        const button = document.createElement('button');
        button.textContent = 'Print Train';
        button.className = 'btn print-train-btn'; // Add classes for styling
        button.style.margin = '10px'; // Basic styling
        button.onclick = () => printTrain(trainId);
        
        // Append to the details section, which is shown on expand
        const detailsSection = container.querySelector('.train-details');
        if (detailsSection) {
            detailsSection.appendChild(button);
        }
    });
}

/**
 * Prints the content of a specific train.
 * @param {string} trainId The ID of the train container element to print.
 */
function printTrain(trainId) {
    const printContent = document.getElementById(trainId);
    if (!printContent) {
        console.error('Could not find train content to print:', trainId);
        return;
    }
    
    // Add a class to the body to scope print-specific styles
    document.body.classList.add('printing-maco-train');

    // Use a timeout to ensure styles are applied before printing
    setTimeout(() => {
        window.print();
    }, 100); // A short delay can help render styles
}

/**
 * A central function to re-render all parts of the application that depend on the main data.
 * This should be called after any significant state change (add, edit, delete).
 */
export function fullAppRender() {
    try {
        // Generate the train map first, as many other renders depend on it.
        utils.generateTrainMap();

        // Re-render each major view/tab
        productView.handleSearchAndFilter('productRegister');
        worstCaseView.handleSearchAndFilter('worstCaseProducts');
        machineView.renderMachinesTable();
        dashboardView.renderMainDashboard();
        macoProductView.renderMacoForTrains();
        addPrintButtonsToTrains(); // Add print buttons after rendering
        macoDetergentView.renderDetergentMaco();
        macoDetergentView.renderDetergentIngredientsList();
        summaryView.renderSummaryReport();
        scoringView.renderScoringSystem(); // Re-render scoring system to reflect state changes

        // Update any dynamic UI elements, like filter dropdowns
        productView.populateFilterSelects();
    } catch (error) {
        console.error('Error during full application render:', error);
        ui.hideLoader(); // Ensure loader is hidden on error
    }
}

/**
 * Handles the logic for switching between tabs.
 * @param {string} tabId The ID of the tab content to show.
 * @param {HTMLElement} element The clicked tab button element.
 */
function changeTab(tabId, element) {
    state.setActiveTabId(tabId);
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab-content'));
    document.getElementById(tabId).classList.add('active-tab-content');
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active-tab'));
    element.classList.add('active-tab');

    // Call the specific rendering function for the activated tab
    if (tabId === 'dashboard') { dashboardView.renderMainDashboard(); }
    if (tabId === 'summaryReport') { summaryView.renderSummaryReport(); }
    if (tabId === 'trainSummary') { trainSummaryView.renderTrainSummary(); }
    if (tabId === 'machineManagement') { machineView.renderMachinesTable(); }
    if (tabId === 'macoForTrains') { 
        macoProductView.renderMacoForTrains(); 
        addPrintButtonsToTrains(); // Add print buttons after rendering
    }
    if (tabId === 'detergentMaco') { macoDetergentView.renderDetergentMaco(); }
    if (tabId === 'productRegister' || tabId === 'worstCaseProducts') {
        productView.handleSearchAndFilter(tabId);
    }
}

// --- 3. INITIALIZATION ---
/**
 * The main initialization function for the entire application.
 * Runs once when the DOM is loaded.
 */
function initializeApp() {
    ui.showLoader();
    try {
        // Prompt for org and user ID (replace with a real login UI for production)
        // let orgId = localStorage.getItem('orgId') || prompt('Enter your organization ID:');
        // let userId = localStorage.getItem('userId') || prompt('Enter your user ID:');
         let orgId, userId;
        if (!orgId) orgId = 'defaultOrg';
        if (!userId) userId = 'defaultUser';
        localStorage.setItem('orgId', orgId);
        localStorage.setItem('userId', userId);
        window.orgId = orgId;
        window.userId = userId;

        // Set theme from localStorage
        if (localStorage.getItem('theme') === 'dark') { ui.toggleDarkMode(true); } 
        else { ui.toggleDarkMode(false); }

        // Load all data from localStorage
        ui.loadAllDataFromLocalStorage();
        // After loading, recalculate dynamic "nextId" counters
        if (state.products.length > 0) {
            state.setNextProductId(Math.max(0, ...state.products.map(p => p.id)) + 1);
            const allIngredientIds = state.products.flatMap(p => p.activeIngredients.map(ai => ai.id));
            state.setNextIngredientId(allIngredientIds.length > 0 ? Math.max(0, ...allIngredientIds) + 1 : 1);
        }
        if (state.machines.length > 0) { state.setNextMachineId(Math.max(0, ...state.machines.map(m => m.id)) + 1); }
        if (state.detergentIngredients.length > 0) { state.setNextDetergentIngredientId(Math.max(0, ...state.detergentIngredients.map(i => i.id)) + 1); }

        // Data migration logic
        state.products.forEach(p => {
            if (p.isCritical === undefined) p.isCritical = false;
        });

        // Save the initial loaded state as the first step in the undo/redo history
        ui.saveStateForUndo();

        // Perform the first full render of the application
        fullAppRender();

        // Perform any final UI setup after the initial render
        ui.updateToggleIcons('productRegister');
        scoringView.toggleScoringEditMode(false);
        ui.hideLoader();
    } catch (error) {
        console.error('Error during application initialization:', error);
        ui.hideLoader();
    }
}

// --- 4. GLOBAL EVENT LISTENERS & FUNCTION EXPOSURE ---
document.addEventListener('DOMContentLoaded', function() {
    
    // --- CRITICAL STEP: EXPOSE FUNCTIONS TO GLOBAL SCOPE ---
    // Your HTML uses `onclick="functionName()"`. These functions must exist on the `window` object.
    // This loop makes all imported functions from your modules available globally.
   window.changeTab = changeTab; // Manually expose the one function not in a module import
   window.printTrain = printTrain; // Expose the new print function
    window.saveAllDataToLocalStorage = ui.saveAllDataToLocalStorage;
    window.loadAllDataFromLocalStorage = ui.loadAllDataFromLocalStorage;
   
   // Create a unified handleSearchAndFilter function that delegates to the appropriate module
   window.handleSearchAndFilter = function(tabId) {
       if (tabId === 'worstCaseProducts') {
           worstCaseView.handleSearchAndFilter(tabId);
       } else {
           productView.handleSearchAndFilter(tabId);
       }
   };
   
   // Create a unified sortData function that delegates to the appropriate module
   window.sortData = function(key, tabId) {
       if (tabId === 'worstCaseProducts') {
           worstCaseView.sortData(key, tabId);
       } else {
           productView.sortData(key, tabId);
       }
   };
   
    const { printReport, ...macoProductViewWithoutPrint } = macoProductView;
    const { handleSearchAndFilter: productHandleSearchAndFilter, ...productViewWithoutHandler } = productView;
    const { handleSearchAndFilter: worstCaseHandleSearchAndFilter, ...worstCaseViewWithoutHandler } = worstCaseView;
    Object.assign(window, ui, utils, productViewWithoutHandler, machineView, worstCaseViewWithoutHandler, macoProductViewWithoutPrint, macoDetergentView, dashboardView, summaryView, trainSummaryView, scoringView);
    // --- EVENT LISTENERS FOR STATIC ELEMENTS ---
    // These are elements that are always present in your HTML.
    document.getElementById('theme-toggle').addEventListener('click', () => { 
        const isDark = document.documentElement.classList.contains('dark'); 
        ui.toggleDarkMode(!isDark); 
        localStorage.setItem('theme', !isDark ? 'dark' : 'light'); 
    });

    window.addEventListener('beforeprint', () => {
        // Store which view was being printed
        window.printingView = null;
        if (document.body.classList.contains('printing-worstCaseProducts')) {
            window.printingView = 'worstCaseProducts';
        } else if (document.body.classList.contains('printing-macoForTrains')) {
            window.printingView = 'macoForTrains';
        } else if (document.body.classList.contains('printing-trainSummary')) {
            window.printingView = 'trainSummary';
        }
    });

    window.addEventListener('afterprint', () => {
        const wasWorstCasePrinting = document.body.classList.contains('printing-worstCaseProducts');
        const wasMacoPrinting = document.body.classList.contains('printing-macoForTrains');
        const wasTrainSummaryPrinting = document.body.classList.contains('printing-trainSummary');
        
        document.body.className = document.body.className.replace(/printing-[\w-]+/g, '');
        
        if (state.scoringWasInEditModeForPrint) {
            scoringView.toggleScoringEditMode(true);
            state.setScoringWasInEditModeForPrint(false);
        }
        
        // Re-render views to restore original state
        if (wasWorstCasePrinting || wasMacoPrinting || wasTrainSummaryPrinting) {
            ui.showLoader(); // Show loader while re-rendering
            window.printSelectedTrain = null; // Clear the selected train
            
            if (wasWorstCasePrinting) {
                worstCaseView.renderWorstCaseByTrain();
            } else if (wasMacoPrinting) {
                macoProductView.renderMacoForTrains();
            } else if (wasTrainSummaryPrinting) {
                trainSummaryView.renderTrainSummary();
            }
        }
        
        // Clear the printing view flag
        window.printingView = null;
    });

    // Add a fallback mechanism to handle cases where print is cancelled
    // and afterprint might not fire properly
    window.addEventListener('focus', () => {
        if (window.printingView && !document.body.className.includes('printing-')) {
            // Print was likely cancelled, clean up
            setTimeout(() => {
                if (window.printingView && !document.body.className.includes('printing-')) {
                    ui.hideLoader();
                    window.printSelectedTrain = null;
                    window.printingView = null;
                }
            }, 500);
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); ui.undoChange(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); ui.redoChange(); }
    });

    // Add event delegation for filter inputs
    document.addEventListener('input', function(e) {
        if (e.target.matches('.filterColProductCode, .filterColProductName')) {
            handleSearchAndFilter('productRegister');
        }
        if (e.target.matches('#worstCaseProductNameFilter')) {
            worstCaseView.handleWorstCaseProductFilter();
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.matches('.filterColTrainNo, .filterColProductType, .filterColIsCritical')) {
            handleSearchAndFilter('productRegister');
        }
    });

    // --- EVENT LISTENERS FOR FORMS ---
    // Your original code had these listeners, which is a good pattern.
    // They call the handler functions which now live in their respective modules.
    document.getElementById('addProductForm').addEventListener('submit', productView.addNewProduct); // Assumes you create addNewProduct in productView.js from the original logic
    document.getElementById('editProductForm').addEventListener('submit', productView.saveProductChanges);
    document.getElementById('editIngredientForm').addEventListener('submit', productView.saveIngredientChanges);
    document.getElementById('machineForm').addEventListener('submit', machineView.saveMachine);
    document.getElementById('assignMachinesForm').addEventListener('submit', machineView.saveProductMachines);
    document.getElementById('addProductsToMachineForm').addEventListener('submit', machineView.saveProductsToMachine);
    
    // Listeners for static buttons
    document.getElementById('customAlertButton').onclick = () => ui.hideModal('customAlertModal');
    document.getElementById('editScoringBtn').addEventListener('click', () => scoringView.toggleScoringEditMode(!state.scoringInEditMode));
    
    // --- KICKSTART THE APPLICATION ---
    initializeApp();
});
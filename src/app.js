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
import * as machineCoverageView from './machineCoverageView.js';
import { renderLineReport } from './lineReportView.js';
import { QAView } from './qaView.js';
// Firestore functions removed; use only localStorage functions from ui.js if needed

// --- 2. ORCHESTRATION ---
// Initialize Q&A view with application data
const qaView = new QAView({
    products: state.products,
    machines: state.machines,
    trains: [], // Will be populated by train data
    lines: [],
    dosageForms: [],
    selectedStudies: [],
    macoCalculations: []
}, {
    debugMode: false,
    confidenceThreshold: 0.3 // Normal threshold
});

// Attach functions to window for live testing with script modules
window.changeTab = changeTab;
window.printTrain = printTrain;
window.sortData = productView.sortData;

// Global PDF export function
window.exportToPDFDirect = function() {
    try {
        // Check if PDF libraries are available
        if (typeof html2pdf === 'undefined') {
            console.error('html2pdf library not loaded');
            alert('PDF export library not available. Please refresh the page and try again.');
            return;
        }

        // Find the report content container instead of using document.body
        let element = document.querySelector('.report-container');
        if (!element) {
            element = document.querySelector('#lineReportContainer');
        }
        if (!element) {
            element = document.querySelector('.report-content');
        }
        if (!element) {
            // Fallback to body but hide navigation elements
            element = document.body;
            // Temporarily hide navigation elements
            const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
            navElements.forEach(el => {
                el.style.display = 'none';
            });
        }

        const opt = {
            margin: [0.3, 0.3, 0.3, 0.3],
            filename: 'cleaning_validation_report.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true
            },
            jsPDF: { 
                unit: 'in', 
                format: 'a4', 
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Show loading indicator
        const button = document.querySelector('.btn-pdf');
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '⏳ Generating PDF...';
            button.disabled = true;

            // Generate PDF directly
            html2pdf().set(opt).from(element).save().then(() => {
                button.innerHTML = originalText;
                button.disabled = false;

                
                // Restore navigation elements if they were hidden
                const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
                navElements.forEach(el => {
                    el.style.display = '';
                });
            }).catch((error) => {
                console.error('PDF generation failed:', error);
                button.innerHTML = originalText;
                button.disabled = false;
                alert('PDF generation failed: ' + error.message);
                
                // Restore navigation elements if they were hidden
                const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
                navElements.forEach(el => {
                    el.style.display = '';
                });
            });
        } else {
            // Generate PDF directly without button feedback
            html2pdf().set(opt).from(element).save().then(() => {
                    
                // Restore navigation elements if they were hidden
                const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
                navElements.forEach(el => {
                    el.style.display = '';
                });
            }).catch((error) => {
                console.error('PDF generation failed:', error);
                alert('PDF generation failed: ' + error.message);
                
                // Restore navigation elements if they were hidden
                const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
                navElements.forEach(el => {
                    el.style.display = '';
                });
            });
        }

    } catch (error) {
        console.error('Error in exportToPDFDirect:', error);
        alert('PDF export failed: ' + error.message);
        
        // Restore navigation elements if they were hidden
        const navElements = document.querySelectorAll('.header, .main-nav, .sidebar, .export-section');
        navElements.forEach(el => {
            el.style.display = '';
        });
    }
};

// Legacy function for backward compatibility
window.exportToPDF = function() {
    window.exportToPDFDirect();
};
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
        
        // Reset color mapping to ensure consistent colors after data changes
        dashboardView.resetColorMapping();

        // Re-render each major view/tab
        productView.handleSearchAndFilter('productRegister');
        worstCaseView.handleSearchAndFilter('worstCaseProducts');
        machineView.renderMachinesTable();
        machineView.updateMachineLineOptionsIfModalOpen(); // Update machine line options if modal is open
        dashboardView.renderMainDashboard();
        
        // Initialize Q&A system with current app data
        const appData = {
            products: state.products,
            machines: state.machines,
            trains: utils.getTrainsGroupedByLine()
        };
        qaView.initialize(appData);
        
        // Initialize proper case inputs after rendering
        utils.initializeProperCaseInputs();
        macoProductView.renderMacoForTrains();
        addPrintButtonsToTrains(); // Add print buttons after rendering
        macoDetergentView.renderDetergentMaco();
        macoDetergentView.renderDetergentIngredientsList();
        summaryView.renderSummaryReport();
        scoringView.renderScoringSystem(); // Re-render scoring system to reflect state changes

        // Update any dynamic UI elements, like filter dropdowns
        productView.populateFilterSelects();
        productView.populateProductLineDropdowns(); // Update product line dropdowns
        
        // Render line navigation
        renderLineNavigation();
    } catch (error) {
        console.error('Error during full application render:', error);
        ui.hideLoader(); // Ensure loader is hidden on error
    }
}

/**
 * Renders the line navigation sidebar with dynamic line-based menu items
 */
export function renderLineNavigation() {
    const lineNavigation = document.getElementById('lineNavigation');
    if (!lineNavigation) {
        console.error('Line navigation element not found');
        return;
    }

    // Get unique lines from products
    const uniqueLines = utils.getUniqueProductLines(state.products);
    
    lineNavigation.innerHTML = '';
    
    uniqueLines.forEach(line => {
        if (line === 'Shared') return; // Skip Shared line for navigation
        
        const lineDiv = document.createElement('div');
        lineDiv.className = 'line-nav-item';
        lineDiv.innerHTML = `
            <button onclick="toggleLineMenu('${line}')" class="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between" style="color: var(--text-primary);">
                <span>${line}</span>
                <svg class="w-4 h-4 transform transition-transform" id="arrow-${line}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div id="submenu-${line}" class="hidden ml-4 mt-2 space-y-1">
                <button onclick="showLineSpecificView('${line}', 'worstCase')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Worst Case Products</button>
                <button onclick="showLineSpecificView('${line}', 'maco')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Product MACO Calculation</button>
                <button onclick="showLineSpecificView('${line}', 'detergent')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Detergent MACO Calculation</button>
                <button onclick="showLineSpecificView('${line}', 'trainSummary')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Train Summary</button>
                <button onclick="showLineSpecificView('${line}', 'coverage')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Machine Coverage</button>
                <button onclick="showLineSpecificView('${line}', 'lineReport')" class="w-full text-left px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" style="color: var(--text-secondary);">Report</button>
            </div>
        `;
        lineNavigation.appendChild(lineDiv);
    });
}

/**
 * Toggles the line submenu visibility
 */
window.toggleLineMenu = function(line) {
    const submenu = document.getElementById(`submenu-${line}`);
    const arrow = document.getElementById(`arrow-${line}`);
    
    if (submenu.classList.contains('hidden')) {
        submenu.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        submenu.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
};

/**
 * Initializes the sidebar state on app load
 */
function initializeSidebarState() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const floatingToggle = document.getElementById('floatingToggle');
    
    // Start with sidebar open (not collapsed)
    if (sidebar) {
        sidebar.classList.remove('collapsed');
    }
    
    // Show sidebar toggle with collapse icon, hide floating toggle
    if (sidebarToggle) {
        sidebarToggle.classList.remove('hidden');
        sidebarToggle.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>
            </svg>
        `;
    }
    
    if (floatingToggle) {
        floatingToggle.classList.add('hidden');
    }
}

/**
 * Toggles the sidebar visibility
 */
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const floatingToggle = document.getElementById('floatingToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    
    if (sidebar.classList.contains('collapsed')) {
        // Expand sidebar
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('w-64');
        sidebar.classList.remove('w-0');
        sidebar.classList.remove('mr-0');
        sidebar.classList.add('mr-8');
        mainContent.classList.remove('ml-0');
        
        // Show sidebar toggle, hide floating toggle
        if (sidebarToggle) {
            sidebarToggle.classList.remove('hidden');
            // Set collapse icon for sidebar toggle
            sidebarToggle.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>
                </svg>
            `;
        }
        if (floatingToggle) {
            floatingToggle.classList.add('hidden');
        }
        
        // Show backdrop on mobile
        if (window.innerWidth <= 1024) {
            backdrop.classList.remove('hidden');
        }
    } else {
        // Collapse sidebar
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-0');
        sidebar.classList.remove('mr-8');
        sidebar.classList.add('mr-0');
        mainContent.classList.add('ml-0');
        
        // Hide sidebar toggle, show floating toggle
        if (sidebarToggle) {
            sidebarToggle.classList.add('hidden');
        }
        if (floatingToggle) {
            floatingToggle.classList.remove('hidden');
            // Set hamburger icon for floating toggle
            floatingToggle.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            `;
        }
        
        // Hide backdrop
        backdrop.classList.add('hidden');
    }
};

/**
 * Shows line-specific view with filtered data
 */
window.showLineSpecificView = function(line, viewType) {
    
    // Store the current line filter
    window.currentLineFilter = line;
    
    // Show the appropriate tab content
    let tabId;
    switch(viewType) {
        case 'worstCase':
            tabId = 'worstCaseProducts';
            break;
        case 'maco':
            tabId = 'macoForTrains';
            break;
        case 'detergent':
            tabId = 'detergentMaco';
            break;
        case 'trainSummary':
            tabId = 'trainSummary';
            break;
        case 'coverage':
            tabId = 'machineCoverage';
            break;
        case 'lineReport':
            tabId = 'lineReport';
            break;
    }
    
 
    
    // Hide all tab contents first
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab-content'));
    
    // Show the specific tab content
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
        tabContent.classList.add('active-tab-content');
        
    } else {
        console.error('Tab content not found:', tabId);
    }
    
    // Apply line-specific filtering
    applyLineFilter(line, viewType);
};

/**
 * Applies line-specific filtering to the current view
 */
function applyLineFilter(line, viewType) {

    switch(viewType) {
        case 'worstCase':
            // Filter worst case products by line
            
            worstCaseView.handleSearchAndFilter('worstCaseProducts', line);
            break;
        case 'maco':
            // Filter MACO calculations by line
        
            macoProductView.renderMacoForTrains(line);
            break;
        case 'detergent':
            // Filter detergent MACO by line
           
            macoDetergentView.renderDetergentMaco(line);
            break;
        case 'trainSummary':
            // Filter train summary by line
         
            trainSummaryView.renderTrainSummary(line);
            break;
        case 'coverage':
            
            {
                const container = document.getElementById('machineCoverageContainer');
                if (container) {
                    container.innerHTML = machineCoverageView.createHorizontalMachineCoverageTable();
                }
            }
            break;
        case 'lineReport':
            
            renderLineReport(line);
            break;
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
    if (tabId === 'dashboard') { 
        dashboardView.resetColorMapping(); // Reset colors for fresh assignment
        dashboardView.renderMainDashboard(); 
    }
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
    if (tabId === 'machineCoverage') {
        const container = document.getElementById('machineCoverageContainer');
        if (container) {
            container.innerHTML = machineCoverageView.createHorizontalMachineCoverageTable();
        }
    }
    if (tabId === 'qa') {
        qaView.render();
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

        try {
            if (typeof state.ensureProductsHaveLine === 'function') {
                state.ensureProductsHaveLine();
            }
        } catch (e) {
            console.warn('[migration] ensureProductsHaveLine failed', e);
        }
        
        // Perform the first full render of the application
        fullAppRender();

        // Initialize proper case inputs
        utils.initializeProperCaseInputs();

        // Initialize sidebar state
        initializeSidebarState();

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
   window.toggleSidebar = window.toggleSidebar; // Expose the sidebar toggle function
   window.toggleLineMenu = window.toggleLineMenu; // Expose the line menu toggle function
   window.showLineSpecificView = window.showLineSpecificView; // Expose the line-specific view function
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
    
    // Handle window resize for responsive sidebar
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        
        if (window.innerWidth > 1024) {
            // Desktop: hide backdrop
            backdrop.classList.add('hidden');
        } else if (!sidebar.classList.contains('collapsed')) {
            // Mobile: show backdrop if sidebar is open
            backdrop.classList.remove('hidden');
        }
    });
    
    // --- KICKSTART THE APPLICATION ---
    initializeApp();
    
    // Check if PDF libraries are loaded after a delay
    setTimeout(() => {
       

        // If libraries are not loaded, try to load them dynamically
        if (!window.jsPDF || !window.html2canvas) {
            loadPDFLibrariesDynamically();
        }
    }, 2000);
});

// Function to load html2pdf library dynamically
async function loadHtml2PdfLibrary() {
    if (!window.html2pdf) {
        const html2pdfScript = document.createElement('script');
        html2pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        html2pdfScript.onload = () => {
        
        };
        html2pdfScript.onerror = () => {
            console.error('Failed to load html2pdf from CDN');
        };
        document.head.appendChild(html2pdfScript);
        
        // Wait for library to load
        return new Promise((resolve) => {
            const checkLibrary = () => {
                if (window.html2pdf) {
                    resolve();
                } else {
                    setTimeout(checkLibrary, 100);
                }
            };
            checkLibrary();
        });
    }
}

// Function to load PDF libraries dynamically (legacy)
function loadPDFLibrariesDynamically() {
    // Try to load jsPDF
    if (!window.jsPDF) {
        const jsPDFScript = document.createElement('script');
        jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jsPDFScript.onload = () => {
            // Fix the global reference - try different possible names
            window.jsPDF = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;
        };
        jsPDFScript.onerror = () => {
            console.error('Failed to load jsPDF from CDN');
        };
        document.head.appendChild(jsPDFScript);
    }

    // Try to load html2canvas
    if (!window.html2canvas) {
        const html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
 
        html2canvasScript.onerror = () => {
            console.error('Failed to load html2canvas from CDN');
        };
        document.head.appendChild(html2canvasScript);
    }
}

// Test function to create a simple PDF
window.testSimplePDF = function() {
    try {
        let PDFConstructor = null;
        if (window.jspdf && window.jspdf.jsPDF) {
            PDFConstructor = window.jspdf.jsPDF;
        } else if (window.jsPDF && window.jsPDF.jsPDF) {
            PDFConstructor = window.jsPDF.jsPDF;
        } else if (window.jsPDF) {
            PDFConstructor = window.jsPDF;
        }
        
        if (!PDFConstructor) {
            console.log('❌ No PDF constructor available');
            return false;
        }
        
        
        const pdf = new PDFConstructor('p', 'mm', 'a4');
        pdf.text('Test PDF Generation', 20, 20);
        pdf.text('This is a test to verify PDF creation works.', 20, 30);
        pdf.text('If you can see this, the PDF generation is working!', 20, 40);
        
        const filename = 'test-pdf-' + Date.now() + '.pdf';
        pdf.save(filename);
        
        return true;
        
    } catch (error) {
        console.error('❌ Test PDF creation failed:', error);
        return false;
    }
};

// Test function to check report content visibility
window.testReportContent = function() {
    const reportContainer = document.querySelector('#lineReportContainer .report-container');
    if (!reportContainer) {
        console.log('❌ No report container found');
        return false;
    }
    
    
    return true;
};

// Test function to check PDF library availability
window.testPDFLibraries = function() {

    
    // Check for jsPDF constructor
    let PDFConstructor = null;
    if (window.jspdf && window.jspdf.jsPDF) {
        PDFConstructor = window.jspdf.jsPDF;
    } else if (window.jsPDF && window.jsPDF.jsPDF) {
        PDFConstructor = window.jsPDF.jsPDF;
    } else if (window.jsPDF) {
        PDFConstructor = window.jsPDF;
    }
    
    if (PDFConstructor) {
        try {
            const testPdf = new PDFConstructor('p', 'mm', 'a4');
            testPdf.text('Test', 10, 10);
        } catch (error) {
            console.error('❌ jsPDF constructor failed:', error.message);
        }
    } else {
        console.log('❌ No jsPDF constructor found');
    }
 
    return {
        jsPDF: !!window.jsPDF,
        html2canvas: !!window.html2canvas,
        jspdf: !!window.jspdf,
        PDFConstructor: PDFConstructor
    };
};

// Global function to force restore export button
window.forceRestoreExportButton = function() {
    const exportButton = document.querySelector('button[onclick="exportToPDF()"], button[onclick="window.exportToPDF()"]');
    if (exportButton) {

        exportButton.disabled = false;
        exportButton.style.opacity = '';
        exportButton.style.cursor = '';
        exportButton.style.backgroundColor = '';
        // Try to restore original text if we can find it
        if (exportButton.innerHTML.includes('Generating PDF')) {
            exportButton.innerHTML = '📄 Export to PDF';
        }
    }
};

// Global PDF export function for reports - opens in new window
window.exportToPDF = async function exportToPDF() {
    // Get the current line from the URL or state
    const currentLine = window.currentLineFilter || 'Solids';
    
    try {
        // Import the lineReportView module
        const lineReportModule = await import('./lineReportView.js');
        
        // Generate the report in a new window (original behavior)
        const generator = new lineReportModule.CleaningValidationReportGenerator();
        generator.generateReport(currentLine, 'All');
        
    } catch (error) {
        console.error('Error opening report window:', error);
        alert('Error opening report. Please try again.');
    }
};
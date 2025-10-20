// Machine Coverage Visualization Table
// src/machineCoverageView.js

import { getTrainData } from './utils.js';
import { products, machines } from './state.js';

// Color scheme for different studies
const STUDY_COLORS = [
    { name: 'Study 1', bg: '#e0f2fe', cell: '#0ea5e9' }, // Light blue
    { name: 'Study 2', bg: '#dcfce7', cell: '#22c55e' }, // Light green
    { name: 'Study 3', bg: '#fef9c3', cell: '#eab308' }, // Light yellow
    { name: 'Study 4', bg: '#fce7f3', cell: '#ec4899' }, // Light pink
    { name: 'Study 5', bg: '#f3e8ff', cell: '#a855f7' }, // Light purple
    { name: 'Study 6', bg: '#fef2f2', cell: '#ef4444' }, // Light red
];

export function createHorizontalMachineCoverageTable() {
    const trainData = getTrainData();
    const allMachines = getAllMachines();
    
    // For now, let's simulate selected trains based on highest RPN
    // In a real implementation, this would come from your algorithm
    const selectedTrains = getSelectedTrainsForStudy(trainData);
    
    console.log('Machine Coverage Data:', {
        trainData: trainData.length,
        allMachines: allMachines.length,
        selectedTrains: selectedTrains.length
    });
    
    return generateMachineCoverageHTML(trainData, selectedTrains, allMachines);
}

function getAllMachines() {
    // Get all unique machines from the state
    const machineList = machines.map(m => ({
        id: m.id,
        name: m.name,
        machineNumber: m.machineNumber
    }));
    
    // Sort by machine number for consistent display
    return machineList.sort((a, b) => {
        const aNum = parseInt(a.machineNumber.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.machineNumber.replace(/\D/g, '')) || 0;
        return aNum - bNum;
    });
}

function getSelectedTrainsForStudy(trainData) {
    // Simulate study selection based on highest RPN and coverage
    // In a real implementation, this would be your algorithm result
    const sortedTrains = trainData
        .filter(train => train.products && train.products.length > 0)
        .sort((a, b) => {
            // Sort by RPN (highest first) and then by number of machines
            const aRpn = getTrainHighestRPN(a);
            const bRpn = getTrainHighestRPN(b);
            if (aRpn !== bRpn) return bRpn - aRpn;
            return b.machineIds.length - a.machineIds.length;
        });
    
    // Select top trains for study (simplified logic)
    return sortedTrains.slice(0, Math.min(3, sortedTrains.length)).map(train => train.id);
}

function getTrainHighestRPN(train) {
    let highestRpn = 0;
    if (train.products) {
        train.products.forEach(product => {
            if (product.activeIngredients) {
                product.activeIngredients.forEach(ingredient => {
                    const rpn = calculateRPN(ingredient);
                    if (rpn > highestRpn) {
                        highestRpn = rpn;
                    }
                });
            }
        });
    }
    return highestRpn;
}

function calculateRPN(ingredient) {
    // Simplified RPN calculation
    const severity = ingredient.severity || 1;
    const occurrence = ingredient.occurrence || 1;
    const detection = ingredient.detection || 1;
    return severity * occurrence * detection;
}

function generateMachineCoverageHTML(trainData, selectedTrains, allMachines) {
    // Create coverage map to track which machines are covered by which study
    const machineCoverage = new Map();
    
    // Process selected trains in order
    selectedTrains.forEach((trainId, studyIndex) => {
        const train = trainData.find(t => t.id == trainId);
        if (train && train.machineIds) {
            train.machineIds.forEach(machineId => {
                if (!machineCoverage.has(machineId)) {
                    machineCoverage.set(machineId, studyIndex);
                }
            });
        }
    });
    
    // Generate HTML
    let html = `
        <div class="machine-coverage-container">
            <h3 class="text-xl font-bold mb-4">Machine Coverage Analysis</h3>
            <div class="overflow-x-auto">
                <table class="horizontal-coverage-table">
                    <thead>
                        <tr>
                            <th class="train-header">Train</th>
                            <th class="product-group-header">Product Group</th>
                            <th class="worst-case-header">Worst Case Product</th>
                            <th class="rpn-header">RPN</th>
    `;
    
    // Add machine headers
    allMachines.forEach(machine => {
        html += `<th class="machine-header">${machine.machineNumber}</th>`;
    });
    
    html += `
                            <th class="selected-header">Selected for Study</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Add train rows
    trainData.forEach(train => {
        const isSelected = selectedTrains.includes(train.id);
        const studyIndex = selectedTrains.indexOf(train.id);
        const studyColor = studyIndex >= 0 ? STUDY_COLORS[studyIndex] : null;
        
        // Get train info
        const productGroup = getTrainProductGroup(train);
        const worstCaseProduct = getTrainWorstCaseProduct(train);
        const highestRpn = getTrainHighestRPN(train);
        
        // Row styling
        const rowClass = isSelected ? `study-${studyIndex + 1}-row` : '';
        const rowStyle = studyColor ? `background-color: ${studyColor.bg};` : '';
        
        html += `
            <tr class="${rowClass}" style="${rowStyle}">
                <td class="train-cell font-semibold">${train.id}</td>
                <td class="product-group-cell">${productGroup}</td>
                <td class="worst-case-cell">${worstCaseProduct}</td>
                <td class="rpn-cell font-bold">${highestRpn}</td>
        `;
        
        // Add machine cells
        allMachines.forEach(machine => {
            const usesMachine = train.machineIds && train.machineIds.includes(machine.id);
            const coverageStudyIndex = machineCoverage.get(machine.id);
            const coverageColor = coverageStudyIndex !== undefined ? STUDY_COLORS[coverageStudyIndex] : null;
            
            let cellClass = 'machine-cell';
            let cellStyle = '';
            
            if (usesMachine) {
                if (coverageColor) {
                    cellClass += ` study-${coverageStudyIndex + 1}-machine`;
                    cellStyle = `background-color: ${coverageColor.cell}; color: white;`;
                } else {
                    cellClass += ' machine-used';
                    cellStyle = 'background-color: #e2e8f0;';
                }
            }
            
            html += `<td class="${cellClass}" style="${cellStyle}">${usesMachine ? '✓' : ''}</td>`;
        });
        
        // Selected for study column
        const selectedText = isSelected ? 'Yes' : 'No';
        const selectedClass = isSelected ? 'text-green-600 font-bold' : 'text-gray-500';
        html += `<td class="selected-cell ${selectedClass}">${selectedText}</td>`;
        
        html += '</tr>';
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <!-- Summary Section -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="study-summary">
                    <h4 class="text-lg font-semibold mb-3">Study Summary</h4>
                    <div class="space-y-2">
    `;
    
    // Generate study summary
    const studySummary = getStudySummary(trainData, selectedTrains);
    studySummary.forEach((summary, index) => {
        const color = STUDY_COLORS[index];
        html += `
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded" style="background-color: ${color.cell};"></div>
                <span class="text-sm">${summary}</span>
            </div>
        `;
    });
    
    html += `
                    </div>
                </div>
                
                <div class="coverage-stats">
                    <h4 class="text-lg font-semibold mb-3">Coverage Statistics</h4>
                    <div class="space-y-2 text-sm">
                        <div>Total Trains: ${trainData.length}</div>
                        <div>Selected for Study: ${selectedTrains.length}</div>
                        <div>Machines Covered: ${machineCoverage.size}</div>
                        <div>Coverage Rate: ${Math.round((machineCoverage.size / allMachines.length) * 100)}%</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function getTrainProductGroup(train) {
    if (!train.products || train.products.length === 0) return 'N/A';
    
    // Get the most common product type in this train
    const productTypes = train.products.map(p => p.productType || 'Other');
    const typeCounts = {};
    productTypes.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    const mostCommonType = Object.keys(typeCounts).reduce((a, b) => 
        typeCounts[a] > typeCounts[b] ? a : b
    );
    
    return mostCommonType.toUpperCase();
}

function getTrainWorstCaseProduct(train) {
    if (!train.products || train.products.length === 0) return 'N/A';
    
    let worstProduct = null;
    let highestRpn = 0;
    
    train.products.forEach(product => {
        if (product.activeIngredients) {
            product.activeIngredients.forEach(ingredient => {
                const rpn = calculateRPN(ingredient);
                if (rpn > highestRpn) {
                    highestRpn = rpn;
                    worstProduct = product.name;
                }
            });
        }
    });
    
    return worstProduct || train.products[0].name;
}

function getStudySummary(trainData, selectedTrains) {
    const summary = [];
    
    selectedTrains.forEach((trainId, index) => {
        const train = trainData.find(t => t.id == trainId);
        if (train) {
            const worstCaseProduct = getTrainWorstCaseProduct(train);
            const studyNumber = index + 1;
            summary.push(`Study ${studyNumber}: ${trainId} (${worstCaseProduct})`);
        }
    });
    
    return summary;
}

// CSS styles for the table
export function getMachineCoverageStyles() {
    return `
        <style>
        .machine-coverage-container {
            padding: 20px;
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }
        
        .horizontal-coverage-table {
            border-collapse: collapse;
            width: 100%;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .horizontal-coverage-table th {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px 8px;
            text-align: center;
            font-weight: 600;
            color: #374151;
        }
        
        .machine-header {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            min-width: 40px;
            max-width: 40px;
        }
        
        .train-header, .product-group-header, .worst-case-header, .rpn-header, .selected-header {
            min-width: 120px;
        }
        
        .horizontal-coverage-table td {
            border: 1px solid #e2e8f0;
            padding: 8px;
            text-align: center;
        }
        
        .train-cell {
            font-weight: 600;
            background-color: #f8fafc;
        }
        
        .machine-cell {
            min-width: 40px;
            font-weight: bold;
        }
        
        .machine-used {
            background-color: #e2e8f0;
        }
        
        .study-1-row {
            background-color: #e0f2fe !important;
        }
        
        .study-2-row {
            background-color: #dcfce7 !important;
        }
        
        .study-3-row {
            background-color: #fef9c3 !important;
        }
        
        .study-4-row {
            background-color: #fce7f3 !important;
        }
        
        .study-5-row {
            background-color: #f3e8ff !important;
        }
        
        .study-6-row {
            background-color: #fef2f2 !important;
        }
        
        .study-1-machine {
            background-color: #0ea5e9 !important;
            color: white !important;
        }
        
        .study-2-machine {
            background-color: #22c55e !important;
            color: white !important;
        }
        
        .study-3-machine {
            background-color: #eab308 !important;
            color: white !important;
        }
        
        .study-4-machine {
            background-color: #ec4899 !important;
            color: white !important;
        }
        
        .study-5-machine {
            background-color: #a855f7 !important;
            color: white !important;
        }
        
        .study-6-machine {
            background-color: #ef4444 !important;
            color: white !important;
        }
        
        .study-summary, .coverage-stats {
            background-color: var(--bg-secondary);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }
        
        .overflow-x-auto {
            overflow-x: auto;
            margin-bottom: 20px;
        }
        
        @media (max-width: 768px) {
            .horizontal-coverage-table {
                font-size: 12px;
            }
            
            .machine-header {
                min-width: 30px;
                max-width: 30px;
            }
            
            .machine-cell {
                min-width: 30px;
            }
        }
        </style>
    `;
}

// Make function globally available
window.createHorizontalMachineCoverageTable = createHorizontalMachineCoverageTable;

// Demo function for testing
window.testMachineCoverage = function() {
    const container = document.getElementById('machineCoverageContainer');
    if (container) {
        container.innerHTML = createHorizontalMachineCoverageTable();
        console.log('Machine coverage table rendered!');
    } else {
        console.log('Container not found!');
    }
};

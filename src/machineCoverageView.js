/**
 * Simplified Machine Coverage Table Generator
 * Creates a clean, simple table with horizontal row coloring only
 * Based on the cleaner mockup design
 */

import { getTrainData, getTrainIdToLineNumberMap, countStudiesForTrains, getConsistentTrainOrder, calculateScores } from './utils.js';
import { products, machines } from './state.js';

class SimplifiedMachineCoverageTable {
    constructor() {
        this.selectedTrains = [];
        this.allTrains = [];
        this.machines = [];
        // Darker, high-contrast colors starting with RED for highest risk
        this.studyColors = [
            '#f87171', // Study 1 - Red
            '#f59e0b', // Study 2 - Orange
            '#facc15', // Study 3 - Yellow
            '#34d399', // Study 4 - Green
            '#60a5fa', // Study 5 - Blue
            '#a78bfa'  // Study 6 - Purple
        ];
    }

    /**
     * Generate the simplified machine coverage table
     * @param {Object} data - Input data containing products and machine coverage
     * @returns {string} HTML string for the table
     */
    generateTable(data) {
        // Process the data
        this.processData(data);
        
        // Generate HTML
        return this.generateHTML();
    }

    /**
     * Process input data and determine selected products
     * @param {Object} data - Raw input data
     */
    processData(data) {
        // Group trains by dosage form (same logic as train summary)
        const dosageGroups = {};
        data.trains.forEach(train => {
            const dosageForm = train.productGroup || 'Unknown';
            if (!dosageGroups[dosageForm]) {
                dosageGroups[dosageForm] = [];
            }
            dosageGroups[dosageForm].push(train);
        });
        
        // Process each dosage form group separately and apply consistent train ordering
        const dosageFormGroups = [];
        Object.keys(dosageGroups).forEach(dosageForm => {
            const trainsInGroup = dosageGroups[dosageForm];
            dosageFormGroups.push({ dosageForm, trains: trainsInGroup });
        });
        
        // Apply consistent train ordering within each dosage form group
        dosageFormGroups.forEach(group => {
            group.trains = getConsistentTrainOrder(group.trains);
        });
        
        // Combine back into single array maintaining dosage form grouping
        this.allTrains = [];
        dosageFormGroups.forEach(group => {
            // Sort by train ID within each dosage form group (like train summary)
            const sortedTrains = group.trains.sort((a, b) => {
                // Extract train number from trainId (e.g., "Train 1" -> 1)
                const aNum = parseInt(a.trainId?.replace(/\D/g, '') || '0');
                const bNum = parseInt(b.trainId?.replace(/\D/g, '') || '0');
                return aNum - bNum;
            });
            this.allTrains.push(...sortedTrains);
        });
        
        // Extract unique machines
        this.machines = [...new Set(data.trains.flatMap(t => t.usedMachines))].sort();
        
        // Apply machine coverage algorithm
        this.selectTrainsForStudy();
    }

    /**
     * Apply the machine coverage selection algorithm
     */
    selectTrainsForStudy() {
        // Group trains by dosage form (like train summary)
        const dosageGroups = {};
        this.allTrains.forEach(train => {
            const dosageForm = train.productGroup || 'Unknown';
            if (!dosageGroups[dosageForm]) {
                dosageGroups[dosageForm] = [];
            }
            dosageGroups[dosageForm].push(train);
        });
        
        // Process each dosage form group separately (EXACTLY like train summary)
        this.selectedTrains = [];
        let globalStudyIndex = 0;
        
        Object.keys(dosageGroups).forEach(dosageForm => {
            const trainsInGroup = dosageGroups[dosageForm];
            const machinesInGroup = [...new Set(trainsInGroup.flatMap(t => t.usedMachines))];
            const coveredMachines = new Set();
            
            // Sort by RPN (highest first) within dosage form group (EXACTLY like train summary)
            const trainsWithRPN = trainsInGroup.map(train => ({
                train,
                rpn: train.rpn || 0
            })).sort((a, b) => b.rpn - a.rpn);
            
            console.log(`Machine Coverage: Processing ${trainsInGroup.length} trains in dosage form: ${dosageForm}`);
            console.log(`Machine Coverage: RPN-sorted order:`, trainsWithRPN.map(t => {
                const internalId = t.train.trainInternalId || t.train.originalTrain?.id;
                return `${t.train.trainId} (Internal ID: ${internalId}, RPN: ${t.rpn})`;
            }));
            
            for (const { train, rpn } of trainsWithRPN) {
                const trainMachines = new Set(train.usedMachines);
                const newMachines = [...trainMachines].filter(m => !coveredMachines.has(m));
                const internalId = train.trainInternalId || train.originalTrain?.id;
                
                console.log(`Machine Coverage: Checking train ${train.trainId} (Internal ID: ${internalId}) - RPN: ${rpn}, new machines: ${newMachines.length}`);
                
                if (newMachines.length > 0) {
                    globalStudyIndex++;
                    console.log(`Machine Coverage: Selected train ${train.trainId} for study ${globalStudyIndex}`);
                    
                    this.selectedTrains.push({
                        ...train,
                        studyNumber: globalStudyIndex,
                        studyColor: this.studyColors[(globalStudyIndex - 1) % this.studyColors.length],
                        newMachinesCovered: newMachines,
                        trainInternalId: internalId
                    });
                    
                    newMachines.forEach(machine => coveredMachines.add(machine));
                    
                    if (coveredMachines.size === machinesInGroup.length) {
                        break;
                    }
                } else {
                    console.log(`Machine Coverage: Skipped train ${train.trainId} - no new machines`);
                }
            }
        });
        
        console.log(`Machine Coverage: Selected ${this.selectedTrains.length} studies total`);
    }

    /**
     * Generate clean HTML table
     * @returns {string} HTML string
     */
    generateHTML() {
        return `
        <div class="machine-coverage-container">
            <div class="coverage-header">
                <h2>Machine Coverage Details – ${this.getLineAndDosageForm()}</h2>
                <p class="coverage-description">Products selected for cleaning validation studies based on machine coverage optimization</p>
            </div>
            
            <div class="coverage-table-wrapper">
                <table class="coverage-table">
                    ${this.generateTableHeader()}
                    ${this.generateTableBody()}
                </table>
            </div>
            
            ${this.generateStudyLegend()}
            
            ${this.generateSummaryStats()}
        </div>
        
        <style>
        .machine-coverage-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 20px auto;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .coverage-header h2 {
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
        }
        
        .coverage-description {
            color: #666;
            font-size: 14px;
            margin: 0 0 24px 0;
        }
        
        .coverage-table-wrapper {
            overflow-x: auto;
            margin-bottom: 24px;
        }
        
        .coverage-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            background: white;
        }
        
        .coverage-table th {
            background: #f8f9fa;
            color: #495057;
            font-weight: 600;
            padding: 12px 8px;
            text-align: center;
            border: 1px solid #dee2e6;
            font-size: 13px;
        }
        .coverage-table th.machine-header {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            min-width: 24px;
            max-width: 24px;
            white-space: nowrap;
            transform: rotate(180deg); /* bottom-to-top */
            transform-origin: center;
        }
        
        .coverage-table th:first-child {
            text-align: left;
            min-width: 90px;
            max-width: 120px;
        }
        
        .coverage-table th:nth-child(2) {
            min-width: 80px;
        }
        
        .coverage-table td {
            padding: 12px 8px;
            text-align: center;
            border: 1px solid #dee2e6;
            font-size: 13px;
        }
        
        .coverage-table td:first-child {
            text-align: left;
            font-weight: 500;
            color: #212529;
            width: 90px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .coverage-table td:nth-child(2) {
            font-weight: 600;
            color: #495057;
        }
        
        /* Cells colored per study; empty cells are white */
        .coverage-table .machine-cell { min-width: 28px; height: 24px; }
        
        .study-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 500;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 1px solid #dee2e6;
        }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 6px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #495057;
            margin-bottom: 4px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            font-weight: 500;
        }
        </style>`;
    }

    /**
     * Generate table header
     * @returns {string} HTML string for header
     */
    generateTableHeader() {
        const machineHeaders = this.machines.map(machine => 
            `<th class="machine-header">${machine}</th>`
        ).join('');
        
        return `
        <thead>
            <tr>
                <th>Train</th>
                <th>Product Group</th>
                <th>Worst Case Product</th>
                <th>RPN</th>
                <th>Study No.</th>
                ${machineHeaders}
                <th>Selected for Study</th>
            </tr>
        </thead>`;
    }

    /**
     * Generate table body with horizontal row coloring
     * @returns {string} HTML string for body
     */
    generateTableBody() {
        const rows = this.allTrains.map(train => {
            // Match by internal ID and productGroup for proper train matching
            const selectedTrain = this.selectedTrains.find(st => {
                const trainInternalId = train.trainInternalId || train.originalTrain?.id;
                const stInternalId = st.trainInternalId || st.originalTrain?.id;
                
                if (trainInternalId && stInternalId && trainInternalId === stInternalId) {
                    return st.productGroup === train.productGroup;
                }
                return false;
            });
            const studyColor = selectedTrain ? selectedTrain.studyColor : null;
            const metaStyle = studyColor ? `style="background-color: ${studyColor};"` : '';
            
            const machineCells = this.machines.map(machine => {
                const isUsed = train.usedMachines.includes(machine);
                const isNewCoverage = selectedTrain && selectedTrain.newMachinesCovered && selectedTrain.newMachinesCovered.includes(machine);
                const fillColor = isNewCoverage ? studyColor : '#ffffff';
                const mark = isUsed ? '✓' : '';
                return `<td class="machine-cell" style="background-color: ${fillColor}; text-align:center; font-weight:700;">${mark}</td>`;
            }).join('');
            
            const selectedText = selectedTrain ? 'Yes' : 'No';
            const group = train.productGroup || '-';
            const wcp = train.worstCaseProduct || '-';
            
            console.log(`Train ${train.trainId} (${train.productGroup}): selectedTrain =`, selectedTrain);
            console.log(`Train ${train.trainId} (${train.productGroup}): newMachinesCovered =`, selectedTrain?.newMachinesCovered);
            
            return `
            <tr>
                <td class="train-label" ${metaStyle}>${train.trainId}</td>
                <td ${metaStyle}>${group}</td>
                <td ${metaStyle}>${wcp}</td>
                <td ${metaStyle}>${train.rpn}</td>
                <td ${metaStyle}>${selectedTrain ? selectedTrain.studyNumber : '-'}</td>
                ${machineCells}
                <td>${selectedText}</td>
            </tr>`;
        }).join('');
        
        return `<tbody>${rows}</tbody>`;
    }

    /**
     * Generate study legend
     * @returns {string} HTML string for legend
     */
    generateStudyLegend() {
        const legendItems = this.selectedTrains.map(train => 
            `<div class="legend-item">
                <div class="legend-color" style="background-color: ${train.studyColor};"></div>
                <span>Study ${train.studyNumber}: ${train.trainId} (${train.worstCaseProduct || '-'})</span>
            </div>`
        ).join('');
        
        return `<div class="study-legend">${legendItems}</div>`;
    }

    /**
     * Generate summary statistics
     * @returns {string} HTML string for stats
     */
    generateSummaryStats() {
        // Use the actual study selection count from the algorithm
        const selectedCount = this.selectedTrains.filter(study => 
            study.newMachinesCovered && study.newMachinesCovered.length > 0
        ).length;
        
        const totalProducts = Number(this.allTrains?.length || 0);
        const totalMachines = Number(this.machines?.length || 0);
        const savingsPercent = totalProducts > 0
            ? Math.round((1 - selectedCount / totalProducts) * 100)
            : 0;
        
        console.log(`Machine Coverage Stats: ${selectedCount} studies from ${totalProducts} trains`);
        
        return `
        <div class="summary-stats">
            <div class="stat-card">
                <div class="stat-value">${selectedCount}</div>
                <div class="stat-label">Studies Required</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalProducts}</div>
                <div class="stat-label">Total Products</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalMachines}</div>
                <div class="stat-label">Machines Covered</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${savingsPercent}%</div>
                <div class="stat-label">Studies Saved</div>
            </div>
        </div>`;
    }

    /**
     * Get line and dosage form for header
     * @returns {string} Line and dosage form string
     */
    getLineAndDosageForm() {
        // Prefer injected context from caller (current selected line)
        if (this._lineContext) {
            return `${this._lineContext}`;
        }
        return "All Lines";
    }
}

export function createHorizontalMachineCoverageTable() {
    // Get full train data
    let trainData = getTrainData();
    const allMachines = getAllMachines();
    
    // Apply current line filter to reflect Train Summary behavior
    const currentLine = (window.currentLineFilter && window.currentLineFilter !== 'all') ? window.currentLineFilter : null;
    if (currentLine) {
        trainData = trainData.filter(t => (t.line || t.productLine) === currentLine);
    }
    
    // Helper to render a single line section
    const renderLineSection = (lineName, trainsForLine) => {
        // Build machine list only used by this line's trains (for compact width)
        const usedMachineIds = new Set();
        trainsForLine.forEach(t => (t.machineIds || []).forEach(id => usedMachineIds.add(id)));
        const machinesForLine = allMachines.filter(m => usedMachineIds.has(m.id));
        
        const dataForLine = convertTrainDataToProductData(trainsForLine, machinesForLine);
        const table = new SimplifiedMachineCoverageTable();
        table._lineContext = lineName;
        return table.generateTable(dataForLine);
    };
    
    if (currentLine) {
        return renderLineSection(currentLine, trainData);
    }
    
    // No specific line selected: render a section per line similar to Product MACO/Train Summary
    const lineNames = [...new Set(trainData.map(t => (t.line || t.productLine) || 'Unassigned'))];
    let html = '';
    lineNames.forEach(line => {
        const trainsForLine = trainData.filter(t => (t.line || t.productLine) === line);
        html += renderLineSection(line, trainsForLine);
    });
    return html;
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

function convertTrainDataToProductData(trainData, allMachines) {
    const data = { trains: [] };
    
    trainData.forEach(train => {
        // Map machine ids to names (vertical headers)
        const usedMachines = (train.machineIds || []).map(id => {
            const m = allMachines.find(x => x.id === id);
            return m ? m.name : null;
        }).filter(Boolean);
        
        // Get proper train numbering
        const idMap = getTrainIdToLineNumberMap();
        const mapped = idMap.get(String(train.id));
        const trainNumber = mapped ? mapped.number : train.id;
        
        // Get unique dosage forms in this train (same logic as train summary)
        const dosageForms = [...new Set((train.products || []).map(p => p.productType || 'Unknown'))];
        
        // Create separate entry for each dosage form (like train summary)
        dosageForms.forEach(dosageForm => {
            // Find worst case product and highest RPN for this specific dosage form
            let worstProduct = null;
            let highestRpn = 0;
            
            const productsInDosageForm = (train.products || []).filter(p => (p.productType || 'Unknown') === dosageForm);
            
            productsInDosageForm.forEach(product => {
                if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                    product.activeIngredients.forEach(ingredient => {
                        try {
                            const scores = calculateScores(ingredient);
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
            
            // Create unique train identifier that includes dosage form
            const uniqueTrainId = `${trainNumber}-${dosageForm}`;
            
            data.trains.push({
                trainId: train.id ? `Train ${trainNumber}` : (train.trainId || 'Train'),
                uniqueId: uniqueTrainId, // Add unique identifier
                productGroup: dosageForm,
                worstCaseProduct: worstProduct || '-',
                rpn: highestRpn,
                usedMachines,
                originalTrain: train, // Keep reference to original train
                trainInternalId: train.id // Add internal ID for matching
            });
        });
    });
    
    return data;
}

function calculateRPN(ingredient) {
    // RPN calculation based on solubility and cleanability
    const solubility = ingredient.solubility === 'Freely soluble' ? 1 : 
                     ingredient.solubility === 'Soluble' ? 2 :
                     ingredient.solubility === 'Slightly soluble' ? 3 : 4;
    
    const cleanability = ingredient.cleanability === 'Easy' ? 1 :
                        ingredient.cleanability === 'Medium' ? 2 : 3;
    
    return solubility * cleanability;
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

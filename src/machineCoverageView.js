/**
 * Simplified Machine Coverage Table Generator
 * Creates a clean, simple table with horizontal row coloring only
 * Based on the cleaner mockup design
 */

import { getTrainData } from './utils.js';
import { products, machines } from './state.js';

class SimplifiedMachineCoverageTable {
    constructor() {
        this.selectedProducts = [];
        this.allProducts = [];
        this.machines = [];
        this.studyColors = [
            '#E3F2FD', // Light Blue for Study 1
            '#E8F5E8', // Light Green for Study 2
            '#FFF3E0', // Light Orange for Study 3
            '#F3E5F5', // Light Purple for Study 4
            '#E0F2F1'  // Light Teal for Study 5
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
        // Extract all products sorted by RPN (highest first)
        this.allProducts = data.products.sort((a, b) => b.rpn - a.rpn);
        
        // Extract unique machines
        this.machines = [...new Set(data.products.flatMap(p => p.machines))].sort();
        
        // Apply machine coverage algorithm
        this.selectProductsForStudy();
    }

    /**
     * Apply the machine coverage selection algorithm
     */
    selectProductsForStudy() {
        const coveredMachines = new Set();
        const allMachines = new Set(this.machines);
        let studyIndex = 0;

        // Reset selected products
        this.selectedProducts = [];

        // Iterate through products by RPN (highest first)
        for (const product of this.allProducts) {
            // Check if this product covers any uncovered machines
            const productMachines = new Set(product.machines);
            const newMachines = [...productMachines].filter(m => !coveredMachines.has(m));
            
            if (newMachines.length > 0) {
                // This product covers new machines, select it for study
                this.selectedProducts.push({
                    ...product,
                    studyNumber: studyIndex + 1,
                    studyColor: this.studyColors[studyIndex % this.studyColors.length],
                    newMachinesCovered: newMachines
                });
                
                // Add covered machines
                newMachines.forEach(machine => coveredMachines.add(machine));
                studyIndex++;
                
                // Stop if all machines are covered
                if (coveredMachines.size === allMachines.size) {
                    break;
                }
            }
        }
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
        
        .coverage-table th:first-child {
            text-align: left;
            min-width: 200px;
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
        }
        
        .coverage-table td:nth-child(2) {
            font-weight: 600;
            color: #495057;
        }
        
        .coverage-table .machine-covered {
            background: #28a745;
            color: white;
            font-weight: 600;
            border-radius: 3px;
        }
        
        .coverage-table .machine-not-covered {
            background: #f8f9fa;
            color: #6c757d;
        }
        
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
            `<th>${machine}</th>`
        ).join('');
        
        return `
        <thead>
            <tr>
                <th>Product Name</th>
                <th>RPN</th>
                ${machineHeaders}
            </tr>
        </thead>`;
    }

    /**
     * Generate table body with horizontal row coloring
     * @returns {string} HTML string for body
     */
    generateTableBody() {
        const rows = this.allProducts.map(product => {
            const selectedProduct = this.selectedProducts.find(sp => sp.name === product.name);
            const rowStyle = selectedProduct ? 
                `style="background-color: ${selectedProduct.studyColor};"` : '';
            
            const machineCells = this.machines.map(machine => {
                const isUsed = product.machines.includes(machine);
                const cellClass = isUsed ? 'machine-covered' : 'machine-not-covered';
                const cellContent = isUsed ? '✓' : '';
                return `<td class="${cellClass}">${cellContent}</td>`;
            }).join('');
            
            return `
            <tr ${rowStyle}>
                <td>${product.name}</td>
                <td>${product.rpn}</td>
                ${machineCells}
            </tr>`;
        }).join('');
        
        return `<tbody>${rows}</tbody>`;
    }

    /**
     * Generate study legend
     * @returns {string} HTML string for legend
     */
    generateStudyLegend() {
        const legendItems = this.selectedProducts.map(product => 
            `<div class="legend-item">
                <div class="legend-color" style="background-color: ${product.studyColor};"></div>
                <span>Study ${product.studyNumber}: ${product.name}</span>
            </div>`
        ).join('');
        
        return `<div class="study-legend">${legendItems}</div>`;
    }

    /**
     * Generate summary statistics
     * @returns {string} HTML string for stats
     */
    generateSummaryStats() {
        const totalProducts = this.allProducts.length;
        const selectedCount = this.selectedProducts.length;
        const totalMachines = this.machines.length;
        const savingsPercent = Math.round((1 - selectedCount / totalProducts) * 100);
        
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
        // This should be passed from the parent component
        return "Line 1 - Tablets"; // Default value
    }
}

export function createHorizontalMachineCoverageTable() {
    const trainData = getTrainData();
    const allMachines = getAllMachines();
    
    // Convert train data to product data format
    const productData = convertTrainDataToProductData(trainData, allMachines);
    
    console.log('Machine Coverage Data:', {
        trainData: trainData.length,
        allMachines: allMachines.length,
        products: productData.products.length
    });
    
    const coverageTable = new SimplifiedMachineCoverageTable();
    return coverageTable.generateTable(productData);
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
    const productData = {
        products: []
    };
    
    // Convert each train to products
    trainData.forEach(train => {
        if (train.products && train.products.length > 0) {
            train.products.forEach(product => {
                // Calculate highest RPN for this product
                let highestRpn = 0;
                if (product.activeIngredients) {
                    product.activeIngredients.forEach(ingredient => {
                        const rpn = calculateRPN(ingredient);
                        console.log(`Product: ${product.name}, Ingredient: ${ingredient.name}, Solubility: ${ingredient.solubility}, Cleanability: ${ingredient.cleanability}, RPN: ${rpn}`);
                        if (rpn > highestRpn) {
                            highestRpn = rpn;
                        }
                    });
                }
                
                // Get machine numbers for this product
                const productMachines = [];
                if (product.machineIds) {
                    product.machineIds.forEach(machineId => {
                        const machine = allMachines.find(m => m.id === machineId);
                        if (machine) {
                            productMachines.push(machine.machineNumber);
                        }
                    });
                }
                
                productData.products.push({
                    name: product.name,
                    rpn: highestRpn,
                    machines: productMachines
                });
            });
        }
    });
    
    return productData;
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

// Line Report View - generates a printable report per line using in-app data
import { getTrainData, getLargestEssaForLineAndDosageForm, getWorstCaseProductType, countStudiesForTrains, calculateScores } from './utils.js';
import { machines, safetyFactorConfig, products } from './state.js';

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

class CleaningValidationReportGenerator {
    constructor() { this.reportData = null; }

    generateReport(lineId, dosageForm = 'All') {
        try {
            this.reportData = this.collectReportData(lineId, dosageForm);
            const htmlReport = this.generateHTMLReport(this.reportData);
            this.openReportWindow(htmlReport);
            return true;
        } catch (e) {
            console.error('Error generating report:', e);
            alert('Error generating report. Please try again.');
            return false;
        }
    }

    collectReportData(lineId, dosageForm) {
        const allTrainData = getTrainData();
        const trainsForLine = allTrainData.filter(t => (t.line || t.productLine) === lineId);

        // Build usedMachines (names) per train and handle multiple dosage forms
        const trainDtos = [];
        trainsForLine.forEach(t => {
            const usedMachineNames = (t.machineIds || []).map(id => {
                const m = machines.find(x => x.id === id);
                return m ? m.name : null;
            }).filter(Boolean);

            // Get unique dosage forms in this train (same logic as machine coverage and train summary)
            const dosageForms = [...new Set((t.products || []).map(p => p.productType || 'Unknown'))];
            
            // Create separate entry for each dosage form (like train summary and machine coverage)
            dosageForms.forEach(dosageForm => {
                // Find worst case product and highest RPN for this specific dosage form
                let worstProduct = '-';
                let worstRpn = 0;
                
                const productsInDosageForm = (t.products || []).filter(p => (p.productType || 'Unknown') === dosageForm);
                
                productsInDosageForm.forEach(p => {
                    if (p.activeIngredients && Array.isArray(p.activeIngredients)) {
                        p.activeIngredients.forEach(ing => {
                            try {
                                const scores = calculateScores(ing);
                                const rpn = scores?.rpn || 0;
                                if (rpn > worstRpn) {
                                    worstRpn = rpn;
                                    worstProduct = p.name;
                                }
                            } catch (error) {
                                console.warn('Error calculating RPN for ingredient:', ing, error);
                            }
                        });
                    }
                });

                // Calculate MACO for this train
                const macoValue = this.calculateMacoForTrain(t, allTrainData);

                trainDtos.push({
                    trainId: `Train ${t.number || t.id}`,
                    products: productsInDosageForm.map(p => p.name), // Only products in this dosage form
                    machines: usedMachineNames,
                    worstCaseProduct: worstProduct,
                    worstCaseRPN: worstRpn,
                    macoValue: macoValue,
                    machineIds: t.machineIds || [],
                    productType: dosageForm, // Specific dosage form for this entry
                    line: t.line || 'Unassigned', // Add line for sorting
                    trainNumber: t.number || t.id, // Add train number for sorting
                    trainInternalId: t.id // Add internal ID for sorting
                });
            });
        });

        // Apply consistent train ordering (exact same as train summary view)
        trainDtos.sort((a, b) => {
            // First sort by line with specific order
            if (a.line !== b.line) {
                const lineOrder = ['Solids', 'Semisolid', 'Liquids', 'Other'];
                const aIndex = lineOrder.indexOf(a.line) !== -1 ? lineOrder.indexOf(a.line) : lineOrder.length;
                const bIndex = lineOrder.indexOf(b.line) !== -1 ? lineOrder.indexOf(b.line) : lineOrder.length;
                if (aIndex !== bIndex) return aIndex - bIndex;
            }
            
            // Then sort by dosage form using lowest train number within each dosage form (same as train summary)
            if (a.productType !== b.productType) {
                // Find all trains in this line for each dosage form to get the minimum train number
                const aDosageFormTrains = trainDtos.filter(t => t.line === a.line && t.productType === a.productType);
                const bDosageFormTrains = trainDtos.filter(t => t.line === b.line && t.productType === b.productType);
                
                const aMinNumber = Math.min(...aDosageFormTrains.map(t => t.trainInternalId));
                const bMinNumber = Math.min(...bDosageFormTrains.map(t => t.trainInternalId));
                
                if (aMinNumber !== bMinNumber) return aMinNumber - bMinNumber;
            }
            
            // Finally sort by train number/ID
            return a.trainInternalId - b.trainInternalId;
        });

        // Select studies to cover machines (same logic as coverage view)
        const selectedStudies = this.selectStudies(trainDtos);

        const uniqueMachineIds = new Set();
        trainsForLine.forEach(t => (t.machineIds || []).forEach(id => uniqueMachineIds.add(id)));
        const machineNames = Array.from(uniqueMachineIds).map(id => {
            const m = machines.find(x => x.id === id); return m ? m.name : null;
        }).filter(Boolean);

        // Use the actual study selection count from the algorithm
        const studyCount = selectedStudies.filter(study => 
            study.newMachinesCovered && study.newMachinesCovered.length > 0
        ).length;
        
        console.log(`Report: Final study count: ${studyCount} (from ${selectedStudies.length} total)`);
        
        return {
            groupInfo: { lineName: lineId, dosageForm, reportDate: new Date().toLocaleDateString(), reviewer: 'System Generated' },
            summary: {
                totalProducts: trainDtos.reduce((acc, t) => acc + t.products.length, 0),
                totalTrains: trainDtos.length,
                totalMachines: machineNames.length,
                requiredStudies: studyCount,
                savingsPercentage: trainDtos.length > 0 ? Math.round(((trainDtos.length - studyCount) / trainDtos.length) * 100) : 0,
                lowestMaco: trainDtos.length > 0 ? Math.min(...trainDtos.map(t => t.macoValue)) : 0
            },
            trains: trainDtos,
            selectedStudies,
            macoCalculations: [],
            allProducts: Array.from(new Set(trainDtos.flatMap(t => t.products))),
            allMachines: machineNames
        };
    }


    calculateMacoForTrain(train, allTrains) {
        try {
            const sfConfig = safetyFactorConfig[getWorstCaseProductType(train.products.map(p => p.productType))] || safetyFactorConfig['Other'];
            const sf = sfConfig.max;
            
            // Calculate line-specific largest ESSA for this train
            const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, allTrains);
            
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            if (train.lowestPde !== null) {
                macoHealth = train.lowestPde * train.minBsMddRatio;
            }
            const macoVisual = (0.004) * lineLargestEssa;
            
            const finalMaco = Math.min(macoDose, maco10ppm, macoHealth, macoVisual);
            return finalMaco;
        } catch (error) {
            console.error('Error calculating MACO for train:', error);
            return 0;
        }
    }

    selectStudies(trains) {
        // Group trains by dosage form (same logic as train summary)
        const dosageGroups = {};
        trains.forEach(train => {
            // Extract dosage form from train data (same logic as machine coverage view)
            const dosageForm = train.productType || (train.products && train.products.length > 0 ? 
                train.products[0].productType : null) || 'Unknown';
            if (!dosageGroups[dosageForm]) {
                dosageGroups[dosageForm] = [];
            }
            dosageGroups[dosageForm].push(train);
        });
        
        const allStudies = [];
        
        console.log(`Report: Processing ${trains.length} trains for study selection`);
        
        // Process each dosage form group separately (same as train summary - reset study numbering per group)
        Object.keys(dosageGroups).forEach(dosageForm => {
            const trainsInGroup = dosageGroups[dosageForm];
            const allMachines = Array.from(new Set(trainsInGroup.flatMap(t => t.machines)));
            const covered = new Set();
            const sorted = [...trainsInGroup].sort((a, b) => b.worstCaseRPN - a.worstCaseRPN);
            let studyIndexInGroup = 0; // Reset study numbering for each dosage form group (same as train summary)
            
            console.log(`Report: Processing ${trainsInGroup.length} trains in dosage form: ${dosageForm}`);
            console.log(`Report: All machines in ${dosageForm}:`, allMachines);
            
            for (const t of sorted) {
                const newMs = t.machines.filter(m => !covered.has(m));
                console.log(`Report: Train ${t.trainId} (${dosageForm}) - RPN: ${t.worstCaseRPN}`);
                console.log(`Report: Train machines:`, t.machines);
                console.log(`Report: New machines:`, newMs);
                console.log(`Report: Currently covered:`, Array.from(covered));
                
                if (newMs.length > 0) {
                    studyIndexInGroup++; // Increment within this dosage form group
                    allStudies.push({ 
                        studyNumber: studyIndexInGroup, 
                        productName: t.worstCaseProduct, 
                        rpn: t.worstCaseRPN, 
                        machinesCovered: t.machines, 
                        newMachinesCovered: newMs, 
                        justification: 'Covers uncovered machines',
                        trainId: t.trainId,
                        dosageForm: dosageForm
                    });
                    console.log(`Report: Selected train ${t.trainId} for study ${studyIndexInGroup} in ${dosageForm}`);
                    newMs.forEach(m => covered.add(m));
                    console.log(`Report: Now covered ${covered.size}/${allMachines.length} machines in ${dosageForm}`);
                    if (covered.size === allMachines.length) {
                        console.log(`Report: All machines covered in ${dosageForm}, moving to next group`);
                        break;
                    }
                } else {
                    console.log(`Report: Skipped train ${t.trainId} - no new machines`);
                }
            }
        });
        
        console.log(`Report: Selected ${allStudies.length} studies from ${trains.length} trains`);
        return allStudies;
    }

    // HTML assembly (compact) - reusing structure from user-provided template
    generateHTMLReport(data) {
        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cleaning Validation Report - ${data.groupInfo.lineName}</title><style>${this.getReportCSS()}</style></head><body><div class="report-container">${this.generateReportHeader(data.groupInfo)}${this.generateExecutiveSummary(data.summary)}${this.generateGroupingStrategy(data.trains)}${this.generateWorstCaseSelection(data.selectedStudies)}${this.generateSpecialCaseProducts(data.groupInfo.line)}${this.generateExportButtons()}</div><script>${this.getReportJavaScript()}</script></body></html>`;
    }

    generateReportHeader(g) {
        return `<header class="report-header"><h1>Cleaning Validation Report</h1><h2>${g.lineName}</h2><div class="report-meta"><p><strong>Date:</strong> ${g.reportDate}</p><p><strong>Generated By:</strong> ${g.reviewer}</p></div></header>`;
    }

    generateExecutiveSummary(s) {
        const savedStudies = s.totalTrains - s.requiredStudies;
        const efficiencyNote = `${s.savingsPercentage}% <br><small style="color:#666;font-weight:normal;font-size:0.85em;">(Saved ${savedStudies} studies: ${s.totalTrains} trains reduced to ${s.requiredStudies} studies)</small>`;
        return `<section class="section"><h2>Executive Summary</h2><table class="summary-table"><tr><td><strong>Total Products</strong></td><td>${s.totalProducts}</td></tr><tr><td><strong>Total Trains</strong></td><td>${s.totalTrains}</td></tr><tr><td><strong>Total Machines</strong></td><td>${s.totalMachines}</td></tr><tr><td><strong>Required Studies</strong></td><td class="highlight">${s.requiredStudies}</td></tr><tr><td><strong>Efficiency Savings</strong></td><td class="success">${efficiencyNote}</td></tr><tr><td><strong>Lowest MACO</strong></td><td class="highlight">${formatSmallNumber(s.lowestMaco, 'mg')}</td></tr></table></section>`;
    }

    generateGroupingStrategy(trains) {
        const rows = trains.map(t => `<tr><td>${t.trainId}</td><td>${t.products.join(', ')}</td><td>${t.machines.join(', ')}</td><td class="highlight">${t.worstCaseProduct}</td><td>${t.worstCaseRPN}</td><td class="highlight">${formatSmallNumber(t.macoValue, 'mg')}</td></tr>`).join('');
        return `<section class="section"><h2>Grouping Strategy</h2><table class="data-table"><thead><tr><th>Train</th><th>Products</th><th>Machines</th><th>Worst Case</th><th>RPN</th><th>Product MACO</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }

    generateWorstCaseSelection(studies) {
        // Group studies by dosage form for better presentation (same as train summary grouping)
        const studiesByDosageForm = {};
        studies.forEach(s => {
            if (!studiesByDosageForm[s.dosageForm]) {
                studiesByDosageForm[s.dosageForm] = [];
            }
            studiesByDosageForm[s.dosageForm].push(s);
        });
        
        let tableContent = '';
        Object.keys(studiesByDosageForm).forEach(dosageForm => {
            const studiesInGroup = studiesByDosageForm[dosageForm];
            // Add dosage form group header
            tableContent += `<tr class="group-header"><td colspan="6"><strong>${dosageForm}</strong></td></tr>`;
            // Add studies in this group
            studiesInGroup.forEach(s => {
                tableContent += `<tr><td>Study ${s.studyNumber}</td><td class="highlight">${s.productName}</td><td>${s.rpn}</td><td>${s.machinesCovered.join(', ')}</td><td>${s.newMachinesCovered.join(', ')}</td><td>${s.justification}</td></tr>`;
            });
        });
        
        return `<section class="section"><h2>Selected Studies</h2><table class="data-table"><thead><tr><th>Study</th><th>Product</th><th>RPN</th><th>All Machines</th><th>New Machines</th><th>Justification</th></tr></thead><tbody>${tableContent}</tbody></table></section>`;
    }

    generateSpecialCaseProducts(line) {
        // Get special case products for this line (isCritical === true)
        const specialCaseProducts = [];
        
        const lineProducts = products.filter(product => 
            product.line === line && product.isCritical === true
        );
        
        lineProducts.forEach(product => {
            if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                // Find the ingredient with highest RPN for this product
                let highestRpnIngredient = null;
                let highestRpn = 0;
                
                product.activeIngredients.forEach(ingredient => {
                    try {
                        const scores = calculateScores(ingredient);
                        if (scores && scores.rpn > highestRpn) {
                            highestRpn = scores.rpn;
                            highestRpnIngredient = ingredient;
                        }
                    } catch (error) {
                        console.warn('Error calculating scores for ingredient:', ingredient, error);
                    }
                });
                
                if (highestRpnIngredient) {
                    // Get machines that manufacture this product
                    const productMachines = machines.filter(machine => 
                        product.machineIds && product.machineIds.includes(machine.id)
                    );
                    
                    specialCaseProducts.push({
                        name: product.name,
                        productCode: product.productCode,
                        ingredient: highestRpnIngredient.name,
                        dosageForm: product.productType,
                        rpn: highestRpn,
                        machines: productMachines.map(machine => machine.name),
                        reason: product.criticalReason || 'High Risk'
                    });
                }
            }
        });
        
        // Sort by RPN descending
        specialCaseProducts.sort((a, b) => b.rpn - a.rpn);
        
        if (specialCaseProducts.length === 0) {
            return `<section class="section">
                <h2 style="color: #16a34a;">Special Case Products</h2>
                <p style="padding: 20px; text-align: center; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; color: #0369a1;">
                    ✅ No special case products identified for this line.
                </p>
            </section>`;
        }
        
        let tableContent = '';
        specialCaseProducts.forEach(product => {
            const machinesList = product.machines.length > 0 ? product.machines.join(', ') : 'No machines assigned';
            tableContent += `
                <tr>
                    <td><strong>${product.productCode}</strong></td>
                    <td class="highlight">${product.name}</td>
                    <td>${product.dosageForm}</td>
                    <td>${product.ingredient}</td>
                    <td style="text-align: center; font-weight: bold; ${product.rpn >= 100 ? 'color: #dc2626; background: #fef2f2;' : 'color: #ea580c; background: #fff7ed;'}">${product.rpn}</td>
                    <td>${machinesList}</td>
                    <td style="color: #dc2626;">${product.reason}</td>
                </tr>
            `;
        });
        
        return `<section class="section">
            <h2 style="color: #dc2626;">⚠️ Special Case Products</h2>
            <p style="margin-bottom: 15px; padding: 12px; background: #fef2f2; border-left: 4px solid #dc2626; color: #7f1d1d; border-radius: 4px;">
                <strong>Note:</strong> These products require special attention due to high risk factors and have been designated as critical products.
            </p>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Product Code</th>
                        <th>Product Name</th>
                        <th>Dosage Form</th>
                        <th>Critical Ingredient</th>
                        <th>RPN</th>
                        <th>Machines</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableContent}
                </tbody>
            </table>
        </section>`;
    }

    generateExportButtons() { return `<div class="export-section no-print"><h3>Export Options</h3><div class="export-buttons"><button onclick="printCurrentView('lineReport')" class="btn-export btn-print">🖨️ Print</button><button onclick="exportToPDFDirect()" class="btn-export btn-pdf">📄 Export to PDF</button></div></div>`; }

    getReportCSS() {
        return `body{font-family:'Segoe UI',Tahoma,Verdana,sans-serif;background:#f8f9fa}.report-container{max-width:1100px;margin:0 auto;background:#fff;padding:32px;box-shadow:0 0 20px rgba(0,0,0,0.08)}.report-header{text-align:center;border-bottom:3px solid #1976d2;padding-bottom:18px;margin-bottom:28px}.report-header h1{color:#1976d2;margin:0 0 6px}.report-header h2{color:#666;margin:0 0 10px;font-weight:500}.report-meta{display:flex;gap:24px;justify-content:center;color:#666}.section{margin-bottom:28px}.section h2{color:#1976d2;border-bottom:2px solid #e0e0e0;padding-bottom:8px;margin-bottom:14px}.summary-table,.data-table{width:100%;border-collapse:collapse;background:#fff;margin-top:12px}.summary-table th,.summary-table td,.data-table th,.data-table td{border:1px solid #ddd;padding:10px;text-align:left}.summary-table th,.data-table th{background:#1976d2;color:#fff}.data-table tbody tr:nth-child(even){background:#f8f9fa}.data-table .group-header{background:#e3f2fd;color:#1976d2;font-weight:bold;border-top:2px solid #1976d2}.highlight{background:#fff3cd;font-weight:700}.success{background:#d4edda;color:#155724;font-weight:700}.export-section{margin-top:28px;text-align:center}.export-buttons{display:flex;gap:15px;justify-content:center;margin-top:15px}.btn-export{padding:10px 18px;border:none;border-radius:6px;color:#fff;font-weight:700;cursor:pointer;transition:all 0.3s ease}.btn-export:hover{transform:translateY(-2px);box-shadow:0 4px 8px rgba(0,0,0,0.2)}.btn-print{background:#6c757d}.btn-pdf{background:#dc3545}`;
    }

    getReportJavaScript() { 
        return `
        // Direct PDF export function without print dialog
        function exportToPDFDirect() {
            try {
                // Check if PDF libraries are available
                if (typeof html2pdf === 'undefined') {
                    console.error('html2pdf library not loaded');
                    alert('PDF export library not available. Please refresh the page and try again.');
                    return;
                }

                const element = document.body;
                const opt = {
                    margin: [0.5, 0.5, 0.5, 0.5],
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
                const originalText = button.innerHTML;
                button.innerHTML = '⏳ Generating PDF...';
                button.disabled = true;

                // Generate PDF directly
                html2pdf().set(opt).from(element).save().then(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    console.log('PDF generated successfully');
                }).catch((error) => {
                    console.error('PDF generation failed:', error);
                    button.innerHTML = originalText;
                    button.disabled = false;
                    alert('PDF generation failed: ' + error.message);
                });

            } catch (error) {
                console.error('Error in exportToPDFDirect:', error);
                alert('PDF export failed: ' + error.message);
            }
        }

        // Legacy function for backward compatibility
        function exportToPDF() {
            exportToPDFDirect();
        }
        
        // Add smooth scrolling for better UX
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
        `; 
    }

    openReportWindow(html) { 
        const w = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes'); 
        
        // Keep the original export button functionality
        const enhancedHtml = html;
        
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cleaning Validation Report</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 0; 
                        line-height: 1.4;
                    }
                    .report-header {
                        background: #f8f9fa;
                        padding: 15px 20px;
                        border-bottom: 2px solid #dee2e6;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .report-content {
                        padding: 20px;
                    }
                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s;
                    }
                    .btn-print {
                        background: #007bff;
                        color: white;
                    }
                    .btn-print:hover {
                        background: #0056b3;
                    }
                    .btn-export {
                        background: #dc2626;
                        color: white;
                    }
                    .btn-export:hover {
                        background: #b91c1c;
                    }
                    .data-table, .summary-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 10px 0;
                        page-break-inside: avoid;
                    }
                    .data-table td, .data-table th,
                    .summary-table td, .summary-table th {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                        vertical-align: top;
                        page-break-inside: avoid;
                        min-height: 30px;
                    }
                    .data-table th, .summary-table th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    @media print {
                        .report-header, .action-buttons, .export-section, .no-print {
                            display: none !important;
                        }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        margin: 0; 
                        padding: 0;
                        font-size: 12px;
                        background: white;
                    }
                    .report-container {
                        margin: 0;
                        padding: 0;
                    }
                        .data-table, .summary-table {
                            page-break-inside: avoid;
                            font-size: 11px;
                        }
                        .data-table td, .data-table th,
                        .summary-table td, .summary-table th {
                            padding: 6px;
                            border: 1px solid #000;
                        }
                        h1, h2, h3 {
                            page-break-after: avoid;
                        }
                        .report-content {
                            margin: 0;
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1 style="margin: 0 0 10px 0; color: #333;">Cleaning Validation Report</h1>
                    <div class="action-buttons">    
                        <button onclick="printCurrentView('lineReport')" class="btn btn-print">
                            🖨️ Print
                        </button>
                        <button onclick="printCurrentView('lineReport')" class="btn btn-export">
                            📄 Save as PDF
                        </button>
                    </div>
                </div>
                <div class="report-content">
                    ${enhancedHtml}
                </div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                <script>
                    // Auto-focus for easy printing
                    window.onload = function() {
                        // Optional: auto-print (uncomment if desired)
                        // setTimeout(() => window.print(), 1000);
                    };
                </script>
            </body>
            </html>
        `);
        w.document.close(); 
    }

    renderInlineReport(lineId, dosageForm = 'All') {
        try {
            this.reportData = this.collectReportData(lineId, dosageForm);
            const htmlReport = this.generateInlineHTMLReport(this.reportData);
            
            // Find the line report container and replace its content
            const container = document.getElementById('lineReportContainer');
            if (container) {
                container.innerHTML = htmlReport;
            } else {
                console.error('Line report container not found');
                alert('Error: Could not find the report container. Please try again.');
            }
            
            return true;
        } catch (e) {
            console.error('Error generating inline report:', e);
            alert('Error generating report. Please try again.');
            return false;
        }
    }

    generateInlineHTMLReport(data) {
        return `
        <div class="report-header">
              ${this.generateExportButtons()}
        </div>
            <div class="report-container" style="max-width: 100%; margin: 0; padding: 0; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                ${this.generateReportHeader(data.groupInfo)}
                ${this.generateExecutiveSummary(data.summary)}
                ${this.generateGroupingStrategy(data.trains)}
                ${this.generateWorstCaseSelection(data.selectedStudies)}
                ${this.generateSpecialCaseProducts(data.groupInfo.line)}
          
            </div>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { margin: 0; padding: 0; }
                .report-container { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; margin: 0; padding: 0; }
                .report-header { text-align: center; border-bottom: 3px solid #1976d2; padding-bottom: 18px; margin: 0; }
                .report-header h1 { color: #1976d2; margin: 0 0 6px; font-size: 2em; }
                .report-header h2 { color: #666; margin: 0 0 10px; font-weight: 500; font-size: 1.5em; }
                .report-meta { display: flex; gap: 24px; justify-content: center; color: #666; margin: 0; }
                .section { margin-bottom: 28px; }
                .section h2 { color: #1976d2; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 14px; font-size: 1.3em; }
                .summary-table, .data-table { width: 100%; border-collapse: collapse; background: #fff; margin-top: 12px; }
                .summary-table th, .summary-table td, .data-table th, .data-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                .summary-table th, .data-table th { background: #1976d2; color: #fff; font-weight: bold; }
                .data-table tbody tr:nth-child(even) { background: #f8f9fa; }
                .highlight { background: #fff3cd; font-weight: 700; }
                .success { background: #d4edda; color: #155724; font-weight: 700; }
                .export-section { margin-top: 28px; text-align: center; }
                .export-buttons { display: flex; gap: 15px; justify-content: center; margin-top: 15px; }
                .btn-export { padding: 10px 18px; border: none; border-radius: 6px; color: #fff; font-weight: 700; cursor: pointer; transition: all 0.3s ease; }
                .btn-export:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
                .btn-print { background: #6c757d; }
                .btn-pdf { background: #dc3545; }
                
                /* Hide navigation elements in print view */
                @media print {
                    .header, .main-nav, .sidebar, .export-section, .no-print {
                        display: none !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    .report-content {
                        margin: 0;
                        padding: 0;
                    }
                }
                
                /* Ensure content doesn't get cut off */
                .section {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 20px;
                }
                .data-table, .summary-table {
                    page-break-inside: auto;
                    break-inside: auto;
                    width: 100%;
                }
                .data-table tr, .summary-table tr {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                h1, h2, h3 {
                    page-break-after: avoid;
                    break-after: avoid;
                }
            </style>
        `;
    }
}

export function renderLineReport(line) {
    const generator = new CleaningValidationReportGenerator();
    generator.renderInlineReport(line, 'All');
}

// Export the class
export { CleaningValidationReportGenerator };

// Expose for debugging
window.renderLineReport = renderLineReport;



// Line Report View - generates a printable report per line using in-app data
import { getTrainData, getLargestEssaForLineAndDosageForm, getWorstCaseProductType } from './utils.js';
import { machines, safetyFactorConfig } from './state.js';

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

        // Build usedMachines (names) per train
        const trainDtos = trainsForLine.map(t => {
            const usedMachineNames = (t.machineIds || []).map(id => {
                const m = machines.find(x => x.id === id);
                return m ? m.name : null;
            }).filter(Boolean);

            // Worst case product and RPN proxy (max ingredient RPN equivalent used elsewhere)
            let worstProduct = '-';
            let worstRpn = 0;
            if (t.products) {
                t.products.forEach(p => {
                    (p.activeIngredients || []).forEach(ing => {
                        const rpn = this.calcRpn(ing);
                        if (rpn > worstRpn) { worstRpn = rpn; worstProduct = p.name; }
                    });
                });
            }

            // Calculate MACO for this train
            const macoValue = this.calculateMacoForTrain(t, allTrainData);

            return {
                trainId: `Train ${t.number || t.id}`,
                products: (t.products || []).map(p => p.name),
                machines: usedMachineNames,
                worstCaseProduct: worstProduct,
                worstCaseRPN: worstRpn,
                macoValue: macoValue,
                machineIds: t.machineIds || []
            };
        });

        // Select studies to cover machines (same logic as coverage view)
        const selectedStudies = this.selectStudies(trainDtos);

        const uniqueMachineIds = new Set();
        trainsForLine.forEach(t => (t.machineIds || []).forEach(id => uniqueMachineIds.add(id)));
        const machineNames = Array.from(uniqueMachineIds).map(id => {
            const m = machines.find(x => x.id === id); return m ? m.name : null;
        }).filter(Boolean);

        return {
            groupInfo: { lineName: lineId, dosageForm, reportDate: new Date().toLocaleDateString(), reviewer: 'System Generated' },
            summary: {
                totalProducts: trainDtos.reduce((acc, t) => acc + t.products.length, 0),
                totalTrains: trainDtos.length,
                totalMachines: machineNames.length,
                requiredStudies: selectedStudies.length,
                savingsPercentage: trainDtos.length > 0 ? Math.round(((trainDtos.length - selectedStudies.length) / trainDtos.length) * 100) : 0,
                lowestMaco: trainDtos.length > 0 ? Math.min(...trainDtos.map(t => t.macoValue)) : 0
            },
            trains: trainDtos,
            selectedStudies,
            macoCalculations: [],
            allProducts: Array.from(new Set(trainDtos.flatMap(t => t.products))),
            allMachines: machineNames
        };
    }

    calcRpn(ing) {
        const sol = ing.solubility === 'Freely soluble' ? 1 : ing.solubility === 'Soluble' ? 2 : ing.solubility === 'Slightly soluble' ? 3 : 4;
        const clean = ing.cleanability === 'Easy' ? 1 : ing.cleanability === 'Medium' ? 2 : 3;
        return sol * clean;
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
        const allMachines = Array.from(new Set(trains.flatMap(t => t.machines)));
        const covered = new Set();
        const sorted = [...trains].sort((a, b) => b.worstCaseRPN - a.worstCaseRPN);
        const studies = [];
        let idx = 1;
        for (const t of sorted) {
            const newMs = t.machines.filter(m => !covered.has(m));
            if (newMs.length > 0) {
                studies.push({ studyNumber: idx, productName: t.worstCaseProduct, rpn: t.worstCaseRPN, machinesCovered: t.machines, newMachinesCovered: newMs, justification: 'Covers uncovered machines' });
                newMs.forEach(m => covered.add(m));
                idx++;
                if (covered.size === allMachines.length) break;
            }
        }
        return studies;
    }

    // HTML assembly (compact) - reusing structure from user-provided template
    generateHTMLReport(data) {
        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cleaning Validation Report - ${data.groupInfo.lineName}</title><style>${this.getReportCSS()}</style></head><body><div class="report-container">${this.generateReportHeader(data.groupInfo)}${this.generateExecutiveSummary(data.summary)}${this.generateGroupingStrategy(data.trains)}${this.generateWorstCaseSelection(data.selectedStudies)}${this.generateExportButtons()}</div><script>${this.getReportJavaScript()}</script></body></html>`;
    }

    generateReportHeader(g) {
        return `<header class="report-header"><h1>Cleaning Validation Report</h1><h2>${g.lineName}</h2><div class="report-meta"><p><strong>Date:</strong> ${g.reportDate}</p><p><strong>Generated By:</strong> ${g.reviewer}</p></div></header>`;
    }

    generateExecutiveSummary(s) {
        return `<section class="section"><h2>Executive Summary</h2><table class="summary-table"><tr><td><strong>Total Products</strong></td><td>${s.totalProducts}</td></tr><tr><td><strong>Total Trains</strong></td><td>${s.totalTrains}</td></tr><tr><td><strong>Total Machines</strong></td><td>${s.totalMachines}</td></tr><tr><td><strong>Required Studies</strong></td><td class="highlight">${s.requiredStudies}</td></tr><tr><td><strong>Efficiency Savings</strong></td><td class="success">${s.savingsPercentage}%</td></tr><tr><td><strong>Lowest MACO</strong></td><td class="highlight">${s.lowestMaco.toFixed(2)} mg</td></tr></table></section>`;
    }

    generateGroupingStrategy(trains) {
        const rows = trains.map(t => `<tr><td>${t.trainId}</td><td>${t.products.join(', ')}</td><td>${t.machines.join(', ')}</td><td class="highlight">${t.worstCaseProduct}</td><td>${t.worstCaseRPN}</td><td class="highlight">${t.macoValue.toFixed(2)} mg</td></tr>`).join('');
        return `<section class="section"><h2>Grouping Strategy</h2><table class="data-table"><thead><tr><th>Train</th><th>Products</th><th>Machines</th><th>Worst Case</th><th>RPN</th><th>Product MACO</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }

    generateWorstCaseSelection(studies) {
        const rows = studies.map(s => `<tr><td>Study ${s.studyNumber}</td><td class="highlight">${s.productName}</td><td>${s.rpn}</td><td>${s.machinesCovered.join(', ')}</td><td>${s.newMachinesCovered.join(', ')}</td><td>${s.justification}</td></tr>`).join('');
        return `<section class="section"><h2>Selected Studies</h2><table class="data-table"><thead><tr><th>Study</th><th>Product</th><th>RPN</th><th>All Machines</th><th>New Machines</th><th>Justification</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }

    generateExportButtons() { return `<div class="export-section no-print"><h3>Export Options</h3><div class="export-buttons"><button onclick="window.print()" class="btn-export btn-print">🖨️ Print</button><button onclick="exportToPDFDirect()" class="btn-export btn-pdf">📄 Export to PDF</button></div></div>`; }

    getReportCSS() {
        return `body{font-family:'Segoe UI',Tahoma,Verdana,sans-serif;background:#f8f9fa}.report-container{max-width:1100px;margin:0 auto;background:#fff;padding:32px;box-shadow:0 0 20px rgba(0,0,0,0.08)}.report-header{text-align:center;border-bottom:3px solid #1976d2;padding-bottom:18px;margin-bottom:28px}.report-header h1{color:#1976d2;margin:0 0 6px}.report-header h2{color:#666;margin:0 0 10px;font-weight:500}.report-meta{display:flex;gap:24px;justify-content:center;color:#666}.section{margin-bottom:28px}.section h2{color:#1976d2;border-bottom:2px solid #e0e0e0;padding-bottom:8px;margin-bottom:14px}.summary-table,.data-table{width:100%;border-collapse:collapse;background:#fff;margin-top:12px}.summary-table th,.summary-table td,.data-table th,.data-table td{border:1px solid #ddd;padding:10px;text-align:left}.summary-table th,.data-table th{background:#1976d2;color:#fff}.data-table tbody tr:nth-child(even){background:#f8f9fa}.highlight{background:#fff3cd;font-weight:700}.success{background:#d4edda;color:#155724;font-weight:700}.export-section{margin-top:28px;text-align:center}.export-buttons{display:flex;gap:15px;justify-content:center;margin-top:15px}.btn-export{padding:10px 18px;border:none;border-radius:6px;color:#fff;font-weight:700;cursor:pointer;transition:all 0.3s ease}.btn-export:hover{transform:translateY(-2px);box-shadow:0 4px 8px rgba(0,0,0,0.2)}.btn-print{background:#6c757d}.btn-pdf{background:#dc3545}`;
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
                        <button onclick="window.print()" class="btn btn-print">
                            🖨️ Print
                        </button>
                        <button onclick="window.print()" class="btn btn-export">
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



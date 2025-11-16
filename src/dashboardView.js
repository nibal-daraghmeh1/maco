 // Renders the main dashboard with stats and charts
 // js/dashboardView.js
import { products, machines, macoChartInstance, setMacoChartInstance, getSafetyFactorForDosageForm } from './state.js';
import { getTrainData, getWorstCaseProductType, getLargestEssaForLineAndDosageForm, getTrainsGroupedByLine, calculateScores } from './utils.js'; // Assuming getTrainData is in utils
import * as utils from './utils.js';
import { renderRpnChart } from './worstCaseView.js'; // The RPN chart is on the worst-case tab but shown here too
import * as state from './state.js';
import { createHorizontalMachineCoverageTable } from './machineCoverageView.js';

// Central color management for consistent colors across all charts - Extended palette for more unique colors
const CHART_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
    '#FF9F40', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
    '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#AED6F1',
    '#E74C3C', '#3498DB', '#F39C12', '#27AE60', '#8E44AD',
    '#E67E22', '#1ABC9C', '#34495E', '#F1C40F', '#E91E63',
    '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B'
];

// Global cached color mapping to ensure consistency across all charts
let globalColorMapping = null;

// Create consistent color mapping for lines (cached)
function initializeColorMapping() {
    if (globalColorMapping) {
        return globalColorMapping;
    }
    
    const colorMapping = new Map();
    let colorIndex = 0;
    
    // Get all unique lines from train data
    const trainData = getTrainData();
    const lines = new Set();
    
    trainData.forEach(train => {
        const line = train.line || train.productLine || 'Unassigned';
        lines.add(line);
    });
    
    // Sort lines for consistent ordering, ensuring each gets a unique color
    const sortedLines = Array.from(lines).sort();
    
    console.log('Creating color mapping for lines:', sortedLines);
    
    // Assign colors to each line ensuring no duplicates
    sortedLines.forEach((line, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];
        colorMapping.set(line, color);
        console.log(`Line "${line}" -> Color ${color} (index: ${index})`);
        colorIndex++;
    });
    
    // Verify no duplicate colors were assigned
    const assignedColors = Array.from(colorMapping.values());
    const uniqueColors = [...new Set(assignedColors)];
    if (assignedColors.length !== uniqueColors.length) {
        console.warn('WARNING: Duplicate colors detected in mapping!');
        console.log('Assigned colors:', assignedColors);
        console.log('Unique colors:', uniqueColors);
    }
    
    globalColorMapping = colorMapping;
    return colorMapping;
}

// Get color for a specific line (all dosage forms in same line get same color)
function getColorForCombination(line, dosageForm) {
    const colorMapping = initializeColorMapping();
    const color = colorMapping.get(line) || CHART_COLORS[0];
    console.log(`Getting color for ${line} - ${dosageForm}: ${color} (using line color)`);
    return color;
}

// Reset color mapping (call when data changes)
export function resetColorMapping() {
    console.log('Resetting color mapping for consistency');
    globalColorMapping = null;
}

// Chart expand functionality
let expandedChartInstance = null;

export function expandChart(chartId, chartTitle) {
    const modal = document.getElementById('chartExpandModal');
    const modalTitle = document.getElementById('chartExpandModalTitle');
    const expandedCanvas = document.getElementById('expandedChart');
    
    // Set modal title
    modalTitle.textContent = chartTitle;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Destroy any existing expanded chart
    if (expandedChartInstance) {
        expandedChartInstance.destroy();
        expandedChartInstance = null;
    }
    
    // Recreate the chart in the modal with larger size
    setTimeout(() => {
        recreateChartInModal(chartId, expandedCanvas);
    }, 100);
}

export function closeChartExpandModal() {
    const modal = document.getElementById('chartExpandModal');
    
    // Destroy expanded chart
    if (expandedChartInstance) {
        expandedChartInstance.destroy();
        expandedChartInstance = null;
    }
    
    // Hide modal
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function recreateChartInModal(originalChartId, expandedCanvas) {
    const ctx = expandedCanvas.getContext('2d');
    
    // Map chart IDs to their recreation functions
    const chartRecreationMap = {
        'dosageFormPieChart': () => recreateTrainsDistributionChart(ctx),
        'studiesPieChart': () => recreateStudiesDistributionChart(ctx),
        'specialCasesPieChart': () => recreateSpecialCasesChart(ctx),
        'minMacosPieChart': () => recreateMinMacosChart(ctx),
        'trainsByLineAndDosageChart': () => recreateTrainsByLineChart(ctx),
        'highestRpnByTrainChart': () => recreateHighestRpnChart(ctx)
    };
    
    const recreationFunction = chartRecreationMap[originalChartId];
    if (recreationFunction) {
        expandedChartInstance = recreationFunction();
    } else {
        console.warn(`No recreation function found for chart: ${originalChartId}`);
    }
}

// Recreation functions for each chart type
function recreateTrainsDistributionChart(ctx) {
    // Initialize color mapping for consistency
    initializeColorMapping();
    
    // Use the same data source as the original chart
    const distribution = getTrainsDistributionByLineAndDosageForm();
    
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    const linesInLegend = new Set();

    // Process each line and dosage form combination with consistent colors
    Object.keys(distribution).forEach(line => {
        const lineData = distribution[line];
        if (!lineData || typeof lineData !== 'object') return;

        // Add each dosage form as a separate slice with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });

    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Trains Distribution',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        generateLabels: function(chart) {
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value} train${value !== 1 ? 's' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

function recreateStudiesDistributionChart(ctx) {
    initializeColorMapping();
    
    // Use the same data source as the original chart
    const studiesDistribution = getStudiesDistributionByLineAndDosageForm();

    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    const linesInLegend = new Set();

    // Process each line and dosage form combination with consistent colors
    Object.keys(studiesDistribution).forEach(line => {
        const lineData = studiesDistribution[line];
        if (!lineData || typeof lineData !== 'object') return;

        // Add each dosage form as a separate slice with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });

    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Studies Distribution',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        generateLabels: function(chart) {
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value} ${value === 1 ? 'study' : 'studies'}`;
                        }
                    }
                }
            }
        }
    });
}

function recreateSpecialCasesChart(ctx) {
    initializeColorMapping();
    
    // Use the same data source as the original chart
    const specialCasesDistribution = getSpecialCasesDistributionByLineAndDosageForm();

    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    const linesInLegend = new Set();

    Object.keys(specialCasesDistribution).forEach(line => {
        const lineData = specialCasesDistribution[line];
        if (!lineData || typeof lineData !== 'object') return;

        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });

    if (labels.length === 0) {
        // No special cases - show placeholder
        labels.push('No Special Cases');
        data.push(1);
        backgroundColors.push('#e5e7eb');
        borderColors.push('#fff');
    }

    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Special Cases Distribution',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        generateLabels: function(chart) {
                            if (labels[0] === 'No Special Cases') {
                                return [{
                                    text: 'No Special Cases',
                                    fillStyle: '#e5e7eb',
                                    strokeStyle: '#e5e7eb',
                                    pointStyle: 'circle',
                                    hidden: false
                                }];
                            }
                            
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value} special case${value !== 1 ? 's' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

function recreateMinMacosChart(ctx) {
    initializeColorMapping();
    
    // Use the same data source as the original chart
    const minMacosDistribution = getMinMacosDistributionByLineAndDosageForm();

    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    const linesInLegend = new Set();

    Object.keys(minMacosDistribution).forEach(line => {
        const lineData = minMacosDistribution[line];
        if (!lineData || typeof lineData !== 'object') return;

        Object.keys(lineData).forEach(dosageForm => {
            const value = lineData[dosageForm];
            
            // More lenient validation and add defaults if needed
            if (value && value > 0 && !isNaN(value) && isFinite(value)) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(value);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            } else if (dosageForm && line) {
                // Add small default value for missing data to ensure all dosage forms appear
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(0.001);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff');
                linesInLegend.add(line);
            }
        });
    });

    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Minimum MACO Distribution',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        generateLabels: function(chart) {
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value.toFixed(6)} mg/Swab`;
                        }
                    }
                }
            }
        }
    });
}

function recreateTrainsByLineChart(ctx) {
    initializeColorMapping();
    
    const trainData = getTrainData();
    if (trainData.length === 0) {
        return null;
    }
    
    // Use the same grouping logic as the original chart
    const groupedData = {};
    const allLines = new Set();
    const allDosageForms = new Set();
    
    trainData.forEach(train => {
        const line = train.line || 'Unassigned';
        const dosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
        
        allLines.add(line);
        dosageForms.forEach(dosageForm => {
            allDosageForms.add(dosageForm);
            
            if (!groupedData[line]) {
                groupedData[line] = {};
            }
            if (!groupedData[line][dosageForm]) {
                groupedData[line][dosageForm] = [];
            }
            
            // Calculate MACO per swab for this train (same logic as original)
            const worstCaseType = getWorstCaseProductType(train.products.map(p=>p.productType));
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
            const sf = sfConfig.max;
            const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
            
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            let macoNoel = Infinity;
            
            const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
            const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
            
            if (train.lowestPde !== null && !pdeHidden) {
                macoHealth = train.lowestPde * train.minBsMddRatio;
            }
            
            if (train.lowestLd50 !== null && !ld50Hidden) {
                const noel = (train.lowestLd50 * 70) / 2000;
                const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000));
                const minMdd = Math.min(...allMdds);
                macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
            }
            
            const macoVisual = 0.004 * lineLargestEssa;
            
            const allMacoValues = [
                { name: '0.1% Therapeutic Dose', value: macoDose },
                { name: '10 ppm Criterion', value: maco10ppm }
            ];
            
            if (train.lowestPde !== null && !pdeHidden) {
                allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
            }
            
            if (train.lowestLd50 !== null && !ld50Hidden) {
                allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
            }
            
            allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
            
            const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
            const finalMaco = finalMacoResult.value;
            const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
            const macoPerSwab = macoPerArea * train.assumedSsa;
            
            // Get proper train numbering
            const idMap = getTrainIdToLineNumberMap();
            const mapped = idMap.get(String(train.id));
            const trainNumber = mapped ? mapped.number : train.id;
            
            groupedData[line][dosageForm].push({
                trainId: train.id,
                trainName: `Train ${trainNumber}`,
                macoPerSwab: macoPerSwab
            });
        });
    });
    
    // Prepare data for Chart.js - Show individual trains with correct labels (exact same as original)
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Create a flat structure: [line-dosageForm-train] combinations (same as original)
    const flatTrainData = [];
    
    Array.from(allLines).sort().forEach(line => {
        const lineData = groupedData[line] || {};
        const dosageForms = Object.keys(lineData).sort();
        
        dosageForms.forEach(dosageForm => {
            const trains = lineData[dosageForm] || [];
            trains.forEach(train => {
                flatTrainData.push({
                    line: line,
                    dosageForm: dosageForm,
                    trainName: train.trainName,
                    macoPerSwab: train.macoPerSwab
                });
            });
        });
    });
    
    // Sort trains by line, then dosage form, then train number (same as original)
    flatTrainData.sort((a, b) => {
        if (a.line !== b.line) return a.line.localeCompare(b.line);
        if (a.dosageForm !== b.dosageForm) return a.dosageForm.localeCompare(b.dosageForm);
        return a.trainName.localeCompare(b.trainName);
    });
    
    // Create single dataset with all trains using consistent colors and sequential numbering (same as original)
    flatTrainData.forEach((item, index) => {
        // Sequential train numbering (1, 2, 3, 4, ...)
        const sequentialNumber = index + 1;
        
        // Short label for space efficiency: just "T1", "T2", etc.
        labels.push(`T${sequentialNumber}`);
        data.push(item.macoPerSwab);
        const color = getColorForCombination(item.line, item.dosageForm);
        backgroundColors.push(color);
        borderColors.push(color);
        
        // Store full info for tooltips
        item.sequentialNumber = sequentialNumber;
    });
    
    // Create datasets for legend (one per line with dosage forms) (same as original)
    const uniqueLines = [...new Set(flatTrainData.map(item => item.line))].sort();
    const datasets = uniqueLines.map(line => {
        // Find all dosage forms for this line
        const dosageFormsInLine = new Set();
        flatTrainData.forEach(item => {
            if (item.line === line) {
                dosageFormsInLine.add(item.dosageForm);
            }
        });
        
        const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
        const legendText = `${line}: ${dosageFormsList}`;
        
        return {
            label: legendText,
            data: [], // Empty data, just for legend
            backgroundColor: getColorForCombination(line, 'dummy'),
            borderColor: getColorForCombination(line, 'dummy'),
            borderWidth: 1
        };
    });
    
    // Add the main dataset with all data
    datasets.push({
        label: 'Trains',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
    });

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Trains by Line and Dosage Form',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        filter: function(legendItem) {
                            return legendItem.text !== 'Trains';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const trainData = flatTrainData[index];
                            if (trainData) {
                                return `${trainData.line} - ${trainData.dosageForm} - ${trainData.trainName}`;
                            }
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            return `MACO: ${value.toFixed(6)} mg/Swab`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Trains in Line and Group'
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'MACO per Swab (mg/Swab)'
                    },
                    type: 'logarithmic'
                }
            }
        }
    });
}

function recreateHighestRpnChart(ctx) {
    initializeColorMapping();
    
    const trainData = getTrainData();
    if (trainData.length === 0) {
        return null;
    }
    
    // Calculate highest RPN for each train (same logic as original)
    const trainRpnData = [];
    
    trainData.forEach(train => {
        let highestRpn = 0;
        let highestRpnProduct = null;
        let highestRpnIngredient = null;
        
        // Find the highest RPN across all products in this train
        train.products.forEach(product => {
            if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                product.activeIngredients.forEach(ingredient => {
                    try {
                        const scores = calculateScores(ingredient);
                        const rpn = scores?.rpn || 0;
                        if (rpn && rpn > highestRpn) {
                            highestRpn = rpn;
                            highestRpnProduct = product.name;
                            highestRpnIngredient = ingredient.name;
                        }
                    } catch (error) {
                        console.warn('Error calculating RPN for ingredient:', ingredient, error);
                    }
                });
            }
        });
        
        if (highestRpn > 0) {
            // Get proper train numbering
            const idMap = getTrainIdToLineNumberMap();
            const mapped = idMap.get(String(train.id));
            const trainNumber = mapped ? mapped.number : train.id;
            
            trainRpnData.push({
                line: train.line || 'Unassigned',
                dosageForm: train.products.length > 0 ? train.products[0].productType || 'Other' : 'Other',
                trainName: `Train ${trainNumber}`,
                highestRpn: highestRpn,
                productName: highestRpnProduct,
                ingredientName: highestRpnIngredient
            });
        }
    });

    // Sort by line, then dosage form, then train number (same as original)
    trainRpnData.sort((a, b) => {
        if (a.line !== b.line) return a.line.localeCompare(b.line);
        if (a.dosageForm !== b.dosageForm) return a.dosageForm.localeCompare(b.dosageForm);
        return a.trainName.localeCompare(b.trainName);
    });
    
    // Prepare chart data (same as original)
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Create labels and data with consistent colors and sequential numbering (same as original)
    trainRpnData.forEach((item, index) => {
        // Sequential train numbering (1, 2, 3, 4, ...)
        const sequentialNumber = index + 1;
        
        // Short label for space efficiency: just "T1", "T2", etc.
        labels.push(`T${sequentialNumber}`);
        data.push(item.highestRpn);
        const color = getColorForCombination(item.line, item.dosageForm);
        backgroundColors.push(color);
        borderColors.push(color);
        
        // Store full info for tooltips
        item.sequentialNumber = sequentialNumber;
    });
    
    // Create datasets for legend (one per line with dosage forms) (same as original)
    const uniqueLines = [...new Set(trainRpnData.map(item => item.line))].sort();
    const datasets = uniqueLines.map(line => {
        // Find all dosage forms for this line
        const dosageFormsInLine = new Set();
        trainRpnData.forEach(item => {
            if (item.line === line) {
                dosageFormsInLine.add(item.dosageForm);
            }
        });
        
        const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
        const legendText = `${line}: ${dosageFormsList}`;
        
        return {
            label: legendText,
            data: [], // Empty data, just for legend
            backgroundColor: getColorForCombination(line, 'dummy'),
            borderColor: getColorForCombination(line, 'dummy'),
            borderWidth: 1
        };
    });
    
    // Add the main dataset with all data
    datasets.push({
        label: 'Trains',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
    });

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Highest RPN by Train',
                    font: { size: 18, weight: 'bold' },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        filter: function(legendItem) {
                            return legendItem.text !== 'Trains';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const trainData = trainRpnData[index];
                            if (trainData) {
                                return `${trainData.line} - ${trainData.dosageForm} - ${trainData.trainName}`;
                            }
                            return context[0].label;
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = trainRpnData[index];
                            if (item) {
                                return `RPN: ${item.highestRpn} (${item.productName})`;
                            }
                            return `RPN: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Trains in Line and Group'
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Highest RPN Value'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Calculate the total number of studies required using the machine coverage algorithm
 */
function calculateTotalRequiredStudies() {
    // Use the same logic as the train summary view
    const linesWithTrains = getTrainsGroupedByLine();
    let totalStudies = 0;
    
    linesWithTrains.forEach(lineObj => {
        const line = lineObj.line;
        const trains = lineObj.trains;
        
        // Group trains by dosage form within this line
        const groupedTrains = {};
        
        trains.forEach(train => {
            if (train.products && train.products.length > 0) {
                const dosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
                dosageForms.forEach(dosageForm => {
                    const groupKey = `${line}-${dosageForm}`;
                    if (!groupedTrains[groupKey]) {
                        groupedTrains[groupKey] = {
                            line,
                            dosageForm,
                            trains: []
                        };
                    }
                    groupedTrains[groupKey].trains.push(train);
                });
            }
        });
        
        // Calculate studies for each group
        Object.values(groupedTrains).forEach(group => {
            const trainsInGroup = group.trains;
            
            // Calculate RPN for each train and sort by RPN (highest first)
            const trainsWithRPN = trainsInGroup.map(train => {
                let highestRPN = 0;
                if (train.products && train.products.length > 0) {
                    train.products.forEach(product => {
                        if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                            product.activeIngredients.forEach(ingredient => {
                                try {
                                    const rpn = utils.calculateScores(ingredient).rpn;
                                    if (rpn && rpn > highestRPN) {
                                        highestRPN = rpn;
                                    }
                                } catch (error) {
                                    console.warn('Error calculating RPN for ingredient:', ingredient, error);
                                }
                            });
                        }
                    });
                }
                return { train, rpn: highestRPN };
            }).sort((a, b) => b.rpn - a.rpn);
            
            // Calculate studies needed based on machine coverage
            const coveredMachines = new Set();
            let studiesNeeded = 0;
            
            trainsWithRPN.forEach(({ train }) => {
                if (train.machineIds && train.machineIds.length > 0) {
                    const hasNewMachines = train.machineIds.some(id => !coveredMachines.has(id));
                    if (hasNewMachines) {
                        studiesNeeded++;
                        train.machineIds.forEach(id => coveredMachines.add(id));
                    }
                }
            });
            
            totalStudies += studiesNeeded;
        });
    });
    
    return totalStudies;
}

export function renderMainDashboard() {
    // Reset color mapping to ensure consistency when data changes
    resetColorMapping();
    
    const statsContainer = document.getElementById('dashboardStats');
    statsContainer.innerHTML = '';
    const trainData = getTrainData();
            
            let lowestMacoTrain = { id: 'N/A', finalMaco: Infinity };
            let largestEssaTrain = { id: 'N/A', essa: 0 };
            if (trainData.length > 0) {
                 const finalTrainData = trainData.map(train => {
                    const worstCaseType = getWorstCaseProductType(train.products.map(p=>p.productType));
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
                    const sf = sfConfig.max;
                    
                    // Calculate line-specific largest ESSA for this train
                    const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
                    
                    const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
                    const maco10ppm = 10 * train.minMbsKg;
                    let macoHealth = Infinity;
                    if (train.lowestPde !== null) {
                        macoHealth = train.lowestPde * train.minBsMddRatio;
                    }
                    const macoVisual = (0.004) * lineLargestEssa;
                    return {...train, finalMaco: Math.min(macoDose, maco10ppm, macoHealth, macoVisual) };
                 });

                 lowestMacoTrain = finalTrainData.reduce((min, t) => t.finalMaco < min.finalMaco ? t : min);
                 largestEssaTrain = finalTrainData.reduce((max, t) => t.essa > max.essa ? t : max);
            }

            // Build mapping for friendly labels
            const idMap = utils.getTrainIdToLineNumberMap();

            const friendlyLowest = (lowestMacoTrain && lowestMacoTrain.id !== 'N/A')
                ? (idMap.get(String(lowestMacoTrain.id)) ? `${idMap.get(String(lowestMacoTrain.id)).line} — Train ${idMap.get(String(lowestMacoTrain.id)).number}` : `Train ${lowestMacoTrain.id}`)
                : 'N/A';

            const friendlyLargest = (largestEssaTrain && largestEssaTrain.id !== 'N/A')
                ? (idMap.get(String(largestEssaTrain.id)) ? `${idMap.get(String(largestEssaTrain.id)).line} — Train ${idMap.get(String(largestEssaTrain.id)).number}` : `Train ${largestEssaTrain.id}`)
                : 'N/A';

            // Calculate additional KPIs
            const totalRequiredStudies = calculateTotalRequiredStudies();
            const highestRpnProduct = getHighestRpnProduct();

            const stats = [
                { label: 'Total Required Studies', value: totalRequiredStudies, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-clipboard-check" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>' },
                { label: 'Total Products', value: products.length, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-box-seam" viewBox="0 0 16 16"><path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.405 1.372L8 2.267l3.75 2.605 2.405-1.372L8.186 1.113zM3.75 4.81L8 7.76l4.25-2.95L8 1.815 3.75 4.81z"/><path d="M1 4.53v7.94l6.5 3.53 6.5-3.53V4.53L8 8.06 1 4.53zm7.5 3.56l-3.5-2-3.5 2v7.19l3.5 2 3.5-2v-7.19zm3.5 2l-3.5 2v7.19l3.5-2 3.5 2v-7.19l-3.5-2z"/></svg>' },
                { label: 'Total Trains', value: trainData.length, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-diagram-3" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5v-1zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1zM3 11.5A1.5 1.5 0 0 1 4.5 10h1A1.5 1.5 0 0 1 7 11.5v1A1.5 1.5 0 0 1 5.5 14h-1A1.5 1.5 0 0 1 3 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5A1.5 1.5 0 0 1 10.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 9 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"/></svg>' },
            ];

            stats.forEach(stat => {
                const card = document.createElement('div');
                card.className = 'card p-4 flex items-center';
               
                card.innerHTML = `
                    <div class="p-3 rounded-full mr-4 text-white" style="background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end))">
                        ${stat.icon}
                    </div>
                    <div>
                        <p class="text-2xl font-bold">${stat.value}</p>
                        <p class="text-sm -mt-1" style="color: var(--text-secondary);">${stat.label}</p>
                        ${stat.subValue ? `<p class="text-xs font-semibold mt-1" style="color: var(--text-primary);">${stat.subValue}</p>` : ''}
                    </div>
                `;
                statsContainer.appendChild(card);
            });

            renderTrainsDistributionPieChart();
            renderStudiesDistributionPieChart();
            renderSpecialCasesDistributionPieChart();
            renderMinMacosDistributionPieChart();
            renderTrainsByLineAndDosageChart(); // New grouped bar chart
            renderHighestRpnByTrainChart(); // New RPN chart
            renderTopRpnProductsChart();
            renderMachineCoverageTable();
}

// Helper functions for new KPIs
function getHighestRpnProduct() {
    let highestRpn = 0;
    let highestProduct = { name: 'N/A', rpn: 0 };
    
    products.forEach(product => {
        if (product.activeIngredients && product.activeIngredients.length > 0) {
            product.activeIngredients.forEach(ingredient => {
                const scores = calculateScores(ingredient);
                const rpn = scores?.rpn || 0;
                if (rpn > highestRpn) {
                    highestRpn = rpn;
                    highestProduct = { name: product.name, rpn: rpn };
                }
            });
        }
    });
    
    return highestProduct;
}

function getTrainsDistributionByLineAndDosageForm() {
    // Build distribution by grouping products into trains
    const distribution = {};
    
    // Group products by line first
    const productsByLine = {};
    products.forEach(product => {
        if (product.machineIds && product.machineIds.length > 0) {
            const line = product.line || 'Unassigned';
            if (!productsByLine[line]) {
                productsByLine[line] = [];
            }
            productsByLine[line].push(product);
        }
    });
    
    // For each line, group products by dosage form and then by machine path (train)
    Object.keys(productsByLine).forEach(line => {
        const lineProducts = productsByLine[line];
        const dosageGroups = {};
        
        // Group by dosage form
        lineProducts.forEach(product => {
            const dosageForm = product.productType || 'Other';
            if (!dosageGroups[dosageForm]) {
                dosageGroups[dosageForm] = [];
            }
            dosageGroups[dosageForm].push(product);
        });
        
        // For each dosage form, group by machine path to identify trains
        Object.keys(dosageGroups).forEach(dosageForm => {
            const dosageProducts = dosageGroups[dosageForm];
            const trainGroups = {};
            
            // Group products by their machine path (sorted machine IDs)
            dosageProducts.forEach(product => {
                const machinePath = JSON.stringify(product.machineIds.sort((a, b) => a - b));
                if (!trainGroups[machinePath]) {
                    trainGroups[machinePath] = [];
                }
                trainGroups[machinePath].push(product);
            });
            
            // Count the number of trains (unique machine paths) for this dosage form
            const trainCount = Object.keys(trainGroups).length;
            
            if (!distribution[line]) {
                distribution[line] = {};
            }
            distribution[line][dosageForm] = trainCount;
        });
    });
    
    console.log('Train-based distribution:', distribution);
    return distribution;
}

function getStudiesDistributionByLineAndDosageForm() {
    // Build distribution by calculating actual studies needed
    const distribution = {};
    
    // Get all trains grouped by line
    const linesWithTrains = getTrainsGroupedByLine();
    
    linesWithTrains.forEach(lineObj => {
        const line = lineObj.line;
        const trains = lineObj.trains;
        
        if (!distribution[line]) {
            distribution[line] = {};
        }
        
        // Group trains by dosage form
        const dosageGroups = {};
        trains.forEach(train => {
            if (train.products && train.products.length > 0) {
                const dosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
                dosageForms.forEach(dosageForm => {
                    if (!dosageGroups[dosageForm]) {
                        dosageGroups[dosageForm] = [];
                    }
                    dosageGroups[dosageForm].push(train);
                });
            }
        });
        
        // Calculate studies for each dosage form
        Object.keys(dosageGroups).forEach(dosageForm => {
            const trainsInDosageForm = dosageGroups[dosageForm];
            
            // Calculate RPN for each train and sort by RPN (highest first)
            const trainsWithRPN = trainsInDosageForm.map(train => {
                let highestRPN = 0;
                if (train.products && train.products.length > 0) {
                    train.products.forEach(product => {
                        if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                            product.activeIngredients.forEach(ingredient => {
                                try {
                                    const scores = calculateScores(ingredient);
                const rpn = scores?.rpn || 0;
                                    if (rpn && rpn > highestRPN) {
                                        highestRPN = rpn;
                                    }
                                } catch (error) {
                                    console.warn('Error calculating RPN for ingredient:', ingredient, error);
                                }
                            });
                        }
                    });
                }
                return { train, rpn: highestRPN };
            }).sort((a, b) => b.rpn - a.rpn); // Sort by RPN descending
            
            // Calculate studies needed based on machine coverage
            const coveredMachines = new Set();
            let studiesNeeded = 0;
            
            trainsWithRPN.forEach(({ train }) => {
                if (train.machineIds && train.machineIds.length > 0) {
                    const hasNewMachines = train.machineIds.some(id => !coveredMachines.has(id));
                    if (hasNewMachines) {
                        studiesNeeded++;
                        train.machineIds.forEach(id => coveredMachines.add(id));
                    }
                }
            });
            
            if (studiesNeeded > 0) {
                distribution[line][dosageForm] = studiesNeeded;
            }
        });
    });
    
    console.log('Studies distribution:', distribution);
    return distribution;
}

function getSpecialCasesDistributionByLineAndDosageForm() {
    // Build distribution by counting special case products
    const distribution = {};
    const productNames = {}; // Store product names for tooltips
    
    // Group products by line first
    const productsByLine = {};
    products.forEach(product => {
        // Check if product is a special case (isCritical: true)
        if (product.isCritical === true) {
            const line = product.line || 'Unassigned';
            if (!productsByLine[line]) {
                productsByLine[line] = [];
            }
            productsByLine[line].push(product);
        }
    });
    
    // For each line, group special case products by dosage form
    Object.keys(productsByLine).forEach(line => {
        const lineProducts = productsByLine[line];
        const dosageGroups = {};
        
        // Group by dosage form
        lineProducts.forEach(product => {
            const dosageForm = product.productType || 'Other';
            if (!dosageGroups[dosageForm]) {
                dosageGroups[dosageForm] = [];
            }
            dosageGroups[dosageForm].push(product);
        });
        
        // Count special case products for each dosage form
        Object.keys(dosageGroups).forEach(dosageForm => {
            const count = dosageGroups[dosageForm].length;
            if (count > 0) {
                if (!distribution[line]) {
                    distribution[line] = {};
                }
                distribution[line][dosageForm] = count;
                
                // Store product names for this line-dosage form combination
                const key = `${line}-${dosageForm}`;
                productNames[key] = dosageGroups[dosageForm].map(p => p.name);
            }
        });
    });
    
    console.log('Special cases distribution:', distribution);
    console.log('Special cases product names:', productNames);
    
    // Store product names globally for tooltip access
    window.specialCasesProductNames = productNames;
    
    return distribution;
}

function getMinMacosDistributionByLineAndDosageForm() {
    // Build distribution by finding minimum MACO for each dosage form in each line
    const distribution = {};
    const macoValues = {}; // Store MACO values for tooltips
    
    // Get all trains grouped by line
    const linesWithTrains = getTrainsGroupedByLine();
    console.log('Lines with trains:', linesWithTrains);
    
    // Use real data from existing train calculations
    console.log('Using real MACO data for minimum MACO chart');
    
    // Get all trains with their calculated MACO values
    const trainData = getTrainData();
    console.log('Train data for MACO calculation:', trainData);
    
    if (!trainData || trainData.length === 0) {
        console.log('No train data available, using mock data');
        distribution['Solids'] = {
            'Tablets': 0.000123,
            'Capsules': 0.000456
        };
        distribution['Liquids'] = {
            'Syrups': 0.000789,
            'Solutions': 0.000321
        };
        distribution['Semisolid'] = {
            'Creams': 0.000654,
            'Ointments': 0.000987
        };
        
        // Store mock MACO values
        Object.keys(distribution).forEach(line => {
            Object.keys(distribution[line]).forEach(dosageForm => {
                const key = `${line}-${dosageForm}`;
                macoValues[key] = distribution[line][dosageForm];
            });
        });
        
        window.minMacosValues = macoValues;
        console.log('Mock distribution:', distribution);
        return distribution;
    }
    
    // Group trains by line and dosage form
    const lineGroups = {};
    
    console.log('Processing train data for MACO distribution:', trainData.length, 'trains');
    
    trainData.forEach(train => {
        const line = train.line || train.productLine || 'Unassigned';
        const dosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
        
        console.log(`Train ${train.id}: Line = ${line}, Dosage Forms = [${dosageForms.join(', ')}]`);
        
        if (!lineGroups[line]) {
            lineGroups[line] = {};
        }
        
        dosageForms.forEach(dosageForm => {
            if (!lineGroups[line][dosageForm]) {
                lineGroups[line][dosageForm] = [];
            }
            lineGroups[line][dosageForm].push(train);
            console.log(`Added train ${train.id} to ${line} - ${dosageForm} group`);
        });
    });
    
    console.log('Final line groups structure:', lineGroups);
    
    // Log summary
    Object.keys(lineGroups).forEach(line => {
        Object.keys(lineGroups[line]).forEach(dosageForm => {
            const trainCount = lineGroups[line][dosageForm].length;
            console.log(`${line} - ${dosageForm}: ${trainCount} trains`);
        });
    });
    
    // Calculate minimum MACO for each line-dosage form combination
    Object.keys(lineGroups).forEach(line => {
        const lineData = lineGroups[line];
        
        if (!distribution[line]) {
            distribution[line] = {};
        }
        
        Object.keys(lineData).forEach(dosageForm => {
            const trainsInGroup = lineData[dosageForm];
            
            // Calculate MACO for each train in this group using the same logic as Product MACO view
            const trainMacos = trainsInGroup.map(train => {
                try {
                    console.log(`Calculating MACO for train ${train.id} in ${line} - ${dosageForm}:`, train);
                    
                    const worstCaseType = getWorstCaseProductType(train.products.map(p=>p.productType));
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
                    const sf = sfConfig.max;
                    
                    console.log(`Safety factor config for ${dosageForm}:`, sfConfig);
                    
                    // Calculate line-specific largest ESSA for this train
                    const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
                    
                    // Check essential train data
                    if (!train.lowestLtd || train.lowestLtd <= 0) {
                        console.warn(`Train ${train.id}: Invalid lowestLtd (${train.lowestLtd}), using default`);
                        train.lowestLtd = 100; // Default therapeutic dose in mg
                    }
                    
                    if (!train.minBsMddRatio || train.minBsMddRatio <= 0) {
                        console.warn(`Train ${train.id}: Invalid minBsMddRatio (${train.minBsMddRatio}), using default`);
                        train.minBsMddRatio = 1000; // Default ratio
                    }
                    
                    if (!train.minMbsKg || train.minMbsKg <= 0) {
                        console.warn(`Train ${train.id}: Invalid minMbsKg (${train.minMbsKg}), using default`);
                        train.minMbsKg = 100; // Default batch size in kg
                    }
                    
                    if (!train.assumedSsa || train.assumedSsa <= 0) {
                        console.warn(`Train ${train.id}: Invalid assumedSsa (${train.assumedSsa}), using default`);
                        train.assumedSsa = 25; // Default SSA
                    }
                    
                    // Use the same MACO calculation logic as Product MACO view
                    const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
                    const maco10ppm = 10 * train.minMbsKg;
                    let macoHealth = Infinity;
                    let macoNoel = Infinity;
                    
                    // Check toxicity data visibility preferences
                    const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
                    const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
                    
                    // Calculate PDE-based MACO if PDE is available and not hidden
                    if (train.lowestPde !== null && train.lowestPde > 0 && !pdeHidden) {
                        macoHealth = train.lowestPde * train.minBsMddRatio;
                        console.log(`Train ${train.id}: PDE-based MACO = ${macoHealth}`);
                    }
                    
                    // Calculate NOEL-based MACO if LD50 is available and not hidden
                    if (train.lowestLd50 !== null && train.lowestLd50 > 0 && !ld50Hidden) {
                        // NOEL = (LD50 g/kg × 70 kg) ÷ 2000
                        const noel = (train.lowestLd50 * 70) / 2000; // NOEL in g
                        // Find minimum MDD from all ingredients in the train
                        const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000)); // Convert mg to g
                        const minMdd = Math.min(...allMdds.filter(mdd => mdd > 0));
                        if (minMdd > 0 && isFinite(minMdd)) {
                            // MACO = (NOEL g × min batch size g × 1000) ÷ (safety factor × MDD g)
                            macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
                            console.log(`Train ${train.id}: NOEL-based MACO = ${macoNoel}`);
                        }
                    }
                    
                    const macoVisual = 0.004 * lineLargestEssa;
                    
                    // Build MACO values array conditionally based on toxicity data visibility
                    const allMacoValues = [
                        { name: '0.1% Therapeutic Dose', value: macoDose },
                        { name: '10 ppm Criterion', value: maco10ppm }
                    ];
                    
                    // Add PDE equation only if PDE is available and not hidden
                    if (train.lowestPde !== null && train.lowestPde > 0 && !pdeHidden) {
                        allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
                    }
                    
                    // Add NOEL equation only if LD50 is available and not hidden
                    if (train.lowestLd50 !== null && train.lowestLd50 > 0 && !ld50Hidden) {
                        allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
                    }
                    
                    // Always add visual clean limit
                    allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
                    
                    // Filter out invalid values before finding minimum
                    const validMacoValues = allMacoValues.filter(m => 
                        m.value > 0 && isFinite(m.value) && !isNaN(m.value)
                    );
                    
                    if (validMacoValues.length === 0) {
                        console.error(`Train ${train.id}: No valid MACO values found`);
                        return { train, maco: 0.001 }; // Default small value
                    }
                    
                    // Find the minimum MACO (same logic as Product MACO view)
                    const finalMacoResult = validMacoValues.reduce((min, current) => current.value < min.value ? current : min);
                    const finalMaco = finalMacoResult.value;
                    
                    // Calculate MACO per swab (same as Product MACO view)
                    const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : finalMaco / 10000; // Default area if missing
                    const macoPerSwab = macoPerArea * train.assumedSsa;
                    
                    console.log(`Train ${train.id} final MACO calculation:`, {
                        macoDose, maco10ppm, macoHealth, macoNoel, macoVisual, 
                        finalMaco, macoPerArea, macoPerSwab, 
                        selectedLimit: finalMacoResult.name,
                        lineLargestEssa, assumedSsa: train.assumedSsa
                    });
                    
                    // Ensure we return a valid positive number
                    const resultMaco = (macoPerSwab > 0 && isFinite(macoPerSwab) && !isNaN(macoPerSwab)) 
                        ? macoPerSwab 
                        : 0.001; // Default small value
                    
                    console.log(`Train ${train.id} result MACO: ${resultMaco}`);
                    
                    return { train, maco: resultMaco };
                } catch (error) {
                    console.error(`Error calculating MACO for train ${train.id}:`, error);
                    return { train, maco: 0.001 }; // Default small value instead of 0
                }
            });
            
            // Find minimum MACO
            if (trainMacos.length > 0) {
                const minMacoData = trainMacos.reduce((min, current) => 
                    current.maco < min.maco ? current : min
                );
                
                console.log(`Minimum MACO for ${line} - ${dosageForm}:`, minMacoData.maco);
                distribution[line][dosageForm] = minMacoData.maco;
                
                // Store MACO value for tooltip
                const key = `${line}-${dosageForm}`;
                macoValues[key] = minMacoData.maco;
            }
        });
    });
    
    console.log('Real MACO distribution:', distribution);
    console.log('MACO values for tooltips:', macoValues);
    
    // Store MACO values globally for tooltip access
    window.minMacosValues = macoValues;
    
    return distribution;
}


function renderTrainsDistributionPieChart() {
    const canvas = document.getElementById('dosageFormPieChart');
    if (!canvas) return;
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    const distribution = getTrainsDistributionByLineAndDosageForm();
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.dosageFormChart) {
        window.dosageFormChart.destroy();
    }
    
    // Prepare data for simple pie chart
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Keep separate slices but prepare for grouped legend
    const linesInLegend = new Set();
    
    // Process each line and dosage form combination with consistent colors
    Object.keys(distribution).forEach(line => {
        const lineData = distribution[line];
        if (!lineData || typeof lineData !== 'object') return;
        
        // Add each dosage form as a separate slice with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count);
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });
    
    // Check if we have any data to display
    if (labels.length === 0 || data.length === 0) {
        console.log('No train data available for pie chart');
        return;
    }
    
    window.dosageFormChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                    text: 'Trains Distribution by Line and Dosage Form',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            // Create grouped legend showing line names with their dosage forms
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                // Find all dosage forms for this line
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value} train${value !== 1 ? 's' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

function renderStudiesDistributionPieChart() {
    const canvas = document.getElementById('studiesPieChart');
    if (!canvas) return;
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    const studiesDistribution = getStudiesDistributionByLineAndDosageForm();
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.studiesChart) {
        window.studiesChart.destroy();
    }
    
    // Prepare data for studies pie chart
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Keep separate slices but prepare for grouped legend
    const linesInLegend = new Set();
    
    // Process each line and dosage form combination with consistent colors
    Object.keys(studiesDistribution).forEach(line => {
        const lineData = studiesDistribution[line];
        if (!lineData || typeof lineData !== 'object') return;
        
        // Add each dosage form as a separate slice with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count); // Actual number of studies needed
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });
    
    // Check if we have any data to display
    if (labels.length === 0 || data.length === 0) {
        console.log('No studies data available for pie chart');
        return;
    }
    
    window.studiesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                    text: 'Studies Distribution by Line and Dosage Form',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            // Create grouped legend showing line names with their dosage forms
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                // Find all dosage forms for this line
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',  
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            return `${label}: ${value} ${value === 1 ? 'study' : 'studies'}`;
                        }
                    }
                }
            }
        }
    });
}

function renderSpecialCasesDistributionPieChart() {
    const canvas = document.getElementById('specialCasesPieChart');
    if (!canvas) return;
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    const specialCasesDistribution = getSpecialCasesDistributionByLineAndDosageForm();
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.specialCasesChart) {
        window.specialCasesChart.destroy();
    }
    
    // Prepare data for special cases pie chart
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Keep separate slices but prepare for grouped legend
    const linesInLegend = new Set();
    
    // Process each line and dosage form combination with consistent colors
    Object.keys(specialCasesDistribution).forEach(line => {
        const lineData = specialCasesDistribution[line];
        if (!lineData || typeof lineData !== 'object') return;
        
        // Add each dosage form as a separate slice with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const count = lineData[dosageForm];
            if (count && count > 0) {
                const label = `${line} - ${dosageForm}`;
                labels.push(label);
                data.push(count); // Number of special case products
                backgroundColors.push(getColorForCombination(line, dosageForm));
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
            }
        });
    });
    
    // Check if we have any data to display
    if (labels.length === 0 || data.length === 0) {
        console.log('No special cases data available for pie chart');
        return;
    }
    
    window.specialCasesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: borderColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                    text: 'Special Cases Distribution by Line and Dosage Form',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        },
                        generateLabels: function(chart) {
                            // Create grouped legend showing line names with their dosage forms
                            const uniqueLines = Array.from(linesInLegend).sort();
                            return uniqueLines.map(line => {
                                // Find all dosage forms for this line
                                const dosageFormsInLine = new Set();
                                labels.forEach((label, index) => {
                                    if (label.startsWith(line + ' - ')) {
                                        const dosageForm = label.replace(line + ' - ', '');
                                        dosageFormsInLine.add(dosageForm);
                                    }
                                });
                                
                                const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                const legendText = `${line}: ${dosageFormsList}`;
                                
                                return {
                                    text: legendText,
                                    fillStyle: getColorForCombination(line, 'dummy'),
                                    strokeStyle: getColorForCombination(line, 'dummy'),
                                    pointStyle: 'circle',
                                    hidden: false
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            
                            // Get product names for this line-dosage form combination
                            const productNames = window.specialCasesProductNames || {};
                            const key = label.replace(' - ', '-'); // Convert "Solids - Tablets" to "Solids-Tablets"
                            const names = productNames[key] || [];
                            
                            let tooltipText = `${label}: ${value} special case${value !== 1 ? 's' : ''}`;
                            
                            if (names.length > 0) {
                                // Show up to 3 products in a compact format
                                const displayNames = names.slice(0, 3);
                                const remainingCount = names.length - 3;
                                
                                if (displayNames.length === 1) {
                                    tooltipText += ` (${displayNames[0]})`;
                                } else if (displayNames.length === 2) {
                                    tooltipText += ` (${displayNames[0]}, ${displayNames[1]})`;
                                } else if (displayNames.length === 3) {
                                    tooltipText += ` (${displayNames[0]}, ${displayNames[1]}, ${displayNames[2]})`;
                                }
                                
                                if (remainingCount > 0) {
                                    tooltipText += ` +${remainingCount} more`;
                                }
                            }
                            
                            return tooltipText;
                        }
                    }
                }
            }
        }
    });
}

function renderMinMacosDistributionPieChart() {
    console.log('renderMinMacosDistributionPieChart called');
    const canvas = document.getElementById('minMacosPieChart');
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    console.log('Rendering minimum MACO chart...');
    const minMacosDistribution = getMinMacosDistributionByLineAndDosageForm();
    console.log('Distribution data:', minMacosDistribution);
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.minMacosChart) {
        window.minMacosChart.destroy();
    }
    
    // Prepare data for minimum MACO pie chart
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Keep separate slices but prepare for grouped legend
    const linesInLegend = new Set();
    
    // Process each line and dosage form combination with consistent colors
    console.log('Processing distribution data...');
    Object.keys(minMacosDistribution).forEach(line => {
        const lineData = minMacosDistribution[line];
        console.log(`Processing line: ${line}`, lineData);
        if (!lineData || typeof lineData !== 'object') {
            console.log(`Skipping line ${line}: Invalid data`);
            return;
        }
        
        // Add each dosage form as a separate segment with consistent colors
        Object.keys(lineData).forEach(dosageForm => {
            const macoValue = lineData[dosageForm];
            console.log(`Processing ${line} - ${dosageForm}: MACO value = ${macoValue}`);
            
            // More lenient validation - accept very small positive numbers
            if (macoValue && macoValue > 0 && !isNaN(macoValue) && isFinite(macoValue)) {
                const label = `${line} - ${dosageForm}`;
                const color = getColorForCombination(line, dosageForm);
                console.log(`Line ${line} - ${dosageForm} color: ${color}`);
                labels.push(label);
                data.push(macoValue); // Minimum MACO value
                backgroundColors.push(color);
                borderColors.push('#fff'); // White borders
                linesInLegend.add(line); // Track unique lines for legend
                console.log(`Added segment: ${label} = ${macoValue}`);
            } else {
                console.warn(`Skipping ${line} - ${dosageForm}: Invalid MACO value (${macoValue})`);
                // If we have invalid data but should have valid data, add a small default
                if (dosageForm && line) {
                    console.log(`Adding default MACO value for ${line} - ${dosageForm}`);
                    const label = `${line} - ${dosageForm}`;
                    const color = getColorForCombination(line, dosageForm);
                    labels.push(label);
                    data.push(0.001); // Small default value
                    backgroundColors.push(color);
                    borderColors.push('#fff');
                    linesInLegend.add(line);
                    console.log(`Added default segment: ${label} = 0.001`);
                }
            }
        });
    });
    
    console.log('Final chart data:', { labels, data, backgroundColors, borderColors });
    
    // Check if we have any data to display
    if (labels.length === 0 || data.length === 0) {
        console.log('No minimum MACO data available for pie chart');
        console.log('Labels:', labels);
        console.log('Data:', data);
        console.log('Distribution:', minMacosDistribution);
        return;
    }
    
    console.log('Creating Chart.js chart with data:', { labels, data, backgroundColors, borderColors });
    
    // Create a simple test chart first
    try {
        window.minMacosChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: borderColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false,
                        text: 'Minimum MACO by Line and Dosage Form',
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            },
                            generateLabels: function(chart) {
                                // Create grouped legend showing line names with their dosage forms
                                const uniqueLines = Array.from(linesInLegend).sort();
                                return uniqueLines.map(line => {
                                    // Find all dosage forms for this line
                                    const dosageFormsInLine = new Set();
                                    labels.forEach((label, index) => {
                                        if (label.startsWith(line + ' - ')) {
                                            const dosageForm = label.replace(line + ' - ', '');
                                            dosageFormsInLine.add(dosageForm);
                                        }
                                    });
                                    
                                    const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
                                    const legendText = `${line}: ${dosageFormsList}`;
                                    
                                    return {
                                        text: legendText,
                                        fillStyle: getColorForCombination(line, 'dummy'),
                                        strokeStyle: getColorForCombination(line, 'dummy'),
                                        pointStyle: 'circle',
                                        hidden: false
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                
                                // Get MACO value for this line-dosage form combination
                                const macoValues = window.minMacosValues || {};
                                const key = label.replace(' - ', '-'); // Convert "Solids - Tablets" to "Solids-Tablets"
                                const macoValue = macoValues[key] || value;
                                
                                         return `${label}: ${macoValue.toFixed(6)} mg/Swab`;
                            }
                        }
                    }
                }
            }
        });
        
    console.log('Chart created successfully!');
    
    
} catch (error) {
    console.error('Error creating chart:', error);
    alert('Error creating chart: ' + error.message);
}
}

function renderTrainsByLineAndDosageChart() {
    console.log('renderTrainsByLineAndDosageChart called');
    const canvas = document.getElementById('trainsByLineAndDosageChart');
    if (!canvas) {
        console.log('Canvas element not found: trainsByLineAndDosageChart - skipping chart');
        return;
    }
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    const trainData = getTrainData();
    if (trainData.length === 0) {
        console.log('No train data available for grouped bar chart');
        return;
    }
    
    // Group trains by line and dosage form
    const groupedData = {};
    const allLines = new Set();
    const allDosageForms = new Set();
    
    trainData.forEach(train => {
        const line = train.line || 'Unassigned';
        const dosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
        
        allLines.add(line);
        dosageForms.forEach(dosageForm => {
            allDosageForms.add(dosageForm);
            
            if (!groupedData[line]) {
                groupedData[line] = {};
            }
            if (!groupedData[line][dosageForm]) {
                groupedData[line][dosageForm] = [];
            }
            
            // Calculate MACO per swab for this train
            const worstCaseType = getWorstCaseProductType(train.products.map(p=>p.productType));
            const sfConfig = getSafetyFactorForDosageForm(worstCaseType);
            const sf = sfConfig.max;
            const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
            
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            let macoNoel = Infinity;
            
            const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
            const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
            
            if (train.lowestPde !== null && !pdeHidden) {
                macoHealth = train.lowestPde * train.minBsMddRatio;
            }
            
            if (train.lowestLd50 !== null && !ld50Hidden) {
                const noel = (train.lowestLd50 * 70) / 2000;
                const allMdds = train.products.flatMap(p => p.activeIngredients.map(ing => ing.mdd / 1000));
                const minMdd = Math.min(...allMdds);
                macoNoel = (noel * train.minMbsKg * 1000) / (sf * minMdd);
            }
            
            const macoVisual = 0.004 * lineLargestEssa;
            
            const allMacoValues = [
                { name: '0.1% Therapeutic Dose', value: macoDose },
                { name: '10 ppm Criterion', value: maco10ppm }
            ];
            
            if (train.lowestPde !== null && !pdeHidden) {
                allMacoValues.push({ name: 'Health-Based Limit (PDE)', value: macoHealth });
            }
            
            if (train.lowestLd50 !== null && !ld50Hidden) {
                allMacoValues.push({ name: 'Health-Based Limit (NOEL)', value: macoNoel });
            }
            
            allMacoValues.push({ name: 'Visual Clean Limit', value: macoVisual });
            
            const finalMacoResult = allMacoValues.reduce((min, current) => current.value < min.value ? current : min);
            const finalMaco = finalMacoResult.value;
            const macoPerArea = lineLargestEssa > 0 ? finalMaco / lineLargestEssa : 0;
            const macoPerSwab = macoPerArea * train.assumedSsa;
            
            // Get proper train numbering
            const idMap = getTrainIdToLineNumberMap();
            const mapped = idMap.get(String(train.id));
            const trainNumber = mapped ? mapped.number : train.id;
            
            groupedData[line][dosageForm].push({
                trainId: train.id,
                trainName: `Train ${trainNumber}`,
                macoPerSwab: macoPerSwab
            });
        });
    });
    
    console.log('Grouped data:', groupedData);
    
    // Prepare data for Chart.js - Show individual trains with correct labels
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Create a flat structure: [line-dosageForm-train] combinations
    const flatTrainData = [];
    
    Array.from(allLines).sort().forEach(line => {
        const lineData = groupedData[line] || {};
        const dosageForms = Object.keys(lineData).sort();
        
        dosageForms.forEach(dosageForm => {
            const trains = lineData[dosageForm] || [];
            trains.forEach(train => {
                flatTrainData.push({
                    line: line,
                    dosageForm: dosageForm,
                    trainName: train.trainName,
                    macoPerSwab: train.macoPerSwab
                });
            });
        });
    });
    
    // Sort trains by line, then dosage form, then train number
    flatTrainData.sort((a, b) => {
        if (a.line !== b.line) return a.line.localeCompare(b.line);
        if (a.dosageForm !== b.dosageForm) return a.dosageForm.localeCompare(b.dosageForm);
        return a.trainName.localeCompare(b.trainName);
    });
    
    // Create single dataset with all trains using consistent colors and sequential numbering
    flatTrainData.forEach((item, index) => {
        // Sequential train numbering (1, 2, 3, 4, ...)
        const sequentialNumber = index + 1;
        
        // Short label for space efficiency: just "T1", "T2", etc.
        labels.push(`T${sequentialNumber}`);
        data.push(item.macoPerSwab);
        const color = getColorForCombination(item.line, item.dosageForm);
        backgroundColors.push(color);
        borderColors.push(color);
        
        // Store full info for tooltips
        item.sequentialNumber = sequentialNumber;
    });
    
    // Create datasets for legend (one per line with dosage forms)
    const uniqueLines = [...new Set(flatTrainData.map(item => item.line))].sort();
    const datasets = uniqueLines.map(line => {
        // Find all dosage forms for this line
        const dosageFormsInLine = new Set();
        flatTrainData.forEach(item => {
            if (item.line === line) {
                dosageFormsInLine.add(item.dosageForm);
            }
        });
        
        const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
        const legendText = `${line}: ${dosageFormsList}`;
        
        return {
            label: legendText,
            data: [], // Empty data, just for legend
            backgroundColor: getColorForCombination(line, 'dummy'),
            borderColor: getColorForCombination(line, 'dummy'),
            borderWidth: 1
        };
    });
    
    // Add the main dataset with all data
    datasets.push({
        label: 'Trains',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
    });
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.trainsByLineAndDosageChart && typeof window.trainsByLineAndDosageChart.destroy === 'function') {
        window.trainsByLineAndDosageChart.destroy();
    }
    
    window.trainsByLineAndDosageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                    text: 'Individual Trains by Line and Dosage Form (MACO per Swab)',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        filter: function(legendItem) {
                            return legendItem.text !== 'Trains';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const trainData = flatTrainData[index];
                            if (trainData) {
                                return `${trainData.line} - ${trainData.dosageForm} - ${trainData.trainName}`;
                            }
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            return `MACO: ${value.toFixed(6)} mg/Swab`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Trains in Line and Group'
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'MACO per Swab (mg/Swab)'
                    },
                    type: 'logarithmic'
                }
            }
        }
    });
    
    console.log('Trains by Line and Dosage chart created successfully!');
}

function renderHighestRpnByTrainChart() {
    console.log('renderHighestRpnByTrainChart called');
    const canvas = document.getElementById('highestRpnByTrainChart');
    if (!canvas) {
        console.log('Canvas element not found: highestRpnByTrainChart - skipping chart');
        return;
    }
    
    // Ensure color mapping is initialized
    initializeColorMapping();
    
    const trainData = getTrainData();
    if (trainData.length === 0) {
        console.log('No train data available for highest RPN chart');
        return;
    }
    
    // Calculate highest RPN for each train
    const trainRpnData = [];
    
    trainData.forEach(train => {
        let highestRpn = 0;
        let highestRpnProduct = null;
        let highestRpnIngredient = null;
        
        // Find the highest RPN across all products in this train
        train.products.forEach(product => {
            if (product.activeIngredients && Array.isArray(product.activeIngredients)) {
                product.activeIngredients.forEach(ingredient => {
                    try {
                        const scores = calculateScores(ingredient);
                const rpn = scores?.rpn || 0;
                        if (rpn && rpn > highestRpn) {
                            highestRpn = rpn;
                            highestRpnProduct = product.name;
                            highestRpnIngredient = ingredient.name;
                        }
                    } catch (error) {
                        console.warn('Error calculating RPN for ingredient:', ingredient, error);
                    }
                });
            }
        });
        
        if (highestRpn > 0) {
            // Get proper train numbering
            const idMap = getTrainIdToLineNumberMap();
            const mapped = idMap.get(String(train.id));
            const trainNumber = mapped ? mapped.number : train.id;
            
            trainRpnData.push({
                line: train.line || 'Unassigned',
                dosageForm: train.products.length > 0 ? train.products[0].productType || 'Other' : 'Other',
                trainName: `Train ${trainNumber}`,
                highestRpn: highestRpn,
                productName: highestRpnProduct,
                ingredientName: highestRpnIngredient
            });
        }
    });
    
    // Sort by line, then dosage form, then train number
    trainRpnData.sort((a, b) => {
        if (a.line !== b.line) return a.line.localeCompare(b.line);
        if (a.dosageForm !== b.dosageForm) return a.dosageForm.localeCompare(b.dosageForm);
        return a.trainName.localeCompare(b.trainName);
    });
    
    console.log('Train RPN data:', trainRpnData);
    
    // Prepare chart data
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Create labels and data with consistent colors and sequential numbering
    trainRpnData.forEach((item, index) => {
        // Sequential train numbering (1, 2, 3, 4, ...)
        const sequentialNumber = index + 1;
        
        // Short label for space efficiency: just "T1", "T2", etc.
        labels.push(`T${sequentialNumber}`);
        data.push(item.highestRpn);
        const color = getColorForCombination(item.line, item.dosageForm);
        backgroundColors.push(color);
        borderColors.push(color);
        
        // Store full info for tooltips
        item.sequentialNumber = sequentialNumber;
    });
    
    // Create datasets for legend (one per line with dosage forms)
    const uniqueLines = [...new Set(trainRpnData.map(item => item.line))].sort();
    const datasets = uniqueLines.map(line => {
        // Find all dosage forms for this line
        const dosageFormsInLine = new Set();
        trainRpnData.forEach(item => {
            if (item.line === line) {
                dosageFormsInLine.add(item.dosageForm);
            }
        });
        
        const dosageFormsList = Array.from(dosageFormsInLine).sort().join(', ');
        const legendText = `${line}: ${dosageFormsList}`;
        
        return {
            label: legendText,
            data: [], // Empty data, just for legend
            backgroundColor: getColorForCombination(line, 'dummy'),
            borderColor: getColorForCombination(line, 'dummy'),
            borderWidth: 1
        };
    });
    
    // Add the main dataset with all data
    datasets.push({
        label: 'Trains',
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
    });
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.highestRpnByTrainChart && typeof window.highestRpnByTrainChart.destroy === 'function') {
        window.highestRpnByTrainChart.destroy();
    }
    
    window.highestRpnByTrainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                    text: 'Highest RPN by Train (with Product Name)',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 14 },
                        filter: function(legendItem) {
                            return legendItem.text !== 'Trains';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const item = trainRpnData[index];
                            if (item) {
                                return `${item.trainName}: RPN ${item.highestRpn} (${item.productName})`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Trains in Line and Group'
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Highest RPN Value'
                    },
                    beginAtZero: true
                }
            }
        }
    });
    
    console.log('Highest RPN by Train chart created successfully!');
}

function renderTopRpnProductsChart() {
    const canvas = document.getElementById('topRpnProductsChart');
    if (!canvas) return;
    
    // Get top 10 products by RPN
    const productRpnData = [];
    products.forEach(product => {
        if (product.activeIngredients && product.activeIngredients.length > 0) {
            let maxRpn = 0;
            product.activeIngredients.forEach(ingredient => {
                try {
                    const scores = calculateScores(ingredient);
                    const rpn = scores?.rpn || 0;
                    if (rpn > maxRpn) maxRpn = rpn;
                } catch (error) {
                    console.warn('Error calculating RPN:', error);
                }
            });
            if (maxRpn > 0) {
                productRpnData.push({ name: product.name, rpn: maxRpn });
            }
        }
    });
    
    // Sort by RPN and take top 10
    productRpnData.sort((a, b) => b.rpn - a.rpn);
    const topProducts = productRpnData.slice(0, 10);
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.topRpnChart) {
        window.topRpnChart.destroy();
    }
    
    window.topRpnChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProducts.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
            datasets: [{
                label: 'RPN Score',
                data: topProducts.map(p => p.rpn),
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Products by RPN Score',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'RPN Score'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Products'
                    }
                }
            }
        }
    });
}

function getMacoPerSwabForTrain(train, allTrains) {
               const sfConfig = state.safetyFactorConfig[getWorstCaseProductType(train.products.map(p => p.productType))] || state.safetyFactorConfig['Other'];
            const sf = sfConfig.max;
            
            // Calculate largest ESSA for trains in the same line and dosage form
            const largestEssa = getLargestEssaForLineAndDosageForm(train, allTrains);
            
            const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
            const maco10ppm = 10 * train.minMbsKg;
            let macoHealth = Infinity;
            if (train.lowestPde !== null) {
                macoHealth = train.lowestPde * train.minBsMddRatio;
            }
            const macoVisual = (0.004) * largestEssa;

            const finalMaco = Math.min(macoDose, maco10ppm, macoHealth, macoVisual);
            const macoPerArea = largestEssa > 0 ? finalMaco / largestEssa : 0;
            return macoPerArea * train.assumedSsa;
}

export function renderMacoChart() {
   const canvas = document.getElementById('macoChartCanvas');
            const placeholder = document.getElementById('macoChartPlaceholder');
            
            const trainData = getTrainData();

            if (trainData.length === 0) {
                canvas.style.display = 'none';
                placeholder.style.display = 'flex';
                if (macoChartInstance) macoChartInstance.destroy();
                return;
            }
            
            canvas.style.display = 'block';
            placeholder.style.display = 'none';

            // Use friendly labels where available
            const idMap = utils.getTrainIdToLineNumberMap();
            const labels = trainData.map(t => {
                const mapped = idMap.get(String(t.id));
                return mapped ? `${mapped.line} — Train ${mapped.number}` : `Train ${t.id}`;
            });
            const data = trainData.map(t => getMacoPerSwabForTrain(t, trainData));
            
            if (macoChartInstance) macoChartInstance.destroy();
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
            gradient.addColorStop(1, 'rgba(139, 92, 246, 0.6)');

            const newChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'MACO per Swab',
                        data: data,
                        backgroundColor: gradient,
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
                        y: { 
                            type: 'logarithmic', 
                            ticks: { color: 'var(--text-secondary)' }, 
                            grid: { display: false },
                            title: {
                                display: true,
                                text: 'MACO (mg/Swab)',
                                color: 'var(--text-secondary)'
                            }
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.y !== null) { 
                                        label += context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 5 });
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
            state.setMacoChartInstance(newChart);
}

function renderFinalMacoComparisonChart() {
    const canvas = document.getElementById('finalMacoComparisonChart');
    if (!canvas) return;
    
    const trainData = getTrainData();
    if (trainData.length === 0) return;
    
    // Calculate final MACO for each train
    const macoData = trainData.map(train => {
        const sfConfig = state.safetyFactorConfig[getWorstCaseProductType(train.products.map(p=>p.productType))] || state.safetyFactorConfig['Other'];
        const sf = sfConfig.max;
        
        const lineLargestEssa = getLargestEssaForLineAndDosageForm(train, trainData);
        
        const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
        const maco10ppm = 10 * train.minMbsKg;
        let macoHealth = Infinity;
        if (train.lowestPde !== null) {
            macoHealth = train.lowestPde * train.minBsMddRatio;
        }
        const macoVisual = (0.004) * lineLargestEssa;
        
        const finalMaco = Math.min(macoDose, maco10ppm, macoHealth, macoVisual);
        
        return {
            trainId: train.id,
            trainName: `Train ${train.id}`,
            finalMaco: finalMaco
        };
    });
    
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.finalMacoChart) {
        window.finalMacoChart.destroy();
    }
    
    window.finalMacoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: macoData.map(d => d.trainName),
            datasets: [{
                label: 'Final MACO (mg)',
                data: macoData.map(d => d.finalMaco),
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Final MACO Comparison by Train',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Final MACO (mg) - Logarithmic Scale'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Trains'
                    }
                }
            }
        }
    });
}

export function renderMachineCoverageTable() {
    const container = document.getElementById('machineCoverageContainer');
    if (!container) return;
    
    // Generate and display the table (styles are included in the HTML)
    container.innerHTML = createHorizontalMachineCoverageTable();
}

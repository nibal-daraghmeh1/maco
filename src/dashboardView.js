 // Renders the main dashboard with stats and charts
 // js/dashboardView.js
import { products, machines, macoChartInstance, setMacoChartInstance } from './state.js';
import { getTrainData, getWorstCaseProductType, getLargestEssaForLineAndDosageForm } from './utils.js'; // Assuming getTrainData is in utils
import * as utils from './utils.js';
import { renderRpnChart } from './worstCaseView.js'; // The RPN chart is on the worst-case tab but shown here too
import * as state from './state.js';
import { createHorizontalMachineCoverageTable, getMachineCoverageStyles } from './machineCoverageView.js';

export function renderMainDashboard() {
         const statsContainer = document.getElementById('dashboardStats');
            statsContainer.innerHTML = '';
            const trainData = getTrainData();
            
            let lowestMacoTrain = { id: 'N/A', finalMaco: Infinity };
            let largestEssaTrain = { id: 'N/A', essa: 0 };
            if (trainData.length > 0) {
                 const finalTrainData = trainData.map(train => {
                    const sfConfig = state.safetyFactorConfig[getWorstCaseProductType(train.products.map(p=>p.productType))] || state.safetyFactorConfig['Other'];
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
            const totalRequiredStudies = trainData.length;
            const highestRpnProduct = getHighestRpnProduct();
            const dosageFormDistribution = getDosageFormDistribution();

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

            renderRpnChart();
            renderMacoChart();
            renderDosageFormPieChart();
            renderTopRpnProductsChart();
            renderFinalMacoComparisonChart();
            renderMachineCoverageTable();
}

// Helper functions for new KPIs
function getHighestRpnProduct() {
    let highestRpn = 0;
    let highestProduct = { name: 'N/A', rpn: 0 };
    
    products.forEach(product => {
        if (product.activeIngredients && product.activeIngredients.length > 0) {
            product.activeIngredients.forEach(ingredient => {
                const rpn = calculateRpn(ingredient);
                if (rpn > highestRpn) {
                    highestRpn = rpn;
                    highestProduct = { name: product.name, rpn: rpn };
                }
            });
        }
    });
    
    return highestProduct;
}

function getDosageFormDistribution() {
    const distribution = {};
    products.forEach(product => {
        const dosageForm = product.productType || 'Other';
        distribution[dosageForm] = (distribution[dosageForm] || 0) + 1;
    });
    return distribution;
}

function calculateRpn(ingredient) {
    // Simple RPN calculation - you may need to adjust based on your actual formula
    const solubility = ingredient.solubility === 'Freely soluble' ? 1 : 
                     ingredient.solubility === 'Soluble' ? 2 :
                     ingredient.solubility === 'Slightly soluble' ? 3 : 4;
    
    const cleanability = ingredient.cleanability === 'Easy' ? 1 :
                        ingredient.cleanability === 'Medium' ? 2 : 3;
    
    return solubility * cleanability;
}

function renderDosageFormPieChart() {
    const canvas = document.getElementById('dosageFormPieChart');
    if (!canvas) return;
    
    const distribution = getDosageFormDistribution();
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.dosageFormChart) {
        window.dosageFormChart.destroy();
    }
    
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    
    window.dosageFormChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                data: Object.values(distribution),
                backgroundColor: colors.slice(0, Object.keys(distribution).length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Studies Distribution by Dosage Form',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
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
                const rpn = calculateRpn(ingredient);
                if (rpn > maxRpn) maxRpn = rpn;
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
    
    // Add styles
    const styleElement = document.getElementById('machineCoverageStyles');
    if (!styleElement) {
        const style = document.createElement('div');
        style.id = 'machineCoverageStyles';
        style.innerHTML = getMachineCoverageStyles();
        document.head.appendChild(style);
    }
    
    // Generate and display the table
    container.innerHTML = createHorizontalMachineCoverageTable();
}
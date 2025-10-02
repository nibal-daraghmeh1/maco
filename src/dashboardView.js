 // Renders the main dashboard with stats and charts
 // js/dashboardView.js
import { products, machines, macoChartInstance, setMacoChartInstance } from './state.js';
import { getTrainData, getWorstCaseProductType, getLargestEssaForLineAndDosageForm } from './utils.js'; // Assuming getTrainData is in utils
import * as utils from './utils.js';
import { renderRpnChart } from './worstCaseView.js'; // The RPN chart is on the worst-case tab but shown here too
import * as state from './state.js';

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

            const stats = [
                { label: 'Total Products', value: products.length, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-box-seam" viewBox="0 0 16 16"><path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.405 1.372L8 2.267l3.75 2.605 2.405-1.372L8.186 1.113zM3.75 4.81L8 7.76l4.25-2.95L8 1.815 3.75 4.81z"/><path d="M1 4.53v7.94l6.5 3.53 6.5-3.53V4.53L8 8.06 1 4.53zm7.5 3.56l-3.5-2-3.5 2v7.19l3.5 2 3.5-2v-7.19zm3.5 2l-3.5 2v7.19l3.5-2 3.5 2v-7.19l-3.5-2z"/></svg>' },
                { label: 'Total Machines', value: machines.length, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16"><path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.62 1.105l-.09.282c-.273.85-.92 1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.09-.282c-.268-1.135.925-1.824 1.62-1.105l.205.211a.96.96 0 0 0 1.622-.434L7.068.727zM12.973 8.5H8.25l-1.03-1.03a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l2.5-2.5a1 1 0 0 0-1.414-1.414L12.973 8.5z"/><path d="M.242 4.753a.626.626 0 0 1 .884 0l.058.058a.96.96 0 0 0 1.353-.14l.17-.186c.695-.761 1.888.06 1.62 1.204l-.066.261c-.273.85-.92 1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.066-.261c-.268-1.144.925-1.965 1.62-1.204l.17.186a.96.96 0 0 0 1.353.14l.058-.058a.626.626 0 0 1 0-.884zM15.758 4.753a.626.626 0 0 1 .884 0l.058.058a.96.96 0 0 0 1.353.14l.17-.186c.695.761-.925 1.965-1.62 1.204l-.066-.261c-.273-.85-.92-1.368-1.843 1.368h-1.11c-.923 0-1.57-.517-1.843 1.368l-.066.261c-.268 1.144 1.888.443 1.62-1.204l.17-.186a.96.96 0 0 0 1.353-.14l.058-.058a.626.626 0 0 1 0 .884z"/></svg>' },
                { label: 'Number of Trains', value: trainData.length, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-diagram-3" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5v-1zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1zM3 11.5A1.5 1.5 0 0 1 4.5 10h1A1.5 1.5 0 0 1 7 11.5v1A1.5 1.5 0 0 1 5.5 14h-1A1.5 1.5 0 0 1 3 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5A1.5 1.5 0 0 1 10.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 9 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"/></svg>' },
                { label: 'Lowest MACO Train', value: friendlyLowest, subValue: `${lowestMacoTrain.finalMaco ? lowestMacoTrain.finalMaco.toFixed(2) : 'N/A'} mg`, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a7 7 0 0 1 14 0H1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/><path d="M7.25 4.5a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5z"/></svg>' },
                { label: 'Largest Area Train', value: friendlyLargest, subValue: `${largestEssaTrain.essa.toLocaleString()} cm²`, icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 1.5a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-1 0v-12a.5.5 0 0 1 .5-.5z"/><path d="M1.5 6.002a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 0 1h-12a.5.5 0 0 1-.5-.5z"/><path d="M14.25 2.164a.5.5 0 0 1 .146.353v10.966a.5.5 0 0 1-.146.353l-10.966 2.193a.5.5 0 0 1-.611-.493v-1.077A5.002 5.002 0 0 1 5.5 7.425V4.28a.5.5 0 0 1 .2-.4l8-3a.5.5 0 0 1 .55.284zM3.5 13.923v-1.077A5.002 5.002 0 0 1 5.5 7.425V4.893L3.5 5.672v8.251zm2-6.538A4.002 4.002 0 0 0 4.5 12.8v-1.077a4 4 0 0 0-1-2.316V8.19a4 4 0 0 0 2 1.2V7.385zM13.5 3.33v-.171l-8 3v3.115A4.002 4.002 0 0 0 9.5 8.19v2.292a4 4 0 0 0 1-2.316V9.423a4 4 0 0 0 2-1.2v-4.9z"/></svg>' }
            ];

            stats.forEach(stat => {
                const card = document.createElement('div');
                card.className = 'card p-6 flex items-center';
                card.innerHTML = `
                    <div class="p-3 rounded-full mr-4 text-white" style="background-image: linear-gradient(to right, var(--gradient-start), var(--gradient-end));">
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
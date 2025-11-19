// Renders the "Scoring System" tab
// js/scoringView.js

import * as state from './state.js';
import { fullAppRender } from './app.js';
import { showLoader, hideLoader, showCustomAlert, saveStateForUndo } from './ui.js';
import { getRpnRatingClass } from './utils.js';

// Track active scoring tab
let activeScoringTab = 'productRpn';

// Product RPN Criteria keys
const PRODUCT_RPN_KEYS = ['solubility', 'therapeuticDose', 'cleanability', 'toxicityLd50', 'toxicityPde', 'rpnRating'];

// Location RPN Criteria keys
const LOCATION_RPN_KEYS = ['hardToClean', 'accessibility', 'visibility', 'numberOfSamples'];

export function changeScoringTab(tabId, element) {
    activeScoringTab = tabId;
    
    // Update tab button styles
    document.querySelectorAll('.scoring-tab-button').forEach(btn => {
        btn.classList.remove('active-scoring-tab');
    });
    element.classList.add('active-scoring-tab');
    
    // Re-render the scoring system with the new tab
    renderScoringSystem();
}

export function toggleScoringEditMode(isEdit) {
    state.setScoringInEditMode(isEdit);
    const editBtn = document.getElementById('editScoringBtn');
    const activeStyle = "btn-gradient";
    const inactiveStyle = "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
    if (isEdit) {
        editBtn.textContent = 'View';
        editBtn.className = `px-4 py-2 text-sm rounded-lg ${inactiveStyle}`;
    } else {
        editBtn.textContent = 'Edit';
        editBtn.className = `px-4 py-2 text-sm rounded-lg ${activeStyle}`;
    }
    renderScoringSystem();
}

export function renderScoringSystem() {
    const container = document.getElementById('scoringSystemContainer');
    container.innerHTML = '';
    
    // Determine which criteria keys to show based on active tab
    const criteriaKeysToShow = activeScoringTab === 'productRpn' ? PRODUCT_RPN_KEYS : LOCATION_RPN_KEYS;
    
    if (state.scoringInEditMode) {
        const form = document.createElement('form'); 
        form.id = 'scoringForm';
        form.className = 'space-y-6';
        
        for (const key of criteriaKeysToShow) {
            if (!state.scoringCriteria[key]) continue;
            const category = state.scoringCriteria[key];
            const groupDiv = document.createElement('div');
            groupDiv.innerHTML = `<h4 class="text-lg font-semibold mb-3">${category.title}</h4>`;
            const fieldsContainer = document.createElement('div');
            fieldsContainer.id = `fields-container-${key}`;
            fieldsContainer.className = 'space-y-2';
            category.criteria.forEach((c) =>
                 fieldsContainer.appendChild(createCriterionFieldRow(key, c)));
            groupDiv.appendChild(fieldsContainer);
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'pt-2 no-print';
            buttonContainer.innerHTML = `<button type="button" onclick="addCriterionToScoringTab('${key}')" class="text-sm px-3 py-1 rounded-md text-white btn-gradient">+ Add Criterion</button>`;
            groupDiv.appendChild(buttonContainer);
            form.appendChild(groupDiv);
        }
        container.appendChild(form);
        const saveButton = document.createElement('button');
        saveButton.onclick = (event) => saveScoringCriteria(event);
        saveButton.className = 'w-full mt-6 py-2.5 text-white rounded-lg no-print btn-gradient';
        saveButton.textContent = 'Save All Changes';
        container.appendChild(saveButton);

    } else {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
        
        for (const key of criteriaKeysToShow) {
            if (!state.scoringCriteria[key]) continue;
            const category = state.scoringCriteria[key];
            const cardDiv = document.createElement('div');
            cardDiv.className = 'bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700';

            let tableHTML = `<h4 class="text-lg font-semibold mb-3" style="color: var(--text-primary);">${category.title}</h4>
                             <div class="overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                                 <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">`;

            const isRpn = category.type === 'rpn_threshold';
            const isRpnSamples = category.type === 'rpn_samples';
            const header1 = isRpn ? 'Range Description' : isRpnSamples ? 'RPN Range' : 'Criteria';
            const header2 = isRpn ? 'Rating' : isRpnSamples ? 'Number of Samples' : 'Score';

            tableHTML += `<thead class="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th scope="col" class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">${header1}</th>
                                <th scope="col" class="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">${header2}</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 dark:divide-gray-600" style="background-color: var(--bg-secondary);">`;

            category.criteria.forEach(c => {
                let col1, col2;
                if (isRpn) {
                    col1 = c.rangeDescription;
                    const rpnClass = getRpnRatingClass(c.rating);
                    col2 = `<span class="rpn-rating-badge ${rpnClass}">${c.rating}</span>`;
                } else if (isRpnSamples) {
                    col1 = `${c.rpnMin}-${c.rpnMax}`;
                    col2 = `<span class="samples-badge">${c.samples}</span>`;
                } else {
                    col1 = c.text;
                    const scoreClass = `score-${c.score}`;
                    col2 = `<span class="score-badge ${scoreClass}">${c.score}</span>`;
                }
                tableHTML += `<tr>
                                <td class="px-3 py-2 whitespace-nowrap text-sm">${col1}</td>
                                <td class="px-3 py-2 whitespace-nowrap text-sm">${col2}</td>
                              </tr>`;
            });

            tableHTML += `</tbody></table></div>`;
            cardDiv.innerHTML = tableHTML;
            grid.appendChild(cardDiv);
        }
        container.appendChild(grid);
    }
}

function createCriterionFieldRow(key, crit) {
   const itemDiv = document.createElement('div'); 
   itemDiv.className = 'grid gap-2 items-center p-2 border rounded-md';
    itemDiv.style.borderColor = 'var(--border-color)'; 
    const type = state.scoringCriteria[key].type; 
    if (type === 'exactMatch') { itemDiv.style.gridTemplateColumns = '3fr 1fr 0.5fr';
         itemDiv.innerHTML = `<input type="text" value="${crit.text}" class="w-full px-2 py-1 border rounded-md text-sm" data-field="text"><input type="number" value="${crit.score}" class="w-full px-2 py-1 border rounded-md text-sm" data-field="score" min="0">`;
         } else if (type === 'range') { 
            itemDiv.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 0.5fr'; 
            itemDiv.innerHTML = `<input type="text" value="${crit.text}" class="w-full px-2 py-1 border rounded-md text-sm" data-field="text"><input type="number" step="any" value="${crit.lowerBound ?? ''}" placeholder="Min" class="w-full px-2 py-1 border rounded-md text-sm" data-field="lowerBound" min="0"><input type="number" step="any" value="${crit.upperBound ?? ''}" placeholder="Max" class="w-full px-2 py-1 border rounded-md text-sm" data-field="upperBound" min="0"><input type="number" value="${crit.score}" class="w-full px-2 py-1 border rounded-md text-sm" data-field="score" min="0">`;
         } else if (type === 'rpn_threshold') { 
            itemDiv.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 0.5fr';
            const maxVal = crit.max === Infinity ? '' : crit.max;
            itemDiv.innerHTML = `
                <input type="number" value="${crit.min}" placeholder="Min RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="minRpn" min="0">
                <input type="number" value="${maxVal}" placeholder="Max RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="maxRpn" min="0">
                <input type="text" value="${crit.rating}" placeholder="Rating" class="w-full px-2 py-1 border rounded-md text-sm" data-field="ratingText">
                <span class="text-xs self-center" style="color:var(--text-secondary);">${crit.rangeDescription || ''}</span>
            `;
        } else if (type === 'rpn_samples') {
            itemDiv.style.gridTemplateColumns = '1fr 1fr 1fr 0.5fr';
            itemDiv.innerHTML = `
                <input type="number" value="${crit.rpnMin}" placeholder="Min RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="rpnMin" min="0">
                <input type="number" value="${crit.rpnMax}" placeholder="Max RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="rpnMax" min="0">
                <input type="number" value="${crit.samples}" placeholder="Samples" class="w-full px-2 py-1 border rounded-md text-sm" data-field="samples" min="1">
            `;
        } itemDiv.innerHTML += `<button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 p-1" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg></button>`;
    return itemDiv;
}

export function addCriterionToScoringTab(key) {
   const container = document.getElementById(`fields-container-${key}`); 
   const cat = state.scoringCriteria[key]; 
   let newCrit; 
   if (cat.type === 'rpn_threshold') { 
    newCrit = { min: 1, max: 27, rating: 'Low', rangeDescription: '1-27' }; 
   } else if (cat.type === 'rpn_samples') {
    newCrit = { text: '1-27 RPN = 1 Sample', samples: 1, rpnMin: 1, rpnMax: 27 };
   } else { 
    newCrit = { ...(cat.criteria[0] || {text: "", score: 0}), text: "New Criterion",
      score: cat.defaultScore || 1 }; 
    if (cat.type === 'range') {
         delete newCrit.lowerBound; delete newCrit.upperBound; 
         newCrit.comparison = cat.criteria[0]?.comparison || "between_inclusive_both"; 
    } 
   }
   container.appendChild(createCriterionFieldRow(key, newCrit));
}
    

export async function saveScoringCriteria(event) {
    const saveButton = event.target;
    showLoader();
    saveButton.disabled = true;

    try {
        const newCriteria = JSON.parse(JSON.stringify(state.scoringCriteria));
        let isValid = true;
        
        // Determine which criteria keys are currently visible
        const criteriaKeysToProcess = activeScoringTab === 'productRpn' ? PRODUCT_RPN_KEYS : LOCATION_RPN_KEYS;
        
        for (const key in newCriteria) {
            if (!isValid) break;
            const cat = newCriteria[key];
            const type = state.scoringCriteria[key].type;
            
            // Only process criteria that are in the current active tab
            // For other criteria, keep the existing values unchanged
            if (!criteriaKeysToProcess.includes(key)) {
                continue; // Skip criteria not in the current tab - keep existing values
            }
            
            cat.criteria = [];
            const container = document.getElementById(`fields-container-${key}`);
            if (!container) continue;

            Array.from(container.children).forEach(row => {
                if (!isValid) return;
                const crit = {};
                if (type === 'exactMatch' || type === 'range') {
                    crit.text = row.querySelector('[data-field="text"]').value;
                    crit.score = parseInt(row.querySelector('[data-field="score"]').value);
                    if (!crit.text || isNaN(crit.score)) {
                        isValid = false;
                        return;
                    }
                    if (type === 'range') {
                        const lower = row.querySelector('[data-field="lowerBound"]').value;
                        const upper = row.querySelector('[data-field="upperBound"]').value;
                        crit.lowerBound = lower ? parseFloat(lower) : undefined;
                        crit.upperBound = upper ? parseFloat(upper) : undefined;
                        if ((lower && isNaN(crit.lowerBound)) || (upper && isNaN(crit.upperBound)) || (crit.lowerBound !== undefined && crit.upperBound !== undefined && crit.lowerBound >= crit.upperBound)) {
                            isValid = false;
                            return;
                        }
                        if (crit.lowerBound === undefined && crit.upperBound !== undefined) crit.comparison = "less_inclusive";
                        else if (crit.lowerBound !== undefined && crit.upperBound === undefined) crit.comparison = "greater_exclusive";
                        else crit.comparison = state.scoringCriteria[key].criteria.find(c => c.text === crit.text)?.comparison || "between_exclusive_lower_inclusive_upper";
                    }
                } else if (type === 'rpn_threshold') {
                    const minRpnField = row.querySelector('[data-field="minRpn"]');
                    const maxRpnField = row.querySelector('[data-field="maxRpn"]');
                    const ratingField = row.querySelector('[data-field="ratingText"]');
                    
                    if (!minRpnField || !maxRpnField || !ratingField) {
                        console.error('RPN Threshold fields not found in row');
                        isValid = false;
                        return;
                    }
                    
                    crit.min = parseFloat(minRpnField.value);
                    const maxStr = maxRpnField.value.trim();
                    crit.max = (maxStr === '' || maxStr === null) ? Infinity : parseFloat(maxStr);
                    crit.rating = ratingField.value.trim();
                    
                    if (isNaN(crit.min)) {
                        console.error('Invalid Min RPN value:', minRpnField.value);
                        isValid = false;
                        return;
                    }
                    if (maxStr !== '' && isNaN(crit.max)) {
                        console.error('Invalid Max RPN value:', maxStr);
                        isValid = false;
                        return;
                    }
                    if (!crit.rating) {
                        console.error('Rating text is required');
                        isValid = false;
                        return;
                    }
                    if (crit.max !== Infinity && crit.min >= crit.max) {
                        console.error('Min RPN must be less than Max RPN');
                        isValid = false;
                        return;
                    }
                    
                    crit.rangeDescription = `${crit.min} - ${maxStr || 'Infinity'}`;
                    
                } else if (type === 'rpn_samples') {
                    const rpnMinField = row.querySelector('[data-field="rpnMin"]');
                    const rpnMaxField = row.querySelector('[data-field="rpnMax"]');
                    const samplesField = row.querySelector('[data-field="samples"]');
                    
                    if (!rpnMinField || !rpnMaxField || !samplesField) {
                        console.error('RPN Samples fields not found in row');
                        isValid = false;
                        return;
                    }
                    
                    crit.rpnMin = parseFloat(rpnMinField.value);
                    crit.rpnMax = parseFloat(rpnMaxField.value);
                    crit.samples = parseInt(samplesField.value);
                    
                    if (isNaN(crit.rpnMin)) {
                        console.error('Invalid Min RPN value:', rpnMinField.value);
                        isValid = false;
                        return;
                    }
                    if (isNaN(crit.rpnMax)) {
                        console.error('Invalid Max RPN value:', rpnMaxField.value);
                        isValid = false;
                        return;
                    }
                    if (isNaN(crit.samples) || crit.samples < 1) {
                        console.error('Invalid number of samples (must be >= 1):', samplesField.value);
                        isValid = false;
                        return;
                    }
                    if (crit.rpnMin >= crit.rpnMax) {
                        console.error('Min RPN must be less than Max RPN');
                        isValid = false;
                        return;
                    }
                    
                    crit.text = `${crit.rpnMin}-${crit.rpnMax} RPN = ${crit.samples} Sample${crit.samples > 1 ? 's' : ''}`;
                }
                cat.criteria.push(crit);
            });
        }

        if (isValid) {
            state.setScoringCriteria(newCriteria);
            saveStateForUndo();
            
            // Save to IndexedDB for persistence
            console.log('🔄 SCORING CRITERIA: Saving to IndexedDB...');
            const ui = await import('./ui.js');
            await ui.saveAllDataToLocalStorage();
            console.log('✅ SCORING CRITERIA: Saved to IndexedDB successfully');
            
            toggleScoringEditMode(false); // Switch back to view mode
            fullAppRender();
            showCustomAlert("Success", "Changes saved successfully.");
        } else {
            showCustomAlert("Validation Error", "Please check your input. Check the browser console for detailed error information. Common issues:\n\n• Min RPN must be less than Max RPN\n• Rating text is required\n• Number of samples must be at least 1\n• All numeric fields must have valid numbers");
        }
    } catch (error) {
        console.error("Error saving scoring criteria:", error);
        showCustomAlert("Error", "Failed to save changes. Please try again.");
    } finally {
        hideLoader();
        saveButton.disabled = false;
    }
}
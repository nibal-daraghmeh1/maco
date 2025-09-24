// Renders the "Scoring System" tab
// js/scoringView.js

import * as state from './state.js';
import { fullAppRender } from './app.js';
import { showLoader, hideLoader, showCustomAlert, saveStateForUndo } from './ui.js';
import { getRpnRatingClass } from './utils.js';

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
    if (state.scoringInEditMode) {
            const form = document.createElement('form'); 
        form.id = 'scoringForm';
                form.className = 'space-y-6';
                for (const key in state.scoringCriteria) {
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
                for (const key in state.scoringCriteria) {
                    const category = state.scoringCriteria[key];
                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700';

                    let tableHTML = `<h4 class="text-lg font-semibold mb-3" style="color: var(--text-primary);">${category.title}</h4>
                                     <div class="overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                                         <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">`;

                    const isRpn = category.type === 'rpn_threshold';
                    const header1 = isRpn ? 'Range Description' : 'Criteria';
                    const header2 = isRpn ? 'Rating' : 'Score';

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
            itemDiv.style.gridTemplateColumns = '1fr 1fr 1fr 1fr 0.5fr'; const maxVal = crit.max === Infinity ? '' : crit.max; itemDiv.innerHTML = `<input type="number" value="${crit.min}" placeholder="Min RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="minRpn" min="0"><input type="number" value="${maxVal}" placeholder="Max RPN" class="w-full px-2 py-1 border rounded-md text-sm" data-field="maxRpn" min="0"><input type="text" value="${crit.rating}" placeholder="Rating" class="w-full px-2 py-1 border rounded-md text-sm" data-field="ratingText"><span class="text-xs self-center" style="color:var(--text-secondary);">${crit.rangeDescription}</span>`; 
        } itemDiv.innerHTML += `<button type="button" onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700 p-1" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg></button>`;
    return itemDiv;
}

export function addCriterionToScoringTab(key) {
   const container = document.getElementById(`fields-container-${key}`); 
   const cat = state.scoringCriteria[key]; let newCrit; if (cat.type === 'rpn_threshold') { 
    newCrit = { min: 0, max: 10, rating: 'NEW', rangeDescription: '0-10' }; }
     else { newCrit = { ...(cat.criteria[0] || {text: "", score: 0}), text: "New Criterion",
      score: cat.defaultScore || 1 }; if (cat.type === 'range') {
         delete newCrit.lowerBound; delete newCrit.upperBound; 
         newCrit.comparison = cat.criteria[0]?.comparison || "between_inclusive_both"; } }
          container.appendChild(createCriterionFieldRow(key, newCrit));
         }
    

export function saveScoringCriteria(event) {
    const saveButton = event.target;
    showLoader();
    saveButton.disabled = true;

    try {
        const newCriteria = JSON.parse(JSON.stringify(state.scoringCriteria));
        let isValid = true;
        for (const key in newCriteria) {
            if (!isValid) break;
            const cat = newCriteria[key];
            const type = state.scoringCriteria[key].type;
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
                    crit.min = parseFloat(row.querySelector('[data-field="minRpn"]').value);
                    const maxStr = row.querySelector('[data-field="maxRpn"]').value;
                    crit.max = (maxStr === '' || maxStr === null) ? Infinity : parseFloat(maxStr);
                    crit.rating = row.querySelector('[data-field="ratingText"]').value.trim();
                    if (isNaN(crit.min) || (maxStr !== '' && isNaN(crit.max)) || !crit.rating || crit.min >= crit.max) {
                        isValid = false;
                        return;
                    }
                    crit.rangeDescription = `${crit.min} - ${maxStr || 'Infinity'}`;
                }
                cat.criteria.push(crit);
            });
        }

        if (isValid) {
            state.setScoringCriteria(newCriteria);
            saveStateForUndo();
            toggleScoringEditMode(false); // Switch back to view mode
            fullAppRender();
            showCustomAlert("Success", "Changes saved successfully.");
        } else {
            showCustomAlert("Validation Error", "Please check your input. Some fields may be invalid.");
        }
    } catch (error) {
        console.error("Error saving scoring criteria:", error);
        showCustomAlert("Error", "Failed to save changes. Please try again.");
    } finally {
        hideLoader();
        saveButton.disabled = false;
    }
}
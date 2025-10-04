// Shared helper and calculation functions
// js/dashboardView.js
// js/utils.js

import { products, machines, trainIdMap, scoringCriteria, productTypeHierarchy, safetyFactorConfig } from './state.js';

// --- TOXICITY PREFERENCE LOGIC ---
export function getToxicityPreference() {
    // Check if PDE is hidden in product register (this serves as the global preference)
    const pdeHidden = localStorage.getItem('productRegister-pdeHidden') === 'true';
    const ld50Hidden = localStorage.getItem('productRegister-ld50Hidden') === 'true';
    
    if (pdeHidden && !ld50Hidden) {
        return 'ld50'; // Only PDE hidden, use LD50
    } else if (!pdeHidden && ld50Hidden) {
        return 'pde'; // Only LD50 hidden, use PDE
    } else if (pdeHidden && ld50Hidden) {
        return 'pde'; // Both hidden, force use PDE in worst case view
    } else {
        return 'auto'; // Both visible (or no preference set), use auto mode (prefer PDE for calculation)
    }
}

// --- CENTRALIZED TRAIN LOGIC ---
export function generateTrainMap() {
    // Store existing train mappings to preserve them
    const existingTrainMap = new Map(trainIdMap);
    
    const trains = {}; // Key: JSON string of consolidated train path, Value: { products: [product IDs] }
    products.forEach(product => {
        if (product.machineIds && product.machineIds.length > 0) {
            // Get consolidated machine path based on groups
            const consolidatedPath = getConsolidatedTrainPath(product.machineIds);
            const key = JSON.stringify(consolidatedPath);
            if (!trains[key]) {
                trains[key] = { products: [] };
            }
            trains[key].products.push(product.id);
        }
    });

    // Clear the map but preserve existing assignments
    trainIdMap.clear();
    
    // Find the highest existing train ID to continue numbering from there
    let maxTrainId = 0;
    existingTrainMap.forEach(trainId => {
        if (trainId > maxTrainId) {
            maxTrainId = trainId;
        }
    });
    
    // First, restore existing train configurations with their original IDs
    const sortedTrainKeys = Object.keys(trains).sort(); // Sort keys for consistent numbering
    const newTrainKeys = []; // Track which keys are truly new
    
    sortedTrainKeys.forEach(key => {
        if (existingTrainMap.has(key)) {
            // This train configuration already existed, preserve its ID
            trainIdMap.set(key, existingTrainMap.get(key));
        } else {
            // This is a new train configuration, we'll assign it a new ID later
            newTrainKeys.push(key);
        }
    });
    
    // Now assign new IDs to truly new train configurations
    let trainCounter = maxTrainId + 1;
    newTrainKeys.forEach(key => {
        trainIdMap.set(key, trainCounter++);
    });
}

/**
 * Gets consolidated train path based on individual machines
 * @param {Array} machineIds - Array of machine IDs
 * @returns {Array} Consolidated path representing individual machines
 */
function getConsolidatedTrainPath(machineIds) {
    // Sort machine IDs to ensure consistent ordering
    const sortedMachineIds = [...machineIds].sort((a, b) => a - b);
    
    // Treat each machine individually - no grouping
    return sortedMachineIds.map(machineId => `machine:${machineId}`);
}

export function getProductTrainId(product) {
    if (!product.machineIds || product.machineIds.length === 0) {
        return 'N/A';
    }
    
    // Get consolidated path for this product
    const consolidatedPath = getConsolidatedTrainPath(product.machineIds);
    const key = JSON.stringify(consolidatedPath);
    
    return trainIdMap.get(key) || 'N/A';
}

/**
 * Get unique production line names from products.
 * Returns an array of unique, sorted line names including standard and custom lines.
 */
export function getUniqueProductLines() {
    // Standard line options that should always be available
    const standardLines = ['Solids', 'Semisolid', 'Liquids'];
    
    // Get custom lines from existing products
    const productLines = products.map(p => (p && p.line) ? String(p.line).trim() : null).filter(Boolean);
    const customLines = productLines.filter(line => !standardLines.includes(line));
    
    // Combine standard lines with unique custom lines
    const allLines = [...standardLines, ...new Set(customLines)].sort();
    
    // Always include "Shared" as an option for machines
    if (!allLines.includes('Shared')) {
        allLines.push('Shared');
    }
    
    return allLines;
}

/**
 * Get unique production line names from the machines array.
 * Falls back to product.line values if machines do not declare lines.
 * Returns an array of unique, sorted line names.
 */
export function getUniqueLinesFromMachines() {
    const machineLines = machines.map(m => (m && m.line) ? String(m.line).trim() : null).filter(Boolean);
    if (machineLines.length > 0) {
        return [...new Set(machineLines)].sort();
    }

    // Fallback to product lines
    return getUniqueProductLines();
}

/**
 * Build trains grouped by Production Line, then by Dosage Form.
 * Each train will have a sequential number (1..N) scoped to the Line and
 * a reference to the machines and products that belong to it.
 *
 * Returned format: [ { line: 'Line A', trains: [ { number: 1, dosageForm: 'Tablets', consolidatedPath, machineIds, products: [...] }, ... ] }, ... ]
 */
export function getTrainsGroupedByLine() {
    // collect all lines from products (use product.line or fallback)
    const linesSet = new Set();
    products.forEach(p => linesSet.add((p.line && String(p.line).trim()) || 'Unassigned'));
    const lines = Array.from(linesSet);

    const result = [];

    lines.forEach(lineName => {
        const productsInLine = products.filter(p => ((p.line && String(p.line).trim()) || 'Unassigned') === lineName && p.machineIds && p.machineIds.length > 0);

        // group by dosage form (productType)
        const byDosage = {};
        productsInLine.forEach(p => {
            const dtype = p.productType || 'Other';
            if (!byDosage[dtype]) byDosage[dtype] = [];
            byDosage[dtype].push(p);
        });

        // identify trains within each dosage group
        const trainsForLine = [];
        Object.keys(byDosage).forEach(dtype => {
            const map = {};
            byDosage[dtype].forEach(p => {
                const consolidatedPath = getConsolidatedTrainPath(p.machineIds);
                const key = JSON.stringify(consolidatedPath);
                if (!map[key]) {
                    map[key] = {
                        key,
                        dosageForm: dtype,
                        consolidatedPath,
                        machineIds: Array.from(new Set(p.machineIds)).sort((a,b)=>a-b),
                        products: []
                    };
                }
                map[key].products.push(p);
            });

            Object.values(map).forEach(t => trainsForLine.push(t));
        });

        // assign sequential numbers within the line
        trainsForLine.sort((a,b) => {
            if (a.dosageForm < b.dosageForm) return -1;
            if (a.dosageForm > b.dosageForm) return 1;
            return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
        });

        let counter = 1;
        trainsForLine.forEach(t => {
            t.line = lineName;
            t.number = counter++;
            // Attach existing train id if available (preserve legacy ids)
            t.id = trainIdMap.get(t.key) || null;
        });

        result.push({ line: lineName, trains: trainsForLine });
    });

    return result;
}

/**
 * Returns a mapping of legacy train id -> { line, number }
 * Useful for displaying user-friendly labels while preserving scalar ids for exports/prints.
 */
export function getTrainIdToLineNumberMap() {
    const map = new Map();
    const grouped = getTrainsGroupedByLine();
    grouped.forEach(lineObj => {
        lineObj.trains.forEach(t => {
            if (t.id !== null && t.id !== undefined) {
                map.set(String(t.id), { line: t.line, number: t.number });
            }
        });
    });
    return map;
}

// --- SCORING AND RATING LOGIC ---
export function calculateScores(ingredient, toxicityPreference = 'auto') { 
    const getScoreByExactMatch = (config, value) => { 
        const lowerValue = String(value || "").toLowerCase(); 
        const criterion = config.criteria.find(c => String(c.text || "").toLowerCase() === lowerValue); 
        return criterion ? criterion.score : config.defaultScore; 
    }; 
    const getScoreByRange = (config, value) => { 
        const numValue = parseFloat(value); 
        if (isNaN(numValue)) return config.defaultScore; 
        for (const c of config.criteria) { 
            if (c.comparison === "greater_exclusive" && numValue > c.lowerBound) return c.score; 
            if (c.comparison === "less_exclusive" && numValue < c.upperBound) return c.score; 
            if (c.comparison === "between_inclusive_both" && numValue >= c.lowerBound && numValue <= c.upperBound) return c.score; 
            if (c.comparison === "less_inclusive" && numValue <= c.upperBound) return c.score; 
            if (c.comparison === "between_exclusive_lower_inclusive_upper" && numValue > c.lowerBound && numValue <= c.upperBound) return c.score; 
        } 
        return config.defaultScore; 
    }; 
    
    const solubilityScore = getScoreByExactMatch(scoringCriteria.solubility, ingredient.solubility); 
    const therapeuticDoseScore = getScoreByRange(scoringCriteria.therapeuticDose, ingredient.therapeuticDose); 
    const cleanabilityScore = getScoreByExactMatch(scoringCriteria.cleanability, ingredient.cleanability); 
    
    let toxicityScore, pdeScore, ld50Score; 
    if (ingredient.pde !== null && !isNaN(ingredient.pde)) { 
        pdeScore = getScoreByRange(scoringCriteria.toxicityPde, ingredient.pde); 
    } 
    if (ingredient.ld50 !== null && !isNaN(ingredient.ld50)) { 
        ld50Score = getScoreByRange(scoringCriteria.toxicityLd50, ingredient.ld50); 
    } 
    
    // Apply toxicity preference logic
    if (toxicityPreference === 'ld50') {
        // Force use of LD50 if available
        if (ld50Score !== undefined) { 
            toxicityScore = ld50Score; 
        } else if (pdeScore !== undefined) { 
            toxicityScore = pdeScore; 
        } else { 
            toxicityScore = 1; 
        }
    } else if (toxicityPreference === 'pde') {
        // Force use of PDE if available
        if (pdeScore !== undefined) { 
            toxicityScore = pdeScore; 
        } else if (ld50Score !== undefined) { 
            toxicityScore = ld50Score; 
        } else { 
            toxicityScore = 1; 
        }
    } else {
        // Auto mode - prefer PDE over LD50 (original behavior)
        if (pdeScore !== undefined) { 
            toxicityScore = pdeScore; 
        } else if (ld50Score !== undefined) { 
            toxicityScore = ld50Score; 
        } else { 
            toxicityScore = 1; 
        }
    }
    
    const rpn = solubilityScore * therapeuticDoseScore * cleanabilityScore * toxicityScore; 
    const rpnRatingText = getRpnRatingText(rpn); 
    return { rpn, pdeScore, ld50Score, solubilityScore, therapeuticDoseScore, cleanabilityScore, rpnRatingText }; 
}

export const getRpnRatingText = (rpnValue) => { 
    const rpnConfig = scoringCriteria.rpnRating; 
    
    if (!rpnConfig || !rpnConfig.criteria) {
        return "N/A"; 
    }
    
    for (const c of rpnConfig.criteria) { 
        const min = parseFloat(c.min); 
        const max = c.max === null || c.max === undefined ? Infinity : parseFloat(c.max); 
        
        if (rpnValue >= min && rpnValue <= max) { 
            return c.rating; 
        } 
    } 
    
    return "N/A"; 
};

export const getRpnRatingClass = (ratingText) => { 
    switch(String(ratingText).toLowerCase()) { 
        case 'low': return 'rpn-low'; 
        case 'medium': return 'rpn-medium'; 
        case 'high': return 'rpn-high'; 
        default: return 'rpn-default'; 
    } 
};

export const debugRpnRating = (rpnValue) => {
    console.log('=== DEBUG RPN RATING ===');
    console.log('RPN Value:', rpnValue);
    console.log('RPN Config:', scoringCriteria.rpnRating);
    
    const rpnConfig = scoringCriteria.rpnRating;
    if (!rpnConfig) {
        console.log('ERROR: rpnConfig is undefined or null');
        return;
    }
    
    if (!rpnConfig.criteria) {
        console.log('ERROR: rpnConfig.criteria is undefined or null');
        return;
    }
    
    console.log('Available criteria:', rpnConfig.criteria);
    
    rpnConfig.criteria.forEach((c, index) => {
        console.log(`Criteria ${index}:`, {
            min: c.min,
            max: c.max,
            rating: c.rating,
            minParsed: parseFloat(c.min),
            maxParsed: parseFloat(c.max),
            rangeCheck: `${rpnValue} >= ${parseFloat(c.min)} && ${rpnValue} <= ${parseFloat(c.max)}`,
            result: rpnValue >= parseFloat(c.min) && rpnValue <= parseFloat(c.max)
        });
    });
    
    console.log('=== END DEBUG ===');
};

// --- DATA AGGREGATION FOR VIEWS ---
export function getTrainData() {
    const trains = {}; // key: stringified consolidated train path

    products.forEach(product => {
        if (product.machineIds && product.machineIds.length > 0) {
            // Use consolidated path based on groups
            const consolidatedPath = getConsolidatedTrainPath(product.machineIds);
            const key = JSON.stringify(consolidatedPath);
            if (!trains[key]) {
                trains[key] = {
                    key: key,
                    consolidatedPath: consolidatedPath,
                    machineIds: product.machineIds, // Keep original for compatibility
                    products: [],
                };
            } else {
                // Merge machine IDs from all products in this train
                const existingIds = new Set(trains[key].machineIds);
                product.machineIds.forEach(id => existingIds.add(id));
                trains[key].machineIds = Array.from(existingIds).sort((a, b) => a - b);
            }
            trains[key].products.push(product);
        }
    });

    const trainArray = Object.values(trains).map(train => {
        return { ...train, id: trainIdMap.get(train.key) };
    }).filter(train => train.id !== undefined);

    trainArray.sort((a, b) => a.id - b.id);

    if (trainArray.length === 0) return [];

    trainArray.forEach(train => {
        // Calculate ESSA using group-based consolidation for accuracy
        train.essa = getGroupedTrainSurfaceArea(train.machineIds);
        
        // Assign line based on the most common line among products in this train
        const productLines = train.products.map(p => p.line).filter(Boolean);
        if (productLines.length > 0) {
            // Find the most common line
            const lineCounts = {};
            productLines.forEach(line => {
                lineCounts[line] = (lineCounts[line] || 0) + 1;
            });
            train.line = Object.keys(lineCounts).reduce((a, b) => lineCounts[a] > lineCounts[b] ? a : b);
        } else {
            train.line = 'Unassigned';
        }

        let worstProductByRpn = null;
        let maxRpn = -1;
        train.products.forEach(p => {
            p.activeIngredients.forEach(ing => {
                const { rpn } = calculateScores(ing);
                if (rpn > maxRpn) {
                    maxRpn = rpn;
                    worstProductByRpn = { productName: p.name, ingredientName: ing.name, rpn: maxRpn, rating: getRpnRatingText(maxRpn) };
                }
            });
        });
        train.worstProductRpn = worstProductByRpn;

        let lowestLtd = Infinity;
        let lowestLtdProductId = -1;
        train.products.forEach(p => {
            p.activeIngredients.forEach(ing => {
                if (ing.therapeuticDose < lowestLtd) {
                    lowestLtd = ing.therapeuticDose;
                    lowestLtdProductId = p.id;
                }
            });
        });
        train.lowestLtd = lowestLtd;
        train.lowestLtdProductId = lowestLtdProductId;

        const productRatios = train.products.map(p => {
            const minRatioForProduct = Math.min(...p.activeIngredients.map(ing => (p.batchSizeKg * 1000) / (ing.mdd / 1000)));
            return { productId: p.id, ratio: minRatioForProduct };
        }).sort((a, b) => a.ratio - b.ratio);

        let minBsMddRatio;
        let minRatioProductId = -1;
        if (productRatios.length > 0) {
            const primaryMinRatioProduct = productRatios[0];
            if (primaryMinRatioProduct.productId === lowestLtdProductId && productRatios.length > 1) {
                const secondaryMinRatioProduct = productRatios[1];
                minBsMddRatio = secondaryMinRatioProduct.ratio;
                minRatioProductId = secondaryMinRatioProduct.productId;
            } else {
                minBsMddRatio = primaryMinRatioProduct.ratio;
                minRatioProductId = primaryMinRatioProduct.productId;
            }
        } else {
            minBsMddRatio = Infinity;
        }
        train.minBsMddRatio = minBsMddRatio;
        train.minRatioProductId = minRatioProductId;
        
        const productWithMinBatchSize = train.products.reduce((minP, currentP) =>
            currentP.batchSizeKg < minP.batchSizeKg ? currentP : minP, train.products[0]);
        train.minMbsKg = productWithMinBatchSize.batchSizeKg;
        train.minMbsProductId = productWithMinBatchSize.id;

        const pdeValues = train.products.flatMap(p => p.activeIngredients).map(i => i.pde).filter(pde => pde != null);
        train.lowestPde = pdeValues.length > 0 ? Math.min(...pdeValues) : null;
        
        const ld50Values = train.products.flatMap(p => p.activeIngredients).map(i => i.ld50).filter(ld50 => ld50 != null);
        train.lowestLd50 = ld50Values.length > 0 ? Math.min(...ld50Values) : null;
        
        train.assumedSsa = 25;
    });
    
    return trainArray;
}

export function getWorstCaseProductType(types) {
    for (const type of productTypeHierarchy) {
        if (types.includes(type)) {
            return type;
        }
    }
    const uniqueTypes = [...new Set(types)];
    const nonStandardType = uniqueTypes.find(t => !productTypeHierarchy.includes(t));
    if (nonStandardType) return nonStandardType;

    return 'Other'; 
}

// Helper function to calculate largest ESSA for trains in the same line and dosage form
export function getLargestEssaForLineAndDosageForm(targetTrain, allTrains) {
    // Get the line and dosage form of the target train
    const targetLine = targetTrain.line;
    const targetDosageForms = [...new Set(targetTrain.products.map(p => p.productType || 'Other'))];
    
    // Filter trains that are in the same line and have overlapping dosage forms
    const sameLineAndDosageTrains = allTrains.filter(train => {
        const trainLine = train.line;
        const trainDosageForms = [...new Set(train.products.map(p => p.productType || 'Other'))];
        
        // Check if train is in same line and has any overlapping dosage forms
        const sameLineCheck = trainLine === targetLine;
        const overlappingDosageForm = targetDosageForms.some(df => trainDosageForms.includes(df));
        
        return sameLineCheck && overlappingDosageForm;
    });
    
    // Return the largest ESSA from filtered trains
    return sameLineAndDosageTrains.length > 0 ? Math.max(...sameLineAndDosageTrains.map(t => t.essa)) : 0;
}

export function getMacoPerSwabForTrain(train, largestEssa) {
    const sfConfig = safetyFactorConfig[getWorstCaseProductType(train.products.map(p => p.productType))] || safetyFactorConfig['Other'];
    const sf = sfConfig.max;
    
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

// --- SELECT POPULATION ---
export function populateSelectWithOptions(select, criteriaKey, addAllOption = false, optionsArray = null) { 
    if (!select) return;
    select.innerHTML = '';
    
    if (addAllOption) {
        select.innerHTML = `<option value="all">All</option>`;
    } else {
        select.innerHTML = `<option value="" disabled selected>Select...</option>`;
    }

    let uniqueOptions;
    if (optionsArray) {
        uniqueOptions = [...new Set(optionsArray)];
    } else {
        const config = scoringCriteria[criteriaKey];
        if (!config) return;
        uniqueOptions = [...new Set(config.criteria.map(c => c.text))];
    }
    
    uniqueOptions.forEach(text => {
        select.innerHTML += `<option value="${text}">${text}</option>`;
    });
}

// --- MACHINE GROUPING UTILITIES ---
/**
 * Consolidates machines by their groups for train path calculations
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {Array} Array of consolidated machine representations
 */
export function consolidateMachinesByGroup(machineIds) {
    const consolidated = [];
    const machineMap = new Map();
    
    // Group machines by their group property
    machineIds.forEach(machineId => {
        const machine = machines.find(m => m.id === machineId);
        if (!machine) return;
        
        const groupKey = machine.group || `individual_${machine.id}`;
        
        if (!machineMap.has(groupKey)) {
            machineMap.set(groupKey, {
                group: machine.group || null,
                machines: [],
                maxArea: 0,
                representativeMachine: machine
            });
        }
        
        const groupData = machineMap.get(groupKey);
        groupData.machines.push(machine);
        
        // Track the machine with the largest surface area in the group
        if (machine.area > groupData.maxArea) {
            groupData.maxArea = machine.area;
            groupData.representativeMachine = machine;
        }
    });
    
    // Convert to array format
    machineMap.forEach((groupData, groupKey) => {
        if (groupData.group) {
            // Grouped machines - use worst case (largest area)
            consolidated.push({
                id: `group_${groupData.group}`,
                name: `${groupData.group} (Group)`,
                group: groupData.group,
                area: groupData.maxArea,
                stage: groupData.representativeMachine.stage,
                isGroup: true,
                machineCount: groupData.machines.length,
                machines: groupData.machines
            });
        } else {
            // Individual machine
            consolidated.push({
                ...groupData.representativeMachine,
                isGroup: false,
                machineCount: 1,
                machines: [groupData.representativeMachine]
            });
        }
    });
    
    return consolidated;
}

/**
 * Gets the total surface area for all machines in a train path
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {number} Total surface area of all machines
 */
export function getGroupedTrainSurfaceArea(machineIds) {
    // Calculate total surface area of all individual machines (no grouping)
    return machineIds.reduce((total, machineId) => {
        const machine = machines.find(m => m.id === machineId);
        return total + (machine ? machine.area : 0);
    }, 0);
}

/**
 * Gets detailed information about machine groups in a train path
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {Object} Detailed grouping information
 */
export function getTrainGroupingDetails(machineIds) {
    // Since we're not using grouping anymore, treat all machines as individuals
    const groupDetails = {
        totalMachines: machineIds.length,
        consolidatedUnits: machineIds.length, // Same as total machines since no grouping
        groups: [],
        individuals: [],
        totalSurfaceArea: 0,
        worstCaseOptimization: 0
    };
    
    // Calculate surface area for all individual machines
    machineIds.forEach(machineId => {
        const machine = machines.find(m => m.id === machineId);
        if (machine) {
            groupDetails.totalSurfaceArea += machine.area;
            groupDetails.individuals.push({
                id: machine.id,
                name: machine.name,
                area: machine.area
            });
        }
    });
    
    // No optimization since we're using all individual machines
    groupDetails.worstCaseOptimization = 0;
    
    return groupDetails;
}

/**
 * Formats group information for display in train tables
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {string} Formatted HTML string for display
 */
export function formatTrainGroupDisplay(machineIds) {
    // Display individual machines (no grouping)
    return machineIds.map(machineId => {
        const machine = machines.find(m => m.id === machineId);
        const machineName = machine ? machine.name : `Unknown (ID: ${machineId})`;
        const machineArea = machine ? machine.area : 0;
        return `<span class="individual-machine" title="Machine: ${machineName} - Area: ${machineArea.toLocaleString()} cm²">${machineName}</span>`;
    }).join(' → ');
}
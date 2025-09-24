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
 * Gets consolidated train path based on machine groups
 * @param {Array} machineIds - Array of machine IDs
 * @returns {Array} Consolidated path representing groups and individual machines
 */
function getConsolidatedTrainPath(machineIds) {
    const consolidatedPath = [];
    const processedGroups = new Set();
    
    // Sort machine IDs to ensure consistent ordering
    const sortedMachineIds = [...machineIds].sort((a, b) => a - b);
    
    sortedMachineIds.forEach(machineId => {
        const machine = machines.find(m => m.id === machineId);
        if (!machine) return;
        
        if (machine.group && machine.group !== '') {
            // Machine belongs to a group
            if (!processedGroups.has(machine.group)) {
                // First time seeing this group, add it to the path
                consolidatedPath.push(`group:${machine.group}`);
                processedGroups.add(machine.group);
            }
            // If we've already processed this group, don't add it again
        } else {
            // Individual machine (no group)
            consolidatedPath.push(`machine:${machineId}`);
        }
    });
    
    return consolidatedPath.sort(); // Sort for consistent train identification
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

export function getMacoPerSwabForTrain(train, globalLargestEssa) {
    const sfConfig = safetyFactorConfig[getWorstCaseProductType(train.products.map(p => p.productType))] || safetyFactorConfig['Other'];
    const sf = sfConfig.max;
    
    const macoDose = (train.lowestLtd * train.minBsMddRatio) / sf;
    const maco10ppm = 10 * train.minMbsKg;
    let macoHealth = Infinity;
    if (train.lowestPde !== null) {
        macoHealth = train.lowestPde * train.minBsMddRatio;
    }
    const macoVisual = (0.004) * globalLargestEssa;

    const finalMaco = Math.min(macoDose, maco10ppm, macoHealth, macoVisual);
    const macoPerArea = globalLargestEssa > 0 ? finalMaco / globalLargestEssa : 0;
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
 * Gets the worst-case surface area for grouped machines in a train path
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {number} Total worst-case surface area
 */
export function getGroupedTrainSurfaceArea(machineIds) {
    const consolidatedMachines = consolidateMachinesByGroup(machineIds);
    return consolidatedMachines.reduce((total, machine) => total + machine.area, 0);
}

/**
 * Gets detailed information about machine groups in a train path
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {Object} Detailed grouping information
 */
export function getTrainGroupingDetails(machineIds) {
    const consolidatedMachines = consolidateMachinesByGroup(machineIds);
    const groupDetails = {
        totalMachines: machineIds.length,
        consolidatedUnits: consolidatedMachines.length,
        groups: [],
        individuals: [],
        totalSurfaceArea: 0,
        worstCaseOptimization: 0
    };
    
    let originalSurfaceArea = 0;
    
    // Calculate original surface area without grouping
    machineIds.forEach(machineId => {
        const machine = machines.find(m => m.id === machineId);
        if (machine) {
            originalSurfaceArea += machine.area;
        }
    });
    
    // Analyze consolidated machines
    consolidatedMachines.forEach(machine => {
        groupDetails.totalSurfaceArea += machine.area;
        
        if (machine.isGroup) {
            groupDetails.groups.push({
                name: machine.group,
                machineCount: machine.machineCount,
                worstCaseArea: machine.area,
                machines: machine.machines.map(m => ({ id: m.id, name: m.name, area: m.area }))
            });
        } else {
            groupDetails.individuals.push({
                id: machine.id,
                name: machine.name,
                area: machine.area
            });
        }
    });
    
    groupDetails.worstCaseOptimization = originalSurfaceArea - groupDetails.totalSurfaceArea;
    
    return groupDetails;
}

/**
 * Formats group information for display in train tables
 * @param {Array} machineIds - Array of machine IDs in the train path
 * @returns {string} Formatted HTML string for display
 */
export function formatTrainGroupDisplay(machineIds) {
    const consolidatedMachines = consolidateMachinesByGroup(machineIds);
    
    return consolidatedMachines.map(machine => {
        if (machine.isGroup) {
            return `<span class="group-indicator" title="Group: ${machine.group} (${machine.machineCount} machines, worst-case area: ${machine.area.toLocaleString()} cm²)">
                <strong>${machine.group}</strong> <em>(${machine.machineCount}x)</em>
            </span>`;
        } else {
            return `<span class="individual-machine" title="Individual machine: ${machine.name}">${machine.name}</span>`;
        }
    }).join(' → ');
}
// All global state variables
// js/state.js

// --- GLOBAL STATE ---
export let products = [
    { id: 1, productCode: "1ATC50001AP", name: "Acetaminophen 500mg", batchSizeKg: 51.08, date: "2023-01-15T10:00:00.000Z", isCritical: false, criticalReason: '', productType: 'Tablets', line: 'Solids Line A', machineIds: [1, 2, 6, 11, 13, 16], activeIngredients: [{ id: 1, name: "Acetaminophen", therapeuticDose: 500, mdd: 4000, solubility: "Freely soluble", cleanability: "Easy", pde: 12.5, ld50: 1944 }] },
    { id: 2, productCode: "2IBU20011PN", name: "Ibuprofen 200mg", batchSizeKg: 113.51, date: "2023-02-20T10:00:00.000Z", isCritical: false, criticalReason: '', productType: 'Tablets', line: 'Solids Line A', machineIds: [1, 3, 4, 12, 16], activeIngredients: [{ id: 2, name: "Ibuprofen", therapeuticDose: 200, mdd: 1200, solubility: "Practically insoluble", cleanability: "Medium", pde: 1.2, ld50: 636 }] },
    { id: 3, productCode: "3CFR18003MX", name: "Cold & Flu Relief", batchSizeKg: 180, date: "2023-03-10T10:00:00.000Z", isCritical: true, criticalReason: 'Stains equipment yellow', productType: 'Tablets', line: 'Solids Line B', machineIds: [1, 8, 16], activeIngredients: [ { id: 3, name: "Acetaminophen", therapeuticDose: 650, mdd: 3900, solubility: "Freely soluble", cleanability: "Easy", pde: 12.5, ld50: 1944 }, { id: 4, name: "Phenylephrine HCl", therapeuticDose: 10, mdd: 60, solubility: "Very soluble", cleanability: "Easy", pde: 0.6, ld50: 350 }, { id: 5, name: "Dextromethorphan HBr", therapeuticDose: 30, mdd: 120, solubility: "Slightly soluble", cleanability: "Medium", pde: 1.0, ld50: 750 } ] },
    { id: 4, productCode: "4ASA32504AC", name: "Aspirin 325mg", batchSizeKg: 75.5, date: "2023-04-05T10:00:00.000Z", isCritical: false, criticalReason: '', productType: 'Tablets', line: 'Solids Line A', machineIds: [1, 4, 7, 12, 16], activeIngredients: [{ id: 6, name: "Aspirin", therapeuticDose: 325, mdd: 4000, solubility: "Slightly soluble", cleanability: "Medium", pde: 0.5, ld50: null }] },
    { id: 5, productCode: "5OME02005PR", name: "Omeprazole 20mg", batchSizeKg: 25.2, date: "2023-05-25T10:00:00.000Z", isCritical: true, criticalReason: 'New API', productType: 'Capsules', line: 'Capsules Line', machineIds: [1, 5, 9, 14, 15], activeIngredients: [{ id: 7, name: "Omeprazole", therapeuticDose: 20, mdd: 40, solubility: "Practically insoluble", cleanability: "Hard", pde: 0.013, ld50: null }] },
    { id: 6, productCode: "6PCX00506XP", name: "Potent Compound X", batchSizeKg: 5.0, date: "2023-06-30T10:00:00.000Z", isCritical: false, criticalReason: '', productType: 'Sterile Products', line: 'Sterile Line', machineIds: [1, 10, 16], activeIngredients: [{ id: 8, name: "Potent Compound X", therapeuticDose: 1, mdd: 2, solubility: "Slightly soluble", cleanability: "Hard", pde: 0.0005, ld50: 25 }] },
];

export let machines = [
    { 
        id: 1, 
        machineNumber: 'M-001', 
        name: "weighing tool", 
        stage: "Weighing", 
        area: 55000, 
        group: "", 
        line: "Shared", 
        cleaningSOP: { sopName: 'SOP-001', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null },
        sampleLocations: [
            { location: "Scale Platform", material: "Stainless steel", area: 2500, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 1, visibility: 1 },
            { location: "Load Cell Area", material: "Stainless steel", area: 800, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 2 },
            { location: "Display Unit", material: "Plastic/Steel", area: 400, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 1, visibility: 1 },
            { location: "Calibration Weights Holder", material: "Stainless steel", area: 600, hardToClean: 2, accessibilityForCleaning: 1, accessibilityForSampling: 2, visibility: 2 }
        ]
    },
    { 
        id: 2, 
        machineNumber: 'M-002', 
        name: "nin mill", 
        stage: "Milling", 
        area: 35000, 
        group: "", 
        line: "Solids Line A", 
        cleaningSOP: { sopName: 'SOP-002', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null },
        sampleLocations: [
            { location: "Left blade edge", material: "Stainless steel", area: 3136, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 2, visibility: 1 },
            { location: "Blade holder surface", material: "Stainless steel", area: 2000, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 3 },
            { location: "Blades box inside", material: "Stainless steel", area: 1500, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 1, visibility: 2 },
            { location: "Right blade edge", material: "Stainless steel", area: 3136, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 2, visibility: 1 },
            { location: "Nin mill Stainless Steel sieve", material: "Stainless steel", area: 1904, hardToClean: 3, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 3 },
            { location: "External Hopper", material: "Stainless steel", area: 5596, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 1, visibility: 3 },
            { location: "Inlet Hopper", material: "Stainless steel", area: 3000, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 3 },
            { location: "Inlet Valve", material: "Stainless steel", area: 800, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 2 },
            { location: "Discharge Tube", material: "Stainless steel", area: 1200, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 1, visibility: 2 },
            { location: "Wall", material: "_", area: null, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 1, visibility: 1 }
        ]
    },
    { id: 3, machineNumber: 'M-003', name: "fitz mill", stage: "Milling", area: 42000, group: "", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-003', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { 
        id: 4, 
        machineNumber: 'M-004', 
        name: "FBD", 
        stage: "Mixing", 
        area: 120000, 
        group: "", 
        line: "Solids Line A", 
        cleaningSOP: { sopName: 'SOP-004', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null },
        sampleLocations: [
            { location: "Product Bowl Interior", material: "Stainless steel", area: 8500, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 1, visibility: 2 },
            { location: "Air Distribution Plate", material: "Stainless steel", area: 1200, hardToClean: 3, accessibilityForCleaning: 3, accessibilityForSampling: 2, visibility: 3 },
            { location: "Expansion Chamber", material: "Stainless steel", area: 4500, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 2 },
            { location: "Filter Bags", material: "Polyester/PTFE", area: 2400, hardToClean: 3, accessibilityForCleaning: 2, accessibilityForSampling: 1, visibility: 2 },
            { location: "Inlet Air Ducts", material: "Stainless steel", area: 1800, hardToClean: 2, accessibilityForCleaning: 3, accessibilityForSampling: 3, visibility: 3 },
            { location: "Discharge Valve", material: "Stainless steel", area: 600, hardToClean: 2, accessibilityForCleaning: 2, accessibilityForSampling: 2, visibility: 2 },
            { location: "Product Container", material: "Stainless steel", area: 3200, hardToClean: 1, accessibilityForCleaning: 1, accessibilityForSampling: 1, visibility: 1 }
        ]
    },
    { id: 5, machineNumber: 'M-005', name: "Glatt", stage: "Mixing", area: 95000, group: "", line: "Capsules Line", cleaningSOP: { sopName: 'SOP-005', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 6, machineNumber: 'M-006', name: "Compactor", stage: "Mixing", area: 85000, group: "", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-006', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 7, machineNumber: 'M-007', name: "Bin 200", stage: "Mixing", area: 45000, group: "Mixing Bins", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-007', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 8, machineNumber: 'M-008', name: "Bin 400", stage: "Mixing", area: 65000, group: "Mixing Bins", line: "Solids Line B", cleaningSOP: { sopName: 'SOP-008', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 9, machineNumber: 'M-009', name: "Bin 600", stage: "Mixing", area: 85000, group: "Mixing Bins", line: "Capsules Line", cleaningSOP: { sopName: 'SOP-009', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 10, machineNumber: 'M-010', name: "Bin 800", stage: "Mixing", area: 105000, group: "Mixing Bins", line: "Sterile Line", cleaningSOP: { sopName: 'SOP-010', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 11, machineNumber: 'M-011', name: "Jcmco", stage: "Compression", area: 150000, group: "Compression Machines", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-011', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 12, machineNumber: 'M-012', name: "Natoli", stage: "Compression", area: 165000, group: "Compression Machines", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-012', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 13, machineNumber: 'M-013', name: "Korsch", stage: "Compression", area: 180000, group: "Compression Machines", line: "Solids Line A", cleaningSOP: { sopName: 'SOP-013', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 14, machineNumber: 'M-014', name: "Coat", stage: "Coating", area: 110000, group: "", line: "Capsules Line", cleaningSOP: { sopName: 'SOP-014', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 15, machineNumber: 'M-015', name: "jar filling", stage: "Filling", area: 75000, group: "", line: "Capsules Line", cleaningSOP: { sopName: 'SOP-015', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] },
    { id: 16, machineNumber: 'M-016', name: "Bliste", stage: "Packing", area: 220000, group: "", line: "Shared", cleaningSOP: { sopName: 'SOP-016', attachmentType: 'none', attachmentValue: null, fileName: null, fileData: null }, sampleLocations: [] }
];

export let machineStageDisplayOrder = ['Weighing', 'Mixing', 'Compression', 'Coating', 'Filling', 'Checking', 'Labeling', 'Packing', 'Other'];

// Machine group options for grouping similar machines
export let machineGroups = [
    'Mixing Bins',
    'Compression Machines', 
    'Milling Equipment',
    'Granulators',
    'Coating Equipment',
    'Packaging Equipment',
    'Weighing Equipment',
    'Filling Equipment'
];

export let detergentIngredients = [{ id: 1, name: 'Default Detergent', ld50: 5000 }];
export let nextDetergentIngredientId = 2;

// Route-based Safety Factors Configuration
export const routeSafetyFactors = {
    parenteral: { min: 1000, max: 10000, route: 'Parenteral', riskLevel: 'Very High' },
    inhalation: { min: 1000, max: 10000, route: 'Inhalation', riskLevel: 'Very High' },
    ophthalmic: { min: 1000, max: 10000, route: 'Ophthalmic', riskLevel: 'Very High' },
    nasal:      { min: 1000, max: 10000, route: 'Nasal', riskLevel: 'Very High' },
    oral:       { min: 100,  max: 1000,  route: 'Oral', riskLevel: 'Standard' },
    rectal:     { min: 100,  max: 1000,  route: 'Rectal', riskLevel: 'Standard' },
    topical:    { min: 10,   max: 100,   route: 'Topical', riskLevel: 'Low' }
};

// Dosage Form to Route Mapping
export const dosageFormToRouteMap = {
    // Parenteral
    'Ampoules': 'parenteral',
    'Vials': 'parenteral',
    'Injections': 'parenteral',
    'Sterile Products': 'parenteral',
    
    // Oral
    'Tablets': 'oral',
    'Capsules': 'oral',
    'Liquids': 'oral',
    'Powder': 'oral',
    
    // Topical
    'Cream': 'topical',
    'Ointment': 'topical',
    'Gel': 'topical',
    'Lotion': 'topical',
    'Semisolids': 'topical',
    
    // Ophthalmic
    'Sterile Ointment': 'ophthalmic',
    'Eye Drops': 'ophthalmic',
    
    // Inhalation
    'Spray': 'inhalation',
    'Powder for Inhalation': 'inhalation',
    
    // Rectal
    'Suppository': 'rectal'
};

// Helper function to intelligently detect route from dosage form name using keywords
function detectRouteFromDosageForm(dosageForm) {
    if (!dosageForm) return null;
    
    const formLower = dosageForm.toLowerCase().trim();
    
    // Parenteral keywords (Very High Risk)
    const parenteralKeywords = ['injection', 'injectable', 'ampoule', 'ampule', 'vial', 'sterile product', 'sterile solution', 'sterile suspension', 'infusion', 'parenteral'];
    if (parenteralKeywords.some(keyword => formLower.includes(keyword))) {
        return 'parenteral';
    }
    
    // Ophthalmic keywords (Very High Risk)
    const ophthalmicKeywords = ['eye drop', 'ophthalmic', 'ocular', 'ophthalmic solution', 'ophthalmic suspension', 'sterile ointment'];
    if (ophthalmicKeywords.some(keyword => formLower.includes(keyword))) {
        return 'ophthalmic';
    }
    
    // Inhalation keywords (Very High Risk)
    const inhalationKeywords = ['inhalation', 'inhaler', 'spray', 'nebulizer', 'powder for inhalation', 'aerosol'];
    if (inhalationKeywords.some(keyword => formLower.includes(keyword))) {
        return 'inhalation';
    }
    
    // Nasal keywords (Very High Risk)
    const nasalKeywords = ['nasal', 'nose', 'nasal spray', 'nasal drop'];
    if (nasalKeywords.some(keyword => formLower.includes(keyword))) {
        return 'nasal';
    }
    
    // Topical keywords (Standard Risk)
    const topicalKeywords = ['cream', 'ointment', 'gel', 'lotion', 'semisolid', 'topical', 'dermal', 'cutaneous', 'emulsion', 'paste'];
    if (topicalKeywords.some(keyword => formLower.includes(keyword))) {
        return 'topical';
    }
    
    // Rectal keywords (Standard Risk)
    const rectalKeywords = ['suppository', 'rectal', 'enema'];
    if (rectalKeywords.some(keyword => formLower.includes(keyword))) {
        return 'rectal';
    }
    
    // Oral keywords (Standard Risk) - check last as it's the most common
    const oralKeywords = ['tablet', 'capsule', 'liquid', 'syrup', 'suspension', 'solution', 'powder', 'oral', 'pill', 'dragee', 'lozenge', 'chewable', 'granule', 'sachet'];
    if (oralKeywords.some(keyword => formLower.includes(keyword))) {
        return 'oral';
    }
    
    return null;
}

// Helper function to get safety factor config from dosage form
export function getSafetyFactorForDosageForm(dosageForm) {
    if (!dosageForm) {
        // Default to oral if no dosage form provided
        return routeSafetyFactors.oral;
    }
    
    // First, check exact match in the predefined map
    const routeKey = dosageFormToRouteMap[dosageForm];
    if (routeKey && routeSafetyFactors[routeKey]) {
        return routeSafetyFactors[routeKey];
    }
    
    // If not found, use intelligent detection based on keywords
    const detectedRoute = detectRouteFromDosageForm(dosageForm);
    if (detectedRoute && routeSafetyFactors[detectedRoute]) {
        return routeSafetyFactors[detectedRoute];
    }
    
    // Fallback to oral if no match found
    return routeSafetyFactors.oral;
}

// Legacy safetyFactorConfig for backward compatibility (deprecated - use getSafetyFactorForDosageForm instead)
export const safetyFactorConfig = {
    'Sterile Products': routeSafetyFactors.parenteral,
    'Semisolids': routeSafetyFactors.topical,
    'Tablets': routeSafetyFactors.oral,
    'Capsules': routeSafetyFactors.oral,
    'Liquids': routeSafetyFactors.oral,
    'Suppository': routeSafetyFactors.rectal,
    'Sterile Ointment': routeSafetyFactors.ophthalmic,
    'Spray': routeSafetyFactors.inhalation,
    'Ampoules': routeSafetyFactors.parenteral,
    'Vials': routeSafetyFactors.parenteral,
    'Injections': routeSafetyFactors.parenteral,
    'Cream': routeSafetyFactors.topical,
    'Ointment': routeSafetyFactors.topical,
    'Gel': routeSafetyFactors.topical,
    'Lotion': routeSafetyFactors.topical,
};

export const productTypeHierarchy = [
    // Sterile products (highest priority)
    'Ampoules', 'Vials', 'Injections', 'Sterile Products', 
    // Semisolids
    'Cream', 'Ointment', 'Gel', 'Lotion', 'Semisolids',
    // Oral solids
    'Tablets', 'Capsules', 
    // Liquids
    'Liquids',
    // Specialized
    'Suppository', 'Sterile Ointment', 'Spray',
    // Fallback
    'Other'
];

export let viewProducts = {
    productRegister: [],
    worstCaseProducts: []
};

// Dynamically initialize IDs to prevent collisions with sample data
export let nextProductId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
export let nextIngredientId = products.length > 0 ? Math.max(...products.flatMap(p => p.activeIngredients.map(i => i.id))) + 1 : 1;
export let nextMachineId = machines.length > 0 ? Math.max(...machines.map(m => m.id)) + 1 : 1;
export let ingredientFormCounter = 0;
export let rpnChartInstance;
export let macoChartInstance;
export let scoringInEditMode = false;
export let sortState = { key: 'rpn', direction: 'desc' };
export let machineSortState = { key: 'name', direction: 'asc' };
export let activeTabId = 'dashboard';
export let trainIdMap = new Map();

// --- Undo/Redo State Management ---
export let history = [];
export let historyIndex = -1;

export let scoringCriteria = {
    solubility: { title: "Solubility Rating", defaultScore: 3, type: "exactMatch", criteria: [ { text: "Very soluble", score: 1 }, { text: "Freely soluble", score: 2 }, { text: "Soluble", score: 3 }, { text: "Sparingly soluble", score: 4 }, { text: "Slightly soluble", score: 5 }, { text: "Very slightly soluble", score: 6 }, { text: "Practically insoluble", score: 7 }, { text: "Insoluble", score: 7 } ] },
    therapeuticDose: { title: "Therapeutic Dose Rating", defaultScore: 3, type: "range", criteria: [ { text: ">1000 mg", score: 1, lowerBound: 1000, comparison: "greater_exclusive" }, { text: "100-1000 mg", score: 2, lowerBound: 100, upperBound: 1000, comparison: "between_inclusive_both" }, { text: "10-99 mg", score: 3, lowerBound: 10, upperBound: 99, comparison: "between_inclusive_both" }, { text: "1-9 mg", score: 4, lowerBound: 1, upperBound: 9, comparison: "between_inclusive_both" }, { text: "<1 mg", score: 5, upperBound: 1, comparison: "less_exclusive" } ] },
    cleanability: { title: "Cleanability Rating", defaultScore: 2, type: "exactMatch", criteria: [ { text: "Easy", score: 1 }, { text: "Medium", score: 2 }, { text: "Hard", score: 3 } ] },
    toxicityLd50: { title: "Toxicity Rating (LD50)", defaultScore: 3, type: "range", criteria: [ { text: ">5000 mg/kg", score: 1, lowerBound: 5000, comparison: "greater_exclusive" }, { text: "500-5000 mg/kg", score: 2, lowerBound: 500, upperBound: 5000, comparison: "between_inclusive_both" }, { text: "50-499 mg/kg", score: 3, lowerBound: 50, upperBound: 499, comparison: "between_inclusive_both" }, { text: "1-49 mg/kg", score: 4, lowerBound: 1, upperBound: 49, comparison: "between_inclusive_both" }, { text: "<1 mg/kg", score: 5, upperBound: 1, comparison: "less_exclusive" } ] },
    toxicityPde: { title: "PDE Rating (mg/day)", defaultScore: 3, type: "range", criteria: [ { text: "≤ 0.001", score: 10, upperBound: 0.001, comparison: "less_inclusive" }, { text: ">0.001 – ≤0.01", score: 9, lowerBound: 0.001, upperBound: 0.01, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">0.01 – ≤0.1", score: 8, lowerBound: 0.01, upperBound: 0.1, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">0.1 – ≤1", score: 7, lowerBound: 0.1, upperBound: 1, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">1 – ≤10", score: 6, lowerBound: 1, upperBound: 10, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">10 – ≤100", score: 5, lowerBound: 10, upperBound: 100, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">100 – ≤1000", score: 4, lowerBound: 100, upperBound: 1000, comparison: "between_exclusive_lower_inclusive_upper"}, { text: ">1000", score: 3, lowerBound: 1000, comparison: "greater_exclusive"} ] },
    hardToClean: { title: "Hard to Clean Rating", defaultScore: 2, type: "exactMatch", criteria: [ { text: "Low", score: 1 }, { text: "Medium", score: 2 }, { text: "High", score: 3 } ] },
    accessibility: { title: "Accessibility Rating", defaultScore: 2, type: "exactMatch", criteria: [ { text: "Low", score: 1 }, { text: "Medium", score: 2 }, { text: "High", score: 3 } ] },
    visibility: { title: "Visibility Rating", defaultScore: 2, type: "exactMatch", criteria: [ { text: "Low", score: 1 }, { text: "Medium", score: 2 }, { text: "High", score: 3 } ] },
    numberOfSamples: { title: "Number of Samples (RPN Based)", defaultScore: 1, type: "rpn_samples", criteria: [ { text: "1-27 RPN = 1 Sample", samples: 1, rpnMin: 1, rpnMax: 27 }, { text: "36-54 RPN = 2 Samples", samples: 2, rpnMin: 36, rpnMax: 54 }, { text: "81 RPN = 3 Samples", samples: 3, rpnMin: 81, rpnMax: 81 } ] },
    rpnRating: { title: "RPN Rating", type: "rpn_threshold", criteria: [ { rangeDescription: "1-20", rating: "Low", min: 1, max: 20 },{ rangeDescription: "21-50", rating: "Medium", min: 21, max: 50 },{ rangeDescription: "51 and more", rating: "High", min: 51, max: Infinity } ] }
};

export let scoringWasInEditModeForPrint = false;

// We need to re-assign the variables after importing to allow modification
export function setProducts(newProducts) { products = newProducts; }
export function setMachines(newMachines) { machines = newMachines; }
export function setDetergentIngredients(newIngredients) { detergentIngredients = newIngredients; }
export function setScoringCriteria(newCriteria) { scoringCriteria = newCriteria; }
export function setNextProductId(id) { nextProductId = id; }
export function setNextIngredientId(id) { nextIngredientId = id; }
export function setNextMachineId(id) { nextMachineId = id; }
export function setNextDetergentIngredientId(id) { nextDetergentIngredientId = id; }
export function setRpnChartInstance(instance) { rpnChartInstance = instance; }
export function setMacoChartInstance(instance) { macoChartInstance = instance; }
export function setScoringInEditMode(isEditing) { scoringInEditMode = isEditing; }
export function setSortState(state) { sortState = state; }
export function setMachineSortState(state) { machineSortState = state; }
export function setActiveTabId(id) { activeTabId = id; }
export function setHistory(newHistory, newIndex) { history = newHistory; historyIndex = newIndex; }
export function setMachineStageDisplayOrder(order) { machineStageDisplayOrder = order; }
export function setScoringWasInEditModeForPrint(wasEditing) { scoringWasInEditModeForPrint = wasEditing; }
export function setIngredientFormCounter(count) { ingredientFormCounter = count; }

/**
 * Ensure every product has a `line` property.
 * If missing, try to infer from productType (backwards-compatibility).
 * Call this once at app start (or after loading saved state).
 */
export function ensureProductsHaveLine() {
    if (!Array.isArray(exports.products) && !Array.isArray(window.state?.products) && !Array.isArray(products)) {
        // best-effort: check common names used in this project
    }

    // Attempt to access the products array from known exports/variables
    const prodHolder = (typeof state !== 'undefined' && state.products) ? state
                    : (typeof exports !== 'undefined' && exports.products) ? exports
                    : (typeof window !== 'undefined' && window.state && window.state.products) ? window.state
                    : null;
    if (!prodHolder) return;

    const products = prodHolder.products || [];
    let changed = false;

    const solids = ['Tablets', 'Capsules', 'Powder'];
    const semisolids = ['Ointment', 'Cream', 'Gel'];
    const liquids = ['Syrup', 'Solution', 'Suspension'];

    const migrated = products.map(p => {
        // if product already has a line (non-empty), keep as is
        if (p.line !== undefined && p.line !== null && p.line !== '') return p;
        const copy = Object.assign({}, p);
        if (copy.productType) {
            if (solids.includes(copy.productType)) copy.line = 'Solids';
            else if (semisolids.includes(copy.productType)) copy.line = 'Semisolid';
            else if (liquids.includes(copy.productType)) copy.line = 'Liquids';
            else copy.line = ''; // unknown/custom; leave empty so UI can set
        } else {
            copy.line = '';
        }
        changed = true;
        return copy;
    });

    if (changed) {
        // prefer exported setter if present
        if (typeof prodHolder.setProducts === 'function') {
            prodHolder.setProducts(migrated);
        } else {
            prodHolder.products = migrated;
        }
    }
}

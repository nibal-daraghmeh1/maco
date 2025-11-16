/**
 * Enhanced Intelligent Q&A System for Cleaning Validation
 * Advanced AI-powered question answering with sophisticated error handling,
 * performance optimization, and extensible architecture
 * 
 * @version 2.0
 * @author AI Assistant
 */

class QAView {
    constructor(appData, options = {}) {
        // Configuration with defaults
        this.config = {
            maxResponseTime: options.maxResponseTime || 5000,
            cacheEnabled: options.cacheEnabled !== false,
            debugMode: options.debugMode || false,
            confidenceThreshold: options.confidenceThreshold || 0.3,
            maxSuggestions: options.maxSuggestions || 5,
            ...options
        };

        // Initialize core components
        this.appData = this.validateAndNormalizeData(appData);
        this.cache = new Map();
        this.searchIndex = null;
        this.questionPatterns = [];
        this.analytics = {
            totalQuestions: 0,
            successfulAnswers: 0,
            failedAnswers: 0,
            averageResponseTime: 0,
            popularQuestions: new Map()
        };

        // Initialize system
        this.initialize().catch(error => {
            console.error('Q&A System initialization failed:', error);
        });
    }

    /**
     * Initialize the Q&A system with error handling
     */
    async initialize() {
        try {
            this.log('Initializing Enhanced Q&A System...');
            
            // Build search index with progress tracking
            await this.buildAdvancedSearchIndex();
            
            // Initialize question patterns
            this.initializeAdvancedPatterns();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            this.log('Q&A System initialized successfully');
        } catch (error) {
            this.handleError('Initialization failed', error);
            throw new Error(`Q&A System initialization failed: ${error.message}`);
        }
    }

    /**
     * Validate and normalize input data
     */
    validateAndNormalizeData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid app data: Expected object');
        }

        const normalized = {
            trains: [],
            products: [],
            machines: [],
            lines: [],
            dosageForms: [],
            selectedStudies: [],
            macoCalculations: [],
            metadata: {
                lastUpdated: new Date().toISOString(),
                version: '1.0',
                totalRecords: 0
            }
        };

        try {
            // Normalize trains data
            if (Array.isArray(data.trains)) {
                normalized.trains = data.trains.map((train, index) => ({
                    id: train.id || `T${index + 1}`,
                    line: this.sanitizeString(train.line) || 'Unknown Line',
                    dosageForm: this.sanitizeString(train.dosageForm) || 'Unknown Form',
                    products: Array.isArray(train.products) ? train.products.map(p => ({
                        name: this.sanitizeString(p.name) || `Product ${index}`,
                        rpn: this.sanitizeNumber(p.rpn) || 0,
                        machines: Array.isArray(p.machines) ? p.machines.filter(Boolean) : [],
                        maco: p.maco ? {
                            value: this.sanitizeNumber(p.maco.value) || 0,
                            unit: this.sanitizeString(p.maco.unit) || 'mg',
                            method: this.sanitizeString(p.maco.method) || 'Unknown',
                            safetyFactor: this.sanitizeNumber(p.maco.safetyFactor) || 1000,
                            calculatedAt: p.maco.calculatedAt || new Date().toISOString()
                        } : null,
                        properties: p.properties || {}
                    })) : [],
                    machines: Array.isArray(train.machines) ? train.machines.filter(Boolean) : [],
                    metadata: train.metadata || {}
                }));
            }

            // Extract and normalize other data types
            this.extractNormalizedData(normalized);
            
            // Update metadata
            normalized.metadata.totalRecords = this.calculateTotalRecords(normalized);
            
            return normalized;
        } catch (error) {
            this.handleError('Data normalization failed', error);
            return normalized; // Return empty structure to prevent crashes
        }
    }

    /**
     * Extract normalized data from trains
     */
    extractNormalizedData(normalized) {
        const uniqueProducts = new Set();
        const uniqueMachines = new Set();
        const uniqueLines = new Set();
        const uniqueDosageForms = new Set();

        normalized.trains.forEach(train => {
            uniqueLines.add(train.line);
            uniqueDosageForms.add(train.dosageForm);
            
            train.machines.forEach(machine => uniqueMachines.add(machine));
            
            train.products.forEach(product => {
                if (!uniqueProducts.has(product.name)) {
                    uniqueProducts.add(product.name);
                    normalized.products.push({
                        ...product,
                        trainId: train.id,
                        line: train.line,
                        dosageForm: train.dosageForm
                    });
                }
                
                product.machines.forEach(machine => uniqueMachines.add(machine));
            });
        });

        normalized.machines = Array.from(uniqueMachines).map(name => ({ name, usage: [] }));
        normalized.lines = Array.from(uniqueLines).map(name => ({ name, trains: [] }));
        normalized.dosageForms = Array.from(uniqueDosageForms).map(name => ({ name, trains: [] }));
    }

    /**
     * Build advanced search index with optimization
     */
    async buildAdvancedSearchIndex() {
        return new Promise((resolve, reject) => {
            try {
                this.searchIndex = {
                    products: new Map(),
                    trains: new Map(),
                    machines: new Map(),
                    lines: new Map(),
                    dosageForms: new Map(),
                    keywords: new Map(),
                    relationships: new Map(),
                    // Advanced indexes
                    rpnIndex: new Map(),
                    macoIndex: new Map(),
                    machineUsage: new Map(),
                    lineProducts: new Map()
                };

                // Build primary indexes
                this.buildPrimaryIndexes();
                
                // Build secondary indexes for advanced queries
                this.buildSecondaryIndexes();
                
                // Build keyword index for fuzzy matching
                this.buildKeywordIndex();
                
                // Build relationship index
                this.buildRelationshipIndex();

                this.log(`Search index built: ${this.getIndexStats()}`);
                resolve(this.searchIndex);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Build primary search indexes
     */
    buildPrimaryIndexes() {
        // Index trains
        this.appData.trains.forEach((train, index) => {
            this.searchIndex.trains.set(train.id, train);
            this.searchIndex.lines.set(train.line, 
                (this.searchIndex.lines.get(train.line) || []).concat(train));
            this.searchIndex.dosageForms.set(train.dosageForm,
                (this.searchIndex.dosageForms.get(train.dosageForm) || []).concat(train));
        });

        // Index products with enhanced metadata
        this.appData.products.forEach(product => {
            const enhancedProduct = {
                ...product,
                searchTerms: this.generateSearchTerms(product),
                indexed: true,
                indexedAt: new Date().toISOString()
            };
            
            this.searchIndex.products.set(product.name.toLowerCase(), enhancedProduct);
            
            // Index machines
            product.machines.forEach(machine => {
                const machineData = this.searchIndex.machines.get(machine) || { name: machine, products: [], usage: 0 };
                machineData.products.push(product);
                machineData.usage++;
                this.searchIndex.machines.set(machine, machineData);
            });
        });
    }

    /**
     * Build secondary indexes for advanced queries
     */
    buildSecondaryIndexes() {
        // RPN index (sorted by RPN value)
        const rpnSorted = [...this.appData.products]
            .filter(p => p.rpn > 0)
            .sort((a, b) => b.rpn - a.rpn);
        
        rpnSorted.forEach((product, index) => {
            this.searchIndex.rpnIndex.set(index, product);
        });

        // MACO index
        this.appData.products
            .filter(p => p.maco)
            .forEach(product => {
                this.searchIndex.macoIndex.set(product.name.toLowerCase(), product.maco);
            });

        // Machine usage index
        this.searchIndex.machines.forEach((machineData, machineName) => {
            this.searchIndex.machineUsage.set(machineName, {
                totalProducts: machineData.products.length,
                products: machineData.products.map(p => p.name),
                utilizationScore: this.calculateUtilizationScore(machineData)
            });
        });

        // Line-product relationships
        this.searchIndex.lines.forEach((trains, lineName) => {
            const allProducts = trains.flatMap(train => train.products);
            this.searchIndex.lineProducts.set(lineName.toLowerCase(), {
                totalProducts: allProducts.length,
                products: allProducts,
                trains: trains.length,
                dosageForms: [...new Set(trains.map(t => t.dosageForm))]
            });
        });
    }

    /**
     * Build keyword index for fuzzy matching
     */
    buildKeywordIndex() {
        const keywords = new Set();
        
        // Extract keywords from all text fields
        this.appData.products.forEach(product => {
            this.extractKeywords(product.name).forEach(kw => keywords.add(kw));
            this.extractKeywords(product.line).forEach(kw => keywords.add(kw));
            this.extractKeywords(product.dosageForm).forEach(kw => keywords.add(kw));
        });

        // Build keyword to entity mapping
        keywords.forEach(keyword => {
            this.searchIndex.keywords.set(keyword.toLowerCase(), {
                keyword,
                entities: this.findEntitiesForKeyword(keyword),
                frequency: this.calculateKeywordFrequency(keyword)
            });
        });
    }

    /**
     * Build relationship index for complex queries
     */
    buildRelationshipIndex() {
        // Product-Machine relationships
        this.appData.products.forEach(product => {
            product.machines.forEach(machine => {
                const key = `${product.name.toLowerCase()}-${machine}`;
                this.searchIndex.relationships.set(key, {
                    type: 'product-machine',
                    product: product.name,
                    machine: machine,
                    strength: 1.0
                });
            });
        });

        // Line-Product relationships
        this.searchIndex.lineProducts.forEach((data, line) => {
            data.products.forEach(product => {
                const key = `${line}-${product.name.toLowerCase()}`;
                this.searchIndex.relationships.set(key, {
                    type: 'line-product',
                    line: line,
                    product: product.name,
                    strength: 1.0 / data.totalProducts
                });
            });
        });
    }

    /**
     * Handle MACO calculation method questions
     */
    async handleMACOCalculationMethod(question, entities, context, analysis) {
        let response = "## 🧮 **MACO Calculation Methods - Complete Guide**\n\n";
        
        response += `MACO (Maximum Allowable Carryover) can be calculated using **four standard methods**. The **LOWEST value** from all methods becomes your acceptance limit.\n\n`;
        
        response += `### **Method 1: NOEL-Based Calculation** 🔬\n`;
        response += `\`\`\`\n`;
        response += `MACO = (NOEL × MBS) / (SF × TDD)\n`;
        response += `\`\`\`\n`;
        response += `**Where:**\n`;
        response += `- **NOEL:** No Observed Effect Level (mg/kg/day)\n`;
        response += `- **MBS:** Minimum Batch Size of next product (kg)\n`;
        response += `- **SF:** Safety Factor (100-10,000 based on route)\n`;
        response += `- **TDD:** Therapeutic Daily Dose (mg/day)\n\n`;
        response += `**Example:** NOEL=50, MBS=100kg, SF=1000, TDD=200mg\n`;
        response += `MACO = (50 × 100) / (1000 × 200) = **0.025 mg**\n\n`;
        
        response += `### **Method 2: 10 ppm Approach** 📊\n`;
        response += `\`\`\`\n`;
        response += `MACO = (10 ppm × Batch Size of Next Product) / 1,000,000\n`;
        response += `\`\`\`\n`;
        response += `**Example:** If next batch = 500 kg\n`;
        response += `MACO = (10 × 500,000 mg) / 1,000,000 = **5 mg**\n\n`;
        
        response += `### **Method 3: 1/1000 of Therapeutic Dose** 💊\n`;
        response += `\`\`\`\n`;
        response += `MACO = Minimum Daily Dose of Next Product / 1000\n`;
        response += `\`\`\`\n`;
        response += `**Example:** If daily dose = 100 mg\n`;
        response += `MACO = 100 mg / 1000 = **0.1 mg**\n\n`;
        
        response += `### **Method 4: Visually Clean** 👁️\n`;
        response += `\`\`\`\n`;
        response += `MACO = Limit of Visual Detection\n`;
        response += `\`\`\`\n`;
        response += `Typically **0.1 mg/cm²** for most surfaces\n\n`;
        
        response += `### **🎯 Final Step:**\n`;
        response += `**Select the LOWEST value** from all four methods as your acceptance limit.\n\n`;
        
        response += `### **🛡️ Safety Factors by Route:**\n`;
        response += `| Route | Range | Typical |\n`;
        response += `|-------|--------|----------|\n`;
        response += `| **Oral** | 100-1,000 | 1,000 |\n`;
        response += `| **Injectable** | 1,000-10,000 | 10,000 |\n`;
        response += `| **Topical** | 10-100 | 50 |\n`;
        response += `| **Inhalation** | 1,000-10,000 | 10,000 |\n`;
        response += `| **Ophthalmic** | 1,000-10,000 | 5,000 |\n\n`;
        
        response += `### **📋 Step-by-Step Process:**\n`;
        response += `1. **Gather Data:** NOEL, batch sizes, daily doses, safety factors\n`;
        response += `2. **Calculate Method 1:** NOEL-based calculation\n`;
        response += `3. **Calculate Method 2:** 10 ppm approach\n`;
        response += `4. **Calculate Method 3:** 1/1000 dose approach\n`;
        response += `5. **Consider Method 4:** Visual detection limit\n`;
        response += `6. **Select Lowest:** Use the most restrictive value\n`;
        response += `7. **Document:** Record calculation and rationale\n\n`;
        
        response += `*This ensures patient safety and regulatory compliance.*`;
        
        return response;
    }

    /**
     * Initialize advanced question patterns with sophisticated matching
     */
    initializeAdvancedPatterns() {
        this.questionPatterns = [
            // MACO Questions - Enhanced patterns
            {
                id: 'maco_specific',
                patterns: [
                    /(?:what|show|tell).*maco.*(?:for|of)\s+([a-zA-Z\s\d]+)/i,
                    /maco.*value.*(?:for|of)\s+([a-zA-Z\s\d]+)/i,
                    /([a-zA-Z\s\d]+).*maco/i
                ],
                type: 'maco_specific',
                confidence: 0.9,
                handler: (question, entities, context, analysis) => this.handleSpecificMACOQuestions(question, entities, context, analysis),
                examples: ["What is the MACO for Product A?", "Show MACO value for Aspirin"]
            },
            
            {
                id: 'maco_calculation_method',
                patterns: [
                    /what.*is.*maco.*calculation.*method/i,
                    /maco.*calculation.*method/i,
                    /how.*to.*calculate.*maco/i,
                    /how.*do.*i.*calculate.*maco/i,
                    /maco.*formula/i,
                    /maco.*equation/i,
                    /calculation.*method.*maco/i,
                    /method.*for.*calculating.*maco/i,
                    /formula.*for.*maco/i
                ],
                type: 'maco_calculation_method',
                confidence: 0.95,
                handler: (question, entities, context, analysis) => this.handleMACOCalculationMethod(question, entities, context, analysis),
                examples: ["What is the MACO calculation method?", "How do I calculate MACO?"]
            },

            {
                id: 'maco_general',
                patterns: [
                    /(?:what|explain).*maco(?!\s*calculation)/i,
                    /maco.*information/i,
                    /about.*maco/i,
                    /maco.*values/i,
                    /show.*maco/i
                ],
                type: 'maco_general',
                confidence: 0.8,
                handler: (question, entities, context, analysis) => this.handleGeneralMACOQuestions(question, entities, context, analysis),
                examples: ["What is MACO?", "Show me MACO information"]
            },

            // Product Questions - Enhanced patterns
            {
                id: 'product_count',
                patterns: [
                    /how\s+many.*products.*(?:in|for|at)\s+([a-zA-Z\s\d]+)/i,
                    /(?:count|number).*products.*([a-zA-Z\s\d]+)/i,
                    /total.*products.*([a-zA-Z\s\d]+)/i
                ],
                type: 'product_count',
                confidence: 0.85,
                handler: (question, entities, context, analysis) => this.handleProductCountQuestions(question, entities, context, analysis),
                examples: ["How many products in Line 1?", "Count products for tablets"]
            },

            {
                id: 'product_list',
                patterns: [
                    /(?:list|show|display).*products/i,
                    /(?:what|which).*products.*(?:are|in|for)/i,
                    /products.*(?:list|available)/i
                ],
                type: 'product_list',
                confidence: 0.8,
                handler: (question, entities, context, analysis) => this.handleProductListQuestions(question, entities, context, analysis),
                examples: ["List all products", "Show products in Line 1"]
            },

            // RPN Questions - Enhanced patterns
            {
                id: 'rpn_highest',
                patterns: [
                    /(?:highest|maximum|max|top).*rpn/i,
                    /rpn.*(?:highest|maximum|max)/i,
                    /(?:what|which).*highest.*rpn/i,
                    /worst.*case.*product/i
                ],
                type: 'rpn_highest',
                confidence: 0.9,
                handler: (question, entities, context, analysis) => this.handleHighestRPNQuestions(question, entities, context, analysis),
                examples: ["What is the highest RPN?", "Show worst case product"]
            },

            {
                id: 'rpn_analysis',
                patterns: [
                    /rpn.*(?:analysis|distribution|range)/i,
                    /(?:analyze|show).*rpn/i,
                    /risk.*priority.*analysis/i
                ],
                type: 'rpn_analysis',
                confidence: 0.8,
                handler: (question, entities, context, analysis) => this.handleRPNAnalysisQuestions(question, entities, context, analysis),
                examples: ["Show RPN analysis", "RPN distribution"]
            },

            // Machine Questions - Enhanced patterns
            {
                id: 'machine_coverage',
                patterns: [
                    /(?:which|what).*machines.*(?:used|covered|required)/i,
                    /machines.*(?:for|by|in)\s+([a-zA-Z\s\d]+)/i,
                    /(?:equipment|machinery).*coverage/i
                ],
                type: 'machine_coverage',
                confidence: 0.85,
                handler: (question, entities, context, analysis) => this.handleMachineCoverageQuestions(question, entities, context, analysis),
                examples: ["Which machines are used by Product A?", "Machine coverage analysis"]
            },

            // Study Questions - Enhanced patterns
            {
                id: 'study_requirements',
                patterns: [
                    /how\s+many.*stud(?:y|ies).*(?:required|needed)/i,
                    /stud(?:y|ies).*(?:requirements|needed|required)/i,
                    /(?:cleaning.*validation|cv).*stud(?:y|ies)/i
                ],
                type: 'study_requirements',
                confidence: 0.9,
                handler: (question, entities, context, analysis) => this.handleStudyRequirementQuestions(question, entities, context, analysis),
                examples: ["How many studies are required?", "Study requirements for tablets"]
            },

            // Statistics Questions - Enhanced patterns
            {
                id: 'statistics_overview',
                patterns: [
                    /(?:overview|summary|statistics|stats)/i,
                    /(?:total|overall).*(?:count|number)/i,
                    /system.*(?:overview|summary)/i,
                    /dashboard.*(?:summary|overview)/i
                ],
                type: 'statistics_overview',
                confidence: 0.7,
                handler: (question, entities, context, analysis) => this.handleStatisticsQuestions(question, entities, context, analysis),
                examples: ["System overview", "Show statistics", "Dashboard summary"]
            },

            // Safety Factor Questions - Enhanced patterns
            {
                id: 'safety_factors',
                patterns: [
                    /safety.*factor/i,
                    /(?:sf|safety).*(?:value|range|for)/i,
                    /factor.*(?:oral|topical|parenteral|inhalation)/i
                ],
                type: 'safety_factors',
                confidence: 0.8,
                handler: (question, entities, context, analysis) => this.handleSafetyFactorQuestions(question, entities, context, analysis),
                examples: ["What are safety factors?", "Safety factor for oral products"]
            },

            // Advanced Query Patterns
            {
                id: 'comparison',
                patterns: [
                    /(?:compare|comparison|vs|versus)/i,
                    /(?:difference|different).*between/i,
                    /(?:higher|lower|better|worse).*than/i
                ],
                type: 'comparison',
                confidence: 0.7,
                handler: (question, entities, context, analysis) => this.handleComparisonQuestions(question, entities, context, analysis),
                examples: ["Compare Product A vs Product B", "Difference between lines"]
            },

            {
                id: 'recommendations',
                patterns: [
                    /(?:recommend|suggest|advice|should)/i,
                    /(?:best|optimal|recommended).*(?:approach|method)/i,
                    /what.*(?:should|would).*you/i
                ],
                type: 'recommendations',
                confidence: 0.6,
                handler: (question, entities, context, analysis) => this.handleRecommendationQuestions(question, entities, context, analysis),
                examples: ["What do you recommend?", "Best approach for cleaning validation"]
            }
        ];

        this.log(`Initialized ${this.questionPatterns.length} question patterns`);
    }

    /**
     * Main method to process questions with advanced error handling
     */
    async askQuestion(question, context = {}) {
        const startTime = performance.now();
        
        try {
            // Validate input
            if (!question || typeof question !== 'string' || question.trim().length === 0) {
                throw new Error('Invalid question: Question must be a non-empty string');
            }

            // Update analytics
            this.analytics.totalQuestions++;
            this.updatePopularQuestions(question);

            // Check cache first
            const cacheKey = this.generateCacheKey(question, context);
            if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
                const cachedResult = this.cache.get(cacheKey);
                this.log(`Cache hit for question: ${question.substring(0, 50)}...`);
                return {
                    ...cachedResult,
                    cached: true,
                    responseTime: performance.now() - startTime
                };
            }

            // Process question with timeout
            const result = await Promise.race([
                this.processQuestionAdvanced(question, context),
                this.createTimeoutPromise()
            ]);

            // Calculate response time
            const responseTime = performance.now() - startTime;
            result.responseTime = responseTime;
            this.updateAverageResponseTime(responseTime);

            // Cache successful results
            if (result.success && this.config.cacheEnabled) {
                this.cache.set(cacheKey, { ...result, cached: false });
                this.manageCacheSize();
            }

            // Update analytics
            if (result.success) {
                this.analytics.successfulAnswers++;
            } else {
                this.analytics.failedAnswers++;
            }

            return result;

        } catch (error) {
            this.handleError('Question processing failed', error);
            this.analytics.failedAnswers++;
            
            return {
                success: false,
                question: question,
                error: error.message,
                answer: this.generateErrorResponse(error),
                suggestions: this.generateErrorSuggestions(),
                responseTime: performance.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Advanced question processing with sophisticated matching
     */
    async processQuestionAdvanced(question, context) {
        // Normalize and prepare question
        const normalizedQuestion = this.normalizeQuestionAdvanced(question);
        const questionAnalysis = this.analyzeQuestion(normalizedQuestion);
        
        // Find best matching patterns
        const matchedPatterns = this.findMatchingPatternsAdvanced(normalizedQuestion);
        
        if (matchedPatterns.length === 0) {
            return this.handleUnknownQuestionAdvanced(question, questionAnalysis);
        }

        // Select best pattern based on confidence and context
        const bestPattern = this.selectBestPattern(matchedPatterns, questionAnalysis, context);
        
        // Extract entities with advanced NLP
        const entities = this.extractEntitiesAdvanced(normalizedQuestion, bestPattern, questionAnalysis);
        
        // Generate answer using the best pattern
        const answer = await bestPattern.handler(normalizedQuestion, entities, context, questionAnalysis);
        
        return {
            success: true,
            question: question,
            answer: answer,
            type: bestPattern.type,
            confidence: bestPattern.confidence,
            entities: entities,
            analysis: questionAnalysis,
            pattern: bestPattern.id,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Advanced question normalization
     */
    normalizeQuestionAdvanced(question) {
        return question
            .toLowerCase()
            .trim()
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove punctuation but keep important chars
            .replace(/[?!.,:;]/g, '')
            // Handle common abbreviations
            .replace(/\bmaco\b/gi, 'maco')
            .replace(/\brpn\b/gi, 'rpn')
            .replace(/\bcv\b/gi, 'cleaning validation')
            // Normalize numbers
            .replace(/\b(\d+)\s*(st|nd|rd|th)\b/gi, '$1')
            // Handle plurals
            .replace(/\bproducts?\b/gi, 'product')
            .replace(/\bstudies\b/gi, 'study')
            .replace(/\bmachines?\b/gi, 'machine');
    }

    /**
     * Analyze question structure and intent
     */
    analyzeQuestion(question) {
        const analysis = {
            length: question.length,
            wordCount: question.split(' ').length,
            questionWords: [],
            entities: [],
            intent: 'unknown',
            complexity: 'simple',
            sentiment: 'neutral'
        };

        // Identify question words
        const questionWords = ['what', 'which', 'how', 'when', 'where', 'why', 'who'];
        questionWords.forEach(word => {
            if (question.includes(word)) {
                analysis.questionWords.push(word);
            }
        });

        // Determine intent
        if (question.includes('how many') || question.includes('count')) {
            analysis.intent = 'count';
        } else if (question.includes('what is') || question.includes('show')) {
            analysis.intent = 'information';
        } else if (question.includes('list') || question.includes('display')) {
            analysis.intent = 'list';
        } else if (question.includes('compare') || question.includes('difference')) {
            analysis.intent = 'comparison';
        }

        // Determine complexity
        if (analysis.wordCount > 10 || analysis.questionWords.length > 1) {
            analysis.complexity = 'complex';
        } else if (analysis.wordCount > 5) {
            analysis.complexity = 'medium';
        }

        return analysis;
    }

    /**
     * Find matching patterns with advanced scoring
     */
    findMatchingPatternsAdvanced(question) {
        const matches = [];

        // Debug: Log the question and available patterns
        if (this.config.debugMode) {
            console.log('Matching question:', question);
            console.log('Available patterns:', this.questionPatterns.length);
        }

        this.questionPatterns.forEach(patternGroup => {
            let bestScore = 0;
            let bestMatch = null;

            patternGroup.patterns.forEach(pattern => {
                const match = question.match(pattern);
                if (match) {
                    // Calculate match score based on multiple factors
                    const score = this.calculatePatternScore(match, question, patternGroup);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = { match, score, pattern };
                    }
                    
                    // Debug: Log successful matches
                    if (this.config.debugMode) {
                        console.log(`Pattern ${patternGroup.id} matched:`, {
                            pattern: pattern.toString(),
                            match: match[0],
                            score: score,
                            confidence: patternGroup.confidence
                        });
                    }
                }
            });

            if (bestMatch && bestScore > this.config.confidenceThreshold) {
                matches.push({
                    ...patternGroup,
                    matchScore: bestScore,
                    matchDetails: bestMatch
                });
            }
        });

        // Debug: Log final matches
        if (this.config.debugMode) {
            console.log('Final matches:', matches.length);
            matches.forEach(match => {
                console.log(`Match: ${match.id}, Score: ${match.matchScore}, Confidence: ${match.confidence}`);
            });
        }

        // Sort by match score
        return matches.sort((a, b) => b.matchScore - a.matchScore);
    }

    /**
     * Calculate pattern matching score
     */
    calculatePatternScore(match, question, patternGroup) {
        let score = 0;

        // Base score from match coverage
        score += (match[0].length / question.length) * 0.4;

        // Bonus for pattern confidence
        score += patternGroup.confidence * 0.3;

        // Bonus for exact keyword matches
        const keywords = ['maco', 'rpn', 'product', 'machine', 'study', 'train'];
        keywords.forEach(keyword => {
            if (question.includes(keyword) && patternGroup.type.includes(keyword)) {
                score += 0.1;
            }
        });

        // Penalty for partial matches
        if (match[0].length < question.length * 0.3) {
            score *= 0.8;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Select best pattern based on context and analysis
     */
    selectBestPattern(patterns, analysis, context) {
        if (patterns.length === 1) {
            return patterns[0];
        }

        // Apply contextual scoring
        patterns.forEach(pattern => {
            // Boost score based on question intent alignment
            if (analysis.intent === 'count' && pattern.type.includes('count')) {
                pattern.contextScore = (pattern.matchScore || 0) * 1.2;
            } else if (analysis.intent === 'information' && pattern.type.includes('specific')) {
                pattern.contextScore = (pattern.matchScore || 0) * 1.1;
            } else {
                pattern.contextScore = pattern.matchScore || 0;
            }

            // Consider user context if available
            if (context.preferredTypes && context.preferredTypes.includes(pattern.type)) {
                pattern.contextScore *= 1.15;
            }
        });

        // Return pattern with highest contextual score
        return patterns.sort((a, b) => (b.contextScore || 0) - (a.contextScore || 0))[0];
    }

    /**
     * Advanced entity extraction with NLP techniques
     */
    extractEntitiesAdvanced(question, pattern, analysis) {
        const entities = {
            products: [],
            lines: [],
            dosageForms: [],
            machines: [],
            numbers: [],
            keywords: [],
            confidence: 0
        };

        try {
            // Extract named entities using search index
            this.searchIndex.products.forEach((product, name) => {
                if (this.fuzzyMatch(question, name) || this.fuzzyMatch(question, product.name)) {
                    entities.products.push({
                        name: product.name,
                        confidence: this.calculateEntityConfidence(question, name),
                        source: 'index'
                    });
                }
            });

            // Extract line names
            this.searchIndex.lines.forEach((trains, line) => {
                if (this.fuzzyMatch(question, line.toLowerCase())) {
                    entities.lines.push({
                        name: line,
                        confidence: this.calculateEntityConfidence(question, line),
                        source: 'index'
                    });
                }
            });

            // Extract dosage forms
            this.searchIndex.dosageForms.forEach((trains, form) => {
                if (this.fuzzyMatch(question, form.toLowerCase())) {
                    entities.dosageForms.push({
                        name: form,
                        confidence: this.calculateEntityConfidence(question, form),
                        source: 'index'
                    });
                }
            });

            // Extract machines
            this.searchIndex.machines.forEach((data, machine) => {
                if (this.fuzzyMatch(question, machine.toLowerCase())) {
                    entities.machines.push({
                        name: machine,
                        confidence: this.calculateEntityConfidence(question, machine),
                        source: 'index'
                    });
                }
            });

            // Extract numbers with context
            const numberMatches = question.match(/\d+/g);
            if (numberMatches) {
                entities.numbers = numberMatches.map(num => ({
                    value: parseInt(num),
                    context: this.getNumberContext(question, num),
                    confidence: 0.9
                }));
            }

            // Extract keywords using keyword index
            this.searchIndex.keywords.forEach((data, keyword) => {
                if (question.includes(keyword)) {
                    entities.keywords.push({
                        keyword: keyword,
                        frequency: data.frequency,
                        entities: data.entities,
                        confidence: 0.8
                    });
                }
            });

            // Calculate overall entity confidence
            entities.confidence = this.calculateOverallEntityConfidence(entities);

            return entities;
        } catch (error) {
            this.handleError('Entity extraction failed', error);
            return entities;
        }
    }

    /**
     * Fuzzy matching for entity recognition
     */
    fuzzyMatch(text, target, threshold = 0.8) {
        if (!text || !target) return false;
        
        // Exact match
        if (text.includes(target.toLowerCase())) return true;
        
        // Levenshtein distance based matching
        const distance = this.levenshteinDistance(text, target.toLowerCase());
        const similarity = 1 - (distance / Math.max(text.length, target.length));
        
        return similarity >= threshold;
    }

    /**
     * Calculate Levenshtein distance for fuzzy matching
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // ========== ENHANCED QUESTION HANDLERS ==========

    /**
     * Handle specific MACO questions with advanced features
     */
    async handleSpecificMACOQuestions(question, entities, context, analysis) {
        let response = "## 🧮 MACO Information\n\n";

        try {
            if (entities.products.length > 0) {
                const productEntity = entities.products[0];
                const productName = productEntity.name;
                const product = this.searchIndex.products.get(productName.toLowerCase());
                
                if (product && product.maco) {
                    response += `### **MACO for ${productName}**\n\n`;
                    response += `**💊 Value:** ${product.maco.value} ${product.maco.unit}\n`;
                    response += `**📋 Calculation Method:** ${product.maco.method}\n`;
                    response += `**🛡️ Safety Factor:** ${product.maco.safetyFactor.toLocaleString()}\n`;
                    response += `**📅 Calculated:** ${new Date(product.maco.calculatedAt).toLocaleDateString()}\n\n`;
                    
                    // Add context about the product
                    response += `**📊 Product Context:**\n`;
                    response += `- **Line:** ${product.line}\n`;
                    response += `- **Dosage Form:** ${product.dosageForm}\n`;
                    response += `- **RPN:** ${product.rpn}\n`;
                    response += `- **Machines:** ${product.machines.join(', ')}\n\n`;
                    
                    // Add calculation breakdown if available
                    if (product.maco.calculation) {
                        response += `**🔬 Calculation Breakdown:**\n`;
                        response += `- **NOEL:** ${product.maco.calculation.noel || 'N/A'}\n`;
                        response += `- **MBS:** ${product.maco.calculation.mbs || 'N/A'}\n`;
                        response += `- **TDD:** ${product.maco.calculation.tdd || 'N/A'}\n`;
                    }
                } else {
                    response += `❌ **MACO data for "${productName}" is not available.**\n\n`;
                    response += `**💡 To calculate MACO, you need:**\n`;
                    response += `- NOEL (No Observed Effect Level)\n`;
                    response += `- Maximum Batch Size (MBS)\n`;
                    response += `- Safety Factor (SF)\n`;
                    response += `- Therapeutic Daily Dose (TDD)\n\n`;
                    response += `**📐 Formula:** MACO = (NOEL × MBS) / (SF × TDD)`;
                }
            } else {
                // No specific product mentioned - show available MACO data
                const productsWithMACO = Array.from(this.searchIndex.macoIndex.entries());
                
                if (productsWithMACO.length > 0) {
                    response += `**📋 Available MACO Values (${productsWithMACO.length} products):**\n\n`;
                    
                    productsWithMACO
                        .sort((a, b) => b[1].value - a[1].value)
                        .slice(0, 10) // Show top 10
                        .forEach(([productName, maco], index) => {
                            response += `${index + 1}. **${this.capitalizeWords(productName)}:** ${maco.value} ${maco.unit}\n`;
                        });
                        
                    if (productsWithMACO.length > 10) {
                        response += `\n*... and ${productsWithMACO.length - 10} more products*\n`;
                    }
                } else {
                    response += this.getGeneralMACOInfo();
                }
            }

            return response;
        } catch (error) {
            this.handleError('MACO question processing failed', error);
            return `❌ **Error processing MACO question:** ${error.message}`;
        }
    }

    /**
     * Handle general MACO questions
     */
    async handleGeneralMACOQuestions(question, entities, context, analysis) {
        let response = "## 🧮 MACO (Maximum Allowable Carryover) Guide\n\n";

        response += `**🎯 What is MACO?**\n`;
        response += `MACO is the maximum scientifically justified amount of residue that can be carried over from one product to the next without compromising patient safety.\n\n`;

        response += `**📐 MACO Calculation Methods:**\n\n`;
        response += `### 1️⃣ **Dose-Based Approach**\n`;
        response += `MACO = (NOEL × MBS) / (SF × TDD)\n\n`;
        response += `### 2️⃣ **10 ppm Approach**\n`;
        response += `MACO = (10 ppm × MBS) / 1,000,000\n\n`;
        response += `### 3️⃣ **1/1000 of Dose Approach**\n`;
        response += `MACO = (Smallest Therapeutic Dose × MBS) / (1000 × Largest Batch Size)\n\n`;
        response += `### 4️⃣ **Visually Clean Approach**\n`;
        response += `MACO = Visual Detection Limit\n\n`;

        response += `**🔤 Key Parameters:**\n`;
        response += `- **NOEL:** No Observed Effect Level (mg/kg/day)\n`;
        response += `- **MBS:** Maximum Batch Size of next product (kg)\n`;
        response += `- **SF:** Safety Factor (route-dependent)\n`;
        response += `- **TDD:** Therapeutic Daily Dose (mg/day)\n\n`;

        response += `**🛡️ Safety Factors by Route:**\n`;
        response += `- **Oral:** 100-1,000 (typical: 1,000)\n`;
        response += `- **Topical:** 10-100 (typical: 50)\n`;
        response += `- **Parenteral:** 1,000-10,000 (typical: 10,000)\n`;
        response += `- **Inhalation:** 1,000-10,000 (typical: 10,000)\n`;
        response += `- **Ophthalmic:** 1,000-10,000 (typical: 5,000)\n\n`;

        response += `**📏 Final MACO Selection:**\n`;
        response += `The **lowest value** from all four methods is selected as the acceptance limit to ensure maximum safety.\n`;

        return response;
    }

    /**
     * Handle product count questions
     */
    async handleProductCountQuestions(question, entities, context, analysis) {
        let response = "## 📊 Product Count Analysis\n\n";

        try {
            if (entities.lines.length > 0) {
                const lineName = entities.lines[0].name;
                const lineData = this.searchIndex.lineProducts.get(lineName.toLowerCase());
                
                if (lineData) {
                    response += `### **Products in ${lineName}**\n\n`;
                    response += `**📈 Total Products:** ${lineData.totalProducts}\n`;
                    response += `**🚂 Total Trains:** ${lineData.trains}\n`;
                    response += `**💊 Dosage Forms:** ${lineData.dosageForms.join(', ')}\n\n`;
                    
                    // Group by dosage form
                    const byDosageForm = new Map();
                    lineData.products.forEach(product => {
                        const form = product.dosageForm;
                        byDosageForm.set(form, (byDosageForm.get(form) || 0) + 1);
                    });
                    
                    response += `**📋 Breakdown by Dosage Form:**\n`;
                    byDosageForm.forEach((count, form) => {
                        response += `- **${form}:** ${count} products\n`;
                    });
                } else {
                    response += `❌ **Line "${lineName}" not found.**\n\n`;
                    response += this.getAvailableLinesInfo();
                }
            } else if (entities.dosageForms.length > 0) {
                const dosageForm = entities.dosageForms[0].name;
                const formData = this.searchIndex.dosageForms.get(dosageForm);
                
                if (formData) {
                    const totalProducts = formData.reduce((sum, train) => sum + train.products.length, 0);
                    response += `### **${dosageForm} Products**\n\n`;
                    response += `**📈 Total Products:** ${totalProducts}\n`;
                    response += `**🚂 Total Trains:** ${formData.length}\n\n`;
                    
                    // Group by line
                    const byLine = new Map();
                    formData.forEach(train => {
                        const line = train.line;
                        byLine.set(line, (byLine.get(line) || 0) + train.products.length);
                    });
                    
                    response += `**📋 Breakdown by Line:**\n`;
                    byLine.forEach((count, line) => {
                        response += `- **${line}:** ${count} products\n`;
                    });
                } else {
                    response += `❌ **Dosage form "${dosageForm}" not found.**\n\n`;
                    response += this.getAvailableDosageFormsInfo();
                }
            } else {
                // Overall product count
                response += `### **Overall Product Statistics**\n\n`;
                response += `**📈 Total Products:** ${this.appData.products.length}\n`;
                response += `**🚂 Total Trains:** ${this.appData.trains.length}\n`;
                response += `**🏭 Total Lines:** ${this.searchIndex.lines.size}\n`;
                response += `**💊 Total Dosage Forms:** ${this.searchIndex.dosageForms.size}\n\n`;
                
                // Breakdown by line
                response += `**📋 Products by Line:**\n`;
                this.searchIndex.lineProducts.forEach((data, line) => {
                    response += `- **${this.capitalizeWords(line)}:** ${data.totalProducts} products\n`;
                });
            }

            return response;
        } catch (error) {
            this.handleError('Product count question processing failed', error);
            return `❌ **Error processing product count question:** ${error.message}`;
        }
    }

    /**
     * Handle highest RPN questions
     */
    async handleHighestRPNQuestions(question, entities, context, analysis) {
        let response = "## 🔺 Highest RPN Analysis\n\n";

        try {
            const topProducts = Array.from(this.searchIndex.rpnIndex.values()).slice(0, 10);
            
            if (topProducts.length === 0) {
                return "❌ **No RPN data available in the system.**";
            }

            const highest = topProducts[0];
            response += `### **🏆 Highest RPN Product**\n\n`;
            response += `**🎯 Product:** ${highest.name}\n`;
            response += `**📊 RPN Value:** ${highest.rpn.toLocaleString()}\n`;
            response += `**🏭 Line:** ${highest.line}\n`;
            response += `**💊 Dosage Form:** ${highest.dosageForm}\n`;
            response += `**⚙️ Machines:** ${highest.machines.join(', ')}\n\n`;

            if (topProducts.length > 1) {
                response += `### **📈 Top ${Math.min(topProducts.length, 5)} Highest RPN Products**\n\n`;
                topProducts.slice(0, 5).forEach((product, index) => {
                    response += `${index + 1}. **${product.name}** - RPN: ${product.rpn.toLocaleString()}\n`;
                    response += `   *${product.line} | ${product.dosageForm}*\n\n`;
                });
            }

            // Add RPN distribution analysis
            response += this.generateRPNDistributionAnalysis(topProducts);

            return response;
        } catch (error) {
            this.handleError('Highest RPN question processing failed', error);
            return `❌ **Error processing RPN question:** ${error.message}`;
        }
    }

    /**
     * Handle machine coverage questions
     */
    async handleMachineCoverageQuestions(question, entities, context, analysis) {
        let response = "## ⚙️ Machine Coverage Analysis\n\n";

        try {
            if (entities.products.length > 0) {
                // Machine coverage for specific product
                const productName = entities.products[0].name;
                const product = this.searchIndex.products.get(productName.toLowerCase());
                
                if (product) {
                    response += `### **Machines Used by ${productName}**\n\n`;
                    response += `**🔧 Total Machines:** ${product.machines.length}\n\n`;
                    
                    product.machines.forEach((machine, index) => {
                        const machineData = this.searchIndex.machineUsage.get(machine);
                        response += `${index + 1}. **${machine}**\n`;
                        if (machineData) {
                            response += `   - Used by ${machineData.totalProducts} products\n`;
                            response += `   - Utilization Score: ${machineData.utilizationScore.toFixed(2)}\n`;
                        }
                        response += `\n`;
                    });
                } else {
                    response += `❌ **Product "${productName}" not found.**`;
                }
            } else {
                // Overall machine coverage analysis
                response += `### **Overall Machine Coverage**\n\n`;
                response += `**🔧 Total Machines:** ${this.searchIndex.machines.size}\n\n`;
                
                // Sort machines by usage
                const machineUsage = Array.from(this.searchIndex.machineUsage.entries())
                    .sort((a, b) => b[1].totalProducts - a[1].totalProducts);
                
                response += `**📊 Top 10 Most Used Machines:**\n\n`;
                machineUsage.slice(0, 10).forEach(([machine, data], index) => {
                    response += `${index + 1}. **${machine}** - Used by ${data.totalProducts} products\n`;
                });
                
                if (machineUsage.length > 10) {
                    response += `\n*... and ${machineUsage.length - 10} more machines*\n`;
                }
            }

            return response;
        } catch (error) {
            this.handleError('Machine coverage question processing failed', error);
            return `❌ **Error processing machine coverage question:** ${error.message}`;
        }
    }

    /**
     * Handle study requirement questions
     */
    async handleStudyRequirementQuestions(question, entities, context, analysis) {
        let response = "## 🔬 Study Requirements Analysis\n\n";

        try {
            // Check if we have selected studies data
            if (this.appData.selectedStudies && this.appData.selectedStudies.length > 0) {
                response += `### **📋 Required Studies**\n\n`;
                response += `**🎯 Total Studies Required:** ${this.appData.selectedStudies.length}\n\n`;
                
                this.appData.selectedStudies.forEach((study, index) => {
                    response += `**Study ${index + 1}: ${study.productName}**\n`;
                    response += `- **RPN:** ${study.rpn.toLocaleString()}\n`;
                    if (study.machinesCovered) {
                        response += `- **Machines Covered:** ${study.machinesCovered.join(', ')}\n`;
                    }
                    response += `- **Justification:** Worst case product for machine coverage\n\n`;
                });

                // Calculate coverage statistics
                const totalMachines = this.searchIndex.machines.size;
                const coveredMachines = new Set();
                this.appData.selectedStudies.forEach(study => {
                    if (study.machinesCovered) {
                        study.machinesCovered.forEach(machine => coveredMachines.add(machine));
                    }
                });

                response += `**📊 Coverage Statistics:**\n`;
                response += `- **Total Machines:** ${totalMachines}\n`;
                response += `- **Covered Machines:** ${coveredMachines.size}\n`;
                response += `- **Coverage Rate:** ${((coveredMachines.size / totalMachines) * 100).toFixed(1)}%\n`;
            } else {
                // General study requirements information
                response += `### **📚 Study Requirements Overview**\n\n`;
                response += `**🎯 Study Selection Criteria:**\n`;
                response += `1. **Worst Case Product Selection** - Highest RPN value\n`;
                response += `2. **Machine Coverage Analysis** - Ensure all equipment is covered\n`;
                response += `3. **Risk Assessment** - Consider product characteristics\n`;
                response += `4. **Regulatory Compliance** - Meet FDA/EMA guidelines\n\n`;

                response += `**📋 Typical Study Requirements:**\n`;
                response += `- **3 consecutive successful cleaning cycles**\n`;
                response += `- **Swab sampling** from product contact surfaces\n`;
                response += `- **Rinse sampling** from final rinse water\n`;
                response += `- **Visual inspection** for cleanliness\n`;
                response += `- **Analytical method validation**\n\n`;

                // Estimate based on available data
                const estimatedStudies = Math.ceil(this.appData.trains.length * 0.3); // Rough estimate
                response += `**🔮 Estimated Studies for Your System:**\n`;
                response += `Based on ${this.appData.trains.length} trains, approximately **${estimatedStudies} studies** may be required.\n`;
                response += `*Actual number depends on machine sharing and risk assessment.*`;
            }

            return response;
        } catch (error) {
            this.handleError('Study requirement question processing failed', error);
            return `❌ **Error processing study requirement question:** ${error.message}`;
        }
    }

    /**
     * Handle statistics questions
     */
    async handleStatisticsQuestions(question, entities, context, analysis) {
        let response = "## 📊 System Statistics Dashboard\n\n";

        try {
            // Core statistics
            response += `### **🎯 Core Metrics**\n\n`;
            response += `| Metric | Count |\n`;
            response += `|--------|-------|\n`;
            response += `| **Products** | ${this.appData.products.length.toLocaleString()} |\n`;
            response += `| **Trains** | ${this.appData.trains.length.toLocaleString()} |\n`;
            response += `| **Machines** | ${this.searchIndex.machines.size.toLocaleString()} |\n`;
            response += `| **Production Lines** | ${this.searchIndex.lines.size.toLocaleString()} |\n`;
            response += `| **Dosage Forms** | ${this.searchIndex.dosageForms.size.toLocaleString()} |\n\n`;

            // Distribution analysis
            response += `### **📈 Distribution Analysis**\n\n`;
            
            // Products by line
            response += `**Products by Line:**\n`;
            this.searchIndex.lineProducts.forEach((data, line) => {
                const percentage = ((data.totalProducts / this.appData.products.length) * 100).toFixed(1);
                response += `- **${this.capitalizeWords(line)}:** ${data.totalProducts} (${percentage}%)\n`;
            });
            response += `\n`;

            // Products by dosage form
            response += `**Products by Dosage Form:**\n`;
            this.searchIndex.dosageForms.forEach((trains, form) => {
                const productCount = trains.reduce((sum, train) => sum + train.products.length, 0);
                const percentage = ((productCount / this.appData.products.length) * 100).toFixed(1);
                response += `- **${form}:** ${productCount} (${percentage}%)\n`;
            });
            response += `\n`;

            // RPN analysis
            const rpnProducts = Array.from(this.searchIndex.rpnIndex.values());
            if (rpnProducts.length > 0) {
                const avgRPN = rpnProducts.reduce((sum, p) => sum + p.rpn, 0) / rpnProducts.length;
                const maxRPN = Math.max(...rpnProducts.map(p => p.rpn));
                const minRPN = Math.min(...rpnProducts.map(p => p.rpn));
                
                response += `### **🎯 RPN Analysis**\n\n`;
                response += `- **Average RPN:** ${avgRPN.toFixed(1)}\n`;
                response += `- **Highest RPN:** ${maxRPN.toLocaleString()}\n`;
                response += `- **Lowest RPN:** ${minRPN.toLocaleString()}\n`;
                response += `- **RPN Range:** ${(maxRPN - minRPN).toLocaleString()}\n\n`;
            }

            // Machine utilization
            if (this.searchIndex.machineUsage.size > 0) {
                const utilizationScores = Array.from(this.searchIndex.machineUsage.values())
                    .map(data => data.utilizationScore);
                const avgUtilization = utilizationScores.reduce((a, b) => a + b, 0) / utilizationScores.length;
                
                response += `### **⚙️ Machine Utilization**\n\n`;
                response += `- **Average Utilization Score:** ${avgUtilization.toFixed(2)}\n`;
                response += `- **Most Used Machine:** ${this.getMostUsedMachine()}\n`;
                response += `- **Least Used Machine:** ${this.getLeastUsedMachine()}\n\n`;
            }

            // System health indicators
            response += `### **🏥 System Health**\n\n`;
            response += `- **Data Completeness:** ${this.calculateDataCompleteness()}%\n`;
            response += `- **Index Status:** ${this.searchIndex ? '✅ Active' : '❌ Inactive'}\n`;
            response += `- **Cache Hit Rate:** ${this.calculateCacheHitRate()}%\n`;
            response += `- **Average Response Time:** ${this.analytics.averageResponseTime.toFixed(0)}ms\n`;

            return response;
        } catch (error) {
            this.handleError('Statistics question processing failed', error);
            return `❌ **Error generating statistics:** ${error.message}`;
        }
    }

    /**
     * Handle safety factor questions
     */
    async handleSafetyFactorQuestions(question, entities, context, analysis) {
        // Import safety factor configuration from state
        const stateModule = await import('./state.js');
        const { routeSafetyFactors, dosageFormToRouteMap } = stateModule;
        
        let response = "## 🛡️ Safety Factors - Complete Summary\n\n";

        // Generate table from routeSafetyFactors data
        response += `### **📋 Safety Factors by Route of Administration**\n\n`;
        response += `| Route | Safety Factor Range | Risk Level |\n`;
        response += `|-------|---------------------|------------|\n`;
        
        // Sort routes by risk level (Very High first, then High, Standard, Low)
        const riskOrder = { 'Very High': 0, 'High': 1, 'Standard': 2, 'Low': 3 };
        const sortedRoutes = Object.entries(routeSafetyFactors).sort((a, b) => {
            const orderA = riskOrder[a[1].riskLevel] ?? 999;
            const orderB = riskOrder[b[1].riskLevel] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return a[1].route.localeCompare(b[1].route);
        });

        sortedRoutes.forEach(([key, config]) => {
            const riskEmoji = config.riskLevel === 'Very High' ? '🔴' : 
                            config.riskLevel === 'High' ? '🟡' : 
                            config.riskLevel === 'Standard' ? '🟢' : '🟢';
            response += `| **${config.route}** | ${config.min.toLocaleString()} - ${config.max.toLocaleString()} | ${riskEmoji} ${config.riskLevel} |\n`;
        });

        response += `\n`;

        // Generate dosage form to route mapping table
        response += `### **💊 Dosage Form to Route Mapping**\n\n`;
        response += `| Dosage Form | Route | Safety Factor Range | Risk Level |\n`;
        response += `|-------------|-------|---------------------|------------|\n`;

        // Group dosage forms by route
        const routeGroups = {};
        Object.entries(dosageFormToRouteMap).forEach(([dosageForm, routeKey]) => {
            if (!routeGroups[routeKey]) {
                routeGroups[routeKey] = [];
            }
            routeGroups[routeKey].push(dosageForm);
        });

        // Sort routes by risk level
        const sortedRouteKeys = Object.keys(routeGroups).sort((a, b) => {
            const orderA = riskOrder[routeSafetyFactors[a]?.riskLevel] ?? 999;
            const orderB = riskOrder[routeSafetyFactors[b]?.riskLevel] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return routeSafetyFactors[a]?.route.localeCompare(routeSafetyFactors[b]?.route || '') || 0;
        });

        sortedRouteKeys.forEach(routeKey => {
            const routeConfig = routeSafetyFactors[routeKey];
            if (!routeConfig) return;
            
            const dosageForms = routeGroups[routeKey].sort();
            const riskEmoji = routeConfig.riskLevel === 'Very High' ? '🔴' : 
                            routeConfig.riskLevel === 'High' ? '🟡' : 
                            routeConfig.riskLevel === 'Standard' ? '🟢' : '🟢';
            
            dosageForms.forEach((dosageForm, index) => {
                if (index === 0) {
                    // First row shows route info
                    response += `| **${dosageForm}** | **${routeConfig.route}** | ${routeConfig.min.toLocaleString()} - ${routeConfig.max.toLocaleString()} | ${riskEmoji} ${routeConfig.riskLevel} |\n`;
                } else {
                    // Subsequent rows for same route show only dosage form
                    response += `| **${dosageForm}** | ${routeConfig.route} | ${routeConfig.min.toLocaleString()} - ${routeConfig.max.toLocaleString()} | ${riskEmoji} ${routeConfig.riskLevel} |\n`;
                }
            });
        });

        response += `\n`;

        // Add summary statistics
        response += `### **📊 Summary Statistics**\n\n`;
        response += `- **Total Routes:** ${Object.keys(routeSafetyFactors).length}\n`;
        response += `- **Total Dosage Forms:** ${Object.keys(dosageFormToRouteMap).length}\n`;
        response += `- **Very High Risk Routes:** ${sortedRoutes.filter(([_, config]) => config.riskLevel === 'Very High').length}\n`;
        response += `- **Standard Risk Routes:** ${sortedRoutes.filter(([_, config]) => config.riskLevel === 'Standard').length}\n`;
        response += `- **Low Risk Routes:** ${sortedRoutes.filter(([_, config]) => config.riskLevel === 'Low').length}\n\n`;

        response += `### **ℹ️ How Safety Factors Are Used**\n\n`;
        response += `Safety factors are automatically determined based on the **dosage form** of your product:\n\n`;
        response += `1. **Select Dosage Form** → System maps to Route of Administration\n`;
        response += `2. **Route Determines Range** → Safety factor range is set (e.g., 100-1,000 for Oral)\n`;
        response += `3. **Default Value** → Maximum value from range is used (e.g., 1,000 for Oral)\n`;
        response += `4. **User Can Adjust** → Safety factor can be adjusted within the allowed range\n\n`;
        response += `**Example:** A product with dosage form "Tablets" → Maps to "Oral" route → Safety factor range: 100-1,000 → Default: 1,000\n\n`;

        return response;
    }

    /**
     * Handle unknown questions with advanced suggestions
     */
    async handleUnknownQuestionAdvanced(question, analysis) {
        let response = `❓ **I couldn't understand your question:** "${question}"\n\n`;

        // Analyze what might have been intended
        const suggestions = this.generateIntelligentSuggestions(question, analysis);
        
        response += `**💡 Based on your question, you might be asking about:**\n\n`;
        suggestions.forEach((suggestion, index) => {
            response += `${index + 1}. ${suggestion.text}\n`;
            response += `   *${suggestion.reason}*\n\n`;
        });

        response += `**🎯 Popular Questions:**\n`;
        const popularQuestions = this.getPopularQuestions();
        popularQuestions.forEach((q, index) => {
            response += `- ${q}\n`;
        });

        response += `\n**📚 I can help with:**\n`;
        response += `- MACO calculations and values\n`;
        response += `- Product information and counts\n`;
        response += `- Train and machine analysis\n`;
        response += `- Study requirements\n`;
        response += `- RPN analysis\n`;
        response += `- Safety factors\n`;
        response += `- System statistics\n`;

        return {
            success: false,
            question: question,
            answer: response,
            suggestions: suggestions.map(s => s.text),
            confidence: 0,
            type: 'unknown'
        };
    }

    // ========== UTILITY METHODS ==========

    /**
     * Generate intelligent suggestions based on question analysis
     */
    generateIntelligentSuggestions(question, analysis) {
        const suggestions = [];
        const questionLower = question.toLowerCase();

        // Check for partial matches with known patterns
        this.questionPatterns.forEach(pattern => {
            pattern.patterns.forEach(regex => {
                const match = questionLower.match(regex);
                if (match && match[0].length > questionLower.length * 0.3) {
                    suggestions.push({
                        text: pattern.examples[0] || `Ask about ${pattern.type}`,
                        reason: `Similar to ${pattern.type} questions`,
                        confidence: 0.7
                    });
                }
            });
        });

        // Keyword-based suggestions
        if (questionLower.includes('product')) {
            suggestions.push({
                text: "How many products are in Line 1?",
                reason: "You mentioned 'product'",
                confidence: 0.6
            });
        }

        if (questionLower.includes('maco')) {
            suggestions.push({
                text: "What is the MACO calculation method?",
                reason: "You mentioned 'MACO'",
                confidence: 0.8
            });
        }

        if (questionLower.includes('study') || questionLower.includes('studies')) {
            suggestions.push({
                text: "How many studies are required?",
                reason: "You mentioned 'study'",
                confidence: 0.7
            });
        }

        // Remove duplicates and sort by confidence
        const uniqueSuggestions = suggestions
            .filter((item, index, arr) => arr.findIndex(i => i.text === item.text) === index)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);

        // Add default suggestions if none found
        if (uniqueSuggestions.length === 0) {
            uniqueSuggestions.push(
                {
                    text: "Show system statistics",
                    reason: "Get an overview of your data",
                    confidence: 0.5
                },
                {
                    text: "What is the highest RPN product?",
                    reason: "Find worst case products",
                    confidence: 0.5
                },
                {
                    text: "How many products are in the system?",
                    reason: "Basic system information",
                    confidence: 0.5
                }
            );
        }

        return uniqueSuggestions;
    }

    /**
     * Generate search terms for better matching
     */
    generateSearchTerms(product) {
        const terms = new Set();
        
        // Add product name variations
        terms.add(product.name.toLowerCase());
        terms.add(product.name.toLowerCase().replace(/\s+/g, ''));
        
        // Add individual words
        product.name.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2) terms.add(word);
        });
        
        // Add line and dosage form
        if (product.line) terms.add(product.line.toLowerCase());
        if (product.dosageForm) terms.add(product.dosageForm.toLowerCase());
        
        return Array.from(terms);
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        if (!text) return [];
        
        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word));
    }

    /**
     * Find entities for a keyword
     */
    findEntitiesForKeyword(keyword) {
        const entities = [];
        
        this.appData.products.forEach(product => {
            if (product.name.toLowerCase().includes(keyword.toLowerCase())) {
                entities.push({ type: 'product', name: product.name });
            }
        });
        
        return entities;
    }

    /**
     * Calculate keyword frequency
     */
    calculateKeywordFrequency(keyword) {
        let frequency = 0;
        
        this.appData.products.forEach(product => {
            if (product.name.toLowerCase().includes(keyword.toLowerCase())) {
                frequency++;
            }
        });
        
        return frequency;
    }

    /**
     * Calculate utilization score for machine
     */
    calculateUtilizationScore(machineData) {
        const totalProducts = this.appData.products.length;
        return totalProducts > 0 ? (machineData.products.length / totalProducts) : 0;
    }

    /**
     * Calculate entity confidence
     */
    calculateEntityConfidence(question, entity) {
        const exactMatch = question.includes(entity.toLowerCase());
        const fuzzyMatch = this.fuzzyMatch(question, entity.toLowerCase(), 0.7);
        
        if (exactMatch) return 0.95;
        if (fuzzyMatch) return 0.7;
        return 0.3;
    }

    /**
     * Get number context from question
     */
    getNumberContext(question, number) {
        const index = question.indexOf(number);
        const before = question.substring(Math.max(0, index - 10), index).trim();
        const after = question.substring(index + number.length, index + number.length + 10).trim();
        
        return { before, after };
    }

    /**
     * Calculate overall entity confidence
     */
    calculateOverallEntityConfidence(entities) {
        const allEntities = [
            ...entities.products,
            ...entities.lines,
            ...entities.dosageForms,
            ...entities.machines,
            ...entities.keywords
        ];
        
        if (allEntities.length === 0) return 0;
        
        const totalConfidence = allEntities.reduce((sum, entity) => sum + (entity.confidence || 0), 0);
        return totalConfidence / allEntities.length;
    }

    /**
     * Generate RPN distribution analysis
     */
    generateRPNDistributionAnalysis(products) {
        let analysis = `### **📊 RPN Distribution Analysis**\n\n`;
        
        if (products.length === 0) return analysis;
        
        // Calculate quartiles
        const rpnValues = products.map(p => p.rpn).sort((a, b) => a - b);
        const q1 = rpnValues[Math.floor(rpnValues.length * 0.25)];
        const median = rpnValues[Math.floor(rpnValues.length * 0.5)];
        const q3 = rpnValues[Math.floor(rpnValues.length * 0.75)];
        
        analysis += `**📈 Statistical Summary:**\n`;
        analysis += `- **Q1 (25th percentile):** ${q1.toLocaleString()}\n`;
        analysis += `- **Median (50th percentile):** ${median.toLocaleString()}\n`;
        analysis += `- **Q3 (75th percentile):** ${q3.toLocaleString()}\n`;
        analysis += `- **Range:** ${(Math.max(...rpnValues) - Math.min(...rpnValues)).toLocaleString()}\n\n`;
        
        // Risk categories
        const highRisk = products.filter(p => p.rpn >= q3).length;
        const mediumRisk = products.filter(p => p.rpn >= median && p.rpn < q3).length;
        const lowRisk = products.filter(p => p.rpn < median).length;
        
        analysis += `**🎯 Risk Categories:**\n`;
        analysis += `- **High Risk (≥Q3):** ${highRisk} products\n`;
        analysis += `- **Medium Risk (Q1-Q3):** ${mediumRisk} products\n`;
        analysis += `- **Low Risk (<Median):** ${lowRisk} products\n`;
        
        return analysis;
    }

    /**
     * Get most used machine
     */
    getMostUsedMachine() {
        let maxUsage = 0;
        let mostUsed = 'N/A';
        
        this.searchIndex.machineUsage.forEach((data, machine) => {
            if (data.totalProducts > maxUsage) {
                maxUsage = data.totalProducts;
                mostUsed = machine;
            }
        });
        
        return `${mostUsed} (${maxUsage} products)`;
    }

    /**
     * Get least used machine
     */
    getLeastUsedMachine() {
        let minUsage = Infinity;
        let leastUsed = 'N/A';
        
        this.searchIndex.machineUsage.forEach((data, machine) => {
            if (data.totalProducts < minUsage) {
                minUsage = data.totalProducts;
                leastUsed = machine;
            }
        });
        
        return `${leastUsed} (${minUsage} products)`;
    }

    /**
     * Calculate data completeness percentage
     */
    calculateDataCompleteness() {
        let totalFields = 0;
        let completedFields = 0;
        
        this.appData.products.forEach(product => {
            totalFields += 5; // name, rpn, line, dosageForm, machines
            
            if (product.name) completedFields++;
            if (product.rpn > 0) completedFields++;
            if (product.line) completedFields++;
            if (product.dosageForm) completedFields++;
            if (product.machines && product.machines.length > 0) completedFields++;
        });
        
        return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    }

    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        const totalQuestions = this.analytics.totalQuestions;
        if (totalQuestions === 0) return 0;
        
        // This is a simplified calculation - in a real implementation,
        // you'd track cache hits vs misses
        return Math.round((this.cache.size / Math.max(totalQuestions, 1)) * 100);
    }

    /**
     * Get popular questions from analytics
     */
    getPopularQuestions() {
        const popular = Array.from(this.analytics.popularQuestions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([question]) => question);
        
        // Add defaults if no popular questions yet
        if (popular.length === 0) {
            return [
                "What is the MACO calculation method?",
                "How many products are in Line 1?",
                "What is the highest RPN product?",
                "Show system statistics",
                "How many studies are required?"
            ];
        }
        
        return popular;
    }

    /**
     * Get available lines info
     */
    getAvailableLinesInfo() {
        let info = `**📋 Available Lines:**\n`;
        this.searchIndex.lines.forEach((trains, line) => {
            info += `- ${this.capitalizeWords(line)}\n`;
        });
        return info;
    }

    /**
     * Get available dosage forms info
     */
    getAvailableDosageFormsInfo() {
        let info = `**💊 Available Dosage Forms:**\n`;
        this.searchIndex.dosageForms.forEach((trains, form) => {
            info += `- ${form}\n`;
        });
        return info;
    }

    /**
     * Get general MACO info
     */
    getGeneralMACOInfo() {
        return `**📚 MACO Calculation Information:**\n\n` +
               `MACO (Maximum Allowable Carryover) is calculated using four methods:\n` +
               `1. **Dose-based:** (NOEL × MBS) / (SF × TDD)\n` +
               `2. **10 ppm approach:** (10 × MBS) / 1,000,000\n` +
               `3. **1/1000 dose:** (Smallest dose × MBS) / (1000 × Largest batch)\n` +
               `4. **Visually clean:** Based on detection limits\n\n` +
               `The **lowest value** from all methods is used as the acceptance limit.`;
    }

    // ========== PERFORMANCE AND MONITORING ==========

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor memory usage
        if (typeof window !== 'undefined' && window.performance) {
            setInterval(() => {
                if (window.performance.memory) {
                    this.log(`Memory usage: ${(window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
                }
            }, 60000); // Check every minute
        }
        
        // Monitor cache size
        setInterval(() => {
            if (this.cache.size > 1000) {
                this.log('Cache size exceeded 1000 entries, cleaning up...');
                this.manageCacheSize();
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Manage cache size to prevent memory leaks
     */
    manageCacheSize() {
        if (this.cache.size > 500) {
            // Remove oldest entries (simple LRU implementation)
            const entries = Array.from(this.cache.entries());
            const toRemove = entries.slice(0, this.cache.size - 400);
            toRemove.forEach(([key]) => this.cache.delete(key));
            
            this.log(`Cache cleaned: removed ${toRemove.length} entries`);
        }
    }

    /**
     * Create timeout promise for question processing
     */
    createTimeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Question processing timeout after ${this.config.maxResponseTime}ms`));
            }, this.config.maxResponseTime);
        });
    }

    /**
     * Update popular questions analytics
     */
    updatePopularQuestions(question) {
        const normalizedQuestion = question.toLowerCase().trim();
        const count = this.analytics.popularQuestions.get(normalizedQuestion) || 0;
        this.analytics.popularQuestions.set(normalizedQuestion, count + 1);
    }

    /**
     * Update average response time
     */
    updateAverageResponseTime(responseTime) {
        const total = this.analytics.averageResponseTime * (this.analytics.totalQuestions - 1);
        this.analytics.averageResponseTime = (total + responseTime) / this.analytics.totalQuestions;
    }

    /**
     * Generate cache key for question and context
     */
    generateCacheKey(question, context) {
        const contextStr = JSON.stringify(context);
        return `${question.toLowerCase().trim()}_${contextStr}`;
    }

    /**
     * Generate error response
     */
    generateErrorResponse(error) {
        if (error.message.includes('timeout')) {
            return `⏰ **Request Timeout:** Your question is taking too long to process. Please try a simpler question or check your data.`;
        } else if (error.message.includes('Invalid')) {
            return `❌ **Invalid Input:** ${error.message}`;
        } else {
            return `❌ **System Error:** I encountered an unexpected error while processing your question. Please try again or contact support.`;
        }
    }

    /**
     * Generate error suggestions
     */
    generateErrorSuggestions() {
        return [
            "Try asking a simpler question",
            "Check if your question contains valid product or line names",
            "Ask about system statistics",
            "Try: 'What is the highest RPN product?'",
            "Try: 'How many products are in the system?'"
        ];
    }

    // ========== UTILITY HELPERS ==========

    /**
     * Sanitize string input
     */
    sanitizeString(input) {
        if (typeof input !== 'string') return null;
        return input.trim().replace(/[<>]/g, '');
    }

    /**
     * Sanitize number input
     */
    sanitizeNumber(input) {
        const num = parseFloat(input);
        return isNaN(num) ? null : num;
    }

    /**
     * Capitalize words in a string
     */
    capitalizeWords(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    /**
     * Calculate total records in normalized data
     */
    calculateTotalRecords(data) {
        return data.trains.length + data.products.length + data.machines.length;
    }

    /**
     * Get index statistics
     */
    getIndexStats() {
        return `Products: ${this.searchIndex.products.size}, ` +
               `Trains: ${this.searchIndex.trains.size}, ` +
               `Machines: ${this.searchIndex.machines.size}, ` +
               `Keywords: ${this.searchIndex.keywords.size}`;
    }

    /**
     * Handle errors with logging
     */
    handleError(context, error) {
        const errorMsg = `${context}: ${error.message}`;
        this.log(errorMsg, 'error');
        
        if (this.config.debugMode) {
            console.error(`[EnhancedQA Error] ${errorMsg}`, error);
        }
    }

    /**
     * Logging utility
     */
    log(message, level = 'info') {
        if (this.config.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[EnhancedQA ${level.toUpperCase()}] ${timestamp}: ${message}`);
        }
    }

    /**
     * Get system analytics
     */
    getAnalytics() {
        return {
            ...this.analytics,
            cacheSize: this.cache.size,
            indexSize: this.getIndexStats(),
            systemHealth: this.calculateSystemHealth()
        };
    }

    /**
     * Calculate system health score
     */
    calculateSystemHealth() {
        let score = 100;
        
        // Deduct points for errors
        const errorRate = this.analytics.failedAnswers / Math.max(this.analytics.totalQuestions, 1);
        score -= errorRate * 50;
        
        // Deduct points for slow responses
        if (this.analytics.averageResponseTime > 1000) {
            score -= 20;
        }
        
        // Deduct points for incomplete data
        const completeness = this.calculateDataCompleteness();
        score = score * (completeness / 100);
        
        return Math.max(0, Math.round(score));
    }

    /**
     * Reset analytics
     */
    resetAnalytics() {
        this.analytics = {
            totalQuestions: 0,
            successfulAnswers: 0,
            failedAnswers: 0,
            averageResponseTime: 0,
            popularQuestions: new Map()
        };
        this.cache.clear();
    }

    /**
     * Export configuration and analytics
     */
    exportStats() {
        return {
            config: this.config,
            analytics: this.getAnalytics(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Render the Q&A interface
     */
    render() {
        const qaContainer = document.getElementById('qaContainer');
        if (!qaContainer) {
            console.warn('Q&A container not found');
            return;
        }

        qaContainer.innerHTML = `
            <div class="qa-interface">
                <div class="qa-header">
                    <h2 class="text-2xl font-bold mb-4">🤖 Intelligent Q&A System</h2>
                    <p class="text-gray-600 mb-6">Ask questions about your cleaning validation data, MACO calculations, products, machines, and more!</p>
                </div>
                
                <div class="qa-input-section mb-6">
                    <div class="flex gap-4">
                        <input 
                            type="text" 
                            id="qaQuestionInput" 
                            placeholder="Ask a question... (e.g., 'What is the highest RPN product?', 'How many products are in Line 1?')"
                            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button 
                            id="qaAskButton" 
                            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            Ask
                        </button>
                    </div>
                </div>

                <div class="qa-response-section">
                    <div id="qaResponse" class="min-h-[200px] p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div class="text-center text-gray-500">
                            <div class="text-4xl mb-2">🤖</div>
                            <p>Ask me anything about your cleaning validation data!</p>
                            <div class="mt-4 text-sm">
                                <p><strong>Try asking:</strong></p>
                                <ul class="list-disc list-inside mt-2 space-y-1">
                                    <li>"What is the highest RPN product?"</li>
                                    <li>"How many products are in Line 1?"</li>
                                    <li>"What is the MACO calculation method?"</li>
                                    <li>"Show machine coverage analysis"</li>
                                    <li>"How many studies are required?"</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="qa-suggestions mt-6">
                    <h3 class="text-lg font-semibold mb-3">💡 Popular Questions</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="What is the highest RPN product?">
                            🔺 What is the highest RPN product?
                        </button>
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="How many products are in the system?">
                            📊 How many products are in the system?
                        </button>
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="What is the MACO calculation method?">
                            🧮 What is the MACO calculation method?
                        </button>
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="Show system statistics">
                            📈 Show system statistics
                        </button>
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="How many studies are required?">
                            🔬 How many studies are required?
                        </button>
                        <button class="suggestion-btn px-4 py-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-question="What are the safety factors?">
                            🛡️ What are the safety factors?
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for the Q&A interface
     */
    setupEventListeners() {
        const questionInput = document.getElementById('qaQuestionInput');
        const askButton = document.getElementById('qaAskButton');
        const responseDiv = document.getElementById('qaResponse');
        const suggestionButtons = document.querySelectorAll('.suggestion-btn');

        // Handle ask button click
        askButton.addEventListener('click', () => {
            const question = questionInput.value.trim();
            if (question) {
                this.handleQuestion(question, responseDiv);
                questionInput.value = '';
            }
        });

        // Handle enter key in input
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const question = questionInput.value.trim();
                if (question) {
                    this.handleQuestion(question, responseDiv);
                    questionInput.value = '';
                }
            }
        });

        // Handle suggestion button clicks
        suggestionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const question = button.getAttribute('data-question');
                questionInput.value = question;
                this.handleQuestion(question, responseDiv);
            });
        });
    }

    /**
     * Handle a question and display the response
     */
    async handleQuestion(question, responseDiv) {
        // Show loading state
        responseDiv.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-3 text-gray-600">Processing your question...</span>
            </div>
        `;

        try {
            // Test pattern matching for debugging
            if (this.config.debugMode) {
                this.testPatternMatching(question);
            }
            
            const result = await this.askQuestion(question);
            
            if (result.success) {
                responseDiv.innerHTML = `
                    <div class="qa-response">
                        <div class="flex items-start gap-3 mb-4">
                            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                🤖
                            </div>
                            <div class="flex-1">
                                <div class="font-semibold text-gray-900 mb-2">Question:</div>
                                <div class="text-gray-700 mb-4">${question}</div>
                                <div class="font-semibold text-gray-900 mb-2">Answer:</div>
                                <div class="prose max-w-none">
                                    ${this.formatMarkdownResponse(result.answer)}
                                </div>
                                ${result.suggestions && result.suggestions.length > 0 ? `
                                    <div class="mt-4">
                                        <div class="font-semibold text-gray-900 mb-2">💡 Suggestions:</div>
                                        <ul class="list-disc list-inside text-gray-700">
                                            ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                responseDiv.innerHTML = `
                    <div class="qa-response">
                        <div class="flex items-start gap-3 mb-4">
                            <div class="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                ❌
                            </div>
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-2">Error:</div>
                                <div class="text-red-700 mb-4">${result.answer}</div>
                                ${result.suggestions && result.suggestions.length > 0 ? `
                                    <div class="mt-4">
                                        <div class="font-semibold text-gray-900 mb-2">💡 Try asking:</div>
                                        <ul class="list-disc list-inside text-gray-700">
                                            ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            responseDiv.innerHTML = `
                <div class="qa-response">
                    <div class="flex items-start gap-3 mb-4">
                        <div class="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            ❌
                        </div>
                        <div class="flex-1">
                            <div class="font-semibold text-red-900 mb-2">Error:</div>
                            <div class="text-red-700">Failed to process your question: ${error.message}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Format markdown response for display
     */
    formatMarkdownResponse(markdown) {
        // Simple markdown to HTML conversion
        return markdown
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 py-0.5 rounded text-sm">$1</code>')
            .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')
            .replace(/\n\n/g, '</p><p class="mb-3">')
            .replace(/^(.*)$/gim, '<p class="mb-3">$1</p>')
            .replace(/<p class="mb-3"><\/p>/g, '')
            .replace(/<li class="ml-4">(.*?)<\/li>/g, '<ul class="list-disc list-inside mb-3"><li>$1</li></ul>');
    }

    /**
     * Test pattern matching for debugging
     */
    testPatternMatching(question) {
        console.log('Testing pattern matching for:', question);
        console.log('Available patterns:', this.questionPatterns.length);
        
        this.questionPatterns.forEach(patternGroup => {
            console.log(`\nTesting pattern group: ${patternGroup.id}`);
            patternGroup.patterns.forEach((pattern, index) => {
                const match = question.match(pattern);
                console.log(`  Pattern ${index}: ${pattern.toString()}`);
                console.log(`  Match: ${match ? match[0] : 'No match'}`);
            });
        });
    }
}

// Export for both CommonJS and ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QAView;
} else if (typeof window !== 'undefined') {
    window.QAView = QAView;
}

export { QAView };
export default QAView;

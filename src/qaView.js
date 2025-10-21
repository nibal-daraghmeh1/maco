/**
 * Intelligent Q&A System for Cleaning Validation App
 * Understands natural language questions and searches app data for answers
 */

class IntelligentQA {
    constructor(appData) {
        this.appData = appData;
        this.questionPatterns = this.initializeQuestionPatterns();
        this.searchIndex = this.buildSearchIndex();
    }

    /**
     * Initialize question patterns and their handlers
     */
    initializeQuestionPatterns() {
        return [
            // MACO related questions
            {
                patterns: [
                    /what.*maco.*(?:value|limit|calculation)/i,
                    /maco.*(?:for|of).*([a-zA-Z\s]+)/i,
                    /calculate.*maco/i,
                    /maximum.*allowable.*carryover/i
                ],
                type: 'maco',
                handler: this.handleMACOQuestions.bind(this)
            },

            // Product related questions
            {
                patterns: [
                    /(?:which|what).*products.*(?:in|for).*([a-zA-Z0-9\s]+)/i,
                    /(?:list|show).*products/i,
                    /products.*(?:line|train|group)/i,
                    /how many.*products/i
                ],
                type: 'products',
                handler: this.handleProductQuestions.bind(this)
            },

            // Train related questions
            {
                patterns: [
                    /(?:which|what).*trains/i,
                    /train.*(?:contains|has|includes)/i,
                    /how many.*trains/i,
                    /trains.*(?:for|in).*([a-zA-Z0-9\s]+)/i
                ],
                type: 'trains',
                handler: this.handleTrainQuestions.bind(this)
            },

            // Machine related questions
            {
                patterns: [
                    /(?:which|what).*machines/i,
                    /machines.*(?:used|covered|required)/i,
                    /equipment.*(?:for|in)/i,
                    /machine.*coverage/i
                ],
                type: 'machines',
                handler: this.handleMachineQuestions.bind(this)
            },

            // Study related questions
            {
                patterns: [
                    /how many.*stud(?:y|ies)/i,
                    /(?:which|what).*stud(?:y|ies)/i,
                    /stud(?:y|ies).*(?:required|needed)/i,
                    /cleaning.*validation.*stud(?:y|ies)/i
                ],
                type: 'studies',
                handler: this.handleStudyQuestions.bind(this)
            },

            // RPN related questions
            {
                patterns: [
                    /(?:highest|lowest|maximum|minimum).*rpn/i,
                    /rpn.*(?:value|score)/i,
                    /risk.*priority.*number/i,
                    /worst.*case.*product/i
                ],
                type: 'rpn',
                handler: this.handleRPNQuestions.bind(this)
            },

            // Safety factor questions
            {
                patterns: [
                    /safety.*factor/i,
                    /(?:what|which).*sf/i,
                    /factor.*(?:for|of).*([a-zA-Z\s]+)/i
                ],
                type: 'safety_factor',
                handler: this.handleSafetyFactorQuestions.bind(this)
            },

            // Line and dosage form questions
            {
                patterns: [
                    /(?:which|what).*lines/i,
                    /production.*line/i,
                    /dosage.*form/i,
                    /(?:tablets|capsules|powder|liquid)/i
                ],
                type: 'lines_dosage',
                handler: this.handleLinesDosageQuestions.bind(this)
            },

            // General statistics
            {
                patterns: [
                    /(?:total|overall|summary)/i,
                    /statistics/i,
                    /how many.*total/i,
                    /give.*overview/i
                ],
                type: 'statistics',
                handler: this.handleStatisticsQuestions.bind(this)
            }
        ];
    }

    /**
     * Build search index for faster data retrieval
     */
    buildSearchIndex() {
        const index = {
            products: new Map(),
            trains: new Map(),
            machines: new Map(),
            lines: new Map(),
            dosageForms: new Map()
        };

        // Process trains data
        if (this.appData && this.appData.trains) {
            this.appData.trains.forEach((train, trainIndex) => {
                // Index trains
                index.trains.set(train.id || trainIndex, train);
                
                // Index lines
                if (train.line) {
                    if (!index.lines.has(train.line)) {
                        index.lines.set(train.line, []);
                    }
                    index.lines.get(train.line).push(train);
                }

                // Index dosage forms
                if (train.dosageForm) {
                    if (!index.dosageForms.has(train.dosageForm)) {
                        index.dosageForms.set(train.dosageForm, []);
                    }
                    index.dosageForms.get(train.dosageForm).push(train);
                }

                // Index products and machines
                if (train.products) {
                    train.products.forEach(product => {
                        // Calculate RPN for the product
                        const productWithRPN = {
                            ...product,
                            rpn: this.calculateProductRPN(product),
                            train
                        };
                        index.products.set(product.name, productWithRPN);
                        
                        if (product.machines) {
                            product.machines.forEach(machine => {
                                if (!index.machines.has(machine)) {
                                    index.machines.set(machine, []);
                                }
                                index.machines.get(machine).push({ product: productWithRPN, train });
                            });
                        }
                    });
                }
            });
        }

        // Process products data directly if available
        if (this.appData && this.appData.products) {
            this.appData.products.forEach(product => {
                // Calculate RPN for each product
                const productWithRPN = {
                    ...product,
                    rpn: this.calculateProductRPN(product)
                };
                
                if (!index.products.has(product.name)) {
                    index.products.set(product.name, productWithRPN);
                }
            });
        }

        // Process machines data directly if available
        if (this.appData && this.appData.machines) {
            this.appData.machines.forEach(machine => {
                if (!index.machines.has(machine.name)) {
                    index.machines.set(machine.name, []);
                }
            });
        }

        console.log('Q&A Search Index built:', {
            products: index.products.size,
            trains: index.trains.size,
            machines: index.machines.size,
            lines: index.lines.size,
            dosageForms: index.dosageForms.size
        });

        // Debug: Show some sample products with RPN
        const sampleProducts = Array.from(index.products.values()).slice(0, 3);
        console.log('Sample products with RPN:', sampleProducts.map(p => ({
            name: p.name,
            rpn: p.rpn,
            productType: p.productType,
            activeIngredients: p.activeIngredients?.length || 0
        })));

        return index;
    }

    /**
     * Calculate RPN for a product based on its active ingredients
     */
    calculateProductRPN(product) {
        if (!product.activeIngredients || product.activeIngredients.length === 0) {
            return 0;
        }

        let highestRPN = 0;
        product.activeIngredients.forEach(ingredient => {
            const rpn = this.calculateIngredientRPN(ingredient);
            if (rpn > highestRPN) {
                highestRPN = rpn;
            }
        });

        return highestRPN;
    }

    /**
     * Calculate RPN for a single ingredient based on solubility and cleanability
     */
    calculateIngredientRPN(ingredient) {
        // RPN calculation based on solubility and cleanability
        const solubility = ingredient.solubility === 'Freely soluble' ? 1 : 
                         ingredient.solubility === 'Soluble' ? 2 :
                         ingredient.solubility === 'Slightly soluble' ? 3 : 4;
        
        const cleanability = ingredient.cleanability === 'Easy' ? 1 :
                            ingredient.cleanability === 'Medium' ? 2 : 3;
        
        return solubility * cleanability;
    }

    /**
     * Main method to process questions and return answers
     */
    async askQuestion(question) {
        try {
            // Clean and normalize the question
            const normalizedQuestion = this.normalizeQuestion(question);
            
            // Find matching pattern
            const matchedPattern = this.findMatchingPattern(normalizedQuestion);
            
            if (matchedPattern) {
                // Extract entities from question
                const entities = this.extractEntities(normalizedQuestion, matchedPattern);
                
                // Get answer using appropriate handler
                const answer = await matchedPattern.handler(normalizedQuestion, entities);
                
                return {
                    success: true,
                    question: question,
                    answer: answer,
                    type: matchedPattern.type,
                    confidence: this.calculateConfidence(normalizedQuestion, matchedPattern)
                };
            } else {
                return this.handleUnknownQuestion(question);
            }
        } catch (error) {
            return {
                success: false,
                question: question,
                error: error.message,
                answer: "I encountered an error while processing your question. Please try rephrasing it."
            };
        }
    }

    /**
     * Normalize question for better matching
     */
    normalizeQuestion(question) {
        return question
            .toLowerCase()
            .trim()
            .replace(/[?!.]/g, '')
            .replace(/\s+/g, ' ');
    }

    /**
     * Find the best matching pattern for the question
     */
    findMatchingPattern(question) {
        let bestMatch = null;
        let bestScore = 0;

        for (const patternGroup of this.questionPatterns) {
            for (const pattern of patternGroup.patterns) {
                const match = question.match(pattern);
                if (match) {
                    const score = match[0].length / question.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = patternGroup;
                    }
                }
            }
        }

        return bestMatch;
    }

    /**
     * Extract entities (product names, line names, etc.) from question
     */
    extractEntities(question, pattern) {
        const entities = {
            products: [],
            lines: [],
            dosageForms: [],
            machines: [],
            numbers: []
        };

        // Extract product names
        this.searchIndex.products.forEach((product, name) => {
            if (question.includes(name.toLowerCase())) {
                entities.products.push(name);
            }
        });

        // Extract line names
        this.searchIndex.lines.forEach((trains, line) => {
            if (question.includes(line.toLowerCase())) {
                entities.lines.push(line);
            }
        });

        // Extract dosage forms
        this.searchIndex.dosageForms.forEach((trains, dosageForm) => {
            if (question.includes(dosageForm.toLowerCase())) {
                entities.dosageForms.push(dosageForm);
            }
        });

        // Extract numbers
        const numbers = question.match(/\d+/g);
        if (numbers) {
            entities.numbers = numbers.map(n => parseInt(n));
        }

        return entities;
    }

    /**
     * Handle MACO related questions
     */
    async handleMACOQuestions(question, entities) {
        let response = "## MACO Information\n\n";

        if (entities.products.length > 0) {
            // Specific product MACO
            const productName = entities.products[0];
            const productData = this.searchIndex.products.get(productName);
            
            if (productData && productData.maco) {
                response += `**MACO for ${productName}:** ${productData.maco.value} ${productData.maco.unit}\n\n`;
                response += `**Calculation Method:** ${productData.maco.method}\n`;
                response += `**Safety Factor:** ${productData.maco.safetyFactor}\n`;
            } else {
                response += `MACO data for ${productName} is not available in the current dataset.\n`;
            }
        } else {
            // General MACO information
            const allMAcos = Array.from(this.searchIndex.products.values())
                .filter(p => p.maco)
                .map(p => ({ name: p.name, maco: p.maco }));

            if (allMAcos.length > 0) {
                response += "**Available MACO Values:**\n\n";
                allMAcos.forEach(item => {
                    response += `- **${item.name}:** ${item.maco.value} ${item.maco.unit}\n`;
                });
            } else {
                response += "No MACO calculations are available in the current dataset.\n";
                response += "\n**To calculate MACO, you need:**\n";
                response += "- NOEL (No Observed Effect Level)\n";
                response += "- Maximum Batch Size (MBS)\n";
                response += "- Safety Factor (SF)\n";
                response += "- Therapeutic Daily Dose (TDD)\n";
                response += "\n**Formula:** MACO = (NOEL × MBS) / (SF × TDD)";
            }
        }

        return response;
    }

    /**
     * Handle product related questions
     */
    async handleProductQuestions(question, entities) {
        let response = "## Product Information\n\n";

        if (entities.lines.length > 0 || entities.dosageForms.length > 0) {
            // Products for specific line or dosage form
            let filteredProducts = Array.from(this.searchIndex.products.values());

            if (entities.lines.length > 0) {
                const line = entities.lines[0];
                filteredProducts = filteredProducts.filter(p => p.train.line === line);
                response += `**Products in ${line}:**\n\n`;
            }

            if (entities.dosageForms.length > 0) {
                const dosageForm = entities.dosageForms[0];
                filteredProducts = filteredProducts.filter(p => p.train.dosageForm === dosageForm);
                response += `**${dosageForm} Products:**\n\n`;
            }

            filteredProducts.forEach((product, index) => {
                response += `${index + 1}. **${product.name}**\n`;
                response += `   - RPN: ${product.rpn || 'N/A'}\n`;
                response += `   - Train: ${product.train.id || 'N/A'}\n`;
                response += `   - Line: ${product.train.line || 'N/A'}\n`;
                response += `   - Dosage Form: ${product.train.dosageForm || 'N/A'}\n\n`;
            });

            response += `**Total Products:** ${filteredProducts.length}`;
        } else {
            // All products
            const allProducts = Array.from(this.searchIndex.products.values());
            response += `**Total Products in System:** ${allProducts.length}\n\n`;

            // Group by line
            const productsByLine = new Map();
            allProducts.forEach(product => {
                const line = product.train.line || 'Unknown';
                if (!productsByLine.has(line)) {
                    productsByLine.set(line, []);
                }
                productsByLine.get(line).push(product);
            });

            productsByLine.forEach((products, line) => {
                response += `**${line}:** ${products.length} products\n`;
            });
        }

        return response;
    }

    /**
     * Handle train related questions
     */
    async handleTrainQuestions(question, entities) {
        let response = "## Train Information\n\n";

        const allTrains = Array.from(this.searchIndex.trains.values());
        
        if (entities.lines.length > 0) {
            const line = entities.lines[0];
            const lineTrains = allTrains.filter(t => t.line === line);
            
            response += `**Trains in ${line}:**\n\n`;
            lineTrains.forEach((train, index) => {
                response += `${index + 1}. **Train ${train.id || index + 1}**\n`;
                response += `   - Dosage Form: ${train.dosageForm || 'N/A'}\n`;
                response += `   - Products: ${train.products ? train.products.length : 0}\n`;
                response += `   - Machines: ${train.machines ? train.machines.length : 0}\n\n`;
            });
        } else {
            response += `**Total Trains:** ${allTrains.length}\n\n`;
            
            // Group by line
            const trainsByLine = new Map();
            allTrains.forEach(train => {
                const line = train.line || 'Unknown';
                if (!trainsByLine.has(line)) {
                    trainsByLine.set(line, 0);
                }
                trainsByLine.set(line, trainsByLine.get(line) + 1);
            });

            trainsByLine.forEach((count, line) => {
                response += `**${line}:** ${count} trains\n`;
            });
        }

        return response;
    }

    /**
     * Handle machine related questions
     */
    async handleMachineQuestions(question, entities) {
        let response = "## Machine Information\n\n";

        const allMachines = Array.from(this.searchIndex.machines.keys());
        response += `**Total Machines:** ${allMachines.length}\n\n`;

        if (entities.products.length > 0) {
            const productName = entities.products[0];
            const productData = this.searchIndex.products.get(productName);
            
            if (productData && productData.machines) {
                response += `**Machines used by ${productName}:**\n`;
                productData.machines.forEach(machine => {
                    response += `- ${machine}\n`;
                });
            }
        } else {
            response += "**All Machines:**\n";
            allMachines.forEach(machine => {
                const usage = this.searchIndex.machines.get(machine);
                response += `- **${machine}:** Used by ${usage.length} products\n`;
            });
        }

        return response;
    }

    /**
     * Handle study related questions
     */
    async handleStudyQuestions(question, entities) {
        let response = "## Study Information\n\n";

        // This would need to be calculated based on your study selection algorithm
        // For now, providing general information
        
        if (this.appData && this.appData.selectedStudies) {
            response += `**Studies Required:** ${this.appData.selectedStudies.length}\n\n`;
            
            this.appData.selectedStudies.forEach((study, index) => {
                response += `**Study ${index + 1}:** ${study.productName}\n`;
                response += `- RPN: ${study.rpn}\n`;
                response += `- Machines Covered: ${study.machinesCovered ? study.machinesCovered.length : 'N/A'}\n\n`;
            });
        } else {
            response += "Study selection data is not available. Studies are determined by:\n\n";
            response += "1. **Machine Coverage Algorithm**\n";
            response += "2. **Worst Case Product Selection**\n";
            response += "3. **Risk Priority Number (RPN) ranking**\n";
            response += "4. **Equipment sharing analysis**\n";
        }

        return response;
    }

    /**
     * Handle RPN related questions
     */
    async handleRPNQuestions(question, entities) {
        let response = "## RPN (Risk Priority Number) Information\n\n";

        const allProducts = Array.from(this.searchIndex.products.values())
            .filter(p => p.rpn !== undefined && p.rpn > 0)
            .sort((a, b) => b.rpn - a.rpn);

        if (allProducts.length === 0) {
            response += "No RPN data is available in the current dataset.\n\n";
            response += "**RPN Calculation:**\n";
            response += "RPN = Solubility Score × Cleanability Score\n\n";
            response += "**Scoring:**\n";
            response += "- **Solubility:** Freely soluble (1), Soluble (2), Slightly soluble (3), Practically insoluble (4)\n";
            response += "- **Cleanability:** Easy (1), Medium (2), Hard (3)\n\n";
            response += "**Example:** A product with 'Slightly soluble' (3) and 'Medium' cleanability (2) has RPN = 3 × 2 = 6";
            return response;
        }

        if (question.includes('highest') || question.includes('maximum')) {
            const highest = allProducts[0];
            response += `**Highest RPN:** ${highest.rpn}\n`;
            response += `**Product:** ${highest.name}\n`;
            if (highest.train) {
                response += `**Line:** ${highest.train.line || 'N/A'}\n`;
                response += `**Dosage Form:** ${highest.train.dosageForm || 'N/A'}\n`;
            }
            response += `**Product Type:** ${highest.productType || 'N/A'}\n`;
        } else if (question.includes('lowest') || question.includes('minimum')) {
            const lowest = allProducts[allProducts.length - 1];
            response += `**Lowest RPN:** ${lowest.rpn}\n`;
            response += `**Product:** ${lowest.name}\n`;
            if (lowest.train) {
                response += `**Line:** ${lowest.train.line || 'N/A'}\n`;
                response += `**Dosage Form:** ${lowest.train.dosageForm || 'N/A'}\n`;
            }
            response += `**Product Type:** ${lowest.productType || 'N/A'}\n`;
        } else {
            response += `**RPN Range:** ${allProducts[allProducts.length - 1].rpn} - ${allProducts[0].rpn}\n\n`;
            response += "**Top 5 Highest RPN Products:**\n";
            
            allProducts.slice(0, 5).forEach((product, index) => {
                response += `${index + 1}. **${product.name}:** ${product.rpn} (${product.productType || 'N/A'})\n`;
            });

            response += `\n**Total Products with RPN:** ${allProducts.length}`;
        }

        return response;
    }

    /**
     * Handle safety factor questions
     */
    async handleSafetyFactorQuestions(question, entities) {
        let response = "## Safety Factor Information\n\n";

        response += "**Safety Factors by Route of Administration:**\n\n";
        response += "- **Oral:** 100 - 1,000 (typical: 1,000)\n";
        response += "- **Topical:** 10 - 100 (typical: 50)\n";
        response += "- **Parenteral:** 1,000 - 10,000 (typical: 10,000)\n";
        response += "- **Inhalation:** 1,000 - 10,000 (typical: 10,000)\n";
        response += "- **Ophthalmic:** 1,000 - 10,000 (typical: 5,000)\n";
        response += "- **Suppository:** 100 - 1,000 (typical: 1,000)\n\n";

        response += "**Additional Factors:**\n";
        response += "- **Pediatric patients:** ×5-10 multiplier\n";
        response += "- **Geriatric patients:** ×2-5 multiplier\n";
        response += "- **Highly potent drugs:** ×10-100 multiplier\n";
        response += "- **Cytotoxic drugs:** ×1,000-10,000 multiplier\n";

        return response;
    }

    /**
     * Handle lines and dosage form questions
     */
    async handleLinesDosageQuestions(question, entities) {
        let response = "## Lines and Dosage Forms\n\n";

        const lines = Array.from(this.searchIndex.lines.keys());
        const dosageForms = Array.from(this.searchIndex.dosageForms.keys());

        response += `**Production Lines (${lines.length}):**\n`;
        lines.forEach(line => {
            const trains = this.searchIndex.lines.get(line);
            response += `- **${line}:** ${trains.length} trains\n`;
        });

        response += `\n**Dosage Forms (${dosageForms.length}):**\n`;
        dosageForms.forEach(form => {
            const trains = this.searchIndex.dosageForms.get(form);
            response += `- **${form}:** ${trains.length} trains\n`;
        });

        return response;
    }

    /**
     * Handle statistics questions
     */
    async handleStatisticsQuestions(question, entities) {
        let response = "## System Statistics\n\n";

        const totalProducts = this.searchIndex.products.size;
        const totalTrains = this.searchIndex.trains.size;
        const totalMachines = this.searchIndex.machines.size;
        const totalLines = this.searchIndex.lines.size;
        const totalDosageForms = this.searchIndex.dosageForms.size;

        response += `**📊 Overview:**\n`;
        response += `- **Products:** ${totalProducts}\n`;
        response += `- **Trains:** ${totalTrains}\n`;
        response += `- **Machines:** ${totalMachines}\n`;
        response += `- **Production Lines:** ${totalLines}\n`;
        response += `- **Dosage Forms:** ${totalDosageForms}\n\n`;

        // Calculate average products per train
        const avgProductsPerTrain = totalTrains > 0 ? (totalProducts / totalTrains).toFixed(1) : 0;
        response += `**📈 Averages:**\n`;
        response += `- **Products per Train:** ${avgProductsPerTrain}\n`;

        return response;
    }

    /**
     * Handle unknown questions
     */
    handleUnknownQuestion(question) {
        return {
            success: false,
            question: question,
            answer: `I couldn't understand your question: "${question}"\n\n**Try asking about:**\n- MACO calculations\n- Products in specific lines\n- Train information\n- Machine coverage\n- Study requirements\n- RPN values\n- Safety factors\n- System statistics\n\n**Example questions:**\n- "What is the MACO for Product A?"\n- "How many products are in Line 1?"\n- "Which machines are used by Product B?"\n- "What studies are required for tablets?"\n- "What is the highest RPN product?"`,
            suggestions: [
                "What is the MACO calculation?",
                "How many products are in the system?",
                "Which trains are in Line 1?",
                "What machines are covered?",
                "How many studies are required?"
            ]
        };
    }

    /**
     * Calculate confidence score for the answer
     */
    calculateConfidence(question, pattern) {
        // Simple confidence calculation based on pattern match strength
        const matchStrength = pattern.patterns.reduce((max, p) => {
            const match = question.match(p);
            return match ? Math.max(max, match[0].length / question.length) : max;
        }, 0);

        return Math.min(0.95, Math.max(0.3, matchStrength));
    }
}

// Q&A View Module
class QAView {
    constructor() {
        this.qaSystem = null;
        this.chatHistory = [];
        this.isInitialized = false;
    }

    /**
     * Initialize the Q&A system with app data
     */
    initialize(appData) {
        this.qaSystem = new IntelligentQA(appData);
        this.isInitialized = true;
        console.log('Q&A System initialized with app data');
    }

    /**
     * Render the Q&A interface
     */
    render() {
        const container = document.getElementById('qaContainer');
        if (!container) {
            console.error('Q&A container not found');
            return;
        }

        container.innerHTML = `
            <div class="qa-interface">
                <div class="qa-header">
                    <h2 class="text-2xl font-bold mb-4">🤖 Intelligent Q&A Assistant</h2>
                    <p class="text-gray-600 mb-6">Ask questions about your cleaning validation data in natural language</p>
                </div>

                <div class="qa-chat-container">
                    <div id="qaChatHistory" class="qa-chat-history">
                        ${this.renderWelcomeMessage()}
                    </div>
                    
                    <div class="qa-input-container">
                        <div class="qa-input-wrapper">
                            <input 
                                type="text" 
                                id="qaQuestionInput" 
                                placeholder="Ask a question about your data..." 
                                class="qa-question-input"
                                autocomplete="off"
                            >
                            <button id="qaAskButton" class="qa-ask-button">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="qa-suggestions">
                            <p class="text-sm text-gray-500 mb-2">Try asking:</p>
                            <div class="qa-suggestion-chips">
                                <button class="qa-suggestion-chip" data-question="How many products are in the system?">Products count</button>
                                <button class="qa-suggestion-chip" data-question="What is the highest RPN product?">Highest RPN</button>
                                <button class="qa-suggestion-chip" data-question="Which trains are in Line 1?">Trains by line</button>
                                <button class="qa-suggestion-chip" data-question="What machines are covered?">Machine coverage</button>
                                <button class="qa-suggestion-chip" data-question="How many studies are required?">Study requirements</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .qa-interface {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 20px;
                }

                .qa-chat-container {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }

                .qa-chat-history {
                    max-height: 500px;
                    overflow-y: auto;
                    padding: 20px;
                    background: #f8f9fa;
                }

                .qa-message {
                    margin-bottom: 20px;
                    animation: fadeIn 0.3s ease-in;
                }

                .qa-message.user {
                    text-align: right;
                }

                .qa-message.assistant {
                    text-align: left;
                }

                .qa-message-bubble {
                    display: inline-block;
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 18px;
                    word-wrap: break-word;
                }

                .qa-message.user .qa-message-bubble {
                    background: #007bff;
                    color: white;
                }

                .qa-message.assistant .qa-message-bubble {
                    background: white;
                    color: #333;
                    border: 1px solid #e0e0e0;
                }

                .qa-message-content {
                    white-space: pre-wrap;
                    line-height: 1.5;
                }

                .qa-message-meta {
                    font-size: 0.75rem;
                    color: #666;
                    margin-top: 4px;
                }

                .qa-input-container {
                    padding: 20px;
                    background: white;
                    border-top: 1px solid #e0e0e0;
                }

                .qa-input-wrapper {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .qa-question-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 2px solid #e0e0e0;
                    border-radius: 25px;
                    font-size: 16px;
                    outline: none;
                    transition: border-color 0.3s ease;
                }

                .qa-question-input:focus {
                    border-color: #007bff;
                }

                .qa-ask-button {
                    padding: 12px 16px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .qa-ask-button:hover {
                    background: #0056b3;
                }

                .qa-ask-button:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                }

                .qa-suggestions {
                    margin-top: 15px;
                }

                .qa-suggestion-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .qa-suggestion-chip {
                    padding: 6px 12px;
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }

                .qa-suggestion-chip:hover {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }

                .qa-loading {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #666;
                    font-style: italic;
                }

                .qa-loading-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .qa-error {
                    color: #dc3545;
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    padding: 10px;
                    border-radius: 6px;
                    margin: 10px 0;
                }

                .qa-success {
                    color: #155724;
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    padding: 10px;
                    border-radius: 6px;
                    margin: 10px 0;
                }
            </style>
        `;

        this.attachEventListeners();
    }

    /**
     * Render welcome message
     */
    renderWelcomeMessage() {
        return `
            <div class="qa-message assistant">
                <div class="qa-message-bubble">
                    <div class="qa-message-content">
                        👋 Hello! I'm your intelligent Q&A assistant for cleaning validation data.

                        I can help you with questions about:
                        • **MACO calculations** and values
                        • **Products** in specific lines or dosage forms
                        • **Trains** and their configurations
                        • **Machines** and equipment coverage
                        • **Study requirements** and selection
                        • **RPN values** and risk assessment
                        • **Safety factors** and guidelines
                        • **System statistics** and overview

                        Try asking something like "How many products are in the system?" or "What is the highest RPN product?"
                    </div>
                    <div class="qa-message-meta">Assistant • Just now</div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const input = document.getElementById('qaQuestionInput');
        const button = document.getElementById('qaAskButton');
        const suggestionChips = document.querySelectorAll('.qa-suggestion-chip');

        // Ask button click
        button.addEventListener('click', () => this.askQuestion());

        // Enter key press
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.askQuestion();
            }
        });

        // Suggestion chips
        suggestionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const question = chip.getAttribute('data-question');
                input.value = question;
                this.askQuestion();
            });
        });
    }

    /**
     * Ask a question and display the answer
     */
    async askQuestion() {
        const input = document.getElementById('qaQuestionInput');
        const button = document.getElementById('qaAskButton');
        const chatHistory = document.getElementById('qaChatHistory');

        const question = input.value.trim();
        if (!question) return;

        if (!this.isInitialized) {
            this.addMessage('assistant', 'Q&A system is not initialized yet. Please wait for the app to load completely.');
            return;
        }

        // Clear input and disable button
        input.value = '';
        button.disabled = true;
        button.innerHTML = '<div class="qa-loading-spinner"></div>';

        // Add user message
        this.addMessage('user', question);

        // Add loading message
        const loadingId = this.addMessage('assistant', 'Thinking...', true);

        try {
            // Get answer from Q&A system
            const result = await this.qaSystem.askQuestion(question);
            
            // Remove loading message
            this.removeMessage(loadingId);

            // Add answer
            if (result.success) {
                this.addMessage('assistant', result.answer);
            } else {
                this.addMessage('assistant', result.answer, false, true);
            }

            // Add to chat history
            this.chatHistory.push({
                question: question,
                answer: result.answer,
                success: result.success,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error asking question:', error);
            this.removeMessage(loadingId);
            this.addMessage('assistant', 'Sorry, I encountered an error while processing your question. Please try again.', false, true);
        } finally {
            // Re-enable button
            button.disabled = false;
            button.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
            `;
        }
    }

    /**
     * Add a message to the chat
     */
    addMessage(sender, content, isLoading = false, isError = false) {
        const chatHistory = document.getElementById('qaChatHistory');
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const messageElement = document.createElement('div');
        messageElement.className = `qa-message ${sender}`;
        messageElement.id = messageId;
        
        const bubbleClass = isError ? 'qa-error' : (isLoading ? 'qa-loading' : 'qa-message-bubble');
        const contentClass = isLoading ? 'qa-loading' : 'qa-message-content';
        
        messageElement.innerHTML = `
            <div class="${bubbleClass}">
                ${isLoading ? '<div class="qa-loading-spinner"></div>' : ''}
                <div class="${contentClass}">${content}</div>
                ${!isLoading ? `<div class="qa-message-meta">${sender === 'user' ? 'You' : 'Assistant'} • ${new Date().toLocaleTimeString()}</div>` : ''}
            </div>
        `;
        
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        return messageId;
    }

    /**
     * Remove a message from the chat
     */
    removeMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }

    /**
     * Clear chat history
     */
    clearChat() {
        const chatHistory = document.getElementById('qaChatHistory');
        if (chatHistory) {
            chatHistory.innerHTML = this.renderWelcomeMessage();
        }
        this.chatHistory = [];
    }
}

// Export for use in other modules
export { QAView, IntelligentQA };

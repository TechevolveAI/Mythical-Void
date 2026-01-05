/**
 * AgentToolRegistry - Tool definitions and execution for AI creature agents
 * Manages in-game tools that creatures can use to complete tasks
 */

import { devLog, devWarn } from '../utils/devLogger.js';

class AgentToolRegistryService {
    constructor() {
        this.initialized = false;
        this.tools = new Map();
        this.executionHistory = [];
        this.maxHistorySize = 50;
    }

    /**
     * Initialize the tool registry
     */
    initialize() {
        if (this.initialized) return this;

        this.registerDefaultTools();
        this.initialized = true;

        devLog('[AgentToolRegistry] Initialized with', this.tools.size, 'tools');
        return this;
    }

    /**
     * Register all default in-game tools
     */
    registerDefaultTools() {
        // Tool: collect_coins - Gather coins within range
        this.register({
            id: 'collect_coins',
            name: 'Collect Coins',
            description: 'Collect visible coins within range of the creature',
            category: 'in_game',
            kidSafe: true,
            cooldown: 5000, // 5 second cooldown
            parameters: {
                range: { type: 'number', default: 150, min: 50, max: 300 }
            },
            execute: async (params, context) => {
                return this.executeCollectCoins(params, context);
            }
        });

        // Tool: explore_area - Move to and explore a biome area
        this.register({
            id: 'explore_area',
            name: 'Explore Area',
            description: 'Move to and explore a specific area or biome',
            category: 'in_game',
            kidSafe: true,
            cooldown: 10000, // 10 second cooldown
            parameters: {
                direction: { type: 'string', enum: ['north', 'south', 'east', 'west', 'random'], default: 'random' },
                distance: { type: 'number', default: 200, min: 100, max: 500 }
            },
            execute: async (params, context) => {
                return this.executeExploreArea(params, context);
            }
        });

        // Tool: check_stats - Report creature stats
        this.register({
            id: 'check_stats',
            name: 'Check Stats',
            description: 'Check and report the creature\'s current stats',
            category: 'in_game',
            kidSafe: true,
            cooldown: 2000,
            parameters: {},
            execute: async (params, context) => {
                return this.executeCheckStats(params, context);
            }
        });

        // Tool: suggest_care - Recommend care actions
        this.register({
            id: 'suggest_care',
            name: 'Suggest Care',
            description: 'Analyze stats and suggest appropriate care actions (feed, play, rest)',
            category: 'in_game',
            kidSafe: true,
            cooldown: 3000,
            parameters: {},
            execute: async (params, context) => {
                return this.executeSuggestCare(params, context);
            }
        });

        // Tool: send_message - Send a message to the player
        this.register({
            id: 'send_message',
            name: 'Send Message',
            description: 'Send a chat message to the player',
            category: 'communication',
            kidSafe: true,
            cooldown: 1000,
            parameters: {
                message: { type: 'string', required: true, maxLength: 200 }
            },
            execute: async (params, context) => {
                return this.executeSendMessage(params, context);
            }
        });

        // Tool: remember - Store something in long-term memory
        this.register({
            id: 'remember',
            name: 'Remember',
            description: 'Store important information in long-term memory',
            category: 'memory',
            kidSafe: true,
            cooldown: 2000,
            parameters: {
                key: { type: 'string', required: true, maxLength: 50 },
                value: { type: 'string', required: true, maxLength: 500 }
            },
            execute: async (params, context) => {
                return this.executeRemember(params, context);
            }
        });

        // Tool: recall - Retrieve from long-term memory
        this.register({
            id: 'recall',
            name: 'Recall',
            description: 'Retrieve information from long-term memory',
            category: 'memory',
            kidSafe: true,
            cooldown: 1000,
            parameters: {
                key: { type: 'string', required: true }
            },
            execute: async (params, context) => {
                return this.executeRecall(params, context);
            }
        });
    }

    /**
     * Register a new tool
     */
    register(toolDef) {
        if (!toolDef.id || !toolDef.execute) {
            devWarn('[AgentToolRegistry] Invalid tool definition:', toolDef);
            return false;
        }

        this.tools.set(toolDef.id, {
            ...toolDef,
            lastExecuted: 0
        });

        devLog('[AgentToolRegistry] Registered tool:', toolDef.id);
        return true;
    }

    /**
     * Get a tool by ID
     */
    getTool(toolId) {
        return this.tools.get(toolId) || null;
    }

    /**
     * Get all tools, optionally filtered
     */
    getAllTools(filter = {}) {
        let tools = Array.from(this.tools.values());

        if (filter.category) {
            tools = tools.filter(t => t.category === filter.category);
        }

        if (filter.kidSafe !== undefined) {
            tools = tools.filter(t => t.kidSafe === filter.kidSafe);
        }

        return tools;
    }

    /**
     * Get tool definitions for LLM prompt
     */
    getToolDefinitions(filter = {}) {
        const tools = this.getAllTools(filter);

        return tools.map(tool => ({
            name: tool.id,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * Execute a tool by ID
     */
    async execute(toolId, params = {}, context = {}) {
        const tool = this.getTool(toolId);

        if (!tool) {
            return {
                success: false,
                error: `Unknown tool: ${toolId}`,
                toolId
            };
        }

        // Check cooldown
        const now = Date.now();
        if (tool.cooldown && (now - tool.lastExecuted) < tool.cooldown) {
            const remaining = tool.cooldown - (now - tool.lastExecuted);
            return {
                success: false,
                error: `Tool on cooldown (${Math.ceil(remaining / 1000)}s remaining)`,
                toolId,
                cooldownRemaining: remaining
            };
        }

        // Validate parameters
        const validationResult = this.validateParams(tool, params);
        if (!validationResult.valid) {
            return {
                success: false,
                error: validationResult.error,
                toolId
            };
        }

        try {
            // Execute the tool
            tool.lastExecuted = now;
            const result = await tool.execute(validationResult.params, context);

            // Log execution
            this.logExecution(toolId, validationResult.params, result);

            return {
                success: true,
                toolId,
                result,
                executedAt: now
            };

        } catch (error) {
            devWarn('[AgentToolRegistry] Tool execution failed:', toolId, error);
            return {
                success: false,
                error: error.message || 'Execution failed',
                toolId
            };
        }
    }

    /**
     * Validate tool parameters
     */
    validateParams(tool, params) {
        const validatedParams = {};

        for (const [key, schema] of Object.entries(tool.parameters || {})) {
            let value = params[key];

            // Check required
            if (schema.required && value === undefined) {
                return { valid: false, error: `Missing required parameter: ${key}` };
            }

            // Apply default
            if (value === undefined && schema.default !== undefined) {
                value = schema.default;
            }

            // Type validation
            if (value !== undefined) {
                if (schema.type === 'number') {
                    value = Number(value);
                    if (isNaN(value)) {
                        return { valid: false, error: `Parameter ${key} must be a number` };
                    }
                    if (schema.min !== undefined && value < schema.min) value = schema.min;
                    if (schema.max !== undefined && value > schema.max) value = schema.max;
                }

                if (schema.type === 'string') {
                    value = String(value);
                    if (schema.maxLength && value.length > schema.maxLength) {
                        value = value.slice(0, schema.maxLength);
                    }
                    if (schema.enum && !schema.enum.includes(value)) {
                        return { valid: false, error: `Parameter ${key} must be one of: ${schema.enum.join(', ')}` };
                    }
                }
            }

            validatedParams[key] = value;
        }

        return { valid: true, params: validatedParams };
    }

    /**
     * Log tool execution for history
     */
    logExecution(toolId, params, result) {
        this.executionHistory.push({
            toolId,
            params,
            result,
            timestamp: Date.now()
        });

        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory.shift();
        }

        // Emit event for tracking
        if (window.GameState) {
            window.GameState.emit('agent/tool_executed', { toolId, params, result });
        }
    }

    // ===== Tool Implementations =====

    async executeCollectCoins(params, context) {
        const scene = context.scene;
        if (!scene || !scene.coins) {
            return { collected: 0, message: 'No coins visible in current area' };
        }

        const player = scene.player;
        if (!player) {
            return { collected: 0, message: 'Cannot locate creature position' };
        }

        const range = params.range || 150;
        let collected = 0;

        // Find coins within range
        scene.coins.getChildren().forEach(coin => {
            if (coin.active) {
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    coin.x, coin.y
                );

                if (distance <= range) {
                    // Collect the coin
                    if (window.GameState) {
                        window.GameState.addCoins(1);
                    }
                    coin.destroy();
                    collected++;
                }
            }
        });

        if (window.AudioManager && collected > 0) {
            window.AudioManager.playCoinCollect?.();
        }

        return {
            collected,
            message: collected > 0
                ? `Found and collected ${collected} coin${collected > 1 ? 's' : ''}!`
                : 'No coins within range right now'
        };
    }

    async executeExploreArea(params, context) {
        const scene = context.scene;
        if (!scene || !scene.player) {
            return { success: false, message: 'Cannot explore without active scene' };
        }

        const direction = params.direction || 'random';
        const distance = params.distance || 200;

        // Calculate target position
        let angle;
        switch (direction) {
            case 'north': angle = -Math.PI / 2; break;
            case 'south': angle = Math.PI / 2; break;
            case 'east': angle = 0; break;
            case 'west': angle = Math.PI; break;
            default: angle = Math.random() * Math.PI * 2;
        }

        const targetX = scene.player.x + Math.cos(angle) * distance;
        const targetY = scene.player.y + Math.sin(angle) * distance;

        // Store exploration intent for the scene to handle
        if (window.GameState) {
            window.GameState.set('agent.pendingExploration', {
                targetX,
                targetY,
                direction,
                startedAt: Date.now()
            });
        }

        return {
            success: true,
            message: `Moving ${direction} to explore new area`,
            target: { x: Math.round(targetX), y: Math.round(targetY) }
        };
    }

    async executeCheckStats(params, context) {
        if (!window.GameState) {
            return { success: false, message: 'Cannot access creature stats' };
        }

        const stats = window.GameState.get('creature.stats') || {};
        const level = window.GameState.get('creature.level') || 1;
        const experience = window.GameState.get('creature.experience') || 0;
        const coins = window.GameState.get('player.coins') || 0;

        const report = {
            health: stats.health ?? 100,
            energy: stats.energy ?? 100,
            happiness: stats.happiness ?? 100,
            level,
            experience,
            coins
        };

        // Determine overall status
        const avgStat = (report.health + report.energy + report.happiness) / 3;
        let status;
        if (avgStat >= 80) status = 'excellent';
        else if (avgStat >= 60) status = 'good';
        else if (avgStat >= 40) status = 'fair';
        else status = 'needs attention';

        return {
            success: true,
            stats: report,
            status,
            message: `Health: ${report.health}%, Energy: ${report.energy}%, Happiness: ${report.happiness}%. Overall status: ${status}`
        };
    }

    async executeSuggestCare(params, context) {
        if (!window.GameState) {
            return { success: false, suggestions: [], message: 'Cannot access creature stats' };
        }

        const stats = window.GameState.get('creature.stats') || {};
        const suggestions = [];

        // Check each stat and suggest care
        if ((stats.energy ?? 100) < 40) {
            suggestions.push({
                action: 'rest',
                priority: stats.energy < 20 ? 'high' : 'medium',
                reason: `Energy is low (${stats.energy}%)`
            });
        }

        if ((stats.happiness ?? 100) < 50) {
            suggestions.push({
                action: 'play',
                priority: stats.happiness < 25 ? 'high' : 'medium',
                reason: `Happiness needs a boost (${stats.happiness}%)`
            });
        }

        if ((stats.health ?? 100) < 60) {
            suggestions.push({
                action: 'feed',
                priority: stats.health < 30 ? 'high' : 'medium',
                reason: `Health could use some attention (${stats.health}%)`
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        const message = suggestions.length > 0
            ? `I recommend: ${suggestions.map(s => s.action).join(', ')}`
            : 'All stats look good! No immediate care needed.';

        return {
            success: true,
            suggestions,
            message
        };
    }

    async executeSendMessage(params, context) {
        const message = params.message;
        if (!message) {
            return { success: false, message: 'No message to send' };
        }

        // Emit message event for ChatManager or scene to handle
        if (window.GameState) {
            window.GameState.emit('agent/message', {
                content: message,
                timestamp: Date.now(),
                source: 'creature'
            });
        }

        return {
            success: true,
            message: 'Message sent to player'
        };
    }

    async executeRemember(params, context) {
        if (!window.LongTermMemory) {
            return { success: false, message: 'Long-term memory not available' };
        }

        const { key, value } = params;
        window.LongTermMemory.store(key, value, context.creatureId);

        return {
            success: true,
            message: `Remembered: ${key}`
        };
    }

    async executeRecall(params, context) {
        if (!window.LongTermMemory) {
            return { success: false, value: null, message: 'Long-term memory not available' };
        }

        const value = window.LongTermMemory.retrieve(params.key, context.creatureId);

        return {
            success: !!value,
            value,
            message: value ? `Recalled: ${params.key}` : `I don't remember anything about "${params.key}"`
        };
    }
}

// Singleton wiring
window.AgentToolRegistry = window.AgentToolRegistry || new AgentToolRegistryService();
window.AgentToolRegistry.initialize();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentToolRegistryService;
}

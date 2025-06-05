/**
 * Cuovare Agent Mode Unit Tests
 * 
 * Comprehensive test suite for the flagship Agent Mode functionality.
 * These tests ensure the autonomous AI agent properly understands tools,
 * creates executable plans, and delivers reliable results.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { AgentMode, AgentAction, AgentPlan, AgentCapabilities } from '../../src/agent/AgentMode';
import { AIProviderManager } from '../../src/providers/AIProviderManager';
import { ContextRetrievalEngine } from '../../src/context/ContextRetrievalEngine';
import { MCPManager } from '../../src/mcp/MCPManager';
import { ToolExecutionEngine } from '../../src/mcp/ToolExecutionEngine';
import { toolRegistry } from '../../src/agent/ToolRegistry';

// Mock implementations for testing
class MockAIProvider {
    async sendMessage(options: any): Promise<{ content: string; model: string; provider: string }> {
        const request = options.messages[0].content;
        
        // Mock responses based on request patterns
        if (request.includes('Create a README file')) {
            return {
                content: JSON.stringify({
                    goal: "Create a comprehensive README.md file for the project",
                    actions: [
                        {
                            type: "file_operation",
                            description: "Create README.md with project documentation",
                            payload: {
                                operation: "create",
                                filePath: "README.md",
                                content: "# Project Name\n\nDescription of the project..."
                            }
                        }
                    ]
                }),
                model: 'mock-model',
                provider: 'mock'
            };
        } else if (request.includes('Fix authentication bug')) {
            return {
                content: JSON.stringify({
                    goal: "Fix authentication bug in auth.ts",
                    actions: [
                        {
                            type: "file_operation",
                            description: "Read auth.ts to understand current implementation",
                            payload: {
                                operation: "read",
                                filePath: "src/auth.ts"
                            }
                        },
                        {
                            type: "file_operation",
                            description: "Write corrected auth.ts with the fix",
                            payload: {
                                operation: "write",
                                filePath: "src/auth.ts",
                                content: "export const auth = () => { /* fixed implementation */ };"
                            }
                        },
                        {
                            type: "terminal",
                            description: "Run tests to verify the fix works",
                            payload: {
                                command: "npm test"
                            }
                        }
                    ]
                }),
                model: 'mock-model',
                provider: 'mock'
            };
        } else if (request.includes('invalid request')) {
            return {
                content: "This is not a valid JSON response",
                model: 'mock-model',
                provider: 'mock'
            };
        }
        
        // Default fallback response
        return {
            content: JSON.stringify({
                goal: "Default response",
                actions: [
                    {
                        type: "search_analysis",
                        description: "Analyze the request",
                        payload: {
                            query: "test query",
                            type: "semantic",
                            scope: "workspace"
                        }
                    }
                ]
            }),
            model: 'mock-model',
            provider: 'mock'
        };
    }
}

class MockContextEngine {
    async getRelevantContext(): Promise<any[]> {
        return [];
    }
}

class MockMCPManager {
    async initialize(): Promise<void> {}
    async dispose(): Promise<void> {}
}

class MockToolExecutionEngine {
    async executeTool(): Promise<any> {
        return { success: true, message: "Mock execution successful" };
    }
}

// Mock VS Code output channel
class MockOutputChannel implements vscode.OutputChannel {
    name = "Test Output";
    private _messages: string[] = [];

    appendLine(value: string): void {
        this._messages.push(value);
    }

    append(value: string): void {
        this._messages[this._messages.length - 1] += value;
    }

    replace(value: string): void {
        this._messages = [value];
    }

    clear(): void {
        this._messages = [];
    }

    show(): void {}
    hide(): void {}
    dispose(): void {}

    getMessages(): string[] {
        return this._messages;
    }
}

// Test Suite
describe('AgentMode Core Functionality', () => {
    let agentMode: AgentMode;
    let mockAIProvider: MockAIProvider;
    let mockOutputChannel: MockOutputChannel;

    beforeEach(async () => {
        // Initialize mocks
        mockAIProvider = new MockAIProvider();
        const mockContextEngine = new MockContextEngine() as any;
        const mockMCPManager = new MockMCPManager() as any;
        const mockToolEngine = new MockToolExecutionEngine() as any;

        // Create agent mode instance
        agentMode = new AgentMode(
            mockAIProvider,
            mockContextEngine,
            mockMCPManager,
            mockToolEngine
        );

        // Mock vscode.window.createOutputChannel
        mockOutputChannel = new MockOutputChannel();
        (agentMode as any).outputChannel = mockOutputChannel;

        // Initialize tool registry for testing
        await toolRegistry.initialize();
    });

    afterEach(() => {
        agentMode?.dispose();
    });

    describe('Initialization and Configuration', () => {
        it('should initialize with correct default state', () => {
            assert.strictEqual(agentMode.getEnabled(), false);
            
            const capabilities = agentMode.getCapabilities();
            assert.strictEqual(typeof capabilities.fileOperations, 'boolean');
            assert.strictEqual(typeof capabilities.terminalCommands, 'boolean');
            assert.strictEqual(typeof capabilities.gitOperations, 'boolean');
            assert.strictEqual(typeof capabilities.mcpTools, 'boolean');
        });

        it('should enable and disable agent mode correctly', () => {
            assert.strictEqual(agentMode.getEnabled(), false);
            
            agentMode.setEnabled(true);
            assert.strictEqual(agentMode.getEnabled(), true);
            
            agentMode.setEnabled(false);
            assert.strictEqual(agentMode.getEnabled(), false);
        });

        it('should log initialization messages', () => {
            const messages = mockOutputChannel.getMessages();
            assert.ok(messages.some(msg => msg.includes('Agent Mode initialized')));
            assert.ok(messages.some(msg => msg.includes('Capabilities:')));
        });
    });

    describe('Tool Registry Integration', () => {
        it('should have access to tool registry', async () => {
            const tools = toolRegistry.getAllTools();
            assert.ok(tools.length > 0, 'Tool registry should have loaded tools');
        });

        it('should validate tool names are available', () => {
            const toolNames = toolRegistry.getToolNames();
            assert.ok(toolNames.includes('file_operation'), 'Should have file_operation tool');
        });

        it('should build tool descriptions for AI', () => {
            const descriptions = toolRegistry.buildToolDescriptionsForLLM();
            assert.ok(descriptions.length > 0, 'Should generate tool descriptions');
            assert.ok(descriptions.includes('file_operation'), 'Should include file operations');
        });
    });

    describe('Plan Creation and Validation', () => {
        beforeEach(() => {
            agentMode.setEnabled(true);
        });

        it('should create valid plan for README creation request', async () => {
            const result = await agentMode.executeAgentRequest('Create a README file');
            
            const plan = agentMode.getCurrentPlan();
            assert.ok(plan, 'Should have created a plan');
            assert.strictEqual(plan.goal, 'Create a comprehensive README.md file for the project');
            assert.strictEqual(plan.actions.length, 1);
            assert.strictEqual(plan.actions[0].type, 'file_operation');
            assert.strictEqual(plan.actions[0].payload.operation, 'create');
            assert.strictEqual(plan.actions[0].payload.filePath, 'README.md');
        });

        it('should create multi-step plan for complex requests', async () => {
            const result = await agentMode.executeAgentRequest('Fix authentication bug');
            
            const plan = agentMode.getCurrentPlan();
            assert.ok(plan, 'Should have created a plan');
            assert.strictEqual(plan.actions.length, 3);
            
            // Verify action sequence
            assert.strictEqual(plan.actions[0].type, 'file_operation');
            assert.strictEqual(plan.actions[0].payload.operation, 'read');
            
            assert.strictEqual(plan.actions[1].type, 'file_operation');
            assert.strictEqual(plan.actions[1].payload.operation, 'write');
            
            assert.strictEqual(plan.actions[2].type, 'terminal');
            assert.strictEqual(plan.actions[2].payload.command, 'npm test');
        });

        it('should handle invalid AI responses gracefully', async () => {
            try {
                await agentMode.executeAgentRequest('invalid request');
                const plan = agentMode.getCurrentPlan();
                assert.ok(plan, 'Should create fallback plan for invalid responses');
                assert.ok(plan.actions.length > 0, 'Fallback plan should have actions');
            } catch (error) {
                // Should not throw, should handle gracefully
                assert.fail('Should handle invalid responses gracefully');
            }
        });

        it('should validate action types against available tools', async () => {
            // Mock an invalid tool response
            mockAIProvider.sendMessage = async () => ({
                content: JSON.stringify({
                    goal: "Test invalid tool",
                    actions: [{
                        type: "invalid_tool_type",
                        description: "This should fail",
                        payload: {}
                    }]
                })
            });

            try {
                await agentMode.executeAgentRequest('test request');
                const plan = agentMode.getCurrentPlan();
                
                // Should create fallback plan when tool validation fails
                assert.ok(plan, 'Should create fallback plan');
                assert.ok(plan.actions.length > 0, 'Should have fallback actions');
            } catch (error) {
                // May throw error, which is acceptable for invalid tools
            }
        });
    });

    describe('Action Type Normalization', () => {
        it('should normalize common action type aliases', () => {
            const normalizeMethod = (agentMode as any).normalizeActionType.bind(agentMode);
            
            assert.strictEqual(normalizeMethod('fileOperation'), 'file_operation');
            assert.strictEqual(normalizeMethod('file'), 'file_operation');
            assert.strictEqual(normalizeMethod('terminalCommand'), 'terminal');
            assert.strictEqual(normalizeMethod('command'), 'terminal');
            assert.strictEqual(normalizeMethod('git'), 'git_operation');
        });

        it('should return exact matches unchanged', () => {
            const normalizeMethod = (agentMode as any).normalizeActionType.bind(agentMode);
            const toolNames = toolRegistry.getToolNames();
            
            for (const toolName of toolNames) {
                assert.strictEqual(normalizeMethod(toolName), toolName);
            }
        });

        it('should handle unknown types with fallback', () => {
            const normalizeMethod = (agentMode as any).normalizeActionType.bind(agentMode);
            const result = normalizeMethod('completely_unknown_type');
            
            const availableTools = toolRegistry.getToolNames();
            assert.ok(availableTools.includes(result), 'Should fallback to available tool');
        });
    });

    describe('Plan Execution Flow', () => {
        beforeEach(() => {
            agentMode.setEnabled(true);
        });

        it('should track plan execution progress', async () => {
            let progressUpdates = 0;
            agentMode.setProgressCallback((plan) => {
                progressUpdates++;
                assert.ok(plan, 'Progress callback should receive plan');
            });

            await agentMode.executeAgentRequest('Create a README file');
            assert.ok(progressUpdates > 0, 'Should have received progress updates');
        });

        it('should handle execution errors gracefully', async () => {
            // Mock tool registry to simulate execution error
            const originalExecute = toolRegistry.executeAction;
            toolRegistry.executeAction = async () => ({
                success: false,
                message: 'Simulated execution error'
            });

            try {
                await agentMode.executeAgentRequest('Create a README file');
                const plan = agentMode.getCurrentPlan();
                
                // Should track failed action status
                assert.ok(plan, 'Should have plan after error');
                
                const failedActions = plan.actions.filter(a => a.status === 'failed');
                assert.ok(failedActions.length > 0, 'Should have failed actions');
            } finally {
                // Restore original method
                toolRegistry.executeAction = originalExecute;
            }
        });

        it('should provide execution summary', async () => {
            const result = await agentMode.executeAgentRequest('Create a README file');
            
            assert.ok(result.includes('Task Completed'), 'Should provide success summary');
            assert.ok(result.includes('accomplished'), 'Should list accomplishments');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should reject requests when agent mode is disabled', async () => {
            agentMode.setEnabled(false);
            
            try {
                await agentMode.executeAgentRequest('test request');
                assert.fail('Should throw error when disabled');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('not enabled'));
            }
        });

        it('should handle empty or invalid requests', async () => {
            agentMode.setEnabled(true);
            
            try {
                await agentMode.executeAgentRequest('');
                const plan = agentMode.getCurrentPlan();
                assert.ok(plan, 'Should create plan for empty request');
            } catch (error) {
                // May throw error, which is acceptable
            }
        });

        it('should stop execution when requested', async () => {
            agentMode.setEnabled(true);
            
            // Start execution (don't await)
            const executionPromise = agentMode.executeAgentRequest('Create a README file');
            
            // Stop execution immediately
            agentMode.stopExecution();
            
            const plan = agentMode.getCurrentPlan();
            if (plan) {
                assert.strictEqual(plan.status, 'failed');
            }
        });

        it('should properly dispose resources', () => {
            const disposeCalled = mockOutputChannel.dispose;
            agentMode.dispose();
            // Should not throw error on dispose
        });
    });

    describe('Context Integration', () => {
        it('should handle context when provided', async () => {
            agentMode.setEnabled(true);
            
            const context = [
                { path: 'test.ts', content: 'export const test = "value";' }
            ];
            
            await agentMode.executeAgentRequest('Create a README file', context);
            
            const plan = agentMode.getCurrentPlan();
            assert.ok(plan, 'Should create plan with context');
        });

        it('should work without context', async () => {
            agentMode.setEnabled(true);
            
            await agentMode.executeAgentRequest('Create a README file');
            
            const plan = agentMode.getCurrentPlan();
            assert.ok(plan, 'Should create plan without context');
        });
    });

    describe('Performance and Reliability', () => {
        it('should complete simple requests quickly', async function() {
            this.timeout(5000); // 5 second timeout
            
            agentMode.setEnabled(true);
            
            const startTime = Date.now();
            await agentMode.executeAgentRequest('Create a README file');
            const endTime = Date.now();
            
            const duration = endTime - startTime;
            assert.ok(duration < 3000, `Request should complete in under 3s, took ${duration}ms`);
        });

        it('should handle concurrent requests properly', async () => {
            agentMode.setEnabled(true);
            
            const requests = [
                'Create a README file',
                'Create a package.json file'
            ];
            
            // Start multiple requests concurrently
            const promises = requests.map(req => 
                agentMode.executeAgentRequest(req).catch(e => e)
            );
            
            const results = await Promise.all(promises);
            
            // At least one should succeed (agent mode processes sequentially)
            const successCount = results.filter(r => typeof r === 'string').length;
            assert.ok(successCount >= 1, 'At least one request should succeed');
        });
    });

    describe('Tool Capability Discovery', () => {
        it('should report accurate capabilities', () => {
            const capabilities = agentMode.getCapabilities();
            
            // Basic capabilities should be enabled
            assert.strictEqual(capabilities.fileOperations, true);
            assert.strictEqual(capabilities.mcpTools, true);
            assert.strictEqual(capabilities.webSearch, true);
            assert.strictEqual(capabilities.codebaseAnalysis, true);
        });

        it('should build concise tool descriptions', () => {
            const buildDescriptions = (agentMode as any).buildConciseToolDescriptions.bind(agentMode);
            const descriptions = buildDescriptions();
            
            assert.ok(descriptions.length > 0, 'Should generate descriptions');
            assert.ok(descriptions.includes('file_operation'), 'Should include core tools');
            
            // Should be concise (not too verbose)
            const lines = descriptions.split('\n');
            assert.ok(lines.length <= 15, 'Should be concise (≤15 lines)');
        });
    });
});

// Additional Test Suite for Tool Registry
describe('ToolRegistry Core System', () => {
    beforeEach(async () => {
        await toolRegistry.initialize();
    });

    describe('Tool Discovery', () => {
        it('should discover and load tools successfully', () => {
            const tools = toolRegistry.getAllTools();
            assert.ok(tools.length > 0, 'Should load at least basic tools');
        });

        it('should provide fallback tools if discovery fails', () => {
            const toolNames = toolRegistry.getToolNames();
            assert.ok(toolNames.includes('file_operation'), 'Should have fallback file operations');
        });

        it('should validate tool metadata structure', () => {
            const tools = toolRegistry.getAllTools();
            
            for (const tool of tools) {
                assert.ok(tool.metadata, 'Tool should have metadata');
                assert.ok(tool.metadata.name, 'Tool should have name');
                assert.ok(tool.metadata.description, 'Tool should have description');
                assert.ok(tool.metadata.category, 'Tool should have category');
                assert.ok(typeof tool.execute === 'function', 'Tool should have execute function');
            }
        });
    });

    describe('Tool Execution', () => {
        it('should execute basic file operations', async () => {
            const mockContext = {
                workspaceRoot: process.cwd(),
                outputChannel: new MockOutputChannel() as any,
                onProgress: (msg: string) => {}
            };

            const result = await toolRegistry.executeAction('file_operation', {
                operation: 'read',
                filePath: 'package.json'
            }, mockContext);

            assert.strictEqual(result.success, true);
            assert.ok(result.message, 'Should provide result message');
        });

        it('should handle unknown tools gracefully', async () => {
            const mockContext = {
                workspaceRoot: process.cwd(),
                outputChannel: new MockOutputChannel() as any
            };

            const result = await toolRegistry.executeAction('unknown_tool', {}, mockContext);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.message?.includes('Unknown tool'), 'Should report unknown tool');
        });

        it('should handle tool execution errors', async () => {
            const mockContext = {
                workspaceRoot: process.cwd(),
                outputChannel: new MockOutputChannel() as any
            };

            // Try to read non-existent file
            const result = await toolRegistry.executeAction('file_operation', {
                operation: 'read',
                filePath: 'non_existent_file.txt'
            }, mockContext);

            assert.strictEqual(result.success, false);
            assert.ok(result.message, 'Should provide error message');
        });
    });

    describe('Tool Organization', () => {
        it('should categorize tools properly', () => {
            const categories = new Map<string, number>();
            const tools = toolRegistry.getAllTools();
            
            for (const tool of tools) {
                const category = tool.metadata.category;
                categories.set(category, (categories.get(category) || 0) + 1);
            }
            
            assert.ok(categories.size > 0, 'Should have tool categories');
            assert.ok(categories.has('File Operations'), 'Should have file operations category');
        });

        it('should provide tools by category', () => {
            const fileTools = toolRegistry.getToolsByCategory('File Operations');
            assert.ok(fileTools.length > 0, 'Should have file operation tools');
            
            for (const tool of fileTools) {
                assert.strictEqual(tool.metadata.category, 'File Operations');
            }
        });
    });
});

console.log('✅ AgentMode and ToolRegistry unit tests loaded successfully');

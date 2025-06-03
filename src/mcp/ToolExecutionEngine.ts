import * as vscode from 'vscode';
import { MCPManager, MCPTool, MCPToolCall, MCPToolResult } from './MCPManager';

export interface ToolExecutionRequest {
    toolName: string;
    arguments: Record<string, any>;
    requestId: string;
    providerName: string;
    conversationId: string;
}

export interface ToolExecutionResult {
    requestId: string;
    toolName: string;
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
    metadata?: {
        serverName?: string;
        retryCount?: number;
        warnings?: string[];
    };
}

export interface ToolExecutionContext {
    workspaceFolder?: vscode.Uri;
    activeDocument?: vscode.TextDocument;
    selection?: vscode.Selection;
    userContext?: Record<string, any>;
}

export class ToolExecutionEngine {
    private mcpManager: MCPManager;
    private outputChannel: vscode.OutputChannel;
    private executionQueue: Map<string, ToolExecutionRequest> = new Map();
    private activeExecutions: Set<string> = new Set();
    private maxConcurrentExecutions = 5;
    private executionTimeout = 30000; // 30 seconds

    constructor(mcpManager: MCPManager) {
        this.mcpManager = mcpManager;
        this.outputChannel = vscode.window.createOutputChannel('Cuovare Tool Execution');
    }

    /**
     * Execute a single tool with comprehensive error handling and validation
     */
    public async executeTool(request: ToolExecutionRequest, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        
        try {
            // Validate tool existence
            const availableTools = this.mcpManager.getAvailableTools();
            const tool = availableTools.find(t => t.name === request.toolName);
            
            if (!tool) {
                return {
                    requestId: request.requestId,
                    toolName: request.toolName,
                    success: false,
                    error: `Tool "${request.toolName}" not found or server not connected`,
                    executionTime: Date.now() - startTime
                };
            }

            // Validate arguments against schema
            const validationResult = this.validateToolArguments(tool, request.arguments);
            if (!validationResult.valid) {
                return {
                    requestId: request.requestId,
                    toolName: request.toolName,
                    success: false,
                    error: `Invalid arguments: ${validationResult.errors.join(', ')}`,
                    executionTime: Date.now() - startTime
                };
            }

            // Check execution limits
            if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
                return {
                    requestId: request.requestId,
                    toolName: request.toolName,
                    success: false,
                    error: 'Maximum concurrent tool executions reached. Please wait.',
                    executionTime: Date.now() - startTime
                };
            }

            // Add to active executions
            this.activeExecutions.add(request.requestId);
            this.outputChannel.appendLine(`[${new Date().toISOString()}] Executing tool: ${request.toolName}`);

            // Execute with timeout
            const toolCall: MCPToolCall = {
                name: request.toolName,
                arguments: request.arguments
            };

            const mcpResult = await Promise.race([
                this.mcpManager.callTool(toolCall),
                this.createTimeoutPromise(request.requestId)
            ]);

            const executionTime = Date.now() - startTime;

            if (!mcpResult || mcpResult.isError) {
                return {
                    requestId: request.requestId,
                    toolName: request.toolName,
                    success: false,
                    error: typeof mcpResult?.content === 'string' ? mcpResult.content : 'Unknown execution error',
                    executionTime
                };
            }

            // Process and format result
            const processedResult = this.processToolResult(mcpResult, tool, context);

            this.outputChannel.appendLine(`[${new Date().toISOString()}] Tool executed successfully: ${request.toolName} (${executionTime}ms)`);

            return {
                requestId: request.requestId,
                toolName: request.toolName,
                success: true,
                result: processedResult,
                executionTime,
                metadata: {
                    serverName: this.mcpManager.getServerForTool(request.toolName)?.name
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.outputChannel.appendLine(`[${new Date().toISOString()}] Tool execution failed: ${request.toolName} - ${error}`);
            
            return {
                requestId: request.requestId,
                toolName: request.toolName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime
            };
        } finally {
            this.activeExecutions.delete(request.requestId);
        }
    }

    /**
     * Execute multiple tools in parallel with coordination
     */
    public async executeMultipleTools(requests: ToolExecutionRequest[], context?: ToolExecutionContext): Promise<ToolExecutionResult[]> {
        const results: ToolExecutionResult[] = [];
        
        // Group by dependencies and execute in batches
        const batches = this.organizeBatches(requests);
        
        for (const batch of batches) {
            const batchPromises = batch.map(request => this.executeTool(request, context));
            const batchResults = await Promise.allSettled(batchPromises);
            
            for (let i = 0; i < batchResults.length; i++) {
                const result = batchResults[i];
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({
                        requestId: batch[i].requestId,
                        toolName: batch[i].toolName,
                        success: false,
                        error: result.reason?.message || 'Batch execution failed',
                        executionTime: 0
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * Validate tool arguments against schema
     */
    private validateToolArguments(tool: MCPTool, args: Record<string, any>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (!tool.inputSchema) {
            return { valid: true, errors: [] };
        }

        const schema = tool.inputSchema;
        
        // Check required properties
        if (schema.required && Array.isArray(schema.required)) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in args)) {
                    errors.push(`Missing required property: ${requiredProp}`);
                }
            }
        }

        // Validate property types (basic validation)
        if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
                if (propName in args) {
                    const value = args[propName];
                    const expectedType = propSchema.type;
                    
                    if (expectedType && !this.validateType(value, expectedType)) {
                        errors.push(`Property ${propName} should be of type ${expectedType}`);
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Basic type validation
     */
    private validateType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return true; // Unknown type, allow
        }
    }

    /**
     * Process and format tool results
     */
    private processToolResult(mcpResult: MCPToolResult, tool: MCPTool, context?: ToolExecutionContext): any {
        try {
            const contentStr = typeof mcpResult.content === 'string' ? mcpResult.content : JSON.stringify(mcpResult.content);
            // Try to parse JSON result
            const parsed = JSON.parse(contentStr);
            
            // Apply any tool-specific formatting
            return this.formatToolResult(tool.name, parsed, context);
        } catch {
            // Return as string if not JSON
            const contentStr = typeof mcpResult.content === 'string' ? mcpResult.content : JSON.stringify(mcpResult.content);
            return {
                type: 'text',
                content: contentStr,
                formatted: this.formatTextResult(contentStr)
            };
        }
    }

    /**
     * Format tool results based on tool type
     */
    private formatToolResult(toolName: string, result: any, context?: ToolExecutionContext): any {
        // Tool-specific formatting logic
        switch (toolName.toLowerCase()) {
            case 'read_file':
            case 'get_file_content':
                return {
                    type: 'file_content',
                    content: result,
                    language: this.detectLanguage(result, context?.activeDocument?.fileName)
                };
                
            case 'execute_command':
            case 'shell_exec':
                return {
                    type: 'command_output',
                    output: result.stdout || result.output,
                    error: result.stderr || result.error,
                    exitCode: result.exitCode || result.code
                };
                
            case 'search':
            case 'find_files':
                return {
                    type: 'search_results',
                    results: Array.isArray(result) ? result : [result],
                    count: Array.isArray(result) ? result.length : 1
                };
                
            default:
                return {
                    type: 'generic',
                    content: result
                };
        }
    }

    /**
     * Format text results with smart formatting
     */
    private formatTextResult(content: string): string {
        // Apply smart formatting based on content
        if (content.includes('\n') && content.split('\n').length > 3) {
            return '```\n' + content + '\n```';
        }
        return content;
    }

    /**
     * Detect language from content or filename
     */
    private detectLanguage(content: string, filename?: string): string {
        if (filename) {
            const ext = filename.split('.').pop()?.toLowerCase();
            const langMap: Record<string, string> = {
                'ts': 'typescript',
                'js': 'javascript',
                'py': 'python',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
                'go': 'go',
                'rs': 'rust',
                'php': 'php',
                'rb': 'ruby',
                'sh': 'bash',
                'json': 'json',
                'xml': 'xml',
                'html': 'html',
                'css': 'css',
                'sql': 'sql'
            };
            if (ext && langMap[ext]) {
                return langMap[ext];
            }
        }
        
        // Simple content-based detection
        if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
            return 'javascript';
        }
        if (content.includes('def ') || content.includes('import ')) {
            return 'python';
        }
        if (content.includes('<?php')) {
            return 'php';
        }
        
        return 'text';
    }

    /**
     * Organize tool requests into execution batches
     */
    private organizeBatches(requests: ToolExecutionRequest[]): ToolExecutionRequest[][] {
        // For now, simple batching - could be enhanced with dependency analysis
        const batchSize = Math.min(this.maxConcurrentExecutions, requests.length);
        const batches: ToolExecutionRequest[][] = [];
        
        for (let i = 0; i < requests.length; i += batchSize) {
            batches.push(requests.slice(i, i + batchSize));
        }
        
        return batches;
    }

    /**
     * Create timeout promise for tool execution
     */
    private createTimeoutPromise(requestId: string): Promise<MCPToolResult> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool execution timeout for request ${requestId}`));
            }, this.executionTimeout);
        });
    }

    /**
     * Get execution statistics
     */
    public getExecutionStats(): {
        activeExecutions: number;
        queuedExecutions: number;
        maxConcurrent: number;
        averageExecutionTime: number;
    } {
        return {
            activeExecutions: this.activeExecutions.size,
            queuedExecutions: this.executionQueue.size,
            maxConcurrent: this.maxConcurrentExecutions,
            averageExecutionTime: 0 // Could track this with execution history
        };
    }

    /**
     * Cancel tool execution
     */
    public cancelExecution(requestId: string): boolean {
        if (this.activeExecutions.has(requestId)) {
            this.activeExecutions.delete(requestId);
            this.outputChannel.appendLine(`[${new Date().toISOString()}] Cancelled tool execution: ${requestId}`);
            return true;
        }
        return false;
    }

    /**
     * Update execution limits
     */
    public updateLimits(maxConcurrent: number, timeout: number): void {
        this.maxConcurrentExecutions = Math.max(1, Math.min(10, maxConcurrent));
        this.executionTimeout = Math.max(5000, Math.min(120000, timeout));
        this.outputChannel.appendLine(`Updated execution limits: concurrent=${this.maxConcurrentExecutions}, timeout=${this.executionTimeout}ms`);
    }

    public dispose(): void {
        this.outputChannel.dispose();
        this.executionQueue.clear();
        this.activeExecutions.clear();
    }
}

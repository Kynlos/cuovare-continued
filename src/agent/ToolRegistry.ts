import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ToolResult {
    success: boolean;
    message?: string;  // Made optional for backward compatibility
    data?: any;
    result?: any;  // Legacy property for backward compatibility
    error?: string; // Legacy property for error messages
}

export interface ToolMetadata {
    name: string;
    description: string;
    category: string;
    parameters?: {
        name: string;
        description: string;
        required: boolean;
        type: string;
    }[];
    examples?: string[];
}

export interface ToolExecutor {
    metadata: ToolMetadata;
    execute(action: any, context: {
        workspaceRoot: string;
        outputChannel: vscode.OutputChannel;
        onProgress?: (message: string) => void;
    }): Promise<ToolResult>;
}

export class ToolRegistry {
    private tools: Map<string, ToolExecutor> = new Map();
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        await this.discoverTools();
        this.initialized = true;
    }

    private async discoverTools(): Promise<void> {
        const executorsPath = path.join(__dirname, 'executors');
        
        try {
            const files = fs.readdirSync(executorsPath);
            
            // Look for both .ts and .js files for better development experience
            const executorFiles = files.filter(file => 
                file.endsWith('.js') || file.endsWith('.ts')
            );

            let loadedCount = 0;
            let errorCount = 0;
            let vscodeMissingCount = 0;

            for (const file of executorFiles) {
                try {
                    const modulePath = path.join(executorsPath, file);
                    
                    // Skip .d.ts files
                    if (file.endsWith('.d.ts')) {
                        continue;
                    }
                    
                    let module: any;
                    try {
                        // For .ts files in development, try direct import
                        if (file.endsWith('.ts')) {
                            // Convert to file:// URL for cross-platform compatibility
                            const moduleUrl = `file:///${modulePath.replace(/\\/g, '/')}`;
                            module = await import(moduleUrl);
                        } else {
                            // For .js files, use require with cache clearing
                            delete require.cache[require.resolve(modulePath)];
                            module = require(modulePath);
                        }
                    } catch (importError) {
                        // Check if this is a vscode dependency issue
                        if ((importError as Error).message.includes('Cannot find module \'vscode\'')) {
                            vscodeMissingCount++;
                            // Skip vscode-dependent tools when not in VS Code environment
                            continue;
                        }
                        
                        // Fallback: try require for all file types
                        try {
                            delete require.cache[require.resolve(modulePath)];
                            module = require(modulePath);
                        } catch (requireError) {
                            if ((requireError as Error).message.includes('Cannot find module \'vscode\'')) {
                                vscodeMissingCount++;
                                continue;
                            }
                            throw new Error(`Failed to load ${file}: ${(importError as Error).message} and ${(requireError as Error).message}`);
                        }
                    }
                    
                    // Look for default export with metadata
                    if (module.default && this.isValidToolExecutor(module.default)) {
                        const executor = module.default as ToolExecutor;
                        this.tools.set(executor.metadata.name, executor);
                        loadedCount++;
                    }
                    
                    // Look for named exports with metadata
                    for (const [key, value] of Object.entries(module)) {
                        if (key !== 'default' && this.isValidToolExecutor(value)) {
                            const executor = value as ToolExecutor;
                            this.tools.set(executor.metadata.name, executor);
                            loadedCount++;
                        }
                    }
                } catch (error) {
                    errorCount++;
                    console.warn(`[ToolRegistry] Failed to load tool from ${file}:`, error);
                }
            }
            
            let statusMessage = `[ToolRegistry] Loaded ${loadedCount} tools successfully`;
            if (errorCount > 0) {
                statusMessage += ` (${errorCount} failed)`;
            }
            if (vscodeMissingCount > 0) {
                statusMessage += ` (${vscodeMissingCount} skipped - vscode not available)`;
            }
            console.log(statusMessage);
            
            // Ensure we have at least basic tools
            if (this.tools.size === 0) {
                this.loadFallbackTools();
            }
        } catch (error) {
            console.error('[ToolRegistry] Failed to discover tools:', error);
            this.loadFallbackTools();
        }
    }

    private isValidToolExecutor(obj: any): boolean {
        return obj && 
               typeof obj === 'object' && 
               obj.metadata && 
               typeof obj.metadata.name === 'string' &&
               typeof obj.metadata.description === 'string' &&
               typeof obj.metadata.category === 'string' &&
               typeof obj.execute === 'function';
    }

    private loadFallbackTools(): void {
        // Basic fallback tools to ensure agent mode can function
        const basicFileOp = {
            metadata: {
                name: 'file_operation',
                description: 'Basic file operations: read, write, create files',
                category: 'File Operations',
                parameters: [
                    { name: 'operation', description: 'read, write, create', required: true, type: 'string' },
                    { name: 'filePath', description: 'Path to file', required: true, type: 'string' },
                    { name: 'content', description: 'Content for write/create', required: false, type: 'string' }
                ]
            },
            execute: async (payload: any, context: any) => {
                try {
                    const filePath = path.resolve(context.workspaceRoot, payload.filePath);
                    
                    if (payload.operation === 'read') {
                        const content = fs.readFileSync(filePath, 'utf8');
                        return { success: true, message: `Read ${payload.filePath}`, data: content };
                    } else if (payload.operation === 'write' || payload.operation === 'create') {
                        fs.writeFileSync(filePath, payload.content || '');
                        return { success: true, message: `${payload.operation === 'create' ? 'Created' : 'Wrote'} ${payload.filePath}` };
                    }
                    
                    return { success: false, message: 'Unknown operation' };
                } catch (error) {
                    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
                }
            }
        };
        
        this.tools.set('file_operation', basicFileOp as ToolExecutor);
        console.log('[ToolRegistry] Loaded fallback tools');
    }

    getAllTools(): ToolExecutor[] {
        return Array.from(this.tools.values());
    }

    getTool(name: string): ToolExecutor | undefined {
        return this.tools.get(name);
    }

    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    getToolsByCategory(category: string): ToolExecutor[] {
        return Array.from(this.tools.values()).filter(
            tool => tool.metadata.category === category
        );
    }

    buildToolDescriptionsForLLM(): string {
        const categories = new Map<string, ToolExecutor[]>();
        
        // Group tools by category
        for (const tool of this.tools.values()) {
            const category = tool.metadata.category;
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(tool);
        }

        let description = "Available Tools:\n\n";
        
        for (const [category, tools] of categories) {
            description += `## ${category}\n\n`;
            
            for (const tool of tools) {
                description += `### ${tool.metadata.name}\n`;
                description += `${tool.metadata.description}\n\n`;
                
                if (tool.metadata.parameters && tool.metadata.parameters.length > 0) {
                    description += "Parameters:\n";
                    for (const param of tool.metadata.parameters) {
                        const required = param.required ? " (required)" : " (optional)";
                        description += `- ${param.name} (${param.type})${required}: ${param.description}\n`;
                    }
                    description += "\n";
                }
                
                if (tool.metadata.examples && tool.metadata.examples.length > 0) {
                    description += "Examples:\n";
                    for (const example of tool.metadata.examples) {
                        description += `- ${example}\n`;
                    }
                    description += "\n";
                }
            }
        }
        
        return description;
    }

    async executeAction(actionType: string, action: any, context: {
        workspaceRoot: string;
        outputChannel: vscode.OutputChannel;
        onProgress?: (message: string) => void;
    }): Promise<ToolResult> {
        const tool = this.getTool(actionType);
        
        if (!tool) {
            return {
                success: false,
                message: `Unknown tool: ${actionType}. Available tools: ${this.getToolNames().join(', ')}`
            };
        }

        try {
            return await tool.execute(action, context);
        } catch (error) {
            return {
                success: false,
                message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}

// Global registry instance
export const toolRegistry = new ToolRegistry();

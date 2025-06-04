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
            
            // Only look for .js files since we're running compiled code
            const executorFiles = files.filter(file => file.endsWith('.js'));

            for (const file of executorFiles) {
                try {
                    const modulePath = path.join(executorsPath, file);
                    
                    // Try require first for CommonJS compatibility, fallback to import
                    let module: any;
                    try {
                        // Use require for better compatibility in Node.js
                        delete require.cache[require.resolve(modulePath)];
                        module = require(modulePath);
                    } catch (requireError) {
                        // Convert to file:// URL for Windows compatibility
                        const moduleUrl = `file:///${modulePath.replace(/\\/g, '/')}`;
                        module = await import(moduleUrl);
                    }
                    
                    // Look for default export with metadata
                    if (module.default && module.default.metadata && module.default.execute) {
                        const executor = module.default as ToolExecutor;
                        this.tools.set(executor.metadata.name, executor);
                    }
                    
                    // Look for named exports with metadata
                    for (const [key, value] of Object.entries(module)) {
                        if (key !== 'default' && value && typeof value === 'object' && 
                            (value as any).metadata && (value as any).execute) {
                            const executor = value as ToolExecutor;
                            this.tools.set(executor.metadata.name, executor);
                        }
                    }
                } catch (error) {
                    // Silently skip tools that fail to load (e.g., missing dependencies)
                }
            }
        } catch (error) {
            console.warn('[ToolRegistry] Failed to discover tools:', error);
        }
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

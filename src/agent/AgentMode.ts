import * as vscode from 'vscode';
import { AIProviderManager } from '../providers/AIProviderManager';
import { ContextRetrievalEngine } from '../context/ContextRetrievalEngine';
import { MCPManager } from '../mcp/MCPManager';
import { ToolExecutionEngine } from '../mcp/ToolExecutionEngine';
import { toolRegistry } from './ToolRegistry';

export interface AgentAction {
    type: string; // Dynamic action type based on available tools
    description: string;
    payload: any;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    result?: string;
    error?: string;
    timestamp: number;
}

export interface AgentPlan {
    goal: string;
    actions: AgentAction[];
    currentActionIndex: number;
    status: 'planning' | 'executing' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
}

export interface AgentCapabilities {
    fileOperations: boolean;
    terminalCommands: boolean;
    gitOperations: boolean;
    mcpTools: boolean;
    webSearch: boolean;
    codebaseAnalysis: boolean;
}

export class AgentMode {
    private isEnabled: boolean = false;
    private currentPlan: AgentPlan | null = null;
    private capabilities: AgentCapabilities;
    private outputChannel: vscode.OutputChannel;
    private progressCallback?: (plan: AgentPlan) => void;

    constructor(
        private aiProvider: AIProviderManager,
        private contextEngine: ContextRetrievalEngine,
        private mcpManager: MCPManager,
        private toolEngine: ToolExecutionEngine
    ) {
        this.outputChannel = vscode.window.createOutputChannel('Cuovare Agent Mode');
        
        this.capabilities = {
            fileOperations: true,
            terminalCommands: this.checkTerminalAccess(),
            gitOperations: this.checkGitAccess(),
            mcpTools: true,
            webSearch: true,
            codebaseAnalysis: true
        };
        
        this.outputChannel.appendLine('🤖 Agent Mode initialized');
        this.outputChannel.appendLine(`Capabilities: ${JSON.stringify(this.capabilities, null, 2)}`);
    }

    /**
     * Enable or disable agent mode
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        this.outputChannel.appendLine(`🎯 Agent Mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
        
        if (!enabled && this.currentPlan) {
            this.stopCurrentPlan();
        }
    }

    /**
     * Check if agent mode is enabled
     */
    public getEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get current capabilities
     */
    public getCapabilities(): AgentCapabilities {
        return { ...this.capabilities };
    }

    /**
     * Set progress callback for UI updates
     */
    public setProgressCallback(callback: (plan: AgentPlan) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Execute a user request in agent mode
     */
    public async executeAgentRequest(userRequest: string, context?: any[]): Promise<string> {
        if (!this.isEnabled) {
            throw new Error('Agent mode is not enabled');
        }

        this.outputChannel.appendLine(`\n🚀 Starting agent execution for: "${userRequest}"`);

        try {
            // Planning phase
            const plan = await this.createExecutionPlan(userRequest, context);
            this.currentPlan = plan;
            this.notifyProgress();

            // Execution phase
            const result = await this.executePlan(plan);
            
            plan.status = 'completed';
            plan.endTime = Date.now();
            this.notifyProgress();

            this.outputChannel.appendLine(`✅ Agent execution completed successfully`);
            return result;

        } catch (error) {
            if (this.currentPlan) {
                this.currentPlan.status = 'failed';
                this.currentPlan.endTime = Date.now();
                this.notifyProgress();
            }

            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Agent execution failed: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * Create an execution plan for the request
     */
    private async createExecutionPlan(userRequest: string, context?: any[]): Promise<AgentPlan> {
        this.outputChannel.appendLine('🧠 Creating execution plan...');

        const systemPrompt = await this.buildPlanningPrompt();
        const contextText = context ? this.formatContext(context) : '';
        
        const availableActionTypes = toolRegistry.getToolNames().join('|');
        
        const planningPrompt = `${systemPrompt}

User Request: "${userRequest}"

${contextText ? `Available Context:\n${contextText}\n` : ''}

ANALYZE THE REQUEST:
1. What is the user asking me to DO? (not just explain or analyze)
2. What concrete deliverable do they expect?
3. What files need to be read, created, or modified?
4. What commands need to be executed?

CREATE AN EXECUTION PLAN:
- Each action must use one of these exact tool types: ${availableActionTypes}
- Each action must have a concrete, executable payload
- Focus on DOING the work, not just gathering information
- Include verification steps to ensure completion

Return your response as a JSON object with this structure:
{
    "goal": "Brief description of the concrete deliverable we're creating",
    "actions": [
        {
            "type": "one_of_the_available_tool_types",
            "description": "Concrete action that produces a result",
            "payload": {
                "detailed": "parameters for the tool"
            }
        }
    ]
}

REMEMBER: You are building something, fixing something, or creating something. Not just searching or analyzing.`;

        const response = await this.aiProvider.sendMessage({
            messages: [{ role: 'user', content: planningPrompt }]
        });

        const plan = this.parsePlanFromResponse(response.content, userRequest);
        this.outputChannel.appendLine(`📋 Generated plan with ${plan.actions.length} actions`);
        
        return plan;
    }

    /**
     * Execute the plan step by step
     */
    private async executePlan(plan: AgentPlan): Promise<string> {
        this.outputChannel.appendLine(`\n🎬 Executing plan: ${plan.goal}`);
        
        const results: string[] = [];
        plan.status = 'executing';

        for (let i = 0; i < plan.actions.length; i++) {
            plan.currentActionIndex = i;
            const action = plan.actions[i];
            
            // Create a user-friendly progress message
            const progressMsg = this.createProgressMessage(action, i + 1, plan.actions.length);
            this.outputChannel.appendLine(`\n📍 ${progressMsg}`);
            
            try {
                action.status = 'executing';
                action.timestamp = Date.now();
                this.notifyProgress();

                const result = await this.executeAction(action);
                action.result = result;
                action.status = 'completed';
                
                results.push(`Step ${i + 1}: ${action.description}\nResult: ${result}`);
                this.outputChannel.appendLine(`✅ Completed: ${action.description}`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                action.error = errorMsg;
                action.status = 'failed';
                
                this.outputChannel.appendLine(`❌ Failed: ${action.description} - ${errorMsg}`);
                
                // Continue with remaining actions or stop based on error severity
                if (this.isCriticalError(error)) {
                    throw new Error(`Critical error in step ${i + 1}: ${errorMsg}`);
                }
            }

            this.notifyProgress();
        }

        return this.generateExecutionSummary(plan, results);
    }

    /**
     * Execute a single action
     */
    private async executeAction(action: AgentAction): Promise<string> {
        // Initialize tool registry if not already done
        await toolRegistry.initialize();
        
        const context = {
            workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            outputChannel: this.outputChannel,
            onProgress: (message: string) => {
                this.outputChannel.appendLine(`  ⏳ ${message}`);
            }
        };
        
        const result = await toolRegistry.executeAction(action.type, action.payload, context);
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        return result.message;
    }

    // Helper methods
    private async buildPlanningPrompt(): Promise<string> {
        // Initialize tool registry if not already done
        await toolRegistry.initialize();
        
        const dynamicTools = toolRegistry.buildToolDescriptionsForLLM();
        
        return `You are Cuovare's Full Agent Mode - an autonomous AI assistant that can perform actual work by executing tools.

CRITICAL: You are NOT a search engine or information provider. You are an AGENT that DOES THINGS.

When a user asks you to do something, you must:
1. Understand the SPECIFIC task they want accomplished
2. Break it down into concrete, executable steps using available tools
3. Actually execute those steps to complete the task

${dynamicTools}

AGENT BEHAVIOR PRINCIPLES:
- If user says "document X", you should READ the file and CREATE documentation
- If user says "create Y", you should CREATE the actual file/code/feature
- If user says "fix Z", you should IDENTIFY the issue and IMPLEMENT the fix
- If user says "add feature W", you should WRITE the actual code

PLANNING RULES:
1. Always start by understanding what the user ACTUALLY wants done
2. Use file_operation to READ files when you need to understand existing code
3. Use search_analysis only when you need to find specific information across the codebase
4. Use terminal to run tests, builds, or other commands
5. Use git_operation for version control tasks
6. ALWAYS include verification steps to ensure your work is complete
7. Create CONCRETE actions, not vague "analyze" steps

Example good plan for "document the authentication system":
1. Read authentication-related files to understand the system
2. Create comprehensive documentation file
3. Verify documentation is accurate and complete

Example BAD plan for "document the authentication system":
1. Search for authentication-related information (too vague, doesn't accomplish the task)

Available Capabilities:
${Object.entries(this.capabilities).map(([key, enabled]) => `- ${key}: ${enabled ? 'ENABLED' : 'DISABLED'}`).join('\n')}

Remember: You are an AGENT that EXECUTES tasks, not a chatbot that provides information.`;
    }

    private formatContext(context: any[]): string {
        return context.map(item => `File: ${item.path}\n${item.content}`).join('\n\n');
    }

    private parsePlanFromResponse(response: string, userRequest: string): AgentPlan {
        try {
            // Extract JSON from response (handle cases where AI adds explanation)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : response;
            const parsed = JSON.parse(jsonStr);
            
            return {
                goal: parsed.goal || userRequest,
                actions: parsed.actions.map((action: any, index: number) => ({
                    ...action,
                    type: this.normalizeActionType(action.type),
                    status: 'pending' as const,
                    timestamp: Date.now() + index
                })),
                currentActionIndex: 0,
                status: 'planning',
                startTime: Date.now()
            };
        } catch (error) {
            // Fallback: create a simple plan
            return {
                goal: userRequest,
                actions: [{
                    type: 'search_analysis',
                    description: 'Analyze the request and determine next steps',
                    payload: { 
                        query: userRequest,
                        type: 'semantic',
                        scope: 'workspace',
                        maxResults: 10
                    },
                    status: 'pending',
                    timestamp: Date.now()
                }],
                currentActionIndex: 0,
                status: 'planning',
                startTime: Date.now()
            };
        }
    }

    /**
    * Normalize action types from AI response to match our executor types
    */
    private normalizeActionType(type: string): string {
    // Get available tool names from registry
    const availableTools = toolRegistry.getToolNames();
    
    // If it's already a valid tool name, return as-is
    if (availableTools.includes(type)) {
    return type;
    }
    
    // Legacy mapping for common aliases
    const typeMap: Record<string, string> = {
    'fileOperation': 'file_operation',
    'file': 'file_operation',
    'fileOp': 'file_operation',
    
    'terminalCommand': 'terminal',
    'terminal_command': 'terminal',
    'command': 'terminal',
    'cmd': 'terminal',
    
    'searchAnalysis': 'search_analysis',
    'search': 'search_analysis',
    'codebaseAnalysis': 'search_analysis',
    'analysis': 'search_analysis',
    'webSearch': 'search_analysis',
    
    'gitOperation': 'git_operation',
    'git': 'git_operation',
        
            'mcpTool': 'mcp_tool',
        'mcp': 'mcp_tool',
        'tool': 'mcp_tool'
    };

    const normalized = typeMap[type];
    if (normalized && availableTools.includes(normalized)) {
        return normalized;
        }
        
        // Default to first available tool if no match
        this.outputChannel.appendLine(`⚠️ Unknown action type '${type}', defaulting to ${availableTools[0]}`);
        return availableTools[0] || 'file_operation';
    }

    private generateExecutionSummary(plan: AgentPlan, results: string[]): string {
        const duration = plan.endTime ? plan.endTime - plan.startTime : 0;
        const completedActions = plan.actions.filter(a => a.status === 'completed').length;
        const failedActions = plan.actions.filter(a => a.status === 'failed').length;

        // Extract key file operations and achievements
        const fileOperations = this.extractFileOperations(plan.actions);
        const achievements = this.extractAchievements(plan.actions, results);

        let summary = `🎉 **Task Completed Successfully!**\n\n`;
        
        if (achievements.length > 0) {
            summary += `**What I accomplished:**\n${achievements.map(a => `• ${a}`).join('\n')}\n\n`;
        }

        if (fileOperations.length > 0) {
            summary += `**Files created/modified:**\n${fileOperations.map(f => `• ${f}`).join('\n')}\n\n`;
        }

        summary += `*Completed in ${Math.round(duration / 1000)}s with ${completedActions} action${completedActions !== 1 ? 's' : ''}*`;

        if (failedActions > 0) {
            summary += `\n\n⚠️ *${failedActions} action${failedActions !== 1 ? 's' : ''} encountered issues - check the output log for details*`;
        }

        return summary;
    }

    private extractFileOperations(actions: AgentAction[]): string[] {
        const fileOps: string[] = [];
        
        for (const action of actions) {
            if (action.status === 'completed' && action.type === 'file_operation' && action.result) {
                const result = action.result;
                if (result.includes('Created') || result.includes('Wrote')) {
                    // Extract filename from result
                    const match = result.match(/(?:Created|Wrote) ([^\s]+)/);
                    if (match) {
                        const operation = result.includes('Created') ? 'Created' : 'Updated';
                        fileOps.push(`${operation} \`${match[1]}\``);
                    }
                } else if (result.includes('Copied')) {
                    const match = result.match(/Copied ([^\s]+) to ([^\s]+)/);
                    if (match) {
                        fileOps.push(`Copied \`${match[1]}\` to \`${match[2]}\``);
                    }
                } else if (result.includes('Moved')) {
                    const match = result.match(/Moved ([^\s]+) to ([^\s]+)/);
                    if (match) {
                        fileOps.push(`Moved \`${match[1]}\` to \`${match[2]}\``);
                    }
                }
            }
        }
        
        return fileOps;
    }

    private extractAchievements(actions: AgentAction[], results: string[]): string[] {
        const achievements: string[] = [];
        
        for (const action of actions) {
            if (action.status === 'completed') {
                // Convert technical action descriptions to user-friendly achievements
                let achievement = action.description;
                
                // Simplify common patterns
                if (achievement.toLowerCase().includes('read') && achievement.toLowerCase().includes('file')) {
                    achievement = `Analyzed ${this.extractFilename(action.payload?.filePath) || 'files'}`;
                } else if (achievement.toLowerCase().includes('create') && achievement.toLowerCase().includes('documentation')) {
                    achievement = `Created comprehensive documentation`;
                } else if (achievement.toLowerCase().includes('terminal') || achievement.toLowerCase().includes('command')) {
                    achievement = `Executed necessary commands`;
                } else if (achievement.toLowerCase().includes('search')) {
                    achievement = `Searched and analyzed codebase`;
                } else if (achievement.toLowerCase().includes('git')) {
                    achievement = `Performed version control operations`;
                }
                
                achievements.push(achievement);
            }
        }
        
        return achievements;
    }

    private extractFilename(filePath?: string): string | null {
        if (!filePath) return null;
        return filePath.split(/[/\\]/).pop() || null;
    }

    private createProgressMessage(action: AgentAction, step: number, total: number): string {
        const stepInfo = `Step ${step}/${total}`;
        
        // Create user-friendly descriptions based on action type and description
        if (action.type === 'file_operation') {
            const filePath = action.payload?.filePath;
            const operation = action.payload?.operation;
            const filename = this.extractFilename(filePath) || filePath || 'file';
            
            switch (operation) {
                case 'read':
                    return `${stepInfo}: Reading \`${filename}\``;
                case 'create':
                    return `${stepInfo}: Creating \`${filename}\``;
                case 'write':
                    return `${stepInfo}: Writing to \`${filename}\``;
                case 'delete':
                    return `${stepInfo}: Deleting \`${filename}\``;
                case 'copy':
                    const target = this.extractFilename(action.payload?.targetPath) || action.payload?.targetPath;
                    return `${stepInfo}: Copying \`${filename}\` to \`${target}\``;
                case 'move':
                    const moveTarget = this.extractFilename(action.payload?.targetPath) || action.payload?.targetPath;
                    return `${stepInfo}: Moving \`${filename}\` to \`${moveTarget}\``;
                default:
                    return `${stepInfo}: Working on \`${filename}\``;
            }
        } else if (action.type === 'terminal') {
            const command = action.payload?.command;
            return `${stepInfo}: Running command \`${command}\``;
        } else if (action.type === 'search_analysis') {
            const query = action.payload?.query;
            return `${stepInfo}: Searching for "${query}"`;
        } else if (action.type === 'git_operation') {
            const operation = action.payload?.operation;
            return `${stepInfo}: Git ${operation}`;
        } else {
            // Fallback to simplified action description
            let desc = action.description;
            if (desc.length > 60) {
                desc = desc.substring(0, 57) + '...';
            }
            return `${stepInfo}: ${desc}`;
        }
    }

    private isCriticalError(error: any): boolean {
        // Define what constitutes a critical error that should stop execution
        const criticalPatterns = [
            'permission denied',
            'access denied',
            'authentication failed',
            'workspace not found'
        ];
        
        const errorMsg = (error?.message || String(error)).toLowerCase();
        return criticalPatterns.some(pattern => errorMsg.includes(pattern));
    }

    private stopCurrentPlan(): void {
        if (this.currentPlan) {
            this.currentPlan.status = 'failed';
            this.currentPlan.endTime = Date.now();
            this.outputChannel.appendLine('🛑 Agent execution stopped by user');
            this.notifyProgress();
        }
    }

    private notifyProgress(): void {
        if (this.progressCallback && this.currentPlan) {
            this.progressCallback(this.currentPlan);
        }
    }

    private checkTerminalAccess(): boolean {
        // Check if terminal operations are available
        return vscode.window.terminals !== undefined;
    }

    private checkGitAccess(): boolean {
        // Check if git is available
        return vscode.extensions.getExtension('vscode.git') !== undefined;
    }

    /**
     * Get current plan for UI display
     */
    public getCurrentPlan(): AgentPlan | null {
        return this.currentPlan;
    }

    /**
     * Stop current execution
     */
    public stopExecution(): void {
        this.stopCurrentPlan();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}

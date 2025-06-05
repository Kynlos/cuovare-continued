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

## USER REQUEST: "${userRequest}"

${contextText ? `## CONTEXT:\n${contextText}\n` : ''}

## YOUR TASK:
Analyze the request and create a JSON execution plan.

## ANALYSIS QUESTIONS:
1. What specific deliverable does the user want?
2. Which files need to be read/created/modified?
3. What commands need to be executed?
4. How will I verify success?

## RESPONSE FORMAT:
Return ONLY a JSON object in this exact format:

{
    "goal": "Brief, specific description of what I will deliver",
    "actions": [
        {
            "type": "tool_name",
            "description": "What this action accomplishes",
            "payload": {
                "operation": "specific_operation",
                "filePath": "path/to/file",
                "content": "actual content to write"
            }
        }
    ]
}

## AVAILABLE TOOLS: ${availableActionTypes}

## REQUIREMENTS:
- Each action MUST use a tool from the available list
- Each action MUST have complete, executable payload parameters
- Focus on CREATING/BUILDING/FIXING, not just analyzing
- Include verification steps
- Be specific with file paths and content

## EXAMPLE FOR "Create a README file":
{
    "goal": "Create a comprehensive README.md file for the project",
    "actions": [
        {
            "type": "file_operation",
            "description": "Create README.md with project documentation",
            "payload": {
                "operation": "create",
                "filePath": "README.md",
                "content": "# Project Name\\n\\nDescription of the project..."
            }
        }
    ]
}`;

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
            throw new Error(result.message || 'Tool execution failed');
        }
        
        return result.message || 'Tool executed successfully';
    }

    // Helper methods
    private async buildPlanningPrompt(): Promise<string> {
        // Initialize tool registry if not already done
        await toolRegistry.initialize();
        
        const availableTools = toolRegistry.getToolNames();
        const toolDescriptions = this.buildConciseToolDescriptions();
        
        return `You are an AUTONOMOUS AI AGENT that executes tasks using tools.

YOUR MISSION: Transform user requests into executable action plans.

## AVAILABLE TOOLS:
${toolDescriptions}

## HOW TO THINK:
1. WHAT does the user want me to BUILD/CREATE/FIX?
2. WHICH files do I need to read/write/modify?
3. WHAT commands need to be executed?
4. HOW do I verify success?

## PLANNING RULES:
✅ Use "file_operation" to read/write/create/edit files
✅ Use "terminal" to run commands like tests, builds, npm install
✅ Use "git_operation" for git commands
✅ Use "search_analysis" only to FIND files or code patterns
✅ Create specific, concrete actions with exact parameters
✅ Always include verification steps

❌ Never create vague "analyze" or "investigate" actions
❌ Never use tools just to gather information - always work toward the goal

## EXAMPLES:

USER: "Create a new React component for user login"
GOOD PLAN:
1. file_operation: Create LoginComponent.tsx with React component code
2. file_operation: Create LoginComponent.test.tsx with tests
3. terminal: Run "npm test" to verify tests pass

USER: "Fix the broken authentication in auth.ts"
GOOD PLAN:
1. file_operation: Read auth.ts to understand current implementation
2. file_operation: Write corrected auth.ts with the fix
3. terminal: Run tests to verify the fix works

TOOL LIST: ${availableTools.join(', ')}`;
    }

    private buildConciseToolDescriptions(): string {
        const tools = toolRegistry.getAllTools();
        const descriptions: string[] = [];
        
        for (const tool of tools) {
            const params = tool.metadata.parameters?.slice(0, 3).map(p => 
                `${p.name}${p.required ? '*' : ''}`
            ).join(', ') || '';
            
            descriptions.push(`• ${tool.metadata.name}: ${tool.metadata.description} (${params})`);
        }
        
        return descriptions.slice(0, 10).join('\n'); // Limit to top 10 tools for clarity
    }

    private formatContext(context: any[]): string {
        return context.map(item => `File: ${item.path}\n${item.content}`).join('\n\n');
    }

    private parsePlanFromResponse(response: string, userRequest: string): AgentPlan {
        try {
            // Extract JSON from response (handle cases where AI adds explanation)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            
            const jsonStr = jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            
            // Validate the parsed plan
            if (!parsed.actions || !Array.isArray(parsed.actions)) {
                throw new Error('Invalid plan: actions must be an array');
            }
            
            if (parsed.actions.length === 0) {
                throw new Error('Invalid plan: must have at least one action');
            }
            
            const availableTools = toolRegistry.getToolNames();
            
            // Validate and normalize each action
            const validatedActions = parsed.actions.map((action: any, index: number) => {
                if (!action.type) {
                    throw new Error(`Action ${index + 1}: missing type`);
                }
                
                if (!action.payload) {
                    throw new Error(`Action ${index + 1}: missing payload`);
                }
                
                const normalizedType = this.normalizeActionType(action.type);
                if (!availableTools.includes(normalizedType)) {
                    throw new Error(`Action ${index + 1}: unknown tool type '${action.type}'`);
                }
                
                return {
                    type: normalizedType,
                    description: action.description || `Execute ${normalizedType}`,
                    payload: action.payload,
                    status: 'pending' as const,
                    timestamp: Date.now() + index
                };
            });
            
            this.outputChannel.appendLine(`✅ Plan validation successful: ${validatedActions.length} actions`);
            
            return {
                goal: parsed.goal || userRequest,
                actions: validatedActions,
                currentActionIndex: 0,
                status: 'planning',
                startTime: Date.now()
            };
            
        } catch (error) {
            this.outputChannel.appendLine(`⚠️ Plan parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            
            // Create a smart fallback plan based on request analysis
            return this.createFallbackPlan(userRequest);
        }
    }

    private createFallbackPlan(userRequest: string): AgentPlan {
        const request = userRequest.toLowerCase();
        
        // Analyze request to create a reasonable fallback
        if (request.includes('create') || request.includes('add') || request.includes('build')) {
            return {
                goal: `Create solution for: ${userRequest}`,
                actions: [{
                    type: 'file_operation',
                    description: `Read existing files to understand context`,
                    payload: { 
                        operation: 'read',
                        filePath: 'package.json'
                    },
                    status: 'pending',
                    timestamp: Date.now()
                }],
                currentActionIndex: 0,
                status: 'planning',
                startTime: Date.now()
            };
        } else if (request.includes('fix') || request.includes('debug') || request.includes('error')) {
            return {
                goal: `Fix issue: ${userRequest}`,
                actions: [{
                    type: 'search_analysis',
                    description: 'Search for relevant code to understand the issue',
                    payload: { 
                        query: userRequest,
                        type: 'semantic',
                        scope: 'workspace',
                        maxResults: 5
                    },
                    status: 'pending',
                    timestamp: Date.now()
                }],
                currentActionIndex: 0,
                status: 'planning',
                startTime: Date.now()
            };
        } else {
            return {
                goal: `Analyze and respond to: ${userRequest}`,
                actions: [{
                    type: 'search_analysis',
                    description: 'Search codebase to understand the request',
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

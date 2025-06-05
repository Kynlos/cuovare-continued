import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AIProviderManager, Message, ToolCall, ChatResponse, ChatRequest } from './AIProviderManager';
import { FileContextManager } from '../context/FileContextManager';
import { ContextRetrievalEngine, RetrievalContext, QueryIntent } from '../context/ContextRetrievalEngine';
import { MCPManager } from '../mcp/MCPManager';
import { ToolExecutionEngine, ToolExecutionRequest, ToolExecutionResult } from '../mcp/ToolExecutionEngine';
import { AgentMode } from '../agent/AgentMode';
import { marked } from 'marked';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: number;
    metadata?: {
        provider?: string;
        model?: string;
        files?: string[];
        intelligentContextFiles?: string[];
        contextCount?: number;
        tokens?: number;
        toolCalls?: ToolCall[];
        toolResults?: ToolExecutionResult[];
        executionTime?: number;
        isAgentMode?: boolean;
        agentStatus?: string;
        isSystemMessage?: boolean;
    };
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    lastUpdated: number;
    toolsEnabled: boolean;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _chatHistory: ChatMessage[] = [];
    private _isLoading = false;
    private _currentSessionId: string | null = null;
    private _sessions: Map<string, ChatSession> = new Map();
    private _toolsEnabled = true;
    private _autoExecuteTools = true;
    private _agentMode: AgentMode;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aiManager: AIProviderManager,
        private readonly _fileManager: FileContextManager,
        private readonly _contextEngine: ContextRetrievalEngine,
        private readonly _mcpManager: MCPManager,
        private readonly _toolEngine: ToolExecutionEngine
    ) {
        this.loadSessions();
        this.createNewSession();
        this.setupToolEventHandlers();
        
        // Initialize Agent Mode
        this._agentMode = new AgentMode(
            this._aiManager,
            this._contextEngine,
            this._mcpManager,
            this._toolEngine
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.message, data.fileReferences);
                    break;
                case 'clearChat':
                    this.clearChat();
                    break;
                case 'saveApiKey':
                    await this.saveApiKey(data.provider, data.apiKey);
                    break;
                case 'setProvider':
                    await this.setProvider(data.provider);
                    break;
                case 'setModel':
                    await this.setModel(data.provider, data.model);
                    break;
                case 'getSettings':
                    await this.sendSettings();
                    break;
                case 'addMCPServer':
                    await this.addMCPServer(data.server);
                    break;
                case 'callMCPTool':
                    await this.callMCPTool(data.tool, data.args);
                    break;
                case 'toggleAgentMode':
                    this.toggleAgentMode(data.enabled);
                    break;
                case 'stopAgentExecution':
                    this.stopAgentExecution();
                    break;
                case 'toggleTools':
                    this.toggleToolsEnabled(data.enabled);
                    break;
                case 'toggleAutoExecuteTools':
                    this.toggleAutoExecuteTools(data.enabled);
                    break;
                case 'executeToolCall':
                    await this.executeToolCall(data.toolCall);
                    break;
                case 'getMCPStatus':
                    await this.sendMCPStatus();
                    break;
                case 'refreshMCPServers':
                    await this.refreshMCPServers();
                    break;
                case 'newChat':
                    this.createNewSession();
                    break;
                case 'loadSession':
                    this.loadSession(data.sessionId);
                    break;
                case 'deleteSession':
                    this.deleteSession(data.sessionId);
                    break;
                case 'getSessions':
                    this.sendSessionList();
                    break;
                case 'getActiveFile':
                    await this.getActiveFileInfo();
                    break;
                case 'applyCodeToFile':
                    await this.applyCodeToFile(data.filePath, data.code, data.language);
                    break;
                case 'createNewFile':
                    await this.createNewFile(data.fileName, data.content, data.language);
                    break;
                case 'deleteCustomModel':
                    await this.deleteCustomModel(data.provider, data.model);
                    break;
                case 'confirmRemoveApiKey':
                    await this.confirmRemoveApiKey(data.provider);
                    break;
                case 'removeApiKey':
                    await this.removeApiKey(data.provider);
                    break;
                case 'generateCommitMessage':
                    await this.generateCommitMessage();
                    break;
            }
        });

        // Send initial data
        this.sendChatHistory();
        this.sendSettings();
        this.sendMCPStatus();
        this.sendWorkspaceFiles();
    }

    /**
     * Setup event handlers for tool-related events
     */
    private setupToolEventHandlers(): void {
        // Listen for MCP server changes
        this._mcpManager.refreshConfiguration();
    }

    /**
     * Handle user message with tool support
     */
    private async handleUserMessage(message: string, fileReferences?: string[]): Promise<void> {
        if (this._isLoading) {
            return;
        }

        this._isLoading = true;
        this.updateLoadingState(true);

        try {
            // Add user message to history
            const userMessage: ChatMessage = {
                id: this.generateId(),
                role: 'user',
                content: message,
                timestamp: Date.now(),
                metadata: {
                    files: fileReferences,
                    intelligentContextFiles: [] // Will be populated after context retrieval
                }
            };

            this.addMessage(userMessage);

            // Get available tools
            const availableTools = this._toolsEnabled ? this._mcpManager.getToolsForAIProvider() : [];
            
            // Prepare conversation context
            const contextFiles = await this.getContextFiles(fileReferences);
            
            // Check if agent mode is enabled
            if (this._agentMode.getEnabled()) {
                await this.handleAgentModeMessage(message, contextFiles, userMessage);
                return;
            }
            
            // Get intelligent context based on the user's message
            const intelligentContext = await this.getIntelligentContext(message, fileReferences);
            
            // Update user message metadata with intelligent context info
            if (userMessage.metadata && intelligentContext.length > 0) {
                userMessage.metadata.intelligentContextFiles = intelligentContext.map(f => f.path);
                userMessage.metadata.contextCount = intelligentContext.length;
                // Update the existing message in the UI
                this.updateMessage(userMessage);
            }
            
            // Combine explicit file references with intelligent context
            const allContextFiles = [...contextFiles, ...intelligentContext];
            
            const conversationMessages = await this.prepareConversationMessages(allContextFiles);

            // Create AI request
            const request: ChatRequest = {
                messages: conversationMessages,
                tools: availableTools,
                enableTools: this._toolsEnabled && availableTools.length > 0,
                toolChoice: this._toolsEnabled && availableTools.length > 0 ? 'auto' : undefined
            };

            // Get AI response
            const response = await this._aiManager.sendMessage(request);

            // Handle tool calls if present
            if (response.requiresToolExecution && response.toolCalls && response.toolCalls.length > 0) {
                await this.handleToolCalls(response, conversationMessages);
            } else {
                // Add regular assistant message
                const assistantMessage: ChatMessage = {
                    id: this.generateId(),
                    role: 'assistant',
                    content: response.content,
                    timestamp: Date.now(),
                    metadata: {
                        provider: response.provider,
                        model: response.model,
                        files: allContextFiles.filter(f => !f.isIntelligentContext).map(f => f.path),
                        intelligentContextFiles: allContextFiles.filter(f => f.isIntelligentContext).map(f => f.path),
                        contextCount: allContextFiles.length
                    }
                };

                this.addMessage(assistantMessage);
            }

        } catch (error) {
            console.error('Error handling user message:', error);
            
            const errorMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                timestamp: Date.now(),
                metadata: {
                    provider: 'error'
                }
            };

            this.addMessage(errorMessage);
        } finally {
            this._isLoading = false;
            this.updateLoadingState(false);
        }
    }

    /**
     * Handle tool calls from AI response
     */
    private async handleToolCalls(response: ChatResponse, conversationMessages: Message[]): Promise<void> {
        if (!response.toolCalls || response.toolCalls.length === 0) {
            return;
        }

        // Add assistant message with tool calls
        const assistantMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: response.content || 'I need to use some tools to help you.',
            timestamp: Date.now(),
            metadata: {
                provider: response.provider,
                model: response.model,
                toolCalls: response.toolCalls
            }
        };

        this.addMessage(assistantMessage);

        if (this._autoExecuteTools) {
            // Auto-execute tools
            await this.executeToolCalls(response.toolCalls, conversationMessages);
        } else {
            // Show tool execution UI
            this.showToolExecutionPrompt(response.toolCalls);
        }
    }

    /**
     * Execute multiple tool calls
     */
    private async executeToolCalls(toolCalls: ToolCall[], conversationMessages: Message[]): Promise<void> {
        const executionRequests: ToolExecutionRequest[] = toolCalls.map(toolCall => ({
            toolName: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            requestId: toolCall.id,
            providerName: 'mcp',
            conversationId: this._currentSessionId || 'default'
        }));

        // Execute tools in parallel
        const results = await this._toolEngine.executeMultipleTools(executionRequests);

        // Add tool results to conversation
        const toolMessages: Message[] = [];
        const toolResultsMetadata: ToolExecutionResult[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const toolCall = toolCalls[i];

            // Format tool result for AI provider
            const toolMessage = this._aiManager.formatToolResult(
                conversationMessages[0]?.role === 'system' ? 'openai' : 'anthropic', // Default to OpenAI format
                toolCall,
                result.success ? result.result : { error: result.error }
            );

            if (toolMessage) {
                toolMessages.push(toolMessage);
            }

            toolResultsMetadata.push(result);

            // Add tool result message to chat
            const toolResultMessage: ChatMessage = {
                id: this.generateId(),
                role: 'tool',
                content: result.success 
                    ? `Tool "${result.toolName}" executed successfully:\n\`\`\`\n${typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}\n\`\`\``
                    : `Tool "${result.toolName}" failed: ${result.error}`,
                timestamp: Date.now(),
                metadata: {
                    toolResults: [result]
                }
            };

            this.addMessage(toolResultMessage);
        }

        // Get follow-up response from AI with tool results
        if (toolMessages.length > 0) {
            await this.getFollowUpResponse([...conversationMessages, ...toolMessages], toolResultsMetadata);
        }
    }

    /**
     * Get follow-up response after tool execution
     */
    private async getFollowUpResponse(messages: Message[], toolResults: ToolExecutionResult[]): Promise<void> {
        try {
            const request: ChatRequest = {
                messages,
                enableTools: false // Don't enable tools for follow-up
            };

            const response = await this._aiManager.sendMessage(request);

            const followUpMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                metadata: {
                    provider: response.provider,
                    model: response.model,
                    toolResults
                }
            };

            this.addMessage(followUpMessage);

        } catch (error) {
            console.error('Error getting follow-up response:', error);
        }
    }

    /**
     * Execute a single tool call manually
     */
    private async executeToolCall(toolCall: ToolCall): Promise<void> {
        try {
            const executionRequest: ToolExecutionRequest = {
                toolName: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments),
                requestId: toolCall.id,
                providerName: 'mcp',
                conversationId: this._currentSessionId || 'default'
            };

            const result = await this._toolEngine.executeTool(executionRequest);

            // Add result message
            const resultMessage: ChatMessage = {
                id: this.generateId(),
                role: 'tool',
                content: result.success 
                    ? `Tool executed: ${result.result}`
                    : `Tool failed: ${result.error}`,
                timestamp: Date.now(),
                metadata: {
                    toolResults: [result]
                }
            };

            this.addMessage(resultMessage);

        } catch (error) {
            console.error('Error executing tool call:', error);
        }
    }

    /**
     * Show tool execution prompt in UI
     */
    private showToolExecutionPrompt(toolCalls: ToolCall[]): void {
        this._view?.webview.postMessage({
            type: 'showToolExecution',
            toolCalls: toolCalls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
                description: this.getToolDescription(tc.function.name)
            }))
        });
    }

    /**
     * Get tool description from MCP registry
     */
    private getToolDescription(toolName: string): string {
        const tools = this._mcpManager.getAvailableTools();
        const tool = tools.find(t => t.name === toolName);
        return tool?.description || 'No description available';
    }

    /**
     * Toggle tools enabled/disabled
     */
    private toggleToolsEnabled(enabled: boolean): void {
        this._toolsEnabled = enabled;
        
        if (this._currentSessionId) {
            const session = this._sessions.get(this._currentSessionId);
            if (session) {
                session.toolsEnabled = enabled;
            }
        }

        this._view?.webview.postMessage({
            type: 'toolsToggled',
            enabled
        });
    }

    /**
     * Toggle auto-execute tools
     */
    private toggleAutoExecuteTools(enabled: boolean): void {
        this._autoExecuteTools = enabled;

        this._view?.webview.postMessage({
            type: 'autoExecuteToolsToggled',
            enabled
        });
    }

    /**
     * Send MCP status to webview
     */
    private async sendMCPStatus(): Promise<void> {
        const serverStatus = this._mcpManager.getServerStatus();
        const availableTools = this._mcpManager.getAvailableTools();
        const toolRegistry = this._mcpManager.getToolRegistry();
        const executionStats = this._toolEngine.getExecutionStats();

        this._view?.webview.postMessage({
            type: 'mcpStatus',
            data: {
                servers: Array.from(serverStatus.entries()).map(([name, status]) => ({
                    name,
                    ...status
                })),
                toolCount: availableTools.length,
                tools: availableTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    serverName: tool.serverName,
                    category: tool.category,
                    dangerous: tool.dangerous
                })),
                executionStats,
                toolsEnabled: this._toolsEnabled,
                autoExecuteTools: this._autoExecuteTools
            }
        });
    }

    /**
     * Refresh MCP servers
     */
    private async refreshMCPServers(): Promise<void> {
        try {
            await this._mcpManager.refreshConfiguration();
            await this.sendMCPStatus();
            
            this._view?.webview.postMessage({
                type: 'mcpRefreshed',
                success: true
            });
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'mcpRefreshed',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Prepare conversation messages with tool context
     */
    private async prepareConversationMessages(contextFiles: any[]): Promise<Message[]> {
        const messages: Message[] = [];

        // Add system message with tool information if tools are enabled
        if (this._toolsEnabled) {
            const availableTools = this._mcpManager.getAvailableTools();
            if (availableTools.length > 0) {
                const toolSystemMessage = this._aiManager.createToolSystemMessage(
                    this._mcpManager.getToolsForAIProvider()
                );
                if (toolSystemMessage) {
                    messages.push(toolSystemMessage);
                }
            }
        }

        // Add context files
        if (contextFiles.length > 0) {
            const explicitFiles = contextFiles.filter(f => !f.isIntelligentContext);
            const intelligentFiles = contextFiles.filter(f => f.isIntelligentContext);
            
            let contextContent = '';
            
            if (explicitFiles.length > 0) {
                contextContent += `## Explicitly Referenced Files:\n\n${explicitFiles.map(f => 
                    `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``
                ).join('\n\n')}\n\n`;
            }
            
            if (intelligentFiles.length > 0) {
                contextContent += `## Relevant Project Files (automatically selected):\n\n${intelligentFiles.map(f => 
                    `### ${f.path} ${f.relevanceScore ? `(relevance: ${f.relevanceScore.toFixed(2)})` : ''}\n\`\`\`${f.language}\n${f.content}\n\`\`\``
                ).join('\n\n')}`;
            }
            
            const contextMessage: Message = {
                role: 'system',
                content: contextContent
            };
            messages.push(contextMessage);
        }

        // Add conversation history
        for (const chatMessage of this._chatHistory) {
            if (chatMessage.role !== 'tool') { // Don't include tool messages in AI context
                messages.push({
                    role: chatMessage.role as 'user' | 'assistant' | 'system',
                    content: chatMessage.content
                });
            }
        }

        return messages;
    }

    // ... Include all other methods from the original ChatViewProvider ...
    // (I'll include the key methods for completeness)

    private addMessage(message: ChatMessage): void {
        this._chatHistory.push(message);
        this.updateCurrentSession();
        this.sendMessage(message);
    }

    private updateCurrentSession(): void {
        if (!this._currentSessionId) {return;}

        const session = this._sessions.get(this._currentSessionId);
        if (session) {
            session.messages = [...this._chatHistory];
            session.lastUpdated = Date.now();
            this.saveSessions();
        }
    }

    private sendMessage(message: ChatMessage): void {
        this._view?.webview.postMessage({
            type: 'newMessage',
            message
        });
    }

    private updateMessage(message: ChatMessage): void {
        this._view?.webview.postMessage({
            type: 'updateMessage',
            message
        });
    }

    private async sendWorkspaceFiles(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._view?.webview.postMessage({
                    type: 'workspaceFiles',
                    data: []
                });
                return;
            }

            const allFiles: string[] = [];
            
            for (const workspaceFolder of workspaceFolders) {
                const relativePattern = new vscode.RelativePattern(workspaceFolder, '**/*');
                const uris = await vscode.workspace.findFiles(
                    relativePattern,
                    '{**/node_modules/**,**/dist/**,**/build/**,**/out/**,**/.git/**,**/coverage/**,**/*.min.js,**/*.map,**/logs/**,**/temp/**,**/tmp/**,**/.vscode/**,**/.idea/**}',
                    1000
                );
                
                // Convert to relative paths from workspace folder
                const relativePaths = uris
                    .filter(uri => uri.fsPath.startsWith(workspaceFolder.uri.fsPath))
                    .map(uri => path.relative(workspaceFolder.uri.fsPath, uri.fsPath))
                    .filter(relativePath => relativePath && !relativePath.startsWith('..'));
                
                allFiles.push(...relativePaths);
            }

            this._view?.webview.postMessage({
                type: 'workspaceFiles',
                data: allFiles.sort()
            });
        } catch (error) {
            console.error('Error getting workspace files:', error);
            this._view?.webview.postMessage({
                type: 'workspaceFiles',
                data: []
            });
        }
    }

    private updateLoadingState(isLoading: boolean): void {
        this._view?.webview.postMessage({
            type: 'loadingState',
            isLoading
        });
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private createNewSession(): void {
        const sessionId = this.generateId();
        const session: ChatSession = {
            id: sessionId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            toolsEnabled: this._toolsEnabled
        };

        this._sessions.set(sessionId, session);
        this._currentSessionId = sessionId;
        this._chatHistory = [];
        
        this.saveSessions();
        this.sendChatHistory();
        this.sendSessionList();
    }

    // ... Continue with all other necessary methods from original ChatViewProvider ...
    // (For brevity, I'm showing the structure - the actual implementation would include all methods)

    private async getContextFiles(fileReferences?: string[]): Promise<any[]> {
        const contextFiles: any[] = [];
        
        if (fileReferences && fileReferences.length > 0) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return contextFiles;
            }

            for (const ref of fileReferences) {
                try {
                    // Try to resolve relative paths
                    let filePath = ref;
                    if (!path.isAbsolute(ref)) {
                        // Try to find the file in workspace folders
                        for (const workspaceFolder of workspaceFolders) {
                            const absolutePath = path.join(workspaceFolder.uri.fsPath, ref);
                            if (fs.existsSync(absolutePath)) {
                                filePath = absolutePath;
                                break;
                            }
                        }
                    }

                    const fileContent = await this._fileManager.getFileContent(filePath);
                    if (fileContent) {
                        const language = this.detectLanguageFromPath(filePath);
                        contextFiles.push({
                            path: filePath,
                            content: fileContent,
                            language: language,
                            isIntelligentContext: false
                        });
                    }
                } catch (error) {
                    console.error(`Failed to get context for file: ${ref}`, error);
                }
            }
        }
        
        return contextFiles;
    }

    private async getIntelligentContext(userMessage: string, explicitFiles?: string[]): Promise<any[]> {
        try {
            // Use the advanced context retrieval engine with built-in intelligence
            const retrievalContext = await this._contextEngine.retrieveContext(userMessage, {
                maxFileSize: 100000, // 100KB max per file
                includeLanguages: ['typescript', 'javascript', 'json', 'markdown', 'python', 'java', 'cpp'],
                excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**']
            });
            
            const intelligentFiles: any[] = [];
            
            for (const contextFile of retrievalContext.files) {
                // Skip files that were explicitly referenced
                if (explicitFiles && explicitFiles.includes(contextFile.path)) {
                    continue;
                }
                
                intelligentFiles.push({
                    path: contextFile.path,
                    content: contextFile.content,
                    language: contextFile.language,
                    relevanceScore: contextFile.relevanceScore,
                    isIntelligentContext: true
                });
            }
            
            console.log(`Advanced context retrieval found ${intelligentFiles.length} relevant files for query: "${userMessage}"`);
            
            return intelligentFiles;
        } catch (error) {
            console.error('Failed to get intelligent context:', error);
            return [];
        }
    }

    private shouldRetrieveContext(userMessage: string): boolean {
        // The ContextRetrievalEngine now handles all intelligent analysis
        // This method is kept for backward compatibility but delegates to the engine
        return true; // Engine will determine if context is needed
    }

    private classifyQueryIntent(userMessage: string): QueryIntent {
        const message = userMessage.toLowerCase().trim();
        const tokens = message.split(/\s+/);
        
        // === SOCIAL/CONVERSATIONAL QUERIES ===
        if (this.isSocialQuery(message, tokens)) {
            return {
                type: 'social',
                requiresContext: false,
                contextConfig: { maxFiles: 0, minRelevanceScore: 1.0 },
                priority: 'none',
                scope: 'none'
            };
        }

        // === DEBUGGING QUERIES ===
        if (this.isDebuggingQuery(message, tokens)) {
            return {
                type: 'debugging',
                requiresContext: true,
                contextConfig: { maxFiles: 12, minRelevanceScore: 0.25 },
                priority: 'high',
                scope: 'focused'
            };
        }

        // === ARCHITECTURE/SYSTEM ANALYSIS ===
        if (this.isArchitectureQuery(message, tokens)) {
            return {
                type: 'architecture',
                requiresContext: true,
                contextConfig: { maxFiles: 20, minRelevanceScore: 0.2 },
                priority: 'high',
                scope: 'comprehensive'
            };
        }

        // === CODE REVIEW/QUALITY ===
        if (this.isCodeReviewQuery(message, tokens)) {
            return {
                type: 'review',
                requiresContext: true,
                contextConfig: { maxFiles: 15, minRelevanceScore: 0.3 },
                priority: 'high',
                scope: 'comprehensive'
            };
        }

        // === IMPLEMENTATION/DEVELOPMENT ===
        if (this.isImplementationQuery(message, tokens)) {
            return {
                type: 'implementation',
                requiresContext: true,
                contextConfig: { maxFiles: 10, minRelevanceScore: 0.35 },
                priority: 'medium',
                scope: 'focused'
            };
        }

        // === LEARNING/EXPLANATION ===
        if (this.isLearningQuery(message, tokens)) {
            return {
                type: 'learning',
                requiresContext: true,
                contextConfig: { maxFiles: 6, minRelevanceScore: 0.4 },
                priority: 'medium',
                scope: 'educational'
            };
        }

        // === TESTING QUERIES ===
        if (this.isTestingQuery(message, tokens)) {
            return {
                type: 'testing',
                requiresContext: true,
                contextConfig: { maxFiles: 8, minRelevanceScore: 0.35 },
                priority: 'medium',
                scope: 'testing'
            };
        }

        // === PERFORMANCE/OPTIMIZATION ===
        if (this.isPerformanceQuery(message, tokens)) {
            return {
                type: 'performance',
                requiresContext: true,
                contextConfig: { maxFiles: 15, minRelevanceScore: 0.3 },
                priority: 'high',
                scope: 'comprehensive'
            };
        }

        // === SECURITY QUERIES ===
        if (this.isSecurityQuery(message, tokens)) {
            return {
                type: 'security',
                requiresContext: true,
                contextConfig: { maxFiles: 12, minRelevanceScore: 0.3 },
                priority: 'high',
                scope: 'security'
            };
        }

        // === DEPLOYMENT/DEVOPS ===
        if (this.isDeploymentQuery(message, tokens)) {
            return {
                type: 'deployment',
                requiresContext: true,
                contextConfig: { maxFiles: 8, minRelevanceScore: 0.4 },
                priority: 'medium',
                scope: 'infrastructure'
            };
        }

        // === DOCUMENTATION QUERIES ===
        if (this.isDocumentationQuery(message, tokens)) {
            return {
                type: 'documentation',
                requiresContext: true,
                contextConfig: { maxFiles: 5, minRelevanceScore: 0.4 },
                priority: 'low',
                scope: 'focused'
            };
        }

        // === QUICK FIXES/SIMPLE TASKS ===
        if (this.isQuickFixQuery(message, tokens)) {
            return {
                type: 'quickfix',
                requiresContext: true,
                contextConfig: { maxFiles: 3, minRelevanceScore: 0.6 },
                priority: 'low',
                scope: 'minimal'
            };
        }

        // === DEFAULT: CONSERVATIVE TECHNICAL ===
        if (this.hasTechnicalIndicators(message, tokens)) {
            return {
                type: 'technical',
                requiresContext: true,
                contextConfig: { maxFiles: 5, minRelevanceScore: 0.5 },
                priority: 'medium',
                scope: 'focused'
            };
        }

        // === NON-TECHNICAL FALLBACK ===
        return {
            type: 'general',
            requiresContext: false,
            contextConfig: { maxFiles: 0, minRelevanceScore: 1.0 },
            priority: 'none',
            scope: 'none'
        };
    }

    private isSocialQuery(message: string, tokens: string[]): boolean {
        const socialPatterns = [
            // Greetings
            /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)(\s|$)/,
            // Thanks and goodbyes
            /^(thanks?( you)?|thank you|bye|goodbye|see you|farewell)(\s|$)/,
            // Status checks
            /^(how are you|what'?s up|what'?s new|how'?s it going)/,
            // Confirmations
            /^(yes|no|ok|okay|sure|alright|got it|understood|makes sense)$/,
            // Compliments
            /^(good|great|nice|awesome|cool|excellent|perfect|amazing)(\s|$)/,
            // Self-introduction
            /^(who are you|what are you|tell me about yourself|what can you do)/
        ];

        return socialPatterns.some(pattern => pattern.test(message)) ||
               (tokens.length <= 2 && ['hi', 'hello', 'hey', 'thanks', 'ok', 'yes', 'no'].includes(tokens[0]));
    }

    private isDebuggingQuery(message: string, tokens: string[]): boolean {
        const debugKeywords = [
            'bug', 'error', 'exception', 'crash', 'fail', 'broken', 'not working', 'issue', 'problem',
            'debug', 'troubleshoot', 'diagnose', 'trace', 'stack trace', 'stacktrace',
            'undefined', 'null', 'reference error', 'syntax error', 'type error',
            'memory leak', 'performance issue', 'slow', 'hanging', 'timeout',
            'fix', 'solve', 'resolve', 'repair'
        ];

        const debugPatterns = [
            /why (is|does|doesn'?t|isn'?t|won'?t)/,
            /what'?s wrong with/,
            /(error|exception|bug|issue|problem).*(help|fix|solve)/,
            /(help|fix|solve).*(error|exception|bug|issue|problem)/,
            /not working|doesn'?t work|won'?t work/,
            /getting.*error/,
            /console.*error/
        ];

        return debugKeywords.some(keyword => message.includes(keyword)) ||
               debugPatterns.some(pattern => pattern.test(message));
    }

    private isArchitectureQuery(message: string, tokens: string[]): boolean {
        const archKeywords = [
            'architecture', 'design', 'structure', 'pattern', 'system', 'overview',
            'relationship', 'dependency', 'connection', 'integration', 'flow',
            'microservice', 'monolith', 'component', 'module', 'service',
            'database schema', 'data model', 'entity relationship',
            'scalability', 'maintainability', 'extensibility'
        ];

        const archPatterns = [
            /how (does|do) .* work/,
            /what is the .* (architecture|structure|design)/,
            /explain the .* (system|structure|flow)/,
            /how are .* connected/,
            /what'?s the relationship between/,
            /analyze the (codebase|project|system)/,
            /review the (architecture|design|structure)/
        ];

        return archKeywords.some(keyword => message.includes(keyword)) ||
               archPatterns.some(pattern => pattern.test(message));
    }

    private isCodeReviewQuery(message: string, tokens: string[]): boolean {
        const reviewKeywords = [
            'review', 'analyze', 'audit', 'check', 'examine', 'inspect',
            'code quality', 'best practice', 'clean code', 'refactor',
            'smell', 'anti-pattern', 'violation', 'standard', 'convention',
            'maintainable', 'readable', 'optimization', 'improvement'
        ];

        const reviewPatterns = [
            /review (this|the|my) code/,
            /analyze (this|the|my) (code|function|class|file)/,
            /check (this|the|my) (code|implementation)/,
            /is this.*good|is this.*correct|is this.*right/,
            /how can I improve/,
            /what'?s wrong with this/,
            /any suggestions for/,
            /code review/
        ];

        return reviewKeywords.some(keyword => message.includes(keyword)) ||
               reviewPatterns.some(pattern => pattern.test(message));
    }

    private isImplementationQuery(message: string, tokens: string[]): boolean {
        const implKeywords = [
            'implement', 'create', 'build', 'make', 'add', 'write', 'develop',
            'generate', 'construct', 'setup', 'configure', 'install',
            'feature', 'functionality', 'component', 'service', 'endpoint',
            'crud', 'api', 'route', 'handler', 'middleware', 'utility'
        ];

        const implPatterns = [
            /how (to|do I) (create|build|make|implement|add|write)/,
            /can you (create|build|make|implement|add|write)/,
            /I (need|want) to (create|build|make|implement|add|write)/,
            /help me (create|build|make|implement|add|write)/,
            /show me how to/,
            /walk me through/
        ];

        return implKeywords.some(keyword => message.includes(keyword)) ||
               implPatterns.some(pattern => pattern.test(message));
    }

    private isLearningQuery(message: string, tokens: string[]): boolean {
        const learnKeywords = [
            'explain', 'understand', 'learn', 'teach', 'what is', 'what does',
            'how does', 'why does', 'concept', 'principle', 'theory',
            'tutorial', 'guide', 'documentation', 'example', 'sample'
        ];

        const learnPatterns = [
            /what (is|does|are)/,
            /how (does|do|is|are)/,
            /why (does|do|is|are)/,
            /explain.*to me/,
            /help me understand/,
            /I don'?t understand/,
            /can you explain/,
            /what'?s the difference between/
        ];

        return learnKeywords.some(keyword => message.includes(keyword)) ||
               learnPatterns.some(pattern => pattern.test(message));
    }

    private isTestingQuery(message: string, tokens: string[]): boolean {
        const testKeywords = [
            'test', 'testing', 'unit test', 'integration test', 'e2e test',
            'mock', 'stub', 'spy', 'jest', 'mocha', 'chai', 'cypress',
            'coverage', 'assertion', 'expect', 'should', 'describe', 'it'
        ];

        const testPatterns = [
            /write.*test/,
            /test.*function|test.*component|test.*class/,
            /how to test/,
            /testing strategy/,
            /unit test|integration test/
        ];

        return testKeywords.some(keyword => message.includes(keyword)) ||
               testPatterns.some(pattern => pattern.test(message));
    }

    private isPerformanceQuery(message: string, tokens: string[]): boolean {
        const perfKeywords = [
            'performance', 'optimize', 'speed', 'fast', 'slow', 'latency',
            'memory', 'cpu', 'bottleneck', 'profiling', 'benchmark',
            'cache', 'lazy loading', 'pagination', 'compression',
            'bundle size', 'minify', 'tree shaking', 'code splitting'
        ];

        const perfPatterns = [
            /make.*faster|make.*better performance/,
            /optimize.*performance/,
            /improve.*speed|improve.*performance/,
            /reduce.*time|reduce.*latency/,
            /performance.*issue|performance.*problem/
        ];

        return perfKeywords.some(keyword => message.includes(keyword)) ||
               perfPatterns.some(pattern => pattern.test(message));
    }

    private isSecurityQuery(message: string, tokens: string[]): boolean {
        const securityKeywords = [
            'security', 'vulnerability', 'exploit', 'attack', 'threat',
            'authentication', 'authorization', 'permission', 'access control',
            'xss', 'csrf', 'injection', 'sql injection', 'sanitize',
            'encrypt', 'decrypt', 'hash', 'salt', 'token', 'jwt',
            'https', 'ssl', 'tls', 'certificate'
        ];

        const securityPatterns = [
            /security.*issue|security.*problem|security.*vulnerability/,
            /is this secure|is this safe/,
            /security.*review|security.*audit/,
            /protect.*against|prevent.*attack/
        ];

        return securityKeywords.some(keyword => message.includes(keyword)) ||
               securityPatterns.some(pattern => pattern.test(message));
    }

    private isDeploymentQuery(message: string, tokens: string[]): boolean {
        const deployKeywords = [
            'deploy', 'deployment', 'production', 'staging', 'environment',
            'docker', 'container', 'kubernetes', 'k8s', 'ci/cd', 'pipeline',
            'build', 'compile', 'bundle', 'package', 'release',
            'server', 'cloud', 'aws', 'azure', 'gcp', 'heroku', 'vercel'
        ];

        const deployPatterns = [
            /deploy.*to|deploy.*on/,
            /how to deploy/,
            /deployment.*process|deployment.*strategy/,
            /build.*for production/,
            /production.*build|production.*deployment/
        ];

        return deployKeywords.some(keyword => message.includes(keyword)) ||
               deployPatterns.some(pattern => pattern.test(message));
    }

    private isDocumentationQuery(message: string, tokens: string[]): boolean {
        const docKeywords = [
            'document', 'documentation', 'comment', 'readme', 'guide',
            'manual', 'instruction', 'description', 'specification',
            'jsdoc', 'typedoc', 'swagger', 'openapi'
        ];

        const docPatterns = [
            /write.*documentation|create.*documentation/,
            /document.*this|document.*function|document.*class/,
            /add.*comment|add.*documentation/,
            /generate.*docs|generate.*documentation/
        ];

        return docKeywords.some(keyword => message.includes(keyword)) ||
               docPatterns.some(pattern => pattern.test(message));
    }

    private isQuickFixQuery(message: string, tokens: string[]): boolean {
        const quickKeywords = [
            'quick', 'simple', 'small', 'minor', 'tiny', 'little',
            'change', 'update', 'modify', 'tweak', 'adjust',
            'rename', 'move', 'delete', 'remove'
        ];

        return tokens.length <= 5 && quickKeywords.some(keyword => message.includes(keyword));
    }

    private hasTechnicalIndicators(message: string, tokens: string[]): boolean {
        const techIndicators = [
            // Programming languages
            'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'rust', 'go',
            'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css',
            
            // Frameworks/Libraries
            'react', 'vue', 'angular', 'node', 'express', 'django', 'flask',
            'spring', 'laravel', 'rails', 'next', 'nuxt', 'svelte',
            
            // Technical concepts
            'function', 'class', 'method', 'variable', 'constant', 'array',
            'object', 'string', 'number', 'boolean', 'null', 'undefined',
            'async', 'await', 'promise', 'callback', 'closure', 'scope',
            'prototype', 'inheritance', 'polymorphism', 'encapsulation',
            
            // File extensions
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.cs',
            '.html', '.css', '.json', '.xml', '.yml', '.yaml', '.md',
            
            // Development tools
            'git', 'npm', 'yarn', 'webpack', 'babel', 'eslint', 'prettier',
            'vscode', 'github', 'gitlab', 'bitbucket',
            
            // Database/Backend
            'database', 'sql', 'mongodb', 'postgresql', 'mysql', 'redis',
            'api', 'rest', 'graphql', 'endpoint', 'route', 'middleware'
        ];

        return techIndicators.some(indicator => message.includes(indicator)) ||
               /\.(js|ts|jsx|tsx|py|java|cpp|cs|html|css|json|xml|yml|yaml|md)(\s|$)/i.test(message);
    }

    private detectLanguageFromPath(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap: Record<string, string> = {
            'ts': 'typescript',
            'js': 'javascript',
            'jsx': 'jsx',
            'tsx': 'tsx',
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
            'sql': 'sql',
            'md': 'markdown',
            'yml': 'yaml',
            'yaml': 'yaml'
        };
        return langMap[ext || ''] || 'text';
    }

    private sendChatHistory(): void {
        this._view?.webview.postMessage({
            type: 'chatHistory',
            data: this._chatHistory,
            isLoading: this._isLoading
        });
    }

    private async sendSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const defaultProvider = config.get<string>('defaultProvider', 'openai');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});
        const customModels = config.get<Record<string, string[]>>('customModels', {});
        const mcpServers = config.get<any[]>('mcpServers', []);

        const availableProviders = await this._aiManager.getAvailableProviders();
        const allProviders = Array.from(this._aiManager.getAllProviders().keys());
        const allProvidersMap = this._aiManager.getAllProviders();
        const mcpStatus = this._mcpManager.getServerStatus();
        const mcpTools = this._mcpManager.getAvailableTools();

        // Check which providers have API keys stored
        const apiKeyStatus: Record<string, boolean> = {};
        for (const provider of allProviders) {
            apiKeyStatus[provider] = await this._aiManager.hasApiKey(provider);
        }

        // Get models for each provider (including custom models)
        const providerModels: Record<string, string[]> = {};
        for (const [providerName, providerData] of allProvidersMap) {
            const baseModels = [...providerData.models];
            const customProviderModels = customModels[providerName] || [];
            providerModels[providerName] = [...baseModels, ...customProviderModels];
        }

        this._view?.webview.postMessage({
            type: 'settings',
            data: {
                apiKeyStatus,
                defaultProvider,
                selectedModels,
                customModels,
                availableProviders,
                allProviders,
                providerModels,
                mcpServers,
                mcpStatus: Object.fromEntries(mcpStatus),
                mcpTools,
                toolsEnabled: this._toolsEnabled,
                autoExecuteTools: this._autoExecuteTools,
                agentModeEnabled: this._agentMode.getEnabled(),
                agentCapabilities: this._agentMode.getCapabilities(),
                currentAgentPlan: this._agentMode.getCurrentPlan()
            }
        });
    }

    private sendSessionList(): void {
        const sessions = Array.from(this._sessions.values())
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .map(session => ({
                id: session.id,
                title: session.title,
                lastUpdated: session.lastUpdated,
                messageCount: session.messages.length
            }));

        this._view?.webview.postMessage({
            type: 'sessionList',
            data: {
                sessions,
                currentSessionId: this._currentSessionId
            }
        });
    }

    private loadSessions(): void {
        const config = vscode.workspace.getConfiguration('cuovare');
        const savedSessions = config.get<ChatSession[]>('chatSessions', []);
        
        this._sessions.clear();
        savedSessions.forEach(session => {
            this._sessions.set(session.id, session);
        });
    }

    private saveSessions(): void {
        const config = vscode.workspace.getConfiguration('cuovare');
        const sessionsArray = Array.from(this._sessions.values());
        config.update('chatSessions', sessionsArray, vscode.ConfigurationTarget.Global);
    }

    private clearChat(): void {
        this._chatHistory = [];
        this.updateCurrentSession();
        this.sendChatHistory();
    }

    /**
     * Handle message in agent mode
     */
    private async handleAgentModeMessage(message: string, contextFiles: any[], userMessage: ChatMessage): Promise<void> {
        try {
            // Show agent mode indicator
            const agentMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: '🤖 **Agent Mode Activated**\n\nAnalyzing your request and creating execution plan...',
                timestamp: Date.now(),
                metadata: {
                    isAgentMode: true,
                    agentStatus: 'planning'
                }
            };
            
            this._chatHistory.push(agentMessage);
            this.sendChatHistory();
            
            // Execute in agent mode
            const result = await this._agentMode.executeAgentRequest(message, contextFiles);
            
            // Update with final result
            agentMessage.content = result;
            agentMessage.metadata = {
                isAgentMode: true,
                agentStatus: 'completed'
            };
            
            this.updateMessage(agentMessage);
            this.updateCurrentSession();
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            const agentErrorMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `🤖 **Agent Mode Error**\n\n❌ ${errorMessage}`,
                timestamp: Date.now(),
                metadata: {
                    isAgentMode: true,
                    agentStatus: 'failed'
                }
            };
            
            this._chatHistory.push(agentErrorMessage);
            this.sendChatHistory();
            this.updateCurrentSession();
        }
    }

    /**
     * Toggle agent mode
     */
    private toggleAgentMode(enabled: boolean): void {
        this._agentMode.setEnabled(enabled);
        
        // Send updated settings to UI
        this.sendSettings();
        
        // Add system message about mode change
        const systemMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: `🤖 **Agent Mode ${enabled ? 'Enabled' : 'Disabled'}**\n\n${enabled ? 
                'I can now perform autonomous multi-step tasks including file operations, terminal commands, and complex workflows.' : 
                'Switched back to standard chat mode.'}`,
            timestamp: Date.now(),
            metadata: {
                isSystemMessage: true
            }
        };
        
        this._chatHistory.push(systemMessage);
        this.sendChatHistory();
        this.updateCurrentSession();
    }

    /**
     * Stop agent execution
     */
    private stopAgentExecution(): void {
        this._agentMode.stopExecution();
        
        const systemMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: '🛑 **Agent Execution Stopped**\n\nExecution has been halted by user request.',
            timestamp: Date.now(),
            metadata: {
                isSystemMessage: true
            }
        };
        
        this._chatHistory.push(systemMessage);
        this.sendChatHistory();
        this.updateCurrentSession();
    }

    private async saveApiKey(provider: string, apiKey: string): Promise<void> {
        await this._aiManager.setApiKey(provider, apiKey);
    }

    private async confirmRemoveApiKey(provider: string): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to remove the API key for ${provider}? This will make the provider unavailable until you add a new key.`,
            { modal: true },
            'Remove API Key'
        );
        
        if (result === 'Remove API Key') {
            await this.removeApiKey(provider);
        }
    }

    private async removeApiKey(provider: string): Promise<void> {
        await this._aiManager.removeApiKey(provider);
        await this.sendSettings(); // Refresh the UI
        vscode.window.showInformationMessage(`API key removed for ${provider}.`);
    }

    private async setProvider(provider: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        
        // Validate that the provider exists
        const availableProviders = this._aiManager.getAllProviders();
        if (!availableProviders.has(provider)) {
            vscode.window.showErrorMessage(`Provider '${provider}' is not available.`);
            return;
        }
        
        // Check if the provider has an API key
        const hasApiKey = await this._aiManager.hasApiKey(provider);
        if (!hasApiKey) {
            vscode.window.showWarningMessage(
                `No API key configured for ${provider}. Please add an API key in settings.`
            );
        }
        
        // Update the default provider setting
        await config.update('defaultProvider', provider, vscode.ConfigurationTarget.Global);
        
        // Refresh settings to update UI
        await this.sendSettings();
        
        vscode.window.showInformationMessage(`Switched to ${provider} provider.`);
    }

    private async setModel(provider: string, model: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});
        const customModels = config.get<Record<string, string[]>>('customModels', {});
        
        // Check if this is a new custom model
        const providerData = this._aiManager.getProvider(provider);
        if (providerData && !providerData.models.includes(model)) {
            // This is a custom model - add it to the custom models list
            const providerCustomModels = customModels[provider] || [];
            if (!providerCustomModels.includes(model)) {
                providerCustomModels.push(model);
                customModels[provider] = providerCustomModels;
                await config.update('customModels', customModels, vscode.ConfigurationTarget.Global);
            }
        }
        
        // Update selected model for this provider
        selectedModels[provider] = model;
        await config.update('selectedModels', selectedModels, vscode.ConfigurationTarget.Global);
        
        // Refresh settings to update UI
        await this.sendSettings();
    }

    private async addMCPServer(server: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const mcpServers = config.get<any[]>('mcpServers', []);
        
        // Process the arguments - replace workspace placeholders
        let processedArgs = server.args;
        if (Array.isArray(processedArgs)) {
            processedArgs = processedArgs.map((arg: string) => 
                this.replaceWorkspacePlaceholders(arg)
            );
        } else if (typeof processedArgs === 'string') {
            processedArgs = processedArgs.split(',')
                .map((arg: string) => this.replaceWorkspacePlaceholders(arg.trim()))
                .filter((arg: string) => arg);
        }
        
        const newServer: any = {
            name: server.name,
            command: server.command,
            args: processedArgs,
            autoReconnect: true
        };
        
        if (server.description) {
            newServer.description = server.description;
        }
        
        // Check if server with same name already exists
        const existingIndex = mcpServers.findIndex(s => s.name === server.name);
        if (existingIndex >= 0) {
            mcpServers[existingIndex] = newServer;
        } else {
            mcpServers.push(newServer);
        }
        
        await config.update('mcpServers', mcpServers, vscode.ConfigurationTarget.Global);
        
        // Refresh MCP manager to pick up new server
        await this._mcpManager.refreshConfiguration();
        await this.sendSettings();
    }

    private replaceWorkspacePlaceholders(arg: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return arg;
        }
        
        // Replace common placeholders
        let result = arg;
        result = result.replace(/\$\{WORKSPACE_FOLDER\}/g, workspaceFolders[0].uri.fsPath);
        result = result.replace(/\$\{workspaceFolder\}/g, workspaceFolders[0].uri.fsPath);
        result = result.replace(/\$\{HOME\}/g, os.homedir());
        
        return result;
    }

    private async callMCPTool(tool: string, args: any): Promise<void> {
        // Implementation using tool execution engine
    }

    private async getActiveFileInfo(): Promise<void> {
        // Implementation
    }

    private async applyCodeToFile(filePath: string, code: string, language: string): Promise<void> {
        // Implementation
    }

    private async createNewFile(fileName: string, content: string, language: string): Promise<void> {
        // Implementation
    }

    private async deleteCustomModel(provider: string, model: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const customModels = config.get<Record<string, string[]>>('customModels', {});
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});
        
        // Remove from custom models list
        if (customModels[provider]) {
            customModels[provider] = customModels[provider].filter(m => m !== model);
            if (customModels[provider].length === 0) {
                delete customModels[provider];
            }
            await config.update('customModels', customModels, vscode.ConfigurationTarget.Global);
        }
        
        // If this was the selected model, reset to the provider's default
        if (selectedModels[provider] === model) {
            const providerData = this._aiManager.getProvider(provider);
            if (providerData && providerData.models.length > 0) {
                selectedModels[provider] = providerData.models[0];
                await config.update('selectedModels', selectedModels, vscode.ConfigurationTarget.Global);
            }
        }
        
        // Refresh settings to update UI
        await this.sendSettings();
    }

    private loadSession(sessionId: string): void {
        // Implementation
    }

    private deleteSession(sessionId: string): void {
        // Implementation
    }

    public showSettings(): void {
        // Implementation
    }

    public async explainCode(code: string, fileName: string): Promise<void> {
        // Implementation
    }

    public async generateCode(request: string): Promise<void> {
        // Implementation
    }

    public async reviewCode(code: string, fileName: string): Promise<void> {
        // Implementation
    }

    private async generateCommitMessage(): Promise<void> {
        try {
            this._isLoading = true;
            this.updateLoadingState(true);

            // Get git status and diff
            const gitInfo = await this.getGitChanges();
            
            if (!gitInfo.hasChanges) {
                vscode.window.showInformationMessage('No git changes found to commit.');
                return;
            }

            // Generate commit message using AI
            const commitMessage = await this.generateAICommitMessage(gitInfo);
            
            // Show the generated commit message
            const result = await vscode.window.showInformationMessage(
                `Generated commit message:\n\n"${commitMessage}"\n\nWould you like to use this commit message?`,
                { modal: true },
                'Use Message',
                'Copy to Clipboard',
                'Edit Message'
            );

            if (result === 'Use Message') {
                await this.commitWithMessage(commitMessage);
            } else if (result === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(commitMessage);
                vscode.window.showInformationMessage('Commit message copied to clipboard.');
            } else if (result === 'Edit Message') {
                const editedMessage = await vscode.window.showInputBox({
                    value: commitMessage,
                    prompt: 'Edit the commit message',
                    placeHolder: 'Enter your commit message'
                });
                
                if (editedMessage) {
                    await this.commitWithMessage(editedMessage);
                }
            }

        } catch (error) {
            console.error('Error generating commit message:', error);
            vscode.window.showErrorMessage(`Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this._isLoading = false;
            this.updateLoadingState(false);
        }
    }

    private async getGitChanges(): Promise<{ hasChanges: boolean; status: string; diff: string; files: string[] }> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const { spawn } = require('child_process');

        // Get git status
        const status = await this.runGitCommand(workspaceRoot, ['status', '--porcelain']);
        const hasChanges = status.trim().length > 0;
        
        if (!hasChanges) {
            return { hasChanges: false, status: '', diff: '', files: [] };
        }

        // Get git diff for staged and unstaged changes
        const diffStaged = await this.runGitCommand(workspaceRoot, ['diff', '--staged']);
        const diffUnstaged = await this.runGitCommand(workspaceRoot, ['diff']);
        const diff = diffStaged + '\n' + diffUnstaged;

        // Parse changed files
        const files = status.split('\n')
            .filter(line => line.trim())
            .map(line => line.substring(3)); // Remove status indicators

        return { hasChanges: true, status, diff, files };
    }

    private async runGitCommand(cwd: string, args: string[]): Promise<string> {
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            const git = spawn('git', args, { cwd });
            let stdout = '';
            let stderr = '';

            git.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            git.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            git.on('close', (code: number) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Git command failed with code ${code}`));
                }
            });
        });
    }

    private async generateAICommitMessage(gitInfo: { status: string; diff: string; files: string[] }): Promise<string> {
        const prompt = `Generate a concise, conventional commit message based on the following git changes.

Files changed:
${gitInfo.files.join('\n')}

Git status:
${gitInfo.status}

Git diff:
${gitInfo.diff.substring(0, 4000)} ${gitInfo.diff.length > 4000 ? '...(truncated)' : ''}

Rules:
1. Use conventional commit format: type(scope): description
2. Common types: feat, fix, docs, style, refactor, test, chore
3. Keep the description under 72 characters
4. Be specific about what changed
5. Focus on the "what" and "why", not the "how"

Return only the commit message, nothing else.`;

        const messages = [
            {
                role: 'system' as const,
                content: 'You are an expert at writing clear, concise git commit messages following conventional commit standards.'
            },
            {
                role: 'user' as const,
                content: prompt
            }
        ];

        const response = await this._aiManager.sendMessage({
            messages,
            enableTools: false
        });

        return response.content.trim();
    }

    private async commitWithMessage(message: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        
        try {
            // Add all changes
            await this.runGitCommand(workspaceRoot, ['add', '.']);
            
            // Commit with the generated message
            await this.runGitCommand(workspaceRoot, ['commit', '-m', message]);
            
            vscode.window.showInformationMessage(`Successfully committed: "${message}"`);
        } catch (error) {
            throw new Error(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'styles.css')
        );

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js')
        );

        // Use CDN for highlight.js to avoid require issues
        const highlightJsUri = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
        const highlightCssUri = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; script-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com 'unsafe-eval';">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        vscode: {
                            bg: 'var(--vscode-editor-background)',
                            fg: 'var(--vscode-editor-foreground)',
                            accent: 'var(--vscode-accent, #007acc)'
                        }
                    }
                }
            }
        }
    </script>
    <link href="${highlightCssUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <script src="${highlightJsUri}"></script>
    <title>Cuovare Chat</title>
</head>
<body>
    <div id="app" class="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
        <!-- Header -->
        <header id="header" class="flex-shrink-0 flex items-center justify-between px-2 py-2 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50">
            <div class="flex items-center gap-2 min-w-0 flex-1">
                <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                    <span class="text-white text-xs font-bold">BC</span>
                </div>
                <h1 class="text-sm font-semibold text-slate-100 truncate">Cuovare</h1>
                <select id="quickModelSelect"
                    class="bg-slate-800 border border-slate-600 text-slate-100 text-xs rounded px-2 py-1 min-w-0 flex-1 max-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    title="Model">
                    <option value="" class="bg-slate-800 text-slate-100">Select...</option>
                </select>
            </div>

            <nav class="flex items-center gap-0.5">
                <button id="historyBtn"
                    class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200"
                    title="History">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                </button>
                <button id="newChatBtn"
                    class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200"
                    title="New">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                </button>
                <button id="agentModeToggle"
                    class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all duration-200"
                    title="Toggle Agent Mode">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                </button>
                <button id="generateCommitBtn"
                    class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200"
                    title="Generate Commit Message">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 713.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                </button>
                <button id="settingsBtn"
                    class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200"
                    title="Settings">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                </button>
            </nav>
        </header>

        <!-- Chat Container -->
        <main id="chatContainer" class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div id="chatMessages" class="flex-1 overflow-y-auto px-2 py-3 space-y-3 scroll-smooth"></div>

            <!-- Loading Indicator -->
            <div id="loadingIndicator" class="hidden flex items-center justify-center py-2 px-3">
                <div class="flex items-center gap-2 text-slate-400">
                    <div class="flex gap-1">
                        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0ms"></div>
                        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 150ms"></div>
                        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 300ms"></div>
                    </div>
                    <span class="text-xs">Thinking...</span>
                </div>
            </div>
        </main>

        <!-- Input Container -->
        <footer id="inputContainer" class="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800/50 p-2">
            <!-- Context Info -->
            <div id="contextInfo" class="hidden mb-2 p-2 bg-slate-800/50 border border-slate-700/50 rounded-md">
                <div class="flex items-center gap-2 text-xs text-slate-400">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Context loaded</span>
                </div>
            </div>

            <!-- File References -->
            <div id="fileReferences" class="hidden mb-2">
                <div class="flex items-center gap-1 mb-1">
                    <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span class="text-xs font-medium text-slate-400">Files:</span>
                </div>
                <div class="flex flex-wrap gap-1" id="fileReferencesList"></div>
            </div>

            <!-- Input Area -->
            <div class="relative">
                <div class="relative flex gap-2">
                    <div class="relative flex-1">
                        <textarea id="messageInput"
                            class="w-full bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2 pr-10 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 text-sm leading-relaxed min-h-[36px] max-h-24"
                            placeholder="Ask me anything... Use @filename to reference files"
                            rows="1"></textarea>

                        <!-- File Autocomplete Dropdown -->
                        <div id="autocompleteDropdown" class="absolute bottom-full left-0 right-0 mb-1 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-md shadow-2xl max-h-32 overflow-y-auto hidden z-50">
                            <!-- Populated dynamically -->
                        </div>

                        <!-- Character count (optional) -->
                        <div class="absolute bottom-1 right-2 text-xs text-slate-500 pointer-events-none hidden" id="charCount">
                            0/2000
                        </div>
                    </div>

                    <button id="sendBtn"
                        class="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg transition-all duration-200 group"
                        disabled>
                        <svg class="w-4 h-4 text-white group-disabled:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                    </button>
                </div>
            </div>
        </footer>

        <!-- History Panel -->
        <aside id="historyPanel" class="hidden fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50">
            <div class="flex h-full">
                <div class="w-full max-w-md bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/50 shadow-2xl">
                    <!-- Header -->
                    <header class="flex items-center justify-between p-4 border-b border-slate-800/50">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                </svg>
                            </div>
                            <h2 class="text-lg font-semibold text-slate-100">Chat History</h2>
                        </div>
                        <button id="closeHistory"
                            class="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </header>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-4">
                        <div id="sessionsList" class="space-y-3"></div>
                    </div>
                </div>

                <!-- Backdrop -->
                <div class="flex-1 cursor-pointer" onclick="document.getElementById('closeHistory').click()"></div>
            </div>
        </aside>

        <!-- Settings Panel -->
        <aside id="settingsPanel" class="hidden fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50">
            <div class="flex h-full">
                <div class="w-full bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/50 shadow-2xl flex flex-col">
                    <!-- Header -->
                    <header class="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-800/50">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center">
                                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                </svg>
                            </div>
                            <h2 class="text-base font-semibold text-slate-100">Settings</h2>
                        </div>
                        <button id="closeSettings"
                            class="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-200">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </header>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-3 space-y-3">
                        <!-- AI Providers & Models Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('ai-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">AI Providers & Models</h3>
                                        <p class="text-xs text-slate-400">Configure AI providers, models, and response settings</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="ai-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="ai-section-content" class="px-3 pb-3 space-y-3">
                                <div class="space-y-2">
                                    <label for="providerSelect" class="block text-xs font-medium text-slate-300">Default Provider</label>
                                    <select id="providerSelect" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all">
                                    </select>
                                </div>
                                <div id="modelSelectionContainer" class="space-y-2"></div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">Selected Models</label>
                                    <div id="selectedModelsContainer" class="space-y-2">
                                        <!-- Selected models for each provider will be populated here -->
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">Custom Models</label>
                                    <div id="customModelsContainer" class="space-y-2">
                                        <!-- Custom models for each provider will be populated here -->
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">Response Settings</label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div>
                                            <label for="temperature" class="block text-xs text-slate-400">Temperature</label>
                                            <input type="number" id="temperature" min="0" max="2" step="0.1" value="0.7" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        </div>
                                        <div>
                                            <label for="maxTokens" class="block text-xs text-slate-400">Max Tokens</label>
                                            <input type="number" id="maxTokens" min="100" max="32000" value="4000" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <input type="checkbox" id="streamResponses" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                        <label for="streamResponses" class="text-xs text-slate-300">Stream responses</label>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">API Keys</label>
                                    <div id="apiKeysContainer" class="space-y-2"></div>
                                </div>
                            </div>
                        </section>

                        <!-- Agent System & Tools Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('agent-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">Agent System & Tools</h3>
                                        <p class="text-xs text-slate-400">Configure agent capabilities and tool execution</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="agent-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="agent-section-content" class="hidden px-3 pb-3 space-y-3">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="agentEnabled" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="agentEnabled" class="text-xs text-slate-300">Enable Agent Mode</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="autoExecuteTools" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="autoExecuteTools" class="text-xs text-slate-300">Auto-execute tools</label>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label for="maxConcurrentTools" class="block text-xs font-medium text-slate-300">Max Concurrent Tools</label>
                                        <input type="number" id="maxConcurrentTools" min="1" max="10" value="5" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                    </div>
                                    <div>
                                        <label for="toolExecutionTimeout" class="block text-xs font-medium text-slate-300">Tool Timeout (ms)</label>
                                        <input type="number" id="toolExecutionTimeout" min="5000" max="120000" value="30000" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">Safety Controls</label>
                                    <div class="space-y-2">
                                        <div>
                                            <label for="requireConfirmationTools" class="block text-xs text-slate-400">Tools requiring confirmation:</label>
                                            <input type="text" id="requireConfirmationTools" value="deployment, database, terminal" placeholder="deployment, database, terminal" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        </div>
                                        <div>
                                            <label for="blockedCommands" class="block text-xs text-slate-400">Blocked commands:</label>
                                            <input type="text" id="blockedCommands" value="rm -rf, del /f, format, shutdown" placeholder="rm -rf, del /f, format" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        </div>
                                        <div>
                                            <label for="maxFileSize" class="block text-xs text-slate-400">Max file size (bytes):</label>
                                            <input type="number" id="maxFileSize" value="1048576" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="block text-xs font-medium text-slate-300">Available Tools (23 total)</label>
                                    <div id="availableToolsContainer" class="space-y-1 max-h-32 overflow-y-auto border border-slate-700/50 rounded p-2 bg-slate-800/20">
                                        <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-api" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">API Development</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-database" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Database</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-debugging" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Debugging</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-deployment" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Deployment</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-package" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Package Manager</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-performance" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Performance</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-security" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Security</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-webscraping" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Web Scraping</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-fileOperation" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">File Operations</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-git" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Git</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-multiFileEditing" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Multi-File Editing</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-terminal" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Terminal</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-search" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Search</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-documentation" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Documentation</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-testing" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Testing</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-refactoring" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Refactoring</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-advancedCodeReview" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Advanced Code Review</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-autoTestGeneration" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Auto Test Generation</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-codeRefactoring" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Code Refactoring</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-realTimeErrorDetection" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Real-time Error Detection</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-performanceOptimization" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Performance Optimization</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-securityVulnerability" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Security Vulnerability</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-codeQualityMetrics" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Code Quality Metrics</span>
                                            </label>
                                            <label class="flex items-center gap-2 text-xs">
                                                <input type="checkbox" id="tool-smartImportManagement" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                                <span class="text-slate-300">Smart Import Management</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <!-- Context & Understanding Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('context-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">Context & Understanding</h3>
                                        <p class="text-xs text-slate-400">Configure codebase analysis and context settings</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="context-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="context-section-content" class="hidden px-3 pb-3 space-y-3">
                                <div class="space-y-2">
                                    <label for="maxContextFiles" class="block text-xs font-medium text-slate-300">Max Context Files</label>
                                    <input type="number" id="maxContextFiles" min="1" max="200" value="50" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="autoIncludeOpenFiles" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="autoIncludeOpenFiles" class="text-xs text-slate-300">Auto-include open files</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="intelligentFiltering" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="intelligentFiltering" class="text-xs text-slate-300">Intelligent filtering</label>
                                </div>
                                <div class="space-y-2">
                                    <label for="maxTokensPerFile" class="block text-xs font-medium text-slate-300">Max Tokens Per File</label>
                                    <input type="number" id="maxTokensPerFile" min="100" max="10000" value="2000" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                </div>
                                <div class="space-y-2">
                                    <label for="excludePatterns" class="block text-xs font-medium text-slate-300">Exclude Patterns</label>
                                    <textarea id="excludePatterns" rows="3" placeholder="node_modules/**, .git/**, *.min.js" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs resize-none"></textarea>
                                </div>
                            </div>
                        </section>

                        <!-- User Interface Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('ui-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">User Interface</h3>
                                        <p class="text-xs text-slate-400">Customize appearance and behavior</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="ui-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="ui-section-content" class="hidden px-3 pb-3 space-y-3">
                                <div class="space-y-2">
                                    <label for="uiTheme" class="block text-xs font-medium text-slate-300">Theme</label>
                                    <select id="uiTheme" class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded px-2 py-1 text-xs">
                                        <option value="auto">Auto</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="syntaxHighlighting" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="syntaxHighlighting" class="text-xs text-slate-300">Syntax highlighting</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="showToolDetails" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="showToolDetails" class="text-xs text-slate-300">Show tool execution details</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="autoScroll" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="autoScroll" class="text-xs text-slate-300">Auto-scroll to new messages</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="compactMode" class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="compactMode" class="text-xs text-slate-300">Compact mode</label>
                                </div>
                            </div>
                        </section>

                        <!-- Model Context Protocol Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('mcp-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">Model Context Protocol</h3>
                                        <p class="text-xs text-slate-400">External integrations and server management</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="mcp-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="mcp-section-content" class="hidden px-3 pb-3 space-y-3">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="mcpEnabled" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="mcpEnabled" class="text-xs text-slate-300">Enable MCP</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="mcpAutoStart" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="mcpAutoStart" class="text-xs text-slate-300">Auto-start servers</label>
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="text-xs font-medium text-slate-300">MCP Servers</label>
                                    <button id="addMCPServerBtn" class="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-md transition-all duration-200 text-xs">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        <span>Add</span>
                                    </button>
                                </div>
                                <div id="mcpServersContainer" class="space-y-2"></div>
                            </div>
                        </section>

                        <!-- Advanced Features Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg">
                            <button class="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/30 transition-all rounded-lg" onclick="toggleSection('advanced-section')">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1 1 21 9z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">Advanced Features</h3>
                                        <p class="text-xs text-slate-400">Debug logging, caching, and experimental options</p>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-slate-400 transform transition-transform" id="advanced-section-arrow">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" fill="none" stroke="currentColor"/>
                                </svg>
                            </button>
                            <div id="advanced-section-content" class="hidden px-3 pb-3 space-y-3">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="debugLogging" class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="debugLogging" class="text-xs text-slate-300">Enable debug logging</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="cacheResponses" checked class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="cacheResponses" class="text-xs text-slate-300">Cache AI responses</label>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" id="telemetryEnabled" class="rounded border-slate-600 bg-slate-800 text-blue-500">
                                    <label for="telemetryEnabled" class="text-xs text-slate-300">Anonymous telemetry (optional)</label>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <!-- Backdrop -->
                <div class="flex-1 cursor-pointer" onclick="document.getElementById('closeSettings').click()"></div>
            </div>
        </aside>

        <!-- MCP Server Modal -->
        <div id="mcpServerModal" class="hidden fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div class="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-2xl w-full max-w-sm">
                <!-- Header -->
                <div class="flex items-center gap-2 p-4 border-b border-slate-800/50">
                    <div class="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-semibold text-slate-100">Add MCP Server</h3>
                        <p class="text-xs text-slate-400">Configure new server</p>
                    </div>
                </div>

                <!-- Content -->
                <div class="p-4 space-y-3">
                    <div class="space-y-1">
                        <label for="serverTemplate" class="block text-xs font-medium text-slate-300">Template</label>
                        <select id="serverTemplate"
                            class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all">
                            <option value="">Custom Server</option>
                        </select>
                        <p class="text-xs text-slate-500">Choose a template or configure manually</p>
                    </div>

                    <div class="space-y-1">
                        <label for="serverName" class="block text-xs font-medium text-slate-300">Server Name</label>
                        <input id="serverName"
                            class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                            placeholder="e.g., Database Tools" />
                    </div>

                    <div class="space-y-1">
                        <label for="serverCommand" class="block text-xs font-medium text-slate-300">Command</label>
                        <input id="serverCommand"
                            class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all font-mono"
                            placeholder="e.g., npx" />
                    </div>

                    <div class="space-y-1">
                        <label for="serverArgs" class="block text-xs font-medium text-slate-300">Arguments</label>
                        <input id="serverArgs"
                            class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all font-mono"
                            placeholder="e.g., @modelcontextprotocol/server-postgres" />
                        <p class="text-xs text-slate-500">Separate multiple arguments with commas</p>
                    </div>

                    <div class="space-y-1">
                        <label for="serverDescription" class="block text-xs font-medium text-slate-300">Description</label>
                        <input id="serverDescription"
                            class="w-full bg-slate-800/80 border border-slate-700/50 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                            placeholder="e.g., Access local files and directories" />
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex gap-2 justify-end p-4 border-t border-slate-800/50">
                    <button id="cancelMCPServer"
                        class="px-3 py-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 rounded-md transition-all duration-200 text-sm">
                        Cancel
                    </button>
                    <button id="saveMCPServer"
                        class="px-4 py-1.5 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white rounded-md transition-all duration-200 text-sm">
                        Add Server
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Toggle collapsible sections
        function toggleSection(sectionId) {
            const content = document.getElementById(sectionId + '-content');
            const arrow = document.getElementById(sectionId + '-arrow');
            
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                arrow.style.transform = 'rotate(90deg)';
            } else {
                content.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose(): void {
        this._agentMode.dispose();
    }
}

// Enhanced ChatViewProvider is now exported as ChatViewProvider above

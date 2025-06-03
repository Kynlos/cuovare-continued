import * as vscode from 'vscode';
import { AIProviderManager, Message } from './AIProviderManager';
import { FileContextManager } from '../context/FileContextManager';
import { MCPManager } from '../mcp/MCPManager';
import { marked } from 'marked';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    metadata?: {
        provider?: string;
        model?: string;
        files?: string[];
        tokens?: number;
    };
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    lastUpdated: number;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _chatHistory: ChatMessage[] = [];
    private _isLoading = false;
    private _currentSessionId: string | null = null;
    private _sessions: Map<string, ChatSession> = new Map();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aiManager: AIProviderManager,
        private readonly _fileManager: FileContextManager,
        private readonly _mcpManager: MCPManager
    ) {
        this.loadSessions();
        this.createNewSession();
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
                    await this.applyCodeToFile(data.filePath, data.content);
                    break;
                case 'createNewFile':
                    await this.createNewFile(data.fileName, data.content, data.language);
                    break;
                case 'getWorkspaceFiles':
                    await this.sendWorkspaceFiles();
                    break;
                case 'showSettings':
                    this.showSettings();
                    break;
            }
        });

        // Send initial data
        this.sendChatHistory();
        this.sendSettings();
        this.sendSessionList();
    }

    private generateSessionId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private generateSessionTitle(firstMessage?: string): string {
        if (!firstMessage) {
            return `Chat ${new Date().toLocaleString()}`;
        }
        
        const words = firstMessage.split(' ').slice(0, 6).join(' ');
        return words.length > 40 ? words.substring(0, 40) + '...' : words;
    }

    private createNewSession(): void {
        const sessionId = this.generateSessionId();
        const session: ChatSession = {
            id: sessionId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };

        this._sessions.set(sessionId, session);
        this._currentSessionId = sessionId;
        this._chatHistory = [];
        
        this.saveSessions();
        this.sendChatHistory();
        this.sendSessionList();
    }

    private loadSession(sessionId: string): void {
        const session = this._sessions.get(sessionId);
        if (!session) {
            return;
        }

        this._currentSessionId = sessionId;
        this._chatHistory = [...session.messages];
        
        this.sendChatHistory();
        this.sendSessionList();
    }

    private deleteSession(sessionId: string): void {
        this._sessions.delete(sessionId);
        
        if (this._currentSessionId === sessionId) {
            // If we deleted the current session, create a new one
            this.createNewSession();
        }
        
        this.saveSessions();
        this.sendSessionList();
    }

    private updateCurrentSession(): void {
        if (!this._currentSessionId) {
            return;
        }

        const session = this._sessions.get(this._currentSessionId);
        if (!session) {
            return;
        }

        // Update title if this is the first user message
        if (session.title === 'New Chat' && this._chatHistory.length > 0) {
            const firstUserMessage = this._chatHistory.find(m => m.role === 'user');
            if (firstUserMessage) {
                session.title = this.generateSessionTitle(firstUserMessage.content);
            }
        }

        session.messages = [...this._chatHistory];
        session.lastUpdated = Date.now();
        
        this.saveSessions();
    }

    private loadSessions(): void {
        try {
            const savedSessions = vscode.workspace.getConfiguration('cuovare').get<any[]>('chatSessions', []);
            this._sessions.clear();
            
            for (const sessionData of savedSessions) {
                this._sessions.set(sessionData.id, sessionData);
            }
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
        }
    }

    private saveSessions(): void {
        try {
            const sessionsArray = Array.from(this._sessions.values());
            vscode.workspace.getConfiguration('cuovare').update(
                'chatSessions', 
                sessionsArray, 
                vscode.ConfigurationTarget.Global
            );
        } catch (error) {
            console.error('Failed to save chat sessions:', error);
        }
    }

    private sendSessionList(): void {
        const sessions = Array.from(this._sessions.values())
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .slice(0, 20); // Limit to last 20 sessions

        this._view?.webview.postMessage({
            type: 'sessionList',
            data: {
                sessions,
                currentSessionId: this._currentSessionId
            }
        });
    }

    private async handleUserMessage(content: string, fileReferences?: any[]): Promise<void> {
        if (!content.trim() || this._isLoading) {
            return;
        }

        this._isLoading = true;
        
        // Add user message to history
        const userMessage: ChatMessage = {
            id: this.generateId(),
            role: 'user',
            content,
            timestamp: Date.now()
        };
        this._chatHistory.push(userMessage);
        this.sendChatHistory();

        try {
            // Get project context
            const projectContext = await this._fileManager.getProjectContext();
            
            // Process file references if provided
            let referencedFiles: any[] = [];
            if (fileReferences && fileReferences.length > 0) {
                referencedFiles = await this.processFileReferences(fileReferences);
            }
            
            // Build messages array
            const messages: Message[] = [
                {
                    role: 'system',
                    content: await this.buildSystemPromptWithReferences(projectContext, referencedFiles)
                },
                ...this._chatHistory.slice(-10).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];

            // Send to AI provider
            const response = await this._aiManager.sendMessage(messages);

            // Add assistant response to history
            const assistantMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                metadata: {
                    provider: response.provider,
                    model: response.model,
                    files: projectContext.files.map((f: any) => this._fileManager.getRelativePath(f.path))
                }
            };
            this._chatHistory.push(assistantMessage);
            
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                timestamp: Date.now()
            };
            this._chatHistory.push(errorMessage);
        } finally {
            this._isLoading = false;
            this.updateCurrentSession();
            this.sendChatHistory();
            this.sendSessionList();
        }
    }

    private async buildSystemPrompt(projectContext: any): Promise<string> {
        return this.buildSystemPromptWithReferences(projectContext, []);
    }

    private async buildSystemPromptWithReferences(projectContext: any, referencedFiles: any[]): Promise<string> {
        const availableProviders = await this._aiManager.getAvailableProviders();
        const mcpTools = this._mcpManager.getAvailableTools();
        
        let referencedFilesSection = '';
        if (referencedFiles.length > 0) {
            referencedFilesSection = `
USER-REFERENCED FILES:
${referencedFiles.map(f => 
    `File: ${f.fileName}${f.lineRange ? ` (lines ${f.lineRange})` : ''}
Content:
\`\`\`
${f.content}
\`\`\``
).join('\n\n')}
`;
        }
        
        return `You are Cuovare, an advanced AI coding assistant integrated into VS Code. You have access to the user's codebase and can help with programming tasks.

CODEBASE CONTEXT:
${projectContext.summary}

AVAILABLE FILES (${projectContext.totalFiles} files, ${projectContext.totalLines} lines):
${projectContext.files.map((f: any) => `- ${this._fileManager.getRelativePath(f.path)} (${f.language}, ${f.lineCount} lines)`).join('\n')}

${referencedFilesSection}

AVAILABLE AI PROVIDERS: ${availableProviders.join(', ')}

${mcpTools.length > 0 ? `AVAILABLE MCP TOOLS:
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}` : ''}

You can:
1. Analyze and explain code
2. Generate new code
3. Review and suggest improvements
4. Help with debugging
5. Answer programming questions
6. Use MCP tools when appropriate
7. Reference specific files using @filename syntax

When users reference files with @filename or @filename:lines, pay special attention to those files as they are the focus of the user's question.

Always provide helpful, accurate, and contextually relevant responses. Format code in markdown code blocks with appropriate language highlighting.`;
    }

    public async explainCode(code: string, fileName: string): Promise<void> {
        const message = `Please explain this code from ${fileName}:

\`\`\`
${code}
\`\`\``;
        
        await this.handleUserMessage(message);
    }

    public async generateCode(request: string): Promise<void> {
        const message = `Please generate code for: ${request}`;
        await this.handleUserMessage(message);
    }

    public async reviewCode(code: string, fileName: string): Promise<void> {
        const message = `Please review this code from ${fileName} and suggest improvements:

\`\`\`
${code}
\`\`\``;
        
        await this.handleUserMessage(message);
    }

    public showSettings(): void {
        this._view?.webview.postMessage({ type: 'showSettings' });
    }

    private async sendSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const defaultProvider = config.get<string>('defaultProvider', 'openai');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});
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

        // Get models for each provider
        const providerModels: Record<string, string[]> = {};
        for (const [providerName, providerData] of allProvidersMap) {
            providerModels[providerName] = providerData.models;
        }

        this._view?.webview.postMessage({
            type: 'settings',
            data: {
                apiKeyStatus,
                defaultProvider,
                selectedModels,
                availableProviders,
                allProviders,
                providerModels,
                mcpServers,
                mcpStatus: Object.fromEntries(mcpStatus),
                mcpTools
            }
        });
    }

    private async saveApiKey(provider: string, apiKey: string): Promise<void> {
        await this._aiManager.setApiKey(provider, apiKey);
        
        this._view?.webview.postMessage({
            type: 'notification',
            message: `API key for ${provider} saved securely`
        });
        
        await this.sendSettings();
    }

    private async setProvider(provider: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        await config.update('defaultProvider', provider, vscode.ConfigurationTarget.Global);
        
        this._view?.webview.postMessage({
            type: 'notification',
            message: `Default provider set to ${provider}`
        });
        
        await this.sendSettings();
    }

    private async setModel(provider: string, model: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});
        selectedModels[provider] = model;
        
        await config.update('selectedModels', selectedModels, vscode.ConfigurationTarget.Global);
        
        this._view?.webview.postMessage({
            type: 'notification',
            message: `Model for ${provider} set to ${model}`
        });
        
        await this.sendSettings();
    }

    private async addMCPServer(server: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const currentServers = config.get<any[]>('mcpServers', []);
        currentServers.push(server);
        
        await config.update('mcpServers', currentServers, vscode.ConfigurationTarget.Global);
        await this._mcpManager.refreshConfiguration();
        
        this._view?.webview.postMessage({
            type: 'notification',
            message: `MCP server ${server.name} added successfully`
        });
        
        await this.sendSettings();
    }

    private async callMCPTool(toolName: string, args: Record<string, any>): Promise<void> {
        try {
            const result = await this._mcpManager.callTool({ name: toolName, arguments: args });
            
            const message: ChatMessage = {
                id: this.generateId(),
                role: 'assistant',
                content: `MCP Tool Result (${toolName}):\n\n\`\`\`\n${result.content}\n\`\`\``,
                timestamp: Date.now(),
                metadata: { provider: 'MCP' }
            };
            
            this._chatHistory.push(message);
            this.sendChatHistory();
            
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'notification',
                message: `Error calling MCP tool: ${error}`
            });
        }
    }

    private clearChat(): void {
        if (this._chatHistory.length === 0) {
            return;
        }
        
        // Create a new session instead of clearing current one
        this.createNewSession();
    }

    private sendChatHistory(): void {
        this._view?.webview.postMessage({
            type: 'chatHistory',
            data: this._chatHistory,
            isLoading: this._isLoading
        });
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private async getActiveFileInfo(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        
        let fileInfo = {
            filePath: null as string | null,
            fileName: null as string | null,
            content: null as string | null
        };

        if (activeEditor) {
            const document = activeEditor.document;
            fileInfo = {
                filePath: document.uri.fsPath,
                fileName: document.uri.path.split('/').pop() || 'Unknown',
                content: document.getText()
            };
        }

        this._view?.webview.postMessage({
            type: 'activeFileInfo',
            data: fileInfo
        });
    }

    private async applyCodeToFile(filePath: string, content: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            
            edit.replace(uri, fullRange, content);
            
            const success = await vscode.workspace.applyEdit(edit);
            
            if (success) {
                await document.save();
                
                this._view?.webview.postMessage({
                    type: 'notification',
                    message: `Code applied to ${filePath.split(/[/\\]/).pop()}`
                });
                
                // Show the file in editor
                await vscode.window.showTextDocument(document);
            } else {
                throw new Error('Failed to apply edit');
            }
        } catch (error) {
            console.error('Error applying code to file:', error);
            this._view?.webview.postMessage({
                type: 'notification',
                message: `Error applying code: ${error}`
            });
        }
    }

    private async createNewFile(fileName: string, content: string, language?: string): Promise<void> {
        try {
            // Get workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder open');
            }

            const workspaceUri = workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(workspaceUri, fileName);
            
            // Create the file
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
            
            // Open the file in editor
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            
            this._view?.webview.postMessage({
                type: 'notification',
                message: `Created new file: ${fileName}`
            });
            
        } catch (error) {
            console.error('Error creating new file:', error);
            this._view?.webview.postMessage({
                type: 'notification',
                message: `Error creating file: ${error}`
            });
        }
    }

    private async sendWorkspaceFiles(): Promise<void> {
        try {
            const workspaceFiles = await this.getWorkspaceFiles();
            this._view?.webview.postMessage({
                type: 'workspaceFiles',
                data: workspaceFiles
            });
        } catch (error) {
            console.error('Error getting workspace files:', error);
        }
    }

    private async getWorkspaceFiles(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const files: string[] = [];
        const excludePatterns = ['**/node_modules/**', '**/.*', '**/*.log', '**/dist/**', '**/build/**'];
        
        for (const folder of workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/*');
            const uris = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);
            
            for (const uri of uris) {
                const relativePath = vscode.workspace.asRelativePath(uri);
                files.push(relativePath);
            }
        }

        return files.sort();
    }

    private async processFileReferences(fileReferences: any[]): Promise<any[]> {
        const processedFiles = [];
        
        for (const ref of fileReferences) {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    continue;
                }

                // Find the file in workspace
                const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, ref.fileName);
                
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    let content = document.getText();
                    let lineRange = '';

                    // Handle line ranges
                    if (ref.startLine) {
                        const lines = content.split('\n');
                        const startLine = Math.max(0, ref.startLine - 1); // Convert to 0-based
                        const endLine = ref.endLine ? Math.min(lines.length, ref.endLine) : ref.startLine;
                        
                        content = lines.slice(startLine, endLine).join('\n');
                        lineRange = ref.endLine ? `${ref.startLine}-${ref.endLine}` : `${ref.startLine}`;
                    }

                    processedFiles.push({
                        fileName: ref.fileName,
                        content,
                        lineRange
                    });
                } catch (error) {
                    // File not found or can't read
                    console.error(`Could not read file ${ref.fileName}:`, error);
                }
            } catch (error) {
                console.error('Error processing file reference:', error);
            }
        }

        return processedFiles;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'styles.css')
        );
        
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js')
        );

        const highlightJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'highlight.js', 'lib', 'index.js')
        );

        const highlightCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'highlight.js', 'styles', 'vs2015.css')
        );

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com; script-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com;">
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
                        <!-- API Keys Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-3">
                                <div class="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-md flex items-center justify-center">
                                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-sm font-semibold text-slate-100">API Keys</h3>
                                    <p class="text-xs text-slate-400">Configure credentials</p>
                                </div>
                            </div>
                            <div id="apiKeysContainer" class="space-y-2"></div>
                        </section>

                        <!-- AI Providers Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-3">
                                <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-md flex items-center justify-center">
                                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-sm font-semibold text-slate-100">AI Providers</h3>
                                    <p class="text-xs text-slate-400">Select model & provider</p>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div class="space-y-2">
                                    <label for="providerSelect" class="block text-xs font-medium text-slate-300">Provider</label>
                                    <select id="providerSelect" 
                                        class="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all">
                                    </select>
                                </div>
                                <div id="modelSelectionContainer" class="space-y-2"></div>
                            </div>
                        </section>

                        <!-- MCP Servers Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-semibold text-slate-100">MCP Servers</h3>
                                        <p class="text-xs text-slate-400">Protocol integrations</p>
                                    </div>
                                </div>
                                <button id="addMCPServerBtn" 
                                    class="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white rounded-md transition-all duration-200 text-xs">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                    </svg>
                                    <span>Add</span>
                                </button>
                            </div>
                            <div id="mcpServersContainer" class="space-y-2"></div>
                        </section>

                        <!-- Available Tools Section -->
                        <section class="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                            <div class="flex items-center gap-2 mb-3">
                                <div class="w-6 h-6 bg-gradient-to-br from-pink-500 to-rose-600 rounded-md flex items-center justify-center">
                                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-sm font-semibold text-slate-100">Available Tools</h3>
                                    <p class="text-xs text-slate-400">External capabilities</p>
                                </div>
                            </div>
                            <div id="mcpToolsContainer" class="space-y-2"></div>
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

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

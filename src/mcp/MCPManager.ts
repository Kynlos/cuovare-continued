import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';

export interface MCPServer {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
    process?: ChildProcess;
    socket?: WebSocket;
    tools?: MCPTool[];
    resources?: MCPResource[];
    prompts?: MCPPrompt[];
    status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'initializing';
    capabilities?: MCPCapabilities;
    lastError?: string;
    connectionAttempts: number;
    lastHeartbeat?: number;
    version?: string;
    autoReconnect?: boolean;
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema?: any;
    category?: string;
    examples?: any[];
    serverName?: string;
    dangerous?: boolean;
    requiresConfirmation?: boolean;
}

export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: any[];
}

export interface MCPCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
    experimental?: Record<string, any>;
}

export interface MCPToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface MCPToolResult {
    content: string | any[];
    isError?: boolean;
    isText?: boolean;
    metadata?: {
        serverName?: string;
        executionTime?: number;
        warnings?: string[];
    };
}

export interface ToolRegistryEntry {
    tool: MCPTool;
    serverName: string;
    lastUsed?: number;
    usageCount: number;
    averageExecutionTime: number;
}

export interface AIProviderToolSchema {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

export class MCPManager {
    private servers: Map<string, MCPServer> = new Map();
    private toolRegistry: Map<string, ToolRegistryEntry> = new Map();
    private outputChannel: vscode.OutputChannel;
    private messageIdCounter = 1;
    private pendingRequests: Map<number, { resolve: (value: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }> = new Map();
    private heartbeatInterval?: NodeJS.Timeout;
    private maxReconnectAttempts = 3;
    private reconnectDelay = 5000;
    private requestTimeout = 30000;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Cuovare MCP Enhanced');
        this.startHeartbeat();
        this.setupEventHandlers();
    }

    /**
     * Initialize all configured MCP servers
     */
    public async initializeServers(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const serverConfigs = config.get<any[]>('mcpServers', []);

        this.outputChannel.appendLine('=== Enhanced MCP Server Initialization ===');
        this.outputChannel.appendLine(`Found ${serverConfigs.length} server configurations`);

        // Clear existing servers
        await this.disconnectAllServers();

        for (const serverConfig of serverConfigs) {
            if (!this.validateServerConfig(serverConfig)) {
                this.outputChannel.appendLine(`❌ Invalid server config: ${JSON.stringify(serverConfig)}`);
                continue;
            }

            const server: MCPServer = {
                name: serverConfig.name,
                command: serverConfig.command,
                args: serverConfig.args || [],
                env: serverConfig.env,
                cwd: serverConfig.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                status: 'disconnected',
                connectionAttempts: 0,
                tools: [],
                resources: [],
                prompts: [],
                autoReconnect: serverConfig.autoReconnect !== false
            };

            this.servers.set(server.name, server);
            await this.connectServerWithRetry(server);
        }

        this.outputChannel.appendLine(`=== Initialization Complete: ${this.getConnectedServersCount()}/${this.servers.size} servers connected ===`);
    }

    /**
     * Connect to a server with retry logic
     */
    private async connectServerWithRetry(server: MCPServer): Promise<void> {
        for (let attempt = 0; attempt < this.maxReconnectAttempts; attempt++) {
            try {
                server.connectionAttempts = attempt + 1;
                await this.connectServer(server);
                
                if (server.status === 'connected') {
                    this.outputChannel.appendLine(`✅ ${server.name} connected successfully (attempt ${attempt + 1})`);
                    return;
                }
            } catch (error) {
                server.lastError = error instanceof Error ? error.message : String(error);
                this.outputChannel.appendLine(`❌ ${server.name} connection failed (attempt ${attempt + 1}): ${server.lastError}`);
                
                if (attempt < this.maxReconnectAttempts - 1) {
                    this.outputChannel.appendLine(`⏳ Retrying ${server.name} in ${this.reconnectDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
                }
            }
        }
        
        server.status = 'error';
        this.outputChannel.appendLine(`💀 ${server.name} failed to connect after ${this.maxReconnectAttempts} attempts`);
    }

    /**
     * Connect to a single MCP server
     */
    private async connectServer(server: MCPServer): Promise<void> {
        server.status = 'connecting';
        this.outputChannel.appendLine(`🔌 Connecting to MCP server: ${server.name}`);
        this.outputChannel.appendLine(`   Command: ${server.command} ${server.args.join(' ')}`);

        // Start the MCP server process
        server.process = spawn(server.command, server.args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, ...server.env },
            cwd: server.cwd
        });

        if (!server.process) {
            throw new Error('Failed to start process');
        }

        // Set up process event handlers
        this.setupProcessHandlers(server);

        // Set up communication protocol
        await this.setupProtocol(server);
    }

    /**
     * Set up process event handlers
     */
    private setupProcessHandlers(server: MCPServer): void {
        if (!server.process) {return;}

        server.process.on('error', (error) => {
            this.outputChannel.appendLine(`💥 Process error for ${server.name}: ${error.message}`);
            server.status = 'error';
            server.lastError = error.message;
        });

        server.process.on('exit', (code, signal) => {
            this.outputChannel.appendLine(`👋 Process exited for ${server.name}: code=${code}, signal=${signal}`);
            server.status = 'disconnected';
            
            // Auto-reconnect if enabled and not manually disconnected
            if (server.autoReconnect && code !== 0) {
                setTimeout(() => {
                    if (server.status === 'disconnected') {
                        this.outputChannel.appendLine(`🔄 Auto-reconnecting ${server.name}...`);
                        this.connectServerWithRetry(server);
                    }
                }, this.reconnectDelay);
            }
        });

        server.process.on('spawn', () => {
            this.outputChannel.appendLine(`🚀 Process spawned for ${server.name} (PID: ${server.process?.pid})`);
        });
    }

    /**
     * Set up JSON-RPC communication protocol
     */
    private async setupProtocol(server: MCPServer): Promise<void> {
        if (!server.process) {
            throw new Error('No process available');
        }

        server.status = 'initializing';
        let buffer = '';

        // Handle stdout messages
        server.process.stdout?.on('data', (data) => {
            buffer += data.toString();
            this.processBuffer(server, buffer);
            buffer = this.extractCompleteMessages(buffer);
        });

        // Handle stderr for debugging
        server.process.stderr?.on('data', (data) => {
            const errorOutput = data.toString().trim();
            if (errorOutput) {
                this.outputChannel.appendLine(`🔍 ${server.name} stderr: ${errorOutput}`);
            }
        });

        // Send initialization request
        await this.sendInitializationMessage(server);
    }

    /**
     * Process JSON-RPC buffer and extract complete messages
     */
    private processBuffer(server: MCPServer, buffer: string): void {
        const lines = buffer.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
                try {
                    const message = JSON.parse(line);
                    this.handleMCPMessage(server, message);
                } catch (error) {
                    this.outputChannel.appendLine(`❌ Failed to parse message from ${server.name}: ${line}`);
                    this.outputChannel.appendLine(`   Parse error: ${error}`);
                }
            }
        }
    }

    /**
     * Extract complete messages from buffer
     */
    private extractCompleteMessages(buffer: string): string {
        const lines = buffer.split('\n');
        return lines[lines.length - 1] || '';
    }

    /**
     * Send initialization message
     */
    private async sendInitializationMessage(server: MCPServer): Promise<void> {
        const initMessage = {
            jsonrpc: '2.0',
            id: this.getNextMessageId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {},
                    resources: { subscribe: true },
                    prompts: {}
                },
                clientInfo: {
                    name: 'Cuovare Enhanced',
                    version: '1.0.0'
                }
            }
        };

        await this.sendMCPMessage(server, initMessage);
    }

    /**
     * Send JSON-RPC message to server
     */
    private async sendMCPMessage(server: MCPServer, message: any): Promise<void> {
        if (!server.process?.stdin) {
            throw new Error(`Server process not available for ${server.name}`);
        }

        const jsonMessage = JSON.stringify(message) + '\n';
        
        try {
            server.process.stdin.write(jsonMessage);
            this.outputChannel.appendLine(`📤 Sent to ${server.name}: ${message.method || 'response'} (id: ${message.id})`);
        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to send message to ${server.name}: ${error}`);
            throw error;
        }
    }

    /**
     * Handle incoming MCP messages
     */
    private handleMCPMessage(server: MCPServer, message: any): void {
        this.outputChannel.appendLine(`📥 Received from ${server.name}: ${message.method || 'response'} (id: ${message.id})`);

        // Handle responses to our requests
        if (message.id && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id)!;
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error.message || 'Unknown MCP error'));
            } else {
                pending.resolve(message.result);
            }
            return;
        }

        // Handle specific methods
        switch (message.method) {
            case 'tools/list':
                this.handleToolsList(server, message);
                break;
            case 'resources/list':
                this.handleResourcesList(server, message);
                break;
            case 'prompts/list':
                this.handlePromptsList(server, message);
                break;
            default:
                if (message.id === 1 && message.result) {
                    this.handleInitializationComplete(server, message);
                }
                break;
        }
    }

    /**
     * Handle initialization completion
     */
    private async handleInitializationComplete(server: MCPServer, message: any): Promise<void> {
        server.status = 'connected';
        server.capabilities = message.result.capabilities;
        server.version = message.result.serverInfo?.version;
        server.lastHeartbeat = Date.now();

        this.outputChannel.appendLine(`🎉 ${server.name} initialized successfully`);
        this.outputChannel.appendLine(`   Version: ${server.version || 'unknown'}`);
        this.outputChannel.appendLine(`   Capabilities: ${JSON.stringify(server.capabilities)}`);

        // Request available tools, resources, and prompts
        await this.requestServerInventory(server);
    }

    /**
     * Request server inventory (tools, resources, prompts)
     */
    private async requestServerInventory(server: MCPServer): Promise<void> {
        try {
            // Request tools
            if (server.capabilities?.tools) {
                await this.sendMCPMessage(server, {
                    jsonrpc: '2.0',
                    id: this.getNextMessageId(),
                    method: 'tools/list'
                });
            }

            // Request resources
            if (server.capabilities?.resources) {
                await this.sendMCPMessage(server, {
                    jsonrpc: '2.0',
                    id: this.getNextMessageId(),
                    method: 'resources/list'
                });
            }

            // Request prompts
            if (server.capabilities?.prompts) {
                await this.sendMCPMessage(server, {
                    jsonrpc: '2.0',
                    id: this.getNextMessageId(),
                    method: 'prompts/list'
                });
            }
        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to request inventory from ${server.name}: ${error}`);
        }
    }

    /**
     * Handle tools list response
     */
    private handleToolsList(server: MCPServer, message: any): void {
        if (message.result?.tools) {
            server.tools = message.result.tools.map((tool: any) => ({
                ...tool,
                serverName: server.name
            }));
            
            this.updateToolRegistry(server);
            this.outputChannel.appendLine(`🛠️  Loaded ${server.tools?.length || 0} tools from ${server.name}:`);
            
            server.tools?.forEach(tool => {
                this.outputChannel.appendLine(`   - ${tool.name}: ${tool.description}`);
            });
        }
    }

    /**
     * Handle resources list response
     */
    private handleResourcesList(server: MCPServer, message: any): void {
        if (message.result?.resources) {
            server.resources = message.result.resources;
            this.outputChannel.appendLine(`📁 Loaded ${server.resources?.length || 0} resources from ${server.name}`);
        }
    }

    /**
     * Handle prompts list response
     */
    private handlePromptsList(server: MCPServer, message: any): void {
        if (message.result?.prompts) {
            server.prompts = message.result.prompts;
            this.outputChannel.appendLine(`💬 Loaded ${server.prompts?.length || 0} prompts from ${server.name}`);
        }
    }

    /**
     * Update tool registry with server tools
     */
    private updateToolRegistry(server: MCPServer): void {
        if (!server.tools) {return;}

        for (const tool of server.tools) {
            const existingEntry = this.toolRegistry.get(tool.name);
            
            if (existingEntry) {
                // Update existing entry
                existingEntry.tool = tool;
                existingEntry.serverName = server.name;
            } else {
                // Create new entry
                this.toolRegistry.set(tool.name, {
                    tool,
                    serverName: server.name,
                    usageCount: 0,
                    averageExecutionTime: 0
                });
            }
        }
    }

    /**
     * Get all available tools from all connected servers
     */
    public getAvailableTools(): MCPTool[] {
        const tools: MCPTool[] = [];
        
        for (const server of this.servers.values()) {
            if (server.status === 'connected' && server.tools) {
                tools.push(...server.tools);
            }
        }

        return tools;
    }

    /**
     * Get tools formatted for AI providers
     */
    public getToolsForAIProvider(): AIProviderToolSchema[] {
        const tools = this.getAvailableTools();
        
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: {
                type: 'object',
                properties: tool.inputSchema?.properties || {},
                required: tool.inputSchema?.required || []
            }
        }));
    }

    /**
     * Call a tool on the appropriate server
     */
    public async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        const startTime = Date.now();
        
        // Find the server that has this tool
        const registryEntry = this.toolRegistry.get(toolCall.name);
        if (!registryEntry) {
            return {
                content: `Tool "${toolCall.name}" not found in registry`,
                isError: true,
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };
        }

        const server = this.servers.get(registryEntry.serverName);
        if (!server || server.status !== 'connected') {
            return {
                content: `Server "${registryEntry.serverName}" not connected`,
                isError: true,
                metadata: {
                    serverName: registryEntry.serverName,
                    executionTime: Date.now() - startTime
                }
            };
        }

        try {
            const requestId = this.getNextMessageId();
            
            // Create promise for response
            const resultPromise = new Promise<any>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Tool call timeout for "${toolCall.name}"`));
                }, this.requestTimeout);

                this.pendingRequests.set(requestId, { resolve, reject, timeout });
            });

            // Send tool call request
            await this.sendMCPMessage(server, {
                jsonrpc: '2.0',
                id: requestId,
                method: 'tools/call',
                params: {
                    name: toolCall.name,
                    arguments: toolCall.arguments
                }
            });

            // Wait for response
            const result = await resultPromise;
            const executionTime = Date.now() - startTime;

            // Update registry stats
            registryEntry.usageCount++;
            registryEntry.lastUsed = Date.now();
            registryEntry.averageExecutionTime = 
                (registryEntry.averageExecutionTime * (registryEntry.usageCount - 1) + executionTime) / registryEntry.usageCount;

            this.outputChannel.appendLine(`✅ Tool executed: ${toolCall.name} (${executionTime}ms)`);

            return {
                content: result.content || result,
                isError: false,
                metadata: {
                    serverName: server.name,
                    executionTime
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.outputChannel.appendLine(`❌ Tool execution failed: ${toolCall.name} - ${errorMessage}`);
            
            return {
                content: errorMessage,
                isError: true,
                metadata: {
                    serverName: server.name,
                    executionTime
                }
            };
        }
    }

    /**
     * Get server that provides a specific tool
     */
    public getServerForTool(toolName: string): MCPServer | undefined {
        const registryEntry = this.toolRegistry.get(toolName);
        return registryEntry ? this.servers.get(registryEntry.serverName) : undefined;
    }

    /**
     * Get server status for all servers
     */
    public getServerStatus(): Map<string, { status: string; tools: number; lastError?: string }> {
        const status = new Map();
        
        for (const [name, server] of this.servers) {
            status.set(name, {
                status: server.status,
                tools: server.tools?.length || 0,
                lastError: server.lastError
            });
        }

        return status;
    }

    /**
     * Get connected servers count
     */
    public getConnectedServersCount(): number {
        return Array.from(this.servers.values()).filter(s => s.status === 'connected').length;
    }

    /**
     * Get tool registry for debugging
     */
    public getToolRegistry(): Map<string, ToolRegistryEntry> {
        return new Map(this.toolRegistry);
    }

    /**
     * Start heartbeat monitoring
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            
            for (const server of this.servers.values()) {
                if (server.status === 'connected' && server.lastHeartbeat) {
                    const timeSinceHeartbeat = now - server.lastHeartbeat;
                    
                    if (timeSinceHeartbeat > 60000) { // 1 minute
                        this.outputChannel.appendLine(`💔 Heartbeat timeout for ${server.name}`);
                        server.status = 'error';
                        server.lastError = 'Heartbeat timeout';
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Set up event handlers
     */
    private setupEventHandlers(): void {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('cuovare.mcpServers')) {
                this.outputChannel.appendLine('🔄 MCP configuration changed, reinitializing servers...');
                await this.refreshConfiguration();
            }
        });
    }

    /**
     * Validate server configuration
     */
    private validateServerConfig(config: any): boolean {
        return !!(config && config.name && config.command);
    }

    /**
     * Get next message ID
     */
    private getNextMessageId(): number {
        return this.messageIdCounter++;
    }

    /**
     * Disconnect all servers
     */
    private async disconnectAllServers(): Promise<void> {
        for (const server of this.servers.values()) {
            if (server.process) {
                server.process.kill('SIGTERM');
            }
        }
        
        this.servers.clear();
        this.toolRegistry.clear();
        this.pendingRequests.clear();
    }

    /**
     * Refresh configuration and reinitialize servers
     */
    public async refreshConfiguration(): Promise<void> {
        this.outputChannel.appendLine('🔄 Refreshing MCP configuration...');
        
        await this.disconnectAllServers();
        await this.initializeServers();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.disconnectAllServers();
        this.outputChannel.dispose();
    }
}

// Manager is now exported as MCPManager class above

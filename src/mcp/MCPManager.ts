import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';

export interface MCPServer {
    name: string;
    command: string;
    args: string[];
    process?: ChildProcess;
    socket?: WebSocket;
    tools?: MCPTool[];
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any;
}

export interface MCPToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface MCPToolResult {
    content: string;
    isError?: boolean;
}

export class MCPManager {
    private servers: Map<string, MCPServer> = new Map();
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Cuovare MCP');
    }

    public async initializeServers(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const serverConfigs = config.get<any[]>('mcpServers', []);

        this.outputChannel.appendLine('Initializing MCP servers...');

        for (const serverConfig of serverConfigs) {
            if (!serverConfig.name || !serverConfig.command) {
                this.outputChannel.appendLine(`Skipping invalid server config: ${JSON.stringify(serverConfig)}`);
                continue;
            }

            const server: MCPServer = {
                name: serverConfig.name,
                command: serverConfig.command,
                args: serverConfig.args || [],
                status: 'disconnected'
            };

            this.servers.set(server.name, server);
            await this.connectServer(server);
        }
    }

    private async connectServer(server: MCPServer): Promise<void> {
        try {
            server.status = 'connecting';
            this.outputChannel.appendLine(`Connecting to MCP server: ${server.name}`);

            // Start the MCP server process
            server.process = spawn(server.command, server.args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            if (!server.process) {
                throw new Error('Failed to start process');
            }

            // Handle process events
            server.process.on('error', (error) => {
                this.outputChannel.appendLine(`Process error for ${server.name}: ${error.message}`);
                server.status = 'error';
            });

            server.process.on('exit', (code) => {
                this.outputChannel.appendLine(`Process exited for ${server.name} with code: ${code}`);
                server.status = 'disconnected';
            });

            // Set up communication protocol
            await this.setupProtocol(server);
            
        } catch (error) {
            this.outputChannel.appendLine(`Failed to connect to ${server.name}: ${error}`);
            server.status = 'error';
        }
    }

    private async setupProtocol(server: MCPServer): Promise<void> {
        if (!server.process) {
            throw new Error('No process available');
        }

        // MCP uses JSON-RPC over stdio
        let buffer = '';

        server.process.stdout?.on('data', (data) => {
            buffer += data.toString();
            
            // Process complete JSON-RPC messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line);
                        this.handleMCPMessage(server, message);
                    } catch (error) {
                        this.outputChannel.appendLine(`Failed to parse message from ${server.name}: ${line}`);
                    }
                }
            }
        });

        server.process.stderr?.on('data', (data) => {
            this.outputChannel.appendLine(`${server.name} stderr: ${data}`);
        });

        // Send initialization request
        await this.sendMCPMessage(server, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: 'Cuovare',
                    version: '1.0.0'
                }
            }
        });
    }

    private async sendMCPMessage(server: MCPServer, message: any): Promise<void> {
        if (!server.process?.stdin) {
            throw new Error('Server process not available');
        }

        const jsonMessage = JSON.stringify(message) + '\n';
        server.process.stdin.write(jsonMessage);
    }

    private handleMCPMessage(server: MCPServer, message: any): void {
        if (message.method === 'tools/list') {
            // Handle tools list response
            if (message.result?.tools) {
                server.tools = message.result.tools;
                this.outputChannel.appendLine(`Loaded ${server.tools?.length || 0} tools from ${server.name}`);
            }
        } else if (message.id === 1 && message.result) {
            // Initialization complete
            server.status = 'connected';
            this.outputChannel.appendLine(`Successfully connected to ${server.name}`);
            
            // Request available tools
            this.sendMCPMessage(server, {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list'
            });
        }
    }

    public getAvailableTools(): MCPTool[] {
        const tools: MCPTool[] = [];
        
        for (const server of this.servers.values()) {
            if (server.status === 'connected' && server.tools && Array.isArray(server.tools)) {
                tools.push(...server.tools);
            }
        }

        return tools;
    }

    public async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        // Find the server that has this tool
        let targetServer: MCPServer | undefined;
        
        for (const server of this.servers.values()) {
            if (server.status === 'connected' && server.tools && Array.isArray(server.tools) && server.tools.some(t => t.name === toolCall.name)) {
                targetServer = server;
                break;
            }
        }

        if (!targetServer) {
            return {
                content: `Tool "${toolCall.name}" not found or server not connected`,
                isError: true
            };
        }

        try {
            const requestId = Math.floor(Math.random() * 10000);
            
            await this.sendMCPMessage(targetServer, {
                jsonrpc: '2.0',
                id: requestId,
                method: 'tools/call',
                params: {
                    name: toolCall.name,
                    arguments: toolCall.arguments
                }
            });

            // Wait for response (simplified - in real implementation, should use proper promise handling)
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({
                        content: `Tool call timeout for "${toolCall.name}"`,
                        isError: true
                    });
                }, 10000);

                // This is a simplified response handler
                const originalHandler = this.handleMCPMessage.bind(this);
                this.handleMCPMessage = (server, message) => {
                    if (message.id === requestId) {
                        clearTimeout(timeout);
                        this.handleMCPMessage = originalHandler;
                        
                        if (message.result) {
                            resolve({
                                content: JSON.stringify(message.result, null, 2)
                            });
                        } else {
                            resolve({
                                content: message.error?.message || 'Unknown error',
                                isError: true
                            });
                        }
                    } else {
                        originalHandler(server, message);
                    }
                };
            });

        } catch (error) {
            return {
                content: `Error calling tool "${toolCall.name}": ${error}`,
                isError: true
            };
        }
    }

    public getServerStatus(): Map<string, string> {
        const status = new Map<string, string>();
        
        for (const [name, server] of this.servers) {
            status.set(name, server.status);
        }

        return status;
    }

    public async refreshConfiguration(): Promise<void> {
        this.outputChannel.appendLine('Refreshing MCP configuration...');
        
        // Disconnect existing servers
        for (const server of this.servers.values()) {
            if (server.process) {
                server.process.kill();
            }
        }
        
        this.servers.clear();
        
        // Reinitialize with new configuration
        await this.initializeServers();
    }

    public dispose(): void {
        for (const server of this.servers.values()) {
            if (server.process) {
                server.process.kill();
            }
        }
        
        this.outputChannel.dispose();
    }
}

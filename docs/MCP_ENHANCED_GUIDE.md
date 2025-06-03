# Enhanced Model Context Protocol (MCP) Implementation Guide

## Overview

Cuovare now features a completely overhauled and massively enhanced MCP (Model Context Protocol) implementation with comprehensive tool use support across all AI providers. This guide covers the new architecture, features, and usage.

## Key Features

### 🔧 **Universal Tool Support**
- **OpenAI**: Full function calling with tools and tool_choice
- **Anthropic**: Native tool use with input_schema validation
- **Groq**: Complete function calling support
- **Grok**: Basic tool descriptions in system prompts
- **OpenRouter**: Model-specific tool support detection

### 🚀 **Enhanced MCP Architecture**
- **Tool Registry**: Centralized tool discovery and management
- **Execution Engine**: Parallel tool execution with timeouts and retries
- **Health Monitoring**: Real-time server status and heartbeat monitoring
- **Auto-Reconnection**: Intelligent server recovery with exponential backoff

### 🎯 **Advanced Tool Execution**
- **Parallel Execution**: Run multiple tools simultaneously (configurable limit)
- **Smart Validation**: Input schema validation before execution
- **Result Formatting**: Intelligent formatting based on tool type and content
- **Error Handling**: Comprehensive error recovery and user feedback

## Architecture Overview

```mermaid
graph TB
    A[ChatViewProvider] --> B[AIProviderManager]
    A --> C[ToolExecutionEngine]
    C --> D[MCPManager]
    D --> E[MCP Servers]
    
    B --> F[OpenAI Function Calling]
    B --> G[Anthropic Tool Use]
    B --> H[Groq Function Calling]
    B --> I[Grok System Prompts]
    B --> J[OpenRouter Smart Detection]
    
    C --> K[Tool Registry]
    C --> L[Execution Queue]
    C --> M[Result Formatter]
    
    D --> N[Server Management]
    D --> O[Health Monitoring]
    D --> P[Auto Reconnection]
```

## Configuration

### Basic MCP Server Configuration

```json
{
  "cuovare.mcpServers": [
    {
      "name": "Filesystem Server",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
      "autoReconnect": true
    },
    {
      "name": "Database Server",
      "command": "python",
      "args": ["-m", "mcp_server_postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      },
      "cwd": "/path/to/server",
      "autoReconnect": true
    },
    {
      "name": "Git Server",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git", "--repository", "/path/to/repo"]
    }
  ]
}
```

### Tool Execution Settings

```json
{
  "cuovare.toolsEnabled": true,
  "cuovare.autoExecuteTools": true,
  "cuovare.maxConcurrentToolExecutions": 5,
  "cuovare.toolExecutionTimeout": 30000
}
```

## Tool Support by Provider

### OpenAI (Full Support)
```typescript
// Automatic function calling with tools array
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read file contents",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {"type": "string"}
          },
          "required": ["path"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Anthropic (Native Tool Use)
```typescript
// Native tool use with input_schema
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read file contents",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {"type": "string"}
        },
        "required": ["path"]
      }
    }
  ]
}
```

### Groq (Function Calling)
```typescript
// Same as OpenAI format
{
  "tools": [...],
  "tool_choice": "auto"
}
```

### Grok (System Prompt Integration)
```typescript
// Tools described in system message
{
  "messages": [
    {
      "role": "system",
      "content": "You have access to these tools:\nread_file: Read file contents\nTo use: USE_TOOL:read_file:{\"path\":\"file.txt\"}"
    }
  ]
}
```

### OpenRouter (Smart Detection)
```typescript
// Automatic detection of tool-capable models
const toolSupportedModels = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'openai/gpt-4-turbo'
];
```

## Enhanced Features

### 1. Tool Registry & Discovery

```typescript
interface ToolRegistryEntry {
  tool: MCPTool;
  serverName: string;
  lastUsed?: number;
  usageCount: number;
  averageExecutionTime: number;
}
```

- **Automatic Discovery**: Tools are automatically discovered from connected servers
- **Usage Tracking**: Tracks tool usage patterns and performance
- **Server Mapping**: Maps tools to their originating servers
- **Performance Metrics**: Tracks execution times and success rates

### 2. Advanced Tool Execution

```typescript
interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, any>;
  requestId: string;
  providerName: string;
  conversationId: string;
}
```

**Features:**
- **Input Validation**: Schema-based argument validation
- **Timeout Management**: Configurable execution timeouts
- **Parallel Execution**: Multiple tools run simultaneously
- **Error Recovery**: Comprehensive error handling and retry logic

### 3. Server Health Monitoring

```typescript
interface MCPServer {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'initializing';
  capabilities?: MCPCapabilities;
  lastError?: string;
  connectionAttempts: number;
  lastHeartbeat?: number;
  autoReconnect?: boolean;
}
```

**Monitoring Features:**
- **Real-time Status**: Live server connection status
- **Heartbeat Monitoring**: Detects server disconnections
- **Auto-reconnection**: Intelligent reconnection with backoff
- **Error Logging**: Detailed error reporting and debugging

### 4. Intelligent Result Formatting

```typescript
interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  metadata?: {
    serverName?: string;
    warnings?: string[];
  };
}
```

**Formatting Features:**
- **Content Type Detection**: Automatically detects file types and formats
- **Language Detection**: Smart language detection for code blocks
- **JSON Formatting**: Pretty-prints JSON responses
- **Error Formatting**: User-friendly error messages

## API Reference

### MCPManager Methods

```typescript
class MCPManager {
  // Server Management
  async initializeServers(): Promise<void>
  async refreshConfiguration(): Promise<void>
  getServerStatus(): Map<string, ServerStatus>
  getConnectedServersCount(): number
  
  // Tool Management
  getAvailableTools(): MCPTool[]
  getToolsForAIProvider(): AIProviderToolSchema[]
  getServerForTool(toolName: string): MCPServer | undefined
  
  // Tool Execution
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult>
  
  // Registry Access
  getToolRegistry(): Map<string, ToolRegistryEntry>
}
```

### ToolExecutionEngine Methods

```typescript
class ToolExecutionEngine {
  // Single Tool Execution
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult>
  
  // Batch Execution
  async executeMultipleTools(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]>
  
  // Management
  cancelExecution(requestId: string): boolean
  getExecutionStats(): ExecutionStats
  updateLimits(maxConcurrent: number, timeout: number): void
}
```

### AIProviderManager Methods

```typescript
class AIProviderManager {
  // Enhanced Chat
  async sendMessage(request: ChatRequest): Promise<ChatResponse>
  
  // Tool Support
  getToolSupportedProviders(): string[]
  formatToolResult(provider: string, toolCall: ToolCall, result: any): Message
  createToolSystemMessage(tools: any[]): Message
}
```

## Usage Examples

### 1. Basic Tool Usage

```typescript
// User asks: "What files are in my project?"
// AI automatically calls filesystem tools

const request: ChatRequest = {
  messages: [
    { role: 'user', content: 'What files are in my project?' }
  ],
  enableTools: true,
  tools: mcpManager.getToolsForAIProvider()
};

const response = await aiManager.sendMessage(request);
// AI calls list_directory tool automatically
```

### 2. Manual Tool Execution

```typescript
// Execute a specific tool manually
const toolRequest: ToolExecutionRequest = {
  toolName: 'read_file',
  arguments: { path: 'package.json' },
  requestId: 'req-123',
  providerName: 'mcp',
  conversationId: 'chat-456'
};

const result = await toolEngine.executeTool(toolRequest);
console.log(result.success ? result.result : result.error);
```

### 3. Batch Tool Execution

```typescript
// Execute multiple tools in parallel
const requests: ToolExecutionRequest[] = [
  { toolName: 'read_file', arguments: { path: 'src/main.ts' }, requestId: 'req-1', providerName: 'mcp', conversationId: 'chat-1' },
  { toolName: 'read_file', arguments: { path: 'package.json' }, requestId: 'req-2', providerName: 'mcp', conversationId: 'chat-1' },
  { toolName: 'list_directory', arguments: { path: 'src' }, requestId: 'req-3', providerName: 'mcp', conversationId: 'chat-1' }
];

const results = await toolEngine.executeMultipleTools(requests);
```

## Popular MCP Servers

### Official Servers

1. **Filesystem Server**
   ```bash
   npx @modelcontextprotocol/server-filesystem /path/to/directory
   ```

2. **Git Server**
   ```bash
   npx @modelcontextprotocol/server-git --repository /path/to/repo
   ```

3. **SQLite Server**
   ```bash
   npx @modelcontextprotocol/server-sqlite --db-path /path/to/database.db
   ```

4. **Postgres Server**
   ```bash
   npx @modelcontextprotocol/server-postgres
   ```

### Community Servers

1. **Docker Server**
   ```bash
   npx mcp-server-docker
   ```

2. **AWS S3 Server**
   ```bash
   npx mcp-server-s3
   ```

3. **Kubernetes Server**
   ```bash
   npx mcp-server-kubernetes
   ```

## Troubleshooting

### Common Issues

1. **Server Connection Failures**
   - Check server command and arguments
   - Verify server dependencies are installed
   - Check environment variables and working directory
   - Review MCP Enhanced output channel for errors

2. **Tool Execution Timeouts**
   - Increase `cuovare.toolExecutionTimeout` setting
   - Check if server is responding to heartbeats
   - Verify tool arguments are valid

3. **Provider Tool Support**
   - Not all providers support all tool features
   - Grok has limited tool support (system prompts only)
   - OpenRouter tool support varies by model

### Debug Information

- **MCP Enhanced Output Channel**: Detailed server logs and debugging
- **Extension Developer Tools**: Console logs for AI provider interactions
- **Server Status UI**: Real-time server health in chat interface

## Performance Considerations

### Optimization Settings

```json
{
  "cuovare.maxConcurrentToolExecutions": 3,  // Reduce for slower systems
  "cuovare.toolExecutionTimeout": 15000,     // Shorter timeout for faster responses
  "cuovare.autoExecuteTools": false          // Manual approval for tool execution
}
```

### Best Practices

1. **Limit Concurrent Executions**: Keep under 5 for most systems
2. **Use Appropriate Timeouts**: 15-30 seconds for most tools
3. **Monitor Server Health**: Check server status regularly
4. **Optimize Tool Arguments**: Validate inputs before execution

## Security Considerations

### Server Security

- **Sandbox Servers**: Run MCP servers in isolated environments
- **Validate Arguments**: Always validate tool arguments
- **Limit File Access**: Restrict filesystem server to specific directories
- **Monitor Execution**: Track tool usage and execution patterns

### Tool Permissions

- **Dangerous Tools**: Mark potentially dangerous tools in schema
- **User Confirmation**: Require confirmation for destructive operations
- **Audit Logging**: Log all tool executions for security review

## Future Enhancements

### Planned Features

1. **Streaming Tool Execution**: Real-time tool output streaming
2. **Tool Composition**: Chain multiple tools together
3. **Custom Tool Validation**: User-defined validation rules
4. **Tool Marketplace**: Community tool sharing
5. **Advanced Analytics**: Detailed usage and performance analytics

---

*This enhanced MCP implementation represents the cutting edge of AI tool integration, providing seamless, secure, and powerful tool execution across all major AI providers.*

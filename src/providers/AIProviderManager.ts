import * as vscode from 'vscode';
import axios from 'axios';

export interface AIProvider {
    name: string;
    baseUrl: string;
    models: string[];
    supportsTools: boolean;
    headers: (apiKey: string) => Record<string, string>;
    formatRequest: (messages: Message[], model: string, tools?: any[], toolChoice?: any) => any;
    parseResponse: (response: any) => string;
    parseToolCalls?: (response: any) => ToolCall[];
    formatToolResult?: (toolCall: ToolCall, result: any) => Message;
    requiresSystemPrompt?: boolean;
}

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolResult {
    tool_call_id: string;
    content: string;
    isError?: boolean;
}

export interface ChatResponse {
    content: string;
    model: string;
    provider: string;
    toolCalls?: ToolCall[];
    requiresToolExecution?: boolean;
}

export interface ChatRequest {
    messages: Message[];
    provider?: string;
    model?: string;
    tools?: any[];
    toolChoice?: any;
    enableTools?: boolean;
}

export class AIProviderManager {
    private providers: Map<string, AIProvider> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeProviders();
    }

    private initializeProviders() {
        // OpenAI Provider - Full tool support
        this.providers.set('openai', {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            supportsTools: true,
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string, tools?: any[], toolChoice?: any) => {
                const request: any = {
                    model,
                    messages: messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
                        ...(msg.name && { name: msg.name })
                    })),
                    stream: false,
                    temperature: 0.7
                };

                if (tools && tools.length > 0) {
                    request.tools = tools.map(tool => ({
                        type: 'function',
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters
                        }
                    }));

                    if (toolChoice) {
                        request.tool_choice = toolChoice;
                    }
                }

                return request;
            },
            parseResponse: (response: any) => {
                return response.data.choices[0].message.content || '';
            },
            parseToolCalls: (response: any) => {
                const message = response.data.choices[0].message;
                return message.tool_calls || [];
            },
            formatToolResult: (toolCall: ToolCall, result: any) => ({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            })
        });

        // Anthropic Provider - Tool support
        this.providers.set('anthropic', {
            name: 'Anthropic',
            baseUrl: 'https://api.anthropic.com/v1/messages',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
            supportsTools: true,
            requiresSystemPrompt: true,
            headers: (apiKey: string) => ({
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }),
            formatRequest: (messages: Message[], model: string, tools?: any[]) => {
                const systemMessages = messages.filter(m => m.role === 'system');
                const conversationMessages = messages.filter(m => m.role !== 'system');

                const request: any = {
                    model,
                    max_tokens: 4096,
                    messages: conversationMessages.map(msg => {
                        if (msg.role === 'tool') {
                            return {
                                role: 'user',
                                content: `Tool "${msg.name}" returned: ${msg.content}`
                            };
                        }
                        return {
                            role: msg.role,
                            content: msg.content
                        };
                    }),
                    system: systemMessages.map(m => m.content).join('\n') || ''
                };

                if (tools && tools.length > 0) {
                    request.tools = tools.map(tool => ({
                        name: tool.name,
                        description: tool.description,
                        input_schema: tool.parameters
                    }));
                }

                return request;
            },
            parseResponse: (response: any) => {
                if (response.data.content) {
                    return response.data.content.map((block: any) => block.text || '').join('');
                }
                return '';
            },
            parseToolCalls: (response: any) => {
                const toolUses = response.data.content?.filter((block: any) => block.type === 'tool_use') || [];
                return toolUses.map((use: any) => ({
                    id: use.id,
                    type: 'function',
                    function: {
                        name: use.name,
                        arguments: JSON.stringify(use.input)
                    }
                }));
            },
            formatToolResult: (toolCall: ToolCall, result: any) => ({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            })
        });

        // Groq Provider - Tool support
        this.providers.set('groq', {
            name: 'Groq',
            baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
            models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
            supportsTools: true,
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string, tools?: any[], toolChoice?: any) => {
                const request: any = {
                    model,
                    messages: messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
                        ...(msg.name && { name: msg.name })
                    })),
                    stream: false,
                    temperature: 0.7
                };

                if (tools && tools.length > 0) {
                    request.tools = tools.map(tool => ({
                        type: 'function',
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters
                        }
                    }));

                    if (toolChoice) {
                        request.tool_choice = toolChoice;
                    }
                }

                return request;
            },
            parseResponse: (response: any) => {
                return response.data.choices[0].message.content || '';
            },
            parseToolCalls: (response: any) => {
                const message = response.data.choices[0].message;
                return message.tool_calls || [];
            },
            formatToolResult: (toolCall: ToolCall, result: any) => ({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            })
        });

        // Grok Provider - Basic tool support
        this.providers.set('grok', {
            name: 'Grok',
            baseUrl: 'https://api.x.ai/v1/chat/completions',
            models: ['grok-2-1212', 'grok-2-vision-1212', 'grok-beta', 'grok-vision-beta'],
            supportsTools: false, // Limited tool support for now
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string, tools?: any[]) => {
                const request: any = {
                    model,
                    messages: messages.filter(m => m.role !== 'tool').map(msg => ({
                        role: msg.role,
                        content: msg.content
                    })),
                    stream: false,
                    temperature: 0.7
                };

                // Add tool descriptions to system prompt if tools provided
                if (tools && tools.length > 0) {
                    const toolDescriptions = tools.map(tool => 
                        `${tool.name}: ${tool.description}`
                    ).join('\n');
                    
                    const systemMessage = {
                        role: 'system',
                        content: `You have access to the following tools:\n${toolDescriptions}\n\nTo use a tool, respond with: USE_TOOL:tool_name:{"arg1":"value1","arg2":"value2"}`
                    };
                    
                    request.messages.unshift(systemMessage);
                }

                return request;
            },
            parseResponse: (response: any) => {
                return response.data.choices[0].message.content || '';
            }
        });

        // OpenRouter Provider - Tool support varies by model
        this.providers.set('openrouter', {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
            models: [
                'anthropic/claude-3.5-sonnet',
                'openai/gpt-4o',
                'google/gemini-pro-1.5',
                'meta-llama/llama-3.2-90b-vision-instruct'
            ],
            supportsTools: true,
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/cuovare/vscode-extension',
                'X-Title': 'Cuovare VSCode Extension'
            }),
            formatRequest: (messages: Message[], model: string, tools?: any[], toolChoice?: any) => {
                const request: any = {
                    model,
                    messages: messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
                        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
                        ...(msg.name && { name: msg.name })
                    })),
                    stream: false,
                    temperature: 0.7
                };

                // Only add tools for models that support them
                if (tools && tools.length > 0 && this.modelSupportsTools(model)) {
                    request.tools = tools.map(tool => ({
                        type: 'function',
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters
                        }
                    }));

                    if (toolChoice) {
                        request.tool_choice = toolChoice;
                    }
                }

                return request;
            },
            parseResponse: (response: any) => {
                return response.data.choices[0].message.content || '';
            },
            parseToolCalls: (response: any) => {
                const message = response.data.choices[0].message;
                return message.tool_calls || [];
            },
            formatToolResult: (toolCall: ToolCall, result: any) => ({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            })
        });
    }

    /**
     * Check if a specific model supports tools
     */
    private modelSupportsTools(model: string): boolean {
        const toolSupportedModels = [
            'anthropic/claude-3.5-sonnet',
            'openai/gpt-4o',
            'openai/gpt-4-turbo'
        ];
        return toolSupportedModels.some(supportedModel => model.includes(supportedModel));
    }

    public getProvider(name: string): AIProvider | undefined {
        return this.providers.get(name);
    }

    public getAllProviders(): Map<string, AIProvider> {
        return this.providers;
    }

    public async getAvailableProviders(): Promise<string[]> {
        const availableProviders: string[] = [];
        
        for (const provider of this.providers.keys()) {
            const apiKey = await this.getStoredApiKey(provider);
            if (apiKey && apiKey.trim() !== '') {
                availableProviders.push(provider);
            }
        }
        
        return availableProviders;
    }

    /**
     * Get providers that support tools
     */
    public getToolSupportedProviders(): string[] {
        return Array.from(this.providers.entries())
            .filter(([_, provider]) => provider.supportsTools)
            .map(([name, _]) => name);
    }

    private async getStoredApiKey(provider: string): Promise<string | undefined> {
        return await this.context.secrets.get(`cuovare.apiKey.${provider}`);
    }

    public async setApiKey(provider: string, apiKey: string): Promise<void> {
        await this.context.secrets.store(`cuovare.apiKey.${provider}`, apiKey);
    }

    public async hasApiKey(provider: string): Promise<boolean> {
        const apiKey = await this.getStoredApiKey(provider);
        return !!(apiKey && apiKey.trim() !== '');
    }

    /**
     * Enhanced sendMessage with tool support
     */
    public async sendMessage(request: ChatRequest): Promise<ChatResponse> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const defaultProvider = config.get<string>('defaultProvider', 'openai');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});

        let targetProvider = request.provider;
        
        // Provider selection logic
        if (!targetProvider) {
            if (await this.hasApiKey(defaultProvider)) {
                targetProvider = defaultProvider;
            } else {
                const availableProviders = await this.getAvailableProviders();
                if (availableProviders.length === 0) {
                    throw new Error('No AI providers configured. Please add an API key in settings.');
                }
                targetProvider = availableProviders[0];
            }
        }

        const provider = this.providers.get(targetProvider);
        if (!provider) {
            throw new Error(`Provider ${targetProvider} not found`);
        }

        const apiKey = await this.getStoredApiKey(targetProvider);
        if (!apiKey) {
            throw new Error(`No API key configured for ${provider.name}`);
        }

        const targetModel = request.model || selectedModels[targetProvider] || provider.models[0];
        
        // Handle tools
        let tools = request.tools;
        let toolChoice = request.toolChoice;
        
        if (request.enableTools && provider.supportsTools && tools && tools.length > 0) {
            // Tools are enabled and provider supports them
        } else {
            // Disable tools for this request
            tools = undefined;
            toolChoice = undefined;
        }

        const requestData = provider.formatRequest(request.messages, targetModel, tools, toolChoice);
        const headers = provider.headers(apiKey);
        
        // Enhanced logging
        console.log(`[${provider.name}] Sending request:`, {
            model: targetModel,
            toolsEnabled: !!(tools && tools.length > 0),
            toolCount: tools?.length || 0,
            messageCount: request.messages.length
        });
        
        try {
            const response = await axios.post(provider.baseUrl, requestData, { headers });
            const content = provider.parseResponse(response);
            
            // Parse tool calls if provider supports them
            let toolCalls: ToolCall[] = [];
            if (provider.parseToolCalls && tools && tools.length > 0) {
                toolCalls = provider.parseToolCalls(response);
            }

            console.log(`[${provider.name}] Response received:`, {
                contentLength: content.length,
                toolCallsCount: toolCalls.length,
                requiresToolExecution: toolCalls.length > 0
            });

            return {
                content,
                model: targetModel,
                provider: provider.name,
                toolCalls,
                requiresToolExecution: toolCalls.length > 0
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`[${provider.name}] API Error:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: provider.baseUrl
                });
                
                const errorData = error.response?.data;
                let message = error.message;
                
                if (errorData) {
                    if (errorData.error?.message) {
                        message = errorData.error.message;
                    } else if (errorData.message) {
                        message = errorData.message;
                    } else if (typeof errorData === 'string') {
                        message = errorData;
                    }
                }
                
                throw new Error(`${provider.name} API Error: ${message} (Status: ${error.response?.status})`);
            }
            throw error;
        }
    }

    /**
     * Format tool result for a specific provider
     */
    public formatToolResult(providerName: string, toolCall: ToolCall, result: any): Message | null {
        const provider = this.providers.get(providerName);
        if (!provider || !provider.formatToolResult) {
            return null;
        }
        
        return provider.formatToolResult(toolCall, result);
    }

    /**
     * Create a system message with tool descriptions for providers that need it
     */
    public createToolSystemMessage(tools: any[]): Message | null {
        if (!tools || tools.length === 0) {
            return null;
        }

        const toolDescriptions = tools.map(tool => 
            `- ${tool.name}: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters.properties, null, 2)}`
        ).join('\n\n');

        return {
            role: 'system',
            content: `You have access to the following tools:\n\n${toolDescriptions}\n\nUse these tools when appropriate to help the user. Call tools by including tool_calls in your response.`
        };
    }

    public refreshConfiguration() {
        console.log('Enhanced AI Provider configuration refreshed');
    }
}

// Manager and types are exported above

import * as vscode from 'vscode';
import axios from 'axios';

export interface AIProvider {
    name: string;
    baseUrl: string;
    models: string[];
    headers: (apiKey: string) => Record<string, string>;
    formatRequest: (messages: Message[], model: string) => any;
    parseResponse: (response: any) => string;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatResponse {
    content: string;
    model: string;
    provider: string;
}

export class AIProviderManager {
    private providers: Map<string, AIProvider> = new Map();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeProviders();
    }

    private initializeProviders() {
        // OpenAI Provider
        this.providers.set('openai', {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1/chat/completions',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string) => ({
                model,
                messages,
                stream: false,
                temperature: 0.7
            }),
            parseResponse: (response: any) => response.data.choices[0].message.content
        });

        // Anthropic Provider
        this.providers.set('anthropic', {
            name: 'Anthropic',
            baseUrl: 'https://api.anthropic.com/v1/messages',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
            headers: (apiKey: string) => ({
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }),
            formatRequest: (messages: Message[], model: string) => ({
                model,
                max_tokens: 4096,
                messages: messages.filter(m => m.role !== 'system'),
                system: messages.find(m => m.role === 'system')?.content || ''
            }),
            parseResponse: (response: any) => response.data.content[0].text
        });

        // Groq Provider
        this.providers.set('groq', {
            name: 'Groq',
            baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
            models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string) => ({
                model,
                messages,
                stream: false,
                temperature: 0.7
            }),
            parseResponse: (response: any) => response.data.choices[0].message.content
        });

        // Grok Provider (X.AI)
        this.providers.set('grok', {
            name: 'Grok',
            baseUrl: 'https://api.x.ai/v1/chat/completions',
            models: ['grok-beta', 'grok-vision-beta'],
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }),
            formatRequest: (messages: Message[], model: string) => ({
                model,
                messages,
                stream: false,
                temperature: 0.7
            }),
            parseResponse: (response: any) => response.data.choices[0].message.content
        });

        // OpenRouter Provider
        this.providers.set('openrouter', {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
            models: [
                'anthropic/claude-3.5-sonnet',
                'openai/gpt-4o',
                'google/gemini-pro-1.5',
                'meta-llama/llama-3.2-90b-vision-instruct'
            ],
            headers: (apiKey: string) => ({
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/cuovare/vscode-extension',
                'X-Title': 'Cuovare VSCode Extension'
            }),
            formatRequest: (messages: Message[], model: string) => ({
                model,
                messages,
                stream: false,
                temperature: 0.7
            }),
            parseResponse: (response: any) => response.data.choices[0].message.content
        });
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

    public async sendMessage(
        messages: Message[], 
        providerName?: string, 
        model?: string
    ): Promise<ChatResponse> {
        const config = vscode.workspace.getConfiguration('cuovare');
        const defaultProvider = config.get<string>('defaultProvider', 'openai');
        const selectedModels = config.get<Record<string, string>>('selectedModels', {});

        let targetProvider = providerName;
        
        // If no specific provider requested, use smart selection
        if (!targetProvider) {
            // Try default provider first if it has API key
            if (await this.hasApiKey(defaultProvider)) {
                targetProvider = defaultProvider;
            } else {
                // Fall back to first available provider with API key
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

        const targetModel = model || selectedModels[targetProvider] || provider.models[0];
        
        try {
            const requestData = provider.formatRequest(messages, targetModel);
            const headers = provider.headers(apiKey);

            const response = await axios.post(provider.baseUrl, requestData, { headers });
            const content = provider.parseResponse(response);

            return {
                content,
                model: targetModel,
                provider: provider.name
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(`${provider.name} API Error: ${message}`);
            }
            throw error;
        }
    }

    public refreshConfiguration() {
        // Configuration will be reloaded automatically when accessed
        console.log('AI Provider configuration refreshed');
    }
}

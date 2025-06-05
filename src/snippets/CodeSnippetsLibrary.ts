import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * AI-Curated Code Snippets Library
 * Provides intelligent, reusable code templates with AI enhancement
 */

export interface CodeSnippet {
    id: string;
    title: string;
    description: string;
    language: string;
    category: string;
    tags: string[];
    code: string;
    variables: VariableDefinition[];
    usage: number;
    rating: number;
    author: string;
    dateCreated: Date;
    dateModified: Date;
    isBuiltIn: boolean;
    frameworks: string[];
    dependencies: string[];
}

export interface VariableDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'choice' | 'file' | 'directory';
    description: string;
    defaultValue?: any;
    choices?: string[];
    required: boolean;
    placeholder?: string;
}

export interface SnippetCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    snippetCount: number;
}

export interface SnippetSearchResult {
    snippets: CodeSnippet[];
    totalResults: number;
    categories: string[];
    suggestedTags: string[];
}

export interface AISnippetSuggestion {
    snippet: CodeSnippet;
    confidence: number;
    reasoning: string;
    adaptations: string[];
}

export class CodeSnippetsLibrary {
    private static instance: CodeSnippetsLibrary;
    private snippets: Map<string, CodeSnippet> = new Map();
    private categories: Map<string, SnippetCategory> = new Map();
    private userSnippetsPath: string = '';

    private constructor() {
        this.initializeBuiltInSnippets();
        this.initializeCategories();
    }

    public static getInstance(): CodeSnippetsLibrary {
        if (!this.instance) {
            this.instance = new CodeSnippetsLibrary();
        }
        return this.instance;
    }

    /**
     * Initialize the library with workspace context
     */
    public async initialize(workspacePath?: string): Promise<void> {
        if (workspacePath) {
            this.userSnippetsPath = path.join(workspacePath, '.vscode', 'cuovare-snippets.json');
            await this.loadUserSnippets();
        }
    }

    /**
     * Search snippets with intelligent filtering
     */
    public async searchSnippets(
        query: string,
        language?: string,
        category?: string,
        tags?: string[]
    ): Promise<SnippetSearchResult> {
        let results = Array.from(this.snippets.values());

        // Language filter
        if (language) {
            results = results.filter(s => s.language === language);
        }

        // Category filter
        if (category) {
            results = results.filter(s => s.category === category);
        }

        // Tags filter
        if (tags && tags.length > 0) {
            results = results.filter(s => 
                tags.some(tag => s.tags.includes(tag))
            );
        }

        // Text search
        if (query.trim()) {
            const queryLower = query.toLowerCase();
            results = results.filter(s => 
                s.title.toLowerCase().includes(queryLower) ||
                s.description.toLowerCase().includes(queryLower) ||
                s.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
                s.code.toLowerCase().includes(queryLower)
            );
        }

        // Sort by relevance and usage
        results.sort((a, b) => {
            const aScore = this.calculateRelevanceScore(a, query);
            const bScore = this.calculateRelevanceScore(b, query);
            return bScore - aScore;
        });

        // Extract metadata
        const categories = [...new Set(results.map(s => s.category))];
        const suggestedTags = this.extractSuggestedTags(results, query);

        return {
            snippets: results.slice(0, 50), // Limit results
            totalResults: results.length,
            categories,
            suggestedTags
        };
    }

    /**
     * Get AI-powered snippet suggestions based on context
     */
    public async getAISnippetSuggestions(
        context: {
            currentFile?: string;
            language?: string;
            frameworks?: string[];
            intent?: string;
            existingCode?: string;
        }
    ): Promise<AISnippetSuggestion[]> {
        const suggestions: AISnippetSuggestion[] = [];
        
        // Analyze context intent
        const intent = this.analyzeIntent(context);
        
        // Find relevant snippets
        const relevantSnippets = this.findRelevantSnippets(context, intent);
        
        for (const snippet of relevantSnippets.slice(0, 5)) {
            const confidence = this.calculateConfidence(snippet, context);
            const reasoning = this.generateReasoning(snippet, context, intent);
            const adaptations = this.suggestAdaptations(snippet, context);
            
            suggestions.push({
                snippet,
                confidence,
                reasoning,
                adaptations
            });
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Create a new snippet from code selection
     */
    public async createSnippetFromCode(
        code: string,
        language: string,
        context?: {
            title?: string;
            description?: string;
            category?: string;
            tags?: string[];
        }
    ): Promise<CodeSnippet> {
        // AI-enhanced metadata extraction
        const metadata = await this.extractSnippetMetadata(code, language);
        
        const snippet: CodeSnippet = {
            id: this.generateSnippetId(),
            title: context?.title || metadata.title,
            description: context?.description || metadata.description,
            language,
            category: context?.category || metadata.category,
            tags: [...(context?.tags || []), ...metadata.suggestedTags],
            code: this.cleanCode(code),
            variables: this.extractVariables(code),
            usage: 0,
            rating: 0,
            author: 'User',
            dateCreated: new Date(),
            dateModified: new Date(),
            isBuiltIn: false,
            frameworks: metadata.frameworks,
            dependencies: metadata.dependencies
        };

        await this.saveSnippet(snippet);
        return snippet;
    }

    /**
     * Generate code from snippet with variable substitution
     */
    public async generateCode(
        snippet: CodeSnippet,
        variables: Map<string, any> = new Map()
    ): Promise<string> {
        let code = snippet.code;

        // Substitute variables
        for (const variable of snippet.variables) {
            const value = variables.get(variable.name) || variable.defaultValue || variable.placeholder || '';
            const pattern = new RegExp(`\\$\\{${variable.name}\\}`, 'g');
            code = code.replace(pattern, String(value));
        }

        // Increment usage
        snippet.usage++;
        await this.saveSnippet(snippet);

        return code;
    }

    /**
     * Get snippet categories
     */
    public getCategories(): SnippetCategory[] {
        return Array.from(this.categories.values());
    }

    /**
     * Get popular snippets
     */
    public getPopularSnippets(limit: number = 10): CodeSnippet[] {
        return Array.from(this.snippets.values())
            .sort((a, b) => b.usage - a.usage)
            .slice(0, limit);
    }

    /**
     * Get recent snippets
     */
    public getRecentSnippets(limit: number = 10): CodeSnippet[] {
        return Array.from(this.snippets.values())
            .sort((a, b) => b.dateModified.getTime() - a.dateModified.getTime())
            .slice(0, limit);
    }

    /**
     * Export snippets to VS Code snippets format
     */
    public async exportToVSCodeSnippets(language: string): Promise<string> {
        const snippets = Array.from(this.snippets.values())
            .filter(s => s.language === language);

        const vsCodeSnippets: any = {};

        for (const snippet of snippets) {
            vsCodeSnippets[snippet.title] = {
                prefix: snippet.id,
                body: snippet.code.split('\n'),
                description: snippet.description,
                scope: language
            };
        }

        return JSON.stringify(vsCodeSnippets, null, 2);
    }

    /**
     * Import snippets from VS Code snippets file
     */
    public async importFromVSCodeSnippets(snippetsJson: string, language: string): Promise<number> {
        try {
            const vsCodeSnippets = JSON.parse(snippetsJson);
            let importedCount = 0;

            for (const [name, data] of Object.entries(vsCodeSnippets as any)) {
                const snippetData = data as any;
                const snippet: CodeSnippet = {
                    id: this.generateSnippetId(),
                    title: name,
                    description: snippetData.description || '',
                    language,
                    category: 'Imported',
                    tags: ['imported', 'vscode'],
                    code: Array.isArray(snippetData.body) ? snippetData.body.join('\n') : snippetData.body,
                    variables: this.extractVariables(Array.isArray(snippetData.body) ? snippetData.body.join('\n') : snippetData.body),
                    usage: 0,
                    rating: 0,
                    author: 'VS Code',
                    dateCreated: new Date(),
                    dateModified: new Date(),
                    isBuiltIn: false,
                    frameworks: [],
                    dependencies: []
                };

                await this.saveSnippet(snippet);
                importedCount++;
            }

            return importedCount;
        } catch (error) {
            throw new Error(`Failed to import snippets: ${error}`);
        }
    }

    // Private helper methods

    private initializeBuiltInSnippets(): void {
        const builtInSnippets: CodeSnippet[] = [
            {
                id: 'react-component',
                title: 'React Functional Component',
                description: 'Modern React functional component with TypeScript',
                language: 'typescriptreact',
                category: 'React',
                tags: ['react', 'component', 'typescript', 'functional'],
                code: `import React from 'react';

interface \${componentName}Props {
  \${propName}: \${propType};
}

const \${componentName}: React.FC<\${componentName}Props> = ({ \${propName} }) => {
  return (
    <div className="\${className}">
      \${content}
    </div>
  );
};

export default \${componentName};`,
                variables: [
                    {
                        name: 'componentName',
                        type: 'string',
                        description: 'Component name',
                        defaultValue: 'MyComponent',
                        required: true,
                        placeholder: 'Enter component name'
                    },
                    {
                        name: 'propName',
                        type: 'string',
                        description: 'Prop name',
                        defaultValue: 'title',
                        required: false,
                        placeholder: 'Enter prop name'
                    },
                    {
                        name: 'propType',
                        type: 'choice',
                        description: 'Prop type',
                        choices: ['string', 'number', 'boolean', 'object'],
                        defaultValue: 'string',
                        required: false
                    },
                    {
                        name: 'className',
                        type: 'string',
                        description: 'CSS class name',
                        defaultValue: 'container',
                        required: false,
                        placeholder: 'Enter CSS class'
                    },
                    {
                        name: 'content',
                        type: 'string',
                        description: 'Component content',
                        defaultValue: '<p>Hello World</p>',
                        required: false,
                        placeholder: 'Enter JSX content'
                    }
                ],
                usage: 0,
                rating: 5,
                author: 'Cuovare',
                dateCreated: new Date(),
                dateModified: new Date(),
                isBuiltIn: true,
                frameworks: ['React'],
                dependencies: ['react', '@types/react']
            },
            {
                id: 'express-route',
                title: 'Express.js Route Handler',
                description: 'Express route with error handling and validation',
                language: 'typescript',
                category: 'Backend',
                tags: ['express', 'route', 'api', 'nodejs', 'typescript'],
                code: `import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const \${handlerName} = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    // \${businessLogic}
    const result = await \${serviceCall}(req.\${requestProperty});

    res.status(\${successStatus}).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};`,
                variables: [
                    {
                        name: 'handlerName',
                        type: 'string',
                        description: 'Handler function name',
                        defaultValue: 'handleRequest',
                        required: true,
                        placeholder: 'Enter handler name'
                    },
                    {
                        name: 'businessLogic',
                        type: 'string',
                        description: 'Business logic description',
                        defaultValue: 'Process request data',
                        required: false,
                        placeholder: 'Describe business logic'
                    },
                    {
                        name: 'serviceCall',
                        type: 'string',
                        description: 'Service method to call',
                        defaultValue: 'userService.getUser',
                        required: false,
                        placeholder: 'service.method'
                    },
                    {
                        name: 'requestProperty',
                        type: 'choice',
                        description: 'Request property to use',
                        choices: ['body', 'params', 'query'],
                        defaultValue: 'body',
                        required: false
                    },
                    {
                        name: 'successStatus',
                        type: 'choice',
                        description: 'Success status code',
                        choices: ['200', '201', '202', '204'],
                        defaultValue: '200',
                        required: false
                    }
                ],
                usage: 0,
                rating: 5,
                author: 'Cuovare',
                dateCreated: new Date(),
                dateModified: new Date(),
                isBuiltIn: true,
                frameworks: ['Express.js'],
                dependencies: ['express', 'express-validator']
            }
        ];

        for (const snippet of builtInSnippets) {
            this.snippets.set(snippet.id, snippet);
        }
    }

    private initializeCategories(): void {
        const categories: SnippetCategory[] = [
            {
                id: 'react',
                name: 'React',
                description: 'React components and hooks',
                icon: '⚛️',
                color: '#61DAFB',
                snippetCount: 0
            },
            {
                id: 'backend',
                name: 'Backend',
                description: 'Server-side code and APIs',
                icon: '🚀',
                color: '#68D391',
                snippetCount: 0
            },
            {
                id: 'database',
                name: 'Database',
                description: 'Database queries and models',
                icon: '🗄️',
                color: '#4299E1',
                snippetCount: 0
            },
            {
                id: 'utility',
                name: 'Utilities',
                description: 'Helper functions and utilities',
                icon: '🔧',
                color: '#ED8936',
                snippetCount: 0
            },
            {
                id: 'testing',
                name: 'Testing',
                description: 'Test cases and test utilities',
                icon: '🧪',
                color: '#9F7AEA',
                snippetCount: 0
            }
        ];

        for (const category of categories) {
            this.categories.set(category.id, category);
        }

        this.updateCategoryCounts();
    }

    private calculateRelevanceScore(snippet: CodeSnippet, query: string): number {
        let score = 0;
        const queryLower = query.toLowerCase();

        // Title match (highest weight)
        if (snippet.title.toLowerCase().includes(queryLower)) {
            score += 100;
        }

        // Description match
        if (snippet.description.toLowerCase().includes(queryLower)) {
            score += 50;
        }

        // Tag match
        for (const tag of snippet.tags) {
            if (tag.toLowerCase().includes(queryLower)) {
                score += 30;
            }
        }

        // Usage and rating bonus
        score += snippet.usage * 2;
        score += snippet.rating * 10;

        return score;
    }

    private extractSuggestedTags(snippets: CodeSnippet[], query: string): string[] {
        const tagCounts = new Map<string, number>();

        for (const snippet of snippets) {
            for (const tag of snippet.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }

        return Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag]) => tag);
    }

    private analyzeIntent(context: any): string {
        // Simple intent analysis - could be enhanced with AI
        if (context.intent) return context.intent;
        
        if (context.currentFile) {
            if (context.currentFile.includes('test')) return 'testing';
            if (context.currentFile.includes('component')) return 'ui';
            if (context.currentFile.includes('api')) return 'api';
            if (context.currentFile.includes('util')) return 'utility';
        }

        return 'general';
    }

    private findRelevantSnippets(context: any, intent: string): CodeSnippet[] {
        let snippets = Array.from(this.snippets.values());

        // Filter by language
        if (context.language) {
            snippets = snippets.filter(s => s.language === context.language);
        }

        // Filter by frameworks
        if (context.frameworks) {
            snippets = snippets.filter(s => 
                context.frameworks.some((f: string) => s.frameworks.includes(f))
            );
        }

        // Sort by relevance to intent
        return snippets.sort((a, b) => {
            const aRelevance = this.calculateIntentRelevance(a, intent);
            const bRelevance = this.calculateIntentRelevance(b, intent);
            return bRelevance - aRelevance;
        });
    }

    private calculateIntentRelevance(snippet: CodeSnippet, intent: string): number {
        let score = 0;

        if (snippet.category.toLowerCase().includes(intent)) score += 50;
        
        for (const tag of snippet.tags) {
            if (tag.toLowerCase().includes(intent)) score += 20;
        }

        score += snippet.usage;
        score += snippet.rating * 5;

        return score;
    }

    private calculateConfidence(snippet: CodeSnippet, context: any): number {
        let confidence = 0.5; // Base confidence

        if (context.language === snippet.language) confidence += 0.2;
        
        if (context.frameworks) {
            const frameworkMatch = context.frameworks.some((f: string) => 
                snippet.frameworks.includes(f)
            );
            if (frameworkMatch) confidence += 0.2;
        }

        confidence += Math.min(snippet.usage / 100, 0.1);
        confidence += snippet.rating / 50;

        return Math.min(confidence, 1.0);
    }

    private generateReasoning(snippet: CodeSnippet, context: any, intent: string): string {
        const reasons: string[] = [];

        if (context.language === snippet.language) {
            reasons.push(`Matches ${snippet.language} language`);
        }

        if (context.frameworks) {
            const matchingFrameworks = snippet.frameworks.filter(f => 
                context.frameworks.includes(f)
            );
            if (matchingFrameworks.length > 0) {
                reasons.push(`Uses ${matchingFrameworks.join(', ')}`);
            }
        }

        if (snippet.usage > 10) {
            reasons.push(`Popular snippet (${snippet.usage} uses)`);
        }

        if (snippet.rating > 4) {
            reasons.push(`Highly rated (${snippet.rating}/5)`);
        }

        return reasons.join('; ') || 'General match for current context';
    }

    private suggestAdaptations(snippet: CodeSnippet, context: any): string[] {
        const adaptations: string[] = [];

        if (context.existingCode) {
            adaptations.push('Adapt variable names to match existing code');
        }

        if (context.frameworks && !snippet.frameworks.some(f => context.frameworks.includes(f))) {
            adaptations.push(`Consider adapting for ${context.frameworks.join(', ')}`);
        }

        adaptations.push('Customize variable values');
        adaptations.push('Add error handling if needed');

        return adaptations;
    }

    private async extractSnippetMetadata(code: string, language: string): Promise<{
        title: string;
        description: string;
        category: string;
        suggestedTags: string[];
        frameworks: string[];
        dependencies: string[];
    }> {
        // AI-enhanced metadata extraction - simplified version
        const analysis = this.analyzeCodeStructure(code, language);

        return {
            title: analysis.title || 'Custom Snippet',
            description: analysis.description || 'User-created code snippet',
            category: analysis.category || 'Custom',
            suggestedTags: analysis.tags || [language, 'custom'],
            frameworks: analysis.frameworks || [],
            dependencies: analysis.dependencies || []
        };
    }

    private analyzeCodeStructure(code: string, language: string): any {
        const analysis: any = {
            tags: [language],
            frameworks: [],
            dependencies: []
        };

        // Detect React
        if (code.includes('React') || code.includes('jsx') || code.includes('tsx')) {
            analysis.frameworks.push('React');
            analysis.tags.push('react');
            analysis.category = 'React';
        }

        // Detect Express
        if (code.includes('express') || code.includes('Router')) {
            analysis.frameworks.push('Express.js');
            analysis.tags.push('express', 'api');
            analysis.category = 'Backend';
        }

        // Detect functions
        if (code.includes('function') || code.includes('=>')) {
            analysis.tags.push('function');
            if (!analysis.category) analysis.category = 'Utility';
        }

        // Detect classes
        if (code.includes('class ')) {
            analysis.tags.push('class', 'oop');
        }

        return analysis;
    }

    private cleanCode(code: string): string {
        // Remove extra whitespace and normalize formatting
        return code.trim().replace(/\n\s*\n\s*\n/g, '\n\n');
    }

    private extractVariables(code: string): VariableDefinition[] {
        const variables: VariableDefinition[] = [];
        const variablePattern = /\$\{([^}]+)\}/g;
        let match;

        while ((match = variablePattern.exec(code)) !== null) {
            const varName = match[1];
            if (!variables.some(v => v.name === varName)) {
                variables.push({
                    name: varName,
                    type: 'string',
                    description: `Variable: ${varName}`,
                    required: true,
                    placeholder: `Enter ${varName}`
                });
            }
        }

        return variables;
    }

    private generateSnippetId(): string {
        return `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async saveSnippet(snippet: CodeSnippet): Promise<void> {
        this.snippets.set(snippet.id, snippet);
        this.updateCategoryCounts();
        
        if (!snippet.isBuiltIn && this.userSnippetsPath) {
            await this.saveUserSnippets();
        }
    }

    private updateCategoryCounts(): void {
        for (const category of this.categories.values()) {
            category.snippetCount = Array.from(this.snippets.values())
                .filter(s => s.category === category.name).length;
        }
    }

    private async loadUserSnippets(): Promise<void> {
        try {
            const data = await fs.readFile(this.userSnippetsPath, 'utf8');
            const userSnippets: CodeSnippet[] = JSON.parse(data);
            
            for (const snippet of userSnippets) {
                this.snippets.set(snippet.id, snippet);
            }
        } catch (error) {
            // File doesn't exist or is invalid - that's okay
        }
    }

    private async saveUserSnippets(): Promise<void> {
        try {
            const userSnippets = Array.from(this.snippets.values())
                .filter(s => !s.isBuiltIn);
            
            const dir = path.dirname(this.userSnippetsPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.userSnippetsPath, JSON.stringify(userSnippets, null, 2));
        } catch (error) {
            console.error('Failed to save user snippets:', error);
        }
    }
}

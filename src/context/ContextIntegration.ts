import { ContextRetrievalEngine, RetrievalContext, SearchOptions } from './ContextRetrievalEngine';

/**
 * Integration layer for using ContextRetrievalEngine in chat and other components
 */
export class ContextIntegration {
    private engine: ContextRetrievalEngine;

    constructor() {
        this.engine = ContextRetrievalEngine.getInstance();
    }

    /**
     * Get intelligent context for a user's chat message
     */
    public async getContextForMessage(message: string, currentFile?: string): Promise<RetrievalContext> {
        // Determine if this is a code-specific query
        const isCodeQuery = this.isCodeRelatedQuery(message);
        
        const options: SearchOptions = {
            maxFiles: isCodeQuery ? 15 : 8,
            includeTests: message.includes('test') || message.includes('spec'),
            includeDocs: message.includes('how') || message.includes('what') || message.includes('documentation'),
            contextWindow: 100
        };

        // If user mentions current file context, include related files
        if (currentFile && (message.includes('this file') || message.includes('current file'))) {
            return this.engine.findRelatedFiles(currentFile, options);
        }

        // Use semantic search for natural language queries
        if (message.split(' ').length > 3 && !this.containsCodeIdentifiers(message)) {
            return this.engine.semanticSearch(message, options);
        }

        // Use standard retrieval for everything else
        return this.engine.retrieveContext(message, options);
    }

    /**
     * Get context for @ file references in chat
     */
    public async getFileReferenceContext(filePath: string, lineRange?: [number, number]): Promise<string> {
        const file = await this.engine.analyzeFile(filePath);
        if (!file) {
            return `File not found: ${filePath}`;
        }

        if (lineRange) {
            const lines = file.content.split('\n');
            const [start, end] = lineRange;
            const selectedLines = lines.slice(start - 1, end);
            return selectedLines.join('\n');
        }

        return file.content;
    }

    /**
     * Find usage examples for a function/class/interface
     */
    public async findUsageExamples(identifier: string): Promise<RetrievalContext> {
        return this.engine.findUsages(identifier, {
            maxFiles: 10,
            includeTests: true,
            searchType: 'usage'
        });
    }

    /**
     * Get context suggestions for autocomplete
     */
    public async getAutocompleteSuggestions(query: string): Promise<string[]> {
        if (query.length < 2) return [];

        const context = await this.engine.retrieveContext(query, {
            maxFiles: 5,
            searchType: 'keyword'
        });

        const suggestions = new Set<string>();

        // Add file names
        context.files.forEach(file => {
            const fileName = file.path.split(/[/\\]/).pop()!;
            if (fileName.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(fileName);
            }
        });

        // Add function names
        context.files.forEach(file => {
            file.functions.forEach(func => {
                if (func.name.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(func.name);
                }
            });
        });

        // Add class names
        context.files.forEach(file => {
            file.classes.forEach(cls => {
                if (cls.name.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(cls.name);
                }
            });
        });

        return Array.from(suggestions).slice(0, 10);
    }

    /**
     * Format context for AI provider
     */
    public formatContextForAI(context: RetrievalContext): string {
        if (context.files.length === 0) {
            return 'No relevant context found.';
        }

        let formatted = `## Codebase Context (${context.files.length} files, relevance: ${(context.relevanceScore * 100).toFixed(1)}%)\n\n`;

        context.files.forEach((file, index) => {
            const relativePath = this.getRelativePath(file.path);
            formatted += `### ${index + 1}. ${relativePath} (${file.language})\n`;
            formatted += `Relevance: ${file.relevanceScore.toFixed(1)}/100\n`;
            
            // Add file summary
            if (file.functions.length > 0) {
                formatted += `Functions: ${file.functions.map(f => f.name).join(', ')}\n`;
            }
            if (file.classes.length > 0) {
                formatted += `Classes: ${file.classes.map(c => c.name).join(', ')}\n`;
            }
            if (file.interfaces.length > 0) {
                formatted += `Interfaces: ${file.interfaces.map(i => i.name).join(', ')}\n`;
            }

            // Add relevant code snippets (truncated for context)
            const truncatedContent = this.truncateContent(file.content, 500);
            formatted += `\`\`\`${file.language}\n${truncatedContent}\n\`\`\`\n\n`;
        });

        return formatted;
    }

    private isCodeRelatedQuery(message: string): boolean {
        const codeKeywords = [
            'function', 'class', 'interface', 'method', 'variable', 'import', 'export',
            'typescript', 'javascript', 'python', 'java', 'implementation', 'algorithm',
            'bug', 'error', 'debug', 'refactor', 'optimize', 'test', 'api', 'endpoint'
        ];

        return codeKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );
    }

    private containsCodeIdentifiers(message: string): boolean {
        // Check for camelCase, PascalCase, snake_case patterns
        return /\b[a-z]+[A-Z][a-zA-Z]*\b|\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|\b[a-z]+_[a-z_]+\b/.test(message);
    }

    private getRelativePath(filePath: string): string {
        // Simple relative path - could be enhanced with workspace root
        const parts = filePath.split(/[/\\]/);
        return parts.slice(-2).join('/');
    }

    private truncateContent(content: string, maxLength: number): string {
        if (content.length <= maxLength) {
            return content;
        }

        // Try to cut at a reasonable line break
        const truncated = content.substring(0, maxLength);
        const lastNewline = truncated.lastIndexOf('\n');
        
        if (lastNewline > maxLength * 0.8) {
            return truncated.substring(0, lastNewline) + '\n// ... (truncated)';
        }

        return truncated + '\n// ... (truncated)';
    }
}

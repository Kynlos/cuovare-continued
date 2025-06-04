import * as vscode from 'vscode';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

export class SearchTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'search_analysis',
        description: 'Perform semantic and keyword searches across the codebase with advanced analysis',
        category: 'Code Analysis',
        parameters: [
            { name: 'query', description: 'Search query or pattern', required: true, type: 'string' },
            { name: 'type', description: 'Search type: keyword, pattern, file', required: true, type: 'string' },
            { name: 'filePattern', description: 'File pattern to match', required: false, type: 'string' },
            { name: 'maxResults', description: 'Maximum number of results', required: false, type: 'number' }
        ],
        examples: [
            'Find files by name: { "query": "auth", "type": "file" }',
            'Search for text: { "query": "function handleAuth", "type": "keyword" }',
            'Pattern search: { "query": "fetch|axios", "type": "pattern" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: vscode.OutputChannel;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Performing ${payload.type} search for: ${payload.query}`);
            
            const maxResults = payload.maxResults || 10;
            const query = payload.query;

            switch (payload.type) {
                case 'file':
                    return await this.performFileSearch(query, context.workspaceRoot, maxResults);
                
                case 'keyword':
                    return await this.performKeywordSearch(query, context.workspaceRoot, maxResults, payload.filePattern);
                
                case 'pattern':
                    return await this.performPatternSearch(query, context.workspaceRoot, maxResults, payload.filePattern);
                
                default:
                    throw new Error(`Unknown search type: ${payload.type}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Search failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async performFileSearch(query: string, workspaceRoot: string, maxResults: number): Promise<{ success: boolean; message: string }> {
        const pattern = `**/*${query}*`;
        const files = await glob(pattern, { cwd: workspaceRoot, ignore: ['**/node_modules/**', '**/dist/**'] });
        
        const results = files.slice(0, maxResults);
        let message = `Found ${results.length} files matching "${query}":\n`;
        results.forEach(file => {
            message += `- ${file}\n`;
        });

        return { success: true, message };
    }

    private async performKeywordSearch(query: string, workspaceRoot: string, maxResults: number, filePattern?: string): Promise<{ success: boolean; message: string }> {
        const searchPattern = filePattern || '**/*.{ts,js,json,md}';
        const files = await glob(searchPattern, { cwd: workspaceRoot, ignore: ['**/node_modules/**', '**/dist/**'] });
        
        const results: { file: string; line: number; content: string }[] = [];
        
        for (const file of files.slice(0, 50)) { // Limit files to search
            try {
                const filePath = path.join(workspaceRoot, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    if (line.toLowerCase().includes(query.toLowerCase()) && results.length < maxResults) {
                        results.push({
                            file,
                            line: index + 1,
                            content: line.trim()
                        });
                    }
                });
            } catch (error) {
                // Skip files that can't be read
            }
        }

        let message = `Found ${results.length} matches for "${query}":\n`;
        results.forEach(result => {
            message += `${result.file}:${result.line} - ${result.content}\n`;
        });

        return { success: true, message };
    }

    private async performPatternSearch(pattern: string, workspaceRoot: string, maxResults: number, filePattern?: string): Promise<{ success: boolean; message: string }> {
        try {
            const regex = new RegExp(pattern, 'gi');
            return await this.searchWithRegex(regex, workspaceRoot, maxResults, filePattern);
        } catch (error) {
            throw new Error(`Invalid regex pattern: ${pattern}`);
        }
    }

    private async searchWithRegex(regex: RegExp, workspaceRoot: string, maxResults: number, filePattern?: string): Promise<{ success: boolean; message: string }> {
        const searchPattern = filePattern || '**/*.{ts,js,json,md}';
        const files = await glob(searchPattern, { cwd: workspaceRoot, ignore: ['**/node_modules/**', '**/dist/**'] });
        
        const results: { file: string; line: number; content: string }[] = [];
        
        for (const file of files.slice(0, 50)) {
            try {
                const filePath = path.join(workspaceRoot, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    if (regex.test(line) && results.length < maxResults) {
                        results.push({
                            file,
                            line: index + 1,
                            content: line.trim()
                        });
                    }
                });
            } catch (error) {
                // Skip files that can't be read
            }
        }

        let message = `Found ${results.length} pattern matches:\n`;
        results.forEach(result => {
            message += `${result.file}:${result.line} - ${result.content}\n`;
        });

        return { success: true, message };
    }
}

export default new SearchTool();

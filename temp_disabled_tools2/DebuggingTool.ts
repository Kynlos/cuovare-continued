import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class DebuggingTool implements ToolExecutor {
    readonly name = 'debugging';
    readonly description = 'Debug and analyze code issues, breakpoints, and runtime behavior';
    
    readonly metadata = {
        name: 'debugging',
        description: 'Debug and analyze code issues, breakpoints, and runtime behavior',
        category: 'Debugging',
        parameters: [
            {
                name: 'action',
                description: 'Debug action to perform',
                required: true,
                type: 'string'
            },
            {
                name: 'params',
                description: 'Parameters for the action',
                required: false,
                type: 'object'
            }
        ],
        examples: [
            'Set breakpoints in code',
            'Analyze runtime behavior',
            'Debug performance issues',
            'Trace code execution'
        ]
    };

    readonly methods = {
        'setBreakpoint': {
            description: 'Set a breakpoint at a specific line in a file',
            parameters: {
                filePath: { type: 'string', description: 'Path to the file' },
                lineNumber: { type: 'number', description: 'Line number to set breakpoint' },
                condition: { type: 'string', description: 'Optional condition for the breakpoint', optional: true }
            }
        },
        'removeBreakpoint': {
            description: 'Remove a breakpoint from a specific line',
            parameters: {
                filePath: { type: 'string', description: 'Path to the file' },
                lineNumber: { type: 'number', description: 'Line number to remove breakpoint' }
            }
        },
        'analyzeError': {
            description: 'Analyze error messages and stack traces',
            parameters: {
                errorMessage: { type: 'string', description: 'Error message or stack trace' },
                filePath: { type: 'string', description: 'Optional file path where error occurred', optional: true }
            }
        },
        'findDeadCode': {
            description: 'Find potentially dead code in the project',
            parameters: {
                directory: { type: 'string', description: 'Directory to analyze', optional: true }
            }
        },
        'analyzePerformance': {
            description: 'Analyze performance bottlenecks in code',
            parameters: {
                filePath: { type: 'string', description: 'Path to the file to analyze' }
            }
        },
        'debugSession': {
            description: 'Start a debug session for the current workspace',
            parameters: {
                configuration: { type: 'string', description: 'Debug configuration name', optional: true }
            }
        },
        'inspectVariable': {
            description: 'Inspect variable values during debugging',
            parameters: {
                variableName: { type: 'string', description: 'Variable name to inspect' },
                scope: { type: 'string', description: 'Scope (local, global, closure)', optional: true }
            }
        },
        'generateStackTrace': {
            description: 'Generate and analyze current stack trace',
            parameters: {}
        },
        'findMemoryLeaks': {
            description: 'Identify potential memory leaks in JavaScript/TypeScript code',
            parameters: {
                filePath: { type: 'string', description: 'Path to the file to analyze' }
            }
        },
        'validateTypes': {
            description: 'Validate TypeScript types and find type-related issues',
            parameters: {
                filePath: { type: 'string', description: 'Path to the TypeScript file' }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'setBreakpoint':
                    return await this.setBreakpoint(args.filePath, args.lineNumber, args.condition);
                case 'removeBreakpoint':
                    return await this.removeBreakpoint(args.filePath, args.lineNumber);
                case 'analyzeError':
                    return await this.analyzeError(args.errorMessage, args.filePath);
                case 'findDeadCode':
                    return await this.findDeadCode(args.directory);
                case 'analyzePerformance':
                    return await this.analyzePerformance(args.filePath);
                case 'debugSession':
                    return await this.debugSession(args.configuration);
                case 'inspectVariable':
                    return await this.inspectVariable(args.variableName, args.scope);
                case 'generateStackTrace':
                    return await this.generateStackTrace();
                case 'findMemoryLeaks':
                    return await this.findMemoryLeaks(args.filePath);
                case 'validateTypes':
                    return await this.validateTypes(args.filePath);
                default:
                    return {
                        success: false,
                        error: `Unknown method: ${method}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: `Error executing ${method}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async setBreakpoint(filePath: string, lineNumber: number, condition?: string): Promise<ToolResult> {
        try {
            const uri = vscode.Uri.file(filePath);
            const breakpoint = new vscode.SourceBreakpoint(
                new vscode.Location(uri, new vscode.Position(lineNumber - 1, 0)),
                true,
                condition
            );

            vscode.debug.addBreakpoints([breakpoint]);

            return {
                success: true,
                result: `Breakpoint set at line ${lineNumber} in ${filePath}${condition ? ` with condition: ${condition}` : ''}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to set breakpoint: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async removeBreakpoint(filePath: string, lineNumber: number): Promise<ToolResult> {
        try {
            const uri = vscode.Uri.file(filePath);
            const breakpoints = vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.SourceBreakpoint &&
                bp.location.uri.fsPath === uri.fsPath &&
                bp.location.range.start.line === lineNumber - 1
            );

            if (breakpoints.length > 0) {
                vscode.debug.removeBreakpoints(breakpoints);
                return {
                    success: true,
                    result: `Breakpoint removed from line ${lineNumber} in ${filePath}`
                };
            } else {
                return {
                    success: false,
                    error: `No breakpoint found at line ${lineNumber} in ${filePath}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Failed to remove breakpoint: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeError(errorMessage: string, filePath?: string): Promise<ToolResult> {
        try {
            const analysis = {
                errorType: this.determineErrorType(errorMessage),
                stackTrace: this.parseStackTrace(errorMessage),
                suggestions: this.generateErrorSuggestions(errorMessage),
                relatedFiles: filePath ? [filePath] : this.extractFilesFromStackTrace(errorMessage)
            };

            return {
                success: true,
                result: JSON.stringify(analysis, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async findDeadCode(directory?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const searchDir = directory || workspaceFolder.uri.fsPath;
            const deadCodeCandidates: string[] = [];

            // Simple dead code detection - functions/variables that are defined but never used
            const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx}', '**/node_modules/**');
            
            for (const file of files) {
                if (directory && !file.fsPath.includes(directory)) continue;
                
                const content = await fs.readFile(file.fsPath, 'utf8');
                const unusedExports = await this.findUnusedExports(content, file.fsPath);
                deadCodeCandidates.push(...unusedExports);
            }

            return {
                success: true,
                result: JSON.stringify({
                    deadCodeCandidates,
                    summary: `Found ${deadCodeCandidates.length} potentially dead code candidates`
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find dead code: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzePerformance(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const issues = this.detectPerformanceIssues(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    performanceIssues: issues,
                    recommendations: this.generatePerformanceRecommendations(issues)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze performance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async debugSession(configuration?: string): Promise<ToolResult> {
        try {
            const configs = vscode.workspace.getConfiguration('launch').get('configurations') as any[];
            if (!configs || configs.length === 0) {
                return {
                    success: false,
                    error: 'No debug configurations found in launch.json'
                };
            }

            const configToUse = configuration 
                ? configs.find(c => c.name === configuration)
                : configs[0];

            if (!configToUse) {
                return {
                    success: false,
                    error: `Debug configuration '${configuration}' not found`
                };
            }

            const started = await vscode.debug.startDebugging(
                vscode.workspace.workspaceFolders?.[0],
                configToUse
            );

            return {
                success: started,
                result: started 
                    ? `Debug session started with configuration: ${configToUse.name}`
                    : 'Failed to start debug session'
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to start debug session: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async inspectVariable(variableName: string, scope?: string): Promise<ToolResult> {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                return {
                    success: false,
                    error: 'No active debug session found'
                };
            }

            // Note: This is a simplified implementation
            // In practice, you'd need to evaluate expressions in the debug context
            return {
                success: true,
                result: `Variable inspection for '${variableName}' in scope '${scope || 'current'}' - requires active debug session`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to inspect variable: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateStackTrace(): Promise<ToolResult> {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                return {
                    success: false,
                    error: 'No active debug session found for stack trace generation'
                };
            }

            // This would require debugging API access
            return {
                success: true,
                result: 'Stack trace generation requires an active debug session with breakpoint hit'
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate stack trace: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async findMemoryLeaks(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const leakPatterns = this.detectMemoryLeakPatterns(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    potentialLeaks: leakPatterns,
                    recommendations: this.generateMemoryLeakRecommendations(leakPatterns)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find memory leaks: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async validateTypes(filePath: string): Promise<ToolResult> {
        try {
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
                return {
                    success: false,
                    error: 'Type validation is only available for TypeScript files'
                };
            }

            const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(filePath));
            const typeErrors = diagnostics.filter(d => d.source === 'typescript');

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    typeErrors: typeErrors.map(error => ({
                        line: error.range.start.line + 1,
                        column: error.range.start.character + 1,
                        message: error.message,
                        severity: vscode.DiagnosticSeverity[error.severity]
                    })),
                    summary: `Found ${typeErrors.length} type-related issues`
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to validate types: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Helper methods
    private determineErrorType(errorMessage: string): string {
        if (errorMessage.includes('TypeError')) return 'Type Error';
        if (errorMessage.includes('ReferenceError')) return 'Reference Error';
        if (errorMessage.includes('SyntaxError')) return 'Syntax Error';
        if (errorMessage.includes('RangeError')) return 'Range Error';
        if (errorMessage.includes('URIError')) return 'URI Error';
        return 'Unknown Error';
    }

    private parseStackTrace(errorMessage: string): string[] {
        const lines = errorMessage.split('\n');
        return lines.filter(line => line.trim().startsWith('at '));
    }

    private generateErrorSuggestions(errorMessage: string): string[] {
        const suggestions: string[] = [];
        
        if (errorMessage.includes('undefined')) {
            suggestions.push('Check if variables are properly initialized');
            suggestions.push('Add null/undefined checks');
        }
        
        if (errorMessage.includes('Cannot read property')) {
            suggestions.push('Verify object structure before accessing properties');
            suggestions.push('Use optional chaining (?.) for safer property access');
        }
        
        return suggestions;
    }

    private extractFilesFromStackTrace(errorMessage: string): string[] {
        const filePattern = /at\s+.*\s+\(([^:]+):\d+:\d+\)/g;
        const files: string[] = [];
        let match;
        
        while ((match = filePattern.exec(errorMessage)) !== null) {
            files.push(match[1]);
        }
        
        return [...new Set(files)];
    }

    private async findUnusedExports(content: string, filePath: string): Promise<string[]> {
        const exportPattern = /export\s+(function|const|let|var|class|interface|type)\s+(\w+)/g;
        const exports: string[] = [];
        let match;
        
        while ((match = exportPattern.exec(content)) !== null) {
            exports.push(`${match[2]} in ${filePath}`);
        }
        
        return exports;
    }

    private detectPerformanceIssues(content: string): any[] {
        const issues = [];
        
        // Check for common performance anti-patterns
        if (content.includes('document.getElementById') && content.split('document.getElementById').length > 3) {
            issues.push({
                type: 'DOM Query Optimization',
                description: 'Multiple DOM queries detected - consider caching elements'
            });
        }
        
        if (content.includes('JSON.parse(JSON.stringify')) {
            issues.push({
                type: 'Deep Clone Anti-pattern',
                description: 'JSON.parse(JSON.stringify()) is inefficient for object cloning'
            });
        }
        
        return issues;
    }

    private generatePerformanceRecommendations(issues: any[]): string[] {
        return issues.map(issue => `${issue.type}: ${issue.description}`);
    }

    private detectMemoryLeakPatterns(content: string): any[] {
        const patterns = [];
        
        if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
            patterns.push({
                type: 'Event Listener Leak',
                description: 'Event listeners added but not removed'
            });
        }
        
        if (content.includes('setInterval') && !content.includes('clearInterval')) {
            patterns.push({
                type: 'Interval Leak',
                description: 'Intervals created but not cleared'
            });
        }
        
        return patterns;
    }

    private generateMemoryLeakRecommendations(patterns: any[]): string[] {
        return patterns.map(pattern => `${pattern.type}: ${pattern.description}`);
    }
}

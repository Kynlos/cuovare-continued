import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

interface NavigationResult {
    type: 'definition' | 'reference' | 'implementation' | 'declaration';
    file: string;
    line: number;
    column: number;
    symbol: string;
    context: string;
    relativePath: string;
    preview?: string;
}

interface SymbolInfo {
    name: string;
    kind: string;
    containerName?: string;
    location: {
        file: string;
        line: number;
        column: number;
    };
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    detail?: string;
    documentation?: string;
}

interface CallHierarchy {
    symbol: string;
    callers: NavigationResult[];
    callees: NavigationResult[];
    hierarchy: string[];
}

interface TypeHierarchy {
    symbol: string;
    baseTypes: NavigationResult[];
    derivedTypes: NavigationResult[];
    interfaces: NavigationResult[];
}

export class CodeNavigationTool implements ToolExecutor {
    static metadata = {
        name: 'CodeNavigationTool',
        description: 'Smart code navigation with go-to-definition, find references, and symbol exploration',
        parameters: {
            action: 'go-to-definition | find-references | find-implementations | find-declarations | symbol-outline | call-hierarchy | type-hierarchy | workspace-symbols',
            symbol: 'Symbol name to navigate to or analyze',
            file: 'File path for context-aware navigation',
            line: 'Line number for cursor position (number)',
            column: 'Column number for cursor position (number)',
            includeDeclarations: 'Include declarations in results (boolean)',
            includeReferences: 'Include references in results (boolean)',
            maxResults: 'Maximum number of results (number)',
            showPreview: 'Show code preview for results (boolean)'
        }
    };

    private readonly supportedExtensions = [
        '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h',
        '.hpp', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.dart'
    ];

    async execute(params: Record<string, any>): Promise<ToolResult> {
        const { 
            action, symbol, file, line, column, 
            includeDeclarations, includeReferences, maxResults, showPreview 
        } = params;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, message: 'No workspace folder found' };
            }

            const options = {
                includeDeclarations: includeDeclarations !== false,
                includeReferences: includeReferences !== false,
                maxResults: maxResults || 100,
                showPreview: showPreview !== false
            };

            switch (action) {
                case 'go-to-definition':
                    return await this.goToDefinition(symbol, file, line, column, options);
                case 'find-references':
                    return await this.findReferences(symbol, file, line, column, options);
                case 'find-implementations':
                    return await this.findImplementations(symbol, file, line, column, options);
                case 'find-declarations':
                    return await this.findDeclarations(symbol, file, line, column, options);
                case 'symbol-outline':
                    return await this.getSymbolOutline(file || workspaceFolder.uri.fsPath, options);
                case 'call-hierarchy':
                    return await this.getCallHierarchy(symbol, file, line, column, options);
                case 'type-hierarchy':
                    return await this.getTypeHierarchy(symbol, file, line, column, options);
                case 'workspace-symbols':
                    return await this.findWorkspaceSymbols(symbol, options);
                default:
                    return await this.goToDefinition(symbol, file, line, column, options);
            }
        } catch (error) {
            return { 
                success: false, 
                message: `Code navigation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async goToDefinition(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { success: false, message: 'No workspace folder found' };
        }

        const definitions = await this.findSymbolDefinitions(symbol, file, options);
        
        if (definitions.length === 0) {
            return { 
                success: false, 
                message: `No definition found for symbol '${symbol}'` 
            };
        }

        // If we have a specific position, try to find the most relevant definition
        let bestDefinition = definitions[0];
        if (file && line !== undefined) {
            bestDefinition = this.findBestMatch(definitions, file, line) || definitions[0];
        }

        const result = {
            symbol,
            definition: bestDefinition,
            alternativeDefinitions: definitions.length > 1 ? definitions.slice(1) : [],
            totalFound: definitions.length
        };

        return {
            success: true,
            message: `Found ${definitions.length} definition${definitions.length === 1 ? '' : 's'} for '${symbol}'`,
            data: result
        };
    }

    private async findReferences(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const references = await this.findSymbolReferences(symbol, file, options);
        
        if (references.length === 0) {
            return { 
                success: false, 
                message: `No references found for symbol '${symbol}'` 
            };
        }

        const groupedByFile = this.groupResultsByFile(references);
        const excludingDefinitions = references.filter(ref => ref.type !== 'definition');

        return {
            success: true,
            message: `Found ${references.length} references to '${symbol}' in ${Object.keys(groupedByFile).length} files`,
            data: {
                symbol,
                totalReferences: references.length,
                referencesExcludingDefinitions: excludingDefinitions.length,
                filesWithReferences: Object.keys(groupedByFile).length,
                groupedByFile,
                allReferences: references
            }
        };
    }

    private async findImplementations(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const implementations = await this.findSymbolImplementations(symbol, file, options);
        
        if (implementations.length === 0) {
            return { 
                success: false, 
                message: `No implementations found for '${symbol}'` 
            };
        }

        return {
            success: true,
            message: `Found ${implementations.length} implementation${implementations.length === 1 ? '' : 's'} of '${symbol}'`,
            data: {
                symbol,
                totalImplementations: implementations.length,
                implementations,
                groupedByFile: this.groupResultsByFile(implementations)
            }
        };
    }

    private async findDeclarations(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const declarations = await this.findSymbolDeclarations(symbol, file, options);
        
        if (declarations.length === 0) {
            return { 
                success: false, 
                message: `No declarations found for '${symbol}'` 
            };
        }

        return {
            success: true,
            message: `Found ${declarations.length} declaration${declarations.length === 1 ? '' : 's'} of '${symbol}'`,
            data: {
                symbol,
                totalDeclarations: declarations.length,
                declarations,
                groupedByFile: this.groupResultsByFile(declarations)
            }
        };
    }

    private async getSymbolOutline(filePath: string, options: any): Promise<ToolResult> {
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isFile()) {
            const symbols = await this.extractFileSymbols(filePath, options);
            return {
                success: true,
                message: `Found ${symbols.length} symbols in ${path.basename(filePath)}`,
                data: {
                    file: filePath,
                    symbols,
                    hierarchical: this.organizeSymbolsHierarchically(symbols)
                }
            };
        } else {
            const symbols = await this.extractWorkspaceSymbols(filePath, options);
            return {
                success: true,
                message: `Found ${symbols.length} symbols in workspace`,
                data: {
                    workspace: filePath,
                    symbols,
                    byFile: this.groupSymbolsByFile(symbols),
                    byKind: this.groupSymbolsByKind(symbols)
                }
            };
        }
    }

    private async getCallHierarchy(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const hierarchy = await this.buildCallHierarchy(symbol, file, options);
        
        return {
            success: true,
            message: `Built call hierarchy for '${symbol}' (${hierarchy.callers.length} callers, ${hierarchy.callees.length} callees)`,
            data: hierarchy
        };
    }

    private async getTypeHierarchy(symbol: string, file?: string, line?: number, column?: number, options?: any): Promise<ToolResult> {
        const hierarchy = await this.buildTypeHierarchy(symbol, file, options);
        
        return {
            success: true,
            message: `Built type hierarchy for '${symbol}' (${hierarchy.baseTypes.length} base types, ${hierarchy.derivedTypes.length} derived types)`,
            data: hierarchy
        };
    }

    private async findWorkspaceSymbols(query: string, options: any): Promise<ToolResult> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { success: false, message: 'No workspace folder found' };
        }

        const symbols = await this.searchWorkspaceSymbols(query, workspaceFolder.uri.fsPath, options);
        
        return {
            success: true,
            message: `Found ${symbols.length} symbols matching '${query}'`,
            data: {
                query,
                totalSymbols: symbols.length,
                symbols,
                byFile: this.groupSymbolsByFile(symbols),
                byKind: this.groupSymbolsByKind(symbols)
            }
        };
    }

    private async findSymbolDefinitions(symbol: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        // Definition patterns for different languages
        const patterns = this.getDefinitionPatterns(symbol);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const fileResults = await this.searchDefinitionsInFile(file, content, symbol, patterns, options);
                results.push(...fileResults);
            } catch (error) {
                continue;
            }
        }

        return this.rankResults(results, contextFile);
    }

    private async findSymbolReferences(symbol: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        // Reference patterns
        const patterns = this.getReferencePatterns(symbol);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const fileResults = await this.searchReferencesInFile(file, content, symbol, patterns, options);
                results.push(...fileResults);
            } catch (error) {
                continue;
            }
        }

        return this.rankResults(results, contextFile);
    }

    private async findSymbolImplementations(symbol: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        // Implementation patterns
        const patterns = this.getImplementationPatterns(symbol);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const fileResults = await this.searchImplementationsInFile(file, content, symbol, patterns, options);
                results.push(...fileResults);
            } catch (error) {
                continue;
            }
        }

        return this.rankResults(results, contextFile);
    }

    private async findSymbolDeclarations(symbol: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        // Declaration patterns (interfaces, abstract classes, function signatures)
        const patterns = this.getDeclarationPatterns(symbol);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const fileResults = await this.searchDeclarationsInFile(file, content, symbol, patterns, options);
                results.push(...fileResults);
            } catch (error) {
                continue;
            }
        }

        return this.rankResults(results, contextFile);
    }

    private getDefinitionPatterns(symbol: string): Array<{ pattern: RegExp; type: string; language: string }> {
        return [
            // TypeScript/JavaScript
            { pattern: new RegExp(`\\bfunction\\s+${symbol}\\s*\\(`, 'g'), type: 'function', language: 'typescript' },
            { pattern: new RegExp(`\\bconst\\s+${symbol}\\s*=`, 'g'), type: 'constant', language: 'typescript' },
            { pattern: new RegExp(`\\blet\\s+${symbol}\\s*=`, 'g'), type: 'variable', language: 'typescript' },
            { pattern: new RegExp(`\\bvar\\s+${symbol}\\s*=`, 'g'), type: 'variable', language: 'typescript' },
            { pattern: new RegExp(`\\bclass\\s+${symbol}\\b`, 'g'), type: 'class', language: 'typescript' },
            { pattern: new RegExp(`\\binterface\\s+${symbol}\\b`, 'g'), type: 'interface', language: 'typescript' },
            { pattern: new RegExp(`\\btype\\s+${symbol}\\s*=`, 'g'), type: 'type', language: 'typescript' },
            { pattern: new RegExp(`\\benum\\s+${symbol}\\b`, 'g'), type: 'enum', language: 'typescript' },
            
            // Python
            { pattern: new RegExp(`^\\s*def\\s+${symbol}\\s*\\(`, 'gm'), type: 'function', language: 'python' },
            { pattern: new RegExp(`^\\s*class\\s+${symbol}\\s*[\\(:]`, 'gm'), type: 'class', language: 'python' },
            { pattern: new RegExp(`^\\s*${symbol}\\s*=`, 'gm'), type: 'variable', language: 'python' },
            
            // Java
            { pattern: new RegExp(`\\bclass\\s+${symbol}\\b`, 'g'), type: 'class', language: 'java' },
            { pattern: new RegExp(`\\binterface\\s+${symbol}\\b`, 'g'), type: 'interface', language: 'java' },
            { pattern: new RegExp(`\\benum\\s+${symbol}\\b`, 'g'), type: 'enum', language: 'java' },
            { pattern: new RegExp(`\\b\\w+\\s+${symbol}\\s*\\(`, 'g'), type: 'method', language: 'java' },
            
            // C/C++
            { pattern: new RegExp(`\\b\\w+\\s+${symbol}\\s*\\(`, 'g'), type: 'function', language: 'cpp' },
            { pattern: new RegExp(`\\bclass\\s+${symbol}\\b`, 'g'), type: 'class', language: 'cpp' },
            { pattern: new RegExp(`\\bstruct\\s+${symbol}\\b`, 'g'), type: 'struct', language: 'cpp' },
            { pattern: new RegExp(`\\btypedef\\s+.*\\s+${symbol}\\b`, 'g'), type: 'typedef', language: 'cpp' }
        ];
    }

    private getReferencePatterns(symbol: string): Array<{ pattern: RegExp; type: string; context: string }> {
        return [
            { pattern: new RegExp(`\\b${symbol}\\s*\\(`, 'g'), type: 'call', context: 'function_call' },
            { pattern: new RegExp(`\\b${symbol}\\.\\w+`, 'g'), type: 'property_access', context: 'member_access' },
            { pattern: new RegExp(`\\bnew\\s+${symbol}\\b`, 'g'), type: 'instantiation', context: 'constructor' },
            { pattern: new RegExp(`\\bextends\\s+${symbol}\\b`, 'g'), type: 'inheritance', context: 'extends' },
            { pattern: new RegExp(`\\bimplements\\s+.*\\b${symbol}\\b`, 'g'), type: 'implementation', context: 'implements' },
            { pattern: new RegExp(`\\bimport\\s+.*\\b${symbol}\\b`, 'g'), type: 'import', context: 'import_statement' },
            { pattern: new RegExp(`\\bfrom\\s+.*\\b${symbol}\\b`, 'g'), type: 'import', context: 'from_import' },
            { pattern: new RegExp(`\\b${symbol}\\s*=`, 'g'), type: 'assignment', context: 'assignment' },
            { pattern: new RegExp(`\\b${symbol}\\b(?!\\s*[=\\(])`, 'g'), type: 'usage', context: 'general_usage' }
        ];
    }

    private getImplementationPatterns(symbol: string): Array<{ pattern: RegExp; type: string; language: string }> {
        return [
            // Class implementations
            { pattern: new RegExp(`\\bclass\\s+\\w+\\s+implements\\s+.*\\b${symbol}\\b`, 'g'), type: 'interface_implementation', language: 'typescript' },
            { pattern: new RegExp(`\\bclass\\s+\\w+\\s+extends\\s+${symbol}\\b`, 'g'), type: 'class_extension', language: 'typescript' },
            
            // Method implementations
            { pattern: new RegExp(`\\b${symbol}\\s*\\([^)]*\\)\\s*\\{`, 'g'), type: 'method_implementation', language: 'typescript' },
            
            // Python implementations
            { pattern: new RegExp(`\\bclass\\s+\\w+\\s*\\([^)]*\\b${symbol}\\b[^)]*\\):`, 'g'), type: 'class_inheritance', language: 'python' },
            
            // Function implementations (override patterns)
            { pattern: new RegExp(`@override\\s*\\n\\s*\\b${symbol}\\s*\\(`, 'gm'), type: 'method_override', language: 'java' }
        ];
    }

    private getDeclarationPatterns(symbol: string): Array<{ pattern: RegExp; type: string; language: string }> {
        return [
            // Interface declarations
            { pattern: new RegExp(`\\binterface\\s+${symbol}\\b`, 'g'), type: 'interface', language: 'typescript' },
            
            // Abstract class declarations
            { pattern: new RegExp(`\\babstract\\s+class\\s+${symbol}\\b`, 'g'), type: 'abstract_class', language: 'typescript' },
            
            // Function declarations (without implementation)
            { pattern: new RegExp(`\\bdeclare\\s+function\\s+${symbol}\\s*\\(`, 'g'), type: 'function_declaration', language: 'typescript' },
            
            // Method signatures in interfaces
            { pattern: new RegExp(`\\b${symbol}\\s*\\([^)]*\\)\\s*;`, 'g'), type: 'method_signature', language: 'typescript' },
            
            // C++ forward declarations
            { pattern: new RegExp(`\\bclass\\s+${symbol}\\s*;`, 'g'), type: 'forward_declaration', language: 'cpp' },
            
            // Function prototypes
            { pattern: new RegExp(`\\b\\w+\\s+${symbol}\\s*\\([^)]*\\)\\s*;`, 'g'), type: 'function_prototype', language: 'cpp' }
        ];
    }

    private async searchDefinitionsInFile(filePath: string, content: string, symbol: string, patterns: any[], options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const lines = content.split('\n');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder ? 
            path.relative(workspaceFolder.uri.fsPath, filePath) : 
            filePath;

        for (const { pattern, type, language } of patterns) {
            const ext = path.extname(filePath);
            if (!this.isLanguageMatch(language, ext)) continue;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;
                
                while ((match = pattern.exec(line)) !== null) {
                    const context = this.getLineContext(lines, i, 2);
                    const preview = options?.showPreview ? this.getCodePreview(lines, i, 5) : undefined;
                    
                    results.push({
                        type: 'definition',
                        file: filePath,
                        line: i + 1,
                        column: match.index + 1,
                        symbol,
                        context,
                        relativePath,
                        preview
                    });

                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }
                }
                
                pattern.lastIndex = 0;
            }
        }

        return results;
    }

    private async searchReferencesInFile(filePath: string, content: string, symbol: string, patterns: any[], options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const lines = content.split('\n');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder ? 
            path.relative(workspaceFolder.uri.fsPath, filePath) : 
            filePath;

        for (const { pattern, type, context } of patterns) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;
                
                while ((match = pattern.exec(line)) !== null) {
                    const lineContext = this.getLineContext(lines, i, 2);
                    const preview = options?.showPreview ? this.getCodePreview(lines, i, 5) : undefined;
                    
                    results.push({
                        type: 'reference',
                        file: filePath,
                        line: i + 1,
                        column: match.index + 1,
                        symbol,
                        context: lineContext,
                        relativePath,
                        preview
                    });

                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }
                }
                
                pattern.lastIndex = 0;
            }
        }

        return results;
    }

    private async searchImplementationsInFile(filePath: string, content: string, symbol: string, patterns: any[], options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const lines = content.split('\n');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder ? 
            path.relative(workspaceFolder.uri.fsPath, filePath) : 
            filePath;

        for (const { pattern, type, language } of patterns) {
            const ext = path.extname(filePath);
            if (!this.isLanguageMatch(language, ext)) continue;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;
                
                while ((match = pattern.exec(line)) !== null) {
                    const context = this.getLineContext(lines, i, 2);
                    const preview = options?.showPreview ? this.getCodePreview(lines, i, 5) : undefined;
                    
                    results.push({
                        type: 'implementation',
                        file: filePath,
                        line: i + 1,
                        column: match.index + 1,
                        symbol,
                        context,
                        relativePath,
                        preview
                    });

                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }
                }
                
                pattern.lastIndex = 0;
            }
        }

        return results;
    }

    private async searchDeclarationsInFile(filePath: string, content: string, symbol: string, patterns: any[], options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const lines = content.split('\n');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder ? 
            path.relative(workspaceFolder.uri.fsPath, filePath) : 
            filePath;

        for (const { pattern, type, language } of patterns) {
            const ext = path.extname(filePath);
            if (!this.isLanguageMatch(language, ext)) continue;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                let match;
                
                while ((match = pattern.exec(line)) !== null) {
                    const context = this.getLineContext(lines, i, 2);
                    const preview = options?.showPreview ? this.getCodePreview(lines, i, 5) : undefined;
                    
                    results.push({
                        type: 'declaration',
                        file: filePath,
                        line: i + 1,
                        column: match.index + 1,
                        symbol,
                        context,
                        relativePath,
                        preview
                    });

                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }
                }
                
                pattern.lastIndex = 0;
            }
        }

        return results;
    }

    private async extractFileSymbols(filePath: string, options: any): Promise<SymbolInfo[]> {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const symbols: SymbolInfo[] = [];
        const lines = content.split('\n');
        const ext = path.extname(filePath);

        // Extract symbols based on file type
        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            symbols.push(...this.extractTypeScriptSymbols(lines, filePath));
        } else if (ext === '.py') {
            symbols.push(...this.extractPythonSymbols(lines, filePath));
        } else if (ext === '.java') {
            symbols.push(...this.extractJavaSymbols(lines, filePath));
        }

        return symbols;
    }

    private extractTypeScriptSymbols(lines: string[], filePath: string): SymbolInfo[] {
        const symbols: SymbolInfo[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Functions
            const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
            if (funcMatch) {
                symbols.push({
                    name: funcMatch[1],
                    kind: 'Function',
                    location: { file: filePath, line: i + 1, column: funcMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Classes
            const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[1],
                    kind: 'Class',
                    location: { file: filePath, line: i + 1, column: classMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Interfaces
            const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                symbols.push({
                    name: interfaceMatch[1],
                    kind: 'Interface',
                    location: { file: filePath, line: i + 1, column: interfaceMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Constants/Variables
            const constMatch = line.match(/(?:export\s+)?const\s+(\w+)/);
            if (constMatch) {
                symbols.push({
                    name: constMatch[1],
                    kind: 'Constant',
                    location: { file: filePath, line: i + 1, column: constMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }
        }

        return symbols;
    }

    private extractPythonSymbols(lines: string[], filePath: string): SymbolInfo[] {
        const symbols: SymbolInfo[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Functions
            const funcMatch = line.match(/^(\s*)def\s+(\w+)\s*\(/);
            if (funcMatch) {
                symbols.push({
                    name: funcMatch[2],
                    kind: 'Function',
                    location: { file: filePath, line: i + 1, column: funcMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Classes
            const classMatch = line.match(/^(\s*)class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[2],
                    kind: 'Class',
                    location: { file: filePath, line: i + 1, column: classMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }
        }

        return symbols;
    }

    private extractJavaSymbols(lines: string[], filePath: string): SymbolInfo[] {
        const symbols: SymbolInfo[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Classes
            const classMatch = line.match(/(?:public\s+)?class\s+(\w+)/);
            if (classMatch) {
                symbols.push({
                    name: classMatch[1],
                    kind: 'Class',
                    location: { file: filePath, line: i + 1, column: classMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Interfaces
            const interfaceMatch = line.match(/(?:public\s+)?interface\s+(\w+)/);
            if (interfaceMatch) {
                symbols.push({
                    name: interfaceMatch[1],
                    kind: 'Interface',
                    location: { file: filePath, line: i + 1, column: interfaceMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }

            // Methods
            const methodMatch = line.match(/(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/);
            if (methodMatch) {
                symbols.push({
                    name: methodMatch[1],
                    kind: 'Method',
                    location: { file: filePath, line: i + 1, column: methodMatch.index! + 1 },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } }
                });
            }
        }

        return symbols;
    }

    private async extractWorkspaceSymbols(workspacePath: string, options: any): Promise<SymbolInfo[]> {
        const symbols: SymbolInfo[] = [];
        const files = await this.getRelevantFiles(workspacePath);
        
        for (const file of files.slice(0, options.maxResults || 100)) {
            try {
                const fileSymbols = await this.extractFileSymbols(file, options);
                symbols.push(...fileSymbols);
            } catch (error) {
                continue;
            }
        }

        return symbols;
    }

    private async searchWorkspaceSymbols(query: string, workspacePath: string, options: any): Promise<SymbolInfo[]> {
        const allSymbols = await this.extractWorkspaceSymbols(workspacePath, options);
        const queryLower = query.toLowerCase();
        
        return allSymbols.filter(symbol => 
            symbol.name.toLowerCase().includes(queryLower) ||
            symbol.kind.toLowerCase().includes(queryLower)
        ).slice(0, options.maxResults || 100);
    }

    private async buildCallHierarchy(symbol: string, contextFile?: string, options?: any): Promise<CallHierarchy> {
        const callers = await this.findSymbolReferences(symbol, contextFile, options);
        const callees = await this.findFunctionCalls(symbol, contextFile, options);
        
        return {
            symbol,
            callers: callers.filter(ref => ref.type === 'reference'),
            callees,
            hierarchy: this.buildHierarchyPath(symbol, callers)
        };
    }

    private async buildTypeHierarchy(symbol: string, contextFile?: string, options?: any): Promise<TypeHierarchy> {
        const baseTypes = await this.findBaseTypes(symbol, contextFile, options);
        const derivedTypes = await this.findDerivedTypes(symbol, contextFile, options);
        const interfaces = await this.findImplementedInterfaces(symbol, contextFile, options);
        
        return {
            symbol,
            baseTypes,
            derivedTypes,
            interfaces
        };
    }

    private async findFunctionCalls(functionName: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        // Find what functions this function calls
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return [];

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        const results: NavigationResult[] = [];
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                // Look for function calls within the function definition
                let inFunction = false;
                let braceCount = 0;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    if (line.includes(`function ${functionName}`) || line.includes(`${functionName}(`)) {
                        inFunction = true;
                    }
                    
                    if (inFunction) {
                        braceCount += (line.match(/\{/g) || []).length;
                        braceCount -= (line.match(/\}/g) || []).length;
                        
                        // Find function calls in this line
                        const callMatches = line.matchAll(/(\w+)\s*\(/g);
                        for (const match of callMatches) {
                            if (match[1] !== functionName) { // Don't include self-calls
                                results.push({
                                    type: 'reference',
                                    file,
                                    line: i + 1,
                                    column: match.index! + 1,
                                    symbol: match[1],
                                    context: this.getLineContext(lines, i, 1),
                                    relativePath: path.relative(workspaceFolder.uri.fsPath, file)
                                });
                            }
                        }
                        
                        if (braceCount === 0 && inFunction) {
                            break; // End of function
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return results;
    }

    private async findBaseTypes(className: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Find extends relationships
                    const extendsMatch = line.match(new RegExp(`class\\s+${className}\\s+extends\\s+(\\w+)`));
                    if (extendsMatch) {
                        results.push({
                            type: 'reference',
                            file,
                            line: i + 1,
                            column: extendsMatch.index! + 1,
                            symbol: extendsMatch[1],
                            context: this.getLineContext(lines, i, 1),
                            relativePath: path.relative(workspaceFolder.uri.fsPath, file)
                        });
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return results;
    }

    private async findDerivedTypes(className: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Find classes that extend this class
                    const extendsMatch = line.match(new RegExp(`class\\s+(\\w+)\\s+extends\\s+${className}`));
                    if (extendsMatch) {
                        results.push({
                            type: 'reference',
                            file,
                            line: i + 1,
                            column: extendsMatch.index! + 1,
                            symbol: extendsMatch[1],
                            context: this.getLineContext(lines, i, 1),
                            relativePath: path.relative(workspaceFolder.uri.fsPath, file)
                        });
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return results;
    }

    private async findImplementedInterfaces(className: string, contextFile?: string, options?: any): Promise<NavigationResult[]> {
        const results: NavigationResult[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return results;

        const files = await this.getRelevantFiles(workspaceFolder.uri.fsPath);
        
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Find interfaces implemented by this class
                    const implementsMatch = line.match(new RegExp(`class\\s+${className}\\s+.*implements\\s+([^{]+)`));
                    if (implementsMatch) {
                        const interfaces = implementsMatch[1].split(',').map(iface => iface.trim());
                        for (const iface of interfaces) {
                            results.push({
                                type: 'reference',
                                file,
                                line: i + 1,
                                column: implementsMatch.index! + 1,
                                symbol: iface,
                                context: this.getLineContext(lines, i, 1),
                                relativePath: path.relative(workspaceFolder.uri.fsPath, file)
                            });
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return results;
    }

    private async getRelevantFiles(workspacePath: string): Promise<string[]> {
        const files: string[] = [];
        
        const scanDir = async (dirPath: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (!this.shouldIgnoreDirectory(entry.name)) {
                            await scanDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (this.supportedExtensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directories that can't be read
            }
        };

        await scanDir(workspacePath);
        return files;
    }

    private shouldIgnoreDirectory(dirName: string): boolean {
        const ignoreDirs = [
            'node_modules', '.git', '.vscode', 'dist', 'build', 'coverage',
            '.next', '.nuxt', 'out', '__pycache__', '.pytest_cache',
            '.mypy_cache', 'target', 'bin', 'obj'
        ];
        return ignoreDirs.includes(dirName);
    }

    private isLanguageMatch(language: string, fileExt: string): boolean {
        const languageMap: Record<string, string[]> = {
            'typescript': ['.ts', '.tsx', '.js', '.jsx'],
            'python': ['.py'],
            'java': ['.java'],
            'cpp': ['.cpp', '.c', '.h', '.hpp'],
            'csharp': ['.cs'],
            'go': ['.go'],
            'rust': ['.rs']
        };
        
        return languageMap[language]?.includes(fileExt) || false;
    }

    private getLineContext(lines: string[], lineIndex: number, contextLines: number): string {
        const start = Math.max(0, lineIndex - contextLines);
        const end = Math.min(lines.length - 1, lineIndex + contextLines);
        
        const contextArray: string[] = [];
        for (let i = start; i <= end; i++) {
            const marker = i === lineIndex ? '>' : ' ';
            contextArray.push(`${marker} ${i + 1}: ${lines[i]}`);
        }
        
        return contextArray.join('\n');
    }

    private getCodePreview(lines: string[], lineIndex: number, previewLines: number): string {
        const start = Math.max(0, lineIndex - Math.floor(previewLines / 2));
        const end = Math.min(lines.length - 1, lineIndex + Math.floor(previewLines / 2));
        
        return lines.slice(start, end + 1).join('\n');
    }

    private groupResultsByFile(results: NavigationResult[]): Record<string, NavigationResult[]> {
        const grouped: Record<string, NavigationResult[]> = {};
        
        for (const result of results) {
            if (!grouped[result.file]) {
                grouped[result.file] = [];
            }
            grouped[result.file].push(result);
        }
        
        return grouped;
    }

    private groupSymbolsByFile(symbols: SymbolInfo[]): Record<string, SymbolInfo[]> {
        const grouped: Record<string, SymbolInfo[]> = {};
        
        for (const symbol of symbols) {
            if (!grouped[symbol.location.file]) {
                grouped[symbol.location.file] = [];
            }
            grouped[symbol.location.file].push(symbol);
        }
        
        return grouped;
    }

    private groupSymbolsByKind(symbols: SymbolInfo[]): Record<string, SymbolInfo[]> {
        const grouped: Record<string, SymbolInfo[]> = {};
        
        for (const symbol of symbols) {
            if (!grouped[symbol.kind]) {
                grouped[symbol.kind] = [];
            }
            grouped[symbol.kind].push(symbol);
        }
        
        return grouped;
    }

    private organizeSymbolsHierarchically(symbols: SymbolInfo[]): any {
        // Create a hierarchical structure of symbols
        const hierarchy: any = {
            classes: [],
            interfaces: [],
            functions: [],
            constants: [],
            types: [],
            other: []
        };
        
        for (const symbol of symbols) {
            switch (symbol.kind.toLowerCase()) {
                case 'class':
                    hierarchy.classes.push(symbol);
                    break;
                case 'interface':
                    hierarchy.interfaces.push(symbol);
                    break;
                case 'function':
                case 'method':
                    hierarchy.functions.push(symbol);
                    break;
                case 'constant':
                case 'variable':
                    hierarchy.constants.push(symbol);
                    break;
                case 'type':
                case 'enum':
                    hierarchy.types.push(symbol);
                    break;
                default:
                    hierarchy.other.push(symbol);
            }
        }
        
        return hierarchy;
    }

    private rankResults(results: NavigationResult[], contextFile?: string): NavigationResult[] {
        // Rank results by relevance
        return results.sort((a, b) => {
            // Prefer results from the context file
            if (contextFile) {
                if (a.file === contextFile && b.file !== contextFile) return -1;
                if (b.file === contextFile && a.file !== contextFile) return 1;
            }
            
            // Prefer definitions over references
            if (a.type === 'definition' && b.type !== 'definition') return -1;
            if (b.type === 'definition' && a.type !== 'definition') return 1;
            
            // Then by file name (shorter paths first)
            const aPathLength = a.relativePath.split('/').length;
            const bPathLength = b.relativePath.split('/').length;
            if (aPathLength !== bPathLength) return aPathLength - bPathLength;
            
            // Finally by line number
            return a.line - b.line;
        });
    }

    private findBestMatch(results: NavigationResult[], contextFile: string, contextLine: number): NavigationResult | null {
        // Find the most relevant result based on context
        for (const result of results) {
            if (result.file === contextFile) {
                return result;
            }
        }
        
        // If no match in the same file, return the first result
        return results[0] || null;
    }

    private buildHierarchyPath(symbol: string, callers: NavigationResult[]): string[] {
        // Build a call hierarchy path
        const path = [symbol];
        
        // Add immediate callers
        const uniqueCallers = [...new Set(callers.map(caller => caller.symbol))];
        path.unshift(...uniqueCallers.slice(0, 5)); // Limit to 5 levels
        
        return path;
    }
}

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface RetrievalContext {
    files: ContextualFile[];
    relevanceScore: number;
    totalMatches: number;
    searchMetadata: SearchMetadata;
}

export interface ContextualFile {
    path: string;
    content: string;
    language: string;
    relevanceScore: number;
    matchRanges: MatchRange[];
    dependencies: string[];
    exports: string[];
    imports: string[];
    functions: FunctionInfo[];
    classes: ClassInfo[];
    interfaces: InterfaceInfo[];
    types: TypeInfo[];
}

export interface MatchRange {
    start: number;
    end: number;
    type: 'exact' | 'semantic' | 'fuzzy';
    confidence: number;
}

export interface SearchMetadata {
    query: string;
    searchType: SearchType;
    timeMs: number;
    totalFilesScanned: number;
    includedLanguages: string[];
    excludedPatterns: string[];
}

export interface FunctionInfo {
    name: string;
    line: number;
    parameters: string[];
    returnType: string;
    isExported: boolean;
}

export interface ClassInfo {
    name: string;
    line: number;
    methods: string[];
    properties: string[];
    extends?: string;
    implements: string[];
    isExported: boolean;
}

export interface InterfaceInfo {
    name: string;
    line: number;
    properties: string[];
    methods: string[];
    extends: string[];
    isExported: boolean;
}

export interface TypeInfo {
    name: string;
    line: number;
    definition: string;
    isExported: boolean;
}

export type SearchType = 'semantic' | 'keyword' | 'function' | 'class' | 'interface' | 'type' | 'dependency' | 'usage' | 'pattern';

export interface SearchOptions {
    maxFiles?: number;
    maxFileSize?: number;
    includeLanguages?: string[];
    excludeLanguages?: string[];
    includePatterns?: string[];
    excludePatterns?: string[];
    searchType?: SearchType;
    fuzzyThreshold?: number;
    includeTests?: boolean;
    includeDocs?: boolean;
    contextWindow?: number;
}

export class ContextRetrievalEngine {
    private static instance: ContextRetrievalEngine;
    
    private defaultExcludePatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.map',
        '**/logs/**',
        '**/temp/**',
        '**/tmp/**',
        '**/.vscode/**',
        '**/.idea/**'
    ];

    private codePatterns = {
        typescript: {
            function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/g,
            class: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/g,
            interface: /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?/g,
            type: /(?:export\s+)?type\s+(\w+)\s*=/g,
            import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
            export: /export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+(\w+)/g
        },
        javascript: {
            function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
            class: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/g,
            import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
            export: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g
        },
        python: {
            function: /def\s+(\w+)\s*\([^)]*\):/g,
            class: /class\s+(\w+)(?:\([^)]*\))?:/g,
            import: /(?:from\s+[\w.]+\s+)?import\s+([\w,\s]+)/g
        },
        java: {
            function: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\([^)]*\)/g,
            class: /(?:public|private|protected)?\s*class\s+(\w+)(?:\s+extends\s+\w+)?/g,
            interface: /(?:public|private|protected)?\s*interface\s+(\w+)/g,
            import: /import\s+([\w.]+);/g
        }
    };

    private constructor() {}

    public static getInstance(): ContextRetrievalEngine {
        if (!ContextRetrievalEngine.instance) {
            ContextRetrievalEngine.instance = new ContextRetrievalEngine();
        }
        return ContextRetrievalEngine.instance;
    }

    /**
     * Main retrieval method - intelligently finds relevant context based on query
     */
    public async retrieveContext(query: string, options: SearchOptions = {}): Promise<RetrievalContext> {
        const startTime = Date.now();
        const searchType = this.determineSearchType(query);
        
        const searchOptions: Required<SearchOptions> = {
            maxFiles: options.maxFiles || 50,
            maxFileSize: options.maxFileSize || 1024 * 1024,
            includeLanguages: options.includeLanguages || [],
            excludeLanguages: options.excludeLanguages || [],
            includePatterns: options.includePatterns || [],
            excludePatterns: options.excludePatterns || this.defaultExcludePatterns,
            searchType: options.searchType || searchType,
            fuzzyThreshold: options.fuzzyThreshold || 0.6,
            includeTests: options.includeTests || false,
            includeDocs: options.includeDocs || true,
            contextWindow: options.contextWindow || 50
        };

        const files = await this.findRelevantFiles(query, searchOptions);
        const analyzedFiles = await this.analyzeFiles(files, query, searchOptions);
        const rankedFiles = this.rankByRelevance(analyzedFiles, query, searchOptions);

        const endTime = Date.now();

        return {
            files: rankedFiles.slice(0, searchOptions.maxFiles),
            relevanceScore: this.calculateOverallRelevance(rankedFiles),
            totalMatches: rankedFiles.length,
            searchMetadata: {
                query,
                searchType: searchOptions.searchType,
                timeMs: endTime - startTime,
                totalFilesScanned: files.length,
                includedLanguages: [...new Set(rankedFiles.map(f => f.language))],
                excludedPatterns: searchOptions.excludePatterns
            }
        };
    }

    /**
     * Semantic search for code concepts and functionality
     */
    public async semanticSearch(concept: string, options: SearchOptions = {}): Promise<RetrievalContext> {
        const semanticKeywords = this.expandSemanticQuery(concept);
        const combinedQuery = [concept, ...semanticKeywords].join(' ');
        
        return this.retrieveContext(combinedQuery, {
            ...options,
            searchType: 'semantic',
            fuzzyThreshold: 0.4
        });
    }

    /**
     * Find files that use/import a specific function/class/module
     */
    public async findUsages(identifier: string, options: SearchOptions = {}): Promise<RetrievalContext> {
        return this.retrieveContext(identifier, {
            ...options,
            searchType: 'usage'
        });
    }

    /**
     * Find related files through dependency analysis
     */
    public async findRelatedFiles(filePath: string, options: SearchOptions = {}): Promise<RetrievalContext> {
        const baseFile = await this.analyzeFile(filePath);
        if (!baseFile) {
            return {
                files: [],
                relevanceScore: 0,
                totalMatches: 0,
                searchMetadata: {
                    query: filePath,
                    searchType: 'dependency',
                    timeMs: 0,
                    totalFilesScanned: 0,
                    includedLanguages: [],
                    excludedPatterns: []
                }
            };
        }

        // Create search query from imports/exports
        const relatedQuery = [
            ...baseFile.imports,
            ...baseFile.exports,
            ...baseFile.functions.map(f => f.name),
            ...baseFile.classes.map(c => c.name)
        ].join(' ');

        return this.retrieveContext(relatedQuery, {
            ...options,
            searchType: 'dependency'
        });
    }

    private determineSearchType(query: string): SearchType {
        // Function patterns
        if (/\b(function|def|method)\b/.test(query.toLowerCase()) || /\(\)$/.test(query)) {
            return 'function';
        }
        
        // Class patterns
        if (/\b(class|extends|implements)\b/.test(query.toLowerCase())) {
            return 'class';
        }
        
        // Interface/Type patterns
        if (/\b(interface|type)\b/.test(query.toLowerCase())) {
            return 'interface';
        }
        
        // Import/Usage patterns
        if (/\b(import|require|use|using)\b/.test(query.toLowerCase())) {
            return 'dependency';
        }
        
        // Pattern matching
        if (/[.*+?^${}()|[\]\\]/.test(query)) {
            return 'pattern';
        }
        
        // Default to semantic for natural language queries
        if (query.split(' ').length > 2) {
            return 'semantic';
        }
        
        return 'keyword';
    }

    private expandSemanticQuery(concept: string): string[] {
        const expansions: Record<string, string[]> = {
            'authentication': ['auth', 'login', 'token', 'jwt', 'session', 'user', 'password', 'credential'],
            'database': ['db', 'sql', 'query', 'connection', 'model', 'schema', 'orm', 'entity'],
            'api': ['endpoint', 'route', 'controller', 'request', 'response', 'http', 'rest', 'graphql'],
            'error': ['exception', 'try', 'catch', 'throw', 'error', 'failure', 'handler'],
            'test': ['spec', 'unit', 'integration', 'mock', 'assert', 'expect', 'describe', 'it'],
            'config': ['configuration', 'settings', 'environment', 'env', 'options', 'parameters'],
            'validation': ['validate', 'check', 'verify', 'sanitize', 'schema', 'rules'],
            'logging': ['log', 'logger', 'debug', 'info', 'warn', 'error', 'trace']
        };

        const words = concept.toLowerCase().split(' ');
        const expanded = new Set<string>();

        for (const word of words) {
            if (expansions[word]) {
                expansions[word].forEach(exp => expanded.add(exp));
            }
        }

        return Array.from(expanded);
    }

    private async findRelevantFiles(query: string, options: Required<SearchOptions>): Promise<vscode.Uri[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        // Build include pattern
        let includePattern = '**/*';
        if (options.includeLanguages.length > 0) {
            const extensions = this.getExtensionsForLanguages(options.includeLanguages);
            includePattern = `**/*.{${extensions.join(',')}}`;
        }

        // Build exclude pattern
        let excludePattern = `{${options.excludePatterns.join(',')}}`;
        
        if (!options.includeTests) {
            excludePattern = excludePattern.slice(0, -1) + ',**/*test*,**/*spec*,**/tests/**,**/test/**}';
        }

        if (!options.includeDocs) {
            excludePattern = excludePattern.slice(0, -1) + ',**/*.md,**/docs/**,**/documentation/**}';
        }

        return vscode.workspace.findFiles(
            includePattern,
            excludePattern,
            options.maxFiles * 3 // Get more files to filter later
        );
    }

    private getExtensionsForLanguages(languages: string[]): string[] {
        const languageMap: Record<string, string[]> = {
            'typescript': ['ts', 'tsx'],
            'javascript': ['js', 'jsx', 'mjs'],
            'python': ['py', 'pyw'],
            'java': ['java'],
            'csharp': ['cs'],
            'cpp': ['cpp', 'cc', 'cxx', 'h', 'hpp'],
            'go': ['go'],
            'rust': ['rs'],
            'php': ['php'],
            'ruby': ['rb'],
            'swift': ['swift'],
            'kotlin': ['kt', 'kts']
        };

        const extensions: string[] = [];
        for (const lang of languages) {
            if (languageMap[lang]) {
                extensions.push(...languageMap[lang]);
            }
        }
        return extensions;
    }

    private async analyzeFiles(uris: vscode.Uri[], query: string, options: Required<SearchOptions>): Promise<ContextualFile[]> {
        const analyzed: ContextualFile[] = [];
        
        for (const uri of uris) {
            const file = await this.analyzeFile(uri.fsPath);
            if (file) {
                // Calculate relevance and matches for this specific query
                const { relevanceScore, matchRanges } = this.calculateFileRelevance(file, query, options);
                
                if (relevanceScore > 0) {
                    file.relevanceScore = relevanceScore;
                    file.matchRanges = matchRanges;
                    analyzed.push(file);
                }
            }
        }

        return analyzed;
    }

    public async analyzeFile(filePath: string): Promise<ContextualFile | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            const stat = await vscode.workspace.fs.stat(uri);
            
            if (stat.size > 1024 * 1024) { // 1MB limit
                return null;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const language = document.languageId;

            const analysis = this.performCodeAnalysis(content, language);

            return {
                path: filePath,
                content,
                language,
                relevanceScore: 0, // Will be calculated later
                matchRanges: [],
                dependencies: analysis.dependencies,
                exports: analysis.exports,
                imports: analysis.imports,
                functions: analysis.functions,
                classes: analysis.classes,
                interfaces: analysis.interfaces,
                types: analysis.types
            };
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
            return null;
        }
    }

    private performCodeAnalysis(content: string, language: string) {
        const patterns = this.codePatterns[language as keyof typeof this.codePatterns] || this.codePatterns.typescript;
        
        const analysis = {
            dependencies: [] as string[],
            exports: [] as string[],
            imports: [] as string[],
            functions: [] as FunctionInfo[],
            classes: [] as ClassInfo[],
            interfaces: [] as InterfaceInfo[],
            types: [] as TypeInfo[]
        };

        // Extract imports
        if (patterns.import) {
            const importMatches = content.matchAll(patterns.import);
            for (const match of importMatches) {
                analysis.imports.push(match[1]);
                analysis.dependencies.push(match[1]);
            }
        }

        // Extract exports
        if ('export' in patterns && patterns.export) {
            const exportMatches = content.matchAll(patterns.export);
            for (const match of exportMatches) {
                analysis.exports.push(match[1]);
            }
        }

        // Extract functions
        if (patterns.function) {
            const functionMatches = content.matchAll(patterns.function);
            for (const match of functionMatches) {
                const line = content.substring(0, match.index!).split('\n').length;
                analysis.functions.push({
                    name: match[1],
                    line,
                    parameters: [], // Could be enhanced
                    returnType: '',
                    isExported: analysis.exports.includes(match[1])
                });
            }
        }

        // Extract classes
        if (patterns.class) {
            const classMatches = content.matchAll(patterns.class);
            for (const match of classMatches) {
                const line = content.substring(0, match.index!).split('\n').length;
                analysis.classes.push({
                    name: match[1],
                    line,
                    methods: [],
                    properties: [],
                    implements: [],
                    isExported: analysis.exports.includes(match[1])
                });
            }
        }

        // Extract interfaces
        if ('interface' in patterns && patterns.interface) {
            const interfaceMatches = content.matchAll(patterns.interface);
            for (const match of interfaceMatches) {
                const line = content.substring(0, match.index!).split('\n').length;
                analysis.interfaces.push({
                    name: match[1],
                    line,
                    properties: [],
                    methods: [],
                    extends: [],
                    isExported: analysis.exports.includes(match[1])
                });
            }
        }

        // Extract types
        if ('type' in patterns && patterns.type) {
            const typeMatches = content.matchAll(patterns.type);
            for (const match of typeMatches) {
                const line = content.substring(0, match.index!).split('\n').length;
                analysis.types.push({
                    name: match[1],
                    line,
                    definition: '',
                    isExported: analysis.exports.includes(match[1])
                });
            }
        }

        return analysis;
    }

    private calculateFileRelevance(file: ContextualFile, query: string, options: Required<SearchOptions>) {
        let relevanceScore = 0;
        const matchRanges: MatchRange[] = [];
        const queryLower = query.toLowerCase();
        const contentLower = file.content.toLowerCase();

        // Exact matches (highest weight)
        const exactMatches = this.findExactMatches(contentLower, queryLower);
        relevanceScore += exactMatches.length * 10;
        matchRanges.push(...exactMatches);

        // Semantic matches based on search type
        switch (options.searchType) {
            case 'function':
                relevanceScore += this.scoreFunctionMatches(file, query) * 8;
                break;
            case 'class':
                relevanceScore += this.scoreClassMatches(file, query) * 8;
                break;
            case 'interface':
                relevanceScore += this.scoreInterfaceMatches(file, query) * 8;
                break;
            case 'dependency':
                relevanceScore += this.scoreDependencyMatches(file, query) * 6;
                break;
            case 'semantic':
                relevanceScore += this.scoreSemanticMatches(file, query) * 4;
                break;
        }

        // File name relevance
        const fileName = path.basename(file.path).toLowerCase();
        if (fileName.includes(queryLower)) {
            relevanceScore += 15;
        }

        // Language preference
        if (options.includeLanguages.includes(file.language)) {
            relevanceScore += 5;
        }

        // File size penalty (prefer smaller, more focused files)
        const sizeKB = file.content.length / 1024;
        if (sizeKB > 100) {
            relevanceScore *= 0.8;
        }

        return { relevanceScore, matchRanges };
    }

    private findExactMatches(content: string, query: string): MatchRange[] {
        const matches: MatchRange[] = [];
        let index = 0;
        
        while ((index = content.indexOf(query, index)) !== -1) {
            matches.push({
                start: index,
                end: index + query.length,
                type: 'exact',
                confidence: 1.0
            });
            index += query.length;
        }
        
        return matches;
    }

    private scoreFunctionMatches(file: ContextualFile, query: string): number {
        const queryLower = query.toLowerCase();
        let score = 0;
        
        for (const func of file.functions) {
            if (func.name.toLowerCase().includes(queryLower)) {
                score += func.isExported ? 3 : 2;
            }
        }
        
        return score;
    }

    private scoreClassMatches(file: ContextualFile, query: string): number {
        const queryLower = query.toLowerCase();
        let score = 0;
        
        for (const cls of file.classes) {
            if (cls.name.toLowerCase().includes(queryLower)) {
                score += cls.isExported ? 3 : 2;
            }
        }
        
        return score;
    }

    private scoreInterfaceMatches(file: ContextualFile, query: string): number {
        const queryLower = query.toLowerCase();
        let score = 0;
        
        for (const iface of file.interfaces) {
            if (iface.name.toLowerCase().includes(queryLower)) {
                score += iface.isExported ? 3 : 2;
            }
        }
        
        return score;
    }

    private scoreDependencyMatches(file: ContextualFile, query: string): number {
        const queryLower = query.toLowerCase();
        let score = 0;
        
        for (const dep of file.dependencies) {
            if (dep.toLowerCase().includes(queryLower)) {
                score += 2;
            }
        }
        
        return score;
    }

    private scoreSemanticMatches(file: ContextualFile, query: string): number {
        // Simple semantic scoring based on keyword density
        const keywords = query.toLowerCase().split(' ');
        const contentLower = file.content.toLowerCase();
        let score = 0;
        
        for (const keyword of keywords) {
            const occurrences = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
            score += Math.min(occurrences, 5); // Cap to avoid spam
        }
        
        return score;
    }

    private rankByRelevance(files: ContextualFile[], query: string, options: Required<SearchOptions>): ContextualFile[] {
        return files.sort((a, b) => {
            // Primary sort by relevance score
            if (a.relevanceScore !== b.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            
            // Secondary sort by file name relevance
            const queryLower = query.toLowerCase();
            const aNameMatch = path.basename(a.path).toLowerCase().includes(queryLower);
            const bNameMatch = path.basename(b.path).toLowerCase().includes(queryLower);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            // Tertiary sort by file size (prefer smaller files)
            return a.content.length - b.content.length;
        });
    }

    private calculateOverallRelevance(files: ContextualFile[]): number {
        if (files.length === 0) return 0;
        
        const totalScore = files.reduce((sum, file) => sum + file.relevanceScore, 0);
        const avgScore = totalScore / files.length;
        
        // Normalize to 0-1 range
        return Math.min(avgScore / 100, 1.0);
    }

    /**
     * Get file suggestions based on current context
     */
    public async getContextSuggestions(currentFile?: string): Promise<ContextualFile[]> {
        if (!currentFile) {
            // Return recently modified files
            return this.getRecentlyModifiedFiles();
        }
        
        // Return related files
        const related = await this.findRelatedFiles(currentFile, { maxFiles: 10 });
        return related.files;
    }

    private async getRecentlyModifiedFiles(): Promise<ContextualFile[]> {
        const uris = await vscode.workspace.findFiles(
            '**/*',
            `{${this.defaultExcludePatterns.join(',')}}`,
            20
        );
        
        const files: ContextualFile[] = [];
        for (const uri of uris) {
            const file = await this.analyzeFile(uri.fsPath);
            if (file) {
                files.push(file);
            }
        }
        
        return files;
    }
}

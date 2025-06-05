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

export type SearchType = 'semantic' | 'keyword' | 'function' | 'class' | 'interface' | 'type' | 'dependency' | 'usage' | 'pattern' | 'architecture' | 'debugging' | 'testing' | 'performance' | 'security';

export interface QueryIntent {
    type: 'social' | 'debugging' | 'architecture' | 'review' | 'implementation' | 'learning' | 'testing' | 'performance' | 'security' | 'deployment' | 'documentation' | 'quickfix' | 'technical' | 'general';
    requiresContext: boolean;
    contextConfig: {
        maxFiles: number;
        minRelevanceScore: number;
        searchStrategy?: 'focused' | 'comprehensive' | 'minimal' | 'educational' | 'testing' | 'security' | 'infrastructure';
        priorityFiles?: string[];
        excludeTypes?: string[];
        includeRelated?: boolean;
    };
    priority: 'none' | 'low' | 'medium' | 'high' | 'critical';
    scope: 'none' | 'minimal' | 'focused' | 'comprehensive' | 'educational' | 'testing' | 'security' | 'infrastructure';
    contextSources?: ('files' | 'dependencies' | 'tests' | 'docs' | 'config' | 'git' | 'symbols')[];
}

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
        
        // 🧠 INTELLIGENT QUERY ANALYSIS
        const intent = this.analyzeQueryIntent(query);
        
        // Skip context retrieval for non-technical queries
        if (!intent.requiresContext) {
            return {
                files: [],
                relevanceScore: 0,
                totalMatches: 0,
                searchMetadata: {
                    query,
                    searchType: 'semantic',
                    timeMs: Date.now() - startTime,
                    totalFilesScanned: 0,
                    includedLanguages: [],
                    excludedPatterns: []
                }
            };
        }

        // 🎯 DYNAMIC SEARCH STRATEGY
        const enhancedOptions = this.buildEnhancedSearchOptions(query, intent, options);
        
        // 🔍 MULTI-MODAL CONTEXT RETRIEVAL
        const contextSources = await this.gatherMultiModalContext(query, intent, enhancedOptions);
        
        // 🏗️ PROJECT TOPOLOGY ANALYSIS
        const topologyContext = await this.analyzeProjectTopology(query, intent);
        
        // 🔗 DEPENDENCY GRAPH ANALYSIS  
        const dependencyContext = await this.analyzeDependencyGraph(query, intent);
        
        // 📊 SMART RELEVANCE SCORING
        const scoredFiles = this.applyAdvancedRelevanceScoring(
            [...contextSources.files, ...topologyContext, ...dependencyContext],
            query,
            intent,
            enhancedOptions
        );
        
        // 🎛️ DYNAMIC FILTERING & PRIORITIZATION
        const finalFiles = this.applyIntelligentFiltering(scoredFiles, intent, enhancedOptions);

        const endTime = Date.now();

        return {
            files: finalFiles.slice(0, intent.contextConfig.maxFiles),
            relevanceScore: this.calculateAdvancedRelevance(finalFiles, intent),
            totalMatches: finalFiles.length,
            searchMetadata: {
                query,
                searchType: enhancedOptions.searchType,
                timeMs: endTime - startTime,
                totalFilesScanned: contextSources.totalScanned,
                includedLanguages: [...new Set(finalFiles.map(f => f.language))],
                excludedPatterns: enhancedOptions.excludePatterns
            }
        };
    }

    // ===================================================================
    // 🧠 ADVANCED INTELLIGENT CONTEXT ANALYSIS SYSTEM
    // ===================================================================

    /**
     * 🎯 Advanced Query Intent Analysis - Most sophisticated classification system
     */
    private analyzeQueryIntent(query: string): QueryIntent {
        const message = query.toLowerCase().trim();
        const tokens = message.split(/\s+/);
        const entities = this.extractNamedEntities(message);
        const technicalTerms = this.identifyTechnicalTerms(message);
        const actionVerbs = this.extractActionVerbs(message);
        const complexity = this.assessQueryComplexity(message, tokens);

        // === SOCIAL/CONVERSATIONAL DETECTION ===
        if (this.isSocialQuery(message, tokens)) {
            return this.createIntent('social', false, { maxFiles: 0, minRelevanceScore: 1.0 }, 'none', 'none');
        }

        // === CRITICAL DEBUGGING SCENARIOS ===
        if (this.isEmergencyDebugging(message, tokens, entities)) {
            return this.createIntent('debugging', true, {
                maxFiles: 25,
                minRelevanceScore: 0.15,
                searchStrategy: 'comprehensive',
                includeRelated: true
            }, 'critical', 'comprehensive', ['files', 'dependencies', 'tests', 'git']);
        }

        // === ARCHITECTURAL ANALYSIS ===
        if (this.isArchitecturalAnalysis(message, tokens, entities, technicalTerms)) {
            return this.createIntent('architecture', true, {
                maxFiles: 30,
                minRelevanceScore: 0.2,
                searchStrategy: 'comprehensive',
                includeRelated: true
            }, 'high', 'comprehensive', ['files', 'dependencies', 'config', 'docs']);
        }

        // === PERFORMANCE OPTIMIZATION ===
        if (this.isPerformanceAnalysis(message, tokens, technicalTerms)) {
            return this.createIntent('performance', true, {
                maxFiles: 20,
                minRelevanceScore: 0.25,
                searchStrategy: 'comprehensive',
                priorityFiles: ['*.perf.*', '*.benchmark.*', '*.config.*']
            }, 'high', 'comprehensive', ['files', 'dependencies', 'tests']);
        }

        // === SECURITY AUDIT ===
        if (this.isSecurityAnalysis(message, tokens, technicalTerms)) {
            return this.createIntent('security', true, {
                maxFiles: 18,
                minRelevanceScore: 0.25,
                searchStrategy: 'security',
                priorityFiles: ['*auth*', '*security*', '*crypto*', '*session*']
            }, 'high', 'security', ['files', 'dependencies', 'config']);
        }

        // === CODE REVIEW & QUALITY ===
        if (this.isCodeReviewQuery(message, tokens, actionVerbs)) {
            return this.createIntent('review', true, {
                maxFiles: 15,
                minRelevanceScore: 0.3,
                searchStrategy: 'focused',
                includeRelated: true
            }, 'medium', 'comprehensive', ['files', 'tests', 'docs']);
        }

        // === TESTING SCENARIOS ===
        if (this.isTestingQuery(message, tokens, technicalTerms)) {
            return this.createIntent('testing', true, {
                maxFiles: 12,
                minRelevanceScore: 0.3,
                searchStrategy: 'testing',
                priorityFiles: ['*.test.*', '*.spec.*', '__tests__/*']
            }, 'medium', 'testing', ['files', 'tests', 'dependencies']);
        }

        // === IMPLEMENTATION TASKS ===
        if (this.isImplementationQuery(message, tokens, actionVerbs, complexity)) {
            const contextSize = complexity > 0.7 ? 15 : complexity > 0.4 ? 10 : 8;
            return this.createIntent('implementation', true, {
                maxFiles: contextSize,
                minRelevanceScore: 0.35,
                searchStrategy: 'focused',
                includeRelated: true
            }, 'medium', 'focused', ['files', 'dependencies', 'symbols']);
        }

        // === LEARNING & EXPLANATION ===
        if (this.isLearningQuery(message, tokens, actionVerbs)) {
            return this.createIntent('learning', true, {
                maxFiles: 8,
                minRelevanceScore: 0.4,
                searchStrategy: 'educational',
                includeRelated: true
            }, 'medium', 'educational', ['files', 'docs', 'symbols']);
        }

        // === DEPLOYMENT & DEVOPS ===
        if (this.isDeploymentQuery(message, tokens, technicalTerms)) {
            return this.createIntent('deployment', true, {
                maxFiles: 10,
                minRelevanceScore: 0.35,
                searchStrategy: 'infrastructure',
                priorityFiles: ['*docker*', '*deploy*', '*config*', '*env*']
            }, 'medium', 'infrastructure', ['files', 'config', 'docs']);
        }

        // === DOCUMENTATION TASKS ===
        if (this.isDocumentationQuery(message, tokens)) {
            return this.createIntent('documentation', true, {
                maxFiles: 6,
                minRelevanceScore: 0.4,
                searchStrategy: 'focused'
            }, 'low', 'focused', ['files', 'docs']);
        }

        // === QUICK FIXES ===
        if (this.isQuickFixQuery(message, tokens, complexity)) {
            return this.createIntent('quickfix', true, {
                maxFiles: 3,
                minRelevanceScore: 0.6,
                searchStrategy: 'minimal'
            }, 'low', 'minimal', ['files']);
        }

        // === GENERAL TECHNICAL ===
        if (this.hasTechnicalIndicators(message, tokens, technicalTerms)) {
            return this.createIntent('technical', true, {
                maxFiles: 6,
                minRelevanceScore: 0.5,
                searchStrategy: 'focused'
            }, 'medium', 'focused', ['files', 'symbols']);
        }

        // === NON-TECHNICAL FALLBACK ===
        return this.createIntent('general', false, { maxFiles: 0, minRelevanceScore: 1.0 }, 'none', 'none');
    }

    /**
     * 🏗️ Advanced Project Topology Analysis
     */
    private async analyzeProjectTopology(query: string, intent: QueryIntent): Promise<ContextualFile[]> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return [];

        const topologyFiles: ContextualFile[] = [];
        
        // Analyze project structure patterns
        const structurePatterns = await this.identifyProjectStructure(workspace.uri.fsPath);
        
        // Find architectural entry points
        if (intent.scope === 'comprehensive' || intent.type === 'architecture') {
            const entryPoints = await this.findArchitecturalEntryPoints(workspace.uri.fsPath, structurePatterns);
            topologyFiles.push(...entryPoints);
        }

        // Identify core configuration files
        if (intent.contextSources?.includes('config')) {
            const configFiles = await this.findConfigurationFiles(workspace.uri.fsPath);
            topologyFiles.push(...configFiles);
        }

        return topologyFiles;
    }

    /**
     * 🔗 Advanced Dependency Graph Analysis
     */
    private async analyzeDependencyGraph(query: string, intent: QueryIntent): Promise<ContextualFile[]> {
        if (!intent.contextSources?.includes('dependencies')) return [];

        const dependencyFiles: ContextualFile[] = [];
        
        // Analyze import/export relationships
        const importGraph = await this.buildImportGraph();
        
        // Find dependency clusters relevant to query
        const relevantClusters = this.findRelevantDependencyClusters(query, importGraph);
        
        // Include critical dependency files
        for (const cluster of relevantClusters) {
            dependencyFiles.push(...cluster.files);
        }

        return dependencyFiles;
    }

    /**
     * 🔍 Multi-Modal Context Gathering
     */
    private async gatherMultiModalContext(query: string, intent: QueryIntent, options: Required<SearchOptions>): Promise<{files: ContextualFile[], totalScanned: number}> {
        const contextFiles: ContextualFile[] = [];
        let totalScanned = 0;

        // 1. SEMANTIC FILE SEARCH
        const semanticFiles = await this.findRelevantFiles(query, options);
        totalScanned += semanticFiles.length;
        
        const analyzedFiles = await this.analyzeFiles(semanticFiles, query, options);
        contextFiles.push(...analyzedFiles);

        // 2. SYMBOL-BASED SEARCH
        if (intent.contextSources?.includes('symbols')) {
            const symbolFiles = await this.findFilesBySymbols(query, options);
            contextFiles.push(...symbolFiles);
        }

        // 3. GIT HISTORY ANALYSIS
        if (intent.contextSources?.includes('git')) {
            const recentlyModified = await this.findRecentlyModifiedFiles(query);
            contextFiles.push(...recentlyModified);
        }

        // 4. TEST FILE CORRELATION
        if (intent.contextSources?.includes('tests')) {
            const testFiles = await this.findRelatedTestFiles(query, contextFiles);
            contextFiles.push(...testFiles);
        }

        return { files: contextFiles, totalScanned };
    }

    /**
     * Helper method to create intent objects
     */
    private createIntent(
        type: QueryIntent['type'], 
        requiresContext: boolean, 
        contextConfig: QueryIntent['contextConfig'], 
        priority: QueryIntent['priority'], 
        scope: QueryIntent['scope'],
        contextSources?: QueryIntent['contextSources']
    ): QueryIntent {
        return { type, requiresContext, contextConfig, priority, scope, contextSources };
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

        // Get the active workspace folder (the one containing the active file)
        let targetWorkspaceFolder = workspaceFolders[0]; // Default to first
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor) {
            const activeFile = activeEditor.document.uri;
            const matchingFolder = vscode.workspace.getWorkspaceFolder(activeFile);
            if (matchingFolder) {
                targetWorkspaceFolder = matchingFolder;
            }
        }

        // Build include pattern - constrain to workspace folders only
        let includePattern = '**/*';
        if (options.includeLanguages.length > 0) {
            const extensions = this.getExtensionsForLanguages(options.includeLanguages);
            includePattern = `**/*.{${extensions.join(',')}}`;
        }

        // Build exclude pattern with additional safety constraints
        let excludePattern = `{${options.excludePatterns.join(',')}}`;
        
        if (!options.includeTests) {
            excludePattern = excludePattern.slice(0, -1) + ',**/*test*,**/*spec*,**/tests/**,**/test/**}';
        }

        if (!options.includeDocs) {
            excludePattern = excludePattern.slice(0, -1) + ',**/*.md,**/docs/**,**/documentation/**}';
        }

        // Search only within the target workspace folder
        const relativePattern = new vscode.RelativePattern(targetWorkspaceFolder, includePattern);
        const files = await vscode.workspace.findFiles(
            relativePattern,
            excludePattern,
            options.maxFiles * 3 // Get more files to filter later
        );
        
        // Double-check that files are within workspace folder
        const validFiles = files.filter(file => 
            file.fsPath.startsWith(targetWorkspaceFolder.uri.fsPath)
        );
        
        return validFiles;
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
            
            if (aNameMatch && !bNameMatch) {return -1;}
            if (!aNameMatch && bNameMatch) {return 1;}
            
            // Tertiary sort by file size (prefer smaller files)
            return a.content.length - b.content.length;
        });
    }

    private calculateOverallRelevance(files: ContextualFile[]): number {
        if (files.length === 0) {return 0;}
        
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
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        // Get the active workspace folder (the one containing the active file)
        let targetWorkspaceFolder = workspaceFolders[0]; // Default to first
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor) {
            const activeFile = activeEditor.document.uri;
            const matchingFolder = vscode.workspace.getWorkspaceFolder(activeFile);
            if (matchingFolder) {
                targetWorkspaceFolder = matchingFolder;
            }
        }

        const relativePattern = new vscode.RelativePattern(targetWorkspaceFolder, '**/*');
        const uris = await vscode.workspace.findFiles(
            relativePattern,
            `{${this.defaultExcludePatterns.join(',')}}`,
            20
        );
        
        // Ensure files are within workspace folder
        const validFiles = uris.filter(file => 
            file.fsPath.startsWith(targetWorkspaceFolder.uri.fsPath)
        );
        
        const files: ContextualFile[] = [];
        for (const uri of validFiles) {
            const file = await this.analyzeFile(uri.fsPath);
            if (file) {
                files.push(file);
            }
        }
        
        return files;
    }

    // ===================================================================
    // 🎯 SOPHISTICATED QUERY CLASSIFICATION METHODS
    // ===================================================================

    private isSocialQuery(message: string, tokens: string[]): boolean {
        const socialPatterns = [
            /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)(\s|$)/,
            /^(thanks?( you)?|thank you|bye|goodbye|see you|farewell)(\s|$)/,
            /^(how are you|what'?s up|what'?s new|how'?s it going)/,
            /^(yes|no|ok|okay|sure|alright|got it|understood|makes sense)$/,
            /^(good|great|nice|awesome|cool|excellent|perfect|amazing)(\s|$)/,
            /^(who are you|what are you|tell me about yourself|what can you do)/
        ];

        const socialWords = ['hi', 'hello', 'hey', 'thanks', 'ok', 'yes', 'no', 'cool', 'awesome'];
        
        return socialPatterns.some(pattern => pattern.test(message)) ||
               (tokens.length <= 3 && socialWords.includes(tokens[0]));
    }

    private isEmergencyDebugging(message: string, tokens: string[], entities: string[]): boolean {
        const emergencyKeywords = [
            'crash', 'crashed', 'crashing', 'broken', 'not working', 'fails', 'failed', 'failing',
            'error', 'exception', 'bug', 'urgent', 'critical', 'emergency', 'production down',
            'system down', 'can\'t', 'won\'t', 'doesn\'t work', 'stops working', 'hanging',
            'frozen', 'stuck', 'memory leak', 'infinite loop', 'stack overflow'
        ];

        const emergencyPatterns = [
            /nothing (works|happens|shows)/,
            /(everything|system|app|website) (is )?broken/,
            /(can'?t|cannot) (run|start|load|access)/,
            /production (issue|problem|error|down)/,
            /urgent.*fix|fix.*urgent/,
            /critical.*bug|bug.*critical/
        ];

        const hasEmergencyKeywords = emergencyKeywords.some(keyword => message.includes(keyword));
        const hasEmergencyPatterns = emergencyPatterns.some(pattern => pattern.test(message));
        const hasErrorEntities = entities.some(entity => entity.includes('error') || entity.includes('exception'));

        return hasEmergencyKeywords || hasEmergencyPatterns || hasErrorEntities;
    }

    private isArchitecturalAnalysis(message: string, tokens: string[], entities: string[], technicalTerms: string[]): boolean {
        const archKeywords = [
            'architecture', 'design', 'structure', 'pattern', 'patterns', 'system', 'systems',
            'overview', 'relationship', 'relationships', 'dependency', 'dependencies',
            'connection', 'connections', 'integration', 'flow', 'workflow', 'data flow',
            'microservice', 'microservices', 'monolith', 'component', 'components',
            'module', 'modules', 'service', 'services', 'layer', 'layers',
            'database schema', 'data model', 'entity relationship', 'erd',
            'scalability', 'maintainability', 'extensibility', 'coupling', 'cohesion'
        ];

        const archPatterns = [
            /how (does|do|is|are) .* (work|organized|structured|connected)/,
            /what is the .* (architecture|structure|design|pattern)/,
            /explain the .* (system|structure|flow|design|architecture)/,
            /how are .* (connected|related|integrated|linked)/,
            /what'?s the relationship between/,
            /analyze the (codebase|project|system|architecture)/,
            /review the (architecture|design|structure|system)/,
            /understand the (flow|structure|design|architecture)/,
            /(big picture|high level|overall) (view|understanding|overview)/
        ];

        const hasArchKeywords = archKeywords.some(keyword => message.includes(keyword));
        const hasArchPatterns = archPatterns.some(pattern => pattern.test(message));
        const hasSystemEntities = entities.some(entity => 
            ['system', 'architecture', 'design', 'component', 'service'].includes(entity)
        );

        return hasArchKeywords || hasArchPatterns || hasSystemEntities;
    }

    private isPerformanceAnalysis(message: string, tokens: string[], technicalTerms: string[]): boolean {
        const perfKeywords = [
            'performance', 'optimize', 'optimization', 'speed', 'fast', 'faster', 'slow', 'slower',
            'latency', 'lag', 'delay', 'memory', 'cpu', 'gpu', 'bottleneck', 'bottlenecks',
            'profiling', 'profile', 'benchmark', 'benchmarking', 'metrics', 'monitoring',
            'cache', 'caching', 'lazy loading', 'pagination', 'compression', 'minify',
            'bundle size', 'tree shaking', 'code splitting', 'parallel', 'concurrent',
            'throughput', 'response time', 'load time', 'render time', 'fps', 'timing'
        ];

        const perfPatterns = [
            /make.*faster|make.*quicker|speed.*up/,
            /optimize.*performance|improve.*performance|performance.*optimization/,
            /reduce.*(time|latency|delay|memory|size)/,
            /performance.*(issue|problem|bottleneck|analysis)/,
            /(too )?slow|running.*slow|loads.*slow/,
            /memory.*(usage|leak|consumption|optimization)/,
            /cpu.*(usage|intensive|optimization)/
        ];

        return perfKeywords.some(keyword => message.includes(keyword)) ||
               perfPatterns.some(pattern => pattern.test(message));
    }

    private isSecurityAnalysis(message: string, tokens: string[], technicalTerms: string[]): boolean {
        const securityKeywords = [
            'security', 'secure', 'vulnerability', 'vulnerabilities', 'exploit', 'exploits',
            'attack', 'attacks', 'threat', 'threats', 'penetration', 'audit', 'assessment',
            'authentication', 'authorization', 'permission', 'permissions', 'access control',
            'xss', 'csrf', 'injection', 'sql injection', 'code injection', 'sanitize', 'sanitization',
            'validation', 'escape', 'encrypt', 'encryption', 'decrypt', 'decryption',
            'hash', 'hashing', 'salt', 'token', 'tokens', 'jwt', 'session', 'sessions',
            'https', 'ssl', 'tls', 'certificate', 'certificates', 'firewall', 'cors'
        ];

        const securityPatterns = [
            /security.*(issue|issues|problem|problems|vulnerability|audit|review|analysis)/,
            /(is this|how) (secure|safe)/,
            /security.*(check|scan|test|assessment)/,
            /protect.*against|prevent.*(attack|attacks|exploit)/,
            /(vulnerable|vulnerability) to/,
            /authorization.*(check|validation|system)/,
            /authentication.*(system|flow|process)/
        ];

        return securityKeywords.some(keyword => message.includes(keyword)) ||
               securityPatterns.some(pattern => pattern.test(message));
    }

    private isCodeReviewQuery(message: string, tokens: string[], actionVerbs: string[]): boolean {
        const reviewKeywords = [
            'review', 'analyze', 'audit', 'check', 'examine', 'inspect', 'evaluate',
            'assess', 'critique', 'feedback', 'suggestions', 'improvements',
            'code quality', 'best practice', 'best practices', 'clean code', 'refactor',
            'refactoring', 'smell', 'smells', 'anti-pattern', 'anti-patterns',
            'violation', 'violations', 'standard', 'standards', 'convention', 'conventions',
            'maintainable', 'readable', 'readability', 'optimization', 'improvement'
        ];

        const reviewPatterns = [
            /review (this|the|my) (code|function|class|file|implementation)/,
            /analyze (this|the|my) (code|function|class|file|implementation)/,
            /check (this|the|my) (code|implementation|solution)/,
            /(is this|how) (good|correct|right|proper|appropriate)/,
            /how can I (improve|make.*better|optimize)/,
            /what'?s wrong with (this|my)/,
            /(any|have) suggestions for/,
            /code review|peer review/,
            /(best|better) (way|approach|practice) to/,
            /clean.*up|refactor/
        ];

        const reviewVerbs = ['review', 'analyze', 'check', 'examine', 'assess', 'critique'];
        const hasReviewVerbs = actionVerbs.some(verb => reviewVerbs.includes(verb));

        return reviewKeywords.some(keyword => message.includes(keyword)) ||
               reviewPatterns.some(pattern => pattern.test(message)) ||
               hasReviewVerbs;
    }

    private isTestingQuery(message: string, tokens: string[], technicalTerms: string[]): boolean {
        const testKeywords = [
            'test', 'tests', 'testing', 'unit test', 'unit tests', 'integration test',
            'integration tests', 'e2e test', 'e2e tests', 'end-to-end', 'acceptance test',
            'mock', 'mocks', 'mocking', 'stub', 'stubs', 'stubbing', 'spy', 'spies',
            'jest', 'mocha', 'chai', 'jasmine', 'cypress', 'playwright', 'selenium',
            'coverage', 'test coverage', 'assertion', 'assertions', 'expect', 'should',
            'describe', 'it', 'test case', 'test cases', 'test suite', 'test suites'
        ];

        const testPatterns = [
            /write.*(test|tests|unit test|integration test)/,
            /test.*(function|component|class|module|feature)/,
            /how to test|testing (strategy|approach|methodology)/,
            /(unit|integration|e2e) test/,
            /test.*coverage|coverage.*report/,
            /mock.*(data|service|api|function)/,
            /assert.*that|expect.*to/
        ];

        const testFrameworks = ['jest', 'mocha', 'chai', 'jasmine', 'cypress', 'playwright', 'selenium'];
        const hasTestFrameworks = testFrameworks.some(framework => message.includes(framework));

        return testKeywords.some(keyword => message.includes(keyword)) ||
               testPatterns.some(pattern => pattern.test(message)) ||
               hasTestFrameworks;
    }

    private isImplementationQuery(message: string, tokens: string[], actionVerbs: string[], complexity: number): boolean {
        const implKeywords = [
            'implement', 'create', 'build', 'make', 'add', 'write', 'develop', 'code',
            'generate', 'construct', 'setup', 'configure', 'install', 'initialize',
            'feature', 'functionality', 'component', 'service', 'endpoint', 'api',
            'crud', 'route', 'handler', 'middleware', 'utility', 'helper', 'function'
        ];

        const implPatterns = [
            /how (to|do I) (create|build|make|implement|add|write|develop)/,
            /can you (create|build|make|implement|add|write|generate)/,
            /I (need|want) to (create|build|make|implement|add|write)/,
            /help me (create|build|make|implement|add|write|develop)/,
            /show me how to (create|build|make|implement)/,
            /walk me through (creating|building|making|implementing)/,
            /step by step|walkthrough|tutorial/
        ];

        const implVerbs = ['implement', 'create', 'build', 'make', 'add', 'write', 'develop', 'generate'];
        const hasImplVerbs = actionVerbs.some(verb => implVerbs.includes(verb));

        return implKeywords.some(keyword => message.includes(keyword)) ||
               implPatterns.some(pattern => pattern.test(message)) ||
               hasImplVerbs;
    }

    private isLearningQuery(message: string, tokens: string[], actionVerbs: string[]): boolean {
        const learnKeywords = [
            'explain', 'understand', 'learn', 'teach', 'what is', 'what does', 'what are',
            'how does', 'how do', 'why does', 'why do', 'concept', 'concepts',
            'principle', 'principles', 'theory', 'tutorial', 'guide', 'documentation',
            'example', 'examples', 'sample', 'samples', 'difference', 'differences'
        ];

        const learnPatterns = [
            /what (is|does|are|do)/,
            /how (does|do|is|are)/,
            /why (does|do|is|are)/,
            /explain.*to me|explain (this|that|how|why|what)/,
            /help me understand|I want to understand/,
            /I don'?t understand|I'?m confused/,
            /can you explain|could you explain/,
            /what'?s the difference between/,
            /how.*work|how.*function/,
            /tell me about/
        ];

        const learnVerbs = ['explain', 'understand', 'learn', 'teach'];
        const hasLearnVerbs = actionVerbs.some(verb => learnVerbs.includes(verb));

        return learnKeywords.some(keyword => message.includes(keyword)) ||
               learnPatterns.some(pattern => pattern.test(message)) ||
               hasLearnVerbs;
    }

    private isDeploymentQuery(message: string, tokens: string[], technicalTerms: string[]): boolean {
        const deployKeywords = [
            'deploy', 'deployment', 'production', 'staging', 'environment', 'environments',
            'docker', 'container', 'containers', 'kubernetes', 'k8s', 'ci/cd', 'pipeline',
            'pipelines', 'build', 'builds', 'compile', 'bundle', 'package', 'release',
            'releases', 'server', 'servers', 'cloud', 'aws', 'azure', 'gcp', 'heroku', 'vercel'
        ];

        const deployPatterns = [
            /deploy.*to|deploy.*on|deployment.*to/,
            /how to deploy|deployment.*process|deployment.*strategy/,
            /build.*for production|production.*build|production.*deployment/,
            /ci\/cd|continuous (integration|deployment)/,
            /docker.*container|containerize/,
            /kubernetes.*deploy|k8s.*deploy/
        ];

        const cloudProviders = ['aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify'];
        const hasCloudProviders = cloudProviders.some(provider => message.includes(provider));

        return deployKeywords.some(keyword => message.includes(keyword)) ||
               deployPatterns.some(pattern => pattern.test(message)) ||
               hasCloudProviders;
    }

    private isDocumentationQuery(message: string, tokens: string[]): boolean {
        const docKeywords = [
            'document', 'documentation', 'docs', 'comment', 'comments', 'commenting',
            'readme', 'guide', 'guides', 'manual', 'instruction', 'instructions',
            'description', 'specification', 'spec', 'jsdoc', 'typedoc', 'swagger', 'openapi'
        ];

        const docPatterns = [
            /write.*(documentation|docs|comment|comments)/,
            /document.*(this|function|class|api|code)/,
            /add.*(comment|comments|documentation)/,
            /generate.*(docs|documentation|api.*docs)/,
            /create.*(readme|documentation|guide)/
        ];

        return docKeywords.some(keyword => message.includes(keyword)) ||
               docPatterns.some(pattern => pattern.test(message));
    }

    private isQuickFixQuery(message: string, tokens: string[], complexity: number): boolean {
        const quickKeywords = [
            'quick', 'simple', 'small', 'minor', 'tiny', 'little', 'easy',
            'change', 'update', 'modify', 'tweak', 'adjust', 'fix',
            'rename', 'move', 'delete', 'remove', 'replace'
        ];

        const isShort = tokens.length <= 6;
        const isSimple = complexity < 0.3;
        const hasQuickKeywords = quickKeywords.some(keyword => message.includes(keyword));

        return isShort && (isSimple || hasQuickKeywords);
    }

    private hasTechnicalIndicators(message: string, tokens: string[], technicalTerms: string[]): boolean {
        const techIndicators = [
            // Programming languages
            'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'rust', 'go',
            'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css', 'sql',
            
            // Frameworks/Libraries
            'react', 'vue', 'angular', 'node', 'express', 'django', 'flask',
            'spring', 'laravel', 'rails', 'next', 'nuxt', 'svelte', 'jquery',
            
            // Technical concepts
            'function', 'class', 'method', 'variable', 'constant', 'array', 'object',
            'string', 'number', 'boolean', 'null', 'undefined', 'async', 'await',
            'promise', 'callback', 'closure', 'scope', 'prototype', 'inheritance',
            
            // Development tools
            'git', 'npm', 'yarn', 'webpack', 'babel', 'eslint', 'prettier',
            'vscode', 'github', 'gitlab', 'bitbucket',
            
            // Database/Backend
            'database', 'mongodb', 'postgresql', 'mysql', 'redis', 'api', 'rest',
            'graphql', 'endpoint', 'route', 'middleware'
        ];

        const hasFileExtensions = /\.(js|ts|jsx|tsx|py|java|cpp|cs|html|css|json|xml|yml|yaml|md)(\s|$)/i.test(message);
        const hasTechTerms = technicalTerms.length > 0;
        const hasTechIndicators = techIndicators.some(indicator => message.includes(indicator));

        return hasFileExtensions || hasTechTerms || hasTechIndicators;
    }

    // ===================================================================
    // 🔬 ADVANCED LINGUISTIC ANALYSIS METHODS
    // ===================================================================

    private extractNamedEntities(message: string): string[] {
        const entities: string[] = [];
        
        // Extract quoted strings (likely file names, function names, etc.)
        const quotedStrings = message.match(/['"`]([^'"`]+)['"`]/g);
        if (quotedStrings) {
            entities.push(...quotedStrings.map(s => s.slice(1, -1)));
        }
        
        // Extract CamelCase identifiers
        const camelCase = message.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
        if (camelCase) {
            entities.push(...camelCase);
        }
        
        // Extract snake_case identifiers
        const snakeCase = message.match(/\b[a-z]+(?:_[a-z]+)+\b/g);
        if (snakeCase) {
            entities.push(...snakeCase);
        }
        
        return entities;
    }

    private identifyTechnicalTerms(message: string): string[] {
        const technicalDictionary = [
            'api', 'backend', 'frontend', 'database', 'server', 'client', 'framework',
            'library', 'module', 'component', 'service', 'middleware', 'endpoint',
            'authentication', 'authorization', 'encryption', 'deployment', 'testing',
            'debugging', 'optimization', 'performance', 'security', 'architecture'
        ];
        
        return technicalDictionary.filter(term => message.includes(term));
    }

    private extractActionVerbs(message: string): string[] {
        const actionVerbs = [
            'create', 'build', 'make', 'implement', 'develop', 'write', 'generate',
            'fix', 'debug', 'solve', 'resolve', 'analyze', 'review', 'test',
            'deploy', 'optimize', 'refactor', 'update', 'modify', 'change',
            'explain', 'understand', 'learn', 'teach', 'document', 'check'
        ];
        
        const words = message.toLowerCase().split(/\s+/);
        return actionVerbs.filter(verb => words.includes(verb));
    }

    private assessQueryComplexity(message: string, tokens: string[]): number {
        let complexity = 0;
        
        // Length factor
        complexity += Math.min(tokens.length / 20, 0.3);
        
        // Technical term density
        const techTerms = this.identifyTechnicalTerms(message);
        complexity += Math.min(techTerms.length / tokens.length, 0.4);
        
        // Question complexity
        const questionWords = ['how', 'why', 'what', 'when', 'where', 'which'];
        const hasMultipleQuestions = questionWords.filter(q => message.includes(q)).length > 1;
        if (hasMultipleQuestions) complexity += 0.2;
        
        // Conditional/complex language
        const complexPhrases = ['if', 'when', 'because', 'since', 'although', 'however'];
        complexity += complexPhrases.filter(phrase => message.includes(phrase)).length * 0.1;
        
        return Math.min(complexity, 1.0);
    }

    // ===================================================================
    // 🎯 MISSING IMPLEMENTATION METHODS (STUBS FOR NOW)
    // ===================================================================

    private buildEnhancedSearchOptions(query: string, intent: QueryIntent, options: SearchOptions): Required<SearchOptions> {
        return {
            maxFiles: intent.contextConfig.maxFiles,
            maxFileSize: options.maxFileSize || 1024 * 1024,
            includeLanguages: options.includeLanguages || [],
            excludeLanguages: options.excludeLanguages || [],
            includePatterns: options.includePatterns || [],
            excludePatterns: options.excludePatterns || this.defaultExcludePatterns,
            searchType: options.searchType || this.determineSearchType(query),
            fuzzyThreshold: options.fuzzyThreshold || 0.6,
            includeTests: intent.contextSources?.includes('tests') || false,
            includeDocs: intent.contextSources?.includes('docs') || true,
            contextWindow: options.contextWindow || 50
        };
    }

    private applyAdvancedRelevanceScoring(files: ContextualFile[], query: string, intent: QueryIntent, options: Required<SearchOptions>): ContextualFile[] {
        return files.map(file => ({
            ...file,
            relevanceScore: this.calculateAdvancedFileRelevance(file, query, intent)
        }));
    }

    private calculateAdvancedFileRelevance(file: ContextualFile, query: string, intent: QueryIntent): number {
        let score = file.relevanceScore || 0;
        
        // Boost score based on intent type
        if (intent.type === 'debugging' && file.path.includes('error')) score += 0.2;
        if (intent.type === 'testing' && file.path.includes('test')) score += 0.3;
        if (intent.type === 'security' && file.path.includes('auth')) score += 0.2;
        
        return Math.min(score, 1.0);
    }

    private applyIntelligentFiltering(files: ContextualFile[], intent: QueryIntent, options: Required<SearchOptions>): ContextualFile[] {
        return files
            .filter(file => file.relevanceScore >= intent.contextConfig.minRelevanceScore)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    private calculateAdvancedRelevance(files: ContextualFile[], intent: QueryIntent): number {
        if (files.length === 0) return 0;
        return files.reduce((sum, file) => sum + file.relevanceScore, 0) / files.length;
    }

    // Stub implementations for advanced features
    private async identifyProjectStructure(rootPath: string): Promise<any> { return {}; }
    private async findArchitecturalEntryPoints(rootPath: string, patterns: any): Promise<ContextualFile[]> { return []; }
    private async findConfigurationFiles(rootPath: string): Promise<ContextualFile[]> { return []; }
    private async buildImportGraph(): Promise<any> { return {}; }
    private findRelevantDependencyClusters(query: string, graph: any): any[] { return []; }
    private async findFilesBySymbols(query: string, options: Required<SearchOptions>): Promise<ContextualFile[]> { return []; }
    private async findRecentlyModifiedFiles(query: string): Promise<ContextualFile[]> { return []; }
    private async findRelatedTestFiles(query: string, contextFiles: ContextualFile[]): Promise<ContextualFile[]> { return []; }
}

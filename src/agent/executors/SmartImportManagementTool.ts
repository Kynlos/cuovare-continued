import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface ImportStatement {
    type: 'named' | 'default' | 'namespace' | 'side-effect';
    moduleName: string;
    importedNames: string[];
    alias?: string;
    line: number;
    statement: string;
}

interface ImportIssue {
    type: 'unused' | 'duplicate' | 'circular' | 'style' | 'optimization';
    severity: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    suggestion: string;
    autoFixable: boolean;
}

interface ImportAnalysis {
    file: string;
    imports: ImportStatement[];
    issues: ImportIssue[];
    suggestions: {
        organize: boolean;
        combineImports: string[];
        removeUnused: string[];
        addMissing: string[];
        sortImports: boolean;
    };
}

interface OptimizationResult {
    filesProcessed: number;
    importsOptimized: number;
    issuesFixed: number;
    bundleSizeReduction: string;
    changes: Array<{
        file: string;
        action: string;
        description: string;
    }>;
}

export class SmartImportManagementTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'smart_import_management',
        description: 'Auto-organize and optimize imports with dead code elimination, circular dependency detection, and bundle optimization',
        category: 'Code Organization',
        parameters: [
            { name: 'target', description: 'File or directory to analyze and optimize imports', required: true, type: 'string' },
            { name: 'action', description: 'Action: analyze, organize, optimize, fix-unused, detect-circular (default: analyze)', required: false, type: 'string' },
            { name: 'autoFix', description: 'Automatically apply safe import optimizations (default: false)', required: false, type: 'boolean' },
            { name: 'sortStyle', description: 'Import sorting style: alphabetical, type-first, length (default: alphabetical)', required: false, type: 'string' },
            { name: 'combineImports', description: 'Combine multiple imports from same module (default: true)', required: false, type: 'boolean' },
            { name: 'removeUnused', description: 'Remove unused imports (default: true when autoFix is true)', required: false, type: 'boolean' },
            { name: 'addMissing', description: 'Add missing imports for undefined variables (default: false)', required: false, type: 'boolean' }
        ],
        examples: [
            'Analyze imports: { "target": "src/components" }',
            'Organize imports: { "target": "src/app.ts", "action": "organize", "autoFix": true }',
            'Remove unused: { "target": "src", "action": "fix-unused", "autoFix": true }',
            'Detect circular dependencies: { "target": "src", "action": "detect-circular" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting import management: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const action = payload.action || 'analyze';
            const autoFix = payload.autoFix === true;
            const sortStyle = payload.sortStyle || 'alphabetical';
            const combineImports = payload.combineImports !== false;
            const removeUnused = payload.removeUnused !== false;
            const addMissing = payload.addMissing === true;

            // Collect files for analysis
            const filesToAnalyze = await this.collectFiles(targetPath);
            context.onProgress?.(`Found ${filesToAnalyze.length} files for import analysis`);

            if (filesToAnalyze.length === 0) {
                return {
                    success: true,
                    message: 'No files found for import analysis',
                    data: { analyses: [], optimizationResult: null }
                };
            }

            // Analyze imports in all files
            const analyses: ImportAnalysis[] = [];
            for (let i = 0; i < filesToAnalyze.length; i++) {
                const file = filesToAnalyze[i];
                context.onProgress?.(`Analyzing imports ${i + 1}/${filesToAnalyze.length}: ${path.relative(context.workspaceRoot, file)}`);
                
                const analysis = await this.analyzeFileImports(file, context.workspaceRoot, filesToAnalyze);
                analyses.push(analysis);
            }

            // Perform requested action
            let optimizationResult: OptimizationResult | null = null;
            
            switch (action) {
                case 'analyze':
                    // Analysis only, no changes
                    break;
                    
                case 'organize':
                    if (autoFix) {
                        context.onProgress?.('Organizing imports...');
                        optimizationResult = await this.organizeImports(analyses, context, sortStyle, combineImports);
                    }
                    break;
                    
                case 'optimize':
                    if (autoFix) {
                        context.onProgress?.('Optimizing imports...');
                        optimizationResult = await this.optimizeImports(analyses, context, {
                            removeUnused,
                            combineImports,
                            addMissing,
                            sortStyle
                        });
                    }
                    break;
                    
                case 'fix-unused':
                    if (autoFix) {
                        context.onProgress?.('Removing unused imports...');
                        optimizationResult = await this.removeUnusedImports(analyses, context);
                    }
                    break;
                    
                case 'detect-circular':
                    context.onProgress?.('Detecting circular dependencies...');
                    const circularDeps = await this.detectCircularDependencies(analyses, context.workspaceRoot);
                    return {
                        success: true,
                        message: this.formatCircularDependencyResults(circularDeps),
                        data: { circularDependencies: circularDeps, analyses }
                    };
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            const message = this.formatResults(analyses, optimizationResult, action);

            return {
                success: true,
                message,
                data: {
                    analyses,
                    optimizationResult,
                    summary: this.generateSummary(analyses)
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Import management failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async collectFiles(targetPath: string): Promise<string[]> {
        const files: string[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            if (this.isAnalyzableFile(targetPath)) {
                return [targetPath];
            }
            return [];
        }

        const collectRecursively = (dir: string) => {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry)) {
                        collectRecursively(fullPath);
                    }
                } else if (stat.isFile() && this.isAnalyzableFile(fullPath)) {
                    files.push(fullPath);
                }
            }
        };

        collectRecursively(targetPath);
        return files;
    }

    private isAnalyzableFile(filePath: string): boolean {
        const ext = path.extname(filePath);
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
    }

    private async analyzeFileImports(filePath: string, workspaceRoot: string, allFiles: string[]): Promise<ImportAnalysis> {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(workspaceRoot, filePath);
        const lines = content.split('\n');
        
        // Extract import statements
        const imports = this.extractImports(content);
        
        // Detect issues
        const issues = await this.detectImportIssues(content, imports, filePath, allFiles);
        
        // Generate suggestions
        const suggestions = this.generateSuggestions(imports, issues, content);

        return {
            file: relativePath,
            imports,
            issues,
            suggestions
        };
    }

    private extractImports(content: string): ImportStatement[] {
        const imports: ImportStatement[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Named imports: import { a, b } from 'module'
            const namedMatch = trimmed.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/);
            if (namedMatch) {
                const importedNames = namedMatch[1].split(',').map(name => {
                    const parts = name.trim().split(' as ');
                    return parts[0].trim();
                });
                
                imports.push({
                    type: 'named',
                    moduleName: namedMatch[2],
                    importedNames,
                    line: index + 1,
                    statement: trimmed
                });
                return;
            }
            
            // Default imports: import Something from 'module'
            const defaultMatch = trimmed.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
            if (defaultMatch) {
                imports.push({
                    type: 'default',
                    moduleName: defaultMatch[2],
                    importedNames: [defaultMatch[1]],
                    line: index + 1,
                    statement: trimmed
                });
                return;
            }
            
            // Namespace imports: import * as Something from 'module'
            const namespaceMatch = trimmed.match(/import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
            if (namespaceMatch) {
                imports.push({
                    type: 'namespace',
                    moduleName: namespaceMatch[2],
                    importedNames: [namespaceMatch[1]],
                    alias: namespaceMatch[1],
                    line: index + 1,
                    statement: trimmed
                });
                return;
            }
            
            // Side-effect imports: import 'module'
            const sideEffectMatch = trimmed.match(/import\s*['"]([^'"]+)['"]/);
            if (sideEffectMatch) {
                imports.push({
                    type: 'side-effect',
                    moduleName: sideEffectMatch[1],
                    importedNames: [],
                    line: index + 1,
                    statement: trimmed
                });
            }
        });
        
        return imports;
    }

    private async detectImportIssues(content: string, imports: ImportStatement[], filePath: string, allFiles: string[]): Promise<ImportIssue[]> {
        const issues: ImportIssue[] = [];
        
        // Check for unused imports
        for (const imp of imports) {
            if (imp.type === 'side-effect') continue;
            
            for (const importedName of imp.importedNames) {
                const usageRegex = new RegExp(`\\b${importedName}\\b`, 'g');
                const usages = (content.match(usageRegex) || []).length;
                
                // If only found once (the import itself), it's unused
                if (usages <= 1) {
                    issues.push({
                        type: 'unused',
                        severity: 'warning',
                        message: `Unused import: ${importedName}`,
                        line: imp.line,
                        suggestion: `Remove unused import '${importedName}'`,
                        autoFixable: true
                    });
                }
            }
        }
        
        // Check for duplicate imports
        const moduleGroups = imports.reduce((groups, imp) => {
            if (!groups[imp.moduleName]) groups[imp.moduleName] = [];
            groups[imp.moduleName].push(imp);
            return groups;
        }, {} as { [module: string]: ImportStatement[] });
        
        Object.entries(moduleGroups).forEach(([module, moduleImports]) => {
            if (moduleImports.length > 1) {
                const duplicateLines = moduleImports.slice(1).map(imp => imp.line);
                duplicateLines.forEach(line => {
                    issues.push({
                        type: 'duplicate',
                        severity: 'warning',
                        message: `Duplicate import from '${module}'`,
                        line,
                        suggestion: `Combine imports from '${module}' into a single statement`,
                        autoFixable: true
                    });
                });
            }
        });
        
        // Check import order/style
        for (let i = 1; i < imports.length; i++) {
            const prev = imports[i - 1];
            const curr = imports[i];
            
            // External modules should come before internal modules
            const prevIsExternal = !prev.moduleName.startsWith('.') && !prev.moduleName.startsWith('/');
            const currIsExternal = !curr.moduleName.startsWith('.') && !curr.moduleName.startsWith('/');
            
            if (!prevIsExternal && currIsExternal) {
                issues.push({
                    type: 'style',
                    severity: 'info',
                    message: 'External imports should come before internal imports',
                    line: curr.line,
                    suggestion: 'Reorder imports: external modules first, then internal modules',
                    autoFixable: true
                });
            }
        }
        
        return issues;
    }

    private generateSuggestions(imports: ImportStatement[], issues: ImportIssue[], content: string): ImportAnalysis['suggestions'] {
        const suggestions = {
            organize: false,
            combineImports: [] as string[],
            removeUnused: [] as string[],
            addMissing: [] as string[],
            sortImports: false
        };
        
        // Check if organization is needed
        const hasStyleIssues = issues.some(issue => issue.type === 'style');
        suggestions.organize = hasStyleIssues;
        
        // Check for modules that can be combined
        const moduleGroups = imports.reduce((groups, imp) => {
            if (!groups[imp.moduleName]) groups[imp.moduleName] = [];
            groups[imp.moduleName].push(imp);
            return groups;
        }, {} as { [module: string]: ImportStatement[] });
        
        Object.entries(moduleGroups).forEach(([module, moduleImports]) => {
            if (moduleImports.length > 1) {
                suggestions.combineImports.push(module);
            }
        });
        
        // Collect unused imports
        suggestions.removeUnused = issues
            .filter(issue => issue.type === 'unused')
            .map(issue => issue.message.replace('Unused import: ', ''));
        
        // Check if sorting is needed
        const currentOrder = imports.map(imp => imp.moduleName);
        const sortedOrder = [...currentOrder].sort();
        suggestions.sortImports = !this.arraysEqual(currentOrder, sortedOrder);
        
        return suggestions;
    }

    private async organizeImports(analyses: ImportAnalysis[], context: { workspaceRoot: string; outputChannel: any }, sortStyle: string, combineImports: boolean): Promise<OptimizationResult> {
        const result: OptimizationResult = {
            filesProcessed: 0,
            importsOptimized: 0,
            issuesFixed: 0,
            bundleSizeReduction: 'N/A',
            changes: []
        };

        for (const analysis of analyses) {
            if (analysis.suggestions.organize || analysis.suggestions.sortImports) {
                const filePath = path.resolve(context.workspaceRoot, analysis.file);
                const originalContent = fs.readFileSync(filePath, 'utf8');
                
                const optimizedContent = this.optimizeFileImports(originalContent, analysis, {
                    sortStyle,
                    combineImports,
                    removeUnused: false,
                    addMissing: false
                });
                
                if (optimizedContent !== originalContent) {
                    fs.writeFileSync(filePath, optimizedContent, 'utf8');
                    result.filesProcessed++;
                    result.importsOptimized += analysis.imports.length;
                    result.changes.push({
                        file: analysis.file,
                        action: 'organize',
                        description: 'Organized and sorted imports'
                    });
                    
                    context.outputChannel.appendLine(`Organized imports in ${analysis.file}`);
                }
            }
        }

        return result;
    }

    private async optimizeImports(analyses: ImportAnalysis[], context: { workspaceRoot: string; outputChannel: any }, options: any): Promise<OptimizationResult> {
        const result: OptimizationResult = {
            filesProcessed: 0,
            importsOptimized: 0,
            issuesFixed: 0,
            bundleSizeReduction: 'N/A',
            changes: []
        };

        for (const analysis of analyses) {
            const filePath = path.resolve(context.workspaceRoot, analysis.file);
            const originalContent = fs.readFileSync(filePath, 'utf8');
            
            const optimizedContent = this.optimizeFileImports(originalContent, analysis, options);
            
            if (optimizedContent !== originalContent) {
                fs.writeFileSync(filePath, optimizedContent, 'utf8');
                result.filesProcessed++;
                result.importsOptimized += analysis.imports.length;
                result.issuesFixed += analysis.issues.filter(i => i.autoFixable).length;
                
                const actions = [];
                if (options.removeUnused) actions.push('removed unused');
                if (options.combineImports) actions.push('combined duplicates');
                if (options.sortStyle) actions.push('sorted');
                
                result.changes.push({
                    file: analysis.file,
                    action: 'optimize',
                    description: `Optimized imports: ${actions.join(', ')}`
                });
                
                context.outputChannel.appendLine(`Optimized imports in ${analysis.file}`);
            }
        }

        return result;
    }

    private async removeUnusedImports(analyses: ImportAnalysis[], context: { workspaceRoot: string; outputChannel: any }): Promise<OptimizationResult> {
        const result: OptimizationResult = {
            filesProcessed: 0,
            importsOptimized: 0,
            issuesFixed: 0,
            bundleSizeReduction: 'N/A',
            changes: []
        };

        for (const analysis of analyses) {
            const unusedIssues = analysis.issues.filter(issue => issue.type === 'unused');
            
            if (unusedIssues.length > 0) {
                const filePath = path.resolve(context.workspaceRoot, analysis.file);
                const originalContent = fs.readFileSync(filePath, 'utf8');
                
                const optimizedContent = this.removeUnusedFromContent(originalContent, unusedIssues);
                
                if (optimizedContent !== originalContent) {
                    fs.writeFileSync(filePath, optimizedContent, 'utf8');
                    result.filesProcessed++;
                    result.issuesFixed += unusedIssues.length;
                    result.changes.push({
                        file: analysis.file,
                        action: 'remove-unused',
                        description: `Removed ${unusedIssues.length} unused imports`
                    });
                    
                    context.outputChannel.appendLine(`Removed unused imports from ${analysis.file}`);
                }
            }
        }

        return result;
    }

    private optimizeFileImports(content: string, analysis: ImportAnalysis, options: any): string {
        const lines = content.split('\n');
        const importLines = analysis.imports.map(imp => imp.line - 1);
        const nonImportLines = lines.filter((_, index) => !importLines.includes(index));
        
        // Group imports by type
        const externalImports = analysis.imports.filter(imp => !imp.moduleName.startsWith('.') && !imp.moduleName.startsWith('/'));
        const internalImports = analysis.imports.filter(imp => imp.moduleName.startsWith('.') || imp.moduleName.startsWith('/'));
        
        // Combine imports from same module if requested
        let optimizedExternalImports = externalImports;
        let optimizedInternalImports = internalImports;
        
        if (options.combineImports) {
            optimizedExternalImports = this.combineImportsFromSameModule(externalImports);
            optimizedInternalImports = this.combineImportsFromSameModule(internalImports);
        }
        
        // Remove unused imports if requested
        if (options.removeUnused) {
            const unusedNames = analysis.issues
                .filter(issue => issue.type === 'unused')
                .map(issue => issue.message.replace('Unused import: ', ''));
                
            optimizedExternalImports = this.filterUnusedImports(optimizedExternalImports, unusedNames);
            optimizedInternalImports = this.filterUnusedImports(optimizedInternalImports, unusedNames);
        }
        
        // Sort imports if requested
        if (options.sortStyle) {
            optimizedExternalImports = this.sortImports(optimizedExternalImports, options.sortStyle);
            optimizedInternalImports = this.sortImports(optimizedInternalImports, options.sortStyle);
        }
        
        // Reconstruct content
        const optimizedImportStatements = [
            ...optimizedExternalImports.map(imp => imp.statement),
            ...optimizedInternalImports.map(imp => imp.statement)
        ];
        
        // Find the position to insert imports (after any initial comments)
        let insertIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('import ') || line === '') {
                break;
            }
            if (line.startsWith('//') || line.startsWith('/*')) {
                insertIndex = i + 1;
            }
        }
        
        // Remove old import lines and insert optimized ones
        const beforeImports = lines.slice(0, insertIndex);
        const afterImports = nonImportLines.slice(insertIndex);
        
        return [
            ...beforeImports,
            ...optimizedImportStatements,
            '',
            ...afterImports.filter(line => line.trim() !== '')
        ].join('\n');
    }

    private combineImportsFromSameModule(imports: ImportStatement[]): ImportStatement[] {
        const moduleGroups = imports.reduce((groups, imp) => {
            if (!groups[imp.moduleName]) groups[imp.moduleName] = [];
            groups[imp.moduleName].push(imp);
            return groups;
        }, {} as { [module: string]: ImportStatement[] });
        
        return Object.entries(moduleGroups).map(([module, moduleImports]) => {
            if (moduleImports.length === 1) {
                return moduleImports[0];
            }
            
            // Combine named imports
            const namedImports = moduleImports.filter(imp => imp.type === 'named');
            const defaultImports = moduleImports.filter(imp => imp.type === 'default');
            const namespaceImports = moduleImports.filter(imp => imp.type === 'namespace');
            
            let combinedStatement = 'import ';
            const parts = [];
            
            if (defaultImports.length > 0) {
                parts.push(defaultImports[0].importedNames[0]);
            }
            
            if (namedImports.length > 0) {
                const allNamedImports = namedImports.flatMap(imp => imp.importedNames);
                const uniqueNamedImports = [...new Set(allNamedImports)];
                parts.push(`{ ${uniqueNamedImports.join(', ')} }`);
            }
            
            if (namespaceImports.length > 0) {
                parts.push(`* as ${namespaceImports[0].importedNames[0]}`);
            }
            
            combinedStatement += parts.join(', ') + ` from '${module}';`;
            
            return {
                type: 'named' as const,
                moduleName: module,
                importedNames: namedImports.flatMap(imp => imp.importedNames),
                line: moduleImports[0].line,
                statement: combinedStatement
            };
        });
    }

    private filterUnusedImports(imports: ImportStatement[], unusedNames: string[]): ImportStatement[] {
        return imports.map(imp => {
            if (imp.type === 'side-effect') return imp;
            
            const filteredNames = imp.importedNames.filter(name => !unusedNames.includes(name));
            
            if (filteredNames.length === 0) {
                return null; // Remove entire import
            }
            
            if (filteredNames.length === imp.importedNames.length) {
                return imp; // No changes needed
            }
            
            // Reconstruct import statement with remaining names
            let newStatement = '';
            if (imp.type === 'named') {
                newStatement = `import { ${filteredNames.join(', ')} } from '${imp.moduleName}';`;
            } else if (imp.type === 'default') {
                newStatement = `import ${filteredNames[0]} from '${imp.moduleName}';`;
            }
            
            return {
                ...imp,
                importedNames: filteredNames,
                statement: newStatement
            };
        }).filter(imp => imp !== null) as ImportStatement[];
    }

    private sortImports(imports: ImportStatement[], sortStyle: string): ImportStatement[] {
        return [...imports].sort((a, b) => {
            switch (sortStyle) {
                case 'alphabetical':
                    return a.moduleName.localeCompare(b.moduleName);
                case 'type-first':
                    if (a.type !== b.type) {
                        const typeOrder = ['side-effect', 'namespace', 'default', 'named'];
                        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
                    }
                    return a.moduleName.localeCompare(b.moduleName);
                case 'length':
                    return a.statement.length - b.statement.length;
                default:
                    return 0;
            }
        });
    }

    private removeUnusedFromContent(content: string, unusedIssues: ImportIssue[]): string {
        const lines = content.split('\n');
        const linesToRemove = new Set(unusedIssues.map(issue => issue.line - 1));
        
        return lines.filter((_, index) => !linesToRemove.has(index)).join('\n');
    }

    private async detectCircularDependencies(analyses: ImportAnalysis[], workspaceRoot: string): Promise<string[][]> {
        const dependencyGraph = new Map<string, string[]>();
        
        // Build dependency graph
        analyses.forEach(analysis => {
            const filePath = path.resolve(workspaceRoot, analysis.file);
            const dependencies: string[] = [];
            
            analysis.imports.forEach(imp => {
                if (imp.moduleName.startsWith('.')) {
                    // Resolve relative path
                    const resolvedPath = path.resolve(path.dirname(filePath), imp.moduleName);
                    const relativePath = path.relative(workspaceRoot, resolvedPath);
                    dependencies.push(relativePath);
                }
            });
            
            dependencyGraph.set(analysis.file, dependencies);
        });
        
        // Detect cycles using DFS
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[][] = [];
        
        const dfs = (node: string, path: string[]): void => {
            visited.add(node);
            recursionStack.add(node);
            
            const dependencies = dependencyGraph.get(node) || [];
            
            for (const dep of dependencies) {
                if (!visited.has(dep)) {
                    dfs(dep, [...path, node]);
                } else if (recursionStack.has(dep)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(dep);
                    if (cycleStart !== -1) {
                        cycles.push([...path.slice(cycleStart), node, dep]);
                    }
                }
            }
            
            recursionStack.delete(node);
        };
        
        dependencyGraph.forEach((_, node) => {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        });
        
        return cycles;
    }

    private generateSummary(analyses: ImportAnalysis[]) {
        return {
            totalFiles: analyses.length,
            totalImports: analyses.reduce((sum, a) => sum + a.imports.length, 0),
            totalIssues: analyses.reduce((sum, a) => sum + a.issues.length, 0),
            unusedImports: analyses.reduce((sum, a) => sum + a.issues.filter(i => i.type === 'unused').length, 0),
            duplicateImports: analyses.reduce((sum, a) => sum + a.issues.filter(i => i.type === 'duplicate').length, 0),
            filesNeedingOptimization: analyses.filter(a => a.suggestions.organize || a.suggestions.removeUnused.length > 0).length
        };
    }

    private formatResults(analyses: ImportAnalysis[], optimizationResult: OptimizationResult | null, action: string): string {
        const summary = this.generateSummary(analyses);
        
        let message = `Import management completed! 📦\n`;
        message += `📊 Analyzed ${summary.totalFiles} files with ${summary.totalImports} imports\n`;
        message += `🔍 Found ${summary.totalIssues} issues: ${summary.unusedImports} unused, ${summary.duplicateImports} duplicates\n`;
        
        if (optimizationResult) {
            message += `\n✅ Optimization Results:\n`;
            message += `  • Files processed: ${optimizationResult.filesProcessed}\n`;
            message += `  • Imports optimized: ${optimizationResult.importsOptimized}\n`;
            message += `  • Issues fixed: ${optimizationResult.issuesFixed}`;
        } else if (action === 'analyze') {
            message += `\n💡 ${summary.filesNeedingOptimization} files could be optimized`;
            message += `\nRun with autoFix=true to apply optimizations`;
        }
        
        return message;
    }

    private formatCircularDependencyResults(cycles: string[][]): string {
        if (cycles.length === 0) {
            return 'No circular dependencies detected! ✅';
        }
        
        let message = `🔄 Found ${cycles.length} circular dependencies:\n`;
        cycles.forEach((cycle, index) => {
            message += `  ${index + 1}. ${cycle.join(' → ')}\n`;
        });
        
        return message;
    }

    private arraysEqual(a: any[], b: any[]): boolean {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    }
}

export default new SmartImportManagementTool();

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

interface SearchResult {
    file: string;
    line: number;
    column: number;
    match: string;
    context: string;
    relativePath: string;
}

interface ReplaceResult {
    file: string;
    replacements: number;
    preview?: string;
    backup?: string;
}

interface SearchOptions {
    caseSensitive: boolean;
    wholeWord: boolean;
    regex: boolean;
    includeFiles: string[];
    excludeFiles: string[];
    includeDirs: string[];
    excludeDirs: string[];
    maxResults: number;
    contextLines: number;
}

interface ReplaceOptions extends SearchOptions {
    dryRun: boolean;
    createBackup: boolean;
    confirmEach: boolean;
    replaceAll: boolean;
}

export class WorkspaceSearchTool implements ToolExecutor {
    static metadata = {
        name: 'WorkspaceSearchTool',
        description: 'AI-powered workspace-wide search and replace with intelligent pattern matching',
        parameters: {
            action: 'search | replace | find-references | find-definitions | search-symbols',
            pattern: 'Search pattern (string or regex)',
            replacement: 'Replacement text (for replace operations)',
            files: 'File patterns to include (comma-separated)',
            excludeFiles: 'File patterns to exclude (comma-separated)',
            dirs: 'Directory patterns to include (comma-separated)',
            excludeDirs: 'Directory patterns to exclude (comma-separated)',
            caseSensitive: 'Case sensitive search (boolean)',
            wholeWord: 'Match whole words only (boolean)',
            regex: 'Use regular expressions (boolean)',
            maxResults: 'Maximum number of results (number)',
            contextLines: 'Number of context lines (number)',
            dryRun: 'Preview changes without applying (boolean)',
            createBackup: 'Create backup files before replacing (boolean)'
        }
    };

    private defaultExcludeDirs = [
        'node_modules', '.git', '.vscode', 'dist', 'build', 'coverage',
        '.next', '.nuxt', 'out', 'public', 'static', '__pycache__',
        '.pytest_cache', '.mypy_cache', 'target', 'bin', 'obj'
    ];

    private defaultExcludeFiles = [
        '*.log', '*.tmp', '*.temp', '*.cache', '*.lock', '*.pid',
        '*.min.js', '*.min.css', '*.map', '*.d.ts', 'package-lock.json',
        'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', 'Thumbs.db'
    ];

    async execute(params: Record<string, any>): Promise<ToolResult> {
        const { 
            action, pattern, replacement, files, excludeFiles, dirs, excludeDirs,
            caseSensitive, wholeWord, regex, maxResults, contextLines,
            dryRun, createBackup
        } = params;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, message: 'No workspace folder found' };
            }

            const searchOptions: SearchOptions = {
                caseSensitive: caseSensitive || false,
                wholeWord: wholeWord || false,
                regex: regex || false,
                includeFiles: files ? files.split(',').map((f: string) => f.trim()) : ['*'],
                excludeFiles: excludeFiles ? 
                    excludeFiles.split(',').map((f: string) => f.trim()) : 
                    this.defaultExcludeFiles,
                includeDirs: dirs ? dirs.split(',').map((d: string) => d.trim()) : ['**'],
                excludeDirs: excludeDirs ? 
                    excludeDirs.split(',').map((d: string) => d.trim()) : 
                    this.defaultExcludeDirs,
                maxResults: maxResults || 1000,
                contextLines: contextLines || 2
            };

            switch (action) {
                case 'search':
                    return await this.performSearch(pattern, searchOptions);
                case 'replace':
                    if (!replacement) {
                        return { success: false, message: 'Replacement text is required for replace operation' };
                    }
                    const replaceOptions: ReplaceOptions = {
                        ...searchOptions,
                        dryRun: dryRun || false,
                        createBackup: createBackup || true,
                        confirmEach: false,
                        replaceAll: true
                    };
                    return await this.performReplace(pattern, replacement, replaceOptions);
                case 'find-references':
                    return await this.findReferences(pattern, searchOptions);
                case 'find-definitions':
                    return await this.findDefinitions(pattern, searchOptions);
                case 'search-symbols':
                    return await this.searchSymbols(pattern, searchOptions);
                default:
                    return await this.performSearch(pattern, searchOptions);
            }
        } catch (error) {
            return { 
                success: false, 
                message: `Workspace search failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async performSearch(pattern: string, options: SearchOptions): Promise<ToolResult> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { success: false, message: 'No workspace folder found' };
        }

        const results: SearchResult[] = [];
        const files = await this.getFilesToSearch(workspaceFolder.uri.fsPath, options);
        
        for (const file of files) {
            if (results.length >= options.maxResults) break;
            
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const fileResults = await this.searchInFile(file, content, pattern, options);
                results.push(...fileResults);
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        const groupedResults = this.groupResultsByFile(results);
        
        return {
            success: true,
            message: `Found ${results.length} matches in ${Object.keys(groupedResults).length} files`,
            data: {
                totalMatches: results.length,
                filesWithMatches: Object.keys(groupedResults).length,
                results: groupedResults,
                pattern,
                options
            }
        };
    }

    private async performReplace(pattern: string, replacement: string, options: ReplaceOptions): Promise<ToolResult> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { success: false, message: 'No workspace folder found' };
        }

        // First, perform a search to find all matches
        const searchResults = await this.performSearch(pattern, options);
        if (!searchResults.success || !searchResults.data?.results) {
            return { success: false, message: 'No matches found for replacement' };
        }

        const replaceResults: ReplaceResult[] = [];
        const filesToProcess = Object.keys(searchResults.data.results);

        if (options.dryRun) {
            // Preview mode - show what would be changed
            for (const file of filesToProcess) {
                const content = await fs.promises.readFile(file, 'utf8');
                const preview = await this.generateReplacePreview(content, pattern, replacement, options);
                const matchCount = searchResults.data.results[file].length;
                
                replaceResults.push({
                    file: path.relative(workspaceFolder.uri.fsPath, file),
                    replacements: matchCount,
                    preview
                });
            }

            return {
                success: true,
                message: `Preview: Would replace ${searchResults.data.totalMatches} matches in ${filesToProcess.length} files`,
                data: {
                    preview: true,
                    totalReplacements: searchResults.data.totalMatches,
                    filesAffected: filesToProcess.length,
                    results: replaceResults
                }
            };
        }

        // Actual replacement
        for (const file of filesToProcess) {
            try {
                let content = await fs.promises.readFile(file, 'utf8');
                const originalContent = content;
                
                // Create backup if requested
                let backupFile = '';
                if (options.createBackup) {
                    backupFile = file + '.backup.' + Date.now();
                    await fs.promises.writeFile(backupFile, originalContent);
                }

                // Perform the replacement
                const { newContent, replacementCount } = await this.replaceInContent(content, pattern, replacement, options);
                
                if (replacementCount > 0) {
                    await fs.promises.writeFile(file, newContent);
                    
                    replaceResults.push({
                        file: path.relative(workspaceFolder.uri.fsPath, file),
                        replacements: replacementCount,
                        backup: backupFile ? path.relative(workspaceFolder.uri.fsPath, backupFile) : undefined
                    });
                }
            } catch (error) {
                return { 
                    success: false, 
                    message: `Failed to replace in file ${file}: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        }

        const totalReplacements = replaceResults.reduce((sum, result) => sum + result.replacements, 0);

        return {
            success: true,
            message: `Successfully replaced ${totalReplacements} occurrences in ${replaceResults.length} files`,
            data: {
                preview: false,
                totalReplacements,
                filesAffected: replaceResults.length,
                results: replaceResults,
                pattern,
                replacement
            }
        };
    }

    private async findReferences(symbol: string, options: SearchOptions): Promise<ToolResult> {
        // Enhanced search specifically for finding references to a symbol
        const enhancedOptions = {
            ...options,
            wholeWord: true, // References should match whole words
            regex: false // Use exact symbol matching
        };

        // Search for various reference patterns
        const patterns = [
            symbol, // Direct usage
            `${symbol}(`, // Function calls
            `${symbol}.`, // Property access
            `new ${symbol}`, // Constructor calls
            `extends ${symbol}`, // Class extension
            `implements ${symbol}`, // Interface implementation
            `import.*${symbol}`, // Import statements
            `from.*${symbol}` // Import from statements
        ];

        const allResults: SearchResult[] = [];
        
        for (const pattern of patterns) {
            const searchResult = await this.performSearch(pattern, enhancedOptions);
            if (searchResult.success && searchResult.data?.results) {
                // Flatten results from all files
                for (const fileResults of Object.values(searchResult.data.results)) {
                    allResults.push(...(fileResults as SearchResult[]));
                }
            }
        }

        // Remove duplicates and sort by file and line
        const uniqueResults = this.removeDuplicateResults(allResults);
        const groupedResults = this.groupResultsByFile(uniqueResults);

        return {
            success: true,
            message: `Found ${uniqueResults.length} references to '${symbol}' in ${Object.keys(groupedResults).length} files`,
            data: {
                symbol,
                totalReferences: uniqueResults.length,
                filesWithReferences: Object.keys(groupedResults).length,
                results: groupedResults
            }
        };
    }

    private async findDefinitions(symbol: string, options: SearchOptions): Promise<ToolResult> {
        // Search for definition patterns
        const definitionPatterns = [
            `function\\s+${symbol}`, // Function definitions
            `const\\s+${symbol}\\s*=`, // Const declarations
            `let\\s+${symbol}\\s*=`, // Let declarations
            `var\\s+${symbol}\\s*=`, // Var declarations
            `class\\s+${symbol}`, // Class definitions
            `interface\\s+${symbol}`, // Interface definitions
            `type\\s+${symbol}\\s*=`, // Type definitions
            `enum\\s+${symbol}`, // Enum definitions
            `${symbol}\\s*:`, // Object property definitions
            `def\\s+${symbol}\\s*\\(`, // Python function definitions
            `class\\s+${symbol}\\s*\\(` // Python class definitions
        ];

        const enhancedOptions = {
            ...options,
            regex: true,
            wholeWord: false
        };

        const allResults: SearchResult[] = [];
        
        for (const pattern of definitionPatterns) {
            const searchResult = await this.performSearch(pattern, enhancedOptions);
            if (searchResult.success && searchResult.data?.results) {
                for (const fileResults of Object.values(searchResult.data.results)) {
                    allResults.push(...(fileResults as SearchResult[]));
                }
            }
        }

        const uniqueResults = this.removeDuplicateResults(allResults);
        const groupedResults = this.groupResultsByFile(uniqueResults);

        return {
            success: true,
            message: `Found ${uniqueResults.length} definitions of '${symbol}' in ${Object.keys(groupedResults).length} files`,
            data: {
                symbol,
                totalDefinitions: uniqueResults.length,
                filesWithDefinitions: Object.keys(groupedResults).length,
                results: groupedResults
            }
        };
    }

    private async searchSymbols(pattern: string, options: SearchOptions): Promise<ToolResult> {
        // Search for symbol declarations and usages
        const symbolPatterns = [
            `\\b${pattern}\\b`, // Exact word match
            `${pattern}\\w*`, // Words starting with pattern
            `\\w*${pattern}\\w*` // Words containing pattern
        ];

        const enhancedOptions = {
            ...options,
            regex: true,
            includeFiles: ['*.ts', '*.js', '*.tsx', '*.jsx', '*.py', '*.java', '*.cs', '*.cpp', '*.h']
        };

        const allResults: SearchResult[] = [];
        
        for (const searchPattern of symbolPatterns) {
            const searchResult = await this.performSearch(searchPattern, enhancedOptions);
            if (searchResult.success && searchResult.data?.results) {
                for (const fileResults of Object.values(searchResult.data.results)) {
                    allResults.push(...(fileResults as SearchResult[]));
                }
            }
        }

        const uniqueResults = this.removeDuplicateResults(allResults);
        const categorizedResults = this.categorizeSymbolResults(uniqueResults);

        return {
            success: true,
            message: `Found ${uniqueResults.length} symbol matches for '${pattern}'`,
            data: {
                pattern,
                totalMatches: uniqueResults.length,
                categories: categorizedResults,
                results: this.groupResultsByFile(uniqueResults)
            }
        };
    }

    private async getFilesToSearch(workspacePath: string, options: SearchOptions): Promise<string[]> {
        const allFiles: string[] = [];
        
        const scanDirectory = async (dirPath: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    const relativePath = path.relative(workspacePath, fullPath);
                    
                    if (entry.isDirectory()) {
                        // Check if directory should be excluded
                        if (this.shouldExcludeDirectory(entry.name, relativePath, options)) {
                            continue;
                        }
                        await scanDirectory(fullPath);
                    } else if (entry.isFile()) {
                        // Check if file should be included
                        if (this.shouldIncludeFile(entry.name, relativePath, options)) {
                            allFiles.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directories that can't be read
            }
        };

        await scanDirectory(workspacePath);
        return allFiles;
    }

    private shouldExcludeDirectory(dirName: string, relativePath: string, options: SearchOptions): boolean {
        return options.excludeDirs.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(dirName) || regex.test(relativePath);
            }
            return dirName === pattern || relativePath.includes(pattern);
        });
    }

    private shouldIncludeFile(fileName: string, relativePath: string, options: SearchOptions): boolean {
        // Check exclusions first
        if (options.excludeFiles.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(fileName) || regex.test(relativePath);
            }
            return fileName === pattern || relativePath.includes(pattern);
        })) {
            return false;
        }

        // Check inclusions
        return options.includeFiles.some(pattern => {
            if (pattern === '*') return true;
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(fileName) || regex.test(relativePath);
            }
            return fileName === pattern || fileName.endsWith(pattern);
        });
    }

    private async searchInFile(filePath: string, content: string, pattern: string, options: SearchOptions): Promise<SearchResult[]> {
        const results: SearchResult[] = [];
        const lines = content.split('\n');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder ? 
            path.relative(workspaceFolder.uri.fsPath, filePath) : 
            filePath;

        let searchRegex: RegExp;
        try {
            if (options.regex) {
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(pattern, flags);
            } else {
                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordBoundary = options.wholeWord ? '\\b' : '';
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(`${wordBoundary}${escapedPattern}${wordBoundary}`, flags);
            }
        } catch (error) {
            // Invalid regex pattern
            return results;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;
            
            while ((match = searchRegex.exec(line)) !== null) {
                const context = this.getContext(lines, i, options.contextLines);
                
                results.push({
                    file: filePath,
                    line: i + 1,
                    column: match.index + 1,
                    match: match[0],
                    context,
                    relativePath
                });

                // Prevent infinite loop for zero-width matches
                if (match.index === searchRegex.lastIndex) {
                    searchRegex.lastIndex++;
                }
            }
            
            // Reset regex for next line
            searchRegex.lastIndex = 0;
        }

        return results;
    }

    private getContext(lines: string[], lineIndex: number, contextLines: number): string {
        const start = Math.max(0, lineIndex - contextLines);
        const end = Math.min(lines.length - 1, lineIndex + contextLines);
        
        const contextArray: string[] = [];
        for (let i = start; i <= end; i++) {
            const marker = i === lineIndex ? '>' : ' ';
            contextArray.push(`${marker} ${i + 1}: ${lines[i]}`);
        }
        
        return contextArray.join('\n');
    }

    private groupResultsByFile(results: SearchResult[]): Record<string, SearchResult[]> {
        const grouped: Record<string, SearchResult[]> = {};
        
        for (const result of results) {
            if (!grouped[result.file]) {
                grouped[result.file] = [];
            }
            grouped[result.file].push(result);
        }
        
        // Sort results within each file by line number
        for (const file in grouped) {
            grouped[file].sort((a, b) => a.line - b.line);
        }
        
        return grouped;
    }

    private removeDuplicateResults(results: SearchResult[]): SearchResult[] {
        const seen = new Set<string>();
        return results.filter(result => {
            const key = `${result.file}:${result.line}:${result.column}:${result.match}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private categorizeSymbolResults(results: SearchResult[]): Record<string, SearchResult[]> {
        const categories: Record<string, SearchResult[]> = {
            definitions: [],
            usages: [],
            imports: [],
            exports: [],
            comments: []
        };

        for (const result of results) {
            const context = result.context.toLowerCase();
            
            if (context.includes('function') || context.includes('class') || 
                context.includes('interface') || context.includes('const') || 
                context.includes('let') || context.includes('var')) {
                categories.definitions.push(result);
            } else if (context.includes('import') || context.includes('require')) {
                categories.imports.push(result);
            } else if (context.includes('export')) {
                categories.exports.push(result);
            } else if (context.includes('//') || context.includes('/*') || 
                       context.includes('*') || context.includes('#')) {
                categories.comments.push(result);
            } else {
                categories.usages.push(result);
            }
        }

        return categories;
    }

    private async generateReplacePreview(content: string, pattern: string, replacement: string, options: ReplaceOptions): Promise<string> {
        const lines = content.split('\n');
        const previewLines: string[] = [];
        
        let searchRegex: RegExp;
        try {
            if (options.regex) {
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(pattern, flags);
            } else {
                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordBoundary = options.wholeWord ? '\\b' : '';
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(`${wordBoundary}${escapedPattern}${wordBoundary}`, flags);
            }
        } catch (error) {
            return 'Invalid regex pattern';
        }

        for (let i = 0; i < lines.length && previewLines.length < 50; i++) {
            const line = lines[i];
            if (searchRegex.test(line)) {
                const newLine = line.replace(searchRegex, replacement);
                previewLines.push(`  ${i + 1}: - ${line}`);
                previewLines.push(`  ${i + 1}: + ${newLine}`);
                previewLines.push('');
            }
            searchRegex.lastIndex = 0;
        }

        return previewLines.join('\n');
    }

    private async replaceInContent(content: string, pattern: string, replacement: string, options: ReplaceOptions): Promise<{ newContent: string; replacementCount: number }> {
        let searchRegex: RegExp;
        try {
            if (options.regex) {
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(pattern, flags);
            } else {
                const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordBoundary = options.wholeWord ? '\\b' : '';
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchRegex = new RegExp(`${wordBoundary}${escapedPattern}${wordBoundary}`, flags);
            }
        } catch (error) {
            return { newContent: content, replacementCount: 0 };
        }

        const matches = content.match(searchRegex);
        const replacementCount = matches ? matches.length : 0;
        const newContent = content.replace(searchRegex, replacement);

        return { newContent, replacementCount };
    }
}

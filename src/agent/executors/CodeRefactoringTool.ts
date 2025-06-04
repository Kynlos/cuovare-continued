import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface RefactoringRule {
    name: string;
    description: string;
    pattern: RegExp;
    replacement: string | ((match: string, ...groups: string[]) => string);
    severity: 'suggestion' | 'warning' | 'critical';
    category: 'performance' | 'readability' | 'maintainability' | 'modernization';
}

interface RefactoringResult {
    file: string;
    changes: Array<{
        line: number;
        original: string;
        refactored: string;
        rule: string;
        description: string;
        severity: string;
    }>;
    metrics: {
        linesChanged: number;
        complexity: { before: number; after: number };
        maintainability: { before: number; after: number };
    };
}

export class CodeRefactoringTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'code_refactoring',
        description: 'Intelligent code restructuring with automated refactoring suggestions and implementation',
        category: 'Code Quality',
        parameters: [
            { name: 'target', description: 'File or directory to refactor', required: true, type: 'string' },
            { name: 'rules', description: 'Refactoring rules: all, performance, readability, maintainability, modernization', required: false, type: 'array' },
            { name: 'autoApply', description: 'Automatically apply safe refactorings (default: false)', required: false, type: 'boolean' },
            { name: 'severity', description: 'Minimum severity: suggestion, warning, critical (default: suggestion)', required: false, type: 'string' },
            { name: 'language', description: 'Programming language (auto-detect if not specified)', required: false, type: 'string' },
            { name: 'dryRun', description: 'Show what would be changed without applying (default: true)', required: false, type: 'boolean' },
            { name: 'createBackup', description: 'Create backup files before refactoring (default: true)', required: false, type: 'boolean' }
        ],
        examples: [
            'Analyze refactoring opportunities: { "target": "src/utils.ts", "dryRun": true }',
            'Apply performance refactoring: { "target": "src/components", "rules": ["performance"], "autoApply": true }',
            'Modernize codebase: { "target": "src", "rules": ["modernization"], "severity": "warning" }',
            'Safe auto-refactoring: { "target": "src/legacy.js", "autoApply": true, "createBackup": true }'
        ]
    };

    private refactoringRules: RefactoringRule[] = [];

    constructor() {
        this.initializeRules();
    }

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting code refactoring analysis: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const rules = payload.rules || ['all'];
            const autoApply = payload.autoApply === true;
            const severity = payload.severity || 'suggestion';
            const dryRun = payload.dryRun !== false;
            const createBackup = payload.createBackup !== false;

            // Collect files to refactor
            const filesToRefactor = await this.collectFiles(targetPath, payload.language);
            context.onProgress?.(`Found ${filesToRefactor.length} files for refactoring analysis`);

            if (filesToRefactor.length === 0) {
                return {
                    success: true,
                    message: 'No files found for refactoring',
                    data: { results: [] }
                };
            }

            const results: RefactoringResult[] = [];

            // Analyze and refactor files
            for (let i = 0; i < filesToRefactor.length; i++) {
                const file = filesToRefactor[i];
                context.onProgress?.(`Analyzing file ${i + 1}/${filesToRefactor.length}: ${path.relative(context.workspaceRoot, file)}`);
                
                const result = await this.refactorFile(file, context.workspaceRoot, rules, severity, dryRun, autoApply, createBackup);
                if (result && result.changes.length > 0) {
                    results.push(result);
                }
            }

            const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
            const appliedChanges = autoApply && !dryRun ? totalChanges : 0;

            let message = `Refactoring analysis completed!\n`;
            message += `📊 Files analyzed: ${filesToRefactor.length}\n`;
            message += `🔧 Potential improvements: ${totalChanges}\n`;
            
            if (autoApply && !dryRun) {
                message += `✅ Changes applied: ${appliedChanges}`;
            } else {
                message += `💡 Run with autoApply=true to implement changes`;
            }

            return {
                success: true,
                message,
                data: {
                    results,
                    summary: {
                        filesAnalyzed: filesToRefactor.length,
                        totalSuggestions: totalChanges,
                        appliedChanges,
                        dryRun,
                        autoApply
                    }
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Code refactoring failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private initializeRules(): void {
        this.refactoringRules = [
            // Performance Rules
            {
                name: 'cache-array-length',
                description: 'Cache array length in loops for better performance',
                pattern: /for\s*\(\s*let\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\w+)\.length\s*;\s*\1\+\+\s*\)/g,
                replacement: (match, index, array) => `for (let ${index} = 0, len = ${array}.length; ${index} < len; ${index}++)`,
                severity: 'suggestion',
                category: 'performance'
            },
            {
                name: 'remove-console-logs',
                description: 'Remove console.log statements for production',
                pattern: /console\.log\([^)]*\);?\s*\n?/g,
                replacement: '',
                severity: 'warning',
                category: 'performance'
            },
            {
                name: 'use-const-for-immutable',
                description: 'Use const for variables that are never reassigned',
                pattern: /let\s+(\w+)\s*=\s*([^;]+);(?![^}]*\1\s*=)/g,
                replacement: 'const $1 = $2;',
                severity: 'suggestion',
                category: 'readability'
            },

            // Modernization Rules
            {
                name: 'arrow-function-conversion',
                description: 'Convert function expressions to arrow functions',
                pattern: /function\s*\(([^)]*)\)\s*{\s*return\s+([^;]+);\s*}/g,
                replacement: '($1) => $2',
                severity: 'suggestion',
                category: 'modernization'
            },
            {
                name: 'template-literals',
                description: 'Use template literals instead of string concatenation',
                pattern: /(['"])([^'"]*)\1\s*\+\s*(\w+)\s*\+\s*(['"])([^'"]*)\4/g,
                replacement: '`$2${$3}$5`',
                severity: 'suggestion',
                category: 'modernization'
            },
            {
                name: 'destructuring-assignment',
                description: 'Use destructuring assignment for object properties',
                pattern: /const\s+(\w+)\s*=\s*(\w+)\.(\w+);\s*const\s+(\w+)\s*=\s*\2\.(\w+);/g,
                replacement: 'const { $3: $1, $5: $4 } = $2;',
                severity: 'suggestion',
                category: 'modernization'
            },

            // Readability Rules
            {
                name: 'meaningful-variable-names',
                description: 'Replace single-letter variables with meaningful names',
                pattern: /\b(for|let|const)\s+([a-z])\b(?!\w)/g,
                replacement: (match, keyword, letter) => {
                    const meaningfulNames: { [key: string]: string } = {
                        'i': 'index',
                        'j': 'innerIndex', 
                        'k': 'keyIndex',
                        'n': 'count',
                        'x': 'value',
                        'y': 'result'
                    };
                    return `${keyword} ${meaningfulNames[letter] || letter}`;
                },
                severity: 'suggestion',
                category: 'readability'
            },
            {
                name: 'remove-unnecessary-else',
                description: 'Remove unnecessary else after return',
                pattern: /if\s*\([^)]+\)\s*{\s*return[^}]+}\s*else\s*{/g,
                replacement: match => match.replace(/\s*else\s*{/, ' {'),
                severity: 'suggestion',
                category: 'readability'
            },

            // Maintainability Rules
            {
                name: 'extract-magic-numbers',
                description: 'Extract magic numbers to named constants',
                pattern: /(?<![a-zA-Z_$])\b(?!0|1)\d{2,}\b(?![a-zA-Z_$])/g,
                replacement: (match) => `/* TODO: Extract magic number ${match} to constant */`,
                severity: 'warning',
                category: 'maintainability'
            },
            {
                name: 'simplify-boolean-expressions',
                description: 'Simplify boolean expressions',
                pattern: /if\s*\(([^)]+)\s*===?\s*true\)/g,
                replacement: 'if ($1)',
                severity: 'suggestion',
                category: 'maintainability'
            },
            {
                name: 'use-optional-chaining',
                description: 'Use optional chaining for safer property access',
                pattern: /(\w+)\s*&&\s*\1\.(\w+)/g,
                replacement: '$1?.$2',
                severity: 'suggestion',
                category: 'modernization'
            }
        ];
    }

    private async collectFiles(targetPath: string, language?: string): Promise<string[]> {
        const files: string[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            if (this.isRefactorableFile(targetPath, language)) {
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
                } else if (stat.isFile()) {
                    if (this.isRefactorableFile(fullPath, language)) {
                        files.push(fullPath);
                    }
                }
            }
        };

        collectRecursively(targetPath);
        return files;
    }

    private isRefactorableFile(filePath: string, language?: string): boolean {
        const ext = path.extname(filePath);
        const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'];
        
        if (language) {
            const languageExtensions: { [key: string]: string[] } = {
                'typescript': ['.ts', '.tsx'],
                'javascript': ['.js', '.jsx', '.mjs'],
                'vue': ['.vue'],
                'svelte': ['.svelte']
            };
            return languageExtensions[language.toLowerCase()]?.includes(ext) || false;
        }
        
        return supportedExtensions.includes(ext);
    }

    private async refactorFile(
        filePath: string,
        workspaceRoot: string,
        rules: string[],
        severity: string,
        dryRun: boolean,
        autoApply: boolean,
        createBackup: boolean
    ): Promise<RefactoringResult | null> {
        try {
            const originalContent = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(workspaceRoot, filePath);
            
            let refactoredContent = originalContent;
            const changes: RefactoringResult['changes'] = [];
            
            // Apply applicable rules
            const applicableRules = this.getApplicableRules(rules, severity);
            
            for (const rule of applicableRules) {
                const beforeContent = refactoredContent;
                refactoredContent = this.applyRule(refactoredContent, rule, changes, relativePath);
            }

            if (changes.length === 0) {
                return null;
            }

            // Calculate metrics
            const metrics = {
                linesChanged: changes.length,
                complexity: {
                    before: this.calculateComplexity(originalContent),
                    after: this.calculateComplexity(refactoredContent)
                },
                maintainability: {
                    before: this.calculateMaintainability(originalContent),
                    after: this.calculateMaintainability(refactoredContent)
                }
            };

            // Apply changes if not dry run and auto apply is enabled
            if (!dryRun && autoApply) {
                // Create backup if requested
                if (createBackup) {
                    const backupPath = filePath + '.backup';
                    fs.writeFileSync(backupPath, originalContent, 'utf8');
                }
                
                // Write refactored content
                fs.writeFileSync(filePath, refactoredContent, 'utf8');
            }

            return {
                file: relativePath,
                changes,
                metrics
            };

        } catch (error) {
            console.error(`Failed to refactor ${filePath}:`, error);
            return null;
        }
    }

    private getApplicableRules(ruleTypes: string[], severity: string): RefactoringRule[] {
        const severityOrder = ['suggestion', 'warning', 'critical'];
        const minSeverityIndex = severityOrder.indexOf(severity);
        
        let rules = this.refactoringRules;
        
        // Filter by rule types
        if (!ruleTypes.includes('all')) {
            rules = rules.filter(rule => ruleTypes.includes(rule.category));
        }
        
        // Filter by severity
        if (minSeverityIndex !== -1) {
            rules = rules.filter(rule => severityOrder.indexOf(rule.severity) >= minSeverityIndex);
        }
        
        return rules;
    }

    private applyRule(content: string, rule: RefactoringRule, changes: RefactoringResult['changes'], filePath: string): string {
        const lines = content.split('\n');
        let modifiedContent = content;
        
        let match;
        while ((match = rule.pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const originalLine = lines[lineNumber - 1];
            
            let replacement: string;
            if (typeof rule.replacement === 'function') {
                replacement = rule.replacement(match[0], ...match.slice(1));
            } else {
                replacement = match[0].replace(rule.pattern, rule.replacement);
            }
            
            modifiedContent = modifiedContent.replace(match[0], replacement);
            
            changes.push({
                line: lineNumber,
                original: originalLine.trim(),
                refactored: replacement.trim(),
                rule: rule.name,
                description: rule.description,
                severity: rule.severity
            });
            
            // Reset regex lastIndex to avoid infinite loops
            rule.pattern.lastIndex = 0;
        }
        
        return modifiedContent;
    }

    private calculateComplexity(content: string): number {
        // Simple cyclomatic complexity calculation
        const complexityKeywords = [
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 
            'catch', 'try', '&&', '||', '?'
        ];
        
        let complexity = 1; // Base complexity
        
        for (const keyword of complexityKeywords) {
            const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    private calculateMaintainability(content: string): number {
        // Simple maintainability index calculation (0-100)
        const lines = content.split('\n').length;
        const complexity = this.calculateComplexity(content);
        const comments = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        
        // Higher score is better
        let score = 100;
        score -= Math.min(lines / 10, 30); // Penalty for length
        score -= Math.min(complexity * 2, 40); // Penalty for complexity
        score += Math.min(comments * 2, 20); // Bonus for comments
        
        return Math.max(0, Math.round(score));
    }
}

export default new CodeRefactoringTool();

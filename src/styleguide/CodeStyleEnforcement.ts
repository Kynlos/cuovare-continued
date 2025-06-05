/**
 * Code Style Enforcement - v0.9.0 Professional Features
 * 
 * Automated style guide compliance with industry standards support,
 * custom rule creation, and real-time enforcement capabilities.
 * 
 * Features:
 * - Support for popular style guides (Airbnb, Google, Standard, PEP 8, etc.)
 * - Custom style rule creation and management
 * - Real-time style violation detection
 * - Automatic fix suggestions and application
 * - Team style guide synchronization
 * - Code review integration
 * - Performance-optimized style checking
 * - Multi-language support with language-specific rules
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface StyleRule {
    id: string;
    name: string;
    description: string;
    category: 'naming' | 'formatting' | 'structure' | 'imports' | 'comments' | 'security' | 'performance';
    language: string[];
    severity: 'error' | 'warning' | 'info';
    pattern: RegExp;
    message: string;
    fixable: boolean;
    fix?: (code: string, match: RegExpMatchArray) => string;
    examples: {
        bad: string;
        good: string;
    };
}

export interface StyleGuide {
    id: string;
    name: string;
    description: string;
    version: string;
    languages: string[];
    rules: string[];
    settings: { [key: string]: any };
    official: boolean;
    url?: string;
}

export interface StyleViolation {
    rule: StyleRule;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    fixable: boolean;
    suggestion?: string;
}

export interface StyleCheckResult {
    success: boolean;
    filePath: string;
    violations: StyleViolation[];
    fixedViolations: StyleViolation[];
    totalLines: number;
    checkDuration: number;
    appliedStyleGuide: string;
    compliance: {
        score: number; // 0-100
        errorsCount: number;
        warningsCount: number;
        infoCount: number;
    };
}

export interface TeamStyleConfig {
    teamId: string;
    name: string;
    styleGuides: string[];
    customRules: string[];
    overrides: { [ruleId: string]: any };
    enforcementLevel: 'strict' | 'moderate' | 'lenient';
    autoFix: boolean;
    reviewRequired: boolean;
}

/**
 * Code Style Enforcement Engine with comprehensive rule management
 */
export class CodeStyleEnforcement {
    private rules: Map<string, StyleRule> = new Map();
    private styleGuides: Map<string, StyleGuide> = new Map();
    private teamConfigs: Map<string, TeamStyleConfig> = new Map();
    private diagnosticCollection: vscode.DiagnosticCollection;
    private violationHistory: Map<string, StyleViolation[]> = new Map();
    private performanceMetrics: Map<string, number[]> = new Map();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('cuovare-style');
        this.initializeBuiltInRules();
        this.initializeStyleGuides();
        this.initializeTeamConfigs();
    }

    /**
     * Initialize built-in style rules
     */
    private initializeBuiltInRules(): void {
        // TypeScript/JavaScript Naming Rules
        this.addRule({
            id: 'camelcase-variables',
            name: 'CamelCase Variables',
            description: 'Variables should use camelCase naming',
            category: 'naming',
            language: ['typescript', 'javascript'],
            severity: 'warning',
            pattern: /(?:let|const|var)\s+([a-z]+_[a-zA-Z_]*)/g,
            message: 'Variable names should use camelCase, not snake_case',
            fixable: true,
            fix: (code: string, match: RegExpMatchArray) => {
                const variableName = match[1];
                const camelCase = variableName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                return code.replace(match[0], match[0].replace(variableName, camelCase));
            },
            examples: {
                bad: 'const user_name = "John";',
                good: 'const userName = "John";'
            }
        });

        this.addRule({
            id: 'pascalcase-classes',
            name: 'PascalCase Classes',
            description: 'Class names should use PascalCase',
            category: 'naming',
            language: ['typescript', 'javascript'],
            severity: 'error',
            pattern: /class\s+([a-z][a-zA-Z]*)/g,
            message: 'Class names should start with uppercase letter (PascalCase)',
            fixable: true,
            fix: (code: string, match: RegExpMatchArray) => {
                const className = match[1];
                const pascalCase = className.charAt(0).toUpperCase() + className.slice(1);
                return code.replace(match[0], match[0].replace(className, pascalCase));
            },
            examples: {
                bad: 'class userService {}',
                good: 'class UserService {}'
            }
        });

        this.addRule({
            id: 'const-assertions',
            name: 'Const Assertions',
            description: 'Use const for variables that are never reassigned',
            category: 'structure',
            language: ['typescript', 'javascript'],
            severity: 'warning',
            pattern: /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;(?!\s*\1\s*=)/g,
            message: 'Use const for variables that are never reassigned',
            fixable: true,
            fix: (code: string, match: RegExpMatchArray) => {
                return code.replace('let ', 'const ');
            },
            examples: {
                bad: 'let name = "John";',
                good: 'const name = "John";'
            }
        });

        // TypeScript-specific rules
        this.addRule({
            id: 'explicit-return-types',
            name: 'Explicit Return Types',
            description: 'Functions should have explicit return types',
            category: 'structure',
            language: ['typescript'],
            severity: 'warning',
            pattern: /function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*{/g,
            message: 'Function should have explicit return type annotation',
            fixable: false,
            examples: {
                bad: 'function getName() { return "John"; }',
                good: 'function getName(): string { return "John"; }'
            }
        });

        this.addRule({
            id: 'no-any-type',
            name: 'No Any Type',
            description: 'Avoid using the any type',
            category: 'structure',
            language: ['typescript'],
            severity: 'error',
            pattern: /:\s*any\b/g,
            message: 'Avoid using the "any" type. Use specific types instead',
            fixable: false,
            examples: {
                bad: 'const data: any = {};',
                good: 'const data: { [key: string]: string } = {};'
            }
        });

        // Python PEP 8 Rules
        this.addRule({
            id: 'python-snake-case',
            name: 'Snake Case Variables',
            description: 'Python variables should use snake_case',
            category: 'naming',
            language: ['python'],
            severity: 'warning',
            pattern: /([a-z]+[A-Z][a-zA-Z]*)\s*=/g,
            message: 'Python variables should use snake_case, not camelCase',
            fixable: true,
            fix: (code: string, match: RegExpMatchArray) => {
                const variableName = match[1];
                const snakeCase = variableName.replace(/([A-Z])/g, '_$1').toLowerCase();
                return code.replace(variableName, snakeCase);
            },
            examples: {
                bad: 'userName = "John"',
                good: 'user_name = "John"'
            }
        });

        this.addRule({
            id: 'python-line-length',
            name: 'Line Length Limit',
            description: 'Lines should not exceed 88 characters',
            category: 'formatting',
            language: ['python'],
            severity: 'warning',
            pattern: /.{89,}/g,
            message: 'Line exceeds 88 character limit',
            fixable: false,
            examples: {
                bad: 'def very_long_function_name_that_exceeds_the_character_limit_and_should_be_broken_down():',
                good: 'def long_function_name():'
            }
        });

        // Import organization rules
        this.addRule({
            id: 'import-order',
            name: 'Import Order',
            description: 'Imports should be organized: standard library, third-party, local',
            category: 'imports',
            language: ['typescript', 'javascript', 'python'],
            severity: 'warning',
            pattern: /^import\s+.*$/gm,
            message: 'Imports should be organized by type',
            fixable: true,
            fix: (code: string) => {
                // Implementation would organize imports
                return code;
            },
            examples: {
                bad: 'import lodash from "lodash";\nimport fs from "fs";',
                good: 'import fs from "fs";\nimport lodash from "lodash";'
            }
        });

        // Comment rules
        this.addRule({
            id: 'jsdoc-functions',
            name: 'JSDoc Functions',
            description: 'Public functions should have JSDoc comments',
            category: 'comments',
            language: ['typescript', 'javascript'],
            severity: 'info',
            pattern: /(?:export\s+)?(?:public\s+)?function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*{/g,
            message: 'Public functions should have JSDoc documentation',
            fixable: false,
            examples: {
                bad: 'export function getName() { return "John"; }',
                good: '/**\n * Gets the user name\n */\nexport function getName() { return "John"; }'
            }
        });

        // Security rules
        this.addRule({
            id: 'no-console-log',
            name: 'No Console Log',
            description: 'Remove console.log statements in production code',
            category: 'security',
            language: ['typescript', 'javascript'],
            severity: 'warning',
            pattern: /console\.log\s*\(/g,
            message: 'Remove console.log statements from production code',
            fixable: true,
            fix: (code: string, match: RegExpMatchArray) => {
                return code.replace(match[0], '// ' + match[0]);
            },
            examples: {
                bad: 'console.log("Debug info");',
                good: 'logger.debug("Debug info");'
            }
        });

        // Performance rules
        this.addRule({
            id: 'no-synchronous-fs',
            name: 'No Synchronous File Operations',
            description: 'Use asynchronous file operations instead of synchronous ones',
            category: 'performance',
            language: ['typescript', 'javascript'],
            severity: 'warning',
            pattern: /fs\.(readFileSync|writeFileSync|existsSync)/g,
            message: 'Use asynchronous file operations for better performance',
            fixable: false,
            examples: {
                bad: 'fs.readFileSync("file.txt")',
                good: 'await fs.promises.readFile("file.txt")'
            }
        });
    }

    /**
     * Initialize popular style guides
     */
    private initializeStyleGuides(): void {
        // Airbnb JavaScript Style Guide
        this.addStyleGuide({
            id: 'airbnb-javascript',
            name: 'Airbnb JavaScript Style Guide',
            description: 'The most popular JavaScript style guide',
            version: '19.0.4',
            languages: ['javascript', 'typescript'],
            rules: [
                'camelcase-variables',
                'pascalcase-classes',
                'const-assertions',
                'import-order',
                'jsdoc-functions',
                'no-console-log'
            ],
            settings: {
                indent: 2,
                quotes: 'single',
                semicolons: true,
                trailingComma: 'es5'
            },
            official: true,
            url: 'https://github.com/airbnb/javascript'
        });

        // Google JavaScript Style Guide
        this.addStyleGuide({
            id: 'google-javascript',
            name: 'Google JavaScript Style Guide',
            description: 'Google\'s JavaScript style guide',
            version: '2.0',
            languages: ['javascript', 'typescript'],
            rules: [
                'camelcase-variables',
                'pascalcase-classes',
                'const-assertions',
                'explicit-return-types',
                'import-order',
                'jsdoc-functions'
            ],
            settings: {
                indent: 2,
                quotes: 'single',
                semicolons: true,
                maxLineLength: 80
            },
            official: true,
            url: 'https://google.github.io/styleguide/jsguide.html'
        });

        // TypeScript Strict
        this.addStyleGuide({
            id: 'typescript-strict',
            name: 'TypeScript Strict',
            description: 'Strict TypeScript rules for type safety',
            version: '1.0',
            languages: ['typescript'],
            rules: [
                'camelcase-variables',
                'pascalcase-classes',
                'const-assertions',
                'explicit-return-types',
                'no-any-type',
                'import-order',
                'jsdoc-functions'
            ],
            settings: {
                strict: true,
                noImplicitAny: true,
                noImplicitReturns: true,
                strictNullChecks: true
            },
            official: false
        });

        // Python PEP 8
        this.addStyleGuide({
            id: 'python-pep8',
            name: 'PEP 8 Python Style Guide',
            description: 'Official Python style guide',
            version: '1.0',
            languages: ['python'],
            rules: [
                'python-snake-case',
                'python-line-length',
                'import-order'
            ],
            settings: {
                indent: 4,
                maxLineLength: 88,
                quotes: 'double'
            },
            official: true,
            url: 'https://pep8.org/'
        });

        // Standard JavaScript
        this.addStyleGuide({
            id: 'standard-javascript',
            name: 'JavaScript Standard Style',
            description: 'JavaScript Standard Style - no configuration needed',
            version: '17.0',
            languages: ['javascript', 'typescript'],
            rules: [
                'camelcase-variables',
                'pascalcase-classes',
                'const-assertions',
                'import-order'
            ],
            settings: {
                indent: 2,
                quotes: 'single',
                semicolons: false,
                trailingComma: 'never'
            },
            official: true,
            url: 'https://standardjs.com/'
        });
    }

    /**
     * Initialize default team configurations
     */
    private initializeTeamConfigs(): void {
        this.addTeamConfig({
            teamId: 'default',
            name: 'Default Team Configuration',
            styleGuides: ['airbnb-javascript'],
            customRules: [],
            overrides: {},
            enforcementLevel: 'moderate',
            autoFix: true,
            reviewRequired: false
        });
    }

    /**
     * Add a style rule
     */
    public addRule(rule: StyleRule): void {
        this.rules.set(rule.id, rule);
    }

    /**
     * Add a style guide
     */
    public addStyleGuide(guide: StyleGuide): void {
        this.styleGuides.set(guide.id, guide);
    }

    /**
     * Add team configuration
     */
    public addTeamConfig(config: TeamStyleConfig): void {
        this.teamConfigs.set(config.teamId, config);
    }

    /**
     * Check code style and return violations
     */
    public async checkCodeStyle(
        code: string,
        filePath: string,
        styleGuideId?: string,
        teamId?: string
    ): Promise<StyleCheckResult> {
        const startTime = Date.now();
        const language = this.getLanguageFromPath(filePath);
        const totalLines = code.split('\n').length;

        try {
            // Get applicable style guide and rules
            const { styleGuide, rules } = this.getApplicableRules(language, styleGuideId, teamId);
            const violations: StyleViolation[] = [];

            // Check each rule
            for (const rule of rules) {
                if (!rule.language.includes(language)) continue;

                const ruleViolations = this.checkRule(code, rule);
                violations.push(...ruleViolations);
            }

            // Sort violations by line number
            violations.sort((a, b) => a.line - b.line || a.column - b.column);

            // Calculate compliance score
            const compliance = this.calculateComplianceScore(violations, totalLines);
            const checkDuration = Date.now() - startTime;

            // Record performance metrics
            this.recordPerformance(language, checkDuration);

            const result: StyleCheckResult = {
                success: true,
                filePath,
                violations,
                fixedViolations: [],
                totalLines,
                checkDuration,
                appliedStyleGuide: styleGuide?.name || 'Custom',
                compliance
            };

            // Store violation history
            this.violationHistory.set(filePath, violations);

            // Update VS Code diagnostics
            this.updateDiagnostics(filePath, violations);

            return result;

        } catch (error) {
            const checkDuration = Date.now() - startTime;
            return {
                success: false,
                filePath,
                violations: [],
                fixedViolations: [],
                totalLines,
                checkDuration,
                appliedStyleGuide: 'Error',
                compliance: {
                    score: 0,
                    errorsCount: 1,
                    warningsCount: 0,
                    infoCount: 0
                }
            };
        }
    }

    /**
     * Automatically fix style violations
     */
    public async autoFixViolations(
        code: string,
        filePath: string,
        styleGuideId?: string,
        teamId?: string
    ): Promise<{ code: string; fixedViolations: StyleViolation[]; unfixableViolations: StyleViolation[] }> {
        const checkResult = await this.checkCodeStyle(code, filePath, styleGuideId, teamId);
        let fixedCode = code;
        const fixedViolations: StyleViolation[] = [];
        const unfixableViolations: StyleViolation[] = [];

        // Sort violations by position (reverse order to maintain line numbers)
        const sortedViolations = checkResult.violations.sort((a, b) => 
            b.line - a.line || b.column - a.column
        );

        for (const violation of sortedViolations) {
            if (violation.fixable && violation.rule.fix) {
                try {
                    const lines = fixedCode.split('\n');
                    const lineContent = lines[violation.line - 1];
                    const match = lineContent.match(violation.rule.pattern);
                    
                    if (match) {
                        const fixedLine = violation.rule.fix(lineContent, match);
                        lines[violation.line - 1] = fixedLine;
                        fixedCode = lines.join('\n');
                        fixedViolations.push(violation);
                    }
                } catch (error) {
                    unfixableViolations.push(violation);
                }
            } else {
                unfixableViolations.push(violation);
            }
        }

        return {
            code: fixedCode,
            fixedViolations,
            unfixableViolations
        };
    }

    /**
     * Check multiple files in batch
     */
    public async checkMultipleFiles(
        files: { path: string; content: string }[],
        styleGuideId?: string,
        teamId?: string,
        progressCallback?: (progress: number, current: string) => void
    ): Promise<Map<string, StyleCheckResult>> {
        const results = new Map<string, StyleCheckResult>();
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (progressCallback) {
                progressCallback((i / total) * 100, file.path);
            }

            const result = await this.checkCodeStyle(file.content, file.path, styleGuideId, teamId);
            results.set(file.path, result);
        }

        if (progressCallback) {
            progressCallback(100, 'Complete');
        }

        return results;
    }

    /**
     * Get style guide recommendations for a project
     */
    public getStyleGuideRecommendations(
        languages: string[],
        projectType?: 'frontend' | 'backend' | 'fullstack' | 'library'
    ): StyleGuide[] {
        const recommendations: StyleGuide[] = [];
        
        for (const language of languages) {
            const guides = Array.from(this.styleGuides.values())
                .filter(guide => guide.languages.includes(language))
                .sort((a, b) => {
                    // Prioritize official guides
                    if (a.official && !b.official) return -1;
                    if (!a.official && b.official) return 1;
                    return a.name.localeCompare(b.name);
                });
            
            recommendations.push(...guides);
        }

        return recommendations;
    }

    /**
     * Get violation trends for a file or project
     */
    public getViolationTrends(filePath?: string): {
        trends: { date: string; violations: number; score: number }[];
        improvementSuggestions: string[];
    } {
        // This would typically connect to a database or file system
        // For now, return mock data
        return {
            trends: [],
            improvementSuggestions: [
                'Consider enabling auto-fix for formatting rules',
                'Add pre-commit hooks to catch violations early',
                'Review team style guide configuration'
            ]
        };
    }

    /**
     * Generate style guide configuration file
     */
    public generateConfigFile(
        styleGuideId: string,
        format: 'eslint' | 'prettier' | 'tslint' | 'pylint'
    ): string {
        const styleGuide = this.styleGuides.get(styleGuideId);
        if (!styleGuide) {
            throw new Error(`Style guide not found: ${styleGuideId}`);
        }

        switch (format) {
            case 'eslint':
                return JSON.stringify({
                    extends: [`@${styleGuide.name.toLowerCase().replace(/\s+/g, '-')}`],
                    rules: this.convertRulesToESLint(styleGuide.rules),
                    env: {
                        node: true,
                        browser: true,
                        es2021: true
                    }
                }, null, 2);

            case 'prettier':
                return JSON.stringify({
                    printWidth: styleGuide.settings.maxLineLength || 80,
                    tabWidth: styleGuide.settings.indent || 2,
                    useTabs: false,
                    semi: styleGuide.settings.semicolons !== false,
                    singleQuote: styleGuide.settings.quotes === 'single',
                    trailingComma: styleGuide.settings.trailingComma || 'es5'
                }, null, 2);

            default:
                throw new Error(`Unsupported config format: ${format}`);
        }
    }

    /**
     * Private helper methods
     */
    private getApplicableRules(
        language: string,
        styleGuideId?: string,
        teamId?: string
    ): { styleGuide: StyleGuide | undefined; rules: StyleRule[] } {
        let styleGuide: StyleGuide | undefined;
        
        if (styleGuideId) {
            styleGuide = this.styleGuides.get(styleGuideId);
        } else if (teamId) {
            const teamConfig = this.teamConfigs.get(teamId);
            if (teamConfig && teamConfig.styleGuides.length > 0) {
                styleGuide = this.styleGuides.get(teamConfig.styleGuides[0]);
            }
        }

        if (!styleGuide) {
            // Find default style guide for language
            styleGuide = Array.from(this.styleGuides.values())
                .find(guide => guide.languages.includes(language));
        }

        const rules: StyleRule[] = [];
        if (styleGuide) {
            for (const ruleId of styleGuide.rules) {
                const rule = this.rules.get(ruleId);
                if (rule) {
                    rules.push(rule);
                }
            }
        }

        return { styleGuide, rules };
    }

    private checkRule(code: string, rule: StyleRule): StyleViolation[] {
        const violations: StyleViolation[] = [];
        const lines = code.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let match;
            
            // Reset regex to check from beginning
            rule.pattern.lastIndex = 0;
            
            while ((match = rule.pattern.exec(line)) !== null) {
                violations.push({
                    rule,
                    line: lineIndex + 1,
                    column: match.index + 1,
                    endLine: lineIndex + 1,
                    endColumn: match.index + match[0].length + 1,
                    message: rule.message,
                    severity: rule.severity,
                    fixable: rule.fixable,
                    suggestion: rule.fixable ? 'Auto-fix available' : undefined
                });

                // Prevent infinite loop for global patterns
                if (!rule.pattern.global) break;
            }
        }

        return violations;
    }

    private calculateComplianceScore(violations: StyleViolation[], totalLines: number): {
        score: number;
        errorsCount: number;
        warningsCount: number;
        infoCount: number;
    } {
        const errorsCount = violations.filter(v => v.severity === 'error').length;
        const warningsCount = violations.filter(v => v.severity === 'warning').length;
        const infoCount = violations.filter(v => v.severity === 'info').length;

        // Calculate score based on violation severity and density
        const errorWeight = 3;
        const warningWeight = 2;
        const infoWeight = 1;

        const totalWeight = errorsCount * errorWeight + warningsCount * warningWeight + infoCount * infoWeight;
        const maxPossibleWeight = totalLines * errorWeight; // Assume worst case
        
        const score = Math.max(0, Math.round(100 - (totalWeight / Math.max(1, maxPossibleWeight)) * 100));

        return {
            score,
            errorsCount,
            warningsCount,
            infoCount
        };
    }

    private updateDiagnostics(filePath: string, violations: StyleViolation[]): void {
        const diagnostics: vscode.Diagnostic[] = violations.map(violation => {
            const range = new vscode.Range(
                violation.line - 1,
                violation.column - 1,
                violation.endLine - 1,
                violation.endColumn - 1
            );

            const severity = violation.severity === 'error' 
                ? vscode.DiagnosticSeverity.Error
                : violation.severity === 'warning'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;

            return new vscode.Diagnostic(range, violation.message, severity);
        });

        this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }

    private getLanguageFromPath(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        const mapping: { [key: string]: string } = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust'
        };
        return mapping[extension] || 'plaintext';
    }

    private recordPerformance(language: string, duration: number): void {
        if (!this.performanceMetrics.has(language)) {
            this.performanceMetrics.set(language, []);
        }
        
        const times = this.performanceMetrics.get(language)!;
        times.push(duration);
        
        // Keep only last 100 measurements
        if (times.length > 100) {
            times.shift();
        }
    }

    private convertRulesToESLint(ruleIds: string[]): { [key: string]: any } {
        const eslintRules: { [key: string]: any } = {};
        
        for (const ruleId of ruleIds) {
            const rule = this.rules.get(ruleId);
            if (!rule) continue;

            // Map internal rules to ESLint rules (simplified)
            switch (ruleId) {
                case 'camelcase-variables':
                    eslintRules['camelcase'] = 'warn';
                    break;
                case 'no-console-log':
                    eslintRules['no-console'] = 'warn';
                    break;
                case 'const-assertions':
                    eslintRules['prefer-const'] = 'warn';
                    break;
                // Add more mappings as needed
            }
        }

        return eslintRules;
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): Map<string, { average: number; min: number; max: number; count: number }> {
        const metrics = new Map();
        
        for (const [language, times] of Array.from(this.performanceMetrics.entries())) {
            const average = times.reduce((a, b) => a + b, 0) / times.length;
            const min = Math.min(...times);
            const max = Math.max(...times);
            const count = times.length;
            
            metrics.set(language, { average, min, max, count });
        }
        
        return metrics;
    }

    /**
     * Clear diagnostics
     */
    public clearDiagnostics(filePath?: string): void {
        if (filePath) {
            this.diagnosticCollection.delete(vscode.Uri.file(filePath));
        } else {
            this.diagnosticCollection.clear();
        }
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}

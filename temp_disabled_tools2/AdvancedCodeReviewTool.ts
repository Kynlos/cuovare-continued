import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface CodeIssue {
    file: string;
    line: number;
    column?: number;
    severity: 'error' | 'warning' | 'info' | 'suggestion';
    category: string;
    message: string;
    suggestion?: string;
    code?: string;
}

interface CodeReviewResult {
    files: string[];
    issues: CodeIssue[];
    summary: {
        totalIssues: number;
        errors: number;
        warnings: number;
        suggestions: number;
        linesAnalyzed: number;
        filesAnalyzed: number;
    };
    recommendations: string[];
    score: number; // 0-100 code quality score
}

export class AdvancedCodeReviewTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'advanced_code_review',
        description: 'AI-powered comprehensive code analysis with suggestions, best practices validation, and quality scoring',
        category: 'Code Quality',
        parameters: [
            { name: 'target', description: 'File path or directory to analyze', required: true, type: 'string' },
            { name: 'language', description: 'Programming language (auto-detect if not specified)', required: false, type: 'string' },
            { name: 'includeTests', description: 'Include test files in analysis (default: true)', required: false, type: 'boolean' },
            { name: 'severity', description: 'Minimum severity level: error, warning, info, suggestion (default: info)', required: false, type: 'string' },
            { name: 'categories', description: 'Analysis categories: security, performance, maintainability, bugs, style (default: all)', required: false, type: 'array' },
            { name: 'generateReport', description: 'Generate detailed HTML report (default: false)', required: false, type: 'boolean' }
        ],
        examples: [
            'Review single file: { "target": "src/utils/helper.ts" }',
            'Review directory: { "target": "src/components", "severity": "warning" }',
            'Security-focused review: { "target": "src/auth", "categories": ["security", "bugs"] }',
            'Full project review: { "target": "src", "generateReport": true }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting advanced code review of: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            // Validate target path
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const includeTests = payload.includeTests !== false;
            const severity = payload.severity || 'info';
            const categories = payload.categories || ['security', 'performance', 'maintainability', 'bugs', 'style'];
            const generateReport = payload.generateReport === true;

            // Collect files to analyze
            const filesToAnalyze = await this.collectFiles(targetPath, payload.language, includeTests);
            context.onProgress?.(`Found ${filesToAnalyze.length} files to analyze`);

            if (filesToAnalyze.length === 0) {
                return {
                    success: true,
                    message: 'No files found to analyze',
                    data: { files: [], issues: [], summary: { totalIssues: 0 } }
                };
            }

            // Analyze files
            const issues: CodeIssue[] = [];
            let totalLines = 0;

            for (let i = 0; i < filesToAnalyze.length; i++) {
                const file = filesToAnalyze[i];
                context.onProgress?.(`Analyzing file ${i + 1}/${filesToAnalyze.length}: ${path.relative(context.workspaceRoot, file)}`);
                
                const fileIssues = await this.analyzeFile(file, context.workspaceRoot, categories);
                issues.push(...fileIssues);
                
                // Count lines
                const content = fs.readFileSync(file, 'utf8');
                totalLines += content.split('\n').length;
            }

            // Filter by severity
            const filteredIssues = this.filterBySeverity(issues, severity);

            // Generate summary
            const summary = this.generateSummary(filteredIssues, totalLines, filesToAnalyze.length);
            
            // Generate recommendations
            const recommendations = this.generateRecommendations(filteredIssues);
            
            // Calculate quality score
            const score = this.calculateQualityScore(filteredIssues, totalLines);

            const result: CodeReviewResult = {
                files: filesToAnalyze.map(f => path.relative(context.workspaceRoot, f)),
                issues: filteredIssues,
                summary,
                recommendations,
                score
            };

            // Generate HTML report if requested
            if (generateReport) {
                const reportPath = await this.generateHtmlReport(result, context.workspaceRoot);
                context.outputChannel.appendLine(`Generated detailed report: ${reportPath}`);
            }

            const message = this.formatResultMessage(result);
            
            return {
                success: true,
                message,
                data: result
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Code review failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async collectFiles(targetPath: string, language?: string, includeTests: boolean = true): Promise<string[]> {
        const files: string[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            return [targetPath];
        }

        const extensions = this.getExtensionsForLanguage(language);
        
        const collectRecursively = (dir: string) => {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Skip common non-source directories
                    if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry)) {
                        collectRecursively(fullPath);
                    }
                } else if (stat.isFile()) {
                    const ext = path.extname(entry);
                    const isTestFile = /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(entry);
                    
                    if (extensions.includes(ext) && (includeTests || !isTestFile)) {
                        files.push(fullPath);
                    }
                }
            }
        };

        collectRecursively(targetPath);
        return files;
    }

    private getExtensionsForLanguage(language?: string): string[] {
        const extensionMap: { [key: string]: string[] } = {
            typescript: ['.ts', '.tsx'],
            javascript: ['.js', '.jsx', '.mjs'],
            python: ['.py'],
            java: ['.java'],
            csharp: ['.cs'],
            go: ['.go'],
            rust: ['.rs'],
            php: ['.php'],
            ruby: ['.rb'],
            swift: ['.swift'],
            kotlin: ['.kt']
        };

        if (language && extensionMap[language.toLowerCase()]) {
            return extensionMap[language.toLowerCase()];
        }

        // Default: common web development extensions
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'];
    }

    private async analyzeFile(filePath: string, workspaceRoot: string, categories: string[]): Promise<CodeIssue[]> {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(workspaceRoot, filePath);
        const issues: CodeIssue[] = [];
        const lines = content.split('\n');

        // Security analysis
        if (categories.includes('security')) {
            issues.push(...this.analyzeSecurityIssues(content, relativePath, lines));
        }

        // Performance analysis
        if (categories.includes('performance')) {
            issues.push(...this.analyzePerformanceIssues(content, relativePath, lines));
        }

        // Maintainability analysis
        if (categories.includes('maintainability')) {
            issues.push(...this.analyzeMaintainabilityIssues(content, relativePath, lines));
        }

        // Bug detection
        if (categories.includes('bugs')) {
            issues.push(...this.analyzeBugPatterns(content, relativePath, lines));
        }

        // Style analysis
        if (categories.includes('style')) {
            issues.push(...this.analyzeStyleIssues(content, relativePath, lines));
        }

        return issues;
    }

    private analyzeSecurityIssues(content: string, file: string, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        // Check for potential security vulnerabilities
        const securityPatterns = [
            { pattern: /eval\s*\(/g, message: 'Avoid using eval() - potential code injection risk', severity: 'error' as const },
            { pattern: /innerHTML\s*=/g, message: 'Direct innerHTML assignment can lead to XSS vulnerabilities', severity: 'warning' as const },
            { pattern: /document\.write\s*\(/g, message: 'document.write() can be exploited for XSS attacks', severity: 'warning' as const },
            { pattern: /\.html\(/g, message: 'Direct HTML injection - consider sanitization', severity: 'warning' as const },
            { pattern: /password\s*=\s*["']/gi, message: 'Hardcoded password detected', severity: 'error' as const },
            { pattern: /api[_-]?key\s*=\s*["']/gi, message: 'Hardcoded API key detected', severity: 'error' as const },
            { pattern: /Math\.random\(\)/g, message: 'Math.random() is not cryptographically secure', severity: 'info' as const }
        ];

        securityPatterns.forEach(({ pattern, message, severity }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                issues.push({
                    file,
                    line: lineNumber,
                    severity,
                    category: 'Security',
                    message,
                    code: lines[lineNumber - 1]?.trim()
                });
            }
        });

        return issues;
    }

    private analyzePerformanceIssues(content: string, file: string, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        const performancePatterns = [
            { pattern: /console\.log\(/g, message: 'Remove console.log statements in production', severity: 'info' as const },
            { pattern: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length/g, message: 'Cache array length in loops for better performance', severity: 'suggestion' as const },
            { pattern: /document\.getElementById\(/g, message: 'Consider caching DOM queries', severity: 'suggestion' as const },
            { pattern: /JSON\.parse\(JSON\.stringify\(/g, message: 'Deep cloning with JSON is inefficient - consider alternatives', severity: 'warning' as const },
            { pattern: /setInterval\(/g, message: 'setInterval can cause memory leaks - ensure proper cleanup', severity: 'info' as const }
        ];

        performancePatterns.forEach(({ pattern, message, severity }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                issues.push({
                    file,
                    line: lineNumber,
                    severity,
                    category: 'Performance',
                    message,
                    code: lines[lineNumber - 1]?.trim()
                });
            }
        });

        return issues;
    }

    private analyzeMaintainabilityIssues(content: string, file: string, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        // Check function length
        const functionMatches = content.match(/function\s+\w+[^{]*{[\s\S]*?^}/gm) || [];
        functionMatches.forEach(func => {
            const lineCount = func.split('\n').length;
            if (lineCount > 50) {
                const match = func.match(/function\s+(\w+)/);
                const functionName = match ? match[1] : 'anonymous';
                issues.push({
                    file,
                    line: 1, // Would need more complex parsing for exact line
                    severity: 'warning',
                    category: 'Maintainability',
                    message: `Function '${functionName}' is too long (${lineCount} lines). Consider breaking it down.`,
                    suggestion: 'Split into smaller, focused functions'
                });
            }
        });

        // Check for magic numbers
        const magicNumberPattern = /(?<![a-zA-Z_$])\b(?!0|1)\d{2,}\b(?![a-zA-Z_$])/g;
        let match;
        while ((match = magicNumberPattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            issues.push({
                file,
                line: lineNumber,
                severity: 'suggestion',
                category: 'Maintainability',
                message: `Magic number detected: ${match[0]}. Consider using a named constant.`,
                code: lines[lineNumber - 1]?.trim()
            });
        }

        return issues;
    }

    private analyzeBugPatterns(content: string, file: string, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        const bugPatterns = [
            { pattern: /==\s*null/g, message: 'Use === null for strict null comparison', severity: 'warning' as const },
            { pattern: /!=\s*null/g, message: 'Use !== null for strict null comparison', severity: 'warning' as const },
            { pattern: /var\s+/g, message: 'Use let or const instead of var', severity: 'warning' as const },
            { pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/g, message: 'Empty catch block - handle errors appropriately', severity: 'error' as const },
            { pattern: /debugger/g, message: 'Remove debugger statements', severity: 'warning' as const }
        ];

        bugPatterns.forEach(({ pattern, message, severity }) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                issues.push({
                    file,
                    line: lineNumber,
                    severity,
                    category: 'Potential Bugs',
                    message,
                    code: lines[lineNumber - 1]?.trim()
                });
            }
        });

        return issues;
    }

    private analyzeStyleIssues(content: string, file: string, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        // Check for missing semicolons (for JS/TS)
        if (file.match(/\.(js|ts|jsx|tsx)$/)) {
            lines.forEach((line, index) => {
                const trimmed = line.trim();
                if (trimmed && 
                    !trimmed.endsWith(';') && 
                    !trimmed.endsWith('{') && 
                    !trimmed.endsWith('}') &&
                    !trimmed.startsWith('//') &&
                    !trimmed.startsWith('*') &&
                    !trimmed.includes('import ') &&
                    !trimmed.includes('export ')) {
                    
                    issues.push({
                        file,
                        line: index + 1,
                        severity: 'suggestion',
                        category: 'Style',
                        message: 'Missing semicolon',
                        code: trimmed
                    });
                }
            });
        }

        return issues;
    }

    private filterBySeverity(issues: CodeIssue[], minSeverity: string): CodeIssue[] {
        const severityOrder = ['suggestion', 'info', 'warning', 'error'];
        const minIndex = severityOrder.indexOf(minSeverity);
        
        if (minIndex === -1) return issues;
        
        return issues.filter(issue => severityOrder.indexOf(issue.severity) >= minIndex);
    }

    private generateSummary(issues: CodeIssue[], linesAnalyzed: number, filesAnalyzed: number) {
        return {
            totalIssues: issues.length,
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            suggestions: issues.filter(i => i.severity === 'suggestion').length + issues.filter(i => i.severity === 'info').length,
            linesAnalyzed,
            filesAnalyzed
        };
    }

    private generateRecommendations(issues: CodeIssue[]): string[] {
        const recommendations: string[] = [];
        
        const securityIssues = issues.filter(i => i.category === 'Security').length;
        const performanceIssues = issues.filter(i => i.category === 'Performance').length;
        const maintainabilityIssues = issues.filter(i => i.category === 'Maintainability').length;

        if (securityIssues > 0) {
            recommendations.push(`Address ${securityIssues} security issues immediately`);
        }
        
        if (performanceIssues > 5) {
            recommendations.push('Consider performance optimization - multiple issues detected');
        }
        
        if (maintainabilityIssues > 10) {
            recommendations.push('Refactor code for better maintainability');
        }

        if (issues.length === 0) {
            recommendations.push('Great job! No significant issues found.');
        }

        return recommendations;
    }

    private calculateQualityScore(issues: CodeIssue[], totalLines: number): number {
        if (totalLines === 0) return 100;
        
        const errorWeight = 10;
        const warningWeight = 5;
        const suggestionWeight = 1;
        
        const weightedIssues = issues.reduce((sum, issue) => {
            switch (issue.severity) {
                case 'error': return sum + errorWeight;
                case 'warning': return sum + warningWeight;
                case 'info':
                case 'suggestion': return sum + suggestionWeight;
                default: return sum;
            }
        }, 0);
        
        const issuesPerLine = weightedIssues / totalLines;
        const score = Math.max(0, 100 - (issuesPerLine * 1000)); // Scale factor
        
        return Math.round(score);
    }

    private async generateHtmlReport(result: CodeReviewResult, workspaceRoot: string): Promise<string> {
        const reportPath = path.join(workspaceRoot, 'code-review-report.html');
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Code Review Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .score { font-size: 2em; color: ${result.score >= 80 ? 'green' : result.score >= 60 ? 'orange' : 'red'}; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .error { border-left-color: #d32f2f; }
        .warning { border-left-color: #f57c00; }
        .suggestion { border-left-color: #1976d2; }
        .code { background: #f5f5f5; padding: 5px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Code Review Report</h1>
        <div class="score">Quality Score: ${result.score}/100</div>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <h2>Summary</h2>
    <ul>
        <li>Files analyzed: ${result.summary.filesAnalyzed}</li>
        <li>Lines analyzed: ${result.summary.linesAnalyzed}</li>
        <li>Total issues: ${result.summary.totalIssues}</li>
        <li>Errors: ${result.summary.errors}</li>
        <li>Warnings: ${result.summary.warnings}</li>
        <li>Suggestions: ${result.summary.suggestions}</li>
    </ul>
    
    <h2>Recommendations</h2>
    <ul>
        ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    
    <h2>Issues</h2>
    ${result.issues.map(issue => `
        <div class="issue ${issue.severity}">
            <strong>${issue.category} - ${issue.severity.toUpperCase()}</strong><br>
            <strong>File:</strong> ${issue.file}:${issue.line}<br>
            <strong>Message:</strong> ${issue.message}<br>
            ${issue.code ? `<div class="code">${issue.code}</div>` : ''}
            ${issue.suggestion ? `<strong>Suggestion:</strong> ${issue.suggestion}` : ''}
        </div>
    `).join('')}
</body>
</html>`;
        
        fs.writeFileSync(reportPath, html, 'utf8');
        return reportPath;
    }

    private formatResultMessage(result: CodeReviewResult): string {
        const { summary, score } = result;
        
        let message = `Code review completed! Quality score: ${score}/100\n`;
        message += `📊 Analyzed ${summary.filesAnalyzed} files (${summary.linesAnalyzed} lines)\n`;
        message += `🔍 Found ${summary.totalIssues} issues: `;
        message += `${summary.errors} errors, ${summary.warnings} warnings, ${summary.suggestions} suggestions\n`;
        
        if (result.recommendations.length > 0) {
            message += `💡 Top recommendations:\n${result.recommendations.slice(0, 3).map(r => `  • ${r}`).join('\n')}`;
        }
        
        return message;
    }
}

export default new AdvancedCodeReviewTool();

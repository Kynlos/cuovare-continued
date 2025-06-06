import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface PerformanceIssue {
    file: string;
    line: number;
    type: 'memory' | 'cpu' | 'network' | 'rendering' | 'bundle-size' | 'algorithm';
    severity: 'critical' | 'major' | 'minor' | 'suggestion';
    message: string;
    impact: string;
    suggestion: string;
    estimatedGain: string;
    code?: string;
    fix?: {
        description: string;
        before: string;
        after: string;
    };
}

interface PerformanceMetrics {
    bundleSize?: {
        total: number;
        gzipped: number;
        largest: Array<{ file: string; size: number }>;
    };
    complexity: {
        cyclomatic: number;
        cognitive: number;
        maintainability: number;
    };
    dependencies: {
        total: number;
        outdated: number;
        unused: string[];
        heavy: Array<{ name: string; size: string }>;
    };
    codeSmells: {
        duplicatedCode: number;
        longMethods: number;
        deepNesting: number;
        tooManyParams: number;
    };
}

export class PerformanceOptimizationTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'performance_optimization',
        description: 'Identify and fix performance bottlenecks with detailed analysis and automated optimizations',
        category: 'Performance',
        parameters: [
            { name: 'target', description: 'File or directory to analyze for performance issues', required: true, type: 'string' },
            { name: 'analysisType', description: 'Type: code, bundle, runtime, memory, network (default: all)', required: false, type: 'array' },
            { name: 'severity', description: 'Minimum severity: critical, major, minor, suggestion', required: false, type: 'string' },
            { name: 'autoOptimize', description: 'Automatically apply safe optimizations (default: false)', required: false, type: 'boolean' },
            { name: 'generateReport', description: 'Generate detailed performance report (default: true)', required: false, type: 'boolean' },
            { name: 'includeMetrics', description: 'Include detailed performance metrics (default: true)', required: false, type: 'boolean' }
        ],
        examples: [
            'Analyze performance: { "target": "src/components", "analysisType": ["code", "bundle"] }',
            'Critical issues only: { "target": "src/app.ts", "severity": "critical" }',
            'Auto-optimize: { "target": "src/utils", "autoOptimize": true }',
            'Full analysis: { "target": "src", "generateReport": true, "includeMetrics": true }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting performance analysis: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const analysisTypes = payload.analysisType || ['code', 'bundle', 'runtime', 'memory'];
            const severity = payload.severity || 'suggestion';
            const autoOptimize = payload.autoOptimize === true;
            const generateReport = payload.generateReport !== false;
            const includeMetrics = payload.includeMetrics !== false;

            // Collect files for analysis
            const filesToAnalyze = await this.collectFiles(targetPath);
            context.onProgress?.(`Found ${filesToAnalyze.length} files for performance analysis`);

            const allIssues: PerformanceIssue[] = [];
            let metrics: PerformanceMetrics | undefined;

            // Perform different types of analysis
            for (const analysisType of analysisTypes) {
                context.onProgress?.(`Running ${analysisType} analysis...`);
                
                switch (analysisType) {
                    case 'code':
                        const codeIssues = await this.analyzeCodePerformance(filesToAnalyze, context.workspaceRoot);
                        allIssues.push(...codeIssues);
                        break;
                    case 'bundle':
                        const bundleIssues = await this.analyzeBundleSize(targetPath, context.workspaceRoot);
                        allIssues.push(...bundleIssues);
                        break;
                    case 'runtime':
                        const runtimeIssues = await this.analyzeRuntimePerformance(filesToAnalyze, context.workspaceRoot);
                        allIssues.push(...runtimeIssues);
                        break;
                    case 'memory':
                        const memoryIssues = await this.analyzeMemoryUsage(filesToAnalyze, context.workspaceRoot);
                        allIssues.push(...memoryIssues);
                        break;
                    case 'network':
                        const networkIssues = await this.analyzeNetworkOptimization(filesToAnalyze, context.workspaceRoot);
                        allIssues.push(...networkIssues);
                        break;
                }
            }

            // Generate metrics if requested
            if (includeMetrics) {
                context.onProgress?.('Calculating performance metrics...');
                metrics = await this.calculateMetrics(filesToAnalyze, context.workspaceRoot);
            }

            // Filter by severity
            const filteredIssues = this.filterBySeverity(allIssues, severity);

            // Apply auto-optimizations if requested
            let optimizedCount = 0;
            if (autoOptimize && filteredIssues.length > 0) {
                context.onProgress?.('Applying automatic optimizations...');
                optimizedCount = await this.applyOptimizations(filteredIssues, context);
            }

            // Generate report if requested
            let reportPath: string | undefined;
            if (generateReport) {
                context.onProgress?.('Generating performance report...');
                reportPath = await this.generatePerformanceReport(filteredIssues, metrics, context.workspaceRoot);
            }

            const message = this.formatResults(filteredIssues, optimizedCount, reportPath);

            return {
                success: true,
                message,
                data: {
                    issues: filteredIssues,
                    metrics,
                    summary: {
                        totalIssues: filteredIssues.length,
                        critical: filteredIssues.filter(i => i.severity === 'critical').length,
                        major: filteredIssues.filter(i => i.severity === 'major').length,
                        minor: filteredIssues.filter(i => i.severity === 'minor').length,
                        suggestions: filteredIssues.filter(i => i.severity === 'suggestion').length,
                        optimizedCount,
                        analysisTypes
                    },
                    reportPath
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Performance optimization failed: ${errorMessage}`);
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
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte'].includes(ext);
    }

    private async analyzeCodePerformance(files: string[], workspaceRoot: string): Promise<PerformanceIssue[]> {
        const issues: PerformanceIssue[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(workspaceRoot, file);
            const lines = content.split('\n');

            // Check for performance anti-patterns
            const performancePatterns = [
                {
                    pattern: /for\s*\([^}]+\.length[^}]+\)/g,
                    type: 'cpu' as const,
                    severity: 'minor' as const,
                    message: 'Array length accessed in loop',
                    impact: 'Unnecessary repeated property access',
                    suggestion: 'Cache array length before loop',
                    estimatedGain: '5-10% in tight loops',
                    fix: {
                        description: 'Cache array length in variable',
                        before: 'for (let i = 0; i < array.length; i++)',
                        after: 'for (let i = 0, len = array.length; i < len; i++)'
                    }
                },
                {
                    pattern: /document\.getElementById\([^)]+\)/g,
                    type: 'rendering' as const,
                    severity: 'minor' as const,
                    message: 'Repeated DOM query',
                    impact: 'Expensive DOM traversal on each call',
                    suggestion: 'Cache DOM element references',
                    estimatedGain: '10-30% in DOM-heavy operations',
                    fix: {
                        description: 'Cache DOM element',
                        before: 'document.getElementById("element")',
                        after: 'const element = document.getElementById("element")'
                    }
                },
                {
                    pattern: /JSON\.parse\(JSON\.stringify\(/g,
                    type: 'cpu' as const,
                    severity: 'major' as const,
                    message: 'Inefficient deep cloning',
                    impact: 'Slow serialization/deserialization process',
                    suggestion: 'Use structured cloning or libraries like Lodash',
                    estimatedGain: '50-80% improvement',
                    fix: {
                        description: 'Use structuredClone or library',
                        before: 'JSON.parse(JSON.stringify(obj))',
                        after: 'structuredClone(obj) // or _.cloneDeep(obj)'
                    }
                },
                {
                    pattern: /new\s+RegExp\(/g,
                    type: 'cpu' as const,
                    severity: 'minor' as const,
                    message: 'RegExp created at runtime',
                    impact: 'Compilation overhead on each creation',
                    suggestion: 'Use regex literals when pattern is static',
                    estimatedGain: '10-20% in regex-heavy code',
                    fix: {
                        description: 'Use regex literal',
                        before: 'new RegExp("pattern", "flags")',
                        after: '/pattern/flags'
                    }
                },
                {
                    pattern: /\.map\([^}]+\)\.filter\(/g,
                    type: 'cpu' as const,
                    severity: 'minor' as const,
                    message: 'Chained map().filter() operations',
                    impact: 'Multiple array iterations',
                    suggestion: 'Use reduce() or flatMap() for single iteration',
                    estimatedGain: '20-40% for large arrays',
                    fix: {
                        description: 'Combine operations',
                        before: 'array.map(fn).filter(predicate)',
                        after: 'array.reduce((acc, item) => { const mapped = fn(item); return predicate(mapped) ? [...acc, mapped] : acc; }, [])'
                    }
                }
            ];

            performancePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    issues.push({
                        file: relativePath,
                        line: lineNumber,
                        type: pattern.type,
                        severity: pattern.severity,
                        message: pattern.message,
                        impact: pattern.impact,
                        suggestion: pattern.suggestion,
                        estimatedGain: pattern.estimatedGain,
                        code: lines[lineNumber - 1]?.trim(),
                        fix: pattern.fix
                    });
                }
            });

            // Check for large functions
            const functionMatches = content.match(/function\s+\w+[^{]*{[\s\S]*?^}/gm) || [];
            functionMatches.forEach(func => {
                const lineCount = func.split('\n').length;
                if (lineCount > 100) {
                    issues.push({
                        file: relativePath,
                        line: 1,
                        type: 'cpu',
                        severity: 'major',
                        message: `Large function detected (${lineCount} lines)`,
                        impact: 'Harder to optimize by JS engines',
                        suggestion: 'Break into smaller functions',
                        estimatedGain: '10-30% potential optimization'
                    });
                }
            });
        }

        return issues;
    }

    private async analyzeBundleSize(targetPath: string, workspaceRoot: string): Promise<PerformanceIssue[]> {
        const issues: PerformanceIssue[] = [];

        try {
            // Check for large dependencies
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

                // Known heavy libraries
                const heavyLibraries = {
                    'moment': 'Consider using date-fns or dayjs for smaller bundle size',
                    'lodash': 'Consider using individual lodash methods or native alternatives',
                    'jquery': 'Consider using vanilla JS or lighter alternatives',
                    'bootstrap': 'Consider using CSS-only version or utility-first frameworks',
                    'material-ui': 'Consider tree-shaking or lighter component libraries'
                };

                Object.keys(dependencies).forEach(dep => {
                    if (heavyLibraries[dep]) {
                        issues.push({
                            file: 'package.json',
                            line: 1,
                            type: 'bundle-size',
                            severity: 'minor',
                            message: `Heavy dependency detected: ${dep}`,
                            impact: 'Increases bundle size significantly',
                            suggestion: heavyLibraries[dep],
                            estimatedGain: '10-50% bundle size reduction'
                        });
                    }
                });
            }

            // Check for unused imports
            const files = await this.collectFiles(targetPath);
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf8');
                const relativePath = path.relative(workspaceRoot, file);

                // Simple unused import detection
                const importMatches = content.match(/import\s+{([^}]+)}\s+from/g) || [];
                importMatches.forEach(importStatement => {
                    const imported = importStatement.match(/{([^}]+)}/)?.[1];
                    if (imported) {
                        const imports = imported.split(',').map(i => i.trim());
                        imports.forEach(imp => {
                            const usageRegex = new RegExp(`\\b${imp}\\b`, 'g');
                            const usages = (content.match(usageRegex) || []).length;
                            if (usages <= 1) { // Only the import itself
                                issues.push({
                                    file: relativePath,
                                    line: 1,
                                    type: 'bundle-size',
                                    severity: 'suggestion',
                                    message: `Potentially unused import: ${imp}`,
                                    impact: 'Unnecessary code in bundle',
                                    suggestion: 'Remove unused imports',
                                    estimatedGain: '1-5% bundle size reduction'
                                });
                            }
                        });
                    }
                });
            }

        } catch (error) {
            // Bundle analysis failed, continue without it
        }

        return issues;
    }

    private async analyzeRuntimePerformance(files: string[], workspaceRoot: string): Promise<PerformanceIssue[]> {
        const issues: PerformanceIssue[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(workspaceRoot, file);

            // Check for performance-impacting patterns
            const runtimePatterns = [
                {
                    pattern: /setInterval\([^,]+,\s*\d+\)/g,
                    message: 'setInterval without cleanup',
                    impact: 'Potential memory leaks',
                    suggestion: 'Store interval reference and clear on cleanup'
                },
                {
                    pattern: /addEventListener\([^,]+,[^,]+\)/g,
                    message: 'Event listener without cleanup',
                    impact: 'Memory leaks in SPAs',
                    suggestion: 'Use removeEventListener in cleanup'
                },
                {
                    pattern: /\.innerHTML\s*=/g,
                    message: 'Direct innerHTML manipulation',
                    impact: 'Forces full re-parsing',
                    suggestion: 'Use textContent or DOM methods'
                }
            ];

            runtimePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    issues.push({
                        file: relativePath,
                        line: lineNumber,
                        type: 'runtime',
                        severity: 'minor',
                        message: pattern.message,
                        impact: pattern.impact,
                        suggestion: pattern.suggestion,
                        estimatedGain: '5-15% runtime improvement'
                    });
                }
            });
        }

        return issues;
    }

    private async analyzeMemoryUsage(files: string[], workspaceRoot: string): Promise<PerformanceIssue[]> {
        const issues: PerformanceIssue[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(workspaceRoot, file);

            // Check for memory leak patterns
            const memoryPatterns = [
                {
                    pattern: /new\s+Array\(\d+\)/g,
                    message: 'Large array pre-allocation',
                    impact: 'Immediate memory allocation',
                    suggestion: 'Consider lazy initialization or streaming'
                },
                {
                    pattern: /window\.\w+\s*=/g,
                    message: 'Global variable assignment',
                    impact: 'Memory never freed',
                    suggestion: 'Use modules or explicit cleanup'
                }
            ];

            memoryPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    issues.push({
                        file: relativePath,
                        line: lineNumber,
                        type: 'memory',
                        severity: 'minor',
                        message: pattern.message,
                        impact: pattern.impact,
                        suggestion: pattern.suggestion,
                        estimatedGain: '10-30% memory usage reduction'
                    });
                }
            });
        }

        return issues;
    }

    private async analyzeNetworkOptimization(files: string[], workspaceRoot: string): Promise<PerformanceIssue[]> {
        const issues: PerformanceIssue[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(workspaceRoot, file);

            // Check for network performance issues
            const networkPatterns = [
                {
                    pattern: /fetch\([^)]+\)(?!\.then)/g,
                    message: 'Fetch without error handling',
                    impact: 'Unhandled network failures',
                    suggestion: 'Add proper error handling and retries'
                },
                {
                    pattern: /await\s+fetch[^;]+;\s*await\s+fetch/g,
                    message: 'Sequential API calls',
                    impact: 'Unnecessary wait time',
                    suggestion: 'Use Promise.all() for parallel requests'
                }
            ];

            networkPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.pattern.exec(content)) !== null) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    issues.push({
                        file: relativePath,
                        line: lineNumber,
                        type: 'network',
                        severity: 'minor',
                        message: pattern.message,
                        impact: pattern.impact,
                        suggestion: pattern.suggestion,
                        estimatedGain: '20-50% faster load times'
                    });
                }
            });
        }

        return issues;
    }

    private async calculateMetrics(files: string[], workspaceRoot: string): Promise<PerformanceMetrics> {
        let totalComplexity = 0;
        let totalCognitive = 0;
        let totalMaintainability = 0;
        let duplicatedCode = 0;
        let longMethods = 0;
        let deepNesting = 0;
        let tooManyParams = 0;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Calculate complexity metrics
            totalComplexity += this.calculateCyclomaticComplexity(content);
            totalCognitive += this.calculateCognitiveComplexity(content);
            totalMaintainability += this.calculateMaintainabilityIndex(content);

            // Count code smells
            const functions = content.match(/function[^{]*{[^}]*}/g) || [];
            longMethods += functions.filter(func => func.split('\n').length > 20).length;
            
            const paramMatches = content.match(/function[^(]*\(([^)]*)\)/g) || [];
            tooManyParams += paramMatches.filter(match => 
                (match.match(/,/g) || []).length >= 5
            ).length;

            const nestingMatches = content.match(/{[^{}]*{[^{}]*{[^{}]*{/g) || [];
            deepNesting += nestingMatches.length;
        }

        // Check dependencies
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        let dependencyMetrics = { total: 0, outdated: 0, unused: [], heavy: [] };
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            dependencyMetrics.total = Object.keys(dependencies).length;
        }

        return {
            complexity: {
                cyclomatic: Math.round(totalComplexity / files.length),
                cognitive: Math.round(totalCognitive / files.length),
                maintainability: Math.round(totalMaintainability / files.length)
            },
            dependencies: dependencyMetrics,
            codeSmells: {
                duplicatedCode,
                longMethods,
                deepNesting,
                tooManyParams
            }
        };
    }

    private calculateCyclomaticComplexity(content: string): number {
        const complexityKeywords = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', '&&', '||', '?'];
        let complexity = 1;
        
        complexityKeywords.forEach(keyword => {
            const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
            if (matches) complexity += matches.length;
        });
        
        return complexity;
    }

    private calculateCognitiveComplexity(content: string): number {
        // Simplified cognitive complexity calculation
        let complexity = 0;
        const lines = content.split('\n');
        let nestingLevel = 0;
        
        lines.forEach(line => {
            if (line.includes('{')) nestingLevel++;
            if (line.includes('}')) nestingLevel = Math.max(0, nestingLevel - 1);
            
            if (/\b(if|for|while|switch)\b/.test(line)) {
                complexity += 1 + nestingLevel;
            }
        });
        
        return complexity;
    }

    private calculateMaintainabilityIndex(content: string): number {
        const loc = content.split('\n').length;
        const complexity = this.calculateCyclomaticComplexity(content);
        const comments = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        
        // Simplified maintainability index (0-100, higher is better)
        let index = 100;
        index -= Math.min(loc / 10, 30);
        index -= Math.min(complexity * 2, 40);
        index += Math.min(comments * 2, 20);
        
        return Math.max(0, Math.round(index));
    }

    private filterBySeverity(issues: PerformanceIssue[], minSeverity: string): PerformanceIssue[] {
        const severityOrder = ['suggestion', 'minor', 'major', 'critical'];
        const minIndex = severityOrder.indexOf(minSeverity);
        
        if (minIndex === -1) return issues;
        
        return issues.filter(issue => severityOrder.indexOf(issue.severity) >= minIndex);
    }

    private async applyOptimizations(issues: PerformanceIssue[], context: { workspaceRoot: string; outputChannel: any }): Promise<number> {
        let optimizedCount = 0;

        // Group issues by file
        const issuesByFile = issues.reduce((acc, issue) => {
            if (!acc[issue.file]) acc[issue.file] = [];
            acc[issue.file].push(issue);
            return acc;
        }, {} as { [file: string]: PerformanceIssue[] });

        // Apply optimizations
        for (const [file, fileIssues] of Object.entries(issuesByFile)) {
            const filePath = path.resolve(context.workspaceRoot, file);
            
            if (!fs.existsSync(filePath)) continue;
            
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            // Apply fixes for issues that have them
            for (const issue of fileIssues) {
                if (issue.fix && issue.severity !== 'critical') {
                    try {
                        content = content.replace(issue.fix.before, issue.fix.after);
                        modified = true;
                        optimizedCount++;
                    } catch (error) {
                        context.outputChannel.appendLine(`Failed to apply fix for ${issue.message}: ${error}`);
                    }
                }
            }

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                context.outputChannel.appendLine(`Applied optimizations to ${file}`);
            }
        }

        return optimizedCount;
    }

    private async generatePerformanceReport(
        issues: PerformanceIssue[], 
        metrics: PerformanceMetrics | undefined, 
        workspaceRoot: string
    ): Promise<string> {
        const reportPath = path.join(workspaceRoot, 'performance-report.html');
        
        const issuesByType = issues.reduce((acc, issue) => {
            if (!acc[issue.type]) acc[issue.type] = [];
            acc[issue.type].push(issue);
            return acc;
        }, {} as { [type: string]: PerformanceIssue[] });

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Optimization Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .issue { margin: 10px 0; padding: 15px; border-left: 4px solid #ddd; background: #f9f9f9; }
        .critical { border-left-color: #d32f2f; }
        .major { border-left-color: #f57c00; }
        .minor { border-left-color: #1976d2; }
        .suggestion { border-left-color: #388e3c; }
        .code { background: #f5f5f5; padding: 10px; border-radius: 3px; font-family: monospace; margin: 10px 0; }
        .fix { background: #e8f5e8; padding: 10px; border-radius: 3px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Optimization Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Total Issues: ${issues.length}</p>
    </div>
    
    ${metrics ? `
    <h2>Performance Metrics</h2>
    <div class="metrics">
        <div class="metric-card">
            <h3>Code Complexity</h3>
            <p>Cyclomatic: ${metrics.complexity.cyclomatic}</p>
            <p>Cognitive: ${metrics.complexity.cognitive}</p>
            <p>Maintainability: ${metrics.complexity.maintainability}/100</p>
        </div>
        <div class="metric-card">
            <h3>Dependencies</h3>
            <p>Total: ${metrics.dependencies.total}</p>
            <p>Outdated: ${metrics.dependencies.outdated}</p>
        </div>
        <div class="metric-card">
            <h3>Code Smells</h3>
            <p>Long Methods: ${metrics.codeSmells.longMethods}</p>
            <p>Deep Nesting: ${metrics.codeSmells.deepNesting}</p>
            <p>Too Many Params: ${metrics.codeSmells.tooManyParams}</p>
        </div>
    </div>
    ` : ''}
    
    <h2>Performance Issues</h2>
    ${Object.entries(issuesByType).map(([type, typeIssues]) => `
        <h3>${type.charAt(0).toUpperCase() + type.slice(1)} Issues (${typeIssues.length})</h3>
        ${typeIssues.map(issue => `
            <div class="issue ${issue.severity}">
                <h4>${issue.message}</h4>
                <p><strong>File:</strong> ${issue.file}:${issue.line}</p>
                <p><strong>Severity:</strong> ${issue.severity}</p>
                <p><strong>Impact:</strong> ${issue.impact}</p>
                <p><strong>Suggestion:</strong> ${issue.suggestion}</p>
                <p><strong>Estimated Gain:</strong> ${issue.estimatedGain}</p>
                ${issue.code ? `<div class="code">${issue.code}</div>` : ''}
                ${issue.fix ? `
                    <div class="fix">
                        <strong>Quick Fix:</strong> ${issue.fix.description}<br>
                        <strong>Before:</strong> <code>${issue.fix.before}</code><br>
                        <strong>After:</strong> <code>${issue.fix.after}</code>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    `).join('')}
</body>
</html>`;
        
        fs.writeFileSync(reportPath, html, 'utf8');
        return reportPath;
    }

    private formatResults(issues: PerformanceIssue[], optimizedCount: number, reportPath?: string): string {
        const summary = issues.reduce((acc, issue) => {
            acc[issue.severity] = (acc[issue.severity] || 0) + 1;
            return acc;
        }, {} as { [severity: string]: number });

        let message = `Performance analysis completed! 🚀\n`;
        message += `📊 Found ${issues.length} performance opportunities:\n`;
        
        if (summary.critical) message += `  🔴 Critical: ${summary.critical}\n`;
        if (summary.major) message += `  🟠 Major: ${summary.major}\n`;
        if (summary.minor) message += `  🔵 Minor: ${summary.minor}\n`;
        if (summary.suggestion) message += `  🟢 Suggestions: ${summary.suggestion}\n`;
        
        if (optimizedCount > 0) {
            message += `\n✅ Applied ${optimizedCount} automatic optimizations`;
        }
        
        if (reportPath) {
            message += `\n📄 Detailed report: ${path.basename(reportPath)}`;
        }

        return message;
    }
}

export default new PerformanceOptimizationTool();

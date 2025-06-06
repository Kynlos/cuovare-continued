import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface QualityMetrics {
    file: string;
    metrics: {
        linesOfCode: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        maintainabilityIndex: number;
        technicalDebt: number; // minutes
        duplicateCode: number; // percentage
        testCoverage?: number; // percentage
        documentation: number; // percentage
    };
    functions: Array<{
        name: string;
        complexity: number;
        lines: number;
        parameters: number;
        issues: string[];
    }>;
    classes: Array<{
        name: string;
        methods: number;
        complexity: number;
        cohesion: number;
        coupling: number;
    }>;
    issues: Array<{
        type: 'complexity' | 'size' | 'style' | 'maintainability';
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        line?: number;
        suggestion: string;
    }>;
}

interface ProjectMetrics {
    summary: {
        totalFiles: number;
        totalLines: number;
        averageComplexity: number;
        averageMaintainability: number;
        technicalDebtRatio: number;
        qualityGate: 'passed' | 'failed';
        grade: 'A' | 'B' | 'C' | 'D' | 'F';
    };
    fileMetrics: QualityMetrics[];
    trends: {
        complexity: 'improving' | 'stable' | 'degrading';
        maintainability: 'improving' | 'stable' | 'degrading';
        codeSmells: number;
    };
    recommendations: string[];
    benchmarks: {
        industry: { complexity: number; maintainability: number };
        project: { complexity: number; maintainability: number };
        comparison: string;
    };
}

export class CodeQualityMetricsTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'code_quality_metrics',
        description: 'Comprehensive code quality analysis with complexity metrics, maintainability scores, and technical debt calculation',
        category: 'Code Quality',
        parameters: [
            { name: 'target', description: 'File or directory to analyze for quality metrics', required: true, type: 'string' },
            { name: 'includeTests', description: 'Include test files in analysis (default: false)', required: false, type: 'boolean' },
            { name: 'generateReport', description: 'Generate detailed quality report (default: true)', required: false, type: 'boolean' },
            { name: 'includeCharts', description: 'Include visual charts in report (default: true)', required: false, type: 'boolean' },
            { name: 'threshold', description: 'Quality threshold settings: strict, normal, relaxed (default: normal)', required: false, type: 'string' },
            { name: 'compareBaseline', description: 'Compare against baseline file (path to previous metrics)', required: false, type: 'string' }
        ],
        examples: [
            'Analyze code quality: { "target": "src" }',
            'Include tests: { "target": "src", "includeTests": true }',
            'Strict thresholds: { "target": "src/components", "threshold": "strict" }',
            'Compare baseline: { "target": "src", "compareBaseline": "previous-metrics.json" }'
        ]
    };

    private thresholds = {
        strict: {
            cyclomaticComplexity: 5,
            cognitiveComplexity: 10,
            maintainabilityIndex: 80,
            functionLength: 20,
            parameterCount: 3,
            classLength: 200
        },
        normal: {
            cyclomaticComplexity: 10,
            cognitiveComplexity: 20,
            maintainabilityIndex: 60,
            functionLength: 50,
            parameterCount: 5,
            classLength: 500
        },
        relaxed: {
            cyclomaticComplexity: 20,
            cognitiveComplexity: 40,
            maintainabilityIndex: 40,
            functionLength: 100,
            parameterCount: 8,
            classLength: 1000
        }
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting code quality analysis: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const includeTests = payload.includeTests === true;
            const generateReport = payload.generateReport !== false;
            const includeCharts = payload.includeCharts !== false;
            const threshold = payload.threshold || 'normal';
            const compareBaseline = payload.compareBaseline;

            // Collect files for analysis
            const filesToAnalyze = await this.collectFiles(targetPath, includeTests);
            context.onProgress?.(`Found ${filesToAnalyze.length} files for quality analysis`);

            if (filesToAnalyze.length === 0) {
                return {
                    success: true,
                    message: 'No files found for quality analysis',
                    data: { fileMetrics: [], summary: { totalFiles: 0 } }
                };
            }

            // Analyze each file
            const fileMetrics: QualityMetrics[] = [];
            for (let i = 0; i < filesToAnalyze.length; i++) {
                const file = filesToAnalyze[i];
                context.onProgress?.(`Analyzing file ${i + 1}/${filesToAnalyze.length}: ${path.relative(context.workspaceRoot, file)}`);
                
                const metrics = await this.analyzeFile(file, context.workspaceRoot, threshold);
                fileMetrics.push(metrics);
            }

            // Generate project-level metrics
            context.onProgress?.('Calculating project-level metrics...');
            const projectMetrics = this.generateProjectMetrics(fileMetrics, threshold);

            // Compare with baseline if provided
            let comparison: any = undefined;
            if (compareBaseline) {
                comparison = await this.compareWithBaseline(projectMetrics, compareBaseline, context.workspaceRoot);
            }

            // Generate report if requested
            let reportPath: string | undefined;
            if (generateReport) {
                context.onProgress?.('Generating quality report...');
                reportPath = await this.generateQualityReport(projectMetrics, includeCharts, context.workspaceRoot, comparison);
            }

            // Save current metrics as baseline
            await this.saveMetricsBaseline(projectMetrics, context.workspaceRoot);

            const message = this.formatResults(projectMetrics, reportPath, comparison);

            return {
                success: true,
                message,
                data: {
                    projectMetrics,
                    comparison,
                    reportPath,
                    qualityGate: projectMetrics.summary.qualityGate,
                    grade: projectMetrics.summary.grade
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Code quality analysis failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async collectFiles(targetPath: string, includeTests: boolean): Promise<string[]> {
        const files: string[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            if (this.isAnalyzableFile(targetPath, includeTests)) {
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
                } else if (stat.isFile() && this.isAnalyzableFile(fullPath, includeTests)) {
                    files.push(fullPath);
                }
            }
        };

        collectRecursively(targetPath);
        return files;
    }

    private isAnalyzableFile(filePath: string, includeTests: boolean): boolean {
        const ext = path.extname(filePath);
        const isSourceFile = ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
        
        if (!isSourceFile) return false;
        
        if (!includeTests) {
            const fileName = path.basename(filePath);
            return !/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
        }
        
        return true;
    }

    private async analyzeFile(filePath: string, workspaceRoot: string, threshold: string): Promise<QualityMetrics> {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(workspaceRoot, filePath);
        const lines = content.split('\n');
        
        // Basic metrics
        const linesOfCode = this.countLinesOfCode(content);
        const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);
        const cognitiveComplexity = this.calculateCognitiveComplexity(content);
        const maintainabilityIndex = this.calculateMaintainabilityIndex(content);
        const technicalDebt = this.calculateTechnicalDebt(content, threshold);
        const duplicateCode = this.detectDuplicateCode(content);
        const documentation = this.calculateDocumentationRatio(content);

        // Function analysis
        const functions = this.analyzeFunctions(content, threshold);
        
        // Class analysis
        const classes = this.analyzeClasses(content);
        
        // Issues detection
        const issues = this.detectQualityIssues(content, threshold, relativePath);

        return {
            file: relativePath,
            metrics: {
                linesOfCode,
                cyclomaticComplexity,
                cognitiveComplexity,
                maintainabilityIndex,
                technicalDebt,
                duplicateCode,
                documentation
            },
            functions,
            classes,
            issues
        };
    }

    private countLinesOfCode(content: string): number {
        const lines = content.split('\n');
        return lines.filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
        }).length;
    }

    private calculateCyclomaticComplexity(content: string): number {
        const complexityKeywords = [
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 
            'catch', 'try', '&&', '||', '?', 'break', 'continue'
        ];
        
        let complexity = 1; // Base complexity
        
        for (const keyword of complexityKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    private calculateCognitiveComplexity(content: string): number {
        let complexity = 0;
        let nestingLevel = 0;
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Track nesting level
            const openBraces = (trimmed.match(/{/g) || []).length;
            const closeBraces = (trimmed.match(/}/g) || []).length;
            nestingLevel += openBraces - closeBraces;
            
            // Add complexity for control structures
            if (/\b(if|for|while|switch|catch)\b/.test(trimmed)) {
                complexity += 1 + Math.max(0, nestingLevel - 1);
            }
            
            // Add complexity for logical operators
            const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
            complexity += logicalOps;
            
            // Add complexity for ternary operators
            const ternaryOps = (trimmed.match(/\?/g) || []).length;
            complexity += ternaryOps;
        }
        
        return Math.max(0, complexity);
    }

    private calculateMaintainabilityIndex(content: string): number {
        const loc = this.countLinesOfCode(content);
        const complexity = this.calculateCyclomaticComplexity(content);
        const comments = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        
        // Simplified maintainability index calculation (0-100)
        let index = 100;
        index -= Math.min(loc / 20, 30); // Penalty for size
        index -= Math.min(complexity * 3, 40); // Penalty for complexity
        index += Math.min(comments * 3, 20); // Bonus for comments
        
        // Additional factors
        const duplicateLines = this.detectDuplicateLines(content);
        index -= Math.min(duplicateLines * 2, 20);
        
        return Math.max(0, Math.round(index));
    }

    private calculateTechnicalDebt(content: string, threshold: string): number {
        const thresholdConfig = this.thresholds[threshold as keyof typeof this.thresholds];
        const complexity = this.calculateCyclomaticComplexity(content);
        const loc = this.countLinesOfCode(content);
        
        let debt = 0;
        
        // Debt from high complexity (minutes to refactor)
        if (complexity > thresholdConfig.cyclomaticComplexity) {
            debt += (complexity - thresholdConfig.cyclomaticComplexity) * 5;
        }
        
        // Debt from file size
        if (loc > 500) {
            debt += (loc - 500) / 10;
        }
        
        // Debt from duplicate code
        const duplicateCode = this.detectDuplicateCode(content);
        debt += duplicateCode * 2;
        
        return Math.round(debt);
    }

    private detectDuplicateCode(content: string): number {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const lineGroups = new Map<string, number>();
        
        lines.forEach(line => {
            if (line.length > 10) { // Only consider substantial lines
                lineGroups.set(line, (lineGroups.get(line) || 0) + 1);
            }
        });
        
        const duplicateLines = Array.from(lineGroups.values()).reduce((sum, count) => {
            return sum + (count > 1 ? count - 1 : 0);
        }, 0);
        
        return Math.round((duplicateLines / lines.length) * 100);
    }

    private detectDuplicateLines(content: string): number {
        const lines = content.split('\n').map(line => line.trim());
        const duplicates = new Set<string>();
        const seen = new Set<string>();
        
        lines.forEach(line => {
            if (line.length > 10) {
                if (seen.has(line)) {
                    duplicates.add(line);
                } else {
                    seen.add(line);
                }
            }
        });
        
        return duplicates.size;
    }

    private calculateDocumentationRatio(content: string): number {
        const totalLines = content.split('\n').length;
        const commentLines = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        
        return Math.round((commentLines / totalLines) * 100);
    }

    private analyzeFunctions(content: string, threshold: string): Array<{ name: string; complexity: number; lines: number; parameters: number; issues: string[] }> {
        const functions: Array<{ name: string; complexity: number; lines: number; parameters: number; issues: string[] }> = [];
        const thresholdConfig = this.thresholds[threshold as keyof typeof this.thresholds];
        
        // Match function declarations
        const functionPattern = /function\s+(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
        let match;
        
        while ((match = functionPattern.exec(content)) !== null) {
            const [fullMatch, name, params, body] = match;
            const parameters = params.split(',').filter(p => p.trim().length > 0).length;
            const lines = fullMatch.split('\n').length;
            const complexity = this.calculateCyclomaticComplexity(fullMatch);
            
            const issues: string[] = [];
            
            if (complexity > thresholdConfig.cyclomaticComplexity) {
                issues.push(`High complexity (${complexity})`);
            }
            
            if (lines > thresholdConfig.functionLength) {
                issues.push(`Too long (${lines} lines)`);
            }
            
            if (parameters > thresholdConfig.parameterCount) {
                issues.push(`Too many parameters (${parameters})`);
            }
            
            functions.push({ name, complexity, lines, parameters, issues });
        }
        
        // Match arrow functions
        const arrowFunctionPattern = /(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g;
        while ((match = arrowFunctionPattern.exec(content)) !== null) {
            const name = match[1];
            // Simplified analysis for arrow functions
            functions.push({
                name,
                complexity: 1,
                lines: 1,
                parameters: 0,
                issues: []
            });
        }
        
        return functions;
    }

    private analyzeClasses(content: string): Array<{ name: string; methods: number; complexity: number; cohesion: number; coupling: number }> {
        const classes: Array<{ name: string; methods: number; complexity: number; cohesion: number; coupling: number }> = [];
        
        const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
        let match;
        
        while ((match = classPattern.exec(content)) !== null) {
            const [fullMatch, name, body] = match;
            
            // Count methods
            const methodMatches = body.match(/\b\w+\s*\(/g) || [];
            const methods = methodMatches.length;
            
            // Calculate complexity
            const complexity = this.calculateCyclomaticComplexity(fullMatch);
            
            // Simplified cohesion and coupling metrics
            const cohesion = Math.max(0, 100 - methods * 5); // Simplified: fewer methods = higher cohesion
            const coupling = (fullMatch.match(/import|require/g) || []).length * 10;
            
            classes.push({
                name,
                methods,
                complexity,
                cohesion: Math.min(100, cohesion),
                coupling: Math.min(100, coupling)
            });
        }
        
        return classes;
    }

    private detectQualityIssues(content: string, threshold: string, filePath: string): Array<{ type: 'style' | 'size' | 'maintainability' | 'complexity'; severity: 'low' | 'medium' | 'high' | 'critical'; message: string; line?: number; suggestion: string }> {
        const issues: Array<{ type: 'style' | 'size' | 'maintainability' | 'complexity'; severity: 'low' | 'medium' | 'high' | 'critical'; message: string; line?: number; suggestion: string }> = [];
        const thresholdConfig = this.thresholds[threshold as keyof typeof this.thresholds];
        const lines = content.split('\n');
        
        // Check file length
        if (lines.length > thresholdConfig.classLength) {
            issues.push({
                type: 'size',
                severity: 'high',
                message: `File too long (${lines.length} lines)`,
                suggestion: 'Consider splitting into smaller modules'
            });
        }
        
        // Check for long lines
        lines.forEach((line, index) => {
            if (line.length > 120) {
                issues.push({
                    type: 'style',
                    severity: 'low',
                    message: 'Line too long',
                    line: index + 1,
                    suggestion: 'Break long lines for better readability'
                });
            }
        });
        
        // Check for TODOs and FIXMEs
        lines.forEach((line, index) => {
            if (/TODO|FIXME|HACK/i.test(line)) {
                issues.push({
                    type: 'maintainability',
                    severity: 'medium',
                    message: 'Technical debt marker found',
                    line: index + 1,
                    suggestion: 'Address technical debt items'
                });
            }
        });
        
        // Check for high nesting
        let nestingLevel = 0;
        let maxNesting = 0;
        lines.forEach((line, index) => {
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            nestingLevel += openBraces - closeBraces;
            maxNesting = Math.max(maxNesting, nestingLevel);
            
            if (nestingLevel > 4) {
                issues.push({
                    type: 'complexity',
                    severity: 'medium',
                    message: 'Deep nesting detected',
                    line: index + 1,
                    suggestion: 'Extract nested logic into separate functions'
                });
            }
        });
        
        return issues;
    }

    private generateProjectMetrics(fileMetrics: QualityMetrics[], threshold: string): ProjectMetrics {
        const totalLines = fileMetrics.reduce((sum, file) => sum + file.metrics.linesOfCode, 0);
        const summary = {
            totalFiles: fileMetrics.length,
            totalLines,
            averageComplexity: Math.round(fileMetrics.reduce((sum, file) => sum + file.metrics.cyclomaticComplexity, 0) / fileMetrics.length),
            averageMaintainability: Math.round(fileMetrics.reduce((sum, file) => sum + file.metrics.maintainabilityIndex, 0) / fileMetrics.length),
            technicalDebtRatio: Math.round(fileMetrics.reduce((sum, file) => sum + file.metrics.technicalDebt, 0) / totalLines * 100),
            qualityGate: 'passed' as 'passed' | 'failed',
            grade: 'A' as 'A' | 'B' | 'C' | 'D' | 'F'
        };

        // Determine quality gate and grade
        const thresholdConfig = this.thresholds[threshold as keyof typeof this.thresholds];
        const criticalIssues = fileMetrics.reduce((sum, file) => 
            sum + file.issues.filter(issue => issue.severity === 'critical').length, 0);
        
        if (criticalIssues > 0 || summary.averageComplexity > thresholdConfig.cyclomaticComplexity * 2) {
            summary.qualityGate = 'failed';
        }
        
        // Grade calculation
        if (summary.averageMaintainability >= 80 && summary.averageComplexity <= 10) {
            summary.grade = 'A';
        } else if (summary.averageMaintainability >= 70 && summary.averageComplexity <= 15) {
            summary.grade = 'B';
        } else if (summary.averageMaintainability >= 60 && summary.averageComplexity <= 20) {
            summary.grade = 'C';
        } else if (summary.averageMaintainability >= 50) {
            summary.grade = 'D';
        } else {
            summary.grade = 'F';
        }

        // Generate recommendations
        const recommendations = this.generateRecommendations(fileMetrics, summary);
        
        // Calculate trends (simplified - would need historical data)
        const trends = {
            complexity: 'stable' as 'improving' | 'stable' | 'degrading',
            maintainability: 'stable' as 'improving' | 'stable' | 'degrading',
            codeSmells: fileMetrics.reduce((sum, file) => sum + file.issues.length, 0)
        };

        // Industry benchmarks
        const benchmarks = {
            industry: { complexity: 12, maintainability: 65 },
            project: { complexity: summary.averageComplexity, maintainability: summary.averageMaintainability },
            comparison: summary.averageComplexity <= 12 && summary.averageMaintainability >= 65 
                ? 'Above industry average' 
                : 'Below industry average'
        };

        return {
            summary,
            fileMetrics,
            trends,
            recommendations,
            benchmarks
        };
    }

    private generateRecommendations(fileMetrics: QualityMetrics[], summary: any): string[] {
        const recommendations: string[] = [];
        
        if (summary.averageComplexity > 15) {
            recommendations.push('🔧 Reduce code complexity by breaking down large functions');
        }
        
        if (summary.averageMaintainability < 60) {
            recommendations.push('📝 Improve code documentation and add comments');
        }
        
        const highDebtFiles = fileMetrics.filter(file => file.metrics.technicalDebt > 60);
        if (highDebtFiles.length > 0) {
            recommendations.push(`⚠️ Address technical debt in ${highDebtFiles.length} files`);
        }
        
        const complexFunctions = fileMetrics.flatMap(file => 
            file.functions.filter(func => func.complexity > 10)
        );
        if (complexFunctions.length > 0) {
            recommendations.push(`🎯 Refactor ${complexFunctions.length} complex functions`);
        }
        
        const undocumentedFiles = fileMetrics.filter(file => file.metrics.documentation < 10);
        if (undocumentedFiles.length > 0) {
            recommendations.push(`📚 Add documentation to ${undocumentedFiles.length} files`);
        }
        
        return recommendations;
    }

    private async compareWithBaseline(projectMetrics: ProjectMetrics, baselinePath: string, workspaceRoot: string): Promise<any> {
        try {
            const fullBaselinePath = path.resolve(workspaceRoot, baselinePath);
            if (!fs.existsSync(fullBaselinePath)) {
                return { error: 'Baseline file not found' };
            }
            
            const baseline = JSON.parse(fs.readFileSync(fullBaselinePath, 'utf8'));
            
            return {
                complexity: {
                    current: projectMetrics.summary.averageComplexity,
                    baseline: baseline.summary.averageComplexity,
                    change: projectMetrics.summary.averageComplexity - baseline.summary.averageComplexity
                },
                maintainability: {
                    current: projectMetrics.summary.averageMaintainability,
                    baseline: baseline.summary.averageMaintainability,
                    change: projectMetrics.summary.averageMaintainability - baseline.summary.averageMaintainability
                },
                technicalDebt: {
                    current: projectMetrics.summary.technicalDebtRatio,
                    baseline: baseline.summary.technicalDebtRatio,
                    change: projectMetrics.summary.technicalDebtRatio - baseline.summary.technicalDebtRatio
                }
            };
        } catch (error) {
            return { error: 'Failed to parse baseline file' };
        }
    }

    private async saveMetricsBaseline(projectMetrics: ProjectMetrics, workspaceRoot: string): Promise<void> {
        const baselinePath = path.join(workspaceRoot, 'quality-metrics-baseline.json');
        const baseline = {
            timestamp: new Date().toISOString(),
            summary: projectMetrics.summary,
            version: '1.0'
        };
        
        fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf8');
    }

    private async generateQualityReport(
        projectMetrics: ProjectMetrics, 
        includeCharts: boolean, 
        workspaceRoot: string,
        comparison?: any
    ): Promise<string> {
        const reportPath = path.join(workspaceRoot, 'quality-metrics-report.html');
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Code Quality Metrics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .grade { font-size: 3em; color: ${this.getGradeColor(projectMetrics.summary.grade)}; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .file-metrics { margin: 20px 0; }
        .file { margin: 10px 0; padding: 15px; border-left: 4px solid #ddd; background: #f9f9f9; }
        .recommendations { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .comparison { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .chart { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    </style>
    ${includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
</head>
<body>
    <div class="header">
        <h1>Code Quality Metrics Report</h1>
        <div class="grade">Grade: ${projectMetrics.summary.grade}</div>
        <p>Quality Gate: <strong style="color: ${projectMetrics.summary.qualityGate === 'passed' ? 'green' : 'red'}">${projectMetrics.summary.qualityGate.toUpperCase()}</strong></p>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <h2>Project Summary</h2>
    <div class="metrics">
        <div class="metric-card">
            <h3>Files Analyzed</h3>
            <div style="font-size: 2em;">${projectMetrics.summary.totalFiles}</div>
        </div>
        <div class="metric-card">
            <h3>Lines of Code</h3>
            <div style="font-size: 2em;">${projectMetrics.summary.totalLines.toLocaleString()}</div>
        </div>
        <div class="metric-card">
            <h3>Avg Complexity</h3>
            <div style="font-size: 2em; color: ${projectMetrics.summary.averageComplexity > 15 ? '#d32f2f' : '#388e3c'}">${projectMetrics.summary.averageComplexity}</div>
        </div>
        <div class="metric-card">
            <h3>Maintainability</h3>
            <div style="font-size: 2em; color: ${projectMetrics.summary.averageMaintainability < 60 ? '#d32f2f' : '#388e3c'}">${projectMetrics.summary.averageMaintainability}%</div>
        </div>
    </div>
    
    ${comparison && !comparison.error ? `
    <div class="comparison">
        <h2>📊 Comparison with Baseline</h2>
        <p><strong>Complexity:</strong> ${comparison.complexity.current} (${comparison.complexity.change > 0 ? '+' : ''}${comparison.complexity.change})</p>
        <p><strong>Maintainability:</strong> ${comparison.maintainability.current}% (${comparison.maintainability.change > 0 ? '+' : ''}${comparison.maintainability.change}%)</p>
        <p><strong>Technical Debt:</strong> ${comparison.technicalDebt.current}% (${comparison.technicalDebt.change > 0 ? '+' : ''}${comparison.technicalDebt.change}%)</p>
    </div>
    ` : ''}
    
    <div class="recommendations">
        <h2>🎯 Recommendations</h2>
        ${projectMetrics.recommendations.map(rec => `<p>• ${rec}</p>`).join('')}
    </div>
    
    <h2>📈 Benchmarks</h2>
    <p><strong>Industry Average:</strong> Complexity ${projectMetrics.benchmarks.industry.complexity}, Maintainability ${projectMetrics.benchmarks.industry.maintainability}%</p>
    <p><strong>Your Project:</strong> Complexity ${projectMetrics.benchmarks.project.complexity}, Maintainability ${projectMetrics.benchmarks.project.maintainability}%</p>
    <p><strong>Assessment:</strong> ${projectMetrics.benchmarks.comparison}</p>
    
    <h2>📁 File Details</h2>
    <div class="file-metrics">
        ${projectMetrics.fileMetrics.slice(0, 20).map(file => `
            <div class="file">
                <h3>${file.file}</h3>
                <p><strong>Lines:</strong> ${file.metrics.linesOfCode} | <strong>Complexity:</strong> ${file.metrics.cyclomaticComplexity} | <strong>Maintainability:</strong> ${file.metrics.maintainabilityIndex}%</p>
                ${file.issues.length > 0 ? `<p><strong>Issues:</strong> ${file.issues.length}</p>` : ''}
                ${file.functions.length > 0 ? `<p><strong>Functions:</strong> ${file.functions.length}</p>` : ''}
            </div>
        `).join('')}
        ${projectMetrics.fileMetrics.length > 20 ? `<p>... and ${projectMetrics.fileMetrics.length - 20} more files</p>` : ''}
    </div>
</body>
</html>`;
        
        fs.writeFileSync(reportPath, html, 'utf8');
        return reportPath;
    }

    private getGradeColor(grade: string): string {
        const colors = {
            'A': '#4caf50',
            'B': '#8bc34a',
            'C': '#ffc107',
            'D': '#ff9800',
            'F': '#f44336'
        };
        return colors[grade as keyof typeof colors] || '#757575';
    }

    private formatResults(projectMetrics: ProjectMetrics, reportPath?: string, comparison?: any): string {
        let message = `Code quality analysis completed! 📊\n`;
        message += `🎯 Grade: ${projectMetrics.summary.grade} | Quality Gate: ${projectMetrics.summary.qualityGate.toUpperCase()}\n`;
        message += `📈 Metrics: Complexity ${projectMetrics.summary.averageComplexity}, Maintainability ${projectMetrics.summary.averageMaintainability}%\n`;
        message += `📁 Analyzed ${projectMetrics.summary.totalFiles} files (${projectMetrics.summary.totalLines.toLocaleString()} lines)\n`;
        
        if (comparison && !comparison.error) {
            const complexityTrend = comparison.complexity.change > 0 ? '📈' : comparison.complexity.change < 0 ? '📉' : '➡️';
            const maintTrend = comparison.maintainability.change > 0 ? '📈' : comparison.maintainability.change < 0 ? '📉' : '➡️';
            message += `\n${complexityTrend} Complexity: ${comparison.complexity.change > 0 ? '+' : ''}${comparison.complexity.change}\n`;
            message += `${maintTrend} Maintainability: ${comparison.maintainability.change > 0 ? '+' : ''}${comparison.maintainability.change}%`;
        }
        
        if (reportPath) {
            message += `\n📄 Detailed report: ${path.basename(reportPath)}`;
        }

        return message;
    }
}

export default new CodeQualityMetricsTool();

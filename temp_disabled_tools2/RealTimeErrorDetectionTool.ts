import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface ErrorDetection {
    file: string;
    line: number;
    column?: number;
    severity: 'error' | 'warning' | 'info';
    type: 'syntax' | 'type' | 'runtime' | 'logic' | 'performance';
    message: string;
    suggestion?: string;
    quickFix?: {
        description: string;
        newText: string;
        range: { start: number; end: number };
    };
}

interface WatcherConfig {
    patterns: string[];
    excludePatterns: string[];
    debounceMs: number;
    realTimeAnalysis: boolean;
}

export class RealTimeErrorDetectionTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'real_time_error_detection',
        description: 'Live code analysis with instant error detection and fix suggestions',
        category: 'Code Quality',
        parameters: [
            { name: 'action', description: 'Action: start, stop, analyze, status', required: true, type: 'string' },
            { name: 'target', description: 'File or directory to monitor/analyze', required: false, type: 'string' },
            { name: 'watchPatterns', description: 'File patterns to watch (default: common source files)', required: false, type: 'array' },
            { name: 'excludePatterns', description: 'Patterns to exclude from watching', required: false, type: 'array' },
            { name: 'severity', description: 'Minimum severity to report: error, warning, info', required: false, type: 'string' },
            { name: 'autoFix', description: 'Automatically apply safe fixes (default: false)', required: false, type: 'boolean' },
            { name: 'debounceMs', description: 'Milliseconds to wait before analyzing changes (default: 500)', required: false, type: 'number' }
        ],
        examples: [
            'Start monitoring: { "action": "start", "target": "src" }',
            'Analyze current file: { "action": "analyze", "target": "src/app.ts" }',
            'Check status: { "action": "status" }',
            'Stop monitoring: { "action": "stop" }'
        ]
    };

    private isWatching = false;
    private watchers: fs.FSWatcher[] = [];
    private errorCache = new Map<string, ErrorDetection[]>();
    private watcherConfig: WatcherConfig = {
        patterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        debounceMs: 500,
        realTimeAnalysis: true
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            const action = payload.action?.toLowerCase();
            
            switch (action) {
                case 'start':
                    return this.startWatching(payload, context);
                case 'stop':
                    return this.stopWatching(context);
                case 'analyze':
                    return this.analyzeTarget(payload, context);
                case 'status':
                    return this.getStatus(context);
                default:
                    throw new Error(`Unknown action: ${action}. Use: start, stop, analyze, status`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Real-time error detection failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async startWatching(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        if (this.isWatching) {
            return { success: false, message: 'Real-time monitoring is already active' };
        }

        const target = payload.target || 'src';
        const targetPath = path.resolve(context.workspaceRoot, target);
        
        if (!targetPath.startsWith(context.workspaceRoot)) {
            throw new Error('Target path outside workspace not allowed');
        }
        
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Target not found: ${target}`);
        }

        // Update configuration
        if (payload.watchPatterns) this.watcherConfig.patterns = payload.watchPatterns;
        if (payload.excludePatterns) this.watcherConfig.excludePatterns = payload.excludePatterns;
        if (payload.debounceMs) this.watcherConfig.debounceMs = payload.debounceMs;

        context.onProgress?.(`Starting real-time error detection for: ${target}`);

        // Setup file watchers
        await this.setupWatchers(targetPath, context, payload);
        
        // Initial analysis
        const initialErrors = await this.performInitialAnalysis(targetPath, context, payload.severity);
        
        this.isWatching = true;
        
        return {
            success: true,
            message: `Real-time error detection started monitoring ${target}\n🔍 Found ${initialErrors.length} issues in initial scan`,
            data: {
                target,
                watching: true,
                initialErrors: initialErrors.length,
                watchPatterns: this.watcherConfig.patterns,
                excludePatterns: this.watcherConfig.excludePatterns
            }
        };
    }

    private async stopWatching(context: {
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        if (!this.isWatching) {
            return { success: false, message: 'Real-time monitoring is not active' };
        }

        context.onProgress?.('Stopping real-time error detection...');

        // Close all watchers
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];
        this.isWatching = false;
        
        const totalErrorsFound = Array.from(this.errorCache.values()).reduce((sum, errors) => sum + errors.length, 0);
        this.errorCache.clear();

        return {
            success: true,
            message: `Real-time error detection stopped\n📊 Total errors detected during session: ${totalErrorsFound}`,
            data: { watching: false, totalErrorsDetected: totalErrorsFound }
        };
    }

    private async analyzeTarget(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        const target = payload.target;
        if (!target) {
            throw new Error('Target parameter is required for analyze action');
        }

        const targetPath = path.resolve(context.workspaceRoot, target);
        
        if (!targetPath.startsWith(context.workspaceRoot)) {
            throw new Error('Target path outside workspace not allowed');
        }
        
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Target not found: ${target}`);
        }

        context.onProgress?.(`Analyzing: ${target}`);

        const errors = await this.analyzeFile(targetPath, payload.severity || 'info', payload.autoFix === true);
        
        // Cache results
        this.errorCache.set(targetPath, errors);

        let message = `Analysis complete for ${path.relative(context.workspaceRoot, targetPath)}\n`;
        message += `🔍 Found ${errors.length} issues\n`;
        
        if (errors.length > 0) {
            const errorsByType = this.groupErrorsByType(errors);
            message += Object.entries(errorsByType)
                .map(([type, count]) => `  • ${type}: ${count}`)
                .join('\n');
        }

        return {
            success: true,
            message,
            data: {
                file: path.relative(context.workspaceRoot, targetPath),
                errors,
                summary: this.generateSummary(errors)
            }
        };
    }

    private async getStatus(context: {
        outputChannel: any;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        const totalFiles = this.errorCache.size;
        const totalErrors = Array.from(this.errorCache.values()).reduce((sum, errors) => sum + errors.length, 0);
        
        let message = `Real-time Error Detection Status\n`;
        message += `📡 Monitoring: ${this.isWatching ? 'Active' : 'Inactive'}\n`;
        message += `📁 Files monitored: ${totalFiles}\n`;
        message += `⚠️  Total errors: ${totalErrors}\n`;
        
        if (this.isWatching) {
            message += `🎯 Watch patterns: ${this.watcherConfig.patterns.join(', ')}\n`;
            message += `🚫 Exclude patterns: ${this.watcherConfig.excludePatterns.join(', ')}`;
        }

        return {
            success: true,
            message,
            data: {
                watching: this.isWatching,
                filesMonitored: totalFiles,
                totalErrors,
                config: this.watcherConfig,
                errorsByFile: Object.fromEntries(
                    Array.from(this.errorCache.entries()).map(([file, errors]) => [
                        file,
                        { count: errors.length, severity: this.getHighestSeverity(errors) }
                    ])
                )
            }
        };
    }

    private async setupWatchers(targetPath: string, context: {
        workspaceRoot: string;
        outputChannel: any;
    }, payload: any): Promise<void> {
        const debounceMap = new Map<string, NodeJS.Timeout>();

        const handleFileChange = (filePath: string) => {
            // Clear existing timeout
            const existingTimeout = debounceMap.get(filePath);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }

            // Set new timeout
            const timeout = setTimeout(async () => {
                try {
                    const errors = await this.analyzeFile(filePath, payload.severity || 'info', payload.autoFix === true);
                    this.errorCache.set(filePath, errors);
                    
                    const relativePath = path.relative(context.workspaceRoot, filePath);
                    if (errors.length > 0) {
                        const highestSeverity = this.getHighestSeverity(errors);
                        context.outputChannel.appendLine(`🔍 ${relativePath}: ${errors.length} ${highestSeverity} issue(s) detected`);
                    }
                } catch (error) {
                    context.outputChannel.appendLine(`Error analyzing ${filePath}: ${error}`);
                }
                debounceMap.delete(filePath);
            }, this.watcherConfig.debounceMs);

            debounceMap.set(filePath, timeout);
        };

        // Setup recursive watcher
        if (fs.statSync(targetPath).isDirectory()) {
            const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
                if (filename && eventType === 'change') {
                    const fullPath = path.join(targetPath, filename);
                    if (this.shouldWatchFile(fullPath)) {
                        handleFileChange(fullPath);
                    }
                }
            });
            this.watchers.push(watcher);
        } else {
            const watcher = fs.watch(targetPath, (eventType) => {
                if (eventType === 'change') {
                    handleFileChange(targetPath);
                }
            });
            this.watchers.push(watcher);
        }
    }

    private shouldWatchFile(filePath: string): boolean {
        const relativePath = path.relative(process.cwd(), filePath);
        
        // Check exclude patterns
        for (const pattern of this.watcherConfig.excludePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                return false;
            }
        }
        
        // Check include patterns
        for (const pattern of this.watcherConfig.patterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                return true;
            }
        }
        
        return false;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Simple pattern matching (could be enhanced with proper glob matching)
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\./g, '\\.');
        
        return new RegExp(`^${regexPattern}$`).test(filePath);
    }

    private async performInitialAnalysis(targetPath: string, context: {
        workspaceRoot: string;
        outputChannel: any;
    }, severity: string = 'info'): Promise<ErrorDetection[]> {
        const allErrors: ErrorDetection[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            const errors = await this.analyzeFile(targetPath, severity);
            this.errorCache.set(targetPath, errors);
            return errors;
        }

        // Recursively analyze directory
        const analyzeDirectory = async (dir: string) => {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    if (!this.watcherConfig.excludePatterns.some(pattern => 
                        this.matchesPattern(path.relative(context.workspaceRoot, fullPath), pattern)
                    )) {
                        await analyzeDirectory(fullPath);
                    }
                } else if (stat.isFile() && this.shouldWatchFile(fullPath)) {
                    const errors = await this.analyzeFile(fullPath, severity);
                    this.errorCache.set(fullPath, errors);
                    allErrors.push(...errors);
                }
            }
        };

        await analyzeDirectory(targetPath);
        return allErrors;
    }

    private async analyzeFile(filePath: string, severity: string = 'info', autoFix: boolean = false): Promise<ErrorDetection[]> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const errors: ErrorDetection[] = [];
            
            // Syntax errors
            errors.push(...this.detectSyntaxErrors(content, filePath));
            
            // Runtime errors
            errors.push(...this.detectRuntimeErrors(content, filePath));
            
            // Logic errors
            errors.push(...this.detectLogicErrors(content, filePath));
            
            // Performance issues
            errors.push(...this.detectPerformanceIssues(content, filePath));
            
            // Filter by severity
            const filteredErrors = this.filterBySeverity(errors, severity);
            
            // Apply auto-fixes if enabled
            if (autoFix && filteredErrors.length > 0) {
                await this.applyAutoFixes(filePath, content, filteredErrors);
            }
            
            return filteredErrors;
            
        } catch (error) {
            return [{
                file: path.basename(filePath),
                line: 1,
                severity: 'error',
                type: 'syntax',
                message: `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`
            }];
        }
    }

    private detectSyntaxErrors(content: string, filePath: string): ErrorDetection[] {
        const errors: ErrorDetection[] = [];
        const lines = content.split('\n');
        
        // Check for common syntax issues
        const syntaxPatterns = [
            { pattern: /\s+$/, message: 'Trailing whitespace', severity: 'info' as const },
            { pattern: /\t/, message: 'Tab character detected (use spaces)', severity: 'warning' as const },
            { pattern: /console\.log\s*\(\s*\)/, message: 'Empty console.log statement', severity: 'warning' as const },
            { pattern: /debugger\s*;/, message: 'Debugger statement should be removed', severity: 'warning' as const },
            { pattern: /\/\*[\s\S]*?\*\//, message: 'Block comment found', severity: 'info' as const }
        ];

        lines.forEach((line, index) => {
            syntaxPatterns.forEach(({ pattern, message, severity }) => {
                if (pattern.test(line)) {
                    errors.push({
                        file: path.basename(filePath),
                        line: index + 1,
                        severity,
                        type: 'syntax',
                        message,
                        quickFix: severity !== 'info' ? {
                            description: 'Remove or fix this issue',
                            newText: line.replace(pattern, ''),
                            range: { start: 0, end: line.length }
                        } : undefined
                    });
                }
            });
        });

        return errors;
    }

    private detectRuntimeErrors(content: string, filePath: string): ErrorDetection[] {
        const errors: ErrorDetection[] = [];
        
        const runtimePatterns = [
            { pattern: /\.length\s*-\s*1/, message: 'Potential off-by-one error', severity: 'warning' as const },
            { pattern: /parseInt\([^,)]+\)/, message: 'parseInt without radix parameter', severity: 'warning' as const },
            { pattern: /==\s*null/, message: 'Use === null for strict comparison', severity: 'warning' as const },
            { pattern: /var\s+/, message: 'Use let or const instead of var', severity: 'warning' as const }
        ];

        let match;
        runtimePatterns.forEach(({ pattern, message, severity }) => {
            const regex = new RegExp(pattern.source, 'g');
            while ((match = regex.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                errors.push({
                    file: path.basename(filePath),
                    line: lineNumber,
                    severity,
                    type: 'runtime',
                    message
                });
            }
        });

        return errors;
    }

    private detectLogicErrors(content: string, filePath: string): ErrorDetection[] {
        const errors: ErrorDetection[] = [];
        
        // Check for common logic issues
        if (/if\s*\([^)]+\)\s*;\s*/.test(content)) {
            const lineNumber = content.substring(0, content.search(/if\s*\([^)]+\)\s*;\s*/)).split('\n').length;
            errors.push({
                file: path.basename(filePath),
                line: lineNumber,
                severity: 'warning',
                type: 'logic',
                message: 'Empty if statement - possible logic error'
            });
        }

        return errors;
    }

    private detectPerformanceIssues(content: string, filePath: string): ErrorDetection[] {
        const errors: ErrorDetection[] = [];
        
        const performancePatterns = [
            { pattern: /for\s*\([^}]+\.length[^}]+\)/, message: 'Cache array length in loop for better performance', severity: 'info' as const },
            { pattern: /document\.getElementById\s*\([^)]+\)/, message: 'Consider caching DOM queries', severity: 'info' as const }
        ];

        let match;
        performancePatterns.forEach(({ pattern, message, severity }) => {
            const regex = new RegExp(pattern.source, 'g');
            while ((match = regex.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                errors.push({
                    file: path.basename(filePath),
                    line: lineNumber,
                    severity,
                    type: 'performance',
                    message
                });
            }
        });

        return errors;
    }

    private filterBySeverity(errors: ErrorDetection[], minSeverity: string): ErrorDetection[] {
        const severityOrder = ['info', 'warning', 'error'];
        const minIndex = severityOrder.indexOf(minSeverity);
        
        if (minIndex === -1) return errors;
        
        return errors.filter(error => severityOrder.indexOf(error.severity) >= minIndex);
    }

    private async applyAutoFixes(filePath: string, content: string, errors: ErrorDetection[]): Promise<void> {
        let modifiedContent = content;
        
        // Apply quick fixes where available
        const fixableErrors = errors.filter(error => error.quickFix);
        
        for (const error of fixableErrors) {
            if (error.quickFix) {
                const lines = modifiedContent.split('\n');
                if (lines[error.line - 1]) {
                    lines[error.line - 1] = error.quickFix.newText;
                    modifiedContent = lines.join('\n');
                }
            }
        }
        
        if (modifiedContent !== content) {
            fs.writeFileSync(filePath, modifiedContent, 'utf8');
        }
    }

    private groupErrorsByType(errors: ErrorDetection[]): { [key: string]: number } {
        return errors.reduce((acc, error) => {
            acc[error.type] = (acc[error.type] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
    }

    private generateSummary(errors: ErrorDetection[]) {
        return {
            total: errors.length,
            byType: this.groupErrorsByType(errors),
            bySeverity: {
                error: errors.filter(e => e.severity === 'error').length,
                warning: errors.filter(e => e.severity === 'warning').length,
                info: errors.filter(e => e.severity === 'info').length
            }
        };
    }

    private getHighestSeverity(errors: ErrorDetection[]): string {
        if (errors.some(e => e.severity === 'error')) return 'error';
        if (errors.some(e => e.severity === 'warning')) return 'warning';
        return 'info';
    }
}

export default new RealTimeErrorDetectionTool();

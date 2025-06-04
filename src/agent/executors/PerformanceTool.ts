import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class PerformanceTool implements ToolExecutor {
    readonly name = 'performance';
    readonly description = 'Performance analysis, optimization, and monitoring tools';

    readonly methods = {
        'analyzeBundle': {
            description: 'Analyze bundle size and suggest optimizations',
            parameters: {
                buildDir: { type: 'string', description: 'Path to build/dist directory' },
                framework: { type: 'string', description: 'Framework (webpack, vite, rollup, parcel)', optional: true }
            }
        },
        'profileCode': {
            description: 'Profile code performance and identify bottlenecks',
            parameters: {
                filePath: { type: 'string', description: 'Path to file to profile' },
                language: { type: 'string', description: 'Programming language', optional: true }
            }
        },
        'optimizeImages': {
            description: 'Analyze and suggest image optimizations',
            parameters: {
                directory: { type: 'string', description: 'Directory containing images' },
                format: { type: 'string', description: 'Target format (webp, avif, auto)', optional: true }
            }
        },
        'analyzeMemoryUsage': {
            description: 'Analyze memory usage patterns and detect leaks',
            parameters: {
                filePath: { type: 'string', description: 'Path to JavaScript/TypeScript file' }
            }
        },
        'optimizeDatabase': {
            description: 'Analyze database queries and suggest optimizations',
            parameters: {
                queryFile: { type: 'string', description: 'File containing SQL queries or ORM code' }
            }
        },
        'generateLighthouse': {
            description: 'Generate Lighthouse performance report configuration',
            parameters: {
                url: { type: 'string', description: 'URL to analyze' },
                outputPath: { type: 'string', description: 'Output path for report config', optional: true }
            }
        },
        'cacheAnalysis': {
            description: 'Analyze caching strategies and effectiveness',
            parameters: {
                filePath: { type: 'string', description: 'Path to file with caching logic' }
            }
        },
        'webVitals': {
            description: 'Generate Web Vitals monitoring setup',
            parameters: {
                framework: { type: 'string', description: 'Framework (react, vue, angular, vanilla)', optional: true }
            }
        },
        'lazyLoading': {
            description: 'Analyze and suggest lazy loading opportunities',
            parameters: {
                filePath: { type: 'string', description: 'Path to component or HTML file' }
            }
        },
        'treeShaking': {
            description: 'Analyze tree shaking effectiveness and unused code',
            parameters: {
                projectDir: { type: 'string', description: 'Project root directory', optional: true }
            }
        },
        'renderOptimization': {
            description: 'Analyze rendering performance and suggest optimizations',
            parameters: {
                filePath: { type: 'string', description: 'Path to component or template file' },
                framework: { type: 'string', description: 'Frontend framework', optional: true }
            }
        },
        'networkAnalysis': {
            description: 'Analyze network requests and suggest optimizations',
            parameters: {
                filePath: { type: 'string', description: 'File containing API calls or network requests' }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'analyzeBundle':
                    return await this.analyzeBundle(args.buildDir, args.framework);
                case 'profileCode':
                    return await this.profileCode(args.filePath, args.language);
                case 'optimizeImages':
                    return await this.optimizeImages(args.directory, args.format);
                case 'analyzeMemoryUsage':
                    return await this.analyzeMemoryUsage(args.filePath);
                case 'optimizeDatabase':
                    return await this.optimizeDatabase(args.queryFile);
                case 'generateLighthouse':
                    return await this.generateLighthouse(args.url, args.outputPath);
                case 'cacheAnalysis':
                    return await this.cacheAnalysis(args.filePath);
                case 'webVitals':
                    return await this.webVitals(args.framework);
                case 'lazyLoading':
                    return await this.lazyLoading(args.filePath);
                case 'treeShaking':
                    return await this.treeShaking(args.projectDir);
                case 'renderOptimization':
                    return await this.renderOptimization(args.filePath, args.framework);
                case 'networkAnalysis':
                    return await this.networkAnalysis(args.filePath);
                default:
                    return {
                        success: false,
                        error: `Unknown method: ${method}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: `Error executing ${method}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeBundle(buildDir: string, framework: string = 'webpack'): Promise<ToolResult> {
        try {
            const analysis = await this.performBundleAnalysis(buildDir, framework);
            
            const reportPath = path.join(buildDir, 'bundle-analysis.json');
            await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));

            return {
                success: true,
                result: `Bundle analysis completed. Report saved to ${reportPath}\n\n${this.formatBundleReport(analysis)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze bundle: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async profileCode(filePath: string, language?: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const detectedLanguage = language || this.detectLanguage(filePath);
            const profile = this.performCodeProfiling(content, detectedLanguage);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    language: detectedLanguage,
                    performance: profile,
                    recommendations: this.generatePerformanceRecommendations(profile)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to profile code: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async optimizeImages(directory: string, format: string = 'auto'): Promise<ToolResult> {
        try {
            const images = await this.findImages(directory);
            const optimizations = await this.analyzeImageOptimizations(images, format);

            const optimizationScript = this.generateImageOptimizationScript(optimizations);
            const scriptPath = path.join(directory, 'optimize-images.sh');
            await fs.writeFile(scriptPath, optimizationScript);

            return {
                success: true,
                result: `Image optimization analysis completed.\nScript generated at ${scriptPath}\n\n${JSON.stringify(optimizations.summary, null, 2)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to optimize images: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeMemoryUsage(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const memoryIssues = this.detectMemoryIssues(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    memoryIssues,
                    recommendations: this.generateMemoryOptimizationRecommendations(memoryIssues)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze memory usage: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async optimizeDatabase(queryFile: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(queryFile, 'utf8');
            const optimizations = this.analyzeDatabasePerformance(content);

            const optimizedQueriesPath = path.join(path.dirname(queryFile), 'optimized-queries.sql');
            await fs.writeFile(optimizedQueriesPath, optimizations.optimizedQueries);

            return {
                success: true,
                result: JSON.stringify({
                    originalFile: queryFile,
                    optimizedFile: optimizedQueriesPath,
                    analysis: optimizations.analysis,
                    recommendations: optimizations.recommendations
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to optimize database: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateLighthouse(url: string, outputPath?: string): Promise<ToolResult> {
        try {
            const config = this.createLighthouseConfig(url);
            const configPath = outputPath || path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'lighthouse.config.js'
            );

            await fs.writeFile(configPath, config.content);

            return {
                success: true,
                result: `Lighthouse configuration generated at ${configPath}\n\nUsage:\n${config.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Lighthouse config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async cacheAnalysis(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const cacheAnalysis = this.analyzeCachingStrategies(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    cacheAnalysis,
                    recommendations: this.generateCacheRecommendations(cacheAnalysis)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze cache: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async webVitals(framework: string = 'vanilla'): Promise<ToolResult> {
        try {
            const vitalsSetup = this.generateWebVitalsSetup(framework);
            
            const setupDir = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'src/performance'
            );
            await fs.mkdir(setupDir, { recursive: true });

            const setupPath = path.join(setupDir, `web-vitals.${this.getFileExtension(framework)}`);
            await fs.writeFile(setupPath, vitalsSetup.code);

            return {
                success: true,
                result: `Web Vitals monitoring setup generated at ${setupPath}\n\nInstructions:\n${vitalsSetup.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate Web Vitals setup: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async lazyLoading(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const opportunities = this.findLazyLoadingOpportunities(content);

            const optimizedContent = this.generateLazyLoadingCode(content, opportunities);
            const optimizedPath = path.join(
                path.dirname(filePath),
                `${path.basename(filePath, path.extname(filePath))}-optimized${path.extname(filePath)}`
            );
            await fs.writeFile(optimizedPath, optimizedContent);

            return {
                success: true,
                result: JSON.stringify({
                    originalFile: filePath,
                    optimizedFile: optimizedPath,
                    opportunities,
                    recommendations: this.generateLazyLoadingRecommendations(opportunities)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze lazy loading: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async treeShaking(projectDir?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const targetDir = projectDir || workspaceFolder?.uri.fsPath;
            
            if (!targetDir) {
                return { success: false, error: 'No project directory found' };
            }

            const analysis = await this.analyzeTreeShaking(targetDir);

            const reportPath = path.join(targetDir, 'tree-shaking-report.json');
            await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));

            return {
                success: true,
                result: `Tree shaking analysis completed. Report saved to ${reportPath}\n\n${this.formatTreeShakingReport(analysis)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze tree shaking: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async renderOptimization(filePath: string, framework?: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const detectedFramework = framework || this.detectFramework(content);
            const optimizations = this.analyzeRenderingPerformance(content, detectedFramework);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    framework: detectedFramework,
                    renderingIssues: optimizations.issues,
                    recommendations: optimizations.recommendations,
                    optimizedCode: optimizations.optimizedCode
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze rendering: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async networkAnalysis(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const networkIssues = this.analyzeNetworkPerformance(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    networkIssues,
                    recommendations: this.generateNetworkOptimizationRecommendations(networkIssues)
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze network performance: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Helper methods
    private async performBundleAnalysis(buildDir: string, framework: string): Promise<any> {
        const files = await this.getFilesRecursively(buildDir);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        const cssFiles = files.filter(file => file.endsWith('.css'));

        const analysis = {
            framework,
            totalSize: 0,
            jsSize: 0,
            cssSize: 0,
            files: [],
            largestFiles: [],
            duplicateModules: [],
            recommendations: []
        };

        for (const file of jsFiles) {
            const stats = await fs.stat(file);
            const size = stats.size;
            analysis.totalSize += size;
            analysis.jsSize += size;
            analysis.files.push({ path: file, size, type: 'js' });
        }

        for (const file of cssFiles) {
            const stats = await fs.stat(file);
            const size = stats.size;
            analysis.totalSize += size;
            analysis.cssSize += size;
            analysis.files.push({ path: file, size, type: 'css' });
        }

        // Sort by size and find largest files
        analysis.files.sort((a, b) => b.size - a.size);
        analysis.largestFiles = analysis.files.slice(0, 10);

        // Generate recommendations
        if (analysis.totalSize > 1024 * 1024) { // > 1MB
            analysis.recommendations.push('Consider code splitting to reduce bundle size');
        }

        if (analysis.jsSize > 512 * 1024) { // > 512KB
            analysis.recommendations.push('Implement tree shaking to remove unused code');
        }

        return analysis;
    }

    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go'
        };
        return languageMap[ext] || 'unknown';
    }

    private performCodeProfiling(content: string, language: string): any {
        const profile = {
            language,
            complexity: this.calculateComplexity(content),
            potentialBottlenecks: this.findBottlenecks(content, language),
            algorithmicIssues: this.findAlgorithmicIssues(content),
            memoryUsage: this.estimateMemoryUsage(content, language)
        };

        return profile;
    }

    private calculateComplexity(content: string): number {
        // Simplified cyclomatic complexity calculation
        const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||'];
        let complexity = 1; // Base complexity
        
        for (const keyword of complexityKeywords) {
            const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    private findBottlenecks(content: string, language: string): any[] {
        const bottlenecks = [];

        // Common performance anti-patterns
        const patterns = [
            { pattern: /for\s*\([^)]*\)\s*{\s*for\s*\([^)]*\)/g, issue: 'Nested loops detected', severity: 'high' },
            { pattern: /document\.getElementById|document\.querySelector/g, issue: 'DOM queries in loops', severity: 'medium' },
            { pattern: /JSON\.parse\(JSON\.stringify/g, issue: 'Inefficient deep cloning', severity: 'medium' },
            { pattern: /setTimeout\s*\(\s*.*,\s*0\s*\)/g, issue: 'Unnecessary setTimeout with 0 delay', severity: 'low' }
        ];

        for (const { pattern, issue, severity } of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                bottlenecks.push({
                    issue,
                    severity,
                    line: content.substring(0, match.index).split('\n').length,
                    code: match[0]
                });
            }
        }

        return bottlenecks;
    }

    private findAlgorithmicIssues(content: string): any[] {
        const issues = [];

        // Look for potential O(n²) operations
        if (content.includes('indexOf') && content.includes('for')) {
            issues.push({
                type: 'Potential O(n²) operation',
                description: 'Using indexOf inside a loop',
                recommendation: 'Consider using Set or Map for O(1) lookups'
            });
        }

        // Look for array methods in loops
        if (content.match(/for.*\.filter\(|for.*\.map\(|for.*\.find\(/)) {
            issues.push({
                type: 'Array methods in loops',
                description: 'Using array methods inside loops',
                recommendation: 'Consider combining operations or using more efficient algorithms'
            });
        }

        return issues;
    }

    private estimateMemoryUsage(content: string, language: string): any {
        const estimate = {
            variables: (content.match(/(?:let|const|var)\s+\w+/g) || []).length,
            functions: (content.match(/function\s+\w+|=>\s*{|=\s*\([^)]*\)\s*=>/g) || []).length,
            objects: (content.match(/{\s*\w+:/g) || []).length,
            arrays: (content.match(/\[[^\]]*\]/g) || []).length,
            riskLevel: 'low'
        };

        if (estimate.variables > 100 || estimate.objects > 50) {
            estimate.riskLevel = 'high';
        } else if (estimate.variables > 50 || estimate.objects > 25) {
            estimate.riskLevel = 'medium';
        }

        return estimate;
    }

    private generatePerformanceRecommendations(profile: any): string[] {
        const recommendations = [];

        if (profile.complexity > 15) {
            recommendations.push('Consider breaking down complex functions into smaller ones');
        }

        if (profile.potentialBottlenecks.length > 0) {
            recommendations.push('Address identified performance bottlenecks');
        }

        if (profile.algorithmicIssues.length > 0) {
            recommendations.push('Optimize algorithmic complexity for better performance');
        }

        if (profile.memoryUsage.riskLevel === 'high') {
            recommendations.push('Review memory usage and consider object pooling');
        }

        return recommendations;
    }

    private async findImages(directory: string): Promise<string[]> {
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif'];
        const files = await this.getFilesRecursively(directory);
        return files.filter(file => 
            imageExts.includes(path.extname(file).toLowerCase())
        );
    }

    private async analyzeImageOptimizations(images: string[], format: string): Promise<any> {
        const optimizations = {
            images: [],
            summary: {
                totalImages: images.length,
                totalSize: 0,
                potentialSavings: 0,
                recommendations: []
            }
        };

        for (const imagePath of images) {
            try {
                const stats = await fs.stat(imagePath);
                const size = stats.size;
                const ext = path.extname(imagePath).toLowerCase();
                
                let potentialSaving = 0;
                let recommendation = '';

                // Estimate potential savings based on format
                if (ext === '.png' && size > 100000) { // > 100KB PNG
                    potentialSaving = size * 0.3; // 30% savings with WebP
                    recommendation = 'Convert to WebP format';
                } else if (ext === '.jpg' && size > 200000) { // > 200KB JPEG
                    potentialSaving = size * 0.2; // 20% savings with optimization
                    recommendation = 'Optimize JPEG compression';
                }

                optimizations.images.push({
                    path: imagePath,
                    currentSize: size,
                    format: ext,
                    potentialSaving,
                    recommendation
                });

                optimizations.summary.totalSize += size;
                optimizations.summary.potentialSavings += potentialSaving;
            } catch (error) {
                // Skip files that can't be accessed
            }
        }

        // Generate general recommendations
        if (optimizations.summary.potentialSavings > 1024 * 1024) { // > 1MB savings
            optimizations.summary.recommendations.push('Significant size reduction possible with image optimization');
        }

        optimizations.summary.recommendations.push('Consider using responsive images with different sizes');
        optimizations.summary.recommendations.push('Implement lazy loading for images below the fold');

        return optimizations;
    }

    private generateImageOptimizationScript(optimizations: any): string {
        return `#!/bin/bash
# Image Optimization Script
# Generated automatically - review before running

echo "Starting image optimization..."

# Install tools if not available
# npm install -g imagemin-cli imagemin-webp imagemin-mozjpeg imagemin-pngquant

${optimizations.images.map((img: any) => {
    if (img.recommendation.includes('WebP')) {
        return `# Convert ${img.path} to WebP
imagemin "${img.path}" --plugin=webp > "${img.path.replace(path.extname(img.path), '.webp')}"`;
    } else if (img.recommendation.includes('JPEG')) {
        return `# Optimize ${img.path}
imagemin "${img.path}" --plugin=mozjpeg --plugin.mozjpeg.quality=80 > "${img.path}.optimized"`;
    }
    return '';
}).filter(Boolean).join('\n\n')}

echo "Optimization complete!"
echo "Potential savings: ${(optimizations.summary.potentialSavings / 1024 / 1024).toFixed(2)} MB"
`;
    }

    private detectMemoryIssues(content: string): any[] {
        const issues = [];

        // Memory leak patterns
        const patterns = [
            { pattern: /addEventListener\s*\([^)]*\)(?!.*removeEventListener)/g, issue: 'Event listeners without cleanup' },
            { pattern: /setInterval\s*\([^)]*\)(?!.*clearInterval)/g, issue: 'Intervals without cleanup' },
            { pattern: /setTimeout\s*\([^)]*\)(?!.*clearTimeout)/g, issue: 'Timeouts without cleanup' },
            { pattern: /new\s+Array\s*\(\s*\d{6,}\s*\)/g, issue: 'Large array allocation' },
            { pattern: /\[\s*\.\.\.Array\s*\(\s*\d{6,}\s*\)\s*\]/g, issue: 'Large spread array' }
        ];

        for (const { pattern, issue } of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                issues.push({
                    issue,
                    line: content.substring(0, match.index).split('\n').length,
                    code: match[0]
                });
            }
        }

        return issues;
    }

    private generateMemoryOptimizationRecommendations(issues: any[]): string[] {
        const recommendations = [
            'Use WeakMap and WeakSet for object references that should be garbage collected',
            'Remove event listeners when components unmount',
            'Clear intervals and timeouts when no longer needed',
            'Avoid creating large objects in frequently called functions',
            'Consider object pooling for frequently created/destroyed objects',
            'Use lazy loading for large data structures'
        ];

        if (issues.some(issue => issue.issue.includes('Event listeners'))) {
            recommendations.push('Implement proper cleanup in component lifecycle methods');
        }

        if (issues.some(issue => issue.issue.includes('Array'))) {
            recommendations.push('Consider using more memory-efficient data structures');
        }

        return recommendations;
    }

    private analyzeDatabasePerformance(content: string): any {
        const analysis = {
            queries: [],
            issues: [],
            recommendations: [],
            optimizedQueries: ''
        };

        // Find SQL queries
        const sqlPatterns = [
            /SELECT\s+.*?FROM\s+.*?(?:WHERE\s+.*?)?(?:ORDER\s+BY\s+.*?)?(?:LIMIT\s+.*?)?[;\n]/gi,
            /INSERT\s+INTO\s+.*?VALUES\s*\([^)]*\)[;\n]/gi,
            /UPDATE\s+.*?SET\s+.*?(?:WHERE\s+.*?)?[;\n]/gi,
            /DELETE\s+FROM\s+.*?(?:WHERE\s+.*?)?[;\n]/gi
        ];

        let queryIndex = 0;
        for (const pattern of sqlPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                queryIndex++;
                const query = match[0].trim();
                const queryAnalysis = this.analyzeQuery(query, queryIndex);
                analysis.queries.push(queryAnalysis);
                
                if (queryAnalysis.issues.length > 0) {
                    analysis.issues.push(...queryAnalysis.issues);
                }
            }
        }

        // Generate optimized queries
        analysis.optimizedQueries = this.generateOptimizedQueries(analysis.queries);

        // Generate recommendations
        analysis.recommendations = this.generateDatabaseRecommendations(analysis.issues);

        return analysis;
    }

    private analyzeQuery(query: string, index: number): any {
        const queryAnalysis = {
            index,
            query,
            type: this.getQueryType(query),
            issues: [],
            optimizations: []
        };

        // Check for common issues
        if (query.includes('SELECT *')) {
            queryAnalysis.issues.push('Using SELECT * instead of specific columns');
            queryAnalysis.optimizations.push('Specify only needed columns');
        }

        if (query.includes('WHERE') && !query.includes('INDEX')) {
            queryAnalysis.issues.push('WHERE clause may need indexing');
            queryAnalysis.optimizations.push('Consider adding indexes on WHERE clause columns');
        }

        if (!query.includes('LIMIT') && query.includes('SELECT')) {
            queryAnalysis.issues.push('No LIMIT clause in SELECT query');
            queryAnalysis.optimizations.push('Add LIMIT clause to prevent large result sets');
        }

        return queryAnalysis;
    }

    private getQueryType(query: string): string {
        const type = query.trim().split(' ')[0].toUpperCase();
        return ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(type) ? type : 'UNKNOWN';
    }

    private generateOptimizedQueries(queries: any[]): string {
        return queries.map(q => {
            let optimized = q.query;
            
            // Apply optimizations
            if (q.issues.includes('Using SELECT * instead of specific columns')) {
                optimized = optimized.replace('SELECT *', 'SELECT column1, column2 -- Specify needed columns');
            }
            
            if (q.issues.includes('No LIMIT clause in SELECT query')) {
                optimized = optimized.replace(/;?\s*$/, ' LIMIT 100; -- Add appropriate limit');
            }
            
            return `-- Original Query ${q.index}:\n-- ${q.query}\n\n-- Optimized Query ${q.index}:\n${optimized}\n`;
        }).join('\n\n');
    }

    private generateDatabaseRecommendations(issues: any[]): string[] {
        const recommendations = [
            'Add indexes on frequently queried columns',
            'Use EXPLAIN to analyze query execution plans',
            'Implement query result caching',
            'Consider database connection pooling',
            'Monitor slow query logs',
            'Normalize database schema appropriately'
        ];

        if (issues.some(issue => issue.includes('SELECT *'))) {
            recommendations.push('Always specify required columns instead of using SELECT *');
        }

        if (issues.some(issue => issue.includes('LIMIT'))) {
            recommendations.push('Implement pagination for large result sets');
        }

        return recommendations;
    }

    private createLighthouseConfig(url: string): { content: string; instructions: string } {
        const content = `module.exports = {
  ci: {
    collect: {
      url: ['${url}'],
      startServerCommand: 'npm run start',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'categories:pwa': ['warn', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};`;

        const instructions = `1. Install Lighthouse CI: npm install -g @lhci/cli
2. Run: lhci autorun
3. View results in the generated report
4. Adjust assertions based on your requirements`;

        return { content, instructions };
    }

    private analyzeCachingStrategies(content: string): any {
        const analysis = {
            strategies: [],
            issues: [],
            effectiveness: 'unknown'
        };

        // Check for caching patterns
        if (content.includes('Cache-Control')) {
            analysis.strategies.push('HTTP caching');
        }

        if (content.includes('localStorage') || content.includes('sessionStorage')) {
            analysis.strategies.push('Browser storage');
        }

        if (content.includes('redis') || content.includes('memcached')) {
            analysis.strategies.push('In-memory caching');
        }

        if (content.includes('service-worker') || content.includes('sw.js')) {
            analysis.strategies.push('Service Worker caching');
        }

        // Check for issues
        if (content.includes('no-cache') && content.includes('static')) {
            analysis.issues.push('Static assets with no-cache headers');
        }

        if (!content.includes('etag') && !content.includes('last-modified')) {
            analysis.issues.push('Missing cache validation headers');
        }

        // Determine effectiveness
        if (analysis.strategies.length >= 2 && analysis.issues.length === 0) {
            analysis.effectiveness = 'good';
        } else if (analysis.strategies.length > 0) {
            analysis.effectiveness = 'moderate';
        } else {
            analysis.effectiveness = 'poor';
        }

        return analysis;
    }

    private generateCacheRecommendations(analysis: any): string[] {
        const recommendations = [
            'Implement appropriate cache headers for static assets',
            'Use ETags or Last-Modified headers for cache validation',
            'Consider implementing a CDN for static content',
            'Use service workers for offline caching',
            'Implement cache busting for updated assets'
        ];

        if (analysis.effectiveness === 'poor') {
            recommendations.unshift('Implement basic HTTP caching strategy');
        }

        if (analysis.issues.some((issue: string) => issue.includes('static'))) {
            recommendations.push('Set long cache times for static assets with versioning');
        }

        return recommendations;
    }

    private generateWebVitalsSetup(framework: string): { code: string; instructions: string } {
        const setups = {
            react: {
                code: `import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Function to send metrics to analytics
function sendToAnalytics({ name, delta, value, id }) {
  // Replace with your analytics service
  console.log('Web Vital:', { name, delta, value, id });
  
  // Example: Google Analytics 4
  // gtag('event', name, {
  //   event_category: 'Web Vitals',
  //   value: Math.round(name === 'CLS' ? delta * 1000 : delta),
  //   event_label: id,
  //   non_interaction: true,
  // });
}

// Measure all Web Vitals
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);

export default sendToAnalytics;`,
                instructions: '1. Install: npm install web-vitals\n2. Import in your main App component\n3. Configure your analytics service'
            },
            vue: {
                code: `import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Vue plugin for Web Vitals
export default {
  install(app, options = {}) {
    const sendToAnalytics = ({ name, delta, value, id }) => {
      console.log('Web Vital:', { name, delta, value, id });
      
      // Custom analytics integration
      if (options.analyticsCallback) {
        options.analyticsCallback({ name, delta, value, id });
      }
    };

    getCLS(sendToAnalytics);
    getFID(sendToAnalytics);
    getFCP(sendToAnalytics);
    getLCP(sendToAnalytics);
    getTTFB(sendToAnalytics);

    app.config.globalProperties.$webVitals = sendToAnalytics;
  }
};`,
                instructions: '1. Install: npm install web-vitals\n2. Register as Vue plugin\n3. Configure analytics callback'
            },
            vanilla: {
                code: `import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Web Vitals monitoring setup
class WebVitalsMonitor {
  constructor(analyticsEndpoint = null) {
    this.analyticsEndpoint = analyticsEndpoint;
    this.init();
  }

  sendToAnalytics({ name, delta, value, id }) {
    const data = { name, delta, value, id, timestamp: Date.now() };
    
    console.log('Web Vital:', data);

    // Send to analytics endpoint
    if (this.analyticsEndpoint) {
      fetch(this.analyticsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(console.error);
    }
  }

  init() {
    const callback = this.sendToAnalytics.bind(this);
    getCLS(callback);
    getFID(callback);
    getFCP(callback);
    getLCP(callback);
    getTTFB(callback);
  }
}

// Initialize monitoring
const monitor = new WebVitalsMonitor('/api/analytics/web-vitals');
export default monitor;`,
                instructions: '1. Install: npm install web-vitals\n2. Import in your main JavaScript file\n3. Configure analytics endpoint'
            }
        };

        return setups[framework as keyof typeof setups] || setups.vanilla;
    }

    private getFileExtension(framework: string): string {
        const extensions = {
            react: 'jsx',
            vue: 'js',
            angular: 'ts',
            vanilla: 'js'
        };
        return extensions[framework as keyof typeof extensions] || 'js';
    }

    private findLazyLoadingOpportunities(content: string): any[] {
        const opportunities = [];

        // Image lazy loading opportunities
        const imgMatches = content.matchAll(/<img\s+[^>]*src=[^>]*>/gi);
        for (const match of imgMatches) {
            if (!match[0].includes('loading=')) {
                opportunities.push({
                    type: 'image',
                    element: match[0],
                    recommendation: 'Add loading="lazy" attribute'
                });
            }
        }

        // Component lazy loading opportunities (React/Vue)
        const importMatches = content.matchAll(/import\s+\w+\s+from\s+['"][^'"]*['"];?/gi);
        for (const match of importMatches) {
            if (match[0].includes('./components/') || match[0].includes('./pages/')) {
                opportunities.push({
                    type: 'component',
                    element: match[0],
                    recommendation: 'Consider dynamic import for code splitting'
                });
            }
        }

        return opportunities;
    }

    private generateLazyLoadingCode(content: string, opportunities: any[]): string {
        let optimizedContent = content;

        for (const opportunity of opportunities) {
            if (opportunity.type === 'image') {
                // Add loading="lazy" to images
                const newElement = opportunity.element.replace('<img', '<img loading="lazy"');
                optimizedContent = optimizedContent.replace(opportunity.element, newElement);
            }
        }

        return optimizedContent;
    }

    private generateLazyLoadingRecommendations(opportunities: any[]): string[] {
        const recommendations = [];

        if (opportunities.some(o => o.type === 'image')) {
            recommendations.push('Add loading="lazy" to images below the fold');
            recommendations.push('Consider using Intersection Observer for custom lazy loading');
        }

        if (opportunities.some(o => o.type === 'component')) {
            recommendations.push('Implement dynamic imports for route-based code splitting');
            recommendations.push('Use React.lazy() or Vue async components');
        }

        recommendations.push('Implement skeleton screens for better perceived performance');

        return recommendations;
    }

    private async analyzeTreeShaking(projectDir: string): Promise<any> {
        const analysis = {
            unusedExports: [],
            unusedImports: [],
            potentialSavings: 0,
            recommendations: []
        };

        try {
            const jsFiles = await this.getJSFiles(projectDir);
            
            for (const file of jsFiles) {
                const content = await fs.readFile(file, 'utf8');
                const fileAnalysis = this.analyzeFileForTreeShaking(content, file);
                analysis.unusedExports.push(...fileAnalysis.unusedExports);
                analysis.unusedImports.push(...fileAnalysis.unusedImports);
            }

            // Estimate potential savings
            analysis.potentialSavings = analysis.unusedExports.length * 1024; // Rough estimate

            // Generate recommendations
            if (analysis.unusedExports.length > 10) {
                analysis.recommendations.push('Remove unused exports to improve tree shaking');
            }

            if (analysis.unusedImports.length > 5) {
                analysis.recommendations.push('Remove unused imports to reduce bundle size');
            }

            analysis.recommendations.push('Use ES6 modules for better tree shaking support');
            analysis.recommendations.push('Avoid default exports when possible');

        } catch (error) {
            analysis.recommendations.push('Error analyzing project structure');
        }

        return analysis;
    }

    private async getJSFiles(directory: string): Promise<string[]> {
        const files = await this.getFilesRecursively(directory);
        return files.filter(file => 
            ['.js', '.ts', '.jsx', '.tsx'].includes(path.extname(file)) &&
            !file.includes('node_modules') &&
            !file.includes('.test.') &&
            !file.includes('.spec.')
        );
    }

    private analyzeFileForTreeShaking(content: string, filePath: string): any {
        const analysis = {
            unusedExports: [],
            unusedImports: []
        };

        // Find exports
        const exportMatches = content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g);
        for (const match of exportMatches) {
            analysis.unusedExports.push({
                name: match[1],
                file: filePath,
                type: 'named export'
            });
        }

        // Find imports that might be unused
        const importMatches = content.matchAll(/import\s+{([^}]+)}\s+from/g);
        for (const match of importMatches) {
            const imports = match[1].split(',').map(i => i.trim());
            for (const imp of imports) {
                if (!content.includes(imp.replace(/\s+as\s+\w+/, ''))) {
                    analysis.unusedImports.push({
                        name: imp,
                        file: filePath
                    });
                }
            }
        }

        return analysis;
    }

    private formatTreeShakingReport(analysis: any): string {
        return `Tree Shaking Analysis Results:
- Unused exports: ${analysis.unusedExports.length}
- Unused imports: ${analysis.unusedImports.length}
- Potential savings: ${(analysis.potentialSavings / 1024).toFixed(2)} KB
- Recommendations: ${analysis.recommendations.length}`;
    }

    private detectFramework(content: string): string {
        if (content.includes('React') || content.includes('jsx')) return 'react';
        if (content.includes('Vue') || content.includes('<template>')) return 'vue';
        if (content.includes('Angular') || content.includes('@Component')) return 'angular';
        if (content.includes('Svelte')) return 'svelte';
        return 'vanilla';
    }

    private analyzeRenderingPerformance(content: string, framework: string): any {
        const analysis = {
            issues: [],
            recommendations: [],
            optimizedCode: content
        };

        switch (framework) {
            case 'react':
                analysis.issues.push(...this.analyzeReactPerformance(content));
                break;
            case 'vue':
                analysis.issues.push(...this.analyzeVuePerformance(content));
                break;
            default:
                analysis.issues.push(...this.analyzeVanillaPerformance(content));
        }

        analysis.recommendations = this.generateRenderingRecommendations(analysis.issues, framework);

        return analysis;
    }

    private analyzeReactPerformance(content: string): any[] {
        const issues = [];

        if (content.includes('useEffect(() => {') && !content.includes('[]')) {
            issues.push({
                type: 'Missing dependency array',
                description: 'useEffect without proper dependencies'
            });
        }

        if (content.includes('.map(') && !content.includes('key=')) {
            issues.push({
                type: 'Missing keys in lists',
                description: 'Lists without proper key props'
            });
        }

        return issues;
    }

    private analyzeVuePerformance(content: string): any[] {
        const issues = [];

        if (content.includes('v-for') && !content.includes(':key')) {
            issues.push({
                type: 'Missing keys in v-for',
                description: 'v-for without proper key binding'
            });
        }

        return issues;
    }

    private analyzeVanillaPerformance(content: string): any[] {
        const issues = [];

        if (content.includes('document.getElementById') && content.split('document.getElementById').length > 5) {
            issues.push({
                type: 'Repeated DOM queries',
                description: 'Multiple DOM queries for same elements'
            });
        }

        return issues;
    }

    private generateRenderingRecommendations(issues: any[], framework: string): string[] {
        const recommendations = [];

        for (const issue of issues) {
            switch (issue.type) {
                case 'Missing dependency array':
                    recommendations.push('Add proper dependency arrays to useEffect hooks');
                    break;
                case 'Missing keys in lists':
                    recommendations.push('Add unique key props to list items');
                    break;
                case 'Repeated DOM queries':
                    recommendations.push('Cache DOM elements instead of repeated queries');
                    break;
            }
        }

        // Framework-specific recommendations
        if (framework === 'react') {
            recommendations.push('Consider using React.memo for expensive components');
            recommendations.push('Use useMemo and useCallback for expensive computations');
        } else if (framework === 'vue') {
            recommendations.push('Use v-memo for expensive list rendering');
            recommendations.push('Consider component-level caching');
        }

        return recommendations;
    }

    private analyzeNetworkPerformance(content: string): any[] {
        const issues = [];

        // Check for network anti-patterns
        const patterns = [
            { pattern: /fetch\([^)]*\)\.then\([^)]*\)\.then/g, issue: 'Sequential API calls' },
            { pattern: /await\s+fetch[^;]*;\s*await\s+fetch/g, issue: 'Sequential await calls' },
            { pattern: /fetch\([^)]*\)(?!.*\.catch)/g, issue: 'Missing error handling' },
            { pattern: /setInterval\([^)]*fetch/g, issue: 'Polling without optimization' }
        ];

        for (const { pattern, issue } of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                issues.push({
                    issue,
                    line: content.substring(0, match.index).split('\n').length,
                    code: match[0]
                });
            }
        }

        return issues;
    }

    private generateNetworkOptimizationRecommendations(issues: any[]): string[] {
        const recommendations = [
            'Implement request batching for multiple API calls',
            'Use Promise.all() for parallel requests',
            'Add proper error handling and retry logic',
            'Implement request caching to avoid duplicate calls',
            'Use debouncing for user input-triggered requests',
            'Consider implementing request deduplication'
        ];

        if (issues.some(issue => issue.issue.includes('Sequential'))) {
            recommendations.push('Parallelize independent API calls');
        }

        if (issues.some(issue => issue.issue.includes('Polling'))) {
            recommendations.push('Use WebSockets or Server-Sent Events instead of polling');
        }

        return recommendations;
    }

    private formatBundleReport(analysis: any): string {
        return `Bundle Analysis Results:
- Total size: ${(analysis.totalSize / 1024 / 1024).toFixed(2)} MB
- JavaScript: ${(analysis.jsSize / 1024 / 1024).toFixed(2)} MB
- CSS: ${(analysis.cssSize / 1024 / 1024).toFixed(2)} MB
- Largest files: ${analysis.largestFiles.length}
- Recommendations: ${analysis.recommendations.length}`;
    }

    private async getFilesRecursively(dir: string): Promise<string[]> {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    const subFiles = await this.getFilesRecursively(fullPath);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist or be accessible
        }
        
        return files;
    }
}

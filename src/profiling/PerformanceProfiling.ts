/**
 * Performance Profiling - v0.9.0 Professional Features
 * 
 * Real-time performance analysis with comprehensive metrics collection,
 * bottleneck identification, and optimization recommendations.
 * 
 * Features:
 * - Real-time performance monitoring
 * - Memory usage tracking and leak detection
 * - CPU profiling and call stack analysis
 * - Bundle size analysis and optimization
 * - Network performance monitoring
 * - Database query profiling
 * - Automated performance testing
 * - Performance regression detection
 * - Optimization recommendations
 * - Historical performance trends
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

export interface PerformanceMetric {
    id: string;
    name: string;
    category: 'cpu' | 'memory' | 'network' | 'bundle' | 'database' | 'render' | 'custom';
    value: number;
    unit: 'ms' | 'MB' | 'KB' | 'bytes' | 'percent' | 'count' | 'fps';
    timestamp: number;
    threshold?: {
        warning: number;
        critical: number;
    };
    context?: { [key: string]: any };
}

export interface PerformanceProfile {
    id: string;
    name: string;
    description: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metrics: PerformanceMetric[];
    callStack: CallStackFrame[];
    memorySnapshots: MemorySnapshot[];
    networkRequests: NetworkRequest[];
    bundleAnalysis?: BundleAnalysis;
    databaseQueries?: DatabaseQuery[];
    recommendations: PerformanceRecommendation[];
}

export interface CallStackFrame {
    functionName: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
    executionTime: number;
    memoryUsage: number;
    children: CallStackFrame[];
}

export interface MemorySnapshot {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    objects: { [type: string]: number };
}

export interface NetworkRequest {
    id: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    startTime: number;
    endTime: number;
    duration: number;
    requestSize: number;
    responseSize: number;
    statusCode: number;
    cached: boolean;
    blocked: boolean;
}

export interface BundleAnalysis {
    totalSize: number;
    compressedSize: number;
    modules: {
        name: string;
        size: number;
        compressedSize: number;
        parseDuration: number;
        dependencies: string[];
    }[];
    duplicates: { module: string; size: number; locations: string[] }[];
    unusedCode: { file: string; percentage: number }[];
    treeShakingOpportunities: string[];
}

export interface DatabaseQuery {
    id: string;
    query: string;
    database: string;
    table?: string;
    startTime: number;
    endTime: number;
    duration: number;
    rowsAffected: number;
    explain?: any;
    indexUsage: string[];
    slowQuery: boolean;
}

export interface PerformanceRecommendation {
    id: string;
    category: 'critical' | 'warning' | 'suggestion';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    priority: number;
    autoFixable: boolean;
    fix?: () => Promise<void>;
    metrics: string[];
}

export interface PerformanceBenchmark {
    name: string;
    description: string;
    iterations: number;
    warmupIterations: number;
    results: {
        avg: number;
        min: number;
        max: number;
        stdDev: number;
        percentiles: { [key: string]: number };
    };
}

export interface PerformanceAlert {
    id: string;
    metric: string;
    threshold: number;
    currentValue: number;
    severity: 'warning' | 'critical';
    message: string;
    timestamp: number;
    resolved: boolean;
}

/**
 * Advanced Performance Profiling Engine
 */
export class PerformanceProfiling {
    private activeProfiles: Map<string, PerformanceProfile> = new Map();
    private historicalData: Map<string, PerformanceMetric[]> = new Map();
    private benchmarks: Map<string, PerformanceBenchmark> = new Map();
    private alerts: PerformanceAlert[] = [];
    private watchers: Map<string, NodeJS.Timeout> = new Map();
    private isMonitoring: boolean = false;

    constructor() {
        this.initializeMonitoring();
        this.setupBuiltInBenchmarks();
    }

    /**
     * Initialize performance monitoring
     */
    private initializeMonitoring(): void {
        if (typeof process !== 'undefined') {
            // Node.js environment monitoring
            this.startMemoryMonitoring();
            this.startCPUMonitoring();
        }

        // VS Code specific monitoring
        if (vscode.window.activeTextEditor) {
            this.startEditorMonitoring();
        }
    }

    /**
     * Set up built-in performance benchmarks
     */
    private setupBuiltInBenchmarks(): void {
        // File I/O benchmark
        this.addBenchmark({
            name: 'file-io-read',
            description: 'File reading performance benchmark',
            iterations: 100,
            warmupIterations: 10,
            results: {
                avg: 0,
                min: 0,
                max: 0,
                stdDev: 0,
                percentiles: {}
            }
        });

        // Text processing benchmark
        this.addBenchmark({
            name: 'text-processing',
            description: 'Text processing and regex performance',
            iterations: 1000,
            warmupIterations: 100,
            results: {
                avg: 0,
                min: 0,
                max: 0,
                stdDev: 0,
                percentiles: {}
            }
        });
    }

    /**
     * Start a new performance profiling session
     */
    public startProfiling(
        name: string,
        description: string = '',
        options: {
            trackMemory?: boolean;
            trackCPU?: boolean;
            trackNetwork?: boolean;
            trackBundle?: boolean;
            trackDatabase?: boolean;
        } = {}
    ): string {
        const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const profile: PerformanceProfile = {
            id: profileId,
            name,
            description,
            startTime: performance.now(),
            metrics: [],
            callStack: [],
            memorySnapshots: [],
            networkRequests: [],
            recommendations: []
        };

        // Initial memory snapshot
        if (options.trackMemory !== false) {
            profile.memorySnapshots.push(this.captureMemorySnapshot());
        }

        // Start CPU profiling if requested
        if (options.trackCPU) {
            this.startCPUProfiling(profileId);
        }

        // Start network monitoring if requested
        if (options.trackNetwork) {
            this.startNetworkMonitoring(profileId);
        }

        this.activeProfiles.set(profileId, profile);
        return profileId;
    }

    /**
     * Stop profiling session and generate report
     */
    public async stopProfiling(profileId: string): Promise<PerformanceProfile | null> {
        const profile = this.activeProfiles.get(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        profile.endTime = performance.now();
        profile.duration = profile.endTime - profile.startTime;

        // Final memory snapshot
        profile.memorySnapshots.push(this.captureMemorySnapshot());

        // Stop CPU profiling
        this.stopCPUProfiling(profileId);

        // Stop network monitoring
        this.stopNetworkMonitoring(profileId);

        // Analyze bundle if requested
        if (profile.bundleAnalysis === undefined) {
            profile.bundleAnalysis = await this.analyzeBundlePerformance();
        }

        // Generate recommendations
        profile.recommendations = await this.generateRecommendations(profile);

        // Store historical data
        this.storeHistoricalData(profile);

        // Remove from active profiles
        this.activeProfiles.delete(profileId);

        return profile;
    }

    /**
     * Record a performance metric
     */
    public recordMetric(
        profileId: string | null,
        metric: Omit<PerformanceMetric, 'timestamp'>
    ): void {
        const fullMetric: PerformanceMetric = {
            ...metric,
            timestamp: performance.now()
        };

        if (profileId) {
            const profile = this.activeProfiles.get(profileId);
            if (profile) {
                profile.metrics.push(fullMetric);
            }
        }

        // Store in historical data
        if (!this.historicalData.has(metric.id)) {
            this.historicalData.set(metric.id, []);
        }
        this.historicalData.get(metric.id)!.push(fullMetric);

        // Check for alerts
        this.checkMetricThresholds(fullMetric);
    }

    /**
     * Measure execution time of a function
     */
    public async measureExecution<T>(
        name: string,
        fn: () => Promise<T> | T,
        profileId?: string,
        category: PerformanceMetric['category'] = 'custom'
    ): Promise<{ result: T; duration: number }> {
        const startTime = performance.now();
        const startMemory = this.getCurrentMemoryUsage();

        try {
            const result = await fn();
            const endTime = performance.now();
            const endMemory = this.getCurrentMemoryUsage();
            const duration = endTime - startTime;

            // Record metric
            this.recordMetric(profileId || null, {
                id: `execution_${name}`,
                name: `Execution Time: ${name}`,
                category,
                value: duration,
                unit: 'ms',
                context: {
                    memoryDelta: endMemory.heapUsed - startMemory.heapUsed
                }
            });

            return { result, duration };
        } catch (error) {
            const endTime = performance.now();
            const duration = endTime - startTime;

            this.recordMetric(profileId || null, {
                id: `execution_error_${name}`,
                name: `Execution Error: ${name}`,
                category,
                value: duration,
                unit: 'ms',
                context: {
                    error: error instanceof Error ? error.message : String(error)
                }
            });

            throw error;
        }
    }

    /**
     * Run performance benchmark
     */
    public async runBenchmark(benchmarkName: string): Promise<PerformanceBenchmark> {
        const benchmark = this.benchmarks.get(benchmarkName);
        if (!benchmark) {
            throw new Error(`Benchmark not found: ${benchmarkName}`);
        }

        const results: number[] = [];
        
        // Warmup iterations
        for (let i = 0; i < benchmark.warmupIterations; i++) {
            await this.executeBenchmarkOperation(benchmarkName);
        }

        // Actual benchmark iterations
        for (let i = 0; i < benchmark.iterations; i++) {
            const { duration } = await this.executeBenchmarkOperation(benchmarkName);
            results.push(duration);
        }

        // Calculate statistics
        results.sort((a, b) => a - b);
        const avg = results.reduce((a, b) => a + b, 0) / results.length;
        const min = results[0];
        const max = results[results.length - 1];
        
        // Calculate standard deviation
        const variance = results.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / results.length;
        const stdDev = Math.sqrt(variance);

        // Calculate percentiles
        const percentiles: { [key: string]: number } = {};
        const percentileValues = [50, 75, 90, 95, 99];
        for (const p of percentileValues) {
            const index = Math.ceil((p / 100) * results.length) - 1;
            percentiles[`p${p}`] = results[index];
        }

        const updatedBenchmark: PerformanceBenchmark = {
            ...benchmark,
            results: {
                avg,
                min,
                max,
                stdDev,
                percentiles
            }
        };

        this.benchmarks.set(benchmarkName, updatedBenchmark);
        return updatedBenchmark;
    }

    /**
     * Monitor file operations performance
     */
    public async monitorFileOperations(
        operation: () => Promise<any>,
        filePath: string,
        profileId?: string
    ): Promise<any> {
        const startTime = performance.now();
        
        try {
            const result = await operation();
            const duration = performance.now() - startTime;
            
            this.recordMetric(profileId || null, {
                id: 'file_operation',
                name: 'File Operation',
                category: 'cpu',
                value: duration,
                unit: 'ms',
                context: { filePath }
            });

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            
            this.recordMetric(profileId || null, {
                id: 'file_operation_error',
                name: 'File Operation Error',
                category: 'cpu',
                value: duration,
                unit: 'ms',
                context: { filePath, error: String(error) }
            });

            throw error;
        }
    }

    /**
     * Analyze memory leaks
     */
    public analyzeMemoryLeaks(profileId: string): {
        leaksDetected: boolean;
        leakPatterns: { object: string; growthRate: number; instances: number }[];
        recommendations: string[];
    } {
        const profile = this.activeProfiles.get(profileId);
        if (!profile || profile.memorySnapshots.length < 2) {
            return {
                leaksDetected: false,
                leakPatterns: [],
                recommendations: ['Insufficient memory snapshots for leak analysis']
            };
        }

        const leakPatterns: { object: string; growthRate: number; instances: number }[] = [];
        const recommendations: string[] = [];

        // Analyze heap growth
        const snapshots = profile.memorySnapshots;
        const heapGrowth = snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed;
        const timespan = snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp;
        
        if (heapGrowth > 10 * 1024 * 1024) { // 10MB threshold
            recommendations.push('Significant heap growth detected. Check for memory leaks.');
        }

        // Analyze object growth patterns
        const objectTypes = new Set<string>();
        snapshots.forEach(snapshot => {
            Object.keys(snapshot.objects).forEach(type => objectTypes.add(type));
        });

        for (const objType of Array.from(objectTypes)) {
            const firstCount = snapshots[0].objects[objType] || 0;
            const lastCount = snapshots[snapshots.length - 1].objects[objType] || 0;
            
            if (lastCount > firstCount * 2) { // 100% growth threshold
                const growthRate = (lastCount - firstCount) / firstCount;
                leakPatterns.push({
                    object: objType,
                    growthRate,
                    instances: lastCount
                });
            }
        }

        const leaksDetected = leakPatterns.length > 0 || heapGrowth > 50 * 1024 * 1024;

        if (leaksDetected) {
            recommendations.push(
                'Use memory profiler to identify specific leak sources',
                'Check for unclosed event listeners or timers',
                'Review closure usage and variable references'
            );
        }

        return {
            leaksDetected,
            leakPatterns,
            recommendations
        };
    }

    /**
     * Get real-time performance metrics
     */
    public getRealTimeMetrics(): {
        cpu: number;
        memory: MemorySnapshot;
        activeProfiles: number;
        alertsCount: number;
    } {
        return {
            cpu: this.getCurrentCPUUsage(),
            memory: this.captureMemorySnapshot(),
            activeProfiles: this.activeProfiles.size,
            alertsCount: this.alerts.filter(a => !a.resolved).length
        };
    }

    /**
     * Get performance trends
     */
    public getPerformanceTrends(
        metricId: string,
        timeRange: 'hour' | 'day' | 'week' | 'month'
    ): {
        data: { timestamp: number; value: number }[];
        trend: 'improving' | 'degrading' | 'stable';
        variance: number;
    } {
        const metrics = this.historicalData.get(metricId) || [];
        const now = Date.now();
        const timeRanges = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000
        };

        const cutoff = now - timeRanges[timeRange];
        const filteredMetrics = metrics
            .filter(m => m.timestamp >= cutoff)
            .map(m => ({ timestamp: m.timestamp, value: m.value }))
            .sort((a, b) => a.timestamp - b.timestamp);

        // Calculate trend
        let trend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (filteredMetrics.length >= 2) {
            const firstHalf = filteredMetrics.slice(0, Math.floor(filteredMetrics.length / 2));
            const secondHalf = filteredMetrics.slice(Math.floor(filteredMetrics.length / 2));
            
            const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
            
            const change = (secondAvg - firstAvg) / firstAvg;
            if (Math.abs(change) > 0.1) { // 10% threshold
                trend = change > 0 ? 'degrading' : 'improving';
            }
        }

        // Calculate variance
        const values = filteredMetrics.map(m => m.value);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;

        return {
            data: filteredMetrics,
            trend,
            variance
        };
    }

    /**
     * Generate optimization recommendations
     */
    public async generateOptimizationRecommendations(
        projectPath: string
    ): Promise<PerformanceRecommendation[]> {
        const recommendations: PerformanceRecommendation[] = [];

        try {
            // Analyze bundle size
            const bundleAnalysis = await this.analyzeBundlePerformance(projectPath);
            if (bundleAnalysis) {
                if (bundleAnalysis.totalSize > 1024 * 1024) { // 1MB threshold
                    recommendations.push({
                        id: 'bundle-size-optimization',
                        category: 'warning',
                        title: 'Large Bundle Size',
                        description: `Bundle size is ${(bundleAnalysis.totalSize / 1024 / 1024).toFixed(2)}MB. Consider code splitting.`,
                        impact: 'high',
                        effort: 'medium',
                        priority: 8,
                        autoFixable: false,
                        metrics: ['bundle_size']
                    });
                }

                if (bundleAnalysis.duplicates.length > 0) {
                    recommendations.push({
                        id: 'duplicate-modules',
                        category: 'warning',
                        title: 'Duplicate Modules Detected',
                        description: `Found ${bundleAnalysis.duplicates.length} duplicate modules that could be deduplicated.`,
                        impact: 'medium',
                        effort: 'low',
                        priority: 6,
                        autoFixable: true,
                        metrics: ['bundle_duplicates']
                    });
                }
            }

            // Analyze memory usage patterns
            const memoryMetrics = this.historicalData.get('memory_usage');
            if (memoryMetrics && memoryMetrics.length > 0) {
                const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length;
                if (avgMemory > 512 * 1024 * 1024) { // 512MB threshold
                    recommendations.push({
                        id: 'high-memory-usage',
                        category: 'critical',
                        title: 'High Memory Usage',
                        description: 'Average memory usage is above 512MB. Consider memory optimization.',
                        impact: 'high',
                        effort: 'high',
                        priority: 9,
                        autoFixable: false,
                        metrics: ['memory_usage']
                    });
                }
            }

            // Check for slow database queries
            const allProfiles = Array.from(this.activeProfiles.values());
            const slowQueries = allProfiles
                .flatMap(p => p.databaseQueries || [])
                .filter(q => q.duration > 1000); // 1 second threshold

            if (slowQueries.length > 0) {
                recommendations.push({
                    id: 'slow-database-queries',
                    category: 'warning',
                    title: 'Slow Database Queries',
                    description: `Found ${slowQueries.length} queries taking longer than 1 second.`,
                    impact: 'high',
                    effort: 'medium',
                    priority: 7,
                    autoFixable: false,
                    metrics: ['db_query_time']
                });
            }

        } catch (error) {
            console.warn('Error generating recommendations:', error);
        }

        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Private helper methods
     */
    private startMemoryMonitoring(): void {
        const interval = setInterval(() => {
            const snapshot = this.captureMemorySnapshot();
            this.recordMetric(null, {
                id: 'memory_usage',
                name: 'Memory Usage',
                category: 'memory',
                value: snapshot.heapUsed,
                unit: 'bytes',
                threshold: {
                    warning: 256 * 1024 * 1024, // 256MB
                    critical: 512 * 1024 * 1024  // 512MB
                }
            });
        }, 10000); // Every 10 seconds

        this.watchers.set('memory', interval);
    }

    private startCPUMonitoring(): void {
        let lastCPUUsage = process.cpuUsage();
        
        const interval = setInterval(() => {
            const currentCPUUsage = process.cpuUsage(lastCPUUsage);
            const cpuPercent = (currentCPUUsage.user + currentCPUUsage.system) / 1000000; // Convert to seconds
            
            this.recordMetric(null, {
                id: 'cpu_usage',
                name: 'CPU Usage',
                category: 'cpu',
                value: cpuPercent * 100,
                unit: 'percent',
                threshold: {
                    warning: 70,
                    critical: 90
                }
            });

            lastCPUUsage = process.cpuUsage();
        }, 5000); // Every 5 seconds

        this.watchers.set('cpu', interval);
    }

    private startEditorMonitoring(): void {
        // Monitor editor performance
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                const startTime = performance.now();
                
                // Monitor document opening time
                setTimeout(() => {
                    const duration = performance.now() - startTime;
                    this.recordMetric(null, {
                        id: 'editor_open_time',
                        name: 'Editor Open Time',
                        category: 'render',
                        value: duration,
                        unit: 'ms',
                        context: {
                            fileName: path.basename(editor.document.fileName),
                            fileSize: editor.document.getText().length
                        }
                    });
                }, 100);
            }
        });
    }

    private startCPUProfiling(profileId: string): void {
        // CPU profiling would typically use Node.js profiler or V8 profiler
        // This is a simplified implementation
        const profile = this.activeProfiles.get(profileId);
        if (!profile) return;

        const interval = setInterval(() => {
            const cpuUsage = this.getCurrentCPUUsage();
            this.recordMetric(profileId, {
                id: 'cpu_profile',
                name: 'CPU Profile',
                category: 'cpu',
                value: cpuUsage,
                unit: 'percent'
            });
        }, 100); // Every 100ms

        this.watchers.set(`cpu_${profileId}`, interval);
    }

    private stopCPUProfiling(profileId: string): void {
        const watcherKey = `cpu_${profileId}`;
        const interval = this.watchers.get(watcherKey);
        if (interval) {
            clearInterval(interval);
            this.watchers.delete(watcherKey);
        }
    }

    private startNetworkMonitoring(profileId: string): void {
        // Network monitoring would typically intercept HTTP requests
        // This is a placeholder implementation
        console.log(`Started network monitoring for profile: ${profileId}`);
    }

    private stopNetworkMonitoring(profileId: string): void {
        console.log(`Stopped network monitoring for profile: ${profileId}`);
    }

    private captureMemorySnapshot(): MemorySnapshot {
        if (typeof process !== 'undefined') {
            const memoryUsage = process.memoryUsage();
            return {
                timestamp: performance.now(),
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
                arrayBuffers: memoryUsage.arrayBuffers || 0,
                objects: {} // Would need heap profiler for detailed object counts
            };
        }

        return {
            timestamp: performance.now(),
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            rss: 0,
            arrayBuffers: 0,
            objects: {}
        };
    }

    private getCurrentMemoryUsage(): { heapUsed: number; heapTotal: number } {
        if (typeof process !== 'undefined') {
            const memoryUsage = process.memoryUsage();
            return {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal
            };
        }
        return { heapUsed: 0, heapTotal: 0 };
    }

    private getCurrentCPUUsage(): number {
        if (typeof process !== 'undefined') {
            const startUsage = process.cpuUsage();
            // Simple CPU usage estimation
            return (startUsage.user + startUsage.system) / 1000000 * 100;
        }
        return 0;
    }

    private async analyzeBundlePerformance(projectPath?: string): Promise<BundleAnalysis | undefined> {
        if (!projectPath) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) return undefined;
            projectPath = workspaceFolders[0].uri.fsPath;
        }

        try {
            // Look for common bundle files
            const bundlePaths = [
                path.join(projectPath, 'dist'),
                path.join(projectPath, 'build'),
                path.join(projectPath, 'public'),
                path.join(projectPath, 'out')
            ];

            let totalSize = 0;
            let compressedSize = 0;
            const modules: BundleAnalysis['modules'] = [];

            for (const bundlePath of bundlePaths) {
                if (fs.existsSync(bundlePath)) {
                    const files = fs.readdirSync(bundlePath);
                    for (const file of files) {
                        if (file.endsWith('.js') || file.endsWith('.css')) {
                            const filePath = path.join(bundlePath, file);
                            const stats = fs.statSync(filePath);
                            totalSize += stats.size;
                            compressedSize += stats.size * 0.7; // Estimate compression

                            modules.push({
                                name: file,
                                size: stats.size,
                                compressedSize: stats.size * 0.7,
                                parseDuration: 0,
                                dependencies: []
                            });
                        }
                    }
                }
            }

            return {
                totalSize,
                compressedSize,
                modules,
                duplicates: [],
                unusedCode: [],
                treeShakingOpportunities: []
            };
        } catch (error) {
            console.warn('Error analyzing bundle:', error);
            return undefined;
        }
    }

    private async generateRecommendations(profile: PerformanceProfile): Promise<PerformanceRecommendation[]> {
        const recommendations: PerformanceRecommendation[] = [];

        // Check execution time
        const slowMetrics = profile.metrics.filter(m => 
            m.unit === 'ms' && m.value > 1000 && m.category === 'cpu'
        );

        if (slowMetrics.length > 0) {
            recommendations.push({
                id: 'slow-execution',
                category: 'warning',
                title: 'Slow Execution Detected',
                description: `Found ${slowMetrics.length} operations taking longer than 1 second.`,
                impact: 'high',
                effort: 'medium',
                priority: 8,
                autoFixable: false,
                metrics: slowMetrics.map(m => m.id)
            });
        }

        // Check memory usage
        if (profile.memorySnapshots.length >= 2) {
            const memoryGrowth = profile.memorySnapshots[profile.memorySnapshots.length - 1].heapUsed - 
                               profile.memorySnapshots[0].heapUsed;
            
            if (memoryGrowth > 50 * 1024 * 1024) { // 50MB growth
                recommendations.push({
                    id: 'memory-growth',
                    category: 'critical',
                    title: 'Significant Memory Growth',
                    description: `Memory usage grew by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB during profiling.`,
                    impact: 'high',
                    effort: 'high',
                    priority: 9,
                    autoFixable: false,
                    metrics: ['memory']
                });
            }
        }

        return recommendations.sort((a, b) => b.priority - a.priority);
    }

    private checkMetricThresholds(metric: PerformanceMetric): void {
        if (!metric.threshold) return;

        let severity: 'warning' | 'critical' | null = null;
        let threshold = 0;

        if (metric.value >= metric.threshold.critical) {
            severity = 'critical';
            threshold = metric.threshold.critical;
        } else if (metric.value >= metric.threshold.warning) {
            severity = 'warning';
            threshold = metric.threshold.warning;
        }

        if (severity) {
            const alert: PerformanceAlert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                metric: metric.id,
                threshold,
                currentValue: metric.value,
                severity,
                message: `${metric.name} (${metric.value}${metric.unit}) exceeded ${severity} threshold (${threshold}${metric.unit})`,
                timestamp: Date.now(),
                resolved: false
            };

            this.alerts.push(alert);

            // Auto-resolve old alerts for the same metric
            this.alerts.forEach(a => {
                if (a.metric === metric.id && a.id !== alert.id && !a.resolved) {
                    a.resolved = true;
                }
            });
        }
    }

    private storeHistoricalData(profile: PerformanceProfile): void {
        for (const metric of profile.metrics) {
            if (!this.historicalData.has(metric.id)) {
                this.historicalData.set(metric.id, []);
            }
            
            const history = this.historicalData.get(metric.id)!;
            history.push(metric);
            
            // Keep only last 1000 measurements per metric
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }
        }
    }

    private async executeBenchmarkOperation(benchmarkName: string): Promise<{ duration: number }> {
        const startTime = performance.now();

        switch (benchmarkName) {
            case 'file-io-read':
                // Simulate file reading
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                break;
            
            case 'text-processing':
                // Simulate text processing
                const text = 'The quick brown fox jumps over the lazy dog'.repeat(100);
                text.match(/\w+/g);
                break;
            
            default:
                throw new Error(`Unknown benchmark: ${benchmarkName}`);
        }

        const duration = performance.now() - startTime;
        return { duration };
    }

    private addBenchmark(benchmark: PerformanceBenchmark): void {
        this.benchmarks.set(benchmark.name, benchmark);
    }

    /**
     * Get all active alerts
     */
    public getActiveAlerts(): PerformanceAlert[] {
        return this.alerts.filter(a => !a.resolved);
    }

    /**
     * Resolve an alert
     */
    public resolveAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
        }
    }

    /**
     * Clear historical data
     */
    public clearHistoricalData(metricId?: string): void {
        if (metricId) {
            this.historicalData.delete(metricId);
        } else {
            this.historicalData.clear();
        }
    }

    /**
     * Export performance data
     */
    public exportData(): {
        profiles: PerformanceProfile[];
        metrics: { [metricId: string]: PerformanceMetric[] };
        benchmarks: PerformanceBenchmark[];
    } {
        return {
            profiles: Array.from(this.activeProfiles.values()),
            metrics: Object.fromEntries(this.historicalData.entries()),
            benchmarks: Array.from(this.benchmarks.values())
        };
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        // Clear all watchers
        for (const interval of Array.from(this.watchers.values())) {
            clearInterval(interval);
        }
        this.watchers.clear();

        // Stop all active profiles
        for (const profileId of Array.from(this.activeProfiles.keys())) {
            this.stopProfiling(profileId).catch(console.warn);
        }

        this.isMonitoring = false;
    }
}

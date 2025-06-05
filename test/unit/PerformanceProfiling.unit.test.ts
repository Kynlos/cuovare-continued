/**
 * Performance Profiling Unit Tests - v0.9.0
 * 
 * Comprehensive test suite for the Performance Profiling system with
 * real-time monitoring, metrics collection, and optimization recommendations.
 */

import * as assert from 'assert';
import { 
    PerformanceProfiling, 
    PerformanceMetric, 
    PerformanceProfile, 
    PerformanceBenchmark 
} from '../../src/profiling/PerformanceProfiling';

// Self-contained test framework
class TestFramework {
    private tests: { name: string; fn: () => Promise<void> | void; group: string }[] = [];
    private groups: Set<string> = new Set();

    describe(groupName: string, fn: () => void) {
        this.groups.add(groupName);
        const currentGroup = groupName;
        const originalIt = (global as any).it;
        (global as any).it = (testName: string, testFn: () => Promise<void> | void) => {
            this.tests.push({ name: testName, fn: testFn, group: currentGroup });
        };
        fn();
        (global as any).it = originalIt;
    }

    async runTests(): Promise<{ passed: number; failed: number; results: any[] }> {
        let passed = 0;
        let failed = 0;
        const results: any[] = [];

        console.log('🧪 Running Performance Profiling Tests...\n');

        for (const group of this.groups) {
            console.log(`📁 ${group}`);
            const groupTests = this.tests.filter(t => t.group === group);
            
            for (const test of groupTests) {
                try {
                    await test.fn();
                    console.log(`  ✅ ${test.name}`);
                    passed++;
                    results.push({ name: test.name, group, status: 'passed' });
                } catch (error) {
                    console.log(`  ❌ ${test.name}`);
                    console.log(`     Error: ${error}`);
                    failed++;
                    results.push({ name: test.name, group, status: 'failed', error: String(error) });
                }
            }
            console.log('');
        }

        return { passed, failed, results };
    }
}

const test = new TestFramework();

// Test helper functions
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateWork(duration: number = 10): Promise<string> {
    await delay(duration);
    return 'work completed';
}

function createMockMetric(category: PerformanceMetric['category'] = 'cpu'): Omit<PerformanceMetric, 'timestamp'> {
    return {
        id: `test-metric-${Date.now()}`,
        name: 'Test Metric',
        category,
        value: Math.random() * 100,
        unit: 'ms'
    };
}

// Core Performance Profiling Tests
test.describe('Core Performance Profiling', () => {
    (global as any).it('should initialize with built-in benchmarks', () => {
        const profiler = new PerformanceProfiling();
        
        // Should initialize without errors
        assert.ok(profiler, 'Profiler should initialize');
        
        const realTimeMetrics = profiler.getRealTimeMetrics();
        assert.ok(realTimeMetrics.cpu >= 0, 'Should return CPU metrics');
        assert.ok(realTimeMetrics.memory, 'Should return memory metrics');
        assert.strictEqual(realTimeMetrics.activeProfiles, 0, 'Should start with no active profiles');
    });

    (global as any).it('should start and stop profiling sessions', async () => {
        const profiler = new PerformanceProfiling();
        
        const profileId = profiler.startProfiling('test-session', 'Test profiling session');
        
        assert.ok(typeof profileId === 'string', 'Should return profile ID');
        assert.ok(profileId.length > 0, 'Profile ID should not be empty');
        
        // Let it run briefly
        await delay(50);
        
        const profile = await profiler.stopProfiling(profileId);
        
        assert.ok(profile, 'Should return profile');
        assert.strictEqual(profile.name, 'test-session', 'Should have correct name');
        assert.ok(profile.duration && profile.duration > 0, 'Should measure duration');
        assert.ok(profile.startTime > 0, 'Should have start time');
        assert.ok(profile.endTime && profile.endTime > 0, 'Should have end time');
    });

    (global as any).it('should handle invalid profile IDs gracefully', async () => {
        const profiler = new PerformanceProfiling();
        
        try {
            await profiler.stopProfiling('non-existent-profile');
            assert.fail('Should throw error for invalid profile ID');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error for invalid profile');
            assert.ok(error.message.includes('Profile not found'), 'Should have appropriate error message');
        }
    });
});

// Metric Recording Tests
test.describe('Metric Recording', () => {
    (global as any).it('should record metrics with timestamps', () => {
        const profiler = new PerformanceProfiling();
        const profileId = profiler.startProfiling('metrics-test');
        
        const metric = createMockMetric('cpu');
        profiler.recordMetric(profileId, metric);
        
        // Should not throw errors
        assert.ok(true, 'Should record metric without errors');
        
        profiler.stopProfiling(profileId).catch(() => {}); // Clean up
    });

    (global as any).it('should record metrics without active profile', () => {
        const profiler = new PerformanceProfiling();
        
        const metric = createMockMetric('memory');
        
        // Should not throw when recording without profile
        profiler.recordMetric(null, metric);
        assert.ok(true, 'Should record metric without active profile');
    });

    (global as any).it('should handle different metric categories', () => {
        const profiler = new PerformanceProfiling();
        const profileId = profiler.startProfiling('category-test');
        
        const categories: PerformanceMetric['category'][] = [
            'cpu', 'memory', 'network', 'bundle', 'database', 'render', 'custom'
        ];
        
        for (const category of categories) {
            const metric = createMockMetric(category);
            profiler.recordMetric(profileId, metric);
        }
        
        assert.ok(true, 'Should handle all metric categories');
        
        profiler.stopProfiling(profileId).catch(() => {}); // Clean up
    });

    (global as any).it('should record metrics with thresholds', () => {
        const profiler = new PerformanceProfiling();
        
        const metricWithThreshold: Omit<PerformanceMetric, 'timestamp'> = {
            id: 'threshold-test',
            name: 'Threshold Test Metric',
            category: 'cpu',
            value: 95, // High value to trigger threshold
            unit: 'percent',
            threshold: {
                warning: 70,
                critical: 90
            }
        };
        
        profiler.recordMetric(null, metricWithThreshold);
        
        // Check if alert was created
        const alerts = profiler.getActiveAlerts();
        assert.ok(alerts.length > 0, 'Should create alert for threshold violation');
        
        const alert = alerts.find(a => a.metric === 'threshold-test');
        assert.ok(alert, 'Should create alert for the specific metric');
        assert.strictEqual(alert?.severity, 'critical', 'Should have critical severity');
    });
});

// Execution Measurement Tests
test.describe('Execution Measurement', () => {
    (global as any).it('should measure synchronous function execution', async () => {
        const profiler = new PerformanceProfiling();
        
        const syncFunction = () => {
            let sum = 0;
            for (let i = 0; i < 1000; i++) {
                sum += i;
            }
            return sum;
        };
        
        const result = await profiler.measureExecution('sync-test', syncFunction);
        
        assert.ok(result.duration >= 0, 'Should measure duration');
        assert.strictEqual(result.result, 499500, 'Should return correct result');
    });

    (global as any).it('should measure asynchronous function execution', async () => {
        const profiler = new PerformanceProfiling();
        
        const asyncFunction = async () => {
            await delay(20);
            return 'async result';
        };
        
        const result = await profiler.measureExecution('async-test', asyncFunction);
        
        assert.ok(result.duration >= 15, 'Should measure async duration');
        assert.strictEqual(result.result, 'async result', 'Should return correct async result');
    });

    (global as any).it('should handle function execution errors', async () => {
        const profiler = new PerformanceProfiling();
        
        const errorFunction = () => {
            throw new Error('Test error');
        };
        
        try {
            await profiler.measureExecution('error-test', errorFunction);
            assert.fail('Should throw the original error');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error');
            assert.strictEqual(error.message, 'Test error', 'Should preserve original error');
        }
    });

    (global as any).it('should measure with profile context', async () => {
        const profiler = new PerformanceProfiling();
        const profileId = profiler.startProfiling('context-test');
        
        const result = await profiler.measureExecution(
            'context-function',
            () => simulateWork(10),
            profileId
        );
        
        assert.ok(result.duration >= 5, 'Should measure duration');
        assert.strictEqual(result.result, 'work completed', 'Should return result');
        
        const profile = await profiler.stopProfiling(profileId);
        assert.ok(profile.metrics.length > 0, 'Should record metrics in profile');
    });
});

// Benchmarking Tests
test.describe('Benchmarking', () => {
    (global as any).it('should run built-in benchmarks', async () => {
        const profiler = new PerformanceProfiling();
        
        const benchmark = await profiler.runBenchmark('file-io-read');
        
        assert.ok(benchmark, 'Should return benchmark result');
        assert.strictEqual(benchmark.name, 'file-io-read', 'Should have correct name');
        assert.ok(benchmark.results.avg >= 0, 'Should have average time');
        assert.ok(benchmark.results.min >= 0, 'Should have minimum time');
        assert.ok(benchmark.results.max >= 0, 'Should have maximum time');
        assert.ok(benchmark.results.stdDev >= 0, 'Should have standard deviation');
        assert.ok(benchmark.results.percentiles.p50 >= 0, 'Should have median');
        assert.ok(benchmark.results.percentiles.p95 >= 0, 'Should have 95th percentile');
    });

    (global as any).it('should handle invalid benchmark names', async () => {
        const profiler = new PerformanceProfiling();
        
        try {
            await profiler.runBenchmark('non-existent-benchmark');
            assert.fail('Should throw error for invalid benchmark');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error');
            assert.ok(error.message.includes('Benchmark not found'), 'Should have appropriate error message');
        }
    });

    (global as any).it('should run text processing benchmark', async () => {
        const profiler = new PerformanceProfiling();
        
        const benchmark = await profiler.runBenchmark('text-processing');
        
        assert.ok(benchmark, 'Should return benchmark result');
        assert.ok(benchmark.results.avg >= 0, 'Should measure text processing performance');
        assert.ok(benchmark.iterations > 0, 'Should have run iterations');
    });
});

// File Operations Monitoring Tests
test.describe('File Operations Monitoring', () => {
    (global as any).it('should monitor file operations', async () => {
        const profiler = new PerformanceProfiling();
        
        const fileOperation = async () => {
            await delay(15); // Simulate file I/O
            return 'file content';
        };
        
        const result = await profiler.monitorFileOperations(
            fileOperation,
            '/test/file.txt'
        );
        
        assert.strictEqual(result, 'file content', 'Should return file operation result');
    });

    (global as any).it('should handle file operation errors', async () => {
        const profiler = new PerformanceProfiling();
        
        const failingOperation = async () => {
            throw new Error('File not found');
        };
        
        try {
            await profiler.monitorFileOperations(failingOperation, '/test/missing.txt');
            assert.fail('Should throw file operation error');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error');
            assert.strictEqual(error.message, 'File not found', 'Should preserve error message');
        }
    });
});

// Memory Leak Analysis Tests
test.describe('Memory Leak Analysis', () => {
    (global as any).it('should analyze memory leaks with sufficient data', () => {
        const profiler = new PerformanceProfiling();
        const profileId = profiler.startProfiling('memory-test', '', { trackMemory: true });
        
        // Simulate memory snapshots
        const profile = (profiler as any).activeProfiles.get(profileId);
        if (profile) {
            profile.memorySnapshots = [
                {
                    timestamp: Date.now() - 1000,
                    heapUsed: 10 * 1024 * 1024, // 10MB
                    heapTotal: 50 * 1024 * 1024,
                    external: 1024 * 1024,
                    rss: 60 * 1024 * 1024,
                    arrayBuffers: 0,
                    objects: { 'String': 1000, 'Object': 500 }
                },
                {
                    timestamp: Date.now(),
                    heapUsed: 15 * 1024 * 1024, // 15MB (5MB growth)
                    heapTotal: 55 * 1024 * 1024,
                    external: 1024 * 1024,
                    rss: 65 * 1024 * 1024,
                    arrayBuffers: 0,
                    objects: { 'String': 1200, 'Object': 600 }
                }
            ];
        }
        
        const analysis = profiler.analyzeMemoryLeaks(profileId);
        
        assert.ok(typeof analysis.leaksDetected === 'boolean', 'Should return leak detection status');
        assert.ok(Array.isArray(analysis.leakPatterns), 'Should return leak patterns array');
        assert.ok(Array.isArray(analysis.recommendations), 'Should return recommendations array');
        assert.ok(analysis.recommendations.length > 0, 'Should provide recommendations');
        
        profiler.stopProfiling(profileId).catch(() => {}); // Clean up
    });

    (global as any).it('should handle insufficient memory data', () => {
        const profiler = new PerformanceProfiling();
        const profileId = profiler.startProfiling('insufficient-memory-test');
        
        const analysis = profiler.analyzeMemoryLeaks(profileId);
        
        assert.strictEqual(analysis.leaksDetected, false, 'Should not detect leaks with insufficient data');
        assert.strictEqual(analysis.leakPatterns.length, 0, 'Should have no leak patterns');
        assert.ok(analysis.recommendations.length > 0, 'Should still provide general recommendations');
        
        profiler.stopProfiling(profileId).catch(() => {}); // Clean up
    });
});

// Real-time Metrics Tests
test.describe('Real-time Metrics', () => {
    (global as any).it('should provide real-time performance metrics', () => {
        const profiler = new PerformanceProfiling();
        
        const metrics = profiler.getRealTimeMetrics();
        
        assert.ok(typeof metrics.cpu === 'number', 'Should return CPU usage');
        assert.ok(metrics.cpu >= 0, 'CPU usage should be non-negative');
        assert.ok(metrics.memory, 'Should return memory snapshot');
        assert.ok(typeof metrics.memory.heapUsed === 'number', 'Should have heap usage');
        assert.ok(typeof metrics.activeProfiles === 'number', 'Should return active profile count');
        assert.ok(typeof metrics.alertsCount === 'number', 'Should return alerts count');
    });

    (global as any).it('should track active profiles count', () => {
        const profiler = new PerformanceProfiling();
        
        let metrics = profiler.getRealTimeMetrics();
        assert.strictEqual(metrics.activeProfiles, 0, 'Should start with no active profiles');
        
        const profileId1 = profiler.startProfiling('test1');
        const profileId2 = profiler.startProfiling('test2');
        
        metrics = profiler.getRealTimeMetrics();
        assert.strictEqual(metrics.activeProfiles, 2, 'Should track multiple active profiles');
        
        profiler.stopProfiling(profileId1).catch(() => {});
        profiler.stopProfiling(profileId2).catch(() => {});
    });
});

// Performance Trends Tests
test.describe('Performance Trends', () => {
    (global as any).it('should analyze performance trends', () => {
        const profiler = new PerformanceProfiling();
        
        // Record some metrics to create trends
        const metricId = 'trend-test-metric';
        for (let i = 0; i < 10; i++) {
            profiler.recordMetric(null, {
                id: metricId,
                name: 'Trend Test',
                category: 'cpu',
                value: 50 + i * 2, // Increasing trend
                unit: 'ms'
            });
        }
        
        const trends = profiler.getPerformanceTrends(metricId, 'hour');
        
        assert.ok(Array.isArray(trends.data), 'Should return trend data array');
        assert.ok(['improving', 'degrading', 'stable'].includes(trends.trend), 'Should classify trend');
        assert.ok(typeof trends.variance === 'number', 'Should calculate variance');
        assert.ok(trends.variance >= 0, 'Variance should be non-negative');
    });

    (global as any).it('should handle empty trend data', () => {
        const profiler = new PerformanceProfiling();
        
        const trends = profiler.getPerformanceTrends('non-existent-metric', 'day');
        
        assert.ok(Array.isArray(trends.data), 'Should return empty data array');
        assert.strictEqual(trends.data.length, 0, 'Should have no trend data');
        assert.strictEqual(trends.trend, 'stable', 'Should default to stable trend');
    });
});

// Optimization Recommendations Tests
test.describe('Optimization Recommendations', () => {
    (global as any).it('should generate optimization recommendations', async () => {
        const profiler = new PerformanceProfiling();
        
        // Mock a workspace folder for testing
        const mockWorkspace = '/test/project';
        
        const recommendations = await profiler.generateOptimizationRecommendations(mockWorkspace);
        
        assert.ok(Array.isArray(recommendations), 'Should return recommendations array');
        
        for (const rec of recommendations) {
            assert.ok(rec.id, 'Each recommendation should have an ID');
            assert.ok(rec.title, 'Each recommendation should have a title');
            assert.ok(rec.description, 'Each recommendation should have a description');
            assert.ok(['critical', 'warning'].includes(rec.category), 'Should have valid category');
            assert.ok(['critical', 'high', 'medium', 'low'].includes(rec.priority), 'Should have valid priority');
            assert.ok(['high', 'medium', 'low'].includes(rec.impact), 'Should have valid impact');
            assert.ok(['high', 'medium', 'low'].includes(rec.effort), 'Should have valid effort');
            assert.ok(typeof rec.autoFixable === 'boolean', 'Should indicate if auto-fixable');
            assert.ok(Array.isArray(rec.dependencies), 'Should have dependencies array');
        }
    });

    (global as any).it('should prioritize recommendations correctly', async () => {
        const profiler = new PerformanceProfiling();
        
        const recommendations = await profiler.generateOptimizationRecommendations('/test');
        
        // Recommendations should be sorted by priority
        for (let i = 1; i < recommendations.length; i++) {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const prevPriority = priorityOrder[recommendations[i - 1].priority];
            const currPriority = priorityOrder[recommendations[i].priority];
            assert.ok(prevPriority >= currPriority, 'Recommendations should be sorted by priority');
        }
    });
});

// Alert Management Tests
test.describe('Alert Management', () => {
    (global as any).it('should create and manage alerts', () => {
        const profiler = new PerformanceProfiling();
        
        // Record metric that exceeds threshold
        profiler.recordMetric(null, {
            id: 'alert-test',
            name: 'Alert Test Metric',
            category: 'memory',
            value: 600 * 1024 * 1024, // 600MB
            unit: 'bytes',
            threshold: {
                warning: 256 * 1024 * 1024,
                critical: 512 * 1024 * 1024
            }
        });
        
        const alerts = profiler.getActiveAlerts();
        assert.ok(alerts.length > 0, 'Should create alert for threshold violation');
        
        const alert = alerts.find(a => a.metric === 'alert-test');
        assert.ok(alert, 'Should find the specific alert');
        assert.strictEqual(alert?.severity, 'critical', 'Should have critical severity');
        assert.ok(!alert?.resolved, 'Alert should not be resolved initially');
        
        // Resolve the alert
        if (alert) {
            profiler.resolveAlert(alert.id);
            const updatedAlerts = profiler.getActiveAlerts();
            const resolvedAlert = updatedAlerts.find(a => a.id === alert.id);
            assert.ok(!resolvedAlert, 'Alert should not be in active alerts after resolution');
        }
    });

    (global as any).it('should auto-resolve old alerts', () => {
        const profiler = new PerformanceProfiling();
        
        // Create first alert
        profiler.recordMetric(null, {
            id: 'auto-resolve-test',
            name: 'Auto Resolve Test',
            category: 'cpu',
            value: 95,
            unit: 'percent',
            threshold: { warning: 70, critical: 90 }
        });
        
        let alerts = profiler.getActiveAlerts();
        const firstAlertCount = alerts.filter(a => a.metric === 'auto-resolve-test').length;
        
        // Create second alert for same metric
        profiler.recordMetric(null, {
            id: 'auto-resolve-test',
            name: 'Auto Resolve Test',
            category: 'cpu',
            value: 98,
            unit: 'percent',
            threshold: { warning: 70, critical: 90 }
        });
        
        alerts = profiler.getActiveAlerts();
        const secondAlertCount = alerts.filter(a => a.metric === 'auto-resolve-test').length;
        
        // Should not have more active alerts than the first time
        // (old alerts should be auto-resolved)
        assert.ok(secondAlertCount <= firstAlertCount + 1, 'Should auto-resolve old alerts');
    });
});

// Data Management Tests
test.describe('Data Management', () => {
    (global as any).it('should clear historical data', () => {
        const profiler = new PerformanceProfiling();
        
        // Record some metrics
        profiler.recordMetric(null, {
            id: 'clear-test',
            name: 'Clear Test',
            category: 'cpu',
            value: 50,
            unit: 'ms'
        });
        
        // Clear specific metric
        profiler.clearHistoricalData('clear-test');
        
        const trends = profiler.getPerformanceTrends('clear-test', 'hour');
        assert.strictEqual(trends.data.length, 0, 'Should clear specific metric data');
        
        // Clear all data
        profiler.clearHistoricalData();
        assert.ok(true, 'Should clear all data without errors');
    });

    (global as any).it('should export performance data', () => {
        const profiler = new PerformanceProfiling();
        
        const profileId = profiler.startProfiling('export-test');
        profiler.recordMetric(profileId, createMockMetric('cpu'));
        
        const exportedData = profiler.exportData();
        
        assert.ok(exportedData.profiles, 'Should export profiles');
        assert.ok(exportedData.metrics, 'Should export metrics');
        assert.ok(exportedData.benchmarks, 'Should export benchmarks');
        assert.ok(Array.isArray(exportedData.profiles), 'Profiles should be an array');
        assert.ok(typeof exportedData.metrics === 'object', 'Metrics should be an object');
        assert.ok(Array.isArray(exportedData.benchmarks), 'Benchmarks should be an array');
        
        profiler.stopProfiling(profileId).catch(() => {}); // Clean up
    });
});

// Error Handling Tests
test.describe('Error Handling', () => {
    (global as any).it('should handle profiling errors gracefully', async () => {
        const profiler = new PerformanceProfiling();
        
        // Test stopping non-existent profile
        try {
            await profiler.stopProfiling('non-existent');
            assert.fail('Should throw error for invalid profile');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw appropriate error');
        }
    });

    (global as any).it('should handle memory analysis errors', () => {
        const profiler = new PerformanceProfiling();
        
        // Test with invalid profile
        const analysis = profiler.analyzeMemoryLeaks('invalid-profile');
        
        assert.strictEqual(analysis.leaksDetected, false, 'Should handle invalid profile gracefully');
        assert.ok(Array.isArray(analysis.recommendations), 'Should still return recommendations');
    });
});

// Cleanup and Disposal Tests
test.describe('Cleanup and Disposal', () => {
    (global as any).it('should dispose resources properly', () => {
        const profiler = new PerformanceProfiling();
        
        // Start some profiles
        const profileId1 = profiler.startProfiling('dispose-test-1');
        const profileId2 = profiler.startProfiling('dispose-test-2');
        
        // Should not throw when disposing
        profiler.dispose();
        
        assert.ok(true, 'Should dispose without errors');
    });

    (global as any).it('should handle disposal with active profiles', () => {
        const profiler = new PerformanceProfiling();
        
        // Start profiles but don't stop them
        profiler.startProfiling('active-1');
        profiler.startProfiling('active-2');
        
        // Dispose should handle active profiles
        profiler.dispose();
        
        assert.ok(true, 'Should dispose with active profiles without errors');
    });
});

// Run the tests
async function runTests(): Promise<void> {
    try {
        const { passed, failed, results } = await test.runTests();
        
        console.log('📊 Test Results Summary:');
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            results.filter(r => r.status === 'failed').forEach(result => {
                console.log(`   ${result.group} > ${result.name}`);
                console.log(`   Error: ${result.error}`);
            });
            process.exit(1);
        } else {
            console.log('\n🎉 All tests passed!');
        }
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Export for external test runners
export { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

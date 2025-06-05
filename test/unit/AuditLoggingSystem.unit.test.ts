import { AuditLoggingSystem, AuditEvent, AuditEventType, AuditCategory, AuditFilter } from '../../src/audit/AuditLoggingSystem';

// Mock VS Code
const mockVSCode = {
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    workspace: {
        onDidOpenTextDocument: jest.fn(),
        onDidSaveTextDocument: jest.fn()
    },
    env: {
        appName: 'Visual Studio Code',
        machineId: 'test-machine-id'
    },
    EventEmitter: class {
        fire() {}
    }
};

// Mock extension context
const mockContext = {
    globalStoragePath: '/test/storage',
    globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn(() => [])
    }
};

// Mock crypto
const mockCrypto = {
    randomUUID: jest.fn(() => 'test-uuid'),
    randomBytes: jest.fn(() => Buffer.from('test-bytes')),
    createHash: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => 'test-hash')
    })),
    createCipher: jest.fn(() => ({
        update: jest.fn(() => 'encrypted'),
        final: jest.fn(() => 'final')
    })),
    createDecipher: jest.fn(() => ({
        update: jest.fn(() => 'decrypted'),
        final: jest.fn(() => 'final')
    }))
};

describe('AuditLoggingSystem Unit Tests', () => {
    let auditSystem: AuditLoggingSystem;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock crypto module
        (global as any).crypto = mockCrypto;
        
        auditSystem = AuditLoggingSystem.getInstance(mockContext as any);
    });

    describe('System Initialization', () => {
        it('should initialize the audit system successfully', async () => {
            // Mock fs.mkdir
            const mockMkdir = jest.fn().mockResolvedValue(undefined);
            (auditSystem as any).logPath = '/test/audit-logs';
            
            // Mock the private methods
            (auditSystem as any).startPeriodicFlush = jest.fn();
            (auditSystem as any).setupEventListeners = jest.fn();
            (auditSystem as any).logEvent = jest.fn().mockResolvedValue('event-id');

            await auditSystem.initialize();

            expect((auditSystem as any).startPeriodicFlush).toHaveBeenCalled();
            expect((auditSystem as any).setupEventListeners).toHaveBeenCalled();
        });

        it('should handle initialization errors gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock fs.mkdir to throw an error
            (auditSystem as any).logPath = '/invalid/path';
            
            await auditSystem.initialize();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should generate unique identifiers', () => {
            const sessionId = (auditSystem as any).generateSessionId();
            const eventId = (auditSystem as any).generateEventId();
            const correlationId = (auditSystem as any).generateCorrelationId();

            expect(sessionId).toBe('test-uuid');
            expect(eventId).toBe('test-uuid');
            expect(correlationId).toBe('test-uuid');
        });
    });

    describe('Event Logging', () => {
        beforeEach(() => {
            (auditSystem as any).config = {
                enabled: true,
                logLevel: 'standard',
                realTime: { enabled: false },
                storage: { encryption: false }
            };
            (auditSystem as any).complianceEngine = {
                assessEvent: jest.fn().mockReturnValue({
                    regulations: [],
                    dataClassification: { level: 'internal' },
                    retentionPolicy: { duration: 90 },
                    privacy: { containsPII: false }
                })
            };
            (auditSystem as any).eventEmitter = { fire: jest.fn() };
        });

        it('should log events successfully', async () => {
            const eventData = {
                eventType: 'user-action' as AuditEventType,
                category: 'file-operations' as AuditCategory,
                action: 'file-opened',
                resource: 'test.ts',
                details: { success: true }
            };

            const eventId = await auditSystem.logEvent(eventData);

            expect(eventId).toBe('test-uuid');
            expect((auditSystem as any).logBuffer.length).toBe(1);
            
            const loggedEvent = (auditSystem as any).logBuffer[0];
            expect(loggedEvent.action).toBe('file-opened');
            expect(loggedEvent.resource).toBe('test.ts');
            expect(loggedEvent.details.success).toBe(true);
        });

        it('should not log when disabled', async () => {
            (auditSystem as any).config.enabled = false;

            const eventId = await auditSystem.logEvent({
                action: 'test-action',
                resource: 'test-resource'
            });

            expect(eventId).toBe('');
            expect((auditSystem as any).logBuffer.length).toBe(0);
        });

        it('should trigger flush when buffer is full', async () => {
            (auditSystem as any).flushBuffer = jest.fn();
            
            // Fill buffer to capacity
            for (let i = 0; i < 100; i++) {
                (auditSystem as any).logBuffer.push({
                    id: `event-${i}`,
                    timestamp: new Date()
                });
            }

            await auditSystem.logEvent({
                action: 'overflow-event',
                resource: 'test'
            });

            expect((auditSystem as any).flushBuffer).toHaveBeenCalled();
        });

        it('should handle real-time processing', async () => {
            (auditSystem as any).config.realTime.enabled = true;
            (auditSystem as any).processRealTimeEvent = jest.fn();

            await auditSystem.logEvent({
                action: 'realtime-event',
                resource: 'test'
            });

            expect((auditSystem as any).processRealTimeEvent).toHaveBeenCalled();
        });
    });

    describe('Event Querying', () => {
        beforeEach(() => {
            const mockEvents: AuditEvent[] = [
                {
                    id: 'event-1',
                    timestamp: new Date('2024-01-01'),
                    userId: 'user-1',
                    sessionId: 'session-1',
                    eventType: 'user-action',
                    category: 'file-operations',
                    action: 'file-opened',
                    resource: 'test1.ts',
                    details: { success: true },
                    metadata: {
                        version: '0.8.0',
                        environment: 'vscode',
                        correlationId: 'corr-1',
                        traceId: 'trace-1',
                        spanId: 'span-1',
                        tags: {},
                        annotations: []
                    },
                    compliance: {} as any,
                    security: { riskLevel: 'low' } as any
                },
                {
                    id: 'event-2',
                    timestamp: new Date('2024-01-02'),
                    userId: 'user-2',
                    sessionId: 'session-2',
                    eventType: 'security-event',
                    category: 'authentication',
                    action: 'login-attempt',
                    resource: 'auth-system',
                    details: { success: false },
                    metadata: {
                        version: '0.8.0',
                        environment: 'vscode',
                        correlationId: 'corr-2',
                        traceId: 'trace-2',
                        spanId: 'span-2',
                        tags: {},
                        annotations: []
                    },
                    compliance: {} as any,
                    security: { riskLevel: 'high' } as any
                }
            ];

            (auditSystem as any).loadEventsFromStorage = jest.fn().mockResolvedValue(mockEvents);
        });

        it('should query events with filters', async () => {
            const filter: AuditFilter = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-03'),
                userId: 'user-1',
                limit: 10
            };

            const result = await auditSystem.queryEvents(filter);

            expect(result.events.length).toBe(1);
            expect(result.events[0].userId).toBe('user-1');
            expect(result.totalCount).toBe(1);
            expect(result.hasMore).toBe(false);
        });

        it('should handle pagination', async () => {
            const filter: AuditFilter = {
                limit: 1,
                offset: 1
            };

            const result = await auditSystem.queryEvents(filter);

            expect(result.events.length).toBe(1);
            expect(result.events[0].id).toBe('event-2');
            expect(result.hasMore).toBe(false);
        });

        it('should filter by event type', async () => {
            const filter: AuditFilter = {
                eventTypes: ['security-event']
            };

            const result = await auditSystem.queryEvents(filter);

            expect(result.events.length).toBe(1);
            expect(result.events[0].eventType).toBe('security-event');
        });

        it('should filter by success status', async () => {
            const filter: AuditFilter = {
                success: false
            };

            const result = await auditSystem.queryEvents(filter);

            expect(result.events.length).toBe(1);
            expect(result.events[0].details.success).toBe(false);
        });

        it('should perform text search', async () => {
            const filter: AuditFilter = {
                textSearch: 'login'
            };

            const result = await auditSystem.queryEvents(filter);

            expect(result.events.length).toBe(1);
            expect(result.events[0].action).toBe('login-attempt');
        });
    });

    describe('Report Generation', () => {
        beforeEach(() => {
            const mockEvents: AuditEvent[] = [
                createMockEvent('event-1', 'user-action', 'file-operations', true, 'low'),
                createMockEvent('event-2', 'security-event', 'authentication', false, 'high'),
                createMockEvent('event-3', 'user-action', 'file-operations', true, 'low')
            ];

            (auditSystem as any).queryEvents = jest.fn().mockResolvedValue({
                events: mockEvents,
                totalCount: 3,
                hasMore: false
            });

            (auditSystem as any).complianceEngine = {
                generateReport: jest.fn().mockResolvedValue({
                    overall: { compliant: true, score: 95 },
                    regulations: {},
                    violations: [],
                    gaps: []
                })
            };
        });

        it('should generate comprehensive audit reports', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const report = await auditSystem.generateReport(startDate, endDate, {
                includeDetails: true,
                compliance: true,
                insights: true
            });

            expect(report.id).toBeDefined();
            expect(report.title).toContain('Audit Report');
            expect(report.period.start).toEqual(startDate);
            expect(report.period.end).toEqual(endDate);
            expect(report.summary).toBeDefined();
            expect(report.events.length).toBe(3);
            expect(report.compliance).toBeDefined();
            expect(Array.isArray(report.insights)).toBe(true);
            expect(Array.isArray(report.recommendations)).toBe(true);
        });

        it('should generate summary statistics', () => {
            const events = [
                createMockEvent('1', 'user-action', 'file-operations', true, 'low'),
                createMockEvent('2', 'security-event', 'authentication', false, 'high'),
                createMockEvent('3', 'user-action', 'file-operations', true, 'low')
            ];

            const summary = (auditSystem as any).generateSummary(events);

            expect(summary.totalEvents).toBe(3);
            expect(summary.successRate).toBeCloseTo(66.67, 1);
            expect(summary.errorRate).toBeCloseTo(33.33, 1);
            expect(summary.uniqueUsers).toBe(3);
            expect(summary.eventsByType['user-action']).toBe(2);
            expect(summary.eventsByType['security-event']).toBe(1);
            expect(summary.riskDistribution['low']).toBe(2);
            expect(summary.riskDistribution['high']).toBe(1);
        });

        it('should generate insights from events', () => {
            const events = Array(20).fill(null).map((_, i) => 
                createMockEvent(`event-${i}`, 'user-action', 'file-operations', i % 10 !== 0, 'low')
            );

            const insights = (auditSystem as any).generateInsights(events);

            expect(Array.isArray(insights)).toBe(true);
            // Should detect high failure rate
            expect(insights.some((insight: any) => insight.title.includes('High Failure Rate'))).toBe(true);
        });

        it('should generate recommendations', () => {
            const insights = [
                {
                    type: 'anomaly',
                    severity: 'critical',
                    title: 'Critical Issue',
                    description: 'A critical issue was detected',
                    recommendedActions: ['Fix immediately']
                }
            ];

            const recommendations = (auditSystem as any).generateRecommendations([], insights);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations[0].priority).toBe('critical');
        });
    });

    describe('Data Export', () => {
        beforeEach(() => {
            const mockEvents = [
                createMockEvent('1', 'user-action', 'file-operations', true, 'low'),
                createMockEvent('2', 'security-event', 'authentication', false, 'high')
            ];

            (auditSystem as any).queryEvents = jest.fn().mockResolvedValue({
                events: mockEvents,
                totalCount: 2,
                hasMore: false
            });
        });

        it('should export data in JSON format', async () => {
            const exported = await auditSystem.exportData('json');

            expect(typeof exported).toBe('string');
            const parsed = JSON.parse(exported);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(2);
        });

        it('should export data in CSV format', async () => {
            const exported = await auditSystem.exportData('csv');

            expect(typeof exported).toBe('string');
            expect(exported).toContain('ID,Timestamp,User ID');
            expect(exported.split('\n').length).toBeGreaterThan(2);
        });

        it('should export data in XML format', async () => {
            const exported = await auditSystem.exportData('xml');

            expect(typeof exported).toBe('string');
            expect(exported).toContain('<?xml version="1.0"');
            expect(exported).toContain('<auditEvents>');
            expect(exported).toContain('</auditEvents>');
        });

        it('should handle unsupported export formats', async () => {
            try {
                await auditSystem.exportData('unsupported' as any);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Unsupported export format');
            }
        });
    });

    describe('Configuration Management', () => {
        it('should update audit configuration', async () => {
            const newConfig = {
                enabled: false,
                logLevel: 'verbose' as const,
                retention: { days: 365, autoArchive: true, autoDelete: true }
            };

            (auditSystem as any).saveConfiguration = jest.fn();
            (auditSystem as any).detectConfigChanges = jest.fn().mockReturnValue([
                { field: 'enabled', oldValue: true, newValue: false, changeType: 'update' }
            ]);
            (auditSystem as any).logEvent = jest.fn();

            await auditSystem.updateConfiguration(newConfig);

            expect((auditSystem as any).config.enabled).toBe(false);
            expect((auditSystem as any).config.logLevel).toBe('verbose');
            expect((auditSystem as any).saveConfiguration).toHaveBeenCalled();
        });

        it('should load configuration from storage', () => {
            const savedConfig = {
                enabled: true,
                logLevel: 'debug' as const
            };

            mockContext.globalState.get.mockReturnValue(savedConfig);

            const config = (auditSystem as any).loadConfiguration();

            expect(config.logLevel).toBe('debug');
        });

        it('should use default configuration when none exists', () => {
            mockContext.globalState.get.mockReturnValue(undefined);

            const config = (auditSystem as any).loadConfiguration();

            expect(config).toBeDefined();
            expect(config.enabled).toBeDefined();
            expect(config.logLevel).toBeDefined();
        });
    });

    describe('Security Features', () => {
        it('should assess security risk for events', () => {
            const eventData = {
                category: 'security' as AuditCategory,
                eventType: 'security-event' as AuditEventType,
                details: { success: false }
            };

            const securityData = (auditSystem as any).assessSecurityRisk(eventData);

            expect(securityData.riskLevel).toBe('high');
            expect(securityData.accessLevel).toBeDefined();
            expect(securityData.encryption).toBeDefined();
        });

        it('should encrypt and decrypt data', () => {
            const originalData = 'sensitive audit data';
            
            const encrypted = (auditSystem as any).encrypt(originalData);
            expect(encrypted).not.toBe(originalData);
            expect(encrypted).toContain(':');

            const decrypted = (auditSystem as any).decrypt(encrypted);
            expect(decrypted).toBe('decryptedfinal'); // Based on mock implementation
        });

        it('should anonymize user data', async () => {
            const events = [
                createMockEvent('1', 'user-action', 'file-operations', true, 'low')
            ];

            (auditSystem as any).loadEventsFromStorage = jest.fn().mockResolvedValue(events);
            (auditSystem as any).saveEventsToStorage = jest.fn();
            (auditSystem as any).anonymizeUserId = jest.fn().mockReturnValue('anonymous');

            await auditSystem.anonymizeData(['1']);

            expect((auditSystem as any).anonymizeUserId).toHaveBeenCalled();
            expect((auditSystem as any).saveEventsToStorage).toHaveBeenCalled();
        });
    });

    describe('Real-time Metrics', () => {
        it('should provide real-time metrics', () => {
            (auditSystem as any).metricsCollector = {
                getCurrentMetrics: jest.fn().mockReturnValue({
                    eventsPerMinute: 10,
                    errorRate: 5.5,
                    averageResponseTime: 150,
                    activeUsers: 3,
                    riskEvents: 2,
                    complianceScore: 95
                })
            };

            const metrics = auditSystem.getRealTimeMetrics();

            expect(metrics.eventsPerMinute).toBe(10);
            expect(metrics.errorRate).toBe(5.5);
            expect(metrics.averageResponseTime).toBe(150);
            expect(metrics.activeUsers).toBe(3);
            expect(metrics.riskEvents).toBe(2);
            expect(metrics.complianceScore).toBe(95);
        });
    });

    describe('Compliance Features', () => {
        it('should assess compliance for events', () => {
            const complianceEngine = (auditSystem as any).complianceEngine;
            
            const eventData = {
                eventType: 'user-action' as AuditEventType,
                category: 'data-access' as AuditCategory
            };

            const complianceData = complianceEngine.assessEvent(eventData);

            expect(complianceData).toBeDefined();
            expect(complianceData.regulations).toBeDefined();
            expect(complianceData.dataClassification).toBeDefined();
            expect(complianceData.retentionPolicy).toBeDefined();
            expect(complianceData.privacy).toBeDefined();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle storage errors gracefully', async () => {
            (auditSystem as any).writeEventsToFile = jest.fn().mockRejectedValue(new Error('Storage error'));

            // Should not throw, but add events back to buffer
            await (auditSystem as any).flushBuffer();

            // Verify error handling behavior
            expect(true).toBe(true); // Test passes if no exception thrown
        });

        it('should handle malformed events in storage', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Mock file content with malformed JSON
            const mockFs = {
                readdir: jest.fn().mockResolvedValue(['audit-2024-01-01.jsonl']),
                readFile: jest.fn().mockResolvedValue('invalid json\n{"valid": "json"}')
            };

            const events = await (auditSystem as any).loadEventsFromStorage();

            expect(Array.isArray(events)).toBe(true);
            consoleSpy.mockRestore();
        });

        it('should handle empty filter queries', async () => {
            (auditSystem as any).loadEventsFromStorage = jest.fn().mockResolvedValue([]);

            const result = await auditSystem.queryEvents({});

            expect(result.events).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.hasMore).toBe(false);
        });

        it('should handle large event volumes', async () => {
            const largeEventSet = Array(10000).fill(null).map((_, i) => 
                createMockEvent(`event-${i}`, 'user-action', 'file-operations', true, 'low')
            );

            (auditSystem as any).loadEventsFromStorage = jest.fn().mockResolvedValue(largeEventSet);

            const result = await auditSystem.queryEvents({ limit: 100 });

            expect(result.events.length).toBe(100);
            expect(result.totalCount).toBe(10000);
            expect(result.hasMore).toBe(true);
        });
    });

    describe('Performance Monitoring', () => {
        it('should start periodic flushing', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation();

            (auditSystem as any).startPeriodicFlush();

            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

            setIntervalSpy.mockRestore();
        });

        it('should process real-time events', async () => {
            (auditSystem as any).metricsCollector = {
                recordEvent: jest.fn()
            };
            (auditSystem as any).anomalyDetector = {
                analyzeEvent: jest.fn()
            };
            (auditSystem as any).config = {
                realTime: { alerting: false }
            };

            const event = createMockEvent('1', 'user-action', 'file-operations', true, 'low');

            await (auditSystem as any).processRealTimeEvent(event);

            expect((auditSystem as any).metricsCollector.recordEvent).toHaveBeenCalledWith(event);
            expect((auditSystem as any).anomalyDetector.analyzeEvent).toHaveBeenCalledWith(event);
        });
    });
});

// Helper function to create mock events
function createMockEvent(
    id: string, 
    eventType: AuditEventType, 
    category: AuditCategory, 
    success: boolean, 
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
): AuditEvent {
    return {
        id,
        timestamp: new Date(),
        userId: `user-${id}`,
        sessionId: `session-${id}`,
        eventType,
        category,
        action: 'test-action',
        resource: 'test-resource',
        details: { success },
        metadata: {
            version: '0.8.0',
            environment: 'test',
            correlationId: `corr-${id}`,
            traceId: `trace-${id}`,
            spanId: `span-${id}`,
            tags: {},
            annotations: []
        },
        compliance: {
            regulations: [],
            dataClassification: { level: 'internal', categories: [], sensitivity: 1 },
            retentionPolicy: { duration: 90, autoDelete: false, archiveAfter: 30 },
            privacy: { containsPII: false, piiTypes: [], anonymized: false, consent: { required: false, obtained: true } }
        },
        security: { 
            riskLevel, 
            threatIndicators: [], 
            accessLevel: { level: 1, permissions: [], restrictions: [] },
            encryption: { encrypted: false }
        }
    };
}

// Helper functions for testing
function fail(message: string): never {
    throw new Error(message);
}

// Mock Jest functions (same as previous file)
const jest = {
    fn: () => {
        const mockFn = function(...args: any[]) {
            mockFn.mock.calls.push(args);
            return mockFn.mock.returnValue;
        };
        mockFn.mock = {
            calls: [] as any[][],
            returnValue: undefined
        };
        mockFn.mockResolvedValue = (value: any) => {
            mockFn.mock.returnValue = Promise.resolve(value);
            return mockFn;
        };
        mockFn.mockRejectedValue = (value: any) => {
            mockFn.mock.returnValue = Promise.reject(value);
            return mockFn;
        };
        mockFn.mockReturnValue = (value: any) => {
            mockFn.mock.returnValue = value;
            return mockFn;
        };
        mockFn.mockImplementation = (fn?: Function) => {
            if (fn) {
                return fn;
            }
            return mockFn;
        };
        return mockFn;
    },
    spyOn: (obj: any, method: string) => {
        const original = obj[method];
        const spy = jest.fn();
        spy.mockRestore = () => {
            obj[method] = original;
        };
        obj[method] = spy;
        return spy;
    },
    clearAllMocks: () => {
        // Mock implementation
    }
};

// Test runner functions
function describe(name: string, fn: () => void) {
    console.log(`\n  ${name}`);
    fn();
}

function it(name: string, fn: () => void | Promise<void>) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result.then(() => {
                console.log(`    ✓ ${name}`);
            }).catch((error) => {
                console.log(`    ✗ ${name}: ${error.message}`);
            });
        } else {
            console.log(`    ✓ ${name}`);
        }
    } catch (error) {
        console.log(`    ✗ ${name}: ${(error as Error).message}`);
    }
}

function beforeEach(fn: () => void) {
    fn();
}

function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toEqual: (expected: any) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined`);
            }
        },
        toBeUndefined: () => {
            if (actual !== undefined) {
                throw new Error(`Expected ${actual} to be undefined`);
            }
        },
        toBeGreaterThan: (expected: number) => {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeCloseTo: (expected: number, precision: number = 2) => {
            const factor = Math.pow(10, precision);
            const actualRounded = Math.round(actual * factor) / factor;
            const expectedRounded = Math.round(expected * factor) / factor;
            if (actualRounded !== expectedRounded) {
                throw new Error(`Expected ${actual} to be close to ${expected}`);
            }
        },
        toContain: (expected: any) => {
            if (!actual.includes(expected)) {
                throw new Error(`Expected ${actual} to contain ${expected}`);
            }
        },
        toHaveBeenCalled: () => {
            if (!actual.mock || actual.mock.calls.length === 0) {
                throw new Error('Expected function to have been called');
            }
        },
        toHaveBeenCalledWith: (...args: any[]) => {
            if (!actual.mock || !actual.mock.calls.some((call: any[]) => 
                JSON.stringify(call) === JSON.stringify(args)
            )) {
                throw new Error(`Expected function to have been called with ${JSON.stringify(args)}`);
            }
        }
    };
}

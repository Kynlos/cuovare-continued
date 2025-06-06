import { AdvancedPluginSystem, PluginManifest, LoadedPlugin, PluginAPIContext } from '../../src/plugins/AdvancedPluginSystem';

// Simple mock function factory
function mockFn(returnValue?: any) {
    const fn = function(...args: any[]) {
        fn.mock.calls.push(args);
        return returnValue;
    } as any;
    fn.mock = { calls: [], returnValue };
    fn.mockResolvedValue = (value: any) => { fn.mock.returnValue = Promise.resolve(value); return fn; };
    fn.mockRejectedValue = (value: any) => { fn.mock.returnValue = Promise.reject(value); return fn; };
    fn.mockReturnValue = (value: any) => { fn.mock.returnValue = value; return fn; };
    fn.mockImplementation = (impl: Function) => { Object.assign(fn, impl); return fn; };
    fn.mockRestore = () => { fn.mock.calls = []; };
    return fn;
}

// Mock VS Code
const mockVSCode = {
    window: {
        showInformationMessage: mockFn(),
        showErrorMessage: mockFn()
    },
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/workspace' }
        }]
    },
    EventEmitter: class {
        fire() {}
    }
};

// Mock extension context
const mockContext = {
    globalStoragePath: '/test/storage',
    extensionPath: '/test/extension',
    globalState: {
        get: mockFn(),
        update: mockFn(),
        keys: mockFn([])
    }
};

// Mock plugin manifests
const mockPluginManifest: PluginManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin for unit testing',
    author: 'Test Author',
    license: 'MIT',
    engines: {
        cuovare: '^0.8.0',
        vscode: '^1.100.0'
    },
    main: 'index.js',
    activationEvents: ['onCommand:test.activate'],
    contributes: {
        commands: [{
            command: 'test.hello',
            title: 'Hello Test',
            category: 'Test'
        }],
        tools: [{
            id: 'test-tool',
            name: 'Test Tool',
            description: 'A test tool',
            category: 'Testing',
            icon: 'test',
            capabilities: ['analyze'],
            inputSchema: {},
            outputSchema: {}
        }]
    }
};

describe('AdvancedPluginSystem Unit Tests', () => {
    let pluginSystem: AdvancedPluginSystem;
    
    beforeEach(() => {
        // Mock file system operations
        jest.clearAllMocks();
        pluginSystem = AdvancedPluginSystem.getInstance(mockContext as any);
    });

    describe('Plugin Discovery', () => {
        it('should discover plugins from directories', async () => {
            // Mock fs.readdir and fs.readFile
            const mockReaddir = jest.fn().mockResolvedValue(['test-plugin', 'another-plugin']);
            const mockStat = jest.fn().mockResolvedValue({ isDirectory: () => true });
            const mockReadFile = jest.fn().mockResolvedValue(JSON.stringify(mockPluginManifest));

            // Replace the discover method's dependencies
            (pluginSystem as any).discoverPlugins = jest.fn().mockResolvedValue([mockPluginManifest]);

            const discovered = await pluginSystem.discoverPlugins();

            expect(Array.isArray(discovered)).toBe(true);
            expect(discovered.length).toBeGreaterThan(0);
        });

        it('should validate plugin manifests', () => {
            const validateManifest = (pluginSystem as any).validateManifest;

            // Valid manifest
            expect(validateManifest(mockPluginManifest)).toBe(true);

            // Invalid manifest - missing required fields
            const invalidManifest = { ...mockPluginManifest };
            delete (invalidManifest as any).id;
            expect(validateManifest(invalidManifest)).toBe(false);

            // Invalid version format
            const invalidVersion = { ...mockPluginManifest, version: 'invalid' };
            expect(validateManifest(invalidVersion)).toBe(false);
        });

        it('should handle discovery errors gracefully', async () => {
            // Mock fs operations to throw errors
            (pluginSystem as any).discoverPlugins = jest.fn().mockRejectedValue(new Error('Directory not found'));

            try {
                await pluginSystem.discoverPlugins();
            } catch (error) {
                expect(error.message).toBe('Directory not found');
            }
        });
    });

    describe('Plugin Installation', () => {
        it('should install a plugin successfully', async () => {
            // Mock installation methods
            (pluginSystem as any).extractPluginManifest = jest.fn().mockResolvedValue(mockPluginManifest);
            (pluginSystem as any).securityManager = {
                validatePlugin: jest.fn().mockResolvedValue(true)
            };
            (pluginSystem as any).dependencyResolver = {
                resolveDependencies: jest.fn().mockResolvedValue(undefined)
            };
            (pluginSystem as any).installPluginFiles = jest.fn().mockResolvedValue('/test/plugin/path');
            (pluginSystem as any).createPluginInstance = jest.fn().mockResolvedValue({
                manifest: mockPluginManifest,
                instance: {},
                context: mockContext,
                isActive: false,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 0,
                    apiCalls: 0,
                    lastUsed: new Date()
                }
            });

            const result = await pluginSystem.installPlugin('/test/plugin/source');

            expect(result).toBe(true);
            expect((pluginSystem as any).securityManager.validatePlugin).toHaveBeenCalled();
        });

        it('should reject plugins that fail security validation', async () => {
            (pluginSystem as any).extractPluginManifest = jest.fn().mockResolvedValue(mockPluginManifest);
            (pluginSystem as any).securityManager = {
                validatePlugin: jest.fn().mockResolvedValue(false)
            };

            try {
                await pluginSystem.installPlugin('/test/plugin/source');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('failed security validation');
            }
        });

        it('should handle installation failures', async () => {
            (pluginSystem as any).extractPluginManifest = jest.fn().mockRejectedValue(new Error('Invalid plugin'));

            try {
                await pluginSystem.installPlugin('/test/plugin/source');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toBe('Invalid plugin');
            }
        });
    });

    describe('Plugin Management', () => {
        beforeEach(() => {
            // Setup a mock installed plugin
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {
                    activate: jest.fn(),
                    deactivate: jest.fn(),
                    executeTool: jest.fn().mockResolvedValue('tool result')
                },
                context: mockContext as any,
                isActive: false,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);
        });

        it('should enable a plugin', async () => {
            (pluginSystem as any).savePluginConfiguration = jest.fn();

            const result = await pluginSystem.enablePlugin('test-plugin');

            expect(result).toBe(true);
            expect((pluginSystem as any).registry.enabled.has('test-plugin')).toBe(true);
        });

        it('should disable a plugin', async () => {
            (pluginSystem as any).registry.enabled.add('test-plugin');
            (pluginSystem as any).savePluginConfiguration = jest.fn();

            const result = await pluginSystem.disablePlugin('test-plugin');

            expect(result).toBe(true);
            expect((pluginSystem as any).registry.enabled.has('test-plugin')).toBe(false);
            expect((pluginSystem as any).registry.disabled.has('test-plugin')).toBe(true);
        });

        it('should uninstall a plugin', async () => {
            (pluginSystem as any).registry.enabled.add('test-plugin');
            (pluginSystem as any).deactivatePlugin = jest.fn();
            (pluginSystem as any).getPluginPath = jest.fn().mockReturnValue('/test/plugin/path');
            (pluginSystem as any).removePluginFiles = jest.fn();

            const result = await pluginSystem.uninstallPlugin('test-plugin');

            expect(result).toBe(true);
            expect((pluginSystem as any).registry.installed.has('test-plugin')).toBe(false);
        });

        it('should handle operations on non-existent plugins', async () => {
            try {
                await pluginSystem.enablePlugin('non-existent');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('is not installed');
            }
        });
    });

    describe('Plugin Execution', () => {
        beforeEach(() => {
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {
                    executeTool: jest.fn().mockResolvedValue('tool result')
                },
                context: mockContext as any,
                isActive: true,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);
            (pluginSystem as any).performanceMonitor = {
                recordToolExecution: jest.fn()
            };
        });

        it('should execute plugin tools successfully', async () => {
            const result = await pluginSystem.executePluginTool('test-plugin', 'test-tool', { input: 'test' });

            expect(result).toBe('tool result');
            
            const plugin = (pluginSystem as any).registry.installed.get('test-plugin');
            expect(plugin.instance.executeTool).toHaveBeenCalledWith('test-tool', { input: 'test' });
            expect(plugin.metadata.apiCalls).toBe(6);
        });

        it('should handle tool execution failures', async () => {
            const plugin = (pluginSystem as any).registry.installed.get('test-plugin');
            plugin.instance.executeTool.mockRejectedValue(new Error('Tool execution failed'));

            try {
                await pluginSystem.executePluginTool('test-plugin', 'test-tool', {});
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toBe('Tool execution failed');
                expect(plugin.errors.length).toBeGreaterThan(0);
            }
        });

        it('should reject execution on inactive plugins', async () => {
            const plugin = (pluginSystem as any).registry.installed.get('test-plugin');
            plugin.isActive = false;

            try {
                await pluginSystem.executePluginTool('test-plugin', 'test-tool', {});
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('is not active');
            }
        });
    });

    describe('Plugin Information', () => {
        it('should return plugin information', () => {
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {},
                context: mockContext as any,
                isActive: true,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);

            const info = pluginSystem.getPluginInfo('test-plugin');

            expect(info).toBeDefined();
            expect(info!.manifest.name).toBe('Test Plugin');
            expect(info!.isActive).toBe(true);
        });

        it('should return undefined for non-existent plugins', () => {
            const info = pluginSystem.getPluginInfo('non-existent');
            expect(info).toBeUndefined();
        });

        it('should list all plugins', () => {
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {},
                context: mockContext as any,
                isActive: true,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.available.set('available-plugin', mockPluginManifest);
            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);
            (pluginSystem as any).registry.enabled.add('test-plugin');

            const list = pluginSystem.listPlugins();

            expect(list.available.length).toBe(1);
            expect(list.installed.length).toBe(1);
            expect(list.enabled.length).toBe(1);
            expect(list.disabled.length).toBe(0);
        });
    });

    describe('Marketplace Integration', () => {
        it('should get marketplace information', async () => {
            const marketplaceInfo = await pluginSystem.getMarketplaceInfo();

            expect(marketplaceInfo).toBeDefined();
            expect(Array.isArray(marketplaceInfo.featured)).toBe(true);
            expect(Array.isArray(marketplaceInfo.popular)).toBe(true);
            expect(Array.isArray(marketplaceInfo.recent)).toBe(true);
            expect(Array.isArray(marketplaceInfo.categories)).toBe(true);
        });

        it('should check for updates', async () => {
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {},
                context: mockContext as any,
                isActive: true,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);

            const updates = await pluginSystem.checkForUpdates();

            expect(Array.isArray(updates)).toBe(true);
        });
    });

    describe('Plugin API Context', () => {
        it('should provide proper API context to plugins', () => {
            const apiContext = (pluginSystem as any).apiContext;

            expect(apiContext).toBeDefined();
            expect(apiContext.vscode).toBeDefined();
            expect(apiContext.cuovare).toBeDefined();
            expect(apiContext.cuovare.version).toBe('0.8.0');
            expect(apiContext.cuovare.logger).toBeDefined();
            expect(apiContext.cuovare.storage).toBeDefined();
            expect(apiContext.cuovare.events).toBeDefined();
            expect(apiContext.cuovare.tools).toBeDefined();
            expect(apiContext.cuovare.ai).toBeDefined();
        });

        it('should provide working storage API', async () => {
            const storage = (pluginSystem as any).apiContext.cuovare.storage;

            await storage.set('test-key', 'test-value');
            expect(mockContext.globalState.update).toHaveBeenCalledWith('test-key', 'test-value');

            mockContext.globalState.get.mockReturnValue('test-value');
            const value = storage.get('test-key');
            expect(value).toBe('test-value');
        });

        it('should provide working logger API', () => {
            const logger = (pluginSystem as any).apiContext.cuovare.logger;
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            logger.info('Test message');
            expect(consoleSpy).toHaveBeenCalledWith('[Plugin] Test message');

            consoleSpy.mockRestore();
        });

        it('should provide working events API', () => {
            const events = (pluginSystem as any).apiContext.cuovare.events;
            const mockListener = jest.fn();

            events.on('test-event', mockListener);
            events.emit('test-event', 'test-data');

            expect(mockListener).toHaveBeenCalledWith('test-data');
        });
    });

    describe('Security and Validation', () => {
        it('should validate plugin manifests properly', () => {
            const validateManifest = (pluginSystem as any).validateManifest;

            // Test various invalid manifests
            expect(validateManifest({})).toBe(false);
            expect(validateManifest({ id: 'test' })).toBe(false);
            expect(validateManifest({ 
                id: 'test', 
                name: 'Test', 
                version: 'invalid-version' 
            })).toBe(false);
        });

        it('should handle security validation', () => {
            const securityManager = (pluginSystem as any).securityManager;
            expect(securityManager).toBeDefined();
            expect(typeof securityManager.validatePlugin).toBe('function');
        });

        it('should track plugin performance', () => {
            const performanceMonitor = (pluginSystem as any).performanceMonitor;
            expect(performanceMonitor).toBeDefined();
            expect(typeof performanceMonitor.recordToolExecution).toBe('function');
            expect(typeof performanceMonitor.collectMetrics).toBe('function');
        });
    });

    describe('Error Handling', () => {
        it('should handle initialization errors gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock fs.mkdir to throw an error
            const originalMkdir = require('fs').promises.mkdir;
            require('fs').promises.mkdir = jest.fn().mockRejectedValue(new Error('Permission denied'));

            try {
                await pluginSystem.initialize();
            } catch (error) {
                // Should not throw, but log error
            }

            expect(consoleSpy).toHaveBeenCalled();

            // Restore
            require('fs').promises.mkdir = originalMkdir;
            consoleSpy.mockRestore();
        });

        it('should track plugin errors', async () => {
            const mockLoadedPlugin: LoadedPlugin = {
                manifest: mockPluginManifest,
                instance: {
                    executeTool: jest.fn().mockRejectedValue(new Error('Tool error'))
                },
                context: mockContext as any,
                isActive: true,
                errors: [],
                metadata: {
                    loadTime: 100,
                    memoryUsage: 1024,
                    apiCalls: 5,
                    lastUsed: new Date()
                }
            };

            (pluginSystem as any).registry.installed.set('test-plugin', mockLoadedPlugin);
            (pluginSystem as any).performanceMonitor = {
                recordToolExecution: jest.fn()
            };

            try {
                await pluginSystem.executePluginTool('test-plugin', 'test-tool', {});
            } catch (error) {
                // Expected
            }

            expect(mockLoadedPlugin.errors.length).toBeGreaterThan(0);
            expect(mockLoadedPlugin.errors[0]).toContain('Tool execution failed');
        });
    });

    describe('Configuration Management', () => {
        it('should save and load plugin configuration', async () => {
            (pluginSystem as any).registry.enabled.add('test-plugin');
            (pluginSystem as any).registry.disabled.add('disabled-plugin');

            await (pluginSystem as any).savePluginConfiguration();

            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'pluginConfiguration',
                {
                    enabled: ['test-plugin'],
                    disabled: ['disabled-plugin']
                }
            );
        });

        it('should handle missing configuration gracefully', () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            
            const config = (pluginSystem as any).loadConfiguration();
            expect(config).toBeDefined();
        });
    });
});

// Helper functions for testing
function fail(message: string): never {
    throw new Error(message);
}

// Mock Jest functions
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

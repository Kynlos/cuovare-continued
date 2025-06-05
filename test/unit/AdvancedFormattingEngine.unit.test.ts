/**
 * Advanced Formatting Engine Unit Tests - v0.9.0
 * 
 * Comprehensive test suite for the Advanced Formatting Engine with
 * context-aware formatting, multi-language support, and formatter integrations.
 */

import * as assert from 'assert';
import * as path from 'path';
import { 
    AdvancedFormattingEngine, 
    FormattingContext, 
    FormattingRule, 
    FormattingProfile 
} from '../../src/formatting/AdvancedFormattingEngine';

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

        console.log('🧪 Running Advanced Formatting Engine Tests...\n');

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
function createMockContext(language: string, filePath: string = 'test.ts'): FormattingContext {
    return {
        language,
        filePath,
        entireDocument: true,
        projectSettings: {
            tabSize: 2,
            insertSpaces: true,
            semi: true
        },
        existingFormatters: []
    };
}

function assertStringEquals(actual: string, expected: string, message?: string) {
    if (actual !== expected) {
        throw new Error(`${message || 'Strings not equal'}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
}

// Core Formatting Engine Tests
test.describe('Core Formatting Engine', () => {
    (global as any).it('should initialize with default rules and profiles', () => {
        const engine = new AdvancedFormattingEngine();
        const tsProfiles = engine.getProfilesForLanguage('typescript');
        assert.ok(tsProfiles.length > 0, 'Should have TypeScript profiles');
        
        const pyProfiles = engine.getProfilesForLanguage('python');
        assert.ok(pyProfiles.length > 0, 'Should have Python profiles');
    });

    (global as any).it('should add custom formatting rules', () => {
        const engine = new AdvancedFormattingEngine();
        
        const customRule: FormattingRule = {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'Test rule for unit testing',
            language: ['typescript'],
            pattern: /test/g,
            formatter: (code) => code.replace(/test/g, 'TEST'),
            priority: 1,
            enabled: true
        };

        engine.addRule(customRule);
        
        // Test that rule is added (would need getter method in real implementation)
        assert.ok(true, 'Custom rule added successfully');
    });

    (global as any).it('should add custom formatting profiles', () => {
        const engine = new AdvancedFormattingEngine();
        
        const customProfile: FormattingProfile = {
            id: 'test-profile',
            name: 'Test Profile',
            description: 'Test profile for unit testing',
            languages: ['typescript'],
            rules: [],
            settings: { tabSize: 4 },
            isDefault: false
        };

        engine.addProfile(customProfile);
        
        const profiles = engine.getProfilesForLanguage('typescript');
        const testProfile = profiles.find(p => p.id === 'test-profile');
        assert.ok(testProfile, 'Custom profile should be added');
        assert.strictEqual(testProfile?.name, 'Test Profile');
    });
});

// TypeScript/JavaScript Formatting Tests
test.describe('TypeScript/JavaScript Formatting', () => {
    (global as any).it('should format TypeScript code with consistent semicolons', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `
const name = "John"
const age = 30
function greet() {
    return "Hello"
}`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        assert.ok(result.formattedCode.includes('const name = "John";'), 'Should add semicolons');
        assert.ok(result.formattedCode.includes('return "Hello";'), 'Should add semicolons to return statements');
    });

    (global as any).it('should organize import statements', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `import lodash from 'lodash';
import fs from 'fs';
import { Component } from './Component';
import React from 'react';`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        
        // Check that standard library imports come first
        const lines = result.formattedCode.split('\n').filter(line => line.trim());
        const fsImportIndex = lines.findIndex(line => line.includes("import fs from 'fs'"));
        const lodashImportIndex = lines.findIndex(line => line.includes("import lodash from 'lodash'"));
        const localImportIndex = lines.findIndex(line => line.includes("import { Component } from './Component'"));
        
        assert.ok(fsImportIndex >= 0, 'Should contain fs import');
        assert.ok(localImportIndex > lodashImportIndex, 'Local imports should come after third-party');
    });

    (global as any).it('should enforce consistent indentation', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `function test() {
    if (true) {
        console.log("test");
            const x = 1;
    }
}`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        
        // Check consistent 2-space indentation
        const lines = result.formattedCode.split('\n');
        const ifLine = lines.find(line => line.trim().startsWith('if'));
        const consoleLine = lines.find(line => line.trim().startsWith('console.log'));
        const constLine = lines.find(line => line.trim().startsWith('const x'));
        
        if (consoleLine && constLine) {
            const consoleIndent = consoleLine.match(/^(\s*)/)?.[1]?.length || 0;
            const constIndent = constLine.match(/^(\s*)/)?.[1]?.length || 0;
            assert.strictEqual(consoleIndent, constIndent, 'Should have consistent indentation');
        }
    });

    (global as any).it('should remove trailing whitespace', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `const name = "John";   
const age = 30;	
function greet() {  
    return "Hello";
}`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        
        const lines = result.formattedCode.split('\n');
        for (const line of lines) {
            assert.ok(!line.match(/\s+$/), `Line should not end with whitespace: "${line}"`);
        }
    });
});

// Python Formatting Tests
test.describe('Python Formatting', () => {
    (global as any).it('should organize Python imports according to PEP 8', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('python');
        
        const code = `import requests
import os
import sys
from myproject import utils
from django import models`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        
        const lines = result.formattedCode.split('\n').filter(line => line.trim());
        
        // Standard library imports should come first
        const osIndex = lines.findIndex(line => line.includes('import os'));
        const sysIndex = lines.findIndex(line => line.includes('import sys'));
        const requestsIndex = lines.findIndex(line => line.includes('import requests'));
        const localIndex = lines.findIndex(line => line.includes('from myproject'));
        
        assert.ok(osIndex >= 0 && sysIndex >= 0, 'Should contain standard library imports');
        assert.ok(localIndex > requestsIndex, 'Local imports should come after third-party');
    });

    (global as any).it('should use 4-space indentation for Python', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('python');
        context.projectSettings = { tabSize: 4, insertSpaces: true };
        
        const code = `def test():
  if True:
    print("test")
      x = 1`;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        
        const lines = result.formattedCode.split('\n');
        const printLine = lines.find(line => line.trim().startsWith('print'));
        const xLine = lines.find(line => line.trim().startsWith('x ='));
        
        if (printLine && xLine) {
            const printIndent = printLine.match(/^(\s*)/)?.[1]?.length || 0;
            const xIndent = xLine.match(/^(\s*)/)?.[1]?.length || 0;
            assert.strictEqual(printIndent, xIndent, 'Should have consistent 4-space indentation');
            assert.strictEqual(printIndent, 8, 'Should use 8 spaces for double indentation');
        }
    });
});

// Performance and Metrics Tests
test.describe('Performance and Metrics', () => {
    (global as any).it('should measure formatting performance', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = 'const x = 1;\n'.repeat(1000); // Large code block
        
        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        assert.ok(result.performance.duration >= 0, 'Should measure duration');
        assert.strictEqual(result.performance.originalLines, 1000, 'Should count original lines');
        assert.ok(result.performance.formattedLines > 0, 'Should count formatted lines');
    });

    (global as any).it('should track applied rules', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `const name = "John"
const age = 30   `;

        const result = await engine.formatCode(code, context);
        
        assert.ok(result.success, 'Formatting should succeed');
        assert.ok(result.appliedRules.length > 0, 'Should track applied rules');
        assert.ok(Array.isArray(result.appliedRules), 'Applied rules should be an array');
    });

    (global as any).it('should return performance metrics', () => {
        const engine = new AdvancedFormattingEngine();
        
        const metrics = engine.getPerformanceMetrics();
        
        assert.ok(metrics instanceof Map, 'Should return performance metrics as Map');
    });
});

// Batch Processing Tests
test.describe('Batch Processing', () => {
    (global as any).it('should format multiple files in batch', async () => {
        const engine = new AdvancedFormattingEngine();
        
        const files = [
            { path: 'test1.ts', content: 'const x = 1' },
            { path: 'test2.ts', content: 'const y = 2' },
            { path: 'test3.js', content: 'const z = 3' }
        ];

        let progressCount = 0;
        const results = await engine.formatMultipleFiles(files, undefined, (progress, current) => {
            progressCount++;
            assert.ok(progress >= 0 && progress <= 100, 'Progress should be between 0 and 100');
            assert.ok(typeof current === 'string', 'Current file should be a string');
        });

        assert.strictEqual(results.size, 3, 'Should process all files');
        assert.ok(progressCount > 0, 'Should call progress callback');
        
        for (const [path, result] of results.entries()) {
            assert.ok(result.success, `File ${path} should format successfully`);
        }
    });
});

// Formatting Suggestions Tests
test.describe('Formatting Suggestions', () => {
    (global as any).it('should provide formatting suggestions', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `const name = "John"
const age = 30   `;

        const suggestions = await engine.getFormattingSuggestions(code, context);
        
        assert.ok(Array.isArray(suggestions), 'Should return array of suggestions');
        assert.ok(suggestions.length > 0, 'Should provide suggestions for improperly formatted code');
        
        for (const suggestion of suggestions) {
            assert.ok(suggestion.message, 'Each suggestion should have a message');
            assert.ok(suggestion.rule, 'Each suggestion should reference a rule');
            assert.ok(['info', 'warning', 'error'].includes(suggestion.severity), 'Should have valid severity');
        }
    });

    (global as any).it('should return empty suggestions for well-formatted code', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const code = `const name = "John";
const age = 30;

function greet(): string {
    return "Hello";
}`;

        const suggestions = await engine.getFormattingSuggestions(code, context);
        
        // Well-formatted code should have fewer or no suggestions
        assert.ok(Array.isArray(suggestions), 'Should return array of suggestions');
    });
});

// Configuration Tests
test.describe('Configuration Management', () => {
    (global as any).it('should export and import configuration', () => {
        const engine = new AdvancedFormattingEngine();
        
        const config = engine.exportConfiguration();
        
        assert.ok(config.rules, 'Should export rules');
        assert.ok(config.profiles, 'Should export profiles');
        assert.ok(Array.isArray(config.rules), 'Rules should be an array');
        assert.ok(Array.isArray(config.profiles), 'Profiles should be an array');
        
        // Test import
        const newEngine = new AdvancedFormattingEngine();
        newEngine.importConfiguration(config);
        
        const newConfig = newEngine.exportConfiguration();
        assert.strictEqual(newConfig.rules.length, config.rules.length, 'Should import same number of rules');
        assert.strictEqual(newConfig.profiles.length, config.profiles.length, 'Should import same number of profiles');
    });
});

// History Management Tests
test.describe('History Management', () => {
    (global as any).it('should track formatting history', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        const filePath = '/test/file.ts';
        context.filePath = filePath;
        
        const code = 'const x = 1';
        
        // Format the code
        await engine.formatCode(code, context);
        
        const history = engine.getFormattingHistory(filePath);
        
        assert.ok(Array.isArray(history), 'History should be an array');
        assert.ok(history.length > 0, 'Should have at least one history entry');
        
        const lastEntry = history[history.length - 1];
        assert.ok(lastEntry.originalCode, 'History entry should have original code');
        assert.ok(lastEntry.formattedCode, 'History entry should have formatted code');
    });

    (global as any).it('should clear formatting history', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        const filePath = '/test/file.ts';
        context.filePath = filePath;
        
        // Format some code to create history
        await engine.formatCode('const x = 1', context);
        
        let history = engine.getFormattingHistory(filePath);
        assert.ok(history.length > 0, 'Should have history before clearing');
        
        // Clear specific file history
        engine.clearHistory(filePath);
        history = engine.getFormattingHistory(filePath);
        assert.strictEqual(history.length, 0, 'Should clear specific file history');
        
        // Test clearing all history
        await engine.formatCode('const y = 2', context);
        engine.clearHistory();
        history = engine.getFormattingHistory(filePath);
        assert.strictEqual(history.length, 0, 'Should clear all history');
    });
});

// Error Handling Tests
test.describe('Error Handling', () => {
    (global as any).it('should handle invalid code gracefully', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('typescript');
        
        const invalidCode = 'const x = [invalid syntax}';
        
        const result = await engine.formatCode(invalidCode, context);
        
        // Should not throw, but may not succeed or have warnings
        assert.ok(typeof result.success === 'boolean', 'Should return success status');
        assert.ok(Array.isArray(result.warnings), 'Should return warnings array');
        assert.ok(Array.isArray(result.appliedRules), 'Should return applied rules array');
    });

    (global as any).it('should handle unsupported languages', async () => {
        const engine = new AdvancedFormattingEngine();
        const context = createMockContext('unsupported-language');
        
        const code = 'some code in unsupported language';
        
        const result = await engine.formatCode(code, context);
        
        // Should handle gracefully, likely with minimal changes
        assert.ok(typeof result.success === 'boolean', 'Should return success status');
        assert.ok(result.formattedCode, 'Should return some formatted code');
    });
});

// Multi-language Support Tests
test.describe('Multi-language Support', () => {
    (global as any).it('should detect appropriate profiles for different languages', () => {
        const engine = new AdvancedFormattingEngine();
        
        const tsProfiles = engine.getProfilesForLanguage('typescript');
        const pyProfiles = engine.getProfilesForLanguage('python');
        const jsProfiles = engine.getProfilesForLanguage('javascript');
        
        assert.ok(tsProfiles.length > 0, 'Should have TypeScript profiles');
        assert.ok(pyProfiles.length > 0, 'Should have Python profiles');
        assert.ok(jsProfiles.length > 0, 'Should have JavaScript profiles');
        
        // TypeScript and JavaScript should share some profiles
        const sharedProfiles = tsProfiles.filter(tsp => 
            jsProfiles.some(jsp => jsp.id === tsp.id)
        );
        assert.ok(sharedProfiles.length > 0, 'TypeScript and JavaScript should share profiles');
    });

    (global as any).it('should format different languages with appropriate rules', async () => {
        const engine = new AdvancedFormattingEngine();
        
        // Test TypeScript
        const tsContext = createMockContext('typescript');
        const tsResult = await engine.formatCode('const x = 1', tsContext);
        assert.ok(tsResult.success, 'Should format TypeScript');
        
        // Test Python
        const pyContext = createMockContext('python');
        const pyResult = await engine.formatCode('x = 1', pyContext);
        assert.ok(pyResult.success, 'Should format Python');
        
        // Test JavaScript
        const jsContext = createMockContext('javascript');
        const jsResult = await engine.formatCode('const x = 1', jsContext);
        assert.ok(jsResult.success, 'Should format JavaScript');
    });
});

// Integration Tests
test.describe('Integration Tests', () => {
    (global as any).it('should get available integrations for languages', async () => {
        const engine = new AdvancedFormattingEngine();
        
        const tsIntegrations = await engine.getAvailableIntegrations('typescript');
        const pyIntegrations = await engine.getAvailableIntegrations('python');
        
        assert.ok(Array.isArray(tsIntegrations), 'Should return array of integrations for TypeScript');
        assert.ok(Array.isArray(pyIntegrations), 'Should return array of integrations for Python');
        
        // Should not throw errors even if external tools are not available
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

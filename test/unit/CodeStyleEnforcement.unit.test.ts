/**
 * Code Style Enforcement Unit Tests - v0.9.0
 * 
 * Comprehensive test suite for the Code Style Enforcement system with
 * style guide compliance, violation detection, and auto-fixing capabilities.
 */

import * as assert from 'assert';
import * as path from 'path';
import { 
    CodeStyleEnforcement, 
    StyleRule, 
    StyleGuide, 
    StyleViolation, 
    TeamStyleConfig 
} from '../../src/styleguide/CodeStyleEnforcement';

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

        console.log('🧪 Running Code Style Enforcement Tests...\n');

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
function createMockCode(language: string): { filePath: string; code: string } {
    const codes: { [key: string]: string } = {
        typescript: `
class user_service {
    private user_name: string;
    
    constructor(user_name: string) {
        this.user_name = user_name
    }
    
    function getUserName() {
        console.log("Getting user name");
        return this.user_name
    }
}

let config = "static config"
`,
        javascript: `
class user_service {
    constructor(user_name) {
        this.user_name = user_name
    }
    
    getUserName() {
        console.log("Getting user name");
        return this.user_name
    }
}

let config = "static config"
`,
        python: `
import requests
import os
from myproject import utils

userName = "John"
userAge = 30

def getUserInfo():
    user_data = requests.get("http://api.example.com/user")
    return user_data
`
    };

    const extensions: { [key: string]: string } = {
        typescript: '.ts',
        javascript: '.js',
        python: '.py'
    };

    return {
        filePath: `test${extensions[language] || '.txt'}`,
        code: codes[language] || 'const test = "example";'
    };
}

// Core Style Enforcement Tests
test.describe('Core Style Enforcement', () => {
    (global as any).it('should initialize with built-in rules and style guides', () => {
        const enforcement = new CodeStyleEnforcement();
        
        // Should have popular style guides
        const recommendations = enforcement.getStyleGuideRecommendations(['typescript']);
        assert.ok(recommendations.length > 0, 'Should have TypeScript style guide recommendations');
        
        const airbnb = recommendations.find(sg => sg.name.includes('Airbnb'));
        assert.ok(airbnb, 'Should include Airbnb style guide');
    });

    (global as any).it('should add custom style rules', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const customRule: StyleRule = {
            id: 'test-custom-rule',
            name: 'Test Custom Rule',
            description: 'Custom rule for testing',
            category: 'naming',
            language: ['typescript'],
            severity: 'warning',
            pattern: /testPattern/g,
            message: 'Test violation message',
            fixable: true,
            fix: (code) => code.replace(/testPattern/g, 'fixedPattern'),
            examples: {
                bad: 'testPattern',
                good: 'fixedPattern'
            }
        };

        enforcement.addRule(customRule);
        assert.ok(true, 'Custom rule added successfully');
    });

    (global as any).it('should add custom style guides', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const customGuide: StyleGuide = {
            id: 'test-guide',
            name: 'Test Style Guide',
            description: 'Custom style guide for testing',
            version: '1.0.0',
            languages: ['typescript'],
            rules: [],
            settings: { indent: 2 },
            official: false
        };

        enforcement.addStyleGuide(customGuide);
        
        const recommendations = enforcement.getStyleGuideRecommendations(['typescript']);
        const testGuide = recommendations.find(sg => sg.id === 'test-guide');
        assert.ok(testGuide, 'Custom style guide should be added');
    });
});

// TypeScript/JavaScript Style Checking Tests
test.describe('TypeScript/JavaScript Style Checking', () => {
    (global as any).it('should detect camelCase variable violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        assert.ok(result.success, 'Style check should succeed');
        assert.ok(result.violations.length > 0, 'Should detect style violations');
        
        const camelCaseViolations = result.violations.filter(v => 
            v.rule.id === 'camelcase-variables'
        );
        assert.ok(camelCaseViolations.length > 0, 'Should detect camelCase violations');
    });

    (global as any).it('should detect PascalCase class violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        const pascalCaseViolations = result.violations.filter(v => 
            v.rule.id === 'pascalcase-classes'
        );
        assert.ok(pascalCaseViolations.length > 0, 'Should detect PascalCase class violations');
    });

    (global as any).it('should detect const assertion opportunities', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        const constViolations = result.violations.filter(v => 
            v.rule.id === 'const-assertions'
        );
        assert.ok(constViolations.length > 0, 'Should detect const assertion opportunities');
    });

    (global as any).it('should detect console.log statements', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        const consoleViolations = result.violations.filter(v => 
            v.rule.id === 'no-console-log'
        );
        assert.ok(consoleViolations.length > 0, 'Should detect console.log violations');
    });

    (global as any).it('should detect TypeScript-specific violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const tsCode = `
function test() {
    return "Hello";
}

const data: any = {};
`;
        
        const result = await enforcement.checkCodeStyle(tsCode, 'test.ts');
        
        // Should detect explicit return type and any type violations
        const returnTypeViolations = result.violations.filter(v => 
            v.rule.id === 'explicit-return-types'
        );
        const anyTypeViolations = result.violations.filter(v => 
            v.rule.id === 'no-any-type'
        );
        
        assert.ok(returnTypeViolations.length > 0, 'Should detect missing return types');
        assert.ok(anyTypeViolations.length > 0, 'Should detect any type usage');
    });
});

// Python Style Checking Tests
test.describe('Python Style Checking', () => {
    (global as any).it('should detect snake_case variable violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('python');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        assert.ok(result.success, 'Style check should succeed');
        
        const snakeCaseViolations = result.violations.filter(v => 
            v.rule.id === 'python-snake-case'
        );
        assert.ok(snakeCaseViolations.length > 0, 'Should detect snake_case violations');
    });

    (global as any).it('should detect line length violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const longLineCode = `
def very_long_function_name_that_exceeds_the_character_limit_and_should_be_broken_down_into_smaller_pieces():
    pass
`;
        
        const result = await enforcement.checkCodeStyle(longLineCode, 'test.py');
        
        const lineLengthViolations = result.violations.filter(v => 
            v.rule.id === 'python-line-length'
        );
        assert.ok(lineLengthViolations.length > 0, 'Should detect line length violations');
    });

    (global as any).it('should check import organization', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('python');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        // May detect import order violations depending on implementation
        assert.ok(result.success, 'Style check should succeed');
        assert.ok(Array.isArray(result.violations), 'Should return violations array');
    });
});

// Auto-fixing Tests
test.describe('Auto-fixing Capabilities', () => {
    (global as any).it('should auto-fix camelCase violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const code = 'const user_name = "John";';
        
        const result = await enforcement.autoFixViolations(code, 'test.ts');
        
        assert.ok(result.code !== code, 'Should modify the code');
        assert.ok(result.fixedViolations.length > 0, 'Should report fixed violations');
        assert.ok(result.code.includes('userName'), 'Should fix variable name to camelCase');
    });

    (global as any).it('should auto-fix console.log statements', async () => {
        const enforcement = new CodeStyleEnforcement();
        const code = 'console.log("debug message");';
        
        const result = await enforcement.autoFixViolations(code, 'test.ts');
        
        assert.ok(result.code !== code, 'Should modify the code');
        assert.ok(result.code.includes('// console.log'), 'Should comment out console.log');
    });

    (global as any).it('should handle non-fixable violations', async () => {
        const enforcement = new CodeStyleEnforcement();
        const code = `
function test() {
    return "Hello";
}
`;
        
        const result = await enforcement.autoFixViolations(code, 'test.ts');
        
        // Some violations may not be auto-fixable
        assert.ok(Array.isArray(result.fixedViolations), 'Should return fixed violations array');
        assert.ok(Array.isArray(result.unfixableViolations), 'Should return unfixable violations array');
    });

    (global as any).it('should preserve code structure when fixing', async () => {
        const enforcement = new CodeStyleEnforcement();
        const code = `
class user_service {
    private user_name: string;
    
    constructor(user_name: string) {
        this.user_name = user_name;
    }
}
`;
        
        const result = await enforcement.autoFixViolations(code, 'test.ts');
        
        // Should maintain overall structure
        assert.ok(result.code.includes('class'), 'Should preserve class declaration');
        assert.ok(result.code.includes('constructor'), 'Should preserve constructor');
        assert.ok(result.code.includes('private'), 'Should preserve access modifiers');
    });
});

// Style Guide Integration Tests
test.describe('Style Guide Integration', () => {
    (global as any).it('should apply Airbnb JavaScript style guide', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath, 'airbnb-javascript');
        
        assert.ok(result.success, 'Style check should succeed');
        assert.strictEqual(result.appliedStyleGuide, 'Airbnb JavaScript Style Guide', 
            'Should apply Airbnb style guide');
    });

    (global as any).it('should apply Python PEP 8 style guide', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('python');
        
        const result = await enforcement.checkCodeStyle(code, filePath, 'python-pep8');
        
        assert.ok(result.success, 'Style check should succeed');
        assert.strictEqual(result.appliedStyleGuide, 'PEP 8 Python Style Guide', 
            'Should apply PEP 8 style guide');
    });

    (global as any).it('should get appropriate style guide recommendations', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const tsRecommendations = enforcement.getStyleGuideRecommendations(['typescript']);
        const pyRecommendations = enforcement.getStyleGuideRecommendations(['python']);
        
        assert.ok(tsRecommendations.length > 0, 'Should recommend TypeScript style guides');
        assert.ok(pyRecommendations.length > 0, 'Should recommend Python style guides');
        
        const tsGuide = tsRecommendations.find(sg => sg.languages.includes('typescript'));
        const pyGuide = pyRecommendations.find(sg => sg.languages.includes('python'));
        
        assert.ok(tsGuide, 'Should include TypeScript-compatible guide');
        assert.ok(pyGuide, 'Should include Python-compatible guide');
    });
});

// Team Configuration Tests
test.describe('Team Configuration', () => {
    (global as any).it('should add team configurations', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const teamConfig: TeamStyleConfig = {
            teamId: 'test-team',
            name: 'Test Team Configuration',
            styleGuides: ['airbnb-javascript'],
            customRules: [],
            overrides: {},
            enforcementLevel: 'strict',
            autoFix: true,
            reviewRequired: true
        };

        enforcement.addTeamConfig(teamConfig);
        assert.ok(true, 'Team configuration added successfully');
    });

    (global as any).it('should apply team-specific style checking', async () => {
        const enforcement = new CodeStyleEnforcement();
        
        const teamConfig: TeamStyleConfig = {
            teamId: 'strict-team',
            name: 'Strict Team',
            styleGuides: ['typescript-strict'],
            customRules: [],
            overrides: {},
            enforcementLevel: 'strict',
            autoFix: false,
            reviewRequired: true
        };

        enforcement.addTeamConfig(teamConfig);
        
        const { filePath, code } = createMockCode('typescript');
        const result = await enforcement.checkCodeStyle(code, filePath, undefined, 'strict-team');
        
        assert.ok(result.success, 'Style check should succeed');
        // Should apply team-specific rules
    });
});

// Batch Processing Tests
test.describe('Batch Processing', () => {
    (global as any).it('should check multiple files in batch', async () => {
        const enforcement = new CodeStyleEnforcement();
        
        const files = [
            { path: 'test1.ts', content: 'const user_name = "John";' },
            { path: 'test2.ts', content: 'class user_service {}' },
            { path: 'test3.js', content: 'let config = "static";' }
        ];

        let progressCount = 0;
        const results = await enforcement.checkMultipleFiles(files, undefined, undefined, 
            (progress, current) => {
                progressCount++;
                assert.ok(progress >= 0 && progress <= 100, 'Progress should be between 0 and 100');
                assert.ok(typeof current === 'string', 'Current file should be a string');
            }
        );

        assert.strictEqual(results.size, 3, 'Should process all files');
        assert.ok(progressCount > 0, 'Should call progress callback');
        
        for (const [path, result] of results.entries()) {
            assert.ok(result.success, `File ${path} should be checked successfully`);
            assert.ok(result.violations.length >= 0, 'Should return violations array');
        }
    });
});

// Performance and Metrics Tests
test.describe('Performance and Metrics', () => {
    (global as any).it('should measure check performance', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        assert.ok(result.checkDuration >= 0, 'Should measure check duration');
        assert.ok(result.totalLines > 0, 'Should count total lines');
    });

    (global as any).it('should calculate compliance scores', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath);
        
        assert.ok(result.compliance.score >= 0 && result.compliance.score <= 100, 
            'Compliance score should be between 0 and 100');
        assert.ok(result.compliance.errorsCount >= 0, 'Error count should be non-negative');
        assert.ok(result.compliance.warningsCount >= 0, 'Warning count should be non-negative');
        assert.ok(result.compliance.infoCount >= 0, 'Info count should be non-negative');
    });

    (global as any).it('should return performance metrics', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const metrics = enforcement.getPerformanceMetrics();
        
        assert.ok(metrics instanceof Map, 'Should return performance metrics as Map');
    });
});

// Configuration Generation Tests
test.describe('Configuration Generation', () => {
    (global as any).it('should generate ESLint configuration', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const eslintConfig = enforcement.generateConfigFile('airbnb-javascript', 'eslint');
        
        assert.ok(typeof eslintConfig === 'string', 'Should return ESLint config as string');
        assert.ok(eslintConfig.includes('extends'), 'Should include extends property');
        
        // Should be valid JSON
        const parsed = JSON.parse(eslintConfig);
        assert.ok(parsed.extends, 'Should have extends property');
        assert.ok(parsed.rules, 'Should have rules property');
    });

    (global as any).it('should generate Prettier configuration', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const prettierConfig = enforcement.generateConfigFile('airbnb-javascript', 'prettier');
        
        assert.ok(typeof prettierConfig === 'string', 'Should return Prettier config as string');
        
        // Should be valid JSON
        const parsed = JSON.parse(prettierConfig);
        assert.ok(typeof parsed.printWidth === 'number', 'Should have printWidth setting');
        assert.ok(typeof parsed.tabWidth === 'number', 'Should have tabWidth setting');
        assert.ok(typeof parsed.semi === 'boolean', 'Should have semi setting');
    });

    (global as any).it('should handle unsupported config formats', () => {
        const enforcement = new CodeStyleEnforcement();
        
        assert.throws(() => {
            enforcement.generateConfigFile('airbnb-javascript', 'unsupported' as any);
        }, /Unsupported config format/, 'Should throw for unsupported formats');
    });
});

// Violation Trends Tests
test.describe('Violation Trends', () => {
    (global as any).it('should return violation trends', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const trends = enforcement.getViolationTrends();
        
        assert.ok(Array.isArray(trends.trends), 'Should return trends array');
        assert.ok(Array.isArray(trends.improvementSuggestions), 'Should return improvement suggestions');
        assert.ok(trends.improvementSuggestions.length > 0, 'Should provide improvement suggestions');
    });

    (global as any).it('should provide meaningful improvement suggestions', () => {
        const enforcement = new CodeStyleEnforcement();
        
        const trends = enforcement.getViolationTrends('test-file.ts');
        
        assert.ok(Array.isArray(trends.improvementSuggestions), 'Should return suggestions array');
        
        for (const suggestion of trends.improvementSuggestions) {
            assert.ok(typeof suggestion === 'string', 'Each suggestion should be a string');
            assert.ok(suggestion.length > 0, 'Suggestions should not be empty');
        }
    });
});

// Diagnostics Integration Tests
test.describe('Diagnostics Integration', () => {
    (global as any).it('should clear diagnostics for specific files', () => {
        const enforcement = new CodeStyleEnforcement();
        
        // Should not throw when clearing diagnostics
        enforcement.clearDiagnostics('test-file.ts');
        enforcement.clearDiagnostics(); // Clear all
        
        assert.ok(true, 'Should clear diagnostics without errors');
    });
});

// Error Handling Tests
test.describe('Error Handling', () => {
    (global as any).it('should handle invalid code gracefully', async () => {
        const enforcement = new CodeStyleEnforcement();
        
        const invalidCode = 'const x = [invalid syntax}';
        const result = await enforcement.checkCodeStyle(invalidCode, 'test.ts');
        
        // Should not throw, but should handle gracefully
        assert.ok(typeof result.success === 'boolean', 'Should return success status');
        assert.ok(Array.isArray(result.violations), 'Should return violations array');
    });

    (global as any).it('should handle unsupported style guides', async () => {
        const enforcement = new CodeStyleEnforcement();
        const { filePath, code } = createMockCode('typescript');
        
        const result = await enforcement.checkCodeStyle(code, filePath, 'non-existent-guide');
        
        // Should fall back gracefully
        assert.ok(typeof result.success === 'boolean', 'Should return success status');
    });

    (global as any).it('should handle auto-fix errors gracefully', async () => {
        const enforcement = new CodeStyleEnforcement();
        
        // Code that might cause fix errors
        const problematicCode = 'const x = /* unclosed comment';
        const result = await enforcement.autoFixViolations(problematicCode, 'test.ts');
        
        // Should not throw, should return original code if fixes fail
        assert.ok(typeof result.code === 'string', 'Should return code string');
        assert.ok(Array.isArray(result.fixedViolations), 'Should return fixed violations array');
        assert.ok(Array.isArray(result.unfixableViolations), 'Should return unfixable violations array');
    });
});

// Cleanup Tests
test.describe('Cleanup and Disposal', () => {
    (global as any).it('should dispose resources properly', () => {
        const enforcement = new CodeStyleEnforcement();
        
        // Should not throw when disposing
        enforcement.dispose();
        
        assert.ok(true, 'Should dispose without errors');
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

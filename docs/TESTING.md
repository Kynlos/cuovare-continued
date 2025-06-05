# 🧪 Cuovare Testing Guide

Comprehensive testing strategy and guidelines for ensuring Cuovare's reliability and quality.

## 📋 Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Debugging Tests](#debugging-tests)
- [CI/CD Integration](#cicd-integration)

## 🎯 Testing Philosophy

Cuovare follows a comprehensive testing strategy with multiple test types:

- **Unit Tests** - Fast, isolated tests for individual components
- **Integration Tests** - Test component interactions within VS Code
- **End-to-End Tests** - Full workflow testing with real AI providers
- **Performance Tests** - Ensure responsiveness and efficiency

### Testing Principles

1. **Fast Feedback** - Unit tests run in <100ms, full suite in <5 minutes
2. **Reliable** - Tests are deterministic and don't depend on external services
3. **Maintainable** - Tests are clear, well-documented, and easy to update
4. **Comprehensive** - High coverage of critical paths and edge cases

## 🔬 Test Types

### 1. Unit Tests ⚡

Fast, isolated tests that mock external dependencies.

**What we test:**
- Business logic in isolation
- Data transformations
- Utility functions
- Error handling
- Edge cases

**Location:** `test/unit/`
**Runtime:** <100ms total
**Dependencies:** Mocked

### 2. Integration Tests 🔗

Test component interactions within the VS Code environment.

**What we test:**
- VS Code API integration
- File system operations
- Webview communication
- Extension lifecycle

**Location:** `test/context/`
**Runtime:** 1-5 minutes
**Dependencies:** VS Code Test Runner

### 3. Performance Tests ⚡

Ensure the extension remains responsive under load.

**What we test:**
- Context retrieval speed
- Memory usage
- Large file handling
- Concurrent operations

**Location:** `test/performance/`
**Runtime:** Variable
**Dependencies:** Performance monitoring tools

## 📁 Test Structure

### Directory Layout

```
test/
├── unit/                           # Unit tests (fast, isolated) - 132 test cases
│   ├── ContextRetrievalEngine.unit.test.ts       # 25 test cases
│   ├── ContextIntegration.unit.test.ts           # 20 test cases
│   ├── AIProviderManager.unit.test.ts            # 15 test cases
│   # 🌟 v0.9.0 Professional Features Tests:
│   ├── AdvancedFormattingEngine.unit.test.ts     # 30 test cases
│   ├── CodeStyleEnforcement.unit.test.ts         # 36 test cases
│   ├── PerformanceProfiling.unit.test.ts         # 34 test cases
│   ├── DependencyManagement.unit.test.ts         # 32 test cases
│   # 🌟 v0.8.0 Enterprise Tests:
│   ├── AdvancedPluginSystem.unit.test.ts         # 25 test cases
│   ├── AuditLoggingSystem.unit.test.ts           # 30 test cases
│   # 🌟 v0.7.0 Context Intelligence Tests:
│   ├── AdvancedContextSystem.unit.test.ts        # 28 test cases
├── context/                        # Integration tests (VS Code)
│   ├── ContextRetrievalEngine.test.ts
│   ├── ContextIntegration.test.ts
│   ├── FileContextManager.test.ts
│   ├── AgentMode.test.ts                          # Agent integration tests
│   ├── MCPManager.test.ts                         # MCP integration tests
├── performance/                    # Performance tests
│   ├── ContextRetrieval.perf.test.ts
│   ├── LargeFiles.perf.test.ts
│   ├── AgentExecution.perf.test.ts
│   ├── FormattingPerformance.perf.test.ts         # v0.9.0 performance tests
├── fixtures/                       # Test data and mock files
│   ├── mock-workspace/
│   ├── sample-code/
│   ├── test-projects/                             # Full project samples
│   └── performance-data/                          # Large file samples
├── helpers/                        # Test utilities
│   ├── mockVSCode.ts
│   ├── testWorkspace.ts
│   ├── assertions.ts
│   ├── mockAIProviders.ts                         # AI provider mocks
│   └── testFramework.ts                           # Self-contained framework
├── runUnitTests.js                # Unit test runner
├── runIntegrationTests.js         # Integration test runner
├── validateV070Features.js        # v0.7.0 Advanced Context validation
├── validateV080Features.js        # v0.8.0 Enterprise & Integration validation
└── validateV090Features.js        # v0.9.0 Professional Features validation
```

### Test File Naming

- `*.unit.test.ts` - Unit tests
- `*.test.ts` - Integration tests  
- `*.perf.test.ts` - Performance tests
- `*.spec.ts` - Specification tests

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
pnpm run test

# Run only unit tests (fast) - 132 test cases
pnpm run unit-tests

# Version-specific validation tests
pnpm run test:v070      # Validate v0.7.0 Advanced Context features
pnpm run test:v080      # Validate v0.8.0 Enterprise & Integration features
pnpm run test:v090      # Validate v0.9.0 Professional features
pnpm run test:all       # Run all validation tests (v0.7.0, v0.8.0, v0.9.0)

# Run with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm run test:watch

# Run specific test file
pnpm run test -- ContextRetrievalEngine

# Run with debug output
pnpm run test:debug

# Performance and regression tests
pnpm run test:performance
pnpm run test:regression
```

### Detailed Commands

#### Unit Tests

```bash
# Fast isolated tests
node test/runUnitTests.js

# With coverage
nyc node test/runUnitTests.js

# Specific test suite
node test/runUnitTests.js --grep "ContextRetrievalEngine"
```

#### Integration Tests

```bash
# Full VS Code integration tests
pnpm run test

# Specific integration test
pnpm run test -- --grep "Context Integration"

# With extended timeout
pnpm run test -- --timeout 10000
```

#### Performance Tests

```bash
# Run performance benchmarks
pnpm run test:performance

# Memory profiling
pnpm run test:memory

# Load testing
pnpm run test:load

# v0.9.0 Professional feature performance
pnpm run test:formatting-performance
pnpm run test:profiling-accuracy
```

#### Feature Validation Tests

```bash
# v0.7.0 Advanced Context System validation
node test/validateV070Features.js

# v0.8.0 Enterprise & Integration validation  
node test/validateV080Features.js

# v0.9.0 Professional Features validation
node test/validateV090Features.js

# All features validation
pnpm run test:all
```

## ✍️ Writing Tests

### Unit Test Example

```typescript
// test/unit/ContextRetrievalEngine.unit.test.ts
import * as assert from 'assert';
import { ContextRetrievalEngine } from '../../src/context/ContextRetrievalEngine';

// Mock VS Code dependencies
const mockVscode = {
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
        findFiles: async () => [],
        // ... other mocks
    }
};

suite('ContextRetrievalEngine Unit Tests', () => {
    let engine: ContextRetrievalEngine;

    setup(() => {
        engine = ContextRetrievalEngine.getInstance();
    });

    test('should expand semantic queries correctly', () => {
        const expansions = {
            'authentication': ['auth', 'login', 'token', 'jwt']
        };
        
        const result = expansions['authentication'];
        assert.ok(result.includes('auth'));
        assert.ok(result.includes('login'));
    });

    test('should handle edge cases gracefully', async () => {
        const result = await engine.retrieveContext('');
        assert.strictEqual(result.files.length, 0);
        assert.strictEqual(result.relevanceScore, 0);
    });
});
```

### Integration Test Example

```typescript
// test/context/ContextIntegration.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContextIntegration } from '../../src/context/ContextIntegration';

suite('ContextIntegration Tests', () => {
    let integration: ContextIntegration;

    suiteSetup(async () => {
        // Setup test workspace
        await createTestWorkspace();
        integration = new ContextIntegration();
    });

    test('should find relevant files for authentication query', async function() {
        this.timeout(5000);
        
        const result = await integration.getContextForMessage(
            'How does user authentication work?'
        );

        assert.ok(result.files.length > 0);
        assert.ok(result.relevanceScore > 0);
    });
});
```

### Professional Features Test Example (v0.9.0)

```typescript
// test/unit/AdvancedFormattingEngine.unit.test.ts
import * as assert from 'assert';
import { AdvancedFormattingEngine } from '../../src/formatting/AdvancedFormattingEngine';

suite('AdvancedFormattingEngine Unit Tests', () => {
    let engine: AdvancedFormattingEngine;

    setup(() => {
        engine = new AdvancedFormattingEngine();
    });

    test('should format TypeScript code with context awareness', async () => {
        const input = 'function   test(){return"hello";}';
        const expected = 'function test() {\n    return "hello";\n}';
        
        const result = await engine.formatCode(input, 'typescript', {
            contextAware: true,
            profile: 'default'
        });
        
        assert.strictEqual(result.formattedCode, expected);
        assert.ok(result.changes.length > 0);
    });

    test('should handle large files efficiently', async function() {
        this.timeout(5000);
        
        const largeCode = 'a'.repeat(100000); // 100KB file
        const startTime = Date.now();
        
        const result = await engine.formatCode(largeCode, 'javascript');
        
        const duration = Date.now() - startTime;
        assert.ok(duration < 2000, `Formatting took ${duration}ms`);
        assert.ok(result.success);
    });
});
```

### Code Style Enforcement Test Example

```typescript
// test/unit/CodeStyleEnforcement.unit.test.ts
import * as assert from 'assert';
import { CodeStyleEnforcement } from '../../src/styleguide/CodeStyleEnforcement';

suite('CodeStyleEnforcement Unit Tests', () => {
    let enforcer: CodeStyleEnforcement;

    setup(() => {
        enforcer = new CodeStyleEnforcement();
    });

    test('should detect Airbnb style violations', async () => {
        const code = `var x=1;function test(){return x}`;
        
        const result = await enforcer.analyzeCode(code, 'airbnb', 'javascript');
        
        assert.ok(result.violations.length > 0);
        assert.ok(result.violations.some(v => v.rule === 'prefer-const'));
        assert.ok(result.violations.some(v => v.rule === 'no-var'));
    });

    test('should auto-fix style violations', async () => {
        const code = `var x=1;console.log(x)`;
        
        const result = await enforcer.autoFix(code, 'airbnb', 'javascript');
        
        assert.ok(result.fixed);
        assert.ok(result.fixedCode.includes('const x = 1'));
        assert.strictEqual(result.fixedViolationsCount, 2);
    });
});
```

### Performance Profiling Test Example

```typescript
// test/unit/PerformanceProfiling.unit.test.ts
import * as assert from 'assert';
import { PerformanceProfiling } from '../../src/profiling/PerformanceProfiling';

suite('PerformanceProfiling Unit Tests', () => {
    let profiler: PerformanceProfiling;

    setup(() => {
        profiler = new PerformanceProfiling();
    });

    test('should detect memory leaks', async () => {
        const mockCode = `
            let leakyArray = [];
            setInterval(() => {
                leakyArray.push(new Array(1000).fill('data'));
            }, 100);
        `;
        
        const result = await profiler.analyzeMemoryUsage(mockCode, 'javascript');
        
        assert.ok(result.memoryLeaks.length > 0);
        assert.ok(result.recommendations.some(r => r.type === 'memory-optimization'));
    });

    test('should provide performance recommendations', async () => {
        const slowCode = `
            for (let i = 0; i < 1000000; i++) {
                document.getElementById('test' + i);
            }
        `;
        
        const result = await profiler.analyzePerformance(slowCode, 'javascript');
        
        assert.ok(result.bottlenecks.length > 0);
        assert.ok(result.optimizations.length > 0);
        assert.ok(result.score < 50); // Poor performance score
    });
});
```

### Performance Test Example

```typescript
// test/performance/ContextRetrieval.perf.test.ts
import * as assert from 'assert';
import { performance } from 'perf_hooks';

suite('Context Retrieval Performance', () => {
    test('should retrieve context within 1 second', async function() {
        this.timeout(5000);
        
        const startTime = performance.now();
        
        const result = await engine.retrieveContext('authentication system');
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        assert.ok(duration < 1000, `Context retrieval took ${duration}ms`);
        assert.ok(result.files.length > 0);
    });

    test('should handle large workspaces efficiently', async function() {
        this.timeout(10000);
        
        // Test with workspace containing 1000+ files
        const startMemory = process.memoryUsage().heapUsed;
        
        await engine.retrieveContext('user management');
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        
        // Memory increase should be reasonable
        assert.ok(memoryIncrease < 50 * 1024 * 1024, 'Memory usage too high');
    });
});
```

## 📊 Test Coverage

### Coverage Goals

- **Overall Coverage**: 85%+
- **Critical Components**: 95%+
- **Business Logic**: 90%+
- **Error Handling**: 80%+

### Coverage Reports

```bash
# Generate coverage report
pnpm run test:coverage

# View HTML report
open coverage/index.html

# Coverage by component
pnpm run coverage:component

# Coverage trends
pnpm run coverage:trends
```

### Coverage Configuration

```json
// .nycrc.json
{
  "extends": "@istanbuljs/nyc-config-typescript",
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "test/**/*"
  ],
  "reporter": ["text", "html", "lcov"],
  "report-dir": "coverage",
  "check-coverage": true,
  "lines": 85,
  "functions": 85,
  "branches": 80,
  "statements": 85
}
```

## 🐛 Debugging Tests

### Debug Unit Tests

```bash
# Run with Node.js debugger
node --inspect-brk test/runUnitTests.js

# Debug specific test
node --inspect-brk test/runUnitTests.js --grep "specific test"
```

### Debug Integration Tests

1. **Launch VS Code Extension Development Host**
   ```bash
   # Press F5 in VS Code to start debugging
   ```

2. **Set Breakpoints**
   - Set breakpoints in test files
   - Set breakpoints in source code

3. **Run Tests with Debugger**
   ```bash
   # In Extension Development Host
   pnpm run test
   ```

### Debug VS Code Integration

```typescript
// In test file
debugger; // Pause execution

// Or use console.log
console.log('Test debug:', someVariable);

// Check VS Code Output panel for logs
```

### Common Debugging Scenarios

#### Test Timeouts

```typescript
// Increase timeout for slow operations
test('slow operation', async function() {
    this.timeout(10000); // 10 seconds
    // ... test code
});
```

#### Mock Issues

```typescript
// Verify mocks are working
assert.ok(mockFunction.called);
assert.strictEqual(mockFunction.callCount, 1);
```

#### Async Issues

```typescript
// Proper async/await usage
test('async test', async () => {
    const result = await asyncOperation();
    assert.ok(result);
});

// Handle promises properly
test('promise test', () => {
    return asyncOperation().then(result => {
        assert.ok(result);
    });
});
```

## 🤖 Mock Strategies

### VS Code API Mocking

```typescript
// test/helpers/mockVSCode.ts
export const mockVscode = {
    workspace: {
        workspaceFolders: [
            { uri: { fsPath: '/mock/workspace', scheme: 'file' } }
        ],
        findFiles: jest.fn(async () => []),
        openTextDocument: jest.fn(async () => ({
            getText: () => 'mock content',
            languageId: 'typescript',
            lineCount: 10
        })),
        fs: {
            stat: jest.fn(async () => ({ size: 1000 }))
        }
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file' })
    },
    window: {
        visibleTextEditors: [],
        activeTextEditor: null
    }
};
```

### AI Provider Mocking

```typescript
// Mock AI responses
const mockAIProvider = {
    sendMessage: jest.fn(async (message) => ({
        content: `Mock response to: ${message}`,
        usage: { tokens: 100 }
    }))
};
```

### File System Mocking

```typescript
// Mock file operations
const mockFS = {
    readFile: jest.fn(async (path) => {
        if (path.includes('UserService')) {
            return 'export class UserService {}';
        }
        return 'mock file content';
    }),
    writeFile: jest.fn(async () => {}),
    exists: jest.fn(async () => true)
};
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm run unit-tests
      - run: pnpm run test:coverage
      
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run compile
      - run: xvfb-run -a pnpm run test
        
  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run test:performance
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && pnpm run unit-tests",
      "pre-push": "pnpm run test"
    }
  },
  "lint-staged": {
    "src/**/*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

## 📈 Test Metrics

### Key Metrics

- **Test Execution Time**
  - Unit tests: <100ms
  - Integration tests: <5 minutes
  - Full suite: <10 minutes

- **Test Coverage**
  - Line coverage: 85%+
  - Branch coverage: 80%+
  - Function coverage: 90%+

- **Test Reliability**
  - Flaky test rate: <1%
  - False positive rate: <0.1%
  - Test maintenance overhead: <5% of development time

### Monitoring

```bash
# Test execution metrics
pnpm run test:metrics

# Coverage trends over time
pnpm run coverage:history

# Performance regression detection
pnpm run test:regression
```

## 🛡️ Test Best Practices

### Do's ✅

- **Write tests first** for critical functionality
- **Use descriptive test names** that explain what's being tested
- **Test edge cases** and error conditions
- **Keep tests isolated** and independent
- **Use appropriate assertions** (strict equality vs loose)
- **Mock external dependencies** consistently
- **Clean up resources** after tests

### Don'ts ❌

- **Don't test implementation details** - test behavior
- **Don't write flaky tests** that randomly fail
- **Don't ignore failing tests** - fix them immediately
- **Don't test third-party code** - trust but verify interfaces
- **Don't make tests dependent** on each other
- **Don't use real API keys** in tests
- **Don't commit test data** with sensitive information

### Test Structure Pattern

```typescript
// AAA Pattern: Arrange, Act, Assert
test('should calculate relevance score correctly', () => {
    // Arrange
    const file = createMockFile();
    const query = 'authentication';
    
    // Act
    const score = calculateRelevance(file, query);
    
    // Assert
    assert.ok(score > 0);
    assert.ok(score <= 100);
});
```

## 🆘 Troubleshooting

### Common Issues

#### VS Code Test Runner Issues

```bash
# Clear VS Code test cache
rm -rf .vscode-test/

# Reinstall test dependencies
pnpm install --force

# Update VS Code test CLI
pnpm update @vscode/test-cli
```

#### Test Timeouts

```typescript
// Increase timeout globally
const mocha = new Mocha({
    timeout: 10000 // 10 seconds
});

// Or per test
test('slow operation', async function() {
    this.timeout(15000);
    // ... test code
});
```

#### Memory Issues

```bash
# Run with increased memory
node --max-old-space-size=4096 test/runUnitTests.js

# Monitor memory usage
node --inspect test/runUnitTests.js
```

### Getting Help

- **Documentation**: Check VS Code Extension Testing docs
- **GitHub Issues**: Search existing issues
- **Stack Overflow**: Tag questions with `vscode-extension`
- **Discord**: Ask in our development channel

---

## 📚 Additional Resources

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Documentation](https://mochajs.org/)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-6-testing-and-overall-quality-practices)
- [Istanbul Code Coverage](https://istanbul.js.org/)

---

*Keep testing! 🧪 Quality code leads to happy developers and users.*

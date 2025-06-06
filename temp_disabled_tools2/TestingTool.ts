import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

export class TestingTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'testing',
        description: 'Generate, run, and manage tests including unit tests, integration tests, and test coverage analysis',
        category: 'Testing',
        parameters: [
            { name: 'operation', description: 'Test operation: generate, run, coverage, mock, scaffold', required: true, type: 'string' },
            { name: 'target', description: 'Target file or test suite to operate on', required: true, type: 'string' },
            { name: 'testType', description: 'Type of test: unit, integration, e2e', required: false, type: 'string' },
            { name: 'framework', description: 'Testing framework: jest, mocha, vitest, cypress', required: false, type: 'string' }
        ],
        examples: [
            'Generate unit tests: { "operation": "generate", "target": "src/utils.ts", "testType": "unit" }',
            'Run specific test: { "operation": "run", "target": "src/__tests__/utils.test.ts" }',
            'Generate test coverage: { "operation": "coverage", "target": "src/" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Performing ${payload.operation} testing operation on ${payload.target}`);
            
            switch (payload.operation) {
                case 'generate':
                    return await this.generateTests(payload.target, payload.testType, payload.framework, context);
                
                case 'run':
                    return await this.runTests(payload.target, context);
                
                case 'coverage':
                    return await this.generateCoverage(payload.target, context);
                
                case 'mock':
                    return await this.generateMocks(payload.target, context);
                
                case 'scaffold':
                    return await this.scaffoldTestStructure(payload.target, payload.framework, context);
                
                default:
                    throw new Error(`Unknown testing operation: ${payload.operation}`);
            }
        } catch (error) { (error as Error).message : String(error);
            context.outputChannel.appendLine(`Testing operation failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async generateTests(target: string, testType: string = 'unit', framework: string = 'jest', context: any): Promise<{ success: boolean; message: string }> {
        const targetPath = path.resolve(context.workspaceRoot, target);
        
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Target file not found: ${target}`);
        }

        const content = fs.readFileSync(targetPath, 'utf8');
        const functions = this.extractFunctions(content);
        const classes = this.extractClasses(content);
        
        const testContent = this.generateTestContent(target, functions, classes, testType, framework);
        
        // Determine test file path
        const ext = path.extname(target);
        const baseName = path.basename(target, ext);
        const dir = path.dirname(targetPath);
        
        let testDir = path.join(dir, '__tests__');
        if (!fs.existsSync(testDir)) {
            testDir = dir; // Fallback to same directory
        }
        
        const testFileName = `${baseName}.test${ext}`;
        const testFilePath = path.join(testDir, testFileName);
        
        // Create __tests__ directory if it doesn't exist
        if (!fs.existsSync(path.dirname(testFilePath))) {
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        }
        
        fs.writeFileSync(testFilePath, testContent, 'utf8');
        
        return {
            success: true,
            message: `Generated ${testType} tests for ${path.basename(target)} at ${path.relative(context.workspaceRoot, testFilePath)}`
        };
    }

    private generateTestContent(targetFile: string, functions: string[], classes: string[], testType: string, framework: string): string {
        const importPath = this.getRelativeImportPath(targetFile);
        const moduleName = path.parse(targetFile).name;
        
        let content = '';
        
        // Add imports based on framework
        if (framework === 'jest') {
            content += `import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';\n`;
        } else if (framework === 'vitest') {
            content += `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';\n`;
        } else {
            content += `import { describe, it, expect, beforeEach, afterEach } from 'mocha';\n`;
        }
        
        content += `import * as ${moduleName} from '${importPath}';\n\n`;
        
        content += `describe('${moduleName}', () => {\n`;
        
        // Generate tests for functions
        for (const func of functions) {
            content += this.generateFunctionTest(func, moduleName, testType, framework);
        }
        
        // Generate tests for classes
        for (const cls of classes) {
            content += this.generateClassTest(cls, moduleName, testType, framework);
        }
        
        content += '});\n';
        
        return content;
    }

    private generateFunctionTest(functionName: string, moduleName: string, testType: string, framework: string): string {
        return `
    describe('${functionName}', () => {
        it('should work correctly with valid input', () => {
            // Arrange
            const input: any = {}; // TODO: Add appropriate test data
            const expected: any = {}; // TODO: Add expected result
            
            // Act
            const result = ${moduleName}.${functionName}(input);
            
            // Assert
            expect(result).toEqual(expected);
        });
        
        it('should handle edge cases', () => {
            // TODO: Add edge case tests
            expect(() => ${moduleName}.${functionName}(null)).not.toThrow();
        });
        
        it('should handle invalid input', () => {
            // TODO: Add invalid input tests
            expect(() => ${moduleName}.${functionName}(undefined)).toThrow();
        });
    });
`;
    }

    private generateClassTest(className: string, moduleName: string, testType: string, framework: string): string {
        return `
    describe('${className}', () => {
        let instance: ${moduleName}.${className};
        
        beforeEach(() => {
            instance = new ${moduleName}.${className}();
        });
        
        afterEach(() => {
            // Cleanup if needed
        });
        
        it('should create an instance', () => {
            expect(instance).toBeDefined();
            expect(instance).toBeInstanceOf(${moduleName}.${className});
        });
        
        it('should have correct initial state', () => {
            // TODO: Test initial state
            expect(instance).toBeTruthy();
        });
        
        // TODO: Add method-specific tests
    });
`;
    }

    private async runTests(target: string, context: any): Promise<{ success: boolean; message: string }> {
        const { spawn } = require('child_process');
        
        return new Promise((resolve) => {
            // Detect package manager and test script
            const packageJsonPath = path.join(context.workspaceRoot, 'package.json');
            let testCommand = 'npm test';
            
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                if (fs.existsSync(path.join(context.workspaceRoot, 'pnpm-lock.yaml'))) {
                    testCommand = 'pnpm test';
                } else if (fs.existsSync(path.join(context.workspaceRoot, 'yarn.lock'))) {
                    testCommand = 'yarn test';
                }
                
                // Add specific test file if provided
                if (target !== '.' && target !== '') {
                    testCommand += ` ${target}`;
                }
            }
            
            const [cmd, ...args] = testCommand.split(' ');
            const testProcess = spawn(cmd, args, {
                cwd: context.workspaceRoot,
                stdio: 'pipe'
            });
            
            let output = '';
            let errorOutput = '';
            
            testProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            
            testProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        message: `Tests completed successfully:\n${output}`
                    });
                } else {
                    resolve({
                        success: false,
                        message: `Tests failed with code ${code}:\n${errorOutput}\n${output}`
                    });
                }
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                testProcess.kill();
                resolve({
                    success: false,
                    message: 'Test execution timed out after 30 seconds'
                });
            }, 30000);
        });
    }

    private async generateCoverage(target: string, context: any): Promise<{ success: boolean; message: string }> {
        const { spawn } = require('child_process');
        
        return new Promise((resolve) => {
            let coverageCommand = 'npm run test:coverage';
            
            const packageJsonPath = path.join(context.workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                if (packageJson.scripts?.['test:coverage']) {
                    // Use existing coverage script
                } else if (packageJson.scripts?.test) {
                    // Try to add coverage flag
                    coverageCommand = packageJson.scripts.test.includes('jest') ? 
                        'npx jest --coverage' : 
                        'npm test -- --coverage';
                }
                
                if (fs.existsSync(path.join(context.workspaceRoot, 'pnpm-lock.yaml'))) {
                    coverageCommand = coverageCommand.replace('npm', 'pnpm');
                } else if (fs.existsSync(path.join(context.workspaceRoot, 'yarn.lock'))) {
                    coverageCommand = coverageCommand.replace('npm', 'yarn');
                }
            }
            
            const [cmd, ...args] = coverageCommand.split(' ');
            const coverageProcess = spawn(cmd, args, {
                cwd: context.workspaceRoot,
                stdio: 'pipe'
            });
            
            let output = '';
            let errorOutput = '';
            
            coverageProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            
            coverageProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            coverageProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        message: `Coverage report generated:\n${output}`
                    });
                } else {
                    resolve({
                        success: false,
                        message: `Coverage generation failed:\n${errorOutput}\n${output}`
                    });
                }
            });
        });
    }

    private async generateMocks(target: string, context: any): Promise<{ success: boolean; message: string }> {
        const targetPath = path.resolve(context.workspaceRoot, target);
        
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Target file not found: ${target}`);
        }

        const content = fs.readFileSync(targetPath, 'utf8');
        const functions = this.extractFunctions(content);
        const classes = this.extractClasses(content);
        
        let mockContent = `// Auto-generated mocks for ${target}\n\n`;
        
        // Generate function mocks
        for (const func of functions) {
            mockContent += `export const mock${this.capitalize(func)} = jest.fn();\n`;
        }
        
        // Generate class mocks
        for (const cls of classes) {
            mockContent += `
export const mock${cls} = {
    // TODO: Add mock methods
    mockMethod: jest.fn(),
};
`;
        }
        
        const mockDir = path.join(path.dirname(targetPath), '__mocks__');
        if (!fs.existsSync(mockDir)) {
            fs.mkdirSync(mockDir, { recursive: true });
        }
        
        const mockFileName = path.basename(target);
        const mockFilePath = path.join(mockDir, mockFileName);
        
        fs.writeFileSync(mockFilePath, mockContent, 'utf8');
        
        return {
            success: true,
            message: `Generated mocks for ${path.basename(target)} at ${path.relative(context.workspaceRoot, mockFilePath)}`
        };
    }

    private async scaffoldTestStructure(target: string, framework: string = 'jest', context: any): Promise<{ success: boolean; message: string }> {
        const targetPath = path.resolve(context.workspaceRoot, target);
        
        // Create test directories
        const testDirs = ['__tests__', '__mocks__', 'test/unit', 'test/integration', 'test/e2e'];
        let createdDirs = 0;
        
        for (const dir of testDirs) {
            const dirPath = path.join(targetPath, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                createdDirs++;
            }
        }
        
        // Create test configuration files
        const configFiles = this.getTestConfigFiles(framework);
        let createdFiles = 0;
        
        for (const [fileName, content] of Object.entries(configFiles)) {
            const filePath = path.join(targetPath, fileName);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content, 'utf8');
                createdFiles++;
            }
        }
        
        return {
            success: true,
            message: `Scaffolded test structure: ${createdDirs} directories and ${createdFiles} config files created`
        };
    }

    private getTestConfigFiles(framework: string): Record<string, string> {
        const configs: Record<string, string> = {};
        
        if (framework === 'jest') {
            configs['jest.config.js'] = `module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html']
};`;
        } else if (framework === 'vitest') {
            configs['vitest.config.ts'] = `import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'c8',
            reporter: ['text', 'json', 'html']
        }
    }
});`;
        }
        
        return configs;
    }

    private extractFunctions(content: string): string[] {
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
        const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
        
        const functions: string[] = [];
        let match;
        
        while ((match = functionRegex.exec(content)) !== null) {
            functions.push(match[1 as keyof typeof match]);
        }
        
        while ((match = arrowFunctionRegex.exec(content)) !== null) {
            functions.push(match[1 as keyof typeof match]);
        }
        
        return [...new Set(functions)]; // Remove duplicates
    }

    private extractClasses(content: string): string[] {
        const classRegex = /(?:export\s+)?class\s+(\w+)/g;
        const classes: string[] = [];
        let match;
        
        while ((match = classRegex.exec(content)) !== null) {
            classes.push(match[1 as keyof typeof match]);
        }
        
        return classes;
    }

    private getRelativeImportPath(targetFile: string): string {
        return targetFile.startsWith('./') ? targetFile : `./${targetFile}`;
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

export default new TestingTool();

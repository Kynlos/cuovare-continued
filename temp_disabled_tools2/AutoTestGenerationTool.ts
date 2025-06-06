import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface TestTemplate {
    framework: string;
    imports: string[];
    setup: string;
    teardown: string;
    testCase: (methodName: string, params: any[], returnType: string) => string;
}

interface GeneratedTest {
    fileName: string;
    content: string;
    framework: string;
    testCount: number;
}

export class AutoTestGenerationTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'auto_test_generation',
        description: 'Generate comprehensive unit tests for selected code with multiple testing frameworks support',
        category: 'Testing',
        parameters: [
            { name: 'target', description: 'File or directory to generate tests for', required: true, type: 'string' },
            { name: 'framework', description: 'Testing framework: jest, mocha, vitest, jasmine, chai (auto-detect if not specified)', required: false, type: 'string' },
            { name: 'testType', description: 'Type of tests: unit, integration, e2e (default: unit)', required: false, type: 'string' },
            { name: 'coverage', description: 'Test coverage level: basic, comprehensive, edge-cases (default: comprehensive)', required: false, type: 'string' },
            { name: 'mockExternal', description: 'Auto-mock external dependencies (default: true)', required: false, type: 'boolean' },
            { name: 'outputPath', description: 'Custom output path for test files (default: auto-detect)', required: false, type: 'string' },
            { name: 'includeSetup', description: 'Include setup and teardown methods (default: true)', required: false, type: 'boolean' }
        ],
        examples: [
            'Generate tests for file: { "target": "src/utils/validator.ts" }',
            'Generate Jest tests: { "target": "src/services", "framework": "jest", "coverage": "comprehensive" }',
            'Generate integration tests: { "target": "src/api/auth.ts", "testType": "integration", "mockExternal": false }',
            'Custom output path: { "target": "src/calculator.js", "outputPath": "tests/unit" }'
        ]
    };

    private testFrameworks: Map<string, TestTemplate> = new Map();

    constructor() {
        this.initializeFrameworks();
    }

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Generating tests for: ${payload.target}`);
            
            const targetPath = path.resolve(context.workspaceRoot, payload.target);
            
            if (!targetPath.startsWith(context.workspaceRoot)) {
                throw new Error('Target path outside workspace not allowed');
            }
            
            if (!fs.existsSync(targetPath)) {
                throw new Error(`Target not found: ${payload.target}`);
            }

            const framework = payload.framework || await this.detectFramework(context.workspaceRoot);
            const testType = payload.testType || 'unit';
            const coverage = payload.coverage || 'comprehensive';
            const mockExternal = payload.mockExternal !== false;
            const includeSetup = payload.includeSetup !== false;

            context.onProgress?.(`Using ${framework} framework for ${testType} tests`);

            // Collect source files
            const sourceFiles = await this.collectSourceFiles(targetPath);
            context.onProgress?.(`Found ${sourceFiles.length} source files to test`);

            if (sourceFiles.length === 0) {
                return {
                    success: true,
                    message: 'No source files found to generate tests for',
                    data: { generated: [] }
                };
            }

            const generatedTests: GeneratedTest[] = [];

            // Generate tests for each file
            for (let i = 0; i < sourceFiles.length; i++) {
                const sourceFile = sourceFiles[i];
                context.onProgress?.(`Generating tests ${i + 1}/${sourceFiles.length}: ${path.relative(context.workspaceRoot, sourceFile)}`);
                
                const testFile = await this.generateTestFile(
                    sourceFile,
                    context.workspaceRoot,
                    framework,
                    testType,
                    coverage,
                    mockExternal,
                    includeSetup,
                    payload.outputPath
                );
                
                if (testFile) {
                    generatedTests.push(testFile);
                }
            }

            // Write test files to disk
            await this.writeTestFiles(generatedTests, context);

            const message = `Generated ${generatedTests.length} test files using ${framework}`;
            const totalTests = generatedTests.reduce((sum, test) => sum + test.testCount, 0);

            return {
                success: true,
                message: `${message}\n📝 Total test cases: ${totalTests}`,
                data: {
                    generated: generatedTests.map(t => ({
                        fileName: t.fileName,
                        framework: t.framework,
                        testCount: t.testCount
                    })),
                    summary: {
                        filesGenerated: generatedTests.length,
                        totalTests,
                        framework
                    }
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Test generation failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private initializeFrameworks(): void {
        // Jest template
        this.testFrameworks.set('jest', {
            framework: 'jest',
            imports: [
                "import { jest } from '@jest/globals';"
            ],
            setup: `beforeEach(() => {
    jest.clearAllMocks();
});`,
            teardown: `afterEach(() => {
    jest.restoreAllMocks();
});`,
            testCase: (methodName: string, params: any[], returnType: string) => `
test('${methodName} should work correctly', () => {
    // Arrange
    const expected = /* expected result */;
    
    // Act
    const result = ${methodName}(${params.map(p => `/* ${p} */`).join(', ')});
    
    // Assert
    expect(result).toBe(expected);
});`
        });

        // Mocha template
        this.testFrameworks.set('mocha', {
            framework: 'mocha',
            imports: [
                "import { expect } from 'chai';",
                "import sinon from 'sinon';"
            ],
            setup: `beforeEach(() => {
    sinon.restore();
});`,
            teardown: `afterEach(() => {
    sinon.restore();
});`,
            testCase: (methodName: string, params: any[], returnType: string) => `
it('should ${methodName} correctly', () => {
    // Arrange
    const expected = /* expected result */;
    
    // Act
    const result = ${methodName}(${params.map(p => `/* ${p} */`).join(', ')});
    
    // Assert
    expect(result).to.equal(expected);
});`
        });

        // Vitest template
        this.testFrameworks.set('vitest', {
            framework: 'vitest',
            imports: [
                "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';"
            ],
            setup: `beforeEach(() => {
    vi.clearAllMocks();
});`,
            teardown: `afterEach(() => {
    vi.restoreAllMocks();
});`,
            testCase: (methodName: string, params: any[], returnType: string) => `
it('${methodName} should work correctly', () => {
    // Arrange
    const expected = /* expected result */;
    
    // Act
    const result = ${methodName}(${params.map(p => `/* ${p} */`).join(', ')});
    
    // Assert
    expect(result).toBe(expected);
});`
        });
    }

    private async detectFramework(workspaceRoot: string): Promise<string> {
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            if (dependencies['vitest']) return 'vitest';
            if (dependencies['jest']) return 'jest';
            if (dependencies['mocha']) return 'mocha';
            if (dependencies['jasmine']) return 'jasmine';
        }
        
        // Default to Jest
        return 'jest';
    }

    private async collectSourceFiles(targetPath: string): Promise<string[]> {
        const files: string[] = [];
        
        if (fs.statSync(targetPath).isFile()) {
            if (this.isSourceFile(targetPath)) {
                return [targetPath];
            }
            return [];
        }

        const collectRecursively = (dir: string) => {
            const entries = fs.readdirSync(dir);
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'build', 'test', 'tests', '__tests__'].includes(entry)) {
                        collectRecursively(fullPath);
                    }
                } else if (stat.isFile()) {
                    if (this.isSourceFile(fullPath) && !this.isTestFile(fullPath)) {
                        files.push(fullPath);
                    }
                }
            }
        };

        collectRecursively(targetPath);
        return files;
    }

    private isSourceFile(filePath: string): boolean {
        const ext = path.extname(filePath);
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext);
    }

    private isTestFile(filePath: string): boolean {
        const fileName = path.basename(filePath);
        return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(fileName);
    }

    private async generateTestFile(
        sourceFile: string,
        workspaceRoot: string,
        framework: string,
        testType: string,
        coverage: string,
        mockExternal: boolean,
        includeSetup: boolean,
        customOutputPath?: string
    ): Promise<GeneratedTest | null> {
        try {
            const content = fs.readFileSync(sourceFile, 'utf8');
            const relativePath = path.relative(workspaceRoot, sourceFile);
            const template = this.testFrameworks.get(framework);
            
            if (!template) {
                throw new Error(`Unsupported framework: ${framework}`);
            }

            // Analyze source code
            const analysis = this.analyzeSourceCode(content, relativePath);
            
            if (analysis.functions.length === 0 && analysis.classes.length === 0) {
                return null; // No testable code found
            }

            // Generate test content
            const testContent = this.generateTestContent(
                analysis,
                template,
                relativePath,
                testType,
                coverage,
                mockExternal,
                includeSetup
            );

            // Determine output file path
            const outputPath = this.getTestFilePath(sourceFile, workspaceRoot, framework, customOutputPath);
            
            return {
                fileName: outputPath,
                content: testContent,
                framework,
                testCount: analysis.functions.length + analysis.classes.reduce((sum, cls) => sum + cls.methods.length, 0)
            };

        } catch (error) {
            console.error(`Failed to generate test for ${sourceFile}:`, error);
            return null;
        }
    }

    private analyzeSourceCode(content: string, filePath: string) {
        const analysis = {
            imports: [] as string[],
            functions: [] as Array<{ name: string; params: string[]; returnType?: string }>,
            classes: [] as Array<{ name: string; methods: Array<{ name: string; params: string[] }> }>,
            exports: [] as string[]
        };

        // Extract imports
        const importMatches = content.match(/import\s+.*?from\s+['"].*?['"];?/g) || [];
        analysis.imports = importMatches.map(imp => imp.trim());

        // Extract functions
        const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g) || [];
        functionMatches.forEach(match => {
            const nameMatch = match.match(/function\s+(\w+)/);
            const paramsMatch = match.match(/\(([^)]*)\)/);
            if (nameMatch) {
                analysis.functions.push({
                    name: nameMatch[1],
                    params: paramsMatch ? paramsMatch[1].split(',').map(p => p.trim()).filter(p => p) : []
                });
            }
        });

        // Extract arrow functions
        const arrowFunctionMatches = content.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g) || [];
        arrowFunctionMatches.forEach(match => {
            const nameMatch = match.match(/(?:const|let|var)\s+(\w+)/);
            const paramsMatch = match.match(/\(([^)]*)\)/);
            if (nameMatch) {
                analysis.functions.push({
                    name: nameMatch[1],
                    params: paramsMatch ? paramsMatch[1].split(',').map(p => p.trim()).filter(p => p) : []
                });
            }
        });

        // Extract classes and methods
        const classMatches = content.match(/class\s+(\w+)(?:\s+extends\s+\w+)?\s*{[^}]*}/g) || [];
        classMatches.forEach(classMatch => {
            const classNameMatch = classMatch.match(/class\s+(\w+)/);
            if (classNameMatch) {
                const className = classNameMatch[1];
                const methods: Array<{ name: string; params: string[] }> = [];
                
                const methodMatches = classMatch.match(/(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)/g) || [];
                methodMatches.forEach(methodMatch => {
                    const methodNameMatch = methodMatch.match(/(\w+)\s*\(/);
                    const paramsMatch = methodMatch.match(/\(([^)]*)\)/);
                    if (methodNameMatch && methodNameMatch[1] !== className) { // Skip constructor
                        methods.push({
                            name: methodNameMatch[1],
                            params: paramsMatch ? paramsMatch[1].split(',').map(p => p.trim()).filter(p => p) : []
                        });
                    }
                });
                
                analysis.classes.push({ name: className, methods });
            }
        });

        return analysis;
    }

    private generateTestContent(
        analysis: any,
        template: TestTemplate,
        sourceFilePath: string,
        testType: string,
        coverage: string,
        mockExternal: boolean,
        includeSetup: boolean
    ): string {
        const sourceFileName = path.basename(sourceFilePath, path.extname(sourceFilePath));
        const importPath = `./${sourceFileName}`;
        
        let content = `// Auto-generated tests for ${sourceFilePath}\n`;
        content += `// Generated on ${new Date().toISOString()}\n\n`;
        
        // Add framework imports
        content += template.imports.join('\n') + '\n';
        
        // Add source imports
        if (analysis.functions.length > 0) {
            const functionNames = analysis.functions.map((f: any) => f.name).join(', ');
            content += `import { ${functionNames} } from '${importPath}';\n`;
        }
        
        if (analysis.classes.length > 0) {
            const classNames = analysis.classes.map((c: any) => c.name).join(', ');
            content += `import { ${classNames} } from '${importPath}';\n`;
        }
        
        content += '\n';

        // Add mocks for external dependencies if enabled
        if (mockExternal && analysis.imports.length > 0) {
            content += '// Mock external dependencies\n';
            analysis.imports.forEach((imp: string) => {
                const moduleMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
                if (moduleMatch && !moduleMatch[1].startsWith('.')) {
                    if (template.framework === 'jest') {
                        content += `jest.mock('${moduleMatch[1]}');\n`;
                    } else if (template.framework === 'vitest') {
                        content += `vi.mock('${moduleMatch[1]}');\n`;
                    }
                }
            });
            content += '\n';
        }

        // Generate tests for functions
        if (analysis.functions.length > 0) {
            content += `describe('${sourceFileName} functions', () => {\n`;
            
            if (includeSetup) {
                content += `  ${template.setup}\n\n`;
                content += `  ${template.teardown}\n\n`;
            }
            
            analysis.functions.forEach((func: any) => {
                content += `  ${template.testCase(func.name, func.params, func.returnType || 'any').replace(/\n/g, '\n  ')}\n`;
                
                if (coverage === 'comprehensive' || coverage === 'edge-cases') {
                    content += `\n  test('${func.name} should handle edge cases', () => {\n`;
                    content += `    // Test with null/undefined inputs\n`;
                    content += `    // Test with empty inputs\n`;
                    content += `    // Test with boundary values\n`;
                    content += `    expect(() => ${func.name}(${func.params.map(() => 'null').join(', ')})).not.toThrow();\n`;
                    content += `  });\n`;
                }
                
                if (coverage === 'edge-cases') {
                    content += `\n  test('${func.name} should handle errors gracefully', () => {\n`;
                    content += `    // Test error conditions\n`;
                    content += `    // Test invalid inputs\n`;
                    content += `    expect(() => ${func.name}(${func.params.map(() => 'undefined').join(', ')})).not.toThrow();\n`;
                    content += `  });\n`;
                }
            });
            
            content += '});\n\n';
        }

        // Generate tests for classes
        analysis.classes.forEach((cls: any) => {
            content += `describe('${cls.name} class', () => {\n`;
            content += `  let instance: ${cls.name};\n\n`;
            
            if (includeSetup) {
                content += `  beforeEach(() => {\n`;
                content += `    instance = new ${cls.name}();\n`;
                content += `  });\n\n`;
            }
            
            content += `  test('should create instance', () => {\n`;
            content += `    expect(instance).toBeInstanceOf(${cls.name});\n`;
            content += `  });\n\n`;
            
            cls.methods.forEach((method: any) => {
                content += `  test('${method.name} should work correctly', () => {\n`;
                content += `    // Arrange\n`;
                content += `    const expected = /* expected result */;\n\n`;
                content += `    // Act\n`;
                content += `    const result = instance.${method.name}(${method.params.map(() => '/* param */').join(', ')});\n\n`;
                content += `    // Assert\n`;
                content += `    expect(result).toBe(expected);\n`;
                content += `  });\n\n`;
            });
            
            content += '});\n\n';
        });

        return content;
    }

    private getTestFilePath(sourceFile: string, workspaceRoot: string, framework: string, customOutputPath?: string): string {
        const sourceDir = path.dirname(sourceFile);
        const baseName = path.basename(sourceFile, path.extname(sourceFile));
        const ext = path.extname(sourceFile);
        
        if (customOutputPath) {
            const outputDir = path.resolve(workspaceRoot, customOutputPath);
            return path.join(outputDir, `${baseName}.test${ext}`);
        }
        
        // Auto-detect test directory structure
        const possibleTestDirs = [
            path.join(sourceDir, '__tests__'),
            path.join(sourceDir, 'tests'),
            path.join(workspaceRoot, 'test'),
            path.join(workspaceRoot, 'tests'),
            path.join(workspaceRoot, '__tests__')
        ];
        
        // Use existing test directory or create alongside source
        for (const testDir of possibleTestDirs) {
            if (fs.existsSync(testDir)) {
                return path.join(testDir, `${baseName}.test${ext}`);
            }
        }
        
        // Create test file alongside source
        return path.join(sourceDir, `${baseName}.test${ext}`);
    }

    private async writeTestFiles(generatedTests: GeneratedTest[], context: { workspaceRoot: string; outputChannel: any }): Promise<void> {
        for (const test of generatedTests) {
            const dir = path.dirname(test.fileName);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Write test file
            fs.writeFileSync(test.fileName, test.content, 'utf8');
            context.outputChannel.appendLine(`Generated: ${path.relative(context.workspaceRoot, test.fileName)}`);
            
            // Try to open in VS Code
            try {
                const vscode = require('vscode');
                const uri = vscode.Uri.file(test.fileName);
                await vscode.window.showTextDocument(uri, { preview: false });
            } catch {
                // VS Code not available
            }
        }
    }
}

export default new AutoTestGenerationTool();

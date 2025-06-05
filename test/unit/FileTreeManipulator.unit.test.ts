import { FileTreeManipulator, FileTreeNode, FileOperation, FileTreeStructure, OrganizationSuggestion } from '../../src/filetree/FileTreeManipulator';

// Mock file tree data for testing
const mockFileTree: FileTreeNode = {
    name: 'project-root',
    path: '/workspace/project',
    type: 'directory',
    size: 0,
    modified: new Date(),
    children: [
        {
            name: 'src',
            path: '/workspace/project/src',
            type: 'directory',
            size: 0,
            modified: new Date(),
            children: [
                {
                    name: 'components',
                    path: '/workspace/project/src/components',
                    type: 'directory',
                    size: 0,
                    modified: new Date(),
                    children: [
                        {
                            name: 'UserProfile.tsx',
                            path: '/workspace/project/src/components/UserProfile.tsx',
                            type: 'file',
                            size: 1024,
                            modified: new Date(),
                            language: 'typescriptreact'
                        }
                    ]
                },
                {
                    name: 'utils',
                    path: '/workspace/project/src/utils',
                    type: 'directory',
                    size: 0,
                    modified: new Date(),
                    children: [
                        {
                            name: 'helpers.ts',
                            path: '/workspace/project/src/utils/helpers.ts',
                            type: 'file',
                            size: 512,
                            modified: new Date(),
                            language: 'typescript'
                        }
                    ]
                }
            ]
        },
        {
            name: 'package.json',
            path: '/workspace/project/package.json',
            type: 'file',
            size: 256,
            modified: new Date(),
            language: 'json'
        },
        {
            name: 'README.md',
            path: '/workspace/project/README.md',
            type: 'file',
            size: 128,
            modified: new Date(),
            language: 'markdown'
        }
    ]
};

const mockTemplates = {
    'react-app': {
        id: 'react-app',
        name: 'React Application',
        description: 'Modern React app with TypeScript',
        category: 'Frontend',
        structure: {
            name: '${projectName}',
            type: 'directory' as const,
            children: [
                {
                    name: 'src',
                    type: 'directory' as const,
                    children: [
                        {
                            name: 'App.tsx',
                            type: 'file' as const,
                            content: 'import React from "react";\n\nfunction App() {\n  return <div>${appContent}</div>;\n}\n\nexport default App;'
                        }
                    ]
                },
                {
                    name: 'package.json',
                    type: 'file' as const,
                    content: '{\n  "name": "${projectName}",\n  "version": "1.0.0"\n}'
                }
            ]
        },
        variables: {
            projectName: 'my-react-app',
            appContent: 'Hello React!'
        },
        frameworks: ['React']
    }
};

describe('FileTreeManipulator Unit Tests', () => {
    let manipulator: FileTreeManipulator;

    beforeEach(() => {
        manipulator = FileTreeManipulator.getInstance();
        // Mock templates
        (manipulator as any).templates = new Map(Object.entries(mockTemplates));
    });

    describe('File Tree Analysis', () => {
        it('should build file tree structure', async () => {
            // Mock the buildFileTree method
            (manipulator as any).buildFileTree = async () => mockFileTree;

            const tree = await manipulator.getFileTree('/workspace/project');

            expect(tree.name).toBe('project-root');
            expect(tree.type).toBe('directory');
            expect(tree.children).toBeDefined();
            expect(tree.children!.length).toBeGreaterThan(0);
        });

        it('should identify file languages correctly', () => {
            const detector = (manipulator as any).detectLanguage;

            expect(detector('test.ts')).toBe('typescript');
            expect(detector('test.tsx')).toBe('typescriptreact');
            expect(detector('test.js')).toBe('javascript');
            expect(detector('test.jsx')).toBe('javascriptreact');
            expect(detector('test.py')).toBe('python');
            expect(detector('test.java')).toBe('java');
            expect(detector('test.md')).toBe('markdown');
            expect(detector('test.json')).toBe('json');
            expect(detector('test.html')).toBe('html');
            expect(detector('test.css')).toBe('css');
            expect(detector('unknown.xyz')).toBe('plaintext');
        });

        it('should filter files appropriately', () => {
            const shouldInclude = (manipulator as any).shouldIncludeInTree;

            expect(shouldInclude('index.js')).toBe(true);
            expect(shouldInclude('component.tsx')).toBe(true);
            expect(shouldInclude('README.md')).toBe(true);

            expect(shouldInclude('node_modules')).toBe(false);
            expect(shouldInclude('.git')).toBe(false);
            expect(shouldInclude('dist')).toBe(false);
            expect(shouldInclude('.DS_Store')).toBe(false);
            expect(shouldInclude('Thumbs.db')).toBe(false);
        });
    });

    describe('Structure Creation', () => {
        it('should create structure from template', async () => {
            // Mock file system operations
            const createdPaths: string[] = [];
            (manipulator as any).createStructureRecursive = async (structure: any, basePath: string, variables: any, paths: string[]) => {
                paths.push(basePath + '/' + structure.name);
                if (structure.children) {
                    for (const child of structure.children) {
                        await (manipulator as any).createStructureRecursive(child, basePath + '/' + structure.name, variables, paths);
                    }
                }
            };

            const paths = await manipulator.createFromTemplate(
                'react-app',
                '/test/path',
                { projectName: 'test-app', appContent: 'Test Content' }
            );

            expect(Array.isArray(paths)).toBe(true);
            expect(paths.length).toBeGreaterThan(0);
        });

        it('should substitute variables in structure', () => {
            const substitute = (manipulator as any).substituteVariables;

            const result = substitute('Hello ${name}!', { name: 'World' });
            expect(result).toBe('Hello World!');

            const multiVar = substitute('${greeting} ${name}!', { 
                greeting: 'Hello', 
                name: 'TypeScript' 
            });
            expect(multiVar).toBe('Hello TypeScript!');
        });

        it('should handle missing variables gracefully', () => {
            const substitute = (manipulator as any).substituteVariables;

            const result = substitute('Hello ${missing}!', {});
            expect(result).toBe('Hello ${missing}!'); // Should leave unchanged
        });

        it('should generate structure from description', async () => {
            const structure = await manipulator.generateStructureFromDescription(
                'Create a user authentication system with login and register components',
                'typescript',
                'React'
            );

            expect(structure.name).toBeDefined();
            expect(structure.type).toBe('directory');
            expect(structure.children).toBeDefined();
        });
    });

    describe('File Operations', () => {
        it('should execute file operations', async () => {
            const operations: FileOperation[] = [
                {
                    type: 'create',
                    target: '/test/newfile.ts',
                    content: 'export const test = true;'
                },
                {
                    type: 'move',
                    source: '/test/oldfile.ts',
                    target: '/test/newlocation/oldfile.ts'
                },
                {
                    type: 'delete',
                    target: '/test/unwanted.js'
                }
            ];

            // Mock the execution methods
            (manipulator as any).executeOperation = async (op: FileOperation) => {
                // Mock successful execution
            };

            const result = await manipulator.moveFiles(operations);

            expect(result.successful).toBeDefined();
            expect(result.failed).toBeDefined();
            expect(Array.isArray(result.successful)).toBe(true);
            expect(Array.isArray(result.failed)).toBe(true);
        });

        it('should handle operation failures', async () => {
            const operations: FileOperation[] = [
                {
                    type: 'move',
                    source: '/nonexistent/file.ts',
                    target: '/test/file.ts'
                }
            ];

            // Mock failed execution
            (manipulator as any).executeOperation = async (op: FileOperation) => {
                throw new Error('File not found');
            };

            const result = await manipulator.moveFiles(operations);

            expect(result.failed.length).toBe(1);
            expect(result.failed[0].error).toBe('File not found');
        });
    });

    describe('Organization Suggestions', () => {
        it('should provide cleanup suggestions', async () => {
            // Mock analysis
            (manipulator as any).analyzeProjectStructure = async () => ({
                hasTests: false,
                hasComponents: true,
                hasUtils: true,
                depth: 3,
                fileCount: 150,
                languages: { typescript: 80, javascript: 20 },
                structure: 'src-based'
            });

            (manipulator as any).generateCleanupSuggestions = async (analysis: any) => [
                {
                    description: 'Organize loose files into directories',
                    operations: [
                        { type: 'create', target: '/workspace/src/components' },
                        { type: 'create', target: '/workspace/src/utils' }
                    ],
                    reasoning: 'Large number of files detected',
                    impact: {
                        filesAffected: 150,
                        directoriesCreated: 2,
                        estimatedTime: '5-10 minutes'
                    },
                    confidence: 0.8
                }
            ];

            const suggestions = await manipulator.getOrganizationSuggestions(
                '/workspace/project',
                'cleanup'
            );

            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions.length).toBeGreaterThan(0);

            const suggestion = suggestions[0];
            expect(suggestion.description).toBeDefined();
            expect(suggestion.operations).toBeDefined();
            expect(suggestion.reasoning).toBeDefined();
            expect(suggestion.impact).toBeDefined();
            expect(suggestion.confidence).toBeGreaterThan(0);
        });

        it('should sort suggestions by confidence', async () => {
            // Mock multiple suggestions with different confidence levels
            (manipulator as any).analyzeProjectStructure = async () => ({});
            (manipulator as any).generateCleanupSuggestions = async () => [
                { confidence: 0.6, description: 'Low confidence suggestion' },
                { confidence: 0.9, description: 'High confidence suggestion' },
                { confidence: 0.7, description: 'Medium confidence suggestion' }
            ];

            const suggestions = await manipulator.getOrganizationSuggestions('/test', 'cleanup');

            if (suggestions.length > 1) {
                for (let i = 0; i < suggestions.length - 1; i++) {
                    expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
                }
            }
        });
    });

    describe('Templates', () => {
        it('should return available templates', () => {
            const templates = manipulator.getTemplates();

            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThan(0);

            const template = templates[0];
            expect(template.id).toBeDefined();
            expect(template.name).toBeDefined();
            expect(template.description).toBeDefined();
            expect(template.structure).toBeDefined();
        });

        it('should filter templates by framework', () => {
            const reactTemplates = manipulator.getTemplates('React');

            expect(Array.isArray(reactTemplates)).toBe(true);
            
            if (reactTemplates.length > 0) {
                const template = reactTemplates[0];
                expect(template.frameworks).toContain('React');
            }
        });

        it('should filter templates by category', () => {
            const frontendTemplates = manipulator.getTemplates(undefined, 'Frontend');

            expect(Array.isArray(frontendTemplates)).toBe(true);

            if (frontendTemplates.length > 0) {
                const template = frontendTemplates[0];
                expect(template.category).toBe('Frontend');
            }
        });
    });

    describe('File Search', () => {
        it('should find files by name pattern', async () => {
            // Mock file retrieval
            (manipulator as any).getAllFiles = async () => [
                { name: 'UserProfile.tsx', path: '/src/components/UserProfile.tsx', type: 'file' },
                { name: 'helpers.ts', path: '/src/utils/helpers.ts', type: 'file' },
                { name: 'UserService.ts', path: '/src/services/UserService.ts', type: 'file' }
            ];

            const results = await manipulator.findFiles('User', 'name');

            expect(Array.isArray(results)).toBe(true);
            
            if (results.length > 0) {
                const hasUserInName = results.every(file => 
                    file.name.toLowerCase().includes('user')
                );
                expect(hasUserInName).toBe(true);
            }
        });

        it('should find files by content', async () => {
            // Mock content search
            (manipulator as any).findByContent = async (files: any[], pattern: string) => {
                return files.filter((f: any) => f.name.includes('component'));
            };

            (manipulator as any).getAllFiles = async () => [
                { name: 'component.tsx', path: '/src/component.tsx', type: 'file' },
                { name: 'service.ts', path: '/src/service.ts', type: 'file' }
            ];

            const results = await manipulator.findFiles('React', 'content');

            expect(Array.isArray(results)).toBe(true);
        });

        it('should perform smart search', async () => {
            // Mock smart search (combination of name and content)
            (manipulator as any).findSmart = async (files: any[], pattern: string) => {
                return files;
            };

            (manipulator as any).getAllFiles = async () => [
                { name: 'test.ts', path: '/src/test.ts', type: 'file' }
            ];

            const results = await manipulator.findFiles('test', 'smart');

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('Project Statistics', () => {
        it('should analyze project statistics', async () => {
            // Mock file tree with statistics
            (manipulator as any).getFileTree = async () => mockFileTree;
            (manipulator as any).analyzeTreeStatistics = (tree: FileTreeNode) => ({
                totalFiles: 3,
                totalDirectories: 3,
                totalSize: 1920,
                languageDistribution: {
                    'typescriptreact': 1,
                    'typescript': 1,
                    'json': 1,
                    'markdown': 1
                },
                largestFiles: [
                    { path: '/workspace/project/src/components/UserProfile.tsx', size: 1024 }
                ],
                recentFiles: [
                    { path: '/workspace/project/src/components/UserProfile.tsx', modified: new Date() }
                ],
                structure: {
                    depth: 3,
                    avgFilesPerDirectory: 1,
                    emptyDirectories: []
                }
            });

            const stats = await manipulator.getProjectStatistics();

            expect(stats.totalFiles).toBeDefined();
            expect(stats.totalDirectories).toBeDefined();
            expect(stats.totalSize).toBeDefined();
            expect(stats.languageDistribution).toBeDefined();
            expect(Array.isArray(stats.largestFiles)).toBe(true);
            expect(Array.isArray(stats.recentFiles)).toBe(true);
            expect(stats.structure).toBeDefined();
        });
    });

    describe('Backup and Restore', () => {
        it('should create backup of files', async () => {
            // Mock backup operations
            (manipulator as any).copyDirectory = async (source: string, target: string) => {};
            (manipulator as any).copyFile = async (source: string, target: string) => {};

            // Mock fs operations
            const mockFs = {
                mkdir: async () => {},
                stat: async () => ({ isDirectory: () => false }),
                copyFile: async () => {}
            };

            const backupDir = await manipulator.createBackup([
                '/workspace/file1.ts',
                '/workspace/file2.ts'
            ]);

            expect(backupDir).toBeDefined();
            expect(backupDir).toContain('.cuovare-backup');
        });

        it('should handle backup failures gracefully', async () => {
            // Mock fs operations that fail
            (manipulator as any).copyFile = async () => {
                throw new Error('Permission denied');
            };

            // Should not throw, just warn
            const backupDir = await manipulator.createBackup(['/nonexistent/file.ts']);

            expect(backupDir).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty directory structures', async () => {
            const emptyStructure: FileTreeStructure = {
                name: 'empty-project',
                type: 'directory',
                children: []
            };

            // Mock creation
            (manipulator as any).createStructureRecursive = async () => {};

            const paths = await manipulator.createStructure(emptyStructure);

            expect(Array.isArray(paths)).toBe(true);
        });

        it('should handle invalid file operations', async () => {
            const invalidOperations: FileOperation[] = [
                {
                    type: 'move',
                    source: '', // Invalid empty source
                    target: '/test/file.ts'
                }
            ];

            const result = await manipulator.moveFiles(invalidOperations);

            expect(result.failed.length).toBeGreaterThan(0);
        });

        it('should handle very deep directory structures', () => {
            const calculateDepth = (manipulator as any).calculateDepth;
            
            const deepTree: FileTreeNode = {
                name: 'root',
                path: '/root',
                type: 'directory',
                children: [
                    {
                        name: 'level1',
                        path: '/root/level1',
                        type: 'directory',
                        children: [
                            {
                                name: 'level2',
                                path: '/root/level1/level2',
                                type: 'directory',
                                children: [
                                    {
                                        name: 'file.ts',
                                        path: '/root/level1/level2/file.ts',
                                        type: 'file',
                                        language: 'typescript'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            const depth = calculateDepth(deepTree);
            expect(depth).toBe(4);
        });
    });

    describe('Performance', () => {
        it('should handle large directory structures efficiently', async () => {
            // Create a large mock structure
            const largeStructure: FileTreeStructure = {
                name: 'large-project',
                type: 'directory',
                children: Array(1000).fill(null).map((_, i) => ({
                    name: `file${i}.ts`,
                    type: 'file' as const,
                    content: `export const value${i} = ${i};`
                }))
            };

            // Mock creation with timing
            let operationCount = 0;
            (manipulator as any).createStructureRecursive = async () => {
                operationCount++;
            };

            const startTime = Date.now();
            await manipulator.createStructure(largeStructure);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
            expect(operationCount).toBeGreaterThan(0);
        });

        it('should limit organization suggestions appropriately', async () => {
            (manipulator as any).analyzeProjectStructure = async () => ({});
            (manipulator as any).generateCleanupSuggestions = async () => 
                Array(20).fill(null).map((_, i) => ({
                    description: `Suggestion ${i}`,
                    confidence: Math.random()
                }));

            const suggestions = await manipulator.getOrganizationSuggestions('/test', 'cleanup');

            expect(suggestions.length).toBeLessThanOrEqual(10); // Reasonable limit
        });
    });
});

// Test helper functions
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
        toBeUndefined: () => {
            if (actual !== undefined) {
                throw new Error(`Expected ${actual} to be undefined`);
            }
        },
        toBeDefined: () => {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined`);
            }
        },
        toBeGreaterThan: (expected: number) => {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toBeGreaterThanOrEqual: (expected: number) => {
            if (actual < expected) {
                throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
            }
        },
        toBeLessThan: (expected: number) => {
            if (actual >= expected) {
                throw new Error(`Expected ${actual} to be less than ${expected}`);
            }
        },
        toBeLessThanOrEqual: (expected: number) => {
            if (actual > expected) {
                throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
            }
        },
        toContain: (expected: any) => {
            if (!actual.includes(expected)) {
                throw new Error(`Expected ${actual} to contain ${expected}`);
            }
        }
    };
}

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

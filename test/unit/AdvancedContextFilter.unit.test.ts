import { AdvancedContextFilter, ContextFile, FilterCriteria } from '../../src/context/AdvancedContextFilter';

// Mock VS Code and file system dependencies
const mockFiles: ContextFile[] = [
    {
        path: 'src/components/UserProfile.tsx',
        content: 'import React from "react";\n\ninterface UserProfileProps {\n  user: User;\n}\n\nconst UserProfile: React.FC<UserProfileProps> = ({ user }) => {\n  return <div>{user.name}</div>;\n};',
        score: 0.7,
        size: 256,
        lastModified: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        language: 'typescriptreact',
        priority: 'high',
        reasons: ['React component', 'TypeScript']
    },
    {
        path: 'src/utils/helpers.ts',
        content: 'export function formatDate(date: Date): string {\n  return date.toLocaleDateString();\n}\n\nexport function validateEmail(email: string): boolean {\n  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);\n}',
        score: 0.4,
        size: 180,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        language: 'typescript',
        priority: 'medium',
        reasons: ['Utility functions']
    },
    {
        path: 'node_modules/react/index.js',
        content: '// React library code...',
        score: 0.1,
        size: 50000,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
        language: 'javascript',
        priority: 'low',
        reasons: ['Third-party library']
    },
    {
        path: 'src/auth/login.ts',
        content: 'import bcrypt from "bcrypt";\n\nexport async function authenticateUser(email: string, password: string) {\n  // Authentication logic\n  const user = await findUserByEmail(email);\n  return bcrypt.compare(password, user.passwordHash);\n}',
        score: 0.8,
        size: 320,
        lastModified: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        language: 'typescript',
        priority: 'high',
        reasons: ['Authentication', 'Security']
    },
    {
        path: 'README.md',
        content: '# My Project\n\nThis is a sample project for testing.',
        score: 0.2,
        size: 50,
        lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
        language: 'markdown',
        priority: 'low',
        reasons: ['Documentation']
    }
];

describe('AdvancedContextFilter Unit Tests', () => {
    describe('Pattern Filtering', () => {
        it('should exclude node_modules by default', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'authentication functions'
            );

            const nodeModulesFile = result.selectedFiles.find(f => f.path.includes('node_modules'));
            expect(nodeModulesFile).toBeUndefined();
        });

        it('should include src directory files', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'React components'
            );

            const srcFiles = result.selectedFiles.filter(f => f.path.startsWith('src/'));
            expect(srcFiles.length).toBeGreaterThan(0);
        });

        it('should respect custom exclude patterns', async () => {
            const criteria: Partial<FilterCriteria> = {
                excludePatterns: ['auth', 'node_modules']
            };

            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'React components',
                criteria
            );

            const authFile = result.selectedFiles.find(f => f.path.includes('auth'));
            expect(authFile).toBeUndefined();
        });
    });

    describe('Relevance Scoring', () => {
        it('should score files based on query relevance', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'authentication login security'
            );

            // Auth file should score highest for authentication query
            const authFile = result.selectedFiles.find(f => f.path.includes('auth'));
            const utilFile = result.selectedFiles.find(f => f.path.includes('utils'));

            if (authFile && utilFile) {
                expect(authFile.score).toBeGreaterThan(utilFile.score);
            }
        });

        it('should prefer TypeScript files', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'utility functions',
                { languagePreferences: ['typescript'] }
            );

            const tsFiles = result.selectedFiles.filter(f => f.language === 'typescript');
            expect(tsFiles.length).toBeGreaterThan(0);
        });

        it('should handle empty query gracefully', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                ''
            );

            expect(result.selectedFiles).toBeDefined();
            expect(result.totalFiles).toBe(mockFiles.length);
        });
    });

    describe('Priority Filtering', () => {
        it('should filter by priority threshold', async () => {
            const criteria: Partial<FilterCriteria> = {
                priorityThreshold: 0.6
            };

            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'any query',
                criteria
            );

            const lowScoreFiles = result.selectedFiles.filter(f => f.score < 0.6);
            expect(lowScoreFiles.length).toBe(0);
        });

        it('should respect max files limit', async () => {
            const criteria: Partial<FilterCriteria> = {
                maxFiles: 2
            };

            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'all files',
                criteria
            );

            expect(result.selectedFiles.length).toBeLessThanOrEqual(2);
        });

        it('should respect token limit', async () => {
            const criteria: Partial<FilterCriteria> = {
                maxTokens: 100 // Very low limit
            };

            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'any query',
                criteria
            );

            expect(result.totalTokens).toBeLessThanOrEqual(100);
        });
    });

    describe('Scenario Criteria', () => {
        it('should create debugging criteria', () => {
            const criteria = AdvancedContextFilter.createScenarioCriteria('debugging');
            
            expect(criteria.maxFiles).toBe(15);
            expect(criteria.recencyWeight).toBe(0.4);
            expect(criteria.priorityThreshold).toBe(0.4);
        });

        it('should create review criteria', () => {
            const criteria = AdvancedContextFilter.createScenarioCriteria('review');
            
            expect(criteria.maxFiles).toBe(30);
            expect(criteria.priorityThreshold).toBe(0.2);
        });

        it('should create learning criteria', () => {
            const criteria = AdvancedContextFilter.createScenarioCriteria('learning');
            
            expect(criteria.maxFiles).toBe(20);
            expect(criteria.includePatterns).toContain('examples');
        });

        it('should create implementation criteria', () => {
            const criteria = AdvancedContextFilter.createScenarioCriteria('implementation');
            
            expect(criteria.maxFiles).toBe(25);
            expect(criteria.relevanceWeight).toBe(0.6);
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens correctly', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles.slice(0, 2), // Use smaller subset
                'test query'
            );

            expect(result.totalTokens).toBeGreaterThan(0);
            expect(typeof result.totalTokens).toBe('number');
        });

        it('should calculate efficiency metrics', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'React components'
            );

            expect(result.efficiency).toBeGreaterThan(0);
            expect(result.efficiency).toBeLessThanOrEqual(1);
        });
    });

    describe('Statistics and Reporting', () => {
        it('should provide filtering statistics', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'authentication'
            );

            const stats = AdvancedContextFilter.getFilteringStats(result);
            
            expect(stats.efficiency).toMatch(/\d+%/);
            expect(stats.tokenUsage).toContain('tokens');
            expect(stats.fileReduction).toContain('files selected');
            expect(Array.isArray(stats.topReasons)).toBe(true);
        });

        it('should provide reasoning for selections', async () => {
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'TypeScript components'
            );

            expect(result.reasoning).toBeDefined();
            expect(Array.isArray(result.reasoning)).toBe(true);
            expect(result.reasoning.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty file list', async () => {
            const result = await AdvancedContextFilter.filterContext(
                [],
                'any query'
            );

            expect(result.selectedFiles).toEqual([]);
            expect(result.totalFiles).toBe(0);
            expect(result.totalTokens).toBe(0);
        });

        it('should handle malformed file data', async () => {
            const malformedFiles: ContextFile[] = [
                {
                    path: '',
                    content: '',
                    score: NaN,
                    size: -1,
                    lastModified: new Date('invalid'),
                    language: '',
                    priority: 'medium' as any,
                    reasons: []
                }
            ];

            const result = await AdvancedContextFilter.filterContext(
                malformedFiles,
                'test query'
            );

            expect(result.selectedFiles).toBeDefined();
            expect(Array.isArray(result.selectedFiles)).toBe(true);
        });

        it('should handle very long queries', async () => {
            const longQuery = 'test '.repeat(1000);
            
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                longQuery
            );

            expect(result.selectedFiles).toBeDefined();
            expect(result.reasoning).toBeDefined();
        });

        it('should handle special characters in queries', async () => {
            const specialQuery = 'test @#$%^&*()[]{}|\\:";\'<>?,./ query';
            
            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                specialQuery
            );

            expect(result.selectedFiles).toBeDefined();
        });
    });

    describe('Performance Considerations', () => {
        it('should handle large file lists efficiently', async () => {
            const largeFileList: ContextFile[] = Array(1000).fill(null).map((_, i) => ({
                path: `src/file${i}.ts`,
                content: `export const value${i} = ${i};`,
                score: Math.random(),
                size: 100 + i,
                lastModified: new Date(),
                language: 'typescript',
                priority: 'medium' as any,
                reasons: [`File ${i}`]
            }));

            const startTime = Date.now();
            const result = await AdvancedContextFilter.filterContext(
                largeFileList,
                'test query'
            );
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
            expect(result.selectedFiles).toBeDefined();
        });

        it('should limit results appropriately', async () => {
            const criteria: Partial<FilterCriteria> = {
                maxFiles: 5
            };

            const result = await AdvancedContextFilter.filterContext(
                mockFiles,
                'any query',
                criteria
            );

            expect(result.selectedFiles.length).toBeLessThanOrEqual(5);
        });
    });
});

// Helper function for expect (mock implementation)
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
        },
        toMatch: (pattern: RegExp) => {
            if (!pattern.test(actual)) {
                throw new Error(`Expected ${actual} to match ${pattern}`);
            }
        }
    };
}

// Mock describe and it functions
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

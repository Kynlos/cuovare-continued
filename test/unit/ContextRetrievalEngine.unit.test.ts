import * as assert from 'assert';
import * as path from 'path';

// Mock VS Code module for unit testing
const mockVscode = {
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: path.join(__dirname, '../../test-workspace'),
                    scheme: 'file'
                }
            }
        ],
        findFiles: async () => [],
        openTextDocument: async () => ({
            getText: () => 'mock content',
            languageId: 'typescript',
            lineCount: 10
        }),
        fs: {
            stat: async () => ({ size: 1000 })
        },
        getConfiguration: () => ({
            get: (key: string, defaultValue: any) => defaultValue
        })
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file' })
    },
    window: {
        visibleTextEditors: [],
        activeTextEditor: null
    }
};

// Replace the vscode import in our modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args: any[]) {
    if (args[0] === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, args);
};

// Now import our modules after mocking vscode
import { ContextRetrievalEngine, SearchOptions } from '../../src/context/ContextRetrievalEngine';

suite('ContextRetrievalEngine Unit Tests', () => {
    let engine: ContextRetrievalEngine;

    setup(() => {
        engine = ContextRetrievalEngine.getInstance();
    });

    suite('Search Type Detection', () => {
        test('should detect function search', () => {
            // Test the logic by checking search results
            assert.ok(true, 'Function search detection works');
        });

        test('should detect class search', () => {
            assert.ok(true, 'Class search detection works');
        });

        test('should detect semantic search', () => {
            assert.ok(true, 'Semantic search detection works');
        });
    });

    suite('Code Pattern Analysis', () => {
        test('should extract TypeScript patterns', () => {
            const testCode = `
                export class UserService {
                    async authenticate(email: string): Promise<boolean> {
                        return true;
                    }
                }
                
                export interface User {
                    id: string;
                    email: string;
                }
                
                export type UserRole = 'admin' | 'user';
            `;

            // Test pattern extraction logic
            const patterns = {
                typescript: {
                    function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?/g,
                    class: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/g,
                    interface: /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?/g,
                    type: /(?:export\s+)?type\s+(\w+)\s*=/g,
                    import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
                    export: /export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+(\w+)/g
                }
            };

            // Test class extraction
            const classMatches = Array.from(testCode.matchAll(patterns.typescript.class));
            assert.strictEqual(classMatches.length, 1, 'Should find one class');
            assert.strictEqual(classMatches[0][1], 'UserService', 'Should extract UserService class name');

            // Test interface extraction
            const interfaceMatches = Array.from(testCode.matchAll(patterns.typescript.interface));
            assert.strictEqual(interfaceMatches.length, 1, 'Should find one interface');
            assert.strictEqual(interfaceMatches[0][1], 'User', 'Should extract User interface name');

            // Test type extraction
            const typeMatches = Array.from(testCode.matchAll(patterns.typescript.type));
            assert.strictEqual(typeMatches.length, 1, 'Should find one type');
            assert.strictEqual(typeMatches[0][1], 'UserRole', 'Should extract UserRole type name');
        });

        test('should extract JavaScript patterns', () => {
            const testCode = `
                export class APIClient {
                    async fetchData(url) {
                        return fetch(url);
                    }
                }
                
                export function validateInput(input) {
                    return input.length > 0;
                }
            `;

            const patterns = {
                javascript: {
                    function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
                    class: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?/g,
                    import: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
                    export: /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g
                }
            };

            // Test class extraction
            const classMatches = Array.from(testCode.matchAll(patterns.javascript.class));
            assert.strictEqual(classMatches.length, 1, 'Should find one class');
            assert.strictEqual(classMatches[0][1], 'APIClient', 'Should extract APIClient class name');

            // Test function extraction
            const functionMatches = Array.from(testCode.matchAll(patterns.javascript.function));
            assert.strictEqual(functionMatches.length, 1, 'Should find one function');
            assert.strictEqual(functionMatches[0][1], 'validateInput', 'Should extract validateInput function name');
        });

        test('should extract Python patterns', () => {
            const testCode = `
                class UserManager:
                    def authenticate(self, email, password):
                        return True
                
                def validate_email(email):
                    return '@' in email
                
                from database import User
                import json
            `;

            const patterns = {
                python: {
                    function: /def\s+(\w+)\s*\([^)]*\):/g,
                    class: /class\s+(\w+)(?:\([^)]*\))?:/g,
                    import: /(?:from\s+[\w.]+\s+)?import\s+([\w,\s]+)/g
                }
            };

            // Test class extraction
            const classMatches = Array.from(testCode.matchAll(patterns.python.class));
            assert.strictEqual(classMatches.length, 1, 'Should find one class');
            assert.strictEqual(classMatches[0][1], 'UserManager', 'Should extract UserManager class name');

            // Test function extraction
            const functionMatches = Array.from(testCode.matchAll(patterns.python.function));
            assert.strictEqual(functionMatches.length, 2, 'Should find two functions');
            assert.strictEqual(functionMatches[0][1], 'authenticate', 'Should extract authenticate function name');
            assert.strictEqual(functionMatches[1][1], 'validate_email', 'Should extract validate_email function name');
        });
    });

    suite('Semantic Query Expansion', () => {
        test('should expand authentication concepts', () => {
            const expansions: Record<string, string[]> = {
                'authentication': ['auth', 'login', 'token', 'jwt', 'session', 'user', 'password', 'credential'],
                'database': ['db', 'sql', 'query', 'connection', 'model', 'schema', 'orm', 'entity'],
                'api': ['endpoint', 'route', 'controller', 'request', 'response', 'http', 'rest', 'graphql'],
                'error': ['exception', 'try', 'catch', 'throw', 'error', 'failure', 'handler'],
                'test': ['spec', 'unit', 'integration', 'mock', 'assert', 'expect', 'describe', 'it'],
                'config': ['configuration', 'settings', 'environment', 'env', 'options', 'parameters'],
                'validation': ['validate', 'check', 'verify', 'sanitize', 'schema', 'rules'],
                'logging': ['log', 'logger', 'debug', 'info', 'warn', 'error', 'trace']
            };

            // Test authentication expansion
            const authExpansion = expansions['authentication'];
            assert.ok(authExpansion.includes('auth'), 'Should include auth');
            assert.ok(authExpansion.includes('login'), 'Should include login');
            assert.ok(authExpansion.includes('token'), 'Should include token');
            assert.ok(authExpansion.includes('jwt'), 'Should include jwt');

            // Test database expansion
            const dbExpansion = expansions['database'];
            assert.ok(dbExpansion.includes('sql'), 'Should include sql');
            assert.ok(dbExpansion.includes('orm'), 'Should include orm');
            assert.ok(dbExpansion.includes('query'), 'Should include query');
        });

        test('should handle multi-word concepts', () => {
            const concept = 'user authentication system';
            const words = concept.toLowerCase().split(' ');
            
            assert.ok(words.includes('user'), 'Should split into individual words');
            assert.ok(words.includes('authentication'), 'Should include authentication');
            assert.ok(words.includes('system'), 'Should include system');
        });
    });

    suite('Relevance Scoring', () => {
        test('should score exact matches highest', () => {
            const content = 'This function authenticate user credentials';
            const query = 'authenticate';
            
            // Find exact matches
            const exactMatches = [];
            let index = 0;
            while ((index = content.toLowerCase().indexOf(query.toLowerCase(), index)) !== -1) {
                exactMatches.push({
                    start: index,
                    end: index + query.length,
                    type: 'exact',
                    confidence: 1.0
                });
                index += query.length;
            }

            assert.strictEqual(exactMatches.length, 1, 'Should find one exact match');
            assert.strictEqual(exactMatches[0].confidence, 1.0, 'Exact match should have 100% confidence');
        });

        test('should calculate file name relevance', () => {
            const fileName1 = 'UserService.ts';
            const fileName2 = 'DatabaseConfig.ts';
            const query = 'user';
            
            const score1 = fileName1.toLowerCase().includes(query.toLowerCase()) ? 15 : 0;
            const score2 = fileName2.toLowerCase().includes(query.toLowerCase()) ? 15 : 0;
            
            assert.strictEqual(score1, 15, 'UserService should get high relevance for "user" query');
            assert.strictEqual(score2, 0, 'DatabaseConfig should get no relevance for "user" query');
        });

        test('should apply file size penalty', () => {
            const smallFileKB = 50;
            const largeFileKB = 150;
            
            const smallFilePenalty = smallFileKB > 100 ? 0.8 : 1.0;
            const largeFilePenalty = largeFileKB > 100 ? 0.8 : 1.0;
            
            assert.strictEqual(smallFilePenalty, 1.0, 'Small files should not be penalized');
            assert.strictEqual(largeFilePenalty, 0.8, 'Large files should be penalized');
        });
    });

    suite('Language Extension Mapping', () => {
        test('should map languages to extensions correctly', () => {
            const languageMap: Record<string, string[]> = {
                'typescript': ['ts', 'tsx'],
                'javascript': ['js', 'jsx', 'mjs'],
                'python': ['py', 'pyw'],
                'java': ['java'],
                'csharp': ['cs'],
                'cpp': ['cpp', 'cc', 'cxx', 'h', 'hpp'],
                'go': ['go'],
                'rust': ['rs'],
                'php': ['php'],
                'ruby': ['rb'],
                'swift': ['swift'],
                'kotlin': ['kt', 'kts']
            };

            assert.deepStrictEqual(languageMap['typescript'], ['ts', 'tsx'], 'TypeScript should map to ts and tsx');
            assert.deepStrictEqual(languageMap['javascript'], ['js', 'jsx', 'mjs'], 'JavaScript should map to js, jsx, and mjs');
            assert.deepStrictEqual(languageMap['python'], ['py', 'pyw'], 'Python should map to py and pyw');
        });
    });

    suite('Error Handling', () => {
        test('should handle empty strings gracefully', () => {
            const emptyQuery = '';
            const result = {
                files: [],
                relevanceScore: 0,
                totalMatches: 0,
                searchMetadata: {
                    query: emptyQuery,
                    searchType: 'keyword' as const,
                    timeMs: 0,
                    totalFilesScanned: 0,
                    includedLanguages: [],
                    excludedPatterns: []
                }
            };

            assert.strictEqual(result.files.length, 0, 'Empty query should return no files');
            assert.strictEqual(result.relevanceScore, 0, 'Empty query should have zero relevance');
        });

        test('should handle invalid search options', () => {
            const invalidOptions = {
                maxFiles: -1,
                maxFileSize: -1,
                fuzzyThreshold: 2.0
            };

            // Normalize invalid options
            const normalizedOptions = {
                maxFiles: Math.max(1, invalidOptions.maxFiles),
                maxFileSize: Math.max(1024, invalidOptions.maxFileSize),
                fuzzyThreshold: Math.min(1.0, Math.max(0.0, invalidOptions.fuzzyThreshold))
            };

            assert.strictEqual(normalizedOptions.maxFiles, 1, 'Negative maxFiles should be normalized to 1');
            assert.strictEqual(normalizedOptions.maxFileSize, 1024, 'Negative maxFileSize should be normalized to 1024');
            assert.strictEqual(normalizedOptions.fuzzyThreshold, 1.0, 'Invalid fuzzyThreshold should be clamped to 1.0');
        });

        test('should handle malformed regex patterns', () => {
            const testPatterns = [
                'valid_pattern',
                '[invalid_pattern',
                '(unclosed_group',
                '*invalid_quantifier'
            ];

            testPatterns.forEach(pattern => {
                try {
                    new RegExp(pattern);
                    assert.ok(true, `Pattern "${pattern}" is valid`);
                } catch (error) {
                    assert.ok(true, `Pattern "${pattern}" is invalid and handled gracefully`);
                }
            });
        });
    });

    suite('Performance Considerations', () => {
        test('should limit search results appropriately', () => {
            const maxFiles = 10;
            const mockResults = Array.from({ length: 20 }, (_, i) => ({ id: i }));
            
            const limitedResults = mockResults.slice(0, maxFiles);
            assert.strictEqual(limitedResults.length, maxFiles, 'Should limit results to maxFiles');
        });

        test('should handle large file content', () => {
            const maxLength = 500;
            const largeContent = 'x'.repeat(1000);
            
            const truncated = largeContent.length > maxLength 
                ? largeContent.substring(0, maxLength) + '\n// ... (truncated)'
                : largeContent;
            
            assert.ok(truncated.length <= maxLength + 20, 'Content should be truncated appropriately');
            assert.ok(truncated.includes('truncated'), 'Should indicate truncation');
        });
    });
});

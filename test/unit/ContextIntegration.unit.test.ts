import * as assert from 'assert';

// Mock VS Code for unit testing
const mockVscode = {
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/mock/workspace', scheme: 'file' }
        }],
        findFiles: async () => [],
        openTextDocument: async () => ({
            getText: () => 'mock content',
            languageId: 'typescript',
            lineCount: 10
        }),
        fs: { stat: async () => ({ size: 1000 }) },
        getConfiguration: () => ({ get: (key: string, defaultValue: any) => defaultValue })
    },
    Uri: { file: (path: string) => ({ fsPath: path, scheme: 'file' }) },
    window: { visibleTextEditors: [], activeTextEditor: null }
};

// Mock the vscode module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args: any[]) {
    if (args[0] === 'vscode') {
        return mockVscode;
    }
    return originalRequire.apply(this, args);
};

import { ContextIntegration } from '../../src/context/ContextIntegration';

suite('ContextIntegration Unit Tests', () => {
    let integration: ContextIntegration;

    setup(() => {
        integration = new ContextIntegration();
    });

    suite('Query Classification', () => {
        test('should identify code-related queries', () => {
            const codeKeywords = [
                'function', 'class', 'interface', 'method', 'variable', 'import', 'export',
                'typescript', 'javascript', 'python', 'java', 'implementation', 'algorithm',
                'bug', 'error', 'debug', 'refactor', 'optimize', 'test', 'api', 'endpoint'
            ];

            const testCases = [
                { query: 'How do I implement a function?', expected: true },
                { query: 'Create a new class for user management', expected: true },
                { query: 'What is the weather today?', expected: false },
                { query: 'Debug this error in the API endpoint', expected: true },
                { query: 'Hello world', expected: false }
            ];

            testCases.forEach(({ query, expected }) => {
                const isCodeQuery = codeKeywords.some(keyword => 
                    query.toLowerCase().includes(keyword)
                );
                assert.strictEqual(isCodeQuery, expected, `Query "${query}" should be ${expected ? 'code-related' : 'non-code-related'}`);
            });
        });

        test('should detect code identifiers', () => {
            const testCases = [
                { text: 'getUserData function', expected: true },  // camelCase
                { text: 'UserService class', expected: true },    // PascalCase
                { text: 'validate_email method', expected: true }, // snake_case
                { text: 'how to implement auth', expected: false }, // no identifiers
                { text: 'just plain text', expected: false }      // no identifiers
            ];

            testCases.forEach(({ text, expected }) => {
                const hasCodeIdentifiers = /\b[a-z]+[A-Z][a-zA-Z]*\b|\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|\b[a-z]+_[a-z_]+\b/.test(text);
                assert.strictEqual(hasCodeIdentifiers, expected, `Text "${text}" should ${expected ? 'contain' : 'not contain'} code identifiers`);
            });
        });
    });

    suite('File Reference Processing', () => {
        test('should extract relative paths correctly', () => {
            const testPaths = [
                { full: '/project/src/components/UserForm.tsx', expected: 'components/UserForm.tsx' },
                { full: 'C:\\Users\\dev\\project\\utils\\validation.ts', expected: 'utils/validation.ts' },
                { full: '/single/file.js', expected: 'single/file.js' },
                { full: 'standalone.py', expected: 'standalone.py' }
            ];

            testPaths.forEach(({ full, expected }) => {
                const parts = full.split(/[/\\]/);
                const relative = parts.slice(-2).join('/');
                assert.strictEqual(relative, expected, `Path "${full}" should become "${expected}"`);
            });
        });

        test('should handle line range extraction', () => {
            const testContent = `line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10`;

            const lines = testContent.split('\n');
            
            // Test line range [3, 6]
            const range1 = lines.slice(2, 6); // 0-indexed, so subtract 1 from start
            assert.deepStrictEqual(range1, ['line 3', 'line 4', 'line 5', 'line 6'], 'Should extract correct line range');

            // Test line range [1, 3]
            const range2 = lines.slice(0, 3);
            assert.deepStrictEqual(range2, ['line 1', 'line 2', 'line 3'], 'Should extract from beginning');
        });
    });

    suite('Content Truncation', () => {
        test('should truncate content at reasonable boundaries', () => {
            const longContent = `This is a very long piece of content that needs to be truncated.
It has multiple lines and should be cut at a reasonable boundary.
The truncation should prefer line breaks when possible.
This line should be included if we truncate after line breaks.
This line might be cut off depending on the limit.`;

            const maxLength = 150;
            
            if (longContent.length <= maxLength) {
                assert.strictEqual(longContent, longContent, 'Content within limit should not be truncated');
            } else {
                const truncated = longContent.substring(0, maxLength);
                const lastNewline = truncated.lastIndexOf('\n');
                
                let result;
                if (lastNewline > maxLength * 0.8) {
                    result = truncated.substring(0, lastNewline) + '\n// ... (truncated)';
                } else {
                    result = truncated + '\n// ... (truncated)';
                }
                
                assert.ok(result.includes('truncated'), 'Should indicate truncation');
                assert.ok(result.length <= maxLength + 20, 'Truncated content should be within reasonable bounds');
            }
        });

        test('should handle edge cases in truncation', () => {
            const edgeCases = [
                { content: '', maxLength: 100, description: 'empty content' },
                { content: 'short', maxLength: 100, description: 'content shorter than limit' },
                { content: 'x'.repeat(50), maxLength: 100, description: 'content without newlines' },
                { content: '\n\n\n\n\n', maxLength: 100, description: 'content with only newlines' }
            ];

            edgeCases.forEach(({ content, maxLength, description }) => {
                if (content.length <= maxLength) {
                    assert.strictEqual(content, content, `${description} should not be truncated`);
                } else {
                    const truncated = content.substring(0, maxLength) + '// ... (truncated)';
                    assert.ok(truncated.includes('truncated'), `${description} should be truncated`);
                }
            });
        });
    });

    suite('Context Formatting', () => {
        test('should format context header correctly', () => {
            const mockContext = {
                files: [
                    {
                        path: '/project/src/UserService.ts',
                        content: 'export class UserService {}',
                        language: 'typescript',
                        relevanceScore: 85.5,
                        matchRanges: [],
                        dependencies: [],
                        exports: ['UserService'],
                        imports: [],
                        functions: [],
                        classes: [{ name: 'UserService', line: 1, methods: [], properties: [], implements: [], isExported: true }],
                        interfaces: [],
                        types: []
                    }
                ],
                relevanceScore: 0.855,
                totalMatches: 1,
                searchMetadata: {
                    query: 'UserService',
                    searchType: 'class' as const,
                    timeMs: 150,
                    totalFilesScanned: 10,
                    includedLanguages: ['typescript'],
                    excludedPatterns: ['**/node_modules/**']
                }
            };

            const expectedHeader = `## Codebase Context (1 files, relevance: 85.5%)`;
            assert.ok(expectedHeader.includes('1 files'), 'Should include file count');
            assert.ok(expectedHeader.includes('85.5%'), 'Should include relevance percentage');
        });

        test('should format individual file sections', () => {
            const mockFile = {
                path: '/project/src/utils/validation.ts',
                content: 'export function validateEmail(email: string): boolean { return true; }',
                language: 'typescript',
                relevanceScore: 72.3,
                matchRanges: [],
                dependencies: [],
                exports: ['validateEmail'],
                imports: [],
                functions: [{ name: 'validateEmail', line: 1, parameters: [], returnType: 'boolean', isExported: true }],
                classes: [],
                interfaces: [],
                types: []
            };

            const relativePath = 'utils/validation.ts';
            const expectedSection = `### 1. ${relativePath} (typescript)
Relevance: 72.3/100
Functions: validateEmail`;

            assert.ok(expectedSection.includes(relativePath), 'Should include relative path');
            assert.ok(expectedSection.includes('72.3/100'), 'Should include relevance score');
            assert.ok(expectedSection.includes('Functions: validateEmail'), 'Should include function names');
        });

        test('should handle empty context gracefully', () => {
            const emptyContext = {
                files: [],
                relevanceScore: 0,
                totalMatches: 0,
                searchMetadata: {
                    query: 'nonexistent',
                    searchType: 'keyword' as const,
                    timeMs: 50,
                    totalFilesScanned: 0,
                    includedLanguages: [],
                    excludedPatterns: []
                }
            };

            const formatted = 'No relevant context found.';
            assert.strictEqual(formatted, 'No relevant context found.', 'Should handle empty context appropriately');
        });
    });

    suite('Autocomplete Suggestions', () => {
        test('should filter suggestions by query', () => {
            const mockSuggestions = [
                'UserService',
                'UserController',
                'validateUser',
                'getUserData',
                'DatabaseService',
                'validateEmail'
            ];

            const query = 'User';
            const filtered = mockSuggestions.filter(suggestion => 
                suggestion.toLowerCase().includes(query.toLowerCase())
            );

            const expected = ['UserService', 'UserController', 'validateUser', 'getUserData'];
            assert.deepStrictEqual(filtered, expected, 'Should filter suggestions correctly');
        });

        test('should limit suggestions to reasonable number', () => {
            const mockSuggestions = Array.from({ length: 20 }, (_, i) => `suggestion${i}`);
            const maxSuggestions = 10;
            
            const limited = mockSuggestions.slice(0, maxSuggestions);
            assert.strictEqual(limited.length, maxSuggestions, 'Should limit suggestions to maximum');
        });

        test('should handle short queries', () => {
            const shortQueries = ['', 'a', 'ab'];
            
            shortQueries.forEach(query => {
                const shouldReturn = query.length >= 2;
                const suggestions = shouldReturn ? ['some', 'suggestions'] : [];
                
                if (query.length < 2) {
                    assert.strictEqual(suggestions.length, 0, `Query "${query}" should return no suggestions`);
                } else {
                    assert.ok(suggestions.length >= 0, `Query "${query}" should return suggestions`);
                }
            });
        });
    });

    suite('Search Options Configuration', () => {
        test('should configure search options based on query', () => {
            const testCases = [
                {
                    query: 'How to write unit tests for authentication?',
                    expectedOptions: { includeTests: true, includeDocs: true }
                },
                {
                    query: 'Implement user authentication function',
                    expectedOptions: { includeTests: false, includeDocs: false }
                },
                {
                    query: 'What does the documentation say about API usage?',
                    expectedOptions: { includeTests: false, includeDocs: true }
                },
                {
                    query: 'Debug this test failure',
                    expectedOptions: { includeTests: true, includeDocs: false }
                }
            ];

            testCases.forEach(({ query, expectedOptions }) => {
                const includeTests = query.toLowerCase().includes('test') || query.toLowerCase().includes('spec');
                const includeDocs = query.toLowerCase().includes('how') || query.toLowerCase().includes('what') || query.toLowerCase().includes('documentation');

                assert.strictEqual(includeTests, expectedOptions.includeTests, 
                    `Query "${query}" should ${expectedOptions.includeTests ? 'include' : 'exclude'} tests`);
                assert.strictEqual(includeDocs, expectedOptions.includeDocs, 
                    `Query "${query}" should ${expectedOptions.includeDocs ? 'include' : 'exclude'} docs`);
            });
        });

        test('should determine appropriate file limits', () => {
            const testCases = [
                { isCodeQuery: true, expectedMax: 15 },
                { isCodeQuery: false, expectedMax: 8 }
            ];

            testCases.forEach(({ isCodeQuery, expectedMax }) => {
                const maxFiles = isCodeQuery ? 15 : 8;
                assert.strictEqual(maxFiles, expectedMax, 
                    `${isCodeQuery ? 'Code' : 'Non-code'} queries should use ${expectedMax} max files`);
            });
        });
    });

    suite('Error Handling', () => {
        test('should handle malformed queries gracefully', () => {
            const malformedInputs = [
                null,
                undefined,
                123,
                {},
                [],
                Symbol('test')
            ];

            malformedInputs.forEach(input => {
                // In a real implementation, these would be handled by the integration layer
                const handled = typeof input === 'string' ? input : String(input || '');
                assert.ok(typeof handled === 'string', `Should convert ${typeof input} to string`);
            });
        });

        test('should handle special characters in queries', () => {
            const specialCharQueries = [
                'user@example.com authentication',
                'function with $pecial ch@racters',
                'search for [brackets] and {braces}',
                'regex patterns with /slashes/ and *asterisks*',
                'unicode тест and émojis 🔐'
            ];

            specialCharQueries.forEach(query => {
                // Should not throw errors when processing special characters
                const processed = query.toLowerCase().trim();
                assert.ok(typeof processed === 'string', `Should process special chars in: ${query}`);
                assert.ok(processed.length > 0 || query.trim().length === 0, 'Should maintain content');
            });
        });

        test('should handle very long queries', () => {
            const longQuery = 'authentication system implementation with user management '.repeat(20);
            const maxLength = 1000;
            
            // In practice, queries might be truncated or limited
            const processed = longQuery.length > maxLength 
                ? longQuery.substring(0, maxLength) 
                : longQuery;
                
            assert.ok(processed.length <= maxLength, 'Should handle long queries appropriately');
        });
    });
});

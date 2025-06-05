import { CodeSnippetsLibrary, CodeSnippet, SnippetCategory } from '../../src/snippets/CodeSnippetsLibrary';

// Mock snippets for testing
const mockSnippets: CodeSnippet[] = [
    {
        id: 'react-component-1',
        title: 'React Functional Component',
        description: 'Modern React component with TypeScript',
        language: 'typescriptreact',
        category: 'React',
        tags: ['react', 'component', 'typescript', 'functional'],
        code: 'const ${componentName}: React.FC = () => {\n  return <div>${content}</div>;\n};',
        variables: [
            {
                name: 'componentName',
                type: 'string',
                description: 'Component name',
                defaultValue: 'MyComponent',
                required: true,
                placeholder: 'Enter component name'
            },
            {
                name: 'content',
                type: 'string',
                description: 'Component content',
                defaultValue: 'Hello World',
                required: false,
                placeholder: 'Enter content'
            }
        ],
        usage: 15,
        rating: 4.8,
        author: 'Cuovare',
        dateCreated: new Date('2024-01-01'),
        dateModified: new Date('2024-06-01'),
        isBuiltIn: true,
        frameworks: ['React'],
        dependencies: ['react', '@types/react']
    },
    {
        id: 'express-route-1',
        title: 'Express Route Handler',
        description: 'Express.js route with error handling',
        language: 'typescript',
        category: 'Backend',
        tags: ['express', 'route', 'api', 'nodejs'],
        code: 'app.${method}("${path}", async (req, res) => {\n  try {\n    ${logic}\n    res.json({ success: true });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});',
        variables: [
            {
                name: 'method',
                type: 'choice',
                description: 'HTTP method',
                choices: ['get', 'post', 'put', 'delete'],
                defaultValue: 'get',
                required: true
            },
            {
                name: 'path',
                type: 'string',
                description: 'Route path',
                defaultValue: '/api/test',
                required: true,
                placeholder: 'Enter route path'
            },
            {
                name: 'logic',
                type: 'string',
                description: 'Route logic',
                defaultValue: '// Add your logic here',
                required: false,
                placeholder: 'Enter route logic'
            }
        ],
        usage: 8,
        rating: 4.5,
        author: 'Cuovare',
        dateCreated: new Date('2024-01-15'),
        dateModified: new Date('2024-05-15'),
        isBuiltIn: true,
        frameworks: ['Express.js'],
        dependencies: ['express']
    },
    {
        id: 'utility-function-1',
        title: 'Utility Function',
        description: 'Generic utility function template',
        language: 'typescript',
        category: 'Utilities',
        tags: ['utility', 'function', 'typescript'],
        code: 'export function ${functionName}(${parameters}): ${returnType} {\n  ${body}\n}',
        variables: [
            {
                name: 'functionName',
                type: 'string',
                description: 'Function name',
                defaultValue: 'myFunction',
                required: true,
                placeholder: 'Enter function name'
            },
            {
                name: 'parameters',
                type: 'string',
                description: 'Function parameters',
                defaultValue: 'param: string',
                required: false,
                placeholder: 'Enter parameters'
            },
            {
                name: 'returnType',
                type: 'string',
                description: 'Return type',
                defaultValue: 'string',
                required: false,
                placeholder: 'Enter return type'
            },
            {
                name: 'body',
                type: 'string',
                description: 'Function body',
                defaultValue: 'return param;',
                required: false,
                placeholder: 'Enter function body'
            }
        ],
        usage: 3,
        rating: 4.0,
        author: 'User',
        dateCreated: new Date('2024-02-01'),
        dateModified: new Date('2024-02-01'),
        isBuiltIn: false,
        frameworks: [],
        dependencies: []
    }
];

describe('CodeSnippetsLibrary Unit Tests', () => {
    let library: CodeSnippetsLibrary;

    beforeEach(() => {
        library = CodeSnippetsLibrary.getInstance();
        // Mock the snippets for testing
        (library as any).snippets = new Map(mockSnippets.map(s => [s.id, s]));
    });

    describe('Search Functionality', () => {
        it('should search snippets by title', async () => {
            const result = await library.searchSnippets('React');

            expect(result.snippets.length).toBeGreaterThan(0);
            const reactSnippet = result.snippets.find(s => s.title.includes('React'));
            expect(reactSnippet).toBeDefined();
        });

        it('should search snippets by language', async () => {
            const result = await library.searchSnippets('', 'typescript');

            const tsSnippets = result.snippets.filter(s => s.language === 'typescript');
            expect(tsSnippets.length).toBeGreaterThan(0);
        });

        it('should search snippets by category', async () => {
            const result = await library.searchSnippets('', undefined, 'React');

            const reactSnippets = result.snippets.filter(s => s.category === 'React');
            expect(reactSnippets.length).toBeGreaterThan(0);
        });

        it('should search snippets by tags', async () => {
            const result = await library.searchSnippets('', undefined, undefined, ['component']);

            const componentSnippets = result.snippets.filter(s => 
                s.tags.includes('component')
            );
            expect(componentSnippets.length).toBeGreaterThan(0);
        });

        it('should handle empty search gracefully', async () => {
            const result = await library.searchSnippets('');

            expect(result.snippets).toBeDefined();
            expect(Array.isArray(result.snippets)).toBe(true);
        });

        it('should limit search results', async () => {
            const result = await library.searchSnippets('');

            expect(result.snippets.length).toBeLessThanOrEqual(50);
        });

        it('should return suggested tags', async () => {
            const result = await library.searchSnippets('React');

            expect(Array.isArray(result.suggestedTags)).toBe(true);
            expect(result.suggestedTags.length).toBeGreaterThan(0);
        });
    });

    describe('AI Suggestions', () => {
        it('should provide AI suggestions based on context', async () => {
            const context = {
                language: 'typescriptreact',
                frameworks: ['React'],
                intent: 'creating a component'
            };

            const suggestions = await library.getAISnippetSuggestions(context);

            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions.length).toBeGreaterThan(0);

            if (suggestions.length > 0) {
                const suggestion = suggestions[0];
                expect(suggestion.snippet).toBeDefined();
                expect(suggestion.confidence).toBeGreaterThan(0);
                expect(suggestion.confidence).toBeLessThanOrEqual(1);
                expect(suggestion.reasoning).toBeDefined();
                expect(Array.isArray(suggestion.adaptations)).toBe(true);
            }
        });

        it('should sort suggestions by confidence', async () => {
            const context = {
                language: 'typescript',
                frameworks: ['Express.js'],
                intent: 'api development'
            };

            const suggestions = await library.getAISnippetSuggestions(context);

            if (suggestions.length > 1) {
                for (let i = 0; i < suggestions.length - 1; i++) {
                    expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
                }
            }
        });

        it('should handle context without frameworks', async () => {
            const context = {
                language: 'typescript'
            };

            const suggestions = await library.getAISnippetSuggestions(context);

            expect(Array.isArray(suggestions)).toBe(true);
        });
    });

    describe('Snippet Creation', () => {
        it('should create snippet from code', async () => {
            const code = 'function testFunction() {\n  return "test";\n}';
            const language = 'typescript';

            const snippet = await library.createSnippetFromCode(code, language);

            expect(snippet.id).toBeDefined();
            expect(snippet.code).toBe(code);
            expect(snippet.language).toBe(language);
            expect(snippet.isBuiltIn).toBe(false);
            expect(snippet.author).toBe('User');
        });

        it('should extract variables from code', async () => {
            const code = 'const ${variableName} = "${value}";';
            const language = 'typescript';

            const snippet = await library.createSnippetFromCode(code, language);

            expect(snippet.variables.length).toBeGreaterThan(0);
            const variable = snippet.variables.find(v => v.name === 'variableName');
            expect(variable).toBeDefined();
        });

        it('should use provided context', async () => {
            const code = 'function test() {}';
            const language = 'typescript';
            const context = {
                title: 'Custom Test Function',
                description: 'A custom test function',
                category: 'Testing',
                tags: ['test', 'custom']
            };

            const snippet = await library.createSnippetFromCode(code, language, context);

            expect(snippet.title).toBe(context.title);
            expect(snippet.description).toBe(context.description);
            expect(snippet.category).toBe(context.category);
            expect(snippet.tags).toEqual(expect.arrayContaining(context.tags));
        });
    });

    describe('Code Generation', () => {
        it('should generate code with variable substitution', async () => {
            const snippet = mockSnippets[0]; // React component
            const variables = new Map([
                ['componentName', 'TestComponent'],
                ['content', 'Test Content']
            ]);

            const code = await library.generateCode(snippet, variables);

            expect(code).toContain('TestComponent');
            expect(code).toContain('Test Content');
            expect(code).not.toContain('${componentName}');
            expect(code).not.toContain('${content}');
        });

        it('should use default values for missing variables', async () => {
            const snippet = mockSnippets[0]; // React component
            const variables = new Map([
                ['componentName', 'TestComponent']
                // Missing 'content' variable
            ]);

            const code = await library.generateCode(snippet, variables);

            expect(code).toContain('TestComponent');
            expect(code).toContain('Hello World'); // Default value
        });

        it('should increment usage count', async () => {
            const snippet = { ...mockSnippets[0] };
            const originalUsage = snippet.usage;

            await library.generateCode(snippet);

            expect(snippet.usage).toBe(originalUsage + 1);
        });
    });

    describe('Categories', () => {
        it('should return available categories', () => {
            const categories = library.getCategories();

            expect(Array.isArray(categories)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);

            const category = categories[0];
            expect(category.id).toBeDefined();
            expect(category.name).toBeDefined();
            expect(category.description).toBeDefined();
        });
    });

    describe('Popular and Recent Snippets', () => {
        it('should return popular snippets', () => {
            const popular = library.getPopularSnippets(2);

            expect(Array.isArray(popular)).toBe(true);
            expect(popular.length).toBeLessThanOrEqual(2);

            if (popular.length > 1) {
                expect(popular[0].usage).toBeGreaterThanOrEqual(popular[1].usage);
            }
        });

        it('should return recent snippets', () => {
            const recent = library.getRecentSnippets(2);

            expect(Array.isArray(recent)).toBe(true);
            expect(recent.length).toBeLessThanOrEqual(2);

            if (recent.length > 1) {
                expect(recent[0].dateModified.getTime()).toBeGreaterThanOrEqual(
                    recent[1].dateModified.getTime()
                );
            }
        });
    });

    describe('VS Code Integration', () => {
        it('should export to VS Code format', async () => {
            const result = await library.exportToVSCodeSnippets('typescript');

            const snippets = JSON.parse(result);
            expect(typeof snippets).toBe('object');

            const snippetNames = Object.keys(snippets);
            expect(snippetNames.length).toBeGreaterThan(0);

            const firstSnippet = snippets[snippetNames[0]];
            expect(firstSnippet.prefix).toBeDefined();
            expect(firstSnippet.body).toBeDefined();
            expect(firstSnippet.description).toBeDefined();
        });

        it('should import from VS Code format', async () => {
            const vsCodeSnippets = {
                "Test Snippet": {
                    "prefix": "test",
                    "body": ["function test() {", "  ${1:// code}", "}"],
                    "description": "Test function"
                }
            };

            const count = await library.importFromVSCodeSnippets(
                JSON.stringify(vsCodeSnippets),
                'typescript'
            );

            expect(count).toBe(1);
        });

        it('should handle malformed VS Code snippets', async () => {
            const malformedJson = '{ invalid json';

            try {
                await library.importFromVSCodeSnippets(malformedJson, 'typescript');
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty snippet library', async () => {
            (library as any).snippets = new Map();

            const result = await library.searchSnippets('test');

            expect(result.snippets).toEqual([]);
            expect(result.totalResults).toBe(0);
        });

        it('should handle very long search queries', async () => {
            const longQuery = 'test '.repeat(1000);

            const result = await library.searchSnippets(longQuery);

            expect(result.snippets).toBeDefined();
            expect(Array.isArray(result.snippets)).toBe(true);
        });

        it('should handle special characters in search', async () => {
            const specialQuery = '@#$%^&*()[]{}|\\:";\'<>?,./"';

            const result = await library.searchSnippets(specialQuery);

            expect(result.snippets).toBeDefined();
            expect(Array.isArray(result.snippets)).toBe(true);
        });

        it('should handle invalid variable types', async () => {
            const snippet = {
                ...mockSnippets[0],
                variables: [
                    {
                        name: 'test',
                        type: 'invalid' as any,
                        description: 'Test',
                        required: false
                    }
                ]
            };

            const code = await library.generateCode(snippet);

            expect(code).toBeDefined();
            expect(typeof code).toBe('string');
        });
    });

    describe('Performance', () => {
        it('should search large snippet collections efficiently', async () => {
            // Create a large collection of snippets
            const largeCollection = Array(1000).fill(null).map((_, i) => ({
                ...mockSnippets[0],
                id: `snippet-${i}`,
                title: `Snippet ${i}`,
                tags: [`tag${i % 10}`, 'common']
            }));

            (library as any).snippets = new Map(largeCollection.map(s => [s.id, s]));

            const startTime = Date.now();
            const result = await library.searchSnippets('common');
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
            expect(result.snippets.length).toBeGreaterThan(0);
        });

        it('should limit AI suggestions appropriately', async () => {
            const context = { language: 'typescript' };

            const suggestions = await library.getAISnippetSuggestions(context);

            expect(suggestions.length).toBeLessThanOrEqual(5);
        });
    });
});

// Test helper functions (same as previous file)
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
        },
        arrayContaining: (expected: any[]) => {
            const matches = expected.every(item => actual.includes(item));
            if (!matches) {
                throw new Error(`Expected ${JSON.stringify(actual)} to contain all of ${JSON.stringify(expected)}`);
            }
            return true;
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

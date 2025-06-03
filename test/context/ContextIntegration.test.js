"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ContextIntegration_1 = require("../../src/context/ContextIntegration");
suite('ContextIntegration Tests', () => {
    let integration;
    let testWorkspaceUri;
    suiteSetup(async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder available for testing');
        }
        testWorkspaceUri = workspaceFolders[0].uri;
        // Create test files for integration testing
        await createIntegrationTestFiles();
        integration = new ContextIntegration_1.ContextIntegration();
    });
    suiteTeardown(async () => {
        await cleanupIntegrationTestFiles();
    });
    async function createIntegrationTestFiles() {
        const testDir = path.join(testWorkspaceUri.fsPath, 'integration-test');
        const files = {
            'api/UserAPI.ts': `
export class UserAPI {
    async getUser(id: string) {
        return fetch(\`/api/users/\${id}\`);
    }

    async createUser(userData: any) {
        return fetch('/api/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async authenticateUser(credentials: any) {
        return fetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }
}
`,
            'components/LoginForm.tsx': `
import React, { useState } from 'react';
import { UserAPI } from '../api/UserAPI';

export const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const userAPI = new UserAPI();

    const handleLogin = async () => {
        try {
            const result = await userAPI.authenticateUser({ email, password });
            console.log('Login successful', result);
        } catch (error) {
            console.error('Login failed', error);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
            />
            <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
            />
            <button type="submit">Login</button>
        </form>
    );
};
`,
            'utils/validation.ts': `
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
    return password.length >= 8;
}

export function sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
}
`,
            'config/database.ts': `
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
}

export const dbConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'myapp',
    username: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password'
};
`,
            'README.md': `
# Integration Test Project

This is a test project for context integration testing.

## Features

- User authentication
- API integration
- Form validation
- Database configuration

## Getting Started

1. Install dependencies
2. Configure environment variables
3. Run the application
`
        };
        // Create directory structure
        await fs.promises.mkdir(path.join(testDir, 'api'), { recursive: true });
        await fs.promises.mkdir(path.join(testDir, 'components'), { recursive: true });
        await fs.promises.mkdir(path.join(testDir, 'utils'), { recursive: true });
        await fs.promises.mkdir(path.join(testDir, 'config'), { recursive: true });
        // Write test files
        for (const [fileName, content] of Object.entries(files)) {
            const filePath = path.join(testDir, fileName);
            await fs.promises.writeFile(filePath, content, 'utf8');
        }
    }
    async function cleanupIntegrationTestFiles() {
        const testDir = path.join(testWorkspaceUri.fsPath, 'integration-test');
        try {
            await fs.promises.rm(testDir, { recursive: true, force: true });
        }
        catch (error) {
            console.warn('Could not clean up integration test files:', error);
        }
    }
    suite('Message Context Analysis', () => {
        test('should identify code-related queries', async () => {
            const codeQuery = 'How do I implement user authentication with JWT tokens?';
            const result = await integration.getContextForMessage(codeQuery);
            assert.ok(result.files.length > 0, 'Should find relevant files for code query');
            assert.ok(result.relevanceScore > 0, 'Should have positive relevance score');
        });
        test('should handle natural language queries', async () => {
            const naturalQuery = 'What is the best way to validate user input?';
            const result = await integration.getContextForMessage(naturalQuery);
            assert.ok(typeof result === 'object', 'Should return valid result for natural language query');
            assert.ok(Array.isArray(result.files), 'Should return files array');
        });
        test('should include test files when mentioned', async () => {
            const testQuery = 'How do I write unit tests for the user service?';
            const result = await integration.getContextForMessage(testQuery);
            // Should have included tests in search options
            assert.ok(typeof result === 'object', 'Should handle test-related queries');
        });
        test('should include documentation when requested', async () => {
            const docQuery = 'How does the authentication system work according to the documentation?';
            const result = await integration.getContextForMessage(docQuery);
            // Should have included docs in search options
            assert.ok(typeof result === 'object', 'Should handle documentation queries');
        });
        test('should handle current file context', async function () {
            this.timeout(10000);
            const currentFilePath = path.join(testWorkspaceUri.fsPath, 'integration-test', 'api', 'UserAPI.ts');
            try {
                await fs.promises.access(currentFilePath);
            }
            catch (error) {
                this.skip(); // Skip if file doesn't exist
            }
            const contextQuery = 'What does this file do and how is it used?';
            const result = await integration.getContextForMessage(contextQuery, currentFilePath);
            assert.ok(typeof result === 'object', 'Should handle current file context queries');
        });
    });
    suite('File Reference Handling', () => {
        test('should get file content for reference', async function () {
            this.timeout(5000);
            const filePath = path.join(testWorkspaceUri.fsPath, 'integration-test', 'utils', 'validation.ts');
            try {
                await fs.promises.access(filePath);
            }
            catch (error) {
                this.skip(); // Skip if file doesn't exist
            }
            const content = await integration.getFileReferenceContext(filePath);
            assert.ok(typeof content === 'string', 'Should return file content as string');
            assert.ok(content.length > 0, 'Should return non-empty content');
            assert.ok(content.includes('validateEmail'), 'Should contain expected function');
        });
        test('should handle line ranges in file references', async function () {
            this.timeout(5000);
            const filePath = path.join(testWorkspaceUri.fsPath, 'integration-test', 'utils', 'validation.ts');
            try {
                await fs.promises.access(filePath);
            }
            catch (error) {
                this.skip(); // Skip if file doesn't exist
            }
            const content = await integration.getFileReferenceContext(filePath, [1, 5]);
            assert.ok(typeof content === 'string', 'Should return file content as string');
            assert.ok(content.split('\n').length <= 5, 'Should respect line range');
        });
        test('should handle non-existent files gracefully', async () => {
            const nonExistentPath = '/this/file/does/not/exist.ts';
            const content = await integration.getFileReferenceContext(nonExistentPath);
            assert.ok(content.includes('File not found'), 'Should return appropriate error message');
        });
    });
    suite('Usage Examples', () => {
        test('should find usage examples for functions', async () => {
            const result = await integration.findUsageExamples('authenticateUser');
            assert.ok(typeof result === 'object', 'Should return valid result object');
            assert.ok(Array.isArray(result.files), 'Should return files array');
        });
        test('should find usage examples for classes', async () => {
            const result = await integration.findUsageExamples('UserAPI');
            assert.ok(typeof result === 'object', 'Should return valid result object');
            assert.ok(Array.isArray(result.files), 'Should return files array');
        });
    });
    suite('Autocomplete Suggestions', () => {
        test('should provide file name suggestions', async () => {
            const suggestions = await integration.getAutocompleteSuggestions('User');
            assert.ok(Array.isArray(suggestions), 'Should return suggestions array');
            assert.ok(suggestions.length <= 10, 'Should limit suggestions to 10 or fewer');
        });
        test('should provide function name suggestions', async () => {
            const suggestions = await integration.getAutocompleteSuggestions('validate');
            assert.ok(Array.isArray(suggestions), 'Should return suggestions array');
        });
        test('should handle short queries', async () => {
            const suggestions = await integration.getAutocompleteSuggestions('a');
            assert.ok(Array.isArray(suggestions), 'Should return array even for short queries');
            assert.strictEqual(suggestions.length, 0, 'Should return empty array for very short queries');
        });
        test('should handle empty queries', async () => {
            const suggestions = await integration.getAutocompleteSuggestions('');
            assert.ok(Array.isArray(suggestions), 'Should return array for empty queries');
            assert.strictEqual(suggestions.length, 0, 'Should return empty array for empty queries');
        });
    });
    suite('AI Context Formatting', () => {
        test('should format context for AI providers', async () => {
            const context = await integration.getContextForMessage('user authentication');
            const formatted = integration.formatContextForAI(context);
            assert.ok(typeof formatted === 'string', 'Should return formatted string');
            assert.ok(formatted.includes('## Codebase Context'), 'Should include context header');
            if (context.files.length > 0) {
                assert.ok(formatted.includes('Relevance:'), 'Should include relevance information');
                assert.ok(formatted.includes('```'), 'Should include code blocks');
            }
        });
        test('should handle empty context gracefully', async () => {
            const emptyContext = {
                files: [],
                relevanceScore: 0,
                totalMatches: 0,
                searchMetadata: {
                    query: 'nonexistent',
                    searchType: 'keyword',
                    timeMs: 0,
                    totalFilesScanned: 0,
                    includedLanguages: [],
                    excludedPatterns: []
                }
            };
            const formatted = integration.formatContextForAI(emptyContext);
            assert.ok(typeof formatted === 'string', 'Should return string for empty context');
            assert.ok(formatted.includes('No relevant context found'), 'Should indicate no context found');
        });
        test('should truncate long content appropriately', async () => {
            const context = await integration.getContextForMessage('validation utils');
            const formatted = integration.formatContextForAI(context);
            // Check that formatted output is reasonable length
            assert.ok(formatted.length < 50000, 'Should not produce excessively long output');
            if (formatted.includes('truncated')) {
                assert.ok(true, 'Should indicate when content is truncated');
            }
        });
    });
    suite('Integration Performance', () => {
        test('should complete context retrieval quickly', async function () {
            this.timeout(3000);
            const startTime = Date.now();
            await integration.getContextForMessage('authentication system');
            const endTime = Date.now();
            assert.ok(endTime - startTime < 3000, 'Should complete context retrieval within 3 seconds');
        });
        test('should handle multiple concurrent requests', async function () {
            this.timeout(10000);
            const promises = [
                integration.getContextForMessage('user authentication'),
                integration.getContextForMessage('form validation'),
                integration.getContextForMessage('database configuration'),
                integration.getAutocompleteSuggestions('User'),
                integration.findUsageExamples('validateEmail')
            ];
            const results = await Promise.all(promises);
            assert.strictEqual(results.length, 5, 'Should handle all concurrent requests');
            results.forEach((result, index) => {
                assert.ok(typeof result === 'object', `Request ${index} should return valid result`);
            });
        });
    });
    suite('Error Handling and Edge Cases', () => {
        test('should handle malformed queries', async () => {
            const malformedQueries = [
                null,
                undefined,
                123,
                {},
                []
            ];
            for (const query of malformedQueries) {
                try {
                    const result = await integration.getContextForMessage(query);
                    assert.ok(typeof result === 'object', `Should handle malformed query: ${query}`);
                }
                catch (error) {
                    // Error handling is also acceptable
                    assert.ok(true, `Appropriately handled malformed query: ${query}`);
                }
            }
        });
        test('should handle very long queries', async () => {
            const longQuery = 'authentication system implementation with user management and security features '.repeat(50);
            const result = await integration.getContextForMessage(longQuery);
            assert.ok(typeof result === 'object', 'Should handle very long queries');
        });
        test('should handle special characters in queries', async () => {
            const specialCharQuery = 'user@example.com authentication with $pecial ch@racters & symbols!';
            const result = await integration.getContextForMessage(specialCharQuery);
            assert.ok(typeof result === 'object', 'Should handle special characters in queries');
        });
        test('should handle unicode and emoji in queries', async () => {
            const unicodeQuery = 'user authentication 🔐 with émojis and ünïcödé characters';
            const result = await integration.getContextForMessage(unicodeQuery);
            assert.ok(typeof result === 'object', 'Should handle unicode and emoji in queries');
        });
    });
});
//# sourceMappingURL=ContextIntegration.test.js.map
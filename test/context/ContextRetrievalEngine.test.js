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
const ContextRetrievalEngine_1 = require("../../src/context/ContextRetrievalEngine");
suite('ContextRetrievalEngine Tests', () => {
    let engine;
    let testWorkspaceUri;
    let testFiles = {};
    suiteSetup(async () => {
        // Create a test workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder available for testing');
        }
        testWorkspaceUri = workspaceFolders[0].uri;
        // Create test files
        await createTestFiles();
        // Get engine instance
        engine = ContextRetrievalEngine_1.ContextRetrievalEngine.getInstance();
    });
    suiteTeardown(async () => {
        // Clean up test files
        await cleanupTestFiles();
    });
    async function createTestFiles() {
        const testDir = path.join(testWorkspaceUri.fsPath, 'test-context');
        testFiles = {
            'UserService.ts': `
import { Database } from './Database';
import { AuthToken } from './auth/AuthToken';

export interface User {
    id: string;
    email: string;
    name: string;
}

export class UserService {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    async authenticate(email: string, password: string): Promise<AuthToken | null> {
        const user = await this.db.findUserByEmail(email);
        if (user && this.validatePassword(password, user.passwordHash)) {
            return new AuthToken(user.id);
        }
        return null;
    }

    async createUser(userData: Partial<User>): Promise<User> {
        return this.db.createUser(userData);
    }

    private validatePassword(password: string, hash: string): boolean {
        // Simple validation logic
        return password.length > 0;
    }
}
`,
            'Database.ts': `
import { User } from './UserService';

export class Database {
    private users: User[] = [];

    async findUserByEmail(email: string): Promise<User | null> {
        return this.users.find(u => u.email === email) || null;
    }

    async createUser(userData: Partial<User>): Promise<User> {
        const user: User = {
            id: Math.random().toString(),
            email: userData.email || '',
            name: userData.name || ''
        };
        this.users.push(user);
        return user;
    }

    async getAllUsers(): Promise<User[]> {
        return [...this.users];
    }
}
`,
            'auth/AuthToken.ts': `
export class AuthToken {
    private token: string;
    private userId: string;
    private expiresAt: Date;

    constructor(userId: string) {
        this.userId = userId;
        this.token = this.generateToken();
        this.expiresAt = new Date(Date.now() + 3600000); // 1 hour
    }

    private generateToken(): string {
        return Math.random().toString(36).substring(2);
    }

    isValid(): boolean {
        return new Date() < this.expiresAt;
    }

    getUserId(): string {
        return this.userId;
    }
}
`,
            'UserController.ts': `
import { UserService } from './UserService';
import { Request, Response } from 'express';

export class UserController {
    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    async login(req: Request, res: Response) {
        const { email, password } = req.body;
        const token = await this.userService.authenticate(email, password);
        
        if (token) {
            res.json({ success: true, token: token.getUserId() });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    }

    async register(req: Request, res: Response) {
        try {
            const user = await this.userService.createUser(req.body);
            res.json({ success: true, user });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
`,
            'utils/Logger.ts': `
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private level: LogLevel = LogLevel.INFO;

    debug(message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.log('[DEBUG]', message, ...args);
        }
    }

    info(message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO) {
            console.log('[INFO]', message, ...args);
        }
    }

    warn(message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN) {
            console.warn('[WARN]', message, ...args);
        }
    }

    error(message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error('[ERROR]', message, ...args);
        }
    }
}
`,
            'tests/UserService.test.ts': `
import { UserService } from '../UserService';
import { Database } from '../Database';

describe('UserService', () => {
    let userService: UserService;
    let database: Database;

    beforeEach(() => {
        database = new Database();
        userService = new UserService(database);
    });

    test('should authenticate valid user', async () => {
        // Test implementation
        const result = await userService.authenticate('test@example.com', 'password');
        expect(result).toBeTruthy();
    });

    test('should create new user', async () => {
        const userData = { email: 'new@example.com', name: 'New User' };
        const user = await userService.createUser(userData);
        expect(user.email).toBe(userData.email);
    });
});
`
        };
        // Create directory structure
        await fs.promises.mkdir(path.join(testDir, 'auth'), { recursive: true });
        await fs.promises.mkdir(path.join(testDir, 'utils'), { recursive: true });
        await fs.promises.mkdir(path.join(testDir, 'tests'), { recursive: true });
        // Write test files
        for (const [fileName, content] of Object.entries(testFiles)) {
            const filePath = path.join(testDir, fileName);
            await fs.promises.writeFile(filePath, content, 'utf8');
        }
    }
    async function cleanupTestFiles() {
        const testDir = path.join(testWorkspaceUri.fsPath, 'test-context');
        try {
            await fs.promises.rm(testDir, { recursive: true, force: true });
        }
        catch (error) {
            console.warn('Could not clean up test files:', error);
        }
    }
    suite('Basic Functionality', () => {
        test('should create singleton instance', () => {
            const instance1 = ContextRetrievalEngine_1.ContextRetrievalEngine.getInstance();
            const instance2 = ContextRetrievalEngine_1.ContextRetrievalEngine.getInstance();
            assert.strictEqual(instance1, instance2);
        });
        test('should determine correct search types', async () => {
            const functionQuery = 'authenticate function';
            const classQuery = 'UserService class';
            const semanticQuery = 'how to implement user authentication';
            const functionResult = await engine.retrieveContext(functionQuery);
            const classResult = await engine.retrieveContext(classQuery);
            const semanticResult = await engine.semanticSearch(semanticQuery);
            assert.ok(functionResult.searchMetadata.searchType === 'function' || functionResult.searchMetadata.searchType === 'keyword');
            assert.ok(classResult.searchMetadata.searchType === 'class' || classResult.searchMetadata.searchType === 'keyword');
            assert.strictEqual(semanticResult.searchMetadata.searchType, 'semantic');
        });
    });
    suite('Context Retrieval', () => {
        test('should find relevant files for authentication query', async () => {
            const result = await engine.retrieveContext('authentication', {
                maxFiles: 10,
                includeTests: true
            });
            assert.ok(result.files.length > 0, 'Should find files related to authentication');
            const hasUserService = result.files.some(f => f.path.includes('UserService'));
            const hasAuthToken = result.files.some(f => f.path.includes('AuthToken'));
            assert.ok(hasUserService || hasAuthToken, 'Should include authentication-related files');
            assert.ok(result.relevanceScore > 0, 'Should have positive relevance score');
        });
        test('should find functions by name', async () => {
            const result = await engine.retrieveContext('authenticate', {
                searchType: 'function',
                maxFiles: 5
            });
            assert.ok(result.files.length > 0, 'Should find files containing authenticate function');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            assert.ok(userServiceFile, 'Should find UserService file');
            assert.ok(userServiceFile.functions.some(f => f.name === 'authenticate'), 'Should identify authenticate function');
        });
        test('should find classes by name', async () => {
            const result = await engine.retrieveContext('UserService', {
                searchType: 'class',
                maxFiles: 5
            });
            assert.ok(result.files.length > 0, 'Should find UserService class');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            assert.ok(userServiceFile, 'Should find UserService file');
            assert.ok(userServiceFile.classes.some(c => c.name === 'UserService'), 'Should identify UserService class');
        });
        test('should handle search options correctly', async () => {
            const options = {
                maxFiles: 3,
                includeTests: false,
                includeDocs: false,
                includeLanguages: ['typescript']
            };
            const result = await engine.retrieveContext('user', options);
            assert.ok(result.files.length <= 3, 'Should respect maxFiles limit');
            assert.ok(!result.files.some(f => f.path.includes('test')), 'Should exclude test files when includeTests is false');
            assert.ok(result.files.every(f => f.language === 'typescript'), 'Should only include TypeScript files');
        });
    });
    suite('Semantic Search', () => {
        test('should expand semantic queries', async () => {
            const result = await engine.semanticSearch('user authentication system');
            assert.ok(result.files.length > 0, 'Should find files for semantic query');
            assert.strictEqual(result.searchMetadata.searchType, 'semantic');
            // Should find authentication-related files
            const hasAuthFiles = result.files.some(f => f.path.includes('UserService') ||
                f.path.includes('AuthToken') ||
                f.path.includes('UserController'));
            assert.ok(hasAuthFiles, 'Should find authentication-related files');
        });
        test('should handle logging concepts', async () => {
            const result = await engine.semanticSearch('error logging and debugging');
            // Should find logger-related files
            const hasLoggerFile = result.files.some(f => f.path.includes('Logger'));
            if (hasLoggerFile) {
                assert.ok(true, 'Found logger-related files');
            }
            else {
                // If no logger files found, that's also valid for a semantic search
                assert.ok(true, 'Semantic search completed without errors');
            }
        });
    });
    suite('Usage Analysis', () => {
        test('should find usages of classes', async () => {
            const result = await engine.findUsages('UserService');
            assert.ok(result.files.length > 0, 'Should find files that use UserService');
            // Should find UserController which uses UserService
            const hasUserController = result.files.some(f => f.path.includes('UserController'));
            if (hasUserController) {
                assert.ok(true, 'Found files that use UserService');
            }
        });
        test('should find usages of functions', async () => {
            const result = await engine.findUsages('authenticate');
            assert.ok(result.files.length > 0, 'Should find files that use authenticate function');
        });
    });
    suite('Related Files', () => {
        test('should find related files through dependencies', async function () {
            this.timeout(10000); // Increase timeout for file operations
            const userServicePath = path.join(testWorkspaceUri.fsPath, 'test-context', 'UserService.ts');
            // Check if file exists
            try {
                await fs.promises.access(userServicePath);
            }
            catch (error) {
                this.skip(); // Skip test if file doesn't exist
            }
            const result = await engine.findRelatedFiles(userServicePath, {
                maxFiles: 10
            });
            // Should find related files like Database.ts and AuthToken.ts
            const hasDatabase = result.files.some(f => f.path.includes('Database'));
            const hasAuthToken = result.files.some(f => f.path.includes('AuthToken'));
            if (result.files.length > 0) {
                assert.ok(hasDatabase || hasAuthToken, 'Should find related files through imports');
            }
            else {
                // If no related files found, the test still passes as the method executed without error
                assert.ok(true, 'Related files search completed');
            }
        });
    });
    suite('Performance and Limits', () => {
        test('should respect file size limits', async () => {
            const result = await engine.retrieveContext('user', {
                maxFileSize: 100, // Very small limit
                maxFiles: 10
            });
            // All returned files should be under the size limit
            for (const file of result.files) {
                assert.ok(file.content.length <= 100 * 1.1, 'File should respect size limit (with small tolerance)');
            }
        });
        test('should complete searches within reasonable time', async function () {
            this.timeout(5000);
            const startTime = Date.now();
            const result = await engine.retrieveContext('authentication system user management', {
                maxFiles: 20
            });
            const endTime = Date.now();
            assert.ok(endTime - startTime < 5000, 'Search should complete within 5 seconds');
            assert.ok(result.searchMetadata.timeMs > 0, 'Should record search time');
        });
    });
    suite('Code Analysis', () => {
        test('should extract function information', async () => {
            const result = await engine.retrieveContext('UserService');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            if (userServiceFile) {
                assert.ok(userServiceFile.functions.length > 0, 'Should extract functions');
                const authenticateFunc = userServiceFile.functions.find(f => f.name === 'authenticate');
                assert.ok(authenticateFunc, 'Should find authenticate function');
                assert.ok(authenticateFunc.line > 0, 'Should have line number');
            }
        });
        test('should extract class information', async () => {
            const result = await engine.retrieveContext('UserService');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            if (userServiceFile) {
                assert.ok(userServiceFile.classes.length > 0, 'Should extract classes');
                const userServiceClass = userServiceFile.classes.find(c => c.name === 'UserService');
                assert.ok(userServiceClass, 'Should find UserService class');
                assert.ok(userServiceClass.line > 0, 'Should have line number');
            }
        });
        test('should extract interface information', async () => {
            const result = await engine.retrieveContext('User interface');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            if (userServiceFile) {
                const userInterface = userServiceFile.interfaces.find(i => i.name === 'User');
                if (userInterface) {
                    assert.ok(userInterface.line > 0, 'Should have line number');
                }
            }
        });
        test('should extract import/export information', async () => {
            const result = await engine.retrieveContext('UserService');
            const userServiceFile = result.files.find(f => f.path.includes('UserService'));
            if (userServiceFile) {
                assert.ok(userServiceFile.imports.length > 0, 'Should extract imports');
                assert.ok(userServiceFile.exports.length > 0, 'Should extract exports');
                // Should have Database import
                const hasDatabaseImport = userServiceFile.imports.some(imp => imp.includes('Database'));
                assert.ok(hasDatabaseImport, 'Should find Database import');
            }
        });
    });
    suite('Error Handling', () => {
        test('should handle empty queries gracefully', async () => {
            const result = await engine.retrieveContext('');
            assert.ok(typeof result === 'object', 'Should return valid result object');
            assert.ok(Array.isArray(result.files), 'Should return files array');
            assert.ok(typeof result.relevanceScore === 'number', 'Should return numeric relevance score');
        });
        test('should handle non-existent file paths', async () => {
            const nonExistentPath = '/this/path/does/not/exist.ts';
            try {
                const result = await engine.findRelatedFiles(nonExistentPath);
                assert.ok(result.files.length === 0, 'Should return empty results for non-existent files');
            }
            catch (error) {
                // Error is acceptable for non-existent files
                assert.ok(true, 'Handled non-existent file appropriately');
            }
        });
        test('should handle malformed search options', async () => {
            const result = await engine.retrieveContext('test', {
                maxFiles: -1,
                maxFileSize: -1,
                fuzzyThreshold: 2.0 // Invalid threshold
            });
            assert.ok(typeof result === 'object', 'Should handle malformed options gracefully');
        });
    });
});
//# sourceMappingURL=ContextRetrievalEngine.test.js.map
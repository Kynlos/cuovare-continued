// Multi-file Editing Tool Demo
// This file demonstrates the capabilities of the MultiFileEditingTool

const demoOperations = [
    {
        description: "Create a new feature with multiple related files",
        files: [
            {
                filePath: "src/features/user-auth/AuthService.ts",
                operation: "create",
                content: `export class AuthService {
    private apiKey: string;
    
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }
    
    async login(username: string, password: string): Promise<boolean> {
        // Implementation here
        return true;
    }
    
    async logout(): Promise<void> {
        // Implementation here
    }
}`
            },
            {
                filePath: "src/features/user-auth/types.ts",
                operation: "create",
                content: `export interface User {
    id: string;
    username: string;
    email: string;
    createdAt: Date;
}

export interface AuthResponse {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}`
            },
            {
                filePath: "src/features/user-auth/index.ts",
                operation: "create",
                content: `export { AuthService } from './AuthService';
export { User, AuthResponse } from './types';`
            }
        ],
        atomic: true
    },
    
    {
        description: "Refactor component name across multiple files",
        files: [
            {
                filePath: "src/components/Button.tsx",
                operation: "edit",
                searchText: "export class Button",
                replaceText: "export class CustomButton"
            },
            {
                filePath: "src/components/Button.tsx",
                operation: "edit",
                searchText: "class Button extends",
                replaceText: "class CustomButton extends"
            },
            {
                filePath: "src/App.tsx",
                operation: "edit",
                searchText: "import { Button }",
                replaceText: "import { CustomButton }"
            },
            {
                filePath: "src/App.tsx",
                operation: "edit",
                searchText: "<Button",
                replaceText: "<CustomButton"
            },
            {
                filePath: "src/App.tsx",
                operation: "edit",
                searchText: "</Button>",
                replaceText: "</CustomButton>"
            }
        ],
        atomic: true
    },
    
    {
        description: "Update API configuration across project",
        files: [
            {
                filePath: "src/config/api.ts",
                operation: "edit",
                searchText: "https://api.old-domain.com",
                replaceText: "https://api.new-domain.com"
            },
            {
                filePath: "docs/api-reference.md",
                operation: "edit",
                searchText: "api.old-domain.com",
                replaceText: "api.new-domain.com"
            },
            {
                filePath: "package.json",
                operation: "edit",
                searchText: "\"homepage\": \"https://api.old-domain.com\"",
                replaceText: "\"homepage\": \"https://api.new-domain.com\""
            }
        ],
        atomic: true
    }
];

console.log("Multi-file Editing Tool Demo Operations:", demoOperations);

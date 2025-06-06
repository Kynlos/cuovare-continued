import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

interface FileEdit {
    filePath: string;
    operation: 'read' | 'write' | 'create' | 'edit' | 'delete';
    content?: string;
    searchText?: string;
    replaceText?: string;
    lineNumber?: number;
    insertAt?: string;
    backup?: boolean;
}

interface MultiFileOperation {
    description: string;
    files: FileEdit[];
    atomic?: boolean; // If true, all operations succeed or all fail
    dryRun?: boolean; // If true, just validate without executing
}

export class MultiFileEditingTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'multi_file_editing',
        description: 'Edit multiple files simultaneously with AI coordination, atomic operations, and rollback support',
        category: 'File Operations',
        parameters: [
            { name: 'description', description: 'Description of the multi-file operation', required: true, type: 'string' },
            { name: 'files', description: 'Array of file operations to perform', required: true, type: 'array' },
            { name: 'atomic', description: 'Whether all operations must succeed or all fail (default: true)', required: false, type: 'boolean' },
            { name: 'dryRun', description: 'Validate operations without executing (default: false)', required: false, type: 'boolean' }
        ],
        examples: [
            'Refactor component across files: { "description": "Rename Button to CustomButton", "files": [{"filePath": "src/Button.tsx", "operation": "edit", "searchText": "export class Button", "replaceText": "export class CustomButton"}, {"filePath": "src/App.tsx", "operation": "edit", "searchText": "import { Button }", "replaceText": "import { CustomButton }"}] }',
            'Create new feature with multiple files: { "description": "Add user authentication", "files": [{"filePath": "src/auth/AuthService.ts", "operation": "create", "content": "export class AuthService {}"}, {"filePath": "src/auth/types.ts", "operation": "create", "content": "export interface User {}"}] }',
            'Update configuration across multiple files: { "description": "Update API endpoint", "files": [{"filePath": "src/config.ts", "operation": "edit", "searchText": "api.old.com", "replaceText": "api.new.com"}, {"filePath": "docs/api.md", "operation": "edit", "searchText": "api.old.com", "replaceText": "api.new.com"}] }'
        ]
    };

    private backupFiles: Map<string, string> = new Map();

    async execute(payload: MultiFileOperation, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Starting multi-file operation: ${payload.description}`);
            
            const atomic = payload.atomic !== false; // Default to true
            const dryRun = payload.dryRun === true; // Default to false
            
            // Validate all file operations first
            const validationResults = await this.validateOperations(payload.files, context);
            if (!validationResults.valid) {
                return { 
                    success: false, 
                    message: `Validation failed: ${validationResults.errors.join(', ')}`,
                    data: { validationErrors: validationResults.errors }
                };
            }

            if (dryRun) {
                return {
                    success: true,
                    message: `Dry run successful: ${payload.files.length} operations validated`,
                    data: { operations: payload.files, validated: true }
                };
            }

            // Create backups if atomic mode is enabled
            if (atomic) {
                await this.createBackups(payload.files, context);
            }

            const results: Array<{ filePath: string; success: boolean; message: string }> = [];
            let failedOperation = false;

            // Execute operations
            for (let i = 0; i < payload.files.length; i++) {
                const fileOp = payload.files[i];
                context.onProgress?.(`Processing file ${i + 1}/${payload.files.length}: ${fileOp.filePath}`);
                
                try {
                    const result = await this.executeFileOperation(fileOp, context);
                    results.push({
                        filePath: fileOp.filePath,
                        success: result.success,
                        message: result.message
                    });

                    if (!result.success) {
                        failedOperation = true;
                        if (atomic) {
                            // Stop execution on first failure in atomic mode
                            break;
                        }
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        filePath: fileOp.filePath,
                        success: false,
                        message: errorMessage
                    });
                    failedOperation = true;
                    
                    if (atomic) {
                        break;
                    }
                }
            }

            // Handle rollback if needed
            if (failedOperation && atomic) {
                context.onProgress?.('Rolling back changes due to failure in atomic mode');
                await this.rollback(context);
                this.clearBackups();
                
                const failedResults = results.filter(r => !r.success);
                return {
                    success: false,
                    message: `Multi-file operation failed and rolled back. Failures: ${failedResults.map(r => `${r.filePath}: ${r.message}`).join('; ')}`,
                    data: { results, rolledBack: true }
                };
            }

            // Clear backups on success
            this.clearBackups();

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            // Try to open affected files in VS Code
            await this.openFilesInEditor(payload.files.filter(f => f.operation !== 'delete'), context);

            return {
                success: failureCount === 0,
                message: `Multi-file operation "${payload.description}" completed. ${successCount} succeeded, ${failureCount} failed.`,
                data: { 
                    results, 
                    summary: { 
                        total: payload.files.length, 
                        succeeded: successCount, 
                        failed: failureCount 
                    }
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Multi-file operation failed: ${errorMessage}`);
            
            // Attempt rollback on unexpected error
            if (payload.atomic !== false) {
                try {
                    await this.rollback(context);
                    this.clearBackups();
                } catch (rollbackError) {
                    context.outputChannel.appendLine(`Rollback failed: ${rollbackError}`);
                }
            }
            
            return { success: false, message: errorMessage };
        }
    }

    private async validateOperations(files: FileEdit[], context: { workspaceRoot: string }): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        for (const fileOp of files) {
            const filePath = path.resolve(context.workspaceRoot, fileOp.filePath);
            
            // Check if file is within workspace
            if (!filePath.startsWith(context.workspaceRoot)) {
                errors.push(`File outside workspace: ${fileOp.filePath}`);
                continue;
            }

            // Validate operation-specific requirements
            switch (fileOp.operation) {
                case 'read':
                case 'edit':
                case 'delete':
                    if (!fs.existsSync(filePath)) {
                        errors.push(`File not found for ${fileOp.operation}: ${fileOp.filePath}`);
                    }
                    break;
                case 'create':
                    if (fs.existsSync(filePath)) {
                        errors.push(`File already exists for create: ${fileOp.filePath}`);
                    }
                    break;
                case 'write':
                    // Write can create or overwrite, so no validation needed
                    break;
                default:
                    errors.push(`Unknown operation: ${fileOp.operation} for ${fileOp.filePath}`);
            }

            // Validate edit operation parameters
            if (fileOp.operation === 'edit') {
                const hasSearchReplace = fileOp.searchText !== undefined || fileOp.replaceText !== undefined;
                const hasLineContent = fileOp.lineNumber !== undefined && fileOp.content !== undefined;
                const hasInsertAt = fileOp.insertAt !== undefined && fileOp.content !== undefined;
                const hasContent = fileOp.content !== undefined;

                if (!hasSearchReplace && !hasLineContent && !hasInsertAt && !hasContent) {
                    errors.push(`Edit operation requires parameters for ${fileOp.filePath}`);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    private async createBackups(files: FileEdit[], context: { workspaceRoot: string }): Promise<void> {
        for (const fileOp of files) {
            if (fileOp.operation === 'create') continue; // No backup needed for new files
            
            const filePath = path.resolve(context.workspaceRoot, fileOp.filePath);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                this.backupFiles.set(filePath, content);
            }
        }
    }

    private async rollback(context: { workspaceRoot: string; outputChannel: any }): Promise<void> {
        for (const [filePath, content] of this.backupFiles) {
            try {
                fs.writeFileSync(filePath, content, 'utf8');
            } catch (error) {
                context.outputChannel.appendLine(`Failed to rollback ${filePath}: ${error}`);
            }
        }
    }

    private clearBackups(): void {
        this.backupFiles.clear();
    }

    private async executeFileOperation(fileOp: FileEdit, context: { workspaceRoot: string }): Promise<{ success: boolean; message: string }> {
        const filePath = path.resolve(context.workspaceRoot, fileOp.filePath);

        switch (fileOp.operation) {
            case 'read':
                const content = fs.readFileSync(filePath, 'utf8');
                return { success: true, message: `Read ${path.basename(filePath)} (${content.length} characters)` };

            case 'write':
            case 'create':
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, fileOp.content || '', 'utf8');
                return { success: true, message: `${fileOp.operation === 'create' ? 'Created' : 'Wrote'} ${path.basename(filePath)}` };

            case 'delete':
                fs.unlinkSync(filePath);
                return { success: true, message: `Deleted ${path.basename(filePath)}` };

            case 'edit':
                const originalContent = fs.readFileSync(filePath, 'utf8');
                let editedContent = originalContent;
                let editMessage = '';

                if (fileOp.searchText && fileOp.replaceText !== undefined) {
                    // Find and replace operation
                    const regex = new RegExp(fileOp.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    const matches = originalContent.match(regex);
                    editedContent = editedContent.replace(regex, fileOp.replaceText);
                    editMessage = `Replaced ${matches ? matches.length : 0} occurrence(s)`;
                } else if (fileOp.lineNumber && fileOp.content) {
                    // Insert at specific line
                    const lines = editedContent.split('\n');
                    const insertIndex = Math.max(0, Math.min(fileOp.lineNumber - 1, lines.length));
                    lines.splice(insertIndex, 0, fileOp.content);
                    editedContent = lines.join('\n');
                    editMessage = `Inserted at line ${fileOp.lineNumber}`;
                } else if (fileOp.insertAt && fileOp.content) {
                    // Insert at position
                    switch (fileOp.insertAt.toLowerCase()) {
                        case 'start':
                            editedContent = fileOp.content + '\n' + editedContent;
                            editMessage = 'Inserted at start';
                            break;
                        case 'end':
                            editedContent = editedContent + '\n' + fileOp.content;
                            editMessage = 'Appended to end';
                            break;
                        default:
                            const lineNum = parseInt(fileOp.insertAt);
                            if (!isNaN(lineNum)) {
                                const lines = editedContent.split('\n');
                                const insertIndex = Math.max(0, Math.min(lineNum - 1, lines.length));
                                lines.splice(insertIndex, 0, fileOp.content);
                                editedContent = lines.join('\n');
                                editMessage = `Inserted at line ${lineNum}`;
                            } else {
                                throw new Error('Invalid insertAt value');
                            }
                    }
                } else if (fileOp.content) {
                    // Replace entire content
                    editedContent = fileOp.content;
                    editMessage = 'Replaced entire content';
                } else {
                    throw new Error('Edit operation requires valid parameters');
                }

                fs.writeFileSync(filePath, editedContent, 'utf8');
                return { success: true, message: `Edited ${path.basename(filePath)}: ${editMessage}` };

            default:
                throw new Error(`Unknown operation: ${fileOp.operation}`);
        }
    }

    private async openFilesInEditor(files: FileEdit[], context: { workspaceRoot: string }): Promise<void> {
        try {
            const vscode = require('vscode');
            
            for (const fileOp of files) {
                const filePath = path.resolve(context.workspaceRoot, fileOp.filePath);
                if (fs.existsSync(filePath)) {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.window.showTextDocument(uri, { preview: false });
                }
            }
        } catch {
            // VS Code not available (running outside extension context)
        }
    }
}

export default new MultiFileEditingTool();

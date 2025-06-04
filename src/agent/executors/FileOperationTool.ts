import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

export class FileOperationTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'file_operation',
        description: 'Perform file operations like read, write, create, delete, edit, copy, and move files',
        category: 'File Operations',
        parameters: [
            { name: 'operation', description: 'Type of operation: read, write, create, delete, copy, move, edit', required: true, type: 'string' },
            { name: 'filePath', description: 'Path to the file (relative to workspace)', required: true, type: 'string' },
            { name: 'content', description: 'Content for write/create operations', required: false, type: 'string' },
            { name: 'targetPath', description: 'Target path for copy/move operations', required: false, type: 'string' },
            { name: 'searchText', description: 'Text to search for in edit operations', required: false, type: 'string' },
            { name: 'replaceText', description: 'Text to replace with in edit operations', required: false, type: 'string' },
            { name: 'lineNumber', description: 'Line number for line-specific edit operations', required: false, type: 'number' },
            { name: 'insertAt', description: 'Position to insert content: start, end, or line number', required: false, type: 'string' }
        ],
        examples: [
            'Read a file: { "operation": "read", "filePath": "src/index.ts" }',
            'Create a new file: { "operation": "create", "filePath": "src/utils.ts", "content": "export const helper = () => {};" }',
            'Write to file: { "operation": "write", "filePath": "src/app.ts", "content": "console.log(\'Hello World\');" }',
            'Edit file (find/replace): { "operation": "edit", "filePath": "src/app.ts", "searchText": "old code", "replaceText": "new code" }',
            'Edit file (insert at line): { "operation": "edit", "filePath": "src/app.ts", "content": "new line", "lineNumber": 5 }',
            'Edit file (append): { "operation": "edit", "filePath": "src/app.ts", "content": "new content", "insertAt": "end" }',
            'Copy a file: { "operation": "copy", "filePath": "src/component.tsx", "targetPath": "src/component.backup.tsx" }',
            'Move a file: { "operation": "move", "filePath": "old/path.ts", "targetPath": "new/path.ts" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Executing ${payload.operation} operation on ${payload.filePath}`);
            
            const filePath = path.resolve(context.workspaceRoot, payload.filePath);
            
            // Ensure file is within workspace
            if (!filePath.startsWith(context.workspaceRoot)) {
                throw new Error('File operation outside workspace not allowed');
            }

            switch (payload.operation) {
                case 'read':
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`File not found: ${payload.filePath}`);
                    }
                    const content = fs.readFileSync(filePath, 'utf8');
                    return { success: true, message: `Read ${path.basename(filePath)} (${content.length} characters):\n${content}` };

                case 'write':
                case 'create':
                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(filePath, payload.content || '', 'utf8');
                    
                    // Try to open file in VS Code if available
                    try {
                        const vscode = require('vscode');
                        const uri = vscode.Uri.file(filePath);
                        await vscode.window.showTextDocument(uri);
                    } catch {
                        // VS Code not available (running outside extension context)
                    }
                    
                    return { success: true, message: `${payload.operation === 'create' ? 'Created' : 'Wrote'} ${path.basename(filePath)} with ${(payload.content || '').length} characters` };

                case 'delete':
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`File not found: ${payload.filePath}`);
                    }
                    fs.unlinkSync(filePath);
                    return { success: true, message: `Deleted file: ${path.basename(filePath)}` };

                case 'copy':
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`Source file not found: ${payload.filePath}`);
                    }
                    if (!payload.targetPath) {
                        throw new Error('Target path is required for copy operation');
                    }
                    const targetPath = path.resolve(context.workspaceRoot, payload.targetPath);
                    if (!targetPath.startsWith(context.workspaceRoot)) {
                        throw new Error('Target path outside workspace not allowed');
                    }
                    const targetDir = path.dirname(targetPath);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    fs.copyFileSync(filePath, targetPath);
                    return { success: true, message: `Copied ${path.basename(filePath)} to ${path.basename(targetPath)}` };

                case 'move':
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`Source file not found: ${payload.filePath}`);
                    }
                    if (!payload.targetPath) {
                        throw new Error('Target path is required for move operation');
                    }
                    const moveTargetPath = path.resolve(context.workspaceRoot, payload.targetPath);
                    if (!moveTargetPath.startsWith(context.workspaceRoot)) {
                        throw new Error('Target path outside workspace not allowed');
                    }
                    const moveTargetDir = path.dirname(moveTargetPath);
                    if (!fs.existsSync(moveTargetDir)) {
                        fs.mkdirSync(moveTargetDir, { recursive: true });
                    }
                    fs.renameSync(filePath, moveTargetPath);
                    return { success: true, message: `Moved ${path.basename(filePath)} to ${path.basename(moveTargetPath)}` };

                case 'edit':
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`File not found: ${payload.filePath}`);
                    }
                    const originalContent = fs.readFileSync(filePath, 'utf8');
                    let editedContent = originalContent;
                    let editMessage = '';

                    if (payload.searchText && payload.replaceText !== undefined) {
                        // Find and replace operation
                        const beforeLength = editedContent.length;
                        editedContent = editedContent.replace(new RegExp(payload.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), payload.replaceText);
                        const replacements = (beforeLength - editedContent.length + payload.replaceText.length * (editedContent.split(payload.replaceText).length - 1)) / payload.searchText.length;
                        editMessage = `Replaced ${Math.floor(replacements)} occurrence(s) of "${payload.searchText}" with "${payload.replaceText}"`;
                    } else if (payload.lineNumber && payload.content) {
                        // Insert at specific line
                        const lines = editedContent.split('\n');
                        const insertIndex = Math.max(0, Math.min(payload.lineNumber - 1, lines.length));
                        lines.splice(insertIndex, 0, payload.content);
                        editedContent = lines.join('\n');
                        editMessage = `Inserted content at line ${payload.lineNumber}`;
                    } else if (payload.insertAt && payload.content) {
                        // Insert at position
                        switch (payload.insertAt.toLowerCase()) {
                            case 'start':
                                editedContent = payload.content + '\n' + editedContent;
                                editMessage = 'Inserted content at the beginning of file';
                                break;
                            case 'end':
                                editedContent = editedContent + '\n' + payload.content;
                                editMessage = 'Appended content to the end of file';
                                break;
                            default:
                                const lineNum = parseInt(payload.insertAt);
                                if (!isNaN(lineNum)) {
                                    const lines = editedContent.split('\n');
                                    const insertIndex = Math.max(0, Math.min(lineNum - 1, lines.length));
                                    lines.splice(insertIndex, 0, payload.content);
                                    editedContent = lines.join('\n');
                                    editMessage = `Inserted content at line ${lineNum}`;
                                } else {
                                    throw new Error('Invalid insertAt value. Use "start", "end", or a line number');
                                }
                        }
                    } else if (payload.content) {
                        // Replace entire content
                        editedContent = payload.content;
                        editMessage = 'Replaced entire file content';
                    } else {
                        throw new Error('Edit operation requires either searchText/replaceText, lineNumber/content, insertAt/content, or just content');
                    }

                    fs.writeFileSync(filePath, editedContent, 'utf8');
                    
                    // Try to open file in VS Code if available
                    try {
                        const vscode = require('vscode');
                        const uri = vscode.Uri.file(filePath);
                        await vscode.window.showTextDocument(uri);
                    } catch {
                        // VS Code not available
                    }
                    
                    return { success: true, message: `Edited ${path.basename(filePath)}: ${editMessage}` };

                default:
                    throw new Error(`Unknown file operation: ${payload.operation}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`File operation failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }
}

export default new FileOperationTool();

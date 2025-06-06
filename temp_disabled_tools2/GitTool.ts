import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

const execAsync = promisify(exec);

export class GitTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'git_operation',
        description: 'Perform Git operations like commit, push, pull, branch management, and repository analysis',
        category: 'Version Control',
        parameters: [
            { name: 'operation', description: 'Git operation: status, add, commit, push, pull, branch, checkout, log, diff', required: true, type: 'string' },
            { name: 'files', description: 'Files to operate on', required: false, type: 'array' },
            { name: 'message', description: 'Commit message', required: false, type: 'string' },
            { name: 'branchName', description: 'Branch name for operations', required: false, type: 'string' }
        ],
        examples: [
            'Check status: { "operation": "status" }',
            'Commit changes: { "operation": "commit", "message": "feat: add new feature", "files": ["src/app.ts"] }',
            'Create branch: { "operation": "branch", "branchName": "feature/new-ui" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: vscode.OutputChannel;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Executing git ${payload.operation}`);
            
            let command = 'git';
            
            switch (payload.operation) {
                case 'status':
                    command += ' status --porcelain';
                    break;
                    
                case 'add':
                    if (payload.files && payload.files.length > 0) {
                        command += ` add ${payload.files.join(' ')}`;
                    } else {
                        command += ' add .';
                    }
                    break;
                    
                case 'commit':
                    if (payload.files && payload.files.length > 0) {
                        command += ` add ${payload.files.join(' ')} && git commit -m "${payload.message || 'Auto commit'}"`;
                    } else {
                        command += ` commit -m "${payload.message || 'Auto commit'}"`;
                    }
                    break;
                    
                case 'push':
                    command += ' push';
                    break;
                    
                case 'pull':
                    command += ' pull';
                    break;
                    
                case 'branch':
                    if (payload.branchName) {
                        command += ` branch ${payload.branchName}`;
                    } else {
                        command += ' branch';
                    }
                    break;
                    
                case 'checkout':
                    if (payload.branchName) {
                        command += ` checkout ${payload.branchName}`;
                    } else {
                        throw new Error('Branch name required for checkout');
                    }
                    break;
                    
                case 'log':
                    command += ' log --oneline -10';
                    break;
                    
                case 'diff':
                    command += ' diff';
                    break;
                    
                default:
                    throw new Error(`Unknown git operation: ${payload.operation}`);
            }

            const { stdout, stderr } = await execAsync(command, { cwd: context.workspaceRoot });
            
            let result = `Git ${payload.operation} completed successfully\n`;
            if (stdout) result += `\nOutput:\n${stdout}`;
            if (stderr) result += `\nMessages:\n${stderr}`;

            return { success: true, message: result };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Git operation failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }
}

export default new GitTool();

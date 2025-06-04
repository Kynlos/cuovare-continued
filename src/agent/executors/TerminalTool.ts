import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

const execAsync = promisify(exec);

export class TerminalTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'terminal',
        description: 'Execute terminal commands safely with configurable environment and timeout',
        category: 'Development Tools',
        parameters: [
            { name: 'command', description: 'Command to execute', required: true, type: 'string' },
            { name: 'args', description: 'Command arguments', required: false, type: 'array' },
            { name: 'cwd', description: 'Working directory (relative to workspace)', required: false, type: 'string' },
            { name: 'timeout', description: 'Timeout in milliseconds', required: false, type: 'number' }
        ],
        examples: [
            'Build project: { "command": "npm", "args": ["run", "build"] }',
            'Run tests: { "command": "npm", "args": ["test"], "timeout": 30000 }',
            'Check git status: { "command": "git", "args": ["status"] }'
        ]
    };

    private static readonly SAFE_COMMANDS = [
        'npm', 'yarn', 'pnpm', 'node', 'tsc', 'eslint', 'prettier',
        'git', 'make', 'cargo', 'go', 'python', 'pip',
        'ls', 'dir', 'cat', 'type', 'echo', 'which', 'where',
        'jest', 'vitest', 'mocha', 'cypress', 'playwright'
    ];

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: vscode.OutputChannel;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            const command = payload.command;
            const args = payload.args || [];
            const timeout = payload.timeout || 30000;
            
            context.onProgress?.(`Executing command: ${command}${args.length ? ' ' + args.join(' ') : ''}`);
            
            // Safety check
            if (!TerminalTool.SAFE_COMMANDS.includes(command)) {
                throw new Error(`Command '${command}' is not in the safe commands list`);
            }

            const fullCommand = `${command}${args.length ? ' ' + args.join(' ') : ''}`;
            const cwd = payload.cwd ? `${context.workspaceRoot}/${payload.cwd}` : context.workspaceRoot;

            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(fullCommand, { cwd, timeout });
            const duration = Date.now() - startTime;

            let result = `Command executed successfully in ${duration}ms\n`;
            if (stdout) result += `\nOutput:\n${stdout}`;
            if (stderr) result += `\nWarnings:\n${stderr}`;

            return { success: true, message: result };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Terminal command failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }
}

export default new TerminalTool();

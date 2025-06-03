import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface FileContext {
    path: string;
    content: string;
    language: string;
    lineCount: number;
    size: number;
}

export interface ProjectContext {
    files: FileContext[];
    summary: string;
    totalFiles: number;
    totalLines: number;
}

export class FileContextManager {
    private excludePatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.map',
        '**/logs/**',
        '**/temp/**',
        '**/tmp/**'
    ];

    private maxFileSize = 1024 * 1024; // 1MB
    private maxTotalFiles = 50;

    public async getProjectContext(): Promise<ProjectContext> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return {
                files: [],
                summary: 'No workspace folder open',
                totalFiles: 0,
                totalLines: 0
            };
        }

        const config = vscode.workspace.getConfiguration('cuovare');
        const maxContextFiles = config.get<number>('maxContextFiles', 50);
        const autoIncludeOpenFiles = config.get<boolean>('autoIncludeOpenFiles', true);

        let files: FileContext[] = [];
        let totalLines = 0;

        // Always include open files if enabled
        if (autoIncludeOpenFiles) {
            const openFiles = await this.getOpenFiles();
            files.push(...openFiles);
            totalLines += openFiles.reduce((sum, file) => sum + file.lineCount, 0);
        }

        // Add project files up to the limit
        const remainingSlots = Math.max(0, maxContextFiles - files.length);
        if (remainingSlots > 0) {
            const projectFiles = await this.getProjectFiles(workspaceFolders[0], remainingSlots);
            
            // Filter out already included files
            const existingPaths = new Set(files.map(f => f.path));
            const newFiles = projectFiles.filter(f => !existingPaths.has(f.path));
            
            files.push(...newFiles);
            totalLines += newFiles.reduce((sum, file) => sum + file.lineCount, 0);
        }

        const summary = this.generateProjectSummary(files);

        return {
            files,
            summary,
            totalFiles: files.length,
            totalLines
        };
    }

    public async getOpenFiles(): Promise<FileContext[]> {
        const openFiles: FileContext[] = [];
        
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.scheme === 'file') {
                const fileContext = await this.createFileContext(editor.document.uri);
                if (fileContext) {
                    openFiles.push(fileContext);
                }
            }
        }

        return openFiles;
    }

    public async getSelectedFileContext(): Promise<FileContext | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file') {
            return null;
        }

        return this.createFileContext(editor.document.uri);
    }

    public async getFileContent(filePath: string): Promise<string | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getText();
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return null;
        }
    }

    private async getProjectFiles(workspaceFolder: vscode.WorkspaceFolder, maxFiles: number): Promise<FileContext[]> {
        const files: FileContext[] = [];
        
        try {
            // Find relevant files using VS Code's file search
            const fileUris = await vscode.workspace.findFiles(
                '**/*',
                `{${this.excludePatterns.join(',')}}`,
                maxFiles * 2 // Get more files to filter later
            );

            // Prioritize important files
            const sortedUris = this.prioritizeFiles(fileUris);

            for (const uri of sortedUris) {
                if (files.length >= maxFiles) break;

                const fileContext = await this.createFileContext(uri);
                if (fileContext) {
                    files.push(fileContext);
                }
            }
        } catch (error) {
            console.error('Error reading project files:', error);
        }

        return files;
    }

    private prioritizeFiles(uris: vscode.Uri[]): vscode.Uri[] {
        const priorities: Record<string, number> = {
            // Configuration files
            'package.json': 10,
            'tsconfig.json': 9,
            'webpack.config.js': 8,
            'vite.config.js': 8,
            '.eslintrc': 7,
            'README.md': 6,
            
            // Main files
            'index.ts': 5,
            'index.js': 5,
            'main.ts': 5,
            'main.js': 5,
            'app.ts': 4,
            'app.js': 4
        };

        return uris.sort((a, b) => {
            const nameA = path.basename(a.fsPath);
            const nameB = path.basename(b.fsPath);
            
            const priorityA = priorities[nameA] || 0;
            const priorityB = priorities[nameB] || 0;
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }
            
            // Prefer TypeScript over JavaScript
            if (nameA.endsWith('.ts') && nameB.endsWith('.js')) return -1;
            if (nameA.endsWith('.js') && nameB.endsWith('.ts')) return 1;
            
            // Prefer shorter paths (closer to root)
            const depthA = a.fsPath.split(path.sep).length;
            const depthB = b.fsPath.split(path.sep).length;
            
            return depthA - depthB;
        });
    }

    private async createFileContext(uri: vscode.Uri): Promise<FileContext | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            
            // Skip large files
            if (stat.size > this.maxFileSize) {
                return null;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const language = document.languageId;
            const lineCount = document.lineCount;

            return {
                path: uri.fsPath,
                content,
                language,
                lineCount,
                size: stat.size
            };
        } catch (error) {
            console.error(`Error creating file context for ${uri.fsPath}:`, error);
            return null;
        }
    }

    private generateProjectSummary(files: FileContext[]): string {
        if (files.length === 0) {
            return 'No files in context';
        }

        const languages = new Map<string, number>();
        const fileTypes = new Map<string, number>();
        let totalLines = 0;

        for (const file of files) {
            languages.set(file.language, (languages.get(file.language) || 0) + 1);
            
            const ext = path.extname(file.path);
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
            
            totalLines += file.lineCount;
        }

        const topLanguages = Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang, count]) => `${lang} (${count})`)
            .join(', ');

        const summary = [
            `Project contains ${files.length} files with ${totalLines} total lines.`,
            `Primary languages: ${topLanguages}.`,
            'Files include configuration, source code, and documentation.'
        ].join(' ');

        return summary;
    }

    public async searchFiles(query: string): Promise<FileContext[]> {
        const results: FileContext[] = [];
        
        try {
            const uris = await vscode.workspace.findFiles(
                '**/*',
                `{${this.excludePatterns.join(',')}}`,
                100
            );

            for (const uri of uris) {
                const content = await this.getFileContent(uri.fsPath);
                if (content && content.toLowerCase().includes(query.toLowerCase())) {
                    const fileContext = await this.createFileContext(uri);
                    if (fileContext) {
                        results.push(fileContext);
                    }
                }
            }
        } catch (error) {
            console.error('Error searching files:', error);
        }

        return results;
    }

    public getRelativePath(filePath: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return path.basename(filePath);
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        return path.relative(workspacePath, filePath);
    }
}

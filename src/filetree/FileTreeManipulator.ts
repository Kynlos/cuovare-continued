import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * File Tree Manipulation System
 * Create, move, and organize files with AI assistance
 */

export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: Date;
    language?: string;
    children?: FileTreeNode[];
    parent?: FileTreeNode;
}

export interface FileOperation {
    type: 'create' | 'move' | 'rename' | 'delete' | 'copy';
    source?: string;
    target: string;
    content?: string;
    options?: {
        overwrite?: boolean;
        recursive?: boolean;
        backup?: boolean;
    };
}

export interface FileTreeStructure {
    name: string;
    type: 'file' | 'directory';
    content?: string;
    children?: FileTreeStructure[];
}

export interface OrganizationSuggestion {
    description: string;
    operations: FileOperation[];
    reasoning: string;
    impact: {
        filesAffected: number;
        directoriesCreated: number;
        estimatedTime: string;
    };
    confidence: number;
}

export interface FileTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    structure: FileTreeStructure;
    variables: { [key: string]: string };
    frameworks: string[];
}

export class FileTreeManipulator {
    private static instance: FileTreeManipulator;
    private workspaceRoot: string = '';
    private fileWatcher?: vscode.FileSystemWatcher;
    private templates: Map<string, FileTemplate> = new Map();

    private constructor() {
        this.initializeTemplates();
    }

    public static getInstance(): FileTreeManipulator {
        if (!this.instance) {
            this.instance = new FileTreeManipulator();
        }
        return this.instance;
    }

    /**
     * Initialize with workspace context
     */
    public async initialize(workspaceRoot: string): Promise<void> {
        this.workspaceRoot = workspaceRoot;
        await this.setupFileWatcher();
    }

    /**
     * Get complete file tree structure
     */
    public async getFileTree(rootPath: string = this.workspaceRoot): Promise<FileTreeNode> {
        return await this.buildFileTree(rootPath);
    }

    /**
     * Create files and directories from structure
     */
    public async createStructure(
        structure: FileTreeStructure, 
        basePath: string = this.workspaceRoot,
        variables: { [key: string]: string } = {}
    ): Promise<string[]> {
        const createdPaths: string[] = [];
        
        try {
            await this.createStructureRecursive(structure, basePath, variables, createdPaths);
            return createdPaths;
        } catch (error) {
            // Rollback on error
            await this.rollbackCreation(createdPaths);
            throw error;
        }
    }

    /**
     * Move files and directories
     */
    public async moveFiles(operations: FileOperation[]): Promise<{
        successful: FileOperation[];
        failed: { operation: FileOperation; error: string }[];
    }> {
        const successful: FileOperation[] = [];
        const failed: { operation: FileOperation; error: string }[] = [];

        for (const operation of operations) {
            try {
                await this.executeOperation(operation);
                successful.push(operation);
            } catch (error) {
                failed.push({
                    operation,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return { successful, failed };
    }

    /**
     * Get AI-powered organization suggestions
     */
    public async getOrganizationSuggestions(
        targetPath: string = this.workspaceRoot,
        intent: 'cleanup' | 'structure' | 'optimize' | 'standardize' = 'structure'
    ): Promise<OrganizationSuggestion[]> {
        const fileTree = await this.getFileTree(targetPath);
        const analysis = await this.analyzeProjectStructure(fileTree);
        
        const suggestions: OrganizationSuggestion[] = [];

        switch (intent) {
            case 'cleanup':
                suggestions.push(...await this.generateCleanupSuggestions(analysis));
                break;
            case 'structure':
                suggestions.push(...await this.generateStructureSuggestions(analysis));
                break;
            case 'optimize':
                suggestions.push(...await this.generateOptimizationSuggestions(analysis));
                break;
            case 'standardize':
                suggestions.push(...await this.generateStandardizationSuggestions(analysis));
                break;
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Create project from template
     */
    public async createFromTemplate(
        templateId: string,
        targetPath: string,
        variables: { [key: string]: string } = {}
    ): Promise<string[]> {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }

        // Merge template variables with provided variables
        const allVariables = { ...template.variables, ...variables };

        return await this.createStructure(template.structure, targetPath, allVariables);
    }

    /**
     * Generate file structure from description
     */
    public async generateStructureFromDescription(
        description: string,
        language: string = 'typescript',
        framework?: string
    ): Promise<FileTreeStructure> {
        // AI-powered structure generation based on description
        const analysis = this.analyzeDescription(description, language, framework);
        return this.buildStructureFromAnalysis(analysis);
    }

    /**
     * Get available templates
     */
    public getTemplates(framework?: string, category?: string): FileTemplate[] {
        let templates = Array.from(this.templates.values());

        if (framework) {
            templates = templates.filter(t => t.frameworks.includes(framework));
        }

        if (category) {
            templates = templates.filter(t => t.category === category);
        }

        return templates;
    }

    /**
     * Backup files before operations
     */
    public async createBackup(paths: string[]): Promise<string> {
        const backupDir = path.join(this.workspaceRoot, '.cuovare-backup', Date.now().toString());
        await fs.mkdir(backupDir, { recursive: true });

        for (const filePath of paths) {
            try {
                const stat = await fs.stat(filePath);
                const relativePath = path.relative(this.workspaceRoot, filePath);
                const backupPath = path.join(backupDir, relativePath);

                await fs.mkdir(path.dirname(backupPath), { recursive: true });

                if (stat.isDirectory()) {
                    await this.copyDirectory(filePath, backupPath);
                } else {
                    await fs.copyFile(filePath, backupPath);
                }
            } catch (error) {
                console.warn(`Failed to backup ${filePath}:`, error);
            }
        }

        return backupDir;
    }

    /**
     * Restore from backup
     */
    public async restoreFromBackup(backupDir: string): Promise<void> {
        const backupTree = await this.buildFileTree(backupDir);
        await this.restoreTreeRecursive(backupTree, this.workspaceRoot);
    }

    /**
     * Find files by pattern with AI enhancement
     */
    public async findFiles(
        pattern: string,
        type: 'name' | 'content' | 'smart' = 'smart',
        rootPath: string = this.workspaceRoot
    ): Promise<FileTreeNode[]> {
        const allFiles = await this.getAllFiles(rootPath);
        
        switch (type) {
            case 'name':
                return this.findByName(allFiles, pattern);
            case 'content':
                return await this.findByContent(allFiles, pattern);
            case 'smart':
                return await this.findSmart(allFiles, pattern);
            default:
                return [];
        }
    }

    /**
     * Get file statistics
     */
    public async getProjectStatistics(rootPath: string = this.workspaceRoot): Promise<{
        totalFiles: number;
        totalDirectories: number;
        totalSize: number;
        languageDistribution: { [language: string]: number };
        largestFiles: { path: string; size: number }[];
        recentFiles: { path: string; modified: Date }[];
        structure: {
            depth: number;
            avgFilesPerDirectory: number;
            emptyDirectories: string[];
        };
    }> {
        const fileTree = await this.getFileTree(rootPath);
        return this.analyzeTreeStatistics(fileTree);
    }

    // Private helper methods

    private async buildFileTree(dirPath: string, parent?: FileTreeNode): Promise<FileTreeNode> {
        const stat = await fs.stat(dirPath);
        const name = path.basename(dirPath);
        
        const node: FileTreeNode = {
            name,
            path: dirPath,
            type: stat.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            modified: stat.mtime,
            parent
        };

        if (stat.isDirectory()) {
            try {
                const entries = await fs.readdir(dirPath);
                node.children = [];

                for (const entry of entries) {
                    if (this.shouldIncludeInTree(entry)) {
                        const childPath = path.join(dirPath, entry);
                        try {
                            const childNode = await this.buildFileTree(childPath, node);
                            node.children.push(childNode);
                        } catch (error) {
                            // Skip inaccessible files/directories
                        }
                    }
                }
            } catch (error) {
                // Directory not accessible
            }
        } else {
            node.language = this.detectLanguage(name);
        }

        return node;
    }

    private shouldIncludeInTree(name: string): boolean {
        const excludePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.vscode',
            '.idea',
            '__pycache__',
            '*.pyc',
            '.DS_Store',
            'Thumbs.db'
        ];

        return !excludePatterns.some(pattern => {
            if (pattern.startsWith('*')) {
                return name.endsWith(pattern.substring(1));
            }
            return name === pattern || name.includes(pattern);
        });
    }

    private detectLanguage(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: { [ext: string]: string } = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown'
        };

        return languageMap[ext] || 'plaintext';
    }

    private async createStructureRecursive(
        structure: FileTreeStructure,
        basePath: string,
        variables: { [key: string]: string },
        createdPaths: string[]
    ): Promise<void> {
        const targetPath = path.join(basePath, this.substituteVariables(structure.name, variables));

        if (structure.type === 'directory') {
            await fs.mkdir(targetPath, { recursive: true });
            createdPaths.push(targetPath);

            if (structure.children) {
                for (const child of structure.children) {
                    await this.createStructureRecursive(child, targetPath, variables, createdPaths);
                }
            }
        } else {
            const content = structure.content ? this.substituteVariables(structure.content, variables) : '';
            await fs.writeFile(targetPath, content, 'utf8');
            createdPaths.push(targetPath);
        }
    }

    private substituteVariables(text: string, variables: { [key: string]: string }): string {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    private async executeOperation(operation: FileOperation): Promise<void> {
        switch (operation.type) {
            case 'create':
                await this.createFile(operation.target, operation.content);
                break;
            case 'move':
                if (!operation.source) throw new Error('Source required for move operation');
                await this.moveFile(operation.source, operation.target);
                break;
            case 'rename':
                if (!operation.source) throw new Error('Source required for rename operation');
                await this.moveFile(operation.source, operation.target);
                break;
            case 'delete':
                await this.deleteFile(operation.target);
                break;
            case 'copy':
                if (!operation.source) throw new Error('Source required for copy operation');
                await this.copyFile(operation.source, operation.target);
                break;
        }
    }

    private async createFile(filePath: string, content: string = ''): Promise<void> {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
    }

    private async moveFile(source: string, target: string): Promise<void> {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(source, target);
    }

    private async deleteFile(filePath: string): Promise<void> {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await fs.rmdir(filePath, { recursive: true });
        } else {
            await fs.unlink(filePath);
        }
    }

    private async copyFile(source: string, target: string): Promise<void> {
        await fs.mkdir(path.dirname(target), { recursive: true });
        const stat = await fs.stat(source);
        
        if (stat.isDirectory()) {
            await this.copyDirectory(source, target);
        } else {
            await fs.copyFile(source, target);
        }
    }

    private async copyDirectory(source: string, target: string): Promise<void> {
        await fs.mkdir(target, { recursive: true });
        const entries = await fs.readdir(source);

        for (const entry of entries) {
            const sourcePath = path.join(source, entry);
            const targetPath = path.join(target, entry);
            
            const stat = await fs.stat(sourcePath);
            if (stat.isDirectory()) {
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
        }
    }

    private async rollbackCreation(createdPaths: string[]): Promise<void> {
        // Delete in reverse order to handle nested structures
        for (const filePath of createdPaths.reverse()) {
            try {
                await this.deleteFile(filePath);
            } catch (error) {
                // Continue cleanup even if some files can't be deleted
            }
        }
    }

    private async analyzeProjectStructure(fileTree: FileTreeNode): Promise<any> {
        // Analyze project structure for organization suggestions
        return {
            hasTests: this.hasTestFiles(fileTree),
            hasComponents: this.hasComponentFiles(fileTree),
            hasUtils: this.hasUtilFiles(fileTree),
            depth: this.calculateDepth(fileTree),
            fileCount: this.countFiles(fileTree),
            languages: this.getLanguageDistribution(fileTree),
            structure: this.identifyStructurePattern(fileTree)
        };
    }

    private async generateCleanupSuggestions(analysis: any): Promise<OrganizationSuggestion[]> {
        const suggestions: OrganizationSuggestion[] = [];

        // Example cleanup suggestion
        if (analysis.fileCount > 100) {
            suggestions.push({
                description: 'Organize loose files into appropriate directories',
                operations: [
                    {
                        type: 'create',
                        target: path.join(this.workspaceRoot, 'src', 'utils'),
                    },
                    {
                        type: 'create', 
                        target: path.join(this.workspaceRoot, 'src', 'components'),
                    }
                ],
                reasoning: 'Large number of files detected. Creating organized directory structure will improve maintainability.',
                impact: {
                    filesAffected: analysis.fileCount,
                    directoriesCreated: 2,
                    estimatedTime: '5-10 minutes'
                },
                confidence: 0.8
            });
        }

        return suggestions;
    }

    private async generateStructureSuggestions(analysis: any): Promise<OrganizationSuggestion[]> {
        return []; // Implementation would analyze and suggest structural improvements
    }

    private async generateOptimizationSuggestions(analysis: any): Promise<OrganizationSuggestion[]> {
        return []; // Implementation would suggest performance optimizations
    }

    private async generateStandardizationSuggestions(analysis: any): Promise<OrganizationSuggestion[]> {
        return []; // Implementation would suggest standardization improvements
    }

    private hasTestFiles(node: FileTreeNode): boolean {
        if (node.name.includes('test') || node.name.includes('spec')) return true;
        if (node.children) {
            return node.children.some(child => this.hasTestFiles(child));
        }
        return false;
    }

    private hasComponentFiles(node: FileTreeNode): boolean {
        if (node.name.includes('component') || node.name.includes('Component')) return true;
        if (node.children) {
            return node.children.some(child => this.hasComponentFiles(child));
        }
        return false;
    }

    private hasUtilFiles(node: FileTreeNode): boolean {
        if (node.name.includes('util') || node.name.includes('helper')) return true;
        if (node.children) {
            return node.children.some(child => this.hasUtilFiles(child));
        }
        return false;
    }

    private calculateDepth(node: FileTreeNode): number {
        if (!node.children || node.children.length === 0) return 1;
        return 1 + Math.max(...node.children.map(child => this.calculateDepth(child)));
    }

    private countFiles(node: FileTreeNode): number {
        let count = node.type === 'file' ? 1 : 0;
        if (node.children) {
            count += node.children.reduce((sum, child) => sum + this.countFiles(child), 0);
        }
        return count;
    }

    private getLanguageDistribution(node: FileTreeNode): { [language: string]: number } {
        const distribution: { [language: string]: number } = {};
        
        const traverse = (n: FileTreeNode) => {
            if (n.type === 'file' && n.language) {
                distribution[n.language] = (distribution[n.language] || 0) + 1;
            }
            if (n.children) {
                n.children.forEach(traverse);
            }
        };

        traverse(node);
        return distribution;
    }

    private identifyStructurePattern(node: FileTreeNode): string {
        // Identify common project structure patterns
        if (this.hasDirectoryNamed(node, 'src')) return 'src-based';
        if (this.hasDirectoryNamed(node, 'lib')) return 'lib-based';
        if (this.hasDirectoryNamed(node, 'app')) return 'app-based';
        return 'flat';
    }

    private hasDirectoryNamed(node: FileTreeNode, name: string): boolean {
        if (node.type === 'directory' && node.name === name) return true;
        if (node.children) {
            return node.children.some(child => this.hasDirectoryNamed(child, name));
        }
        return false;
    }

    private async getAllFiles(rootPath: string): Promise<FileTreeNode[]> {
        const files: FileTreeNode[] = [];
        const tree = await this.buildFileTree(rootPath);
        
        const traverse = (node: FileTreeNode) => {
            if (node.type === 'file') {
                files.push(node);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        };

        traverse(tree);
        return files;
    }

    private findByName(files: FileTreeNode[], pattern: string): FileTreeNode[] {
        const regex = new RegExp(pattern, 'i');
        return files.filter(file => regex.test(file.name));
    }

    private async findByContent(files: FileTreeNode[], pattern: string): Promise<FileTreeNode[]> {
        const matches: FileTreeNode[] = [];
        const regex = new RegExp(pattern, 'i');

        for (const file of files) {
            try {
                const content = await fs.readFile(file.path, 'utf8');
                if (regex.test(content)) {
                    matches.push(file);
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }

        return matches;
    }

    private async findSmart(files: FileTreeNode[], pattern: string): Promise<FileTreeNode[]> {
        // Combine name and content search with AI-enhanced relevance
        const nameMatches = this.findByName(files, pattern);
        const contentMatches = await this.findByContent(files, pattern);
        
        // Merge and deduplicate
        const allMatches = new Map<string, FileTreeNode>();
        
        nameMatches.forEach(file => allMatches.set(file.path, file));
        contentMatches.forEach(file => allMatches.set(file.path, file));

        return Array.from(allMatches.values());
    }

    private analyzeTreeStatistics(tree: FileTreeNode): any {
        const stats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSize: 0,
            languageDistribution: {} as { [language: string]: number },
            largestFiles: [] as { path: string; size: number }[],
            recentFiles: [] as { path: string; modified: Date }[],
            structure: {
                depth: 0,
                avgFilesPerDirectory: 0,
                emptyDirectories: [] as string[]
            }
        };

        const allFiles: FileTreeNode[] = [];
        const allDirs: FileTreeNode[] = [];

        const traverse = (node: FileTreeNode, depth: number = 0) => {
            stats.structure.depth = Math.max(stats.structure.depth, depth);

            if (node.type === 'file') {
                stats.totalFiles++;
                stats.totalSize += node.size || 0;
                allFiles.push(node);

                if (node.language) {
                    stats.languageDistribution[node.language] = 
                        (stats.languageDistribution[node.language] || 0) + 1;
                }
            } else {
                stats.totalDirectories++;
                allDirs.push(node);

                if (!node.children || node.children.length === 0) {
                    stats.structure.emptyDirectories.push(node.path);
                }
            }

            if (node.children) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        };

        traverse(tree);

        // Calculate averages
        stats.structure.avgFilesPerDirectory = stats.totalDirectories > 0 
            ? stats.totalFiles / stats.totalDirectories 
            : 0;

        // Find largest files
        stats.largestFiles = allFiles
            .sort((a, b) => (b.size || 0) - (a.size || 0))
            .slice(0, 10)
            .map(f => ({ path: f.path, size: f.size || 0 }));

        // Find recent files
        stats.recentFiles = allFiles
            .filter(f => f.modified)
            .sort((a, b) => (b.modified?.getTime() || 0) - (a.modified?.getTime() || 0))
            .slice(0, 10)
            .map(f => ({ path: f.path, modified: f.modified! }));

        return stats;
    }

    private analyzeDescription(description: string, language: string, framework?: string): any {
        // AI-powered analysis of description to determine structure
        const analysis = {
            type: 'application',
            components: [] as string[],
            features: [] as string[],
            directories: [] as string[],
            files: [] as string[]
        };

        // Simple pattern matching - could be enhanced with AI
        if (description.includes('component') || description.includes('ui')) {
            analysis.directories.push('components');
        }
        if (description.includes('api') || description.includes('service')) {
            analysis.directories.push('services', 'api');
        }
        if (description.includes('util') || description.includes('helper')) {
            analysis.directories.push('utils');
        }
        if (description.includes('test')) {
            analysis.directories.push('tests');
        }

        return analysis;
    }

    private buildStructureFromAnalysis(analysis: any): FileTreeStructure {
        const structure: FileTreeStructure = {
            name: '${projectName}',
            type: 'directory',
            children: []
        };

        // Add standard directories based on analysis
        for (const dir of analysis.directories) {
            structure.children!.push({
                name: dir,
                type: 'directory',
                children: []
            });
        }

        // Add basic files
        structure.children!.push({
            name: 'README.md',
            type: 'file',
            content: '# ${projectName}\n\n${description}\n'
        });

        return structure;
    }

    private async setupFileWatcher(): Promise<void> {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        const pattern = new vscode.RelativePattern(this.workspaceRoot, '**/*');
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(uri => {
            // Handle file creation
        });

        this.fileWatcher.onDidChange(uri => {
            // Handle file changes
        });

        this.fileWatcher.onDidDelete(uri => {
            // Handle file deletion
        });
    }

    private async restoreTreeRecursive(node: FileTreeNode, targetBase: string): Promise<void> {
        const targetPath = path.join(targetBase, path.relative(path.dirname(node.path), node.path));

        if (node.type === 'directory') {
            await fs.mkdir(targetPath, { recursive: true });
            if (node.children) {
                for (const child of node.children) {
                    await this.restoreTreeRecursive(child, targetBase);
                }
            }
        } else {
            await fs.copyFile(node.path, targetPath);
        }
    }

    private initializeTemplates(): void {
        // Initialize built-in templates
        const templates: FileTemplate[] = [
            {
                id: 'react-app',
                name: 'React Application',
                description: 'Modern React application with TypeScript',
                category: 'Frontend',
                structure: {
                    name: '${projectName}',
                    type: 'directory',
                    children: [
                        {
                            name: 'src',
                            type: 'directory',
                            children: [
                                {
                                    name: 'components',
                                    type: 'directory',
                                    children: []
                                },
                                {
                                    name: 'hooks',
                                    type: 'directory',
                                    children: []
                                },
                                {
                                    name: 'utils',
                                    type: 'directory',
                                    children: []
                                },
                                {
                                    name: 'App.tsx',
                                    type: 'file',
                                    content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>\${projectName}</h1>
      <p>\${description}</p>
    </div>
  );
}

export default App;`
                                }
                            ]
                        },
                        {
                            name: 'public',
                            type: 'directory',
                            children: [
                                {
                                    name: 'index.html',
                                    type: 'file',
                                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${projectName}</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`
                                }
                            ]
                        }
                    ]
                },
                variables: {
                    projectName: 'My React App',
                    description: 'A new React application'
                },
                frameworks: ['React']
            }
        ];

        for (const template of templates) {
            this.templates.set(template.id, template);
        }
    }
}

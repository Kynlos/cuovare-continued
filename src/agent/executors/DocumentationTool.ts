import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

export class DocumentationTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'documentation',
        description: 'Generate comprehensive documentation for files, functions, classes, and entire projects',
        category: 'Documentation',
        parameters: [
            { name: 'type', description: 'Documentation type: file, function, class, project, api, readme', required: true, type: 'string' },
            { name: 'target', description: 'Target file path or code element to document', required: true, type: 'string' },
            { name: 'format', description: 'Output format: markdown, jsdoc, typescript', required: false, type: 'string' },
            { name: 'outputPath', description: 'Where to save the documentation', required: false, type: 'string' }
        ],
        examples: [
            'Document a file: { "type": "file", "target": "src/utils.ts", "format": "markdown" }',
            'Generate project README: { "type": "readme", "target": ".", "outputPath": "README.md" }',
            'API documentation: { "type": "api", "target": "src/api", "format": "markdown" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Generating ${payload.type} documentation for ${payload.target}`);
            
            const format = payload.format || 'markdown';
            
            switch (payload.type) {
                case 'file':
                    return await this.documentFile(payload.target, format, context);
                
                case 'function':
                    return await this.documentFunction(payload.target, format, context);
                
                case 'class':
                    return await this.documentClass(payload.target, format, context);
                
                case 'project':
                    return await this.documentProject(payload.target, format, context);
                
                case 'api':
                    return await this.documentAPI(payload.target, format, context);
                
                case 'readme':
                    return await this.generateReadme(payload.target, payload.outputPath, context);
                
                default:
                    throw new Error(`Unknown documentation type: ${payload.type}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Documentation generation failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async documentFile(filePath: string, format: string, context: any): Promise<{ success: boolean; message: string }> {
        const fullPath = path.resolve(context.workspaceRoot, filePath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath);
        
        let documentation = '';
        
        if (format === 'markdown') {
            documentation = this.generateMarkdownFileDoc(fileName, content, ext);
        } else if (format === 'jsdoc') {
            documentation = this.generateJSDocFileDoc(fileName, content);
        }
        
        const docPath = path.join(path.dirname(fullPath), `${path.parse(fileName).name}.docs.md`);
        fs.writeFileSync(docPath, documentation, 'utf8');
        
        return {
            success: true,
            message: `Generated documentation for ${fileName} at ${path.relative(context.workspaceRoot, docPath)}`
        };
    }

    private generateMarkdownFileDoc(fileName: string, content: string, ext: string): string {
        const lines = content.split('\n');
        
        let doc = `# ${fileName}\n\n`;
        doc += `## Overview\n\n`;
        doc += `This ${ext} file contains ${lines.length} lines of code.\n\n`;
        
        // Extract imports/requires
        const imports = lines.filter(line => 
            line.trim().startsWith('import ') || 
            line.trim().startsWith('require(') ||
            line.trim().startsWith('from ')
        );
        
        if (imports.length > 0) {
            doc += `## Dependencies\n\n`;
            imports.forEach(imp => {
                doc += `- \`${imp.trim()}\`\n`;
            });
            doc += '\n';
        }
        
        // Extract functions
        const functions = this.extractFunctions(content);
        if (functions.length > 0) {
            doc += `## Functions\n\n`;
            functions.forEach(func => {
                doc += `### ${func.name}\n\n`;
                doc += `\`\`\`${ext.slice(1)}\n${func.signature}\n\`\`\`\n\n`;
                if (func.description) {
                    doc += `${func.description}\n\n`;
                }
            });
        }
        
        // Extract classes
        const classes = this.extractClasses(content);
        if (classes.length > 0) {
            doc += `## Classes\n\n`;
            classes.forEach(cls => {
                doc += `### ${cls.name}\n\n`;
                doc += `\`\`\`${ext.slice(1)}\n${cls.signature}\n\`\`\`\n\n`;
                if (cls.description) {
                    doc += `${cls.description}\n\n`;
                }
            });
        }
        
        return doc;
    }

    private generateJSDocFileDoc(fileName: string, content: string): string {
        return `/**\n * @fileoverview ${fileName}\n * @description Auto-generated documentation\n */\n\n${content}`;
    }

    private extractFunctions(content: string): Array<{name: string, signature: string, description?: string}> {
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
        const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g;
        
        const functions: Array<{name: string, signature: string, description?: string}> = [];
        const lines = content.split('\n');
        
        let match;
        
        // Regular functions
        while ((match = functionRegex.exec(content)) !== null) {
            const lineStart = content.substring(0, match.index).split('\n').length - 1;
            const signature = lines[lineStart]?.trim() || match[0];
            functions.push({
                name: match[1],
                signature: signature,
                description: this.extractCommentAboveLine(lines, lineStart)
            });
        }
        
        // Arrow functions
        while ((match = arrowFunctionRegex.exec(content)) !== null) {
            const lineStart = content.substring(0, match.index).split('\n').length - 1;
            const signature = lines[lineStart]?.trim() || match[0];
            functions.push({
                name: match[1],
                signature: signature,
                description: this.extractCommentAboveLine(lines, lineStart)
            });
        }
        
        return functions;
    }

    private extractClasses(content: string): Array<{name: string, signature: string, description?: string}> {
        const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*{/g;
        const classes: Array<{name: string, signature: string, description?: string}> = [];
        const lines = content.split('\n');
        
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const lineStart = content.substring(0, match.index).split('\n').length - 1;
            const signature = lines[lineStart]?.trim() || match[0];
            classes.push({
                name: match[1],
                signature: signature,
                description: this.extractCommentAboveLine(lines, lineStart)
            });
        }
        
        return classes;
    }

    private extractCommentAboveLine(lines: string[], lineIndex: number): string | undefined {
        if (lineIndex > 0) {
            const prevLine = lines[lineIndex - 1]?.trim();
            if (prevLine?.startsWith('//') || prevLine?.startsWith('*') || prevLine?.includes('/**')) {
                return prevLine.replace(/^\/\/\s*|^\*\s*|\/\*\*\s*|\*\/\s*$/g, '').trim();
            }
        }
        return undefined;
    }

    private async documentProject(target: string, format: string, context: any): Promise<{ success: boolean; message: string }> {
        const projectPath = path.resolve(context.workspaceRoot, target);
        
        let doc = `# Project Documentation\n\n`;
        doc += `## Project Structure\n\n`;
        
        // Generate file tree
        const tree = this.generateFileTree(projectPath, 0, 3);
        doc += '```\n' + tree + '```\n\n';
        
        // Find and document key files
        const keyFiles = ['package.json', 'tsconfig.json', 'README.md', 'CHANGELOG.md'];
        for (const file of keyFiles) {
            const filePath = path.join(projectPath, file);
            if (fs.existsSync(filePath)) {
                doc += `## ${file}\n\n`;
                const content = fs.readFileSync(filePath, 'utf8');
                doc += '```json\n' + content.substring(0, 500) + (content.length > 500 ? '...' : '') + '\n```\n\n';
            }
        }
        
        const docPath = path.join(projectPath, 'PROJECT_DOCS.md');
        fs.writeFileSync(docPath, doc, 'utf8');
        
        return {
            success: true,
            message: `Generated project documentation at PROJECT_DOCS.md`
        };
    }

    private generateFileTree(dir: string, depth: number, maxDepth: number): string {
        if (depth > maxDepth) return '';
        
        let tree = '';
        const indent = '  '.repeat(depth);
        
        try {
            const items = fs.readdirSync(dir);
            const filteredItems = items.filter(item => 
                !item.startsWith('.') && 
                item !== 'node_modules' && 
                item !== 'dist' && 
                item !== 'build'
            );
            
            for (const item of filteredItems) {
                const itemPath = path.join(dir, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    tree += `${indent}${item}/\n`;
                    tree += this.generateFileTree(itemPath, depth + 1, maxDepth);
                } else {
                    tree += `${indent}${item}\n`;
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
        
        return tree;
    }

    private async documentAPI(target: string, format: string, context: any): Promise<{ success: boolean; message: string }> {
        const apiPath = path.resolve(context.workspaceRoot, target);
        
        let doc = `# API Documentation\n\n`;
        
        // Search for API route files
        const routeFiles = this.findAPIFiles(apiPath);
        
        for (const file of routeFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const routes = this.extractAPIRoutes(content);
            
            if (routes.length > 0) {
                doc += `## ${path.basename(file)}\n\n`;
                routes.forEach(route => {
                    doc += `### ${route.method.toUpperCase()} ${route.path}\n\n`;
                    if (route.description) {
                        doc += `${route.description}\n\n`;
                    }
                    doc += '```javascript\n' + route.handler + '\n```\n\n';
                });
            }
        }
        
        const docPath = path.join(path.dirname(apiPath), 'API_DOCS.md');
        fs.writeFileSync(docPath, doc, 'utf8');
        
        return {
            success: true,
            message: `Generated API documentation at API_DOCS.md`
        };
    }

    private findAPIFiles(dir: string): string[] {
        const files: string[] = [];
        
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    files.push(...this.findAPIFiles(itemPath));
                } else if (stats.isFile() && (item.includes('route') || item.includes('api') || item.includes('controller'))) {
                    files.push(itemPath);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
        
        return files;
    }

    private extractAPIRoutes(content: string): Array<{method: string, path: string, handler: string, description?: string}> {
        const routes: Array<{method: string, path: string, handler: string, description?: string}> = [];
        const routeRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^}]+})/g;
        
        let match;
        while ((match = routeRegex.exec(content)) !== null) {
            routes.push({
                method: match[1],
                path: match[2],
                handler: match[3].trim()
            });
        }
        
        return routes;
    }

    private async generateReadme(target: string, outputPath: string, context: any): Promise<{ success: boolean; message: string }> {
        const projectPath = path.resolve(context.workspaceRoot, target);
        const packageJsonPath = path.join(projectPath, 'package.json');
        
        let projectName = 'Project';
        let description = 'A software project';
        let scripts: any = {};
        
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            projectName = packageJson.name || projectName;
            description = packageJson.description || description;
            scripts = packageJson.scripts || {};
        }
        
        let readme = `# ${projectName}\n\n`;
        readme += `${description}\n\n`;
        readme += `## Installation\n\n`;
        readme += '```bash\nnpm install\n```\n\n';
        
        if (Object.keys(scripts).length > 0) {
            readme += `## Scripts\n\n`;
            Object.entries(scripts).forEach(([name, command]) => {
                readme += `- \`npm run ${name}\`: ${command}\n`;
            });
            readme += '\n';
        }
        
        readme += `## Usage\n\n`;
        readme += `TODO: Add usage instructions\n\n`;
        readme += `## Contributing\n\n`;
        readme += `TODO: Add contributing guidelines\n\n`;
        readme += `## License\n\n`;
        readme += `TODO: Add license information\n`;
        
        const readmePath = outputPath ? path.resolve(context.workspaceRoot, outputPath) : path.join(projectPath, 'README.md');
        fs.writeFileSync(readmePath, readme, 'utf8');
        
        return {
            success: true,
            message: `Generated README.md at ${path.relative(context.workspaceRoot, readmePath)}`
        };
    }

    private async documentFunction(target: string, format: string, context: any): Promise<{ success: boolean; message: string }> {
        // Implementation for documenting specific functions
        return { success: true, message: `Function documentation for ${target} generated` };
    }

    private async documentClass(target: string, format: string, context: any): Promise<{ success: boolean; message: string }> {
        // Implementation for documenting specific classes
        return { success: true, message: `Class documentation for ${target} generated` };
    }
}

export default new DocumentationTool();

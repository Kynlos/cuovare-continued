import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolMetadata } from '../ToolRegistry';

export class RefactoringTool implements ToolExecutor {
    public metadata: ToolMetadata = {
        name: 'refactoring',
        description: 'Perform code refactoring operations like extract function, rename, move files, and optimize imports',
        category: 'Code Refactoring',
        parameters: [
            { name: 'operation', description: 'Refactoring operation: extract_function, rename, move_file, optimize_imports, extract_interface, split_file', required: true, type: 'string' },
            { name: 'filePath', description: 'Target file path', required: true, type: 'string' },
            { name: 'selection', description: 'Code selection or target name', required: false, type: 'string' },
            { name: 'newName', description: 'New name for rename operations', required: false, type: 'string' },
            { name: 'targetPath', description: 'Target path for move operations', required: false, type: 'string' }
        ],
        examples: [
            'Extract function: { "operation": "extract_function", "filePath": "src/utils.ts", "selection": "lines 10-20", "newName": "calculateTotal" }',
            'Rename variable: { "operation": "rename", "filePath": "src/app.ts", "selection": "userService", "newName": "authService" }',
            'Optimize imports: { "operation": "optimize_imports", "filePath": "src/components/App.tsx" }'
        ]
    };

    async execute(payload: any, context: {
        workspaceRoot: string;
        outputChannel: any;
        onProgress?: (message: string) => void;
    }): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            context.onProgress?.(`Performing ${payload.operation} refactoring on ${payload.filePath}`);
            
            const filePath = path.resolve(context.workspaceRoot, payload.filePath);
            
            if (!filePath.startsWith(context.workspaceRoot)) {
                throw new Error('File operation outside workspace not allowed');
            }
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${payload.filePath}`);
            }

            switch (payload.operation) {
                case 'extract_function':
                    return await this.extractFunction(filePath, payload.selection, payload.newName, context);
                
                case 'rename':
                    return await this.renameSymbol(filePath, payload.selection, payload.newName, context);
                
                case 'move_file':
                    return await this.moveFile(filePath, payload.targetPath, context);
                
                case 'optimize_imports':
                    return await this.optimizeImports(filePath, context);
                
                case 'extract_interface':
                    return await this.extractInterface(filePath, payload.selection, payload.newName, context);
                
                case 'split_file':
                    return await this.splitFile(filePath, context);
                
                default:
                    throw new Error(`Unknown refactoring operation: ${payload.operation}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            context.outputChannel.appendLine(`Refactoring failed: ${errorMessage}`);
            return { success: false, message: errorMessage };
        }
    }

    private async extractFunction(filePath: string, selection: string, newName: string, context: any): Promise<{ success: boolean; message: string }> {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        if (!newName) {
            throw new Error('New function name is required for extract_function operation');
        }
        
        // Parse selection (e.g., "lines 10-20" or specific code)
        let startLine = 0, endLine = 0;
        
        if (selection.includes('lines ')) {
            const match = selection.match(/lines (\d+)-(\d+)/);
            if (match) {
                startLine = parseInt(match[1]) - 1; // Convert to 0-based
                endLine = parseInt(match[2]) - 1;
            }
        } else {
            // Find the selection in the code
            const selectionIndex = content.indexOf(selection);
            if (selectionIndex !== -1) {
                const beforeSelection = content.substring(0, selectionIndex);
                startLine = beforeSelection.split('\n').length - 1;
                endLine = startLine + selection.split('\n').length - 1;
            }
        }
        
        if (startLine >= 0 && endLine >= startLine && endLine < lines.length) {
            const extractedCode = lines.slice(startLine, endLine + 1);
            const indentation = this.getIndentation(lines[startLine]);
            
            // Create the new function
            const functionCode = [
                '',
                `${indentation}function ${newName}() {`,
                ...extractedCode.map(line => `    ${line}`),
                `${indentation}}`,
                ''
            ];
            
            // Replace the extracted code with function call
            const newLines = [
                ...lines.slice(0, startLine),
                `${indentation}${newName}();`,
                ...lines.slice(endLine + 1)
            ];
            
            // Insert function before the current function/class
            const insertionPoint = this.findInsertionPoint(newLines, startLine);
            newLines.splice(insertionPoint, 0, ...functionCode);
            
            const newContent = newLines.join('\n');
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            return {
                success: true,
                message: `Extracted function '${newName}' from ${path.basename(filePath)} (lines ${startLine + 1}-${endLine + 1})`
            };
        } else {
            throw new Error('Invalid selection for extraction');
        }
    }

    private async renameSymbol(filePath: string, oldName: string, newName: string, context: any): Promise<{ success: boolean; message: string }> {
        if (!oldName || !newName) {
            throw new Error('Both old name and new name are required for rename operation');
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const newContent = content.replace(regex, newName);
        
        const matches = (content.match(regex) || []).length;
        
        if (matches > 0) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            return {
                success: true,
                message: `Renamed '${oldName}' to '${newName}' (${matches} occurrences) in ${path.basename(filePath)}`
            };
        } else {
            return {
                success: true,
                message: `No occurrences of '${oldName}' found in ${path.basename(filePath)}`
            };
        }
    }

    private async moveFile(filePath: string, targetPath: string, context: any): Promise<{ success: boolean; message: string }> {
        if (!targetPath) {
            throw new Error('Target path is required for move_file operation');
        }
        
        const fullTargetPath = path.resolve(context.workspaceRoot, targetPath);
        
        if (!fullTargetPath.startsWith(context.workspaceRoot)) {
            throw new Error('Target path outside workspace not allowed');
        }
        
        const targetDir = path.dirname(fullTargetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        fs.renameSync(filePath, fullTargetPath);
        
        // Update import statements in other files
        await this.updateImportsAfterMove(filePath, fullTargetPath, context);
        
        return {
            success: true,
            message: `Moved ${path.basename(filePath)} to ${path.relative(context.workspaceRoot, fullTargetPath)}`
        };
    }

    private async optimizeImports(filePath: string, context: any): Promise<{ success: boolean; message: string }> {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Find all import statements
        const imports: string[] = [];
        const otherLines: string[] = [];
        let inImportSection = true;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
                imports.push(line);
            } else if (trimmed === '' && inImportSection) {
                // Keep empty lines in import section
            } else {
                if (trimmed !== '') {
                    inImportSection = false;
                }
                otherLines.push(line);
            }
        }
        
        // Sort and deduplicate imports
        const sortedImports = [...new Set(imports)].sort((a, b) => {
            // External imports first, then relative imports
            const aIsExternal = !a.includes('./') && !a.includes('../');
            const bIsExternal = !b.includes('./') && !b.includes('../');
            
            if (aIsExternal && !bIsExternal) return -1;
            if (!aIsExternal && bIsExternal) return 1;
            
            return a.localeCompare(b);
        });
        
        // Rebuild file content
        const newContent = [
            ...sortedImports,
            '',
            ...otherLines
        ].join('\n');
        
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        return {
            success: true,
            message: `Optimized imports in ${path.basename(filePath)} (${imports.length} imports sorted and deduplicated)`
        };
    }

    private async extractInterface(filePath: string, className: string, interfaceName: string, context: any): Promise<{ success: boolean; message: string }> {
        if (!className || !interfaceName) {
            throw new Error('Class name and interface name are required for extract_interface operation');
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find class definition
        const classRegex = new RegExp(`class\\s+${className}\\s*{([^}]+)}`, 's');
        const match = content.match(classRegex);
        
        if (!match) {
            throw new Error(`Class '${className}' not found in file`);
        }
        
        const classBody = match[1];
        
        // Extract public methods and properties
        const publicMembers = this.extractPublicMembers(classBody);
        
        if (publicMembers.length === 0) {
            return {
                success: true,
                message: `No public members found in class '${className}' to extract`
            };
        }
        
        // Create interface
        const interfaceCode = [
            `export interface ${interfaceName} {`,
            ...publicMembers.map(member => `    ${member};`),
            '}',
            ''
        ].join('\n');
        
        // Insert interface before class
        const classIndex = content.indexOf(match[0]);
        const newContent = content.substring(0, classIndex) + interfaceCode + '\n' + content.substring(classIndex);
        
        fs.writeFileSync(filePath, newContent, 'utf8');
        
        return {
            success: true,
            message: `Extracted interface '${interfaceName}' with ${publicMembers.length} members from class '${className}'`
        };
    }

    private async splitFile(filePath: string, context: any): Promise<{ success: boolean; message: string }> {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.parse(filePath).name;
        const dir = path.dirname(filePath);
        
        // Find classes and functions to split
        const classes = this.findClasses(content);
        const functions = this.findStandaloneFunctions(content);
        
        if (classes.length <= 1 && functions.length <= 1) {
            return {
                success: true,
                message: `File ${path.basename(filePath)} doesn't need splitting (only 1 class/function found)`
            };
        }
        
        let filesCreated = 0;
        const imports = this.extractImports(content);
        
        // Split each class into its own file
        for (const cls of classes) {
            const newFileName = `${cls.name}.ts`;
            const newFilePath = path.join(dir, newFileName);
            
            const newContent = [
                ...imports,
                '',
                cls.code,
                ''
            ].join('\n');
            
            fs.writeFileSync(newFilePath, newContent, 'utf8');
            filesCreated++;
        }
        
        // Split large functions into separate files
        for (const func of functions) {
            if (func.code.split('\n').length > 10) { // Only split large functions
                const newFileName = `${func.name}.ts`;
                const newFilePath = path.join(dir, newFileName);
                
                const newContent = [
                    ...imports,
                    '',
                    func.code,
                    ''
                ].join('\n');
                
                fs.writeFileSync(newFilePath, newContent, 'utf8');
                filesCreated++;
            }
        }
        
        return {
            success: true,
            message: `Split ${path.basename(filePath)} into ${filesCreated} separate files`
        };
    }

    private getIndentation(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    private findInsertionPoint(lines: string[], currentLine: number): number {
        // Find the start of the current function/class to insert before it
        for (let i = currentLine - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('function ') || line.startsWith('class ') || line.startsWith('export')) {
                return i;
            }
        }
        return Math.max(0, currentLine - 5); // Fallback
    }

    private async updateImportsAfterMove(oldPath: string, newPath: string, context: any): Promise<void> {
        // This would typically scan all TypeScript files and update import paths
        // For now, we'll just log that this should be done
        context.outputChannel.appendLine(`Note: Import statements may need to be updated in other files`);
    }

    private extractPublicMembers(classBody: string): string[] {
        const members: string[] = [];
        const lines = classBody.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip private/protected members
            if (trimmed.startsWith('private ') || trimmed.startsWith('protected ')) {
                continue;
            }
            
            // Extract method signatures
            if (trimmed.includes('(') && (trimmed.includes('{') || trimmed.endsWith(';'))) {
                const signature = trimmed.replace(/\s*{.*$/, '').replace(/;$/, '');
                if (signature && !signature.startsWith('//') && !signature.startsWith('*')) {
                    members.push(signature);
                }
            }
            
            // Extract property declarations
            if (trimmed.includes(':') && !trimmed.includes('(') && !trimmed.includes('=')) {
                const property = trimmed.replace(/;$/, '');
                if (property && !property.startsWith('//') && !property.startsWith('*')) {
                    members.push(property);
                }
            }
        }
        
        return members;
    }

    private findClasses(content: string): Array<{name: string, code: string}> {
        const classes: Array<{name: string, code: string}> = [];
        const classRegex = /export\s+class\s+(\w+)[\s\S]*?^}/gm;
        
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            classes.push({
                name: match[1],
                code: match[0]
            });
        }
        
        return classes;
    }

    private findStandaloneFunctions(content: string): Array<{name: string, code: string}> {
        const functions: Array<{name: string, code: string}> = [];
        const funcRegex = /export\s+(?:async\s+)?function\s+(\w+)[\s\S]*?^}/gm;
        
        let match;
        while ((match = funcRegex.exec(content)) !== null) {
            functions.push({
                name: match[1],
                code: match[0]
            });
        }
        
        return functions;
    }

    private extractImports(content: string): string[] {
        const imports: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.trim().startsWith('import ') || line.trim().startsWith('from ')) {
                imports.push(line);
            }
        }
        
        return imports;
    }
}

export default new RefactoringTool();

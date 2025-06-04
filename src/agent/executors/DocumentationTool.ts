import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

interface FileStructure {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileStructure[];
    functions?: FunctionInfo[];
    classes?: ClassInfo[];
    interfaces?: InterfaceInfo[];
    exports?: ExportInfo[];
    imports?: ImportInfo[];
}

interface FunctionInfo {
    name: string;
    parameters: string[];
    returnType: string;
    description: string;
    line: number;
    isAsync: boolean;
    isExported: boolean;
}

interface ClassInfo {
    name: string;
    methods: FunctionInfo[];
    properties: PropertyInfo[];
    extends?: string;
    implements?: string[];
    description: string;
    line: number;
    isExported: boolean;
}

interface InterfaceInfo {
    name: string;
    properties: PropertyInfo[];
    methods: FunctionInfo[];
    extends?: string[];
    description: string;
    line: number;
    isExported: boolean;
}

interface PropertyInfo {
    name: string;
    type: string;
    description: string;
    line: number;
    isOptional: boolean;
    isReadonly: boolean;
    visibility?: 'public' | 'private' | 'protected';
}

interface ExportInfo {
    name: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'type';
    isDefault: boolean;
    line: number;
}

interface ImportInfo {
    from: string;
    imports: string[];
    isDefault: boolean;
    line: number;
}

interface DocGenerationOptions {
    includePrivate: boolean;
    includeTests: boolean;
    outputFormat: 'markdown' | 'html' | 'json';
    includeExamples: boolean;
    includeTypeDefinitions: boolean;
    generateIndex: boolean;
    includeSourceLinks: boolean;
    outputDirectory: string;
}

export class DocumentationTool implements ToolExecutor {
    static metadata = {
        name: 'DocumentationTool',
        description: 'Auto-generate comprehensive documentation from code comments and structure',
        parameters: {
            action: 'generate-docs | analyze-structure | create-readme | extract-api',
            path: 'Target file or directory path',
            options: 'Documentation generation options (JSON)',
            format: 'Output format: markdown | html | json',
            includePrivate: 'Include private members (boolean)',
            includeTests: 'Include test files (boolean)',
            outputDir: 'Output directory for generated docs'
        }
    };

    async execute(params: Record<string, any>): Promise<ToolResult> {
        const { action, path: targetPath, options, format, includePrivate, includeTests, outputDir } = params;

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, message: 'No workspace folder found' };
            }

            const resolvedPath = targetPath ? 
                path.resolve(workspaceFolder.uri.fsPath, targetPath) : 
                workspaceFolder.uri.fsPath;

            const docOptions: DocGenerationOptions = {
                includePrivate: includePrivate || false,
                includeTests: includeTests || false,
                outputFormat: format || 'markdown',
                includeExamples: true,
                includeTypeDefinitions: true,
                generateIndex: true,
                includeSourceLinks: true,
                outputDirectory: outputDir || path.join(workspaceFolder.uri.fsPath, 'docs'),
                ...options
            };

            switch (action) {
                case 'generate-docs':
                    return await this.generateDocumentation(resolvedPath, docOptions);
                case 'analyze-structure':
                    return await this.analyzeCodeStructure(resolvedPath, docOptions);
                case 'create-readme':
                    return await this.generateReadme(resolvedPath, docOptions);
                case 'extract-api':
                    return await this.extractApiDocumentation(resolvedPath, docOptions);
                default:
                    return await this.generateDocumentation(resolvedPath, docOptions);
            }
        } catch (error) {
            return { 
                success: false, 
                message: `Documentation generation failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateDocumentation(targetPath: string, options: DocGenerationOptions): Promise<ToolResult> {
        const stats = await fs.promises.stat(targetPath);
        const structure = await this.analyzeStructure(targetPath, options);
        
        // Ensure output directory exists
        await fs.promises.mkdir(options.outputDirectory, { recursive: true });

        const results: string[] = [];

        if (stats.isDirectory()) {
            // Generate documentation for entire project
            await this.generateProjectDocs(structure, options);
            results.push('Generated complete project documentation');
            
            if (options.generateIndex) {
                await this.generateIndexFile(structure, options);
                results.push('Generated documentation index');
            }
        } else {
            // Generate documentation for single file
            const fileDoc = await this.generateFileDocumentation(structure, options);
            const outputFile = path.join(options.outputDirectory, 
                path.basename(targetPath, path.extname(targetPath)) + '.md');
            await fs.promises.writeFile(outputFile, fileDoc);
            results.push(`Generated documentation: ${outputFile}`);
        }

        return {
            success: true,
            message: `Documentation generated successfully:\n• ${results.join('\n• ')}`
        };
    }

    private async analyzeCodeStructure(targetPath: string, options: DocGenerationOptions): Promise<ToolResult> {
        const structure = await this.analyzeStructure(targetPath, options);
        
        const analysis = {
            totalFiles: this.countFiles(structure),
            totalFunctions: this.countFunctions(structure),
            totalClasses: this.countClasses(structure),
            totalInterfaces: this.countInterfaces(structure),
            fileTypes: this.getFileTypes(structure),
            structure: structure
        };

        return {
            success: true,
            message: `Code structure analysis complete:
• Total files: ${analysis.totalFiles}
• Total functions: ${analysis.totalFunctions}
• Total classes: ${analysis.totalClasses}
• Total interfaces: ${analysis.totalInterfaces}
• File types: ${Object.keys(analysis.fileTypes).join(', ')}`,
            data: analysis
        };
    }

    private async generateReadme(targetPath: string, options: DocGenerationOptions): Promise<ToolResult> {
        const structure = await this.analyzeStructure(targetPath, options);
        const packageJsonPath = path.join(targetPath, 'package.json');
        
        let projectInfo: any = {};
        try {
            const packageJson = await fs.promises.readFile(packageJsonPath, 'utf8');
            projectInfo = JSON.parse(packageJson);
        } catch {
            // No package.json found, use defaults
        }

        const readme = await this.generateReadmeContent(structure, projectInfo, options);
        const readmePath = path.join(targetPath, 'README.md');
        
        await fs.promises.writeFile(readmePath, readme);

        return {
            success: true,
            message: `Generated README.md with project overview, installation instructions, and API documentation`
        };
    }

    private async extractApiDocumentation(targetPath: string, options: DocGenerationOptions): Promise<ToolResult> {
        const structure = await this.analyzeStructure(targetPath, options);
        const apiDocs = await this.generateApiDocumentation(structure, options);
        
        const outputFile = path.join(options.outputDirectory, 'API.md');
        await fs.promises.writeFile(outputFile, apiDocs);

        return {
            success: true,
            message: `Generated API documentation: ${outputFile}`,
            data: { apiFile: outputFile }
        };
    }

    private async analyzeStructure(targetPath: string, options: DocGenerationOptions): Promise<FileStructure> {
        const stats = await fs.promises.stat(targetPath);
        const name = path.basename(targetPath);

        if (stats.isFile()) {
            return await this.analyzeFile(targetPath, name);
        } else {
            return await this.analyzeDirectory(targetPath, name, options);
        }
    }

    private async analyzeFile(filePath: string, name: string): Promise<FileStructure> {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const ext = path.extname(filePath);
        
        const structure: FileStructure = {
            name,
            type: 'file',
            path: filePath,
            functions: [],
            classes: [],
            interfaces: [],
            exports: [],
            imports: []
        };

        // Parse based on file type
        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            await this.parseTypeScriptFile(content, structure);
        } else if (['.py'].includes(ext)) {
            await this.parsePythonFile(content, structure);
        } else if (['.java'].includes(ext)) {
            await this.parseJavaFile(content, structure);
        }

        return structure;
    }

    private async analyzeDirectory(dirPath: string, name: string, options: DocGenerationOptions): Promise<FileStructure> {
        const structure: FileStructure = {
            name,
            type: 'directory',
            path: dirPath,
            children: []
        };

        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            
            // Skip common ignore patterns
            if (this.shouldIgnoreFile(entry.name, options)) {
                continue;
            }

            if (entry.isDirectory()) {
                const childStructure = await this.analyzeDirectory(entryPath, entry.name, options);
                structure.children!.push(childStructure);
            } else {
                const fileStructure = await this.analyzeFile(entryPath, entry.name);
                structure.children!.push(fileStructure);
            }
        }

        return structure;
    }

    private shouldIgnoreFile(name: string, options: DocGenerationOptions): boolean {
        const ignorePatterns = [
            'node_modules', '.git', '.vscode', 'dist', 'build', 'coverage',
            '.DS_Store', 'Thumbs.db', '*.log'
        ];

        if (!options.includeTests) {
            ignorePatterns.push('test', 'tests', '__tests__', '*.test.*', '*.spec.*');
        }

        return ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(name);
            }
            return name === pattern || name.includes(pattern);
        });
    }

    private async parseTypeScriptFile(content: string, structure: FileStructure): Promise<void> {
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse imports
            if (line.startsWith('import')) {
                const importInfo = this.parseImport(line, i + 1);
                if (importInfo) {
                    structure.imports!.push(importInfo);
                }
            }

            // Parse exports
            if (line.startsWith('export')) {
                const exportInfo = this.parseExport(line, i + 1);
                if (exportInfo) {
                    structure.exports!.push(exportInfo);
                }
            }

            // Parse functions
            if (this.isFunctionDeclaration(line)) {
                const funcInfo = this.parseFunction(lines, i);
                if (funcInfo) {
                    structure.functions!.push(funcInfo);
                }
            }

            // Parse classes
            if (line.includes('class ')) {
                const classInfo = this.parseClass(lines, i);
                if (classInfo) {
                    structure.classes!.push(classInfo);
                }
            }

            // Parse interfaces
            if (line.includes('interface ')) {
                const interfaceInfo = this.parseInterface(lines, i);
                if (interfaceInfo) {
                    structure.interfaces!.push(interfaceInfo);
                }
            }
        }
    }

    private async parsePythonFile(content: string, structure: FileStructure): Promise<void> {
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse imports
            if (line.startsWith('import ') || line.startsWith('from ')) {
                const importInfo = this.parsePythonImport(line, i + 1);
                if (importInfo) {
                    structure.imports!.push(importInfo);
                }
            }

            // Parse functions
            if (line.startsWith('def ')) {
                const funcInfo = this.parsePythonFunction(lines, i);
                if (funcInfo) {
                    structure.functions!.push(funcInfo);
                }
            }

            // Parse classes
            if (line.startsWith('class ')) {
                const classInfo = this.parsePythonClass(lines, i);
                if (classInfo) {
                    structure.classes!.push(classInfo);
                }
            }
        }
    }

    private async parseJavaFile(content: string, structure: FileStructure): Promise<void> {
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse imports
            if (line.startsWith('import ')) {
                const importInfo = this.parseJavaImport(line, i + 1);
                if (importInfo) {
                    structure.imports!.push(importInfo);
                }
            }

            // Parse classes
            if (line.includes('class ') || line.includes('interface ')) {
                const classInfo = this.parseJavaClass(lines, i);
                if (classInfo) {
                    if (line.includes('interface ')) {
                        structure.interfaces!.push(classInfo as InterfaceInfo);
                    } else {
                        structure.classes!.push(classInfo);
                    }
                }
            }
        }
    }

    private parseImport(line: string, lineNum: number): ImportInfo | null {
        const match = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
        if (!match) return null;

        const namedImports = match[1];
        const defaultImport = match[2];
        const from = match[3];

        return {
            from,
            imports: namedImports ? namedImports.split(',').map(s => s.trim()) : [defaultImport],
            isDefault: !!defaultImport,
            line: lineNum
        };
    }

    private parsePythonImport(line: string, lineNum: number): ImportInfo | null {
        let match = line.match(/from\s+(\S+)\s+import\s+(.+)/);
        if (match) {
            return {
                from: match[1],
                imports: match[2].split(',').map(s => s.trim()),
                isDefault: false,
                line: lineNum
            };
        }

        match = line.match(/import\s+(.+)/);
        if (match) {
            return {
                from: match[1],
                imports: [match[1]],
                isDefault: true,
                line: lineNum
            };
        }

        return null;
    }

    private parseJavaImport(line: string, lineNum: number): ImportInfo | null {
        const match = line.match(/import\s+(?:static\s+)?([^;]+);/);
        if (!match) return null;

        const importPath = match[1];
        const parts = importPath.split('.');
        const name = parts[parts.length - 1];

        return {
            from: importPath,
            imports: [name],
            isDefault: true,
            line: lineNum
        };
    }

    private parseExport(line: string, lineNum: number): ExportInfo | null {
        let match = line.match(/export\s+(?:default\s+)?(?:(function|class|interface|const|let|var)\s+)?(\w+)/);
        if (!match) return null;

        const type = match[1] || 'variable';
        const name = match[2];
        const isDefault = line.includes('default');

        return {
            name,
            type: type as any,
            isDefault,
            line: lineNum
        };
    }

    private isFunctionDeclaration(line: string): boolean {
        return /^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
               /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/.test(line) ||
               /^\w+\s*:\s*(async\s+)?\(/.test(line);
    }

    private parseFunction(lines: string[], startIndex: number): FunctionInfo | null {
        const line = lines[startIndex].trim();
        
        // Extract function name and basic info
        let match = line.match(/(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
        if (!match) {
            match = line.match(/(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)/);
        }
        
        if (!match) return null;

        const isExported = !!match[1];
        const isAsync = !!match[2] || !!match[3];
        const name = match[3] || match[2];
        const params = match[4] || match[4];

        // Extract description from preceding comments
        let description = '';
        for (let i = startIndex - 1; i >= 0; i--) {
            const prevLine = lines[i].trim();
            if (prevLine.startsWith('//') || prevLine.startsWith('*') || prevLine.startsWith('/**')) {
                description = prevLine.replace(/^\/\*\*?|\*\/|\/\/|\*/g, '').trim() + '\n' + description;
            } else if (prevLine === '') {
                continue;
            } else {
                break;
            }
        }

        return {
            name,
            parameters: params.split(',').map(p => p.trim()).filter(p => p),
            returnType: 'unknown', // TODO: Extract from TypeScript types
            description: description.trim(),
            line: startIndex + 1,
            isAsync,
            isExported
        };
    }

    private parsePythonFunction(lines: string[], startIndex: number): FunctionInfo | null {
        const line = lines[startIndex].trim();
        const match = line.match(/def\s+(\w+)\s*\(([^)]*)\)/);
        if (!match) return null;

        const name = match[1];
        const params = match[2];

        // Extract docstring
        let description = '';
        if (startIndex + 1 < lines.length) {
            const nextLine = lines[startIndex + 1].trim();
            if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
                let i = startIndex + 1;
                while (i < lines.length) {
                    const docLine = lines[i].trim();
                    description += docLine.replace(/"""|'''/g, '') + '\n';
                    if (docLine.endsWith('"""') || docLine.endsWith("'''")) {
                        break;
                    }
                    i++;
                }
            }
        }

        return {
            name,
            parameters: params.split(',').map(p => p.trim()).filter(p => p),
            returnType: 'unknown',
            description: description.trim(),
            line: startIndex + 1,
            isAsync: line.includes('async def'),
            isExported: !name.startsWith('_')
        };
    }

    private parseClass(lines: string[], startIndex: number): ClassInfo | null {
        const line = lines[startIndex].trim();
        const match = line.match(/(export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/);
        if (!match) return null;

        const isExported = !!match[1];
        const name = match[2];
        const extendsClass = match[3];
        const implementsInterfaces = match[4]?.split(',').map(s => s.trim());

        // Extract description from preceding comments
        let description = '';
        for (let i = startIndex - 1; i >= 0; i--) {
            const prevLine = lines[i].trim();
            if (prevLine.startsWith('//') || prevLine.startsWith('*') || prevLine.startsWith('/**')) {
                description = prevLine.replace(/^\/\*\*?|\*\/|\/\/|\*/g, '').trim() + '\n' + description;
            } else if (prevLine === '') {
                continue;
            } else {
                break;
            }
        }

        // Parse class members
        const methods: FunctionInfo[] = [];
        const properties: PropertyInfo[] = [];
        
        let braceCount = 0;
        let inClass = false;
        
        for (let i = startIndex; i < lines.length; i++) {
            const currentLine = lines[i];
            
            if (currentLine.includes('{')) {
                braceCount += (currentLine.match(/\{/g) || []).length;
                inClass = true;
            }
            if (currentLine.includes('}')) {
                braceCount -= (currentLine.match(/\}/g) || []).length;
                if (braceCount === 0 && inClass) break;
            }
            
            if (inClass && braceCount > 0) {
                // Parse methods
                if (this.isFunctionDeclaration(currentLine.trim())) {
                    const method = this.parseFunction(lines, i);
                    if (method) {
                        methods.push(method);
                    }
                }
                
                // Parse properties
                const propMatch = currentLine.match(/^\s*(private|protected|public)?\s*(readonly)?\s*(\w+)\s*:\s*([^;=]+)/);
                if (propMatch) {
                    properties.push({
                        name: propMatch[3],
                        type: propMatch[4].trim(),
                        description: '',
                        line: i + 1,
                        isOptional: false,
                        isReadonly: !!propMatch[2],
                        visibility: propMatch[1] as any || 'public'
                    });
                }
            }
        }

        return {
            name,
            methods,
            properties,
            extends: extendsClass,
            implements: implementsInterfaces,
            description: description.trim(),
            line: startIndex + 1,
            isExported
        };
    }

    private parsePythonClass(lines: string[], startIndex: number): ClassInfo | null {
        const line = lines[startIndex].trim();
        const match = line.match(/class\s+(\w+)(?:\(([^)]+)\))?:/);
        if (!match) return null;

        const name = match[1];
        const parentClasses = match[2]?.split(',').map(s => s.trim());

        // Extract docstring
        let description = '';
        if (startIndex + 1 < lines.length) {
            const nextLine = lines[startIndex + 1].trim();
            if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
                let i = startIndex + 1;
                while (i < lines.length) {
                    const docLine = lines[i].trim();
                    description += docLine.replace(/"""|'''/g, '') + '\n';
                    if (docLine.endsWith('"""') || docLine.endsWith("'''")) {
                        break;
                    }
                    i++;
                }
            }
        }

        const methods: FunctionInfo[] = [];
        const properties: PropertyInfo[] = [];

        // Parse class members (simplified)
        for (let i = startIndex + 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (currentLine.trim() === '' || currentLine.startsWith('    ')) {
                // Inside class
                if (currentLine.trim().startsWith('def ')) {
                    const method = this.parsePythonFunction(lines, i);
                    if (method) {
                        methods.push(method);
                    }
                }
            } else if (currentLine.trim() && !currentLine.startsWith(' ')) {
                // End of class
                break;
            }
        }

        return {
            name,
            methods,
            properties,
            extends: parentClasses?.[0],
            implements: parentClasses?.slice(1),
            description: description.trim(),
            line: startIndex + 1,
            isExported: !name.startsWith('_')
        };
    }

    private parseJavaClass(lines: string[], startIndex: number): ClassInfo | null {
        const line = lines[startIndex].trim();
        const match = line.match(/(public|private|protected)?\s*(class|interface)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/);
        if (!match) return null;

        const visibility = match[1] || 'public';
        const type = match[2];
        const name = match[3];
        const extendsClass = match[4];
        const implementsInterfaces = match[5]?.split(',').map(s => s.trim());

        // Extract Javadoc
        let description = '';
        for (let i = startIndex - 1; i >= 0; i--) {
            const prevLine = lines[i].trim();
            if (prevLine.startsWith('/**') || prevLine.startsWith('*') || prevLine.endsWith('*/')) {
                description = prevLine.replace(/^\/\*\*?|\*\/|\*/g, '').trim() + '\n' + description;
            } else if (prevLine === '') {
                continue;
            } else {
                break;
            }
        }

        return {
            name,
            methods: [], // TODO: Parse Java methods
            properties: [], // TODO: Parse Java fields
            extends: extendsClass,
            implements: implementsInterfaces,
            description: description.trim(),
            line: startIndex + 1,
            isExported: visibility === 'public'
        };
    }

    private parseInterface(lines: string[], startIndex: number): InterfaceInfo | null {
        const line = lines[startIndex].trim();
        const match = line.match(/(export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?/);
        if (!match) return null;

        const isExported = !!match[1];
        const name = match[2];
        const extendsInterfaces = match[3]?.split(',').map(s => s.trim());

        // Extract description from preceding comments
        let description = '';
        for (let i = startIndex - 1; i >= 0; i--) {
            const prevLine = lines[i].trim();
            if (prevLine.startsWith('//') || prevLine.startsWith('*') || prevLine.startsWith('/**')) {
                description = prevLine.replace(/^\/\*\*?|\*\/|\/\/|\*/g, '').trim() + '\n' + description;
            } else if (prevLine === '') {
                continue;
            } else {
                break;
            }
        }

        const properties: PropertyInfo[] = [];
        const methods: FunctionInfo[] = [];

        // Parse interface members
        let braceCount = 0;
        let inInterface = false;
        
        for (let i = startIndex; i < lines.length; i++) {
            const currentLine = lines[i];
            
            if (currentLine.includes('{')) {
                braceCount += (currentLine.match(/\{/g) || []).length;
                inInterface = true;
            }
            if (currentLine.includes('}')) {
                braceCount -= (currentLine.match(/\}/g) || []).length;
                if (braceCount === 0 && inInterface) break;
            }
            
            if (inInterface && braceCount > 0) {
                const trimmed = currentLine.trim();
                
                // Parse property
                const propMatch = trimmed.match(/(\w+)(\?)?\s*:\s*([^;,}]+)/);
                if (propMatch && !trimmed.includes('(')) {
                    properties.push({
                        name: propMatch[1],
                        type: propMatch[3].trim(),
                        description: '',
                        line: i + 1,
                        isOptional: !!propMatch[2],
                        isReadonly: trimmed.includes('readonly')
                    });
                }
                
                // Parse method signature
                const methodMatch = trimmed.match(/(\w+)\s*\([^)]*\)\s*:\s*([^;,}]+)/);
                if (methodMatch) {
                    methods.push({
                        name: methodMatch[1],
                        parameters: [], // TODO: Extract parameters
                        returnType: methodMatch[2].trim(),
                        description: '',
                        line: i + 1,
                        isAsync: false,
                        isExported: true
                    });
                }
            }
        }

        return {
            name,
            properties,
            methods,
            extends: extendsInterfaces,
            description: description.trim(),
            line: startIndex + 1,
            isExported
        };
    }

    private async generateProjectDocs(structure: FileStructure, options: DocGenerationOptions): Promise<void> {
        if (structure.type === 'directory' && structure.children) {
            for (const child of structure.children) {
                if (child.type === 'file') {
                    const fileDoc = await this.generateFileDocumentation(child, options);
                    const fileName = path.basename(child.name, path.extname(child.name));
                    const outputFile = path.join(options.outputDirectory, fileName + '.md');
                    await fs.promises.writeFile(outputFile, fileDoc);
                } else {
                    await this.generateProjectDocs(child, options);
                }
            }
        }
    }

    private async generateFileDocumentation(structure: FileStructure, options: DocGenerationOptions): Promise<string> {
        let doc = `# ${structure.name}\n\n`;
        
        if (structure.path) {
            doc += `**File:** \`${structure.path}\`\n\n`;
        }

        // Add imports section
        if (structure.imports && structure.imports.length > 0) {
            doc += `## Imports\n\n`;
            for (const imp of structure.imports) {
                doc += `- \`${imp.imports.join(', ')}\` from \`${imp.from}\`\n`;
            }
            doc += '\n';
        }

        // Add exports section
        if (structure.exports && structure.exports.length > 0) {
            doc += `## Exports\n\n`;
            for (const exp of structure.exports) {
                doc += `- **${exp.name}** (${exp.type})${exp.isDefault ? ' - Default export' : ''}\n`;
            }
            doc += '\n';
        }

        // Add interfaces section
        if (structure.interfaces && structure.interfaces.length > 0) {
            doc += `## Interfaces\n\n`;
            for (const iface of structure.interfaces) {
                if (!options.includePrivate && !iface.isExported) continue;
                
                doc += `### ${iface.name}\n\n`;
                if (iface.description) {
                    doc += `${iface.description}\n\n`;
                }
                
                if (iface.extends && iface.extends.length > 0) {
                    doc += `**Extends:** ${iface.extends.join(', ')}\n\n`;
                }

                if (iface.properties.length > 0) {
                    doc += `**Properties:**\n\n`;
                    for (const prop of iface.properties) {
                        doc += `- \`${prop.name}${prop.isOptional ? '?' : ''}: ${prop.type}\`${prop.isReadonly ? ' (readonly)' : ''}\n`;
                    }
                    doc += '\n';
                }

                if (iface.methods.length > 0) {
                    doc += `**Methods:**\n\n`;
                    for (const method of iface.methods) {
                        doc += `- \`${method.name}(${method.parameters.join(', ')}): ${method.returnType}\`\n`;
                    }
                    doc += '\n';
                }
            }
        }

        // Add classes section
        if (structure.classes && structure.classes.length > 0) {
            doc += `## Classes\n\n`;
            for (const cls of structure.classes) {
                if (!options.includePrivate && !cls.isExported) continue;
                
                doc += `### ${cls.name}\n\n`;
                if (cls.description) {
                    doc += `${cls.description}\n\n`;
                }
                
                if (cls.extends) {
                    doc += `**Extends:** ${cls.extends}\n\n`;
                }
                
                if (cls.implements && cls.implements.length > 0) {
                    doc += `**Implements:** ${cls.implements.join(', ')}\n\n`;
                }

                if (cls.properties.length > 0) {
                    doc += `**Properties:**\n\n`;
                    for (const prop of cls.properties) {
                        if (!options.includePrivate && prop.visibility === 'private') continue;
                        doc += `- \`${prop.visibility || 'public'} ${prop.name}: ${prop.type}\`${prop.isReadonly ? ' (readonly)' : ''}\n`;
                    }
                    doc += '\n';
                }

                if (cls.methods.length > 0) {
                    doc += `**Methods:**\n\n`;
                    for (const method of cls.methods) {
                        doc += `- \`${method.name}(${method.parameters.join(', ')}): ${method.returnType}\`${method.isAsync ? ' (async)' : ''}\n`;
                        if (method.description) {
                            doc += `  - ${method.description}\n`;
                        }
                    }
                    doc += '\n';
                }
            }
        }

        // Add functions section
        if (structure.functions && structure.functions.length > 0) {
            doc += `## Functions\n\n`;
            for (const func of structure.functions) {
                if (!options.includePrivate && !func.isExported) continue;
                
                doc += `### ${func.name}\n\n`;
                if (func.description) {
                    doc += `${func.description}\n\n`;
                }
                
                doc += `\`\`\`typescript\n`;
                doc += `${func.isAsync ? 'async ' : ''}function ${func.name}(${func.parameters.join(', ')}): ${func.returnType}\n`;
                doc += `\`\`\`\n\n`;
                
                if (options.includeSourceLinks) {
                    doc += `[View source](${structure.path}#L${func.line})\n\n`;
                }
            }
        }

        return doc;
    }

    private async generateIndexFile(structure: FileStructure, options: DocGenerationOptions): Promise<void> {
        let index = `# Documentation Index\n\n`;
        index += `Generated on ${new Date().toISOString()}\n\n`;
        
        index += `## Project Structure\n\n`;
        index += this.generateStructureTree(structure, 0);
        
        index += `\n## Statistics\n\n`;
        index += `- Total files: ${this.countFiles(structure)}\n`;
        index += `- Total functions: ${this.countFunctions(structure)}\n`;
        index += `- Total classes: ${this.countClasses(structure)}\n`;
        index += `- Total interfaces: ${this.countInterfaces(structure)}\n`;
        
        const indexPath = path.join(options.outputDirectory, 'README.md');
        await fs.promises.writeFile(indexPath, index);
    }

    private generateStructureTree(structure: FileStructure, depth: number): string {
        const indent = '  '.repeat(depth);
        let tree = `${indent}- ${structure.name}\n`;
        
        if (structure.children) {
            for (const child of structure.children) {
                tree += this.generateStructureTree(child, depth + 1);
            }
        }
        
        return tree;
    }

    private async generateReadmeContent(structure: FileStructure, projectInfo: any, options: DocGenerationOptions): Promise<string> {
        let readme = `# ${projectInfo.name || 'Project'}\n\n`;
        
        if (projectInfo.description) {
            readme += `${projectInfo.description}\n\n`;
        }
        
        readme += `## Installation\n\n`;
        if (projectInfo.scripts && projectInfo.scripts.install) {
            readme += `\`\`\`bash\n${projectInfo.scripts.install}\n\`\`\`\n\n`;
        } else {
            readme += `\`\`\`bash\nnpm install\n\`\`\`\n\n`;
        }
        
        readme += `## Usage\n\n`;
        if (projectInfo.scripts && projectInfo.scripts.start) {
            readme += `\`\`\`bash\n${projectInfo.scripts.start}\n\`\`\`\n\n`;
        }
        
        readme += `## API Documentation\n\n`;
        readme += `This project contains:\n\n`;
        readme += `- ${this.countFunctions(structure)} functions\n`;
        readme += `- ${this.countClasses(structure)} classes\n`;
        readme += `- ${this.countInterfaces(structure)} interfaces\n\n`;
        
        readme += `For detailed API documentation, see the [docs](docs/) directory.\n\n`;
        
        if (projectInfo.scripts) {
            readme += `## Scripts\n\n`;
            for (const [name, script] of Object.entries(projectInfo.scripts)) {
                readme += `- \`npm run ${name}\`: ${script}\n`;
            }
            readme += '\n';
        }
        
        if (projectInfo.license) {
            readme += `## License\n\n${projectInfo.license}\n\n`;
        }
        
        return readme;
    }

    private async generateApiDocumentation(structure: FileStructure, options: DocGenerationOptions): Promise<string> {
        let api = `# API Documentation\n\n`;
        
        const allFunctions = this.getAllFunctions(structure);
        const allClasses = this.getAllClasses(structure);
        const allInterfaces = this.getAllInterfaces(structure);
        
        if (allFunctions.length > 0) {
            api += `## Functions\n\n`;
            for (const func of allFunctions) {
                if (!options.includePrivate && !func.isExported) continue;
                api += `### ${func.name}\n\n`;
                if (func.description) {
                    api += `${func.description}\n\n`;
                }
                api += `**Parameters:** ${func.parameters.join(', ')}\n\n`;
                api += `**Returns:** ${func.returnType}\n\n`;
                if (func.isAsync) {
                    api += `**Note:** This function is asynchronous.\n\n`;
                }
            }
        }
        
        if (allClasses.length > 0) {
            api += `## Classes\n\n`;
            for (const cls of allClasses) {
                if (!options.includePrivate && !cls.isExported) continue;
                api += `### ${cls.name}\n\n`;
                if (cls.description) {
                    api += `${cls.description}\n\n`;
                }
                
                // Add constructor info, methods, etc.
                if (cls.methods.length > 0) {
                    api += `**Methods:**\n\n`;
                    for (const method of cls.methods) {
                        api += `- \`${method.name}(${method.parameters.join(', ')})\`\n`;
                    }
                    api += '\n';
                }
            }
        }
        
        if (allInterfaces.length > 0) {
            api += `## Interfaces\n\n`;
            for (const iface of allInterfaces) {
                if (!options.includePrivate && !iface.isExported) continue;
                api += `### ${iface.name}\n\n`;
                if (iface.description) {
                    api += `${iface.description}\n\n`;
                }
                
                if (iface.properties.length > 0) {
                    api += `**Properties:**\n\n`;
                    for (const prop of iface.properties) {
                        api += `- \`${prop.name}: ${prop.type}\`\n`;
                    }
                    api += '\n';
                }
            }
        }
        
        return api;
    }

    private countFiles(structure: FileStructure): number {
        let count = structure.type === 'file' ? 1 : 0;
        if (structure.children) {
            for (const child of structure.children) {
                count += this.countFiles(child);
            }
        }
        return count;
    }

    private countFunctions(structure: FileStructure): number {
        let count = structure.functions?.length || 0;
        if (structure.children) {
            for (const child of structure.children) {
                count += this.countFunctions(child);
            }
        }
        return count;
    }

    private countClasses(structure: FileStructure): number {
        let count = structure.classes?.length || 0;
        if (structure.children) {
            for (const child of structure.children) {
                count += this.countClasses(child);
            }
        }
        return count;
    }

    private countInterfaces(structure: FileStructure): number {
        let count = structure.interfaces?.length || 0;
        if (structure.children) {
            for (const child of structure.children) {
                count += this.countInterfaces(child);
            }
        }
        return count;
    }

    private getFileTypes(structure: FileStructure): Record<string, number> {
        const types: Record<string, number> = {};
        
        if (structure.type === 'file') {
            const ext = path.extname(structure.name);
            types[ext] = (types[ext] || 0) + 1;
        }
        
        if (structure.children) {
            for (const child of structure.children) {
                const childTypes = this.getFileTypes(child);
                for (const [ext, count] of Object.entries(childTypes)) {
                    types[ext] = (types[ext] || 0) + count;
                }
            }
        }
        
        return types;
    }

    private getAllFunctions(structure: FileStructure): FunctionInfo[] {
        let functions = structure.functions || [];
        if (structure.children) {
            for (const child of structure.children) {
                functions = functions.concat(this.getAllFunctions(child));
            }
        }
        return functions;
    }

    private getAllClasses(structure: FileStructure): ClassInfo[] {
        let classes = structure.classes || [];
        if (structure.children) {
            for (const child of structure.children) {
                classes = classes.concat(this.getAllClasses(child));
            }
        }
        return classes;
    }

    private getAllInterfaces(structure: FileStructure): InterfaceInfo[] {
        let interfaces = structure.interfaces || [];
        if (structure.children) {
            for (const child of structure.children) {
                interfaces = interfaces.concat(this.getAllInterfaces(child));
            }
        }
        return interfaces;
    }
}

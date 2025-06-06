import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class SecurityTool implements ToolExecutor {
    readonly name = 'security';
    readonly description = 'Security analysis, vulnerability scanning, and secure coding practices';
    
    readonly metadata = {
        name: 'security',
        description: 'Security analysis, vulnerability scanning, and secure coding practices',
        category: 'Security',
        parameters: [
            {
                name: 'action',
                description: 'Security action to perform',
                required: true,
                type: 'string'
            }
        ],
        examples: [
            'Scan for vulnerabilities',
            'Audit code security',
            'Check dependencies'
        ]
    };

    readonly methods = {
        'scanVulnerabilities': {
            description: 'Scan code for common security vulnerabilities',
            parameters: {
                filePath: { type: 'string', description: 'Path to file or directory to scan' },
                scanType: { type: 'string', description: 'Type of scan (full, secrets, dependencies, code)', optional: true }
            }
        },
        'findSecrets': {
            description: 'Find exposed secrets, API keys, and credentials in code',
            parameters: {
                directory: { type: 'string', description: 'Directory to scan for secrets', optional: true },
                includeTests: { type: 'boolean', description: 'Include test files in scan', optional: true }
            }
        },
        'auditDependencies': {
            description: 'Audit project dependencies for known vulnerabilities',
            parameters: {
                packageFile: { type: 'string', description: 'Path to package.json, requirements.txt, etc.', optional: true }
            }
        },
        'generateSecurityHeaders': {
            description: 'Generate security headers configuration for web applications',
            parameters: {
                framework: { type: 'string', description: 'Web framework (express, fastify, spring, django)', optional: true }
            }
        },
        'validateInputSanitization': {
            description: 'Check for proper input validation and sanitization',
            parameters: {
                filePath: { type: 'string', description: 'Path to file containing input handling code' }
            }
        },
        'checkAuthentication': {
            description: 'Analyze authentication and authorization implementation',
            parameters: {
                filePath: { type: 'string', description: 'Path to authentication-related files' }
            }
        },
        'generateCSP': {
            description: 'Generate Content Security Policy configuration',
            parameters: {
                appType: { type: 'string', description: 'Application type (spa, ssr, static)', optional: true },
                strictness: { type: 'string', description: 'Policy strictness (strict, moderate, lenient)', optional: true }
            }
        },
        'encryptionAnalysis': {
            description: 'Analyze encryption implementation and suggest improvements',
            parameters: {
                filePath: { type: 'string', description: 'Path to file containing encryption code' }
            }
        },
        'generateSecurityChecklist': {
            description: 'Generate security checklist for the project',
            parameters: {
                projectType: { type: 'string', description: 'Project type (web, api, mobile, desktop)', optional: true }
            }
        },
        'sqlInjectionScan': {
            description: 'Scan for potential SQL injection vulnerabilities',
            parameters: {
                filePath: { type: 'string', description: 'Path to file containing database queries' }
            }
        },
        'xssAnalysis': {
            description: 'Analyze code for Cross-Site Scripting (XSS) vulnerabilities',
            parameters: {
                filePath: { type: 'string', description: 'Path to file containing user input handling' }
            }
        },
        'csrfProtection': {
            description: 'Check and suggest CSRF protection mechanisms',
            parameters: {
                filePath: { type: 'string', description: 'Path to web application routes/controllers' }
            }
        }
    };

    private readonly secretPatterns = [
        { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
        { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g },
        { name: 'GitHub Token', pattern: /gh[pousr as keyof typeof gh]_[A-Za-z0-9_]{36,251}/g },
        { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{48}/g },
        { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-]{95}/g },
        { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g },
        { name: 'Generic API Key', pattern: /[aA][pP][iI]_?[kK][eE][yY].*?['\"][0-9a-zA-Z]{32,45}['\"]|[aA][pP][iI]_?[kK][eE][yY].*?[=][0-9a-zA-Z]{32,45}/g },
        { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g },
        { name: 'Password in Code', pattern: /password\s*[:=]\s*['\"][^'\"]{8,}['\"]/gi },
        { name: 'Database Connection String', pattern: /(mongodb|mysql|postgresql):\/\/[^\s'"]+/gi }
    ];

    private readonly vulnerabilityPatterns = [
        { name: 'SQL Injection', pattern: /(?:query|execute)\s*\(\s*['\"].*?\+.*?['\"]|(?:query|execute)\s*\(\s*.*?\$\{.*?\}/gi, severity: 'high' },
        { name: 'Command Injection', pattern: /exec\s*\(\s*.*?\+.*?\)|spawn\s*\(\s*.*?\+.*?\)|system\s*\(\s*.*?\+.*?\)/gi, severity: 'high' },
        { name: 'Path Traversal', pattern: /\.\.\/|\.\.\\|\$\{.*?\}\/|\$\{.*?\}\\/gi, severity: 'medium' },
        { name: 'XSS Vulnerable', pattern: /innerHTML\s*=|document\.write\s*\(|eval\s*\(/gi, severity: 'high' },
        { name: 'Hardcoded Secret', pattern: /(?:password|secret|key|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]/gi, severity: 'high' },
        { name: 'Weak Random', pattern: /Math\.random\(\)|Random\(\)/gi, severity: 'medium' },
        { name: 'Insecure Protocol', pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/gi, severity: 'medium' },
        { name: 'Debug Code', pattern: /console\.log|print\(|debug|TODO.*password/gi, severity: 'low' }
    ];

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'scanVulnerabilities':
                    return await this.scanVulnerabilities(args.filePath, args.scanType);
                case 'findSecrets':
                    return await this.findSecrets(args.directory, args.includeTests);
                case 'auditDependencies':
                    return await this.auditDependencies(args.packageFile);
                case 'generateSecurityHeaders':
                    return await this.generateSecurityHeaders(args.framework);
                case 'validateInputSanitization':
                    return await this.validateInputSanitization(args.filePath);
                case 'checkAuthentication':
                    return await this.checkAuthentication(args.filePath);
                case 'generateCSP':
                    return await this.generateCSP(args.appType, args.strictness);
                case 'encryptionAnalysis':
                    return await this.encryptionAnalysis(args.filePath);
                case 'generateSecurityChecklist':
                    return await this.generateSecurityChecklist(args.projectType);
                case 'sqlInjectionScan':
                    return await this.sqlInjectionScan(args.filePath);
                case 'xssAnalysis':
                    return await this.xssAnalysis(args.filePath);
                case 'csrfProtection':
                    return await this.csrfProtection(args.filePath);
                default:
                    return {
                        success: false,
                        error: `Unknown method: ${method}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: `Error executing ${method}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async scanVulnerabilities(filePath: string, scanType: string = 'full'): Promise<ToolResult> {
        try {
            const results = {
                filePath,
                scanType,
                vulnerabilities: [] as any[],
                summary: {
                    high: 0,
                    medium: 0,
                    low: 0,
                    total: 0
                }
            };

            const stats = await fs.stat(filePath);
            const files = stats.isDirectory() 
                ? await this.getFilesRecursively(filePath)
                : [filePath];

            for (const file of files) {
                if (this.shouldScanFile(file, scanType)) {
                    const content = await fs.readFile(file, 'utf8');
                    const fileVulns = await this.scanFileForVulnerabilities(file, content, scanType);
                    results.vulnerabilities.push(...fileVulns);
                }
            }

            // Calculate summary
            for (const vuln of results.vulnerabilities) {
                results.summary[vuln.severity as keyof typeof results.summary]++;
                results.summary.total++;
            }

            return {
                success: true,
                result: JSON.stringify(results, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async findSecrets(directory?: string, includeTests: boolean = false): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const searchDir = directory || workspaceFolder.uri.fsPath;
            const secrets: string[] = [];

            const files = await this.getFilesRecursively(searchDir);
            const filteredFiles = files.filter(file => {
                if (!includeTests && this.isTestFile(file)) return false;
                return this.isCodeFile(file);
            });

            for (const file of filteredFiles) {
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const fileSecrets = this.findSecretsInContent(file, content);
                    secrets.push(...fileSecrets);
                } catch (error) {
                    // Skip files that can't be read
                }
            }

            return {
                success: true,
                result: JSON.stringify({
                    secretsFound: secrets.length,
                    secrets: secrets.map(secret => ({
                        ...secret,
                        value: secret.value.substring(0, 10) + '...' // Truncate for security
                    })),
                    recommendations: this.generateSecretsRecommendations(secrets)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async auditDependencies(packageFile?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            let targetFile = packageFile;
            if (!targetFile) {
                // Auto-detect package file
                const commonFiles = ['package.json', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle'];
                for (const file of commonFiles) {
                    const filePath = path.join(workspaceFolder.uri.fsPath, file);
                    try {
                        await fs.access(filePath);
                        targetFile = filePath;
                        break;
                    } catch {
                        // File doesn't exist, continue
                    }
                }
            }

            if (!targetFile) {
                return {
                    success: false,
                    error: 'No package file found. Please specify the path to package.json, requirements.txt, etc.'
                };
            }

            const audit = await this.performDependencyAudit(targetFile);

            return {
                success: true,
                result: JSON.stringify(audit, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateSecurityHeaders(framework: string = 'express'): Promise<ToolResult> {
        try {
            const headers = this.getSecurityHeadersConfig(framework);
            
            const configDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'config');
            try {
                await fs.access(configDir);
            } catch {
                await fs.mkdir(configDir, { recursive: true });
            }

            const configPath = path.join(configDir, `security-headers.${this.getConfigExtension(framework)}`);
            await fs.writeFile(configPath, headers.content);

            return {
                success: true,
                result: `Security headers configuration generated at ${configPath}\n\nInstructions:\n${headers.instructions}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async validateInputSanitization(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const issues = this.analyzeInputValidation(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    inputValidationIssues: issues,
                    recommendations: this.generateInputValidationRecommendations(issues)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async checkAuthentication(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const analysis = this.analyzeAuthentication(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    authenticationAnalysis: analysis,
                    recommendations: this.generateAuthRecommendations(analysis)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateCSP(appType: string = 'spa', strictness: string = 'moderate'): Promise<ToolResult> {
        try {
            const csp = this.createCSPPolicy(appType, strictness);
            
            const configPath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'config',
                'csp.json'
            );

            const configDir = path.dirname(configPath);
            try {
                await fs.access(configDir);
            } catch {
                await fs.mkdir(configDir, { recursive: true });
            }

            await fs.writeFile(configPath, JSON.stringify(csp, null, 2));

            return {
                success: true,
                result: `Content Security Policy generated at ${configPath}\n\nCSP Header:\n${csp.header}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async encryptionAnalysis(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const analysis = this.analyzeEncryption(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    encryptionAnalysis: analysis,
                    recommendations: this.generateEncryptionRecommendations(analysis)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async generateSecurityChecklist(projectType: string = 'web'): Promise<ToolResult> {
        try {
            const checklist = this.createSecurityChecklist(projectType);
            
            const checklistPath = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                'SECURITY_CHECKLIST.md'
            );

            await fs.writeFile(checklistPath, checklist);

            return {
                success: true,
                result: `Security checklist generated at ${checklistPath}`
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async sqlInjectionScan(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const vulnerabilities = this.scanForSQLInjection(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    sqlInjectionVulnerabilities: vulnerabilities,
                    recommendations: this.generateSQLInjectionRecommendations(vulnerabilities)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async xssAnalysis(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const vulnerabilities = this.scanForXSS(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    xssVulnerabilities: vulnerabilities,
                    recommendations: this.generateXSSRecommendations(vulnerabilities)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    private async csrfProtection(filePath: string): Promise<ToolResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const analysis = this.analyzeCSRFProtection(content);

            return {
                success: true,
                result: JSON.stringify({
                    filePath,
                    csrfAnalysis: analysis,
                    recommendations: this.generateCSRFRecommendations(analysis)
                }, null, 2)
            };
        } catch (error) { (error as Error).message : String(error)}`
            };
        }
    }

    // Helper methods
    private async getFilesRecursively(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                const subFiles = await this.getFilesRecursively(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private shouldSkipDirectory(name: string): boolean {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.vscode'];
        return skipDirs.includes(name);
    }

    private shouldScanFile(filePath: string, scanType: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const codeExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go'];
        const configExts = ['.json', '.yaml', '.yml', '.xml', '.env'];

        switch (scanType) {
            case 'code':
                return codeExts.includes(ext);
            case 'secrets':
                return codeExts.includes(ext) || configExts.includes(ext);
            case 'dependencies':
                return ['package.json', 'requirements.txt', 'pom.xml'].includes(path.basename(filePath));
            default:
                return codeExts.includes(ext) || configExts.includes(ext);
        }
    }

    private isTestFile(filePath: string): boolean {
        const fileName = path.basename(filePath).toLowerCase();
        return fileName.includes('test') || fileName.includes('spec') || filePath.includes('/test/') || filePath.includes('\\test\\');
    }

    private isCodeFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const codeExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.json', '.yaml', '.yml', '.env'];
        return codeExts.includes(ext);
    }

    private async scanFileForVulnerabilities(filePath: string, content: string, scanType: string): Promise<any[]> {
        const vulnerabilities: string[] = [];

        for (const pattern of this.vulnerabilityPatterns) {
            if (scanType !== 'full' && scanType !== 'code') continue;

            const matches = content.matchAll(pattern.pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                vulnerabilities.push({
                    file: filePath,
                    line: lineNumber,
                    type: pattern as any.name,
                    severity: pattern as "error" | "warning" | "info".severity,
                    description: match[0 as keyof typeof match],
                    recommendation: this.getVulnerabilityRecommendation(pattern.name)
                });
            }
        }

        // Additional secret scanning
        if (scanType === 'full' || scanType === 'secrets') {
            const secrets = this.findSecretsInContent(filePath, content);
            for (const secret of secrets) {
                vulnerabilities.push({
                    file: filePath,
                    line: secret.line,
                    type: 'Exposed Secret',
                    severity: 'high',
                    description: `${secret.type} found`,
                    recommendation: 'Remove secret from code and use environment variables or secure storage'
                });
            }
        }

        return vulnerabilities;
    }

    private findSecretsInContent(filePath: string, content: string): any[] {
        const secrets: string[] = [];

        for (const pattern of this.secretPatterns) {
            const matches = content.matchAll(pattern.pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                secrets.push({
                    file: filePath,
                    line: lineNumber,
                    type: pattern as any.name,
                    value: match[0 as keyof typeof match],
                    context: this.getLineContext(content, match.index!)
                });
            }
        }

        return secrets;
    }

    private getLineContext(content: string, index: number): string {
        const lines = content.split('\n');
        const lineNumber = content.substring(0, index).split('\n').length - 1;
        const start = Math.max(0, lineNumber - 1);
        const end = Math.min(lines.length, lineNumber + 2);
        return lines.slice(start, end).join('\n');
    }

    private generateSecretsRecommendations(secrets: any[]): string[] {
        const recommendations = [
            'Move all secrets to environment variables',
            'Use a secrets management service (AWS Secrets Manager, Azure Key Vault, etc.)',
            'Add secrets patterns to .gitignore',
            'Implement pre-commit hooks to prevent secret commits',
            'Rotate any exposed credentials immediately'
        ];

        if (secrets.some(s => s.type.includes('API Key'))) {
            recommendations.push('Consider using short-lived tokens instead of long-lived API keys');
        }

        if (secrets.some(s => s.type.includes('Private Key'))) {
            recommendations.push('Store private keys in secure key stores, never in code');
        }

        return recommendations;
    }

    private async performDependencyAudit(packageFile: string): Promise<any> {
        const audit = {
            packageFile,
            vulnerabilities: [] as any[],
            outdatedPackages: [] as any[],
            recommendations: [] as any[]
        };

        try {
            const content = await fs.readFile(packageFile, 'utf8');
            
            if (packageFile.endsWith('package.json')) {
                const packageJson = JSON.parse(content);
                audit.vulnerabilities = await this.auditNpmPackages(packageJson);
            } else if (packageFile.endsWith('requirements.txt')) {
                audit.vulnerabilities = await this.auditPythonPackages(content);
            }

            // Generate recommendations
            if (audit.vulnerabilities.length > 0) {
                audit.recommendations.push('Update vulnerable dependencies to secure versions');
                audit.recommendations.push('Consider using automated dependency scanning tools');
            }

            audit.recommendations.push('Regularly audit dependencies for security issues');
            audit.recommendations.push('Use exact version pinning for production deployments');
        } catch (error) { (error as Error).message : String(error)}`
            });
        }

        return audit;
    }

    private async auditNpmPackages(packageJson: any): Promise<any[]> {
        const vulnerabilities: string[] = [];
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Mock vulnerability data - in production, you'd use npm audit API
        const knownVulnerabilities = [
            { package: 'lodash', version: '<4.17.21', severity: 'high', issue: 'Prototype pollution' },
            { package: 'express', version: '<4.18.0', severity: 'medium', issue: 'Open redirect' },
            { package: 'axios', version: '<0.27.0', severity: 'medium', issue: 'SSRF vulnerability' }
        ];

        for (const [pkg, version] of Object.entries(dependencies)) {
            const vuln = knownVulnerabilities.find(v => v.package === pkg);
            if (vuln && this.isVersionVulnerable(version as string, vuln.version)) {
                vulnerabilities.push({
                    package: pkg,
                    installedVersion: version,
                    vulnerableRange: vuln.version,
                    severity: vuln as "error" | "warning" | "info".severity,
                    issue: vuln.issue
                });
            }
        }

        return vulnerabilities;
    }

    private async auditPythonPackages(content: string): Promise<any[]> {
        const vulnerabilities: string[] = [];
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

        // Mock vulnerability data for Python packages
        const knownVulnerabilities = [
            { package: 'django', version: '<3.2.13', severity: 'high', issue: 'SQL injection' },
            { package: 'flask', version: '<2.1.0', severity: 'medium', issue: 'Open redirect' },
            { package: 'requests', version: '<2.28.0', severity: 'medium', issue: 'Certificate validation' }
        ];

        for (const line of lines) {
            const match = line.match(/^([a-zA-Z0-9-_]+)([>=<]+)?([\d.]+)?/);
            if (match) {
                const [, pkg, operator, version] = match;
                const vuln = knownVulnerabilities.find(v => v.package === pkg);
                if (vuln) {
                    vulnerabilities.push({
                        package: pkg,
                        installedVersion: version || 'unknown',
                        vulnerableRange: vuln.version,
                        severity: vuln as "error" | "warning" | "info".severity,
                        issue: vuln.issue
                    });
                }
            }
        }

        return vulnerabilities;
    }

    private isVersionVulnerable(installed: string, vulnerable: string): boolean {
        // Simplified version comparison - in production, use semver library
        return true; // Mock implementation
    }

    private getSecurityHeadersConfig(framework: string): { content: string; instructions: string } {
        switch (framework) {
            case 'express':
                return {
                    content: `const helmet = require('helmet');

// Security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});`,
                    instructions: '1. Install helmet: npm install helmet\n2. Add this configuration to your Express app\n3. Adjust CSP directives based on your app needs'
                };

            case 'fastify':
                return {
                    content: `await fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
});`,
                    instructions: '1. Install @fastify/helmet: npm install @fastify/helmet\n2. Register the plugin with your Fastify instance'
                };

            default:
                return {
                    content: `# General Security Headers Configuration
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin`,
                    instructions: 'Configure these headers in your web server or application framework'
                };
        }
    }

    private getConfigExtension(framework: string): string {
        return framework === 'spring' ? 'java' : 'js';
    }

    private analyzeInputValidation(content: string): any[] {
        const issues: string[] = [];

        // Check for common input validation issues
        const patterns = [
            { name: 'No input validation', pattern: /req\.body\.\w+|request\.form\[|request\.json\[/g },
            { name: 'Direct database query with user input', pattern: /query\(.*req\..*\)|execute\(.*req\./g },
            { name: 'Missing sanitization', pattern: /innerHTML\s*=\s*req\.|document\.write\(.*req\./g },
            { name: 'No length validation', pattern: /req\.body\.\w+(?!\.\w*length)/g }
        ];

        for (const pattern of patterns) {
            const matches = content.matchAll(pattern.pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                issues.push({
                    type: pattern as any.name,
                    line: lineNumber,
                    code: match[0 as keyof typeof match]
                });
            }
        }

        return issues;
    }

    private generateInputValidationRecommendations(issues: any[]): string[] {
        return [
            'Validate all user inputs at the application boundary',
            'Use whitelist validation instead of blacklist',
            'Sanitize inputs before processing',
            'Implement proper length and type checking',
            'Use parameterized queries for database operations',
            'Consider using validation libraries like Joi or Yup'
        ];
    }

    private analyzeAuthentication(content: string): any {
        const analysis = {
            hasAuthentication: false,
            authMethods: [] as any[],
            issues: [] as any[],
            strengths: [] as any[]
        };

        // Check for authentication patterns
        if (content.includes('jwt') || content.includes('JWT')) {
            analysis.hasAuthentication = true;
            analysis.authMethods.push('JWT');
        }

        if (content.includes('passport')) {
            analysis.hasAuthentication = true;
            analysis.authMethods.push('Passport.js');
        }

        if (content.includes('bcrypt') || content.includes('scrypt')) {
            analysis.strengths.push('Uses strong password hashing');
        }

        // Check for common issues
        if (content.includes('password') && !content.includes('hash')) {
            analysis.issues.push('Passwords may not be properly hashed');
        }

        if (content.includes('session') && !content.includes('secure')) {
            analysis.issues.push('Session configuration may not be secure');
        }

        return analysis;
    }

    private generateAuthRecommendations(analysis: any): string[] {
        const recommendations: string[] = [];

        if (!analysis.hasAuthentication) {
            recommendations.push('Implement proper authentication mechanism');
        }

        recommendations.push('Use strong password hashing (bcrypt, scrypt, Argon2)');
        recommendations.push('Implement proper session management');
        recommendations.push('Use HTTPS for all authentication endpoints');
        recommendations.push('Implement rate limiting for login attempts');
        recommendations.push('Add multi-factor authentication for sensitive operations');

        return recommendations;
    }

    private createCSPPolicy(appType: string, strictness: string): any {
        const policies = {
            strict: {
                'default-src': ["'self'"],
                'script-src': ["'self'"],
                'style-src': ["'self'"],
                'img-src': ["'self'", "data:"],
                'connect-src': ["'self'"],
                'font-src': ["'self'"],
                'object-src': ["'none'"],
                'media-src': ["'self'"],
                'frame-src': ["'none'"]
            },
            moderate: {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'unsafe-inline'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", "data:", "https:"],
                'connect-src': ["'self'"],
                'font-src': ["'self'", "https:"],
                'object-src': ["'none'"],
                'media-src': ["'self'"],
                'frame-src': ["'self'"]
            },
            lenient: {
                'default-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", "data:", "https:", "http:"],
                'connect-src': ["'self'", "https:", "http:"],
                'font-src': ["'self'", "https:", "data:"],
                'object-src': ["'self'"],
                'media-src': ["'self'", "https:"],
                'frame-src': ["'self'"]
            }
        };

        const policy = policies[strictness as keyof typeof policies] || policies.moderate;
        
        // Adjust for app type
        if (appType === 'spa') {
            policy['connect-src'] = [...policy['connect-src'], 'https:'];
        }

        const header = Object.entries(policy)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');

        return {
            policy,
            header: `Content-Security-Policy: ${header}`,
            appType,
            strictness
        };
    }

    private analyzeEncryption(content: string): any {
        const analysis = {
            encryptionMethods: [] as any[],
            issues: [] as any[],
            strengths: [] as any[]
        };

        // Check for encryption libraries and methods
        if (content.includes('crypto') || content.includes('CryptoJS')) {
            analysis.encryptionMethods.push('Node.js Crypto / CryptoJS');
        }

        if (content.includes('AES')) {
            analysis.encryptionMethods.push('AES encryption');
        }

        if (content.includes('RSA')) {
            analysis.encryptionMethods.push('RSA encryption');
        }

        // Check for issues
        if (content.includes('MD5') || content.includes('SHA1')) {
            analysis.issues.push('Using weak hashing algorithms (MD5/SHA1)');
        }

        if (content.includes('ECB')) {
            analysis.issues.push('Using insecure ECB mode');
        }

        // Check for strengths
        if (content.includes('SHA256') || content.includes('SHA512')) {
            analysis.strengths.push('Using strong hashing algorithms');
        }

        if (content.includes('GCM') || content.includes('CBC')) {
            analysis.strengths.push('Using secure encryption modes');
        }

        return analysis;
    }

    private generateEncryptionRecommendations(analysis: any): string[] {
        return [
            'Use AES-256-GCM for symmetric encryption',
            'Use RSA-4096 or ECDSA for asymmetric encryption',
            'Use SHA-256 or SHA-512 for hashing',
            'Generate cryptographically secure random keys',
            'Implement proper key management',
            'Use authenticated encryption modes (GCM, CCM)',
            'Avoid deprecated algorithms (MD5, SHA1, DES)'
        ];
    }

    private createSecurityChecklist(projectType: string): string {
        return `# Security Checklist for ${projectType.toUpperCase()} Project

## Authentication & Authorization
- [ ] Implement strong authentication mechanism
- [ ] Use secure password hashing (bcrypt, Argon2)
- [ ] Implement proper session management
- [ ] Add rate limiting for authentication endpoints
- [ ] Implement role-based access control
- [ ] Consider multi-factor authentication

## Input Validation
- [ ] Validate all user inputs
- [ ] Sanitize data before processing
- [ ] Use parameterized queries
- [ ] Implement proper file upload validation
- [ ] Check for path traversal vulnerabilities

## Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS for all communications
- [ ] Implement proper key management
- [ ] Secure database connections
- [ ] Regular security updates

## Security Headers
- [ ] Implement Content Security Policy (CSP)
- [ ] Add X-Frame-Options header
- [ ] Set X-Content-Type-Options to nosniff
- [ ] Configure HSTS headers
- [ ] Add X-XSS-Protection header

## Error Handling
- [ ] Implement proper error handling
- [ ] Don't expose sensitive information in errors
- [ ] Log security events
- [ ] Monitor for suspicious activities

## Dependencies
- [ ] Regularly audit dependencies
- [ ] Keep dependencies updated
- [ ] Remove unused dependencies
- [ ] Use dependency scanning tools

## Configuration
- [ ] Secure configuration management
- [ ] Environment-specific configurations
- [ ] No secrets in code
- [ ] Proper file permissions

## Testing
- [ ] Implement security testing
- [ ] Regular penetration testing
- [ ] Automated vulnerability scanning
- [ ] Code security reviews

## Compliance
- [ ] GDPR compliance (if applicable)
- [ ] PCI DSS compliance (if handling payments)
- [ ] HIPAA compliance (if handling health data)
- [ ] Industry-specific requirements

Generated on: ${new Date().toISOString()}
`;
    }

    private scanForSQLInjection(content: string): any[] {
        const vulnerabilities: string[] = [];
        const patterns = [
            { pattern: /(?:query|execute)\s*\(\s*['""][^'"]*\+.*?['""]/gi, description: 'String concatenation in SQL query' },
            { pattern: /(?:query|execute)\s*\(\s*.*?\$\{.*?\}/gi, description: 'Template literal interpolation in SQL query' },
            { pattern: /WHERE\s+\w+\s*=\s*['""]?\s*\+/gi, description: 'Dynamic WHERE clause construction' }
        ];

        for (const { pattern, description } of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                vulnerabilities.push({
                    line: lineNumber,
                    code: match[0 as keyof typeof match],
                    description,
                    severity: 'high'
                });
            }
        }

        return vulnerabilities;
    }

    private generateSQLInjectionRecommendations(vulnerabilities: any[]): string[] {
        return [
            'Use parameterized queries or prepared statements',
            'Implement input validation and sanitization',
            'Use ORM frameworks that handle parameterization',
            'Apply principle of least privilege to database accounts',
            'Regularly review and audit database queries'
        ];
    }

    private scanForXSS(content: string): any[] {
        const vulnerabilities: string[] = [];
        const patterns = [
            { pattern: /innerHTML\s*=\s*.*(?:req\.|user|input)/gi, description: 'Direct HTML injection from user input' },
            { pattern: /document\.write\s*\(\s*.*(?:req\.|user|input)/gi, description: 'document.write with user input' },
            { pattern: /eval\s*\(\s*.*(?:req\.|user|input)/gi, description: 'eval() with user input' },
            { pattern: /\$\{.*(?:req\.|user|input).*\}/gi, description: 'Template literal with unescaped user input' }
        ];

        for (const { pattern, description } of patterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                vulnerabilities.push({
                    line: lineNumber,
                    code: match[0 as keyof typeof match],
                    description,
                    severity: 'high'
                });
            }
        }

        return vulnerabilities;
    }

    private generateXSSRecommendations(vulnerabilities: any[]): string[] {
        return [
            'Escape all user-generated content before rendering',
            'Use Content Security Policy (CSP) headers',
            'Sanitize HTML input using trusted libraries',
            'Avoid using innerHTML with user data',
            'Implement proper output encoding',
            'Use framework-provided XSS protection mechanisms'
        ];
    }

    private analyzeCSRFProtection(content: string): any {
        const analysis = {
            hasCSRFProtection: false,
            protectionMethods: [] as any[],
            issues: [] as any[]
        };

        // Check for CSRF protection
        if (content.includes('csrf') || content.includes('CSRF')) {
            analysis.hasCSRFProtection = true;
            analysis.protectionMethods.push('CSRF tokens');
        }

        if (content.includes('SameSite')) {
            analysis.protectionMethods.push('SameSite cookies');
        }

        if (content.includes('Origin') && content.includes('header')) {
            analysis.protectionMethods.push('Origin header validation');
        }

        // Check for issues
        if (content.includes('POST') && !analysis.hasCSRFProtection) {
            analysis.issues.push('POST endpoints without CSRF protection');
        }

        return analysis;
    }

    private generateCSRFRecommendations(analysis: any): string[] {
        return [
            'Implement CSRF tokens for state-changing operations',
            'Use SameSite cookie attribute',
            'Validate Origin and Referer headers',
            'Implement double-submit cookie pattern',
            'Use framework-provided CSRF protection',
            'Apply CSRF protection to all non-idempotent requests'
        ];
    }

    private getVulnerabilityRecommendation(vulnType: string): string {
        const recommendations = {
            'SQL Injection': 'Use parameterized queries and input validation',
            'Command Injection': 'Avoid executing user input as system commands',
            'Path Traversal': 'Validate and sanitize file paths',
            'XSS Vulnerable': 'Escape user input and use CSP headers',
            'Hardcoded Secret': 'Move secrets to environment variables',
            'Weak Random': 'Use cryptographically secure random number generators',
            'Insecure Protocol': 'Use HTTPS instead of HTTP',
            'Debug Code': 'Remove debug code before production deployment'
        };

        return recommendations[vulnType as keyof typeof recommendations] || 'Review and fix security issue';
    }
}

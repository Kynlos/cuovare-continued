import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolExecutor, ToolResult } from '../ToolRegistry';

export class PackageManagerTool implements ToolExecutor {
    readonly name = 'package';
    readonly description = 'Package management, dependency analysis, and project maintenance tools';

    readonly methods = {
        'analyzePackages': {
            description: 'Analyze project dependencies and their health',
            parameters: {
                packageFile: { type: 'string', description: 'Path to package file (package.json, requirements.txt, etc.)', optional: true }
            }
        },
        'updateDependencies': {
            description: 'Generate commands to update dependencies safely',
            parameters: {
                strategy: { type: 'string', description: 'Update strategy (patch, minor, major, all)', optional: true },
                exclude: { type: 'array', description: 'Packages to exclude from updates', optional: true }
            }
        },
        'findUnused': {
            description: 'Find unused dependencies in the project',
            parameters: {
                directory: { type: 'string', description: 'Directory to scan for imports', optional: true }
            }
        },
        'licenseAudit': {
            description: 'Audit package licenses for compliance',
            parameters: {
                allowedLicenses: { type: 'array', description: 'List of allowed license types', optional: true }
            }
        },
        'duplicateAnalysis': {
            description: 'Find duplicate dependencies and version conflicts',
            parameters: {}
        },
        'generateLockfile': {
            description: 'Generate or update lockfile for dependency versions',
            parameters: {
                packageManager: { type: 'string', description: 'Package manager (npm, yarn, pnpm, pip)', optional: true }
            }
        },
        'cleanupProject': {
            description: 'Clean up project files and dependencies',
            parameters: {
                cleanType: { type: 'string', description: 'Cleanup type (cache, modules, temp, all)', optional: true }
            }
        },
        'bundleAnalysis': {
            description: 'Analyze package bundle sizes and impact',
            parameters: {}
        },
        'recommendPackages': {
            description: 'Recommend packages based on project type and needs',
            parameters: {
                category: { type: 'string', description: 'Package category (testing, linting, dev-tools, etc.)', optional: true }
            }
        },
        'migratePackageManager': {
            description: 'Generate migration scripts between package managers',
            parameters: {
                from: { type: 'string', description: 'Source package manager (npm, yarn, pnpm)' },
                to: { type: 'string', description: 'Target package manager (npm, yarn, pnpm)' }
            }
        },
        'validatePackages': {
            description: 'Validate package.json structure and dependencies',
            parameters: {}
        },
        'generateScripts': {
            description: 'Generate common npm/package scripts',
            parameters: {
                projectType: { type: 'string', description: 'Project type (web, api, library, etc.)', optional: true }
            }
        }
    };

    async execute(method: string, args: Record<string, any>): Promise<ToolResult> {
        try {
            switch (method) {
                case 'analyzePackages':
                    return await this.analyzePackages(args.packageFile);
                case 'updateDependencies':
                    return await this.updateDependencies(args.strategy, args.exclude);
                case 'findUnused':
                    return await this.findUnused(args.directory);
                case 'licenseAudit':
                    return await this.licenseAudit(args.allowedLicenses);
                case 'duplicateAnalysis':
                    return await this.duplicateAnalysis();
                case 'generateLockfile':
                    return await this.generateLockfile(args.packageManager);
                case 'cleanupProject':
                    return await this.cleanupProject(args.cleanType);
                case 'bundleAnalysis':
                    return await this.bundleAnalysis();
                case 'recommendPackages':
                    return await this.recommendPackages(args.category);
                case 'migratePackageManager':
                    return await this.migratePackageManager(args.from, args.to);
                case 'validatePackages':
                    return await this.validatePackages();
                case 'generateScripts':
                    return await this.generateScripts(args.projectType);
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

    private async analyzePackages(packageFile?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const targetFile = packageFile || await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!targetFile) {
                return { success: false, error: 'No package file found' };
            }

            const analysis = await this.performPackageAnalysis(targetFile);

            const reportPath = path.join(
                path.dirname(targetFile),
                'package-analysis-report.json'
            );
            await fs.writeFile(reportPath, JSON.stringify(analysis, null, 2));

            return {
                success: true,
                result: `Package analysis completed. Report saved to ${reportPath}\n\n${this.formatAnalysisReport(analysis)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze packages: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async updateDependencies(strategy: string = 'minor', exclude: string[] = []): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const packageManager = this.detectPackageManager(workspaceFolder.uri.fsPath);
            const updatePlan = await this.createUpdatePlan(packageFile, strategy, exclude, packageManager);

            const scriptPath = path.join(
                workspaceFolder.uri.fsPath,
                'scripts',
                'update-dependencies.sh'
            );
            
            await fs.mkdir(path.dirname(scriptPath), { recursive: true });
            await fs.writeFile(scriptPath, updatePlan.script);
            
            // Make script executable on Unix systems
            if (process.platform !== 'win32') {
                await fs.chmod(scriptPath, '755');
            }

            return {
                success: true,
                result: `Update plan generated at ${scriptPath}\n\nStrategy: ${strategy}\nPackages to update: ${updatePlan.packagesToUpdate}\nInstructions:\n${updatePlan.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate update plan: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async findUnused(directory?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const searchDir = directory || workspaceFolder.uri.fsPath;
            const packageFile = await this.findPackageFile(searchDir);
            
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const unusedDeps = await this.findUnusedDependencies(packageFile, searchDir);

            const reportPath = path.join(
                path.dirname(packageFile),
                'unused-dependencies.json'
            );
            await fs.writeFile(reportPath, JSON.stringify(unusedDeps, null, 2));

            return {
                success: true,
                result: JSON.stringify({
                    unusedDependencies: unusedDeps.unused,
                    potentialSavings: unusedDeps.potentialSavings,
                    recommendations: unusedDeps.recommendations,
                    reportPath
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to find unused dependencies: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async licenseAudit(allowedLicenses?: string[]): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const defaultAllowed = allowedLicenses || [
                'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0'
            ];

            const licenseAudit = await this.performLicenseAudit(packageFile, defaultAllowed);

            const auditPath = path.join(
                path.dirname(packageFile),
                'license-audit.json'
            );
            await fs.writeFile(auditPath, JSON.stringify(licenseAudit, null, 2));

            return {
                success: true,
                result: `License audit completed. Report saved to ${auditPath}\n\n${this.formatLicenseReport(licenseAudit)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to audit licenses: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async duplicateAnalysis(): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const duplicates = await this.findDuplicateDependencies(packageFile, workspaceFolder.uri.fsPath);

            return {
                success: true,
                result: JSON.stringify({
                    duplicateDependencies: duplicates.duplicates,
                    versionConflicts: duplicates.conflicts,
                    recommendations: duplicates.recommendations,
                    potentialSavings: duplicates.potentialSavings
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze duplicates: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateLockfile(packageManager?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const detectedPM = packageManager || this.detectPackageManager(workspaceFolder.uri.fsPath);
            const lockfileInfo = this.generateLockfileScript(detectedPM);

            const scriptPath = path.join(
                workspaceFolder.uri.fsPath,
                'scripts',
                'generate-lockfile.sh'
            );

            await fs.mkdir(path.dirname(scriptPath), { recursive: true });
            await fs.writeFile(scriptPath, lockfileInfo.script);

            if (process.platform !== 'win32') {
                await fs.chmod(scriptPath, '755');
            }

            return {
                success: true,
                result: `Lockfile generation script created at ${scriptPath}\n\nPackage Manager: ${detectedPM}\nInstructions:\n${lockfileInfo.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate lockfile script: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async cleanupProject(cleanType: string = 'all'): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const cleanupScript = this.generateCleanupScript(cleanType);

            const scriptPath = path.join(
                workspaceFolder.uri.fsPath,
                'scripts',
                'cleanup.sh'
            );

            await fs.mkdir(path.dirname(scriptPath), { recursive: true });
            await fs.writeFile(scriptPath, cleanupScript.script);

            if (process.platform !== 'win32') {
                await fs.chmod(scriptPath, '755');
            }

            return {
                success: true,
                result: `Cleanup script generated at ${scriptPath}\n\nCleanup type: ${cleanType}\nInstructions:\n${cleanupScript.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate cleanup script: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async bundleAnalysis(): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const bundleAnalysis = await this.performBundleAnalysis(packageFile);

            const analysisPath = path.join(
                path.dirname(packageFile),
                'bundle-analysis.json'
            );
            await fs.writeFile(analysisPath, JSON.stringify(bundleAnalysis, null, 2));

            return {
                success: true,
                result: `Bundle analysis completed. Report saved to ${analysisPath}\n\n${this.formatBundleReport(bundleAnalysis)}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to analyze bundle: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async recommendPackages(category?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const recommendations = await this.generatePackageRecommendations(packageFile, category);

            return {
                success: true,
                result: JSON.stringify({
                    category: category || 'all',
                    recommendations: recommendations.packages,
                    reasoning: recommendations.reasoning,
                    installCommands: recommendations.installCommands
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to recommend packages: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async migratePackageManager(from: string, to: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const migration = this.generateMigrationScript(from, to);

            const scriptPath = path.join(
                workspaceFolder.uri.fsPath,
                'scripts',
                `migrate-${from}-to-${to}.sh`
            );

            await fs.mkdir(path.dirname(scriptPath), { recursive: true });
            await fs.writeFile(scriptPath, migration.script);

            if (process.platform !== 'win32') {
                await fs.chmod(scriptPath, '755');
            }

            return {
                success: true,
                result: `Migration script generated at ${scriptPath}\n\nFrom: ${from}\nTo: ${to}\nInstructions:\n${migration.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate migration script: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async validatePackages(): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const validation = await this.validatePackageStructure(packageFile);

            return {
                success: validation.isValid,
                result: JSON.stringify({
                    valid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    suggestions: validation.suggestions
                }, null, 2)
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to validate packages: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async generateScripts(projectType?: string): Promise<ToolResult> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { success: false, error: 'No workspace folder found' };
            }

            const packageFile = await this.findPackageFile(workspaceFolder.uri.fsPath);
            if (!packageFile) {
                return { success: false, error: 'No package file found' };
            }

            const detectedType = projectType || await this.detectProjectType(packageFile);
            const scripts = this.generateProjectScripts(detectedType);

            // Update package.json with new scripts
            const packageContent = await fs.readFile(packageFile, 'utf8');
            const packageJson = JSON.parse(packageContent);
            
            packageJson.scripts = {
                ...packageJson.scripts,
                ...scripts.scripts
            };

            // Backup original
            await fs.writeFile(`${packageFile}.backup`, packageContent);
            
            // Write updated package.json
            await fs.writeFile(packageFile, JSON.stringify(packageJson, null, 2));

            return {
                success: true,
                result: `Scripts generated for ${detectedType} project.\n\nNew scripts added: ${Object.keys(scripts.scripts).join(', ')}\n\nBackup saved to ${packageFile}.backup\n\nInstructions:\n${scripts.instructions}`
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to generate scripts: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Helper methods
    private async findPackageFile(directory: string): Promise<string | null> {
        const packageFiles = ['package.json', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle', 'Cargo.toml'];
        
        for (const file of packageFiles) {
            const filePath = path.join(directory, file);
            try {
                await fs.access(filePath);
                return filePath;
            } catch {
                // File doesn't exist, continue
            }
        }
        
        return null;
    }

    private detectPackageManager(directory: string): string {
        const lockFiles = {
            'package-lock.json': 'npm',
            'yarn.lock': 'yarn',
            'pnpm-lock.yaml': 'pnpm'
        };

        for (const [lockFile, manager] of Object.entries(lockFiles)) {
            try {
                const lockPath = path.join(directory, lockFile);
                require('fs').accessSync(lockPath);
                return manager;
            } catch {
                // Lock file doesn't exist
            }
        }

        return 'npm'; // Default
    }

    private async performPackageAnalysis(packageFile: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);

        const analysis = {
            packageFile,
            packageManager: this.detectPackageManager(path.dirname(packageFile)),
            dependencies: {
                production: Object.keys(packageJson.dependencies || {}),
                development: Object.keys(packageJson.devDependencies || {}),
                peer: Object.keys(packageJson.peerDependencies || {}),
                optional: Object.keys(packageJson.optionalDependencies || {})
            },
            totalPackages: 0,
            outdatedPackages: [],
            vulnerabilities: [],
            licenseIssues: [],
            healthScore: 0,
            recommendations: []
        };

        analysis.totalPackages = analysis.dependencies.production.length + 
                                analysis.dependencies.development.length;

        // Mock outdated packages analysis
        analysis.outdatedPackages = this.mockOutdatedPackages(analysis.dependencies.production);
        
        // Mock vulnerability analysis
        analysis.vulnerabilities = this.mockVulnerabilities(analysis.dependencies.production);

        // Calculate health score
        analysis.healthScore = this.calculateHealthScore(analysis);

        // Generate recommendations
        analysis.recommendations = this.generateAnalysisRecommendations(analysis);

        return analysis;
    }

    private mockOutdatedPackages(packages: string[]): any[] {
        // Mock implementation - in production, use npm outdated or similar
        const outdated = [];
        const sampleOutdated = ['lodash', 'express', 'react'];
        
        for (const pkg of packages) {
            if (sampleOutdated.includes(pkg)) {
                outdated.push({
                    name: pkg,
                    current: '1.0.0',
                    wanted: '1.1.0',
                    latest: '2.0.0',
                    type: 'minor'
                });
            }
        }
        
        return outdated;
    }

    private mockVulnerabilities(packages: string[]): any[] {
        // Mock implementation - in production, use npm audit or similar
        const vulnerabilities = [];
        const vulnerablePackages = ['lodash', 'minimist'];
        
        for (const pkg of packages) {
            if (vulnerablePackages.includes(pkg)) {
                vulnerabilities.push({
                    name: pkg,
                    severity: 'high',
                    description: 'Prototype pollution vulnerability',
                    recommendation: 'Update to latest version'
                });
            }
        }
        
        return vulnerabilities;
    }

    private calculateHealthScore(analysis: any): number {
        let score = 100;
        
        // Deduct points for issues
        score -= analysis.outdatedPackages.length * 2;
        score -= analysis.vulnerabilities.length * 10;
        score -= analysis.licenseIssues.length * 5;
        
        // Bonus for good practices
        if (analysis.totalPackages < 50) score += 5; // Minimal dependencies
        
        return Math.max(0, Math.min(100, score));
    }

    private generateAnalysisRecommendations(analysis: any): string[] {
        const recommendations = [];
        
        if (analysis.outdatedPackages.length > 0) {
            recommendations.push('Update outdated packages to latest versions');
        }
        
        if (analysis.vulnerabilities.length > 0) {
            recommendations.push('Address security vulnerabilities immediately');
        }
        
        if (analysis.totalPackages > 100) {
            recommendations.push('Consider reducing the number of dependencies');
        }
        
        recommendations.push('Regularly audit dependencies for security issues');
        recommendations.push('Use exact version pinning for production builds');
        
        return recommendations;
    }

    private formatAnalysisReport(analysis: any): string {
        return `Package Analysis Summary:
- Total packages: ${analysis.totalPackages}
- Outdated: ${analysis.outdatedPackages.length}
- Vulnerabilities: ${analysis.vulnerabilities.length}
- Health score: ${analysis.healthScore}/100
- Package manager: ${analysis.packageManager}`;
    }

    private async createUpdatePlan(packageFile: string, strategy: string, exclude: string[], packageManager: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        
        const toUpdate = [...dependencies, ...devDependencies].filter(pkg => !exclude.includes(pkg));
        
        const commands = this.generateUpdateCommands(toUpdate, strategy, packageManager);
        
        const script = `#!/bin/bash
# Dependency Update Script
# Strategy: ${strategy}
# Generated: ${new Date().toISOString()}

set -e

echo "Starting dependency updates..."
echo "Strategy: ${strategy}"
echo "Packages to update: ${toUpdate.length}"

# Backup package.json
cp package.json package.json.backup

${commands.join('\n\n')}

echo "Update completed!"
echo "Run tests to verify everything works correctly"
echo "Restore backup with: cp package.json.backup package.json"`;

        return {
            script,
            packagesToUpdate: toUpdate.length,
            instructions: `1. Review the update plan\n2. Run: ./scripts/update-dependencies.sh\n3. Test your application\n4. Commit changes if tests pass`
        };
    }

    private generateUpdateCommands(packages: string[], strategy: string, packageManager: string): string[] {
        const commands = [];
        
        switch (packageManager) {
            case 'npm':
                if (strategy === 'patch') {
                    commands.push('# Update patch versions only\nnpm update');
                } else if (strategy === 'minor') {
                    commands.push('# Update minor versions\nnpm update --save');
                } else {
                    commands.push('# Update to latest versions\nnpm install ' + packages.map(p => `${p}@latest`).join(' '));
                }
                break;
            case 'yarn':
                if (strategy === 'patch') {
                    commands.push('# Update patch versions only\nyarn upgrade --pattern "*" --latest');
                } else {
                    commands.push('# Update to latest versions\nyarn upgrade');
                }
                break;
            case 'pnpm':
                commands.push('# Update with pnpm\npnpm update');
                break;
        }
        
        return commands;
    }

    private async findUnusedDependencies(packageFile: string, searchDir: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        
        const allDeps = [...dependencies, ...devDependencies];
        const used = await this.findUsedPackages(searchDir);
        
        const unused = allDeps.filter(dep => !used.includes(dep));
        
        return {
            unused,
            used,
            potentialSavings: `${unused.length} packages`,
            recommendations: [
                'Remove unused dependencies to reduce bundle size',
                'Verify dependencies are actually unused before removing',
                'Consider moving dev-only packages to devDependencies'
            ]
        };
    }

    private async findUsedPackages(directory: string): Promise<string[]> {
        const used = new Set<string>();
        const files = await this.getCodeFiles(directory);
        
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const imports = this.extractImports(content);
                imports.forEach(imp => used.add(imp));
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        return Array.from(used);
    }

    private async getCodeFiles(directory: string): Promise<string[]> {
        const files: string[] = [];
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'];
        
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    const subFiles = await this.getCodeFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist or be accessible
        }
        
        return files;
    }

    private extractImports(content: string): string[] {
        const imports = [];
        
        // ES6 imports
        const es6Imports = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
        if (es6Imports) {
            for (const imp of es6Imports) {
                const match = imp.match(/from\s+['"]([^'"]+)['"]/);
                if (match) {
                    const packageName = this.extractPackageName(match[1]);
                    if (packageName) imports.push(packageName);
                }
            }
        }
        
        // CommonJS requires
        const requires = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        if (requires) {
            for (const req of requires) {
                const match = req.match(/['"]([^'"]+)['"]/);
                if (match) {
                    const packageName = this.extractPackageName(match[1]);
                    if (packageName) imports.push(packageName);
                }
            }
        }
        
        return imports;
    }

    private extractPackageName(importPath: string): string | null {
        // Handle relative imports
        if (importPath.startsWith('.')) return null;
        
        // Handle scoped packages
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            return parts.slice(0, 2).join('/');
        }
        
        // Handle regular packages
        return importPath.split('/')[0];
    }

    private async performLicenseAudit(packageFile: string, allowedLicenses: string[]): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const dependencies = Object.keys(packageJson.dependencies || {});
        const licenseReport = {
            allowedLicenses,
            compliantPackages: [],
            nonCompliantPackages: [],
            unknownLicenses: [],
            summary: {}
        };
        
        // Mock license data - in production, use license-checker or similar
        for (const dep of dependencies) {
            const mockLicense = this.getMockLicense(dep);
            
            if (allowedLicenses.includes(mockLicense)) {
                licenseReport.compliantPackages.push({ name: dep, license: mockLicense });
            } else if (mockLicense === 'Unknown') {
                licenseReport.unknownLicenses.push({ name: dep, license: mockLicense });
            } else {
                licenseReport.nonCompliantPackages.push({ name: dep, license: mockLicense });
            }
        }
        
        return licenseReport;
    }

    private getMockLicense(packageName: string): string {
        // Mock implementation - in production, parse actual license data
        const commonLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'ISC'];
        const hash = packageName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return commonLicenses[hash % commonLicenses.length];
    }

    private formatLicenseReport(audit: any): string {
        return `License Audit Summary:
- Compliant packages: ${audit.compliantPackages.length}
- Non-compliant: ${audit.nonCompliantPackages.length}  
- Unknown licenses: ${audit.unknownLicenses.length}
- Allowed licenses: ${audit.allowedLicenses.join(', ')}`;
    }

    private async findDuplicateDependencies(packageFile: string, directory: string): Promise<any> {
        // This would require analyzing node_modules structure
        // For now, return mock data
        return {
            duplicates: [
                { name: 'lodash', versions: ['4.17.20', '4.17.21'], locations: ['node_modules/lodash', 'node_modules/some-package/node_modules/lodash'] }
            ],
            conflicts: [
                { name: 'react', requiredVersions: ['^16.0.0', '^17.0.0'], packages: ['package-a', 'package-b'] }
            ],
            recommendations: [
                'Use resolutions in package.json to force single versions',
                'Update packages to use compatible dependency versions'
            ],
            potentialSavings: '2.3 MB'
        };
    }

    private generateLockfileScript(packageManager: string): any {
        const scripts = {
            npm: {
                script: `#!/bin/bash
# Generate npm lockfile
echo "Generating package-lock.json..."
rm -f package-lock.json
npm install
echo "Lockfile generated successfully!"`,
                instructions: 'Run to generate fresh package-lock.json file'
            },
            yarn: {
                script: `#!/bin/bash
# Generate yarn lockfile  
echo "Generating yarn.lock..."
rm -f yarn.lock
yarn install
echo "Lockfile generated successfully!"`,
                instructions: 'Run to generate fresh yarn.lock file'
            },
            pnpm: {
                script: `#!/bin/bash
# Generate pnpm lockfile
echo "Generating pnpm-lock.yaml..."
rm -f pnpm-lock.yaml
pnpm install
echo "Lockfile generated successfully!"`,
                instructions: 'Run to generate fresh pnpm-lock.yaml file'
            }
        };
        
        return scripts[packageManager as keyof typeof scripts] || scripts.npm;
    }

    private generateCleanupScript(cleanType: string): any {
        const cleanupCommands = {
            cache: [
                'echo "Cleaning package manager cache..."',
                'npm cache clean --force 2>/dev/null || true',
                'yarn cache clean 2>/dev/null || true',
                'pnpm store prune 2>/dev/null || true'
            ],
            modules: [
                'echo "Removing node_modules..."',
                'rm -rf node_modules',
                'echo "node_modules removed"'
            ],
            temp: [
                'echo "Cleaning temporary files..."',
                'rm -rf .tmp',
                'rm -rf temp',
                'rm -rf *.log',
                'rm -rf .nyc_output',
                'rm -rf coverage'
            ],
            all: [
                'echo "Full project cleanup..."',
                'rm -rf node_modules',
                'npm cache clean --force 2>/dev/null || true',
                'yarn cache clean 2>/dev/null || true',
                'pnpm store prune 2>/dev/null || true',
                'rm -rf .tmp temp *.log .nyc_output coverage',
                'echo "Cleanup completed!"'
            ]
        };
        
        const commands = cleanupCommands[cleanType as keyof typeof cleanupCommands] || cleanupCommands.all;
        
        return {
            script: `#!/bin/bash
# Project Cleanup Script
# Type: ${cleanType}

set -e

${commands.join('\n')}

echo "Cleanup completed successfully!"`,
            instructions: `1. Run: ./scripts/cleanup.sh\n2. Reinstall dependencies: npm install\n3. Verify project works correctly`
        };
    }

    private async performBundleAnalysis(packageFile: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const dependencies = packageJson.dependencies || {};
        const bundleAnalysis = {
            totalPackages: Object.keys(dependencies).length,
            estimatedSize: '0 MB',
            largestPackages: [],
            recommendations: []
        };
        
        // Mock bundle size analysis
        const packageSizes = this.estimatePackageSizes(Object.keys(dependencies));
        bundleAnalysis.largestPackages = packageSizes.slice(0, 10);
        bundleAnalysis.estimatedSize = this.calculateTotalSize(packageSizes);
        bundleAnalysis.recommendations = this.generateBundleRecommendations(bundleAnalysis);
        
        return bundleAnalysis;
    }

    private estimatePackageSizes(packages: string[]): any[] {
        // Mock implementation - in production, use bundlephobia API or actual bundle analysis
        return packages.map(pkg => ({
            name: pkg,
            size: Math.floor(Math.random() * 500) + 50, // Random size in KB
            gzipped: Math.floor(Math.random() * 100) + 10
        })).sort((a, b) => b.size - a.size);
    }

    private calculateTotalSize(packageSizes: any[]): string {
        const totalKB = packageSizes.reduce((sum, pkg) => sum + pkg.size, 0);
        return `${(totalKB / 1024).toFixed(1)} MB`;
    }

    private generateBundleRecommendations(analysis: any): string[] {
        const recommendations = [];
        
        if (analysis.totalPackages > 50) {
            recommendations.push('Consider reducing the number of dependencies');
        }
        
        if (analysis.largestPackages.length > 0) {
            recommendations.push('Analyze if large packages can be replaced with smaller alternatives');
        }
        
        recommendations.push('Use tree shaking to eliminate unused code');
        recommendations.push('Consider code splitting for web applications');
        
        return recommendations;
    }

    private formatBundleReport(analysis: any): string {
        return `Bundle Analysis Summary:
- Total packages: ${analysis.totalPackages}
- Estimated size: ${analysis.estimatedSize}
- Largest packages: ${analysis.largestPackages.slice(0, 3).map((p: any) => p.name).join(', ')}
- Recommendations: ${analysis.recommendations.length}`;
    }

    private async generatePackageRecommendations(packageFile: string, category?: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const existing = Object.keys(packageJson.dependencies || {});
        const devExisting = Object.keys(packageJson.devDependencies || {});
        
        const recommendations = {
            packages: [],
            reasoning: [],
            installCommands: []
        };
        
        const packageRecommendations = this.getPackageRecommendationsByCategory(category, existing, devExisting);
        
        recommendations.packages = packageRecommendations.packages;
        recommendations.reasoning = packageRecommendations.reasoning;
        recommendations.installCommands = packageRecommendations.installCommands;
        
        return recommendations;
    }

    private getPackageRecommendationsByCategory(category: string | undefined, existing: string[], devExisting: string[]): any {
        const recommendations = {
            packages: [] as any[],
            reasoning: [] as string[],
            installCommands: [] as string[]
        };
        
        if (!category || category === 'testing') {
            if (!existing.includes('jest') && !devExisting.includes('jest')) {
                recommendations.packages.push({ name: 'jest', type: 'dev', description: 'JavaScript testing framework' });
                recommendations.installCommands.push('npm install --save-dev jest');
                recommendations.reasoning.push('Jest is a comprehensive testing framework for JavaScript');
            }
        }
        
        if (!category || category === 'linting') {
            if (!devExisting.includes('eslint')) {
                recommendations.packages.push({ name: 'eslint', type: 'dev', description: 'JavaScript linter' });
                recommendations.installCommands.push('npm install --save-dev eslint');
                recommendations.reasoning.push('ESLint helps maintain code quality and consistency');
            }
        }
        
        if (!category || category === 'dev-tools') {
            if (!devExisting.includes('prettier')) {
                recommendations.packages.push({ name: 'prettier', type: 'dev', description: 'Code formatter' });
                recommendations.installCommands.push('npm install --save-dev prettier');
                recommendations.reasoning.push('Prettier ensures consistent code formatting');
            }
        }
        
        return recommendations;
    }

    private generateMigrationScript(from: string, to: string): any {
        const migrations = {
            'npm-yarn': {
                script: `#!/bin/bash
# Migrate from npm to yarn
echo "Migrating from npm to yarn..."

# Remove npm lockfile
rm -f package-lock.json

# Install yarn if not present
if ! command -v yarn &> /dev/null; then
    npm install -g yarn
fi

# Install dependencies with yarn
yarn install

echo "Migration completed!"
echo "Remember to update CI/CD scripts to use yarn"`,
                instructions: '1. Run the migration script\n2. Update CI/CD configurations\n3. Update documentation\n4. Commit yarn.lock file'
            },
            'npm-pnpm': {
                script: `#!/bin/bash
# Migrate from npm to pnpm
echo "Migrating from npm to pnpm..."

# Remove npm lockfile
rm -f package-lock.json

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi

# Install dependencies with pnpm
pnpm install

echo "Migration completed!"
echo "Remember to update CI/CD scripts to use pnpm"`,
                instructions: '1. Run the migration script\n2. Update CI/CD configurations\n3. Update documentation\n4. Commit pnpm-lock.yaml file'
            }
        };
        
        const key = `${from}-${to}`;
        return migrations[key as keyof typeof migrations] || {
            script: `#!/bin/bash
echo "Migration from ${from} to ${to} not implemented"`,
            instructions: 'Manual migration required'
        };
    }

    private async validatePackageStructure(packageFile: string): Promise<any> {
        const content = await fs.readFile(packageFile, 'utf8');
        
        let packageJson;
        try {
            packageJson = JSON.parse(content);
        } catch (error) {
            return {
                isValid: false,
                errors: ['Invalid JSON in package.json'],
                warnings: [],
                suggestions: []
            };
        }
        
        const validation = {
            isValid: true,
            errors: [] as string[],
            warnings: [] as string[],
            suggestions: [] as string[]
        };
        
        // Required fields
        const requiredFields = ['name', 'version'];
        for (const field of requiredFields) {
            if (!packageJson[field]) {
                validation.errors.push(`Missing required field: ${field}`);
                validation.isValid = false;
            }
        }
        
        // Recommended fields
        const recommendedFields = ['description', 'author', 'license'];
        for (const field of recommendedFields) {
            if (!packageJson[field]) {
                validation.warnings.push(`Missing recommended field: ${field}`);
            }
        }
        
        // Scripts validation
        if (!packageJson.scripts || Object.keys(packageJson.scripts).length === 0) {
            validation.suggestions.push('Add npm scripts for common tasks (test, build, lint)');
        }
        
        // Dependencies validation
        if (packageJson.dependencies && packageJson.devDependencies) {
            const duplicates = Object.keys(packageJson.dependencies).filter(dep => 
                packageJson.devDependencies.hasOwnProperty(dep)
            );
            
            if (duplicates.length > 0) {
                validation.warnings.push(`Dependencies listed in both dependencies and devDependencies: ${duplicates.join(', ')}`);
            }
        }
        
        return validation;
    }

    private async detectProjectType(packageFile: string): Promise<string> {
        const content = await fs.readFile(packageFile, 'utf8');
        const packageJson = JSON.parse(content);
        
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (dependencies.react || dependencies['@types/react']) return 'react';
        if (dependencies.vue || dependencies['@vue/cli']) return 'vue';
        if (dependencies.angular || dependencies['@angular/core']) return 'angular';
        if (dependencies.express || dependencies.fastify) return 'api';
        if (dependencies.electron) return 'desktop';
        if (packageJson.type === 'module' || dependencies.typescript) return 'library';
        
        return 'web';
    }

    private generateProjectScripts(projectType: string): any {
        const scriptSets = {
            react: {
                scripts: {
                    'dev': 'react-scripts start',
                    'build': 'react-scripts build',
                    'test': 'react-scripts test',
                    'test:coverage': 'npm test -- --coverage --watchAll=false',
                    'lint': 'eslint src --ext .js,.jsx,.ts,.tsx',
                    'lint:fix': 'eslint src --ext .js,.jsx,.ts,.tsx --fix',
                    'format': 'prettier --write src/**/*.{js,jsx,ts,tsx,css,md}'
                },
                instructions: 'React project scripts added for development, building, testing, and code quality'
            },
            vue: {
                scripts: {
                    'dev': 'vue-cli-service serve',
                    'build': 'vue-cli-service build',
                    'test': 'vue-cli-service test:unit',
                    'lint': 'vue-cli-service lint',
                    'format': 'prettier --write src/**/*.{js,vue,css,md}'
                },
                instructions: 'Vue.js project scripts added for development, building, testing, and linting'
            },
            api: {
                scripts: {
                    'dev': 'nodemon src/index.js',
                    'start': 'node src/index.js',
                    'build': 'npm run clean && npm run compile',
                    'clean': 'rm -rf dist',
                    'compile': 'tsc',
                    'test': 'jest',
                    'test:watch': 'jest --watch',
                    'test:coverage': 'jest --coverage',
                    'lint': 'eslint src --ext .js,.ts',
                    'lint:fix': 'eslint src --ext .js,.ts --fix'
                },
                instructions: 'API project scripts added for development, building, testing, and deployment'
            },
            library: {
                scripts: {
                    'build': 'tsc',
                    'build:watch': 'tsc --watch',
                    'test': 'jest',
                    'test:watch': 'jest --watch',
                    'test:coverage': 'jest --coverage',
                    'lint': 'eslint src --ext .js,.ts',
                    'lint:fix': 'eslint src --ext .js,.ts --fix',
                    'format': 'prettier --write src/**/*.{js,ts,md}',
                    'prepublishOnly': 'npm run build && npm test'
                },
                instructions: 'Library project scripts added for building, testing, and publishing'
            }
        };
        
        return scriptSets[projectType as keyof typeof scriptSets] || scriptSets.web || {
            scripts: {
                'test': 'echo "No tests specified"',
                'lint': 'eslint .',
                'format': 'prettier --write .'
            },
            instructions: 'Basic project scripts added'
        };
    }
}

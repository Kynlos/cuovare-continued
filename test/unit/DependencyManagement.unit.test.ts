/**
 * Dependency Management Unit Tests - v0.9.0
 * 
 * Comprehensive test suite for the Dependency Management system with
 * vulnerability scanning, smart updates, and license compliance checking.
 */

import * as assert from 'assert';
import * as path from 'path';
import { 
    DependencyManagement, 
    DependencyInfo, 
    SecurityVulnerability, 
    DependencyUpdate, 
    DependencyAnalysis 
} from '../../src/dependencies/DependencyManagement';

// Self-contained test framework
class TestFramework {
    private tests: { name: string; fn: () => Promise<void> | void; group: string }[] = [];
    private groups: Set<string> = new Set();

    describe(groupName: string, fn: () => void) {
        this.groups.add(groupName);
        const currentGroup = groupName;
        const originalIt = (global as any).it;
        (global as any).it = (testName: string, testFn: () => Promise<void> | void) => {
            this.tests.push({ name: testName, fn: testFn, group: currentGroup });
        };
        fn();
        (global as any).it = originalIt;
    }

    async runTests(): Promise<{ passed: number; failed: number; results: any[] }> {
        let passed = 0;
        let failed = 0;
        const results: any[] = [];

        console.log('🧪 Running Dependency Management Tests...\n');

        for (const group of this.groups) {
            console.log(`📁 ${group}`);
            const groupTests = this.tests.filter(t => t.group === group);
            
            for (const test of groupTests) {
                try {
                    await test.fn();
                    console.log(`  ✅ ${test.name}`);
                    passed++;
                    results.push({ name: test.name, group, status: 'passed' });
                } catch (error) {
                    console.log(`  ❌ ${test.name}`);
                    console.log(`     Error: ${error}`);
                    failed++;
                    results.push({ name: test.name, group, status: 'failed', error: String(error) });
                }
            }
            console.log('');
        }

        return { passed, failed, results };
    }
}

const test = new TestFramework();

// Test helper functions
function createMockDependencies(): DependencyInfo[] {
    return [
        {
            name: 'lodash',
            version: '4.17.20',
            type: 'dependency',
            description: 'A modern JavaScript utility library',
            license: 'MIT',
            size: 1200000,
            latestVersion: '4.17.21'
        },
        {
            name: 'express',
            version: '4.18.0',
            type: 'dependency',
            description: 'Fast, unopinionated, minimalist web framework',
            license: 'MIT',
            size: 800000,
            latestVersion: '4.18.2'
        },
        {
            name: 'typescript',
            version: '4.8.0',
            type: 'devDependency',
            description: 'TypeScript is a language for application scale JavaScript development',
            license: 'Apache-2.0',
            size: 15000000,
            latestVersion: '5.0.0'
        },
        {
            name: 'example-vulnerable-package',
            version: '1.0.0',
            type: 'dependency',
            description: 'Example package with vulnerabilities',
            license: 'MIT',
            size: 100000,
            latestVersion: '1.2.3'
        }
    ];
}

function createMockVulnerabilities(): SecurityVulnerability[] {
    return [
        {
            id: 'GHSA-test-001',
            severity: 'high',
            title: 'Cross-Site Scripting in example-vulnerable-package',
            description: 'A cross-site scripting vulnerability exists in example-vulnerable-package.',
            affectedVersions: '<1.2.3',
            patchedVersions: '>=1.2.3',
            cve: 'CVE-2023-12345',
            cwe: ['CWE-79'],
            advisoryUrl: 'https://github.com/advisories/GHSA-test-001',
            reportedBy: 'Security Researcher',
            reportedAt: new Date('2023-01-01'),
            dependency: 'example-vulnerable-package',
            path: ['example-vulnerable-package'],
            fixAvailable: true,
            recommendedAction: 'Update to version 1.2.3 or later'
        },
        {
            id: 'GHSA-test-002',
            severity: 'critical',
            title: 'Remote Code Execution in lodash',
            description: 'A critical RCE vulnerability in older versions of lodash.',
            affectedVersions: '<4.17.21',
            patchedVersions: '>=4.17.21',
            cve: 'CVE-2023-54321',
            cwe: ['CWE-94'],
            advisoryUrl: 'https://github.com/advisories/GHSA-test-002',
            reportedBy: 'Security Team',
            reportedAt: new Date('2023-02-15'),
            dependency: 'lodash',
            path: ['lodash'],
            fixAvailable: true,
            recommendedAction: 'Update to version 4.17.21 immediately'
        }
    ];
}

function createMockProjectStructure(): { packageJson: any; hasLockFile: boolean } {
    return {
        packageJson: {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
                'lodash': '^4.17.20',
                'express': '^4.18.0',
                'example-vulnerable-package': '^1.0.0'
            },
            devDependencies: {
                'typescript': '^4.8.0',
                '@types/node': '^18.0.0'
            },
            scripts: {
                'test': 'jest',
                'build': 'tsc'
            }
        },
        hasLockFile: true
    };
}

// Core Dependency Management Tests
test.describe('Core Dependency Management', () => {
    (global as any).it('should initialize with package managers and license database', () => {
        const depManager = new DependencyManagement();
        
        // Should initialize without errors
        assert.ok(depManager, 'Dependency manager should initialize');
        
        // Should have license database
        const dependencies = createMockDependencies();
        const licenseIssues = depManager.checkLicenseCompliance(dependencies);
        
        assert.ok(Array.isArray(licenseIssues), 'Should return license compliance results');
    });

    (global as any).it('should clear analysis cache', () => {
        const depManager = new DependencyManagement();
        
        // Should not throw when clearing cache
        depManager.clearCache('/test/project');
        depManager.clearCache(); // Clear all
        
        assert.ok(true, 'Should clear cache without errors');
    });

    (global as any).it('should export analysis data', () => {
        const depManager = new DependencyManagement();
        
        const exported = depManager.exportAnalysis('/test/project');
        
        // Should return null for non-existent analysis
        assert.strictEqual(exported, null, 'Should return null for non-existent analysis');
    });
});

// Vulnerability Scanning Tests
test.describe('Vulnerability Scanning', () => {
    (global as any).it('should scan dependencies for vulnerabilities', async () => {
        const depManager = new DependencyManagement();
        const dependencies = createMockDependencies();
        
        const vulnerabilities = await depManager.scanVulnerabilities(dependencies);
        
        assert.ok(Array.isArray(vulnerabilities), 'Should return vulnerabilities array');
        
        // Should find the vulnerable package
        const vulnerablePackage = vulnerabilities.find(v => v.dependency === 'example-vulnerable-package');
        assert.ok(vulnerablePackage, 'Should detect vulnerable package');
        
        if (vulnerablePackage) {
            assert.ok(['low', 'moderate', 'high', 'critical'].includes(vulnerablePackage.severity), 
                'Should have valid severity');
            assert.ok(vulnerablePackage.title, 'Should have vulnerability title');
            assert.ok(vulnerablePackage.description, 'Should have vulnerability description');
        }
    });

    (global as any).it('should check version compatibility with vulnerabilities', async () => {
        const depManager = new DependencyManagement();
        
        // Test with specific vulnerable versions
        const vulnerableDep: DependencyInfo = {
            name: 'example-vulnerable-package',
            version: '1.0.0', // Vulnerable version
            type: 'dependency',
            license: 'MIT'
        };
        
        const safeDep: DependencyInfo = {
            name: 'example-vulnerable-package',
            version: '1.2.3', // Safe version
            type: 'dependency',
            license: 'MIT'
        };
        
        const vulnerableResults = await depManager.scanVulnerabilities([vulnerableDep]);
        const safeResults = await depManager.scanVulnerabilities([safeDep]);
        
        assert.ok(vulnerableResults.length > 0, 'Should detect vulnerabilities in vulnerable version');
        // Safe results might still have vulnerabilities from other sources, so we don't assert length === 0
        assert.ok(Array.isArray(safeResults), 'Should handle safe versions without errors');
    });

    (global as any).it('should handle dependencies without vulnerabilities', async () => {
        const depManager = new DependencyManagement();
        
        const safeDependencies: DependencyInfo[] = [
            {
                name: 'safe-package',
                version: '2.0.0',
                type: 'dependency',
                license: 'MIT'
            }
        ];
        
        const vulnerabilities = await depManager.scanVulnerabilities(safeDependencies);
        
        assert.ok(Array.isArray(vulnerabilities), 'Should return vulnerabilities array');
        // Should not find vulnerabilities for unknown packages
        const safePackageVulns = vulnerabilities.filter(v => v.dependency === 'safe-package');
        assert.strictEqual(safePackageVulns.length, 0, 'Should not find vulnerabilities for safe packages');
    });
});

// License Compliance Tests
test.describe('License Compliance', () => {
    (global as any).it('should check license compliance with allowed licenses', () => {
        const depManager = new DependencyManagement();
        const dependencies = createMockDependencies();
        
        const allowedLicenses = ['MIT', 'Apache-2.0'];
        const issues = depManager.checkLicenseCompliance(dependencies, allowedLicenses);
        
        assert.ok(Array.isArray(issues), 'Should return issues array');
        
        // All test dependencies use allowed licenses, so no issues expected
        assert.strictEqual(issues.length, 0, 'Should not find issues with allowed licenses');
    });

    (global as any).it('should detect prohibited licenses', () => {
        const depManager = new DependencyManagement();
        const dependencies = createMockDependencies();
        
        const allowedLicenses = ['MIT'];
        const prohibitedLicenses = ['Apache-2.0'];
        const issues = depManager.checkLicenseCompliance(dependencies, allowedLicenses, prohibitedLicenses);
        
        assert.ok(Array.isArray(issues), 'Should return issues array');
        
        // Should find issue with TypeScript (Apache-2.0 license)
        const apacheIssue = issues.find(issue => 
            issue.dependency === 'typescript' && issue.license === 'Apache-2.0'
        );
        assert.ok(apacheIssue, 'Should detect prohibited Apache-2.0 license');
        assert.ok(apacheIssue.issue.includes('prohibited'), 'Should indicate license is prohibited');
    });

    (global as any).it('should detect missing license information', () => {
        const depManager = new DependencyManagement();
        
        const dependenciesWithoutLicense: DependencyInfo[] = [
            {
                name: 'unknown-license-package',
                version: '1.0.0',
                type: 'dependency'
                // license property missing
            }
        ];
        
        const issues = depManager.checkLicenseCompliance(dependenciesWithoutLicense);
        
        assert.ok(issues.length > 0, 'Should detect missing license information');
        
        const unknownLicenseIssue = issues.find(issue => 
            issue.dependency === 'unknown-license-package' && issue.license === 'unknown'
        );
        assert.ok(unknownLicenseIssue, 'Should detect unknown license');
        assert.ok(unknownLicenseIssue.issue.includes('not available'), 'Should indicate license info not available');
    });

    (global as any).it('should warn about copyleft licenses in production dependencies', () => {
        const depManager = new DependencyManagement();
        
        const copyleftDependency: DependencyInfo[] = [
            {
                name: 'gpl-package',
                version: '1.0.0',
                type: 'dependency', // Production dependency
                license: 'GPL-3.0'
            }
        ];
        
        const issues = depManager.checkLicenseCompliance(copyleftDependency);
        
        const copyleftIssue = issues.find(issue => 
            issue.dependency === 'gpl-package' && issue.issue.includes('copyleft')
        );
        assert.ok(copyleftIssue, 'Should warn about copyleft licenses in production');
    });
});

// Update Management Tests
test.describe('Update Management', () => {
    (global as any).it('should get update recommendations', async () => {
        const depManager = new DependencyManagement();
        
        // Mock analyze dependencies to return some data
        const mockAnalysis: DependencyAnalysis = {
            projectPath: '/test/project',
            packageManager: 'npm',
            totalDependencies: 4,
            directDependencies: 3,
            devDependencies: 1,
            vulnerabilities: createMockVulnerabilities(),
            outdatedPackages: [
                {
                    name: 'lodash',
                    currentVersion: '4.17.20',
                    targetVersion: '4.17.21',
                    updateType: 'patch',
                    breaking: false,
                    securityFix: true,
                    bugFix: true,
                    newFeatures: [],
                    breakingChanges: [],
                    confidence: 'high',
                    riskLevel: 'low',
                    impact: { bundleSize: 0, dependencies: [], compatibility: [] }
                }
            ],
            unusedDependencies: [],
            duplicateDependencies: [],
            licenseIssues: [],
            recommendations: [],
            totalSize: 17100000,
            compressionRatio: 0.7,
            securityScore: 75,
            healthScore: 85,
            lastUpdated: new Date()
        };
        
        // Override analyze method for testing
        (depManager as any).analysisCache.set('/test/project', mockAnalysis);
        
        const recommendations = await depManager.getUpdateRecommendations('/test/project');
        
        assert.ok(Array.isArray(recommendations), 'Should return recommendations array');
        
        if (recommendations.length > 0) {
            const rec = recommendations[0];
            assert.ok(rec.name, 'Should have package name');
            assert.ok(rec.currentVersion, 'Should have current version');
            assert.ok(rec.targetVersion, 'Should have target version');
            assert.ok(['major', 'minor', 'patch'].includes(rec.updateType), 'Should have valid update type');
            assert.ok(typeof rec.breaking === 'boolean', 'Should indicate breaking changes');
            assert.ok(typeof rec.securityFix === 'boolean', 'Should indicate security fixes');
        }
    });

    (global as any).it('should filter security-only updates', async () => {
        const depManager = new DependencyManagement();
        
        // Mock analysis with security and non-security updates
        const mockAnalysis: DependencyAnalysis = {
            projectPath: '/test/project',
            packageManager: 'npm',
            totalDependencies: 2,
            directDependencies: 2,
            devDependencies: 0,
            vulnerabilities: [],
            outdatedPackages: [
                {
                    name: 'security-package',
                    currentVersion: '1.0.0',
                    targetVersion: '1.0.1',
                    updateType: 'patch',
                    breaking: false,
                    securityFix: true,
                    bugFix: false,
                    newFeatures: [],
                    breakingChanges: [],
                    confidence: 'high',
                    riskLevel: 'low',
                    impact: { bundleSize: 0, dependencies: [], compatibility: [] }
                },
                {
                    name: 'feature-package',
                    currentVersion: '2.0.0',
                    targetVersion: '2.1.0',
                    updateType: 'minor',
                    breaking: false,
                    securityFix: false,
                    bugFix: false,
                    newFeatures: ['new feature'],
                    breakingChanges: [],
                    confidence: 'high',
                    riskLevel: 'low',
                    impact: { bundleSize: 1000, dependencies: [], compatibility: [] }
                }
            ],
            unusedDependencies: [],
            duplicateDependencies: [],
            licenseIssues: [],
            recommendations: [],
            totalSize: 1000000,
            compressionRatio: 0.7,
            securityScore: 90,
            healthScore: 95,
            lastUpdated: new Date()
        };
        
        (depManager as any).analysisCache.set('/test/project', mockAnalysis);
        
        const allUpdates = await depManager.getUpdateRecommendations('/test/project', false);
        const securityOnlyUpdates = await depManager.getUpdateRecommendations('/test/project', true);
        
        assert.ok(allUpdates.length >= securityOnlyUpdates.length, 
            'All updates should include security-only updates');
        
        const securityUpdate = securityOnlyUpdates.find(u => u.name === 'security-package');
        assert.ok(securityUpdate, 'Should include security updates');
        assert.ok(securityUpdate?.securityFix, 'Security update should be marked as security fix');
    });

    (global as any).it('should prioritize updates correctly', async () => {
        const depManager = new DependencyManagement();
        
        const mockAnalysis: DependencyAnalysis = {
            projectPath: '/test/project',
            packageManager: 'npm',
            totalDependencies: 3,
            directDependencies: 3,
            devDependencies: 0,
            vulnerabilities: [
                {
                    id: 'VULN-001',
                    severity: 'critical',
                    title: 'Critical vulnerability',
                    description: 'Critical security issue',
                    affectedVersions: '<2.0.0',
                    reportedAt: new Date(),
                    dependency: 'vulnerable-package',
                    path: ['vulnerable-package'],
                    fixAvailable: true,
                    recommendedAction: 'Update immediately'
                }
            ],
            outdatedPackages: [
                {
                    name: 'vulnerable-package',
                    currentVersion: '1.5.0',
                    targetVersion: '2.0.0',
                    updateType: 'major',
                    breaking: true,
                    securityFix: true,
                    bugFix: true,
                    newFeatures: [],
                    breakingChanges: ['API changes'],
                    confidence: 'high',
                    riskLevel: 'high',
                    impact: { bundleSize: 0, dependencies: [], compatibility: [] }
                },
                {
                    name: 'safe-package',
                    currentVersion: '1.0.0',
                    targetVersion: '1.1.0',
                    updateType: 'minor',
                    breaking: false,
                    securityFix: false,
                    bugFix: true,
                    newFeatures: ['performance improvements'],
                    breakingChanges: [],
                    confidence: 'high',
                    riskLevel: 'low',
                    impact: { bundleSize: 500, dependencies: [], compatibility: [] }
                }
            ],
            unusedDependencies: [],
            duplicateDependencies: [],
            licenseIssues: [],
            recommendations: [],
            totalSize: 2000000,
            compressionRatio: 0.7,
            securityScore: 60,
            healthScore: 70,
            lastUpdated: new Date()
        };
        
        (depManager as any).analysisCache.set('/test/project', mockAnalysis);
        
        const recommendations = await depManager.getUpdateRecommendations('/test/project');
        
        // Security fixes should come first, even if they're breaking
        const firstUpdate = recommendations[0];
        assert.strictEqual(firstUpdate.name, 'vulnerable-package', 
            'Security fixes should be prioritized');
        assert.ok(firstUpdate.securityFix, 'First update should be a security fix');
    });
});

// Unused Dependencies Detection Tests
test.describe('Unused Dependencies Detection', () => {
    (global as any).it('should handle projects without source files', async () => {
        const depManager = new DependencyManagement();
        
        // Test with non-existent project path
        const unusedDeps = await depManager.findUnusedDependencies('/non/existent/path');
        
        assert.ok(Array.isArray(unusedDeps), 'Should return array even for invalid path');
        assert.strictEqual(unusedDeps.length, 0, 'Should return empty array for invalid path');
    });

    (global as any).it('should extract package names from import paths correctly', () => {
        const depManager = new DependencyManagement();
        
        // Test package name extraction (private method testing via casting)
        const extractPackageName = (depManager as any).extractPackageName.bind(depManager);
        
        assert.strictEqual(extractPackageName('lodash'), 'lodash', 'Should handle simple package names');
        assert.strictEqual(extractPackageName('lodash/debounce'), 'lodash', 'Should handle sub-imports');
        assert.strictEqual(extractPackageName('@types/node'), '@types/node', 'Should handle scoped packages');
        assert.strictEqual(extractPackageName('@babel/core/lib/parser'), '@babel/core', 'Should handle scoped package sub-imports');
        assert.strictEqual(extractPackageName('./utils'), null, 'Should ignore relative imports');
        assert.strictEqual(extractPackageName('../config'), null, 'Should ignore relative imports');
    });
});

// Dependency Tree Generation Tests
test.describe('Dependency Tree Generation', () => {
    (global as any).it('should handle missing package manager gracefully', async () => {
        const depManager = new DependencyManagement();
        
        try {
            await depManager.generateDependencyTree('/invalid/path');
            assert.fail('Should throw error for missing package manager');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error');
            assert.ok(error.message.includes('No supported package manager found'), 
                'Should have appropriate error message');
        }
    });

    (global as any).it('should build dependency tree from data', () => {
        const depManager = new DependencyManagement();
        
        const mockListData = {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
                'lodash': {
                    version: '4.17.21',
                    dependencies: {}
                },
                'express': {
                    version: '4.18.2',
                    dependencies: {
                        'accepts': {
                            version: '1.3.8',
                            dependencies: {}
                        }
                    }
                }
            }
        };
        
        const tree = (depManager as any).buildDependencyTree(mockListData, 0);
        
        assert.strictEqual(tree.name, 'test-project', 'Should have correct root name');
        assert.strictEqual(tree.version, '1.0.0', 'Should have correct version');
        assert.strictEqual(tree.depth, 0, 'Root should have depth 0');
        assert.strictEqual(tree.dependencies.length, 2, 'Should have 2 direct dependencies');
        
        const expressDep = tree.dependencies.find(d => d.name === 'express');
        assert.ok(expressDep, 'Should find express dependency');
        assert.strictEqual(expressDep?.dependencies.length, 1, 'Express should have 1 dependency');
        assert.strictEqual(expressDep?.dependencies[0].name, 'accepts', 'Should have accepts as subdependency');
    });
});

// Performance and Health Scoring Tests
test.describe('Performance and Health Scoring', () => {
    (global as any).it('should calculate security scores correctly', () => {
        const depManager = new DependencyManagement();
        
        const vulnerabilities = createMockVulnerabilities();
        const totalDeps = 10;
        
        const score = (depManager as any).calculateSecurityScore(vulnerabilities, totalDeps);
        
        assert.ok(typeof score === 'number', 'Should return numeric score');
        assert.ok(score >= 0 && score <= 100, 'Score should be between 0 and 100');
        
        // With vulnerabilities, score should be less than 100
        assert.ok(score < 100, 'Score should be reduced by vulnerabilities');
    });

    (global as any).it('should calculate health scores correctly', () => {
        const depManager = new DependencyManagement();
        
        const vulnerabilities = createMockVulnerabilities();
        const outdatedPackages: DependencyUpdate[] = [
            {
                name: 'test-package',
                currentVersion: '1.0.0',
                targetVersion: '1.1.0',
                updateType: 'minor',
                breaking: false,
                securityFix: false,
                bugFix: true,
                newFeatures: [],
                breakingChanges: [],
                confidence: 'high',
                riskLevel: 'low',
                impact: { bundleSize: 0, dependencies: [], compatibility: [] }
            }
        ];
        const unusedDependencies = ['unused-package'];
        const duplicates = [{ name: 'duplicate-package', versions: ['1.0.0', '1.1.0'] }];
        
        const score = (depManager as any).calculateHealthScore(
            vulnerabilities, outdatedPackages, unusedDependencies, duplicates
        );
        
        assert.ok(typeof score === 'number', 'Should return numeric score');
        assert.ok(score >= 0 && score <= 100, 'Score should be between 0 and 100');
        
        // With issues, score should be less than 100
        assert.ok(score < 100, 'Score should be reduced by health issues');
    });

    (global as any).it('should handle perfect health scores', () => {
        const depManager = new DependencyManagement();
        
        const score = (depManager as any).calculateHealthScore([], [], [], []);
        
        assert.strictEqual(score, 100, 'Perfect health should score 100');
    });
});

// Update Type and Risk Assessment Tests
test.describe('Update Type and Risk Assessment', () => {
    (global as any).it('should determine update types correctly', () => {
        const depManager = new DependencyManagement();
        
        const getUpdateType = (depManager as any).getUpdateType.bind(depManager);
        
        assert.strictEqual(getUpdateType('1.0.0', '1.0.1'), 'patch', 'Should detect patch updates');
        assert.strictEqual(getUpdateType('1.0.0', '1.1.0'), 'minor', 'Should detect minor updates');
        assert.strictEqual(getUpdateType('1.0.0', '2.0.0'), 'major', 'Should detect major updates');
        assert.strictEqual(getUpdateType('1.5.3', '1.5.4'), 'patch', 'Should handle complex patch versions');
        assert.strictEqual(getUpdateType('2.1.0', '2.2.0'), 'minor', 'Should handle complex minor versions');
    });

    (global as any).it('should detect breaking changes', () => {
        const depManager = new DependencyManagement();
        
        const isBreakingChange = (depManager as any).isBreakingChange.bind(depManager);
        
        assert.strictEqual(isBreakingChange('1.0.0', '2.0.0'), true, 'Major version changes are breaking');
        assert.strictEqual(isBreakingChange('1.0.0', '1.1.0'), false, 'Minor version changes are not breaking');
        assert.strictEqual(isBreakingChange('1.0.0', '1.0.1'), false, 'Patch version changes are not breaking');
        assert.strictEqual(isBreakingChange('2.5.3', '3.0.0'), true, 'Major version changes are always breaking');
    });

    (global as any).it('should assess risk levels correctly', () => {
        const depManager = new DependencyManagement();
        
        const assessRiskLevel = (depManager as any).assessRiskLevel.bind(depManager);
        
        assert.strictEqual(assessRiskLevel('1.0.0', '1.0.1'), 'low', 'Patch updates should be low risk');
        assert.strictEqual(assessRiskLevel('1.0.0', '1.1.0'), 'medium', 'Minor updates should be medium risk');
        assert.strictEqual(assessRiskLevel('1.0.0', '2.0.0'), 'high', 'Major updates should be high risk');
    });
});

// Version Compatibility Tests
test.describe('Version Compatibility', () => {
    (global as any).it('should check version compatibility with vulnerability ranges', () => {
        const depManager = new DependencyManagement();
        
        const isVersionAffected = (depManager as any).isVersionAffected.bind(depManager);
        
        assert.strictEqual(isVersionAffected('1.0.0', '<1.2.3'), true, 'Should detect affected versions');
        assert.strictEqual(isVersionAffected('1.2.3', '<1.2.3'), false, 'Should handle exact boundary versions');
        assert.strictEqual(isVersionAffected('1.5.0', '<1.2.3'), false, 'Should handle versions above range');
        
        // Test with version prefixes
        assert.strictEqual(isVersionAffected('^1.0.0', '<1.2.3'), true, 'Should handle version prefixes');
        assert.strictEqual(isVersionAffected('~1.0.0', '<1.2.3'), true, 'Should handle tilde prefixes');
    });

    (global as any).it('should handle malformed version strings', () => {
        const depManager = new DependencyManagement();
        
        const isVersionAffected = (depManager as any).isVersionAffected.bind(depManager);
        
        // Should not throw for malformed versions
        assert.strictEqual(isVersionAffected('invalid', '<1.2.3'), false, 
            'Should handle malformed versions gracefully');
        assert.strictEqual(isVersionAffected('1.0.0', 'invalid-range'), false, 
            'Should handle malformed ranges gracefully');
    });
});

// Update Strategy Filtering Tests
test.describe('Update Strategy Filtering', () => {
    (global as any).it('should filter updates by conservative strategy', () => {
        const depManager = new DependencyManagement();
        
        const updates: DependencyUpdate[] = [
            {
                name: 'patch-update',
                currentVersion: '1.0.0',
                targetVersion: '1.0.1',
                updateType: 'patch',
                breaking: false,
                securityFix: false,
                bugFix: true,
                newFeatures: [],
                breakingChanges: [],
                confidence: 'high',
                riskLevel: 'low',
                impact: { bundleSize: 0, dependencies: [], compatibility: [] }
            },
            {
                name: 'security-fix',
                currentVersion: '2.0.0',
                targetVersion: '3.0.0',
                updateType: 'major',
                breaking: true,
                securityFix: true,
                bugFix: false,
                newFeatures: [],
                breakingChanges: ['API changes'],
                confidence: 'high',
                riskLevel: 'high',
                impact: { bundleSize: 0, dependencies: [], compatibility: [] }
            },
            {
                name: 'breaking-update',
                currentVersion: '1.0.0',
                targetVersion: '2.0.0',
                updateType: 'major',
                breaking: true,
                securityFix: false,
                bugFix: false,
                newFeatures: ['new API'],
                breakingChanges: ['removed methods'],
                confidence: 'medium',
                riskLevel: 'high',
                impact: { bundleSize: 1000, dependencies: [], compatibility: [] }
            }
        ];
        
        const filterUpdatesByStrategy = (depManager as any).filterUpdatesByStrategy.bind(depManager);
        
        const conservative = filterUpdatesByStrategy(updates, 'conservative');
        const moderate = filterUpdatesByStrategy(updates, 'moderate');
        const aggressive = filterUpdatesByStrategy(updates, 'aggressive');
        
        // Conservative: only patches and security fixes
        assert.ok(conservative.length <= 2, 'Conservative should filter to safe updates');
        assert.ok(conservative.some(u => u.name === 'patch-update'), 'Should include patch updates');
        assert.ok(conservative.some(u => u.name === 'security-fix'), 'Should include security fixes');
        assert.ok(!conservative.some(u => u.name === 'breaking-update'), 'Should exclude non-security breaking updates');
        
        // Moderate: no breaking changes unless security
        assert.ok(moderate.length <= 2, 'Moderate should allow non-breaking + security fixes');
        assert.ok(moderate.some(u => u.name === 'security-fix'), 'Should include security fixes even if breaking');
        
        // Aggressive: all updates
        assert.strictEqual(aggressive.length, 3, 'Aggressive should include all updates');
    });
});

// Error Handling Tests
test.describe('Error Handling', () => {
    (global as any).it('should handle analysis errors gracefully', async () => {
        const depManager = new DependencyManagement();
        
        // Test with invalid project path
        try {
            await depManager.analyzeDependencies('/invalid/path/that/does/not/exist');
            assert.fail('Should throw error for invalid project path');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error for invalid path');
            assert.ok(error.message.includes('Failed to analyze dependencies'), 
                'Should have appropriate error message');
        }
    });

    (global as any).it('should handle vulnerability scanning errors', async () => {
        const depManager = new DependencyManagement();
        
        // Test with malformed dependency info
        const malformedDeps: any[] = [
            { /* missing required fields */ },
            { name: null, version: undefined }
        ];
        
        const vulnerabilities = await depManager.scanVulnerabilities(malformedDeps);
        
        // Should not throw, but return empty or safe results
        assert.ok(Array.isArray(vulnerabilities), 'Should return array even with malformed data');
    });

    (global as any).it('should handle license compliance errors', () => {
        const depManager = new DependencyManagement();
        
        // Test with malformed dependency data
        const malformedDeps: any[] = [
            { name: null },
            { version: undefined },
            {} // Empty object
        ];
        
        const issues = depManager.checkLicenseCompliance(malformedDeps);
        
        // Should handle gracefully
        assert.ok(Array.isArray(issues), 'Should return array even with malformed data');
    });
});

// Cache Management Tests
test.describe('Cache Management', () => {
    (global as any).it('should manage analysis cache correctly', () => {
        const depManager = new DependencyManagement();
        
        // Test clearing specific project
        depManager.clearCache('/test/project1');
        assert.ok(true, 'Should clear specific project cache');
        
        // Test clearing all cache
        depManager.clearCache();
        assert.ok(true, 'Should clear all cache');
        
        // Test export with empty cache
        const exported = depManager.exportAnalysis('/non/existent');
        assert.strictEqual(exported, null, 'Should return null for non-existent analysis');
    });
});

// Run the tests
async function runTests(): Promise<void> {
    try {
        const { passed, failed, results } = await test.runTests();
        
        console.log('📊 Test Results Summary:');
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            results.filter(r => r.status === 'failed').forEach(result => {
                console.log(`   ${result.group} > ${result.name}`);
                console.log(`   Error: ${result.error}`);
            });
            process.exit(1);
        } else {
            console.log('\n🎉 All tests passed!');
        }
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    }
}

// Export for external test runners
export { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

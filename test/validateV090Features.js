/**
 * v0.9.0 Professional Features Validation Script
 * 
 * Validates all v0.9.0 Professional Features:
 * - Advanced Formatting Engine
 * - Code Style Enforcement  
 * - Performance Profiling
 * - Dependency Management
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Validating v0.9.0 Professional Features...\n');

// Feature validation results
const validationResults = {
    passed: 0,
    failed: 0,
    features: []
};

/**
 * Validate a feature by checking file existence and basic structure
 */
function validateFeature(featureName, filePath, requiredExports = []) {
    console.log(`📋 Validating ${featureName}...`);
    
    const result = {
        name: featureName,
        path: filePath,
        exists: false,
        hasRequiredExports: false,
        size: 0,
        issues: []
    };

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            result.issues.push('File does not exist');
            validationResults.failed++;
            console.log(`   ❌ File not found: ${filePath}`);
            validationResults.features.push(result);
            return result;
        }

        result.exists = true;
        
        // Get file size
        const stats = fs.statSync(filePath);
        result.size = stats.size;
        console.log(`   📁 File size: ${(result.size / 1024).toFixed(1)} KB`);

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for required exports/classes
        let hasAllExports = true;
        for (const exportName of requiredExports) {
            if (!content.includes(exportName)) {
                result.issues.push(`Missing required export/class: ${exportName}`);
                hasAllExports = false;
            }
        }
        
        result.hasRequiredExports = hasAllExports;
        
        // Check for comprehensive implementation
        const lines = content.split('\n').length;
        console.log(`   📄 Lines of code: ${lines}`);
        
        if (lines < 100) {
            result.issues.push('Implementation appears too small (< 100 lines)');
        }
        
        // Check for proper TypeScript types
        if (!content.includes('interface ') && !content.includes('type ')) {
            result.issues.push('Missing TypeScript type definitions');
        }
        
        // Check for error handling
        if (!content.includes('try') && !content.includes('catch')) {
            result.issues.push('No error handling detected');
        }
        
        // Check for documentation
        if (!content.includes('/**')) {
            result.issues.push('Missing JSDoc documentation');
        }

        if (result.issues.length === 0) {
            validationResults.passed++;
            console.log(`   ✅ ${featureName} validation passed`);
        } else {
            validationResults.failed++;
            console.log(`   ❌ ${featureName} validation failed:`);
            result.issues.forEach(issue => console.log(`      - ${issue}`));
        }

    } catch (error) {
        result.issues.push(`Validation error: ${error.message}`);
        validationResults.failed++;
        console.log(`   ❌ Validation error: ${error.message}`);
    }

    validationResults.features.push(result);
    console.log('');
    return result;
}

/**
 * Validate test file
 */
function validateTestFile(featureName, testFilePath, requiredTestGroups = []) {
    console.log(`🧪 Validating ${featureName} Tests...`);
    
    const result = {
        name: `${featureName} Tests`,
        path: testFilePath,
        exists: false,
        hasTestGroups: false,
        testCount: 0,
        issues: []
    };

    try {
        if (!fs.existsSync(testFilePath)) {
            result.issues.push('Test file does not exist');
            validationResults.failed++;
            console.log(`   ❌ Test file not found: ${testFilePath}`);
            validationResults.features.push(result);
            return result;
        }

        result.exists = true;
        
        const content = fs.readFileSync(testFilePath, 'utf8');
        
        // Count test cases
        const testMatches = content.match(/it\(/g);
        result.testCount = testMatches ? testMatches.length : 0;
        console.log(`   🧪 Test cases: ${result.testCount}`);
        
        // Check for required test groups
        let hasAllGroups = true;
        for (const group of requiredTestGroups) {
            if (!content.includes(`describe('${group}'`)) {
                result.issues.push(`Missing test group: ${group}`);
                hasAllGroups = false;
            }
        }
        
        result.hasTestGroups = hasAllGroups;
        
        // Check for comprehensive testing
        if (result.testCount < 10) {
            result.issues.push('Insufficient test coverage (< 10 test cases)');
        }
        
        // Check for async test handling
        if (!content.includes('async ') && !content.includes('await ')) {
            result.issues.push('No async test handling detected');
        }
        
        // Check for test framework
        if (!content.includes('assert')) {
            result.issues.push('No assertions detected');
        }

        if (result.issues.length === 0) {
            validationResults.passed++;
            console.log(`   ✅ ${featureName} test validation passed`);
        } else {
            validationResults.failed++;
            console.log(`   ❌ ${featureName} test validation failed:`);
            result.issues.forEach(issue => console.log(`      - ${issue}`));
        }

    } catch (error) {
        result.issues.push(`Test validation error: ${error.message}`);
        validationResults.failed++;
        console.log(`   ❌ Test validation error: ${error.message}`);
    }

    validationResults.features.push(result);
    console.log('');
    return result;
}

// Validate Advanced Formatting Engine
validateFeature(
    'Advanced Formatting Engine',
    'src/formatting/AdvancedFormattingEngine.ts',
    ['AdvancedFormattingEngine', 'FormattingRule', 'FormattingProfile', 'FormattingContext', 'FormattingResult']
);

validateTestFile(
    'Advanced Formatting Engine',
    'test/unit/AdvancedFormattingEngine.unit.test.ts',
    ['Core Formatting Engine', 'TypeScript/JavaScript Formatting', 'Python Formatting', 'Performance and Metrics']
);

// Validate Code Style Enforcement
validateFeature(
    'Code Style Enforcement',
    'src/styleguide/CodeStyleEnforcement.ts',
    ['CodeStyleEnforcement', 'StyleRule', 'StyleGuide', 'StyleViolation', 'TeamStyleConfig']
);

validateTestFile(
    'Code Style Enforcement',
    'test/unit/CodeStyleEnforcement.unit.test.ts',
    ['Core Style Enforcement', 'TypeScript/JavaScript Style Checking', 'Auto-fixing Capabilities', 'Style Guide Integration']
);

// Validate Performance Profiling
validateFeature(
    'Performance Profiling',
    'src/profiling/PerformanceProfiling.ts',
    ['PerformanceProfiling', 'PerformanceMetric', 'PerformanceProfile', 'PerformanceBenchmark']
);

validateTestFile(
    'Performance Profiling',
    'test/unit/PerformanceProfiling.unit.test.ts',
    ['Core Performance Profiling', 'Metric Recording', 'Execution Measurement', 'Benchmarking']
);

// Validate Dependency Management
validateFeature(
    'Dependency Management',
    'src/dependencies/DependencyManagement.ts',
    ['DependencyManagement', 'DependencyInfo', 'SecurityVulnerability', 'DependencyUpdate', 'DependencyAnalysis']
);

validateTestFile(
    'Dependency Management',
    'test/unit/DependencyManagement.unit.test.ts',
    ['Core Dependency Management', 'Vulnerability Scanning', 'License Compliance', 'Update Management']
);

// Validate directory structure
console.log('📁 Validating v0.9.0 Directory Structure...');

const requiredDirectories = [
    'src/formatting',
    'src/styleguide', 
    'src/profiling',
    'src/dependencies'
];

let structureValid = true;
for (const dir of requiredDirectories) {
    if (!fs.existsSync(dir)) {
        console.log(`   ❌ Missing directory: ${dir}`);
        structureValid = false;
        validationResults.failed++;
    } else {
        console.log(`   ✅ Directory exists: ${dir}`);
    }
}

if (structureValid) {
    console.log(`   ✅ Directory structure validation passed`);
    validationResults.passed++;
} else {
    console.log(`   ❌ Directory structure validation failed`);
}

console.log('');

// Check for comprehensive feature integration
console.log('🔗 Validating Feature Integration...');

const integrationChecks = [
    {
        name: 'TypeScript Configuration',
        check: () => fs.existsSync('tsconfig.json'),
        message: 'TypeScript configuration file exists'
    },
    {
        name: 'Package Dependencies',
        check: () => {
            if (!fs.existsSync('package.json')) return false;
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return pkg.devDependencies && pkg.devDependencies['typescript'];
        },
        message: 'TypeScript dependency configured'
    },
    {
        name: 'Test Infrastructure',
        check: () => fs.existsSync('test/unit'),
        message: 'Unit test directory exists'
    },
    {
        name: 'Documentation Structure',
        check: () => fs.existsSync('docs'),
        message: 'Documentation directory exists'
    }
];

let integrationPassed = 0;
for (const check of integrationChecks) {
    if (check.check()) {
        console.log(`   ✅ ${check.message}`);
        integrationPassed++;
    } else {
        console.log(`   ❌ ${check.message}`);
    }
}

if (integrationPassed === integrationChecks.length) {
    validationResults.passed++;
    console.log(`   ✅ Feature integration validation passed`);
} else {
    validationResults.failed++;
    console.log(`   ❌ Feature integration validation failed`);
}

console.log('');

// Generate validation report
console.log('📊 v0.9.0 Features Validation Report');
console.log('=====================================');
console.log(`✅ Passed: ${validationResults.passed}`);
console.log(`❌ Failed: ${validationResults.failed}`);
console.log(`📈 Success Rate: ${((validationResults.passed / (validationResults.passed + validationResults.failed)) * 100).toFixed(1)}%`);

// Calculate total code metrics
let totalLines = 0;
let totalSize = 0;
let totalTests = 0;

validationResults.features.forEach(feature => {
    if (feature.size) {
        totalSize += feature.size;
    }
    if (feature.testCount) {
        totalTests += feature.testCount;
    }
});

console.log('\n📈 Code Metrics:');
console.log(`   📦 Total Size: ${(totalSize / 1024).toFixed(1)} KB`);
console.log(`   🧪 Total Tests: ${totalTests}`);

// Feature summary
console.log('\n🎯 Feature Summary:');
validationResults.features.forEach(feature => {
    const status = feature.issues.length === 0 ? '✅' : '❌';
    console.log(`   ${status} ${feature.name}`);
    if (feature.issues.length > 0) {
        feature.issues.forEach(issue => console.log(`      - ${issue}`));
    }
});

console.log('\n🎉 v0.9.0 Professional Features Validation Complete!');

// Exit with appropriate code
if (validationResults.failed > 0) {
    console.log('\n❌ Some validations failed. Please review and fix the issues above.');
    process.exit(1);
} else {
    console.log('\n✨ All v0.9.0 features successfully validated!');
    
    console.log('\n🚀 v0.9.0 Professional Features Include:');
    console.log('   🎨 Advanced Formatting Engine - Context-aware code formatting');
    console.log('   📏 Code Style Enforcement - Automated style guide compliance');
    console.log('   ⚡ Performance Profiling - Real-time performance analysis');
    console.log('   📦 Dependency Management - Smart package updates and vulnerability checks');
    
    process.exit(0);
}

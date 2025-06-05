/**
 * Simple test runner for v0.7.0 features
 * Runs the self-contained unit tests without external dependencies
 */

const fs = require('fs');
const path = require('path');

async function runTest(testFilePath, testName) {
    console.log(`\n🧪 Running ${testName}...`);
    
    try {
        // Read the test file
        const testContent = fs.readFileSync(testFilePath, 'utf8');
        
        // Create a simple eval context with console access
        const testContext = {
            console,
            Date,
            Map,
            Array,
            JSON,
            Math,
            RegExp,
            Error,
            Promise
        };
        
        // Run the test in isolated context
        const testFunction = new Function(...Object.keys(testContext), testContent);
        await testFunction(...Object.values(testContext));
        
        console.log(`✅ ${testName} completed successfully`);
        return true;
    } catch (error) {
        console.log(`❌ ${testName} failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 Cuovare v0.7.0 Feature Test Suite');
    console.log('=====================================');
    
    const testDir = path.join(__dirname, 'unit');
    const testFiles = [
        {
            file: path.join(testDir, 'AdvancedContextFilter.unit.test.ts'),
            name: 'Advanced Context Filtering'
        },
        {
            file: path.join(testDir, 'CodeSnippetsLibrary.unit.test.ts'), 
            name: 'Code Snippets Library'
        },
        {
            file: path.join(testDir, 'FileTreeManipulator.unit.test.ts'),
            name: 'File Tree Manipulation'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of testFiles) {
        if (fs.existsSync(test.file)) {
            const success = await runTest(test.file, test.name);
            if (success) {
                passed++;
            } else {
                failed++;
            }
        } else {
            console.log(`⚠️  Test file not found: ${test.file}`);
            failed++;
        }
    }
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${passed + failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 All v0.7.0 feature tests passed!');
        console.log('Advanced Context Awareness System is fully validated.');
        process.exit(0);
    } else {
        console.log(`\n💥 ${failed} test(s) failed. Please check the implementation.`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runTest, main };

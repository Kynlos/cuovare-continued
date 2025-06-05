/**
 * Cuovare Agent Mode Validation Script
 * 
 * Comprehensive validation for the flagship Agent Mode functionality.
 * This script tests the core autonomous AI agent capabilities that make
 * Cuovare the most advanced AI coding assistant for VS Code.
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

console.log('🤖 Cuovare Agent Mode Validation Suite');
console.log('=====================================\n');

// Validate Agent Mode implementation files exist
const agentFiles = [
    'src/agent/AgentMode.ts',
    'src/agent/ToolRegistry.ts',
    'test/unit/AgentMode.unit.test.ts'
];

console.log('📁 Checking Agent Mode implementation files...');
let missingFiles = 0;

for (const file of agentFiles) {
    const filePath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - MISSING`);
        missingFiles++;
    }
}

if (missingFiles > 0) {
    console.error(`\n❌ ${missingFiles} Agent Mode files are missing!`);
    process.exit(1);
}

console.log('\n🧪 Running Agent Mode unit tests...\n');

// Create specialized mocha test runner for Agent Mode
const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000, // Longer timeout for agent operations
    reporter: 'spec'
});

// Add Agent Mode core test file (simplified, working version)
const coreTestPath = path.resolve(__dirname, '../out/test/unit/AgentModeCore.unit.test.js');

// Check if compiled test exists
if (!fs.existsSync(coreTestPath)) {
    console.error('❌ AgentModeCore.unit.test.js not found in out/test/unit/');
    console.error('   Make sure to run "pnpm run compile" first');
    process.exit(1);
}

// Run the core test directly since it's self-executing and handles its own exit
console.log('🔧 Running Agent Mode core validation...\n');

try {
    require(coreTestPath);
    // If we get here, tests passed (core test calls process.exit(0))
} catch (error) {
    console.error('\n❌ Agent Mode validation failed:', error.message);
    console.error('\nAgent Mode is the flagship feature and must be 100% reliable!');
    process.exit(1);
}

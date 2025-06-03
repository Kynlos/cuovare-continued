import * as path from 'path';
import { glob } from 'glob';

const Mocha = require('mocha');

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000 // 10 second timeout for tests
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((resolve, reject) => {
        const testFiles = glob.sync('**/**.test.js', { cwd: testsRoot });

        // Add files to the test suite
        testFiles.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        try {
            // Run the mocha test
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

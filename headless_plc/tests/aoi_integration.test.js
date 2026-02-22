
import { describe, it, expect, AOITestKit } from './test-helper.js';
import { parseRungs } from '../aoi/parsers/rungs-parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadAndParse(filename) {
    const filePath = path.resolve('headless_plc/tests/data', filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseRungs(content);
    if (result.diagnostics.some(d => d.type === 'error')) {
        throw new Error(`Parse error in ${filename}: ${JSON.stringify(result.diagnostics)}`);
    }
    return result.aoi;
}

const rungsFiles = [
    'MotorControl_ST.rungs',
    'TrafficLight_ST.rungs',
    'TankLevel_ST.rungs',
    'Cylinder_ST.rungs',
    'FBD_TIMER.rungs',
    'FBD_COUNTER.rungs',
    'CASE_OF.rungs',
    'FOR_DO.rungs',
    'IF_THEN.rungs',
    'REPEAT_UNTIL.rungs',
    'WHILE_DO.rungs',
    'CONTACTS_COILS.rungs',
    'TIMER.rungs',
    'COUNTER.rungs',
    'MATH.rungs',
    'COMPARE.rungs'
];

describe('AOI Integration Tests (Dynamic Execution)', () => {
    rungsFiles.forEach(filename => {
        // We wrap each file in a describe block so failures don't stop the whole suite if handled correctly
        describe(`Testing ${filename}`, () => {
            const aoi = loadAndParse(filename);

            if (!aoi.testing || !aoi.testing.content) {
                console.warn(`No testing content found for ${filename}`);
                return;
            }

            // Create a Mock AOITestKit that acts like the static class expected by the test scripts
            const MockAOITestKit = {
                run: (inputs) => {
                    const kit = new AOITestKit(aoi);
                    return kit.run(inputs);
                }
            };

            // Prepare the test execution function
            try {
                // The test content assumes 'describe', 'it', 'expect', 'AOITestKit' are in scope.
                const runTests = new Function(
                    'describe',
                    'it',
                    'expect',
                    'AOITestKit',
                    aoi.testing.content
                );

                // Execute the tests
                runTests(describe, it, expect, MockAOITestKit);
            } catch (e) {
                console.error(`Error executing tests for ${filename}:`, e);
                throw e;
            }
        });
    });
});


import { describe, it, expect, AOITestKit } from './test-helper.js';
import { parseRungs } from '../aoi/parsers/rungs-parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// This test file manually replicates the test expectations found in the .rungs files
// to ensure the parser correctly loads the AOI and the logic executes as defined.

function loadAndParse(filename) {
    const filePath = path.resolve('headless_plc/tests/data', filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseRungs(content);
    if (result.diagnostics.some(d => d.type === 'error')) {
        throw new Error(`Parse error in ${filename}: ${JSON.stringify(result.diagnostics)}`);
    }
    return result.aoi;
}

describe('AOI Integration Tests (Rungs Parsing + Logic)', () => {

    describe('MotorControl_ST.rungs', () => {
        const aoi = loadAndParse('MotorControl_ST.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('latches run on start', () => {
            const outputs = run({ StartButton: 1 });
            expect(outputs.MotorRun).toBe(1);
            expect(outputs.FaultActive).toBe(0);
        });
    });

    describe('TrafficLight_ST.rungs', () => {
        const aoi = loadAndParse('TrafficLight_ST.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('starts yellow phase on walk request', () => {
            const outputs = run({ WalkRequest: 1 });
            expect(outputs.YellowLight).toBe(1);
        });
    });

    describe('TankLevel_ST.rungs', () => {
        const aoi = loadAndParse('TankLevel_ST.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('increases level when fill command is active', () => {
            const outputs = run({ FillCmd: 1, Level: 50 });
            expect(outputs.Level).toBeGreaterThan(50);
        });
    });

    describe('FBD_TIMER.rungs', () => {
        const aoi = loadAndParse('FBD_TIMER.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('provides timer outputs', () => {
            const outputs = run({});
            expect(typeof outputs.TimerAcc).toBe('number');
        });
    });

    describe('CASE_OF.rungs', () => {
        const aoi = loadAndParse('CASE_OF.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('routes correct valves for batch 1', () => {
            const outputs = run({ batchSelector: 1 });
            expect(outputs.zonePelletDischarge).toBe(1);
        });
    });

    // Testing LD files loaded via Rungs parser
    describe('CONTACTS_COILS.rungs', () => {
        const aoi = loadAndParse('CONTACTS_COILS.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('series logic works', () => {
            expect(run({ InputA: 1, InputB: 1 }).SeriesResult).toBe(1);
            expect(run({ InputA: 1, InputB: 0 }).SeriesResult).toBe(0);
        });
    });

    describe('MATH.rungs', () => {
        const aoi = loadAndParse('MATH.rungs');
        const kit = new AOITestKit(aoi);
        const run = (inputs) => kit.run(inputs).outputs;

        it('computes math correctly', () => {
             const outputs = run({ ValueA: 10, ValueB: 2 });
             expect(outputs.Product).toBe(20);
        });
    });
});

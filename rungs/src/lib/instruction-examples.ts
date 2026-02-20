import { AOIDefinitionSchema, type AOIDefinition } from '@repo/plc-core';
import type { z } from 'zod/v4';

type AOIDefinitionInput = z.input<typeof AOIDefinitionSchema>;

const BASE_TIMESTAMP = '2024-01-01T00:00:00.000Z';

const timerDefinition = {
  name: 'FBD_TIMER',
  description: 'Timer On Delay instruction',
  tags: [
    {
      name: 'Tmr_Generator',
      dataType: 'FBD_TIMER',
      usage: 'local',
      description: 'Timer structure for the TONR instruction',
      defaultValue: {
        EnableIn: 1,
        TimerEnable: 0,
        PRE: 0,
        Reset: 0,
        EnableOut: 0,
        ACC: 0,
        EN: 0,
        TT: 0,
        DN: 0,
        Status: 0,
        InstructFault: 0,
        PresetInv: 0,
      },
    },
    {
      name: 'TimerAcc',
      dataType: 'DINT',
      usage: 'output',
      description: 'Current accumulated timer value in milliseconds',
      defaultValue: 0,
    },
    {
      name: 'Output',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Output coil driven when the timer completes',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Configure the timer preset and enable logic.
Tmr_Generator.PRE := 2000;
Tmr_Generator.TimerEnable := 1;
Tmr_Generator.Reset := Tmr_Generator.DN; // Reset the timer when done so the cycle repeats.
TONR(Tmr_Generator);

// Surface the accumulated value and drive the output when the timer crosses the threshold.
TimerAcc := Tmr_Generator.ACC;
Output := Tmr_Generator.ACC > 500; // Assert the output once 500 ms has elapsed.`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.265Z',
    modified: '2025-10-17T15:57:56.265Z',
  },
  testing: {
    content: `describe('FBD_TIMER AOI', () => {
  it('provides timer outputs with default inputs', () => {
    const { outputs } = AOITestKit.run();
    expect(typeof outputs.TimerAcc).toBe('number');
    expect(outputs.Output === 0 || outputs.Output === 1).toBe(true);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const counterDefinition = {
  name: 'FBD_COUNTER',
  description: '',
  tags: [
    {
      name: 'CTUD_01',
      dataType: 'FBD_COUNTER',
      usage: 'local',
      description: 'CTUD instruction state block',
      defaultValue: {
        EnableIn: 1,
        CUEnable: 0,
        CDEnable: 0,
        PRE: 0,
        Reset: 0,
        EnableOut: 0,
        ACC: 0,
        CU: 0,
        CD: 0,
        DN: 0,
        OV: 0,
        UN: 0,
      },
    },
    {
      name: 'counter_state',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Done bit indicating the preset has been reached',
      defaultValue: 0,
    },
    {
      name: 'CounterAcc',
      dataType: 'DINT',
      usage: 'output',
      description: 'Current accumulated count from the CTUD instruction',
      defaultValue: 0,
    },
    {
      name: 'Reset',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Resets the counter back to zero when asserted',
      defaultValue: 0,
    },
    {
      name: 'CountUp',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Requests the counter to increment',
      defaultValue: 0,
    },
    {
      name: 'CountDown',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Requests the counter to decrement',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Latch preset and gate the up/down enables for the CTUD block.
CTUD_01.PRE := 5;
CTUD_01.Reset := Reset;
CTUD_01.CUEnable := CountUp;
CTUD_01.CDEnable := CountDown;
CTUD(CTUD_01);

// Expose the accumulator and done state as AOI outputs.
CounterAcc := CTUD_01.ACC;
counter_state := CTUD_01.DN;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.274Z',
    modified: '2025-10-17T15:57:56.274Z',
  },
  testing: {
    content: `const runCounter = (inputs) => AOITestKit.run(inputs).outputs;

describe('FBD_COUNTER AOI', () => {
  it('increments the accumulator when CountUp is asserted', () => {
    const outputs = runCounter({ CountUp: 1 });
    expect(outputs.CounterAcc).toBe(1);
    expect(outputs.counter_state).toBe(0);
  });

  it('clears the accumulator when Reset is asserted', () => {
    const outputs = runCounter({ Reset: 1, CountUp: 1 });
    expect(outputs.CounterAcc).toBe(0);
    expect(outputs.counter_state).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const caseOfDefinition = {
  name: 'CASE_OF',
  description: '',
  tags: [
    {
      name: 'zonePelletDischarge',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Energizes the pellet discharge valve',
      defaultValue: 0,
    },
    {
      name: 'zoneSyrupDischarge',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Energizes the syrup discharge valve',
      defaultValue: 0,
    },
    {
      name: 'zonePelletBypass',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Energizes the pellet bypass valve',
      defaultValue: 0,
    },
    {
      name: 'zoneSyrupRecirculation',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Energizes the syrup recirculation valve',
      defaultValue: 0,
    },
    {
      name: 'batchSelector',
      dataType: 'DINT',
      usage: 'input',
      description: 'Integer batch code that drives valve routing',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Select valve combinations based on the batch selector.
CASE batchSelector OF
  1:
    // Default batch sends pellets and syrup through the main discharge path.
    zonePelletDischarge := 1;
    zoneSyrupDischarge := 1;

  2..4:
    // Alternate batches push pellets through the bypass and syrup to recirculation.
    zonePelletBypass := 1;
    zoneSyrupRecirculation := 1;

  5..8:
    // Mid-range batches reuse the alternate routing with the same valve pair.
    zonePelletBypass := 1;
    zoneSyrupRecirculation := 1;

  9, 12..14:
    // Higher batches return to the main discharge valves.
    zonePelletDischarge := 1;
    zoneSyrupDischarge := 1;

ELSE
    // Default condition de-energizes all valves.
    zonePelletDischarge := 0;
    zonePelletBypass := 0;
    zoneSyrupRecirculation := 0;
    zoneSyrupDischarge := 0;

END_CASE;
`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.274Z',
    modified: '2025-10-17T15:57:56.274Z',
  },
  testing: {
    content: `const executeCase = (batchSelector) =>
  AOITestKit.run({ batchSelector }).outputs;

describe('CASE_OF AOI', () => {
  it('energizes main discharge valves for batch 1', () => {
    const outputs = executeCase(1);
    expect(outputs.zonePelletDischarge).toBe(1);
    expect(outputs.zoneSyrupDischarge).toBe(1);
    expect(outputs.zonePelletBypass).toBe(0);
    expect(outputs.zoneSyrupRecirculation).toBe(0);
  });

  it('routes through bypass for batches 2-4', () => {
    const outputs = executeCase(3);
    expect(outputs.zonePelletBypass).toBe(1);
    expect(outputs.zoneSyrupRecirculation).toBe(1);
    expect(outputs.zonePelletDischarge).toBe(0);
    expect(outputs.zoneSyrupDischarge).toBe(0);
  });

  it('turns all valves off for unknown batches', () => {
    const outputs = executeCase(42);
    expect(outputs.zonePelletDischarge).toBe(0);
    expect(outputs.zoneSyrupDischarge).toBe(0);
    expect(outputs.zonePelletBypass).toBe(0);
    expect(outputs.zoneSyrupRecirculation).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const forDoDefinition = {
  name: 'FOR_DO',
  description: '',
  tags: [
    {
      name: 'arrayIndex',
      dataType: 'DINT',
      usage: 'local',
      description: 'Loop counter used while clearing the buffer array',
      defaultValue: 0,
    },
    {
      name: 'slotIndex',
      dataType: 'DINT',
      usage: 'local',
      description: 'Index pointer while scanning storage arrays',
      defaultValue: 0,
    },
    {
      name: 'detectionFlags',
      dataType: 'BOOL',
      usage: 'local',
      description: 'Scratch array that is reset before processing each scan',
      dimension: 24,
      elements: {},
    },
    {
      name: 'scannedBarcode',
      dataType: 'DINT',
      usage: 'input',
      description: 'Barcode to locate within the storage buffers',
      defaultValue: 0,
    },
    {
      name: 'storageCount',
      dataType: 'DINT',
      usage: 'local',
      description: 'Computed number of populated storage entries',
      defaultValue: 0,
    },
    {
      name: 'locatedQuantity',
      dataType: 'DINT',
      usage: 'output',
      description: 'Quantity associated with the matched barcode',
      defaultValue: 0,
    },
    {
      name: 'storageIds',
      dataType: 'DINT',
      usage: 'local',
      description: 'Parallel array of known storage identifiers',
      dimension: 10,
      elements: {
        '0': { defaultValue: 101 },
        '1': { defaultValue: 202 },
        '2': { defaultValue: 303 },
        '3': { defaultValue: 404 },
        '4': { defaultValue: 505 },
        '5': { defaultValue: 606 },
        '6': { defaultValue: 707 },
        '7': { defaultValue: 808 },
        '8': { defaultValue: 909 },
        '9': { defaultValue: 1010 },
      },
    },
    {
      name: 'storageQty',
      dataType: 'DINT',
      usage: 'local',
      description: 'Parallel array of quantities for each storage identifier',
      dimension: 10,
      elements: {
        '0': { defaultValue: 5 },
        '1': { defaultValue: 10 },
        '2': { defaultValue: 15 },
        '3': { defaultValue: 20 },
        '4': { defaultValue: 25 },
        '5': { defaultValue: 30 },
        '6': { defaultValue: 35 },
        '7': { defaultValue: 40 },
        '8': { defaultValue: 45 },
        '9': { defaultValue: 50 },
      },
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Reset the local detection flags prior to scanning storage slots.
For arrayIndex:=0 to 23 by 1 do
  detectionFlags[arrayIndex] := 0;
End_for;

// Measure the storage structure and search for the provided barcode.
SIZE(storageIds,0,storageCount);
For slotIndex:=0 to storageCount do
  // Exit early when the barcode matches.
  If scannedBarcode = storageIds[slotIndex] then
    locatedQuantity := storageQty[slotIndex];
    Exit;
  End_if;
End_for;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.275Z',
    modified: '2025-10-17T15:57:56.275Z',
  },
  testing: {
    content: `const runLookup = (scannedBarcode) =>
  AOITestKit.run({ scannedBarcode }).outputs;

describe('FOR_DO AOI', () => {
  it('returns the quantity when a barcode is present', () => {
    const outputs = runLookup(202);
    expect(outputs.locatedQuantity).toBe(10);
  });

  it('returns zero when the barcode is not found', () => {
    const outputs = runLookup(999);
    expect(outputs.locatedQuantity).toBe(0);
  });

  it('finds the first barcode in the array', () => {
    const outputs = runLookup(101);
    expect(outputs.locatedQuantity).toBe(5);
  });

  it('finds the last barcode in the array', () => {
    const outputs = runLookup(1010);
    expect(outputs.locatedQuantity).toBe(50);
  });

  it('finds a barcode in the middle of the array', () => {
    const outputs = runLookup(505);
    expect(outputs.locatedQuantity).toBe(25);
  });

  it('returns zero for barcode value 0', () => {
    const outputs = runLookup(0);
    expect(outputs.locatedQuantity).toBe(0);
  });

  it('returns zero for negative barcode values', () => {
    const outputs = runLookup(-100);
    expect(outputs.locatedQuantity).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const ifThenDefinition = {
  name: 'IF_THEN',
  description: '',
  tags: [
    {
      name: 'rejectCount',
      dataType: 'DINT',
      usage: 'input',
      description: 'Running count of rejected units on the line',
      defaultValue: 0,
    },
    {
      name: 'conveyorEnabled',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Conveyor run command driven by the AOI logic',
      defaultValue: 0,
    },
    {
      name: 'alarmHorn',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Alarm coil signaling a fault condition',
      defaultValue: 0,
    },
    {
      name: 'forwardCommand',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Indicates the requested conveyor direction',
      defaultValue: 0,
    },
    {
      name: 'statusBeacon',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Indicator light state controlled by the AOI',
      defaultValue: 0,
    },
    {
      name: 'overloadTrip',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Overload sensor input for the conveyor drive',
      defaultValue: 0,
    },
    {
      name: 'levelLow',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Sensor indicating low sugar level',
      defaultValue: 0,
    },
    {
      name: 'levelHigh',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Sensor indicating high sugar level',
      defaultValue: 0,
    },
    {
      name: 'inletValve',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Valve command that opens the sugar inlet',
      defaultValue: 0,
    },
    {
      name: 'tankTemperature',
      dataType: 'REAL',
      usage: 'input',
      description: 'Process tank temperature reading',
      defaultValue: 0,
    },
    {
      name: 'pumpHighSpeed',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Pump command for fast speed',
      defaultValue: 0,
    },
    {
      name: 'pumpLowSpeed',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Pump command for slow speed',
      defaultValue: 0,
    },
    {
      name: 'pumpStandby',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Pump off command when neither speed is selected',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Reject threshold stops the conveyor and raises an alarm.
IF rejectCount >= 4 THEN
  conveyorEnabled := 0;
  alarmHorn := 1;
END_IF;

// Indicate conveyor direction unless overload is active.
IF forwardCommand AND NOT overloadTrip THEN
  statusBeacon := 0;
ELSE
  statusBeacon := 1;
END_IF;


// Balance sugar inlet based on low/high sensor states.
IF levelLow & levelHigh THEN
    inletValve := 1;
ELSIF NOT(levelHigh) THEN
    inletValve := 0;
END_IF;

// Drive pump speeds from the tank temperature bands.
IF tankTemperature > 180 THEN
    pumpHighSpeed := 1;
    pumpLowSpeed := 0;
    pumpStandby := 0;
ELSIF tankTemperature > 90 THEN
    pumpHighSpeed := 0;
    pumpLowSpeed := 1;
    pumpStandby := 0;
ELSE
    pumpHighSpeed := 0;
    pumpLowSpeed := 0;
    pumpStandby := 1;
END_IF;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const runScenario = (overrides = {}) => AOITestKit.run(overrides).outputs;

describe('IF_THEN AOI', () => {
  it('raises an alarm and drives high-speed pumping when rejects spike', () => {
    const outputs = runScenario({
      rejectCount: 5,
      forwardCommand: 1,
      overloadTrip: 0,
      levelLow: 1,
      levelHigh: 1,
      tankTemperature: 200,
    });

    expect(outputs.conveyorEnabled).toBe(0);
    expect(outputs.alarmHorn).toBe(1);
    expect(outputs.statusBeacon).toBe(0);
    expect(outputs.inletValve).toBe(1);
    expect(outputs.pumpHighSpeed).toBe(1);
    expect(outputs.pumpLowSpeed).toBe(0);
    expect(outputs.pumpStandby).toBe(0);
  });

  it('falls back to standby pumping when tank temperature is low', () => {
    const outputs = runScenario({
      forwardCommand: 1,
      overloadTrip: 1,
      levelLow: 0,
      levelHigh: 0,
      tankTemperature: 60,
    });

    expect(outputs.statusBeacon).toBe(1);
    expect(outputs.inletValve).toBe(0);
    expect(outputs.pumpHighSpeed).toBe(0);
    expect(outputs.pumpLowSpeed).toBe(0);
    expect(outputs.pumpStandby).toBe(1);
    expect(outputs.alarmHorn).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const repeatUntilDefinition = {
  name: 'REPEAT_UNTIL',
  description: '',
  tags: [
    {
      name: 'StartValue',
      dataType: 'DINT',
      usage: 'input',
      description: 'Initial value loaded into the counter',
      defaultValue: 0,
    },
    {
      name: 'Threshold',
      dataType: 'DINT',
      usage: 'input',
      description: 'Counter keeps running until it reaches this value',
      defaultValue: 3,
    },
    {
      name: 'Counter',
      dataType: 'DINT',
      usage: 'output',
      description: 'Resulting counter value after the repeat loop finishes',
      defaultValue: 0,
    },
    {
      name: 'Iterations',
      dataType: 'DINT',
      usage: 'output',
      description: 'How many times the repeat loop executed',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// Repeat loop executes once before evaluating the Threshold check.
Counter := StartValue;
Iterations := 0;

REPEAT
    // Increment the running count and track loop iterations.
    Counter := Counter + 1;
    Iterations := Iterations + 1;
UNTIL Counter >= Threshold
END_REPEAT;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const runRepeat = (overrides = {}) => AOITestKit.run(overrides).outputs;

describe('REPEAT_UNTIL AOI', () => {
  it('increments until the threshold is satisfied', () => {
    const outputs = runRepeat({ StartValue: 0, Threshold: 3 });
    expect(outputs.Counter).toBe(3);
    expect(outputs.Iterations).toBe(3);
  });

  it('runs at least once even when the start value already exceeds the threshold', () => {
    const outputs = runRepeat({ StartValue: 5, Threshold: 3 });
    expect(outputs.Counter).toBe(6);
    expect(outputs.Iterations).toBe(1);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const whileDoDefinition: AOIDefinitionInput = {
  name: 'WHILE_DO',
  description: '',
  tags: [
    {
      name: 'StartValue',
      dataType: 'DINT',
      usage: 'input',
      description: 'Initial value loaded into the counter',
      defaultValue: 0,
    },
    {
      name: 'Threshold',
      dataType: 'DINT',
      usage: 'input',
      description: 'Loop runs while the counter is below this value',
      defaultValue: 3,
    },
    {
      name: 'Counter',
      dataType: 'DINT',
      usage: 'output',
      description: 'Resulting counter value after the while loop finishes',
      defaultValue: 0,
    },
    {
      name: 'Iterations',
      dataType: 'DINT',
      usage: 'output',
      description: 'How many times the while loop executed',
      defaultValue: 0,
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `// While loop checks Threshold first and may skip entirely when already satisfied.
Counter := StartValue;
Iterations := 0;

WHILE Counter < Threshold DO
    // Continue counting until the threshold is satisfied.
    Counter := Counter + 1;
    Iterations := Iterations + 1;
END_WHILE;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const runWhile = (overrides = {}) => AOITestKit.run(overrides).outputs;

describe('WHILE_DO AOI', () => {
  it('loops until the counter meets the threshold', () => {
    const outputs = runWhile({ StartValue: 0, Threshold: 3 });
    expect(outputs.Counter).toBe(3);
    expect(outputs.Iterations).toBe(3);
  });

  it('skips the loop when the starting value already meets the threshold', () => {
    const outputs = runWhile({ StartValue: 5, Threshold: 3 });
    expect(outputs.Counter).toBe(5);
    expect(outputs.Iterations).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const contactsCoilsDefinition = {
  name: 'CONTACTS_COILS',
  description: 'XIC, XIO, OTE, OTL, and OTU instructions',
  tags: [
    {
      name: 'InputA',
      dataType: 'BOOL',
      usage: 'input',
      description: 'First input bit for contact evaluation',
    },
    {
      name: 'InputB',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Second input bit for contact evaluation',
    },
    {
      name: 'LatchCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Sets the latched output via OTL',
    },
    {
      name: 'UnlatchCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Clears the latched output via OTU',
    },
    {
      name: 'SeriesResult',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when both InputA and InputB are set',
    },
    {
      name: 'InvertedResult',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when InputA is set and InputB is clear',
    },
    {
      name: 'ParallelResult',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when either InputA or InputB is set',
    },
    {
      name: 'LatchedOut',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Retains state between scans until explicitly unlatched',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'XIC(InputA)XIC(InputB)OTE(SeriesResult);XIC(InputA)XIO(InputB)OTE(InvertedResult);[XIC(InputA),XIC(InputB)]OTE(ParallelResult);XIC(LatchCmd)OTL(LatchedOut);XIC(UnlatchCmd)OTU(LatchedOut)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('CONTACTS_COILS AOI', () => {
  it('series requires both inputs', () => {
    expect(run({ InputA: 1, InputB: 1 }).SeriesResult).toBe(1);
    expect(run({ InputA: 1, InputB: 0 }).SeriesResult).toBe(0);
    expect(run({ InputA: 0, InputB: 1 }).SeriesResult).toBe(0);
  });

  it('XIO inverts the second input', () => {
    expect(run({ InputA: 1, InputB: 0 }).InvertedResult).toBe(1);
    expect(run({ InputA: 1, InputB: 1 }).InvertedResult).toBe(0);
  });

  it('parallel passes when either input is set', () => {
    expect(run({ InputA: 1, InputB: 0 }).ParallelResult).toBe(1);
    expect(run({ InputA: 0, InputB: 1 }).ParallelResult).toBe(1);
    expect(run({ InputA: 0, InputB: 0 }).ParallelResult).toBe(0);
  });

  it('OTL latches the output', () => {
    expect(run({ LatchCmd: 1 }).LatchedOut).toBe(1);
  });

  it('OTU unlatches the output', () => {
    expect(run({ LatchedOut: 1, UnlatchCmd: 1 }).LatchedOut).toBe(0);
  });

  it('OTU wins when both latch and unlatch are active', () => {
    expect(run({ LatchCmd: 1, UnlatchCmd: 1 }).LatchedOut).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const timerLdDefinition = {
  name: 'TIMER',
  description: 'TON timer on delay instruction',
  tags: [
    {
      name: 'Enable',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Starts the timer when set',
    },
    {
      name: 'DelayTimer',
      dataType: 'TIMER',
      usage: 'local',
      description: 'TON timer structure',
      defaultValue: { PRE: 3000 },
    },
    {
      name: 'TimerAcc',
      dataType: 'DINT',
      usage: 'output',
      description: 'Current accumulated time in milliseconds',
    },
    {
      name: 'TimerDone',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Set when the timer reaches its preset',
    },
    {
      name: 'TimerTiming',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Set while the timer is actively counting',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'XIC(Enable)TON(DelayTimer,?,?);XIC(DelayTimer.DN)OTE(TimerDone);XIC(DelayTimer.TT)OTE(TimerTiming);MOVE(DelayTimer.ACC,TimerAcc)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('TIMER AOI', () => {
  it('exposes timer accumulator', () => {
    const outputs = run({ Enable: 1 });
    expect(typeof outputs.TimerAcc).toBe('number');
  });

  it('timer not done on first scan', () => {
    const outputs = run({ Enable: 1 });
    expect(outputs.TimerDone).toBe(0);
  });

  it('timer inactive when enable is off', () => {
    const outputs = run({ Enable: 0 });
    expect(outputs.TimerTiming).toBe(0);
    expect(outputs.TimerDone).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const counterLdDefinition = {
  name: 'COUNTER',
  description: 'CTU, CTD, and RES counter instructions',
  tags: [
    {
      name: 'CountUpPulse',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Increments the counter on rising edge',
    },
    {
      name: 'CountDownPulse',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Decrements the counter on rising edge',
    },
    {
      name: 'ResetCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Clears the counter accumulator to zero',
    },
    {
      name: 'Counter1',
      dataType: 'COUNTER',
      usage: 'local',
      description: 'Counter structure for CTU and CTD',
      defaultValue: { PRE: 5 },
    },
    {
      name: 'CountValue',
      dataType: 'DINT',
      usage: 'output',
      description: 'Current counter accumulator value',
    },
    {
      name: 'CountDone',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Set when the counter reaches its preset',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'XIC(CountUpPulse)CTU(Counter1,?,?);XIC(CountDownPulse)CTD(Counter1,?,?);XIC(ResetCmd)RES(Counter1);MOVE(Counter1.ACC,CountValue);XIC(Counter1.DN)OTE(CountDone)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('COUNTER AOI', () => {
  it('increments on count up pulse', () => {
    const outputs = run({ CountUpPulse: 1 });
    expect(outputs.CountValue).toBe(1);
  });

  it('resets counter to zero', () => {
    const outputs = run({ CountUpPulse: 1, ResetCmd: 1 });
    expect(outputs.CountValue).toBe(0);
    expect(outputs.CountDone).toBe(0);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const mathLdDefinition = {
  name: 'MATH',
  description: 'ADD, SUB, MUL, DIV, and MOVE math instructions',
  tags: [
    {
      name: 'Accumulator',
      dataType: 'REAL',
      usage: 'output',
      description: 'Running total that increases by Rate every scan',
      defaultValue: 0.0,
    },
    {
      name: 'Rate',
      dataType: 'REAL',
      usage: 'input',
      description: 'Amount added to Accumulator each scan',
      defaultValue: 1.5,
    },
    {
      name: 'ValueA',
      dataType: 'DINT',
      usage: 'input',
      description: 'First operand for integer math',
      defaultValue: 10,
    },
    {
      name: 'ValueB',
      dataType: 'DINT',
      usage: 'input',
      description: 'Second operand for integer math',
      defaultValue: 3,
    },
    {
      name: 'Difference',
      dataType: 'DINT',
      usage: 'output',
      description: 'Result of ValueA - ValueB',
    },
    {
      name: 'Product',
      dataType: 'DINT',
      usage: 'output',
      description: 'Result of ValueA * ValueB',
    },
    {
      name: 'Quotient',
      dataType: 'REAL',
      usage: 'output',
      description: 'Result of ValueA / ValueB',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'ADD(Accumulator,Rate,Accumulator);SUB(ValueA,ValueB,Difference);MUL(ValueA,ValueB,Product);DIV(ValueA,ValueB,Quotient)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('MATH AOI', () => {
  it('accumulator increases by rate each scan', () => {
    const outputs = run({ Accumulator: 0, Rate: 1.5 });
    expect(outputs.Accumulator).toBeCloseTo(1.5);
  });

  it('computes integer operations with defaults', () => {
    const outputs = run({ ValueA: 10, ValueB: 3 });
    expect(outputs.Difference).toBe(7);
    expect(outputs.Product).toBe(30);
    expect(outputs.Quotient).toBeCloseTo(3.333, 2);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const compareLdDefinition = {
  name: 'COMPARE',
  description: 'EQ, NE, GT, GE, LT, LE, and LIMIT comparison instructions',
  tags: [
    {
      name: 'SensorValue',
      dataType: 'DINT',
      usage: 'input',
      description: 'Value being compared against the setpoint',
    },
    {
      name: 'Setpoint',
      dataType: 'DINT',
      usage: 'input',
      description: 'Reference value for comparisons',
      defaultValue: 50,
    },
    {
      name: 'LowLimit',
      dataType: 'DINT',
      usage: 'input',
      description: 'Lower bound for the LIMIT range check',
      defaultValue: 20,
    },
    {
      name: 'HighLimit',
      dataType: 'DINT',
      usage: 'input',
      description: 'Upper bound for the LIMIT range check',
      defaultValue: 80,
    },
    {
      name: 'IsEqual',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue equals Setpoint',
    },
    {
      name: 'IsNotEqual',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue differs from Setpoint',
    },
    {
      name: 'IsAbove',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue exceeds Setpoint',
    },
    {
      name: 'IsAtOrAbove',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue meets or exceeds Setpoint',
    },
    {
      name: 'IsBelow',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue is less than Setpoint',
    },
    {
      name: 'IsAtOrBelow',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue is at most Setpoint',
    },
    {
      name: 'InRange',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue is between LowLimit and HighLimit inclusive',
    },
    {
      name: 'OutOfRange',
      dataType: 'BOOL',
      usage: 'output',
      description: 'True when SensorValue is outside LowLimit..HighLimit (inverted LIMIT)',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'EQ(SensorValue,Setpoint)OTE(IsEqual);NE(SensorValue,Setpoint)OTE(IsNotEqual);GT(SensorValue,Setpoint)OTE(IsAbove);GE(SensorValue,Setpoint)OTE(IsAtOrAbove);LT(SensorValue,Setpoint)OTE(IsBelow);LE(SensorValue,Setpoint)OTE(IsAtOrBelow);LIMIT(LowLimit,SensorValue,HighLimit)OTE(InRange);LIMIT(HighLimit,SensorValue,LowLimit)OTE(OutOfRange)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('COMPARE AOI', () => {
  it('all comparisons correct when values are equal', () => {
    const outputs = run({ SensorValue: 50, Setpoint: 50 });
    expect(outputs.IsEqual).toBe(1);
    expect(outputs.IsNotEqual).toBe(0);
    expect(outputs.IsAbove).toBe(0);
    expect(outputs.IsAtOrAbove).toBe(1);
    expect(outputs.IsBelow).toBe(0);
    expect(outputs.IsAtOrBelow).toBe(1);
  });

  it('all comparisons correct when sensor is above setpoint', () => {
    const outputs = run({ SensorValue: 60, Setpoint: 50 });
    expect(outputs.IsEqual).toBe(0);
    expect(outputs.IsNotEqual).toBe(1);
    expect(outputs.IsAbove).toBe(1);
    expect(outputs.IsAtOrAbove).toBe(1);
    expect(outputs.IsBelow).toBe(0);
    expect(outputs.IsAtOrBelow).toBe(0);
  });

  it('all comparisons correct when sensor is below setpoint', () => {
    const outputs = run({ SensorValue: 30, Setpoint: 50 });
    expect(outputs.IsEqual).toBe(0);
    expect(outputs.IsNotEqual).toBe(1);
    expect(outputs.IsAbove).toBe(0);
    expect(outputs.IsAtOrAbove).toBe(0);
    expect(outputs.IsBelow).toBe(1);
    expect(outputs.IsAtOrBelow).toBe(1);
  });

  it('LIMIT standard: true when sensor is within range', () => {
    const outputs = run({ SensorValue: 50, LowLimit: 20, HighLimit: 80 });
    expect(outputs.InRange).toBe(1);
    expect(outputs.OutOfRange).toBe(0);
  });

  it('LIMIT standard: false when sensor is above range', () => {
    const outputs = run({ SensorValue: 90, LowLimit: 20, HighLimit: 80 });
    expect(outputs.InRange).toBe(0);
    expect(outputs.OutOfRange).toBe(1);
  });

  it('LIMIT standard: false when sensor is below range', () => {
    const outputs = run({ SensorValue: 10, LowLimit: 20, HighLimit: 80 });
    expect(outputs.InRange).toBe(0);
    expect(outputs.OutOfRange).toBe(1);
  });

  it('LIMIT standard: true at low boundary', () => {
    const outputs = run({ SensorValue: 20, LowLimit: 20, HighLimit: 80 });
    expect(outputs.InRange).toBe(1);
  });

  it('LIMIT standard: true at high boundary', () => {
    const outputs = run({ SensorValue: 80, LowLimit: 20, HighLimit: 80 });
    expect(outputs.InRange).toBe(1);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

function normalizeTesting(aoi: AOIDefinitionInput): AOIDefinition['testing'] {
  if (!aoi.testing?.content) return undefined;

  return {
    content: aoi.testing.content ?? '',
    config: {
      timeout: aoi.testing.config?.timeout ?? 5000,
      maxIterations: aoi.testing.config?.maxIterations ?? 1000,
      enableDebugMode: aoi.testing.config?.enableDebugMode ?? false,
    },
  };
}

function convertToRuntimeAOI(aoi: AOIDefinitionInput): AOIDefinition {
  const baseMetadata = {
    created: BASE_TIMESTAMP,
    modified: BASE_TIMESTAMP,
  };

  const testing = normalizeTesting(aoi);

  return AOIDefinitionSchema.parse({
    ...aoi,
    metadata: {
      ...baseMetadata,
      ...(aoi.metadata ?? {}),
    },
    testing,
  });
}

export const exampleTimerAOI = convertToRuntimeAOI(timerDefinition);
export const exampleCounterAOI = convertToRuntimeAOI(counterDefinition);
export const exampleCaseOfAOI = convertToRuntimeAOI(caseOfDefinition);
export const exampleForDoAOI = convertToRuntimeAOI(forDoDefinition);
export const exampleIfThenAOI = convertToRuntimeAOI(ifThenDefinition);
export const exampleRepeatUntilAOI = convertToRuntimeAOI(repeatUntilDefinition);
export const exampleWhileDoAOI = convertToRuntimeAOI(whileDoDefinition);
export const exampleContactsCoilsAOI = convertToRuntimeAOI(contactsCoilsDefinition);
export const exampleTimerLdAOI = convertToRuntimeAOI(timerLdDefinition);
export const exampleCounterLdAOI = convertToRuntimeAOI(counterLdDefinition);
export const exampleMathLdAOI = convertToRuntimeAOI(mathLdDefinition);
export const exampleCompareLdAOI = convertToRuntimeAOI(compareLdDefinition);

export const instructionExampleAOIs: AOIDefinition[] = [
  exampleContactsCoilsAOI,
  exampleTimerLdAOI,
  exampleCounterLdAOI,
  exampleMathLdAOI,
  exampleCompareLdAOI,
  exampleTimerAOI,
  exampleCounterAOI,
  exampleCaseOfAOI,
  exampleForDoAOI,
  exampleIfThenAOI,
  exampleRepeatUntilAOI,
  exampleWhileDoAOI,
];

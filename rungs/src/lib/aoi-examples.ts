import { AOIDefinitionSchema, type AOIDefinition } from '@repo/plc-core';
import type { z } from 'zod/v4';

type AOIDefinitionInput = z.input<typeof AOIDefinitionSchema>;

const BASE_TIMESTAMP = '2024-01-01T00:00:00.000Z';

const motorControlSTDefinition = {
  name: 'MotorControl_ST',
  description: 'Start-stop motor control with fault handling',
  tags: [
    {
      name: 'StartButton',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Momentary start command',
    },
    {
      name: 'StopButton',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Momentary stop command',
    },
    {
      name: 'OverloadTrip',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Fault input that trips the motor',
    },
    {
      name: 'ResetFault',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Clears the overload fault latch',
    },
    {
      name: 'RunLatch',
      dataType: 'BOOL',
      usage: 'local',
      description: 'Latched run request state',
    },
    {
      name: 'FaultLatch',
      dataType: 'BOOL',
      usage: 'local',
      description: 'Latched fault state',
    },
    {
      name: 'MotorRun',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Command to run the motor starter',
    },
    {
      name: 'FaultActive',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Fault indicator for the motor',
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `/* Classic Start-Stop Motor Control with Fault Handling
This pattern is used in almost every industrial motor starter.
Click "Start" to run the simulation.
Try toggling StartButton, StopButton, and OverloadTrip to see
how the motor responds. Use ResetFault to clear a fault. */

// Clear the fault latch when reset is pressed.
IF ResetFault THEN
  FaultLatch := 0;
END_IF;

// Latch the fault when an overload occurs.
// Once latched, the fault stays active until reset.
IF OverloadTrip THEN
  FaultLatch := 1;
END_IF;

// Start-stop logic with seal-in circuit.
// StopButton has priority over StartButton (safety first!).
IF StopButton OR FaultLatch THEN
  RunLatch := 0; // Stop the motor
ELSIF StartButton THEN
  RunLatch := 1; // Start and latch the motor
END_IF;

// Motor runs only if latched AND no active fault.
MotorRun := RunLatch AND NOT FaultLatch;
FaultActive := FaultLatch;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.270Z',
    modified: '2025-10-17T15:57:56.270Z',
  },
  testing: {
    content: `const runMotor = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('MotorControl AOI', () => {
  it('latches run on start', () => {
    const outputs = runMotor({ StartButton: 1 });
    expect(outputs.MotorRun).toBe(1);
    expect(outputs.FaultActive).toBe(0);
  });

  it('drops run on stop', () => {
    const outputs = runMotor({ StartButton: 1, StopButton: 1 });
    expect(outputs.MotorRun).toBe(0);
  });

  it('latches fault and blocks run', () => {
    const outputs = runMotor({ StartButton: 1, OverloadTrip: 1 });
    expect(outputs.MotorRun).toBe(0);
    expect(outputs.FaultActive).toBe(1);
  });

  it('clears fault on reset', () => {
    const outputs = runMotor({ FaultLatch: 1, ResetFault: 1 });
    expect(outputs.FaultActive).toBe(0);
  });
});`,
  },
} satisfies AOIDefinitionInput;

const motorControlLDDefinition = {
  name: 'MotorControl_LD',
  description: 'Start-stop motor control with fault handling (Ladder Diagram)',
  tags: [
    {
      name: 'StartButton',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Momentary start command',
    },
    {
      name: 'StopButton',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Momentary stop command',
    },
    {
      name: 'OverloadTrip',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Fault input that trips the motor',
    },
    {
      name: 'ResetFault',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Clears the overload fault latch',
    },
    {
      name: 'MotorRun',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Command to run the motor starter',
    },
    {
      name: 'FaultActive',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Fault indicator for the motor',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        '[XIC(StartButton),XIC(MotorRun)]XIO(StopButton)XIO(OverloadTrip)XIO(FaultActive)OTE(MotorRun);[XIC(OverloadTrip),XIC(FaultActive)]XIO(ResetFault)OTE(FaultActive)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.270Z',
    modified: '2025-10-17T15:57:56.270Z',
  },
  testing: {
    content: `const runMotor = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('MotorControl AOI', () => {
  it('latches run on start', () => {
    const outputs = runMotor({ StartButton: 1 });
    expect(outputs.MotorRun).toBe(1);
    expect(outputs.FaultActive).toBe(0);
  });

  it('drops run on stop', () => {
    const outputs = runMotor({ StartButton: 1, StopButton: 1 });
    expect(outputs.MotorRun).toBe(0);
  });

  it('latches fault and blocks run', () => {
    const outputs = runMotor({ StartButton: 1, OverloadTrip: 1 });
    expect(outputs.MotorRun).toBe(0);
    expect(outputs.FaultActive).toBe(1);
  });

  it('clears fault on reset', () => {
    const outputs = runMotor({ FaultActive: 1, ResetFault: 1 });
    expect(outputs.FaultActive).toBe(0);
  });

  it('cannot start motor is fault is active', () => {
    const outputs = runMotor({ FaultActive: 1, StartButton: 1 });
    expect(outputs.MotorRun).toBe(0);
  });
});`,
  },
} satisfies AOIDefinitionInput;

const trafficLightSTDefinition = {
  name: 'TrafficLight_ST',
  description: 'Traffic light sequence using TIMER instruction',
  tags: [
    {
      name: 'WalkRequest',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Pedestrian crossing request button',
    },
    {
      name: 'PhaseTimer',
      dataType: 'FBD_TIMER',
      usage: 'local',
      description: 'Timer for crossing cycle and cooldown',
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
      name: 'CycleActive',
      dataType: 'BOOL',
      usage: 'local',
      description: 'Crossing cycle in progress',
    },
    {
      name: 'YellowDuration',
      dataType: 'DINT',
      usage: 'local',
      description: 'Yellow phase duration in ms',
      defaultValue: 1000,
    },
    {
      name: 'RedDuration',
      dataType: 'DINT',
      usage: 'local',
      description: 'Red phase duration in ms',
      defaultValue: 5000,
    },
    {
      name: 'CooldownDuration',
      dataType: 'DINT',
      usage: 'local',
      description: 'Minimum green time before next crossing in ms',
      defaultValue: 3000,
    },
    {
      name: 'GreenLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Green light output',
    },
    {
      name: 'YellowLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Yellow light output',
    },
    {
      name: 'RedLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Red light output',
    },
    {
      name: 'WalkSign',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Pedestrian walk signal',
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `/* Pedestrian Crossing Controller
Click "Start" to run the simulation.
Press WalkRequest to trigger a crossing cycle.
Light stays green until pedestrian requests to cross.
Cooldown prevents immediate re-triggering. */

// Start cycle only if not already running.
IF WalkRequest AND NOT CycleActive THEN
  CycleActive := 1;
END_IF;

// Clear cycle at end of full sequence.
IF PhaseTimer.DN THEN
  CycleActive := 0;
END_IF;

// Timer covers: Yellow + Red + Cooldown phases.
PhaseTimer.PRE := YellowDuration + RedDuration + CooldownDuration;
PhaseTimer.TimerEnable := CycleActive;
PhaseTimer.Reset := PhaseTimer.DN;
TONR(PhaseTimer);

// Yellow phase: 0 to YellowDuration
YellowLight := CycleActive AND PhaseTimer.ACC < YellowDuration;

// Red phase: YellowDuration to YellowDuration + RedDuration
RedLight := CycleActive AND PhaseTimer.ACC >= YellowDuration AND PhaseTimer.ACC < (YellowDuration + RedDuration);

// Walk sign active during red phase.
WalkSign := RedLight;

// Green when idle or during cooldown phase.
GreenLight := NOT CycleActive OR PhaseTimer.ACC >= (YellowDuration + RedDuration);`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.280Z',
    modified: '2025-10-17T15:57:56.280Z',
  },
  testing: {
    content: `const runLight = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('TrafficLight AOI', () => {
  it('shows green when idle', () => {
    const outputs = runLight({});
    expect(outputs.GreenLight).toBe(1);
    expect(outputs.YellowLight).toBe(0);
    expect(outputs.RedLight).toBe(0);
    expect(outputs.WalkSign).toBe(0);
  });

  it('starts yellow phase on walk request', () => {
    const outputs = runLight({ WalkRequest: 1 });
    expect(outputs.YellowLight).toBe(1);
    expect(outputs.GreenLight).toBe(0);
    expect(outputs.RedLight).toBe(0);
  });

  it('ignores walk request during active cycle', () => {
    const outputs = runLight({ WalkRequest: 1, CycleActive: 1 });
    expect(outputs.YellowLight).toBe(1);
  });

  it('walk sign follows red light', () => {
    const outputs = runLight({});
    expect(outputs.WalkSign).toBe(outputs.RedLight);
  });

  it('only one light active at a time when idle', () => {
    const outputs = runLight({});
    const activeCount = outputs.GreenLight + outputs.YellowLight + outputs.RedLight;
    expect(activeCount).toBe(1);
  });

  it('only one traffic light active during cycle start', () => {
    const outputs = runLight({ WalkRequest: 1 });
    const activeCount = outputs.GreenLight + outputs.YellowLight + outputs.RedLight;
    expect(activeCount).toBe(1);
  });
});`,
  },
} satisfies AOIDefinitionInput;

const trafficLightLDDefinition = {
  name: 'TrafficLight_LD',
  description: 'Traffic light sequence using TIMER instruction (Ladder Diagram)',
  tags: [
    {
      name: 'WalkRequest',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Pedestrian crossing request button',
    },
    {
      name: 'PhaseTimer',
      dataType: 'TIMER',
      usage: 'local',
      description: 'Timer for crossing cycle and cooldown',
      defaultValue: { PRE: 9000 },
    },
    {
      name: 'CycleActive',
      dataType: 'BOOL',
      usage: 'local',
      description: 'Crossing cycle in progress',
    },
    {
      name: 'GreenLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Green light output',
    },
    {
      name: 'YellowLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Yellow light output',
    },
    {
      name: 'RedLight',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Red light output',
    },
    {
      name: 'WalkSign',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Pedestrian walk signal',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'XIC(WalkRequest)OTL(CycleActive);XIC(CycleActive)TON(PhaseTimer,?,?)XIC(PhaseTimer.DN)OTU(CycleActive);XIC(CycleActive)LT(PhaseTimer.ACC,1000)OTE(YellowLight);XIC(CycleActive)GE(PhaseTimer.ACC,1000)LT(PhaseTimer.ACC,6000)OTE(RedLight);[XIO(CycleActive),GE(PhaseTimer.ACC,6000)]OTE(GreenLight);XIC(RedLight)OTE(WalkSign)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.280Z',
    modified: '2025-10-17T15:57:56.280Z',
  },
  testing: {
    content: `const runLight = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('TrafficLight AOI', () => {
  it('shows green when idle', () => {
    const outputs = runLight({});
    expect(outputs.GreenLight).toBe(1);
    expect(outputs.YellowLight).toBe(0);
    expect(outputs.RedLight).toBe(0);
    expect(outputs.WalkSign).toBe(0);
  });

  it('starts yellow phase on walk request', () => {
    const outputs = runLight({ WalkRequest: 1 });
    expect(outputs.YellowLight).toBe(1);
    expect(outputs.GreenLight).toBe(0);
    expect(outputs.RedLight).toBe(0);
  });

  it('ignores walk request during active cycle', () => {
    const outputs = runLight({ WalkRequest: 1, CycleActive: 1 });
    expect(outputs.YellowLight).toBe(1);
  });

  it('walk sign follows red light', () => {
    const outputs = runLight({});
    expect(outputs.WalkSign).toBe(outputs.RedLight);
  });

  it('only one light active at a time when idle', () => {
    const outputs = runLight({});
    const activeCount = outputs.GreenLight + outputs.YellowLight + outputs.RedLight;
    expect(activeCount).toBe(1);
  });

  it('only one traffic light active during cycle start', () => {
    const outputs = runLight({ WalkRequest: 1 });
    const activeCount = outputs.GreenLight + outputs.YellowLight + outputs.RedLight;
    expect(activeCount).toBe(1);
  });
});`,
  },
} satisfies AOIDefinitionInput;

const tankLevelDefinition = {
  name: 'TankLevel_ST',
  description: 'Tank level simulation with manual valve control and alarms',
  tags: [
    {
      name: 'FillCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Command to open fill valve',
    },
    {
      name: 'DrainCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Command to open drain valve',
    },
    {
      name: 'FillRate',
      dataType: 'REAL',
      usage: 'local',
      description: 'Rate at which tank fills per scan',
    },
    {
      name: 'DrainRate',
      dataType: 'REAL',
      usage: 'local',
      description: 'Rate at which tank drains per scan',
    },
    {
      name: 'Level',
      dataType: 'REAL',
      usage: 'output',
      description: 'Current tank level (0-100%)',
      defaultValue: 50,
    },
    {
      name: 'HighAlarm',
      dataType: 'BOOL',
      usage: 'output',
      description: 'High level alarm (above 80%)',
    },
    {
      name: 'LowAlarm',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Low level alarm (below 20%)',
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `/* Click "Start" to run the simulation, then toggle FillCmd or DrainCmd
in the right panel to control the tank. Open the "Trend" tab to watch
the Level change in real-time.
Feel free to edit the code below to see different behaviors! */

// Fill the tank when fill command is active.
IF FillCmd THEN
  FillRate := 1.3; // Try changing this value!
  Level := Level + FillRate; // Increases by FillRate every scan
END_IF;

// Drain the tank when drain command is active.
IF DrainCmd THEN
  DrainRate := 0.9; // Try changing this value!
  Level := Level - DrainRate; // Decreases by DrainRate every scan
END_IF;

// Clamp level to valid 0-100% range.
IF Level > 100.0 THEN
  Level := 100.0;
ELSIF Level < 0.0 THEN
  Level := 0.0;
END_IF;

// Alarm outputs trigger when level crosses thresholds.
HighAlarm := Level >= 80.0;
LowAlarm := Level <= 20.0;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const runTank = (overrides = {}) => AOITestKit.run(overrides).outputs;

describe('TankLevel AOI', () => {
  it('increases level when fill command is active', () => {
    const outputs = runTank({ FillCmd: 1, Level: 50 });
    expect(outputs.Level).toBeGreaterThan(50);
  });

  it('decreases level when drain command is active', () => {
    const outputs = runTank({ DrainCmd: 1, Level: 50 });
    expect(outputs.Level).toBeLessThan(50);
  });

  it('triggers high alarm at 80%', () => {
    const outputs = runTank({ Level: 80 });
    expect(outputs.HighAlarm).toBe(1);
  });

  it('triggers low alarm at 20%', () => {
    const outputs = runTank({ Level: 20 });
    expect(outputs.LowAlarm).toBe(1);
  });
});`,
    config: {
      timeout: 5000,
      maxIterations: 1000,
      enableDebugMode: false,
    },
  },
} satisfies AOIDefinitionInput;

const tankLevelLDDefinition = {
  name: 'TankLevel_LD',
  description: 'Tank level simulation with manual valve control and alarms (Ladder Diagram)',
  tags: [
    {
      name: 'FillCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Command to open fill valve',
    },
    {
      name: 'DrainCmd',
      dataType: 'BOOL',
      usage: 'input',
      description: 'Command to open drain valve',
    },
    {
      name: 'FillRate',
      dataType: 'REAL',
      usage: 'local',
      description: 'Rate at which tank fills per scan',
      defaultValue: 1.3,
    },
    {
      name: 'DrainRate',
      dataType: 'REAL',
      usage: 'local',
      description: 'Rate at which tank drains per scan',
      defaultValue: 0.9,
    },
    {
      name: 'Level',
      dataType: 'REAL',
      usage: 'output',
      description: 'Current tank level (0-100%)',
      defaultValue: 50,
    },
    {
      name: 'HighAlarm',
      dataType: 'BOOL',
      usage: 'output',
      description: 'High level alarm (above 80%)',
    },
    {
      name: 'LowAlarm',
      dataType: 'BOOL',
      usage: 'output',
      description: 'Low level alarm (below 20%)',
    },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content:
        'XIC(FillCmd)ADD(Level,FillRate,Level);XIC(DrainCmd)SUB(Level,DrainRate,Level);GT(Level,100.0)MOVE(100.0,Level);LT(Level,0.0)MOVE(0.0,Level);GE(Level,80.0)OTE(HighAlarm);LE(Level,20.0)OTE(LowAlarm)',
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const runTank = (overrides = {}) => AOITestKit.run(overrides).outputs;

describe('TankLevel AOI', () => {
  it('increases level when fill command is active', () => {
    const outputs = runTank({ FillCmd: 1, Level: 50 });
    expect(outputs.Level).toBeGreaterThan(50);
  });

  it('decreases level when drain command is active', () => {
    const outputs = runTank({ DrainCmd: 1, Level: 50 });
    expect(outputs.Level).toBeLessThan(50);
  });

  it('clamps level at 100%', () => {
    const outputs = runTank({ FillCmd: 1, Level: 100 });
    expect(outputs.Level).toBe(100);
  });

  it('clamps level at 0%', () => {
    const outputs = runTank({ DrainCmd: 1, Level: 0 });
    expect(outputs.Level).toBe(0);
  });

  it('triggers high alarm at 80%', () => {
    const outputs = runTank({ Level: 80 });
    expect(outputs.HighAlarm).toBe(1);
  });

  it('triggers low alarm at 20%', () => {
    const outputs = runTank({ Level: 20 });
    expect(outputs.LowAlarm).toBe(1);
  });
});`,
  },
} satisfies AOIDefinitionInput;

const cylinderDefinition: AOIDefinitionInput = {
  name: 'Cylinder_LD',
  description: 'Pneumatic cylinder control with extend/retract sensors and timeouts',
  tags: [
    { name: 'In_ExtSensor', dataType: 'BOOL', usage: 'input' },
    { name: 'In_RetSensor', dataType: 'BOOL', usage: 'input' },
    { name: 'Cmd_Extend', dataType: 'BOOL', usage: 'input' },
    { name: 'Cmd_Retract', dataType: 'BOOL', usage: 'input' },
    { name: 'Cmd_Reset', dataType: 'BOOL', usage: 'input' },
    { name: 'Val_ExtTime', dataType: 'DINT', usage: 'input', defaultValue: 5000 },
    { name: 'Val_RetTime', dataType: 'DINT', usage: 'input', defaultValue: 5000 },
    { name: 'Out_Extend', dataType: 'BOOL', usage: 'output' },
    { name: 'Out_Retract', dataType: 'BOOL', usage: 'output' },
    { name: 'Sts_Extended', dataType: 'BOOL', usage: 'output' },
    { name: 'Sts_Retracted', dataType: 'BOOL', usage: 'output' },
    { name: 'Err_ExtTimeout', dataType: 'BOOL', usage: 'output' },
    { name: 'Err_RetTimeout', dataType: 'BOOL', usage: 'output' },
    { name: 'Tmr_Ext', dataType: 'TIMER', usage: 'local', defaultValue: { PRE: 5000 } },
    { name: 'Tmr_Ret', dataType: 'TIMER', usage: 'local', defaultValue: { PRE: 5000 } },
  ],
  routines: {
    Logic: {
      type: 'ld',
      content: `XIC(Cmd_Extend)OTU(Out_Retract)OTL(Out_Extend);XIC(Cmd_Retract)OTU(Out_Extend)OTL(Out_Retract);XIC(In_ExtSensor)OTE(Sts_Extended);XIC(In_RetSensor)OTE(Sts_Retracted);XIC(Out_Extend)XIO(Sts_Extended)XIO(Cmd_Reset)MOVE(Val_ExtTime,Tmr_Ext.PRE)TON(Tmr_Ext,?,?);[XIC(Tmr_Ext.DN),XIC(Err_ExtTimeout)]XIO(Cmd_Reset)OTE(Err_ExtTimeout);XIC(Out_Retract)XIO(Sts_Retracted)XIO(Cmd_Reset)MOVE(Val_RetTime,Tmr_Ret.PRE)TON(Tmr_Ret,?,?);[XIC(Tmr_Ret.DN),XIC(Err_RetTimeout)]XIO(Cmd_Reset)OTE(Err_RetTimeout)`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('Cylinder AOI', () => {
  it('extends on command', () => {
    const out = run({ Cmd_Extend: 1 });
    expect(out.Out_Extend).toBe(1);
    expect(out.Out_Retract).toBe(0);
  });

  it('retracts on command', () => {
    const out = run({ Cmd_Retract: 1 });
    expect(out.Out_Retract).toBe(1);
    expect(out.Out_Extend).toBe(0);
  });

  it('retract overrides extend when both commanded', () => {
    const out = run({ Cmd_Extend: 1, Cmd_Retract: 1 });
    expect(out.Out_Retract).toBe(1);
    expect(out.Out_Extend).toBe(0);
  });

  it('reports extended from sensor', () => {
    const out = run({ In_ExtSensor: 1 });
    expect(out.Sts_Extended).toBe(1);
    expect(out.Sts_Retracted).toBe(0);
  });

  it('reports retracted from sensor', () => {
    const out = run({ In_RetSensor: 1 });
    expect(out.Sts_Retracted).toBe(1);
    expect(out.Sts_Extended).toBe(0);
  });

  it('seals extend timeout error', () => {
    const out = run({ Err_ExtTimeout: 1 });
    expect(out.Err_ExtTimeout).toBe(1);
  });

  it('seals retract timeout error', () => {
    const out = run({ Err_RetTimeout: 1 });
    expect(out.Err_RetTimeout).toBe(1);
  });

  it('clears extend timeout on reset', () => {
    const out = run({ Err_ExtTimeout: 1, Cmd_Reset: 1 });
    expect(out.Err_ExtTimeout).toBe(0);
  });

  it('clears retract timeout on reset', () => {
    const out = run({ Err_RetTimeout: 1, Cmd_Reset: 1 });
    expect(out.Err_RetTimeout).toBe(0);
  });
});`,
  },
};

const cylinderSTDefinition = {
  name: 'Cylinder_ST',
  description: 'Pneumatic cylinder control with extend/retract sensors and timeouts (Structured Text)',
  tags: [
    { name: 'In_ExtSensor', dataType: 'BOOL', usage: 'input', description: 'Extended position sensor' },
    { name: 'In_RetSensor', dataType: 'BOOL', usage: 'input', description: 'Retracted position sensor' },
    { name: 'Cmd_Extend', dataType: 'BOOL', usage: 'input', description: 'Command to extend cylinder' },
    { name: 'Cmd_Retract', dataType: 'BOOL', usage: 'input', description: 'Command to retract cylinder' },
    { name: 'Cmd_Reset', dataType: 'BOOL', usage: 'input', description: 'Clear timeout errors' },
    { name: 'Val_ExtTime', dataType: 'DINT', usage: 'input', defaultValue: 5000, description: 'Extend timeout in ms' },
    { name: 'Val_RetTime', dataType: 'DINT', usage: 'input', defaultValue: 5000, description: 'Retract timeout in ms' },
    { name: 'Out_Extend', dataType: 'BOOL', usage: 'output', description: 'Extend solenoid output' },
    { name: 'Out_Retract', dataType: 'BOOL', usage: 'output', description: 'Retract solenoid output' },
    { name: 'Sts_Extended', dataType: 'BOOL', usage: 'output', description: 'Cylinder is extended' },
    { name: 'Sts_Retracted', dataType: 'BOOL', usage: 'output', description: 'Cylinder is retracted' },
    { name: 'Err_ExtTimeout', dataType: 'BOOL', usage: 'output', description: 'Extend motion timed out' },
    { name: 'Err_RetTimeout', dataType: 'BOOL', usage: 'output', description: 'Retract motion timed out' },
    {
      name: 'Tmr_Ext',
      dataType: 'FBD_TIMER',
      usage: 'local',
      description: 'Extend timeout timer',
      defaultValue: { EnableIn: 1 },
    },
    {
      name: 'Tmr_Ret',
      dataType: 'FBD_TIMER',
      usage: 'local',
      description: 'Retract timeout timer',
      defaultValue: { EnableIn: 1 },
    },
  ],
  routines: {
    Logic: {
      type: 'st',
      content: `/* Pneumatic Cylinder Control
Click "Start" to run the simulation.
Toggle Cmd_Extend or Cmd_Retract to move the cylinder.
Set In_ExtSensor or In_RetSensor to confirm position.
If the cylinder doesn't reach position in time, a timeout error latches.
Use Cmd_Reset to clear errors. */

// Extend command: stop retract, start extend.
IF Cmd_Extend THEN
  Out_Retract := 0;
  Out_Extend := 1;
END_IF;

// Retract command: stop extend, start retract.
IF Cmd_Retract THEN
  Out_Extend := 0;
  Out_Retract := 1;
END_IF;

// Sensor status feedback.
Sts_Extended := In_ExtSensor;
Sts_Retracted := In_RetSensor;

// Extend timeout: timer runs while extending without sensor confirmation.
Tmr_Ext.PRE := Val_ExtTime;
Tmr_Ext.TimerEnable := Out_Extend AND NOT Sts_Extended AND NOT Cmd_Reset;
Tmr_Ext.Reset := NOT Tmr_Ext.TimerEnable;
TONR(Tmr_Ext);

// Seal-in extend timeout error until reset.
Err_ExtTimeout := (Tmr_Ext.DN OR Err_ExtTimeout) AND NOT Cmd_Reset;

// Retract timeout: timer runs while retracting without sensor confirmation.
Tmr_Ret.PRE := Val_RetTime;
Tmr_Ret.TimerEnable := Out_Retract AND NOT Sts_Retracted AND NOT Cmd_Reset;
Tmr_Ret.Reset := NOT Tmr_Ret.TimerEnable;
TONR(Tmr_Ret);

// Seal-in retract timeout error until reset.
Err_RetTimeout := (Tmr_Ret.DN OR Err_RetTimeout) AND NOT Cmd_Reset;`,
    },
  },
  metadata: {
    created: '2025-10-17T15:57:56.276Z',
    modified: '2025-10-17T15:57:56.276Z',
  },
  testing: {
    content: `const run = (inputs = {}) => AOITestKit.run(inputs).outputs;

describe('Cylinder AOI', () => {
  it('extends on command', () => {
    const out = run({ Cmd_Extend: 1 });
    expect(out.Out_Extend).toBe(1);
    expect(out.Out_Retract).toBe(0);
  });

  it('retracts on command', () => {
    const out = run({ Cmd_Retract: 1 });
    expect(out.Out_Retract).toBe(1);
    expect(out.Out_Extend).toBe(0);
  });

  it('retract overrides extend when both commanded', () => {
    const out = run({ Cmd_Extend: 1, Cmd_Retract: 1 });
    expect(out.Out_Retract).toBe(1);
    expect(out.Out_Extend).toBe(0);
  });

  it('reports extended from sensor', () => {
    const out = run({ In_ExtSensor: 1 });
    expect(out.Sts_Extended).toBe(1);
    expect(out.Sts_Retracted).toBe(0);
  });

  it('reports retracted from sensor', () => {
    const out = run({ In_RetSensor: 1 });
    expect(out.Sts_Retracted).toBe(1);
    expect(out.Sts_Extended).toBe(0);
  });

  it('seals extend timeout error', () => {
    const out = run({ Err_ExtTimeout: 1 });
    expect(out.Err_ExtTimeout).toBe(1);
  });

  it('seals retract timeout error', () => {
    const out = run({ Err_RetTimeout: 1 });
    expect(out.Err_RetTimeout).toBe(1);
  });

  it('clears extend timeout on reset', () => {
    const out = run({ Err_ExtTimeout: 1, Cmd_Reset: 1 });
    expect(out.Err_ExtTimeout).toBe(0);
  });

  it('clears retract timeout on reset', () => {
    const out = run({ Err_RetTimeout: 1, Cmd_Reset: 1 });
    expect(out.Err_RetTimeout).toBe(0);
  });
});`,
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

export const exampleMotorControlSTAOI = convertToRuntimeAOI(motorControlSTDefinition);
export const exampleMotorControlLDAOI = convertToRuntimeAOI(motorControlLDDefinition);
export const exampleTrafficLightSTAOI = convertToRuntimeAOI(trafficLightSTDefinition);
export const exampleTrafficLightLDAOI = convertToRuntimeAOI(trafficLightLDDefinition);
export const exampleTankLevelSTAOI = convertToRuntimeAOI(tankLevelDefinition);
export const exampleCylinderLDAOI = convertToRuntimeAOI(cylinderDefinition);
export const exampleTankLevelLDAOI = convertToRuntimeAOI(tankLevelLDDefinition);
export const exampleCylinderSTAOI = convertToRuntimeAOI(cylinderSTDefinition);

export const exampleAOIs: AOIDefinition[] = [
  exampleCylinderSTAOI,
  exampleCylinderLDAOI,
  exampleMotorControlSTAOI,
  exampleMotorControlLDAOI,
  exampleTrafficLightSTAOI,
  exampleTrafficLightLDAOI,
  exampleTankLevelSTAOI,
  exampleTankLevelLDAOI,
];

export function getFirstTimeExampleAOI(): AOIDefinition {
  const candidates = [exampleMotorControlLDAOI, exampleTankLevelLDAOI];
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

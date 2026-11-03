import { describe, it, expect, AOITestKit } from './test-helper.js';

const MotorControlAOI = {
  name: 'MotorControl_LD',
  description: 'Start-stop motor control with fault handling (Ladder Diagram)',
  tags: [
    { name: 'StartButton', dataType: 'BOOL' },
    { name: 'StopButton', dataType: 'BOOL' },
    { name: 'OverloadTrip', dataType: 'BOOL' },
    { name: 'ResetFault', dataType: 'BOOL' },
    { name: 'MotorRun', dataType: 'BOOL' },
    { name: 'FaultActive', dataType: 'BOOL' }
  ],
  routines: {
    Logic: {
      type: 'ld',
      content: `[XIC(StartButton),XIC(MotorRun)]XIO(StopButton)XIO(OverloadTrip)XIO(FaultActive)OTE(MotorRun);[XIC(OverloadTrip),XIC(FaultActive)]XIO(ResetFault)OTE(FaultActive)`
    }
  }
};

describe('MotorControl AOI', () => {
    const kit = new AOITestKit(MotorControlAOI);
    const runMotor = (inputs = {}) => kit.run(inputs).outputs;

    it('latches run on start', () => {
        const outputs = runMotor({ StartButton: 1 });
        expect(outputs.MotorRun).toBe(1);
        expect(outputs.FaultActive).toBe(0);
    });

    it('drops run on stop', () => {
        // Need to simulate "was running" for stop to have effect, but this logic is stateless per scan unless we preserve state?
        // Wait, MotorRun is an output but used as a seal-in. The runner re-initializes vars each run unless we pass previous state.
        // For these simple unit tests, passing "MotorRun: 1" simulates the latch being active.
        const outputs = runMotor({ StartButton: 0, StopButton: 1, MotorRun: 1 });
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

    it('cannot start motor if fault is active', () => {
        const outputs = runMotor({ FaultActive: 1, StartButton: 1 });
        expect(outputs.MotorRun).toBe(0);
    });
});

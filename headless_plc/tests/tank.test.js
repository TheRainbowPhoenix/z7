import { describe, it, expect, AOITestKit } from './test-helper.js';

const TankLevelAOI = {
  name: 'TankLevel_LD',
  description: 'Tank level simulation with manual valve control and alarms (Ladder Diagram)',
  tags: [
    { name: 'FillCmd', dataType: 'BOOL' },
    { name: 'DrainCmd', dataType: 'BOOL' },
    { name: 'Level', dataType: 'REAL', defaultValue: 50.0 },
    { name: 'HighAlarm', dataType: 'BOOL' },
    { name: 'LowAlarm', dataType: 'BOOL' },
    { name: 'FillRate', dataType: 'REAL', defaultValue: 1.3 },
    { name: 'DrainRate', dataType: 'REAL', defaultValue: 0.9 }
  ],
  routines: {
    Logic: {
      type: 'ld',
      content: `XIC(FillCmd)ADD(Level,FillRate,Level);XIC(DrainCmd)SUB(Level,DrainRate,Level);GT(Level,100.0)MOVE(100.0,Level);LT(Level,0.0)MOVE(0.0,Level);GE(Level,80.0)OTE(HighAlarm);LE(Level,20.0)OTE(LowAlarm)`
    }
  }
};

describe('TankLevel AOI', () => {
    const kit = new AOITestKit(TankLevelAOI);
    const runTank = (overrides = {}) => kit.run(overrides).outputs;

    it('increases level when fill command is active', () => {
        const outputs = runTank({ FillCmd: 1, Level: 50.0 });
        expect(outputs.Level).toBeGreaterThan(50.0);
    });

    it('decreases level when drain command is active', () => {
        const outputs = runTank({ DrainCmd: 1, Level: 50.0 });
        expect(outputs.Level).toBeLessThan(50.0);
    });

    it('clamps level at 100%', () => {
        const outputs = runTank({ FillCmd: 1, Level: 100.0 });
        expect(outputs.Level).toBe(100.0);
    });

    it('clamps level at 0%', () => {
        const outputs = runTank({ DrainCmd: 1, Level: 0.0 });
        expect(outputs.Level).toBe(0.0);
    });

    it('triggers high alarm at 80%', () => {
        const outputs = runTank({ Level: 80.0 });
        expect(outputs.HighAlarm).toBe(1);
    });

    it('triggers low alarm at 20%', () => {
        const outputs = runTank({ Level: 20.0 });
        expect(outputs.LowAlarm).toBe(1);
    });
});

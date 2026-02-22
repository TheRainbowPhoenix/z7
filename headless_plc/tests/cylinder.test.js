
import { describe, it, expect, AOITestKit } from './test-helper.js';

const CylinderAOI = {
  name: 'Cylinder_LD',
  description: 'Pneumatic cylinder control with extend/retract sensors and timeouts',
  tags: [
    { name: 'In_ExtSensor', dataType: 'BOOL' },
    { name: 'In_RetSensor', dataType: 'BOOL' },
    { name: 'Cmd_Extend', dataType: 'BOOL' },
    { name: 'Cmd_Retract', dataType: 'BOOL' },
    { name: 'Cmd_Reset', dataType: 'BOOL' },
    { name: 'Val_ExtTime', dataType: 'DINT', defaultValue: 5000 },
    { name: 'Val_RetTime', dataType: 'DINT', defaultValue: 5000 },
    { name: 'Out_Extend', dataType: 'BOOL' },
    { name: 'Out_Retract', dataType: 'BOOL' },
    { name: 'Sts_Extended', dataType: 'BOOL' },
    { name: 'Sts_Retracted', dataType: 'BOOL' },
    { name: 'Err_ExtTimeout', dataType: 'BOOL' },
    { name: 'Err_RetTimeout', dataType: 'BOOL' },
    { name: 'Tmr_Ext', dataType: 'TIMER', defaultValue: { PRE: 5000 } },
    { name: 'Tmr_Ret', dataType: 'TIMER', defaultValue: { PRE: 5000 } }
  ],
  routines: {
    Logic: {
      type: 'ld',
      content: `XIC(Cmd_Extend)OTU(Out_Retract)OTL(Out_Extend);XIC(Cmd_Retract)OTU(Out_Extend)OTL(Out_Retract);XIC(In_ExtSensor)OTE(Sts_Extended);XIC(In_RetSensor)OTE(Sts_Retracted);XIC(Out_Extend)XIO(Sts_Extended)XIO(Cmd_Reset)MOVE(Val_ExtTime,Tmr_Ext.PRE)TON(Tmr_Ext,?,?);[XIC(Tmr_Ext.DN),XIC(Err_ExtTimeout)]XIO(Cmd_Reset)OTE(Err_ExtTimeout);XIC(Out_Retract)XIO(Sts_Retracted)XIO(Cmd_Reset)MOVE(Val_RetTime,Tmr_Ret.PRE)TON(Tmr_Ret,?,?);[XIC(Tmr_Ret.DN),XIC(Err_RetTimeout)]XIO(Cmd_Reset)OTE(Err_RetTimeout)`
    }
  }
};

describe('Cylinder AOI', () => {
    const kit = new AOITestKit(CylinderAOI);
    const run = (inputs = {}) => kit.run(inputs).outputs;

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
});

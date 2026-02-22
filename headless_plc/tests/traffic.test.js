import { describe, it, expect, AOITestKit } from './test-helper.js';

const TrafficLightAOI = {
  name: 'TrafficLight_LD',
  description: 'Traffic light sequence using TIMER instruction (Ladder Diagram)',
  tags: [
    { name: 'WalkRequest', dataType: 'BOOL' },
    { name: 'GreenLight', dataType: 'BOOL' },
    { name: 'YellowLight', dataType: 'BOOL' },
    { name: 'RedLight', dataType: 'BOOL' },
    { name: 'WalkSign', dataType: 'BOOL' },
    { name: 'PhaseTimer', dataType: 'TIMER', defaultValue: { PRE: 9000 } },
    { name: 'CycleActive', dataType: 'BOOL' }
  ],
  routines: {
    Logic: {
      type: 'ld',
      content: `XIC(WalkRequest)OTL(CycleActive);XIC(CycleActive)TON(PhaseTimer,?,?)XIC(PhaseTimer.DN)OTU(CycleActive);XIC(CycleActive)LT(PhaseTimer.ACC,1000)OTE(YellowLight);XIC(CycleActive)GE(PhaseTimer.ACC,1000)LT(PhaseTimer.ACC,6000)OTE(RedLight);[XIO(CycleActive),GE(PhaseTimer.ACC,6000)]OTE(GreenLight);XIC(RedLight)OTE(WalkSign)`
    }
  }
};

describe('TrafficLight AOI', () => {
    const kit = new AOITestKit(TrafficLightAOI);
    const runLight = (inputs = {}) => kit.run(inputs).outputs;

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
        // Assuming CycleActive is 1, timer starts.
        // If WalkRequest is pressed, CycleActive is Latched (OTL). It stays 1.
        expect(outputs.YellowLight).toBe(1); // Because timer ACC < 1000 initially
    });

    it('walk sign follows red light', () => {
        // Force red light condition
        const outputs = runLight({ CycleActive: 1, PhaseTimer: { ACC: 2000, PRE: 9000, EN: 1 } });
        expect(outputs.RedLight).toBe(1);
        expect(outputs.WalkSign).toBe(1);
    });

    it('only one light active at a time when idle', () => {
        const outputs = runLight({});
        const activeCount = (outputs.GreenLight ? 1 : 0) + (outputs.YellowLight ? 1 : 0) + (outputs.RedLight ? 1 : 0);
        expect(activeCount).toBe(1);
    });
});

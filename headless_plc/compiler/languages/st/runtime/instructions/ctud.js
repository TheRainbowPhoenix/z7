const COUNTER_STATE_PROP = '__ctudState';
let currentVersion = 0;
const DINT_MAX = 2147483647;
const DINT_MIN = -2147483648;
const toNumericBool = (value, fallback = 0) => {
    if (value === 1 || value === true)
        return 1;
    if (value === 0 || value === false)
        return 0;
    if (typeof value === 'string') {
        const upper = value.trim().toUpperCase();
        if (upper === '1' || upper === 'TRUE')
            return 1;
        if (upper === '0' || upper === 'FALSE')
            return 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.abs(value) > 0 ? 1 : 0;
    }
    return fallback;
};
const toDint = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return 0;
};
function getCounterState(counter) {
    const record = counter;
    const existing = record[COUNTER_STATE_PROP];
    if (existing && existing.version === currentVersion) {
        return existing;
    }
    const state = { lastCuEnable: 0, lastCdEnable: 0, version: currentVersion };
    record[COUNTER_STATE_PROP] = state;
    return state;
}
export function ctud(counter) {
    if (typeof counter !== 'object' || counter == null) {
        throw new Error('CTUD expects a counter structure');
    }
    const state = getCounterState(counter);
    const enableIn = toNumericBool(counter.EnableIn ?? 1);
    const cuEnable = toNumericBool(counter.CUEnable);
    const cdEnable = toNumericBool(counter.CDEnable);
    const preset = toDint(counter.PRE);
    const reset = toNumericBool(counter.Reset);
    let accumulator = toDint(counter.ACC);
    let overflow = 0;
    let underflow = 0;
    const activeCu = enableIn ? cuEnable : 0;
    const activeCd = enableIn ? cdEnable : 0;
    if (reset) {
        accumulator = 0;
        overflow = 0;
        underflow = 0;
        state.lastCuEnable = 0;
        state.lastCdEnable = 0;
    }
    else if (enableIn) {
        const cuRising = activeCu === 1 && state.lastCuEnable === 0;
        const cdRising = activeCd === 1 && state.lastCdEnable === 0;
        const delta = (cuRising ? 1 : 0) - (cdRising ? 1 : 0);
        if (delta !== 0) {
            accumulator += delta;
            if (accumulator > DINT_MAX) {
                accumulator = DINT_MIN;
                overflow = 1;
            }
            else if (accumulator < DINT_MIN) {
                accumulator = DINT_MAX;
                underflow = 1;
            }
        }
        state.lastCuEnable = activeCu;
        state.lastCdEnable = activeCd;
    }
    else {
        state.lastCuEnable = 0;
        state.lastCdEnable = 0;
    }
    const done = accumulator >= preset ? 1 : 0;
    counter.EnableIn = enableIn;
    counter.CUEnable = cuEnable;
    counter.CDEnable = cdEnable;
    counter.PRE = preset;
    counter.Reset = reset;
    counter.ACC = accumulator;
    counter.EnableOut = enableIn;
    counter.CU = activeCu;
    counter.CD = activeCd;
    counter.DN = reset ? 0 : done;
    counter.OV = reset ? 0 : overflow;
    counter.UN = reset ? 0 : underflow;
    return counter;
}
export function resetCtudState() {
    currentVersion += 1;
}

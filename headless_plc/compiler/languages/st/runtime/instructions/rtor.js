const toNumericBool = (value) => {
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
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return Math.abs(value) > 0 ? 1 : 0;
    }
    return 0;
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
export function rtor(timer, scanTime) {
    if (typeof timer !== 'object' || timer == null) {
        throw new Error('RTOR expects a timer structure');
    }
    const enableIn = toNumericBool(timer.EnableIn ?? 1);
    const timerEnable = toNumericBool(timer.TimerEnable ?? enableIn);
    const enabled = enableIn && timerEnable ? 1 : 0;
    timer.EnableIn = enableIn;
    timer.TimerEnable = timerEnable;
    const rawPreset = toDint(timer.PRE);
    const presetInvalid = rawPreset < 0;
    const preset = presetInvalid ? 0 : rawPreset;
    timer.PRE = preset;
    const reset = toNumericBool(timer.Reset ?? 0);
    timer.Reset = reset;
    let accumulator = Math.max(0, toDint(timer.ACC));
    if (preset >= 0) {
        accumulator = Math.min(accumulator, preset);
    }
    let instructFault = 0;
    let presetInv = 0;
    if (presetInvalid) {
        instructFault = 1;
        presetInv = 1;
        accumulator = 0;
    }
    else if (reset) {
        accumulator = 0;
    }
    else if (enabled) {
        if (preset === 0) {
            accumulator = 0;
        }
        else {
            accumulator = Math.min(preset, accumulator + scanTime);
        }
    }
    const active = presetInvalid || reset ? 0 : enabled;
    const done = reset
        ? 0
        : presetInvalid
            ? 0
            : accumulator >= preset
                ? 1
                : 0;
    const timing = presetInvalid || reset ? 0 : active && accumulator < preset ? 1 : 0;
    timer.ACC = accumulator;
    timer.EnableOut = presetInvalid ? 0 : enableIn;
    timer.EN = presetInvalid || reset ? 0 : enabled ? 1 : 0;
    timer.TT = timing;
    timer.DN = done;
    timer.Status = (instructFault ? 1 : 0) | (presetInv ? 0b10 : 0);
    timer.InstructFault = instructFault;
    timer.PresetInv = presetInv;
    return timer;
}

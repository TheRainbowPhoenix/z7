export const TIMER_MEMBERS = [
    { key: 'PRE', type: 'DINT' },
    { key: 'ACC', type: 'DINT' },
    { key: 'EN', type: 'BOOL' },
    { key: 'TT', type: 'BOOL' },
    { key: 'DN', type: 'BOOL' },
];
export const COUNTER_MEMBERS = [
    { key: 'PRE', type: 'DINT' },
    { key: 'ACC', type: 'DINT' },
    { key: 'CU', type: 'BOOL' },
    { key: 'CD', type: 'BOOL' },
    { key: 'DN', type: 'BOOL' },
    { key: 'OV', type: 'BOOL' },
    { key: 'UN', type: 'BOOL' },
];
export const FBD_TIMER_MEMBERS = [
    { key: 'EnableIn', type: 'BOOL' },
    { key: 'TimerEnable', type: 'BOOL' },
    { key: 'PRE', type: 'DINT' },
    { key: 'Reset', type: 'BOOL' },
    { key: 'EnableOut', type: 'BOOL' },
    { key: 'ACC', type: 'DINT' },
    { key: 'EN', type: 'BOOL' },
    { key: 'TT', type: 'BOOL' },
    { key: 'DN', type: 'BOOL' },
    { key: 'Status', type: 'DINT' },
    { key: 'InstructFault', type: 'BOOL' },
    { key: 'PresetInv', type: 'BOOL' },
];
export const FBD_COUNTER_MEMBERS = [
    { key: 'EnableIn', type: 'BOOL' },
    { key: 'CUEnable', type: 'BOOL' },
    { key: 'CDEnable', type: 'BOOL' },
    { key: 'PRE', type: 'DINT' },
    { key: 'Reset', type: 'BOOL' },
    { key: 'EnableOut', type: 'BOOL' },
    { key: 'ACC', type: 'DINT' },
    { key: 'CU', type: 'BOOL' },
    { key: 'CD', type: 'BOOL' },
    { key: 'DN', type: 'BOOL' },
    { key: 'OV', type: 'BOOL' },
    { key: 'UN', type: 'BOOL' },
];
const DINT_BIT_MEMBERS = Array.from({ length: 32 }, (_, bitIndex) => ({
    key: String(bitIndex),
    type: 'BOOL',
}));
export function parseTagMemberAccessBase(value) {
    const match = value.match(/^([a-zA-Z_]\w*)(?:\[(\d+)\])?$/);
    if (!match)
        return null;
    return {
        tagName: match[1],
        indexText: match[2] ?? null,
    };
}
export function getAvailableDataTypes(usage) {
    if (usage === 'input' || usage === 'output') {
        return ['BOOL', 'DINT', 'REAL'];
    }
    return ['BOOL', 'DINT', 'REAL', 'TIMER', 'COUNTER', 'FBD_TIMER', 'FBD_COUNTER'];
}
export function isDataTypeAvailableForUsage(dataType, usage) {
    const availableTypes = getAvailableDataTypes(usage);
    return availableTypes.includes(dataType);
}
export function isUsageAvailableForDataType(usage, dataType) {
    if (dataType === 'TIMER' || dataType === 'COUNTER' || dataType === 'FBD_TIMER' || dataType === 'FBD_COUNTER') {
        return usage === 'local';
    }
    return true;
}
export function isArrayTag(tag) {
    if ('dimension' in tag && tag.dimension !== undefined)
        return true;
    return Array.isArray(tag.value);
}
export function isStructuredTag(tag) {
    return isArrayTag(tag) || tag.dataType === 'TIMER' || tag.dataType === 'COUNTER' || tag.dataType === 'FBD_TIMER' || tag.dataType === 'FBD_COUNTER';
}
export function getMembersForDataType(dataType) {
    switch (dataType) {
        case 'TIMER':
            return TIMER_MEMBERS;
        case 'COUNTER':
            return COUNTER_MEMBERS;
        case 'FBD_TIMER':
            return FBD_TIMER_MEMBERS;
        case 'FBD_COUNTER':
            return FBD_COUNTER_MEMBERS;
        default:
            return [];
    }
}
export function getMemberCompletionsForDataType(dataType) {
    if (dataType === 'DINT') {
        return DINT_BIT_MEMBERS;
    }
    return getMembersForDataType(dataType);
}
export function getTagMembers(tag) {
    if (isArrayTag(tag)) {
        const totalLength = tag.dimension ?? 0;
        if (!totalLength || totalLength <= 0) {
            return [];
        }
        return Array.from({ length: totalLength }, (_, index) => ({
            key: `[${index}]`,
            type: tag.dataType,
        }));
    }
    if (tag.dataType === 'DINT') {
        return DINT_BIT_MEMBERS;
    }
    if (tag.usage !== 'local') {
        return [];
    }
    return getMembersForDataType(tag.dataType);
}
export function getTagMemberValue(tag, memberKey) {
    const defaultValue = tag.defaultValue;
    const isZeroLike = (value) => value === 0 || value === undefined || value === null;
    const isZeroLikeObject = (value) => {
        if (!value || typeof value !== 'object')
            return false;
        const entries = Object.values(value);
        if (entries.length === 0)
            return true;
        return entries.every((entry) => {
            if (isZeroLike(entry))
                return true;
            if (typeof entry === 'object')
                return isZeroLikeObject(entry);
            return false;
        });
    };
    if (memberKey.startsWith('[') && memberKey.endsWith(']')) {
        if (!isArrayTag(tag)) {
            return undefined;
        }
        const index = Number.parseInt(memberKey.slice(1, -1), 10);
        const elementValue = tag.elements?.[String(index)]?.defaultValue;
        if (elementValue !== undefined) {
            if (isZeroLike(elementValue) || isZeroLikeObject(elementValue)) {
                return undefined;
            }
            return elementValue;
        }
        return undefined;
    }
    if (tag.dataType === 'DINT' && /^\d+$/.test(memberKey)) {
        const bitIndex = Number(memberKey);
        if (Number.isInteger(bitIndex) && bitIndex >= 0 && bitIndex <= 31) {
            const dintValue = typeof defaultValue === 'number' ? Math.trunc(defaultValue) : 0;
            return ((dintValue >>> bitIndex) & 1) === 1 ? 1 : undefined;
        }
        return undefined;
    }
    if (defaultValue &&
        typeof defaultValue === 'object' &&
        !Array.isArray(defaultValue) &&
        !isZeroLikeObject(defaultValue) &&
        memberKey in defaultValue) {
        const value = defaultValue[memberKey];
        if (isZeroLike(value) || isZeroLikeObject(value)) {
            return undefined;
        }
        return value;
    }
    return undefined;
}

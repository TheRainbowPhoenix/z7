const instructionDefs = [
    {
        mnemonic: 'XIC',
        params: [{ name: 'bit', dataTypes: ['BOOL'], usage: 'in' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'XIO',
        params: [{ name: 'bit', dataTypes: ['BOOL'], usage: 'in' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'ONS',
        params: [{ name: 'storageBit', dataTypes: ['BOOL'], usage: 'inout' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'OTE',
        params: [{ name: 'bit', dataTypes: ['BOOL'], usage: 'out' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'OTL',
        params: [{ name: 'bit', dataTypes: ['BOOL'], usage: 'out' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'OTU',
        params: [{ name: 'bit', dataTypes: ['BOOL'], usage: 'out' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'TON',
        params: [
            { name: 'timer', dataTypes: ['TIMER'], usage: 'inout' },
            { name: 'preset', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
            { name: 'accum', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'TOF',
        params: [
            { name: 'timer', dataTypes: ['TIMER'], usage: 'inout' },
            { name: 'preset', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
            { name: 'accum', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'RTO',
        params: [
            { name: 'timer', dataTypes: ['TIMER'], usage: 'inout' },
            { name: 'preset', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
            { name: 'accum', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'CTU',
        params: [
            { name: 'counter', dataTypes: ['COUNTER'], usage: 'inout' },
            { name: 'preset', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
            { name: 'accum', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'CTD',
        params: [
            { name: 'counter', dataTypes: ['COUNTER'], usage: 'inout' },
            { name: 'preset', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
            { name: 'accum', dataTypes: ['DINT'], usage: 'in', defaultValue: 0 },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'RES',
        params: [{ name: 'structure', dataTypes: ['TIMER', 'COUNTER'], usage: 'inout' }],
        languages: ['LD'],
    },
    {
        mnemonic: 'MOVE',
        params: [
            { name: 'source', dataTypes: ['BOOL', 'DINT', 'REAL'], usage: 'in' },
            { name: 'dest', dataTypes: ['BOOL', 'DINT', 'REAL'], usage: 'out' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'ADD',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'dest', dataTypes: ['DINT', 'REAL'], usage: 'out' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'SUB',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'dest', dataTypes: ['DINT', 'REAL'], usage: 'out' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'MUL',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'dest', dataTypes: ['DINT', 'REAL'], usage: 'out' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'DIV',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'dest', dataTypes: ['DINT', 'REAL'], usage: 'out' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'EQ',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'NE',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'GT',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'GE',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'LT',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'LE',
        params: [
            { name: 'sourceA', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'sourceB', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'LIMIT',
        params: [
            { name: 'lowLimit', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'test', dataTypes: ['DINT', 'REAL'], usage: 'in' },
            { name: 'highLimit', dataTypes: ['DINT', 'REAL'], usage: 'in' },
        ],
        languages: ['LD'],
    },
    {
        mnemonic: 'TONR',
        params: [{ name: 'timer', dataTypes: ['FBD_TIMER'], usage: 'inout' }],
        languages: ['ST'],
    },
    {
        mnemonic: 'TOFR',
        params: [{ name: 'timer', dataTypes: ['FBD_TIMER'], usage: 'inout' }],
        languages: ['ST'],
    },
    {
        mnemonic: 'RTOR',
        params: [{ name: 'timer', dataTypes: ['FBD_TIMER'], usage: 'inout' }],
        languages: ['ST'],
    },
    {
        mnemonic: 'CTUD',
        params: [{ name: 'counter', dataTypes: ['FBD_COUNTER'], usage: 'inout' }],
        languages: ['ST'],
    },
];
export const INSTRUCTION_REGISTRY = new Map(instructionDefs.map((def) => [def.mnemonic, def]));
export const getInstruction = (mnemonic) => INSTRUCTION_REGISTRY.get(mnemonic.toUpperCase());

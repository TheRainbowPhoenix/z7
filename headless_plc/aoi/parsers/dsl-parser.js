import { TagDefinitionSchema, AOIDefinitionSchema } from '../../core/index.js';
import { parseAOIWithChevrotain } from './chevrotain/index.js';
function buildRoutinesObject(parsedRoutines) {
    const routines = {};
    for (const routine of parsedRoutines) {
        const routineDef = {
            type: routine.type,
            content: routine.content,
            description: routine.description,
        };
        if (routine.name === 'Logic') {
            routines.Logic = routineDef;
        }
        else if (routine.name === 'Prescan') {
            routines.Prescan = routineDef;
        }
        else if (routine.name === 'EnableInFalse') {
            routines.EnableInFalse = routineDef;
        }
    }
    if (!routines.Logic) {
        routines.Logic = {
            type: 'st',
            content: '',
        };
    }
    return routines;
}
function convertParsedAOIToDefinition(parsedAOI, diagnostics) {
    const now = new Date().toISOString();
    const tags = [];
    for (const tag of parsedAOI.tags) {
        const rawTag = {
            name: tag.name,
            dataType: tag.dataType,
            usage: tag.usage,
            description: tag.description,
            defaultValue: tag.defaultValue,
            dimension: tag.dimension,
            elements: tag.elements,
        };
        const result = TagDefinitionSchema.safeParse(rawTag);
        if (result.success) {
            tags.push(result.data);
        }
        else {
            diagnostics.push({
                type: 'error',
                message: `Unsupported data type "${tag.dataType}" for tag "${tag.name}"`,
                field: 'tags',
            });
        }
    }
    return AOIDefinitionSchema.parse({
        name: parsedAOI.name,
        description: parsedAOI.description,
        tags,
        routines: buildRoutinesObject(parsedAOI.routines),
        metadata: {
            created: now,
            modified: now,
        },
    });
}
function convertDiagnostics(chevrotainDiags) {
    return chevrotainDiags.map((diag) => ({
        type: diag.type,
        message: diag.message,
        field: diag.field,
    }));
}
export function parseJson(text) {
    const parsed = JSON.parse(text);
    return AOIDefinitionSchema.parse(parsed);
}
export function parseDsl(text) {
    return parseDslWithDiagnostics(text).aoi;
}
export function parseDslWithDiagnostics(text) {
    const result = parseAOIWithChevrotain(text);
    const diagnostics = convertDiagnostics(result.diagnostics);
    return {
        aoi: convertParsedAOIToDefinition(result.aoi, diagnostics),
        diagnostics,
    };
}

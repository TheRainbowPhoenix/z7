import * as yaml from 'js-yaml';
import { AOIDefinitionSchema } from '@repo/plc-core';
import { RUNGS_FORMAT_VERSION, isCompatibleVersion } from '../utils/format-version.js';
export function parseRungs(yamlContent) {
    const diagnostics = [];
    try {
        const rungsFile = yaml.load(yamlContent);
        if (!rungsFile || typeof rungsFile !== 'object') {
            throw new Error('Invalid YAML structure');
        }
        if (!rungsFile.version) {
            diagnostics.push({
                type: 'warning',
                message: 'Missing version field, assuming current version',
                field: 'version',
            });
        }
        else if (!isCompatibleVersion(rungsFile.version)) {
            throw new Error(`File version ${rungsFile.version} is newer than supported version ${RUNGS_FORMAT_VERSION}. Please update your tools.`);
        }
        if (!rungsFile.aoi || typeof rungsFile.aoi !== 'object') {
            throw new Error('Missing or invalid AOI definition');
        }
        if (!rungsFile.aoi.name) {
            throw new Error('AOI name is required');
        }
        const tags = [];
        const groupedTags = rungsFile.aoi.tags;
        if (groupedTags && typeof groupedTags === 'object') {
            const usageOrder = ['input', 'output', 'local'];
            for (const usage of usageOrder) {
                const usageTags = groupedTags[usage];
                if (usageTags && Array.isArray(usageTags)) {
                    for (const tag of usageTags) {
                        tags.push({
                            ...tag,
                            usage,
                        });
                    }
                }
            }
        }
        const routines = {};
        const routineNames = ['Logic', 'Prescan', 'EnableInFalse'];
        if (rungsFile.aoi.routines && typeof rungsFile.aoi.routines === 'object') {
            for (const routineName of routineNames) {
                const routine = rungsFile.aoi.routines[routineName];
                if (!routine)
                    continue;
                const routineType = (routine.type?.toLowerCase() ?? 'st');
                routines[routineName] = {
                    type: routineType,
                    content: routine.content || '',
                    ...(routine.description && { description: routine.description }),
                };
                diagnostics.push({
                    type: 'info',
                    message: `Added ${routine.type || 'st'} routine "${routineName}"`,
                });
            }
        }
        if (!routines.Logic) {
            routines.Logic = { type: 'st', content: '' };
            diagnostics.push({
                type: 'info',
                message: 'Added default Logic routine',
            });
        }
        const now = new Date().toISOString();
        const aoi = AOIDefinitionSchema.parse({
            name: rungsFile.aoi.name,
            description: rungsFile.aoi.description || '',
            tags,
            routines,
            metadata: {
                created: now,
                modified: now,
            },
            testing: rungsFile.aoi.testing,
        });
        diagnostics.push({
            type: 'info',
            message: `Successfully parsed AOI "${aoi.name}" from .rungs format`,
        });
        return { aoi, diagnostics };
    }
    catch (error) {
        diagnostics.push({
            type: 'error',
            message: `Failed to parse .rungs file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        const fallbackAoi = AOIDefinitionSchema.parse({
            name: 'ParseError',
            description: 'Failed to parse .rungs file',
            tags: [],
            routines: { Logic: { type: 'st', content: '' } },
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
            },
        });
        return { aoi: fallbackAoi, diagnostics };
    }
}

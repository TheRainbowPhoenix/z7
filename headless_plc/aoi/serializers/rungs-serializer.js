import * as yaml from 'js-yaml';
import { RUNGS_FORMAT_VERSION } from '../utils/format-version.js';
export function serializeToRungs(aoi) {
    const routines = {
        Logic: {
            type: aoi.routines.Logic.type,
            content: aoi.routines.Logic.content,
            ...(aoi.routines.Logic.description && { description: aoi.routines.Logic.description }),
        },
    };
    if (aoi.routines.Prescan) {
        routines.Prescan = {
            type: aoi.routines.Prescan.type,
            content: aoi.routines.Prescan.content,
            ...(aoi.routines.Prescan.description && { description: aoi.routines.Prescan.description }),
        };
    }
    if (aoi.routines.EnableInFalse) {
        routines.EnableInFalse = {
            type: aoi.routines.EnableInFalse.type,
            content: aoi.routines.EnableInFalse.content,
            ...(aoi.routines.EnableInFalse.description && {
                description: aoi.routines.EnableInFalse.description,
            }),
        };
    }
    const omit = (obj, ...keys) => {
        const result = { ...obj };
        for (const key of keys)
            delete result[key];
        return result;
    };
    const usageOrder = ['input', 'output', 'local'];
    const tags = {};
    for (const usage of usageOrder) {
        const usageTags = aoi.tags.filter((tag) => tag.usage === usage);
        if (usageTags.length > 0) {
            tags[usage] = usageTags.map((tag) => omit(tag, 'id', 'usage'));
        }
    }
    const rungsFile = {
        version: RUNGS_FORMAT_VERSION,
        aoi: {
            name: aoi.name,
            description: aoi.description,
            tags,
            routines,
        },
    };
    if (aoi.testing) {
        rungsFile.aoi.testing = { content: aoi.testing.content };
    }
    const yamlOptions = {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
        flowLevel: -1,
    };
    return yaml.dump(rungsFile, yamlOptions);
}

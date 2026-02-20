export const RUNGS_FORMAT_VERSION = 2;
export function isCompatibleVersion(version) {
    return typeof version === 'number' && version <= RUNGS_FORMAT_VERSION;
}

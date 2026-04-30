const GROUP_PREFIX = 'GROUP_';

export const isGroupId = (rawId) => {
    return String(rawId || '').toUpperCase().startsWith(GROUP_PREFIX);
};

export const normalizeComponentId = (rawId) => {
    const value = String(rawId || '').trim();
    return value ? value.toLowerCase() : '';
};

export const normalizeGroupCandidateId = (rawId) => {
    const value = String(rawId || '').trim();
    return isGroupId(value) ? value.toUpperCase() : '';
};

export const resolveGroupKey = (rawId, componentGroups = {}) => {
    const value = String(rawId || '').trim();
    if (!value) return '';

    const groups = componentGroups && typeof componentGroups === 'object' ? componentGroups : {};
    const matchedKey = Object.keys(groups).find(groupKey => groupKey.toLowerCase() === value.toLowerCase());
    return matchedKey || normalizeGroupCandidateId(value);
};

export const normalizeSelectionId = (rawId, componentGroups = {}) => {
    const resolvedGroupKey = resolveGroupKey(rawId, componentGroups);
    if (resolvedGroupKey) {
        return resolvedGroupKey;
    }

    return normalizeComponentId(rawId) || null;
};

export const getSafeEntityId = (rawId) => {
    return normalizeGroupCandidateId(rawId) || normalizeComponentId(rawId);
};
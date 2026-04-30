const cloneValue = (value) => JSON.parse(JSON.stringify(value));

export const createTopologyDocument = (structureData = {}) => ({
    version: '1.0.0',
    components: cloneValue(Array.isArray(structureData?.components) ? structureData.components : []),
    connections: cloneValue(Array.isArray(structureData?.connections) ? structureData.connections : [])
});

export const normalizeTopologyDocument = (document = {}) => ({
    version: document?.version || '1.0.0',
    components: Array.isArray(document?.components) ? document.components : [],
    connections: Array.isArray(document?.connections) ? document.connections : []
});
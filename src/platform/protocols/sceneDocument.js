import { createTopologyDocument, normalizeTopologyDocument } from './topologyDocument';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

export const createSceneDocument = ({
    projectId = '',
    structureData = {},
    modelConfig = {},
    annotations = {},
    componentGroups = {},
    expandedGroupId = null,
    viewMode = '3d'
} = {}) => ({
    version: '1.0.0',
    metadata: {
        projectId,
        viewMode
    },
    topology: createTopologyDocument(structureData),
    visual: {
        modelConfig: cloneValue(modelConfig || {}),
        annotations: cloneValue(annotations || {}),
        componentGroups: cloneValue(componentGroups || {}),
        expandedGroupId: expandedGroupId || null
    }
});

export const normalizeSceneDocument = (document = {}) => ({
    version: document?.version || '1.0.0',
    metadata: {
        projectId: document?.metadata?.projectId || '',
        viewMode: document?.metadata?.viewMode || '3d'
    },
    topology: normalizeTopologyDocument(document?.topology),
    visual: {
        modelConfig: document?.visual?.modelConfig || {},
        annotations: document?.visual?.annotations || {},
        componentGroups: document?.visual?.componentGroups || {},
        expandedGroupId: document?.visual?.expandedGroupId || null
    }
});

export const cloneSceneDocument = (document = {}) => createSceneDocument({
    projectId: document?.metadata?.projectId,
    structureData: document?.topology,
    modelConfig: document?.visual?.modelConfig,
    annotations: document?.visual?.annotations,
    componentGroups: document?.visual?.componentGroups,
    expandedGroupId: document?.visual?.expandedGroupId,
    viewMode: document?.metadata?.viewMode
});
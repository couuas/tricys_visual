import { ref } from 'vue';
import { projectApi } from '../../../api/project';

const CONNECTION_STYLES_KEY = '__connection_styles__';
const defaultConnectionStyle = {
  color: '#FFD700',
  type: 'flow',
  speed: 0.1,
  opacity: 0.9,
  width: 4.0
};

const selectedConnectionId = ref(null);
const connectionStyles = ref({});
const multiSelectedIds = ref(new Set());
const componentGroups = ref({});
const expandedGroupId = ref(null);

export function useSimulationSceneStore({ currentProjectId, modelConfig, structureData }) {
  const persistConnectionStyles = async () => {
    if (!currentProjectId.value) return;
    const mergedConfig = { ...(modelConfig.value || {}) };
    mergedConfig[CONNECTION_STYLES_KEY] = { ...(connectionStyles.value || {}) };
    modelConfig.value = mergedConfig;

    try {
      await projectApi.saveVisualConfig(currentProjectId.value, mergedConfig);
    } catch (error) {
      console.error('Failed to save connection styles', error);
    }
  };

  const hydrateConnectionStyles = () => {
    connectionStyles.value = modelConfig.value?.[CONNECTION_STYLES_KEY] || {};
  };

  const getConnectionStyle = (id) => connectionStyles.value[id] || { ...defaultConnectionStyle };

  const updateConnectionStyle = async (id, style) => {
    connectionStyles.value[id] = { ...defaultConnectionStyle, ...style };
    await persistConnectionStyles();
  };

  const syncAllConnections = async (style) => {
    if (!structureData.value || !structureData.value.connections) return;

    const newStyles = { ...connectionStyles.value };
    if (newStyles.ALL) delete newStyles.ALL;

    structureData.value.connections.forEach((connection) => {
      const id = `${connection.from.toLowerCase()}_${connection.to.toLowerCase()}`;
      newStyles[id] = JSON.parse(JSON.stringify(style));
    });

    connectionStyles.value = newStyles;
    await persistConnectionStyles();
  };

  const toggleMultiSelect = (id) => {
    const newSet = new Set(multiSelectedIds.value);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    multiSelectedIds.value = newSet;
  };

  const clearSelection = () => {
    multiSelectedIds.value.clear();
  };

  const isGroup = (id) => id && id.toUpperCase().startsWith('GROUP_');

  const saveGroups = async () => {
    if (currentProjectId.value) {
      await projectApi.saveGroups(currentProjectId.value, componentGroups.value);
    }
  };

  const createGroup = (customName = null) => {
    if (multiSelectedIds.value.size < 2) return;

    const allChildren = new Set();
    const groupsToDelete = new Set();

    multiSelectedIds.value.forEach((rawId) => {
      const foundGroupKey = Object.keys(componentGroups.value).find(
        (groupKey) => groupKey.toLowerCase() === rawId.toLowerCase()
      );

      if (foundGroupKey) {
        const existingGroup = componentGroups.value[foundGroupKey];
        if (existingGroup && existingGroup.children) {
          existingGroup.children.forEach((child) => allChildren.add(child.toLowerCase()));
          groupsToDelete.add(foundGroupKey);
        }
      } else {
        allChildren.add(rawId.toLowerCase());
      }
    });

    const groupId = `GROUP_${Date.now()}`;
    const childrenArray = Array.from(allChildren);

    componentGroups.value[groupId] = {
      id: groupId,
      name: customName || `Merged System ${Object.keys(componentGroups.value).length + 1}`,
      children: childrenArray,
      expanded: false
    };

    groupsToDelete.forEach((groupIdToDelete) => {
      if (componentGroups.value[groupIdToDelete]) {
        delete componentGroups.value[groupIdToDelete];
      }
      if (expandedGroupId.value === groupIdToDelete) {
        expandedGroupId.value = null;
      }
    });

    clearSelection();
    saveGroups();
    return groupId;
  };

  const dissolveGroup = (groupId) => {
    if (componentGroups.value[groupId]) {
      delete componentGroups.value[groupId];
    }
    if (expandedGroupId.value === groupId) {
      expandedGroupId.value = null;
    }
    saveGroups();
  };

  const setExpandedGroup = (groupId) => {
    expandedGroupId.value = groupId;
  };

  const isExpanded = (groupId) => expandedGroupId.value === groupId;

  const getRenderParentId = (componentId) => {
    const safeCompId = componentId ? componentId.toLowerCase() : '';
    for (const [groupId, group] of Object.entries(componentGroups.value)) {
      if (group.children.includes(safeCompId)) {
        if (expandedGroupId.value === groupId) return safeCompId;
        return groupId;
      }
    }
    return safeCompId;
  };

  const loadGroups = async (projectId = null) => {
    try {
      if (!projectId && !currentProjectId.value) return;
      const groups = await projectApi.getGroups(projectId || currentProjectId.value);
      componentGroups.value = groups || {};
    } catch (error) {
      componentGroups.value = {};
    }
  };

  const resetSceneInteractionState = () => {
    selectedConnectionId.value = null;
    connectionStyles.value = {};
    multiSelectedIds.value.clear();
    componentGroups.value = {};
    expandedGroupId.value = null;
  };

  return {
    componentGroups,
    connectionStyles,
    defaultConnectionStyle,
    expandedGroupId,
    multiSelectedIds,
    selectedConnectionId,
    clearSelection,
    createGroup,
    dissolveGroup,
    getConnectionStyle,
    getRenderParentId,
    hydrateConnectionStyles,
    isExpanded,
    isGroup,
    loadGroups,
    resetSceneInteractionState,
    saveGroups,
    setExpandedGroup,
    syncAllConnections,
    toggleMultiSelect,
    updateConnectionStyle
  };
}
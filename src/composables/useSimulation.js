import { ref, reactive, computed } from 'vue';
import { projectApi } from '../api/project';
import { taskApi } from '../api/task';
import { useAnalysisWorkbenchStore } from '../stores/analysisWorkbench.store';
import { useSimulationSessionStore } from '../stores/simulationSession.store';
import { useAuth } from './useAuth';
import { resolveApiBase, resolveBackendBase } from '../utils/runtimeUrls';

// --- 全局单例状态 (Global State) ---
const isReadOnly = ref(false);
const structureData = ref(null);
const componentParams = ref([]);
const defaultParams = ref([]);
const modelConfig = ref({});
const annotations = ref({});
const libraryModels = ref([]);

const selectedConnectionId = ref(null);
const connectionStyles = ref({});
const defaultConnectionStyle = {
  color: '#FFD700', type: 'flow', speed: 1.0, opacity: 0.9, width: 4.0
};
const CONNECTION_STYLES_KEY = '__connection_styles__';

const multiSelectedIds = ref(new Set());
const componentGroups = ref({});
const expandedGroupId = ref(null);

const graphSelectedIds = ref(new Set(['sds', 'plasma', 'tes']));

const currentProjectId = ref(localStorage.getItem('tricys_last_pid') || null);
const currentProject = ref(null);
const currentTaskId = ref(null);

export function useSimulation() {
  const {
    activeAlert,
    alertRules,
    clearResults: clearSimulationResults,
    currentTime,
    filterSchema,
    hasSimulationData,
    ignoredComponents,
    lastSimConfig,
    normalizeFilterSchema,
    resetSimulationSession,
    showDashboard,
    showLabels,
    simulationData,
    toggleDashboardPref,
    updateDashboardVisibility,
    userPrefersDashboard
  } = useSimulationSessionStore();

  const {
    analysisTasks,
    closeAnalysisDashboard: closeWorkbenchAnalysisDashboard,
    currentAnalysisTask,
    isDashboardMode,
    openAnalysisDashboard: openWorkbenchAnalysisDashboard,
    resetAnalysisWorkbench,
    showAnalysisPanel,
    toggleDashboardMode: toggleWorkbenchDashboardMode
  } = useAnalysisWorkbenchStore();

  const unflattenAndNormalize = (inputData) => {
    const nested = {};
    if (!inputData || typeof inputData !== 'object') return nested;
    for (const [key, val] of Object.entries(inputData)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const compId = key.toLowerCase();
        if (!nested[compId]) nested[compId] = {};
        Object.assign(nested[compId], val);
      } else {
        const parts = key.split('.');
        if (parts.length >= 2) {
          const compId = parts[0].toLowerCase();
          const paramName = parts.slice(1).join('.');
          if (!nested[compId]) nested[compId] = {};
          nested[compId][paramName] = val;
        } else {
          if (!nested['global']) nested['global'] = {};
          nested['global'][key] = val;
        }
      }
    }
    return nested;
  };

  const isParamDifferent = (val1, val2) => {
    if (val1 === undefined && val2 === undefined) return false;
    const str1 = String(val1);
    const str2 = String(val2);
    const num1 = parseFloat(str1);
    const num2 = parseFloat(str2);
    if (!isNaN(num1) && !isNaN(num2)) return Math.abs(num1 - num2) > 1e-9;
    return str1 !== str2;
  };

  const normalizeParamValueForComparison = (value) => {
    if (Array.isArray(value)) return `{${value.join(', ')}}`;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return `{${trimmed.slice(1, -1)}}`;
      }
      return trimmed;
    }
    return value;
  };

  const modifiedParams = computed(() => {
    const diffs = {};
    if (!componentParams.value || !Array.isArray(componentParams.value)) return diffs;

    // Create map of defaults for fast lookup
    const defaultsMap = new Map();
    if (Array.isArray(defaultParams.value)) {
      defaultParams.value.forEach(p => defaultsMap.set(p.name, p.defaultValue));
    }

    componentParams.value.forEach(p => {
      const name = p.name;
      // Parse compId from name (e.g. "wds.T" -> "wds")
      const parts = name.split('.');
      const compId = parts.length > 1 ? parts[0] : 'global';
      const paramKey = parts.length > 1 ? parts.slice(1).join('.') : name;

      const defaultVal = normalizeParamValueForComparison(defaultsMap.get(name));
      const currentVal = normalizeParamValueForComparison(p.value);

      // Compare
      if (isParamDifferent(currentVal, defaultVal)) {
        if (!diffs[compId]) diffs[compId] = {};
        diffs[compId][paramKey] = p.value;
      }
    });

    return diffs;
  });

  const checkAlerts = () => {
    if (!simulationData.value || activeAlert.value) return;
    const timeArr = simulationData.value.time;
    if (!timeArr || timeArr.length === 0) return;
    let idx = -1; const target = currentTime.value; let minDiff = Infinity;
    for (let i = 0; i < timeArr.length; i++) {
      const diff = Math.abs(timeArr[i] - target);
      if (diff < 0.001) { idx = i; break; }
      if (diff < minDiff) { minDiff = diff; idx = i; }
    }
    if (idx === -1) idx = timeArr.length - 1;
    const rules = alertRules.value || {};
    for (const [id, rule] of Object.entries(rules)) {
      const compId = id.toLowerCase();
      if (!rule.enabled || ignoredComponents.has(compId)) continue;
      const values = simulationData.value.components[compId];
      if (!values) continue;
      const val = values[idx];
      let triggered = false;
      if (rule.operator === '<' && val < rule.threshold) triggered = true;
      else if (rule.operator === '>' && val > rule.threshold) triggered = true;
      if (triggered) {
        activeAlert.value = { id: compId, time: currentTime.value.toFixed(2), value: val.toFixed(4), rule: `${rule.operator} ${rule.threshold}` };
        break;
      }
    }
  };

  const scanForAlerts = () => {
    if (!simulationData.value || activeAlert.value) return;
    const timeArr = simulationData.value.time;
    const rules = alertRules.value || {};
    for (const [id, rule] of Object.entries(rules)) {
      const compId = id.toLowerCase();
      if (!rule.enabled || ignoredComponents.has(compId)) continue;
      const values = simulationData.value.components[compId];
      if (!values) continue;
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        let triggered = false;
        if (rule.operator === '<' && val < rule.threshold) triggered = true;
        else if (rule.operator === '>' && val > rule.threshold) triggered = true;
        if (triggered) {
          currentTime.value = timeArr[i];
          activeAlert.value = { id: compId, time: timeArr[i].toFixed(2), value: val.toFixed(4), rule: `${rule.operator} ${rule.threshold}` };
          return;
        }
      }
    }
  };
  const ignoreAlert = (id) => { ignoredComponents.add(id.toLowerCase()); activeAlert.value = null; };
  const confirmAlert = () => { activeAlert.value = null; };

  const persistConnectionStyles = async () => {
    if (!currentProjectId.value) return;
    const mergedConfig = { ...(modelConfig.value || {}) };
    mergedConfig[CONNECTION_STYLES_KEY] = { ...(connectionStyles.value || {}) };
    modelConfig.value = mergedConfig;
    try {
      await projectApi.saveVisualConfig(currentProjectId.value, mergedConfig);
    } catch (e) {
      console.error('Failed to save connection styles', e);
    }
  };

  const getConnectionStyle = (id) => connectionStyles.value[id] || { ...defaultConnectionStyle };
  const updateConnectionStyle = async (id, style) => {
    connectionStyles.value[id] = { ...defaultConnectionStyle, ...style };
    await persistConnectionStyles();
  };
  const syncAllConnections = async (style) => {
    if (!structureData.value || !structureData.value.connections) return;
    const newStyles = { ...connectionStyles.value };
    if (newStyles['ALL']) delete newStyles['ALL'];
    structureData.value.connections.forEach(c => {
      const id = `${c.from.toLowerCase()}_${c.to.toLowerCase()}`;
      newStyles[id] = JSON.parse(JSON.stringify(style));
    });
    connectionStyles.value = newStyles;
    await persistConnectionStyles();
  };

  const loadData = async (projectId = null) => {
    if (projectId) currentProjectId.value = projectId;
    const pid = currentProjectId.value;

    // If no project selected, cannot load data (unless demo/legacy mode handling needed)
    if (!pid) return null;

    try {
      // 1. Get Project Details (includes Structure)
      const project = await projectApi.getProject(pid);
      currentProject.value = project;
      structureData.value = project.structure || { components: [], connections: [] };
      modelConfig.value = project.visual_config || {};
      connectionStyles.value = modelConfig.value?.[CONNECTION_STYLES_KEY] || {};

      // Determine Read-Only Status
      const { currentUser } = useAuth();
      if (!project.user_id) {
        isReadOnly.value = true;
      } else if (currentUser.value) {
        const isOwner = project.user_id === currentUser.value.id;
        const isAdmin = currentUser.value.is_superuser;
        isReadOnly.value = !(isOwner || isAdmin);
      } else {
        isReadOnly.value = true;
      }

      // 2. Get Parameters
      // The backend 'getProject' might include params, but 'projectApi.getParameters' is explicit
      try {
        const params = await projectApi.getParameters(pid);
        // Ensure values
        componentParams.value = Array.isArray(params) ? params.map(p => ({
          ...p,
          value: (p.value !== undefined) ? p.value : p.defaultValue
        })) : [];

        // Defaults - fetch explicit defaults from backend
        try {
          const defs = await projectApi.getDefaults(pid);
          defaultParams.value = defs || [];
        } catch (e) {
          // Fallback if endpoint fails (though it shouldn't)
          defaultParams.value = JSON.parse(JSON.stringify(componentParams.value));
        }
      } catch (e) { componentParams.value = []; defaultParams.value = []; }

      // 3. Get Simulation Data (Results)
      // For now, assuming results are still stored on project or we need a way to get them.
      // My API analysis showed 'simulation_data' on Project model.
      try {
        // Current backend setup might need 'getProject' to return this or specific endpoint
        // The previous code fetched /project/current/simulation_data. 
        // Let's assume project details includes it or we fetch specifically if endpoint exists.
        // Since I didn't create a specific 'getSimulationData' in projectApi, I might need to add it or use generic getProject
        // Let's rely on project.simulation_data if available, otherwise check strictly.
        if (project.simulation_data) {
          const data = project.simulation_data;
          const processedComponents = {};
          if (data.components) { for (let key in data.components) processedComponents[key.toLowerCase()] = data.components[key]; }
          simulationData.value = { time: data.time || [], components: processedComponents };
          hasSimulationData.value = true;
          currentTime.value = 0;
        } else {
          throw new Error("No data");
        }
      } catch (e) { hasSimulationData.value = false; simulationData.value = null; }

      // 4. Run Config
      try {
        const cfg = await projectApi.getRunConfig(pid);
        lastSimConfig.value = cfg;
        filterSchema.value = normalizeFilterSchema(cfg?.filter_schema);
      } catch (e) { lastSimConfig.value = null; filterSchema.value = []; }

      // 5. UI State
      await loadAlertRules(pid);
      await loadGroups(pid);
      await fetchHiddenComponents(pid);
      await loadAnnotations(pid);

      updateDashboardVisibility();
      if (hasSimulationData.value) scanForAlerts();

      return structureData.value;
    } catch (e) { console.error("Load failed", e); return null; }
  };

  const loadModelConfig = async () => { /* Deprecated/merged into loadData/getProject */ };
  const loadAnnotations = async (pid) => {
    try {
      const notes = await projectApi.getAnnotations(pid || currentProjectId.value);
      annotations.value = notes || {};
    } catch (e) { annotations.value = {}; }
  };
  const loadAlertRules = async (pid) => {
    try {
      const rules = await projectApi.getAlerts(pid || currentProjectId.value);
      alertRules.value = rules || {};
    } catch (e) { alertRules.value = {}; }
  };
  const saveAlertRules = async (rules) => {
    alertRules.value = rules || {};
    if (currentProjectId.value) {
      const nextConfig = { ...(lastSimConfig.value || {}), alert_rules: alertRules.value };
      lastSimConfig.value = nextConfig;
      await projectApi.saveRunConfig(currentProjectId.value, nextConfig);
    }
    // Note: Backend might need specific endpoint for alerts if not in run_config. 
    // My API analysis showed /projects/{id}/alerts endpoint.
    try { await projectApi.saveAlerts(currentProjectId.value, alertRules.value); } catch (e) { }
  };

  const saveFilterSchema = async (rules) => {
    filterSchema.value = normalizeFilterSchema(rules);
    const nextConfig = { ...(lastSimConfig.value || {}), filter_schema: filterSchema.value };
    lastSimConfig.value = nextConfig;
    if (!currentProjectId.value) return;
    await projectApi.saveRunConfig(currentProjectId.value, nextConfig);
  };

  const saveComponentFilterRule = async (componentId, rule) => {
    const column = `${String(componentId || '').toLowerCase()}.I[1]`;
    const nextRules = filterSchema.value.filter(existing => !Array.isArray(existing.columns) || !existing.columns.includes(column));

    if (rule && (rule.min !== undefined || rule.max !== undefined)) {
      nextRules.push({
        columns: [column],
        ...(rule.min !== undefined ? { min: rule.min } : {}),
        ...(rule.max !== undefined ? { max: rule.max } : {})
      });
    }

    await saveFilterSchema(nextRules);
  };

  const resetSession = async () => {
    // Backend is stateless now, no need to call /api/session/clear
    // try { await fetch(`${BACKEND_URL}/api/session/clear`, { method: 'POST' }); } catch(e) {}
    resetSimulationSession();
    structureData.value = null;
    currentProject.value = null;
    modelConfig.value = {}; annotations.value = {}; componentParams.value = []; defaultParams.value = [];
    selectedConnectionId.value = null; connectionStyles.value = {}; currentAnalysisTask.value = null;
    multiSelectedIds.value.clear(); componentGroups.value = {}; expandedGroupId.value = null;
    resetAnalysisWorkbench();

    graphSelectedIds.value = new Set(['sds', 'plasma', 'tes']);
  };

  const revertParam = async (compId, paramName) => {
    const fullName = compId === 'global' ? paramName : `${compId}.${paramName}`;
    const target = componentParams.value.find(p => p.name === fullName);
    if (target) {
      const def = defaultParams.value.find(p => p.name === fullName);
      if (def) {
        target.value = def.defaultValue;
        // Persist change
        await saveParameters(componentParams.value);
      }
    }
  };

  const updateParam = async (compId, paramName, newValue) => {
    const fullName = compId === 'global' ? paramName : `${compId}.${paramName}`;
    const target = componentParams.value.find(p => p.name === fullName);

    if (target) {
      target.value = newValue;
    } else {
      // Add new parameter
      componentParams.value.push({
        name: fullName,
        value: newValue,
        defaultValue: newValue // Assuming new param default is self
      });
    }

    await saveParameters(componentParams.value);
  };

  const saveParameters = async (params) => {
    if (!currentProjectId.value) return;
    await projectApi.saveParameters(currentProjectId.value, params);
  };
  const saveAnnotations = async (notes) => {
    // Optimistically update local state
    annotations.value = notes;

    if (!currentProjectId.value) return;
    try {
      await projectApi.saveAnnotations(currentProjectId.value, notes);
    } catch (e) {
      console.error("Failed to save annotations:", e);
      // Optionally revert state here if strict consistency is needed
    }
  };
  const saveComponentPosition = async (id, x, y) => {
    // 1. 立即更新本地状态 (Local Optimistic Update)
    // 这样下次 rebuildVisuals 读取 structureData 时，拿到的就是新坐标
    if (structureData.value && structureData.value.components) {
      // 注意：这里需要忽略大小写查找，确保匹配成功
      const targetComp = structureData.value.components.find(c => c.id.toLowerCase() === id.toLowerCase());
      if (targetComp) {
        targetComp.position.x = x;
        targetComp.position.y = y;
      }
    }

    // 2. 发送请求持久化到后端
    if (currentProjectId.value) {
      try {
        await projectApi.savePosition(currentProjectId.value, { id, x, y });
      } catch (e) {
        console.error("Position save failed", e);
      }
    }
  };
  const clearResults = async () => {
    // Backend is stateless, no need to call /api/session/clear_results
    // try { await fetch(`${BACKEND_URL}/api/session/clear_results`, { method: 'POST' }); } catch (e) {}
    clearSimulationResults();
  };
  /* Fixed BACKEND_URL def */
  const API_BASE = resolveApiBase();
  const BACKEND_URL = resolveBackendBase();
  const fetchLibraryModels = async () => { try { const res = await fetch(`${BACKEND_URL}/api/v1/library/models`); if (res.ok) libraryModels.value = await res.json(); } catch (e) { console.error('Failed to fetch library models:', e); } };
  const fetchAnalysisTasks = async () => { try { const res = await fetch(`${BACKEND_URL}/api/analysis/tasks`); if (res.ok) analysisTasks.value = await res.json(); } catch (e) { console.error("Fetch tasks failed", e); } };
  const submitAnalysisTask = async (config) => {
    try { const res = await fetch(`${BACKEND_URL}/api/analysis/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }); if (!res.ok) throw new Error("Submit failed"); await fetchAnalysisTasks(); return true; } catch (e) {
      // [MODIFIED] Replace alert
      $notify({
        title: 'SUBMISSION FAILED',
        message: e.message || 'Could not submit analysis task.',
        type: 'error'
      });
      return false;
    }
  };
  const deleteAnalysisTask = async (id) => { try { await fetch(`${BACKEND_URL}/api/analysis/tasks/${id}`, { method: 'DELETE' }); await fetchAnalysisTasks(); } catch (e) { } };
  const getTaskLogs = async (id) => { try { const res = await fetch(`${BACKEND_URL}/api/analysis/tasks/${id}/logs`); if (res.ok) { const data = await res.json(); return data.logs; } } catch (e) { } return ""; };
  const getTaskReport = async (id) => { try { const res = await fetch(`${BACKEND_URL}/api/analysis/tasks/${id}/report`); if (res.ok) { const data = await res.json(); return data.content; } } catch (e) { console.error("Fetch report failed", e); } return ""; };

  const toggleDashboardMode = () => {
    toggleWorkbenchDashboardMode();
    showDashboard.value = true;
  };
  const openAnalysisDashboard = (task) => {
    openWorkbenchAnalysisDashboard(task);
    showDashboard.value = false;
  };
  const closeAnalysisDashboard = () => {
    closeWorkbenchAnalysisDashboard();
    showDashboard.value = true;
  };

  const toggleMultiSelect = (id) => { const newSet = new Set(multiSelectedIds.value); if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); } multiSelectedIds.value = newSet; };
  const clearSelection = () => { multiSelectedIds.value.clear(); };

  // [辅助] 忽略大小写的组检查
  const isGroup = (id) => id && id.toUpperCase().startsWith('GROUP_');

  // [修改] 智能聚合逻辑：自动识别并解构已存在的组，实现扁平化合并
  const createGroup = (customName = null) => {
    if (multiSelectedIds.value.size < 2) return;

    const allChildren = new Set();
    const groupsToDelete = new Set(); // 使用 Set 防止重复添加

    multiSelectedIds.value.forEach(rawId => {
      // 1. 尝试在现有组中查找匹配的 Key (忽略大小写)
      // 例如 rawId="group_123", componentGroups Key="GROUP_123"
      const foundGroupKey = Object.keys(componentGroups.value).find(
        gKey => gKey.toLowerCase() === rawId.toLowerCase()
      );

      if (foundGroupKey) {
        // 是一个已存在的组：取出其所有子节点进行“过继”
        const existingGroup = componentGroups.value[foundGroupKey];
        if (existingGroup && existingGroup.children) {
          existingGroup.children.forEach(child => allChildren.add(child.toLowerCase()));
          groupsToDelete.add(foundGroupKey);
        }
      } else {
        // 是一个原子组件
        allChildren.add(rawId.toLowerCase());
      }
    });

    // 2. 创建新组
    const groupId = `GROUP_${Date.now()}`;
    const childrenArray = Array.from(allChildren);

    componentGroups.value[groupId] = {
      id: groupId,
      name: customName || `Merged System ${Object.keys(componentGroups.value).length + 1}`,
      children: childrenArray,
      expanded: false
    };

    // 3. 删除被合并的旧组
    groupsToDelete.forEach(gId => {
      if (componentGroups.value[gId]) {
        delete componentGroups.value[gId];
      }
      if (expandedGroupId.value === gId) {
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

  const setExpandedGroup = (groupId) => { expandedGroupId.value = groupId; };
  const isExpanded = (groupId) => { return expandedGroupId.value === groupId; };

  // 渲染父级查找：只返回 Group ID 或者原子 ID
  const getRenderParentId = (componentId) => {
    const safeCompId = componentId ? componentId.toLowerCase() : '';
    for (const [gId, group] of Object.entries(componentGroups.value)) {
      if (group.children.includes(safeCompId)) {
        if (expandedGroupId.value === gId) return safeCompId;
        return gId;
      }
    }
    return safeCompId;
  };

  const loadGroups = async (pid) => {
    try {
      if (!pid && !currentProjectId.value) return;
      const groups = await projectApi.getGroups(pid || currentProjectId.value);
      componentGroups.value = groups || {};
    } catch (e) { componentGroups.value = {}; }
  };
  const saveGroups = async () => {
    if (currentProjectId.value) await projectApi.saveGroups(currentProjectId.value, componentGroups.value);
  };

  const fetchHiddenComponents = async (pid) => {
    try {
      if (!pid && !currentProjectId.value) return null;
      return await projectApi.getSidebarConfig(pid || currentProjectId.value);
    } catch (e) { return null; }
  };

  const saveHiddenComponents = async (hiddenIds) => {
    try {
      if (!currentProjectId.value) return;
      await projectApi.saveSidebarConfig(currentProjectId.value, hiddenIds);
    } catch (e) { console.error("Failed to save sidebar config", e); }
  };

  const resetGraphSelection = () => {
    graphSelectedIds.value = new Set(['sds', 'plasma', 'tes']);
  };

  return {
    // State
    currentProjectId, currentProject, currentTaskId, isReadOnly,
    simulationData, structureData, componentParams, defaultParams, modelConfig, annotations,
    hasSimulationData,
    showDashboard, showLabels, userPrefersDashboard,
    libraryModels, modifiedParams, lastSimConfig, filterSchema,
    alertRules, activeAlert, analysisTasks, showAnalysisPanel,
    selectedConnectionId, connectionStyles,
    isDashboardMode, currentAnalysisTask,
    defaultConnectionStyle,

    graphSelectedIds,

    // Methods
    loadData, loadModelConfig, loadAnnotations, resetSession, revertParam, updateParam,
    saveParameters, saveAnnotations, saveComponentPosition, saveAlertRules, saveFilterSchema, saveComponentFilterRule, ignoreAlert, confirmAlert,
    clearResults, updateDashboardVisibility, fetchLibraryModels, toggleDashboardPref,
    fetchAnalysisTasks, submitAnalysisTask, deleteAnalysisTask, getTaskLogs, getTaskReport,
    getConnectionStyle, updateConnectionStyle, syncAllConnections,
    toggleDashboardMode, openAnalysisDashboard, closeAnalysisDashboard,

    multiSelectedIds, componentGroups, expandedGroupId,
    toggleMultiSelect, clearSelection, createGroup, dissolveGroup, setExpandedGroup,
    getRenderParentId, isGroup, isExpanded, fetchHiddenComponents,
    saveHiddenComponents,

    resetGraphSelection
  };
}
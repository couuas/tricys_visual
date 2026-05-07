import { projectApi } from '../../../api/project';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';
import { useSimulationSceneStore } from '../stores/simulationScene.store';
import { useSimulationSessionStore } from '../stores/simulationSession.store';

export function useSimulationWorkspace() {
  const {
    currentProjectId,
    structureData,
    modelConfig,
    loadProjectWorkspace,
    fetchHiddenComponents
  } = useProjectWorkspace();

  const {
    activeAlert,
    alertRules,
    currentTime,
    filterSchema,
    hasSimulationData,
    ignoredComponents,
    lastSimConfig,
    normalizeFilterSchema,
    simulationData,
    updateDashboardVisibility
  } = useSimulationSessionStore();

  const {
    hydrateConnectionStyles,
    loadGroups
  } = useSimulationSceneStore({ currentProjectId, modelConfig, structureData });

  const checkAlerts = () => {
    if (!simulationData.value || activeAlert.value) return;
    const timeArr = simulationData.value.time;
    if (!timeArr || timeArr.length === 0) return;

    let index = -1;
    const target = currentTime.value;
    let minDiff = Infinity;
    for (let i = 0; i < timeArr.length; i += 1) {
      const diff = Math.abs(timeArr[i] - target);
      if (diff < 0.001) {
        index = i;
        break;
      }
      if (diff < minDiff) {
        minDiff = diff;
        index = i;
      }
    }
    if (index === -1) index = timeArr.length - 1;

    const rules = alertRules.value || {};
    for (const [id, rule] of Object.entries(rules)) {
      const compId = id.toLowerCase();
      if (!rule.enabled || ignoredComponents.has(compId)) continue;
      const values = simulationData.value.components[compId];
      if (!values) continue;
      const value = values[index];
      const triggered = (rule.operator === '<' && value < rule.threshold) || (rule.operator === '>' && value > rule.threshold);
      if (triggered) {
        activeAlert.value = {
          id: compId,
          time: currentTime.value.toFixed(2),
          value: value.toFixed(4),
          rule: `${rule.operator} ${rule.threshold}`
        };
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

      for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        const triggered = (rule.operator === '<' && value < rule.threshold) || (rule.operator === '>' && value > rule.threshold);
        if (triggered) {
          currentTime.value = timeArr[i];
          activeAlert.value = {
            id: compId,
            time: timeArr[i].toFixed(2),
            value: value.toFixed(4),
            rule: `${rule.operator} ${rule.threshold}`
          };
          return;
        }
      }
    }
  };

  const ignoreAlert = (id) => {
    ignoredComponents.add(id.toLowerCase());
    activeAlert.value = null;
  };

  const confirmAlert = () => {
    activeAlert.value = null;
  };

  const loadData = async (projectId = null) => {
    if (projectId) currentProjectId.value = projectId;
    const pid = currentProjectId.value;
    if (!pid) return null;

    try {
      const project = await loadProjectWorkspace(pid);
      hydrateConnectionStyles();

      try {
        if (project.simulation_data) {
          const data = project.simulation_data;
          const processedComponents = {};
          if (data.components) {
            for (const key in data.components) {
              processedComponents[key.toLowerCase()] = data.components[key];
            }
          }
          simulationData.value = { time: data.time || [], components: processedComponents };
          hasSimulationData.value = true;
          currentTime.value = 0;
        } else {
          throw new Error('No data');
        }
      } catch (error) {
        hasSimulationData.value = false;
        simulationData.value = null;
      }

      try {
        const config = await projectApi.getRunConfig(pid);
        lastSimConfig.value = config;
        filterSchema.value = normalizeFilterSchema(config?.filter_schema);
      } catch (error) {
        lastSimConfig.value = null;
        filterSchema.value = [];
      }

      await loadAlertRules(pid);
      await loadGroups(pid);
      await fetchHiddenComponents(pid);

      updateDashboardVisibility();
      if (hasSimulationData.value) scanForAlerts();

      return structureData.value;
    } catch (error) {
      console.error('Load failed', error);
      return null;
    }
  };

  const loadAlertRules = async (projectId = null) => {
    try {
      const rules = await projectApi.getAlerts(projectId || currentProjectId.value);
      alertRules.value = rules || {};
    } catch (error) {
      alertRules.value = {};
    }
  };

  const saveAlertRules = async (rules) => {
    alertRules.value = rules || {};
    if (currentProjectId.value) {
      const nextConfig = { ...(lastSimConfig.value || {}), alert_rules: alertRules.value };
      lastSimConfig.value = nextConfig;
      await projectApi.saveRunConfig(currentProjectId.value, nextConfig);
    }

    try {
      await projectApi.saveAlerts(currentProjectId.value, alertRules.value);
    } catch (error) {
      // Alert persistence is mirrored through run_config; ignore optional endpoint failures.
    }
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
    const nextRules = filterSchema.value.filter((existing) => !Array.isArray(existing.columns) || !existing.columns.includes(column));

    if (rule && (rule.min !== undefined || rule.max !== undefined)) {
      nextRules.push({
        columns: [column],
        ...(rule.min !== undefined ? { min: rule.min } : {}),
        ...(rule.max !== undefined ? { max: rule.max } : {})
      });
    }

    await saveFilterSchema(nextRules);
  };

  return {
    checkAlerts,
    confirmAlert,
    filterSchema,
    ignoreAlert,
    lastSimConfig,
    loadAlertRules,
    loadData,
    saveAlertRules,
    saveComponentFilterRule,
    saveFilterSchema,
    scanForAlerts
  };
}
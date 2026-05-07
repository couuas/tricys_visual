import { ref } from 'vue';
import { projectApi } from '../../../api/project';
import { useAuth } from '../../auth/composables/useAuth';

const isReadOnly = ref(false);
const structureData = ref(null);
const componentParams = ref([]);
const defaultParams = ref([]);
const modelConfig = ref({});
const annotations = ref({});
const currentProjectId = ref(localStorage.getItem('tricys_last_pid') || null);
const currentProject = ref(null);

function applyReadOnlyStatus(project) {
  const { currentUser } = useAuth();
  if (!project?.user_id) {
    isReadOnly.value = true;
    return;
  }

  if (currentUser.value) {
    const isOwner = project.user_id === currentUser.value.id;
    const isAdmin = currentUser.value.is_superuser;
    isReadOnly.value = !(isOwner || isAdmin);
    return;
  }

  isReadOnly.value = true;
}

async function loadAnnotations(projectId) {
  try {
    const notes = await projectApi.getAnnotations(projectId || currentProjectId.value);
    annotations.value = notes || {};
  } catch {
    annotations.value = {};
  }
}

async function loadProjectWorkspace(projectId = null) {
  if (projectId) currentProjectId.value = projectId;
  const pid = currentProjectId.value;
  if (!pid) return null;

  const project = await projectApi.getProject(pid);
  currentProject.value = project;
  structureData.value = project.structure || { components: [], connections: [] };
  modelConfig.value = project.visual_config || {};
  applyReadOnlyStatus(project);

  try {
    const params = await projectApi.getParameters(pid);
    componentParams.value = Array.isArray(params)
      ? params.map((param) => ({
          ...param,
          value: param.value !== undefined ? param.value : param.defaultValue,
        }))
      : [];

    try {
      const defaults = await projectApi.getDefaults(pid);
      defaultParams.value = defaults || [];
    } catch {
      defaultParams.value = JSON.parse(JSON.stringify(componentParams.value));
    }
  } catch {
    componentParams.value = [];
    defaultParams.value = [];
  }

  await loadAnnotations(pid);
  return project;
}

async function saveParameters(params) {
  if (!currentProjectId.value) return;
  await projectApi.saveParameters(currentProjectId.value, params);
}

async function revertParam(compId, paramName) {
  const fullName = compId === 'global' ? paramName : `${compId}.${paramName}`;
  const target = componentParams.value.find((param) => param.name === fullName);
  if (!target) return;

  const def = defaultParams.value.find((param) => param.name === fullName);
  if (!def) return;

  target.value = def.defaultValue;
  await saveParameters(componentParams.value);
}

async function updateParam(compId, paramName, newValue) {
  const fullName = compId === 'global' ? paramName : `${compId}.${paramName}`;
  const target = componentParams.value.find((param) => param.name === fullName);

  if (target) {
    target.value = newValue;
  } else {
    componentParams.value.push({
      name: fullName,
      value: newValue,
      defaultValue: newValue,
    });
  }

  await saveParameters(componentParams.value);
}

async function saveAnnotations(notes) {
  annotations.value = notes;
  if (!currentProjectId.value) return;

  try {
    await projectApi.saveAnnotations(currentProjectId.value, notes);
  } catch (error) {
    console.error('Failed to save annotations:', error);
  }
}

async function saveComponentPosition(id, x, y) {
  if (structureData.value?.components) {
    const targetComp = structureData.value.components.find((component) => component.id.toLowerCase() === id.toLowerCase());
    if (targetComp) {
      targetComp.position.x = x;
      targetComp.position.y = y;
    }
  }

  if (!currentProjectId.value) return;

  try {
    await projectApi.savePosition(currentProjectId.value, { id, x, y });
  } catch (error) {
    console.error('Position save failed', error);
  }
}

async function fetchHiddenComponents(projectId) {
  try {
    if (!projectId && !currentProjectId.value) return null;
    return await projectApi.getSidebarConfig(projectId || currentProjectId.value);
  } catch {
    return null;
  }
}

async function saveHiddenComponents(hiddenIds) {
  try {
    if (!currentProjectId.value) return;
    await projectApi.saveSidebarConfig(currentProjectId.value, hiddenIds);
  } catch (error) {
    console.error('Failed to save sidebar config', error);
  }
}

function resetProjectWorkspace() {
  structureData.value = null;
  currentProject.value = null;
  modelConfig.value = {};
  annotations.value = {};
  componentParams.value = [];
  defaultParams.value = [];
}

export function useProjectWorkspace() {
  return {
    currentProjectId,
    currentProject,
    isReadOnly,
    structureData,
    componentParams,
    defaultParams,
    modelConfig,
    annotations,
    loadProjectWorkspace,
    loadAnnotations,
    saveParameters,
    revertParam,
    updateParam,
    saveAnnotations,
    saveComponentPosition,
    fetchHiddenComponents,
    saveHiddenComponents,
    resetProjectWorkspace,
  };
}
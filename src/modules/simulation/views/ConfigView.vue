<template>
  <div class="vis-view" :class="{ 'dashboard-mode': isDashboardMode }" @click="closeSettingsMenu">
    <transition name="fade">
      <div v-if="showUploadOverlay && !isDemo" class="upload-overlay">
        <div class="upload-card">
          <div class="upload-icon">📂</div>
          <h2>SYSTEM OFFLINE</h2>
          <p>LOAD MODELICA FILE TO INITIALIZE DIGITAL TWIN</p>
          <label class="upload-btn">
            <span>INITIATE UPLOAD</span>
            <input type="file" accept=".mo" @change="handleUpload" hidden>
          </label>
          <button class="text-btn" @click="goHome(true)">[ RETURN TO BASE ]</button>
        </div>
      </div>
    </transition>

    <div v-if="isReadOnly" class="readonly-badge">
       <span class="icon">🔒</span> READ ONLY PREVIEW
    </div>

    <SimulationWorkbenchShell
      :right-visible="hasRightPanelContent"
      :right-width="320"
      :bottom-expanded="focState.enabled"
      :bottom-height="300"
      :compact-bottom-height="76"
    >
      <template #main>
        <transition name="fade" mode="out-in">
          <ModelSceneAsset
            v-if="isReady"
            key="embedded-model-scene"
            ref="sceneAssetRef"
            :project-id="currentProjectId || router.currentRoute.value.query.projectId || ''"
            mode="view"
            :structure-data="structureData || { components: [], connections: [] }"
            :model-config="modelConfig"
            :annotations="annotations"
            :component-groups="componentGroups"
            :expanded-group-id="expandedGroupId"
            :get-connection-style="getConnectionStyle"
            :multi-selected-ids="multiSelectedIds"
            :is-read-only="true"
            @selectComponent="handleSelectComponent"
            @selectConnection="handleSelectConnection"
            @doubleClickComponent="handleOpenComponentDetail"
          />
        </transition>

        <transition name="fade-up">
          <div v-if="isReady && !isDashboardMode" class="scene-action-overlay">
            <button class="run-btn" :disabled="isSimulating" @click="handleSimButtonClick">
              <span class="icon">▶</span>
              {{ simButtonText }}
            </button>
            <button v-if="!hasSimulationData" class="overlay-btn secondary" @click="handleResetParameters">
              Reset Params
            </button>
          </div>
        </transition>

        <transition name="fade-up">
          <div class="editor-entry-overlay" v-if="isReady && !isSimulating && !isDashboardMode">
            <button class="editor-entry-btn" :class="{'btn-readonly': isReadOnly}" @click="openModelEditor">
              <span class="icon">🛠</span> Open 3D Studio (Alpha)
              <span v-if="isReadOnly" class="ro-badge">View Only</span>
            </button>
          </div>
        </transition>
      </template>

      <template #right>
        <div class="right-split-container">
          <div class="split-top flex-fill">
            <ComponentEditor
              :selectedId="selectedId"
              :embedded="true"
              :allowClose="true"
              @close="selectedId = null"
              @close-panel="selectedId = null"
              @update="handleConfigUpdate"
            />
          </div>
        </div>
      </template>

      <template #bottom>
        <FocWorkbenchPanel
          :project-id="currentProjectId || router.currentRoute.value.query.projectId || ''"
          :model-name="focModelName"
          :stop-time="focStopTime"
        />
      </template>
    </SimulationWorkbenchShell>

    <SimulationConfigModal
        :visible="showSimSettingsModal"
        :model-metadata="modelMetadata"
        @close="showSimSettingsModal = false"
        @simulation-started="handleSimulationStarted"
    />

    <AnalysisConfigModal
        :visible="showAnalysisModal"
        :model-metadata="modelMetadata"
        @close="showAnalysisModal = false"
        @analysis-started="handleSimulationStarted"
    />

    <transition name="pop-in"><div v-if="activeAlert" class="alert-modal-overlay"><div class="alert-card"><div class="alert-header"><span class="alert-icon-lg">⚠️</span><h3>INVENTORY ALERT</h3></div><div class="alert-body"><div class="alert-info-row"><span class="lbl">Component:</span><span class="val">{{ activeAlert.id.toUpperCase() }}</span></div><div class="alert-info-row"><span class="lbl">Time:</span><span class="val">{{ activeAlert.time }} h</span></div><div class="alert-info-row"><span class="lbl">Value:</span><span class="val highlight">{{ activeAlert.value }} g</span></div><div class="alert-condition">Condition: Value {{ activeAlert.rule }}</div></div><div class="alert-footer"><button class="btn-ignore" @click="ignoreAlert(activeAlert.id)">Ignore</button><button class="btn-ack" @click="confirmAlert">Acknowledge</button></div></div></div></transition>

    <transition name="fade"><button v-if="isEditorMode" class="exit-fs-btn" @click="exitFullscreen">✕ EXIT EDITOR</button></transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnalysisWorkbenchStore } from '../../analysis/stores/analysisWorkbench.store';
import { useSimulationParameters } from '../composables/useSimulationParameters';
import { useSimulationWorkspace } from '../composables/useSimulationWorkspace';
import { useSimulationSceneStore } from '../stores/simulationScene.store';
import { useSimulationSessionStore } from '../stores/simulationSession.store';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';
import { useWorkspaceSession } from '../../../shared/session/composables/useWorkspaceSession';
import { $confirm } from '../../../utils/dialog';
import { $notify, $updateNotification, closeNotification } from '../../../utils/notification';
import { taskApi } from '../../../api/task';

import ModelSceneAsset from '../../studio/components/ModelSceneAsset.vue';
import ComponentEditor from '../components/ComponentEditor.vue';
import SimulationConfigModal from '../components/SimulationConfigModal.vue';
import AnalysisConfigModal from '../components/AnalysisConfigModal.vue';
import FocWorkbenchPanel from '../components/FocWorkbenchPanel.vue';
import SimulationWorkbenchShell from '../components/SimulationWorkbenchShell.vue';
import { useFocDraft } from '../composables/useFocDraft';
import { resolveBackendBase } from '../../../utils/runtimeUrls';

const props = defineProps({ mode: { type: String, default: 'normal' } });
const router = useRouter();
const {
  modelConfig,
  annotations,
  structureData,
  componentParams,
  defaultParams,
  isReadOnly,
  currentProjectId,
  fetchHiddenComponents,
  saveHiddenComponents,
  revertParam,
  updateParam,
} = useProjectWorkspace();

const {
  clearResults,
  resetSession
} = useWorkspaceSession();

const {
  activeAlert,
  alertRules,
  hasSimulationData,
  showDashboard,
  showLabels,
  updateDashboardVisibility
} = useSimulationSessionStore();

const {
  isDashboardMode,
  toggleDashboardMode: _toggleDashboardMode
} = useAnalysisWorkbenchStore();

const { modifiedParams } = useSimulationParameters();
const { confirmAlert, ignoreAlert, loadData, lastSimConfig } = useSimulationWorkspace();

const {
  selectedConnectionId,
  isExpanded,
  setExpandedGroup,
  multiSelectedIds,
  createGroup,
  dissolveGroup,
  clearSelection,
  componentGroups,
  expandedGroupId,
  getConnectionStyle
} = useSimulationSceneStore({ currentProjectId, modelConfig, structureData });

const isFullscreen = ref(false);
const isEditorMode = ref(false);
const selectedId = ref(null);
const sceneAssetRef = ref(null);

const showSimSettingsModal = ref(false);
const showAnalysisModal = ref(false);
const showSettingsMenu = ref(false);
const showUploadOverlay = ref(false);
const isReady = ref(false);
const BACKEND_URL = resolveBackendBase();

const isSidebarOpen = ref(false);
const isSidebarEditMode = ref(false);
const hiddenComponents = ref(new Set());
const modelMetadata = ref({ packagePath: '', modelName: '' });
const isSimulating = ref(false);
const elapsedTime = ref(0);
let timerInterval = null;
let pollInterval = null;
let simulationNotifyId = null;

const focStopTime = computed(() => {
  return Number(lastSimConfig.value?.simulation?.stop_time || 0) || null;
});

const focModelName = computed(() => {
  return modelMetadata.value.modelName || lastSimConfig.value?.simulation?.model_name || 'example_model.Cycle';
});

const rawComponentList = computed(() => {
  if (!structureData.value || !structureData.value.components) return [];
  return [...structureData.value.components].sort((a, b) => a.id.localeCompare(b.id));
});

watch(rawComponentList, async (list) => {
  if (!list || list.length === 0) return;
  const savedList = await fetchHiddenComponents();
  if (savedList && Array.isArray(savedList) && savedList.length > 0) {
    const validIds = new Set(list.map(c => c.id));
    const restoredSet = new Set(savedList.filter(id => validIds.has(id)));
    hiddenComponents.value = restoredSet;
  } else {
    if (list.length > 5) {
      const defaultHidden = new Set();
      for (let index = 5; index < list.length; index += 1) {
        defaultHidden.add(list[index].id);
      }
      hiddenComponents.value = defaultHidden;
      await saveHiddenComponents(Array.from(defaultHidden));
    } else {
      hiddenComponents.value = new Set();
    }
  }
}, { immediate: true });

const { focState, setProjectScope: setFocProjectScope, syncFromConfig: syncFocFromConfig, clearDraft: clearFocDraft } = useFocDraft();
const sidebarDisplayList = computed(() => {
  if (isSidebarEditMode.value) return rawComponentList.value;
  return rawComponentList.value.filter(component => !hiddenComponents.value.has(component.id));
});

const handleSidebarItemClick = async (compId) => {
  if (isSidebarEditMode.value) {
    const newSet = new Set(hiddenComponents.value);
    if (newSet.has(compId)) newSet.delete(compId);
    else newSet.add(compId);
    hiddenComponents.value = newSet;
    await saveHiddenComponents(Array.from(newSet));
  } else {
    router.push({
      name: 'component-detail',
      params: { id: compId },
      query: { projectId: router.currentRoute.value.query.projectId }
    });
  }
};

const hasRightPanelContent = computed(() => !!selectedId.value);
watch(
  () => lastSimConfig.value?.foc,
  (focConfig) => {
    syncFocFromConfig(focConfig || null);
  },
  { immediate: true, deep: true }
);

const isDemo = computed(() => props.mode === 'demo');
const statusText = computed(() => { if (isDemo.value) return hasSimulationData.value ? 'Demo Active' : 'Demo Model Ready'; return hasSimulationData.value ? 'Session Active' : 'Model View Only'; });

const initPage = async () => {
  const queryProjectId = router.currentRoute.value.query.projectId;

  if (queryProjectId) {
      watch(
        () => currentProjectId.value || router.currentRoute.value.query.projectId || 'default',
        (projectId) => {
          setFocProjectScope(projectId);
        },
        { immediate: true }
      );
      const struct = await loadData(queryProjectId);
      if (!struct) {
          $notify({ title: 'LOAD ERROR', message: 'Project data not found.', type: 'error' });
          router.push('/');
      } else {
          showUploadOverlay.value = false; isReady.value = true;
      }
  } else if (isDemo.value) {
    try {
      $notify({ title: 'DEMO INIT', message: 'Initializing demo environment...', type: 'info' });
      $notify({ title: 'DEMO ERROR', message: 'Demo mode pending refactor.', type: 'error' });
      router.push('/');
    } catch (error) {
      router.push('/');
    }
  } else {
    router.push('/');
  }
  updateDashboardVisibility();
};

const handleUpload = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const formData = new FormData(); formData.append('file', file);
  try {
    await resetSession();
    const token = localStorage.getItem('tricys_auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${BACKEND_URL}/api/v1/project/parse_model`, {
        method: 'POST',
        headers,
        body: formData
    });
    if (response.ok) {
      const responseData = await response.json();

      if (responseData.file_path) {
        modelMetadata.value.packagePath = responseData.file_path;
        modelMetadata.value.modelName = responseData.name || modelMetadata.value.modelName;
      }

      showUploadOverlay.value = false;
      const struct = await loadData();
      if (struct) { isReady.value = true; updateDashboardVisibility(); $notify({ title: 'UPLOAD SUCCESS', message: 'Model parsed successfully.', type: 'success' }); }
      else { $notify({ title: 'PARSING ERROR', message: 'Model structure not found.', type: 'error' }); }
    } else {
      $notify({ title: 'UPLOAD FAILED', message: 'Server rejected the file.', type: 'error' });
    }
  } catch (error) {
    $notify({ title: 'NETWORK ERROR', message: error.message, type: 'error' });
  }
};

const toggleDashboardMode = () => { _toggleDashboardMode(); };
const onGlobalClick = () => closeSettingsMenu();
const flatModifiedParams = computed(() => { const list = []; if (!modifiedParams.value) return list; for (const [compId, params] of Object.entries(modifiedParams.value)) { for (const [key, val] of Object.entries(params)) { const displayKey = key.startsWith(compId + '.') ? key : `${compId}.${key}`; list.push({ compId, key, displayKey, value: val }); } } return list; });
const hasModifiedParams = computed(() => flatModifiedParams.value.length > 0);
const activeRulesList = computed(() => { const list = []; if (!alertRules || !alertRules.value) return list; for (const [id, rule] of Object.entries(alertRules.value)) { if (rule.enabled) list.push({ id, ...rule }); } return list; });
const simButtonText = computed(() => { if (isSimulating.value) return 'RUNNING...'; if (hasSimulationData.value) return 'CLEAR DATA'; return 'SIMULATE'; });
const formatParamValue = (val) => { if (Array.isArray(val)) return `[${val.length} items]`; if (typeof val === 'number') return Number.isInteger(val) ? val : val.toFixed(4); return val; };
const toggleSettingsMenu = () => { showSettingsMenu.value = !showSettingsMenu.value; };
const closeSettingsMenu = () => { if (showSettingsMenu.value) showSettingsMenu.value = false; };
const handleSimButtonClick = () => { if (hasSimulationData.value) doClearResults(); else showSimSettingsModal.value = true; };

const handleSimulationStarted = () => {
   showSimSettingsModal.value = false;
};

const finishSimulation = async (success) => {
  clearInterval(timerInterval);
  clearInterval(pollInterval);
  isSimulating.value = false;

  if (simulationNotifyId) {
      closeNotification(simulationNotifyId);
      simulationNotifyId = null;
  }

  if (success) {
    await loadData();
    updateDashboardVisibility();
    if (isEditorMode.value) exitFullscreen();
    $notify({ title: 'SIMULATION COMPLETE', message: `Finished in ${elapsedTime.value}s. Data loaded.`, type: 'success' });
  }
};

const handleResetParameters = async () => {
    const isConfirmed = await $confirm('Reset all parameters to default values?', 'RESET PARAMETERS');
    if (!isConfirmed) return;

    if (componentParams.value && Array.isArray(componentParams.value)) {
        componentParams.value.forEach(param => {
             const def = defaultParams.value.find(item => item.name === param.name);
             if (def) param.value = def.defaultValue;
             else if (param.defaultValue !== undefined) param.value = param.defaultValue;
        });
    }

  clearFocDraft();
  $notify({ title: 'RESET COMPLETE', message: 'Parameters and FOC settings restored to defaults.', type: 'info' });
};

const doClearResults = async () => { const isConfirmed = await $confirm('Clear all simulation data? This action cannot be undone.', 'PURGE DATA'); if (isConfirmed) await clearResults(); };

const toggleStandardFullscreen = () => { if (isFullscreen.value && !isEditorMode.value) exitFullscreen(); else enterStandardFullscreen(); showSettingsMenu.value = false; };
const enterStandardFullscreen = () => { isEditorMode.value = false; triggerBrowserFullscreen(); };
const enterEditorMode = () => { isEditorMode.value = true; triggerBrowserFullscreen(); };
const triggerBrowserFullscreen = () => { const elem = document.documentElement; if (!document.fullscreenElement) elem.requestFullscreen().catch(() => {}); };
const exitFullscreen = () => { if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen(); };
const onFullscreenChange = () => { const isFs = !!document.fullscreenElement; isFullscreen.value = isFs; if (!isFs) isEditorMode.value = false; };
const goHome = async (force = false) => { if (!force) { const isConfirmed = await $confirm('Terminate current session and return to main menu? Unsaved progress will be lost.', 'SYSTEM EXIT'); if (!isConfirmed) return; } if (document.fullscreenElement) document.exitFullscreen(); await resetSession(); router.push('/'); };
const navigateTo = (viewName) => {
  if (viewName === 'analysis') {
      router.push({ name: 'analysis' });
      return;
  }
  currentView.value = viewName;
};
const openModelEditor = () => {
    const pid = currentProjectId.value || router.currentRoute.value.query.projectId;
    if (pid) {
        router.push({ name: 'model-editor', query: { projectId: pid, mode: isReadOnly.value ? 'view' : 'edit', from: 'config' } });
    }
};
const handleSelectComponent = (id) => {
  selectedId.value = id || null;
  selectedConnectionId.value = null;
};
const handleSelectConnection = (id) => {
  selectedConnectionId.value = id || null;
  selectedId.value = null;
};
const handleConfigUpdate = () => {
  if (!selectedId.value || !sceneAssetRef.value?.focusCameraOn) return;
  sceneAssetRef.value.focusCameraOn(selectedId.value);
};
const handleOpenComponentDetail = (id) => {
  if (!id) return;
  const projectId = currentProjectId.value || router.currentRoute.value.query.projectId;
  router.push({
    name: 'component-detail',
    params: { id },
    query: projectId ? { projectId } : undefined
  });
};
const handleResize = () => updateDashboardVisibility();

onMounted(() => {
  initPage();
  window.addEventListener('resize', handleResize);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  updateDashboardVisibility();
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  clearInterval(timerInterval);
  clearInterval(pollInterval);
});
</script>

<style scoped>
.vis-view { position: relative; width: 100%; height: 100%; overflow: hidden; background: #05070a; display: flex; flex-direction: column; font-family: 'Inter', 'Roboto Mono', sans-serif; }
.editor-entry-overlay { position: absolute; top: 15px; right: 15px; z-index: 50; }
.scene-action-overlay { position: absolute; top: 15px; left: 15px; z-index: 50; display: flex; align-items: center; gap: 10px; }
.editor-entry-btn { background: linear-gradient(135deg, #00d2ff, #007bff); border: none; padding: 8px 16px; border-radius: 6px; color: #000; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.3); transition: all 0.2s; }
.editor-entry-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4); }
.editor-entry-btn.btn-readonly { background: linear-gradient(135deg, #444, #666); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); }
.editor-entry-btn.btn-readonly:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4); }
.ro-badge { background: #222; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px; color: #ccc; }
.overlay-btn { border: 1px solid rgba(255,255,255,0.12); background: rgba(8, 12, 18, 0.88); color: #d3deea; height: 32px; padding: 0 14px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s; }
.overlay-btn:hover { border-color: rgba(0, 210, 255, 0.4); color: #fff; background: rgba(12, 18, 26, 0.96); }
.overlay-btn.secondary { color: #9eb0c4; }
.sim-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 0; }
.sim-tabs button { background: transparent; border: none; color: #666; padding: 10px; font-weight: 700; font-size: 11px; cursor: pointer; border-bottom: 2px solid transparent; }
.sim-tabs button.active { color: #00d2ff; border-bottom-color: #00d2ff; }
.sim-tabs button:hover:not(.active) { color: #bbb; }
.nav-tabs { display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
.nav-tab { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; color: #666; border-radius: 4px; transition: all 0.2s; letter-spacing: 0.5px; }
.nav-tab.active { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.2); }
.nav-tab.disabled { cursor: not-allowed; opacity: 0.5; }
.nav-tab:not(.disabled):hover { background: rgba(255,255,255,0.05); color: #bbb; cursor: pointer; }
.step-num { font-family: 'JetBrains Mono', monospace; font-size: 9px; opacity: 0.7; }
.nav-arrow { color: #333; font-size: 10px; margin: 0 2px; }
.run-btn { background: linear-gradient(135deg, #00d2ff, #007bff); border: none; height: 32px; padding: 0 16px; border-radius: 4px; color: #000; font-weight: 800; font-size: 11px; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 0 15px rgba(0, 210, 255, 0.2); transition: all 0.2s; letter-spacing: 0.5px; }
.right-split-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: rgba(0,0,0,0.2); }
.split-top { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.split-top.flex-fill { flex: 1; height: auto !important; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-up-enter-active, .fade-up-leave-active { transition: all 0.3s; }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(10px); }
.pop-in-enter-active { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.upload-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #05070a; z-index: 2000; display: flex; align-items: center; justify-content: center; }
.upload-card { text-align: center; padding: 50px; border: 1px solid #30363d; background: radial-gradient(circle at center, #161b22 0%, #0d1117 100%); width: 450px; color: #eee; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
.upload-icon { font-size: 48px; margin-bottom: 20px; opacity: 0.7; color: #00d2ff; text-shadow: 0 0 15px rgba(0, 210, 255, 0.4); }
.upload-card h2 { font-size: 20px; letter-spacing: 2px; margin-bottom: 10px; color: #fff; font-weight: 400; }
.upload-card p { font-size: 12px; color: #666; margin-bottom: 30px; letter-spacing: 1px; }
.upload-btn { display: inline-block; padding: 12px 30px; background: rgba(0, 210, 255, 0.1); border: 1px solid #00d2ff; color: #00d2ff; font-weight: bold; cursor: pointer; transition: 0.3s; letter-spacing: 2px; font-size: 12px; }
.upload-btn:hover { background: #00d2ff; color: #000; box-shadow: 0 0 20px rgba(0, 210, 255, 0.4); }
.text-btn { margin-top: 20px; background: none; border: none; color: #444; cursor: pointer; font-size: 11px; letter-spacing: 1px; transition: color 0.2s; }
.text-btn:hover { color: #888; }
.alert-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(20, 0, 0, 0.4); backdrop-filter: blur(10px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.alert-card { width: 400px; background: #1a0505; border: 1px solid #ff5252; box-shadow: 0 0 50px rgba(255, 82, 82, 0.2); overflow: hidden; animation: shake 0.4s ease-in-out; }
.alert-header { background: #ff5252; color: #000; padding: 12px 20px; display: flex; align-items: center; gap: 10px; font-weight: bold; letter-spacing: 1px; }
.alert-body { padding: 25px; color: #ffcccc; font-family: monospace; }
.alert-info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
.alert-info-row .val { color: #fff; font-weight: bold; }
.alert-info-row .val.highlight { color: #ff5252; font-size: 16px; text-shadow: 0 0 10px #ff5252; }
.alert-footer { padding: 15px; background: #2b0a0a; display: flex; gap: 10px; border-top: 1px solid #4a1010; }
.btn-ack { flex: 1; background: #ff5252; border: none; color: #000; padding: 10px; cursor: pointer; font-weight: bold; text-transform: uppercase; }
.btn-ack:hover { background: #fff; }
.btn-ignore { flex: 1; background: transparent; border: 1px solid #ff5252; color: #ff5252; padding: 10px; cursor: pointer; text-transform: uppercase; }
.btn-ignore:hover { background: rgba(255, 82, 82, 0.1); }
.exit-fs-btn { position: fixed; bottom: 20px; right: 20px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; padding: 10px 20px; border-radius: 30px; cursor: pointer; z-index: 9999; backdrop-filter: blur(10px); font-weight: bold; transition: all 0.3s; }
.exit-fs-btn:hover { background: rgba(255, 255, 255, 0.2); transform: scale(1.05); }
@keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); } 20%, 40%, 60%, 80% { transform: translateX(4px); } }
</style>
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

    <!-- Read Only Badge -->
    <div v-if="isReadOnly" class="readonly-badge">
       <span class="icon">🔒</span> READ ONLY PREVIEW
    </div>

    <div class="workspace-grid" :style="gridStyle">
      


      <div 
        class="grid-area-center"
        :style="{ height: `calc(100% - ${terminalHeight}px)` }"
      >
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

         <!-- [NEW] Editor Entry Point -->
         <transition name="fade-up">
           <div class="editor-entry-overlay" v-if="isReady && !isSimulating && !isDashboardMode">
             <button class="editor-entry-btn" :class="{'btn-readonly': isReadOnly}" @click="openModelEditor">
                <span class="icon">🛠</span> Open 3D Studio (Alpha)
                <span v-if="isReadOnly" class="ro-badge">View Only</span>
             </button>
           </div>
         </transition>
      </div>

      <div 
        v-if="hasRightPanelContent" 
        class="grid-resizer vertical" 
        @mousedown="startResize('horizontal', $event)"
        :style="{ height: `calc(100% - ${terminalHeight}px)` }"
      >
        <div class="resizer-handle-v"></div>
      </div>

      <div 
        class="grid-area-right" 
        v-if="hasRightPanelContent"
        :style="{ height: `calc(100% - ${terminalHeight}px)`, width: layoutState.rightWidth + 'px' }"
      >
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
      </div>
    </div>

    <div class="bottom-panel-shell" :class="{ expanded: focState.enabled }">
      <FocWorkbenchPanel
        :project-id="currentProjectId || router.currentRoute.value.query.projectId || ''"
        :model-name="focModelName"
        :stop-time="focStopTime"
      />
    </div>

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
import { useSimulation } from '../composables/useSimulation';
import { $confirm } from '../utils/dialog';
import { $notify, $updateNotification, closeNotification } from '../utils/notification';
import { taskApi } from '../api/task'; 

import ModelSceneAsset from '../components/workbench/ModelSceneAsset.vue';
import ComponentEditor from '../components/features/simulation/ComponentEditor.vue';
import SimulationConfigModal from '../components/features/simulation/SimulationConfigModal.vue'; 
import AnalysisConfigModal from '../components/features/simulation/AnalysisConfigModal.vue'; // [NEW]
import FocWorkbenchPanel from '../components/features/simulation/FocWorkbenchPanel.vue';
import { useFocDraft } from '../composables/useFocDraft';
import { resolveBackendBase } from '../utils/runtimeUrls';

const props = defineProps({ mode: { type: String, default: 'normal' } });
const router = useRouter();
const {
  resetSession, updateDashboardVisibility, hasSimulationData, loadData, clearResults,
  modelConfig, annotations, modifiedParams, lastSimConfig, loadModelConfig,
  showLabels, alertRules, activeAlert, ignoreAlert, confirmAlert,
  isDashboardMode, toggleDashboardMode: _toggleDashboardMode,
  selectedConnectionId, isExpanded, setExpandedGroup,
  multiSelectedIds, createGroup, dissolveGroup, clearSelection,
  structureData, componentGroups, expandedGroupId,
  componentParams, defaultParams,
  fetchHiddenComponents,
  saveHiddenComponents, isReadOnly, revertParam, updateParam,
  currentProjectId, getConnectionStyle
} = useSimulation();

const isFullscreen = ref(false);
const isEditorMode = ref(false);
const selectedId = ref(null);
const sceneAssetRef = ref(null);

const showSimSettingsModal = ref(false);
const showAnalysisModal = ref(false); // [NEW]
const showSettingsMenu = ref(false);
const showUploadOverlay = ref(false);
const isReady = ref(false);
const BACKEND_URL = resolveBackendBase();



// Sidebar State
const isSidebarOpen = ref(false);
const isSidebarEditMode = ref(false); 
const hiddenComponents = ref(new Set()); 

// Analysis Terminal State
const terminalHeight = ref(0); // Set to 0 to remove spacing 

// Dashboard Dock State - REMOVED
// const isDashboardDocked = ref(false);

const modelMetadata = ref({ packagePath: '', modelName: '' }); // [NEW] Shared model info
const isSimulating = ref(false);
const elapsedTime = ref(0);
let timerInterval = null;
let pollInterval = null;
let simulationNotifyId = null; // [NEW] Notification ID for Sim

// Layout State
const layoutState = reactive({
  dashboardWidth: 420,
  rightWidth: 320, 
  rightTopHeight: 400, 
  isResizing: false
});

const focStopTime = computed(() => {
  return Number(lastSimConfig.value?.simulation?.stop_time || 0) || null;
});

const focModelName = computed(() => {
  return modelMetadata.value.modelName || lastSimConfig.value?.simulation?.model_name || 'example_model.Cycle';
});

// Component List
const rawComponentList = computed(() => {
  if (!structureData.value || !structureData.value.components) return [];
  return [...structureData.value.components].sort((a, b) => a.id.localeCompare(b.id));
});

// Initialization with Backend Persistence
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
      for (let i = 5; i < list.length; i++) {
        defaultHidden.add(list[i].id);
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
  return rawComponentList.value.filter(c => !hiddenComponents.value.has(c.id));
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
const terminalLeftOffset = computed(() => {
    return 0;
});

const gridStyle = computed(() => {
  // const leftColWidth = (isDashboardDocked.value && hasSimulationData.value) ? `${layoutState.dashboardWidth}px` : '0px';
  // const resizerLeftWidth = (isDashboardDocked.value && hasSimulationData.value) ? '6px' : '0px';
  const leftColWidth = '0px';
  const resizerLeftWidth = '0px';
  const rightColWidth = (hasRightPanelContent.value) ? `${layoutState.rightWidth}px` : '0px';
  const resizerRightWidth = (hasRightPanelContent.value) ? '6px' : '0px';
  const cols = `${leftColWidth} ${resizerLeftWidth} 1fr ${resizerRightWidth} ${rightColWidth}`;
  const rows = `1fr`; 
  const areas = `"top res-h center res-v right"`; 
  return { display: 'grid', gridTemplateColumns: cols, gridTemplateRows: rows, gridTemplateAreas: areas, gap: '0px' };
});

const handleTerminalResize = (height) => { terminalHeight.value = height; };

const startResize = (direction, event) => {
  event.preventDefault(); layoutState.isResizing = true;
  const startX = event.clientX; const startY = event.clientY;
  const startRightWidth = layoutState.rightWidth; 
  const startDashWidth = layoutState.dashboardWidth;
  const startRightTopHeight = layoutState.rightTopHeight;

  const onMouseMove = (e) => {
    if (direction === 'horizontal') {
      const newW = startRightWidth + (startX - e.clientX);
      layoutState.rightWidth = Math.max(250, Math.min(600, newW));
    } else if (direction === 'vertical') {
      const newW = startDashWidth + (e.clientX - startX);
      layoutState.dashboardWidth = Math.max(350, Math.min(600, newW));
    } else if (direction === 'right-split') {
      const newH = startRightTopHeight + (e.clientY - startY);
      layoutState.rightTopHeight = Math.max(150, Math.min(800, newH));
    }
  };
  
  const onMouseUp = () => { layoutState.isResizing = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
  document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  document.body.style.userSelect = 'none'; document.body.style.cursor = direction === 'right-split' ? 'row-resize' : 'col-resize';
};

// watch(lastSimConfig, ...) -> Logic moved to child component but we can keep global watcher or just let onShow handle it

watch(
  () => lastSimConfig.value?.foc,
  (focConfig) => {
    syncFocFromConfig(focConfig || null);
  },
  { immediate: true, deep: true }
);

const isDemo = computed(() => props.mode === 'demo');
const statusText = computed(() => { if (isDemo.value) return hasSimulationData.value ? 'Demo Active' : 'Demo Model Ready'; return hasSimulationData.value ? 'Session Active' : 'Model View Only'; });

// [MODIFIED] Init with Notify
const initPage = async () => { 
  const queryProjectId = router.currentRoute.value.query.projectId;
  
  // Update: If we have a projectId, use it. Otherwise, if demo, use demo logic (or redirect)
  if (queryProjectId) {
      await loadModelConfig(); // actually deprecated but kept for safety

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
    // Demo Mode logic: Create a demo project automatically or use a fixed one
    try { 
      // For now, redirect to home if no project ID in demo/normal
      // Or backend could implement a specific demo endpoint that returns a project ID
      $notify({ title: 'DEMO INIT', message: 'Initializing demo environment...', type: 'info' });
      // Example: await projectApi.createDemo() -> returns ID -> loadData(id)
      // Fallback:
       $notify({ title: 'DEMO ERROR', message: 'Demo mode pending refactor.', type: 'error' });
       router.push('/');
    } catch (e) { 
       router.push('/'); 
    } 
  } else { 
    // No project ID and not demo -> Redirect Home
    router.push('/');
  } 
  updateDashboardVisibility(); 
};

// [MODIFIED] Upload with Notify
const handleUpload = async (event) => { 
  const file = event.target.files[0]; if (!file) return; 
  const formData = new FormData(); formData.append('file', file); 
  try { 
    await resetSession(); 
    const token = localStorage.getItem('tricys_auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`${BACKEND_URL}/api/v1/project/parse_model`, { 
        method: 'POST', 
        headers: headers,
        body: formData 
    }); 
    if (res.ok) { 
      const responseData = await res.json();
      
      // Update package path for simulation (Global state, so Component will pick it up)
      if (responseData.file_path) {
        modelMetadata.value.packagePath = responseData.file_path;
        modelMetadata.value.modelName = responseData.name || modelMetadata.value.modelName;
      }
      
      showUploadOverlay.value = false; await loadModelConfig(); 
      const struct = await loadData(); 
      if (struct) { isReady.value = true; updateDashboardVisibility(); $notify({ title: 'UPLOAD SUCCESS', message: 'Model parsed successfully.', type: 'success' }); } 
      else { $notify({ title: 'PARSING ERROR', message: 'Model structure not found.', type: 'error' }); } 
    } else { 
      $notify({ title: 'UPLOAD FAILED', message: 'Server rejected the file.', type: 'error' });
    } 
  } catch (e) { 
    $notify({ title: 'NETWORK ERROR', message: e.message, type: 'error' });
  } 
};

const toggleDashboardMode = () => { _toggleDashboardMode(); };
const onGlobalClick = () => closeSettingsMenu();
const flatModifiedParams = computed(() => { const list = []; if (!modifiedParams.value) return list; for (const [compId, params] of Object.entries(modifiedParams.value)) { for (const [key, val] of Object.entries(params)) { const displayKey = key.startsWith(compId + '.') ? key : `${compId}.${key}`; list.push({ compId, key, displayKey, value: val }); } } return list; });
const hasModifiedParams = computed(() => flatModifiedParams.value.length > 0);
const activeRulesList = computed(() => { const list = []; if (!alertRules || !alertRules.value) return list; for(const [id, rule] of Object.entries(alertRules.value)) { if(rule.enabled) list.push({ id, ...rule }); } return list; });
const simButtonText = computed(() => { if (isSimulating.value) return "RUNNING..."; if (hasSimulationData.value) return "CLEAR DATA"; return "SIMULATE"; });
const formatParamValue = (val) => { if (Array.isArray(val)) return `[${val.length} items]`; if (typeof val === 'number') return Number.isInteger(val) ? val : val.toFixed(4); return val; };
const toggleSettingsMenu = () => { showSettingsMenu.value = !showSettingsMenu.value; };
const closeSettingsMenu = () => { if (showSettingsMenu.value) showSettingsMenu.value = false; };
const handleSimButtonClick = () => { if (hasSimulationData.value) doClearResults(); else showSimSettingsModal.value = true; };

// Simulation Handling
const handleSimulationStarted = () => {
   showSimSettingsModal.value = false;
   // Component handles redirect, parent just needs to know it started
   // Maybe update button state? Component handles loading state internally but parent `isSimulating` button might need care.
   // Parent uses global `isSimulating`? No, parent uses local.
   // Component assumes responsibility for submission. Parent 'isSimulating' is redundant for submission phase, 
   // but useful for 'polling' phase if we were polling here.
   // Component redirects to Monitor, so this view unmounts anyway.
};


// [MODIFIED] Finish Logic
const finishSimulation = async (success) => { 
  clearInterval(timerInterval); 
  clearInterval(pollInterval); 
  isSimulating.value = false; 
  
  // Close the process notification
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
    const isConfirmed = await $confirm("Reset all parameters to default values?", "RESET PARAMETERS");
    if (!isConfirmed) return;
    
    if (componentParams.value && Array.isArray(componentParams.value)) {
        componentParams.value.forEach(p => {
             // Find default from defaultParams
             const def = defaultParams.value.find(d => d.name === p.name);
             if (def) p.value = def.defaultValue;
             else if (p.defaultValue !== undefined) p.value = p.defaultValue;
        });
    }

  clearFocDraft();
  $notify({ title: 'RESET COMPLETE', message: 'Parameters and FOC settings restored to defaults.', type: 'info' });
};

const doClearResults = async () => { const isConfirmed = await $confirm("Clear all simulation data? This action cannot be undone.", "PURGE DATA"); if (isConfirmed) await clearResults(); };



const toggleStandardFullscreen = () => { if (isFullscreen.value && !isEditorMode.value) exitFullscreen(); else enterStandardFullscreen(); showSettingsMenu.value = false; };
const enterStandardFullscreen = () => { isEditorMode.value = false; triggerBrowserFullscreen(); };
const enterEditorMode = () => { isEditorMode.value = true; triggerBrowserFullscreen(); };
const triggerBrowserFullscreen = () => { const elem = document.documentElement; if (!document.fullscreenElement) elem.requestFullscreen().catch(()=>{}); };
const exitFullscreen = () => { if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen(); };
const onFullscreenChange = () => { const isFs = !!document.fullscreenElement; isFullscreen.value = isFs; if (!isFs) isEditorMode.value = false; };
const goHome = async (force = false) => { if (!force) { const isConfirmed = await $confirm("Terminate current session and return to main menu? Unsaved progress will be lost.", "SYSTEM EXIT"); if (!isConfirmed) return; } if (document.fullscreenElement) document.exitFullscreen(); await resetSession(); router.push('/'); };
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
/* Base Styles */
.vis-view { position: relative; width: 100%; height: 100%; overflow: hidden; background: #05070a; display: flex; flex-direction: column; font-family: 'Inter', 'Roboto Mono', sans-serif; }

/* [NEW] Editor Entry Styles */
.editor-entry-overlay {
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 50;
}
.scene-action-overlay {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
}
.editor-entry-btn {
    background: linear-gradient(135deg, #00d2ff, #007bff);
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    color: #000;
    font-weight: bold;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(0, 210, 255, 0.3);
    transition: all 0.2s;
}
.editor-entry-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4);
}
.editor-entry-btn.btn-readonly {
    background: linear-gradient(135deg, #444, #666);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}
.editor-entry-btn.btn-readonly:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.ro-badge {
    background: #222;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    margin-left: 5px;
    color: #ccc;
}
.overlay-btn {
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(8, 12, 18, 0.88);
  color: #d3deea;
  height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
}
.overlay-btn:hover {
  border-color: rgba(0, 210, 255, 0.4);
  color: #fff;
  background: rgba(12, 18, 26, 0.96);
}
.overlay-btn.secondary {
  color: #9eb0c4;
}

/* Tabs */
.sim-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 0px; }
.sim-tabs button {
    background: transparent; border: none; color: #666; padding: 10px; font-weight: 700; font-size: 11px; cursor: pointer; border-bottom: 2px solid transparent;
}
.sim-tabs button.active { color: #00d2ff; border-bottom-color: #00d2ff; }
.sim-tabs button:hover:not(.active) { color: #bbb; }

/* Analysis Wizard */



/* Top Bar */


/* Central Navigation Tabs */
.nav-tabs { display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
.nav-tab { 
  display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; color: #666; 
  border-radius: 4px; transition: all 0.2s; letter-spacing: 0.5px;
}
.nav-tab.active { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.2); }
.nav-tab.disabled { cursor: not-allowed; opacity: 0.5; }
.nav-tab:not(.disabled):hover { background: rgba(255,255,255,0.05); color: #bbb; cursor: pointer; }

.step-num { font-family: "JetBrains Mono", monospace; font-size: 9px; opacity: 0.7; }
.nav-arrow { color: #333; font-size: 10px; margin: 0 2px; }

/* Run Button */
.run-btn {
  background: linear-gradient(135deg, #00d2ff, #007bff);
  border: none;
  height: 32px;
  padding: 0 16px;
  border-radius: 4px;
  color: #000;
  font-weight: 800;
  font-size: 11px;
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(0, 210, 255, 0.2);
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.icon-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #888;
  width: 32px; height: 32px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
}
.icon-btn:hover { border-color: #fff; color: #fff; background: rgba(255,255,255,0.05); }

/* Grid Layout & Resizers */
.workspace-grid { 
  flex: 1; 
  width: 100%; 
  min-height: 0; /* Important for flex child scroll/overflow */
  padding: 10px; 
  box-sizing: border-box; 
  /* Removed absolute positioning */
}

.bottom-panel-shell {
  flex: 0 0 auto;
  height: auto;
  min-height: 0;
  max-height: none;
  padding: 0 10px 10px;
  box-sizing: border-box;
}

.bottom-panel-shell.expanded {
  flex: 0 0 30%;
  height: 30%;
  min-height: 30%;
  max-height: 30%;
}
.grid-area-top { grid-area: top; min-height: 0; overflow: hidden; }

/* [MODIFIED] Dynamic Height Binding */
.grid-area-center { 
  grid-area: center; min-width: 0; min-height: 0; position: relative; 
  /* [MODIFIED] Removed Border */
  /* border: 1px solid #30363d; */
  border-radius: 4px; overflow: hidden; 
  width: 100%; 
  background: rgba(0,0,0,0.3); 
  transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.grid-area-right { 
  grid-area: right; min-width: 0; overflow: hidden; 
  transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* --- Tech Sidebar Styles (Updated) --- */

.scene-sidebar {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 260px;
  /* [Modified] Parent is transparent, content block has background */
  background: transparent;
  border: none;
  z-index: 100;
  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex; flex-direction: column;
  /* [Modified] Remove justify-content: center */
  
  /* [Modified] Allow click-through on empty areas */
  pointer-events: none;
}

.scene-sidebar.open {
  transform: translateX(0);
}

/* [Modified] Centered Block Wrapper */
.sidebar-centered-block {
  width: 100%;
  max-height: 100%; /* Relative to parent */
  display: flex;
  flex-direction: column;
  margin: auto 0; /* Vertical centering */
  
  /* [Modified] Visual styles moved here */
  background: rgba(10, 12, 16, 0.9);
  backdrop-filter: blur(15px);
  /* [Modified] Border radius for floating look */
  border-radius: 0 16px 16px 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 10px 0 30px rgba(0,0,0,0.3);
  
  /* [Modified] Re-enable clicks */
  pointer-events: auto;
  box-sizing: border-box;
}

.sidebar-handle {
  position: absolute; top: 50%; right: -24px; width: 24px; height: 60px;
  background: rgba(10, 12, 16, 0.9);
  border: 1px solid rgba(0, 210, 255, 0.3); border-left: none;
  border-radius: 0 8px 8px 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transform: translateY(-50%);
  box-shadow: 4px 0 15px rgba(0, 210, 255, 0.1);
  transition: all 0.3s;
  /* [Modified] Ensure pointer events active */
  pointer-events: auto;
}
.sidebar-handle:hover { box-shadow: 0 0 15px rgba(0, 210, 255, 0.4); }
.handle-icon { color: #00d2ff; font-size: 10px; }

.sidebar-header {
  height: 50px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex; 
  align-items: center; 
  /* [修改] 核心：使用 space-between 让子元素分别靠向两端 */
  justify-content: space-between;
  padding: 0 15px 0 20px;
  background: linear-gradient(90deg, rgba(255,255,255,0.02) 0%, transparent 100%);
  border-top-right-radius: 16px;
}

.sb-title { 
  font-size: 12px; font-weight: 800; color: #fff; letter-spacing: 1px;
  /* [修改] 移除绝对定位和居中变换 */
  position: static;
  transform: none;
  left: auto;
  
  /* [新增] 确保标题过长时显示省略号，不挤压右侧按钮 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1; /* 占据剩余空间 */
}

.sb-controls { 
  display: flex; align-items: center; gap: 8px; 
  /* [修改] 移除 margin-left: auto (由 space-between 接管) */
  margin-left: 10px; /* 给左侧标题留出最小间距 */
  flex-shrink: 0; /* 防止按钮被挤压 */
  position: relative; 
  z-index: 2;
}

.sb-count { background: #00d2ff; color: #000; font-size: 10px; padding: 2px 6px; border-radius: 2px; font-weight: bold; }
.sb-count.editing { background: #ffea00; color: #000; }

.sb-edit-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.2);
  width: 24px; height: 24px; border-radius: 4px;
  color: #888; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.sb-edit-btn:hover { color: #fff; border-color: #fff; }
.sb-edit-btn.active { background: #ffea00; border-color: #ffea00; color: #000; box-shadow: 0 0 10px rgba(255, 234, 0, 0.3); }

/* 列表容器 */
.sidebar-list { 
  flex: 0 1 auto; 
  min-height: 0;
  overflow-y: auto; 
  overflow-x: hidden; 
  padding: 0; 
  position: relative;
  display: flex; 
  flex-direction: column;
  /* [Modified] Inherit rounded corner at bottom right */
  border-bottom-right-radius: 16px;
}

/* Scroll Wrapper for padding inside the list */
.sidebar-scroll-wrapper {
  width: 100%;
  position: relative;
  padding: 20px 10px 20px 20px;
  box-sizing: border-box;
}

/* 左侧贯穿线 */
.timeline-line {
  position: absolute;
  top: 20px; bottom: 20px; 
  left: 30px; 
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 210, 255, 0.3) 10%, rgba(0, 210, 255, 0.3) 90%, transparent 100%);
  z-index: 0;
}

/* --- 单个组件 Tab 条目 --- */
.tech-tab-item {
  position: relative;
  display: flex; align-items: center;
  margin-bottom: 18px;
  cursor: pointer;
  animation: slideInLeft 0.4s ease forwards;
  opacity: 0;
  animation-delay: var(--delay);
  transition: all 0.3s;
}

.tech-tab-item.hidden { opacity: 0.4; filter: grayscale(0.8); }
.tech-tab-item.hidden:hover { opacity: 0.8; }

@keyframes slideInLeft { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }

/* 1. 连接点 (Timeline Dot) / Indicator */
.tech-indicator {
  width: 20px; display: flex; justify-content: center; align-items: center;
  margin-right: 5px; position: relative; z-index: 1;
}

.tech-dot {
  width: 6px; height: 6px;
  background: #05070a;
  border: 1px solid #00d2ff;
  border-radius: 50%;
  transition: all 0.3s;
}

.eye-icon { font-size: 12px; color: #ffea00; text-shadow: 0 0 5px #ffea00; }
.hidden .eye-icon { color: #666; text-shadow: none; }

.tech-tab-item:hover .tech-dot { background: #00d2ff; box-shadow: 0 0 8px #00d2ff; }
.tech-tab-item.active .tech-dot { background: #fff; border-color: #fff; box-shadow: 0 0 10px #fff; transform: scale(1.2); }

/* 2. 六边形 (Hexagon) */
.tech-hex {
  width: 46px; height: 40px;
  /* 蓝色渐变背景 */
  background: linear-gradient(135deg, #2b70ff 0%, #00d2ff 100%);
  /* CSS 裁剪出六边形 */
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  display: flex; align-items: center; justify-content: center;
  z-index: 2;
  filter: drop-shadow(0 5px 5px rgba(0,0,0,0.3)); /* 阴影 */
  transition: transform 0.2s;
  flex-shrink: 0;
}

.tech-tab-item:hover .tech-hex { transform: scale(1.05); }
.tech-tab-item.active .tech-hex { 
  background: linear-gradient(135deg, #fff 0%, #dcdcdc 100%); /* 激活变白 */
}
.in-edit .tech-hex { background: linear-gradient(135deg, #444 0%, #222 100%); }
.in-edit:hover .tech-hex { background: linear-gradient(135deg, #ffea00 0%, #ffd700 100%); }

/* 六边形内文字 */
.hex-text {
  font-size: 13px; font-weight: 900; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  font-family: "Consolas", monospace;
  letter-spacing: -0.5px;
}
.tech-tab-item.active .hex-text { color: #007bff; text-shadow: none; }
.in-edit:hover .hex-text { color: #000; text-shadow: none; }

/* 3. 渐变条 (Bar) */
.tech-bar {
  flex: 1; height: 32px;
  margin-left: -8px; /* 让 Bar 稍微插在六边形后面一点 */
  padding-left: 20px; /* 文字左边距，避开六边形 */
  padding-right: 10px;
  display: flex; align-items: center; justify-content: space-between;
  
  /* 蓝色 -> 透明 渐变 */
  background: linear-gradient(90deg, rgba(43, 112, 255, 0.3) 0%, rgba(0, 210, 255, 0.05) 80%, transparent 100%);
  
  /* 右侧箭头形状 */
  clip-path: polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%);
  
  transition: all 0.3s;
}

.tech-tab-item:hover .tech-bar {
  background: linear-gradient(90deg, rgba(43, 112, 255, 0.5) 0%, rgba(0, 210, 255, 0.2) 100%);
  padding-left: 25px; /* 悬停时稍微向右动 */
}

/* Analysis Collapsible */
.analysis-collapsible-section {
    border: 1px solid #30363d;
    background: #161b22;
    border-radius: 4px;
    margin-top: 20px;
    overflow: hidden;
}
.analysis-collapse-head {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background: #21262d;
    border: none;
    color: #ccc;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 1px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
}
.analysis-collapse-head:hover {
    background: #30363d;
    color: #fff;
}
.analysis-collapse-head.expanded {
    background: #1f3847;
    color: #00d2ff;
    border-bottom: 1px solid #30363d;
}
.analysis-collapse-head .icon {
    font-size: 10px;
    opacity: 0.7;
}

.tech-tab-item.active .tech-bar {
  background: linear-gradient(90deg, rgba(0, 210, 255, 0.6) 0%, rgba(0, 210, 255, 0.1) 100%);
}

.in-edit .tech-bar { background: linear-gradient(90deg, rgba(255, 234, 0, 0.1) 0%, transparent 100%); }
.in-edit:hover .tech-bar { background: linear-gradient(90deg, rgba(255, 234, 0, 0.3) 0%, transparent 100%); }

.bar-text { font-size: 12px; font-weight: bold; color: #fff; text-shadow: 0 0 5px rgba(0,0,0,0.5); white-space: nowrap; }
.bar-sub { font-size: 9px; color: rgba(255,255,255,0.5); text-transform: uppercase; margin-right: 10px; }
.bar-status { font-size: 9px; font-weight: bold; color: #ffea00; margin-right: 10px; }
.hidden .bar-status { color: #666; }

/* 滚动条微调 */
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(0, 210, 255, 0.2); border-radius: 2px; }

.empty-list { text-align: center; padding: 20px; color: #666; font-style: italic; font-size: 11px; }

/* Resizers */
.grid-resizer { background: #0d1117; display: flex; align-items: center; justify-content: center; z-index: 10; transition: background 0.2s; }
.grid-resizer:hover, .grid-resizer:active { background: rgba(0, 210, 255, 0.2); }

.grid-resizer.vertical { 
  grid-area: res-v; cursor: col-resize; width: 6px; 
  box-sizing: border-box; background-clip: content-box;
  transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.resizer-handle-v { width: 2px; height: 40px; background: #30363d; border-radius: 1px; }
.grid-resizer.vertical:hover .resizer-handle-v { background: #00d2ff; }

.grid-resizer.horizontal { grid-area: res-h; cursor: row-resize; height: 6px; width: 100%; }
.resizer-handle { width: 40px; height: 2px; background: #30363d; border-radius: 1px; }
.grid-resizer.horizontal:hover .resizer-handle { background: #00d2ff; }

/* Right Split Container */
.right-split-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: rgba(0,0,0,0.2); }
.split-top { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.split-top.flex-fill { flex: 1; height: auto !important; }
.split-bottom { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.split-resizer { height: 6px; width: 100%; cursor: row-resize; background: #0d1117; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
.split-resizer:hover, .split-resizer:active { background: rgba(0, 210, 255, 0.2); }
.split-resizer:hover .resizer-handle { background: #00d2ff; }

/* Common UI Elements */
.brand-group { display: flex; align-items: center; gap: 10px; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; }
.logo-icon { font-size: 24px; color: #00d2ff; text-shadow: 0 0 10px rgba(0,210,255,0.6); }
.logo-text { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 1px; }
.logo-text .highlight { color: #00d2ff; }
.logo-text .version { font-size: 10px; color: #666; font-weight: normal; margin-left: 5px; vertical-align: top; }
.status-group { display: flex; align-items: center; gap: 10px; }
.status-indicator { width: 8px; height: 8px; background: #333; border-radius: 50%; box-shadow: inset 0 0 2px #000; transition: all 0.3s; }
.status-indicator.active { background: #00ff88; box-shadow: 0 0 8px #00ff88, inset 0 0 2px #fff; }
.status-indicator:not(.active) { background-color: #d29922; box-shadow: 0 0 5px rgba(210, 153, 34, 0.3); animation: breathe 3s infinite ease-in-out; }
.status-labels { display: flex; flex-direction: column; line-height: 1.2; justify-content: center; }
.status-title { font-size: 9px; color: #666; font-weight: 800; letter-spacing: 0.5px; transform: scale(0.9); transform-origin: left; }
.status-val { font-size: 12px; color: #ccc; font-weight: 600; font-family: "SFMono-Regular", Consolas, monospace; letter-spacing: 1px; text-transform: uppercase; text-shadow: 0 0 5px rgba(0,0,0,0.5); }
.status-val.active-text { color: #fff; text-shadow: 0 0 8px rgba(0, 255, 136, 0.3); }
.hud-btn { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.15); color: #a0a0a0; height: 32px; padding: 0 14px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; transition: all 0.2s; position: relative; overflow: hidden; }
.hud-btn:hover { border-color: #00d2ff; color: #fff; background: rgba(0, 210, 255, 0.1); box-shadow: 0 0 10px rgba(0, 210, 255, 0.15); }
.hud-btn.active { border-color: #00d2ff; color: #00d2ff; background: rgba(0, 210, 255, 0.15); box-shadow: inset 0 0 10px rgba(0, 210, 255, 0.2); }
.hud-btn .icon { font-size: 14px; }
.hud-btn.primary { border-color: #00d2ff; color: #00d2ff; }
.hud-btn.primary:hover { background: #00d2ff; color: #000; }
.hud-btn.danger { border-color: #ff5252; color: #ff5252; }
.hud-btn.danger:hover { background: #ff5252; color: #fff; }
.hud-btn.icon-only { padding: 0; width: 32px; justify-content: center; }
.separator { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15); margin: 0 5px; }
.control-group { display: flex; gap: 8px; align-items: center; }
.settings-wrapper { position: relative; }
.hud-dropdown { position: absolute; top: calc(100% + 10px); right: 0; width: 220px; background: rgba(12, 14, 18, 0.95); border: 1px solid #30363d; box-shadow: 0 10px 30px rgba(0,0,0,0.8); backdrop-filter: blur(10px); padding: 5px; display: flex; flex-direction: column; z-index: 600; border-radius: 4px; }
.dropdown-header { font-size: 10px; color: #555; font-weight: bold; padding: 8px 10px 4px; letter-spacing: 1px; }
.dropdown-divider { height: 1px; background: #30363d; margin: 5px 0; }
.dd-item { background: transparent; border: none; color: #ccc; padding: 10px; width: 100%; text-align: left; cursor: pointer; display: flex; justify-content: space-between; font-size: 12px; transition: 0.2s; border-radius: 2px; }
.dd-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
.dd-item.active { color: #00d2ff; }
.dd-item.danger { color: #ff5252; } .dd-item.danger:hover { background: rgba(255, 82, 82, 0.1); }
.dd-item .state { font-family: monospace; font-size: 10px; opacity: 0.5; }
.config-wrapper { position: relative; height: 100%; display: flex; align-items: center; }
.config-wrapper:hover .config-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }
.config-tooltip { position: absolute; top: 100%; left: 0; margin-top: 15px; width: 280px; background: rgba(12, 14, 18, 0.95); backdrop-filter: blur(12px); border: 1px solid #30363d; border-top: 2px solid #00d2ff; border-radius: 4px; padding: 15px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); z-index: 1000; opacity: 0; visibility: hidden; transform: translateY(-10px); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.config-tooltip::before { content: ''; position: absolute; top: -6px; left: 20px; width: 10px; height: 10px; background: #00d2ff; transform: rotate(45deg); z-index: -1; }
.tooltip-header { font-size: 10px; font-weight: 800; color: #666; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
.conf-grid { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }

/* In-Input Suggestions */
.input-wrapper { position: relative; }
.input-wrapper.small { flex: 1; }
.input-wrapper.medium { flex: 2; }
.input-wrapper .mf-input { width: 100%; box-sizing: border-box; }
.suggestions-list { position: absolute; top: 100%; left: 0; width: 100%; background: #1a1f26; border: 1px solid #30363d; z-index: 50; max-height: 150px; overflow-y: auto; list-style: none; margin: 0; padding: 0; list-style-type: none; }
.suggestions-list li { padding: 6px 10px; cursor: pointer; color: #ccc; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.suggestions-list li:hover { background: #00d2ff; color: #000; }
.conf-row { display: flex; justify-content: space-between; font-size: 12px; }
.conf-row .label { color: #888; font-weight: 600; }
.conf-row .value { color: #eee; font-family: "Consolas", monospace; }
.conf-section { margin-top: 10px; }
.conf-section.empty { font-style: italic; color: #555; font-size: 10px; text-align: center; margin-top: 5px; }
.section-title { font-size: 9px; color: #00d2ff; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
.section-title.alert { color: #ff5252; }
.tags-container { display: flex; flex-wrap: wrap; gap: 4px; }
.tag { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
.tag.param { background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); color: #a5f3ff; }
.tag.alert { background: rgba(255, 82, 82, 0.1); border: 1px solid rgba(255, 82, 82, 0.3); color: #ff8a80; }
.ui-layer { display: contents; }

.btn-text-small { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }
.upload-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #05070a; z-index: 2000; display: flex; align-items: center; justify-content: center; }
.upload-card { text-align: center; padding: 50px; border: 1px solid #30363d; background: radial-gradient(circle at center, #161b22 0%, #0d1117 100%); width: 450px; color: #eee; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
.upload-card::before { content: ''; position: absolute; top: 0; left: 0; width: 10px; height: 10px; border-top: 2px solid #00d2ff; border-left: 2px solid #00d2ff; }
.upload-card::after { content: ''; position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-bottom: 2px solid #00d2ff; border-right: 2px solid #00d2ff; }
.upload-icon { font-size: 48px; margin-bottom: 20px; opacity: 0.7; color: #00d2ff; text-shadow: 0 0 15px rgba(0, 210, 255, 0.4); }
.upload-card h2 { font-size: 20px; letter-spacing: 2px; margin-bottom: 10px; color: #fff; font-weight: 400; }
.upload-card p { font-size: 12px; color: #666; margin-bottom: 30px; letter-spacing: 1px; }
.upload-btn { display: inline-block; padding: 12px 30px; background: rgba(0, 210, 255, 0.1); border: 1px solid #00d2ff; color: #00d2ff; font-weight: bold; cursor: pointer; transition: 0.3s; letter-spacing: 2px; font-size: 12px; }
.upload-btn:hover { background: #00d2ff; color: #000; box-shadow: 0 0 20px rgba(0, 210, 255, 0.4); }
.text-btn { margin-top: 20px; background: none; border: none; color: #444; cursor: pointer; font-size: 11px; letter-spacing: 1px; transition: color 0.2s; }
.text-btn:hover { color: #888; }
.settings-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.settings-card { width: 460px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; box-shadow: 0 0 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; position: relative; }
.settings-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, #00d2ff, transparent); }
.modal-header { padding: 15px 20px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 14px; color: #fff; letter-spacing: 1px; }
.close-modal { background: none; border: none; color: #666; cursor: pointer; font-size: 18px; } .close-modal:hover { color: #fff; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 60vh; overflow-y: auto; }
.form-group label { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 5px; display: block; font-weight: 600; }
.form-group input { background: #010409; border: 1px solid #30363d; color: #00d2ff; padding: 8px; width: 100%; box-sizing: border-box; font-family: monospace; }
.form-group input:focus { border-color: #00d2ff; outline: none; }
.modal-footer { padding: 15px 20px; border-top: 1px solid #30363d; display: flex; justify-content: flex-end; gap: 10px; }
.btn-cancel { background: transparent; border: 1px solid #333; color: #888; padding: 8px 20px; cursor: pointer; font-size: 11px; letter-spacing: 1px; } .btn-cancel:hover { color: #fff; border-color: #666; }
.btn-confirm { background: #00d2ff; border: none; color: #000; padding: 8px 20px; cursor: pointer; font-weight: bold; font-size: 11px; letter-spacing: 1px; } .btn-confirm:hover { background: #fff; }
.alert-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(20, 0, 0, 0.4); backdrop-filter: blur(10px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.alert-card { width: 400px; background: #1a0505; border: 1px solid #ff5252; box-shadow: 0 0 50px rgba(255, 82, 82, 0.2); overflow: hidden; animation: shake 0.4s ease-in-out; }
.alert-header { background: #ff5252; color: #000; padding: 12px 20px; display: flex; align-items: center; gap: 10px; font-weight: bold; letter-spacing: 1px; }
.alert-body { padding: 25px; color: #ffcccc; font-family: monospace; }
/* Manual Params */
.manual-param-section { margin-bottom: 1px; border-bottom: 2px solid #30363d; padding-bottom: 15px; }
.add-btn-mini { background: rgba(0,210,255,0.1); border: 1px dashed #00d2ff; color: #00d2ff; width: 100%; padding: 8px; cursor: pointer; font-size: 11px; transition: all 0.2s; }
.add-btn-mini:hover { background: rgba(0,210,255,0.2); }
.manual-form { background: #161b22; padding: 10px; border: 1px solid #30363d; }
.mf-row { display: flex; gap: 5px; margin-bottom: 8px; }
.mf-input { background: #010409; border: 1px solid #30363d; color: #eee; padding: 6px; font-family: monospace; font-size: 11px; }
.mf-input.small { flex: 1; }
.mf-input.medium { flex: 2; }
.mf-actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-save-mini, .btn-cancel-mini { padding: 4px 12px; font-size: 10px; cursor: pointer; border: none; }
.btn-save-mini { background: #00d2ff; color: #000; font-weight: bold; }
.btn-cancel-mini { background: #333; color: #ccc; }
.clickable { cursor: pointer; transition: background 0.1s; }
.clickable:hover { background: rgba(255,255,255,0.05); }
.alert-info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
.alert-info-row .val { color: #fff; font-weight: bold; }
.alert-info-row .val.highlight { color: #ff5252; font-size: 16px; text-shadow: 0 0 10px #ff5252; }
.alert-footer { padding: 15px; background: #2b0a0a; display: flex; gap: 10px; border-top: 1px solid #4a1010; }
.btn-ack { flex: 1; background: #ff5252; border: none; color: #000; padding: 10px; cursor: pointer; font-weight: bold; text-transform: uppercase; } .btn-ack:hover { background: #fff; }
.btn-ignore { flex: 1; background: transparent; border: 1px solid #ff5252; color: #ff5252; padding: 10px; cursor: pointer; text-transform: uppercase; } .btn-ignore:hover { background: rgba(255, 82, 82, 0.1); }
.modified-params-section { margin-top: 15px; border: 1px solid rgba(255, 202, 40, 0.3); background: rgba(255, 202, 40, 0.05); border-radius: 6px; padding: 12px; }
.modified-params-section label { font-size: 11px; color: #ffca28; font-weight: 800; margin-bottom: 8px; display: flex; justify-content: space-between; text-transform: uppercase; border-bottom: 1px solid rgba(255, 202, 40, 0.2); padding-bottom: 5px; }
.alert-section { margin-top: 15px; border: 1px solid rgba(255, 82, 82, 0.5); background: rgba(255, 82, 82, 0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.alert-section label { color: #ff5252; border-bottom: 1px solid rgba(255, 82, 82, 0.3); }
.params-scroll-box { max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px; }
.params-scroll-box::-webkit-scrollbar { width: 4px; }
.params-scroll-box::-webkit-scrollbar-thumb { background: rgba(255, 202, 40, 0.4); border-radius: 2px; }
.alert-section .params-scroll-box::-webkit-scrollbar-thumb { background: rgba(255, 82, 82, 0.5); }
.mod-param-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-family: "Consolas", monospace; color: #ccc; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 2px; }
.reset-param-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; line-height: 1; margin-left: 8px; padding: 0; transition: color 0.2s; }
.reset-param-btn:hover { color: #fe5050; }
.mod-param-row:last-child { border-bottom: none; }
.p-key { color: #e0e0e0; } .p-val { color: #ffca28; font-weight: bold; }
.alert-row-preview { color: #ffcdd2; } .alert-row-preview .p-val { color: #ff5252; font-weight: 900; }
.nav-btn { background: rgba(16, 20, 28, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); color: #ccc; height: 32px; padding: 0 16px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; backdrop-filter: blur(5px); transition: all 0.2s ease; }
.nav-btn .icon { display: flex; align-items: center; justify-content: center; width: 16px; height: 100%; font-size: 14px; margin-left: 7px; }
.group-actions-bar { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(16, 20, 28, 0.95); border: 1px solid #00d2ff; padding: 8px 20px; border-radius: 30px; display: flex; align-items: center; gap: 20px; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }
.selection-info { display: flex; align-items: baseline; gap: 6px; color: #fff; }
.selection-info .count { font-size: 18px; font-weight: bold; color: #00d2ff; }
.selection-info .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.actions-row { display: flex; gap: 10px; }
.action-btn { background: rgba(255,255,255,0.1); border: none; border-radius: 20px; color: #eee; padding: 8px 16px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.action-btn.primary { background: linear-gradient(90deg, #0066ff, #00d2ff); color: #fff; }
.action-btn.primary:hover { transform: scale(1.05); box-shadow: 0 0 15px rgba(0,210,255,0.4); }
.action-btn.secondary:hover { background: rgba(255,255,255,0.2); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; } .fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-up-enter-active, .fade-up-leave-active { transition: all 0.3s; } .fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(10px); }
.slide-down-fade-enter-active, .slide-down-fade-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); } .slide-down-fade-enter-from, .slide-down-fade-leave-to { transform: translateY(-100%); opacity: 0; }
.pop-in-enter-active { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); } 20%, 40%, 60%, 80% { transform: translateX(4px); } }
.exit-fs-btn { position: fixed; bottom: 20px; right: 20px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; padding: 10px 20px; border-radius: 30px; cursor: pointer; z-index: 9999; backdrop-filter: blur(10px); font-weight: bold; transition: all 0.3s; }
.exit-fs-btn:hover { background: rgba(255, 255, 255, 0.2); transform: scale(1.05); }
@keyframes breathe { 0%, 100% { opacity: 0.6; box-shadow: 0 0 0 rgba(210, 153, 34, 0); } 50% { opacity: 1; box-shadow: 0 0 8px rgba(210, 153, 34, 0.5); } }
/* [NEW] Enhanced Mode Styles */
.modal-footer-secondary { padding: 10px 20px; background: rgba(0,0,0,0.2); display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); }
.enhanced-mode-toggle { display: flex; gap: 8px; align-items: center; cursor: pointer; font-size: 11px; color: #888; user-select: none; }
.enhanced-mode-toggle input { cursor: pointer; }
.enhanced-mode-toggle:hover { color: #ccc; }

.enhanced-overlay { background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); }
.enhanced-card { width: 800px; height: 600px; display: flex; flex-direction: column; }
/* [NEW] Layout Restructure */
.config-modal-container {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: center;
    position: relative;
    z-index: 1001; /* Above overlay base */
}

/* Side Trigger Button */
.analysis-side-trigger {
    margin-top: 15px;
    width: 100%;
    background: rgba(30, 40, 50, 0.6);
    border: 1px solid #30363d;
    padding: 12px 16px;
    border-radius: 6px;
    color: #8b949e;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
    font-size: 11px;
    letter-spacing: 1px;
}
.analysis-side-trigger:hover, .analysis-side-trigger.active {
    background: rgba(0, 210, 255, 0.1);
    border-color: #00d2ff;
    color: #00d2ff;
}
.trigger-icon {
    font-size: 10px;
}

/* Side Panel */
.analysis-side-panel {
    width: 400px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    height: auto;
    max-height: 80vh;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    overflow: hidden;
    backdrop-filter: blur(10px);
}
.panel-header {
    padding: 15px;
    background: #161b22;
    border-bottom: 1px solid #30363d;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.panel-header h3 { margin: 0; font-size: 12px; color: #00d2ff; letter-spacing: 1px; }
.close-panel {
    background: none; border: none; color: #8b949e; font-size: 16px; cursor: pointer; padding: 0; line-height: 1;
}
.close-panel:hover { color: #fff; }
.panel-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel-footer {
    padding: 15px;
    border-top: 1px solid #30363d;
    background: #161b22;
}
.small-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    grid-auto-rows: minmax(0, 1fr);
    align-items: stretch;
    align-content: stretch;
    gap: 8px;
    margin-top: 10px;
    width: 100%;
    flex: 1;
    min-height: 0;
}
.small-grid .type-card-mini {
    padding: 10px;
  min-height: 60px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.small-grid .type-icon { font-size: 16px; margin-bottom: 4px; }
.small-grid h4 { font-size: 11px; }

/* Transitions */
.slide-right-enter-active, .slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.slide-right-enter-from, .slide-right-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
.full-width { width: 100%; }

.enhanced-body { flex: 1; padding: 0; display: flex; flex-direction: column; }
.json-editor-wrapper { flex: 1; position: relative; }
.json-textarea { 
    width: 100%; height: 100%; border: none; background: #0d1117; color: #c9d1d9; 
    font-family: 'Fira Code', 'Consolas', monospace; font-size: 13px; padding: 15px; 
    resize: none; outline: none; box-sizing: border-box; 
    line-height: 1.5;
}
.enhanced-info { padding: 8px 15px; background: #161b22; color: #8b949e; font-size: 11px; border-top: 1px solid #30363d; }

/* --- Bottom Toolbar (Refactored) --- */
/* --- Bottom Toolbar (Refactored) --- */
.view-toolbar-bottom {
  /* [MODIFIED] Relative positioning to flow in flex container */
  position: relative;
  /* bottom, left, right removed */
  flex-shrink: 0; /* Prevent shrinking */
  height: 60px;
  background: #0d1117;
  border-top: 1px solid #30363d;
  display: flex;
  padding: 0;
  z-index: 100;
}

.action-btn-lg {
  border: none;
  font-family: 'Inter', sans-serif;
  font-weight: 800; font-size: 14px; letter-spacing: 1px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: all 0.2s;
  height: 100%;
}

.action-btn-lg.primary {
  flex: 6; /* 60% */
  background: linear-gradient(90deg, #00d2ff, #007bff);
  color: #000;
}
.action-btn-lg.primary:hover:not(.running) { filter: brightness(1.1); }
.action-btn-lg.primary.running { background: #333; color: #888; cursor: wait; }

.action-btn-lg.secondary {
  flex: 2; /* 20% */
  background: #161b22;
  color: #ff5252;
  border-left: 1px solid #30363d;
}
.action-btn-lg.secondary:hover:not(:disabled) { background: #1c2128; color: #ff8888; }
.action-btn-lg.secondary:disabled { color: #555; cursor: not-allowed; }

.action-btn-lg.export-btn {
  color: #00d2ff;
}
.action-btn-lg.export-btn:hover:not(:disabled) { color: #fff; background: rgba(0, 210, 255, 0.1); }

.readonly-badge {
    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
    background: rgba(255, 215, 0, 0.2); border: 1px solid #ffd700;
    color: #ffd700; padding: 5px 15px; border-radius: 4px; z-index: 2000;
    font-weight: bold; letter-spacing: 1px; font-size: 12px;
    display: flex; align-items: center; gap: 8px; pointer-events: none;
    backdrop-filter: blur(5px);
}
.readonly-badge .icon { font-size: 14px; }


</style>
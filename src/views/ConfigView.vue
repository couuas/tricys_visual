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

    <!-- Toolbar Removed (Moved to Bottom) -->

    <div class="workspace-grid" :style="gridStyle">
      
      <div class="grid-area-top" v-if="isDashboardDocked && hasSimulationData">
         <DashboardPanel 
           :embedded="true" 
           @toggle-dock="isDashboardDocked = false" 
         />
      </div>

      <div 
        v-if="isDashboardDocked && hasSimulationData" 
        class="grid-resizer horizontal" 
        @mousedown="startResize('vertical', $event)"
      >
        <div class="resizer-handle"></div>
      </div>

      <div 
        class="grid-area-center"
        :style="{ height: `calc(100% - ${terminalHeight}px)` }"
      >
         <transition name="fade" mode="out-in">
           <ThreeScene 
             v-if="isReady" 
             key="3d-scene"
             ref="sceneRef" 
             @selectComponent="handleSelect" 
           />
         </transition>
         
         <div class="scene-sidebar" :class="{ open: isSidebarOpen }">
            
            <div class="sidebar-centered-block">
                
                <div class="sidebar-handle" @click="isSidebarOpen = !isSidebarOpen" title="Toggle Component List">
                  <span class="handle-icon">{{ isSidebarOpen ? '◀' : '▶' }}</span>
                </div>

                <div class="sidebar-header">
                   <span class="sb-title">SYSTEM MODULES</span>
                   <div class="sb-controls">
                     <span class="sb-count" :class="{ editing: isSidebarEditMode }">
                        {{ sidebarDisplayList.length }}
                     </span>
                     <button 
                       class="sb-edit-btn" 
                       :class="{ active: isSidebarEditMode }"
                       @click="!isReadOnly && (isSidebarEditMode = !isSidebarEditMode)"
                       :disabled="isReadOnly"
                       :title="isReadOnly ? 'Read Only' : (isSidebarEditMode ? 'Finish Editing' : 'Edit List')"
                     >
                       <span class="icon">{{ isSidebarEditMode ? '✓' : '⚙' }}</span>
                     </button>
                   </div>
                </div>

                <div class="sidebar-list custom-scroll" :class="{ 'edit-mode': isSidebarEditMode }">
                   <div class="sidebar-scroll-wrapper">
                       <div class="timeline-line"></div> 
                       
                       <div 
                         v-for="(comp, index) in sidebarDisplayList" 
                         :key="comp.id" 
                         class="tech-tab-item"
                         :class="{ 
                           active: selectedId === comp.id && !isSidebarEditMode,
                           hidden: hiddenComponents.has(comp.id),
                           'in-edit': isSidebarEditMode
                         }"
                         :style="{ '--delay': index * 0.05 + 's' }"
                         @click="handleSidebarItemClick(comp.id)"
                       >
                         <div class="tech-indicator">
                            <span v-if="isSidebarEditMode" class="eye-icon">
                              {{ hiddenComponents.has(comp.id) ? '✕' : '👁' }}
                            </span>
                            <div v-else class="tech-dot"></div>
                         </div>
                         <div class="tech-hex">
                            <span class="hex-text">{{ comp.id.slice(0,3).toUpperCase() }}</span>
                         </div>
                         <div class="tech-bar">
                            <span class="bar-text">{{ comp.id.toUpperCase() }}</span>
                            <span class="bar-status" v-if="isSidebarEditMode">
                              {{ hiddenComponents.has(comp.id) ? 'HIDDEN' : 'VISIBLE' }}
                            </span>
                            <span class="bar-sub" v-else>System</span>
                         </div>
                       </div>
                       
                       <div v-if="sidebarDisplayList.length === 0" class="empty-list">
                         {{ isSidebarEditMode ? 'No components found' : 'All components hidden' }}
                       </div>
                   </div>
                </div>
            </div>
         </div>

         <transition name="fade-up">
            <div v-if="multiSelectedIds.size > 1" class="group-actions-bar">
              <div class="selection-info">
                <span class="count">{{ multiSelectedIds.size }}</span>
                <span class="label">selected</span>
              </div>
              <div class="actions-row">
                <button class="action-btn primary" @click.stop="handleMergeGroup">
                  <span class="icon">🔗</span> Merge Group
                </button>
                <button class="action-btn secondary" @click.stop="clearSelection">
                  Cancel
                </button>
              </div>
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
            <div 
              v-if="selectedId" 
              class="split-top" 
              :class="{ 'flex-fill': !selectedConnectionId }"
              :style="!selectedConnectionId ? {} : { height: layoutState.rightTopHeight + 'px' }"
            >
               <ComponentEditor 
                 :selectedId="selectedId" 
                 :embedded="true" 
                 :allowClose="true"
                 @close="selectedId = null" 
                 @close-panel="selectedId = null"
                 @update="handleConfigUpdate" 
               />
            </div>
            
            <div 
              v-if="selectedId && selectedConnectionId" 
              class="split-resizer" 
              @mousedown="startResize('right-split', $event)"
            >
               <div class="resizer-handle"></div>
            </div>

            <div 
              v-if="selectedConnectionId"
              class="split-bottom"
            >
               <ConnectionEditor 
                 :embedded="true" 
                 :allowClose="true"
                 @close="selectedConnectionId = null" 
                 @close-panel="selectedConnectionId = null"
               />
            </div>
         </div>
      </div>
    </div>

    <!-- BottomConsole Removed -->

    <transition name="fade">
      <div v-if="showSimSettingsModal" class="settings-modal-overlay">
        <div class="settings-card">
          <div class="modal-header">
            <h3>SIMULATION CONFIG</h3>
            <button class="close-modal" @click="showSimSettingsModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Model ID</label>
              <input type="text" v-model="simSettings.modelName" disabled class="input-disabled">
            </div>
            <div class="form-row">
              <div class="form-group"><label>Stop Time (s)</label><input type="number" v-model.number="simSettings.stopTime" step="100" :disabled="isReadOnly"></div>
              <div class="form-group"><label>Step Size (s)</label><input type="number" v-model.number="simSettings.stepSize" step="0.1" :disabled="isReadOnly"></div>
            </div>
            <div class="modified-params-section" v-if="hasModifiedParams">
              <label>Modified Parameters ({{ flatModifiedParams.length }})</label>
              <div class="params-scroll-box">
                <div v-for="(p, idx) in flatModifiedParams" :key="idx" class="mod-param-row">
                  <span class="p-key">{{ p.displayKey }}</span><span class="p-val" :title="p.value">{{ formatParamValue(p.value) }}</span>
                </div>
              </div>
            </div>
            <div class="modified-params-section alert-section" v-if="activeRulesList.length > 0">
              <label>Active Alerts ({{ activeRulesList.length }})</label>
              <div class="params-scroll-box">
                <div v-for="rule in activeRulesList" :key="rule.id" class="mod-param-row alert-row-preview">
                  <span class="p-key">{{ rule.id.toUpperCase() }}</span><span class="p-val">{{ rule.operator }} {{ rule.threshold }}</span>
                </div>
              </div>
            </div>
             <div class="info-box" v-if="!hasModifiedParams && activeRulesList.length === 0">
              <span class="info-icon">ℹ</span><span class="info-text">Using default configuration.</span>
            </div>
          </div>
          <div class="modal-footer">

            <button class="btn-cancel" @click="showSimSettingsModal = false">CANCEL</button>
            <button class="btn-confirm" @click="confirmRunSimulation" :disabled="isReadOnly">
                {{ isReadOnly ? 'ACCESS DENIED' : 'INITIATE ▶' }}
            </button>
          </div>
          <div class="modal-footer-secondary">
             <label class="enhanced-mode-toggle">
                <input type="checkbox" v-model="isEnhancedMode">
                <span>Enable Enhanced Mode (--enhanced)</span>
             </label>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showEnhancedModal" class="settings-modal-overlay enhanced-overlay">
        <div class="settings-card enhanced-card">
          <div class="modal-header">
            <h3>ENHANCED CONFIGURATION</h3>
            <button class="close-modal" @click="showEnhancedModal = false">✕</button>
          </div>
          <div class="modal-body enhanced-body">
             <div class="json-editor-wrapper">
                <textarea v-model="enhancedConfigJson" class="json-textarea" spellcheck="false"></textarea>
             </div>
             <div class="enhanced-info">
                Manually edit the configuration JSON. Use with caution.
                Ref: tricys_backend/tests structures.
             </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showEnhancedModal = false">BACK</button>
            <button class="btn-confirm" @click="submitEnhancedSimulation">SUBMIT & RUN ▶</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="pop-in"><div v-if="activeAlert" class="alert-modal-overlay"><div class="alert-card"><div class="alert-header"><span class="alert-icon-lg">⚠️</span><h3>INVENTORY ALERT</h3></div><div class="alert-body"><div class="alert-info-row"><span class="lbl">Component:</span><span class="val">{{ activeAlert.id.toUpperCase() }}</span></div><div class="alert-info-row"><span class="lbl">Time:</span><span class="val">{{ activeAlert.time }} h</span></div><div class="alert-info-row"><span class="lbl">Value:</span><span class="val highlight">{{ activeAlert.value }} g</span></div><div class="alert-condition">Condition: Value {{ activeAlert.rule }}</div></div><div class="alert-footer"><button class="btn-ignore" @click="ignoreAlert(activeAlert.id)">Ignore</button><button class="btn-ack" @click="confirmAlert">Acknowledge</button></div></div></div></transition>
    

    <!-- New Bottom Toolbar -->
    <div class="view-toolbar-bottom" v-show="!isEditorMode && !(showUploadOverlay && !isDemo) && !isReadOnly">
      <button 
        class="action-btn-lg primary" 
        :class="{ 'running': isSimulating, 'disabled': isReadOnly }"
        @click.stop="!isReadOnly && handleSimButtonClick()" 
      >
         <span class="icon" v-if="isSimulating">⟳</span>
         <span class="icon" v-else>▶</span>
         <span class="label">{{ isReadOnly ? 'READ ONLY' : (isSimulating ? 'SYSTEM BUSY' : 'INITIATE SIMULATION') }}</span>
      </button>
      
      <button class="action-btn-lg secondary" @click.stop="handleResetParameters" :disabled="isReadOnly">
         <span class="icon">✕</span>
         <span class="label">CLEAR</span>
      </button>


    </div>

    <transition name="fade"><button v-if="isEditorMode" class="exit-fs-btn" @click="exitFullscreen">✕ EXIT EDITOR</button></transition>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSimulation } from '../composables/useSimulation';
import { $confirm } from '../utils/dialog';
import { $notify, $updateNotification, closeNotification } from '../utils/notification';
import { taskApi } from '../api/task'; // [NEW]

import ThreeScene from '../components/ThreeScene.vue';
import DashboardPanel from '../components/DashboardPanel.vue';
import ComponentEditor from '../components/ComponentEditor.vue';
import ConnectionEditor from '../components/ConnectionEditor.vue';

// import BottomConsole from '../components/BottomConsole.vue'; // Removed for Config Refactor

const props = defineProps({ mode: { type: String, default: 'normal' } });
const router = useRouter();

const { 
  resetSession, updateDashboardVisibility, hasSimulationData, loadData, clearResults,
  modelConfig, modifiedParams, lastSimConfig, loadModelConfig,
  showLabels, showValues, alertRules, activeAlert, ignoreAlert, confirmAlert,
  isDashboardMode, toggleDashboardMode: _toggleDashboardMode,
  selectedConnectionId, isExpanded, setExpandedGroup,
  multiSelectedIds, createGroup, dissolveGroup, clearSelection,
  structureData,
  componentParams, defaultParams, // [Added]
  fetchHiddenComponents, 
  saveHiddenComponents, isReadOnly   
} = useSimulation();

const selectedId = ref(null);
const sceneRef = ref(null);
const isFullscreen = ref(false);
const isEditorMode = ref(false);

const showSimSettingsModal = ref(false);
const showSettingsMenu = ref(false);
const showUploadOverlay = ref(false);
const isReady = ref(false);
const BACKEND_URL = 'http://localhost:8000';



// Sidebar State
const isSidebarOpen = ref(false);
const isSidebarEditMode = ref(false); 
const hiddenComponents = ref(new Set()); 

// Analysis Terminal State
// const showBottomConsole = ref(true); // Removed
const terminalHeight = ref(0); // Set to 0 to remove spacing 

// Dashboard Dock State
const isDashboardDocked = ref(false);

const simSettings = reactive({ stopTime: 2000.0, stepSize: 0.5, modelName: "example_model.Cycle", packagePath: "" });
const isSimulating = ref(false);
const elapsedTime = ref(0);
let timerInterval = null;
let pollInterval = null;
let simulationNotifyId = null; // [NEW] Notification ID for Sim
const isEnhancedMode = ref(false);
const showEnhancedModal = ref(false);
const enhancedConfigJson = ref('');

// Layout State
const layoutState = reactive({
  dashboardWidth: 420,
  rightWidth: 320, 
  rightTopHeight: 400, 
  isResizing: false
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

const hasRightPanelContent = computed(() => !!selectedId.value || !!selectedConnectionId.value);
const terminalLeftOffset = computed(() => {
  if (isDashboardDocked.value && hasSimulationData.value) {
    return layoutState.dashboardWidth + 6; 
  }
  return 0;
});

const gridStyle = computed(() => {
  const leftColWidth = (isDashboardDocked.value && hasSimulationData.value) ? `${layoutState.dashboardWidth}px` : '0px';
  const resizerLeftWidth = (isDashboardDocked.value && hasSimulationData.value) ? '6px' : '0px';
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

watch(selectedId, (newVal) => { if (newVal && !isDashboardMode.value) selectedConnectionId.value = null; });
watch(selectedConnectionId, (newVal) => { if (newVal && !isDashboardMode.value) selectedId.value = null; });
watch(lastSimConfig, (newVal) => { if (newVal && newVal.simulation) { simSettings.stopTime = newVal.simulation.stop_time; simSettings.stepSize = newVal.simulation.step_size; simSettings.modelName = newVal.simulation.model_name; } }, { immediate: true });

const isDemo = computed(() => props.mode === 'demo');
const statusText = computed(() => { if (isDemo.value) return hasSimulationData.value ? 'Demo Active' : 'Demo Model Ready'; return hasSimulationData.value ? 'Session Active' : 'Model View Only'; });

// [MODIFIED] Init with Notify
const initPage = async () => { 
  const queryProjectId = router.currentRoute.value.query.projectId;
  
  // Update: If we have a projectId, use it. Otherwise, if demo, use demo logic (or redirect)
  if (queryProjectId) {
      await loadModelConfig(); // actually deprecated but kept for safety
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
      
      // Update package path for simulation
      if (responseData.file_path) {
        simSettings.packagePath = responseData.file_path;
        simSettings.modelName = responseData.name || simSettings.modelName; // usage of name if returned, else keep default/extracted
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
const handleMergeGroup = () => { if (multiSelectedIds.value.size < 2) return; const groupName = prompt("Enter name for the new group:", `System Group ${Math.floor(Math.random() * 100)}`); if (groupName) createGroup(groupName); };
const onGlobalClick = () => closeSettingsMenu();
const flatModifiedParams = computed(() => { const list = []; if (!modifiedParams.value) return list; for (const [compId, params] of Object.entries(modifiedParams.value)) { for (const [key, val] of Object.entries(params)) { const displayKey = key.startsWith(compId + '.') ? key : `${compId}.${key}`; list.push({ key, displayKey, value: val }); } } return list; });
const hasModifiedParams = computed(() => flatModifiedParams.value.length > 0);
const activeRulesList = computed(() => { const list = []; if (!alertRules || !alertRules.value) return list; for(const [id, rule] of Object.entries(alertRules.value)) { if(rule.enabled) list.push({ id, ...rule }); } return list; });
const simButtonText = computed(() => { if (isSimulating.value) return "RUNNING..."; if (hasSimulationData.value) return "CLEAR DATA"; return "SIMULATE"; });
const formatParamValue = (val) => { if (Array.isArray(val)) return `[${val.length} items]`; if (typeof val === 'number') return Number.isInteger(val) ? val : val.toFixed(4); return val; };
const toggleSettingsMenu = () => { showSettingsMenu.value = !showSettingsMenu.value; };
const closeSettingsMenu = () => { if (showSettingsMenu.value) showSettingsMenu.value = false; };
const handleSimButtonClick = () => { if (hasSimulationData.value) doClearResults(); else showSimSettingsModal.value = true; };
const confirmRunSimulation = () => { 
  if (isEnhancedMode.value) {
    // Generate base config and open Enhanced Modal
    const config = generateConfigPayload();
    enhancedConfigJson.value = JSON.stringify(config, null, 4);
    showSimSettingsModal.value = false;
    showEnhancedModal.value = true;
  } else {
    showSimSettingsModal.value = false; 
    runSimulation(); 
  }
};

const generateConfigPayload = () => {
    const baseVars = ['time']; 
    // Note: structureData might be null if not loaded yet, but usually is for Sim
    const structure = structureData.value || { components: [] };
    const componentIds = structure.components ? structure.components.map(c => c.id) : [];
    const componentVars = componentIds.map(id => `${id}.I[1]`); 
    const filterString = [...baseVars, ...componentVars].join('|'); 
    
    const simParams = {}; 
    let hasSweep = false;

    flatModifiedParams.value.forEach(item => { 
        let val = item.value;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try { 
                    val = JSON.parse(trimmed); 
                    if (Array.isArray(val)) hasSweep = true;
                } catch(e) {}
            }
        } else if (Array.isArray(val)) {
            hasSweep = true;
        }
        
        // If val is array (sweep), use it directly. If scalar, wrap in [].
        simParams[item.displayKey] = Array.isArray(val) ? val : [val]; 
    }); 

    return {
      type: "BASIC",
      name: `${simSettings.modelName}_Run_${new Date().toISOString().slice(11,19)}`,
      project_id: router.currentRoute.value.query.projectId, // [NEW] Pass project ID
      enhanced: isEnhancedMode.value, 
      config_json: {
        paths: { package_path: simSettings.packagePath || "uploaded_model.mo" }, 
        simulation: { 
            model_name: simSettings.modelName, 
            variableFilter: filterString, 
            stop_time: simSettings.stopTime, 
            step_size: simSettings.stepSize 
        }, 
        simulation_parameters: simParams, 
        metrics_definition: {
            "Startup_Inventory": {
                "source_column": "sds.I[1]",
                "method": "calculate_startup_inventory"
            },
            "Self_Sufficiency_Time": {
                "source_column": "sds.I[1]",
                "method": "time_of_turning_point"
            },
            "Doubling_Time": {
                "source_column": "sds.I[1]",
                "method": "calculate_doubling_time"
            }
        },
        active_alerts: activeRulesList.value 
      }
    };
};

const submitEnhancedSimulation = async () => {
    try {
        const payload = JSON.parse(enhancedConfigJson.value);
        showEnhancedModal.value = false;
        await submitTask(payload);
    } catch (e) {
        $notify({ title: 'JSON ERROR', message: e.message, type: 'error' });
    }
};

// [MODIFIED] Simulation Logic with Persistent Notification
// [MODIFIED] Simulation Logic - Submit and Redirect
// Refactored submit logic
const submitTask = async (taskPayload) => {
    if (isSimulating.value) return; 
    isSimulating.value = true;
    
    $notify({ title: 'SUBMITTING JOB', message: 'Transmitting configuration...', type: 'process', duration: 2000 });

    try {
        const taskData = await taskApi.createTask(taskPayload);
        $notify({ title: 'JOB ACCEPTED', message: `Task ${taskData.id.slice(0,8)} initialized.`, type: 'success' });
        
        // Pass taskId to Monitor View
        setTimeout(() => { router.push({ name: 'monitor', query: { taskId: taskData.id } }); }, 1000);

    } catch (e) { 
        isSimulating.value = false;
        $notify({ title: 'SUBMIT ERROR', message: e.message || "Unknown error", type: 'error' });
    }
};

const runSimulation = async () => { 
  const payload = generateConfigPayload();
  await submitTask(payload);
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
        $notify({ title: 'RESET COMPLETE', message: 'Parameters restored to defaults.', type: 'info' });
    }
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
const handleSelect = (id) => { selectedId.value = id; };
const handleConfigUpdate = () => { if (selectedId.value && sceneRef.value) sceneRef.value.reloadComponent(selectedId.value); };
const handleResize = () => updateDashboardVisibility();

onMounted(() => { initPage(); window.addEventListener('resize', handleResize); document.addEventListener('fullscreenchange', onFullscreenChange); updateDashboardVisibility(); });
onUnmounted(() => { window.removeEventListener('resize', handleResize); document.removeEventListener('fullscreenchange', onFullscreenChange); clearInterval(timerInterval); clearInterval(pollInterval); });
</script>

<style scoped>
/* Base Styles */
/* Base Styles */
.vis-view { position: relative; width: 100%; height: 100%; overflow: hidden; background: #05070a; display: flex; flex-direction: column; font-family: 'Inter', 'Roboto Mono', sans-serif; }

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
.run-btn:hover { transform: translateY(-1px); box-shadow: 0 0 20px rgba(0, 210, 255, 0.4); filter: brightness(1.1); }
.run-btn:active { transform: translateY(0); }
.run-btn.running { background: #333; color: #888; border: 1px solid #444; box-shadow: none; cursor: wait; }
.run-btn .icon { font-size: 12px; }

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
.bar-section { display: flex; align-items: center; height: 100%; }
.bar-section.left { gap: 20px; }
.bar-section.right { gap: 15px; }
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
.mod-param-row { display: flex; justify-content: space-between; font-size: 11px; font-family: "Consolas", monospace; color: #ccc; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 2px; }
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
<template>
  <div class="editor-panel" :class="{ open: selectedId, 'embedded-mode': embedded }" @click.stop>
    
    <div class="header">
      <h3>{{ selectedId ? (isGroup(selectedId) ? "Group: " : "Component: ") + selectedId.toUpperCase() : 'Component Setting' }}</h3>
      
      <button 
        v-if="!embedded || allowClose" 
        class="close-btn" 
        @click="handleClose"
        title="Hide Panel"
      >×</button>
    </div>

    <div v-if="selectedId" class="content custom-scroll" @scroll="handleScroll">
      
      <template v-if="isGroup(selectedId)">
        <div class="section-header-group">
          <div class="section-label">GROUP ACTIONS</div>
          <span class="unlocked-badge">System</span>
        </div>
        
        <div class="group-actions-box">
          <button class="action-btn" @click="toggleGroupView">
            <span class="icon">{{ isExpanded(selectedId) ? '↙' : '🔍' }}</span>
            {{ isExpanded(selectedId) ? 'Collapse Group' : 'View Inside' }}
          </button>
          
          <button class="action-btn danger" @click="handleUnmerge">
            <span class="icon">⛓️‍💥</span> Unmerge Group
          </button>
        </div>

        <div class="divider"></div>
      </template>

      <div class="section-header-group">
        <div class="section-label">PHYSICAL PARAMETERS</div>
        <span v-if="hasSimulationData" class="locked-badge" title="Clear data to edit">🔒 Locked</span>
      </div>
      
      <div v-if="isGroup(selectedId)" class="group-params-container">
        <div v-for="childId in currentGroupChildren" :key="childId" class="group-member-block">
          <div class="member-header">
            <span class="member-icon">📦</span> {{ childId.toUpperCase() }}
          </div>
          <div class="params-list">
             <div v-for="param in getChildParams(childId)" :key="param.name" class="param-item" :class="{ 'item-disabled': hasSimulationData }">
                <div class="param-header">
                  <span class="param-key">{{ getParamName(param.name) }}</span>
                  <div v-if="isParamModified(param.name) && !hasSimulationData" class="modified-group">
                    <span class="modified-tag">MODIFIED</span>
                    <button class="revert-btn" @click="revertToDefault(param.name)">↺</button>
                  </div>
                  <div v-else-if="isParamModified(param.name)" class="modified-group">
                    <span class="modified-tag locked">MODIFIED</span>
                  </div>
                </div>
                <input type="text" v-model="param.value" class="param-input" :class="{ dirty: isParamModified(param.name) }" :disabled="hasSimulationData" />
             </div>
             <div v-if="getChildParams(childId).length === 0" class="no-params-mini">No params</div>
          </div>
        </div>
        <div v-if="currentGroupChildren.length === 0" class="no-params">Empty Group</div>
      </div>

      <div v-else>
        <div v-if="localParamsList.length > 0" class="params-list">
          <div v-for="param in localParamsList" :key="param.name" class="param-item" :class="{ 'item-disabled': hasSimulationData }">
            <div class="param-header">
              <span class="param-key" :title="param.name">{{ getSimpleName(param.name) }}</span>
              <div v-if="isParamModified(param.name) && !hasSimulationData" class="modified-group">
                <span class="modified-tag">MODIFIED</span>
                <button class="revert-btn" @click="revertToDefault(param.name)">↺</button>
              </div>
              <div v-else-if="isParamModified(param.name)" class="modified-group">
                <span class="modified-tag locked">MODIFIED</span>
              </div>
            </div>
            
            <div class="param-meta-row">
              <span v-if="param.comment" class="param-comment">{{ param.comment }}</span>
              <span class="param-default">Default: {{ param.defaultValue }}</span>
            </div>
            
            <input type="text" v-model="param.value" class="param-input" :class="{ dirty: isParamModified(param.name) }" :disabled="hasSimulationData" />
          </div>
        </div>
        <div v-else class="no-params">No parameters available.</div>
      </div>

      <div class="divider"></div>

      <template v-if="!isGroup(selectedId)">
        <div class="section-header-group">
          <div class="section-label">INVENTORY ALERT</div>
          <span v-if="hasSimulationData" class="locked-badge">🔒 Locked</span>
        </div>
        <div class="alert-config-box" :class="{ 'box-disabled': hasSimulationData }">
          <div class="form-row-center">
            <label class="switch">
              <input type="checkbox" v-model="localAlert.enabled" :disabled="hasSimulationData">
              <span class="slider round" :class="{ disabled: hasSimulationData }"></span>
            </label>
            <span class="switch-label" :class="{ active: localAlert.enabled }">
              {{ localAlert.enabled ? 'Alert Enabled' : 'Alert Disabled' }}
            </span>
          </div>
          <transition name="slide-fade">
            <div v-if="localAlert.enabled" class="alert-inputs">
              <span class="static-text">Trigger when Inventory is:</span>
              <div class="input-group">
                <select v-model="localAlert.operator" class="op-select" :disabled="hasSimulationData">
                  <option value=">">&gt; (Greater than)</option>
                  <option value="<">&lt; (Less than)</option>
                </select>
                <input type="number" v-model.number="localAlert.threshold" class="val-input" placeholder="Value" :disabled="hasSimulationData">
                <span class="unit">g</span>
              </div>
            </div>
          </transition>
        </div>
        <div class="divider"></div>
      </template>

      <div class="section-header-group">
         <div class="section-label">VISUAL SETTINGS</div>
         <span class="unlocked-badge">✎ Editable</span>
      </div>
      
      <div class="form-group">
        <label>Description</label>
        <textarea v-model="localNote" rows="2" :disabled="isReadOnly"></textarea>
      </div>

      <div class="form-group">
        <label>Scale: {{ localConfig.scale?.toFixed(1) }}</label>
        <input type="range" min="0.1" max="50.0" step="0.1" v-model.number="localConfig.scale" :disabled="isReadOnly" />
      </div>

      <div class="form-group">
        <div class="row-space-between">
          <label>3D Model Asset</label>
          <div class="badge" :class="localConfig.type">{{ localConfig.type }}</div>
        </div>
        <div class="model-selector" ref="modelSelectorRef">
          <div class="custom-select-trigger" :class="{ active: showModelDropdown, disabled: isReadOnly }" @click="!isReadOnly && toggleModelDropdown()">
            <span class="selected-text">{{ currentModelName }}</span>
            <span class="dropdown-arrow">▼</span>
          </div>
          <transition name="dropdown-fade">
            <div v-if="showModelDropdown" class="custom-dropdown-menu">
              <div class="dropdown-item" :class="{ selected: selectedModelUrl === '' }" @click="selectModel('')"><span class="item-icon">🧊</span> Use Default Geometry</div>
              <div class="dropdown-divider" v-if="libraryModels.length > 0"></div>
              <div class="dropdown-label" v-if="libraryModels.length > 0">LIBRARY MODELS</div>
              <div v-for="m in libraryModels" :key="m.url" class="dropdown-item" :class="{ selected: selectedModelUrl === m.url }" @click="selectModel(m.url)"><span class="item-icon">📦</span> {{ m.name }}</div>
              <div v-if="libraryModels.length === 0" class="dropdown-empty">No models in library</div>
            </div>
          </transition>
          <button class="icon-btn upload" @click="triggerUpload" :disabled="isReadOnly" title="Upload Project Model"><span v-if="!isUploading">⬆</span><span v-else class="spinner">⟳</span></button>
        </div>
        <input type="file" ref="fileInput" accept=".glb" style="display:none" @change="handleUploadModel" />
      </div>

      <div style="height: 20px;"></div>
    </div>

    <div v-if="selectedId" class="actions">
      <button class="btn primary" @click="saveAll" :disabled="isReadOnly">
          {{ isReadOnly ? 'Read Only' : (hasSimulationData ? 'Save Visuals' : 'Save All Changes') }}
      </button>
      <button 
        class="btn secondary" 
        @click="resetChanges"
        :disabled="!hasChanges"
        :title="!hasChanges ? 'No changes to reset' : 'Revert to last saved state'"
      >
        Reset
      </button>
    </div>
    
    <div v-if="!selectedId" class="empty-state">
      <div class="icon">👆</div>
      <div>Select a component to edit.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, onUnmounted } from 'vue';
import { useSimulation } from '../composables/useSimulation';
import { useAuth } from '../composables/useAuth';
import { $confirm } from '../utils/dialog';
import { $notify } from '../utils/notification'; 

const props = defineProps(['selectedId', 'embedded', 'allowClose']);
const emit = defineEmits(['close', 'update', 'close-panel']);

const { 
  modelConfig, annotations, saveAnnotations, componentParams, defaultParams, saveParameters,
  libraryModels, fetchLibraryModels,
  alertRules, saveAlertRules,
  hasSimulationData, currentProjectId,
  isGroup, isExpanded, setExpandedGroup, dissolveGroup, componentGroups, isReadOnly
} = useSimulation();

import { projectApi } from '../api/project';
import { libraryApi } from '../api/library';

const { currentUser } = useAuth();
const isSuperUser = computed(() => currentUser.value && currentUser.value.is_superuser);

const localConfig = ref({ type: 'default', scale: 1.0, url: '' });
const localNote = ref('');
const localParamsList = ref([]); // List of { name, value, defaultValue, comment, type }
const localAlert = ref({ enabled: false, operator: '>', threshold: 1000 });

// Original state tracking
const originalConfig = ref({});
const originalNote = ref('');
const originalParams = ref({});
const originalAlert = ref({});

const isUploading = ref(false);
const fileInput = ref(null);
const selectedModelUrl = ref('');
// Base URL for static assets (remove /api/v1 if it exists in env, we want the root)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, ''); 

const showModelDropdown = ref(false);
const modelSelectorRef = ref(null);

const currentGroupChildren = ref([]);

onMounted(() => { fetchLibraryModels(); window.addEventListener('click', closeDropdownOnClickOutside); });
onUnmounted(() => { window.removeEventListener('click', closeDropdownOnClickOutside); });

const getSafeId = (rawId) => {
    if (!rawId) return '';
    if (rawId.startsWith('GROUP_')) return rawId;
    return rawId.toLowerCase();
};

const toggleGroupView = () => {
    if (!props.selectedId) return;
    if (isExpanded(props.selectedId)) setExpandedGroup(null);
    else setExpandedGroup(props.selectedId);
};

const handleUnmerge = async () => {
    if (!props.selectedId) return;
    const isConfirmed = await $confirm(
        "Dissolving this group will separate all internal components back to the main view. Continue?", 
        "DISSOLVE GROUP"
    );
    if (isConfirmed) {
        dissolveGroup(props.selectedId);
        emit('close');
    }
};

// --- DATA LOADING & WATCHING ---
// 1. 将加载逻辑提取为一个独立函数，避免代码重复
const loadEditorData = () => {
  const newId = props.selectedId;
  if (!newId) return;

  const safeId = getSafeId(newId);

  // 1. Config & Note (Config 通常是本地状态或已存在，不太受异步影响，但统一重载更安全)
  if (modelConfig.value && modelConfig.value[safeId]) {
    localConfig.value = { ...modelConfig.value[safeId] };
  } else {
    localConfig.value = { type: 'default', scale: 1.0, url: '' };
  }
  selectedModelUrl.value = localConfig.value.type === 'custom' ? localConfig.value.url : '';
  originalConfig.value = JSON.parse(JSON.stringify(localConfig.value));

  localNote.value = (annotations.value && annotations.value[safeId]) || '';
  originalNote.value = localNote.value;

  // 2. Parameters Loading (Structured List)
  const bufferList = [];
  currentGroupChildren.value = [];

  const safeIdLower = safeId.toLowerCase();

  // Helper to find param def in componentParams list
  // componentParams is now expected to be a LIST of ALL params in system
  // We filter by prefix "safeId." for non-groups
  
  // NOTE: This assumes componentParams is now a list. 
  // If backend returns list, useSimulation must serve it.
  // Actually, useSimulation keeps componentParams as a Dict for easy access?
  // Let's assume useSimulation logic might need update, OR we process the dict 
  // if backend sends list but logic converts it.
  
  // Wait, if backend sends list, useSimulation needs to handle it.
  // Assuming componentParams is array:
  const allParams = Array.isArray(componentParams.value) ? componentParams.value : [];
  
  if (isGroup(safeId)) {
      // GROUP LOGIC
       if (componentGroups.value && componentGroups.value[safeId]) {
          const groupDef = componentGroups.value[safeId];
          if (groupDef && groupDef.children) {
              currentGroupChildren.value = groupDef.children;
              // Iterate all params and find those belonging to children
              groupDef.children.forEach(childId => {
                  const prefix = childId + ".";
                  const childParams = allParams.filter(p => p.name.startsWith(prefix));
                  childParams.forEach(p => {
                       bufferList.push({ ...p }); // Clone
                  });
              });
          }
      }
  } else {
      // SINGLE COMPONENT LOGIC
      // Filter params starting with "safeId."
      // BUT existing logic used lowercase.
      // LayoutService stores "Type.Param" e.g. "plasma.fb".
      // Our ID might be "plasma".
      // Let's match case-insensitive or expect componentParams to have consistent keys.
      
      bufferList.push(...allParams.filter(p => p.name.toLowerCase().startsWith(safeIdLower + ".")));
  }
  
  localParamsList.value = bufferList;
  // Deep clone for original state
  originalParams.value = JSON.parse(JSON.stringify(bufferList));

  // 3. Alerts
  if (!isGroup(safeId)) {
      const rules = alertRules.value || {};
      const rule = rules[safeId];
      if (rule) {
          localAlert.value = { ...rule };
      } else {
          localAlert.value = { enabled: false, operator: '>', threshold: 1000 };
      }
      originalAlert.value = JSON.parse(JSON.stringify(localAlert.value));
  }
};

// 2. 使用数组监听：同时监听 ID 变化 和 数据源变化
watch(
  [
    () => props.selectedId, 
    componentParams,     // 监听参数数据变化 (解决加载延迟)
    componentGroups,     // 监听分组数据变化
    alertRules,          // 监听警报规则变化
    modelConfig          // 监听配置变化
  ], 
  loadEditorData, 
  { immediate: true, deep: false } // deep: false 即可，因为 ref 被替换时会触发
);

// --- HELPER FUNCTIONS FOR GROUP PARAMS ---

// Filters localParams to only show those belonging to specific child
const getChildParams = (childId) => {
    const prefix = `${childId.toLowerCase()}.`;
    return localParamsList.value.filter(p => p.name.toLowerCase().startsWith(prefix));
};

const getParamName = (fullName) => {
    return fullName.split('.').slice(1).join('.');
};

const getParamOwner = (fullName) => {
    return fullName.split('.')[0];
};

// --- MODIFIED STATE CHECKERS ---

const hasChanges = computed(() => {
    const configChanged = JSON.stringify(localConfig.value) !== JSON.stringify(originalConfig.value);
    const noteChanged = localNote.value !== originalNote.value;
    if (hasSimulationData.value) return configChanged || noteChanged;
    
    const paramsChanged = JSON.stringify(localParamsList.value) !== JSON.stringify(originalParams.value);
    // Only check alert changes if not group
    const alertChanged = !isGroup(props.selectedId) && JSON.stringify(localAlert.value) !== JSON.stringify(originalAlert.value);
    
    return configChanged || noteChanged || paramsChanged || alertChanged;
});

const getSimpleName = (fullName) => {
    return fullName.split('.').pop();
};

const isParamModified = (name) => {
    const current = localParamsList.value.find(p => p.name === name);
    const orig = originalParams.value.find(p => p.name === name); // Use original loaded state, simpler than checking defaults for now
    if (!current || !orig) return false;
    return current.value != orig.value; // Loose equality for string/number match? Or strict if types match
};

const revertToDefault = (name) => {
    const currentParam = localParamsList.value.find(p => p.name === name);
    // Revert to defaultValue from object structure
    if (currentParam) {
        currentParam.value = currentParam.defaultValue; // Or originalParams value? usually defaultValue
    }
};

// --- SAVING ---

const saveAll = async () => { 
  if (!props.selectedId) return; 
  const safeId = getSafeId(props.selectedId); 
  try { 
    // 1. Config & Annotations (Works for Groups too)
    // Update local modelConfig state for immediate reflection
    modelConfig.value[safeId] = { ...localConfig.value }; 
    
    // Save Visual Config to Backend (Structure)
    if (currentProjectId.value) {
        await projectApi.saveComponentVisuals(currentProjectId.value, {
            id: safeId,
            visual: { ...localConfig.value }
        });
    }
    
    originalConfig.value = JSON.parse(JSON.stringify(localConfig.value)); 

    const newNotes = { ...(annotations.value||{}) }; 
    if (localNote.value.trim()) newNotes[safeId] = localNote.value; 
    else delete newNotes[safeId]; 
    await saveAnnotations(newNotes); 
    originalNote.value = localNote.value; 

    // 2. Params
    if (!hasSimulationData.value) { 
        // We update the master componentParams list with our local changes
        // Instead of complex object merging, we find matching items in master list and update value
        if (Array.isArray(componentParams.value)) {
             localParamsList.value.forEach(localP => {
                 const masterP = componentParams.value.find(p => p.name === localP.name);
                 if (masterP) masterP.value = localP.value;
             });
        }
        
        await saveParameters(componentParams.value); 
        originalParams.value = JSON.parse(JSON.stringify(localParamsList.value)); 

        // 3. Alerts (Single only)
        if (!isGroup(safeId)) {
            const newRules = { ...(alertRules.value || {}) }; 
            if (localAlert.value.enabled) { newRules[safeId] = { ...localAlert.value }; } 
            else { delete newRules[safeId]; } 
            await saveAlertRules(newRules);
            originalAlert.value = JSON.parse(JSON.stringify(localAlert.value)); 
        }
    } 
    emit('update'); 
    $notify({ title: 'SAVED', message: 'Configuration updated successfully.', type: 'success', duration: 2000 });
  } catch (e) { 
    console.error(e); 
    $notify({ title: 'SAVE FAILED', message: e.message || 'Unknown error occurred.', type: 'error' }); 
  } 
};

// ... (Rest of existing methods: resetChanges, handleClose, model selection etc. remain same) ...

const resetChanges = () => { 
  localParamsList.value = JSON.parse(JSON.stringify(originalParams.value)); 
  if (!isGroup(props.selectedId)) {
      localAlert.value = JSON.parse(JSON.stringify(originalAlert.value));
  }
  localConfig.value = JSON.parse(JSON.stringify(originalConfig.value));
  localNote.value = originalNote.value;
  selectedModelUrl.value = localConfig.value.type === 'custom' ? localConfig.value.url : '';
  onModelSelectChange(); 
};

const currentModelName = computed(() => {
  if (!selectedModelUrl.value) return "Use Default Geometry";
  const found = libraryModels.value.find(m => m.url === selectedModelUrl.value);
  return found ? found.name : "Unknown Model";
});

const toggleModelDropdown = () => { showModelDropdown.value = !showModelDropdown.value; };
const closeDropdownOnClickOutside = (e) => { if (showModelDropdown.value && modelSelectorRef.value && !modelSelectorRef.value.contains(e.target)) { showModelDropdown.value = false; } };
const handleScroll = () => { if (showModelDropdown.value) showModelDropdown.value = false; };
const selectModel = (url) => { selectedModelUrl.value = url; onModelSelectChange(); showModelDropdown.value = false; };
const onModelSelectChange = () => { if (selectedModelUrl.value === "") { localConfig.value.type = 'default'; localConfig.value.url = ''; } else { localConfig.value.type = 'custom'; localConfig.value.url = selectedModelUrl.value; if (localConfig.value.scale === 1.0) localConfig.value.scale = 1.0; } };
const triggerUpload = () => fileInput.value.click();
const handleUploadModel = async (event) => { 
  const file = event.target.files[0]; 
  if (!file) return; 
  
  if (file.size > 50 * 1024 * 1024) { 
      $notify({ title: 'FILE TOO LARGE', message: 'Model size limit is 50MB.', type: 'error' });
      event.target.value = ''; 
      return;
  }
  if (!file.name.toLowerCase().endsWith('.glb')) {
      $notify({ title: 'INVALID FORMAT', message: 'Only .glb files are supported.', type: 'error' });
      event.target.value = '';
      return;
  }

  isUploading.value = true; 
  
  try { 
    // Use Project API to upload model specifically for this component
    // This saves to workspaces/<pid>/visuals/ and updates config automatically
    const res = await projectApi.uploadComponentModel(currentProjectId.value, props.selectedId, file);
    
    // Update local config with the new visual data returned
    if (res.visual) {
         localConfig.value = { ...res.visual };
         selectedModelUrl.value = res.visual.url;
         
         // Note: We don't add it to "Library Models" dropdown because it's project-specific
         // But setting selectedModelUrl will show "Custom Model" or similar in dropdown text
    }
    
    $notify({ title: 'MODEL UPLOADED', message: `Model attached to ${props.selectedId}.`, type: 'success' });
  } catch (e) { 
    $notify({ title: 'UPLOAD FAILED', message: e.message || 'Could not upload model.', type: 'error' });
  } finally { 
    isUploading.value = false; event.target.value = ''; 
  } 
};
const handleClose = () => {
  if (props.embedded && props.allowClose) { emit('close-panel'); } else { emit('close'); }
};
</script>

<style scoped>
.editor-panel { position: absolute; top: 100px; right: -400px; width: 320px; background: rgba(16, 20, 28, 0.95); backdrop-filter: blur(15px); border-radius: 12px; border: 1px solid rgba(0,210,255,0.25); padding: 0; transition: right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 200; box-shadow: -5px 0 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: calc(100vh - 140px); overflow: hidden; }
.editor-panel.open { right: 20px; }
.editor-panel.embedded-mode { position: relative; top: auto; right: auto; bottom: auto; left: auto; width: 100%; height: 100%; max-height: none; transform: none !important; box-shadow: none; border: 1px solid #30363d; background: rgba(20, 25, 35, 0.6); backdrop-filter: blur(10px); z-index: 1; transition: none; border-radius: 12px; box-sizing: border-box; }
.editor-panel::-webkit-scrollbar { width: 4px; } .editor-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
.header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding: 15px 20px; background: rgba(16, 20, 28, 0.98); }
.editor-panel.embedded-mode .header { background: rgba(20, 25, 35, 0.5); }
h3 { margin: 0; color: #00d2ff; font-size: 16px; letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; padding: 0 5px; }
.content { flex: 1; overflow-y: auto; padding: 20px; }
.actions { flex-shrink: 0; display: flex; gap: 10px; padding: 15px 20px; border-top: 1px solid #30363d; background: rgba(16, 20, 28, 0.98); margin-top: 0; }
.editor-panel.embedded-mode .actions { background: rgba(20, 25, 35, 0.5); }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #666; text-align: center; padding: 20px; } .empty-state .icon { font-size: 40px; margin-bottom: 20px; opacity: 0.5; }
.section-header-group { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 10px 0; } .section-header-group:first-child { margin-top: 0; }
.section-label { font-size: 11px; font-weight: 800; color: #666; letter-spacing: 1px; margin: 0; }
.locked-badge { font-size: 10px; color: #ff5252; background: rgba(255, 82, 82, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255, 82, 82, 0.3); }
.unlocked-badge { font-size: 10px; color: #00d2ff; background: rgba(0, 210, 255, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 210, 255, 0.3); }
.divider { height: 1px; background: rgba(255,255,255,0.1); margin: 20px 0; }
.params-list { display: flex; flex-direction: column; gap: 8px; }
.param-item { background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border: 1px solid transparent; transition: opacity 0.3s; }
.param-item.item-disabled { opacity: 0.6; pointer-events: none; filter: grayscale(0.5); }
.param-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.param-key { font-size: 11px; color: #aaa; font-family: monospace; }
.modified-group { display: flex; align-items: center; gap: 6px; }
.modified-tag { font-size: 9px; color: #000; background: #ffca28; padding: 1px 4px; border-radius: 2px; font-weight: bold; }
.modified-tag.locked { background: #666; color: #ccc; }
.revert-btn { background: none; border: none; color: #ffca28; cursor: pointer; font-size: 12px; padding: 0; opacity: 0.8; }
.param-input { width: 100%; background: transparent; border: none; border-bottom: 1px solid #444; color: #00d2ff; font-family: "Consolas", monospace; font-size: 13px; padding: 4px 0; } .param-input:focus { outline: none; border-bottom-color: #00d2ff; } .param-input.dirty { color: #ffca28; border-bottom-color: #ffca28; } .param-input:disabled { color: #888; border-bottom-style: dashed; }
.param-input:disabled { color: #888; border-bottom-style: dashed; }
.param-meta-row { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }
.param-comment { font-size: 10px; color: #666; font-style: italic; line-height: 1.2; }
.param-default { font-size: 9px; color: #444; font-family: monospace; }
.no-params { color: #555; font-style: italic; font-size: 12px; text-align: center; padding: 10px 0; }
.alert-config-box { background: rgba(255, 82, 82, 0.05); border: 1px solid rgba(255, 82, 82, 0.2); border-radius: 6px; padding: 10px; transition: opacity 0.3s; } .alert-config-box.box-disabled { opacity: 0.6; pointer-events: none; }
.form-row-center { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.switch { position: relative; display: inline-block; width: 34px; height: 18px; } .switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: .4s; border-radius: 34px; } .slider.disabled { cursor: not-allowed; background-color: #333; } .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; } input:checked + .slider { background-color: #ff5252; } input:checked + .slider:before { transform: translateX(16px); }
.switch-label { color: #888; font-size: 12px; font-weight: bold; transition: color 0.2s; } .switch-label.active { color: #ff5252; }
.alert-inputs { display: flex; flex-direction: column; gap: 5px; }
.static-text { font-size: 11px; color: #888; }
.input-group { display: flex; gap: 5px; align-items: center; }
.op-select { flex: 1; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid #555; border-radius: 4px; padding: 4px; font-family: monospace; cursor: pointer; }
.val-input { width: 70px; background: rgba(0,0,0,0.3); color: #ff5252; border: 1px solid #555; border-radius: 4px; padding: 4px 4px; font-family: monospace; text-align: right; } .val-input:focus { border-color: #ff5252; outline: none; }
.unit { color: #888; font-size: 11px; }
.form-group { margin-bottom: 15px; }
label { display: block; font-size: 12px; color: #888; margin-bottom: 5px; }
textarea { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: #eee; padding: 8px; border-radius: 4px; resize: vertical; box-sizing: border-box; }
input[type="range"] { width: 100%; cursor: pointer; accent-color: #00d2ff; }
.row-space-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
.badge.custom { background: rgba(0, 210, 255, 0.2); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); }
.badge.default { background: rgba(255, 255, 255, 0.1); color: #ccc; border: 1px solid rgba(255, 255, 255, 0.2); }
.btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 13px; }
.btn.primary { background: linear-gradient(135deg, #0066ff, #00d2ff); color: #fff; }
.btn.secondary { background: rgba(255,255,255,0.1); color: #ccc; border: 1px solid rgba(255,255,255,0.2); }
.btn.secondary:hover:not(:disabled) { background: rgba(255,255,255,0.2); color: #fff; border-color: rgba(255,255,255,0.4); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(100%); }
.model-selector { display: flex; gap: 8px; position: relative; }
.custom-select-trigger { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; }
.custom-select-trigger:hover { border-color: #00d2ff; background: rgba(0, 210, 255, 0.05); }
.custom-select-trigger.active { border-color: #00d2ff; box-shadow: 0 0 8px rgba(0, 210, 255, 0.2); }
.selected-text { font-size: 12px; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dropdown-arrow { font-size: 10px; color: #888; transition: transform 0.2s; }
.custom-select-trigger.active .dropdown-arrow { transform: rotate(180deg); }
.custom-dropdown-menu { position: absolute; bottom: 100%; margin-bottom: 8px; top: auto; left: 0; right: 40px; background: #1a1f28; border: 1px solid #00d2ff; border-radius: 8px; box-shadow: 0 -5px 20px rgba(0,0,0,0.6); z-index: 100; max-height: 180px; overflow-y: auto; }
.custom-dropdown-menu::-webkit-scrollbar { width: 4px; } .custom-dropdown-menu::-webkit-scrollbar-thumb { background: #00d2ff; border-radius: 2px; }
.dropdown-item { padding: 8px 12px; font-size: 12px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s; }
.dropdown-item:hover { background: rgba(0, 210, 255, 0.1); color: #fff; }
.dropdown-item.selected { background: rgba(0, 210, 255, 0.2); color: #00d2ff; font-weight: bold; }
.item-icon { font-size: 14px; }
.dropdown-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0; }
.dropdown-label { font-size: 10px; color: #666; padding: 4px 12px; font-weight: bold; }
.dropdown-empty { padding: 10px; color: #666; font-style: italic; font-size: 12px; text-align: center; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(10px); }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: all 0.2s ease; }
.icon-btn.upload { width: 32px; height: 32px; flex-shrink: 0; background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); color: #00d2ff; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.icon-btn.upload:hover { background: rgba(0, 210, 255, 0.3); color: #fff; }
.spinner { display: inline-block; animation: spin 1s linear infinite; }
.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease; max-height: 100px; opacity: 1; overflow: hidden; }
.slide-fade-enter-from, .slide-fade-leave-to { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Group Specific Styles */
.group-actions-box { display: flex; gap: 10px; margin-bottom: 15px; }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); color: #00d2ff; transition: all 0.2s; }
.action-btn:hover { background: rgba(0, 210, 255, 0.2); }
.action-btn.danger { background: rgba(255, 82, 82, 0.1); border-color: rgba(255, 82, 82, 0.3); color: #ff5252; }
.action-btn.danger:hover { background: rgba(255, 82, 82, 0.2); }

.group-params-container { display: flex; flex-direction: column; gap: 12px; }
.group-member-block { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 8px; }
.member-header { font-size: 11px; font-weight: bold; color: #888; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
.member-icon { margin-right: 5px; font-size: 12px; }
.no-params-mini { font-size: 10px; color: #555; font-style: italic; text-align: center; padding: 5px; }

.config-body { padding: 15px; font-family: "Consolas", monospace; font-size: 11px; color: #ccc; max-height: 150px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
.config-body::-webkit-scrollbar { width: 5px; }
.config-body::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
.config-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
.config-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }

.custom-scroll::-webkit-scrollbar { width: 5px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
</style>
<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div>
          <h2 class="title-gradient">
            Simulation Configuration
          </h2>
          <p class="subtitle">Configure parameters and run simulation</p>
        </div>
        <button @click="handleClose" class="close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Main Content Area -->
      <div class="modal-body">
          <div class="panel-center" v-if="!showPreview">
            
            <!-- Block 1: Settings -->
            <div class="config-block">
              <h3 class="block-title">Simulation Settings</h3>
              <div class="space-y-4">
                <div>
                   <label class="input-label">Task Name (Optional)</label>
                   <input v-model="simSettings.customName" placeholder="Auto-generated if empty" class="input-styled" />
                </div>
                <div>
                   <label class="input-label">Model Name</label>
                   <div class="input-group">
                     <input :value="modelMetadata.modelName || 'example_model.Cycle'" readonly class="input-styled readonly" />
                   </div>
                </div>
                <div>
                  <label class="input-label">Stop Time (s)</label>
                  <input v-model.number="simSettings.stopTime" type="number" min="0.001" step="0.1" class="input-styled" />
                </div>
                <div>
                  <label class="input-label">Step Size (s)</label>
                  <input v-model.number="simSettings.stepSize" type="number" min="0.001" step="0.01" class="input-styled" />
                </div>
              </div>
            </div>

            <!-- Block 2: Parameters -->
            <div class="config-block">
               <h3 class="block-title flex-between">
                 <div style="display: flex; align-items: center; gap: 8px;">
                    Parameter Overrides
                    <button class="help-btn" @click.prevent="showHelp = true" title="Parameter format help">?</button>
                 </div>
                 <span class="count-badge">{{ flatModifiedParams.length }} active</span>
               </h3>
               
               <!-- Add Parameter Form -->
               <div class="add-param-box">
                  <div class="box-label">Add/Modify Parameter Override</div>
                  
                   <!-- Component Select -->
                   <div class="rel-container" ref="compDropdownRef">
                      <label class="mini-label">Component</label>
                      <input 
                        v-model="manualParam.componentSearch" 
                        @focus="manualParam.showCompDropdown = true"
                        placeholder="Search component..." 
                        class="input-mini"
                      />
                      <div v-if="manualParam.showCompDropdown && filteredComponents.length > 0" class="dropdown-list">
                         <div 
                           v-for="comp in filteredComponents" 
                           :key="comp" 
                           @click="selectManualComponent(comp)"
                           class="dropdown-item"
                         >
                           {{ comp }}
                         </div>
                      </div>
                   </div>

                   <!-- Parameter Select -->
                   <div class="rel-container" v-if="manualParam.selectedComponent" ref="paramDropdownRef">
                      <label class="mini-label">Parameter</label>
                      <input 
                        v-model="manualParam.paramSearch" 
                        @focus="manualParam.showParamDropdown = true"
                        placeholder="Search parameter..." 
                        class="input-mini"
                      />
                      <div v-if="manualParam.showParamDropdown && filteredParameters.length > 0" class="dropdown-list">
                        <div 
                          v-for="param in filteredParameters" 
                          :key="param.name" 
                          @click="selectManualParam(param)"
                          class="dropdown-item flex-between"
                        >
                          <span>{{ param.name }}</span>
                          <span class="val-preview">{{ param.value }}</span>
                        </div>
                      </div>
                   </div>
                   
                   <!-- Value Input and Add Button -->
                   <div v-if="manualParam.selectedParam" class="flex-end-gap">
                      <div class="flex-1">
                        <label class="mini-label">New Value</label>
                        <input v-model="manualParam.value" class="input-mini" />
                      </div>
                      <button @click="applyManualParam" class="btn-mini-action">Apply</button>
                   </div>
               </div>

               <!-- Overrides List -->
               <div v-if="flatModifiedParams.length === 0" class="empty-state">
                 No parameter overrides. Simulation will use defaults.
               </div>
               <div v-else class="param-list">
                 <div v-for="(item, index) in flatModifiedParams" :key="index" class="param-item">
                    <div class="truncate-box">
                      <div class="param-key" :title="item.displayKey">{{ item.displayKey }}</div>
                      <!-- Original Value lookup could be expensive, omitted or simple -->
                    </div>
                    <div class="flex-center-gap">
                       <input 
                         :value="item.value"
                         @change="updateExistingParam(item.compId, item.key, $event.target.value)"
                         class="input-micro" 
                       />
                       <button @click="revertExistingParam(item.compId, item.key)" class="btn-micro-del" title="Revert to Default">
                         <svg xmlns="http://www.w3.org/2000/svg" class="icon-xs" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                       </button>
                    </div>
                 </div>
               </div>
            </div>

            <!-- Block 3: Metrics Definition -->
            <div class="config-block">
               <div class="flex-between mb-4">
                 <h3 class="block-title">
                    Metrics Definition
                    <span class="count-badge" v-if="!showMetricsEditor">{{ selectedMetricKeys.length }} active</span>
                 </h3>
                 <button @click="showMetricsEditor = !showMetricsEditor" class="link-btn">
                   {{ showMetricsEditor ? 'Hide Editor' : 'Edit JSON' }}
                 </button>
               </div>
               
               <div v-if="showMetricsEditor">
                 <textarea 
                    v-model="metricsJsonString" 
                    rows="8" 
                    class="textarea-code"
                    placeholder="{ 'MetricName': { ... } }"
                 ></textarea>
                 <div v-if="metricsError" class="error-text">{{ metricsError }}</div>
               </div>
               <div v-else class="metrics-list">
                 <div v-if="availableMetricKeys.length === 0" class="info-text">No metrics defined.</div>
                 <div v-for="key in availableMetricKeys" :key="key" class="metric-item">
                    <label class="checkbox-label">
                       <input type="checkbox" :value="key" v-model="selectedMetricKeys" />
                       <span class="metric-key">{{ key }}</span>
                    </label>
                    <span class="mini-tag">{{ metricsDefinition[key]?.method }}</span>
                 </div>
               </div>
            </div>

          </div>
          
          <!-- Preview Panel -->
          <div class="panel-center" v-else>
             <div class="config-block full-height">
                <h3 class="block-title">Review Configuration</h3>
                <div class="preview-box">
                   <pre class="json-preview">{{ previewPayload }}</pre>
                </div>
             </div>
          </div>
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer">
          <template v-if="!showPreview">
             <button @click="handleClose" class="btn-cancel">Cancel</button>
             <button 
               class="btn-submit"
               @click="preparePreview"
             >
               Review Config
             </button>
          </template>
          <template v-else>
             <button @click="showPreview = false" class="btn-cancel">Back</button>
             <button 
                class="btn-submit"
                :class="{'disabled': isSubmitting}"
                :disabled="isSubmitting"
                @click="confirmSubmit"
             >
                <span v-if="isSubmitting" class="spinner"></span>
                <span v-else>Start Simulation</span>
             </button>
          </template>
      </div>
      
      <!-- Format Help Modal -->
      <transition name="dropdown-fade">
        <div v-if="showHelp" class="help-overlay" @click.stop="showHelp = false">
          <div class="help-dialog custom-scroll" @click.stop>
            <div class="help-header">
              <h4><span class="icon">💡</span> Parameter Formats</h4>
              <button class="close-help-btn" @click="showHelp = false">×</button>
            </div>
            <div class="help-content">
              <p class="help-intro">The following advanced formats are strictly supported when modifying parameters:</p>
              <ul class="help-list">
                <li>
                  <div class="hl-type">Array Parameter Initialization</div>
                  <div class="hl-desc">Assigns structural array values. Capable of enveloping sweep declarations.</div>
                  <div class="hl-code"><code>{1, 2, 3}</code></div>
                  <div class="hl-code highlight-code"><strong>Example:</strong> <code>"{1, [1,2,3], '1:2:1'}"</code> sweeps the 2nd and 3rd elements individually.</div>
                </li>
                <li>
                  <div class="hl-type">Parameter Sweep List</div>
                  <div class="hl-desc">Defines a finite set of simulation iterations for a scalar element.</div>
                  <div class="hl-code"><code>[1, 2, 3]</code></div>
                </li>
                <li>
                  <div class="hl-type">Range Iteration</div>
                  <div class="hl-desc">Sweep sequence start:stop:step.</div>
                  <div class="hl-code"><code>1:100:2</code></div>
                </li>
                <li>
                  <div class="hl-type">Linspace Generation</div>
                  <div class="hl-desc">Linear step distribution array.</div>
                  <div class="hl-code"><code>linspace:start:stop:samples</code></div>
                </li>
                <li>
                  <div class="hl-type">Random Variables</div>
                  <div class="hl-desc">Uniformly distributed random sets.</div>
                  <div class="hl-code"><code>rand:min:max:samples</code></div>
                </li>
                <li>
                  <div class="hl-type">File Import</div>
                  <div class="hl-desc">Extract array sweeps from a target csv/json file.</div>
                  <div class="hl-code"><code>file:path/to/data.csv</code></div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { taskApi } from '../../../api/task';
import { useSimulation } from '../../../composables/useSimulation';
import { $notify } from '../../../utils/notification';

const props = defineProps({
  visible: Boolean,
  modelMetadata: Object
});

const emit = defineEmits(['close', 'simulation-started']);
const router = useRouter();

const showHelp = ref(false);

// --- Composable Access ---
const { 
  loadData, 
  componentParams, 
  modifiedParams, // Computed: { compId: { param: val } }
  updateParam,
  revertParam,
  structureData 
} = useSimulation();

const isSubmitting = ref(false);
const showPreview = ref(false);
const previewPayload = ref("");

// --- Computed Helper for Params ---
const parameterList = computed(() => {
   const grouped = {};
   if (!componentParams.value) return grouped;
   
   componentParams.value.forEach(p => {
       const parts = p.name.split('.');
       const comp = parts.length > 1 ? parts[0] : 'global';
       if (!grouped[comp]) grouped[comp] = [];
       grouped[comp].push(p);
   });
   return grouped;
});

// [SYNCED] Flat Modified Params from global state
const flatModifiedParams = computed(() => {
   const list = [];
   if (!modifiedParams.value) return list;
   for (const [compId, params] of Object.entries(modifiedParams.value)) {
       for (const [key, val] of Object.entries(params)) {
           const displayKey = key === 'global' ? key : `${compId}.${key}`;
           list.push({
               compId,
               key,
               displayKey,
               value: val
           });
       }
   }
   return list;
});

// --- State: Basic Simulation ---
const simSettings = ref({
  customName: "",
  stopTime: 2000,
  stepSize: 0.1
});

// Manual Param Selection State (Fuzzy Logic)
const manualParam = ref({
  componentSearch: "",
  selectedComponent: null,
  showCompDropdown: false, 
  paramSearch: "",
  selectedParam: null,
  showParamDropdown: false,
  value: "" 
});

// Metrics JSON
const showMetricsEditor = ref(false);
const selectedMetricKeys = ref([]); // Active keys
const metricsDefinition = ref({});

const metricsJsonString = ref(JSON.stringify({
   "Startup_Inventory": { "source_column": "sds.I[1]", "method": "calculate_startup_inventory" },
   "Self_Sufficiency_Time": { "source_column": "sds.I[1]", "method": "time_of_turning_point" },
   "Doubling_Time": { "source_column": "sds.I[1]", "method": "calculate_doubling_time" }
}, null, 4));
const metricsError = ref("");


// --- Click Outside Handling ---
const compDropdownRef = ref(null);
const paramDropdownRef = ref(null);

function handleClickOutside(event) {
  if (manualParam.value.showCompDropdown && compDropdownRef.value && !compDropdownRef.value.contains(event.target)) {
    manualParam.value.showCompDropdown = false;
  }
  if (manualParam.value.showParamDropdown && paramDropdownRef.value && !paramDropdownRef.value.contains(event.target)) {
    manualParam.value.showParamDropdown = false;
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  if (router.currentRoute.value.query.projectId) {
     if (!componentParams.value || componentParams.value.length === 0) {
        await loadData(router.currentRoute.value.query.projectId);
     }
  }
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});


watch(() => props.visible, async (val) => {
   if (val) {
      if (router.currentRoute.value.query.projectId) {
        if (!componentParams.value || componentParams.value.length === 0) {
             await loadData(router.currentRoute.value.query.projectId);
        }
      }
   }
});

// --- Computed: Fuzzy Search ---

const componentsList = computed(() => Object.keys(parameterList.value || {}));

const filteredComponents = computed(() => {
   const q = manualParam.value.componentSearch.toLowerCase();
   if (!q) return componentsList.value;
   return componentsList.value.filter(c => c.toLowerCase().includes(q));
});

const filteredParameters = computed(() => {
   const comp = manualParam.value.selectedComponent;
   if (!comp) return [];
   const params = parameterList.value[comp] || [];
   const q = manualParam.value.paramSearch.toLowerCase();
   if (!q) return params;
   return params.filter(p => p.name.toLowerCase().includes(q));
});


// --- Methods: Basic Config ---

function handleClose() {
  emit('close');
}

// Manual Params Methods
function selectManualComponent(comp) {
  manualParam.value.selectedComponent = comp;
  manualParam.value.componentSearch = comp;
  manualParam.value.showCompDropdown = false;
  manualParam.value.paramSearch = "";
  manualParam.value.selectedParam = null;
}

function selectManualParam(param) {
  manualParam.value.selectedParam = param.name;
  manualParam.value.paramSearch = param.name;
  manualParam.value.value = param.value;
  manualParam.value.showParamDropdown = false;
}

async function applyManualParam() {
  if (!manualParam.value.selectedComponent || !manualParam.value.selectedParam) return;
  
  const compId = manualParam.value.selectedComponent;
  let paramName = manualParam.value.selectedParam;
  
  if (paramName.startsWith(compId + '.')) {
      paramName = paramName.slice(compId.length + 1);
  }
  
  try {
      parseUserInputValue(manualParam.value.value);
  } catch (err) {
      alert("Validation Error: " + err.message);
      return;
  }
  
  await updateParam(compId, paramName, manualParam.value.value);
}

async function updateExistingParam(compId, key, val) {
    try {
        parseUserInputValue(val);
    } catch (err) {
        alert("Validation Error: " + err.message);
        // Force reactivity to reset the DOM element visual to the state value since 
        // the $event string is not saved, by triggering a dummy ref update.
        modifiedParams.value = { ...modifiedParams.value }; 
        return;
    }
    await updateParam(compId, key, val);
}

async function revertExistingParam(compId, key) {
    await revertParam(compId, key);
}


// Metrics

// Metrics Logic
const availableMetricKeys = computed(() => Object.keys(metricsDefinition.value || {}));

watch(metricsJsonString, (val) => {
   try {
      const parsed = JSON.parse(val);
      metricsDefinition.value = parsed;
      metricsError.value = "";
      selectedMetricKeys.value = Object.keys(parsed); // Default select all
   } catch (e) {
      metricsError.value = e.message;
   }
}, { immediate: true });



// --- Submission Logic ---

async function preparePreview() {
   if (showMetricsEditor.value && metricsError.value) {
      alert("Please fix JSON errors in Metrics Definition.");
      return;
   }
   
   try {
       const payload = generatePayload();
       previewPayload.value = JSON.stringify(payload, null, 2);
       showPreview.value = true;
   } catch (e) {
       console.error("Preview gen error", e);
       alert("Failed to generate preview: " + e.message);
   }
}

async function confirmSubmit() {
   isSubmitting.value = true;
   
   try {
      const payload = JSON.parse(previewPayload.value); // Use what is reviewed
      
      const taskObj = await taskApi.createTask(payload);
      
      $notify({ title: 'SUCCESS', message: 'Task submitted. Redirecting to monitor...', type: 'success' });
      
      emit('simulation-started', taskObj);
      
      // Delay interaction
      setTimeout(() => {
        handleClose(); // Close only when ready to leave
        router.push({ 
            name: 'monitor',
            query: { 
            projectId: router.currentRoute.value.query.projectId,
            taskId: taskObj.id 
            } 
        });
      }, 1000);
      
   } catch (e) {
      console.error("Submission error", e);
      alert("Failed to submit task: " + (e.response?.data?.detail || e.message));
      isSubmitting.value = false; // Only reset on error
   } 
}

function parseUserInputValue(str) {
    if (typeof str !== 'string') return str;
    const s = str.trim();
    if (!s) return "";
    
    if (s.startsWith('{') && s.endsWith('}')) return s;
    if (s.startsWith('[') && s.endsWith(']')) {
        try { return JSON.parse(s); } catch (e) { throw new Error(`Invalid JSON array format: ${s}`); }
    }
    const prefixes = ['linspace:', 'log:', 'rand:', 'file:'];
    if (prefixes.some(p => s.toLowerCase().startsWith(p))) return s;
    if (/^-?[0-9.]+:-?[0-9.]+:-?[0-9.]+$/.test(s)) return s;
    
    if (s.includes(',')) {
        throw new Error(`Invalid format "${s}". Please use brackets [1, 2, 3] for lists or {1, 2, 3} for array expansions.`);
    }
    
    if (!isNaN(Number(s))) return Number(s);
    
    return s;
}

function generatePayload() {
    // 1. Convert Manual Params to Dict from SYNCED state
    const simParams = {};
    if (modifiedParams.value) {
        for (const [compId, params] of Object.entries(modifiedParams.value)) {
            for (const [key, val] of Object.entries(params)) {
               // Construct display Key for payload
               // If compId is 'global', key is key.
               // Else compId.key
               const displayKey = compId === 'global' ? key : `${compId}.${key}`;
               simParams[displayKey] = parseUserInputValue(val);
            }
        }
    }

    // 2. Metrics (Filtered)
    const metrics = {};
    selectedMetricKeys.value.forEach(k => {
        if (metricsDefinition.value[k]) {
            metrics[k] = metricsDefinition.value[k];
        }
    });

    // 3. Base Payload (Updated Variable Filter)
    let defaultFilter = "time";
    if (structureData.value && structureData.value.components) {
        structureData.value.components.forEach(c => {
            if (c.id) defaultFilter += `|${c.id}.I[1]`;
        });
    }

    const payload = {
       type: "BASIC",
       name: simSettings.value.customName || `example_model.Cycle_Run_${new Date().toISOString().slice(11,19)}`,
       project_id: router.currentRoute.value.query.projectId,
       config_json: {
           paths: { package_path: props.modelMetadata.packagePath || props.modelMetadata.modelName || null }, 
           simulation: {
               model_name: props.modelMetadata.modelName || "example_model.Cycle",
               stop_time: simSettings.value.stopTime,
               step_size: simSettings.value.stepSize,
               variableFilter: defaultFilter 
           }, 
           simulation_parameters: simParams, 
           metrics_definition: metrics
       }
    };
    
    return payload;
}
</script>

<style scoped>
/* Reuse Scoped Styles - Modified for Full Screen and Centering */
:root {
  --primary: #00d2ff;
  --secondary: #888;
  --bg-dark: #05070a;
  --bg-panel: #161b22;
  --border: #30363d;
  --text: #c9d1d9;
}

.modal-overlay {
  position: fixed; top: 0; left: 0;right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  z-index: 9999 !important; /* Force top z-index */
  display: flex; align-items: center; justify-content: center;
}

.modal-card {
  width: 700px; height: 85vh; /* Centered card style */
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 12px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.8);
  display: flex; flex-direction: column;
  overflow: hidden;
  color: #c9d1d9;
  font-family: 'Inter', sans-serif;
}

/* Header */
.modal-header {
  padding: 15px 25px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  display: flex; justify-content: space-between; align-items: center;
}
.title-gradient {
  margin: 0; font-size: 18px; font-weight: 700;
  background: linear-gradient(90deg, #00d2ff, #007bff);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.subtitle { margin: 0; font-size: 12px; color: #8b949e; }
.close-btn { background: none; border: none; color: #8b949e; cursor: pointer; }
.close-btn:hover { color: #fff; }

/* Body Area */
.modal-body { flex: 1; display: flex; overflow: hidden; padding: 20px; }
.panel-center { width: 100%; display: flex; flex-direction: column; overflow-y: auto; }
.panel-center::-webkit-scrollbar { width: 6px; }
.panel-center::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

/* Config Blocks */
.config-block {
  background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 15px; margin-bottom: 20px;
}
.block-title {
  font-size: 11px; font-weight: 700; color: #8b949e; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.5px;
}
.count-badge {
    background: #00d2ff; color: #000; padding: 2px 6px; border-radius: 8px; font-size: 9px;
}

.input-label { display: block; color: #8b949e; font-size: 11px; font-weight: 600; margin-bottom: 5px; }
.mini-label { display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }

.input-styled, .input-mini, .input-micro, .textarea-code {
  width: 100%; box-sizing: border-box;
  background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
  border-radius: 4px; padding: 8px; font-size: 12px;
  outline: none; transition: border 0.2s;
}
.input-styled:focus, .input-mini:focus { border-color: #00d2ff; }
.input-mini { padding: 6px; font-size: 11px; background: #080a0e; }
.input-micro { padding: 2px 4px; font-size: 11px; text-align: right; width: 60px; height: 20px; }
.textarea-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #05070a; }
.readonly { cursor: not-allowed; opacity: 0.7; color: #666; }

/* Grid Layouts */
.grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-end-gap { display: flex; align-items: flex-end; gap: 8px; }
.flex-center-gap { display: flex; align-items: center; gap: 8px; }

/* Buttons & Icons */
.btn-mini-action {
  background: #1f6feb; color: white; border: none; padding: 4px 10px; border-radius: 3px; font-size: 11px; cursor: pointer; height: 28px;
}
.btn-mini-action:hover { background: #388bfd; }

.btn-micro-del { background: none; border: none; color: #484f58; cursor: pointer; padding: 2px; }
.btn-micro-del:hover { color: #f85149; }

.link-btn { background: none; border: none; color: #00d2ff; font-size: 11px; cursor: pointer; text-decoration: underline; }

.icon { width: 24px; height: 24px; }
.icon-xs { width: 14px; height: 14px; }

/* Manual Param Box */
.add-param-box { background: rgba(0,0,0,0.2); border: 1px solid #30363d; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
.box-label { font-size: 11px; font-weight: 600; color: #00d2ff; margin-bottom: 8px; }
.rel-container { position: relative; margin-bottom: 8px; }
.dropdown-list {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 20;
  background: #161b22; border: 1px solid #30363d; max-height: 150px; overflow-y: auto;
  border-radius: 4px; box-shadow: 0 10px 20px rgba(0,0,0,0.5);
}
.dropdown-item { padding: 6px 10px; font-size: 11px; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid #21262d; }
.dropdown-item:hover { background: #1f6feb; color: white; }
.val-preview { color: #8b949e; font-style: italic; }

.param-list { max-height: 200px; overflow-y: auto; padding-right: 5px; }
.param-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #0d1117; border: 1px solid #30363d; padding: 6px; border-radius: 4px; margin-bottom: 5px;
}
.param-key { font-family: monospace; font-size: 11px; color: #00d2ff; }
.truncate-box { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 60%; }
.empty-state { text-align: center; color: #484f58; font-size: 11px; padding: 10px; border: 1px dashed #30363d; border-radius: 4px; }

/* Footer */
.modal-footer {
  padding: 15px 25px;
  background: #161b22;
  border-top: 1px solid #30363d;
  display: flex; justify-content: flex-end; gap: 10px;
}
.btn-cancel {
  background: none; border: 1px solid transparent; color: #8b949e;
  padding: 8px 16px; border-radius: 4px; font-size: 13px; cursor: pointer;
}
.btn-cancel:hover { color: white; }
.btn-submit {
  background: linear-gradient(135deg, #1f6feb, #00d2ff);
  border: none; color: white;
  padding: 8px 24px; border-radius: 4px; font-size: 13px; font-weight: 600;
  cursor: pointer; box-shadow: 0 4px 10px rgba(0, 210, 255, 0.2);
  display: flex; align-items: center; justify-content: center;
}
.btn-submit:hover { filter: brightness(1.1); }
.btn-submit.disabled { opacity: 0.7; cursor: wait; }

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Globals Helpers */
.mb-4 { margin-bottom: 16px; }

/* Metrics List Styles */
.metrics-list { max-height: 200px; overflow-y: auto; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 5px; }
.metric-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #21262d; }
.metric-item:last-child { border-bottom: none; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #c9d1d9; font-size: 11px; }
.metric-key { font-family: monospace; color: #00d2ff; }
.mini-tag { font-size: 9px; background: #21262d; padding: 2px 6px; border-radius: 4px; color: #8b949e; }



.preview-box {
  background: #05070a;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 10px;
  max-height: 400px;
  overflow: auto;
}
.json-preview {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #c9d1d9;
  white-space: pre-wrap;
}
.full-height { height: 100%; display: flex; flex-direction: column; }
.full-height .preview-box { flex: 1; }

.help-btn { background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); color: #00d2ff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; cursor: pointer; flex-shrink: 0; transition: all 0.2s; padding: 0;}
.help-btn:hover { background: rgba(0, 210, 255, 0.3); color: #fff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.5); }

/* Format Help Modal Styles */
.help-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 15, 20, 0.85); backdrop-filter: blur(5px); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box; }
.help-dialog { background: #1a1f28; border: 1px solid #00d2ff; border-radius: 10px; width: 100%; max-width: 400px; max-height: 100%; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); display: flex; flex-direction: column; margin: auto; }
.help-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid rgba(0, 210, 255, 0.2); background: rgba(0, 210, 255, 0.05); }
.help-header h4 { margin: 0; color: #00d2ff; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.close-help-btn { background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s; }
.close-help-btn:hover { color: #ff5252; }
.help-content { padding: 15px; }
.help-intro { font-size: 11px; color: #aaa; margin: 0 0 15px 0; line-height: 1.4; text-align: left;}
.help-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; text-align: left;}
.help-list li { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px; }
.hl-type { font-size: 12px; font-weight: bold; color: #00d2ff; margin-bottom: 4px; }
.hl-desc { font-size: 11px; color: #888; margin-bottom: 8px; }
.hl-code { font-size: 11px; font-family: "Consolas", monospace; background: rgba(0, 0, 0, 0.4); padding: 6px 8px; border-radius: 4px; border: 1px solid #333; color: #eee; }
.hl-code code { color: #ffca28; font-weight: bold; }
.hl-code.highlight-code { margin-top: 6px; border-left: 3px solid #ffca28; background: rgba(255, 202, 40, 0.05); color: #ccc; }

.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-10px); }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: all 0.2s ease; }

</style>

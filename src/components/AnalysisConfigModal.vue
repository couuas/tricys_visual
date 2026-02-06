<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-card">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
           <button v-if="currentStep === 2" @click="currentStep = 1" class="back-btn">
             <span class="arrow">←</span> Back
           </button>
           <div>
             <h2 class="title-gradient">
               Analysis Configuration
             </h2>
             <p class="subtitle">
               {{ currentStep === 1 ? 'Select Analysis Method' : (currentStep === 2 ? 'Configure Parameters' : 'Review Configuration') }}
             </p>
           </div>
        </div>
        <button @click="handleClose" class="close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Main Content Area -->
      <div class="modal-body">
          
          <!-- Step 1: Template Selection -->
          <div v-if="currentStep === 1" class="step-container">
             <div class="template-grid">
                <div 
                  v-for="tpl in templateOptions" 
                  :key="tpl.id" 
                  class="template-card"
                  @click="selectTemplate(tpl.id)"
                >
                   <div class="card-icon">{{ tpl.icon }}</div>
                   <div class="card-content">
                      <h4 class="card-title">{{ tpl.name }}</h4>
                      <p class="card-desc">{{ tpl.desc }}</p>
                   </div>
                   <div class="card-arrow">→</div>
                </div>
             </div>
          </div>

          <!-- Step 2: Configuration Form -->
          <div v-else-if="currentStep === 2" class="panel-full step-container fade-in">
             <!-- Dynamic Form based on Template -->
             <div class="config-block space-y-5">
                
                <!-- Job Name -->
                <div>
                   <label class="mini-label">Analysis Job Name</label>
                   <input v-model="analysisConfig.name" type="text" class="input-styled" placeholder="e.g. Width_Sensitivity_Run1" />
                </div>
                <!-- Simulation Settings -->
                <div class="grid-2col">
                   <div>
                       <label class="mini-label">Stop Time</label>
                       <input v-model.number="analysisConfig.stop_time" type="number" step="100" min="1" class="input-styled" />
                   </div>
                   <div>
                       <label class="mini-label">Step Size</label>
                       <input v-model.number="analysisConfig.step_size" type="number" step="0.1" min="0.001" class="input-styled" />
                   </div>
                </div>

                <!-- Independent Variable Selection -->
                <div class="space-y-3">
                   <div class="flex-between flex-end">
                      <label class="mini-label">
                         {{ selectedTemplate === 'bisection' ? 'Parameter to Optimize' : 'Independent Variables' }}
                      </label>
                      <button 
                        v-if="['multi_param', 'sobol', 'latin'].includes(selectedTemplate)" 
                        @click="showVarSelector = !showVarSelector"
                        class="link-btn"
                      >
                         + Add Variable
                      </button>
                   </div>
                   
                   <!-- Variable Selector -->
                   <div v-if="showVarSelector || analysisConfig.independent_variables.length === 0" class="add-var-box">
                       <!-- Component Select -->
                       <div class="rel-container" ref="compDropdownRef">
                          <input 
                            v-model="analysisParam.componentSearch" 
                            @focus="analysisParam.showCompDropdown = true"
                            placeholder="Search component..." 
                            class="input-mini-dark"
                          />
                          <div v-if="analysisParam.showCompDropdown && filteredAnalysisComponents.length > 0" class="dropdown-list">
                             <div  v-for="comp in filteredAnalysisComponents" :key="comp" @click="selectAnalysisComponent(comp)" class="dropdown-item">
                               {{ comp }}
                             </div>
                          </div>
                       </div>
                       <!-- Param Select -->
                       <div class="rel-container" v-if="analysisParam.selectedComponent" ref="paramDropdownRef">
                          <input 
                            v-model="analysisParam.paramSearch" 
                            @focus="analysisParam.showParamDropdown = true"
                            placeholder="Select parameter..." 
                            class="input-mini-dark"
                          />
                          <div v-if="analysisParam.showParamDropdown && filteredAnalysisParams.length > 0" class="dropdown-list">
                             <div v-for="param in filteredAnalysisParams" :key="param.name" @click="addAnalysisVariable(param)" class="dropdown-item flex-between">
                               <span>{{ param.name }}</span>
                             </div>
                          </div>
                       </div>
                   </div>

                   <!-- Selected Variables List -->
                   <div class="var-list">
                       <div v-for="(variable, idx) in analysisConfig.independent_variables" :key="idx" class="var-item">
                          <div class="flex-between mb-2">
                             <span class="var-name">{{ variable.name }}</span>
                             <button @click="removeAnalysisVariable(idx)" class="btn-micro-del">
                               <svg xmlns="http://www.w3.org/2000/svg" class="icon-xs" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                             </button>
                          </div>
                          
                          <!-- Dynamic Inputs based on Template -->
                          <div v-if="['single_param', 'multi_param'].includes(selectedTemplate)">
                             <label class="mini-label">Sampling Values (Comma Separated)</label>
                             <input v-model="variable.sampling" placeholder="e.g. 0.1, 0.2, 0.3" class="input-mini-dark" />
                          </div>
                          
                          <div v-if="['sobol', 'latin'].includes(selectedTemplate)" class="grid-2col-tight">
                             <div>
                                <label class="mini-label">Min / Lower</label>
                                <input v-model.number="variable.bounds[0]" type="number" class="input-mini-dark" />
                             </div>
                             <div>
                                <label class="mini-label">Max / Upper</label>
                                <input v-model.number="variable.bounds[1]" type="number" class="input-mini-dark" />
                             </div>
                          </div>
                       </div>
                   </div>
                </div>

                <!-- Analyzer Settings -->
                <div v-if="['sobol', 'latin'].includes(selectedTemplate)">
                   <label class="mini-label">Sample Size (N)</label>
                   <input v-model.number="analysisConfig.analyzer.sample_N" type="number" class="input-styled" />
                   <p class="micro-text">Total runs = {{ analysisConfig.analyzer.sample_N * (analysisConfig.independent_variables.length + 2) }} (approx)</p>
                </div>

                <!-- Bisection Settings -->
                <div v-if="selectedTemplate === 'bisection'" class="grid-2col-tight">
                   <div>
                      <label class="mini-label">Search Min</label>
                      <input v-model.number="analysisConfig.bisection[0]" type="number" class="input-styled" />
                   </div>
                   <div>
                      <label class="mini-label">Search Max</label>
                      <input v-model.number="analysisConfig.bisection[1]" type="number" class="input-styled" />
                   </div>
                   <div>
                      <label class="mini-label">Tolerance</label>
                      <input v-model.number="analysisConfig.bisection_tol" type="number" step="0.001" class="input-styled" />
                   </div>
                    <div>
                      <label class="mini-label">Max Iterations</label>
                      <input v-model.number="analysisConfig.bisection_iter" type="number" class="input-styled" />
                   </div>
                </div>
                </div>

                <!-- Metrics Definition -->
                <div class="config-block">
                   <div class="flex-between mb-2">
                     <label class="input-label">
                        Metrics Definition 
                        <span class="count-badge" v-if="!showMetricsEditor">{{ selectedMetricKeys.length }} active</span>
                     </label>
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
                        <span class="mini-tag">{{ analysisConfig.metrics_definition[key].method }}</span>
                     </div>
                   </div>
                </div>

             </div>
          <div v-else-if="currentStep === 3" class="panel-full step-container fade-in">
             <div class="config-block full-height">
                <h3 class="block-title">Review JSON Payload</h3>
                <div class="preview-box">
                   <pre class="json-preview">{{ previewPayload }}</pre>
                </div>
             </div>
          </div>
      </div>

      <!-- Footer Buttons -->
      <div class="modal-footer" v-if="currentStep >= 2">
         <button @click="currentStep === 2 ? currentStep = 1 : currentStep = 2" class="btn-cancel">Back</button>
         
         <button 
           v-if="currentStep === 2"
           class="btn-submit"
           @click="preparePreview"
         >
           Review Config
         </button>

         <button 
           v-if="currentStep === 3"
           class="btn-submit"
           :class="{'disabled': isSubmitting}"
           :disabled="isSubmitting"
           @click="confirmSubmit"
         >
           <span v-if="isSubmitting" class="spinner"></span>
           <span v-else>Submit Task</span>
         </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { taskApi } from '../api/task';
import { useSimulation } from '../composables/useSimulation';
import { useAuth } from '../composables/useAuth'; // Import useAuth
import { $notify } from '../utils/notification';

const props = defineProps({
  visible: Boolean,
  modelMetadata: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['close', 'analysis-started']);
const router = useRouter();
const { isAuthenticated } = useAuth(); // Destructure isAuthenticated

const { 
  loadData, 
  componentParams,
  structureData 
} = useSimulation();

const isSubmitting = ref(false);
const previewPayload = ref("");

function preparePreview() {
  const payload = generatePayload();
  previewPayload.value = JSON.stringify(payload, null, 4);
  currentStep.value = 3;
}

async function confirmSubmit() {
   if (!isAuthenticated.value) {
       $notify("Authentication Required", "Please log in to submit tasks.", "error");
       // Optional: router.push({ name: 'user' });
       return;
   }

   isSubmitting.value = true;
   try {
      // Re-generate to be safe, or use stored payload
      const payload = JSON.parse(previewPayload.value); 
      const response = await taskApi.createTask(payload);
      emit('analysis-started', response);
      $notify("Analysis Task Submitted!", "success");
      
      // Keep isSubmitting = true to show spinner/disabled state during delay
      
      setTimeout(() => {
          handleClose();
          router.push({ 
            name: 'monitor', 
            query: { 
               projectId: router.currentRoute.value.query.projectId,
               taskId: response.id 
            } 
          });
          // isSubmitting.value = false; // Not needed as we redirect
      }, 1000);
   } catch (e) {
      console.error("Submission error", e);
      let msg = e.response?.data?.detail || e.message;
      if (e.response?.status === 401 || e.response?.status === 403) {
           msg = "Session expired or invalid. Please log in again.";
      }
      alert("Failed to submit task: " + msg);
      isSubmitting.value = false; // Only reset on error
   } 
}

// Deprecated direct submit
function submitTask() { console.warn("Use confirmSubmit logic"); }


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

// --- State: Analysis ---
const currentStep = ref(1);
const selectedTemplate = ref("single_param");

const templateOptions = [
  { id: 'single_param', name: 'Parameter Sweep', desc: 'Scan one parameter across a range.', icon: '📈' },
  { id: 'multi_param', name: 'Multi-Param Sweep', desc: 'Scan combinations of variables.', icon: '📊' },
  { id: 'sobol', name: 'Sensitivity (Sobol)', desc: 'Global sensitivity analysis with indices.', icon: '🎯' },
  { id: 'latin', name: 'Uncertainty (LHS)', desc: 'Latin Hypercube Sampling for UQ.', icon: '🎲' },
  { id: 'bisection', name: 'Optimization', desc: 'Bisection search for target value.', icon: '🔍' }
];

function selectTemplate(id) {
  selectedTemplate.value = id;
  currentStep.value = 2;
}
const showVarSelector = ref(false);

const analysisParam = ref({
  componentSearch: "",
  selectedComponent: null,
  showCompDropdown: false,
  paramSearch: "",
  selectedParam: null, 
  showParamDropdown: false
});

const analysisConfig = ref({
  name: "Analysis_Run",
  independent_variables: [], 
  dependent_variables: ["Startup_Inventory", "Doubling_Time"], 
  analyzer: {
     method: "sobol",
     sample_N: 128
  },
  bisection: [1.0, 1.5], 
  bisection_tol: 0.005,
  bisection_iter: 10,
  stop_time: 12000.0, // [NEW] Default
  step_size: 0.5,     // [NEW] Default
  metrics_definition: {} // [NEW]
});

// Metrics State
const showMetricsEditor = ref(false);
const selectedMetricKeys = ref([]); // Keys of active metrics
const metricsJsonString = ref(JSON.stringify({
   "Startup_Inventory": { "source_column": "sds.I[1]", "method": "calculate_startup_inventory" },
   "Self_Sufficiency_Time": { "source_column": "sds.I[1]", "method": "time_of_turning_point" },
   "Doubling_Time": { "source_column": "sds.I[1]", "method": "calculate_doubling_time" },
   "Required_TBR": {
        "source_column": "sds.I[1]",
        "method": "bisection_search",
        "parameter_to_optimize": "blanket.TBR",
        "search_range": [1, 1.5],
        "tolerance": 0.005,
        "max_iterations": 10
    }
}, null, 4));
const metricsError = ref("");
const availableMetricKeys = computed(() => Object.keys(analysisConfig.value.metrics_definition || {}));

watch(metricsJsonString, (val) => {
   try {
      const parsed = JSON.parse(val);
      analysisConfig.value.metrics_definition = parsed;
      metricsError.value = "";
      // Default: select all new keys
      selectedMetricKeys.value = Object.keys(parsed);
   } catch (e) {
      metricsError.value = e.message;
   }
}, { immediate: true });

const compDropdownRef = ref(null);
const paramDropdownRef = ref(null);

function handleClickOutside(event) {
  if (analysisParam.value.showCompDropdown && compDropdownRef.value && !compDropdownRef.value.contains(event.target)) {
    analysisParam.value.showCompDropdown = false;
  }
  if (analysisParam.value.showParamDropdown && paramDropdownRef.value && !paramDropdownRef.value.contains(event.target)) {
    analysisParam.value.showParamDropdown = false;
  }
}

// --- Initialization ---
watch(() => props.visible, async (val) => {
   if (val) {
      if (router.currentRoute.value.query.projectId) {
        if (!componentParams.value || componentParams.value.length === 0) {
             await loadData(router.currentRoute.value.query.projectId);
        }
      }
      // Set Default Name
      analysisConfig.value.name = selectedTemplate.value.toUpperCase() + "_Analysis";
      // Reset Step
      currentStep.value = 1;
      previewPayload.value = "";
      // Add Listener
      setTimeout(() => document.addEventListener('click', handleClickOutside), 100);
   } else {
      document.removeEventListener('click', handleClickOutside);
   }
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(selectedTemplate, (newVal) => {
   analysisConfig.value.name = newVal.toUpperCase() + "_Analysis";
});


// --- Computed: Fuzzy Search ---
const componentsList = computed(() => Object.keys(parameterList.value || {}));

const filteredAnalysisComponents = computed(() => {
   const q = analysisParam.value.componentSearch.toLowerCase();
   if (!q) return componentsList.value;
   return componentsList.value.filter(c => c.toLowerCase().includes(q));
});

const filteredAnalysisParams = computed(() => {
   const comp = analysisParam.value.selectedComponent;
   if (!comp) return [];
   const params = parameterList.value[comp] || [];
   const q = analysisParam.value.paramSearch.toLowerCase();
   if (!q) return params;
   return params.filter(p => p.name.toLowerCase().includes(q));
});

// --- Methods ---

function handleClose() {
  emit('close');
}

function selectAnalysisComponent(comp) {
  analysisParam.value.selectedComponent = comp;
  analysisParam.value.componentSearch = comp;
  analysisParam.value.showCompDropdown = false;
  analysisParam.value.paramSearch = "";
}

function addAnalysisVariable(param) {
  if (!analysisParam.value.selectedComponent) return;
  
  const fullName = `${analysisParam.value.selectedComponent}.${param.name}`;
  
  if (analysisConfig.value.independent_variables.find(v => v.name === fullName)) return;
  
  if (selectedTemplate.value === 'single_param' || selectedTemplate.value === 'bisection') {
     analysisConfig.value.independent_variables = [{
        name: fullName,
        sampling: "", 
        bounds: [0, 1],
        distribution: "unif"
     }];
  } else {
     analysisConfig.value.independent_variables.push({
        name: fullName,
        sampling: "",
        bounds: [0, 1],
        distribution: "unif" 
     });
  }
  
  analysisParam.value.showParamDropdown = false;
  analysisParam.value.paramSearch = "";
  showVarSelector.value = false;
}

function removeAnalysisVariable(idx) {
  analysisConfig.value.independent_variables.splice(idx, 1);
}



function generatePayload() {
     const payload = {
        type: "ANALYSIS",
        name: analysisConfig.value.name,
        project_id: router.currentRoute.value.query.projectId,
        config_json: {
            paths: { package_path: props.modelMetadata.packagePath || props.modelMetadata.modelName || null },
            simulation: { 
                model_name: props.modelMetadata.modelName || "example_model.Cycle",
                stop_time: analysisConfig.value.stop_time, // [NEW]
                step_size: analysisConfig.value.step_size, // [NEW]
                variableFilter: "time|sds.I[1]" // [FIX 1] Hardcoded strict default
            }
            // [FIX 2] Removed top-level metrics_definition
        }
     };
    
    const template = selectedTemplate.value;
    
    // Filter Metrics
    const activeMetrics = {};
    selectedMetricKeys.value.forEach(k => {
        if (analysisConfig.value.metrics_definition[k]) {
            activeMetrics[k] = analysisConfig.value.metrics_definition[k];
        }
    });

    const analysisSpec = {
        enabled: true,
        analysis_cases: [],
        metrics_definition: activeMetrics // [FIX 3] Metrics inside analysis block
    };
    
    const dependentVars = Object.keys(activeMetrics); // [FIX 4] Dependent vars are just keys

    const caseDef = {
        name: analysisConfig.value.name,
        plot_type: "line",
        dependent_variables: dependentVars,
        sweep_time: ["sds.I[1]"],
        combine_plots: true
    };
    
    // Helper to fix double component naming (blanket.blanket.I -> blanket.I)
    const fixParamName = (name) => {
        const parts = name.split('.');
        if (parts.length >= 2 && parts[0] === parts[1]) {
             return parts.slice(1).join('.');
        }
        return name;
    }

    if (template === 'single_param') {
        const indep = analysisConfig.value.independent_variables[0];
        if (indep) {
            caseDef.independent_variable = fixParamName(indep.name); // [FIX 5]
            caseDef.independent_variable_sampling = safeParseList(indep.sampling);
        }
    } else if (template === 'multi_param') {
         const indep = analysisConfig.value.independent_variables[0];
         if (indep) {
              caseDef.independent_variable = fixParamName(indep.name);
              caseDef.independent_variable_sampling = safeParseList(indep.sampling);
         }
         const multiParams = {};
         analysisConfig.value.independent_variables.slice(1).forEach(v => {
              multiParams[v.name] = safeParseList(v.sampling);
         });
         caseDef.simulation_parameters = multiParams;
    } else if (['sobol', 'latin'].includes(template)) {
        // ... handled below
    } 
    
    // [FIX 3] Use sensitivity_analysis key for everything as per requirement
    // Logic: The user wants "sensitivity_analysis" key even for parameter sweeps based on the file provided
    
    if (['single_param', 'multi_param'].includes(template)) {
         analysisSpec.analysis_cases.push(caseDef);
         payload.config_json.sensitivity_analysis = analysisSpec;
    } else if (['sobol', 'latin'].includes(template)) {
         payload.config_json.sensitivity_analysis = {
             method: template,
             parameters: analysisConfig.value.independent_variables.map(v => ({
                 name: fixParamName(v.name),
                 bounds: v.bounds,
                 distribution: v.distribution || "uniform"
             })),
             N: analysisConfig.value.analyzer.sample_N,
             conf_level: 0.95,
             metrics_definition: activeMetrics 
         };
    } else if (template === 'bisection') {
         payload.config_json.optimization = {
             method: "bisection",
             target_variable: dependentVars[0] || "",
             target_value: 1000,
             parameter: fixParamName(analysisConfig.value.independent_variables[0]?.name),
             bounds: analysisConfig.value.bisection,
             tol: analysisConfig.value.bisection_tol,
             max_iter: analysisConfig.value.bisection_iter
         };
    }
    
    return payload;
}

function safeParseList(str) {
    if (!str) return [];
    return str.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
}
</script>

<style scoped>
/* Reuse the scoped CSS from SimulationConfigModal but adapted for single panel */
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
  z-index: 9999 !important;
  display: flex; align-items: center; justify-content: center;
}

.modal-card {
  width: 700px; height: 85vh; /* Centered card style same as SimulationConfigModal */
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 12px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.8);
  display: flex; flex-direction: column;
  overflow: hidden;
  color: #c9d1d9;
  font-family: 'Inter', sans-serif;
}

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

.modal-body { flex: 1; display: flex; overflow: hidden; padding: 20px; }

.panel-full { width: 100%; display: flex; flex-direction: column; overflow-y: auto; }
.panel-full::-webkit-scrollbar { width: 6px; }
.panel-full::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

.config-block {
  background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 15px; margin-bottom: 20px;
}
.input-label { display: block; color: #8b949e; font-size: 11px; font-weight: 600; margin-bottom: 5px; }
.mini-label { display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
.micro-text { font-size: 10px; color: #666; margin-top: 4px; }

.input-styled, .input-mini-dark {
  width: 100%; box-sizing: border-box;
  background: #0d1117; border: 1px solid #30363d; color: #c9d1d9;
  border-radius: 4px; padding: 8px; font-size: 12px;
  outline: none; transition: border 0.2s;
}
.input-styled:focus, .input-mini-dark:focus { border-color: #00d2ff; }
.input-mini-dark { padding: 6px; font-size: 11px; background: #05070a; }

.textarea-code {
  width: 100%; box-sizing: border-box;
  background: #05070a; border: 1px solid #30363d; color: #c9d1d9;
  border-radius: 4px; padding: 8px; font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  outline: none; transition: border 0.2s;
}
.textarea-code:focus { border-color: #00d2ff; }
.error-text { color: #f85149; font-size: 11px; margin-top: 5px; }
.info-text { font-size: 11px; color: #8b949e; font-style: italic; }


.grid-2col-tight { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-end { align-items: flex-end; }

.btn-micro-del { background: none; border: none; color: #484f58; cursor: pointer; padding: 2px; }
.btn-micro-del:hover { color: #f85149; }
.link-btn { background: none; border: none; color: #00d2ff; font-size: 11px; cursor: pointer; text-decoration: underline; }

.icon { width: 24px; height: 24px; }
.icon-xs { width: 14px; height: 14px; }

.add-var-box { background: #0d1117; padding: 10px; border: 1px solid #30363d; border-radius: 4px; margin-bottom: 10px; }
.rel-container { position: relative; margin-bottom: 8px; }
.dropdown-list {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 20;
  background: #161b22; border: 1px solid #30363d; max-height: 150px; overflow-y: auto;
  border-radius: 4px; box-shadow: 0 10px 20px rgba(0,0,0,0.5);
}
.dropdown-item { padding: 6px 10px; font-size: 11px; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid #21262d; }
.dropdown-item:hover { background: #1f6feb; color: white; }

.var-list { margin-top: 10px; }
.var-item { background: #21262d; border: 1px solid #30363d; padding: 8px; border-radius: 4px; margin-bottom: 8px; }
.var-name { font-family: monospace; font-size: 11px; color: #00d2ff; word-break: break-all; }

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

.mb-4 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 8px; }

/* Metrics List Styles */
.metrics-list { max-height: 200px; overflow-y: auto; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 5px; }
.metric-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #21262d; }
.metric-item:last-child { border-bottom: none; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #c9d1d9; font-size: 11px; }
.metric-key { font-family: monospace; color: #00d2ff; }
.mini-tag { font-size: 9px; background: #21262d; padding: 2px 6px; border-radius: 4px; color: #8b949e; }
.count-badge { background: #00d2ff; color: #000; padding: 2px 6px; border-radius: 8px; font-size: 9px; margin-left: 8px; }

/* Preview Styles */
.full-height { height: 100%; display: flex; flex-direction: column; }
.preview-box { flex: 1; overflow: hidden; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 10px; }
.json-preview { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #c9d1d9; margin: 0; white-space: pre-wrap; overflow-y: auto; height: 100%; }

/* Wizard Styles */
.header-left { display: flex; align-items: center; gap: 15px; }
.back-btn { background: none; border: 1px solid #30363d; color: #ccc; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 5px; }
.back-btn:hover { border-color: #00d2ff; color: #00d2ff; }

.template-grid { 
   display: flex; flex-wrap: wrap; justify-content: center;
   gap: 20px; padding: 20px 40px; 
   max-width: 800px; margin: 0 auto;
}

.template-card {
   flex: 0 0 180px; /* Fixed width for consistent sizing */
   height: 140px;
   background: #161b22; border: 1px solid #30363d; border-radius: 8px;
   padding: 15px; cursor: pointer; transition: all 0.2s;
   display: flex; flex-direction: column; align-items: center; justify-content: center; /* Center content vertically */
   text-align: center;
   position: relative; overflow: hidden;
}
.template-card:hover { 
   border-color: #00d2ff;
   transform: translateY(-5px); 
   box-shadow: 0 10px 25px rgba(0, 210, 255, 0.15);
   background: linear-gradient(145deg, #1f242e, #161b22);
}
.card-icon { font-size: 28px; margin-bottom: 10px; }
.card-title { margin: 0 0 5px 0; color: #fff; font-size: 13px; font-weight: 600; }
.card-desc { font-size: 11px; color: #8b949e; line-height: 1.4; }
.card-arrow { 
   position: absolute; bottom: 10px; right: 10px; opacity: 0; 
   transform: translateX(-10px); transition: all 0.3s; color: #00d2ff;
}
.template-card:hover .card-arrow { opacity: 1; transform: translateX(0); }

.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>

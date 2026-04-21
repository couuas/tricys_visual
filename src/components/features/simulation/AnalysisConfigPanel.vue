<template>
  <div class="analysis-config-panel" :class="{ embedded }">
    <div class="panel-card">
      <div class="panel-header" :class="{ 'embedded-panel-header': embedded }">
        <div class="header-left">
          <div class="header-copy">
            <h2 class="title-gradient">Analysis Configuration</h2>
            <p class="subtitle">
              {{ currentStep === 1 ? 'Select Analysis Method' : (currentStep === 2 ? 'Configure Parameters' : 'Review Configuration') }}
            </p>
          </div>
        </div>
        <div v-if="embedded" class="step-indicator">
          <span class="step-indicator-label">Step</span>
          <span class="step-indicator-value">{{ currentStep }}/3</span>
        </div>
        <button v-if="showClose" @click="emit('close')" class="close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="panel-body" @dblclick.stop>
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

        <div v-else-if="currentStep === 2" class="panel-full step-container fade-in">
          <div class="config-block space-y-5">
            <div>
              <label class="mini-label">Analysis Job Name</label>
              <input v-model="analysisConfig.name" type="text" class="input-styled" placeholder="e.g. Width_Sensitivity_Run1" />
            </div>

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

            <div class="space-y-3">
              <div class="flex-between flex-end">
                <label class="mini-label inline-label">
                  {{ selectedTemplate === 'bisection' ? 'Parameter to Optimize' : 'Independent Variables' }}
                  <button class="help-btn" @click.prevent="showHelp = true" title="Parameter format help">?</button>
                </label>
                <button
                  v-if="['multi_param', 'sobol', 'latin'].includes(selectedTemplate)"
                  @click="showVarSelector = !showVarSelector"
                  class="link-btn"
                >
                  + Add Variable
                </button>
              </div>

              <div v-if="showVarSelector || analysisConfig.independent_variables.length === 0" class="add-var-box">
                <div class="rel-container" ref="compDropdownRef">
                  <input
                    v-model="analysisParam.componentSearch"
                    @focus="analysisParam.showCompDropdown = true"
                    placeholder="Search component..."
                    class="input-mini-dark"
                  />
                  <div v-if="analysisParam.showCompDropdown && filteredAnalysisComponents.length > 0" class="dropdown-list">
                    <div v-for="comp in filteredAnalysisComponents" :key="comp" @click="selectAnalysisComponent(comp)" class="dropdown-item">
                      {{ comp }}
                    </div>
                  </div>
                </div>
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

              <div class="var-list">
                <div v-for="(variable, idx) in analysisConfig.independent_variables" :key="idx" class="var-item">
                  <div class="flex-between mb-2">
                    <span class="var-name">{{ variable.name }}</span>
                    <button @click="removeAnalysisVariable(idx)" class="btn-micro-del">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon-xs" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                  </div>

                  <div v-if="['single_param', 'multi_param'].includes(selectedTemplate)">
                    <label class="mini-label">Sampling Values (Array or Macro)</label>
                    <input v-model="variable.sampling" placeholder="e.g. [0.1, 0.2] or linspace:0:1:5" class="input-mini-dark" />
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

            <div v-if="['sobol', 'latin'].includes(selectedTemplate)">
              <label class="mini-label">Sample Size (N)</label>
              <input v-model.number="analysisConfig.analyzer.sample_N" type="number" class="input-styled" />
              <p class="micro-text">Total runs = {{ analysisConfig.analyzer.sample_N * (analysisConfig.independent_variables.length + 2) }} (approx)</p>
            </div>

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

          <div class="config-block">
            <div class="flex-between mb-2">
              <label class="input-label">LLM Env (Optional)</label>
            </div>
            <div class="grid-2col">
              <div>
                <label class="mini-label">API Key</label>
                <input v-model="llmEnvConfig.apiKey" type="password" class="input-styled" placeholder="API_KEY" />
              </div>
              <div>
                <label class="mini-label">Base URL</label>
                <input v-model="llmEnvConfig.baseUrl" type="text" class="input-styled" placeholder="https://api.siliconflow.cn/v1" />
              </div>
            </div>
            <div class="grid-2col">
              <div>
                <label class="mini-label">AI Model</label>
                <input v-model="llmEnvConfig.aiModel" type="text" class="input-styled" placeholder="Qwen/Qwen3-30B-A3B-Instruct-2507" />
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

      <div class="panel-footer" v-if="currentStep >= 2">
        <button @click="currentStep === 2 ? currentStep = 1 : currentStep = 2" class="btn-cancel">Back</button>
        <button v-if="currentStep === 2" class="btn-submit" @click="preparePreview">Review Config</button>
        <button
          v-if="currentStep === 3"
          class="btn-submit"
          :class="{ disabled: isSubmitting || isRedirecting }"
          :disabled="isSubmitting || isRedirecting"
          @click="confirmSubmit"
        >
          <span v-if="isSubmitting || isRedirecting" class="spinner"></span>
          <span v-if="isRedirecting">Redirecting to Monitor...</span>
          <span v-else-if="!isSubmitting">Submit Task</span>
        </button>
      </div>
    </div>

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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { taskApi } from '../../../api/task';
import { useSimulation } from '../../../composables/useSimulation';
import { useAuth } from '../../../composables/useAuth';
import { $notify } from '../../../utils/notification';

const props = defineProps({
  modelMetadata: { type: Object, default: () => ({}) },
  showClose: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  navigateOnSubmit: { type: Boolean, default: true },
});

const emit = defineEmits(['close', 'analysis-started']);

const router = useRouter();
const route = useRoute();
const { isAuthenticated } = useAuth();
const { loadData, componentParams } = useSimulation();

const showHelp = ref(false);
const isSubmitting = ref(false);
const isRedirecting = ref(false);
const previewPayload = ref('');
const currentStep = ref(1);
const selectedTemplate = ref('single_param');
const showVarSelector = ref(false);
const showMetricsEditor = ref(false);
const selectedMetricKeys = ref([]);
const metricsError = ref('');

const templateOptions = [
  { id: 'single_param', name: 'Parameter Sweep', desc: 'Scan one parameter across a range.', icon: '📈' },
  { id: 'multi_param', name: 'Multi-Param Sweep', desc: 'Scan combinations of variables.', icon: '📊' },
  { id: 'sobol', name: 'Sensitivity (Sobol)', desc: 'Global sensitivity analysis with indices.', icon: '🎯' },
  { id: 'latin', name: 'Uncertainty (LHS)', desc: 'Latin Hypercube Sampling for UQ.', icon: '🎲' },
  { id: 'bisection', name: 'Optimization', desc: 'Bisection search for target value.', icon: '🔍' }
];

const analysisParam = ref({
  componentSearch: '',
  selectedComponent: null,
  showCompDropdown: false,
  paramSearch: '',
  selectedParam: null,
  showParamDropdown: false,
});

const analysisConfig = ref({
  name: 'Analysis_Run',
  independent_variables: [],
  dependent_variables: ['Startup_Inventory', 'Doubling_Time'],
  analyzer: {
    method: 'sobol',
    sample_N: 128,
  },
  bisection: [1.0, 1.5],
  bisection_tol: 0.005,
  bisection_iter: 10,
  stop_time: 12000.0,
  step_size: 0.5,
  metrics_definition: {},
});

const llmEnvConfig = ref({
  apiKey: '',
  baseUrl: '',
  aiModel: '',
});

const metricsJsonString = ref(JSON.stringify({
  Startup_Inventory: { source_column: 'sds.I[1]', method: 'calculate_startup_inventory' },
  Self_Sufficiency_Time: { source_column: 'sds.I[1]', method: 'time_of_turning_point' },
  Doubling_Time: { source_column: 'sds.I[1]', method: 'calculate_doubling_time' },
  Required_TBR: {
    source_column: 'sds.I[1]',
    method: 'bisection_search',
    parameter_to_optimize: 'blanket.TBR',
    search_range: [1, 1.5],
    tolerance: 0.005,
    max_iterations: 10,
  },
}, null, 4));

const parameterList = computed(() => {
  const grouped = {};
  if (!componentParams.value) return grouped;

  componentParams.value.forEach((param) => {
    const parts = param.name.split('.');
    const comp = parts.length > 1 ? parts[0] : 'global';
    if (!grouped[comp]) grouped[comp] = [];
    grouped[comp].push(param);
  });

  return grouped;
});

const componentsList = computed(() => Object.keys(parameterList.value || {}));
const availableMetricKeys = computed(() => Object.keys(analysisConfig.value.metrics_definition || {}));

const filteredAnalysisComponents = computed(() => {
  const query = analysisParam.value.componentSearch.toLowerCase();
  if (!query) return componentsList.value;
  return componentsList.value.filter((component) => component.toLowerCase().includes(query));
});

const filteredAnalysisParams = computed(() => {
  const comp = analysisParam.value.selectedComponent;
  if (!comp) return [];
  const params = parameterList.value[comp] || [];
  const query = analysisParam.value.paramSearch.toLowerCase();
  if (!query) return params;
  return params.filter((param) => param.name.toLowerCase().includes(query));
});

watch(metricsJsonString, (value) => {
  try {
    const parsed = JSON.parse(value);
    analysisConfig.value.metrics_definition = parsed;
    metricsError.value = '';
    selectedMetricKeys.value = Object.keys(parsed);
  } catch (error) {
    metricsError.value = error.message;
  }
}, { immediate: true });

watch(selectedTemplate, (value) => {
  analysisConfig.value.name = `${value.toUpperCase()}_Analysis`;
});

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

async function initPanel() {
  const projectId = route.query.projectId;
  if (projectId && (!componentParams.value || componentParams.value.length === 0)) {
    await loadData(projectId);
  }
  analysisConfig.value.name = `${selectedTemplate.value.toUpperCase()}_Analysis`;
  currentStep.value = 1;
  previewPayload.value = '';
}

onMounted(async () => {
  await initPanel();
  setTimeout(() => document.addEventListener('click', handleClickOutside), 100);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

function selectTemplate(id) {
  selectedTemplate.value = id;
  currentStep.value = 2;
}

function selectAnalysisComponent(comp) {
  analysisParam.value.selectedComponent = comp;
  analysisParam.value.componentSearch = comp;
  analysisParam.value.showCompDropdown = false;
  analysisParam.value.paramSearch = '';
}

function addAnalysisVariable(param) {
  if (!analysisParam.value.selectedComponent) return;

  const fullName = `${analysisParam.value.selectedComponent}.${param.name}`;
  if (analysisConfig.value.independent_variables.find((variable) => variable.name === fullName)) return;

  const nextVariable = {
    name: fullName,
    sampling: '',
    bounds: [0, 1],
    distribution: 'unif',
  };

  if (selectedTemplate.value === 'single_param' || selectedTemplate.value === 'bisection') {
    analysisConfig.value.independent_variables = [nextVariable];
  } else {
    analysisConfig.value.independent_variables.push(nextVariable);
  }

  analysisParam.value.showParamDropdown = false;
  analysisParam.value.paramSearch = '';
  showVarSelector.value = false;
}

function removeAnalysisVariable(index) {
  analysisConfig.value.independent_variables.splice(index, 1);
}

function fixParamName(name) {
  const parts = name.split('.');
  if (parts.length >= 2 && parts[0] === parts[1]) {
    return parts.slice(1).join('.');
  }
  return name;
}

function parseUserInputValue(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if (!normalized) return [];

  if (normalized.startsWith('{') && normalized.endsWith('}')) return normalized;
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    try {
      return JSON.parse(normalized);
    } catch {
      throw new Error(`Invalid JSON array format: ${normalized}`);
    }
  }

  const prefixes = ['linspace:', 'log:', 'rand:', 'file:'];
  if (prefixes.some((prefix) => normalized.toLowerCase().startsWith(prefix))) return normalized;
  if (/^-?[0-9.]+:-?[0-9.]+:-?[0-9.]+$/.test(normalized)) return normalized;

  if (normalized.includes(',')) {
    throw new Error(`Invalid format "${normalized}". Please use brackets [1, 2, 3] for lists or {1, 2, 3} for array expansions.`);
  }

  if (!Number.isNaN(Number(normalized))) return Number(normalized);
  return normalized;
}

function buildPayload() {
  const payload = {
    type: 'ANALYSIS',
    name: analysisConfig.value.name,
    project_id: route.query.projectId,
    config_json: {
      paths: { package_path: props.modelMetadata.packagePath || props.modelMetadata.modelName || null },
      simulation: {
        model_name: props.modelMetadata.modelName || 'example_model.Cycle',
        stop_time: analysisConfig.value.stop_time,
        step_size: analysisConfig.value.step_size,
        variableFilter: 'time|sds.I[1]',
      },
    },
  };

  const llmEnv = {
    API_KEY: llmEnvConfig.value.apiKey.trim(),
    BASE_URL: llmEnvConfig.value.baseUrl.trim(),
    AI_MODEL: llmEnvConfig.value.aiModel.trim(),
  };

  const hasLlmEnv = Object.values(llmEnv).some((entry) => entry);
  if (hasLlmEnv) payload.config_json.llm_env = llmEnv;

  const activeMetrics = {};
  selectedMetricKeys.value.forEach((key) => {
    if (analysisConfig.value.metrics_definition[key]) {
      activeMetrics[key] = analysisConfig.value.metrics_definition[key];
    }
  });

  const analysisSpec = {
    enabled: true,
    analysis_cases: [],
    metrics_definition: activeMetrics,
  };

  const dependentVars = Object.keys(activeMetrics);
  const caseDef = {
    name: analysisConfig.value.name,
    plot_type: 'line',
    dependent_variables: dependentVars,
    sweep_time: ['sds.I[1]'],
    combine_plots: true,
  };

  if (hasLlmEnv) caseDef.ai = true;

  if (selectedTemplate.value === 'single_param') {
    const indep = analysisConfig.value.independent_variables[0];
    if (indep) {
      caseDef.independent_variable = fixParamName(indep.name);
      caseDef.independent_variable_sampling = parseUserInputValue(indep.sampling);
    }
  } else if (selectedTemplate.value === 'multi_param') {
    const indep = analysisConfig.value.independent_variables[0];
    if (indep) {
      caseDef.independent_variable = fixParamName(indep.name);
      caseDef.independent_variable_sampling = parseUserInputValue(indep.sampling);
    }
    const multiParams = {};
    analysisConfig.value.independent_variables.slice(1).forEach((variable) => {
      multiParams[variable.name] = parseUserInputValue(variable.sampling);
    });
    caseDef.simulation_parameters = multiParams;
  }

  if (['single_param', 'multi_param'].includes(selectedTemplate.value)) {
    analysisSpec.analysis_cases.push(caseDef);
    payload.config_json.sensitivity_analysis = analysisSpec;
  } else if (['sobol', 'latin'].includes(selectedTemplate.value)) {
    payload.config_json.sensitivity_analysis = {
      method: selectedTemplate.value,
      parameters: analysisConfig.value.independent_variables.map((variable) => ({
        name: fixParamName(variable.name),
        bounds: variable.bounds,
        distribution: variable.distribution || 'uniform',
      })),
      N: analysisConfig.value.analyzer.sample_N,
      conf_level: 0.95,
      metrics_definition: activeMetrics,
    };
  } else if (selectedTemplate.value === 'bisection') {
    payload.config_json.optimization = {
      method: 'bisection',
      target_variable: dependentVars[0] || '',
      target_value: 1000,
      parameter: fixParamName(analysisConfig.value.independent_variables[0]?.name),
      bounds: analysisConfig.value.bisection,
      tol: analysisConfig.value.bisection_tol,
      max_iter: analysisConfig.value.bisection_iter,
    };
  }

  return payload;
}

function preparePreview() {
  try {
    const payload = buildPayload();
    previewPayload.value = JSON.stringify(payload, null, 4);
    currentStep.value = 3;
  } catch (error) {
    alert(`Validation Error: ${error.message}`);
  }
}

async function confirmSubmit() {
  if (!isAuthenticated.value) {
    $notify({ title: 'AUTHENTICATION REQUIRED', message: 'Please log in to submit tasks.', type: 'error' });
    return;
  }

  isSubmitting.value = true;
  isRedirecting.value = false;
  try {
    const payload = JSON.parse(previewPayload.value);
    const response = await taskApi.createTask(payload);
    emit('analysis-started', response);
    $notify({ title: 'ANALYSIS TASK SUBMITTED', message: 'Task created successfully.', type: 'success' });

    if (props.navigateOnSubmit) {
      isSubmitting.value = false;
      isRedirecting.value = true;
      setTimeout(() => {
        emit('close');
        router.push({
          name: 'monitor',
          query: {
            projectId: route.query.projectId,
            taskId: response.id,
          },
        });
      }, 1000);
      return;
    }

    isSubmitting.value = false;
    isRedirecting.value = false;
  } catch (error) {
    let message = error.response?.data?.detail || error.message;
    if (error.response?.status === 401 || error.response?.status === 403) {
      message = 'Session expired or invalid. Please log in again.';
    }
    alert(`Failed to submit task: ${message}`);
    isSubmitting.value = false;
    isRedirecting.value = false;
  }
}
</script>

<style scoped>
.analysis-config-panel {
  position: relative;
  width: 100%;
  height: 100%;
  color: #c9d1d9;
  font-family: 'Inter', sans-serif;
}

.panel-card {
  width: 700px;
  height: 85vh;
  max-width: 100%;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 12px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.embedded .panel-card {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  border-color: rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.015);
  box-shadow: none;
}

.panel-header {
  padding: 15px 25px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.embedded-panel-header {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.018);
  border-bottom-color: rgba(255, 255, 255, 0.05);
  gap: 12px;
}

.header-copy {
  min-width: 0;
}

.title-gradient {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(90deg, #00d2ff, #007bff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: #8b949e;
}

.embedded-panel-header .title-gradient {
  font-size: 13px;
  font-weight: 600;
  background: none;
  color: #dce7ef;
}

.embedded-panel-header .subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: #8093a2;
}

.close-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
}

.close-btn:hover {
  color: #fff;
}

.panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 16px;
  min-height: 0;
}

.step-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-full {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.config-block {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 20px;
}

.input-label {
  display: block;
  color: #8b949e;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 5px;
}

.mini-label {
  display: block;
  color: #8b949e;
  font-size: 10px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.inline-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.micro-text {
  font-size: 10px;
  color: #666;
  margin-top: 4px;
}

.input-styled,
.input-mini-dark,
.textarea-code {
  width: 100%;
  box-sizing: border-box;
  background: #0d1117;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  outline: none;
  transition: border 0.2s;
}

.input-mini-dark {
  padding: 6px;
  font-size: 11px;
  background: #05070a;
}

.textarea-code {
  background: #05070a;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.input-styled:focus,
.input-mini-dark:focus,
.textarea-code:focus {
  border-color: #00d2ff;
}

.error-text {
  color: #f85149;
  font-size: 11px;
  margin-top: 5px;
}

.info-text {
  font-size: 11px;
  color: #8b949e;
  font-style: italic;
}

.grid-2col,
.grid-2col-tight {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.grid-2col {
  gap: 16px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-end {
  align-items: flex-end;
}

.btn-micro-del,
.link-btn,
.help-btn,
.close-help-btn,
.close-btn,
.back-btn,
.btn-cancel,
.btn-submit {
  cursor: pointer;
}

.btn-micro-del {
  background: none;
  border: none;
  color: #484f58;
  padding: 2px;
}

.btn-micro-del:hover {
  color: #f85149;
}

.link-btn {
  background: none;
  border: none;
  color: #00d2ff;
  font-size: 11px;
  text-decoration: underline;
}

.add-var-box {
  background: #0d1117;
  padding: 10px;
  border: 1px solid #30363d;
  border-radius: 4px;
  margin-bottom: 10px;
}

.rel-container {
  position: relative;
  margin-bottom: 8px;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  background: #161b22;
  border: 1px solid #30363d;
  max-height: 150px;
  overflow-y: auto;
  border-radius: 4px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
}

.dropdown-item {
  padding: 6px 10px;
  font-size: 11px;
  color: #c9d1d9;
  border-bottom: 1px solid #21262d;
}

.dropdown-item:hover {
  background: #1f6feb;
  color: white;
}

.var-list {
  margin-top: 10px;
}

.var-item {
  background: #21262d;
  border: 1px solid #30363d;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.var-name {
  font-family: monospace;
  font-size: 11px;
  color: #00d2ff;
  word-break: break-all;
}

.panel-footer {
  padding: 15px 25px;
  background: #161b22;
  border-top: 1px solid #30363d;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-cancel {
  background: none;
  border: 1px solid transparent;
  color: #8b949e;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
}

.btn-submit {
  background: linear-gradient(135deg, #1f6feb, #00d2ff);
  border: none;
  color: white;
  padding: 8px 24px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(0, 210, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-submit.disabled {
  opacity: 0.7;
  cursor: wait;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.metrics-list {
  max-height: 200px;
  overflow-y: auto;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 5px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #21262d;
}

.metric-item:last-child {
  border-bottom: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c9d1d9;
  font-size: 11px;
}

.metric-key {
  font-family: monospace;
  color: #00d2ff;
}

.mini-tag {
  font-size: 9px;
  background: #21262d;
  padding: 2px 6px;
  border-radius: 4px;
  color: #8b949e;
}

.count-badge {
  background: #00d2ff;
  color: #000;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  margin-left: 8px;
}

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

.full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.full-height .preview-box {
  flex: 1;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
  flex: 1;
}

.step-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  white-space: nowrap;
}

.step-indicator-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7c8d9a;
}

.step-indicator-value {
  font-size: 11px;
  font-weight: 600;
  color: #d6e1e9;
}

.back-btn {
  background: none;
  border: 1px solid #30363d;
  color: #ccc;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  align-content: start;
  gap: 14px;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 120px;
  padding: 18px;
  border: 1px solid #30363d;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(22, 27, 34, 0.95) 0%, rgba(13, 17, 23, 0.98) 100%);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.embedded .panel-body {
  padding: 12px;
}

.template-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 210, 255, 0.45);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
}

.card-icon {
  font-size: 28px;
}

.card-content {
  flex: 1;
}

.card-title {
  margin: 0 0 6px;
  font-size: 14px;
}

.card-desc {
  margin: 0;
  font-size: 11px;
  color: #8b949e;
  line-height: 1.45;
}

.card-arrow {
  color: #00d2ff;
  font-size: 18px;
}

.help-btn {
  border: 1px solid #30363d;
  background: #0d1117;
  color: #8b949e;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.help-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.help-dialog {
  width: min(560px, calc(100% - 32px));
  max-height: min(78vh, 720px);
  overflow: auto;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 14px;
  padding: 18px;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-help-btn {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 20px;
}

.help-intro {
  color: #8b949e;
  font-size: 12px;
}

.help-list {
  padding-left: 18px;
}

.hl-type {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.hl-desc {
  font-size: 11px;
  color: #8b949e;
  margin-bottom: 4px;
}

.hl-code {
  font-size: 11px;
  margin-bottom: 10px;
}

.mb-2 {
  margin-bottom: 8px;
}

.space-y-3 > * + * {
  margin-top: 12px;
}

.space-y-5 > * + * {
  margin-top: 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .template-grid,
  .grid-2col,
  .grid-2col-tight {
    grid-template-columns: 1fr;
  }

  .panel-card {
    height: 100%;
    width: 100%;
  }

  .panel-body,
  .embedded .panel-body {
    padding: 10px;
  }

  .panel-footer {
    padding: 12px 16px;
    flex-wrap: wrap;
  }

  .template-card {
    min-height: 108px;
    padding: 16px;
  }

  .config-block {
    padding: 12px;
    margin-bottom: 14px;
  }
}

@media (max-width: 640px) {
  .embedded-panel-header,
  .panel-header {
    padding: 10px 12px;
    align-items: flex-start;
    gap: 10px;
  }

  .header-left {
    width: 100%;
  }

  .embedded-panel-header {
    flex-wrap: wrap;
  }

  .step-indicator {
    order: 3;
  }

  .panel-body,
  .embedded .panel-body {
    padding: 8px;
  }

  .panel-footer {
    flex-direction: column-reverse;
    padding: 10px 12px;
  }

  .btn-cancel,
  .btn-submit {
    width: 100%;
    justify-content: center;
  }

  .template-card {
    min-height: 96px;
    padding: 14px;
    gap: 12px;
  }

  .card-icon {
    font-size: 24px;
  }

  .card-title {
    font-size: 13px;
  }

  .card-desc,
  .json-preview,
  .input-styled,
  .input-mini-dark,
  .textarea-code {
    font-size: 11px;
  }

  .flex-between {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .help-dialog {
    width: min(100%, calc(100% - 16px));
    padding: 14px;
  }
}
</style>
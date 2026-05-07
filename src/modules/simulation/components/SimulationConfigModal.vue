<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-card">
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

      <div class="modal-body">
          <div class="panel-center" v-if="!showPreview">
            <div v-if="hasConfiguredFoc" class="config-block foc-inline-block">
              <div class="flex-between foc-inline-header">
                <h3 class="block-title">FOC Preview</h3>
                <div class="foc-inline-meta">
                  <span v-if="focComponentLabel" class="foc-meta-chip">{{ focComponentLabel }}</span>
                  <span class="foc-meta-chip">{{ focSourceLabel }}</span>
                </div>
              </div>

              <div v-if="focStopTimeWarning" class="modal-warning-banner">
                {{ focStopTimeWarning }}
              </div>

              <div v-if="focPreviewUnavailableReason" class="modal-warning-banner">
                {{ focPreviewUnavailableReason }}
              </div>

              <div v-if="focState.error" class="modal-error-banner">
                {{ focState.error }}
              </div>

              <div class="foc-inline-grid">
                <pre class="foc-inline-code">{{ focState.content || '# Preview unavailable for foc_path-only configuration.' }}</pre>
                <div class="foc-inline-chart-shell">
                  <FocTimelineChart :rows="focPreviewRows" :loading="focState.isPreviewLoading" />
                </div>
              </div>
            </div>

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
                  <div v-if="focStopTimeWarning" class="field-warning-text">{{ focStopTimeWarning }}</div>
                </div>
                <div>
                  <label class="input-label">Step Size (s)</label>
                  <input v-model.number="simSettings.stepSize" type="number" min="0.001" step="0.01" class="input-styled" />
                </div>
                <div v-if="hasConfiguredFoc" class="config-subsection">
                  <div class="subsection-title">FOC Options</div>
                  <div class="foc-config-grid">
                    <div>
                      <label class="input-label">foc_component</label>
                      <input :value="focState.component ? focState.component : 'selection required'" readonly class="input-styled readonly" />
                    </div>
                    <div>
                      <label class="input-label">foc_path</label>
                      <input :value="focState.path ? focState.path : 'inline foc_content mode'" readonly class="input-styled readonly" />
                    </div>
                  </div>
                </div>
                <div class="config-subsection">
                  <div class="subsection-title">Execution Options</div>
                  <label class="toggle-row">
                    <input v-model="simSettings.concurrent" type="checkbox" />
                    <span>Enable concurrent job execution</span>
                  </label>
                  <label class="toggle-row" v-if="simSettings.concurrent">
                    <input v-model="simSettings.maximizeWorkers" type="checkbox" />
                    <span>Use maximum available workers</span>
                  </label>
                  <div v-if="simSettings.concurrent && !simSettings.maximizeWorkers">
                    <label class="input-label">Max Workers (Optional)</label>
                    <input v-model.number="simSettings.maxWorkers" type="number" min="1" step="1" class="input-styled" placeholder="Auto if empty" />
                  </div>
                </div>
              </div>
            </div>

            <div class="config-block">
               <h3 class="block-title flex-between">
                 <div style="display: flex; align-items: center; gap: 8px;">
                    Parameter Overrides
                    <button class="help-btn" @click.prevent="showHelp = true" title="Parameter format help">?</button>
                 </div>
                 <span class="count-badge">{{ flatModifiedParams.length }} active</span>
               </h3>

               <div class="add-param-box">
                  <div class="box-label">Add/Modify Parameter Override</div>

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

                   <div v-if="manualParam.selectedParam" class="flex-end-gap">
                      <div class="flex-1">
                        <label class="mini-label">New Value</label>
                        <input v-model="manualParam.value" class="input-mini" />
                      </div>
                      <button @click="applyManualParam" class="btn-mini-action">Apply</button>
                   </div>
               </div>

               <div v-if="flatModifiedParams.length === 0" class="empty-state">
                 No parameter overrides. Simulation will use defaults.
               </div>
               <div v-else class="param-list">
                 <div v-for="(item, index) in flatModifiedParams" :key="index" class="param-item">
                    <div class="truncate-box">
                      <div class="param-key" :title="item.displayKey">{{ item.displayKey }}</div>
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

            <div class="config-block">
              <h3 class="block-title flex-between">
                <span>Output Filters</span>
                <span class="count-badge">{{ filterSchema.length }} active</span>
              </h3>

              <div class="add-param-box">
                <div class="box-label">Add/Modify Output Filter</div>

                <div class="rel-container" ref="filterCompDropdownRef">
                  <label class="mini-label">Component</label>
                  <input
                    v-model="manualFilter.componentSearch"
                    @focus="manualFilter.showCompDropdown = true"
                    placeholder="Search component..."
                    class="input-mini"
                  />
                  <div v-if="manualFilter.showCompDropdown && filteredFilterComponents.length > 0" class="dropdown-list">
                    <div
                      v-for="comp in filteredFilterComponents"
                      :key="comp"
                      @click="selectManualFilterComponent(comp)"
                      class="dropdown-item"
                    >
                      {{ comp }}
                    </div>
                  </div>
                </div>

                <div v-if="manualFilter.selectedComponent" class="filter-form-grid">
                  <div>
                    <label class="mini-label">Min</label>
                    <input v-model="manualFilter.min" type="number" step="any" class="input-mini" placeholder="Optional" />
                  </div>
                  <div>
                    <label class="mini-label">Max</label>
                    <input v-model="manualFilter.max" type="number" step="any" class="input-mini" placeholder="Optional" />
                  </div>
                </div>

                <div v-if="manualFilter.selectedComponent" class="flex-end-gap">
                  <div class="filter-column-preview">{{ `${manualFilter.selectedComponent}.I[1]` }}</div>
                  <button @click="applyManualFilter" class="btn-mini-action">Apply</button>
                </div>
              </div>

              <div v-if="filterSchema.length === 0" class="empty-state">
                No output filters configured. All simulation results will be retained.
              </div>
              <div v-else class="filters-list">
                <div v-for="rule in flatFilterRules" :key="`${rule.displayKey}-${rule.index}`" class="filter-item">
                  <div class="filter-main">
                    <div class="filter-columns">{{ rule.displayKey }}</div>
                    <div class="filter-bounds">
                      <input
                        :value="rule.min"
                        @change="updateExistingFilter(rule.compId, 'min', $event.target.value)"
                        class="input-micro"
                        placeholder="min"
                      />
                      <input
                        :value="rule.max"
                        @change="updateExistingFilter(rule.compId, 'max', $event.target.value)"
                        class="input-micro"
                        placeholder="max"
                      />
                      <button @click="removeExistingFilter(rule.compId)" class="btn-micro-del" title="Remove Filter">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon-xs" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div class="panel-center" v-else>
             <div class="config-block full-height">
                <h3 class="block-title">Review Configuration</h3>
                <div class="preview-box">
                   <pre class="json-preview">{{ previewPayload }}</pre>
                </div>
             </div>
          </div>
      </div>

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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { taskApi } from '../../../api/task';
import { projectApi } from '../../../api/project';
import { useSimulationParameters } from '../composables/useSimulationParameters';
import { useSimulationWorkspace } from '../composables/useSimulationWorkspace';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';
import { useFocDraft } from '../composables/useFocDraft';
import { $notify } from '../../../utils/notification';
import FocTimelineChart from './FocTimelineChart.vue';

const props = defineProps({
  visible: Boolean,
  modelMetadata: Object
});

const emit = defineEmits(['close', 'simulation-started']);
const router = useRouter();

const showHelp = ref(false);

const {
  loadProjectWorkspace,
  componentParams,
  structureData,
  updateParam,
  revertParam,
} = useProjectWorkspace();

const {
  modifiedParams
} = useSimulationParameters();

const {
  filterSchema,
  lastSimConfig,
  saveComponentFilterRule
} = useSimulationWorkspace();

const {
  focState,
  taskPayload: focTaskPayload,
  setProjectScope,
  syncFromConfig,
  previewNow
} = useFocDraft();

const isSubmitting = ref(false);
const showPreview = ref(false);
const previewPayload = ref('');

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

const simSettings = ref({
  customName: '',
  stopTime: 2000,
  stepSize: 0.1,
  concurrent: false,
  maximizeWorkers: false,
  maxWorkers: null
});

const manualParam = ref({
  componentSearch: '',
  selectedComponent: null,
  showCompDropdown: false,
  paramSearch: '',
  selectedParam: null,
  showParamDropdown: false,
  value: ''
});

const manualFilter = ref({
  componentSearch: '',
  selectedComponent: null,
  showCompDropdown: false,
  min: '',
  max: ''
});

const showMetricsEditor = ref(false);

const hasConfiguredFoc = computed(() => Boolean(focTaskPayload.value));
const hasInlineFocContent = computed(() => Boolean(focState.value.enabled && String(focState.value.content || '').trim()));
const focComponentLabel = computed(() => {
  if (!String(focState.value.component || '').trim()) {
    return '';
  }
  return `target: ${String(focState.value.component).trim()}`;
});
const focSourceLabel = computed(() => {
  const path = String(focState.value.path || '').trim();
  if (path) {
    return path;
  }
  return focState.value.sourceName || 'task_input.foc';
});
const focPreviewRows = computed(() => focState.value.preview?.rows ?? []);
const focStopTimeWarning = computed(() => {
  return (focState.value.warnings || []).find((warning) =>
    String(warning).includes('Configured stop_time is shorter than the FOC schedule duration.')
  ) || '';
});
const focPreviewUnavailableReason = computed(() => {
  if (!hasConfiguredFoc.value) {
    return '';
  }
  if (hasInlineFocContent.value) {
    return '';
  }
  if (String(focState.value.path || '').trim()) {
    return 'This FOC is configured by foc_path. Inline timeline preview is unavailable until content is uploaded or pasted into the workbench.';
  }
  return 'FOC is enabled, but no content or foc_path is configured.';
});

const flatFilterRules = computed(() => {
  if (!Array.isArray(filterSchema.value)) return [];
  return filterSchema.value.map((rule, index) => {
    const firstColumn = Array.isArray(rule.columns) && rule.columns.length > 0 ? rule.columns[0] : '';
    const compId = firstColumn.includes('.') ? firstColumn.split('.')[0] : firstColumn;
    return {
      index,
      compId,
      displayKey: Array.isArray(rule.columns) ? rule.columns.join(', ') : '',
      min: rule.min ?? '',
      max: rule.max ?? ''
    };
  });
});
const selectedMetricKeys = ref([]);
const metricsDefinition = ref({});

const metricsJsonString = ref(JSON.stringify({
   Startup_Inventory: { source_column: 'sds.I[1]', method: 'calculate_startup_inventory' },
   Self_Sufficiency_Time: { source_column: 'sds.I[1]', method: 'time_of_turning_point' },
   Doubling_Time: { source_column: 'sds.I[1]', method: 'calculate_doubling_time' }
}, null, 4));
const metricsError = ref('');

const compDropdownRef = ref(null);
const paramDropdownRef = ref(null);
const filterCompDropdownRef = ref(null);

function handleClickOutside(event) {
  if (manualParam.value.showCompDropdown && compDropdownRef.value && !compDropdownRef.value.contains(event.target)) {
    manualParam.value.showCompDropdown = false;
  }
  if (manualParam.value.showParamDropdown && paramDropdownRef.value && !paramDropdownRef.value.contains(event.target)) {
    manualParam.value.showParamDropdown = false;
  }
  if (manualFilter.value.showCompDropdown && filterCompDropdownRef.value && !filterCompDropdownRef.value.contains(event.target)) {
    manualFilter.value.showCompDropdown = false;
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  if (router.currentRoute.value.query.projectId) {
     if (!componentParams.value || componentParams.value.length === 0) {
      await loadProjectWorkspace(router.currentRoute.value.query.projectId);
     }
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

watch(() => props.visible, async (val) => {
   if (val) {
      const projectId = router.currentRoute.value.query.projectId || 'default';
      setProjectScope(projectId);
      if (router.currentRoute.value.query.projectId) {
        if (!componentParams.value || componentParams.value.length === 0) {
             await loadProjectWorkspace(router.currentRoute.value.query.projectId);
        }
      }

      const config = lastSimConfig.value || {};
      const simulation = config.simulation || {};
      syncFromConfig(config.foc || null);
      if (simulation.stop_time !== undefined) simSettings.value.stopTime = simulation.stop_time;
      if (simulation.step_size !== undefined) simSettings.value.stepSize = simulation.step_size;
      simSettings.value.concurrent = Boolean(simulation.concurrent);
      simSettings.value.maximizeWorkers = Boolean(simulation.maximize_workers);
      simSettings.value.maxWorkers = simulation.max_workers ?? null;
      if (config.metrics_definition) {
        metricsJsonString.value = JSON.stringify(config.metrics_definition, null, 4);
      }
      showPreview.value = false;

      if (hasInlineFocContent.value) {
        await previewNow(simSettings.value.stopTime);
      }
   }
});

watch(
  () => simSettings.value.stopTime,
  (value) => {
    if (props.visible && hasInlineFocContent.value) {
      previewNow(value);
    }
  }
);

watch(
  () => [props.visible, focState.value.enabled, focState.value.content, focState.value.strategy],
  ([visible, enabled, content]) => {
    if (visible && enabled && String(content || '').trim()) {
      previewNow(simSettings.value.stopTime);
    }
  }
);

watch(() => simSettings.value.maximizeWorkers, (value) => {
  if (value) {
    simSettings.value.maxWorkers = null;
  }
});

const componentsList = computed(() => Object.keys(parameterList.value || {}));

const filteredComponents = computed(() => {
   const q = manualParam.value.componentSearch.toLowerCase();
   if (!q) return componentsList.value;
   return componentsList.value.filter((component) => component.toLowerCase().includes(q));
});

const filteredFilterComponents = computed(() => {
  const q = manualFilter.value.componentSearch.toLowerCase();
  if (!q) return componentsList.value;
  return componentsList.value.filter((component) => component.toLowerCase().includes(q));
});

const filteredParameters = computed(() => {
   const comp = manualParam.value.selectedComponent;
   if (!comp) return [];
   const params = parameterList.value[comp] || [];
   const q = manualParam.value.paramSearch.toLowerCase();
   if (!q) return params;
   return params.filter((param) => param.name.toLowerCase().includes(q));
});

function handleClose() {
  emit('close');
}

function selectManualComponent(comp) {
  manualParam.value.selectedComponent = comp;
  manualParam.value.componentSearch = comp;
  manualParam.value.showCompDropdown = false;
  manualParam.value.paramSearch = '';
  manualParam.value.selectedParam = null;
}

function selectManualFilterComponent(comp) {
  const existingRule = flatFilterRules.value.find((rule) => rule.compId === comp);
  manualFilter.value.selectedComponent = comp;
  manualFilter.value.componentSearch = comp;
  manualFilter.value.showCompDropdown = false;
  manualFilter.value.min = existingRule?.min ?? '';
  manualFilter.value.max = existingRule?.max ?? '';
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
      alert('Validation Error: ' + err.message);
      return;
  }

  await updateParam(compId, paramName, manualParam.value.value);
}

async function updateExistingParam(compId, key, val) {
    try {
        parseUserInputValue(val);
    } catch (err) {
        alert('Validation Error: ' + err.message);
        modifiedParams.value = { ...modifiedParams.value };
        return;
    }
    await updateParam(compId, key, val);
}

async function revertExistingParam(compId, key) {
    await revertParam(compId, key);
}

function parseFilterBound(value, label) {
  if (value === '' || value === null || value === undefined) return undefined;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return numericValue;
}

async function applyManualFilter() {
  if (!manualFilter.value.selectedComponent) return;

  try {
    const min = parseFilterBound(manualFilter.value.min, 'Filter min');
    const max = parseFilterBound(manualFilter.value.max, 'Filter max');
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error('Filter min cannot be greater than max.');
    }
    await saveComponentFilterRule(
      manualFilter.value.selectedComponent,
      (min !== undefined || max !== undefined) ? { min, max } : null
    );
  } catch (err) {
    alert('Validation Error: ' + err.message);
  }
}

async function updateExistingFilter(compId, bound, value) {
  const existingRule = flatFilterRules.value.find((rule) => rule.compId === compId);
  if (!existingRule) return;

  try {
    const nextMin = bound === 'min' ? parseFilterBound(value, 'Filter min') : parseFilterBound(existingRule.min, 'Filter min');
    const nextMax = bound === 'max' ? parseFilterBound(value, 'Filter max') : parseFilterBound(existingRule.max, 'Filter max');
    if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) {
      throw new Error('Filter min cannot be greater than max.');
    }
    await saveComponentFilterRule(compId, (nextMin !== undefined || nextMax !== undefined) ? { min: nextMin, max: nextMax } : null);
  } catch (err) {
    alert('Validation Error: ' + err.message);
  }
}

async function removeExistingFilter(compId) {
  await saveComponentFilterRule(compId, null);
  if (manualFilter.value.selectedComponent === compId) {
    manualFilter.value.min = '';
    manualFilter.value.max = '';
  }
}

const availableMetricKeys = computed(() => Object.keys(metricsDefinition.value || {}));

watch(metricsJsonString, (val) => {
   try {
      const parsed = JSON.parse(val);
      metricsDefinition.value = parsed;
      metricsError.value = '';
      selectedMetricKeys.value = Object.keys(parsed);
   } catch (e) {
      metricsError.value = e.message;
   }
}, { immediate: true });

async function preparePreview() {
   if (showMetricsEditor.value && metricsError.value) {
      alert('Please fix JSON errors in Metrics Definition.');
      return;
   }

   try {
       const payload = generatePayload();
       previewPayload.value = JSON.stringify(payload, null, 2);
       showPreview.value = true;
   } catch (e) {
       console.error('Preview gen error', e);
       alert('Failed to generate preview: ' + e.message);
   }
}

async function confirmSubmit() {
   isSubmitting.value = true;

   try {
      const payload = JSON.parse(previewPayload.value);

      await projectApi.saveRunConfig(
        router.currentRoute.value.query.projectId,
        buildPersistentRunConfig(payload.config_json)
      );

      const taskObj = await taskApi.createTask(payload);

      $notify({ title: 'SUCCESS', message: 'Task submitted. Redirecting to monitor...', type: 'success' });

      emit('simulation-started', taskObj);

      setTimeout(() => {
        handleClose();
        router.push({
            name: 'monitor',
            query: {
            projectId: router.currentRoute.value.query.projectId,
            taskId: taskObj.id
            }
        });
      }, 1000);

   } catch (e) {
      console.error('Submission error', e);
      alert('Failed to submit task: ' + (e.response?.data?.detail || e.message));
      isSubmitting.value = false;
   }
}

function parseUserInputValue(str) {
    if (typeof str !== 'string') return str;
    const s = str.trim();
    if (!s) return '';

    if (s.startsWith('{') && s.endsWith('}')) return s;
    if (s.startsWith('[') && s.endsWith(']')) {
        try { return JSON.parse(s); } catch (e) { throw new Error(`Invalid JSON array format: ${s}`); }
    }
    const prefixes = ['linspace:', 'log:', 'rand:', 'file:'];
    if (prefixes.some((prefix) => s.toLowerCase().startsWith(prefix))) return s;
    if (/^-?[0-9.]+:-?[0-9.]+:-?[0-9.]+$/.test(s)) return s;

    if (s.includes(',')) {
        throw new Error(`Invalid format "${s}". Please use brackets [1, 2, 3] for lists or {1, 2, 3} for array expansions.`);
    }

    if (!Number.isNaN(Number(s))) return Number(s);

    return s;
}

function generatePayload() {
  if (hasConfiguredFoc.value && !String(focState.value.component || '').trim()) {
    throw new Error('FOC requires a foc_component selection before submission.');
  }

    const simParams = {};
    if (modifiedParams.value) {
        for (const [compId, params] of Object.entries(modifiedParams.value)) {
            for (const [key, val] of Object.entries(params)) {
               const displayKey = compId === 'global' ? key : `${compId}.${key}`;
               simParams[displayKey] = parseUserInputValue(val);
            }
        }
    }

    const metrics = {};
    selectedMetricKeys.value.forEach((key) => {
        if (metricsDefinition.value[key]) {
            metrics[key] = metricsDefinition.value[key];
        }
    });

    let defaultFilter = 'time';
    if (structureData.value && structureData.value.components) {
        structureData.value.components.forEach((component) => {
            if (component.id) defaultFilter += `|${component.id}.I[1]`;
        });
    }

    const payload = {
       type: 'BASIC',
       name: simSettings.value.customName || `example_model.Cycle_Run_${new Date().toISOString().slice(11,19)}`,
       project_id: router.currentRoute.value.query.projectId,
       config_json: {
           paths: { package_path: props.modelMetadata.packagePath || props.modelMetadata.modelName || null },
           simulation: {
               model_name: props.modelMetadata.modelName || 'example_model.Cycle',
               stop_time: simSettings.value.stopTime,
               step_size: simSettings.value.stepSize,
               concurrent: simSettings.value.concurrent,
               maximize_workers: simSettings.value.maximizeWorkers,
               ...(simSettings.value.concurrent && !simSettings.value.maximizeWorkers && simSettings.value.maxWorkers ? { max_workers: simSettings.value.maxWorkers } : {}),
               variableFilter: defaultFilter
           },
         ...(focTaskPayload.value ? { foc: focTaskPayload.value } : {}),
           simulation_parameters: simParams,
           metrics_definition: metrics,
           ...(filterSchema.value.length > 0 ? { filter_schema: filterSchema.value } : {})
       }
    };

    return payload;
}

function buildPersistentRunConfig(configJson) {
  return JSON.parse(JSON.stringify(configJson || {}));
}
</script>

<style scoped>
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
  width: 700px; height: 85vh;
  position: relative;
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
.panel-center { width: 100%; display: flex; flex-direction: column; overflow-y: auto; }
.panel-center::-webkit-scrollbar { width: 6px; }
.panel-center::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

.config-block {
  background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 15px; margin-bottom: 20px;
}
.foc-inline-block {
  padding: 14px;
}
.block-title {
  font-size: 11px; font-weight: 700; color: #8b949e; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.5px;
}
.count-badge {
    background: #00d2ff; color: #000; padding: 2px 6px; border-radius: 8px; font-size: 9px;
}

.help-btn {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(0, 210, 255, 0.45);
  border-radius: 999px;
  background: rgba(0, 210, 255, 0.12);
  color: #67e8f9;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.help-btn:hover {
  background: rgba(0, 210, 255, 0.22);
  border-color: rgba(0, 210, 255, 0.8);
}

.input-label { display: block; color: #8b949e; font-size: 11px; font-weight: 600; margin-bottom: 5px; }
.field-warning-text {
  margin-top: 6px;
  color: #fbbf24;
  font-size: 11px;
  line-height: 1.4;
}
.mini-label { display: block; color: #8b949e; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
.config-subsection { margin-top: 12px; padding-top: 12px; border-top: 1px solid #21262d; }
.subsection-title { font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #c9d1d9; margin-bottom: 8px; cursor: pointer; }
.toggle-row input { cursor: pointer; }

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

.grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-end-gap { display: flex; align-items: flex-end; gap: 8px; }
.flex-center-gap { display: flex; align-items: center; gap: 8px; }

.btn-mini-action {
  background: #1f6feb; color: white; border: none; padding: 4px 10px; border-radius: 3px; font-size: 11px; cursor: pointer; height: 28px;
}
.btn-mini-action:hover { background: #388bfd; }

.btn-micro-del { background: none; border: none; color: #484f58; cursor: pointer; padding: 2px; }
.btn-micro-del:hover { color: #f85149; }

.link-btn { background: none; border: none; color: #00d2ff; font-size: 11px; cursor: pointer; text-decoration: underline; }

.icon { width: 24px; height: 24px; }
.icon-xs { width: 14px; height: 14px; }

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

.help-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  box-sizing: border-box;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(8px);
}

.help-dialog {
  width: min(620px, 100%);
  max-height: min(680px, 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(34, 211, 238, 0.24);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.98), rgba(5, 8, 13, 0.99));
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.58);
}

.help-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 27, 34, 0.92);
}

.help-header h4 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e5f6ff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.help-header .icon {
  width: auto;
  height: auto;
  color: #facc15;
  font-size: 18px;
  line-height: 1;
}

.close-help-btn {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.close-help-btn:hover {
  border-color: rgba(34, 211, 238, 0.58);
  color: #67e8f9;
}

.help-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 18px;
}

.help-intro {
  margin: 0 0 14px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.55;
}

.help-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.help-list li {
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.58);
}

.hl-type {
  color: #67e8f9;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hl-desc {
  margin-top: 6px;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.5;
}

.hl-code {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(34, 211, 238, 0.18);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.82);
  color: #e2e8f0;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  overflow-x: auto;
}

.hl-code code {
  color: #bae6fd;
  font-family: inherit;
}

.highlight-code {
  border-color: rgba(250, 204, 21, 0.22);
  background: rgba(120, 53, 15, 0.18);
}

.highlight-code strong {
  color: #fde68a;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
}

.spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.mb-4 { margin-bottom: 16px; }

.metrics-list { max-height: 200px; overflow-y: auto; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 5px; }
.metric-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid #21262d; }
.metric-item:last-child { border-bottom: none; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #c9d1d9; font-size: 11px; }
.metric-key { font-family: monospace; color: #00d2ff; }
.mini-tag { font-size: 9px; background: #21262d; padding: 2px 6px; border-radius: 4px; color: #8b949e; }
.filters-list { display: flex; flex-direction: column; gap: 8px; }
.filter-item { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 8px 10px; }
.filter-main { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.filter-columns { font-size: 11px; color: #00d2ff; font-family: 'JetBrains Mono', monospace; }
.filter-bounds { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.filter-column-preview { flex: 1; font-size: 11px; color: #00d2ff; font-family: 'JetBrains Mono', monospace; align-self: center; }

.foc-inline-header {
  gap: 12px;
  margin-bottom: 12px;
}

.foc-inline-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.foc-meta-chip {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  color: #7dd3fc;
  background: rgba(2, 132, 199, 0.14);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.modal-warning-banner,
.modal-error-banner {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  margin-bottom: 10px;
}

.modal-warning-banner {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.25);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.modal-error-banner {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.foc-inline-grid {
  display: grid;
  grid-template-columns: minmax(200px, 0.95fr) minmax(0, 1.35fr);
  gap: 12px;
  min-height: 260px;
}

.foc-config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.foc-inline-code {
  margin: 0;
  min-height: 0;
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #30363d;
  background: #05070a;
  color: #c9d1d9;
  font-size: 11px;
  line-height: 1.55;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre-wrap;
}
</style>
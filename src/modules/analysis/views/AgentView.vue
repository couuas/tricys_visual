<template>
  <div class="agent-view">
    <div class="agent-shell" :class="{ resizing: splitResizeState.active }">
      <section class="topology-pane surface-card" :style="leftPaneStyle">
        <div class="pane-header">
          <div class="topology-header-row">
            <p class="eyebrow">Topology</p>
            <span class="status-chip muted">{{ componentCount }} modules · {{ connectionCount }} links</span>
          </div>
        </div>

        <div class="topology-main">
          <TopologyTwinPanel
            :structure-data="structureData || { components: [], connections: [] }"
            :selected-component-id="selectedComponentId"
            :is-read-only="true"
            :show-controls="false"
            route-mode="orthogonal"
            @select-component="handleSelect"
          />
        </div>

        <div class="focus-strip">
          <div class="focus-card emphasis">
            <span class="focus-label">Selected Module</span>
            <div class="focus-value">{{ selectedComponentLabel }}</div>
            <div class="focus-meta">{{ selectedComponentType }}</div>
            <div class="focus-meta">{{ selectedConnectionSummary }}</div>
          </div>

          <div class="focus-card">
            <span class="focus-label">Module Parameters</span>
            <div v-if="selectedComponentParameters.length > 0" class="param-list">
              <div v-for="param in selectedComponentParameters" :key="param.name" class="param-item">
                <span class="param-name">{{ param.shortName }}</span>
                <span class="param-value">{{ param.valueLabel }}</span>
              </div>
            </div>
            <div v-else class="focus-meta empty-copy">Select a module to inspect its parameters.</div>
          </div>

          <div class="focus-card">
            <span class="focus-label">Related Modules</span>
            <div v-if="relatedModules.length > 0" class="related-list">
              <button
                v-for="module in relatedModules"
                :key="module.id"
                class="related-chip"
                :class="{ active: module.id === selectedComponentId }"
                @click="handleSelect(module.id)"
              >
                <span class="related-chip-main">
                  <span class="related-chip-name">{{ module.label }}</span>
                  <span class="related-chip-type">{{ module.type }}</span>
                </span>
                <span class="related-chip-direction" :class="module.directionClass">{{ module.directionLabel }}</span>
              </button>
            </div>
            <div v-else class="focus-meta empty-copy">Select a module to see directly connected modules.</div>
          </div>
        </div>
      </section>

      <div class="agent-split-resizer" @mousedown="startSplitResize">
        <div class="agent-split-handle"></div>
      </div>

      <section class="workspace-pane surface-card">
        <div class="workspace-tabs-bar">
          <div class="tab-row workspace-tab-row">
            <button class="workspace-tab-btn" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">Manual</button>
            <button class="workspace-tab-btn" :class="{ active: activeTab === 'agent' }" @click="activeTab = 'agent'">Agent</button>
          </div>
          <div class="header-actions workspace-actions">
            <button class="ghost-btn compact-btn" @click="openMonitor" :disabled="!activeTaskId">Open Monitor</button>
          </div>
        </div>

        <div class="workspace-body">
          <div v-if="activeTab === 'manual'" class="workspace-stack manual-workspace">
            <div class="manual-panel-shell">
              <AnalysisConfigPanel
                embedded
                :model-metadata="modelMetadata"
                :navigate-on-submit="true"
                @analysis-started="handleTaskStarted"
              />
            </div>
          </div>

          <div v-else class="workspace-stack agent-workspace">
            <section class="workspace-card composer-card">
              <div class="section-head">
                <h3>Request Brief</h3>
                <span class="mini-status">{{ agentStageLabel }}</span>
              </div>
              <textarea
                v-model="agentInput"
                rows="5"
                class="compose-input"
                placeholder="Describe the analysis you want, including target variables, sweep ranges, stop time, metrics, or optimization target."
              ></textarea>
              <div class="prompt-suggestions">
                <button v-for="suggestion in suggestions" :key="suggestion" class="suggestion-chip" @click="agentInput = suggestion">{{ suggestion }}</button>
              </div>
              <div class="compose-actions">
                <button class="ghost-btn" @click="generateDraft" :disabled="isGenerating || !agentInput.trim()">{{ isGenerating ? 'Generating...' : 'Generate Draft' }}</button>
                <button class="primary-btn" @click="submitAgentDraft" :disabled="!agentDraftPayload || isSubmittingDraft">{{ isSubmittingDraft ? 'Submitting...' : 'Run Draft' }}</button>
              </div>
            </section>

            <section class="workspace-card draft-card">
              <div class="section-head">
                <h3>Draft Config</h3>
                <button class="text-btn" v-if="agentDraftPayload" @click="activeTab = 'manual'">Refine in Manual</button>
              </div>
              <div v-if="agentDraftSummary" class="draft-panel">
                <p class="draft-summary">{{ agentDraftSummary }}</p>
                <pre class="payload-preview">{{ formattedDraftPayload }}</pre>
              </div>
              <div v-else class="empty-state">Generate a draft to inspect the payload before submission.</div>
            </section>

            <section class="workspace-card log-card">
              <div class="section-head">
                <h3>Task Feed</h3>
                <span class="mini-status">{{ activeTaskId || 'No task yet' }}</span>
              </div>
              <div v-if="taskLogs.length > 0" class="log-preview">
                <div v-for="(log, index) in taskLogs.slice(0, 10)" :key="`${activeTaskId}-${index}`" class="log-line">{{ log.content || log }}</div>
              </div>
              <div v-else class="empty-state">Task logs will appear here after submission.</div>
            </section>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AnalysisConfigPanel } from '../../simulation/public';
import TopologyTwinPanel from '../../studio/components/TopologyTwinPanel.vue';
import { useAnalysisWorkspace } from '../composables/useAnalysisWorkspace';
import { taskApi } from '../../../api/task';
import { $notify } from '../../../utils/notification';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const route = useRoute();
const router = useRouter();
const { loadData, componentParams, structureData, modelMetadata } = useAnalysisWorkspace();

const activeTab = ref('manual');
const selectedComponentId = ref(null);
const agentInput = ref('');
const isGenerating = ref(false);
const isSubmittingDraft = ref(false);
const agentDraftPayload = ref(null);
const agentDraftSummary = ref('');
const activeTaskId = ref('');
const activeTaskStatus = ref('IDLE');
const taskLogs = ref([]);
const pollId = ref(null);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const leftPaneWidth = useSessionLayoutValue(
  'tricys:layout:agent:leftPanePercent',
  52,
  (value) => clamp(value, 34, 68)
);
const splitResizeState = reactive({
  active: false,
  startX: 0,
  startWidth: 52,
  containerWidth: 0
});

const agentSteps = ref([
  { key: 'interpret', title: 'Interpret request', state: 'idle' },
  { key: 'draft', title: 'Build config', state: 'idle' },
  { key: 'submit', title: 'Submit task', state: 'idle' },
  { key: 'track', title: 'Track progress', state: 'idle' },
]);

const suggestions = [
  'Sweep blanket.T from 1.0 to 1.5 with five samples and track Startup_Inventory and Doubling_Time.',
  'Run a multi-parameter analysis on blanket.T and plasma.nf, using three sampling points each.',
  'Create a Sobol sensitivity study for blanket.T and plasma.nf with 128 samples.',
  'Optimize Required_TBR by adjusting blanket.TBR between 1.0 and 1.5.',
];

const components = computed(() => Array.isArray(structureData.value?.components) ? structureData.value.components : []);
const connections = computed(() => Array.isArray(structureData.value?.connections) ? structureData.value.connections : []);
const componentCount = computed(() => components.value.length);
const connectionCount = computed(() => connections.value.length);
const selectedComponent = computed(() => components.value.find((component) => String(component.id || component.name || '').toLowerCase() === String(selectedComponentId.value || '').toLowerCase()) || null);
const selectedComponentLabel = computed(() => selectedComponent.value?.id || selectedComponent.value?.name || selectedComponentId.value || 'No module selected');
const selectedComponentType = computed(() => selectedComponent.value?.type || selectedComponent.value?.class || 'Module');
const selectedConnectionSummary = computed(() => {
  if (!selectedComponentId.value) return 'Select a module on the left to inspect its neighborhood.';
  const selected = String(selectedComponentId.value).toLowerCase();
  const related = connections.value.filter((connection) => {
    const from = String(connection.from || connection.source || connection.start || '').toLowerCase();
    const to = String(connection.to || connection.target || connection.end || '').toLowerCase();
    return from === selected || to === selected;
  });
  return `${related.length} related link${related.length === 1 ? '' : 's'} in simplified topology.`;
});
const selectedComponentParameters = computed(() => {
  if (!selectedComponentId.value) return [];
  const selected = String(selectedComponentId.value).toLowerCase();
  return (componentParams.value || [])
    .filter((param) => String(param.name || '').split('.')[0].toLowerCase() === selected)
    .map((param) => ({
      ...param,
      shortName: String(param.name || '').split('.').slice(1).join('.') || param.name,
      valueLabel: param.value ?? param.defaultValue ?? '--',
    }))
    .slice(0, 12);
});
const relatedModules = computed(() => {
  if (!selectedComponentId.value) return [];
  const selected = String(selectedComponentId.value).toLowerCase();
  const relatedMap = new Map();

  connections.value.forEach((connection) => {
    const from = String(connection.from || connection.source || connection.start || '').toLowerCase();
    const to = String(connection.to || connection.target || connection.end || '').toLowerCase();
    if (from === selected && to) {
      const entry = relatedMap.get(to) || { incoming: false, outgoing: false };
      entry.outgoing = true;
      relatedMap.set(to, entry);
    }
    if (to === selected && from) {
      const entry = relatedMap.get(from) || { incoming: false, outgoing: false };
      entry.incoming = true;
      relatedMap.set(from, entry);
    }
  });

  return Array.from(relatedMap.entries())
    .map(([relatedId, relation]) => {
      const matched = components.value.find((component) => String(component.id || component.name || '').toLowerCase() === relatedId);
      const directionLabel = relation.incoming && relation.outgoing
        ? 'From / To'
        : relation.incoming
          ? 'From'
          : 'To';
      return {
        id: relatedId,
        label: matched?.id || matched?.name || relatedId,
        type: matched?.type || matched?.class || 'Module',
        directionLabel,
        directionClass: relation.incoming && relation.outgoing
          ? 'bidirectional'
          : relation.incoming
            ? 'incoming'
            : 'outgoing',
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
});

const leftPaneStyle = computed(() => ({
  flexBasis: `${leftPaneWidth.value}%`
}));

const formattedDraftPayload = computed(() => agentDraftPayload.value ? JSON.stringify(agentDraftPayload.value, null, 2) : '');
const agentStageLabel = computed(() => {
  const inProgress = agentSteps.value.find((step) => step.state === 'active');
  if (inProgress) return inProgress.title;
  const failed = agentSteps.value.find((step) => step.state === 'failed');
  if (failed) return 'Failed';
  return agentSteps.value.every((step) => step.state === 'done') ? 'Completed' : 'Waiting';
});

function handleSelect(componentId) {
  selectedComponentId.value = componentId;
}

function stopSplitResize() {
  if (!splitResizeState.active) return;
  splitResizeState.active = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', handleSplitResize);
  window.removeEventListener('mouseup', stopSplitResize);
}

function handleSplitResize(event) {
  if (!splitResizeState.active || !splitResizeState.containerWidth) return;
  const deltaPercent = ((event.clientX - splitResizeState.startX) / splitResizeState.containerWidth) * 100;
  leftPaneWidth.value = clamp(splitResizeState.startWidth + deltaPercent, 34, 68);
}

function startSplitResize(event) {
  const shell = event.currentTarget.closest('.agent-shell');
  if (!shell) return;

  event.preventDefault();
  splitResizeState.active = true;
  splitResizeState.startX = event.clientX;
  splitResizeState.startWidth = leftPaneWidth.value;
  splitResizeState.containerWidth = shell.getBoundingClientRect().width;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', handleSplitResize);
  window.addEventListener('mouseup', stopSplitResize);
}

function resetAgentSteps() {
  agentSteps.value = agentSteps.value.map((step) => ({ ...step, state: 'idle' }));
}

function setAgentStep(key, state) {
  agentSteps.value = agentSteps.value.map((step) => (step.key === key ? { ...step, state } : step));
}

function parseRequestedMetrics(prompt) {
  const metrics = [];
  const lower = prompt.toLowerCase();
  if (lower.includes('startup')) metrics.push('Startup_Inventory');
  if (lower.includes('doubling')) metrics.push('Doubling_Time');
  if (lower.includes('self sufficiency') || lower.includes('turning point')) metrics.push('Self_Sufficiency_Time');
  if (lower.includes('tbr') || lower.includes('required_tbr')) metrics.push('Required_TBR');
  return metrics.length > 0 ? metrics : ['Startup_Inventory', 'Doubling_Time'];
}

function detectTemplate(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes('sobol') || lower.includes('global sensitivity')) return 'sobol';
  if (lower.includes('latin') || lower.includes('lhs') || lower.includes('uncertainty')) return 'latin';
  if (lower.includes('optimiz') || lower.includes('bisection') || lower.includes('target')) return 'bisection';
  if (lower.includes('multi') || lower.includes('combination') || lower.includes('同时')) return 'multi_param';
  return 'single_param';
}

function findMentionedParameters(prompt) {
  const lower = prompt.toLowerCase();
  const allParams = (componentParams.value || []).map((param) => param.name);
  const exactMatches = allParams.filter((param) => lower.includes(param.toLowerCase()));
  if (exactMatches.length > 0) return exactMatches;

  const fuzzyMatches = allParams.filter((param) => {
    const shortName = String(param).split('.').slice(-1)[0].toLowerCase();
    return shortName.length > 1 && lower.includes(shortName);
  });
  return fuzzyMatches.slice(0, 2);
}

function detectStopTime(prompt) {
  const match = prompt.match(/(stop time|stoptime|仿真时长|时长)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[2]) : 12000;
}

function detectStepSize(prompt) {
  const match = prompt.match(/(step size|stepsize|步长)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[2]) : 0.5;
}

function buildMetricsDefinition(metrics) {
  const catalog = {
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
  };

  return metrics.reduce((acc, key) => {
    if (catalog[key]) acc[key] = catalog[key];
    return acc;
  }, {});
}

function buildAgentDraft(prompt) {
  const template = detectTemplate(prompt);
  const metrics = parseRequestedMetrics(prompt);
  const params = findMentionedParameters(prompt);
  const stopTime = detectStopTime(prompt);
  const stepSize = detectStepSize(prompt);
  const primaryParam = params[0] || 'blanket.T';
  const secondaryParam = params[1] || 'plasma.nf';

  const payload = {
    type: 'ANALYSIS',
    name: `${template.toUpperCase()}_Agent_Run`,
    project_id: route.query.projectId,
    config_json: {
      paths: { package_path: modelMetadata.value.packagePath || null },
      simulation: {
        model_name: modelMetadata.value.modelName,
        stop_time: stopTime,
        step_size: stepSize,
        variableFilter: 'time|sds.I[1]',
      },
    },
  };

  if (template === 'single_param') {
    payload.config_json.sensitivity_analysis = {
      enabled: true,
      metrics_definition: buildMetricsDefinition(metrics),
      analysis_cases: [{
        name: payload.name,
        independent_variable: primaryParam,
        independent_variable_sampling: 'linspace:1:1.5:5',
        dependent_variables: metrics,
        sweep_time: ['sds.I[1]'],
        plot_type: 'line',
        combine_plots: true,
      }],
    };
  } else if (template === 'multi_param') {
    payload.config_json.sensitivity_analysis = {
      enabled: true,
      metrics_definition: buildMetricsDefinition(metrics),
      analysis_cases: [{
        name: payload.name,
        independent_variable: primaryParam,
        independent_variable_sampling: 'linspace:1:1.5:4',
        simulation_parameters: {
          [secondaryParam]: 'linspace:0.2:0.8:3',
        },
        dependent_variables: metrics,
        sweep_time: ['sds.I[1]'],
        plot_type: 'line',
        combine_plots: true,
      }],
    };
  } else if (template === 'sobol' || template === 'latin') {
    payload.config_json.sensitivity_analysis = {
      method: template,
      parameters: [
        { name: primaryParam, bounds: [1, 1.5], distribution: 'uniform' },
        { name: secondaryParam, bounds: [0.2, 0.8], distribution: 'uniform' },
      ],
      N: 128,
      conf_level: 0.95,
      metrics_definition: buildMetricsDefinition(metrics),
    };
  } else {
    payload.config_json.optimization = {
      method: 'bisection',
      target_variable: metrics.includes('Required_TBR') ? 'Required_TBR' : metrics[0],
      target_value: 1000,
      parameter: primaryParam,
      bounds: [1, 1.5],
      tol: 0.005,
      max_iter: 10,
    };
  }

  return {
    payload,
    summary: `Detected ${template} analysis for ${params.length > 0 ? params.join(', ') : primaryParam}, with metrics ${metrics.join(', ')}. Stop time ${stopTime}, step size ${stepSize}.`,
  };
}

async function generateDraft() {
  const prompt = agentInput.value.trim();
  if (!prompt) return;

  resetAgentSteps();
  isGenerating.value = true;
  setAgentStep('interpret', 'active');

  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const draft = buildAgentDraft(prompt);
    setAgentStep('interpret', 'done');
    setAgentStep('draft', 'active');
    await new Promise((resolve) => setTimeout(resolve, 250));
    agentDraftPayload.value = draft.payload;
    agentDraftSummary.value = draft.summary;
    setAgentStep('draft', 'done');
  } catch (error) {
    setAgentStep('interpret', 'failed');
    $notify({ title: 'DRAFT GENERATION FAILED', message: error.message, type: 'error' });
  } finally {
    isGenerating.value = false;
  }
}

async function submitAgentDraft() {
  if (!agentDraftPayload.value) return;

  isSubmittingDraft.value = true;
  setAgentStep('submit', 'active');
  try {
    const response = await taskApi.createTask(agentDraftPayload.value);
    handleTaskStarted(response);
    setAgentStep('submit', 'done');
    setAgentStep('track', 'active');
  } catch (error) {
    setAgentStep('submit', 'failed');
    $notify({ title: 'AGENT SUBMISSION FAILED', message: error.response?.data?.detail || error.message, type: 'error' });
  } finally {
    isSubmittingDraft.value = false;
  }
}

async function refreshTaskState() {
  if (!activeTaskId.value) return;
  try {
    const task = await taskApi.getTask(activeTaskId.value);
    activeTaskStatus.value = task.status || 'UNKNOWN';
    const logs = await taskApi.getLogs(activeTaskId.value);
    taskLogs.value = Array.isArray(logs?.logs) ? logs.logs.slice(-20).reverse() : [];

    if (['COMPLETED', 'FAILED', 'STOPPED'].includes(activeTaskStatus.value)) {
      setAgentStep('track', activeTaskStatus.value === 'COMPLETED' ? 'done' : 'failed');
      stopPolling();
    }
  } catch {
    stopPolling();
    setAgentStep('track', 'failed');
  }
}

function stopPolling() {
  if (pollId.value) {
    window.clearInterval(pollId.value);
    pollId.value = null;
  }
}

function startPolling() {
  stopPolling();
  refreshTaskState();
  pollId.value = window.setInterval(refreshTaskState, 2500);
}

function handleTaskStarted(response) {
  activeTaskId.value = response.id;
  activeTaskStatus.value = response.status || 'PENDING';
  setAgentStep('track', 'active');
  startPolling();
}

function openMonitor() {
  if (!activeTaskId.value) return;
  router.push({ name: 'monitor', query: { projectId: route.query.projectId, taskId: activeTaskId.value } });
}

onMounted(async () => {
  if (route.query.projectId) {
    await loadData(route.query.projectId);
  }
  if (!selectedComponentId.value && components.value.length > 0) {
    selectedComponentId.value = String(components.value[0].id || components.value[0].name || '');
  }
});

onUnmounted(() => {
  stopPolling();
  stopSplitResize();
});
</script>

<style scoped>
.agent-view {
  height: 100%;
  min-height: 0;
  padding: 18px;
  box-sizing: border-box;
  overflow: auto;
  background:
    radial-gradient(circle at top left, rgba(53, 200, 255, 0.08), transparent 25%),
    radial-gradient(circle at bottom right, rgba(255, 145, 82, 0.08), transparent 28%),
    #05080c;
}

.agent-shell {
  min-height: 100%;
  display: flex;
  gap: 0;
  align-items: stretch;
  overflow: hidden;
}

.agent-shell.resizing,
.agent-shell.resizing * {
  cursor: col-resize !important;
  user-select: none;
}

.surface-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 12, 17, 0.94);
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.topology-pane,
.workspace-pane {
  padding: 18px;
  gap: 16px;
}

.topology-pane {
  flex: 0 0 auto;
  min-width: 320px;
}

.workspace-pane {
  flex: 1 1 auto;
  min-width: 360px;
}

.workspace-pane {
  padding: 0;
  gap: 0;
}

.agent-split-resizer {
  flex: 0 0 8px;
  width: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  position: relative;
  z-index: 10;
}

.agent-split-resizer::before {
  content: '';
  position: absolute;
  inset: 0 2px;
  border-radius: 999px;
  background: rgba(8, 12, 18, 0.78);
}

.agent-split-handle {
  position: relative;
  z-index: 1;
  width: 2px;
  height: 54px;
  border-radius: 999px;
  background: rgba(116, 139, 160, 0.52);
}

.agent-split-resizer:hover::before,
.agent-split-resizer:active::before {
  background: rgba(0, 210, 255, 0.12);
}

.agent-split-resizer:hover .agent-split-handle,
.agent-split-resizer:active .agent-split-handle {
  background: #00d2ff;
}

.pane-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.topology-header-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #6d7c89;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.workspace-tabs-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 14px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
}

.workspace-actions {
  padding-bottom: 10px;
}

.status-chip,
.mini-status {
  display: inline-flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: #d5e1ea;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-chip.muted {
  color: #9aacb9;
}

.topology-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 18px;
}

.focus-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.focus-card,
.workspace-card,
.composer-card,
.manual-panel-shell {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
}

.focus-card {
  padding: 14px;
  min-height: 138px;
}

.focus-card.emphasis {
  background: linear-gradient(180deg, rgba(53, 200, 255, 0.1), rgba(255, 255, 255, 0.03));
}

.focus-label {
  display: block;
  margin-bottom: 6px;
  color: #7e90a1;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.focus-value {
  color: #edf4f8;
  font-size: 14px;
  font-weight: 700;
}

.focus-meta,
.draft-summary,
.log-line,
.empty-state {
  color: #8fa1b0;
  font-size: 12px;
  line-height: 1.55;
}

.param-list,
.related-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.param-list {
  max-height: 180px;
  overflow: auto;
}

.param-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.param-name {
  color: #d7e4ec;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.param-value {
  color: #8ad2ff;
  font-size: 12px;
  font-weight: 600;
}

.related-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #dce7ef;
  cursor: pointer;
  text-align: left;
}

.related-chip.active,
.related-chip:hover {
  border-color: rgba(53, 200, 255, 0.32);
  background: rgba(53, 200, 255, 0.09);
}

.related-chip-name {
  font-size: 12px;
  font-weight: 600;
}

.related-chip-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.related-chip-type {
  color: #90a3b2;
  font-size: 11px;
}

.related-chip-direction {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 62px;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.related-chip-direction.incoming {
  border-color: rgba(255, 145, 82, 0.22);
  color: #ffbd92;
  background: rgba(255, 145, 82, 0.08);
}

.related-chip-direction.outgoing {
  border-color: rgba(53, 200, 255, 0.22);
  color: #8adfff;
  background: rgba(53, 200, 255, 0.08);
}

.related-chip-direction.bidirectional {
  border-color: rgba(166, 192, 214, 0.22);
  color: #dfeaf2;
  background: rgba(255, 255, 255, 0.06);
}

.empty-copy {
  display: flex;
  align-items: center;
  min-height: 92px;
}

.tab-row {
  display: flex;
  gap: 10px;
}

.workspace-tab-row {
  gap: 4px;
  flex-wrap: wrap;
}

.workspace-tab-btn {
  position: relative;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: #7e90a0;
  padding: 12px 16px 11px;
  border-radius: 14px 14px 0 0;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: color 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.workspace-tab-btn:hover {
  color: #d8e5ee;
  background: rgba(255, 255, 255, 0.03);
}

.workspace-tab-btn.active {
  color: #f5fbff;
  border-color: rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(53, 200, 255, 0.16), rgba(9, 14, 20, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.workspace-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}

.workspace-stack {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.manual-workspace {
  overflow: hidden;
}

.manual-panel-shell {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.agent-workspace {
  overflow: auto;
  padding-right: 2px;
}

.composer-card,
.workspace-card {
  padding: 14px;
}

.compact-btn {
  padding: 8px 12px;
  font-size: 11px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-head h3 {
  margin: 0;
  color: #edf5fa;
  font-size: 15px;
}

.compose-input {
  width: 100%;
  min-height: 110px;
  box-sizing: border-box;
  resize: vertical;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(5, 9, 13, 0.88);
  color: #e6eef5;
}

.prompt-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.suggestion-chip,
.ghost-btn,
.primary-btn,
.text-btn {
  border-radius: 12px;
  cursor: pointer;
}

.suggestion-chip {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: #a7b6c2;
  font-size: 11px;
}

.compose-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.ghost-btn,
.primary-btn,
.text-btn {
  padding: 10px 14px;
}

.ghost-btn {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #cad5df;
}

.primary-btn {
  border: 1px solid rgba(53, 200, 255, 0.28);
  background: linear-gradient(135deg, rgba(53, 200, 255, 0.92), rgba(255, 145, 82, 0.9));
  color: #05121c;
  font-weight: 700;
}

.ghost-btn:disabled,
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.draft-card,
.log-card {
  min-height: 0;
}

.draft-panel,
.log-preview {
  min-height: 0;
  overflow: auto;
}

.payload-preview {
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(5, 8, 12, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #d5e4ee;
  font-size: 11px;
  overflow: auto;
}

.log-preview {
  flex: 1;
  min-height: 140px;
}

.log-line {
  margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre-wrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  text-align: center;
}

.text-btn {
  border: none;
  background: transparent;
  color: #5dbdff;
}

@media (max-width: 1100px) {
  .agent-view {
    padding: 14px;
  }

  .surface-card {
    border-radius: 20px;
  }

  .topology-pane {
    padding: 16px;
  }

  .focus-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace-body {
    padding: 12px;
  }
}

@media (max-width: 1320px) {
  .agent-shell {
    flex-direction: column;
    overflow: visible;
  }

  .topology-pane,
  .workspace-pane {
    flex: 0 0 auto !important;
    min-width: 0;
  }

  .agent-split-resizer {
    display: none;
  }

  .focus-strip {
    grid-template-columns: 1fr;
  }

  .pane-header {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-tabs-bar {
    flex-direction: column;
    align-items: stretch;
    padding-top: 12px;
  }

  .header-actions,
  .workspace-tab-row {
    justify-content: flex-start;
    align-items: flex-start;
  }
}

@media (max-width: 900px) {
  .agent-view {
    padding: 12px;
  }

  .topology-pane {
    padding: 14px;
  }

  .focus-strip {
    grid-template-columns: 1fr;
  }

  .workspace-tabs-bar {
    gap: 10px;
    padding: 12px 12px 0;
  }

  .topology-header-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .workspace-body {
    padding: 12px;
  }

  .workspace-stack {
    gap: 12px;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .compose-actions {
    justify-content: stretch;
  }

  .compose-actions .ghost-btn,
  .compose-actions .primary-btn {
    flex: 1 1 180px;
  }

  .param-item,
  .related-chip {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .agent-view {
    padding: 10px;
  }

  .surface-card {
    border-radius: 16px;
  }

  .topology-pane {
    padding: 12px;
    gap: 12px;
  }

  .workspace-tabs-bar {
    padding: 10px 10px 0;
  }

  .workspace-body {
    padding: 10px;
  }

  .workspace-tab-btn {
    flex: 1 1 auto;
    text-align: center;
    padding: 11px 12px 10px;
  }

  .workspace-tab-row {
    width: 100%;
  }

  .workspace-actions {
    padding-bottom: 8px;
  }

  .status-chip,
  .mini-status {
    width: 100%;
  }

  .focus-card,
  .workspace-card,
  .composer-card {
    padding: 12px;
    border-radius: 14px;
  }

  .compose-input,
  .payload-preview,
  .log-preview {
    min-height: 120px;
  }

  .suggestion-chip,
  .ghost-btn,
  .primary-btn,
  .text-btn,
  .compact-btn {
    width: 100%;
    justify-content: center;
    text-align: center;
  }

  .compose-actions {
    flex-direction: column;
  }
}
</style>
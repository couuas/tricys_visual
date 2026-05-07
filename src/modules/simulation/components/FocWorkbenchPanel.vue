<template>
  <section class="foc-panel-shell">
    <div class="foc-panel-header">
      <div>
        <div class="panel-title-row">
          <h3 class="panel-title">FOC Workbench</h3>
          <button
            type="button"
            class="help-icon-btn"
            aria-label="Open FOC syntax guide"
            @click="openRuleDialog"
          >
            ?
          </button>
        </div>
        <p class="panel-subtitle">Task-scoped operation config editor and timeline preview</p>
      </div>
      <div class="panel-actions">
        <div class="foc-enable-group">
          <label class="toggle-row" :class="{ disabled: !hasValidComponentSelection }">
            <input
              :checked="focState.enabled"
              :disabled="!hasValidComponentSelection"
              type="checkbox"
              @change="handleEnabledChange"
            />
            <span>Enable FOC</span>
          </label>
          <select
            :value="componentSelectionMode"
            class="component-select"
            @change="handleComponentSelectChange"
          >
            <option value="" disabled>{{ componentSelectPlaceholder }}</option>
            <option v-for="option in focComponentOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
            <option :value="CUSTOM_COMPONENT_VALUE">{{ customOptionLabel }}</option>
          </select>
          <input
            v-if="showCustomComponentInput"
            :value="focState.component"
            class="component-custom-input"
            placeholder="Custom foc_component"
            @input="handleCustomComponentInput"
          />
        </div>
        <template v-if="focState.enabled">
          <label class="upload-btn">
            <span>Upload .foc</span>
            <input type="file" accept=".foc,text/plain" hidden @change="handleFileUpload" />
          </label>
          <button class="action-btn ghost" :disabled="!defaultPulseSource" @click="insertPulseTemplate">
            From Default Pulse
          </button>
          <button class="action-btn" @click="previewNow(stopTime)">Parse</button>
          <button class="action-btn ghost" @click="loadExample">Example</button>
          <button class="action-btn ghost" @click="clearDraft">Clear</button>
        </template>
      </div>
    </div>

    <div v-if="focState.enabled" class="foc-grid">
      <div class="editor-pane">
        <div class="pane-header">
          <span>Editor</span>
          <span class="source-name">{{ activeSourceLabel }}</span>
        </div>

        <textarea
          :value="focState.content"
          class="editor-textarea"
          placeholder="# Write FOC rules here&#10;PULSE 1500 400 100 5&#10;DWELL 3600"
          @input="handleEditorInput"
        ></textarea>
      </div>

      <div class="preview-pane">
        <div class="pane-header preview-pane-header">
          <span>Preview</span>
          <div class="preview-header-meta">
            <div class="summary-inline-strip">
              <span class="summary-inline-item"><span class="summary-inline-label">Duration</span><span class="summary-inline-value">{{ scheduleDurationLabel }}</span></span>
              <span class="summary-inline-item"><span class="summary-inline-label">Steps</span><span class="summary-inline-value">{{ stepCountLabel }}</span></span>
              <span class="summary-inline-item"><span class="summary-inline-label">Rows</span><span class="summary-inline-value">{{ rowCountLabel }}</span></span>
            </div>
            <span v-if="focState.lastParsedAt" class="preview-status">updated</span>
          </div>
        </div>

        <div v-if="focState.error" class="error-card">
          <div class="error-title">Parse Error</div>
          <div class="error-body">{{ focState.error }}</div>
        </div>

        <div v-else class="chart-shell">
          <FocTimelineChart :rows="previewRows" :loading="focState.isPreviewLoading" />
        </div>
      </div>
    </div>
  </section>

  <div
    v-if="showRuleDialog"
    class="rule-dialog-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="FOC syntax guide"
    @click.self="closeRuleDialog"
  >
    <div class="rule-dialog-panel">
      <div class="rule-dialog-header">
        <div>
          <div class="rule-dialog-eyebrow">FOC Syntax Guide</div>
          <h4 class="rule-dialog-title">Fusion Operation Config quick reference</h4>
        </div>
        <button type="button" class="rule-dialog-close" aria-label="Close FOC syntax guide" @click="closeRuleDialog">
          ×
        </button>
      </div>

      <div class="rule-dialog-body">
        <section class="rule-card">
          <div class="rule-card-title">Header</div>
          <pre class="rule-code">TIME_UNIT &lt;second|hour|day|week|year&gt;
TIME_CONVERSION NONE
TIME_CONVERSION 3600
TIME_CONVERSION hour_to_second
TIME_CONVERSION second_to_hour</pre>
          <p class="rule-copy">
            Header directives must appear before POWER, BURN, DWELL, PULSE, BEGIN_SCHEDULE, and REPEAT. TIME_UNIT only declares the unit; conversion happens only when TIME_CONVERSION is present.
          </p>
        </section>

        <section class="rule-card">
          <div class="rule-card-title">Commands</div>
          <pre class="rule-code">POWER &lt;mw&gt;
BURN &lt;time&gt;
DWELL &lt;time&gt;
PULSE &lt;power&gt; &lt;burn_time&gt; &lt;dwell_time&gt; &lt;cycles&gt;
BEGIN_SCHEDULE
  ...
END_SCHEDULE
REPEAT &lt;n&gt;</pre>
          <p class="rule-copy">
            Without any header directives, FOC time defaults to seconds and no conversion is applied. Time values are converted only when TIME_CONVERSION is declared.
          </p>
        </section>

        <section class="rule-card rule-card-wide">
          <div class="rule-card-title">Examples</div>
          <pre class="rule-code"># Write FOC in hours, convert explicitly to model default seconds
TIME_UNIT hour
TIME_CONVERSION hour_to_second
PULSE 1500 0.9 0.1 5
DWELL 12

# Write FOC in hours, declare unit only without conversion
TIME_UNIT hour
PULSE 1500 0.9 0.1 5

# Write FOC in seconds, convert to model hours
TIME_CONVERSION second_to_hour
PULSE 1500 7200 3600 1

BEGIN_SCHEDULE
  PULSE 2000 0.5 0.25 2
  POWER 1000
  BURN 8
  DWELL 4
END_SCHEDULE
REPEAT 2</pre>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import FocTimelineChart from './FocTimelineChart.vue';
import { useFocDraft } from '../composables/useFocDraft';
import { projectApi } from '../../../api/project';

const CUSTOM_COMPONENT_VALUE = '__custom__';

const props = defineProps({
  projectId: {
    type: String,
    default: ''
  },
  modelName: {
    type: String,
    default: ''
  },
  stopTime: {
    type: Number,
    default: null
  }
});

const {
  focState,
  setProjectScope,
  setEnabled,
  setComponent,
  setContent,
  setSourceName,
  clearDraft,
  loadFromFile,
  previewNow,
  schedulePreview
} = useFocDraft();

const defaultPulseSource = ref('');
const defaultPulseError = ref('');
const showRuleDialog = ref(false);
const focComponentOptions = ref([]);
const componentSelectionMode = ref('');
const modelLeafName = computed(() => {
  return (props.modelName || 'Cycle').split('.').pop() || 'Cycle';
});

const scheduleDurationLabel = computed(() => {
  if (!focState.value.preview?.schedule_duration) {
    return '--';
  }
  return `${focState.value.preview.schedule_duration.toFixed(2)} s`;
});

const stepCountLabel = computed(() => focState.value.preview?.step_count ?? '--');
const rowCountLabel = computed(() => focState.value.preview?.rows?.length ?? '--');
const previewRows = computed(() => focState.value.preview?.rows ?? []);
const activeSourceLabel = computed(() => {
  return focState.value.sourceName || focState.value.path || 'task_input.foc';
});
const showCustomComponentInput = computed(() => componentSelectionMode.value === CUSTOM_COMPONENT_VALUE);
const componentSelectPlaceholder = computed(() =>
  focComponentOptions.value.length ? 'Select foc_component' : '无识别组件，自定义选择'
);
const customOptionLabel = computed(() =>
  focComponentOptions.value.length ? 'Custom...' : '无识别组件，自定义选择'
);
const hasValidComponentSelection = computed(() => {
  const component = String(focState.value.component || '').trim();
  if (!component) {
    return false;
  }
  if (showCustomComponentInput.value) {
    return true;
  }
  return focComponentOptions.value.some((option) => option.value === component);
});

function extractDefaultPulseSource(sourceCode) {
  if (!sourceCode) {
    return '';
  }

  const pulsePattern = /(Modelica\.Blocks\.Sources\.Pulse|FOC_TablePulse|FOC_ArrayPulse)\s+pulseSource\s*\([\s\S]*?\)\s*annotation\s*\([\s\S]*?\);/m;
  const match = sourceCode.match(pulsePattern);
  if (match) {
    return match[0].trim();
  }

  return '';
}

function extractDeclaredComponents(sourceCode, modelName) {
  if (!sourceCode) {
    return [];
  }

  const modelLeaf = (modelName || 'Cycle').split('.').pop() || 'Cycle';
  const modelPattern = new RegExp(`(?:model|block)\\s+${modelLeaf}\\b([\\s\\S]*?)end\\s+${modelLeaf}\\s*;`, 'm');
  const blockMatch = sourceCode.match(modelPattern);
  const targetBlock = blockMatch?.[1] || sourceCode;
  const declarationPattern = /(^|\n)\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+([A-Za-z_]\w*)\s*(?:\([\s\S]*?\))?\s*(?:annotation\s*\([\s\S]*?\))?\s*;/gm;
  const candidates = [];
  const seen = new Set();

  for (const match of targetBlock.matchAll(declarationPattern)) {
    const typeName = match[2];
    const instanceName = match[3];
    if (instanceName && !seen.has(instanceName)) {
      seen.add(instanceName);
      candidates.push({
        value: instanceName,
        label: instanceName,
        description: typeName ? `${typeName} in ${modelLeaf}` : modelLeaf,
        pulseLike:
          String(typeName || '').toLowerCase().includes('pulse') ||
          String(instanceName || '').toLowerCase().includes('pulse')
      });
    }
  }

  return candidates;
}

function applyResolvedComponentOptions(declaredComponents) {
  const pulseLikeComponents = declaredComponents.filter((component) => component.pulseLike);
  const currentSelection = String(focState.value.component || '').trim();

  if (pulseLikeComponents.length === 1) {
    focComponentOptions.value = pulseLikeComponents;
    componentSelectionMode.value = pulseLikeComponents[0].value;
    setComponent(pulseLikeComponents[0].value);
    return;
  }

  if (pulseLikeComponents.length > 1) {
    focComponentOptions.value = pulseLikeComponents;
    if (pulseLikeComponents.some((component) => component.value === currentSelection)) {
      componentSelectionMode.value = currentSelection;
    } else {
      componentSelectionMode.value = '';
      setComponent('');
    }
    return;
  }

  focComponentOptions.value = [];
  componentSelectionMode.value = CUSTOM_COMPONENT_VALUE;
  if (!currentSelection) {
    setComponent('');
    return;
  }

  if (!declaredComponents.some((component) => component.value === currentSelection)) {
    setComponent('');
  }
}

function parsePulseDeclarationDefaults(sourceCode) {
  if (!sourceCode) {
    return null;
  }

  const amplitudeMatch = sourceCode.match(/amplitude\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
  const periodMatch = sourceCode.match(/period\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
  const widthMatch = sourceCode.match(/width\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);

  if (!amplitudeMatch || !periodMatch || !widthMatch) {
    return null;
  }

  const amplitude = Number(amplitudeMatch[1]);
  const period = Number(periodMatch[1]);
  const widthPercent = Number(widthMatch[1]);
  if ([amplitude, period, widthPercent].some((value) => Number.isNaN(value))) {
    return null;
  }

  const burnTime = Number((period * widthPercent / 100).toFixed(6));
  const dwellTime = Number(Math.max(period - burnTime, 0).toFixed(6));
  return { amplitude, period, widthPercent, burnTime, dwellTime };
}

async function loadDefaultPulseSource() {
  if (!props.projectId || !modelLeafName.value) {
    defaultPulseSource.value = '';
    defaultPulseError.value = '';
    return;
  }

  try {
    const response = await projectApi.getComponentSource(props.projectId, modelLeafName.value);
    const sourceCode = response?.code || '';
    const snippet = extractDefaultPulseSource(sourceCode);
    applyResolvedComponentOptions(extractDeclaredComponents(sourceCode, props.modelName));
    if (!snippet) {
      defaultPulseSource.value = '';
      defaultPulseError.value = 'Default pulseSource instance was not found in the original model source.';
      return;
    }
    defaultPulseSource.value = snippet;
    defaultPulseError.value = '';
  } catch (error) {
    defaultPulseSource.value = '';
    focComponentOptions.value = [];
    componentSelectionMode.value = CUSTOM_COMPONENT_VALUE;
    setComponent('');
    defaultPulseError.value = error?.response?.data?.detail || 'Failed to load original model source.';
  }
}

function insertPulseTemplate() {
  setEnabled(true);
  setSourceName('task_input.foc');

  const defaults = parsePulseDeclarationDefaults(defaultPulseSource.value);
  const lines = [
    '# FOC starter generated from the original pulseSource declaration',
    '# Original declaration:',
    ...String(defaultPulseSource.value || '').split('\n').map((line) => `# ${line}`),
    ''
  ];

  if (defaults) {
    lines.push(`# period = ${defaults.period}s, width = ${defaults.widthPercent}%`);
    lines.push(`# derived burn = ${defaults.burnTime}s, dwell = ${defaults.dwellTime}s`);
    lines.push(`PULSE ${defaults.amplitude} ${defaults.burnTime} ${defaults.dwellTime} 1`);
  } else {
    lines.push('# Could not fully derive amplitude/period/width from the source.');
    lines.push('POWER 1000');
    lines.push('BURN 100');
    lines.push('DWELL 100');
  }

  setContent(lines.join('\n'));
  schedulePreview(props.stopTime, 50);
}

function openRuleDialog() {
  showRuleDialog.value = true;
}

function closeRuleDialog() {
  showRuleDialog.value = false;
}

function handleEnabledChange(event) {
  if (event.target.checked && !hasValidComponentSelection.value) {
    event.target.checked = false;
    return;
  }
  setEnabled(event.target.checked);
  if (event.target.checked) {
    schedulePreview(props.stopTime, 50);
  }
}

function handleComponentSelectChange(event) {
  const nextValue = event.target.value;
  componentSelectionMode.value = nextValue;

  if (nextValue === CUSTOM_COMPONENT_VALUE) {
    if (focComponentOptions.value.some((option) => option.value === focState.value.component)) {
      setComponent('');
    }
    return;
  }

  setComponent(nextValue);
}

function handleCustomComponentInput(event) {
  if (componentSelectionMode.value !== CUSTOM_COMPONENT_VALUE) {
    componentSelectionMode.value = CUSTOM_COMPONENT_VALUE;
  }
  setComponent(event.target.value);
}

function handleEditorInput(event) {
  setContent(event.target.value);
  schedulePreview(props.stopTime);
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  await loadFromFile(file);
  await previewNow(props.stopTime);
  event.target.value = '';
}

function loadExample() {
  setEnabled(true);
  setSourceName('task_input.foc');
  setContent([
    '# Mixed operating scenario',
    'TIME_UNIT hour',
    '',
    '# First, a short pulse cycle (power 1500 MW, burn 0.9 h, dwell 0.1 h, 600 cycles)',
    'PULSE 1500 0.9 0.1 300',
    '',
    '# Long shutdown for 100 h',
    'DWELL 100',
    '',
    '# Then execute a schedule block (mixed long and short operations)',
    'BEGIN_SCHEDULE',
    '  PULSE 2000 0.9 0.1 100',
    '  POWER 1000',
    '  BURN 200',
    '  DWELL 100',
    'END_SCHEDULE',
    'REPEAT 2'
  ].join('\n'));
  schedulePreview(props.stopTime, 50);
}

watch(
  () => props.projectId,
  (projectId) => {
    setProjectScope(projectId || 'default');
    loadDefaultPulseSource();
    if (focState.value.enabled && focState.value.content.trim()) {
      schedulePreview(props.stopTime, 50);
    }
  },
  { immediate: true }
);

watch(
  () => props.modelName,
  () => {
    loadDefaultPulseSource();
  },
  { immediate: true }
);

watch(
  () => props.stopTime,
  () => {
    if (focState.value.enabled && focState.value.content.trim()) {
      schedulePreview(props.stopTime, 50);
    }
  }
);
</script>

<style scoped>
.foc-panel-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.96), rgba(7, 11, 16, 0.98));
  border: 1px solid #1f2937;
  border-radius: 10px;
  overflow: hidden;
}

.foc-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-title {
  margin: 0;
  font-size: 14px;
  color: #e5e7eb;
  letter-spacing: 0.4px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.help-icon-btn {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(34, 211, 238, 0.5);
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.12);
  color: #67e8f9;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.help-icon-btn:hover {
  background: rgba(34, 211, 238, 0.2);
  border-color: rgba(34, 211, 238, 0.8);
}

.panel-subtitle {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9ca3af;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 12px;
}

.toggle-row.disabled {
  opacity: 0.55;
}

.toggle-row.compact {
  margin-bottom: 0;
}

.component-select,
.strategy-select,
.action-btn,
.upload-btn {
  height: 30px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  padding: 0 10px;
}

.action-btn,
.upload-btn {
  cursor: pointer;
}

.action-btn.ghost {
  background: transparent;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
}

.foc-enable-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.component-select,
.component-custom-input {
  min-width: 180px;
  max-width: 240px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e5e7eb;
  font-size: 12px;
  padding: 0 10px;
}

.component-select:focus,
.component-custom-input:focus {
  outline: none;
  border-color: #22d3ee;
}

.foc-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 4fr) minmax(420px, 6fr);
}

.editor-pane,
.preview-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-pane {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.preview-pane-header {
  gap: 10px;
}

.preview-header-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.source-name,
.preview-status {
  color: #22d3ee;
  text-transform: none;
  letter-spacing: 0;
}

.editor-textarea {
  flex: 1;
  min-height: 0;
  resize: none;
  border: none;
  outline: none;
  padding: 14px;
  background: #020617;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.55;
}

.preview-pane {
  padding: 0 14px 14px;
  min-height: 0;
}

.placeholder-card,
.error-card {
  margin: 0 0 12px;
  padding: 14px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9);
  color: #cbd5e1;
}

.error-card {
  border: 1px solid rgba(248, 113, 113, 0.35);
}

.error-title {
  font-size: 12px;
  font-weight: 700;
  color: #fca5a5;
  margin-bottom: 6px;
}

.error-body {
  font-size: 12px;
  color: #fecaca;
  white-space: pre-wrap;
}

.summary-inline-strip {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.summary-inline-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  min-height: 22px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.summary-inline-label {
  font-size: 9px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.summary-inline-value {
  font-size: 11px;
  color: #e2e8f0;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.chart-shell {
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.rule-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(2, 6, 23, 0.68);
  backdrop-filter: blur(8px);
}

.rule-dialog-panel {
  width: min(960px, calc(100vw - 48px));
  max-height: min(82vh, 920px);
  overflow-y: auto;
  border-radius: 18px;
  border: 1px solid rgba(34, 211, 238, 0.18);
  background: linear-gradient(180deg, rgba(8, 14, 23, 0.98), rgba(4, 8, 15, 0.99));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.rule-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rule-dialog-eyebrow {
  color: #67e8f9;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.rule-dialog-title {
  margin: 6px 0 0;
  color: #e2e8f0;
  font-size: 20px;
  line-height: 1.25;
}

.rule-dialog-close {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.rule-dialog-close:hover {
  border-color: rgba(34, 211, 238, 0.6);
  color: #67e8f9;
}

.rule-dialog-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 18px 22px 22px;
}

.rule-card {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(15, 23, 42, 0.5);
}

.rule-card-wide {
  grid-column: 1 / -1;
}

.rule-card-title {
  margin-bottom: 10px;
  color: #67e8f9;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rule-code {
  margin: 0;
  white-space: pre-wrap;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.rule-copy {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 1100px) {
  .rule-dialog-body {
    grid-template-columns: 1fr;
  }

  .foc-grid {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(220px, 1fr) minmax(260px, 1fr);
  }

  .editor-pane {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .preview-pane-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .preview-header-meta {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 720px) {
  .rule-dialog-overlay {
    padding: 12px;
  }

  .rule-dialog-panel {
    width: min(100vw - 24px, 960px);
    max-height: calc(100vh - 24px);
  }

  .rule-dialog-header,
  .rule-dialog-body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .preview-header-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-inline-strip {
    justify-content: flex-start;
  }

  .component-target-control {
    width: 100%;
  }

  .foc-enable-group {
    width: 100%;
    align-items: stretch;
  }

  .component-select,
  .component-custom-input {
    min-width: 0;
    max-width: none;
    width: 100%;
  }
}
</style>
<template>
  <section class="foc-panel-shell">
    <div class="foc-panel-header">
      <div>
        <h3 class="panel-title">FOC Workbench</h3>
        <p class="panel-subtitle">Task-scoped operation config editor and timeline preview</p>
      </div>
      <div class="panel-actions">
        <label class="toggle-row">
          <input :checked="focState.enabled" type="checkbox" @change="handleEnabledChange" />
          <span>Enable FOC</span>
        </label>
        <template v-if="focState.enabled">
          <select :value="focState.strategy" class="strategy-select" @change="handleStrategyChange">
            <option value="table">table</option>
            <option value="array">array</option>
          </select>
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
          <span class="source-name">{{ focState.sourceName || 'task_input.foc' }}</span>
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
              <span class="summary-inline-item"><span class="summary-inline-label">Strategy</span><span class="summary-inline-value">{{ focState.strategy }}</span></span>
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
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import FocTimelineChart from './FocTimelineChart.vue';
import { useFocDraft } from '../../../composables/useFocDraft';
import { projectApi } from '../../../api/project';

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
  setStrategy,
  setContent,
  setSourceName,
  clearDraft,
  loadFromFile,
  previewNow,
  schedulePreview
} = useFocDraft();

const defaultPulseSource = ref('');
const defaultPulseError = ref('');

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
    const snippet = extractDefaultPulseSource(response?.code || '');
    if (!snippet) {
      defaultPulseSource.value = '';
      defaultPulseError.value = 'Default pulseSource instance was not found in the original model source.';
      return;
    }
    defaultPulseSource.value = snippet;
    defaultPulseError.value = '';
  } catch (error) {
    defaultPulseSource.value = '';
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

function handleEnabledChange(event) {
  setEnabled(event.target.checked);
  if (event.target.checked) {
    schedulePreview(props.stopTime, 50);
  }
}

function handleStrategyChange(event) {
  setStrategy(event.target.value);
  schedulePreview(props.stopTime, 50);
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
  setContent([
    '# Example mixed schedule',
    'PULSE 1500 400 100 5',
    'DWELL 3600',
    'BEGIN_SCHEDULE',
    '  PULSE 2000 400 100 2',
    '  POWER 1000',
    '  BURN 1000',
    '  DWELL 500',
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

@media (max-width: 1100px) {
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
  .preview-header-meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-inline-strip {
    justify-content: flex-start;
  }
}
</style>

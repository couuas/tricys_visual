<template>
  <section v-if="focConfig" class="task-foc-card" :class="{ compact }">
    <div class="task-foc-header">
      <div>
        <div class="task-foc-title">FOC Preview</div>
        <div class="task-foc-meta">
          <span>{{ focConfig.sourceName }}</span>
          <span>{{ focConfig.strategy }}</span>
          <span>{{ durationLabel }}</span>
        </div>
      </div>
      <div class="task-foc-stats">
        <span>{{ stepCountLabel }} steps</span>
        <span>{{ rowCountLabel }} points</span>
      </div>
    </div>

    <div v-if="errorMessage" class="task-foc-error">{{ errorMessage }}</div>
    <div v-else-if="previewUnavailableReason" class="task-foc-empty">{{ previewUnavailableReason }}</div>
    <div class="task-foc-chart-wrap">
      <FocTimelineChart :rows="rows" :loading="loading" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { configurationApi } from '../../../api/configuration';
import { getTaskFocConfig } from '../../../utils/taskFoc';
import FocTimelineChart from './FocTimelineChart.vue';

const props = defineProps({
  task: {
    type: Object,
    default: null,
  },
  active: {
    type: Boolean,
    default: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const focConfig = computed(() => getTaskFocConfig(props.task));
const loading = ref(false);
const rows = ref([]);
const errorMessage = ref('');
const preview = ref(null);
const loadedSignature = ref('');

const requestSignature = computed(() => {
  if (!focConfig.value) return '';
  return JSON.stringify({
    strategy: focConfig.value.strategy,
    sourceName: focConfig.value.sourceName,
    content: focConfig.value.content,
    stopTime: focConfig.value.stopTime,
  });
});

const durationLabel = computed(() => {
  const duration = preview.value?.schedule_duration;
  if (!duration && duration !== 0) return '-- s';
  return `${Number(duration).toFixed(2)} s`;
});

const stepCountLabel = computed(() => preview.value?.step_count ?? '--');
const rowCountLabel = computed(() => rows.value.length || preview.value?.rows?.length || 0);
const previewUnavailableReason = computed(() => {
  if (!focConfig.value) return '';
  if (focConfig.value.hasInlineContent) return '';
  if (focConfig.value.path) return `This task used foc_path: ${focConfig.value.path}`;
  return 'Inline FOC content is unavailable for preview.';
});

async function loadPreview() {
  if (!props.active || !focConfig.value || !requestSignature.value || !focConfig.value.hasInlineContent) return;
  if (loadedSignature.value === requestSignature.value && (rows.value.length || errorMessage.value || preview.value)) return;

  loading.value = true;
  errorMessage.value = '';
  rows.value = [];
  preview.value = null;

  try {
    const response = await configurationApi.previewFoc({
      content: focConfig.value.content,
      strategy: focConfig.value.strategy,
      stop_time: focConfig.value.stopTime ?? undefined,
    });

    preview.value = response?.valid ? response : null;
    rows.value = Array.isArray(response?.rows) ? response.rows : [];
    errorMessage.value = response?.valid ? '' : (response?.error || 'FOC preview failed.');
    loadedSignature.value = requestSignature.value;
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || 'FOC preview failed.';
    loadedSignature.value = requestSignature.value;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.active, requestSignature.value],
  () => {
    if (!focConfig.value || !focConfig.value.hasInlineContent) {
      rows.value = [];
      preview.value = null;
      errorMessage.value = '';
      loadedSignature.value = '';
      return;
    }

    if (props.active) loadPreview();
  },
  { immediate: true }
);
</script>

<style scoped>
.task-foc-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 14px;
  border: 1px solid #30363d;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(11, 14, 20, 0.96), rgba(7, 10, 16, 0.92));
}

.task-foc-card.compact {
  padding: 12px;
  gap: 10px;
}

.task-foc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-foc-title {
  font-size: 12px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.task-foc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  color: #94a3b8;
  font-size: 11px;
}

.task-foc-meta span,
.task-foc-stats span {
  padding: 2px 8px;
  border: 1px solid rgba(71, 85, 105, 0.75);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
}

.task-foc-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: #cbd5e1;
  font-size: 11px;
}

.task-foc-error {
  color: #fca5a5;
  font-size: 12px;
}

.task-foc-empty {
  color: #cbd5e1;
  font-size: 12px;
}

.task-foc-chart-wrap {
  height: 220px;
  min-height: 180px;
}

.task-foc-card.compact .task-foc-chart-wrap {
  height: 180px;
  min-height: 160px;
}

@media (max-width: 900px) {
  .task-foc-header {
    flex-direction: column;
  }

  .task-foc-stats {
    justify-content: flex-start;
  }
}
</style>
<template>
  <div class="export-bar">
    <div class="title">EXPORT</div>
    <button @click="exportWide" :disabled="!taskId">Download All (Wide)</button>
    <button @click="exportSelected" :disabled="!taskId || jobIds.length === 0">Download Selected (Long)</button>
    <span v-if="loading" class="status">Preparing…</span>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { visualizerApi } from '../../api/visualizer';

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  jobIds: { type: Array, default: () => [] }
});

const loading = ref(false);

const triggerDownload = (url) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const exportWide = async () => {
  if (!props.taskId) return;
  loading.value = true;
  try {
    const res = await visualizerApi.exportData(props.taskId, {
      format: 'wide'
    });
    if (res.download_url) triggerDownload(res.download_url);
  } finally {
    loading.value = false;
  }
};

const exportSelected = async () => {
  if (!props.taskId || props.jobIds.length === 0) return;
  loading.value = true;
  try {
    const res = await visualizerApi.exportData(props.taskId, {
      format: 'long',
      job_ids: props.jobIds
    });
    if (res.download_url) triggerDownload(res.download_url);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.export-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  padding: 10px;
}
.title {
  font-size: 10px;
  font-weight: bold;
  color: #666;
  letter-spacing: 1px;
}
button {
  background: #161b22;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  padding: 6px 10px;
  cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
.status { font-size: 11px; color: #8b949e; }
</style>

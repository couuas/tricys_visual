<template>
  <div class="baseline-panel">
    <div class="panel-header">BASELINE</div>
    <div class="panel-body">
      <div class="row">
        <label>Baseline Job</label>
        <select v-model.number="baselineId" @change="loadBaseline">
          <option v-for="id in jobIds" :key="id" :value="id">Job {{ id }}</option>
        </select>
      </div>

      <div class="row" v-if="baselineParams">
        <label>Parameters</label>
        <table>
          <tbody>
            <tr v-for="(v, k) in baselineParams" :key="k">
              <td>{{ k }}</td>
              <td>{{ v }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="row" v-if="baselineMetrics">
        <label>Metrics</label>
        <table>
          <tbody>
            <tr v-for="(v, k) in baselineMetrics" :key="k">
              <td>{{ k }}</td>
              <td>{{ v }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="jobIds.length === 0" class="empty">Select jobs first.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { visualizerApi } from '../../api/visualizer';

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  jobIds: { type: Array, default: () => [] }
});

const baselineId = ref(null);
const baselineParams = ref(null);
const baselineMetrics = ref(null);

const loadBaseline = async () => {
  if (!props.taskId || !baselineId.value) return;
  try {
    const jobsRes = await visualizerApi.getJobs(props.taskId, {
      page: 1,
      page_size: 1,
      filter: `{id} = ${baselineId.value}`
    });
    const job = (jobsRes.items || [])[0] || null;
    if (job) {
      const { id, ...params } = job;
      baselineParams.value = params;
    } else {
      baselineParams.value = null;
    }
  } catch {
    baselineParams.value = null;
  }

  try {
    const metricsRes = await visualizerApi.getMetrics(props.taskId, {
      job_ids: String(baselineId.value)
    });
    const row = (metricsRes.records || [])[0] || null;
    if (row) {
      const { job_id, ...metrics } = row;
      baselineMetrics.value = metrics;
    } else {
      baselineMetrics.value = null;
    }
  } catch {
    baselineMetrics.value = null;
  }
};

watch(() => props.jobIds, (ids) => {
  if (!ids.length) {
    baselineId.value = null;
    baselineParams.value = null;
    baselineMetrics.value = null;
    return;
  }
  if (!baselineId.value || !ids.includes(baselineId.value)) {
    baselineId.value = ids[0];
  }
  loadBaseline();
}, { deep: true, immediate: true });
</script>

<style scoped>
.baseline-panel {
  background: #0d1117;
  border: 1px solid #30363d;
  padding: 10px;
}
.panel-header {
  font-size: 10px;
  font-weight: bold;
  color: #666;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row label {
  display: block;
  font-size: 11px;
  color: #8b949e;
  margin-bottom: 4px;
}
.row select {
  background: #05070a;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 4px;
}
.row table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.row td {
  border-bottom: 1px solid #30363d;
  padding: 4px 6px;
  color: #c9d1d9;
}
.empty { color: #6e7681; font-size: 11px; }
</style>

<template>
  <div class="viz-panel">
    <div class="toolbar">
      <div class="title">METRICS</div>
      <div class="tabs">
        <button :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">SUMMARY</button>
        <button :class="{ active: activeTab === 'scatter' }" @click="activeTab = 'scatter'">SCATTER</button>
        <button :class="{ active: activeTab === 'heatmap' }" @click="activeTab = 'heatmap'">HEATMAP</button>
        <button :class="{ active: activeTab === 'parallel' }" @click="activeTab = 'parallel'">PARALLEL</button>
      </div>
      <div class="status" v-if="loading">Loading…</div>
    </div>

    <div v-if="activeTab === 'summary'" class="summary-table">
      <table>
        <thead>
          <tr>
            <th>job_id</th>
            <th v-for="k in metricKeys" :key="k">{{ formatLabel(k) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in metrics" :key="row.job_id">
            <td>{{ row.job_id }}</td>
            <td v-for="k in metricKeys" :key="k">{{ formatNumber(row[k]) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="metrics.length === 0" class="empty">NO METRICS</div>
    </div>

    <div v-else class="chart-area">
      <div class="controls">
        <template v-if="activeTab === 'scatter'">
          <label>X</label>
          <select v-model="xMetric">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
          <label>Y</label>
          <select v-model="yMetric">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
        </template>

        <template v-if="activeTab === 'heatmap'">
          <label>X</label>
          <select v-model="xMetric">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
          <label>Y</label>
          <select v-model="yMetric">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
          <label>Z</label>
          <select v-model="zMetric">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
        </template>

        <template v-if="activeTab === 'parallel'">
          <label>Dims</label>
          <select multiple v-model="parallelDims">
            <option v-for="k in metricKeys" :key="k" :value="k">{{ formatLabel(k) }}</option>
          </select>
        </template>
      </div>
      <div ref="chartRef" class="chart"></div>
      <div v-if="metrics.length === 0" class="empty">NO METRICS</div>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { visualizerApi } from '../../api/visualizer';

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  jobIds: { type: Array, default: () => [] }
});

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(false);
const metrics = ref([]);

const activeTab = ref('summary');
const xMetric = ref('');
const yMetric = ref('');
const zMetric = ref('');
const parallelDims = ref([]);

const metricKeys = computed(() => {
  if (!metrics.value.length) return [];
  return Object.keys(metrics.value[0]).filter(k => k !== 'job_id');
});


const formatLabel = (k) => String(k).replace(/_/g, ' ').toUpperCase();
const formatNumber = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return v ?? '';
  return n.toLocaleString();
};

const ensureDefaults = () => {
  if (!metricKeys.value.length) return;
  if (!xMetric.value) xMetric.value = metricKeys.value[0];
  if (!yMetric.value) yMetric.value = metricKeys.value[0];
  if (!zMetric.value) zMetric.value = metricKeys.value[0];
  if (!parallelDims.value.length) parallelDims.value = metricKeys.value.slice(0, 4);
};


const buildScatterOption = () => {
  const data = metrics.value.map(row => [Number(row[xMetric.value]), Number(row[yMetric.value]), row.job_id]);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p) => `job_id: ${p.data[2]}<br/>${xMetric.value}: ${p.data[0]}<br/>${yMetric.value}: ${p.data[1]}`
    },
    xAxis: { type: 'value', name: xMetric.value, axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'value', name: yMetric.value, axisLabel: { color: '#8b949e' } },
    series: [{ type: 'scatter', symbolSize: 8, data }]
  };
};

const buildHeatmapOption = () => {
  const data = metrics.value.map(row => [Number(row[xMetric.value]), Number(row[yMetric.value]), Number(row[zMetric.value])]);
  return {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', name: xMetric.value, axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'value', name: yMetric.value, axisLabel: { color: '#8b949e' } },
    visualMap: {
      min: Math.min(...data.map(d => d[2])),
      max: Math.max(...data.map(d => d[2])),
      calculable: true,
      textStyle: { color: '#8b949e' }
    },
    series: [{ type: 'heatmap', data }]
  };
};

const buildParallelOption = () => {
  const dims = parallelDims.value.length ? parallelDims.value : metricKeys.value;
  const parallelAxis = dims.map((k, i) => ({ dim: i, name: k }));
  const data = metrics.value.map(row => dims.map(k => Number(row[k])));
  return {
    parallelAxis,
    parallel: { left: 40, right: 20, top: 30, bottom: 30 },
    series: [{ type: 'parallel', data }]
  };
};

const renderChart = () => {
  if (!chartInstance.value) return;
  if (!metrics.value.length) {
    chartInstance.value.clear();
    return;
  }

  ensureDefaults();
  let option = {};
  if (activeTab.value === 'scatter') option = buildScatterOption();
  if (activeTab.value === 'heatmap') option = buildHeatmapOption();
  if (activeTab.value === 'parallel') option = buildParallelOption();

  chartInstance.value.setOption({
    textStyle: { color: '#c9d1d9' },
    grid: { left: 50, right: 30, top: 40, bottom: 40 },
    ...option
  }, true);
};


const loadMetrics = async () => {
  if (!props.taskId || props.jobIds.length === 0) {
    metrics.value = [];
    renderChart();
    return;
  }
  loading.value = true;
  try {
    const res = await visualizerApi.getMetrics(props.taskId, {
      job_ids: props.jobIds.join(',')
    });
    metrics.value = res.records || [];
  } catch {
    metrics.value = [];
  } finally {
    loading.value = false;
    await nextTick();
    renderChart();
  }
};

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance.value = echarts.init(chartRef.value, 'dark');
};


const resizeChart = () => {
  if (chartInstance.value) chartInstance.value.resize();
};

watch(() => [props.taskId, props.jobIds], loadMetrics, { deep: true, immediate: true });
watch(activeTab, () => renderChart());
watch([xMetric, yMetric, zMetric, parallelDims], () => renderChart(), { deep: true });

onMounted(() => {
  initChart();
  window.addEventListener('resize', resizeChart);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
  if (chartInstance.value) chartInstance.value.dispose();
});
</script>

<style scoped>
.viz-panel {
  background: #0b0e14;
  border: 1px solid #30363d;
  padding: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.title {
  font-size: 12px;
  letter-spacing: 1px;
  color: #8b949e;
}
.tabs button {
  background: #161b22;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 10px;
  padding: 4px 8px;
  margin-right: 6px;
  cursor: pointer;
}
.tabs button.active {
  border-color: #2f81f7;
  color: #2f81f7;
}
.status {
  margin-left: auto;
  font-size: 11px;
  color: #8b949e;
}
.chart-area {
  position: relative;
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.controls select {
  background: #05070a;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 4px;
  font-size: 11px;
}
.chart {
  width: 100%;
  height: 360px;
}
.summary-table {
  position: relative;
  max-height: 360px;
  overflow: auto;
  border: 1px solid #30363d;
}
.summary-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.summary-table th,
.summary-table td {
  border-bottom: 1px solid #30363d;
  padding: 6px 8px;
  text-align: center;
  color: #c9d1d9;
}
.empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6e7681;
  font-size: 12px;
  letter-spacing: 1px;
}
</style>

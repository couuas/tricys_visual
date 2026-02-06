<template>
  <div class="viz-panel">
    <div class="toolbar">
      <div class="title">TIME SERIES</div>
      <div class="status" v-if="loading">Loading…</div>
    </div>
    <div ref="chartRef" class="chart"></div>
    <div v-if="!loading && isEmpty" class="empty">NO DATA</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import * as echarts from 'echarts';
import { visualizerApi } from '../../api/visualizer';

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  jobIds: { type: Array, default: () => [] },
  variables: { type: Array, default: () => [] }
});

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(false);
const records = ref([]);

const isEmpty = computed(() => records.value.length === 0);

const buildSeries = (rows) => {
  const seriesMap = new Map();
  for (const row of rows) {
    const time = Number(row.time);
    const jobId = row.job_id ?? row.id ?? 'N/A';
    for (const v of props.variables) {
      if (!(v in row)) continue;
      const value = row[v];
      if (value === null || value === undefined || Number.isNaN(Number(value))) continue;
      const key = `${v} | Job ${jobId}`;
      if (!seriesMap.has(key)) seriesMap.set(key, []);
      seriesMap.get(key).push([time, Number(value)]);
    }
  }
  return Array.from(seriesMap.entries()).map(([name, data]) => ({
    name,
    type: 'line',
    showSymbol: false,
    smooth: false,
    data
  }));
};

const renderChart = async () => {
  if (!chartInstance.value) return;
  if (records.value.length === 0 || props.variables.length === 0) {
    chartInstance.value.clear();
    return;
  }

  const series = buildSeries(records.value);

  chartInstance.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', textStyle: { color: '#c9d1d9' } },
    grid: { left: 40, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'value',
      name: 'Time',
      nameTextStyle: { color: '#8b949e' },
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
    },
    yAxis: {
      type: 'value',
      nameTextStyle: { color: '#8b949e' },
      axisLine: { lineStyle: { color: '#30363d' } },
      axisLabel: { color: '#8b949e' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
    },
    series
  }, true);
};

const loadSeries = async () => {
  if (!props.taskId || props.jobIds.length === 0 || props.variables.length === 0) {
    records.value = [];
    await renderChart();
    return;
  }
  loading.value = true;
  try {
    const res = await visualizerApi.getSeries(props.taskId, {
      job_ids: props.jobIds.join(','),
      vars: props.variables.join(',')
    });
    records.value = res.records || [];
  } catch {
    records.value = [];
  } finally {
    loading.value = false;
    await nextTick();
    await renderChart();
  }
};

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance.value = echarts.init(chartRef.value, 'dark');
};

const resizeChart = () => {
  if (chartInstance.value) chartInstance.value.resize();
};

watch(() => [props.taskId, props.jobIds, props.variables], loadSeries, { deep: true, immediate: true });

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
  position: relative;
  background: #0b0e14;
  border: 1px solid #30363d;
  padding: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.title {
  font-size: 12px;
  letter-spacing: 1px;
  color: #8b949e;
}
.status {
  font-size: 11px;
  color: #8b949e;
}
.chart {
  width: 100%;
  height: 420px;
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

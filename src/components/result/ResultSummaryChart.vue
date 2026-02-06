<template>
  <div class="summary-chart">
    <div class="chart-toolbar" v-if="metricOptions.length > 0">
      <label class="toolbar-label">METRIC</label>
      <select v-model="selectedMetric" class="metric-select">
        <option v-for="m in metricOptions" :key="m" :value="m">{{ formatLabel(m) }}</option>
      </select>
      <button class="reset-btn" @click="resetZoom" :disabled="!chartInstance">RESET ZOOM</button>
      <div class="hint">Drag to zoom • Wheel to zoom • Shift+Drag to pan</div>
    </div>
    <div class="chart-container">
      <canvas ref="canvasRef"></canvas>
      <div v-if="metricOptions.length === 0" class="no-data">NO SUMMARY METRICS</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

const props = defineProps({
  metrics: { type: [Array, Object], default: () => [] }
});

const canvasRef = ref(null);
const chartInstance = ref(null);

const metricOptions = computed(() => {
  if (Array.isArray(props.metrics) && props.metrics.length > 0) {
    const keys = Object.keys(props.metrics[0] || {}).filter(k => k !== 'job_id');
    return keys;
  }
  if (props.metrics && typeof props.metrics === 'object') {
    return Object.keys(props.metrics);
  }
  return [];
});

const selectedMetric = ref('');

const formatLabel = (key) => String(key).replace(/_/g, ' ').toUpperCase();

const buildChartData = () => {
  if (Array.isArray(props.metrics)) {
    const labels = props.metrics.map(r => r.job_id ?? 'N/A');
    const values = props.metrics.map(r => Number(r?.[selectedMetric.value] ?? 0));
    return { labels, values };
  }
  const labels = [formatLabel(selectedMetric.value)];
  const values = [Number(props.metrics?.[selectedMetric.value] ?? 0)];
  return { labels, values };
};

const resetZoom = () => {
  if (!chartInstance.value) return;
  chartInstance.value.resetZoom();
};

const initChart = () => {
  if (!canvasRef.value) return;
  chartInstance.value = new Chart(canvasRef.value, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 10, 0.9)',
          titleColor: '#00d2ff',
          bodyColor: '#eee',
          borderColor: '#333',
          borderWidth: 1
        },
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
          zoom: { wheel: { enabled: true }, drag: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        }
      },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
};

const updateChart = () => {
  if (!chartInstance.value || !selectedMetric.value) return;
  const { labels, values } = buildChartData();
  chartInstance.value.data.labels = labels;
  chartInstance.value.data.datasets = [
    {
      label: selectedMetric.value,
      data: values,
      backgroundColor: 'rgba(0, 210, 255, 0.35)',
      borderColor: '#00d2ff',
      borderWidth: 1
    }
  ];
  chartInstance.value.update();
};

watch(metricOptions, (opts) => {
  if (opts.length > 0 && !selectedMetric.value) {
    selectedMetric.value = opts[0];
  }
});

watch(() => props.metrics, () => {
  updateChart();
}, { deep: true });

watch(selectedMetric, () => {
  updateChart();
});

onMounted(() => {
  initChart();
  if (metricOptions.value.length > 0) {
    selectedMetric.value = metricOptions.value[0];
  }
});

onUnmounted(() => {
  if (chartInstance.value) chartInstance.value.destroy();
});
</script>

<style scoped>
.summary-chart { height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px; }
.chart-toolbar { display: flex; align-items: center; gap: 10px; }
.toolbar-label { font-size: 10px; color: #888; letter-spacing: 1px; }
.metric-select { background: #05070a; border: 1px solid #30363d; color: #eee; padding: 6px; font-size: 11px; }
.reset-btn { background: #161b22; border: 1px solid #30363d; color: #ccc; font-size: 10px; padding: 4px 8px; border-radius: 3px; cursor: pointer; }
.reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.hint { margin-left: auto; font-size: 10px; color: #666; }
.chart-container { flex: 1; position: relative; background: #0b0e14; border: 1px solid #30363d; }
.no-data { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #666; font-size: 11px; letter-spacing: 1px; }
</style>

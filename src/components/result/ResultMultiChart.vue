<template>
  <div class="result-chart">
    <div class="chart-toolbar">
      <button class="reset-btn" @click="resetZoom" :disabled="!isChartReady">RESET ZOOM</button>
      <div class="range-text" v-if="xRangeText">X: {{ xRangeText }}</div>
      <div class="hint">Drag to zoom • Wheel to zoom • Shift+Drag to pan</div>
    </div>
    <div class="chart-container">
      <canvas ref="canvasRef"></canvas>
    </div>
    <div v-if="loading" class="loading-overlay">LOADING DATA...</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

const props = defineProps({
  time: { type: Array, default: () => [] },
  dataSeries: { type: Object, default: () => ({}) }, // { 'TBR': [values], 'Inv': [values] }
  loading: { type: Boolean, default: false }
});

const canvasRef = ref(null);
const chartInstance = ref(null);
const isChartReady = ref(false);
const xRangeText = ref('');

const emit = defineEmits(['range-change']);

const colors = ['#00d2ff', '#00ff88', '#ffea00', '#ff5252', '#d29922'];

const updateRangeText = () => {
  if (!chartInstance.value) return;
  const scale = chartInstance.value.scales?.x;
  if (!scale) return;
  const min = typeof scale.min === 'number' ? scale.min.toFixed(4) : '';
  const max = typeof scale.max === 'number' ? scale.max.toFixed(4) : '';
  xRangeText.value = min && max ? `${min} ~ ${max}` : '';
  if (min && max) {
    emit('range-change', [Number(min), Number(max)]);
  }
};

const resetZoom = () => {
  if (!chartInstance.value) return;
  chartInstance.value.resetZoom();
  updateRangeText();
  emit('range-change', null);
};

const initChart = () => {
  if (!canvasRef.value) return;
  
  chartInstance.value = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Performance optimization for large datasets
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
           labels: { color: '#ccc', font: { family: 'Consolas' } }
        },
        tooltip: {
           backgroundColor: 'rgba(5, 7, 10, 0.9)',
           titleColor: '#00d2ff',
           bodyColor: '#eee',
           borderColor: '#333',
           borderWidth: 1
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift',
            onPanComplete: () => updateRangeText()
          },
          zoom: {
            wheel: { enabled: true },
            drag: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
            onZoomComplete: () => updateRangeText()
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#666' },
          title: { display: true, text: 'Time (s)', color: '#444' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#666' }
        }
      }
    }
  });
  isChartReady.value = true;
};

const updateChart = () => {
  if (!chartInstance.value) return;
   
   // X-Axis
  chartInstance.value.data.labels = props.time;
   
   // Datasets
  chartInstance.value.data.datasets = Object.keys(props.dataSeries).map((key, idx) => ({
      label: key,
      data: props.dataSeries[key],
      borderColor: colors[idx % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1
   }));
   
  chartInstance.value.update();
  updateRangeText();
};

watch(() => props.dataSeries, () => {
   updateChart();
}, { deep: true });

onMounted(() => {
   initChart();
   if (props.time.length > 0) updateChart();
});

onUnmounted(() => {
  if (chartInstance.value) chartInstance.value.destroy();
  isChartReady.value = false;
});
</script>

<style scoped>
.result-chart {
  width: 100%; height: 100%; position: relative;
  background: #0b0e14;
}

.chart-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 6px 10px; border-bottom: 1px solid #30363d;
  background: #0d1117; font-size: 10px; color: #888;
}
.reset-btn {
  background: #161b22; border: 1px solid #30363d; color: #ccc;
  font-size: 10px; padding: 4px 8px; border-radius: 3px; cursor: pointer;
}
.reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.range-text { color: #00d2ff; font-family: 'Consolas', monospace; }
.hint { margin-left: auto; color: #666; }

.chart-container {
  width: 100%; height: 100%; padding: 10px; box-sizing: border-box;
}

.loading-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
  color: #00d2ff; font-weight: bold; font-size: 12px; letter-spacing: 2px;
}
</style>

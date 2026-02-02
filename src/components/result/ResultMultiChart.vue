<template>
  <div class="result-chart">
    <div class="chart-container">
      <canvas ref="canvasRef"></canvas>
    </div>
    <div v-if="loading" class="loading-overlay">LOADING DATA...</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import Chart from 'chart.js/auto';

const props = defineProps({
  time: { type: Array, default: () => [] },
  dataSeries: { type: Object, default: () => ({}) }, // { 'TBR': [values], 'Inv': [values] }
  loading: { type: Boolean, default: false }
});

const canvasRef = ref(null);
let chartInstance = null;

const colors = ['#00d2ff', '#00ff88', '#ffea00', '#ff5252', '#d29922'];

const initChart = () => {
  if (!canvasRef.value) return;
  
  chartInstance = new Chart(canvasRef.value, {
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
};

const updateChart = () => {
   if (!chartInstance) return;
   
   // X-Axis
   chartInstance.data.labels = props.time;
   
   // Datasets
   chartInstance.data.datasets = Object.keys(props.dataSeries).map((key, idx) => ({
      label: key,
      data: props.dataSeries[key],
      borderColor: colors[idx % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1
   }));
   
   chartInstance.update();
};

watch(() => props.dataSeries, () => {
   updateChart();
}, { deep: true });

onMounted(() => {
   initChart();
   if (props.time.length > 0) updateChart();
});

onUnmounted(() => {
   if (chartInstance) chartInstance.destroy();
});
</script>

<style scoped>
.result-chart {
  width: 100%; height: 100%; position: relative;
  background: #0b0e14;
}

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

<template>
  <div ref="chartRef" class="foc-chart"></div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const chartRef = ref(null);
let chartInstance = null;
let resizeObserver = null;
let resizeFrame = null;

function renderChart() {
  if (!chartRef.value) {
    return;
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }

  const hasRows = Array.isArray(props.rows) && props.rows.length > 0;
  chartInstance.setOption({
    backgroundColor: 'transparent',
    animation: false,
    grid: {
      left: 48,
      right: 16,
      top: 26,
      bottom: 44
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0d1117',
      borderColor: '#30363d',
      textStyle: { color: '#c9d1d9' }
    },
    xAxis: {
      type: 'value',
      name: 'time(s)',
      nameLocation: 'middle',
      nameGap: 28,
      axisLine: { lineStyle: { color: '#4b5563' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: '#9ca3af' }
    },
    yAxis: {
      type: 'value',
      name: 'power(MW)',
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: { lineStyle: { color: '#4b5563' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: '#9ca3af' }
    },
    dataZoom: [
      { type: 'inside' },
      {
        type: 'slider',
        height: 18,
        bottom: 10,
        borderColor: '#30363d',
        backgroundColor: '#111827',
        fillerColor: 'rgba(34, 211, 238, 0.24)'
      }
    ],
    series: hasRows ? [
      {
        type: 'line',
        step: 'end',
        showSymbol: false,
        data: props.rows,
        lineStyle: {
          color: '#22d3ee',
          width: 2
        },
        itemStyle: {
          color: '#22d3ee'
        },
        areaStyle: {
          color: 'rgba(34, 211, 238, 0.12)'
        }
      }
    ] : [],
    graphic: !hasRows ? [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: props.loading ? 'Parsing FOC...' : 'No preview data',
          fill: '#6b7280',
          fontSize: 14
        }
      }
    ] : []
  }, {
    replaceMerge: ['series', 'graphic']
  });
}

function resizeChart() {
  if (chartInstance) {
    chartInstance.resize();
  }
}

function scheduleResize() {
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    resizeChart();
  });
}

onMounted(() => {
  nextTick(renderChart);
  window.addEventListener('resize', resizeChart);

  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(chartRef.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
  }
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});

watch(() => props.rows, () => nextTick(renderChart), { deep: true });
watch(() => props.loading, () => nextTick(renderChart));
</script>

<style scoped>
.foc-chart {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
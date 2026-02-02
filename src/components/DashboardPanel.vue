<template>
  <transition name="panel-slide">
    <div class="ui-panel" :class="{ 
      'panel-hidden': !showDashboard && !embedded && !consoleMode, 
      'embedded-mode': embedded,
      'console-mode': consoleMode 
    }">
      <div v-if="!embedded && !consoleMode" class="panel-handle" @click.stop="toggleDashboardPref(!showDashboard)" title="Toggle Dashboard">
        <span class="handle-icon">{{ showDashboard ? '◀' : '▶' }}</span>
      </div>
  
      <div class="panel-header" v-if="!consoleMode">
        <h3>Inventory Monitor</h3>
        <div class="header-actions">
           <button class="dock-btn" @click="$emit('toggle-dock')" :title="embedded ? 'Undock (Float)' : 'Dock to Top (Embed)'">{{ embedded ? '❐' : '⊞' }}</button>
        </div>
        <div v-if="!embedded" class="header-decoration"></div>
      </div>
      
      <div class="panel-content" ref="panelContentRef">
        
        <div class="charts-section" :style="chartsSectionStyle">
          <div class="charts-wrapper" ref="chartsWrapperRef">
            <div class="chart-group flex-chart" :style="lineChartStyle">
              <div class="group-header"><span class="group-title">Trend History</span></div>
              <div class="chart-body line-chart-body"><canvas ref="chartCanvas"></canvas></div>
            </div>
    
            <div class="panel-resizer internal" @mousedown.prevent="startDashboardResize('internal', $event)"></div>

            <div class="chart-group flex-chart" :style="pieChartStyle">
              <div class="group-header"><span class="group-title">Current Distribution</span></div>
              <div class="chart-body pie-chart-body pie-container">
                <div class="pie-canvas-wrapper"><canvas ref="pieChartCanvas"></canvas></div>
                <div class="chart-legend custom-scroll" v-if="pieLegendItems.length > 0">
                  <div v-for="item in pieLegendItems" :key="item.id" class="legend-item">
                    <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
                    <span class="legend-text">{{ item.id.toUpperCase() }}</span>
                    <span class="legend-val">{{ item.value.toFixed(1) }}</span>
                  </div>
                </div>
                <div v-else class="legend-empty">Select components</div>
              </div>
            </div>
          </div>
        </div>
  
        <div class="panel-resizer external" @mousedown.prevent="startDashboardResize('external', $event)"></div>

        <div class="side-column" :style="listSectionStyle">
            <div class="list-section">
              <div class="list-header-sticky">
                <span class="col-name">COMPONENTS</span>
                <div class="list-header-actions">
                  <button class="header-btn" @click.stop="selectAll" title="Select All">All</button>
                  <span class="sep">|</span>
                  <button class="header-btn" @click.stop="resetSelection" title="Reset to Default">Reset</button>
                </div>
              </div>
              <div class="list-content custom-scroll">
                <div 
                  v-for="comp in componentList" 
                  :key="comp.id"
                  class="cb-item compact"
                  :class="{ active: graphSelectedIds.has(comp.id) }"
                  @click="toggleSelection(comp.id)"
                  title="Toggle Visibility"
                >
                  <div class="item-bg"></div>
                  <div class="cb-center">
                    <span class="color-dot" :style="{ backgroundColor: comp.color, boxShadow: graphSelectedIds.has(comp.id) ? `0 0 6px ${comp.color}` : 'none' }"></span>
                    <span class="comp-name">{{ comp.id.toUpperCase() }}</span>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
  
      <div class="panel-footer-global">
         <TimeControls />
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, watch, shallowRef, nextTick, reactive } from 'vue';
import Chart from 'chart.js/auto';
import { useSimulation } from '../composables/useSimulation';
import TimeControls from './TimeControls.vue';

const props = defineProps({
  embedded: { type: Boolean, default: false },
  consoleMode: { type: Boolean, default: false }
});

const emit = defineEmits(['toggle-dock']);
  
const { 
  simulationData, currentTime, getCurrentDataSlice, showDashboard, toggleDashboardPref, graphSelectedIds, resetGraphSelection
} = useSimulation();
  
const chartCanvas = ref(null);
const pieChartCanvas = ref(null);
const chartInstance = shallowRef(null);
const pieChartInstance = shallowRef(null);
const panelContentRef = ref(null);
const chartsWrapperRef = ref(null);
const pieLegendItems = ref([]);

const dLayout = reactive({
  chartsListSplit: 60,
  chartInternalSplit: 50,
  isResizing: false
});

const isHorizontal = computed(() => props.consoleMode);

const chartsSectionStyle = computed(() => {
  const size = `${dLayout.chartsListSplit}%`;
  return isHorizontal.value ? { width: size, flex: 'none' } : { height: size, flex: 'none' };
});

const listSectionStyle = computed(() => {
  return { flex: 1, minWidth: 0, minHeight: 0 };
});

const lineChartStyle = computed(() => {
  const size = `${dLayout.chartInternalSplit}%`;
  return isHorizontal.value ? { width: size, flex: 'none' } : { height: size, flex: 'none' };
});

const pieChartStyle = computed(() => {
  return { flex: 1, minWidth: 0, minHeight: 0 };
});

const startDashboardResize = (type, event) => {
  dLayout.isResizing = true;
  const startX = event.clientX;
  const startY = event.clientY;
  const container = type === 'external' ? panelContentRef.value : chartsWrapperRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const totalSize = isHorizontal.value ? rect.width : rect.height;
  const startSplit = type === 'external' ? dLayout.chartsListSplit : dLayout.chartInternalSplit;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = isHorizontal.value ? 'col-resize' : 'row-resize';

  const onMouseMove = (e) => {
    const deltaPx = isHorizontal.value ? (e.clientX - startX) : (e.clientY - startY);
    const deltaPercent = (deltaPx / totalSize) * 100;
    let newSplit = startSplit + deltaPercent;
    newSplit = Math.max(10, Math.min(90, newSplit));
    if (type === 'external') dLayout.chartsListSplit = newSplit;
    else dLayout.chartInternalSplit = newSplit;
    if (chartInstance.value) chartInstance.value.resize();
    if (pieChartInstance.value) pieChartInstance.value.resize();
  };

  const onMouseUp = () => {
    dLayout.isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const getComponentColor = (id) => { 
  id = id.toLowerCase(); 
  if (id === 'sds') return '#00ff00'; 
  if (id === 'plasma') return '#ff00ff'; 
  if (id === 'tes') return '#ff9900'; 
  if (id.includes('iss')) return '#00ccff'; 
  let hash = 0; for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash); const h = Math.abs(hash % 360); return `hsl(${h}, 70%, 60%)`; 
};
  
const componentList = computed(() => { 
  if (!simulationData.value) return []; 
  return Object.keys(simulationData.value.components).sort().map(id => ({ id, color: getComponentColor(id) })); 
});
  
const currentValues = computed(() => getCurrentDataSlice());

const selectAll = () => {
    if (!componentList.value.length) return;
    const newSet = new Set(graphSelectedIds.value);
    componentList.value.forEach(c => newSet.add(c.id));
    graphSelectedIds.value = newSet;
    nextTick(() => { updateChartDatasets(); updatePieChart(); });
};

const resetSelection = () => {
    resetGraphSelection();
    nextTick(() => { updateChartDatasets(); updatePieChart(); });
};

const pieLegendItemsComputed = computed(() => {
  const items = [];
  if (!currentValues.value) return [];
  graphSelectedIds.value.forEach(id => {
      const val = currentValues.value[id] !== undefined ? currentValues.value[id] : 0;
      if (val >= 0) {
          items.push({ id, value: val, color: getComponentColor(id) });
      }
  });
  return items.sort((a, b) => b.value - a.value);
});
watch(pieLegendItemsComputed, (newVal) => { pieLegendItems.value = newVal; }, { immediate: true });

const toggleSelection = (id) => { 
  const newSet = new Set(graphSelectedIds.value);
  if (newSet.has(id)) newSet.delete(id); 
  else newSet.add(id); 
  graphSelectedIds.value = newSet;
};

watch(graphSelectedIds, () => {
    nextTick(() => { 
        updateChartDatasets(); 
        updatePieChart(); 
    });
}, { deep: true });
  
const verticalLinePlugin = { id: 'verticalLine', afterDraw: (chart) => { if (!chart.scales.x) return; const ctx = chart.ctx; const xPos = chart.scales.x.getPixelForValue(currentTime.value); if (xPos >= chart.scales.x.left && xPos <= chart.scales.x.right) { ctx.save(); ctx.beginPath(); ctx.moveTo(xPos, chart.scales.y.top); ctx.lineTo(xPos, chart.scales.y.bottom); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.restore(); } } };
  
const initLineChart = () => { 
  if (!chartCanvas.value) return; 
  if (chartInstance.value) chartInstance.value.destroy();
  chartInstance.value = new Chart(chartCanvas.value, { type: 'line', data: { datasets: [] }, options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, scales: { x: { type: 'linear', display: true, min: 0, ticks: { color: '#667', maxTicksLimit: 6, font: {size: 10} }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { display: true, ticks: { color: '#667', font: {size: 10} }, grid: { color: 'rgba(255,255,255,0.03)' } } }, plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: 'rgba(0,0,0,0.9)', titleColor: '#fff', bodyColor: '#ccc', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } }, elements: { point: { radius: 0 }, line: { borderWidth: 2 } } }, plugins: [verticalLinePlugin] }); 
};
  
const updateChartDatasets = () => { 
  if (!chartInstance.value || !simulationData.value) return; 
  const newDatasets = []; 
  graphSelectedIds.value.forEach(compID => { 
    const yValues = simulationData.value.components[compID]; 
    if (yValues) { 
      const xyData = yValues.map((val, index) => ({ x: simulationData.value.time[index], y: val })); 
      const color = getComponentColor(compID); 
      newDatasets.push({ label: compID.toUpperCase(), data: xyData, borderColor: color, backgroundColor: color, borderWidth: 2, fill: false, tension: 0.2 }); 
    } 
  }); 
  chartInstance.value.data.datasets = newDatasets; 
  const maxT = simulationData.value.time[simulationData.value.time.length - 1]; 
  if (chartInstance.value.options.scales.x) chartInstance.value.options.scales.x.max = maxT;
  chartInstance.value.update(); 
};
  
const initPieChart = () => { 
  if (!pieChartCanvas.value) return; 
  if (pieChartInstance.value) pieChartInstance.value.destroy(); 
  pieChartInstance.value = new Chart(pieChartCanvas.value, { 
    type: 'doughnut', 
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: '#242a35', borderWidth: 2, hoverOffset: 4 }] }, 
    options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: 10 }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.9)', titleColor: '#00d2ff', bodyColor: '#fff', callbacks: { label: (ctx) => { const val = ctx.parsed; const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const percent = total ? Math.round((val / total) * 100) : 0; return ` ${val.toFixed(2)}g (${percent}%)`; } } } } } 
  }); 
};

const updatePieChart = () => { 
  if (!pieChartInstance.value || !simulationData.value) return; 
  const labels = []; const data = []; const colors = []; const items = [];
  graphSelectedIds.value.forEach(id => { 
    const val = currentValues.value[id] || 0; 
    if (val >= 0) { const color = getComponentColor(id); labels.push(id.toUpperCase()); data.push(val); colors.push(color); items.push({ id, value: val, color }); } 
  }); 
  const dataset = pieChartInstance.value.data.datasets[0]; 
  pieChartInstance.value.data.labels = labels; dataset.data = data; dataset.backgroundColor = colors; 
  pieChartInstance.value.update();
  pieLegendItems.value = items.sort((a, b) => b.value - a.value);
};
  
watch(simulationData, (newVal) => { if (newVal) { initLineChart(); initPieChart(); updateChartDatasets(); updatePieChart(); } });
watch(currentTime, () => { if (chartInstance.value) chartInstance.value.draw(); if (pieChartInstance.value) updatePieChart(); });
onMounted(() => { if (simulationData.value) { initLineChart(); initPieChart(); updateChartDatasets(); updatePieChart(); } });
</script>
  
<style scoped>
/* (Base Panel Structure) */
.ui-panel { position: absolute; top: 70px; bottom: 20px; left: 10px; width: 420px; background: rgba(18, 22, 30, 0.9); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; z-index: 400; transition: transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); transform: translateX(0); box-sizing: border-box; }
.ui-panel.panel-hidden { transform: translateX(-430px); }
.ui-panel.embedded-mode { position: relative; top: auto; bottom: auto; left: auto; right: auto; width: 100%; height: 100%; transform: none !important; border: none; border-radius: 0; background: transparent; backdrop-filter: none; box-shadow: none; display: flex; flex-direction: column; }
.ui-panel.console-mode { position: relative; top: auto; bottom: auto; left: auto; right: auto; width: 100%; height: 100%; transform: none !important; background: transparent; border: none; box-shadow: none; border-radius: 0; display: flex; flex-direction: column; }
.ui-panel.console-mode .panel-content { flex-direction: row; height: 100%; overflow: hidden; }
.ui-panel.console-mode .charts-section { border-bottom: none; border-right: none; height: 100%; overflow: hidden; }
.ui-panel.console-mode .charts-wrapper { display: flex; flex-direction: row; height: 100%; }
.ui-panel.console-mode .flex-chart { border-right: none; border-bottom: none; min-height: 0; display: flex; flex-direction: column; }
.ui-panel.console-mode .chart-body { flex: 1; height: auto; min-height: 0; width: 100%; }
.ui-panel.console-mode .side-column { display: flex; flex-direction: column; height: 100%; border-left: none; overflow: hidden; }
.ui-panel.console-mode .list-section { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.ui-panel.console-mode .list-content { overflow-y: auto; flex: 1; }

/* Resizer */
.panel-resizer { background: #0d1117; display: flex; align-items: center; justify-content: center; z-index: 10; transition: background 0.2s; }
.panel-resizer:hover { background: rgba(0, 210, 255, 0.2); }
.panel-resizer.vertical { height: 6px; cursor: row-resize; width: 100%; }
.ui-panel.console-mode .panel-resizer { width: 6px; height: 100%; cursor: col-resize; background: #0d1117; border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }

/* Header & Handle */
.panel-handle { position: absolute; top: 50%; right: -24px; width: 24px; height: 60px; background: rgba(18, 22, 30, 0.9); border: 1px solid rgba(255,255,255,0.1); border-left: none; border-radius: 0 8px 8px 0; display: flex; align-items: center; justify-content: center; cursor: pointer; transform: translateY(-50%); box-shadow: 4px 0 10px rgba(0,0,0,0.3); transition: background 0.2s; z-index: 401; }
.panel-header { padding: 15px 20px; flex-shrink: 0; background: rgba(255, 255, 255, 0.02); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
.ui-panel.embedded-mode .panel-header { padding: 10px 15px; min-height: 45px; }
h3 { margin: 0; font-size: 15px; color: #fff; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; }
h3::before { content: ''; display: block; width: 4px; height: 16px; background: #00d2ff; border-radius: 2px; box-shadow: 0 0 10px #00d2ff; }
.ui-panel.embedded-mode h3 { font-size: 13px; }
.header-actions { display: flex; align-items: center; }
.dock-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #888; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.2s; margin-left: 10px; }
.dock-btn:hover { border-color: #00d2ff; color: #00d2ff; background: rgba(0, 210, 255, 0.1); }

/* Content Structure */
.panel-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.ui-panel.embedded-mode .panel-content { flex-direction: column; }
.charts-section { flex: 0 0 auto; display: flex; flex-direction: column; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.1); }
.ui-panel.embedded-mode .charts-section { flex: 0 0 auto; max-height: 55%; border-bottom: 1px solid #30363d; border-right: none; overflow-y: auto; }
.charts-wrapper { display: block; }
.ui-panel.embedded-mode .charts-wrapper { display: flex; flex-direction: column; height: auto; min-height: 0; }
.chart-group { border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; display: flex; flex-direction: column; }
.chart-group:last-child { border-bottom: none; }
.group-header { padding: 8px 20px; background: rgba(255,255,255,0.03); cursor: default; display: flex; justify-content: space-between; align-items: center; }
.group-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; }
.ui-panel.embedded-mode .flex-chart { border-right: none; border-bottom: 1px solid #30363d; display: flex; flex-direction: column; min-width: 0; min-height: auto; }
.ui-panel.embedded-mode .flex-chart:last-child { border-bottom: none; }
.chart-body { position: relative; width: 100%; padding: 10px 20px; box-sizing: border-box; background: rgba(30, 34, 42, 0.4); }
.line-chart-body { height: 180px; }
.pie-chart-body { height: 180px; }
.ui-panel.embedded-mode .line-chart-body { height: 160px; }
.ui-panel.embedded-mode .pie-chart-body { height: auto; min-height: 220px; }
.pie-container { display: flex; flex-direction: row; align-items: center; height: 100%; }
.ui-panel.embedded-mode .pie-container { flex-direction: column; padding: 10px 0; }
.pie-canvas-wrapper { flex: 1; position: relative; height: 100%; min-width: 0; display: flex; justify-content: center; align-items: center; }
.ui-panel.embedded-mode .pie-canvas-wrapper { height: 160px; width: 100%; margin-bottom: 15px; }
.chart-legend { width: 120px; height: 100%; overflow-y: auto; padding-left: 10px; border-left: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 6px; }
.ui-panel.embedded-mode .chart-legend { width: 100%; height: 100px; border-left: none; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; padding-left: 0; }

/* List Section */
.side-column { flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative; }
.ui-panel.embedded-mode .side-column { width: 100%; min-width: 0; }

.list-section { flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative; }
.list-header-sticky { flex-shrink: 0; display: flex; justify-content: space-between; padding: 12px 20px 8px; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 0.5px; background: rgba(18, 22, 30, 0.95); z-index: 10; }
.list-header-actions { display: flex; align-items: center; gap: 6px; }
.header-btn { background: transparent; border: none; color: #666; font-size: 10px; font-weight: bold; cursor: pointer; padding: 2px 4px; transition: 0.2s; text-transform: uppercase; }
.header-btn:hover { color: #00d2ff; }
.sep { color: #444; font-size: 10px; }

.list-content { 
  flex: 1; overflow-y: auto; 
  padding: 10px 14px 10px 20px; 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); 
  gap: 6px; 
  align-content: start; 
}
.ui-panel.embedded-mode .list-content { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }

.cb-item { position: relative; display: flex; align-items: center; justify-content: center; padding: 6px 4px; border-radius: 4px; cursor: pointer; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); transition: all 0.2s; text-align: center; }
.ui-panel.embedded-mode .cb-item { padding: 12px 4px; }
.item-bg { position: absolute; inset: 0; background: rgba(255,255,255,0.03); z-index: 0; transition: opacity 0.2s; } .cb-item:hover .item-bg { background: rgba(255,255,255,0.08); } .cb-item.active { border-color: rgba(0, 210, 255, 0.3); background: rgba(0, 210, 255, 0.05); } .cb-item.active .item-bg { opacity: 0; }
.cb-center { position: relative; z-index: 1; display: flex; align-items: center; gap: 4px; overflow: hidden; width: 100%; justify-content: center; }
.color-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.comp-name { font-size: 10px; font-weight: 600; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .cb-item.active .comp-name { color: #fff; }

/* GLOBAL FOOTER (NEW) */
.panel-footer-global { flex-shrink: 0; padding: 10px; border-top: 1px solid #30363d; background: rgba(0, 0, 0, 0.3); z-index: 100; }

.legend-item { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #ccc; padding-right: 5px; } .legend-color { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-right: 6px; } .legend-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .legend-val { font-weight: bold; color: #fff; font-family: monospace; } .legend-empty { color: #666; font-size: 10px; text-align: center; margin-top: 20px; }
.panel-slide-enter-active, .panel-slide-leave-active { transition: all 1.2s cubic-bezier(0.19, 1, 0.22, 1); } .panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(-80px); opacity: 0; filter: blur(15px); } .panel-slide-enter-to, .panel-slide-leave-from { transform: translateX(0); opacity: 1; filter: blur(0); }
.custom-scroll::-webkit-scrollbar { width: 4px; } .custom-scroll::-webkit-scrollbar-track { background: transparent; } .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
</style>
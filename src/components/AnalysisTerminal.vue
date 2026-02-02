<template>
  <div class="analysis-terminal-container" ref="containerRef">
    <div class="pane-left sidebar" :style="{ width: layout.leftWidth + 'px' }">
      <div class="sidebar-header">
        <span class="sb-title">TASK QUEUE</span>
        <button class="new-task-icon-btn" @click="selectTask('new')" title="New Analysis">
          <span class="plus-icon">+</span>
        </button>
      </div>
      <div class="task-list custom-scroll">
        <div 
          v-for="task in tasks" :key="task.id" 
          class="task-item" 
          :class="{ active: selectedTaskId === task.id, running: task.status === 'running' }" 
          @click="selectTask(task.id)"
        >
          <div class="task-status-bar"></div>
          <div class="task-content">
            <div class="task-row-main">
              <span class="task-name">{{ task.name }}</span>
              <span class="status-tag" :class="task.status">{{ task.status }}</span>
            </div>
            <div class="task-details">
              <div class="task-params" v-if="task.scan_config">
                <span class="param-name">{{ getScanParamName(task) }}</span>
                <span class="param-val">{{ getScanRangeStr(task) }}</span>
              </div>
              <div class="task-meta">{{ formatTime(task.created_at) }}</div>
            </div>
          </div>
          <button class="del-btn" @click.stop="handleDelete(task.id)">🗑</button>
        </div>
        <div v-if="tasks.length === 0" class="empty-tasks">No history.</div>
      </div>
    </div>
    
    <div class="resizer-v" @mousedown.prevent="startResize('left', $event)"></div>
    
    <div class="panes-wrapper">
        
        <div v-if="selectedTaskId === 'new'" class="config-mode-container">
          
          <div class="config-body custom-scroll">
            
            <div class="config-column left-col">
                <div class="column-header">
                   <span class="step-label">01 // TARGET PARAMETER</span>
                </div>
                
                <div class="control-row">
                  <div class="custom-select-container" ref="paramMenuRef">
                    <div class="custom-select-trigger compact-select" :class="{ active: showParamMenu }" @click.stop="toggleParamMenu">
                      <div class="select-label">SCAN:</div>
                      <span class="selected-val" :class="{ placeholder: !newTask.scan_parameter }">
                        {{ newTask.scan_parameter || 'Select Component...' }}
                      </span>
                      <span class="arrow">▼</span>
                    </div>
                    <transition name="fade-down">
                      <div v-show="showParamMenu" class="custom-options-list custom-scroll">
                        <div v-for="k in availableParams" :key="k" class="option-item" :class="{ selected: newTask.scan_parameter === k }" @click.stop="selectParam(k)">
                          {{ k }}
                        </div>
                        <div v-if="availableParams.length === 0" class="option-empty">No parameters found</div>
                      </div>
                    </transition>
                  </div>
                </div>

                <div class="control-row spacer-top">
                   <div class="row-label-bar">
                      <span class="step-label">VALUE RANGE</span>
                      <div class="mode-switch">
                         <button :class="{ active: newTask.mode === 'range' }" @click="newTask.mode = 'range'">Range</button>
                         <button :class="{ active: newTask.mode === 'list' }" @click="newTask.mode = 'list'">List</button>
                      </div>
                   </div>

                   <div class="input-panel compact">
                      <div v-if="newTask.mode === 'range'" class="range-grid">
                         <div class="field-box compact">
                            <span class="field-label">START</span>
                            <input type="number" v-model.number="newTask.start" step="0.1">
                         </div>
                         <div class="connector">→</div>
                         <div class="field-box compact">
                            <span class="field-label">END</span>
                            <input type="number" v-model.number="newTask.end" step="0.1">
                         </div>
                         <div class="connector">/</div>
                         <div class="field-box compact small">
                            <span class="field-label">STEPS</span>
                            <input type="number" v-model.number="newTask.steps" min="2">
                         </div>
                      </div>
                      
                      <div v-else class="field-box compact full-width">
                         <span class="field-label">VALUES (CSV)</span>
                         <input type="text" v-model="newTask.customValuesStr" placeholder="e.g. 1.0, 1.5, 2.0" class="code-input">
                      </div>
                   </div>
                </div>
            </div>

            <div class="config-column right-col">
                <div class="column-header">
                   <span class="step-label">02 // SIMULATION SETTINGS</span>
                </div>
                
                <div class="settings-grid-layout">
                   <div class="field-box compact">
                      <span class="field-label">STOP (s)</span>
                      <input type="number" v-model.number="newTask.sim_stop_time" step="100">
                   </div>
                   <div class="field-box compact">
                      <span class="field-label">STEP (s)</span>
                      <input type="number" v-model.number="newTask.sim_step_size" step="0.1">
                   </div>
                </div>
                
                 <div class="control-row tight-top">
                    <div class="field-box compact full-width">
                      <span class="field-label">TASK ID</span>
                      <input type="text" v-model="newTask.name" placeholder="Auto-generated (Optional)">
                   </div>
                 </div>

                 <div class="control-row spacer-top">
                    <span class="step-label sub">METRICS</span>
                    <div class="metrics-container compact custom-scroll">
                        <label v-for="m in availableMetrics" :key="m" class="metric-card compact" :class="{ active: newTask.metrics.includes(m) }">
                          <input type="checkbox" :value="m" v-model="newTask.metrics" hidden>
                          <div class="metric-checkbox"></div>
                          <span class="metric-name">{{ m.replace(/_/g,' ') }}</span>
                        </label>
                    </div>
                 </div>
            </div>

          </div>

          <div class="config-footer">
             <div class="footer-left">
                <div class="ai-toggle-compact" :class="{ active: newTask.generate_report }" @click="newTask.generate_report = !newTask.generate_report">
                   <div class="toggle-track">
                      <div class="toggle-knob"></div>
                   </div>
                   <span class="text">AI Report</span>
                </div>
             </div>

             <div class="footer-spacer"></div>

             <div class="footer-right">
                <button class="run-btn-compact" @click="submitTask" :disabled="isSubmitting || !newTask.scan_parameter || isReadOnly">
                  <span v-if="isSubmitting" class="loader mini"></span>
                  <span v-else>INITIATE</span>
                  <span class="icon" v-if="!isSubmitting">▶</span>
                </button>
             </div>
          </div>
        </div>
        
        <div v-else-if="selectedTask" class="result-mode-container">
          <div class="pane-middle">
            <div class="pane-toolbar scrollable-tabs">
              <div class="tab-group dynamic-tabs">
                <button 
                  v-for="header in metricsHeaders" 
                  :key="header" 
                  :class="{ active: activeChartTab === header }" 
                  @click="switchChartTab(header)"
                >
                  <span class="icon">📊</span> {{ header.replace(/_/g, ' ') }}
                </button>
                
                <template v-if="!isSplitView">
                  <div class="tab-divider" v-if="metricsHeaders.length > 0"></div>
                  <button 
                    :class="{ active: activeChartTab === 'temporal' }" 
                    @click="switchChartTab('temporal')"
                  >
                    <span class="icon">📈</span> Time Series
                  </button>
                </template>
              </div>
            </div>

            <div class="canvas-container" :class="{ 'split-layout': isSplitView }">
              
              <div class="chart-wrapper primary-chart">
                <div class="chart-label-overlay" v-if="isSplitView">METRIC SERIES</div>
                <canvas ref="chartRef"></canvas>
              </div>
              
              <div class="chart-wrapper secondary-chart" v-show="isSplitView">
                <div class="chart-separator"></div>
                <div class="chart-label-overlay">TIME SERIES</div>
                <canvas ref="timeSeriesChartRef"></canvas>
              </div>

              <div v-if="isLoadingData" class="overlay-msg">Loading Data...</div>
              <div v-else-if="isChartEmpty" class="overlay-msg">
                <span v-if="selectedTask.status === 'running'">Simulation Running...</span>
                <span v-else>No Data Available</span>
              </div>
            </div>
          </div>

          <div class="resizer-v" @mousedown.prevent="startResize('right', $event)"></div>
          
          <div class="pane-right" :style="{ width: layout.rightWidth + 'px' }">
            <div class="pane-toolbar"><div class="tab-group small"><button :class="{ active: activeTextTab === 'report' }" @click="activeTextTab = 'report'">🤖 Report</button><button :class="{ active: activeTextTab === 'logs' }" @click="activeTextTab = 'logs'">📝 Logs</button></div></div>
            <div class="text-content custom-scroll"><div v-if="activeTextTab === 'report'"><div v-if="reportContent" class="markdown-body" v-html="renderMarkdown(reportContent)"></div><div v-else class="empty-text"><p>AI Report not available.</p><span class="sub" v-if="selectedTask.status === 'running'">Analysis in progress...</span></div></div><div v-else><pre class="log-viewer" v-if="logContent">{{ logContent }}</pre><div v-else class="empty-text">No system logs.</div></div></div>
          </div>
        </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, shallowRef, watch } from 'vue';
import { useSimulation } from '../composables/useSimulation';
import Chart from 'chart.js/auto';
import MarkdownIt from 'markdown-it';
import { $confirm } from '../utils/dialog';

const BACKEND_URL = 'http://localhost:8000';
const props = defineProps(['isActive']); 

const { 
  componentParams, analysisTasks, submitAnalysisTask, 
  deleteAnalysisTask, getTaskReport, getTaskLogs, isReadOnly
} = useSimulation();

const md = new MarkdownIt();

// State
const containerRef = ref(null); // Ref for ResizeObserver
const selectedTaskId = ref('new');
const isSubmitting = ref(false);
const activeChartTab = ref(''); 
const activeTextTab = ref('report');
const layout = reactive({ leftWidth: 280, rightWidth: 320, isResizing: false });
const metricsData = ref(null);
const temporalData = ref(null);
const reportContent = ref('');
const logContent = ref('');
const isLoadingData = ref(false);

// Chart Refs
const chartRef = ref(null); // Primary Chart
const timeSeriesChartRef = ref(null); // Secondary Chart (Split View)
const chartInstance = shallowRef(null);
const timeSeriesChartInstance = shallowRef(null);

const isSplitView = ref(false); // Controls Split Layout

const availableMetrics = ['Startup_Inventory','Doubling_Time','Self_Sufficiency_Time', 'Required_TBR'];
const newTask = reactive({ name: '', scan_parameter: '', mode: 'range', start: 1.0, end: 1.2, steps: 5, customValuesStr: '', metrics: ['Startup_Inventory'], generate_report: false, sim_stop_time: 2000, sim_step_size: 0.5 });

const showParamMenu = ref(false);
const paramMenuRef = ref(null);

const tasks = computed(() => analysisTasks.value);
const selectedTask = computed(() => tasks.value.find(t => t.id === selectedTaskId.value));
const metricsHeaders = computed(() => metricsData.value?.headers?.slice(1) || []);
const isChartEmpty = computed(() => {
  if (activeChartTab.value === 'temporal' && !isSplitView.value) return !temporalData.value?.rows?.length;
  return !metricsData.value?.rows?.length;
});
const availableParams = computed(() => {
  const keys = [];
  if (componentParams.value) {
    for (const [c, p] of Object.entries(componentParams.value)) {
        if (p && typeof p === 'object') {
            for (const k of Object.keys(p)) keys.push(`${c}.${k}`);
        }
    }
  }
  return keys.sort();
});

// --- Logic ---

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // Check if height > 50% of window height
    const isTall = entry.contentRect.height > (window.innerHeight * 0.5);
    if (isTall !== isSplitView.value) {
      isSplitView.value = isTall;
      
      // If switching to split view and current tab is temporal, switch back to first metric
      if (isTall && activeChartTab.value === 'temporal' && metricsHeaders.value.length > 0) {
        activeChartTab.value = metricsHeaders.value[0];
      }
      
      // Re-render charts after layout change
      nextTick(() => renderCharts());
    }
  }
});

const resizeChart = () => { 
  if (chartInstance.value) chartInstance.value.resize();
  if (timeSeriesChartInstance.value) timeSeriesChartInstance.value.resize();
};
defineExpose({ resizeChart });

const startResize = (side, event) => {
  layout.isResizing = true;
  const startX = event.clientX;
  const startWidth = side === 'left' ? layout.leftWidth : layout.rightWidth;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  const onMouseMove = (e) => {
    const delta = e.clientX - startX;
    if (side === 'left') {
      const newW = startWidth + delta;
      if (newW > 150 && newW < 600) layout.leftWidth = newW;
    } else {
      const newW = startWidth - delta;
      if (newW > 200 && newW < 800) layout.rightWidth = newW;
    }
    resizeChart();
  };
  const onMouseUp = () => {
    layout.isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const parseConfig = (jsonStr) => { try { return typeof jsonStr === 'object' ? jsonStr : JSON.parse(jsonStr); } catch { return {}; } };
const getScanParamName = (task) => parseConfig(task.scan_config).scan_parameter || 'Unknown Param';
const getScanRangeStr = (task) => { const cfg = parseConfig(task.scan_config); return cfg.mode === 'list' ? 'Custom List' : `${cfg.start} → ${cfg.end} (${cfg.steps})`; };
const formatTime = (iso) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
const renderMarkdown = (t) => md.render(t || '');

const selectTask = async (id) => { selectedTaskId.value = id; metricsData.value = null; temporalData.value = null; reportContent.value = ''; activeChartTab.value = ''; if (id !== 'new') await loadAllTaskData(id); nextTick(() => renderCharts()); };
const handleDelete = async (id) => {
  const isConfirmed = await $confirm('Are you sure you want to delete this analysis task? This action cannot be undone.', 'DELETE TASK');
  if (isConfirmed) { await deleteAnalysisTask(id); if (selectedTaskId.value === id) selectedTaskId.value = 'new'; }
};
const submitTask = async () => { if (!newTask.scan_parameter) return; isSubmitting.value = true; let values = []; if (newTask.mode === 'list' && newTask.customValuesStr) { values = newTask.customValuesStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v)); } await submitAnalysisTask({ name: newTask.name, scan_parameter: newTask.scan_parameter, mode: newTask.mode, start: newTask.start, end: newTask.end, steps: newTask.steps, values: values, stop_time: newTask.sim_stop_time, step_size: newTask.sim_step_size, generate_report: newTask.generate_report, dependent_variables: newTask.metrics }); isSubmitting.value = false; if (tasks.value.length > 0) selectTask(tasks.value[0].id); };
const toggleParamMenu = () => { showParamMenu.value = !showParamMenu.value; };
const selectParam = (param) => { newTask.scan_parameter = param; showParamMenu.value = false; };
const closeParamMenu = (e) => { if (paramMenuRef.value && !paramMenuRef.value.contains(e.target)) showParamMenu.value = false; };

const switchChartTab = (tab) => { activeChartTab.value = tab; nextTick(() => renderCharts()); };

const loadAllTaskData = async (id) => { 
    isLoadingData.value = true; 
    try { 
        const fetchData = async (url) => { try { const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`); return await res.json(); } catch (err) { console.error(`Failed to fetch ${url}:`, err); return null; } }; 
        const [mRes, tRes, report, logs] = await Promise.all([ fetchData(`${BACKEND_URL}/api/analysis/tasks/${id}/results/metrics`), fetchData(`${BACKEND_URL}/api/analysis/tasks/${id}/results/temporal`), getTaskReport(id), getTaskLogs(id) ]); 
        metricsData.value = mRes; 
        temporalData.value = tRes; 
        reportContent.value = report; 
        logContent.value = logs; 
        
        if (mRes && mRes.headers && mRes.headers.length > 1) { 
            const validTabs = [...mRes.headers.slice(1)]; 
            if (!activeChartTab.value || (!validTabs.includes(activeChartTab.value) && activeChartTab.value !== 'temporal')) { 
                activeChartTab.value = mRes.headers[1]; 
            } 
        } else { activeChartTab.value = 'temporal'; } 
        
        nextTick(() => renderCharts()); 
    } catch (e) { console.error("Error loading data", e); } finally { isLoadingData.value = false; } 
};

// --- Rendering Logic ---

const renderCharts = () => {
  if (isSplitView.value) {
    // Split Mode: Top is Metric, Bottom is Temporal
    renderMetricChart(chartRef.value, activeChartTab.value, chartInstance);
    renderTemporalChart(timeSeriesChartRef.value, timeSeriesChartInstance);
  } else {
    // Single Mode: Canvas 1 handles both
    if (activeChartTab.value === 'temporal') {
      renderTemporalChart(chartRef.value, chartInstance);
    } else {
      renderMetricChart(chartRef.value, activeChartTab.value, chartInstance);
    }
  }
};

const renderMetricChart = (canvas, metricName, instanceRef) => {
    if (!canvas || !metricsData.value?.rows?.length || !metricName) return;
    
    if (instanceRef.value) { instanceRef.value.destroy(); instanceRef.value = null; }
    
    const headers = metricsData.value.headers;
    const xLabel = headers[0];
    const yIdx = headers.indexOf(metricName);
    if (yIdx === -1) return;
    
    const rows = metricsData.value.rows;
    const dataPoints = rows.map(r => ({ x: r[0], y: r[yIdx] })).sort((a,b)=>a.x-b.x);
    
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');
    
    instanceRef.value = new Chart(canvas, { 
        type: 'line', 
        data: { 
            datasets: [{ 
                label: metricName.replace(/_/g, ' '), 
                data: dataPoints, 
                borderColor: '#00d2ff', 
                backgroundColor: gradient, 
                borderWidth: 2, 
                pointRadius: 4, 
                pointBackgroundColor: '#0d1117', 
                pointBorderColor: '#00d2ff', 
                fill: true 
            }] 
        }, 
        options: getChartOptions(xLabel, 'Value') 
    });
};

const renderTemporalChart = (canvas, instanceRef) => {
    if (!canvas || !temporalData.value?.rows?.length) return;
    
    if (instanceRef.value) { instanceRef.value.destroy(); instanceRef.value = null; }
    
    const headers = temporalData.value.headers;
    const rows = temporalData.value.rows;
    const datasets = [];
    const colors = ['#00d2ff', '#ff00ff', '#ffff00', '#00ff00', '#ff0000'];
    
    for(let i = 1; i < headers.length; i++) {
        let label = headers[i].split('&')[1] || headers[i];
        const data = rows.filter((_, idx) => idx % 5 === 0).map(r => ({ x: r[0], y: r[i] }));
        datasets.push({ 
            label: label, 
            data: data, 
            borderColor: colors[(i-1) % colors.length], 
            borderWidth: 1.5, 
            pointRadius: 0, 
            tension: 0.4, 
            fill: false 
        });
    }
    
    instanceRef.value = new Chart(canvas, { 
        type: 'line', 
        data: { datasets }, 
        options: getChartOptions('Time (s)', 'Inventory (g)') 
    });
};

const getChartOptions = (xTitle, yTitle) => ({ 
    responsive: true, 
    maintainAspectRatio: false, 
    interaction: { mode: 'index', intersect: false }, 
    plugins: { 
        legend: { labels: { color: '#aaa', font: {size: 10}, boxWidth: 10 } }, 
        tooltip: { backgroundColor: 'rgba(10,14,20,0.9)', titleColor: '#fff', bodyColor: '#ccc', borderColor: '#333', borderWidth: 1 } 
    }, 
    scales: { 
        x: { type: 'linear', title: { display: true, text: xTitle, color: '#666' }, grid: { color: '#222' }, ticks: { color: '#888' } }, 
        y: { title: { display: true, text: yTitle, color: '#666' }, grid: { color: '#222' }, ticks: { color: '#888' } } 
    } 
});

let pollTimer;
onMounted(() => {
    if (containerRef.value) {
        resizeObserver.observe(containerRef.value);
    }
    window.addEventListener('click', closeParamMenu);
    pollTimer = setInterval(async () => {
        if (selectedTaskId.value !== 'new' && selectedTask.value?.status === 'running') {
            loadAllTaskData(selectedTaskId.value);
        }
    }, 3000);
});
onUnmounted(() => { 
    resizeObserver.disconnect();
    clearInterval(pollTimer); 
    window.removeEventListener('click', closeParamMenu); 
});
watch(() => props.isActive, (active) => { if (active) nextTick(resizeChart); });
</script>

<style scoped>
/* === Global Container & CSS Variables === */
.analysis-terminal-container {
    display: flex; width: 100%; height: 100%; overflow: hidden;
    background: #0b0e13;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    container-type: size; 

    /* Variables (Small Mode) */
    --v-font-xs: 9px;
    --v-font-sm: 10px;
    --v-font-md: 12px;
    --v-input-h: 32px;
    --v-gap: 8px;
    --v-pad-x: 18px;
    --v-pad-y: 12px;
    --v-btn-h: 26px;
    
    /* Task List Variables */
    --v-task-pad-y: 12px;
    --v-task-gap: 4px;
    --v-font-task-name: 12px;
    --v-font-task-meta: 10px;
}

/* === Responsive Container Queries === */
@container (min-height: 450px) {
  .analysis-terminal-container {
    --v-font-xs: 11px;
    --v-font-sm: 12px;
    --v-font-md: 13px;
    --v-input-h: 40px;
    --v-gap: 12px;
    --v-pad-x: 24px;
    --v-pad-y: 18px;
    --v-btn-h: 32px;
    --v-task-pad-y: 16px;
    --v-task-gap: 6px;
    --v-font-task-name: 13px;
    --v-font-task-meta: 11px;
  }
}

@container (min-height: 700px) {
  .analysis-terminal-container {
    --v-font-xs: 12px;
    --v-font-sm: 13px;
    --v-font-md: 15px;
    --v-input-h: 48px;
    --v-gap: 20px;
    --v-pad-x: 32px;
    --v-pad-y: 24px;
    --v-btn-h: 40px;
    --v-task-pad-y: 22px;
    --v-task-gap: 8px;
    --v-font-task-name: 15px;
    --v-font-task-meta: 12px;
  }
}

/* === SIDEBAR === */
.pane-left { background: rgba(5, 7, 10, 0.5); backdrop-filter: blur(10px); width: 280px; border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; flex-shrink: 0; z-index: 20; }
.sidebar-header { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 15px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.sb-title { font-size: 10px; font-weight: bold; color: #888; letter-spacing: 1px; }
.new-task-icon-btn { width: 20px; height: 20px; border-radius: 50%; background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; }

.task-list { flex: 1; overflow-y: auto; width: 100%; }

.task-item { padding: var(--v-task-pad-y) 15px; border-bottom: 1px solid rgba(255,255,255,0.03); position: relative; cursor: pointer; transition: all 0.2s; }
.task-item:hover { background: rgba(255,255,255,0.02); }
.task-item.active { background: linear-gradient(90deg, rgba(0, 210, 255, 0.08), transparent); }
.task-status-bar { width: 3px; height: 100%; position: absolute; left: 0; top: 0; transition: 0.2s; }
.task-item.active .task-status-bar { background: #00d2ff; box-shadow: 0 0 10px #00d2ff; }
.task-item.running .task-status-bar { background: #00ff88; box-shadow: 0 0 10px #00ff88; }

.task-content { display: flex; flex-direction: column; gap: var(--v-task-gap); margin-right: 20px; }
.task-row-main { display: flex; justify-content: space-between; align-items: center; }
.task-name { font-size: var(--v-font-task-name); font-weight: 700; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-tag { font-size: 9px; padding: 2px 6px; border-radius: 2px; text-transform: uppercase; background: rgba(255,255,255,0.1); color: #aaa; }
.status-tag.running { background: rgba(0, 255, 136, 0.15); color: #00ff88; }
.status-tag.completed { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
.task-details { display: flex; flex-direction: column; gap: 2px; }
.task-params { font-size: var(--v-font-task-meta); color: #888; font-family: monospace; display: flex; justify-content: space-between; }
.param-name { color: #00d2ff; margin-right: 6px; }
.param-val { color: #666; }
.task-meta { font-size: var(--v-font-task-meta); color: #555; }
.del-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #555; opacity: 0; font-size: 12px; cursor: pointer; transition: 0.2s; }
.task-item:hover .del-btn { opacity: 1; } .del-btn:hover { color: #ff5252; }

/* === MAIN AREA LAYOUT === */
.panes-wrapper { 
    flex: 1; display: flex; overflow: hidden; position: relative; width: 100%;
}

/* === CONFIG MODE === */
.config-mode-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: radial-gradient(circle at 80% 20%, rgba(0, 210, 255, 0.03), transparent 60%); z-index: 10; }
.config-body { flex: 1; width: 100%; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0; overflow-y: auto; overflow-x: hidden; }
.config-column { padding: var(--v-pad-y) var(--v-pad-x); display: flex; flex-direction: column; gap: var(--v-gap); min-width: 0; position: relative; box-sizing: border-box; }
.config-column.left-col { z-index: 50; }
.config-column.right-col { z-index: 40; border-left: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.01); }
.column-header { display: flex; align-items: center; margin-bottom: 2px; }
.step-label { font-size: var(--v-font-xs); font-weight: 800; color: #666; letter-spacing: 1px; }
.step-label.sub { color: #555; margin-bottom: 4px; display: block; letter-spacing: 0.5px; }
.control-row { display: flex; flex-direction: column; gap: 4px; position: relative; width: 100%; }
.control-row.spacer-top { margin-top: var(--v-gap); }
.control-row.tight-top { margin-top: calc(var(--v-gap) / 2); }
.row-label-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4px; height: 20px; }
.config-footer { height: calc(var(--v-btn-h) + 14px); width: 100%; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(15, 20, 25, 0.95); display: flex; align-items: center; justify-content: space-between; padding: 0 var(--v-pad-x); flex-shrink: 0; gap: 20px; box-sizing: border-box; z-index: 100; }
.footer-left, .footer-right { flex-shrink: 0; }
.footer-spacer { flex: 1; }

/* === RESULT MODE === */
.result-mode-container { display: flex; flex: 1; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.pane-middle { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pane-toolbar { height: 40px; flex-shrink: 0; display: flex; align-items: center; padding: 0 15px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); }
.scrollable-tabs { overflow-x: auto; white-space: nowrap; scrollbar-width: none; }
.scrollable-tabs::-webkit-scrollbar { display: none; }
.dynamic-tabs { display: flex; align-items: center; gap: 5px; height: 100%; }
.tab-divider { width: 1px; height: 14px; background: rgba(255,255,255,0.1); margin: 0 5px; flex-shrink: 0; }
.tab-group button { background: transparent; border: none; color: #666; padding: 6px 10px; cursor: pointer; font-size: 10px; font-weight: 600; border-bottom: 2px solid transparent; }
.tab-group button.active { color: #00d2ff; border-bottom-color: #00d2ff; }

/* Canvas Container & Split View */
.canvas-container { flex: 1; position: relative; padding: 10px; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.chart-wrapper { position: relative; width: 100%; flex: 1; min-height: 0; }

.split-layout .chart-wrapper {
  flex: 1; /* Each takes 50% */
  display: flex; flex-direction: column;
}
.chart-separator { height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0; width: 100%; flex-shrink: 0; }
.chart-label-overlay { 
  position: absolute; top: 10px; right: 10px; font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.15); pointer-events: none; z-index: 10;
}

/* === COMPONENTS (Inputs, Metrics, etc) === */
.custom-select-container { position: relative; width: 100%; }
.compact-select { background: rgba(15, 20, 25, 0.6); border: 1px solid rgba(255,255,255,0.1); height: var(--v-input-h); padding: 0 10px; display: flex; align-items: center; gap: 8px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-family: "Consolas", monospace; box-sizing: border-box; }
.compact-select:hover { border-color: #00d2ff; background: rgba(0,210,255,0.05); }
.compact-select.active { border-color: #00d2ff; }
.select-label { font-size: var(--v-font-sm); font-weight: bold; color: #00d2ff; letter-spacing: 0.5px; }
.selected-val { font-size: var(--v-font-md); color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.selected-val.placeholder { color: #555; font-style: italic; }
.arrow { font-size: var(--v-font-sm); color: #00d2ff; opacity: 0.7; }
.mode-switch { display: flex; background: rgba(0,0,0,0.4); padding: 2px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05); }
.mode-switch button { background: transparent; border: none; color: #666; padding: 1px 8px; font-size: var(--v-font-xs); cursor: pointer; border-radius: 2px; transition: 0.2s; }
.mode-switch button.active { background: #00d2ff; color: #000; font-weight: bold; }
.range-grid { display: flex; align-items: center; gap: 6px; width: 100%; }
.settings-grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--v-gap); width: 100%; }
.field-box.compact { flex: 1; display: flex; flex-direction: row; align-items: center; gap: 8px; background: rgba(15, 20, 25, 0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0 10px; height: var(--v-input-h); border-radius: 4px; transition: 0.2s; min-width: 0; box-sizing: border-box; }
.field-box.compact:focus-within { border-color: #00d2ff; }
.field-box.compact.full-width { width: 100%; flex: none; display: flex; }
.field-box.compact.full-width input { flex: 1; width: auto; min-width: 0; text-align: right; }
.field-label { font-size: var(--v-font-xs); color: #666; white-space: nowrap; letter-spacing: 0.5px; }
.field-box.compact input { font-size: var(--v-font-md); text-align: right; border: none; background: transparent; color: #eee; outline: none; flex: 1; width: 100%; font-family: "Consolas", monospace; padding: 0; height: 100%; }
.connector { font-size: var(--v-font-xs); color: #444; }
.metrics-container.compact { display: flex; flex-wrap: wrap; gap: 8px; }
.metric-card.compact { display: flex; align-items: center; gap: 8px; height: var(--v-input-h); padding: 0 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; cursor: pointer; user-select: none; transition: 0.2s; box-sizing: border-box; }
.metric-card.compact:hover { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); }
.metric-card.compact.active { border-color: #00d2ff; background: rgba(0, 210, 255, 0.1); }
.metric-name { font-size: var(--v-font-sm); color: #888; font-weight: 500; letter-spacing: 0.5px; }
.metric-card.compact.active .metric-name { color: #fff; text-shadow: 0 0 5px rgba(0,210,255,0.5); }
.metric-checkbox { width: 10px; height: 10px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.4); border-radius: 2px; position: relative; transition: all 0.2s ease; flex-shrink: 0; }
.metric-card.compact.active .metric-checkbox { border-color: #00d2ff; background: rgba(0, 210, 255, 0.3); box-shadow: 0 0 6px rgba(0, 210, 255, 0.4); }
.metric-checkbox::after { content: ''; position: absolute; top: 2px; left: 2px; right: 2px; bottom: 2px; background: #00d2ff; transform: scale(0); opacity: 0; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.metric-card.compact.active .metric-checkbox::after { transform: scale(1); opacity: 1; }
.ai-toggle-compact { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.toggle-track { width: 24px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 10px; position: relative; transition: 0.2s; }
.toggle-knob { width: 10px; height: 10px; background: #888; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.2s; }
.ai-toggle-compact.active .toggle-track { background: rgba(168, 85, 247, 0.3); }
.ai-toggle-compact.active .toggle-knob { background: #d8b4fe; left: 12px; }
.ai-toggle-compact .text { font-size: var(--v-font-sm); color: #888; font-weight: 600; }
.run-btn-compact { height: var(--v-btn-h); padding: 0 16px; background: #00d2ff; border: none; border-radius: 3px; color: #000; font-size: var(--v-font-sm); font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
.run-btn-compact:hover { background: #66e0ff; box-shadow: 0 0 10px rgba(0,210,255,0.3); }
.run-btn-compact:disabled { background: #333; color: #555; cursor: not-allowed; box-shadow: none; }
.custom-options-list { position: absolute; top: calc(100% + 5px); left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: #0d1117; border: 1px solid #00d2ff; border-radius: 4px; z-index: 1000; box-shadow: 0 10px 40px rgba(0,0,0,0.8); min-height: 30px; }
.option-item { padding: 8px 15px; font-size: var(--v-font-md); color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
.option-item:hover { background: rgba(0, 210, 255, 0.1); color: #fff; }
.option-empty { padding: 10px; font-size: var(--v-font-sm); color: #666; font-style: italic; }
.overlay-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; font-size: 12px; pointer-events: none; }
.pane-right { display: flex; flex-direction: column; background: #0b0e13; flex-shrink: 0; border-left: 1px solid rgba(255,255,255,0.06); }
.text-content { flex: 1; padding: 15px; overflow-y: auto; color: #ccc; font-size: 11px; font-family: monospace; }
.log-viewer { white-space: pre-wrap; color: #aaa; }
.empty-text { text-align: center; color: #444; margin-top: 40px; }
.resizer-v { width: 2px; height: 100%; background: #000; opacity: 0.5; cursor: col-resize; flex-shrink: 0; z-index: 30; }
.resizer-v:hover { background: #00d2ff; opacity: 1; width: 4px; }
.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
.fade-down-enter-active, .fade-down-leave-active { transition: all 0.2s ease; }
.fade-down-enter-from, .fade-down-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
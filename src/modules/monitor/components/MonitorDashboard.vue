<template>
  <div class="dashboard-container custom-scroll">
    <div class="dashboard-top-section">
      <div class="overview-compact">
        <div class="metrics-strip">
          <div class="metric-pill primary">
            <span class="metric-label">Total</span>
            <span class="metric-value">{{ stats.total }}</span>
            <span class="metric-meta">Basic {{ stats.basicCount }} / Analysis {{ stats.analysisCount }}</span>
          </div>
          <div class="metric-pill warn">
            <span class="metric-label">Active</span>
            <span class="metric-value">{{ stats.active }}</span>
            <span class="metric-meta">Pending or running</span>
          </div>
          <div class="metric-pill success">
            <span class="metric-label">Success</span>
            <span class="metric-value">{{ stats.successRate }}<span class="metric-unit">%</span></span>
            <span class="metric-meta">Completed ratio</span>
          </div>
          <div class="metric-pill neutral">
            <span class="metric-label">Avg Duration</span>
            <span class="metric-value">{{ stats.avgDuration }}<span class="metric-unit">s</span></span>
            <span class="metric-meta">Completed jobs</span>
          </div>
        </div>

        <div class="charts-row compact">
        <!-- Status Distribution -->
        <div class="chart-card donut-card">
          <div class="card-title">STATUS DISTRIBUTION</div>
          <div v-if="hasData" class="chart-wrapper" ref="statusChartRef"></div>
          <div v-else class="no-data-chart">
               <div class="no-data-icon">📊</div>
               <div>No Data Available</div>
          </div>
        </div>
  
        <!-- History Trend -->
        <div class="chart-card trend-card">
          <div class="card-title">7-DAY ACTIVITY TREND</div>
          <div v-if="hasData" class="chart-wrapper trend-chart-wrapper" ref="historyChartRef"></div>
          <div v-else class="no-data-chart">
               <div class="no-data-icon">📉</div>
               <div>No Data Available</div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- 3. Comprehensive Activity Table -->
    <div class="table-card">
      <div class="card-header-flex">
        <div class="card-title">PROJECT TASKS & ACTIVITIES</div>
        <div class="filter-controls">
           <!-- Type Filter -->
           <div class="filter-group">
              <span class="filter-label">TYPE:</span>
              <select v-model="filters.type" class="filter-select">
                 <option value="ALL">ALL</option>
                 <option value="BASIC">BASIC</option>
                 <option value="ANALYSIS">ANALYSIS</option>
              </select>
           </div>
           
           <!-- Status Filter -->
           <div class="filter-group">
              <span class="filter-label">STATUS:</span>
              <select v-model="filters.status" class="filter-select">
                 <option value="ALL">ALL</option>
                 <option value="ACTIVE">ACTIVE</option>
                 <option value="COMPLETED">COMPLETED</option>
                 <option value="FAILED">FAILED</option>
              </select>
           </div>

           <!-- Visualizer Filter -->
           <div class="filter-group">
               <label class="checkbox-label">
                   <input type="checkbox" v-model="filters.onlyFoc">
                   <span>FOC Filter</span>
               </label>
           </div>
        </div>
      </div>
      <div class="table-container">
        <table class="dash-table compact">
          <thead>
            <tr>
              <th style="width: 34%">TASK INFO</th>
              <th style="width: 15%">CREATED AT</th>
              <th style="width: 12%">TYPE</th>
              <th style="width: 12%">STATUS</th>
              <th style="width: 12%">FOC STATUS</th>
              <th style="width: 15%; text-align: center">RESULTS</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="task in filteredTasks" :key="task.id">
            <tr
              @click="$emit('view-task', task.id)"
              class="task-row"
              :class="{ active: task.id === selectedTaskId }"
            >
              <!-- Task Info -->
              <td>
                <div class="cell-group">
                    <div class="task-name" :title="task.name">{{ task.name }}</div>
                    <div class="task-id">{{ task.id.slice(0,8) }}</div>
                </div>
              </td>
              
              <!-- Created At -->
              <td>
                 <div class="cell-group">
                    <span class="time-main">{{ formatTime(task.created_at).split(' ')[0] }}</span>
                    <span class="time-sub">{{ formatTime(task.created_at).split(' ')[1] }}</span>
                 </div>
              </td>

              <!-- Type -->
              <td>
                 <span class="type-tag" :class="(task.type || 'BASIC').toLowerCase()">{{ task.type || 'BASIC' }}</span>
              </td>

              <!-- Status -->
              <td>
                 <span class="status-badge" :class="task.status.toLowerCase()">{{ task.status }}</span>
              </td>

                <!-- FOC Status -->
                <td>
                  <button
                    v-if="hasFoc(task)"
                    class="foc-status-badge enabled foc-preview-trigger"
                    @click.stop="toggleFocPreview(task.id)"
                  >
                    {{ expandedFocTaskId === task.id ? 'HIDE PREVIEW' : 'SHOW PREVIEW' }}
                  </button>
                  <span v-else class="foc-status-badge disabled">NONE</span>
                </td>

              <!-- Results -->
              <td class="col-action" style="text-align: center">
                 <div class="action-group" style="justify-content: center">
                     <button class="icon-btn primary" @click.stop="$emit('view-result', task)" title="View Results">
                        📊 VIEW
                     </button>
                 </div>
              </td>

            </tr>
            <tr v-if="expandedFocTaskId === task.id && hasFoc(task)" class="foc-preview-row">
              <td colspan="6">
                <TaskFocPreview :task="task" :active="expandedFocTaskId === task.id" />
              </td>
            </tr>
            </template>
            <tr v-if="filteredTasks.length === 0">
               <td colspan="7" class="empty-cell">No matching tasks found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { TaskFocPreview } from '../../simulation/public';
import * as echarts from 'echarts';
import { visualizerApi } from '../../../api/visualizer';
import { $notify } from '../../../utils/notification';
import { getTaskFocConfig, hasTaskFoc } from '../../../utils/taskFoc';

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  selectedTaskId: { type: String, default: null }
});

const hasData = computed(() => props.tasks && props.tasks.length > 0);

defineEmits(['view-task', 'view-result']);

// Refs
const statusChartRef = ref(null);
const historyChartRef = ref(null);
let statusChart = null;
let historyChart = null;

// State
const stats = ref({
  total: 0,
  active: 0,
  successRate: 0,
  avgDuration: 0,
  basicCount: 0,
  analysisCount: 0
});
const recentTasks = ref([]);
const filters = ref({
    type: 'ALL',
    status: 'ALL',
  onlyFoc: false
});
const processes = ref([]);
const expandedFocTaskId = ref(null);

const loadingProcs = ref(false);

// Helpers
const formatTime = (iso) => new Date(iso).toLocaleString();
const formatUnixTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
};
const getFileName = (path) => {
    if (!path) return '-';
    return path.split(/[/\\]/).pop();
};
const formatDuration = (task) => {
   if (!task.created_at) return '-';
   const start = new Date(task.created_at).getTime();
   const end = task.updated_at ? new Date(task.updated_at).getTime() : Date.now();
   if (['PENDING', 'RUNNING'].includes(task.status)) return 'Running...';
   const diff = Math.floor((end - start) / 1000);
   return diff > 60 ? `${(diff/60).toFixed(1)}m` : `${diff}s`;
};

const getActiveProc = (taskId) => {
    return processes.value.find(p => p.task_id === taskId);
};

const hasFoc = (task) => hasTaskFoc(task);

const toggleFocPreview = (taskId) => {
  expandedFocTaskId.value = expandedFocTaskId.value === taskId ? null : taskId;
};

// Filter Logic
const filteredTasks = computed(() => {
    let result = [...props.tasks];

    // 1. Filter Type
    if (filters.value.type !== 'ALL') {
        result = result.filter(t => (t.type || 'BASIC') === filters.value.type);
    }

    // 2. Filter Status
    if (filters.value.status !== 'ALL') {
        if (filters.value.status === 'ACTIVE') {
            result = result.filter(t => ['PENDING', 'RUNNING'].includes(t.status));
        } else {
            result = result.filter(t => t.status === filters.value.status);
        }
    }

    // 3. Filter FOC
    if (filters.value.onlyFoc) {
      result = result.filter(t => hasFoc(t));
    }

    // Sort by date desc
    result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    // Limit to 50 for performance if list is huge, or just return all
    return result.slice(0, 50);
});

// Calculation Logic (Preserved stats logic, only charts update)
const calculateStats = () => {
  if (!props.tasks.length) {
      stats.value = {
          total: 0,
          active: 0,
          successRate: 0,
          avgDuration: 0,
          basicCount: 0,
          analysisCount: 0
      };
      if (statusChart) {
          statusChart.dispose();
          statusChart = null;
      }
      if (historyChart) {
          historyChart.dispose();
          historyChart = null;
      }
      return;
  }
  
  const total = props.tasks.length;
  const active = props.tasks.filter(t => ['PENDING', 'RUNNING'].includes(t.status)).length;
  const completed = props.tasks.filter(t => t.status === 'COMPLETED').length;
  const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
  
  const completedTasks = props.tasks.filter(t => t.status === 'COMPLETED' && t.updated_at);
  let totalDur = 0;
  if (completedTasks.length > 0) {
    totalDur = completedTasks.reduce((acc, t) => {
       const d = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000;
       return acc + d;
    }, 0);
  }
  const avgDuration = completedTasks.length > 0 ? (totalDur / completedTasks.length).toFixed(0) : 0;

  const basicCount = props.tasks.filter(t => (t.type || 'BASIC') === 'BASIC').length;
  const analysisCount = props.tasks.filter(t => (t.type || 'BASIC') === 'ANALYSIS').length;

  stats.value = {
    total,
    active,
    successRate,
    avgDuration,
    basicCount,
    analysisCount
  };

  recentTasks.value = [...props.tasks]
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    
  // Wait for v-if to render elements then init/update
  nextTick(() => {
     if (!statusChart && statusChartRef.value) {
        statusChart = echarts.init(statusChartRef.value);
     }
     if (!historyChart && historyChartRef.value) {
        historyChart = echarts.init(historyChartRef.value);
     }
     updateCharts();
  });
};

const updateCharts = () => {
  if (!statusChart || !historyChart) return;
  
  // 1. Status Chart (Nested Pie / Sunburst)
  // Inner: Type (Basic/Analysis), Outer: Status
  const dataBasic = { COMPLETED: 0, FAILED: 0, RUNNING: 0, STOPPED: 0, PENDING: 0 };
  const dataAnalysis = { COMPLETED: 0, FAILED: 0, RUNNING: 0, STOPPED: 0, PENDING: 0 };
  
  props.tasks.forEach(t => {
      const type = t.type || 'BASIC';
      const status = t.status;
      if (type === 'BASIC') dataBasic[status] = (dataBasic[status] || 0) + 1;
      else dataAnalysis[status] = (dataAnalysis[status] || 0) + 1;
  });

  const innerData = [
      { value: Object.values(dataBasic).reduce((a,b)=>a+b,0), name: 'Basic', itemStyle: { color: '#007aff' } },
      { value: Object.values(dataAnalysis).reduce((a,b)=>a+b,0), name: 'Analysis', itemStyle: { color: '#7b00ff' } }
  ].filter(x => x.value > 0);

  // Outer ring colors map
  const colorMap = { COMPLETED: '#00ff88', FAILED: '#ff5252', RUNNING: '#00d2ff', STOPPED: '#888', PENDING: '#666' };
  
  const outerData = [];
  // Basic slice breakdowns
  Object.entries(dataBasic).forEach(([stat, val]) => {
      if(val>0) outerData.push({ value: val, name: `Basic-${stat}`, itemStyle: { color: colorMap[stat] } });
  });
  // Analysis slice breakdowns
  Object.entries(dataAnalysis).forEach(([stat, val]) => {
      if(val>0) outerData.push({ value: val, name: `Analysis-${stat}`, itemStyle: { color: colorMap[stat] } }); 
  });


  statusChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
        {
            name: 'Task Type', type: 'pie', selectedMode: 'single',
            radius: [0, '40%'], label: { position: 'inner', fontSize: 10, color: '#fff' },
            data: innerData
        },
        {
            name: 'Status', type: 'pie', radius: ['55%', '75%'],
            label: { show: false },
            data: outerData
        }
    ]
  });

  // 2. History Chart (Stacked Bar: Basic vs Analysis)
  const days = [];
  const basicSeries = [];
  const analysisSeries = [];
  
  for (let i=6; i>=0; i--) {
     const d = new Date();
     d.setDate(d.getDate() - i);
     const dateStr = d.toISOString().split('T')[0];
     days.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
     
     const dayTasks = props.tasks.filter(t => t.created_at && t.created_at.startsWith(dateStr));
     basicSeries.push(dayTasks.filter(t => (t.type || 'BASIC') === 'BASIC').length);
     analysisSeries.push(dayTasks.filter(t => t.type === 'ANALYSIS').length);
  }

  historyChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      textStyle: { color: '#888', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
      bottom: 0
    },
    grid: { top: 8, left: 8, right: 8, bottom: 28, containLabel: true },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#666' } },
    yAxis: { type: 'value', splitNumber: 3, splitLine: { lineStyle: { color: '#222' } }, axisLabel: { color: '#666' } },
    series: [
      { name: 'Basic', type: 'bar', stack: 'total', data: basicSeries, itemStyle: { color: '#007aff' } },
      { name: 'Analysis', type: 'bar', stack: 'total', data: analysisSeries, itemStyle: { color: '#7b00ff' } }
    ]
  });
};

const openProcess = (port) => {
    if (!port) return;
    const url = `http://${window.location.hostname}:${port}`;
    window.open(url, '_blank');
};

const killProcess = async (taskId) => {
    try {
        await visualizerApi.stopHdf5(taskId);
        $notify({ title: 'SUCCESS', message: 'Visualizer terminated.', type: 'success' });
        fetchVisualizerData(); 
    } catch {
        $notify({ title: 'ERROR', message: 'Failed to stop process.', type: 'error' });
    }
};

const fetchVisualizerData = async () => {
    loadingProcs.value = true;
    try {
        const procData = await visualizerApi.getActiveProcesses();
        processes.value = Array.isArray(procData) ? procData : [];
    } catch (e) {
        console.error("Failed to fetch visualizer data", e);
    } finally {
        loadingProcs.value = false;
    }
};

const fetchAllData = () => {
    fetchVisualizerData();
    // props.tasks is reactive, so parent handles that, but we can emit refresh if needed?
    // For now just refresh local data
};

const initCharts = () => {
    if (statusChartRef.value) {
       statusChart = echarts.init(statusChartRef.value);
    }
    if (historyChartRef.value) {
       historyChart = echarts.init(historyChartRef.value);
    }
    calculateStats();
    fetchVisualizerData(); // Fetch extra data
    
    window.addEventListener('resize', handleResize);
};

const handleResize = () => {
   statusChart?.resize();
   historyChart?.resize();
};

onMounted(() => {
  nextTick(initCharts);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  statusChart?.dispose();
  historyChart?.dispose();
});

watch(() => props.tasks, calculateStats, { deep: true });

</script>

<style scoped>
.dashboard-container {
  padding: 30px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
}

.dashboard-top-section {
  flex: 0 0 auto;
  min-height: 0;
}

.overview-compact {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(420px, 1.4fr);
  gap: 14px;
  margin-bottom: 14px;
}

.metrics-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-height: 0;
}

.metric-pill {
  min-width: 0;
  min-height: 68px;
  padding: 10px 12px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(13, 17, 23, 0.62);
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
  column-gap: 10px;
  align-items: center;
}

.metric-pill.primary { border-color: rgba(0, 210, 255, 0.18); }
.metric-pill.warn { border-color: rgba(255, 202, 40, 0.18); }
.metric-pill.success { border-color: rgba(0, 255, 136, 0.18); }
.metric-pill.neutral { border-color: rgba(148, 163, 184, 0.14); }

.metric-label {
  min-width: 0;
  color: #8b949e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: #f8fafc;
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.metric-unit {
  margin-left: 2px;
  color: #8b949e;
  font-size: 12px;
}

.metric-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #5f6b76;
  font-size: 10px;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 14px;
  height: 172px;
  min-height: 0;
}

.chart-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex; flex-direction: column;
  min-height: 0;
}

.card-title {
  font-size: 11px; font-weight: 700; color: #888;
  letter-spacing: 1px; margin-bottom: 12px;
}

.chart-wrapper { flex: 1; width: 100%; height: 100%; min-height: 0; }

.trend-chart-wrapper {
  min-height: 128px;
}

.table-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
  flex: 1 1 auto;
  min-height: 220px;
  margin-bottom: 0;
}

.card-header-flex {
    padding: 12px 20px;
    border-bottom: 1px solid #30363d;
    display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  flex-wrap: wrap;
    background: rgba(255,255,255,0.02);
}

.card-title {
  font-size: 11px; font-weight: 700; color: #888;
  letter-spacing: 1px; margin: 0; /* Remove bottom margin as it's flex child now */
}

.filter-controls {
  display: flex; align-items: center; gap: 16px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filter-group {
    display: flex; align-items: center; gap: 6px; font-size: 10px; color: #666; font-weight: 600;
  flex-shrink: 0;
}

.filter-select {
    background: #05070a; border: 1px solid #30363d; color: #ccc;
    font-size: 10px; padding: 2px 6px; border-radius: 4px; outline: none;
    font-family: inherit; cursor: pointer;
}
.filter-select:focus { border-color: #007aff; }

.checkbox-label {
    display: flex; align-items: center; gap: 6px; cursor: pointer; 
    user-select: none; color: #ccc;
}
.checkbox-label input { margin: 0; cursor: pointer; }
.checkbox-label span { font-size: 10px; font-weight: 600; }

.table-container { 
  padding: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.dash-table { width: 100%; min-width: 900px; border-collapse: separate; border-spacing: 0; font-size: 11px; }
.dash-table th { 
    text-align: left; padding: 12px 16px; color: #666; font-weight: 700; 
    border-bottom: 1px solid #30363d; letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 1;
  background: #0d1117;
}
.dash-table td { padding: 10px 16px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.02); vertical-align: middle; }
.dash-table tr { transition: background 0.2s; }
.dash-table tr:hover { background: rgba(255,255,255,0.03); cursor: pointer; }
.task-row.active { background: rgba(0, 210, 255, 0.08); }
.task-row.active td:first-child { box-shadow: inset 3px 0 0 #00d2ff; }

/* Cell Groups */
.cell-group { display: flex; flex-direction: column; gap: 3px; }
.task-name { font-weight: 600; color: #fff; font-size: 12px; }
.task-id { font-family: 'Consolas', monospace; color: #666; font-size: 10px; }

.status-badge {
    padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase;
    display: inline-block; width: fit-content;
}
.status-badge.completed { background: rgba(0, 255, 136, 0.1); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.2); }
.status-badge.failed { background: rgba(255, 82, 82, 0.1); color: #ff5252; border: 1px solid rgba(255, 82, 82, 0.2); }
.status-badge.running { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.2); box-shadow: 0 0 5px rgba(0,210,255,0.2); }
.status-badge.stopped { background: rgba(255,255,255,0.1); color: #aaa; border: 1px solid rgba(255,255,255,0.2); }
.status-badge.pending { background: rgba(255,255,0,0.1); color: #ffca28; border: 1px solid rgba(255,255,0,0.2); }
.foc-status-badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; display: inline-block; width: fit-content; }
.foc-status-badge.enabled { background: rgba(34, 211, 238, 0.12); color: #67e8f9; border: 1px solid rgba(34, 211, 238, 0.3); }
.foc-status-badge.disabled { background: rgba(148, 163, 184, 0.08); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }
.foc-preview-trigger { cursor: pointer; transition: 0.2s; }
.foc-preview-trigger:hover { background: rgba(34, 211, 238, 0.2); color: #cffafe; }

.time-main { color: #ccc; font-weight: 500; }
.time-sub { color: #666; font-size: 10px; }

/* Visualizer Active State */
.vis-active { display: flex; align-items: center; gap: 6px; }
.vis-dot { width: 6px; height: 6px; border-radius: 50%; background: #00d2ff; box-shadow: 0 0 5px #00d2ff; animation: pulse 1.5s infinite; }
.vis-text { color: #00d2ff; font-weight: 600; }
.vis-text-mute { color: #444; }

/* Action Buttons */
.action-group { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.icon-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s;
    background: transparent; border: 1px solid transparent;
}
.icon-btn.primary { color: #00d2ff; border-color: rgba(0, 210, 255, 0.3); background: rgba(0, 210, 255, 0.05); }
.icon-btn.primary:hover { background: rgba(0, 210, 255, 0.15); color: #fff; }

.icon-btn.success { color: #00ff88; border-color: rgba(0, 255, 136, 0.3); background: rgba(0, 255, 136, 0.05); }
.icon-btn.success:hover { background: rgba(0, 255, 136, 0.15); color: #fff; }

.icon-btn.danger { color: #ff5252; border-color: rgba(255, 82, 82, 0.3); background: rgba(255, 82, 82, 0.05); }
.icon-btn.danger:hover { background: rgba(255, 82, 82, 0.15); color: #fff; }

@keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

.vis-active-container { display: flex; flex-direction: row; align-items: center; gap: 12px; }
.vis-status { display: flex; align-items: center; gap: 6px; }
.vis-actions { display: flex; gap: 6px; }
.icon-btn.small { padding: 2px 6px; font-size: 9px; }

.empty-cell { text-align: center; padding: 30px; color: #555; font-style: italic; }
.foc-preview-row td { padding: 0; background: #0a0f15; border-bottom: 1px solid rgba(255,255,255,0.02); }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

.type-tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
.type-tag.basic { color: #007aff; border-color: rgba(0, 122, 255, 0.3); background: rgba(0, 122, 255, 0.05); }
.type-tag.analysis { color: #bf5af2; border-color: rgba(191, 90, 242, 0.3); background: rgba(191, 90, 242, 0.05); }

@media (max-width: 1000px) {
  .overview-compact {
    grid-template-columns: 1fr;
  }

  .charts-row { grid-template-columns: 1fr; height: auto; }
  .donut-card { height: 160px; }
  .trend-card { height: 170px; }

  .card-header-flex {
    align-items: flex-start;
  }

  .filter-controls {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-height: 900px) {
  .dashboard-container {
    padding-top: 20px;
    padding-bottom: 20px;
    gap: 16px;
  }

  .charts-row {
    height: 156px;
  }
}

@media (max-height: 760px) {
  .dashboard-container {
    padding: 16px;
    gap: 12px;
  }

  .overview-compact {
    gap: 10px;
    margin-bottom: 10px;
  }

  .charts-row {
    height: 144px;
  }

  .chart-card {
    padding: 12px;
  }

  .chart-wrapper {
    min-height: 0;
  }

  .trend-chart-wrapper {
    min-height: 104px;
  }

  .table-card {
    min-height: 180px;
  }
}

@media (max-width: 760px) {
  .metrics-strip {
    grid-template-columns: 1fr;
  }

  .metric-pill {
    min-height: 58px;
  }

  .table-card {
    margin-bottom: 20px;
  }

  .card-header-flex {
    padding: 12px 14px;
  }

  .filter-controls {
    gap: 10px;
  }

  .filter-group {
    width: 100%;
    justify-content: space-between;
  }

  .filter-select {
    min-width: 120px;
  }

  .table-container {
    min-height: 0;
  }

  .dash-table th,
  .dash-table td {
    padding-left: 12px;
    padding-right: 12px;
  }

  .vis-active-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.no-data-chart {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #555;
    font-size: 12px;
    font-style: italic;
    height: 100%;
    min-height: 0;
}
.no-data-icon {
    font-size: 24px;
    margin-bottom: 8px;
    opacity: 0.5;
}


</style>

<template>
  <div class="dashboard-container custom-scroll">
    <!-- Top Section Wrapper -->
    <div class="dashboard-top-section">
      <!-- Header -->
      <div class="dash-header">
        <div class="title-section">
          <h2>SYSTEM OVERVIEW</h2>
          <div class="subtitle">Real-time simulation metrics and analysis</div>
        </div>
        <div class="actions">
           <div class="last-update">Last updated: {{ lastUpdated }}</div>
           <button class="icon-btn-text" @click="showOverview = !showOverview" :title="showOverview ? 'Collapse Overview' : 'Expand Overview'">
              {{ showOverview ? 'Hide Stats ▲' : 'Show Stats ▼' }}
           </button>
           <button class="refresh-btn" @click="fetchAllData" :disabled="loadingProcs" title="Refresh Data">
              {{ loadingProcs ? '...' : '↻' }}
           </button>
        </div>
      </div>
  
      <div v-show="showOverview">
      <!-- 1. KPI Grid -->
      <div class="kpi-grid">
        <KPICard label="Total Missions" :value="stats.total" type="primary">
          <template #icon>📌</template>
          <template #footer>
             <div class="type-stats">
                <span title="Basic Simulations">Basic: <b>{{ stats.basicCount }}</b></span>
                <span class="divider">|</span>
                <span title="Advanced Analysis">Analysis: <b>{{ stats.analysisCount }}</b></span>
             </div>
          </template>
        </KPICard>
        
        <KPICard label="Active Jobs" :value="stats.active" type="warn">
           <template #icon>⚡</template>
        </KPICard>
  
        <KPICard label="Success Rate" :value="stats.successRate" unit="%" type="success">
           <template #icon>🎯</template>
        </KPICard>
  
        <KPICard label="Avg Duration" :value="stats.avgDuration" unit="s" type="primary">
           <template #icon>⏱</template>
        </KPICard>
      </div>
  
      <!-- 2. Charts Row -->
      <div class="charts-row">
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
          <div v-if="hasData" class="chart-wrapper" ref="historyChartRef"></div>
          <div v-else class="no-data-chart">
               <div class="no-data-icon">📉</div>
               <div>No Data Available</div>
          </div>
        </div>
      </div>
      </div> <!-- End v-show -->
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
                   <input type="checkbox" v-model="filters.onlyVisualizer">
                   <span>HDF5 Running</span>
               </label>
           </div>
        </div>
      </div>
      <div class="table-container">
        <table class="dash-table compact">
          <thead>
            <tr>
              <th style="width: 30%">TASK INFO</th>
              <th style="width: 15%">CREATED AT</th>
              <th style="width: 10%">TYPE</th>
              <th style="width: 10%">STATUS</th>
              <th style="width: 10%; text-align: center">RESULTS</th>
              <th style="width: 25%">VISUALIZER</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in filteredTasks" :key="task.id" @click="$emit('view-task', task.id)" class="task-row">
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

              <!-- Results -->
              <td class="col-action" style="text-align: center">
                 <div class="action-group" style="justify-content: center">
                     <button class="icon-btn primary" @click.stop="$emit('view-result', task)" title="View Results">
                        📊 VIEW
                     </button>
                 </div>
              </td>

              <!-- Visualizer Info & Actions -->
              <td>
                 <div v-if="getActiveProc(task.id)" class="vis-active-container">
                     <div class="vis-status">
                        <span class="vis-dot"></span>
                        <span class="vis-text">Running (PID {{ getActiveProc(task.id).pid }})</span>
                     </div>
                     <div class="vis-actions">
                        <button class="icon-btn success small" @click.stop="openProcess(getActiveProc(task.id).port)" title="Open Visualizer">
                            🔗 OPEN
                        </button>
                         <button class="icon-btn danger small" @click.stop="killProcess(task.id)" title="Stop Visualizer">
                            ⏹ STOP
                        </button>
                     </div>
                 </div>
                 <div v-else class="vis-inactive">
                     <span class="vis-text-mute">-</span>
                 </div>
              </td>
            </tr>
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
import KPICard from './KPICard.vue';
import * as echarts from 'echarts';
import { visualizerApi } from '../../../api/visualizer';
import { $notify } from '../../../utils/notification';

const props = defineProps({
  tasks: { type: Array, default: () => [] }
});

const hasData = computed(() => props.tasks && props.tasks.length > 0);

defineEmits(['view-task', 'view-result']);

// Refs
const statusChartRef = ref(null);
const historyChartRef = ref(null);
let statusChart = null;
let historyChart = null;

// State
const lastUpdated = ref(new Date().toLocaleTimeString());
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
    onlyVisualizer: false
});
const showOverview = ref(true);
const processes = ref([]);

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

    // 3. Filter Visualizer
    if (filters.value.onlyVisualizer) {
        result = result.filter(t => getActiveProc(t.id));
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
    
  lastUpdated.value = new Date().toLocaleTimeString();
  
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
    legend: { textStyle: { color: '#888' }, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#666' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#222' } }, axisLabel: { color: '#666' } },
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
  overflow-y: auto; /* Enable vertical scroll */
  overflow-x: hidden;
}





.dash-header {
  margin-bottom: 24px;
  display: flex; justify-content: space-between; align-items: flex-end;
}
.dash-header h2 { font-size: 20px; color: #fff; margin: 0; letter-spacing: 2px; }
.subtitle { color: #666; font-size: 13px; margin-top: 4px; }
.last-update { font-size: 11px; color: #444; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  margin-bottom: 24px;
  height: 300px;
}

.chart-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px;
  display: flex; flex-direction: column;
}

.card-title {
  font-size: 11px; font-weight: 700; color: #888;
  letter-spacing: 1px; margin-bottom: 12px;
}

.chart-wrapper { flex: 1; width: 100%; height: 100%; min-height: 200px; }

.table-card {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0;
  overflow: visible; /* Let it expand */
  display: flex; flex-direction: column;
  min-height: 0; /* Allow shrinking to content */
  height: fit-content;
  margin-bottom: 30px; /* Space at bottom */
}

.card-header-flex {
    padding: 12px 20px;
    border-bottom: 1px solid #30363d;
    display: flex; justify-content: space-between; align-items: center;
    background: rgba(255,255,255,0.02);
}

.card-title {
  font-size: 11px; font-weight: 700; color: #888;
  letter-spacing: 1px; margin: 0; /* Remove bottom margin as it's flex child now */
}

.filter-controls {
    display: flex; align-items: center; gap: 16px;
}

.filter-group {
    display: flex; align-items: center; gap: 6px; font-size: 10px; color: #666; font-weight: 600;
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
    /* Remove flex/overflow to let table expand */
}

.dash-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; }
.dash-table th { 
    text-align: left; padding: 12px 16px; color: #666; font-weight: 700; 
    border-bottom: 1px solid #30363d; letter-spacing: 0.5px;
}
.dash-table td { padding: 10px 16px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.02); vertical-align: middle; }
.dash-table tr { transition: background 0.2s; }
.dash-table tr:hover { background: rgba(255,255,255,0.03); cursor: pointer; }

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

.type-stats .type-tag { font-size: 9px; padding: 1px 4px; border-radius: 3px; width: fit-content; }
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

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

.type-stats {
    font-size: 10px; color: #888;
    display: flex; gap: 8px; margin-top: 4px;
}
.type-stats b { color: #ccc; }
.type-stats .divider { color: #444; }

.type-tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
.type-tag.basic { color: #007aff; border-color: rgba(0, 122, 255, 0.3); background: rgba(0, 122, 255, 0.05); }
.type-tag.analysis { color: #bf5af2; border-color: rgba(191, 90, 242, 0.3); background: rgba(191, 90, 242, 0.05); }

@media (max-width: 1000px) {
    .charts-row { grid-template-columns: 1fr; height: auto; }
    .donut-card { height: 300px; }
    .trend-card { height: 300px; }
}

/* Merged Styles */
.refresh-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; transition: color 0.2s; }
.refresh-btn:hover:not(:disabled) { color: #fff; }

.icon-btn-text {
    background: none; border: 1px solid rgba(255,255,255,0.1); color: #888; 
    cursor: pointer; font-size: 11px; padding: 4px 8px; border-radius: 4px;
    margin-right: 8px; transition: all 0.2s; font-weight: 600;
}
.icon-btn-text:hover { color: #fff; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.05); }

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
    min-height: 200px;
}
.no-data-icon {
    font-size: 24px;
    margin-bottom: 8px;
    opacity: 0.5;
}


</style>

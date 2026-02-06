<template>
  <div class="dashboard-container custom-scroll">
    <!-- Header -->
    <div class="dash-header">
      <div class="title-section">
        <h2>SYSTEM OVERVIEW</h2>
        <div class="subtitle">Real-time simulation metrics and analysis</div>
      </div>
      <div class="actions">
         <div class="last-update">Last updated: {{ lastUpdated }}</div>
      </div>
    </div>

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
        <div class="chart-wrapper" ref="statusChartRef"></div>
      </div>

      <!-- History Trend -->
      <div class="chart-card trend-card">
        <div class="card-title">7-DAY ACTIVITY TREND</div>
        <div class="chart-wrapper" ref="historyChartRef"></div>
      </div>
    </div>

    <!-- 3. Recent Activity Table -->
    <div class="table-card">
      <div class="card-title">RECENT ACTIVITY</div>
      <div class="table-container">
        <table class="dash-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>TASK NAME</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>CREATED</th>
              <th>DURATION</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in recentTasks" :key="task.id" @click="$emit('view-task', task.id)">
              <td class="col-id">{{ task.id.slice(0,8) }}</td>
              <td class="col-name">{{ task.name }}</td>
              <td class="col-type">
                  <span class="type-tag" :class="(task.type || 'BASIC').toLowerCase()">{{ task.type || 'BASIC' }}</span>
              </td>
              <td>
                <span class="status-badge" :class="task.status.toLowerCase()">
                  {{ task.status }}
                </span>
              </td>
              <td class="col-time">{{ formatTime(task.created_at) }}</td>
              <td class="col-dur">{{ formatDuration(task) }}</td>
              <td class="col-action">
                 <button 
                   class="view-link-btn" 
                   @click.stop="$emit('view-result', task)"
                   title="View Result"
                 >
                   VIEW
                 </button>
              </td>
            </tr>
            <tr v-if="recentTasks.length === 0">
               <td colspan="7" class="empty-cell">No recent activity</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import KPICard from './KPICard.vue';
import * as echarts from 'echarts';

const props = defineProps({
  tasks: { type: Array, default: () => [] }
});

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

// Helpers
const formatTime = (iso) => new Date(iso).toLocaleString();
const formatDuration = (task) => {
   if (!task.created_at) return '-';
   const start = new Date(task.created_at).getTime();
   const end = task.updated_at ? new Date(task.updated_at).getTime() : Date.now();
   if (['PENDING', 'RUNNING'].includes(task.status)) return 'Running...';
   const diff = Math.floor((end - start) / 1000);
   return diff > 60 ? `${(diff/60).toFixed(1)}m` : `${diff}s`;
};

// Calculation Logic (Preserved stats logic, only charts update)
const calculateStats = () => {
  if (!props.tasks.length) return;
  
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
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);
    
  lastUpdated.value = new Date().toLocaleTimeString();
  
  updateCharts();
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

const initCharts = () => {
    if (statusChartRef.value) {
       statusChart = echarts.init(statusChartRef.value);
    }
    if (historyChartRef.value) {
       historyChart = echarts.init(historyChartRef.value);
    }
    calculateStats();
    
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
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
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
  overflow: hidden;
}
.table-card .card-title { padding: 16px; margin: 0; border-bottom: 1px solid #30363d; }
.table-container { padding: 0; }

.dash-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dash-table th { text-align: left; padding: 12px 20px; color: #666; font-weight: 600; border-bottom: 1px solid #30363d; }
.dash-table td { padding: 12px 20px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.02); }
.dash-table tr:hover { background: rgba(255,255,255,0.02); cursor: pointer; }

.col-id { font-family: monospace; color: #8b949e; }
.col-name { font-weight: 600; color: #fff; }

.status-badge {
    padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase;
    display: inline-block;
}
.status-badge.completed { background: rgba(0, 255, 136, 0.1); color: #00ff88; }
.status-badge.failed { background: rgba(255, 82, 82, 0.1); color: #ff5252; }
.status-badge.running { background: rgba(0, 210, 255, 0.1); color: #00d2ff; }
.status-badge.stopped { background: rgba(255,255,255,0.1); color: #ccc; }

.view-link-btn {
  background: none; border: 1px solid rgba(0, 210, 255, 0.3); 
  color: #00d2ff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 4px; 
  cursor: pointer; transition: all 0.2s;
}
.view-link-btn:hover { background: rgba(0, 210, 255, 0.1); border-color: #00d2ff; color: #fff; }

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
</style>

<template>
  <div class="result-view">
    <!-- Top Nav -->
    <!-- Header removed, global layout -->

    <div class="result-body">
      <!-- Left: Completed Task List -->
      <div class="task-sidebar">
        <div class="sidebar-header">RESULTS ARCHIVE</div>
        <div class="task-list custom-scroll">
           <div 
             v-for="task in completedTasks" 
             :key="task.id" 
             class="task-row" 
             :class="{ active: selectedTaskId === task.id }"
             @click="selectTask(task.id)"
            >
              <div class="task-date">{{ formatDate(task.created_at) }}</div>
              <div class="task-name">{{ task.name }}</div>
           </div>
           <div v-if="completedTasks.length === 0" class="empty-list">No completed tasks found.</div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="result-content" v-if="selectedTaskId">
         <div class="result-header">
            <h3>{{ getTaskName(selectedTaskId) }} ({{ selectedTaskId.slice(0,8) }})</h3>
         </div>
         
         <!-- Tabs -->
         <div class="result-tabs">
            <div class="tab" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">SUMMARY</div>
            <div class="tab" :class="{ active: activeTab === 'charts' }" @click="activeTab = 'charts'">CHARTS</div>
            <div class="tab" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">FILES</div>
         </div>

         <div class="tab-content">
            <!-- 1. Summary Tab -->
            <ResultSummary v-if="activeTab === 'summary'" :metrics="summaryData" />

            <!-- 2. Charts Tab -->
            <div v-else-if="activeTab === 'charts'" class="charts-layout">
               <div class="var-tree custom-scroll">
                  <input type="text" v-model="varSearch" placeholder="Filter variables..." class="var-search">
                  <div class="var-list">
                     <div 
                       v-for="v in filteredVars" 
                       :key="v" 
                       class="var-item" 
                       :class="{ selected: selectedVars.includes(v) }"
                       @click="toggleVar(v)"
                     >
                        {{ v }}
                     </div>
                  </div>
                  <button class="plot-btn" @click="fetchChartData">PLOT SELECTED</button>
               </div>
               <div class="chart-area">
                  <ResultMultiChart :time="chartTime" :dataSeries="chartData" :loading="chartLoading" />
               </div>
            </div>

            <!-- 3. Files Tab -->
            <ResultFileBrowser v-else-if="activeTab === 'files'" :files="fileList" :taskId="selectedTaskId" />
         </div>

      </div>
      <div class="empty-state" v-else>
         ← SELECT A RESULT TO VIEW
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import { useRoute } from 'vue-router';
import ResultSummary from '../components/result/ResultSummary.vue';
import ResultFileBrowser from '../components/result/ResultFileBrowser.vue';
import ResultMultiChart from '../components/result/ResultMultiChart.vue';
import { taskApi } from '../api/task';

const completedTasks = ref([]);
const selectedTaskId = ref(null);
const activeTab = ref('summary');
const route = useRoute();

// Data State
const summaryData = ref({});
const fileList = ref([]);
const variableList = ref(['TBR', 'TotalInventory', 'WallLoad']); // Mock or fetched
const selectedVars = ref([]);
const chartTime = ref([]);
const chartData = ref({});
const chartLoading = ref(false);
const varSearch = ref('');

// Computed
const filteredVars = computed(() => variableList.value.filter(v => v.toLowerCase().includes(varSearch.value.toLowerCase())));

// Mock Data
const isMock = ref(false);

const getTaskName = (id) => {
   const t = completedTasks.value.find(x => x.id === id);
   return t ? t.name : id;
};

const formatDate = (iso) => {
   if (!iso) return '';
   return new Date(iso).toLocaleDateString();
};

const fetchCompletedTasks = async () => {
   try {
     const data = await taskApi.listTasks('COMPLETED', 50);
     completedTasks.value = Array.isArray(data) ? data : (data.items || []);
   } catch {
     console.warn("Failed to fetch tasks");
   }
};

const selectTask = async (id) => {
   selectedTaskId.value = id;
   activeTab.value = 'summary';
   selectedVars.value = [];
   chartData.value = {};
   
   // Load Task Details (Config)
   await loadTaskDetails(id);
   
   loadSummary(id);
   loadFileList(id);
};

const loadTaskDetails = async (id) => {
    try {
        const task = await taskApi.getTask(id);
        // Parse variables from config
        const config = task.config_json || {};
        const sim = config.simulation || {};
        const rawFilter = sim.variableFilter || "";
        
        // "time|a|b|c" -> ["time", "a", "b", "c"]
        if (rawFilter) {
            variableList.value = rawFilter.split('|').filter(v => v);
        } else {
            variableList.value = [];
        }
        
        // Also append metrics keys if defined
        const metrics = config.metrics_definition || {};
        const metricKeys = Object.keys(metrics);
        metricKeys.forEach(k => {
            if (!variableList.value.includes(k)) variableList.value.push(k);
        });
    } catch (e) { console.error("Failed to load task details", e); }
};

const loadSummary = async (id) => {
    try {
        const data = await taskApi.getResultSummary(id);
        summaryData.value = data.metrics || {};
    } catch (e) {
        console.error(e);
        summaryData.value = {};
    }
};

const loadFileList = async (id) => {
    try {
        const data = await taskApi.getFiles(id);
        fileList.value = data;
    } catch (e) { 
        console.error(e); 
        fileList.value = [];
    }
};

const toggleVar = (v) => {
   if (selectedVars.value.includes(v)) selectedVars.value = selectedVars.value.filter(x => x !== v);
   else selectedVars.value.push(v);
};

const fetchChartData = async () => {
   if (selectedVars.value.length === 0) return;
   chartLoading.value = true;
   
   // Real API: POST /api/v1/tasks/{id}/results/query
   try {
       const data = await taskApi.queryResults(selectedTaskId.value, {
           variables: selectedVars.value
           // time_range: ... if needed
       });
       
       // Handle Multi-Job (Sweep) Data
       if (data.job_id && data.time) {
               const groupedData = {}; // "var (Job 1)": [...]
               
               // 1. Identify Unique Jobs
               const jobIndices = {}; // { 1: [0, 1, ...], 2: [100, 101, ...] }
               data.job_id.forEach((jid, idx) => {
                   if (!jobIndices[jid]) jobIndices[jid] = [];
                   jobIndices[jid].push(idx);
               });
               
               // 2. Separate Data by Job
               // Note: We need a common time axis or separate series. 
               // For ResultMultiChart, it expects a single 'time' array if all share it, 
               // OR we can't easily support mixed time bases with the current component.
               // Assumption: All jobs share the SAME time steps roughly, or we just pick the first job's time for x-axis?
               // Actually, plotting multiple jobs with different time steps requires Series-based chart (x,y pairs).
               // Current ResultMultiChart likely assumes 1 shared time array.
               // Workaround: We will extract the FIRST job's time as the master time, 
               // and only plot that job, OR simply warn the user.
               
               // BETTER STRATEGY: Treat each job-variable pair as a unique series.
               // But we need to handle the time axis.
               // Let's grab the time from the first job found.
               const firstJobId = Object.keys(jobIndices)[0];
               const firstindices = jobIndices[firstJobId];
               // Slice time for first job
               chartTime.value = firstindices.map(i => data.time[i]);
               
               // For each variable, slice data for EACH job
               Object.keys(data).forEach(key => {
                   if (key === 'time' || key === 'job_id') return;
                   
                   Object.keys(jobIndices).forEach(jid => {
                       const indices = jobIndices[jid];
                       // Only plot if data length matches (simple sync check)
                       if (indices.length === chartTime.value.length) {
                           const seriesKey = `${key} (Job ${jid})`;
                           groupedData[seriesKey] = indices.map(i => data[key][i]);
                       }
                   });
               });
               
               chartData.value = groupedData;
               
           } else if (data.time) {
               // Single Job Case
               chartTime.value = data.time;
               const seriesData = { ...data };
               delete seriesData.time;
               delete seriesData.job_id; // Just in case
               chartData.value = seriesData;
           } else {
               chartTime.value = [];
               chartData.value = {};
           }
           
           chartLoading.value = false;
       } catch(e) { chartLoading.value = false; }
};

onMounted(async () => {
   await fetchCompletedTasks();
   if (route.query.task_id) {
       selectTask(route.query.task_id);
   }
});

</script>

<style scoped>
.result-view {
  width: 100%; height: 100%;
  background: #05070a;
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}


.nav-tabs { display: flex; align-items: center; gap: 5px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
.nav-tab { 
  display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; color: #666; 
  border-radius: 4px; transition: all 0.2s; letter-spacing: 0.5px;
}
.nav-tab.active { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.2); }
.nav-tab:not(.active):hover { background: rgba(255,255,255,0.05); color: #bbb; cursor: pointer; }
.step-num { font-family: "JetBrains Mono", monospace; font-size: 9px; opacity: 0.7; }
.nav-arrow { color: #333; font-size: 10px; margin: 0 2px; }

/* Result Body */
.result-body { flex: 1; display: flex; overflow: hidden; }

.task-sidebar { width: 300px; background: #0d1117; border-right: 1px solid #30363d; display: flex; flex-direction: column; }
.sidebar-header { padding: 15px; font-size: 10px; font-weight: bold; color: #666; letter-spacing: 1px; border-bottom: 1px solid #30363d; }
.task-list { flex: 1; overflow-y: auto; }
.task-row { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; }
.task-row:hover { background: rgba(255,255,255,0.03); }
.task-row.active { background: rgba(0, 210, 255, 0.05); border-left: 2px solid #00d2ff; }
.task-date { font-size: 10px; color: #666; margin-bottom: 3px; font-family: monospace; }
.task-name { font-size: 12px; color: #ccc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.empty-list { padding: 20px; text-align: center; color: #444; font-size: 11px; }

.result-content { flex: 1; display: flex; flex-direction: column; }
.result-header { padding: 15px 20px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; background: #0b0e14; }
.result-header h3 { margin: 0; font-size: 14px; color: #fff; letter-spacing: 1px; }

.result-tabs { display: flex; padding: 0 20px; background: #0b0e14; border-bottom: 1px solid #30363d; gap: 20px; }
.tab { padding: 10px 0; font-size: 11px; font-weight: bold; color: #666; cursor: pointer; position: relative; letter-spacing: 1px; }
.tab:hover { color: #ccc; }
.tab.active { color: #00d2ff; }
.tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: #00d2ff; }

.tab-content { flex: 1; overflow: hidden; position: relative; background: #05070a; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #444; font-size: 12px; letter-spacing: 2px; }

/* Charts Layout */
.charts-layout { display: flex; height: 100%; }
.var-tree { width: 220px; background: #0d1117; border-right: 1px solid #30363d; display: flex; flex-direction: column; padding: 10px; }
.var-search { background: #05070a; border: 1px solid #30363d; color: #eee; padding: 6px; font-size: 11px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
.var-list { flex: 1; overflow-y: auto; }
.var-item { padding: 6px 8px; font-size: 11px; color: #888; cursor: pointer; border-radius: 3px; font-family: monospace; margin-bottom: 2px; }
.var-item:hover { background: rgba(255,255,255,0.03); color: #fff; }
.var-item.selected { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
.plot-btn { margin-top: 10px; background: #00d2ff; border: none; padding: 8px; font-weight: bold; font-size: 11px; cursor: pointer; }
.plot-btn:hover { background: #fff; }

.chart-area { flex: 1; position: relative; }

.custom-scroll::-webkit-scrollbar { width: 5px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; }
</style>

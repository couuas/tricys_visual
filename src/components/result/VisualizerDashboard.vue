<template>
  <div class="vis-dashboard custom-scroll">
    <div class="dash-header">
      <div class="title-section">
        <h2>VISUALIZATION & RESULTS</h2>
        <div class="subtitle">Search, preview, and interact with simulation outputs</div>
      </div>
    </div>

    <!-- Active Visualizers -->
    <div class="section-card active-procs">
        <div class="card-header">
            <h3>ACTIVE HDF5 VISUALIZERS</h3>
            <button class="refresh-btn" @click="fetchProcesses" :disabled="loadingProcs">
                {{ loadingProcs ? '...' : '↻' }}
            </button>
        </div>
        <div class="table-container">
            <table class="dash-table">
                <thead>
                    <tr>
                        <th>TASK NAME</th>
                        <th>TASK ID</th>
                        <th>FILE</th>
                        <th>PID</th>
                        <th>STARTED AT</th>
                        <th style="text-align: right">ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="proc in processes" :key="proc.task_id">
                         <td class="col-name" :title="proc.task_name">{{ proc.task_name }}</td>
                         <td class="col-id clickable" @click="$emit('select-task', proc.task_id)">
                            {{ proc.task_id.slice(0,8) }}
                        </td>
                        <td class="col-file" :title="proc.file">{{ getFileName(proc.file) }}</td>
                        <td class="col-pid">{{ proc.pid }}</td>
                        <td class="col-time">{{ formatTime(proc.started_at) }}</td>
                        <td class="col-action">
                             <button class="open-btn" @click="openProcess(proc.port)" title="Open in new tab">OPEN</button>
                            <button class="kill-btn" @click="killProcess(proc.task_id)">TERMINATE</button>
                        </td>
                    </tr>
                    <tr v-if="processes.length === 0">
                        <td colspan="6" class="empty-cell">No active HDF5 visualizers running.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Stats & Quick Access -->
    <div class="stats-row">
        <!-- Stats -->
        <div class="section-card stat-card">
            <div class="card-header"><h3>RESULTS OVERVIEW</h3></div>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="label">Total Tasks</div>
                    <div class="value">{{ stats.total_tasks || 0 }}</div>
                </div>
                <div class="stat-item">
                    <div class="label">HDF5 Results</div>
                    <div class="value highlight-h5">{{ stats.h5 || 0 }}</div>
                </div>
                 <div class="stat-item">
                    <div class="label">Analysis Reports</div>
                    <div class="value highlight-md">{{ stats.md || 0 }}</div>
                </div>
                 <div class="stat-item">
                    <div class="label">Plots (SVG)</div>
                    <div class="value highlight-svg">{{ stats.svg || 0 }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Visualizer Archive (Previously Sidebar) -->
     <div class="section-card archive-card">
        <div class="card-header"><h3>VISUALIZER ARCHIVE</h3></div>
        <div class="table-container custom-scroll" style="max-height: 400px; overflow-y: auto;">
             <table class="dash-table">
                <thead>
                    <tr>
                        <th>DATE</th>
                        <th>TASK NAME</th>
                        <th>TASK ID</th>
                        <th style="text-align: right">ACTION</th>
                    </tr>
                </thead>
                 <tbody>
                    <tr v-for="task in tasks" :key="task.id" class="archive-row" @click="$emit('select-task', task.id)">
                        <td class="col-date">{{ new Date(task.created_at).toLocaleDateString() }}</td>
                        <td class="col-name">{{ task.name }}</td>
                        <td class="col-id">{{ task.id.slice(0,8) }}</td>
                        <td class="col-action">
                            <span class="view-link">VIEW RESULT &rsaquo;</span>
                        </td>
                    </tr>
                     <tr v-if="tasks.length === 0">
                        <td colspan="4" class="empty-cell">No completed tasks found.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { visualizerApi } from '../../api/visualizer';
import { $notify } from '../../utils/notification';

const props = defineProps({
    tasks: { type: Array, default: () => [] }
});

defineEmits(['select-task']);

const processes = ref([]);
const loadingProcs = ref(false);
const stats = ref({});
let pollTimer = null;

const getFileName = (path) => {
    if (!path) return '-';
    return path.split(/[/\\]/).pop();
};

const formatTime = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
};

const fetchData = async () => {
    loadingProcs.value = true;
    try {
        const [procData, statsData] = await Promise.all([
            visualizerApi.getActiveProcesses(),
            visualizerApi.getStats()
        ]);
        processes.value = Array.isArray(procData) ? procData : [];
        stats.value = statsData || {};
    } catch (e) {
        console.error("Failed to fetch dashboard data", e);
    } finally {
        loadingProcs.value = false;
    }
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
    fetchData(); // Reload stats after killing a process? Maybe not needed instantly but good practice
    } catch {
        $notify({ title: 'ERROR', message: 'Failed to stop process.', type: 'error' });
    }
};

onMounted(() => {
    fetchData();
    pollTimer = setInterval(fetchData, 5000);
});

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.vis-dashboard {
  padding: 30px; margin: 0 auto; max-width: 1200px;
  height: 100%; overflow-y: auto;
}

.dash-header { margin-bottom: 24px;border-bottom: 1px solid #30363d; padding-bottom: 15px; }
.dash-header h2 { font-size: 20px; color: #fff; margin: 0; letter-spacing: 2px; }
.subtitle { color: #666; font-size: 13px; margin-top: 4px; }

.section-card {
    background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
    margin-bottom: 24px; overflow: hidden;
}
.card-header {
    background: rgba(255,255,255,0.02); padding: 12px 20px; border-bottom: 1px solid #30363d;
    display: flex; justify-content: space-between; align-items: center;
}
.card-header h3 { margin: 0; font-size: 12px; font-weight: 700; color: #888; letter-spacing: 1px; }

.refresh-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; }
.refresh-btn:hover:not(:disabled) { color: #fff; }

.table-container { padding: 0; }
.dash-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dash-table th { text-align: left; padding: 10px 20px; color: #666; font-weight: 600; border-bottom: 1px solid #30363d; }
.dash-table td { padding: 10px 20px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.02); }

.col-id { font-family: monospace; color: #00d2ff; }
.col-id.clickable { cursor: pointer; text-decoration: underline; }
.col-action { text-align: right; }

.col-name { font-weight: 600; color: #fff; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.open-btn {
    background: rgba(0, 210, 255, 0.1); border: 1px solid #00d2ff; color: #00d2ff;
    padding: 4px 8px; font-size: 10px; font-weight: bold; border-radius: 4px; cursor: pointer;
    transition: all 0.2s; margin-right: 8px;
}
.open-btn:hover { background: #00d2ff; color: #000; }

.kill-btn {
    background: rgba(255, 82, 82, 0.1); border: 1px solid #ff5252; color: #ff5252;
    padding: 4px 8px; font-size: 10px; font-weight: bold; border-radius: 4px; cursor: pointer;
    transition: all 0.2s;
}
.kill-btn:hover { background: #ff5252; color: #000; }

.empty-cell { text-align: center; padding: 30px; color: #555; font-style: italic; }

.stat-grid { display: flex; padding: 20px; gap: 40px; justify-content: space-around; }
.stat-item { text-align: center; }
.stat-item .label { font-size: 11px; color: #666; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-item .value { font-size: 28px; color: #fff; font-weight: bold; }
.highlight-h5 { color: #00d2ff !important; }
.highlight-md { color: #50fa7b !important; }
.highlight-svg { color: #ffb86c !important; }

.archive-row { cursor: pointer; transition: background 0.2s; }
.archive-row:hover { background: rgba(255, 255, 255, 0.05); }
.col-date { font-family: monospace; color: #888; width: 100px; }
.view-link { font-size: 11px; color: #00d2ff; }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
</style>

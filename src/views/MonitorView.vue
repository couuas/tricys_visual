<template>
  <div class="monitor-dashboard">
    <!-- Top Nav -->
    <!-- Header removed, global layout -->

    <div class="dashboard-body">
      <!-- Left Sidebar: Task List -->
      <div class="sidebar-panel">
        <TaskList 
          :tasks="tasks" 
          :selectedId="selectedTaskId" 
          @select="handleTaskSelect" 
          @refresh="fetchTasks"
          @delete="handleDeleteTask"
        />
      </div>

      <!-- Main Content: Task Detail -->
      <div class="main-panel">
        <div v-if="selectedTaskId" class="detail-container">
           <TaskStatusPanel 
             :status="currentTask.status"
             :progress="currentTask.progress"
             :currentStep="currentTask.currentStep"
             :totalSteps="currentTask.totalSteps"
             :elapsedTime="currentTask.elapsedTime"
             :logs="currentTask.logs"
             @stop="handleStopTask"
             @view-results="handleViewResults"
           />
        </div>
        <div v-else class="empty-selection">
           <div class="empty-icon">←</div>
           <p>SELECT A MISSION TO MONITOR</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import TaskList from '../components/monitor/TaskList.vue';
import TaskStatusPanel from '../components/monitor/TaskStatusPanel.vue';
import { $notify } from '../utils/notification';
import { taskApi } from '../api/task';

const router = useRouter();
const route = useRoute();
const tasks = ref([]);
const selectedTaskId = ref(null);
const currentTask = reactive({
  status: 'PENDING',
  progress: 0,
  currentStep: 0,
  totalSteps: 100,
  elapsedTime: 0,
  logs: [],
  created_at: null,
  updated_at: null
});

let ws = null;
let pollTimer = null;
let elapsedTimer = null; // Timer for elapsed/ETA

// [Mock Data Capability]
const isMock = ref(false); 

const fetchTasks = async () => {
  try {
    const data = await taskApi.listTasks(null, 20);
    tasks.value = Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error("Fetch tasks failed", e);
    // Keep mock fallback if needed, or empty
    if (tasks.value.length === 0) {
        // Mock fallback for UI demo
        isMock.value = true;
        tasks.value = [
            { id: 'mock-001', name: 'Demo Iteration Primary', status: 'RUNNING', created_at: new Date().toISOString() },
            { id: 'mock-002', name: 'Sensitivity Sweep A', status: 'COMPLETED', created_at: new Date(Date.now() - 3600000).toISOString() },
            { id: 'mock-003', name: 'Failed Config Test', status: 'ERROR', created_at: new Date(Date.now() - 7200000).toISOString() }
        ];
    }
  }
};

const handleTaskSelect = (id) => {
  if (selectedTaskId.value === id) return;
  selectedTaskId.value = id;
  // Reset View State
  currentTask.logs = [];
  currentTask.progress = 0;
  
  // Find task basic info
  const basic = tasks.value.find(t => t.id === id);
  if (basic) {
    currentTask.status = basic.status;
    currentTask.created_at = basic.created_at;
    currentTask.updated_at = basic.updated_at || null;
    
    // Initial Calc
    updateTimeStats();
    
    if (basic.status === 'COMPLETED') currentTask.progress = 100;
  }
  
  disconnectWS(); // Cleans up previous
  
  startElapsedTimer(); // Start new ticker
  
  fetchTaskLogs(id);
  connectWS(id);
};

// [Modified] Parse logs to restore progress state
const parseProgressFromLogs = (logs) => {
    if (!logs || logs.length === 0) return;
    
    let lastProgress = 0;
    // Regex patterns matching backend (engine.py)
    const patterns = [
        /(?:Running\s+job|Job)\s+(\d+)\s*(?:\/|of)\s*(\d+)/i, // Job x/y
        /(?:Progress\s*:|complete\s*:)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:complete)?/i, // 50%
        /[\[\(](\d+(?:\.\d+)?)\s*%[\]\)]/ // [50%]
    ];

    logs.forEach(log => {
        const content = log.content || log; // Handle object or string
        if (typeof content !== 'string') return;
        
        for (const p of patterns) {
            const match = content.match(p);
            if (match) {
                // Pattern 1: Job x/y
                if (match.length === 3) {
                     const current = parseInt(match[1]);
                     const total = parseInt(match[2]);
                     if (total > 0) lastProgress = (current / total) * 100;
                } 
                // Pattern 2/3: Percentage
                else if (match.length === 2) {
                     lastProgress = parseFloat(match[1]);
                }
                break; // Found match in this line
            }
        }
    });
    
    if (lastProgress > currentTask.progress) {
        currentTask.progress = parseFloat(lastProgress.toFixed(1));
    }
};

const fetchTaskLogs = async (id) => {
  try {
    const data = await taskApi.getLogs(id);
    let logsArray = [];
    
    if (data && data.logs) {
        currentTask.logs = data.logs;
        logsArray = data.logs;
    } else if (Array.isArray(data)) {
        currentTask.logs = data;
        logsArray = data;
    } 
    
    // Attempt to restore progress from logs parsing
    if (currentTask.status !== 'COMPLETED' && currentTask.status !== 'FAILED') {
        parseProgressFromLogs(logsArray);
    }
    
    // Final override if completed
    if (currentTask.status === 'COMPLETED') {
        currentTask.progress = 100;
        currentTask.currentStep = currentTask.totalSteps;
    }
  } catch(e) { console.error("Failed to fetch logs", e); }
};

const connectWS = (id) => {
  if (isMock.value) {
     if (id === 'mock-001') startMockStream();
     return;
  }

  const token = localStorage.getItem('tricys_auth_token');
  
  // Dynamic WebSocket URL Construction
  let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  // Remove http/https prefix
  baseUrl = baseUrl.replace(/^https?:\/\//, '');
  // Determine scheme
  const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  
  const wsUrl = `${scheme}${baseUrl}/ws/tasks/${id}?token=${token}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
     liveLog("System connected to stream.");
  };
  
  ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        // Handle types: 'log' (stream), 'log_history' (bulk), 'status', 'PROGRESS'
        if (msg.type === 'log' || msg.type === 'LOG') {
            // Real-time log line
            liveLog(msg.data || msg.content, msg.level || 'INFO');
        } else if (msg.type === 'log_history') {
            // Bulk history (string) - Only process if logs are empty (prevent duplicate with API fetch)
            if (msg.data && currentTask.logs.length === 0) {
                // Split lines and add
                const lines = msg.data.split('\n');
                lines.forEach(line => {
                    if (line.trim()) liveLog(line.trim(), 'HISTORY');
                });
            }
        } else if (msg.type === 'PROGRESS') {
            currentTask.currentStep = msg.current || 0;
            currentTask.totalSteps = msg.total || 100;
            currentTask.progress = msg.percent;
        } else if (msg.type === 'status') {
            const newStatus = msg.status;
            currentTask.status = newStatus;
            
            // Error handling
            if (newStatus === 'FAILED' && msg.error) {
                liveLog(`Task Failed: ${msg.error}`, 'ERROR');
            } else if (newStatus === 'COMPLETED') {
                currentTask.progress = 100;
                liveLog("Task Completed Successfully", 'INFO');
            }
            
            // Update list item too
            const t = tasks.value.find(x => x.id === id);
            if (t) t.status = newStatus;
            
            // If failed/completed, maybe auto-refresh list
            if (['COMPLETED', 'FAILED', 'STOPPED'].includes(newStatus)) {
                fetchTasks();
            }
        }
      } catch(e) { console.error("WS Parse Error", e); }
  };
};

const disconnectWS = () => {
  if (ws) { ws.close(); ws = null; }
  stopMockStream();
  stopElapsedTimer(); // Stop ticker
};

// [NEW] Timer Logic
const startElapsedTimer = () => {
    stopElapsedTimer();
    elapsedTimer = setInterval(updateTimeStats, 1000);
};

const stopElapsedTimer = () => {
    if (elapsedTimer) clearInterval(elapsedTimer);
};

const updateTimeStats = () => {
    if (!currentTask.created_at) return;
    
    // Ensure UTC interpretation if suffix missing
    let startStr = currentTask.created_at;
    if (startStr && !startStr.endsWith('Z') && !startStr.includes('+')) {
        startStr += 'Z';
    }
    const start = new Date(startStr).getTime();
    
    let end = Date.now();
    
    // If finished, use updated_at if available
    if (['COMPLETED', 'FAILED', 'STOPPED'].includes(currentTask.status)) {
        if (currentTask.updated_at) {
             let endStr = currentTask.updated_at;
             if (endStr && !endStr.endsWith('Z') && !endStr.includes('+')) {
                endStr += 'Z';
             }
             end = new Date(endStr).getTime();
        } 
    }
    
    const diff = Math.max(0, Math.floor((end - start) / 1000));
    currentTask.elapsedTime = diff;
};

const liveLog = (content, level='INFO') => {
   currentTask.logs.push({
      timestamp: new Date().toLocaleTimeString(),
      content,
      level
   });
};

const handleStopTask = async () => {
   if (isMock.value) {
       currentTask.status = 'STOPPED';
       liveLog("Task manually terminated by user.", "WARN");
       return;
   }
  try {
       await taskApi.stopTask(selectedTaskId.value);
       $notify({ title: 'STOPPING', message: 'Stop signal sent.', type: 'process' });
   } catch (e) { $notify({ title: 'ERROR', message: 'Stop failed', type: 'error' }); }
};

const handleViewResults = () => {
  if (selectedTaskId.value) {
    router.push({ name: 'result', query: { task_id: selectedTaskId.value } });
  }
};

const handleDeleteTask = async (id) => {
  if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
  
  try {
     const res = await taskApi.deleteTask(id, true);
     
     if (res) { // apiClient returns data on success, or throws on error
     
         $notify({ title: 'SUCCESS', message: 'Task deleted', type: 'success' });
         // If deleted currently selected task, clear selection
         if (selectedTaskId.value === id) {
             selectedTaskId.value = null;
             disconnectWS();
         }
         fetchTasks(); // Refresh list
     }
  } catch(e) {
     $notify({ title: 'ERROR', message: 'Failed to delete task', type: 'error' });
  }
};

// Mock Stream Logic
let mockInterval = null;
const startMockStream = () => {
    stopMockStream();
    let p = 0;
    mockInterval = setInterval(() => {
        p += 5;
        if (p > 100) p = 100;
        currentTask.progress = p;
        liveLog(`Processing chunk ${p}...`);
        if (p === 100) {
            currentTask.status = 'COMPLETED';
            liveLog("Task Completed Successfully", "INFO");
            clearInterval(mockInterval);
        }
    }, 1000);
};
const stopMockStream = () => {
    if (mockInterval) clearInterval(mockInterval);
};

onMounted(async () => {
    await fetchTasks();
    pollTimer = setInterval(fetchTasks, 5000); // Polling for list updates
    
    // Check route query for auto-selection
    if (route.query.taskId) {
        const id = route.query.taskId;
        // Wait for list to populate?
        if (tasks.value.some(t => t.id === id)) {
            handleTaskSelect(id);
        } else {
             // Maybe it's a new task not in the list yet?
             // Or fetch individual
             // For now just try to select
             handleTaskSelect(id);
        }
    }
});

onUnmounted(() => {
    disconnectWS();
    if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.monitor-dashboard {
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

/* Dashboard Body */
.dashboard-body { flex: 1; display: flex; overflow: hidden; }

.sidebar-panel { width: 300px; border-right: 1px solid #30363d; background: #0d1117; }

.main-panel { flex: 1; background: #05070a; position: relative; }

.detail-container { width: 100%; height: 100%; padding: 0; }

.empty-selection { 
  width: 100%; height: 100%; display: flex; flex-direction: column; 
  align-items: center; justify-content: center; color: #333; 
}
.empty-icon { font-size: 40px; margin-bottom: 20px; animation: bounce 2s infinite; }
@keyframes bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
</style>

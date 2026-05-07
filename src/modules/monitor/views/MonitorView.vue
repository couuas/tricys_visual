<template>
  <div class="monitor-dashboard">
    <MonitorWorkbenchShell
      :right-visible="showStatusInspector"
      :right-width="380"
      :min-right-width="320"
      :max-right-width="560"
    >
      <template #main>
        <div class="main-panel" :class="{ 'result-mode': selectedTaskId && isResultView }">
          <div v-if="selectedTaskId && isResultView" class="detail-container">
            <ResultViewer
              :taskId="selectedTaskId"
              :taskName="getTaskName(selectedTaskId)"
              :task="selectedTask"
              @back="handleBack"
            />
          </div>
          <div v-else class="dashboard-wrapper">
            <MonitorDashboard
              :tasks="tasks"
              :selected-task-id="selectedTaskId"
              @view-task="handleTaskSelect"
              @view-result="handleDirectViewResult"
            />
          </div>
        </div>
      </template>

      <template #right>
        <TaskStatusPanel
          :status="currentTask.status"
          :progress="currentTask.progress"
          :currentStep="currentTask.currentStep"
          :totalSteps="currentTask.totalSteps"
          :elapsedTime="currentTask.elapsedTime"
          :logs="currentTask.logs"
          @stop="handleStopTask"
          @view-results="handleViewResults"
          @back="handleBack"
        />
      </template>
    </MonitorWorkbenchShell>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import TaskStatusPanel from '../components/TaskStatusPanel.vue';
import MonitorDashboard from '../components/MonitorDashboard.vue';
import ResultViewer from '../components/ResultViewer.vue';
import MonitorWorkbenchShell from '../components/MonitorWorkbenchShell.vue';
import { $notify } from '../../../utils/notification';
import { taskApi } from '../../../api/task';
import { projectApi } from '../../../api/project';
import { useAuth } from '../../../shared/auth/composables/useAuth';
import { useSimulationWorkspace } from '../../simulation/composables/useSimulationWorkspace';
import { resolveApiBase as getRuntimeApiBase } from '../../../utils/runtimeUrls';

const route = useRoute();
const { currentUser } = useAuth();
const { loadData } = useSimulationWorkspace();
const tasks = ref([]);
const selectedTaskId = ref(null);
const isResultView = ref(false);
const isReadOnlyPreview = ref(false);
const selectedTask = computed(() => tasks.value.find((task) => task.id === selectedTaskId.value) || null);
const showStatusInspector = computed(() => !!selectedTaskId.value && !isResultView.value);
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
let elapsedTimer = null;

const fetchTasks = async () => {
  const pid = route.query.projectId;
  try {
    const data = await taskApi.listTasks(null, 20, 0, pid || null);
    tasks.value = Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error('Fetch tasks failed', e);
  }
};

const getTaskName = (id) => {
  const task = tasks.value.find((item) => item.id === id);
  return task ? task.name : 'Task';
};

const upsertTask = (task) => {
  if (!task?.id) {
    return null;
  }
  const index = tasks.value.findIndex((item) => item.id === task.id);
  if (index >= 0) {
    tasks.value[index] = { ...tasks.value[index], ...task };
  } else {
    tasks.value = [task, ...tasks.value];
  }
  return tasks.value.find((item) => item.id === task.id) || task;
};

const ensureTaskRecord = async (id, fallbackTask = null) => {
  if (fallbackTask?.id) {
    return upsertTask(fallbackTask);
  }
  const existing = tasks.value.find((task) => task.id === id);
  if (existing) {
    return existing;
  }
  try {
    const task = await taskApi.getTask(id);
    return upsertTask(task);
  } catch {
    return null;
  }
};

const handleBack = () => {
  selectedTaskId.value = null;
  isResultView.value = false;
  disconnectWS();
  fetchTasks();
};

const resolvePreviewStatus = async () => {
  const pid = route.query.projectId;
  if (!pid) return;
  try {
    const project = await projectApi.getProject(pid);
    const isAdmin = currentUser.value && (currentUser.value.is_superuser === true || currentUser.value.is_superuser === 1);
    if (project) {
      if (!project.user_id) {
        isReadOnlyPreview.value = true;
      } else if (currentUser.value) {
        isReadOnlyPreview.value = project.user_id !== currentUser.value.id && !isAdmin;
      } else {
        isReadOnlyPreview.value = true;
      }
    } else {
      isReadOnlyPreview.value = false;
    }
  } catch (e) {
    isReadOnlyPreview.value = false;
  }
};

const handleTaskSelect = async (id) => {
  if (selectedTaskId.value === id && !isResultView.value) return;
  selectedTaskId.value = id;
  isResultView.value = false;
  currentTask.logs = [];
  currentTask.progress = 0;
  const basic = await ensureTaskRecord(id);
  if (basic) {
    currentTask.status = basic.status;
    currentTask.created_at = basic.created_at;
    currentTask.updated_at = basic.updated_at || null;
    updateTimeStats();
    if (basic.status === 'COMPLETED') currentTask.progress = 100;
  }
  disconnectWS();
  startElapsedTimer();
  fetchTaskLogs(id);
  connectWS(id);
};

const parseProgressFromLogs = (logs) => {
  if (!logs || logs.length === 0) return;
  let lastProgress = 0;
  const patterns = [
    /(?:Running\s+job|Job)\s+(\d+)\s*(?:\/|of)\s*(\d+)/i,
    /(?:Progress\s*:|complete\s*:)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:complete)?/i,
    /[\[\(](\d+(?:\.\d+)?)\s*%[\]\)]/
  ];
  logs.forEach((log) => {
    const content = log.content || log;
    if (typeof content !== 'string') return;
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        if (match.length === 3) {
          const current = parseInt(match[1]);
          const total = parseInt(match[2]);
          if (total > 0) lastProgress = (current / total) * 100;
        } else if (match.length === 2) {
          lastProgress = parseFloat(match[1]);
        }
        break;
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
    if (currentTask.status !== 'COMPLETED' && currentTask.status !== 'FAILED') {
      parseProgressFromLogs(logsArray);
    }
    if (currentTask.status === 'COMPLETED') {
      currentTask.progress = 100;
      currentTask.currentStep = currentTask.totalSteps;
    }
  } catch (e) {
    console.error('Failed to fetch logs', e);
  }
};

const resolveApiBase = () => getRuntimeApiBase();

const connectWS = (id) => {
  const token = localStorage.getItem('tricys_auth_token');
  const apiBase = resolveApiBase();
  const scheme = apiBase.startsWith('https://') ? 'wss://' : 'ws://';
  const hostPath = apiBase.replace(/^https?:\/\//, '');
  const wsUrl = `${scheme}${hostPath}/ws/tasks/${id}?token=${token}`;
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    liveLog('System connected to stream.');
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log' || msg.type === 'LOG') {
        liveLog(msg.data || msg.content, msg.level || 'INFO');
      } else if (msg.type === 'log_history') {
        if (msg.data && currentTask.logs.length === 0) {
          const lines = msg.data.split('\n');
          lines.forEach((line) => {
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
        if (newStatus === 'FAILED' && msg.error) {
          liveLog(`Task Failed: ${msg.error}`, 'ERROR');
        } else if (newStatus === 'COMPLETED') {
          currentTask.progress = 100;
          liveLog('Task Completed Successfully', 'INFO');
        }
        const task = tasks.value.find((item) => item.id === id);
        if (task) task.status = newStatus;
        if (['COMPLETED', 'FAILED', 'STOPPED'].includes(newStatus)) {
          fetchTasks();
        }
      }
    } catch (e) {
      console.error('WS Parse Error', e);
    }
  };
};

const disconnectWS = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  stopElapsedTimer();
};

const startElapsedTimer = () => {
  stopElapsedTimer();
  elapsedTimer = setInterval(updateTimeStats, 1000);
};

const stopElapsedTimer = () => {
  if (elapsedTimer) clearInterval(elapsedTimer);
};

const updateTimeStats = () => {
  if (!currentTask.created_at) return;
  let startStr = currentTask.created_at;
  if (startStr && !startStr.endsWith('Z') && !startStr.includes('+')) {
    startStr += 'Z';
  }
  const start = new Date(startStr).getTime();
  let end = Date.now();
  if (['COMPLETED', 'FAILED', 'STOPPED'].includes(currentTask.status) && currentTask.updated_at) {
    let endStr = currentTask.updated_at;
    if (endStr && !endStr.endsWith('Z') && !endStr.includes('+')) {
      endStr += 'Z';
    }
    end = new Date(endStr).getTime();
  }
  const diff = Math.max(0, Math.floor((end - start) / 1000));
  currentTask.elapsedTime = diff;
};

const liveLog = (content, level = 'INFO') => {
  currentTask.logs.push({
    timestamp: new Date().toLocaleTimeString(),
    content,
    level
  });
};

const handleStopTask = async () => {
  if (isReadOnlyPreview.value) {
    $notify({ title: 'READ ONLY', message: 'Preview projects cannot be stopped.', type: 'warn' });
    return;
  }
  try {
    await taskApi.stopTask(selectedTaskId.value);
    $notify({ title: 'STOPPING', message: 'Stop signal sent.', type: 'process' });
  } catch (e) {
    $notify({ title: 'ERROR', message: 'Stop failed', type: 'error' });
  }
};

const handleDirectViewResult = async (task) => {
  if (task && task.id) {
    const resolvedTask = await ensureTaskRecord(task.id, task);
    selectedTaskId.value = resolvedTask?.id || task.id;
    isResultView.value = true;
    disconnectWS();
  }
};

const handleViewResults = () => {
  if (selectedTaskId.value) {
    isResultView.value = true;
    disconnectWS();
  }
};

watch(showStatusInspector, async () => {
  await nextTick();
  window.dispatchEvent(new Event('resize'));
});

onMounted(async () => {
  const pid = route.query.projectId;
  if (pid) {
    await loadData(pid);
  }
  await resolvePreviewStatus();
  await fetchTasks();
  pollTimer = setInterval(fetchTasks, 5000);
  if (route.query.taskId) {
    const id = route.query.taskId;
    handleTaskSelect(id);
  }
});

onUnmounted(() => {
  disconnectWS();
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.monitor-dashboard {
  width: 100%; height: calc(100vh - 60px);
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

.main-panel {
  width: 100%;
  height: 100%;
  background: #05070a;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.main-panel.result-mode {
  background: #05070a;
}

.detail-container { width: 100%; height: 100%; padding: 0; }

.dashboard-wrapper { width: 100%; height: 100%; overflow: hidden; }

.empty-selection {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #333;
}
.empty-icon { font-size: 40px; margin-bottom: 20px; animation: bounce 2s infinite; }
@keyframes bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
</style>
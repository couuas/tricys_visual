<template>
  <div class="task-status-panel">
    
    <div class="panel-header">
      <div class="header-left">
        <button class="back-btn" @click="$emit('back')">←</button>
        <h3>LIVE MONITOR</h3>
      </div>
      <div class="status-badge" :class="statusClass">
        {{ status }}
      </div>
    </div>

    <!-- Progress Section -->
    <div class="section progress-section">
      <div class="section-label">SIMULATION PROGRESS</div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: percent + '%' }"></div>
        <div class="scan-effect"></div>
      </div>
      <div class="progress-stats">
        <span>{{ currentStep }} / {{ totalSteps }}</span>
        <span>{{ percent.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="section metrics-grid">
      <div class="metric-item">
        <div class="label">ELAPSED TIME</div>
        <div class="value">{{ elapsedTime }}s</div>
      </div>
      <div class="metric-item">
        <div class="label">EST. REMAINING</div>
        <div class="value">{{ estimatedRemaining }}s</div>
      </div>
    </div>

    <!-- Log Stream (Mini) -->
    <div class="section log-section">
      <div class="section-label">SYSTEM LOGS</div>
      <div class="log-window custom-scroll" ref="logContainer">
        <div v-for="(log, idx) in logs" :key="idx" class="log-line" :class="log.level.toLowerCase()">
          <span class="ts">[{{ log.timestamp }}]</span>
          <span class="content">{{ log.content }}</span>
        </div>
      </div>
    </div>

    <!-- Control Actions -->
    <div class="control-actions">
      <button 
        class="action-btn stop-btn" 
        @click="$emit('stop')" 
        v-if="isRunning"
      >
        <span class="icon">⏹</span> TERMINATE TASK
      </button>
      
      <button 
        class="action-btn view-btn" 
        @click="$emit('view-results')" 
        v-if="status === 'COMPLETED'"
      >
        <span class="icon">📊</span> VIEW RESULTS
      </button>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps({
  status: { type: String, default: 'PENDING' }, // PENDING, RUNNING, COMPLETED, ERROR
  progress: { type: Number, default: 0 },
  currentStep: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 100 },
  elapsedTime: { type: Number, default: 0 },
  logs: { type: Array, default: () => [] }
});

const logContainer = ref(null);


defineEmits(['stop', 'view-results', 'back']);

const isRunning = computed(() => ['RUNNING', 'PENDING'].includes(props.status));

const statusClass = computed(() => {
  switch(props.status) {
    case 'RUNNING': return 'running';
    case 'COMPLETED': return 'success';
    case 'ERROR': return 'error';
    default: return 'pending';
  }
});

const percent = computed(() => {
  if (props.totalSteps === 0) return 0;
  return Math.min(100, Math.max(0, (props.currentStep / props.totalSteps) * 100));
});

const estimatedRemaining = computed(() => {
  if (percent.value <= 0 || props.elapsedTime <= 0) return '---';
  const totalTime = props.elapsedTime / (percent.value / 100);
  const remaining = totalTime - props.elapsedTime;
  return Math.round(remaining);
});

// Auto-scroll logs
watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
});

</script>

<style scoped>
.task-status-panel {
  display: flex; flex-direction: column; gap: 20px;
  padding: 20px;
  background: rgba(10, 12, 16, 0.6);
  backdrop-filter: blur(10px);
  height: 100%; box-sizing: border-box;
  font-family: 'Inter', 'Roboto Mono', monospace;
  color: #eee;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #30363d; padding-bottom: 10px; }
.header-left { display: flex; align-items: center; gap: 10px; }
.panel-header h3 { margin: 0; font-size: 14px; letter-spacing: 1px; color: #fff; }

.back-btn { 
  background: none; border: none; color: #666; font-size: 18px; cursor: pointer; padding: 0; display: flex; align-items: center; 
  transition: color 0.2s;
}
.back-btn:hover { color: #fff; }

.status-badge { 
  font-size: 10px; padding: 4px 8px; border-radius: 4px; font-weight: 800; letter-spacing: 1px; 
}
.status-badge.running { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); animation: pulse 1s infinite alternate; }
.status-badge.success { background: rgba(0, 255, 136, 0.1); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); }
.status-badge.error { background: rgba(255, 82, 82, 0.1); color: #ff5252; border: 1px solid rgba(255, 82, 82, 0.3); }
.status-badge.pending { background: rgba(255, 255, 255, 0.1); color: #888; border: 1px solid #444; }

.section-label { font-size: 10px; color: #666; font-weight: bold; margin-bottom: 8px; }

/* Progress Bar */
.progress-bar-track { 
  height: 8px; background: #0d1117; border-radius: 4px; overflow: hidden; position: relative; border: 1px solid #30363d;
}
.progress-bar-fill {
  height: 100%; background: #00d2ff; width: 0%;
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
  transition: width 0.3s ease;
}
.scan-effect {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
  animation: scan 2s infinite linear;
}

.progress-stats { display: flex; justify-content: space-between; font-size: 11px; margin-top: 5px; color: #888; font-family: 'Consolas', monospace; }

/* Metrics */
.metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.metric-item { background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.05); }
.metric-item .label { font-size: 9px; color: #666; margin-bottom: 4px; }
.metric-item .value { font-size: 16px; color: #fff; font-weight: bold; font-family: 'Consolas', monospace; }

/* Logs */
.log-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.log-window { 
  flex: 1; background: #05070a; border: 1px solid #30363d; border-radius: 4px; 
  padding: 10px; font-family: 'Consolas', monospace; font-size: 11px; overflow-y: auto; 
}
.log-line { margin-bottom: 2px; text-shadow: none; display: flex; gap: 8px; }
.log-line .ts { color: #444; white-space: nowrap; }
.log-line .content { color: #ccc; word-break: break-all; }
.log-line.error .content { color: #ff5252; }
.log-line.warn .content { color: #ffca28; }
.log-line.info .content { color: #88ceeb; }

/* Controls */
.control-actions { margin-top: auto; }
.stop-btn { 
  width: 100%; background: rgba(255, 82, 82, 0.1); border: 1px solid #ff5252; color: #ff5252;
  padding: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s;
}
.stop-btn:hover:not(:disabled) { background: #ff5252; color: #000; }
.stop-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }

.view-btn {
  width: 100%; background: rgba(0, 210, 255, 0.1); border: 1px solid #00d2ff; color: #00d2ff;
  padding: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s;
}
.view-btn:hover { background: #00d2ff; color: #000; }

/* Animation */
@keyframes pulse { from { opacity: 0.8; } to { opacity: 1; } }
@keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-track { background: #0d1117; }
</style>

<template>
  <div 
    class="bottom-console" 
    :class="{ 'no-transition': isDragging, 'minimized': isMinimized, 'is-fullscreen': state === 'fullscreen' }"
    :style="consoleStyle"
  >
    
    <div v-if="!isMinimized && state !== 'fullscreen'" class="resize-handle-top" @mousedown.prevent="startDrag">
      <div class="handle-bar"></div>
    </div>

    <div class="console-header" @click="toggleMinimize">
      <div class="header-left">
        <div class="console-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'dashboard', disabled: !hasSimulationData }"
            @click.stop="switchTab('dashboard')"
            :disabled="!hasSimulationData"
            title="Available after simulation"
          >
            <span class="icon">📊</span> DASHBOARD
          </button>

          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'analysis' }"
            @click.stop="switchTab('analysis')"
          >
            <span class="icon">⚗</span> ANALYSIS TERMINAL
          </button>
        </div>

        <transition name="fade">
          <span class="status-text" v-if="isMinimized && activeTab === 'analysis'">
             &nbsp;|&nbsp; <span class="highlight">{{ taskCount }}</span> Tasks &nbsp;|&nbsp; 
             <span class="highlight" :class="{ 'text-green': isRunning }">{{ runningCount }}</span> Running
          </span>
        </transition>
      </div>
      
      <div class="header-controls">
        <div class="size-toggles" v-if="!isMinimized">
          <button @click.stop="setHeightByRatio(0.3)" :class="{ active: isRatio(0.3) }">MIN</button>
          <button @click.stop="setHeightByRatio(0.5)" :class="{ active: isRatio(0.5) }">HALF</button>
          <button @click.stop="setHeightByRatio(1.0)" :class="{ active: isRatio(1.0) }">MAX</button>
        </div>
      </div>
    </div>

    <div class="console-body" v-show="!isMinimized">
      
      <div v-show="activeTab === 'analysis'" class="tab-content analysis-content">
         <AnalysisTerminal 
            ref="analysisTerminalRef" 
            :isActive="activeTab === 'analysis'" 
         />
      </div>

      <div v-show="activeTab === 'dashboard'" class="tab-content dashboard-content">
         <DashboardPanel :consoleMode="true" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useSimulation } from '../composables/useSimulation';
import DashboardPanel from './DashboardPanel.vue';
import AnalysisTerminal from './AnalysisTerminal.vue';

const props = defineProps({
  leftOffset: { type: Number, default: 0 }
});

const emit = defineEmits(['close', 'resize', 'drag-start', 'drag-end']);

// Composables
const { analysisTasks, hasSimulationData, fetchAnalysisTasks } = useSimulation();

// --- CONSOLE STATE ---
const activeTab = ref('analysis');
const panelHeight = ref(300);
const lastPanelHeight = ref(300);
const isMinimized = ref(true);
const isDragging = ref(false);
const state = ref('minimized');
const analysisTerminalRef = ref(null);

// Computed
const taskCount = computed(() => analysisTasks.value.length);
const runningCount = computed(() => analysisTasks.value.filter(t => t.status === 'running').length);
const isRunning = computed(() => runningCount.value > 0);

const consoleStyle = computed(() => {
  if (state.value === 'fullscreen') {
    return { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', zIndex: 999 };
  }
  return { 
    height: isMinimized.value ? '36px' : `${panelHeight.value}px`,
    left: `${props.leftOffset}px`,
    width: `calc(100% - ${props.leftOffset}px)`
  };
});

// --- METHODS ---

const switchTab = (tab) => {
  if (tab === 'dashboard' && !hasSimulationData.value) return;
  activeTab.value = tab;
};

const notifyHeightChange = () => {
  const currentH = isMinimized.value ? 36 : panelHeight.value;
  emit('resize', currentH);
  // Trigger Chart Resize in Child
  if (activeTab.value === 'analysis' && analysisTerminalRef.value) {
    analysisTerminalRef.value.resizeChart();
  }
};

const startDrag = (e) => {
  if (isMinimized.value || state.value === 'fullscreen') return;
  isDragging.value = true;
  emit('drag-start');
  const startY = e.clientY;
  const startH = panelHeight.value;
  const onMouseMove = (ev) => {
    const delta = startY - ev.clientY; 
    let newH = startH + delta;
    const maxH = window.innerHeight - 65; 
    const minH = window.innerHeight * 0.3; 
    if (newH < minH) newH = minH;
    if (newH > maxH) newH = maxH;
    panelHeight.value = newH;
    notifyHeightChange(); 
  };
  const onMouseUp = () => {
    isDragging.value = false;
    emit('drag-end'); 
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const setHeightByRatio = (ratio) => {
  if (ratio === 1.0) { state.value = 'fullscreen'; isMinimized.value = false; }
  else {
    state.value = ratio === 0.3 ? 'medium' : 'large';
    isMinimized.value = false;
    const h = window.innerHeight * ratio;
    panelHeight.value = Math.max(h, window.innerHeight * 0.3);
  }
  notifyHeightChange();
};

const isRatio = (ratio) => {
  if(state.value === 'fullscreen') return ratio === 1.0;
  if(isMinimized.value) return false;
  const target = window.innerHeight * ratio;
  return Math.abs(panelHeight.value - target) < 50; 
};

const toggleMinimize = (e) => {
  // Ignore clicks on buttons/controls inside header
  if (e.target.closest('button') || e.target.closest('.mini-select') || e.target.closest('.tab-btn')) return;
  if (state.value === 'fullscreen') return; 
  
  if (isMinimized.value) {
    isMinimized.value = false;
    if (lastPanelHeight.value < 150) lastPanelHeight.value = 300;
    panelHeight.value = lastPanelHeight.value;
  } else {
    lastPanelHeight.value = panelHeight.value;
    isMinimized.value = true;
  }
  notifyHeightChange();
};

onMounted(() => {
  const defaultOpenHeight = window.innerHeight * 0.5;
  panelHeight.value = defaultOpenHeight;
  lastPanelHeight.value = defaultOpenHeight; 
  isMinimized.value = true;
  state.value = 'minimized';
  notifyHeightChange();
  fetchAnalysisTasks();
});
</script>

<style scoped>
/* === Container & Layout === */
.bottom-console {
  position: absolute; bottom: 0; 
  background: rgba(10, 12, 16, 0.98); 
  backdrop-filter: blur(20px);
  border-top: 1px solid #00d2ff;
  display: flex; flex-direction: column;
  z-index: 600;
  transition: height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), left 0.4s, width 0.4s;
  overflow: hidden;
  box-shadow: 0 -10px 50px rgba(0,0,0,0.6);
}
.bottom-console.is-fullscreen { position: absolute; top: 0; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 999; }
.bottom-console.no-transition { transition: none !important; }
.bottom-console.minimized { cursor: pointer; transition: background 0.2s; }
.bottom-console.minimized:hover { background: rgba(20, 30, 45, 0.98); }

.resize-handle-top { position: absolute; top: 0; left: 0; width: 100%; height: 5px; cursor: ns-resize; z-index: 601; display: flex; justify-content: center; align-items: center; }
.resize-handle-top:hover .handle-bar { background: #00d2ff; width: 100%; box-shadow: 0 0 5px #00d2ff; }
.handle-bar { width: 40px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; transition: 0.2s; }

/* [Header Tabs] */
.console-header {
  height: 36px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; border-bottom: 1px solid rgba(255,255,255,0.08); background: linear-gradient(90deg, rgba(0, 210, 255, 0.08) 0%, transparent 40%); user-select: none;
}
.header-left { display: flex; align-items: center; gap: 15px; }
.console-tabs { display: flex; gap: 2px; }
.tab-btn {
  background: transparent; border: none; color: #666; font-size: 11px; font-weight: 700; padding: 6px 12px; cursor: pointer; transition: all 0.2s; border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px;
}
.tab-btn:hover { color: #ccc; }
.tab-btn.active { color: #00d2ff; border-bottom-color: #00d2ff; background: rgba(0, 210, 255, 0.05); }
.tab-btn.disabled { opacity: 0.3; cursor: not-allowed; }
.status-text { font-size: 11px; color: #666; font-family: monospace; }
.status-text .highlight { color: #ccc; margin-left: 4px; font-weight: bold; }
.status-text .text-green { color: #00ff88; }

.header-controls { display: flex; align-items: center; gap: 8px; }
.size-toggles { display: flex; background: rgba(255,255,255,0.05); border-radius: 4px; padding: 2px; gap: 2px; }
.size-toggles button { background: transparent; border: none; color: #666; font-size: 9px; padding: 2px 8px; border-radius: 2px; cursor: pointer; font-weight: 600; }
.size-toggles button:hover { color: #ccc; }
.size-toggles button.active { background: #00d2ff; color: #000; }

.console-body { flex: 1; display: flex; overflow: hidden; position: relative; }
/* 关键修改：添加 container-type: size */
/* 这使得子组件 AnalysisTerminal 能够根据 tab-content 的尺寸来响应式调整样式 */
.tab-content { 
  flex: 1; 
  display: flex; 
  width: 100%; 
  height: 100%; 
  overflow: hidden; 
  container-type: size; /* 开启容器查询 */
}
.analysis-content { width: 100%; height: 100%; }
.dashboard-content { width: 100%; height: 100%; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
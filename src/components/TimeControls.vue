<template>
  <div class="time-controls-minimal">
    
    <div class="control-group">
      <button class="icon-btn mini" @click="skip(-10)" title="Rewind 10s">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M11 19V5l-7 7 7 7zm8-14l-7 7 7 7V5z"/>
        </svg>
      </button>
      
      <button class="icon-btn main" @click="togglePlay" :disabled="!hasData" title="Play/Pause">
        <svg v-if="isPlaying" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
      
      <button class="icon-btn mini" @click="skip(10)" title="Forward 10s">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M4 19l7-7-7-7v14zm11-14v14l7-7-7-7z"/>
        </svg>
      </button>
    </div>

    <div class="slider-wrapper">
      <input 
        type="range" 
        min="0" 
        :max="maxTime" 
        :step="simulationStep" 
        :value="currentTime" 
        @input="handleInput"
        @change="handleChange"
        :disabled="!hasData"
        class="time-slider"
      >
      <div class="slider-progress" :style="{ width: progressPercent + '%' }"></div>
      <div class="slider-track"></div>
    </div>

    <div class="time-text">
      {{ formatTime(currentTime) }} / {{ maxTime.toFixed(1) }} hrs
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSimulation } from '../composables/useSimulation';

const { 
  simulationData, currentTime, isPlaying, play, pause, setTime, simulationStep
} = useSimulation();

// 计算属性
const hasData = computed(() => !!simulationData.value && simulationData.value.time.length > 0);

const maxTime = computed(() => {
  if (!hasData.value) return 100;
  const timeArr = simulationData.value.time;
  return timeArr[timeArr.length - 1];
});

const progressPercent = computed(() => {
  if (maxTime.value <= 0) return 0;
  return Math.min(100, (currentTime.value / maxTime.value) * 100);
});

// --- 交互逻辑 ---

const togglePlay = () => {
  if (!hasData.value) return;
  if (isPlaying.value) {
    pause();
  } else {
    if (currentTime.value >= maxTime.value) setTime(0);
    play();
  }
};

const skip = (amount) => {
  if (!hasData.value) return;
  let t = currentTime.value + amount;
  if (t < 0) t = 0;
  if (t > maxTime.value) t = maxTime.value;
  setTime(t);
};

const handleInput = (e) => {
  if (!hasData.value) return;
  pause(); 
  setTime(parseFloat(e.target.value));
};

const handleChange = (e) => {
  setTime(parseFloat(e.target.value));
};

// 简约时间格式: 1200.5 s
const formatTime = (val) => {
  return val.toFixed(1);
};

const handleKeydown = (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { 
    e.preventDefault(); 
    togglePlay(); 
  } else if (e.code === 'ArrowRight') {
    skip(5);
  } else if (e.code === 'ArrowLeft') {
    skip(-5);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* 极简容器：固定高度 36px，透明背景 */
.time-controls-minimal {
  width: 100%;
  height: 36px; 
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 5px;
  box-sizing: border-box;
  background: transparent;
}

/* 左侧按钮组 */
.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0; /* 防止按钮被压缩 */
}

/* 纯图标按钮样式 */
.icon-btn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.icon-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* 主播放按钮稍大 */
.icon-btn.main {
  width: 28px;
  height: 28px;
  color: #fff; 
}
.icon-btn.main:hover {
  color: #00d2ff;
}

/* 快进快退按钮稍小 */
.icon-btn.mini {
  width: 24px;
  height: 24px;
  opacity: 0.7;
}
.icon-btn.mini:hover { opacity: 1; }

.icon-btn:disabled {
  color: #444;
  cursor: not-allowed;
  opacity: 0.5;
}

/* 进度条容器 (占据剩余空间) */
.slider-wrapper {
  flex: 1;
  position: relative;
  height: 24px; /* 增加点击热区 */
  display: flex;
  align-items: center;
  cursor: pointer;
}

/* 轨道 */
.slider-track {
  position: absolute;
  left: 0; right: 0;
  height: 3px; /* 细线条 */
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

/* 进度条 (蓝色填充) */
.slider-progress {
  position: absolute;
  left: 0;
  height: 3px;
  background: #00d2ff;
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;
}

/* 原生 Input (透明，覆盖在上层用于交互) */
.time-slider {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
  margin: 0;
}

/* 右侧时间文字 */
.time-text {
  font-family: "Consolas", monospace;
  font-size: 11px;
  color: #888;
  white-space: nowrap;
  font-weight: 600;
  flex-shrink: 0;
}
</style>
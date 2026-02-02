<template>
  <div class="editor-panel connection-editor" :class="{ open: selectedConnectionId, 'embedded-mode': embedded }" @click.stop>
    
  <div class="header">
      <h3>{{ selectedConnectionId ? formattedName : 'Connection Setting' }}</h3>
      <button 
        v-if="!embedded || allowClose" 
        class="close-btn" 
        @click="handleClose"
        title="Hide Panel"
      >×</button>
    </div>

    <div v-if="selectedConnectionId" class="content custom-scroll">
      
      <div class="section-header-group">
         <div class="section-label">APPEARANCE</div>
         <span class="unlocked-badge">✎ Editable</span>
      </div>

      <div class="form-group">
        <label>Preset Style</label>
        <div class="preset-grid">
          <div class="preset-item" :class="{ active: localStyle.type === 'flow' }" @click="applyPreset('flow')"><span class="icon">🌊</span> Flow</div>
          <div class="preset-item" :class="{ active: localStyle.type === 'solid' }" @click="applyPreset('solid')"><span class="icon">➖</span> Solid</div>
          <div class="preset-item" :class="{ active: localStyle.type === 'dashed' }" @click="applyPreset('dashed')"><span class="icon">┄</span> Dash</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="form-group">
        <label>Color</label>
        <div class="color-picker-wrapper">
          <input type="color" v-model="localStyle.color" class="color-input">
          <input type="text" v-model="localStyle.color" class="hex-input">
        </div>
      </div>

      <div class="form-group">
        <label>Line Width: {{ localStyle.width?.toFixed(1) }}</label>
        <input type="range" min="1.0" max="20.0" step="0.5" v-model.number="localStyle.width">
      </div>

      <div class="form-group">
        <label>Opacity: {{ localStyle.opacity }}</label>
        <input type="range" min="0.1" max="1.0" step="0.1" v-model.number="localStyle.opacity">
      </div>

      <div class="form-group" v-if="localStyle.type !== 'solid'">
        <label>Flow Speed: {{ localStyle.speed }}x</label>
        <input type="range" min="0.1" max="5.0" step="0.1" v-model.number="localStyle.speed">
      </div>
      
      <div style="height: 20px;"></div>
    </div>

    <div v-else class="empty-state">
      <div class="icon">🔗</div>
      <div>Select a connection line to edit.</div>
    </div>

    <div class="actions" v-if="selectedConnectionId">
      <button class="btn primary" @click="save">Apply</button>
      <button class="btn secondary" @click="syncAll" title="Apply to ALL lines">Sync All</button>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useSimulation } from '../composables/useSimulation';
import { $confirm } from '../utils/dialog';

// [修改] 新增 allowClose prop
const props = defineProps({ 
  embedded: { type: Boolean, default: false },
  allowClose: { type: Boolean, default: false } // 新增
});
// [修改] 新增 close-panel
const emit = defineEmits(['close', 'close-panel']);

const { selectedConnectionId, getConnectionStyle, updateConnectionStyle, syncAllConnections, defaultConnectionStyle, structureData } = useSimulation();
const localStyle = ref({ ...defaultConnectionStyle });

const formattedName = computed(() => {
  const id = selectedConnectionId.value;
  if (!id) return '';
  if (structureData.value && structureData.value.connections) {
    const conn = structureData.value.connections.find(c => `${c.from.toLowerCase()}_${c.to.toLowerCase()}` === id);
    if (conn) return `Line: ${conn.from} → ${conn.to}`;
  }
  return `Line: ${id}`;
});

watch(selectedConnectionId, (newId) => {
  if (newId) {
    localStyle.value = { ...getConnectionStyle(newId) };
    if (localStyle.value.width === undefined) localStyle.value.width = 4.0;
  }
});

const applyPreset = (type) => {
  localStyle.value.type = type;
  if (type === 'flow') localStyle.value.speed = 1.0;
  if (type === 'solid') localStyle.value.speed = 0;
  if (type === 'dashed' && localStyle.value.speed === 0) localStyle.value.speed = 0.5;
};

// [新增]
const handleClose = () => {
  if (props.embedded && props.allowClose) {
    emit('close-panel');
  } else {
    emit('close');
  }
};

const save = () => { if (selectedConnectionId.value) updateConnectionStyle(selectedConnectionId.value, localStyle.value); };
// [修改] 同步样式逻辑
const syncAll = async () => { 
  const isConfirmed = await $confirm(
    "This will overwrite the visual style of ALL connection lines in the system. Proceed?", 
    "SYNC STYLES"
  );
  
  if (isConfirmed) { 
    syncAllConnections(localStyle.value); 
    save(); 
  } 
};</script>

<style scoped>
/* 基础面板样式 (与 ComponentEditor 对齐) */
.editor-panel {
  position: absolute;
  top: 100px;
  
  /* [修改] 初始位置在屏幕外右侧 */
  right: -400px; 
  
  width: 320px; 
  background: rgba(16, 20, 28, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 12px;
  border: 1px solid rgba(0,210,255,0.25);
  padding: 0; 
  
  /* [核心修改] 添加统一的过渡动画 */
  transition: right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  z-index: 200;
  box-shadow: -5px 0 30px rgba(0,0,0,0.5);
  
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 140px);
  overflow: hidden;
}

/* [修改] 打开状态：滑入屏幕 */
.editor-panel.open { 
  right: 20px; 
}

/* [修改] Embedded Mode */
.editor-panel.embedded-mode {
  position: relative;
  top: auto; right: auto; bottom: auto; left: auto;
  width: 100%; height: 100%; max-height: none;
  transform: none !important;
  box-shadow: none;
  
  /* [统一边框] */
  border: 1px solid #30363d;
  border-radius: 12px;
  
  background: rgba(0, 0, 0, 0.6); /* 黑色背景 */
  backdrop-filter: blur(10px);
  z-index: 1; transition: none;
  box-sizing: border-box;
}

/* 以下样式保持不变，确保与 ComponentEditor 一致 */
.editor-panel::-webkit-scrollbar { width: 4px; }
.editor-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

.header { 
  flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; 
  
  /* [统一分割线] */
  border-bottom: 1px solid #30363d; 
  
  padding: 15px 20px; background: rgba(16, 20, 28, 0.98); 
}
.editor-panel.embedded-mode .header { background: rgba(20, 25, 35, 0.5); }
h3 { margin: 0; color: #00d2ff; font-size: 16px; letter-spacing: 1px; } 
.close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; line-height: 1; padding: 0 5px; }

.content { flex: 1; overflow-y: auto; padding: 20px; }
.actions { 
  flex-shrink: 0; display: flex; gap: 10px; padding: 15px 20px; 
  
  /* [统一分割线] */
  border-top: 1px solid #30363d; 
  
  background: rgba(16, 20, 28, 0.98); margin-top: 0; 
}
.editor-panel.embedded-mode .actions { background: rgba(20, 25, 35, 0.5); }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #666; text-align: center; padding: 20px; }
.empty-state .icon { font-size: 40px; margin-bottom: 20px; opacity: 0.5; }
.section-header-group { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 10px 0; }
.section-header-group:first-child { margin-top: 0; }
.section-label { font-size: 11px; font-weight: 800; color: #666; letter-spacing: 1px; margin: 0; }
.unlocked-badge { font-size: 10px; color: #00d2ff; background: rgba(0, 210, 255, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 210, 255, 0.3); }
.divider { height: 1px; background: rgba(255,255,255,0.1); margin: 20px 0; }
.form-group { margin-bottom: 15px; }
label { display: block; font-size: 12px; color: #888; margin-bottom: 5px; }
.preset-grid { display: flex; gap: 8px; }
.preset-item { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid transparent; border-radius: 6px; padding: 8px; text-align: center; cursor: pointer; font-size: 11px; color: #ccc; transition: 0.2s; }
.preset-item:hover { background: rgba(255,255,255,0.1); }
.preset-item.active { border-color: #00d2ff; color: #00d2ff; background: rgba(0, 210, 255, 0.1); }
.icon { display: block; font-size: 16px; margin-bottom: 4px; }
.color-picker-wrapper { display: flex; gap: 10px; align-items: center; }
.color-input { width: 40px; height: 30px; border: none; padding: 0; background: none; cursor: pointer; }
.hex-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-family: monospace; font-size: 12px; outline: none; }
.hex-input:focus { border-color: #00d2ff; }
input[type="range"] { width: 100%; cursor: pointer; accent-color: #00d2ff; }
.btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; font-size: 13px; }
.btn.primary { background: linear-gradient(135deg, #0066ff, #00d2ff); color: #fff; }
.btn.secondary { background: rgba(255,255,255,0.1); color: #ccc; }
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>
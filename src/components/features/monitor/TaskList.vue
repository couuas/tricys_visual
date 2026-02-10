<template>
  <div class="task-list-panel">
    <div class="list-header">
      <div class="header-title">MISSION LOG</div>
      <button class="refresh-btn" @click="$emit('refresh')" title="Refresh List">⟳</button>
    </div>

    <div class="list-content custom-scroll">
      <div 
        v-for="task in tasks" 
        :key="task.id" 
        class="task-item" 
        :class="{ active: selectedId === task.id }"
        @click="$emit('select', task.id)"
      >
        <div class="task-left">
          <div class="status-indicator" :class="task.status.toLowerCase()"></div>
        </div>
        
        <div class="task-main">
          <div class="task-name">
            <span v-if="isAnalysis(task)" class="type-tag" title="Analysis Job">⚡</span>
            {{ task.name || 'Unnamed Task' }}
          </div>
          <div class="task-meta">
            <span class="task-id">{{ task.id.slice(0, 8) }}</span>
            <span class="task-time">{{ formatTime(task.created_at) }}</span>
          </div>
        </div>

        <div class="task-right">
           <div class="mini-status" :class="task.status.toLowerCase()">
             {{ task.status }}
           </div>
           
           <!-- Delete action (visible on hover) -->
           <button 
             class="delete-btn" 
             @click.stop="$emit('delete', task.id)" 
             title="Delete Task" 
             v-if="task.status !== 'RUNNING'"
           >
             ✕
           </button>

           <!-- Optional Mini Progress for Running Tasks -->
           <div class="mini-progress-track" v-if="task.status === 'RUNNING'">
              <div class="mini-progress-fill" :style="{ width: (task.progress || 0) + '%' }"></div>
           </div>
        </div>
      </div>

      <div v-if="tasks.length === 0" class="empty-state">
        NO TASKS RECORDED
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  selectedId: { type: String, default: null }
});

defineEmits(['select', 'refresh', 'delete']);

const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const isAnalysis = (t) => {
    return t && (t.type === 'analysis' || (t.config_json && t.config_json.type === 'analysis'));
};
</script>

<style scoped>
.task-list-panel {
  width: 100%; height: 100%;
  background: #0d1117;
  border-right: 1px solid #30363d;
  display: flex; flex-direction: column;
}

.list-header {
  height: 50px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 15px; border-bottom: 1px solid #30363d;
  background: rgba(255,255,255,0.02);
}

.header-title { font-size: 11px; font-weight: 800; color: #888; letter-spacing: 1px; }

.refresh-btn {
  background: none; border: none; color: #666; font-size: 16px; cursor: pointer; transition: 0.2s;
}
.refresh-btn:hover { color: #fff; transform: rotate(180deg); }

.list-content { flex: 1; overflow-y: auto; overflow-x: hidden; }

.task-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  cursor: pointer; transition: 0.2s;
  position: relative;
}

.task-item:hover { background: rgba(255,255,255,0.03); }
.task-item.active { background: rgba(0, 210, 255, 0.05); border-left: 2px solid #00d2ff; }

.status-indicator { width: 6px; height: 6px; border-radius: 50%; background: #444; }
.status-indicator.running { background: #00d2ff; box-shadow: 0 0 5px #00d2ff; }
.status-indicator.completed { background: #00ff88; }
.status-indicator.error { background: #ff5252; }

.task-main { flex: 1; min-width: 0; }
.type-tag { font-size: 10px; margin-right: 4px; color: #ffeb3b; }
.task-name { font-size: 13px; font-weight: 600; color: #ccc; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.task-item.active .task-name { color: #fff; }
.task-meta { display: flex; gap: 8px; font-size: 10px; color: #666; font-family: monospace; }

.task-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.mini-status { font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 2px 4px; border-radius: 2px; }
.mini-status.running { color: #00d2ff; background: rgba(0, 210, 255, 0.1); }
.mini-status.completed { color: #00ff88; }
.mini-status.error { color: #ff5252; }
.mini-status.pending { color: #888; }

.task-right { position: relative; }
.delete-btn {
  display: none;
  background: none; border: none; font-size: 10px; color: #666; cursor: pointer;
  position: absolute; right: 0; bottom: -8px; 
}
.delete-btn:hover { color: #ff5252; }
.task-item:hover .delete-btn { display: block; }
.task-item:hover .mini-status { opacity: 0; } /* Hide status on hover to show delete? or just stack them */

/* Better approach: Just sidebar the delete button next to status if space permits, 
   or replace status text with delete icon on hover */
.task-item:hover .mini-status { display: none; }
.task-item:hover .delete-btn { display: block; position: static; color: #888; }
.task-item:hover .delete-btn:hover { color: #ff5252; font-weight: bold; }

.mini-progress-track { width: 50px; height: 2px; background: #333; overflow: hidden; }
.mini-progress-fill { height: 100%; background: #00d2ff; }

.empty-state { padding: 30px; text-align: center; color: #444; font-size: 10px; letter-spacing: 1px; }

.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; }
</style>

<template>
  <div class="file-node">
    <div class="file-row" @click="toggle" :class="{ 'is-dir': isDir }">
      <div class="col-name" :style="{ paddingLeft: depth * 20 + 'px' }">
        <span class="file-icon" v-if="isDir">
             {{ isOpen ? '📂' : '📁' }}
        </span>
        <span class="file-icon" v-else>📄</span>
        <span class="file-text">{{ file.name }}</span>
      </div>
      <div class="col-size">{{ formatSize(file.size) }}</div>
      <div class="col-action">
        <a v-if="!isDir" :href="getDownloadUrl(file.path)" class="download-btn" target="_blank" download @click.stop>
          ⬇
        </a>
      </div>
    </div>
    
    <!-- Recursive Children -->
    <div v-if="isDir && isOpen" class="file-children">
        <ResultFileNode 
            v-for="child in file.children" 
            :key="child.path" 
            :file="child" 
            :taskId="taskId"
            :depth="depth + 1"
        />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  file: { type: Object, required: true },
  taskId: { type: String, required: true },
  depth: { type: Number, default: 0 }
});

const isOpen = ref(false);
const isDir = computed(() => props.file.type === 'directory');

const toggle = () => {
    if(isDir.value) isOpen.value = !isOpen.value;
};

const formatSize = (bytes) => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const BACKEND_URL = 'http://localhost:8000';

const getDownloadUrl = (filePath) => {
  return `${BACKEND_URL}/api/v1/tasks/${props.taskId}/files/download?path=${filePath}`;
};
</script>

<style scoped>
.file-row {
  display: flex; align-items: center;
  padding: 8px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 12px; color: #ccc;
  cursor: default;
}
.file-row.is-dir { cursor: pointer; }
.file-row:hover { background: rgba(255,255,255,0.03); }

.col-name { flex: 1; display: flex; align-items: center; gap: 10px; }
.file-icon { font-size: 14px; opacity: 0.7; }
.file-text { font-family: 'Consolas', monospace; }

.col-size { width: 80px; text-align: right; color: #666; font-size: 11px; }
.col-action { width: 60px; display: flex; justify-content: flex-end; }

.download-btn {
  background: rgba(0, 210, 255, 0.1);
  color: #00d2ff;
  border: 1px solid rgba(0, 210, 255, 0.2);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; text-decoration: none;
  transition: all 0.2s;
}
.download-btn:hover { background: #00d2ff; color: #000; }
</style>

<template>
  <div class="file-node">
    <div class="file-row" @click="handleClick" @dblclick="handleDblClick" :class="{ 'is-dir': isDir }">
      <div class="col-name" :style="{ paddingLeft: depth * 20 + 'px' }">
        <span class="file-icon" v-if="isDir">
             {{ isOpen ? '📂' : '📁' }}
        </span>
        <span class="file-icon" v-else>📄</span>
        <span class="file-text">{{ file.name }}</span>
      </div>
      <div class="col-size">{{ formatSize(file.size) }}</div>
      <div class="col-action"></div>
    </div>
    
    <!-- Recursive Children -->
    <div v-if="isDir && isOpen" class="file-children">
      <ResultFileNode 
        v-for="child in file.children" 
        :key="child.path" 
        :file="child" 
        :taskId="taskId"
        :depth="depth + 1"
        @select-file="emitSelectFile"
        @open-hdf5="emitOpenHdf5"
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

const emit = defineEmits(['select-file', 'open-hdf5']);

const isOpen = ref(false);
const isDir = computed(() => props.file.type === 'directory');

const emitSelectFile = (payload) => emit('select-file', payload);
const emitOpenHdf5 = (payload) => emit('open-hdf5', payload);

const handleClick = () => {
  if (isDir.value) {
    isOpen.value = !isOpen.value;
    return;
  }
  emit('select-file', props.file);
};

const handleDblClick = () => {
  if (isDir.value) return;
  const name = props.file.name || '';
  if (name.toLowerCase().endsWith('.h5')) {
    emit('open-hdf5', props.file);
  }
};

const formatSize = (bytes) => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
.col-action { width: 0; display: none; }
</style>

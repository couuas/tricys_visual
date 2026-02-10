<template>
  <div class="result-files">
    <div class="file-list-header">
      <div class="col-name">FILENAME</div>
      <div class="col-size">SIZE</div>
    </div>
    
    <div class="file-list-body custom-scroll">

      <ResultFileNode 
        v-for="file in files" 
        :key="file.path" 
        :file="file" 
        :taskId="taskId" 
        @select-file="handleSelectFile"
        @open-hdf5="handleOpenHdf5"
      />
      
      <div v-if="files.length === 0" class="empty-files">
        NO FILES FOUND
      </div>
    </div>
  </div>
</template>

<script setup>
import ResultFileNode from './ResultFileNode.vue';

const props = defineProps({
  files: { type: Array, default: () => [] },
  taskId: { type: String, required: true }
});

const emit = defineEmits(['select-file', 'open-hdf5']);

const handleSelectFile = (file) => emit('select-file', file);
const handleOpenHdf5 = (file) => emit('open-hdf5', file);
</script>

<style scoped>
.result-files {
  height: 100%; display: flex; flex-direction: column;
  background: #0d1117;
  font-family: 'Inter', sans-serif;
}

.file-list-header {
  display: flex; padding: 10px 20px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid #30363d;
  font-size: 10px; font-weight: bold; color: #666; letter-spacing: 1px;
}

.file-list-body { flex: 1; overflow-y: auto; }

.file-row {
  display: flex; align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 12px; color: #ccc;
}
.file-row:hover { background: rgba(255,255,255,0.03); }

.col-name { flex: 1; display: flex; align-items: center; gap: 10px; }
.file-icon { font-size: 14px; opacity: 0.7; }
.file-text { font-family: 'Consolas', monospace; }

.col-size { width: 80px; text-align: right; color: #666; font-size: 11px; }

.col-action { width: 0; display: none; }

.empty-files { padding: 40px; text-align: center; color: #444; font-size: 11px; letter-spacing: 1px; }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
</style>

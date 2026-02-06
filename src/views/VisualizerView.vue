<template>
  <div class="result-view">
    <div class="result-body">
       <!-- Main Content -->
       <div class="result-content" v-if="selectedTaskId">
         <div class="result-header">
           <div class="header-left">
             <button class="back-btn" @click="clearSelection" title="Back to Dashboard">◂</button>
             <h3>{{ getTaskName(selectedTaskId) }} ({{ selectedTaskId.slice(0,8) }})</h3>
           </div>
         </div>
          
          <!-- Tabs -->
          <div class="tab-content">
             <div class="files-layout">
               <ResultFileBrowser
                 class="files-tree"
                 :files="fileList"
                 :taskId="selectedTaskId"
                 @select-file="handleSelectFile"
                 @open-hdf5="handleOpenHdf5"
               />
               <div class="file-preview">
                 <div class="preview-section">
                   <div class="section-title">FILE INFO</div>
                   <div class="info-row"><span>Path</span><span>{{ selectedFile?.path || '-' }}</span></div>
                   <div class="info-row"><span>Size</span><span>{{ selectedFile?.size ?? '-' }}</span></div>
                   <div class="info-row"><span>Type</span><span>{{ selectedFile?.name?.split('.').pop() || '-' }}</span></div>
                   <div class="info-row" v-if="hdf5Status.running">
                     <span>HDF5 Visualizer</span>
                     <span>Running (PID {{ hdf5Status.pid }})</span>
                   </div>
                   <div class="info-row" v-if="hdf5Status.running">
                     <span>Started</span>
                     <span>{{ formatStartedAt(hdf5Status.started_at) }}</span>
                   </div>
                   <div class="hint" v-if="hdf5Status.running">
                     Auto-stop in 10 minutes. Status refreshes automatically.
                   </div>
                 </div>
 
                 <div class="preview-section preview-section-text">
                   <div class="section-title">TEXT PREVIEW</div>
                   <div v-if="selectedFile && isH5File(selectedFile?.name)" class="empty">
                     Double-click the .h5 file to launch Tricys HDF5 Visualizer.
                     <div v-if="hdf5Launching" class="hint">Waiting for visualizer to open…</div>
                   </div>
                   <div class="preview-body" v-else-if="isSvgFile(selectedFile?.name) && fileContent">
                     <img :src="svgDataUrl" class="svg-preview" alt="SVG Preview" />
                     <div v-if="fileTruncated" class="hint">Preview truncated.</div>
                   </div>
                   <div class="preview-body" v-else-if="isMarkdownFile(selectedFile?.name) && fileContent">
                     <div ref="markdownRef" class="markdown-body" v-html="renderedMarkdown"></div>
                     <div v-if="fileTruncated" class="hint">Preview truncated.</div>
                   </div>
                   <div class="preview-body" v-else-if="fileContent">
                     <pre>{{ fileContent }}</pre>
                     <div v-if="fileTruncated" class="hint">Preview truncated.</div>
                   </div>
                   <div v-else class="empty">Select a supported file to preview.</div>
                 </div>
               </div>
 
             </div>
           </div>
 
       </div>
       <div class="dashboard-wrapper" v-else>
          <VisualizerDashboard 
            :tasks="completedTasks"
            @select-task="selectTask"
          />
       </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { taskApi } from '../api/task';
import { visualizerApi } from '../api/visualizer';
import ResultFileBrowser from '../components/result/ResultFileBrowser.vue';
import VisualizerDashboard from '../components/result/VisualizerDashboard.vue';
import { $notify, $updateNotification, closeNotification } from '../utils/notification';
import { marked } from 'marked';
import apiClient from '../api/client';

const route = useRoute();
const router = useRouter();

const completedTasks = ref([]);
const selectedTaskId = ref(null);
const isLoading = ref(false);

const fileList = ref([]);
const selectedFile = ref(null);
const fileContent = ref('');
const fileTruncated = ref(false);
const hdf5Launching = ref(false);
const hdf5Status = ref({ running: false });
let hdf5NotifyId = null;
let statusTimer = null;
const markdownRef = ref(null);
const imageObjectUrls = new Set();

const getTaskName = (id) => {
  const t = completedTasks.value.find(x => x.id === id);
  return t ? t.name : id;
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
};

const formatStartedAt = (ts) => {
  if (!ts) return '-';
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return '-';
  }
};

const fetchCompletedTasks = async () => {
  isLoading.value = true;
  try {
    const data = await taskApi.listTasks('COMPLETED', 50);
    completedTasks.value = Array.isArray(data) ? data : (data.items || []);
  } catch {
    completedTasks.value = [];
  } finally {
    isLoading.value = false;
  }
};

const selectTask = async (id) => {
  selectedTaskId.value = id;
  selectedFile.value = null;
  fileContent.value = '';
  fileTruncated.value = false;
  hdf5Launching.value = false;
  if (hdf5NotifyId) {
    closeNotification(hdf5NotifyId);
    hdf5NotifyId = null;
  }
  hdf5Status.value = { running: false };

  await loadFileList(id);
  await loadFileList(id);
  startStatusRefresh();
};

const clearSelection = () => {
  selectedTaskId.value = null;
  selectedFile.value = null;
  fileContent.value = '';
  router.push({ query: {} }); // Clear query params
  if (hdf5NotifyId) closeNotification(hdf5NotifyId);
  if (statusTimer) clearInterval(statusTimer);
};

const loadFileList = async (id) => {
  try {
    const data = await taskApi.getFiles(id);
    fileList.value = data;
  } catch {
    fileList.value = [];
  }
};

const isTextFile = (name) => {
  if (!name) return false;
  return /\.(txt|log|md|json|csv|yaml|yml|py|mo|ini|cfg|xml|toml|env|tsv|bat|sh|ps1|js|ts|css|html|sql|rst|tex|dockerfile|svg)$/i.test(name);
};

const isH5File = (name) => /\.h5$/i.test(name || '');
const isMarkdownFile = (name) => /\.md$/i.test(name || '');
const isSvgFile = (name) => /\.svg$/i.test(name || '');

const resolveMarkdownImagePath = (src) => {
  if (!src) return '';
  const raw = typeof src === 'string' ? src : String(src);
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;

  const baseDir = (selectedFile.value?.path || '').split('/').slice(0, -1).join('/');
  const cleanSrc = raw.startsWith('/') ? raw.slice(1) : raw;
  return baseDir ? `${baseDir}/${cleanSrc}` : cleanSrc;
};

const renderedMarkdown = computed(() => {
  if (!fileContent.value || !isMarkdownFile(selectedFile.value?.name)) return '';
  const renderer = new marked.Renderer();
  renderer.image = (href, title, text) => {
    if (href && typeof href === 'object') {
      const token = href;
      href = token.href;
      title = token.title;
      text = token.text;
    }
    const raw = href ? (typeof href === 'string' ? href : String(href)) : '';
    const safeTitle = title ? ` title="${title}"` : '';
    const alt = text || '';
    return `<img data-md-src="${raw}" alt="${alt}"${safeTitle} class="markdown-img" loading="lazy" />`;
  };
  return marked.parse(fileContent.value, { renderer });
});

const svgDataUrl = computed(() => {
  if (!fileContent.value || !isSvgFile(selectedFile.value?.name)) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fileContent.value)}`;
});

const clearImageObjectUrls = () => {
  imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  imageObjectUrls.clear();
};

const hydrateMarkdownImages = async () => {
  if (!markdownRef.value || !selectedTaskId.value) return;
  const imgs = markdownRef.value.querySelectorAll('img[data-md-src]');
  if (!imgs.length) return;

  clearImageObjectUrls();
  for (const img of imgs) {
    const raw = img.getAttribute('data-md-src') || '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) {
      img.setAttribute('src', raw);
      continue;
    }
    const path = resolveMarkdownImagePath(raw);
    try {
      const res = await apiClient.get(`/tasks/${selectedTaskId.value}/files/download`, {
        params: { path },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res);
      imageObjectUrls.add(url);
      img.setAttribute('src', url);
    } catch {
      img.setAttribute('alt', `${img.getAttribute('alt') || ''} (image failed)`);
    }
  }
};

const handleSelectFile = async (file) => {
  selectedFile.value = file;
  fileContent.value = '';
  fileTruncated.value = false;
  hdf5Launching.value = false;
  clearImageObjectUrls();
  if (!file || file.type !== 'file') return;
  if (!isTextFile(file.name)) return;
  try {
    const res = await visualizerApi.getFileContent(selectedTaskId.value, {
      path: file.path,
      max_bytes: 200000
    });
    fileContent.value = res.content || '';
    fileTruncated.value = !!res.truncated;
    await nextTick();
    await hydrateMarkdownImages();
  } catch {
    fileContent.value = '';
    fileTruncated.value = false;
  }
};

const handleOpenHdf5 = async (file) => {
  if (!file || !file.path) return;
  try {
    hdf5Launching.value = true;
    if (hdf5NotifyId) closeNotification(hdf5NotifyId);
    const notifyId = $notify({
      title: 'HDF5 Visualizer',
      message: 'Launching, please wait…',
      type: 'process',
      duration: 0
    });
    hdf5NotifyId = notifyId;
    await visualizerApi.openHdf5(selectedTaskId.value, { path: file.path });
    const status = await visualizerApi.getHdf5Status(selectedTaskId.value);
    hdf5Status.value = status || { running: false };
    $updateNotification(notifyId, { message: hdf5Status.value.running ? 'Started successfully.' : 'Failed to start.' });
    setTimeout(() => closeNotification(notifyId), hdf5Status.value.running ? 1500 : 2000);
    hdf5NotifyId = null;
  } catch {
    hdf5Status.value = { running: false };
    if (hdf5NotifyId) {
      const notifyId = hdf5NotifyId;
      $updateNotification(notifyId, { message: 'Failed to start.' });
      setTimeout(() => closeNotification(notifyId), 2000);
      hdf5NotifyId = null;
    }
  } finally {
    hdf5Launching.value = false;
  }
};

const startStatusRefresh = () => {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (!selectedTaskId.value) return;
  statusTimer = setInterval(async () => {
    try {
      const status = await visualizerApi.getHdf5Status(selectedTaskId.value);
      hdf5Status.value = status || { running: false };
    } catch {
      hdf5Status.value = { running: false };
    }
  }, 5000);
};

onMounted(async () => {
  await fetchCompletedTasks();
  if (route.query.task_id) {
    selectTask(route.query.task_id);
  }
});

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  if (hdf5NotifyId) closeNotification(hdf5NotifyId);
  clearImageObjectUrls();
});

watch(renderedMarkdown, async () => {
  await nextTick();
  await hydrateMarkdownImages();
});
</script>

<style scoped>
.result-view { width: 100%; height: 100%; background: #05070a; display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', sans-serif; }
.result-body { flex: 1; display: flex; overflow: hidden; min-width: 0; min-height: 0; }


.result-content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.result-header { padding: 15px 20px; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; background: #0b0e14; }
.header-left { display: flex; align-items: center; gap: 10px; }
.back-btn { background: none; border: none; color: #666; font-size: 16px; cursor: pointer; padding: 0; line-height: 1; }
.back-btn:hover { color: #fff; }
.result-header h3 { margin: 0; font-size: 14px; color: #fff; letter-spacing: 1px; }

.tab-content { flex: 1; overflow: hidden; position: relative; background: #05070a; display:flex; flex-direction:column; min-width: 0; min-height: 0; }
.dashboard-wrapper { flex: 1; overflow: hidden; position: relative; width: 100%; height: 100%; }

.files-layout { display: flex; height: 100%; min-width: 0; min-height: 0; position: relative; }
.files-tree { width: 320px; min-width: 240px; border-right: 1px solid #30363d; flex-shrink: 0; }
.file-preview { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow: hidden; }
.preview-section { background: #0d1117; border: 1px solid #30363d; padding: 12px; display: flex; flex-direction: column; min-height: 0; }
.preview-section-text { flex: 1; min-height: 0; }
.section-title { font-size: 10px; font-weight: bold; color: #666; letter-spacing: 1px; margin-bottom: 8px; }
.info-row { display: grid; grid-template-columns: 120px 1fr; gap: 12px; font-size: 12px; color: #c9d1d9; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.info-row span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-body { flex: 1; min-height: 0; overflow: auto; background: #05070a; padding: 10px; border: 1px solid #30363d; }
.preview-body pre { margin: 0; white-space: pre-wrap; color: #c9d1d9; font-family: 'Consolas', monospace; }
.svg-preview { max-width: 100%; height: auto; display: block; }
.markdown-body { color: #c9d1d9; font-family: 'Inter', sans-serif; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #fff; }
.markdown-body a { color: #00d2ff; }
.markdown-body code { background: #0b0e14; padding: 2px 4px; border-radius: 3px; }
.markdown-body pre { background: #0b0e14; padding: 10px; overflow: auto; }
.markdown-img { max-width: 100%; height: auto; display: block; margin: 6px 0; }
.hint { margin-top: 6px; font-size: 11px; color: #8b949e; }
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.modal {
  background: #0d1117;
  border: 1px solid #30363d;
  padding: 16px 20px;
  min-width: 280px;
  text-align: center;
}
.modal-title {
  font-size: 12px;
  color: #c9d1d9;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.modal-body {
  font-size: 12px;
  color: #8b949e;
}

.custom-scroll::-webkit-scrollbar { width: 5px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; }
</style>

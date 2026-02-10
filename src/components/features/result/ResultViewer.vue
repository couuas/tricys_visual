<template>
  <div class="result-viewer">
    <div class="result-header">
      <div class="header-left">
        <button class="back-btn" @click="$emit('back')" title="Back to Dashboard">◂ Back</button>
        <h3>{{ taskName }} ({{ taskId.slice(0,8) }})</h3>
      </div>
    </div>
    
    <div class="tab-content">
      <div class="files-layout">
        <ResultFileBrowser
          class="files-tree"
          :files="fileList"
          :taskId="taskId"
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
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { taskApi } from '../../../api/task';
import { visualizerApi } from '../../../api/visualizer';
import ResultFileBrowser from './ResultFileBrowser.vue';
import { $notify, $updateNotification, closeNotification } from '../../../utils/notification';
import { marked } from 'marked';
import apiClient from '../../../api/client';

const props = defineProps({
  taskId: { type: String, required: true },
  taskName: { type: String, default: 'Task Result' }
});

defineEmits(['back']);

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

const formatStartedAt = (ts) => {
  if (!ts) return '-';
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return '-';
  }
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
    // ... existing renderer logic
    if (href && typeof href === 'object') {
       href = href.href; title = href.title; text = href.text;
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
  if (!markdownRef.value || !props.taskId) return;
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
      const res = await apiClient.get(`/tasks/${props.taskId}/files/download`, {
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
    const res = await visualizerApi.getFileContent(props.taskId, {
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
    await visualizerApi.openHdf5(props.taskId, { path: file.path });
    const status = await visualizerApi.getHdf5Status(props.taskId);
    hdf5Status.value = status || { running: false };
    $updateNotification(notifyId, { message: hdf5Status.value.running ? 'Started successfully.' : 'Failed to start.' });
    setTimeout(() => closeNotification(notifyId), hdf5Status.value.running ? 1500 : 2000);
    hdf5NotifyId = null;
  } catch {
    hdf5Status.value = { running: false };
    if (hdf5NotifyId) {
      $updateNotification(hdf5NotifyId, { message: 'Failed to start.' });
      setTimeout(() => closeNotification(hdf5NotifyId), 2000);
      hdf5NotifyId = null;
    }
  } finally {
    hdf5Launching.value = false;
  }
};

const startStatusRefresh = () => {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(async () => {
        try {
            const status = await visualizerApi.getHdf5Status(props.taskId);
            hdf5Status.value = status || { running: false };
        } catch { hdf5Status.value = { running: false }; }
    }, 5000);
};

onMounted(() => {
  loadFileList(props.taskId);
  startStatusRefresh();
});

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
  if (hdf5NotifyId) closeNotification(hdf5NotifyId);
  clearImageObjectUrls();
});

watch(() => props.taskId, (newId) => {
    loadFileList(newId);
    fileContent.value = '';
    selectedFile.value = null;
    startStatusRefresh();
});

watch(renderedMarkdown, async () => {
  await nextTick();
  await hydrateMarkdownImages();
});
</script>

<style scoped>
.result-viewer { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #05070a; }

.result-header { padding: 10px 20px; border-bottom: 1px solid #30363d; display: flex; align-items: center; background: #0b0e14; flex-shrink: 0; }
.header-left { display: flex; align-items: center; gap: 15px; }
.back-btn { 
    background: none; border: 1px solid #30363d; color: #aaa; font-size: 11px; cursor: pointer; padding: 4px 10px; border-radius: 4px;
    font-weight: 600; transition: all 0.2s;
}
.back-btn:hover { color: #fff; background: #21262d; border-color: #666; }
.result-header h3 { margin: 0; font-size: 14px; color: #fff; letter-spacing: 1px; }

.tab-content { flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; min-height: 0; }
.files-layout { display: flex; height: 100%; min-width: 0; min-height: 0; }
.files-tree { width: 320px; min-width: 240px; border-right: 1px solid #30363d; flex-shrink: 0; }
.file-preview { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow: hidden; }

.preview-section { background: #0d1117; border: 1px solid #30363d; padding: 12px; display: flex; flex-direction: column; min-height: 0; }
.preview-section-text { flex: 1; min-height: 0; }
.section-title { font-size: 10px; font-weight: bold; color: #666; letter-spacing: 1px; margin-bottom: 8px; }

.info-row { display: grid; grid-template-columns: 120px 1fr; gap: 12px; font-size: 12px; color: #c9d1d9; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.info-row span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.preview-body { flex: 1; min-height: 0; overflow: auto; background: #05070a; padding: 10px; border: 1px solid #30363d; }
.preview-body pre { margin: 0; white-space: pre-wrap; color: #c9d1d9; font-family: 'Consolas', monospace; font-size: 12px; }
.svg-preview { max-width: 100%; height: auto; display: block; }

.markdown-body { color: #c9d1d9; font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; }
/* Markdown styles matching VisualizerView */
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3) { color: #fff; margin-top: 1em; margin-bottom: 0.5em; }
:deep(.markdown-body a) { color: #00d2ff; }
:deep(.markdown-body code) { background: #0b0e14; padding: 2px 4px; border-radius: 3px; font-family: 'Consolas', monospace; }
:deep(.markdown-body pre) { background: #0b0e14; padding: 10px; overflow: auto; border-radius: 4px; border: 1px solid #30363d; }
:deep(.markdown-img) { max-width: 100%; height: auto; display: block; margin: 6px 0; border: 1px solid #30363d; }

.hint { margin-top: 6px; font-size: 11px; color: #8b949e; }
.empty { color: #555; font-style: italic; padding: 20px; text-align: center; }
</style>

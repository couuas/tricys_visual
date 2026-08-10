<template>
  <div class="result-viewer">
    <div class="result-header">
      <div class="header-left">
        <button class="back-btn" @click="$emit('back')" title="Back to Dashboard">◂ Back</button>
        <h3>{{ taskName }} ({{ taskId.slice(0,8) }})</h3>
      </div>
    </div>
    
    <div class="tab-content">
      <div v-if="taskFocConfig" class="foc-preview-panel">
        <TaskFocPreview :task="task" />
      </div>
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
            <div class="info-row" v-if="selectedFile && isH5File(selectedFile?.name)">
              <span>HDF5 Visualizer</span>
              <span>Available in-app</span>
            </div>
          </div>

          <div class="preview-section preview-section-text">
            <div class="section-title">TEXT PREVIEW</div>
            <div v-if="selectedFile && isH5File(selectedFile?.name)" class="empty">
              Double-click the .h5 file to open the in-app HDF5 visualizer.
              <div v-if="hdf5Launching" class="hint">Opening visualizer…</div>
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
import { useRoute, useRouter } from 'vue-router';
import { taskApi } from '../../../api/task';
import { visualizerApi } from '../../../api/visualizer';
import ResultFileBrowser from './ResultFileBrowser.vue';
import { TaskFocPreview } from '../../simulation/public';
import { $notify, $updateNotification, closeNotification } from '../../../utils/notification';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';
import apiClient from '../../../api/client';

marked.use(markedKatex({ 
  throwOnError: false,
  nonStandard: true 
}));
import { getTaskFocConfig } from '../../../utils/taskFoc';

const props = defineProps({
  taskId: { type: String, required: true },
  taskName: { type: String, default: 'Task Result' },
  task: { type: Object, default: null }
});

const router = useRouter();
const route = useRoute();

defineEmits(['back']);

const fileList = ref([]);
const selectedFile = ref(null);
const fileContent = ref('');
const fileTruncated = ref(false);
const hdf5Launching = ref(false);
let hdf5NotifyId = null;
const markdownRef = ref(null);
const imageObjectUrls = new Set();
const taskFocConfig = computed(() => getTaskFocConfig(props.task));

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

  let processedContent = fileContent.value
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$$')
    .replace(/\\\)/g, '$$');

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
  return marked.parse(processedContent, { renderer });
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
      message: 'Opening, please wait…',
      type: 'process',
      duration: 0
    });
    hdf5NotifyId = notifyId;
    const response = await visualizerApi.openHdf5(props.taskId, { path: file.path });
    if (response?.viewer_path) {
      router.push(response.viewer_path);
    } else {
      router.push({
        name: 'visualizer',
        query: {
          projectId: route.query.projectId,
          taskId: props.taskId,
          path: file.path,
          token: response?.token,
        },
      });
    }
    $updateNotification(notifyId, { message: 'Opened successfully.' });
    setTimeout(() => closeNotification(notifyId), 1200);
    hdf5NotifyId = null;
  } catch {
    if (hdf5NotifyId) {
      $updateNotification(hdf5NotifyId, { message: 'Failed to open.' });
      setTimeout(() => closeNotification(hdf5NotifyId), 2000);
      hdf5NotifyId = null;
    }
  } finally {
    hdf5Launching.value = false;
  }
};

onMounted(() => {
  loadFileList(props.taskId);
});

onUnmounted(() => {
  if (hdf5NotifyId) closeNotification(hdf5NotifyId);
  clearImageObjectUrls();
});

watch(() => props.taskId, (newId) => {
    loadFileList(newId);
    fileContent.value = '';
    selectedFile.value = null;
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
.foc-preview-panel { padding: 12px 12px 0; flex-shrink: 0; }
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

.markdown-body { 
  color: #c9d1d9; 
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
  font-size: 14px; 
  line-height: 1.6; 
  padding: 10px 20px;
}

/* Premium Markdown Styles matching modern dark mode aesthetics */
:deep(.markdown-body h1), 
:deep(.markdown-body h2), 
:deep(.markdown-body h3),
:deep(.markdown-body h4),
:deep(.markdown-body h5),
:deep(.markdown-body h6) { 
  color: #e6edf3; 
  margin-top: 24px; 
  margin-bottom: 16px; 
  font-weight: 600;
  line-height: 1.25;
}

:deep(.markdown-body h1) { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #21262d; }
:deep(.markdown-body h2) { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #21262d; }
:deep(.markdown-body h3) { font-size: 1.25em; }

:deep(.markdown-body p) { margin-top: 0; margin-bottom: 16px; }

:deep(.markdown-body a) { color: #4493f8; text-decoration: none; }
:deep(.markdown-body a:hover) { text-decoration: underline; }

:deep(.markdown-body code) { 
  background: rgba(110,118,129,0.4); 
  padding: 0.2em 0.4em; 
  border-radius: 6px; 
  font-family: 'Consolas', 'Courier New', monospace; 
  font-size: 85%;
}

:deep(.markdown-body pre) { 
  background: #161b22; 
  padding: 16px; 
  overflow: auto; 
  border-radius: 6px; 
  border: 1px solid #30363d; 
  margin-bottom: 16px;
}

:deep(.markdown-body pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 100%;
}

:deep(.markdown-body blockquote) {
  padding: 0 1em;
  color: #8b949e;
  border-left: 0.25em solid #30363d;
  margin: 0 0 16px 0;
}

:deep(.markdown-body ul), :deep(.markdown-body ol) {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

:deep(.markdown-body li) { margin-top: 0.25em; }

:deep(.markdown-body table) {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 16px;
  width: 100%;
  max-width: 100%;
  overflow: auto;
  display: block;
}

:deep(.markdown-body table th),
:deep(.markdown-body table td) {
  padding: 8px 13px;
  border: 1px solid #30363d;
}

:deep(.markdown-body table th) {
  font-weight: 600;
  background-color: #161b22;
}

:deep(.markdown-body table tr) {
  background-color: #0d1117;
  border-top: 1px solid #21262d;
}

:deep(.markdown-body table tr:nth-child(2n)) {
  background-color: #161b22;
}

:deep(.markdown-body hr) {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #30363d;
  border: 0;
}

:deep(.markdown-img) { 
  max-width: 100%; 
  height: auto; 
  display: block; 
  margin: 20px auto; 
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  border: 1px solid #30363d; 
}

.hint { margin-top: 6px; font-size: 11px; color: #8b949e; }
.empty { color: #555; font-style: italic; padding: 20px; text-align: center; }

@media (max-width: 960px) {
  .files-layout {
    flex-direction: column;
  }

  .files-tree {
    width: 100%;
    min-width: 0;
    max-height: 260px;
    border-right: none;
    border-bottom: 1px solid #30363d;
  }
}
</style>

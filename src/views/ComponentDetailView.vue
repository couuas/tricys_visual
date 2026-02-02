<template>
  <div class="detail-view" :class="{ 'view-mode': !isEditMode }">
    
    <transition name="slide-down-fade">
      <div class="top-bar">
        
        <div class="bar-section left">
          <button class="nav-btn back" @click="goBack" title="Return to Visualization">
            <span class="icon">⬅</span>
          </button>
          <div class="brand-group">
            <div class="logo-icon">☢</div>
            <div class="logo-text">
              {{ id.toUpperCase() }} DASHBOARD
            </div>
          </div>
        </div>
        
        <div class="bar-section right">
          
          <div v-if="isReadOnly" class="readonly-status">
            <span class="lock-icon">🔒</span> READ ONLY PREVIEW
          </div>

          <transition name="fade">
            <div class="control-group" v-show="isEditMode">
              <button class="hud-btn" @click="addWidget('param')"><span class="icon">📊</span> Params</button>
              <button class="hud-btn" @click="addWidget('code')"><span class="icon">📝</span> Code</button>
              <button class="hud-btn" @click="addWidget('model')"><span class="icon">🧊</span> Model</button>
              <button class="hud-btn" @click="addWidget('media')"><span class="icon">🖼️</span> Media</button>
              <div class="separator"></div>
              <button class="hud-btn primary" @click="saveLayout">
                <span class="icon">💾</span> <span class="btn-text">SAVE</span>
              </button>
            </div>
          </transition>

          <div class="separator" v-if="isEditMode"></div>

          <div class="control-group" v-if="!isReadOnly">
            <button 
              class="hud-btn mode-toggle" 
              :class="{ 'active': isEditMode }"
              @click="toggleEditMode" 
              :title="isEditMode ? 'Finish Editing' : 'Edit Dashboard Layout'"
            >
              <span class="icon">{{ isEditMode ? '✓' : '✎' }}</span>
              <span class="btn-text">{{ isEditMode ? 'DONE' : 'EDIT' }}</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <div class="grid-container">
      <grid-layout
        v-if="layout.length > 0 || isReady"
        v-model:layout="layout"
        :col-num="12" :row-height="30" 
        :is-draggable="isEditMode" 
        :is-resizable="isEditMode"
        :vertical-compact="true" :margin="[15, 15]" :use-css-transforms="true"
      >
        <grid-item
          v-for="item in layout" :key="item.i"
          :x="item.x" :y="item.y" :w="item.w" :h="item.h" :i="item.i"
          drag-allow-from=".card-header" 
          class="grid-card"
          :class="{ 'maximized': item.isMaximized }"
        >
          <transition name="fade">
            <div class="card-header" v-show="isEditMode">
              <div class="header-title">
                <span class="type-icon">{{ getIcon(item.type, item.mediaType) }}</span>
                {{ getCardTitle(item.type, item.mediaType) }}
              </div>
              
              <div class="header-actions">
                <button class="action-btn" @click.stop="resizeCard(item, 6)" title="Half Width">½</button>
                <button class="action-btn" @click.stop="resizeCard(item, 12)" title="Full Width">█</button>
                <div class="divider-v"></div>
                <button v-if="item.type === 'media' && item.mediaUrl" class="action-btn" @click.stop="clearMedia(item)" title="Change Media">↺</button>
                <button class="action-btn danger" @mousedown.stop @click.stop="removeWidget(item.i)">×</button>
              </div>
            </div>
          </transition>

          <div class="card-content" @mousedown.stop>
            
            <div v-if="item.type === 'param'" class="param-list custom-scroll">
              <table class="param-table">
                <thead>
                  <tr>
                    <th>PARAMETER KEY</th>
                    <th>VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(val, key) in paramsData" :key="key">
                    <td class="k">{{ key }}</td><td class="v" :title="val">{{ formatValue(val) }}</td>
                  </tr>
                  <tr v-if="Object.keys(paramsData).length === 0">
                    <td colspan="2" class="empty-row">No parameters data</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="item.type === 'code'" class="code-viewer custom-scroll">
              <pre><code>{{ sourceCode }}</code></pre>
            </div>
            
            <div v-if="item.type === 'media'" class="media-container">
              <div v-if="item.mediaUrl" class="media-display">
                <img v-if="item.mediaType === 'image'" :src="`${BACKEND_URL}${item.mediaUrl}`" class="media-img" />
                <video v-if="item.mediaType === 'video'" :src="`${BACKEND_URL}${item.mediaUrl}`" controls class="media-video"></video>
                <Mini3DViewer v-if="item.mediaType === 'model'" :modelUrl="item.mediaUrl" />
                <div v-if="item.mediaType === 'markdown'" class="markdown-viewer custom-scroll" v-html="markdownCache[item.i] || 'Loading...'"></div>
                <iframe v-if="item.mediaType === 'html'" :src="`${BACKEND_URL}${item.mediaUrl}`" class="media-iframe" frameborder="0"></iframe>
              </div>

              <div v-else class="upload-placeholder">
                <div class="upload-text">Select Media Type</div>
                <div class="upload-buttons">
                  <label class="up-btn img-btn"><span>🖼️ Img</span><input type="file" accept="image/*,.gif" @change="(e) => handleMediaUpload(e, item, 'image')" hidden></label>
                  <label class="up-btn vid-btn"><span>🎥 Video</span><input type="file" accept="video/*" @change="(e) => handleMediaUpload(e, item, 'video')" hidden></label>
                  <label class="up-btn 3d-btn"><span>🧊 Model</span><input type="file" accept=".glb,.gltf" @change="(e) => handleMediaUpload(e, item, 'model')" hidden></label>
                  <label class="up-btn md-btn"><span>📝 MD</span><input type="file" accept=".md,.markdown" @change="(e) => handleMediaUpload(e, item, 'markdown')" hidden></label>
                  <label class="up-btn html-btn"><span>🌐 HTML</span><input type="file" accept=".html,.htm" @change="(e) => handleMediaUpload(e, item, 'html')" hidden></label>
                </div>
              </div>
            </div>

          </div>
        </grid-item>
      </grid-layout>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { GridLayout, GridItem } from 'vue3-grid-layout-next';
import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked'; 
import { useSimulation } from '../composables/useSimulation';
import Mini3DViewer from '../components/Mini3DViewer.vue';
import { $confirm } from '../utils/dialog';
import { $notify } from '../utils/notification'; 
import { projectApi } from '../api/project'; 

const props = defineProps(['id']);
const router = useRouter();
const route = useRoute();
const { componentParams, modelConfig, loadModelConfig, currentProjectId, loadData, isReadOnly } = useSimulation();

watch(componentParams, () => {
  loadComponentData();
}, { deep: true });

const layout = ref([]);
const sourceCode = ref('');
const paramsData = ref({});
const isReady = ref(false);

// [MODIFIED] Default is View Mode (false)
const isEditMode = ref(false);
const markdownCache = ref({});
const BACKEND_URL = 'http://localhost:8000';

onMounted(async () => {
  // Ensure we have project ID (rescue from route or localStorage if needed)
  const pid = currentProjectId.value || route.query.projectId || localStorage.getItem('tricys_last_pid');
  if (pid) currentProjectId.value = pid;

  // [FIX] If global state is lost (on refresh), trigger a data load
  if (pid && (!componentParams.value || componentParams.value.length === 0)) {
      await loadData(pid);
  }

  await loadModelConfig();
  await loadComponentData();
  
  const sid = props.id.toLowerCase();
  const cfg = modelConfig.value[sid];
  const hasCustomModel = cfg && cfg.type === 'custom' && cfg.url;

  await loadLayout(hasCustomModel, cfg);
  isReady.value = true;
});

// [MODIFIED] Simple toggle
const toggleEditMode = () => {
  isEditMode.value = !isEditMode.value;
  if (!isEditMode.value) {
      // Optional: Auto-save when exiting edit mode?
      // saveLayout(); 
      $notify({ title: 'VIEW MODE', message: 'Layout locked.', type: 'info', duration: 2000 });
  } else {
      $notify({ title: 'EDIT MODE', message: 'Layout unlocked. You can now rearrange cards.', type: 'warning', duration: 2000 });
  }
};

const resizeCard = (item, width) => {
  item.w = width;
  if (width === 12) item.x = 0;
  layout.value.forEach(other => {
    if (other.i === item.i) return;
    if (collides(item, other)) {
       other.y = item.y + item.h;
    }
  });
};

const collides = (a, b) => {
  if (a.x + a.w <= b.x) return false; 
  if (a.x >= b.x + b.w) return false; 
  if (a.y + a.h <= b.y) return false; 
  if (a.y >= b.y + b.h) return false; 
  return true; 
};

const loadComponentData = async () => {
  // Convert array of params [{name, value}, ...] to object {shortName: value} for this component
  const cidPrefix = props.id.toLowerCase() + '.';
  const filtered = {};
  
  if (Array.isArray(componentParams.value)) {
    componentParams.value.forEach(p => {
      if (p.name.toLowerCase().startsWith(cidPrefix)) {
        const shortName = p.name.substring(cidPrefix.length);
        filtered[shortName] = p.value;
      }
    });
  }
  paramsData.value = filtered;

  try {
    if (currentProjectId.value) {
      const data = await projectApi.getComponentSource(currentProjectId.value, props.id);
      sourceCode.value = data.code;
    }
  } catch (e) {}
};

const calcFullscreenHeight = () => {
  const hPx = window.innerHeight - 80; 
  const h = Math.floor(hPx / 30); 
  return Math.max(10, h); 
};

const loadLayout = async (hasCustomModel, cfg) => {
  try {
    if (!currentProjectId.value) throw new Error("No project context");
    const data = await projectApi.getLayout(currentProjectId.value, props.id);
    
    if (data && data.length) {
      layout.value = data;
    } else {
      if (hasCustomModel) {
        const fullH = calcFullscreenHeight();
        layout.value = [{
          i: uuidv4(), x: 0, y: 0, w: 12, h: fullH, 
          type: 'media', mediaType: 'model', mediaUrl: cfg.url
        }];
      } else {
        layout.value = [
          { i: uuidv4(), x: 0, y: 0, w: 4, h: 20, type: 'param' },
          { i: uuidv4(), x: 4, y: 0, w: 8, h: 20, type: 'code' }
        ];
      }
    }

    layout.value.forEach(item => {
      if (item.type === 'media' && item.mediaType === 'markdown' && item.mediaUrl) {
        fetchMarkdownContent(item);
      }
    });

  } catch (e) {
    console.error("Layout load failed", e);
    layout.value = [
      { i: uuidv4(), x: 0, y: 0, w: 4, h: 20, type: 'param' },
      { i: uuidv4(), x: 4, y: 0, w: 8, h: 20, type: 'code' }
    ];
  }
};

const fetchMarkdownContent = async (item) => {
  try {
    const res = await fetch(`${BACKEND_URL}${item.mediaUrl}`);
    if (res.ok) {
      const text = await res.text();
      markdownCache.value[item.i] = marked.parse(text);
    }
  } catch (e) {
    markdownCache.value[item.i] = '<p style="color: #ff7b72">Failed to load Markdown content.</p>';
  }
};

const handleMediaUpload = async (event, item, type) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (!currentProjectId.value) throw new Error("No project context available");
    const data = await projectApi.uploadMedia(currentProjectId.value, file);
    item.mediaUrl = data.url;
    item.mediaType = type;
    if (type === 'markdown') fetchMarkdownContent(item);
    $notify({ title: 'MEDIA UPLOADED', message: 'Asset attached to card.', type: 'success', duration: 2000 });
  } catch (e) {
    $notify({ title: 'UPLOAD FAILED', message: 'Upload interrupted or rejected.', type: 'error' });
  }
};

const clearMedia = async (item) => {
  const isConfirmed = await $confirm("Remove this media asset?", "REMOVE MEDIA");
  if(isConfirmed) {
    item.mediaUrl = null;
    item.mediaType = null;
    if (markdownCache.value[item.i]) delete markdownCache.value[item.i];
  }
};

const addWidget = (type) => {
  let maxY = 0;
  layout.value.forEach(item => { if(item.y + item.h > maxY) maxY = item.y + item.h; });
  let finalType = type;
  let initialMediaType = null;
  let initialMediaUrl = null;

  if (type === 'model') {
    finalType = 'media';
    initialMediaType = 'model';
    const sid = props.id.toLowerCase();
    const cfg = modelConfig.value[sid];
    if (cfg && cfg.type === 'custom' && cfg.url) initialMediaUrl = cfg.url;
  }

  layout.value.push({
    i: uuidv4(), x: 0, y: maxY, w: 6, h: 10, 
    type: finalType, mediaUrl: initialMediaUrl, mediaType: initialMediaType 
  });
};

const removeWidget = (i) => { layout.value = layout.value.filter(item => item.i !== i); };
const saveLayout = async () => {
  try {
    if (!currentProjectId.value) return;
    await projectApi.saveLayout(currentProjectId.value, props.id, layout.value);
    $notify({ title: 'LAYOUT SAVED', message: 'Dashboard configuration updated.', type: 'success' });
  } catch (e) {
    $notify({ title: 'SAVE ERROR', message: 'Could not save layout.', type: 'error' });
  }
};
const goBack = () => {
  const pid = route.query.projectId || localStorage.getItem('tricys_last_pid');
  router.push({ name: 'config', query: { projectId: pid } });
};

const getCardTitle = (type, mediaType) => {
  if (type === 'media') {
    if (mediaType === 'model') return '3D Model Viewer';
    if (mediaType === 'video') return 'Video Player';
    if (mediaType === 'image') return 'Image Viewer';
    if (mediaType === 'markdown') return 'Documentation'; 
    if (mediaType === 'html') return 'Web Page'; 
    return 'New Media Card';
  }
  return { 'param': 'Parameters', 'code': 'Source Code' }[type] || 'Widget';
};

const getIcon = (type, mediaType) => {
  if (type === 'media') {
      if (mediaType === 'model') return '🧊';
      if (mediaType === 'video') return '🎥';
      if (mediaType === 'image') return '🖼️';
      if (mediaType === 'markdown') return '📝'; 
      if (mediaType === 'html') return '🌐'; 
      return '➕';
  }
  return { 'param': '📊', 'code': '📝' }[type];
};

const formatValue = (val) => {
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'number') return Number.isInteger(val) ? val : val.toFixed(4);
  return val;
};
</script>

<style scoped>
/* Base Styles */
.detail-view { width: 100%; height: 100%; background: #05070a; display: flex; flex-direction: column; color: #eee; overflow: hidden; transition: background 0.3s; font-family: 'Inter', sans-serif; }

/* Top Bar */
.top-bar { 
  flex: 0 0 65px; z-index: 500; 
  display: flex; align-items: center; justify-content: space-between; 
  padding: 0 20px; box-sizing: border-box; background: rgba(16, 20, 28, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0, 210, 255, 0.15); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); 
}
.top-bar::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(0,210,255,0.5) 50%, transparent 100%); box-shadow: 0 0 8px rgba(0, 210, 255, 0.4); }

.bar-section { display: flex; align-items: center; height: 100%; }
.bar-section.left { gap: 20px; }
.bar-section.right { gap: 15px; }

.brand-group { display: flex; align-items: center; gap: 10px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px; }
.logo-icon { font-size: 24px; color: #00d2ff; text-shadow: 0 0 10px rgba(0,210,255,0.6); }
.logo-text { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 1px; }
.logo-text .version { font-size: 10px; color: #666; font-weight: normal; margin-left: 5px; vertical-align: top; }

.control-group { display: flex; gap: 8px; align-items: center; }
.readonly-status { border: 1px solid rgba(255, 215, 0, 0.3); background: rgba(255, 215, 0, 0.05); color: #ffd700; font-size: 10px; font-weight: bold; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 5px; margin-right: 15px; letter-spacing: 0.5px; }
.separator { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.15); margin: 0 5px; }

/* HUD Buttons */
.hud-btn { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.15); color: #a0a0a0; height: 32px; padding: 0 14px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; transition: all 0.2s; position: relative; overflow: hidden; }
.hud-btn:hover { border-color: #00d2ff; color: #fff; background: rgba(0, 210, 255, 0.1); box-shadow: 0 0 10px rgba(0, 210, 255, 0.15); }
.hud-btn.primary { border-color: #00d2ff; color: #00d2ff; }
.hud-btn.primary:hover { background: #00d2ff; color: #000; }
.hud-btn.mode-toggle.active { background: #00d2ff; color: #000; border-color: #00d2ff; box-shadow: 0 0 15px rgba(0, 210, 255, 0.4); }

.nav-btn.back { background: transparent; border: none; font-size: 18px; color: #888; cursor: pointer; transition: color 0.2s; padding: 0; }
.nav-btn.back:hover { color: #fff; }

/* Grid & Cards */
.grid-container { flex: 1; overflow-y: auto; position: relative; background-image: radial-gradient(#21262d 1px, transparent 1px); background-size: 20px 20px; padding: 20px; transition: padding 0.3s; }

.grid-card { 
  background: #161b22; 
  border: 1px solid #30363d; 
  border-radius: 8px; 
  display: flex; flex-direction: column; 
  box-shadow: 0 10px 30px rgba(0,0,0,0.6); /* Deeper shadow for depth */
  transition: all 0.3s ease; 
  overflow: hidden; 
}

.card-header { height: 36px; flex-shrink: 0; background: #21262d; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; padding: 0 12px; cursor: grab; user-select: none; }
.card-header:active { cursor: grabbing; }
.header-title { font-size: 11px; font-weight: 700; color: #8b949e; display: flex; gap: 8px; align-items: center; letter-spacing: 0.5px; text-transform: uppercase; }
.type-icon { color: #00d2ff; }

.header-actions { display: flex; align-items: center; gap: 6px; }
.action-btn { background: transparent; border: 1px solid transparent; color: #666; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
.action-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.action-btn.danger:hover { background: rgba(255, 82, 82, 0.2); color: #ff5252; }
.divider-v { width: 1px; height: 14px; background: rgba(255,255,255,0.1); margin: 0 2px; }

.card-content { flex: 1; display: flex; flex-direction: column; position: relative; background: transparent; transition: background 0.3s; overflow: hidden; height: 100%; }

/* Media & Viewers */
.media-container, .media-display { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; }
.media-img, .media-video { max-width: 100%; max-height: 100%; object-fit: contain; }
.media-iframe { width: 100%; height: 100%; background: #fff; }
.markdown-viewer { width: 100%; height: 100%; padding: 20px; overflow-y: auto; background: #0d1117; color: #c9d1d9; line-height: 1.6; }
.markdown-viewer :deep(h1) { border-bottom: 1px solid #30363d; padding-bottom: 0.3em; color: #fff; font-size: 1.5em; }
.code-viewer { flex: 1; margin: 0; padding: 15px; font-family: "Consolas", monospace; font-size: 12px; line-height: 1.5; color: #c9d1d9; white-space: pre; overflow: auto; }

/* Param List */
.param-list { flex: 1; overflow: auto; padding: 0; position: relative; }
.param-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: "Consolas", monospace; }
.param-table th { position: sticky; top: 0; background: #1c2128; color: #00d2ff; font-weight: 800; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 10px 12px; border-bottom: 2px solid #30363d; z-index: 10; text-align: center; }
.param-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; height: 32px; text-align: center; }
.param-table .k { color: #8b949e; width: 45%; border-right: 1px solid rgba(255,255,255,0.05); font-weight: 600; }
.param-table .v { color: #a5d6ff; word-break: break-all; }
.param-table tr:hover { background: rgba(0, 210, 255, 0.05); }
.empty-row { text-align: center; color: #666; font-style: italic; padding: 20px !important; }

/* View Mode (Clean look) */
.view-mode { background: #05070a; }
.view-mode .grid-container { background-image: none; }
/* In view mode, cards still have borders but no headers */
/* .view-mode .card-header { display: none; }  <-- Handled by v-show */

/* Scrollbars */
.custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.2); }

/* --- Resize Handles Styling --- */
/* The library only generates one handle (Bottom-Right) by design. */
:deep(.vue-resizable-handle) {
  width: 12px;
  height: 12px;
  background: transparent;
  z-index: 100;
  position: absolute;
  bottom: 2px !important;
  right: 2px !important;
  cursor: se-resize !important;
  
  /* Create a visual corner bracket */
  border-right: 2px solid rgba(0, 210, 255, 0.5);
  border-bottom: 2px solid rgba(0, 210, 255, 0.5);
  transition: all 0.2s;
}

/* Hide handles when not in edit mode */
.view-mode :deep(.vue-resizable-handle) {
  display: none !important;
}

:deep(.vue-resizable-handle:hover) {
  border-color: #00d2ff;
  background: rgba(0, 210, 255, 0.1);
  transform: scale(1.2);
}

.upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.upload-text { color: #666; font-style: italic; }
.upload-buttons { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.up-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 80px; height: 60px; border: 1px dashed #444; border-radius: 6px; cursor: pointer; color: #888; font-size: 12px; transition: 0.2s; }
.up-btn:hover { border-color: #00d2ff; color: #fff; background: rgba(0, 210, 255, 0.1); }

.slide-down-fade-enter-active, .slide-down-fade-leave-active { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); } 
.slide-down-fade-enter-from, .slide-down-fade-leave-to { transform: translateY(-100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
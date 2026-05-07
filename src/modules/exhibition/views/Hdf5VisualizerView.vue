<template>
  <div class="hdf5-shell">
    <div class="viewer-bar">
      <div class="viewer-title-group">
        <button class="viewer-btn" @click="goBack">◂ Back</button>
        <div>
          <h2>HDF5 Visualizer</h2>
          <p class="viewer-subtitle">{{ filePath || 'No file selected' }}</p>
        </div>
      </div>
      <div class="viewer-actions">
        <button class="viewer-btn" @click="reloadViewer" :disabled="loading || !iframeSrc">{{ loading ? 'Loading…' : 'Reload' }}</button>
        <button class="viewer-btn viewer-btn-accent" @click="openNewTab" :disabled="!iframeSrc">Open In New Tab</button>
      </div>
    </div>

    <div v-if="errorMessage" class="viewer-error">{{ errorMessage }}</div>

    <div v-else class="viewer-frame-wrap">
      <div v-if="loading" class="viewer-loading">Loading shared HDF5 service…</div>
      <iframe
        v-if="iframeSrc"
        :key="iframeSrc"
        :src="iframeSrc"
        class="viewer-frame"
        title="TRICYS HDF5 Visualizer"
        @load="handleFrameLoad"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { visualizerApi } from '../../../api/visualizer';

const route = useRoute();
const router = useRouter();

const iframeSrc = ref('');
const loading = ref(false);
const errorMessage = ref('');
const resolvedToken = ref('');
const resolvedServiceUrl = ref('');

const taskId = computed(() => String(route.query.taskId || ''));
const filePath = computed(() => String(route.query.path || ''));
const projectId = computed(() => String(route.query.projectId || ''));
const routeToken = computed(() => String(route.query.token || ''));

const buildIframeUrl = (token, serviceUrl = '', reloadKey = '') => {
  if (serviceUrl) {
    const normalized = serviceUrl
      .replace(/([?&])token=[^&]*/g, '')
      .replace(/([?&])reloadKey=[^&]*/g, '')
      .replace(/[?&]$/, '');
    const separator = normalized.includes('?') ? '&' : '?';
    const suffix = reloadKey ? `&reloadKey=${encodeURIComponent(reloadKey)}` : '';
    return `${normalized}${separator}token=${encodeURIComponent(token)}${suffix}`;
  }
  const suffix = reloadKey ? `&reloadKey=${encodeURIComponent(reloadKey)}` : '';
  return `/hdf5/?token=${encodeURIComponent(token)}${suffix}`;
};

const goBack = () => {
  router.push({ name: 'monitor', query: { projectId: projectId.value } });
};

const handleFrameLoad = () => {
  loading.value = false;
};

const reloadViewer = () => {
  if (!iframeSrc.value) return;
  const token = resolvedToken.value || routeToken.value;
  if (!token) return;

  loading.value = true;
  iframeSrc.value = buildIframeUrl(
    token,
    resolvedServiceUrl.value,
    `${Date.now()}`
  );
};

const openNewTab = () => {
  if (!iframeSrc.value) return;
  window.open(iframeSrc.value, '_blank', 'noopener');
};

const ensureViewer = async () => {
  errorMessage.value = '';

  if (taskId.value && filePath.value && routeToken.value && routeToken.value === resolvedToken.value && iframeSrc.value) {
    return;
  }

  if (!taskId.value || !filePath.value) {
    if (routeToken.value) {
      resolvedToken.value = routeToken.value;
      resolvedServiceUrl.value = '/hdf5/';
      iframeSrc.value = buildIframeUrl(routeToken.value, resolvedServiceUrl.value);
      loading.value = true;
      return;
    }

    iframeSrc.value = '';
    errorMessage.value = 'Missing taskId or HDF5 file path.';
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const response = await visualizerApi.openHdf5(taskId.value, { path: filePath.value });
    const token = String(response?.token || '');
    const serviceUrl = String(response?.service_url || '');

    if (!token || !serviceUrl) {
      throw new Error('Visualizer service did not return a valid token.');
    }

    resolvedToken.value = token;
    resolvedServiceUrl.value = serviceUrl;
    iframeSrc.value = serviceUrl;

    if (route.query.token !== token) {
      router.replace({
        name: 'visualizer',
        query: {
          ...route.query,
          token,
        },
      });
    }
  } catch (error) {
    iframeSrc.value = '';
    loading.value = false;
    errorMessage.value = error?.message || 'Failed to open the HDF5 visualizer service.';
  }
};

watch(
  [taskId, filePath, routeToken],
  () => {
    ensureViewer();
  },
  { immediate: true }
);
</script>

<style scoped>
.hdf5-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background:
    radial-gradient(circle at top left, rgba(46, 125, 50, 0.12), transparent 28%),
    linear-gradient(180deg, #07110c 0%, #09141f 100%);
  color: #ecf7ef;
}

.viewer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(173, 255, 210, 0.15);
  border-radius: 16px;
  background: rgba(8, 19, 14, 0.88);
  backdrop-filter: blur(10px);
}

.viewer-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.viewer-title-group h2 {
  margin: 0;
  font-size: 20px;
}

.viewer-subtitle {
  margin: 4px 0 0;
  color: #97b9a0;
  font-size: 12px;
  word-break: break-all;
}

.viewer-actions {
  display: flex;
  gap: 10px;
}

.viewer-btn {
  border: 1px solid rgba(185, 255, 213, 0.18);
  background: #10231b;
  color: #eaffee;
  padding: 10px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
}

.viewer-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.viewer-btn-accent {
  background: #214d38;
}

.viewer-error {
  border: 1px solid rgba(255, 120, 120, 0.35);
  background: rgba(66, 20, 20, 0.78);
  color: #ffd1d1;
  padding: 14px 16px;
  border-radius: 14px;
}

.viewer-frame-wrap {
  flex: 1;
  min-height: 72vh;
  position: relative;
  border: 1px solid rgba(185, 255, 213, 0.12);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(4, 8, 6, 0.86);
}

.viewer-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  color: #d5f4dd;
  background: linear-gradient(135deg, rgba(11, 35, 25, 0.76), rgba(12, 18, 28, 0.76));
}

.viewer-frame {
  width: 100%;
  min-height: 72vh;
  height: calc(100vh - 180px);
  border: 0;
  background: #fff;
}

@media (max-width: 900px) {
  .viewer-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .viewer-actions {
    width: 100%;
  }

  .viewer-btn {
    flex: 1;
  }
}
</style>

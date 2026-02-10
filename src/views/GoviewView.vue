<template>
  <div class="goview-embed">
    <div class="goview-frame">
      <div v-if="previewBlocked" class="goview-preview">
        <div class="preview-card">
          <div class="preview-title">PREVIEW MODE</div>
          <div class="preview-text">GoView is not available in preview. Please fork this project to continue.</div>
          <div class="preview-actions">
            <button class="preview-btn" @click="handleFork" :disabled="isForking">
              {{ isForking ? 'FORKING...' : 'FORK PROJECT' }}
            </button>
          </div>
        </div>
      </div>
      <div v-else class="goview-body">
        <div v-if="isLoading" class="goview-loading">Loading GoView...</div>
        <iframe
          ref="iframeRef"
          :src="iframeSrc"
          class="goview-iframe"
          frameborder="0"
          allowfullscreen
          referrerpolicy="no-referrer"
          @load="handleLoad"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { projectApi } from '../api/project.js';
import { goviewApi } from '../api/goview.js';
import { $notify } from '../utils/notification';
import { useAuth } from '../composables/useAuth';
import { useSimulation } from '../composables/useSimulation';

const route = useRoute();
const router = useRouter();
const { currentUser } = useAuth();
const { loadData } = useSimulation();
const iframeRef = ref(null);
const isLoading = ref(true);
const previewBlocked = ref(false);
const isForking = ref(false);

const projectId = computed(() => route.query.projectId || localStorage.getItem('tricys_last_pid'));
const goviewProjectId = ref(null);
const token = localStorage.getItem('tricys_auth_token');

const apiBase = computed(() => {
  const v2 = import.meta.env.VITE_API_V2_URL;
  if (v2) return v2;
  const v1 = import.meta.env.VITE_API_URL;
  if (v1) return v1.replace(/\/api\/v1\/?$/, '/api/v2/goview');
  return 'http://localhost:8000/api/v2/goview';
});

const goviewBase = computed(() => import.meta.env.VITE_GOVIEW_URL || 'http://localhost:3020/');

const iframeSrc = computed(() => {
  try {
    const baseUrl = goviewBase.value.replace(/\/$/, '');
    if (!goviewProjectId.value) return baseUrl;

    const url = new URL(baseUrl);
    url.searchParams.set('apiBase', apiBase.value);
    if (token) url.searchParams.set('token', token);
    url.searchParams.set('projectId', String(goviewProjectId.value));

    const encodedId = encodeURIComponent(String(goviewProjectId.value));
    url.hash = `/chart/home/${encodedId}`;
    return url.toString();
  } catch (e) {
    return goviewBase.value;
  }
});

const getTargetOrigin = () => {
  try {
    return new URL(goviewBase.value).origin;
  } catch (e) {
    return '*';
  }
};

const sendContext = () => {
  const targetOrigin = getTargetOrigin();
  const payload = {
    type: 'TRICYS_CTX',
    payload: {
      projectId: goviewProjectId.value,
      token,
      apiBase: apiBase.value
    }
  };
  iframeRef.value?.contentWindow?.postMessage(payload, targetOrigin);
};

const requireAuth = () => {
  if (token) return true;
  $notify({
    title: 'AUTH REQUIRED',
    message: 'Please login to access GoView projects.',
    type: 'info'
  });
  router.push({ name: 'user', query: { redirect: route.fullPath } });
  return false;
};

const handleLoad = () => {
  isLoading.value = false;
  sendContext();
};

const handleMessage = (event) => {
  const targetOrigin = getTargetOrigin();
  if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'GOVIEW_READY') {
    isLoading.value = false;
    sendContext();
  }

  if (event.data.type === 'GOVIEW_ERROR') {
    isLoading.value = false;
  }
};

const resolveGoviewProjectId = async () => {
  const direct = route.query.goviewProjectId || route.query.goviewId;
  if (direct) {
    goviewProjectId.value = direct;
    return;
  }

  const tricysId = projectId.value;
  if (!tricysId) {
    goviewProjectId.value = null;
    return;
  }

  if (!requireAuth()) {
    goviewProjectId.value = null;
    return;
  }

  let projectName = `Tricys-${String(tricysId).slice(0, 8)}`;
  try {
    const tricysProject = await projectApi.getProject(tricysId);
    if (tricysProject && tricysProject.name) {
      projectName = tricysProject.name;
    }
    const isAdmin = currentUser.value && (currentUser.value.is_superuser === true || currentUser.value.is_superuser === 1);
    if (tricysProject) {
      if (!tricysProject.user_id) {
        previewBlocked.value = true;
      } else if (currentUser.value) {
        previewBlocked.value = tricysProject.user_id !== currentUser.value.id && !isAdmin;
      } else {
        previewBlocked.value = true;
      }
    } else {
      previewBlocked.value = false;
    }
  } catch (e) {
    // Keep fallback name
  }

  if (previewBlocked.value) {
    goviewProjectId.value = null;
    return;
  }

  const dataResp = await goviewApi.getProjectData(tricysId);
  if (dataResp && dataResp.code === 200) {
    goviewProjectId.value = tricysId;
    return;
  }

  if (dataResp && dataResp.code !== 404) {
    return;
  }

  await goviewApi.createProject({
    id: tricysId,
    projectName,
    remarks: `Tricys project: ${tricysId}`,
    indexImage: '',
    state: -1
  });

  goviewProjectId.value = tricysId;
};

const handleFork = async () => {
  const tricysId = projectId.value;
  if (!tricysId || isForking.value) return;
  isForking.value = true;
  try {
    const res = await projectApi.forkProject(tricysId);
    const pid = res?.id || res?.project_id;
    if (pid) {
      localStorage.setItem('tricys_last_pid', pid);
      previewBlocked.value = false;
      router.push({ name: 'config', query: { projectId: pid } });
    } else {
      $notify({ title: 'FORK FAILED', message: 'Project fork failed.', type: 'error' });
    }
  } catch (e) {
    $notify({ title: 'FORK FAILED', message: 'Project fork failed.', type: 'error' });
  } finally {
    isForking.value = false;
  }
};

onMounted(async () => {
  window.addEventListener('message', handleMessage);
  if (!requireAuth()) return;
  // Ensure project context is loaded for AppHeader
  if (projectId.value) {
      await loadData(projectId.value);
  }
  await resolveGoviewProjectId();
  sendContext();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
});

watch(projectId, async () => {
  await resolveGoviewProjectId();
  sendContext();
});

watch(
  () => route.query.goviewProjectId || route.query.goviewId,
  async () => {
    await resolveGoviewProjectId();
    sendContext();
  }
);
</script>

<style scoped>
.goview-embed {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #05070a;
  min-height: 0;
  flex: 1;
}

.goview-toolbar {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #1f2a36;
  background: #0b0e14;
  color: #c9d1d9;
  font-size: 12px;
}

.goview-title {
  font-weight: 700;
  letter-spacing: 0.4px;
}

.goview-meta {
  opacity: 0.8;
}

.goview-frame {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #1f2a36;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.goview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.goview-preview {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 7, 10, 0.9);
  z-index: 2;
}

.preview-card {
  max-width: 420px;
  padding: 22px;
  border: 1px solid #30363d;
  border-radius: 8px;
  background: #0b0e14;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.preview-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #ffd700;
  margin-bottom: 10px;
}

.preview-text {
  font-size: 12px;
  color: #9aa4b2;
  margin-bottom: 16px;
}

.preview-actions {
  display: flex;
  justify-content: center;
}

.preview-btn {
  padding: 10px 16px;
  border: 1px solid #00d2ff;
  background: transparent;
  color: #00d2ff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.2s;
}

.preview-btn:hover:not(:disabled) {
  background: #00d2ff;
  color: #000;
  box-shadow: 0 0 12px rgba(0, 210, 255, 0.35);
}

.preview-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.goview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa4b2;
  background: rgba(5, 7, 10, 0.8);
  z-index: 1;
  font-size: 12px;
}

.goview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  flex: 1;
  min-height: 0;
}
</style>

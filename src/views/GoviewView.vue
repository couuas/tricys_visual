<template>
  <div class="goview-embed">
    <div class="goview-toolbar">
      <div class="goview-title">GoView</div>
      <div class="goview-meta">
        <span v-if="projectId">Project: {{ projectId }}</span>
        <span v-else>Project: -</span>
      </div>
    </div>
    <div class="goview-frame">
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
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const iframeRef = ref(null);
const isLoading = ref(true);

const projectId = computed(() => route.query.projectId || localStorage.getItem('tricys_last_pid'));
const token = localStorage.getItem('tricys_auth_token');

const apiBase = computed(() => {
  const v2 = import.meta.env.VITE_API_V2_URL;
  if (v2) return v2;
  const v1 = import.meta.env.VITE_API_URL;
  if (v1) return v1.replace(/\/api\/v1\/?$/, '/api/v2');
  return 'http://localhost:8000/api/v2';
});

const goviewBase = computed(() => import.meta.env.VITE_GOVIEW_URL || 'http://localhost:5173/');

const iframeSrc = computed(() => {
  try {
    const url = new URL(goviewBase.value);
    if (projectId.value) url.searchParams.set('projectId', projectId.value);
    url.searchParams.set('apiBase', apiBase.value);
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
      projectId: projectId.value,
      token,
      apiBase: apiBase.value
    }
  };
  iframeRef.value?.contentWindow?.postMessage(payload, targetOrigin);
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

onMounted(() => {
  window.addEventListener('message', handleMessage);
  sendContext();
});

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
});

watch(projectId, () => {
  sendContext();
});
</script>

<style scoped>
.goview-embed {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #05070a;
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
  border: 1px solid #1f2a36;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
  overflow: hidden;
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
}
</style>

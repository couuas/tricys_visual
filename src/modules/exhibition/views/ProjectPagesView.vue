<template>
  <div class="pageview-host">
    <iframe
      v-if="iframeSrc"
      :key="iframeSrc"
      :src="iframeSrc"
      class="pageview-iframe"
      frameborder="0"
      allowfullscreen
      referrerpolicy="no-referrer"
      @load="handleIframeLoad"
    ></iframe>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { projectApi } from '../../../api/project';
import { $notify } from '../../../utils/notification';
import { resolveApiV2Base, resolveGoviewBase } from '../../../utils/runtimeUrls';
import { useSimulationWorkspace } from '../../simulation/composables/useSimulationWorkspace';

const route = useRoute();
const { loadData } = useSimulationWorkspace();

const isLoading = ref(false);
const iframeSrc = ref('');
const reloadSeed = ref('');

const projectId = computed(() => String(route.query.projectId || localStorage.getItem('tricys_last_pid') || ''));

const buildGoviewHomeUrl = (tokenValue, activeProjectId, seed = '') => {
  const baseUrl = resolveGoviewBase();
  const apiBase = resolveApiV2Base();
  const currentHref = typeof window !== 'undefined' ? window.location.href : 'http://localhost:8080/';
  const url = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, currentHref);
  url.searchParams.set('token', tokenValue);
  url.searchParams.set('apiBase', apiBase);
  url.searchParams.set('projectId', String(activeProjectId));
  url.searchParams.set('embedMode', 'tricys-project-home');
  if (seed) {
    url.searchParams.set('reload', seed);
  }
  return url.origin === window.location.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
};

const loadGoviewHome = async () => {
  if (!projectId.value) {
    iframeSrc.value = '';
    return;
  }

  isLoading.value = true;
  try {
    await loadData(projectId.value);
    const response = await projectApi.getGoviewSession(projectId.value);
    const token = String(response?.token || '');
    if (!token) {
      throw new Error('Project-scoped GoView token was not returned.');
    }
    iframeSrc.value = buildGoviewHomeUrl(token, projectId.value, reloadSeed.value);
  } catch (error) {
    iframeSrc.value = '';
    $notify({
      title: 'GOVIEW LOAD FAILED',
      message: error?.response?.data?.detail || error?.message || 'Could not open the project-scoped GoView homepage.',
      type: 'error'
    });
  } finally {
    isLoading.value = false;
  }
};

const handleIframeLoad = () => {
  isLoading.value = false;
};

onMounted(async () => {
  await loadGoviewHome();
});

watch(projectId, async () => {
  reloadSeed.value = '';
  await loadGoviewHome();
});
</script>

<style scoped>
.pageview-host {
  width: 100%;
  height: calc(100vh - 64px);
  min-height: calc(100vh - 64px);
  overflow: hidden;
}

.pageview-iframe {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: block;
  border: 0;
  background: #fff;
}
</style>

import { computed, ref } from 'vue';
import { configurationApi } from '../../../api/configuration';

const activeProjectId = ref(null);
const previewTimer = ref(null);

const focState = ref({
  enabled: false,
  strategy: 'table',
  componentEnabled: false,
  component: '',
  path: '',
  sourceName: 'task_input.foc',
  content: '',
  preview: null,
  warnings: [],
  error: '',
  isPreviewLoading: false,
  lastParsedAt: null
});

function createEmptyState() {
  return {
    enabled: false,
    strategy: 'table',
    componentEnabled: false,
    component: '',
    path: '',
    sourceName: 'task_input.foc',
    content: '',
    preview: null,
    warnings: [],
    error: '',
    isPreviewLoading: false,
    lastParsedAt: null
  };
}

function getStorageKey(projectId) {
  return `tricys_foc_draft_${projectId || 'default'}`;
}

function buildSerializableState() {
  return {
    enabled: Boolean(focState.value.enabled),
    strategy: focState.value.strategy || 'table',
    componentEnabled: Boolean(focState.value.componentEnabled),
    component: focState.value.component || '',
    path: focState.value.path || '',
    sourceName: focState.value.sourceName || 'task_input.foc',
    content: focState.value.content || ''
  };
}

function loadDraft(projectId) {
  const storageKey = getStorageKey(projectId);
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) {
    focState.value = createEmptyState();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    focState.value = {
      enabled: Boolean(parsed.enabled),
      strategy: parsed.strategy || 'table',
      componentEnabled: Boolean(parsed.componentEnabled),
      component: parsed.component || '',
      path: parsed.path || '',
      sourceName: parsed.sourceName || 'task_input.foc',
      content: parsed.content || '',
      preview: null,
      warnings: [],
      error: '',
      isPreviewLoading: false,
      lastParsedAt: null
    };
  } catch (_error) {
    sessionStorage.removeItem(storageKey);
    focState.value = createEmptyState();
  }
}

function persistDraft() {
  sessionStorage.setItem(getStorageKey(activeProjectId.value), JSON.stringify(buildSerializableState()));
}

export function useFocDraft() {
  const setProjectScope = (projectId) => {
    if (activeProjectId.value === projectId) {
      return;
    }
    activeProjectId.value = projectId || 'default';
    loadDraft(activeProjectId.value);
  };

  const setEnabled = (value) => {
    focState.value.enabled = Boolean(value);
    if (focState.value.enabled) {
      focState.value.componentEnabled = true;
    }
    if (!focState.value.enabled) {
      focState.value.preview = null;
      focState.value.error = '';
      focState.value.warnings = [];
    }
    persistDraft();
  };

  const setStrategy = (value) => {
    focState.value.strategy = value || 'table';
    persistDraft();
  };

  const setComponentEnabled = (value) => {
    focState.value.componentEnabled = Boolean(value);
    if (!focState.value.componentEnabled) {
      focState.value.component = '';
    }
    persistDraft();
  };

  const setComponent = (value) => {
    focState.value.component = value ?? '';
    persistDraft();
  };

  const setPath = (value) => {
    focState.value.path = value ?? '';
    persistDraft();
  };

  const setContent = (value) => {
    focState.value.content = value ?? '';
    persistDraft();
  };

  const setSourceName = (value) => {
    focState.value.sourceName = value || 'task_input.foc';
    persistDraft();
  };

  const clearDraft = () => {
    focState.value = createEmptyState();
    persistDraft();
  };

  const loadFromFile = async (file) => {
    const text = await file.text();
    focState.value.enabled = true;
    focState.value.path = '';
    focState.value.sourceName = file.name || 'uploaded.foc';
    focState.value.content = text;
    persistDraft();
  };

  const syncFromConfig = (config, { overwrite = false } = {}) => {
    const currentHasDraft = Boolean(
      String(focState.value.content || '').trim() ||
      String(focState.value.path || '').trim() ||
      String(focState.value.component || '').trim()
    );

    if (!overwrite && currentHasDraft) {
      return;
    }

    const nextConfig = config && typeof config === 'object' ? config : {};
    const nextComponent = String(nextConfig.foc_component || '').trim();
    const nextPath = String(nextConfig.foc_path || '').trim();
    const nextContent = typeof nextConfig.foc_content === 'string' ? nextConfig.foc_content : '';
    const nextSourceName = String(nextConfig.foc_name || nextPath || 'task_input.foc').trim() || 'task_input.foc';
    const hasConfiguredFoc = Boolean(nextComponent && (nextPath || String(nextContent).trim()));

    focState.value = {
      enabled: hasConfiguredFoc,
      strategy: 'table',
      componentEnabled: Boolean(nextComponent),
      component: nextComponent,
      path: nextPath,
      sourceName: nextSourceName,
      content: nextContent,
      preview: null,
      warnings: [],
      error: '',
      isPreviewLoading: false,
      lastParsedAt: null
    };

    persistDraft();
  };

  const previewNow = async (stopTime = null) => {
    if (!focState.value.enabled) {
      focState.value.preview = null;
      focState.value.error = '';
      focState.value.warnings = [];
      return null;
    }

    if (!focState.value.content.trim()) {
      focState.value.preview = null;
      focState.value.error = 'FOC content is empty.';
      focState.value.warnings = [];
      return null;
    }

    if (!String(focState.value.content || '').trim()) {
      focState.value.preview = null;
      focState.value.error = '';
      focState.value.warnings = [];
      return null;
    }

    focState.value.isPreviewLoading = true;
    try {
      const response = await configurationApi.previewFoc({
        content: focState.value.content,
        strategy: focState.value.strategy,
        stop_time: stopTime ?? undefined
      });
      focState.value.preview = response.valid ? response : null;
      focState.value.error = response.valid ? '' : (response.error || 'FOC preview failed.');
      focState.value.warnings = response.warnings || [];
      focState.value.lastParsedAt = Date.now();
      return response;
    } catch (error) {
      focState.value.preview = null;
      focState.value.error = error?.response?.data?.detail || error?.message || 'FOC preview failed.';
      focState.value.warnings = [];
      return null;
    } finally {
      focState.value.isPreviewLoading = false;
    }
  };

  const schedulePreview = (stopTime = null, delay = 500) => {
    if (previewTimer.value) {
      clearTimeout(previewTimer.value);
    }
    previewTimer.value = setTimeout(() => {
      previewNow(stopTime);
    }, delay);
  };

  const taskPayload = computed(() => {
    if (!focState.value.enabled) {
      return null;
    }

    const component = String(focState.value.component || '').trim();
    const content = String(focState.value.content || '');
    const path = String(focState.value.path || '').trim();
    if (!component) {
      return null;
    }

    if (content.trim()) {
      return {
        foc_component: component,
        foc_name: focState.value.sourceName || 'task_input.foc',
        foc_content: content
      };
    }

    if (!path) {
      return null;
    }

    return {
      foc_component: component,
      foc_path: path
    };
  });

  return {
    focState,
    taskPayload,
    setProjectScope,
    setEnabled,
    setStrategy,
    setComponentEnabled,
    setPath,
    setComponent,
    setContent,
    setSourceName,
    clearDraft,
    loadFromFile,
    syncFromConfig,
    previewNow,
    schedulePreview
  };
}
import { computed, ref } from 'vue';
import { configurationApi } from '../api/configuration';

const activeProjectId = ref(null);
const previewTimer = ref(null);

const focState = ref({
  enabled: false,
  strategy: 'table',
  sourceName: 'task_input.foc',
  content: '',
  preview: null,
  warnings: [],
  error: '',
  isPreviewLoading: false,
  lastParsedAt: null
});

function getStorageKey(projectId) {
  return `tricys_foc_draft_${projectId || 'default'}`;
}

function buildSerializableState() {
  return {
    enabled: Boolean(focState.value.enabled),
    strategy: focState.value.strategy || 'table',
    sourceName: focState.value.sourceName || 'task_input.foc',
    content: focState.value.content || ''
  };
}

function loadDraft(projectId) {
  const storageKey = getStorageKey(projectId);
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) {
    focState.value = {
      enabled: false,
      strategy: 'table',
      sourceName: 'task_input.foc',
      content: '',
      preview: null,
      warnings: [],
      error: '',
      isPreviewLoading: false,
      lastParsedAt: null
    };
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    focState.value = {
      enabled: Boolean(parsed.enabled),
      strategy: parsed.strategy || 'table',
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
    focState.value = {
      enabled: false,
      strategy: 'table',
      sourceName: 'task_input.foc',
      content: '',
      preview: null,
      warnings: [],
      error: '',
      isPreviewLoading: false,
      lastParsedAt: null
    };
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

  const setContent = (value) => {
    focState.value.content = value ?? '';
    persistDraft();
  };

  const setSourceName = (value) => {
    focState.value.sourceName = value || 'task_input.foc';
    persistDraft();
  };

  const clearDraft = () => {
    focState.value = {
      enabled: false,
      strategy: 'table',
      sourceName: 'task_input.foc',
      content: '',
      preview: null,
      warnings: [],
      error: '',
      isPreviewLoading: false,
      lastParsedAt: null
    };
    persistDraft();
  };

  const loadFromFile = async (file) => {
    const text = await file.text();
    focState.value.enabled = true;
    focState.value.sourceName = file.name || 'uploaded.foc';
    focState.value.content = text;
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
    if (!focState.value.enabled || !focState.value.content.trim()) {
      return null;
    }
    return {
      foc_strategy: focState.value.strategy,
      foc_name: focState.value.sourceName || 'task_input.foc',
      foc_content: focState.value.content
    };
  });

  return {
    focState,
    taskPayload,
    setProjectScope,
    setEnabled,
    setStrategy,
    setContent,
    setSourceName,
    clearDraft,
    loadFromFile,
    previewNow,
    schedulePreview
  };
}

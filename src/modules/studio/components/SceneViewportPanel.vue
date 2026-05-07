<template>
  <div class="scene-viewport" ref="viewportRef">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-text">LOADING SCENE</div>
      <div class="loading-sub">Building Digital Twin...</div>
    </div>

    <div v-if="isBoxSelecting" class="select-rect" :style="{ left: selectionRect.x + 'px', top: selectionRect.y + 'px', width: selectionRect.w + 'px', height: selectionRect.h + 'px' }"></div>

    <div v-if="Object.keys(progressMap).length > 0" class="load-progress">
      <div class="load-progress-title">MODEL LOADING</div>
      <div class="load-progress-list">
        <div v-for="(item, id) in progressMap" :key="id" class="load-progress-item">
          <div class="load-progress-label">{{ id.toUpperCase() }}</div>
          <div class="load-progress-bar">
            <div class="load-progress-fill" :style="{ width: item.percent + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { TopologySceneEngine } from '../../../platform/scene/TopologySceneEngine';
import { createSceneDocument } from '../../../platform/protocols/sceneDocument';
import { resolveBackendBase } from '../../../utils/runtimeUrls';

const props = defineProps({
  structureData: { type: Object, default: () => null },
  modelConfig: { type: Object, default: () => ({}) },
  annotations: { type: Object, default: () => ({}) },
  componentGroups: { type: Object, default: () => ({}) },
  expandedGroupId: { type: String, default: null },
  getConnectionStyle: { type: Function, default: () => ({ width: 4.0, type: 'flow', color: 0x00d2ff, speed: 0.1, opacity: 0.8 }) },
  multiSelectedIds: { type: Set, default: () => new Set() },
  isReadOnly: { type: Boolean, default: false },
  projectId: { type: String, required: true }
});

const emit = defineEmits(['selectComponent', 'selectConnection', 'dragEnded', 'historyStateChange', 'toggleMultiSelect', 'boxSelectionApplied', 'historyRestore', 'hoverShow', 'hoverHide', 'doubleClickComponent', 'doubleClickEmpty']);

const viewportRef = ref(null);
const isLoading = ref(true);
const progressMap = ref({});
const isBoxSelecting = ref(false);
const selectionRect = ref({ x: 0, y: 0, w: 0, h: 0 });

const buildSceneDocument = () => createSceneDocument({
  projectId: props.projectId,
  structureData: props.structureData || { components: [], connections: [] },
  modelConfig: props.modelConfig || {},
  annotations: props.annotations || {},
  componentGroups: props.componentGroups || {},
  expandedGroupId: props.expandedGroupId,
  viewMode: '3d'
});

const engine = shallowRef(null);

onMounted(async () => {
  if (!viewportRef.value) return;

  const instance = new TopologySceneEngine({
    isReadOnly: props.isReadOnly,
    multiSelectedIds: props.multiSelectedIds,
    BACKEND_URL: resolveBackendBase(),
    getConnectionStyle: props.getConnectionStyle
  });

  const historyCallbacks = {
    getProjectId: () => props.projectId,
    getState: () => ({
      ts: Date.now(),
      components: props.structureData?.components?.map(c => ({
        id: c.id, x: c.position.x, y: c.position.y
      })) || []
    }),
    applyState: async (state, persist) => {
      if (!state || !state.components || !props.structureData?.components) return;
      state.components.forEach(c => {
        const target = props.structureData.components.find(x => x.id.toLowerCase() === String(c.id).toLowerCase());
        if (target && target.position) {
          target.position.x = c.x;
          target.position.y = c.y;
        }
      });
      await engine.value.loadDocument(buildSceneDocument());
      if (persist) {
        emit('historyRestore', state.components);
      }
    }
  };

  await instance.mount(viewportRef.value, historyCallbacks);

  instance.on('loadProgress', (map) => {
    progressMap.value = { ...map };
  });
  instance.on('historyStateChange', (state) => {
    emit('historyStateChange', state);
  });
  instance.on('selectComponent', (id) => {
    emit('selectComponent', id);
  });
  instance.on('doubleClickComponent', (id) => {
    emit('doubleClickComponent', id);
  });
  instance.on('doubleClickEmpty', () => {
    emit('doubleClickEmpty');
  });
  instance.on('selectConnection', (id) => {
    emit('selectConnection', id);
  });
  instance.on('dragEnded', (payload) => {
    emit('dragEnded', payload);
    if (props.structureData && props.structureData.components) {
      const comp = props.structureData.components.find(c => c.id === payload.id);
      if (comp && comp.position) {
        comp.position.x = payload.finalX;
        comp.position.y = payload.finalY;
      }
    }
  });

  instance.on('boxSelectionStarted', () => { isBoxSelecting.value = true; });
  instance.on('boxSelectionUpdated', (rect) => { selectionRect.value = { ...rect }; });
  instance.on('boxSelectionApplied', (set) => {
    isBoxSelecting.value = false;
    emit('boxSelectionApplied', set);
  });
  instance.on('toggleMultiSelect', (id) => emit('toggleMultiSelect', id));
  instance.on('hoverShow', (payload) => emit('hoverShow', payload));
  instance.on('hoverHide', () => emit('hoverHide'));

  engine.value = instance;

  if (props.structureData) {
    await engine.value.loadDocument(buildSceneDocument());
    isLoading.value = false;
  }
});

watch(() => props.structureData, (newVal) => {
  if (engine.value && newVal && !isBoxSelecting.value) {
    isLoading.value = true;
    engine.value.loadDocument(buildSceneDocument()).finally(() => {
      isLoading.value = false;
    });
  }
}, { deep: true });

watch(() => props.modelConfig, (newVal) => {
  if (engine.value && newVal && props.structureData) {
    engine.value.loadDocument(buildSceneDocument());
  }
}, { deep: true });

watch(() => [props.componentGroups, props.expandedGroupId], () => {
  if (engine.value && props.structureData && !isBoxSelecting.value) {
    isLoading.value = true;
    engine.value.loadDocument(buildSceneDocument()).finally(() => {
      isLoading.value = false;
    });
  }
}, { deep: true });

watch(() => props.multiSelectedIds, (newVal) => {
  if (engine.value) {
    engine.value.updateConfig({ multiSelectedIds: newVal });
    engine.value.updateSelectionVisuals();
  }
}, { deep: true });

onUnmounted(() => {
  if (engine.value) {
    engine.value.unmount();
    engine.value = null;
  }
});

const applyComponentMoves = (moves) => {
  if (engine.value) {
    engine.value.applyComponentMoves(moves);
  }
};

const focusCameraOn = (id) => {
  if (engine.value && engine.value.focusOnComponent) {
    engine.value.focusOnComponent(id);
  }
};

const serializeSceneDocument = (viewMode = '3d') => {
  if (engine.value?.setView) {
    engine.value.setView(viewMode);
  }

  const serialized = engine.value?.serialize?.();
  return serialized?.topology?.components?.length ? serialized : buildSceneDocument();
};

const loadSceneDocument = async (document) => {
  if (engine.value?.loadDocument) {
    await engine.value.loadDocument(document);
  }
};

defineExpose({
  focusCameraOn,
  applyComponentMoves,
  loadSceneDocument,
  serializeSceneDocument
});
</script>

<style scoped>
.scene-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #0b1016;
  overflow: hidden;
}
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(11, 16, 22, 0.85);
  z-index: 100;
  color: #4a90e2;
}
.loading-text { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
.loading-sub { font-size: 13px; color: #888; margin-top: 10px; }
.load-progress {
  position: absolute; bottom: 20px; left: 20px; width: 300px;
  background: rgba(15, 22, 30, 0.9); border: 1px solid #1a2a3a;
  padding: 15px; border-radius: 4px; pointer-events: none; z-index: 50;
}
.load-progress-title { font-size: 11px; color: #00d2ff; letter-spacing: 1px; margin-bottom: 10px; }
.load-progress-item { margin-bottom: 8px; }
.load-progress-label { font-size: 10px; color: #8a9bb0; margin-bottom: 4px; }
.load-progress-bar { height: 3px; background: #1f2b3a; border-radius: 2px; overflow: hidden; }
.load-progress-fill { height: 100%; background: #00d2ff; transition: width 0.3s; }
.select-rect {
  position: absolute;
  border: 1px dashed #00d2ff;
  background: rgba(0, 210, 255, 0.15);
  pointer-events: none;
  z-index: 100;
}

:deep(.label-card) {
  text-align: center;
  text-shadow: none;
  transform: translateY(-100%);
  pointer-events: none;
  transition: opacity 0.3s;
  background: rgba(10, 15, 20, 0.9);
  border: 1px solid rgba(120, 170, 210, 0.35);
  border-radius: 6px;
  padding: 6px 8px;
  min-width: 90px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
:deep(.label-title) {
  font-size: 11px;
  color: #cfe6f7;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
  text-align: center;
}
:deep(.label-title.group) {
  background: rgba(35, 55, 75, 0.8);
  color: #cfe6f7;
  border: 1px solid rgba(120, 170, 210, 0.4);
  border-radius: 4px;
  padding: 2px 6px;
  display: inline-block;
}
</style>
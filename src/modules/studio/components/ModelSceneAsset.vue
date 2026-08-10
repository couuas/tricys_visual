<template>
  <div class="model-scene-asset">
    <div v-if="showLoadingState" class="asset-overlay">
      <div class="asset-overlay-title">LOADING 3D SCENE</div>
      <div class="asset-overlay-subtitle">Hydrating scene asset...</div>
    </div>

    <SceneViewportPanel
      v-else
      ref="viewportPanel"
      :project-id="resolvedProjectId"
      :structure-data="resolvedStructureData"
      :model-config="resolvedModelConfig"
      :annotations="resolvedAnnotations"
      :get-connection-style="resolvedGetConnectionStyle"
      :component-groups="resolvedComponentGroups"
      :expanded-group-id="resolvedExpandedGroupId"
      :multi-selected-ids="resolvedMultiSelectedIds"
      :is-read-only="resolvedIsReadOnly"
      @selectComponent="emit('selectComponent', $event)"
      @selectConnection="emit('selectConnection', $event)"
      @doubleClickComponent="emit('doubleClickComponent', $event)"
      @doubleClickEmpty="emit('doubleClickEmpty')"
      @dragEnded="emit('dragEnded', $event)"
      @historyStateChange="emit('historyStateChange', $event)"
      @historyRestore="emit('historyRestore', $event)"
      @boxSelectionApplied="emit('boxSelectionApplied', $event)"
      @toggleMultiSelect="emit('toggleMultiSelect', $event)"
      @hoverShow="emit('hoverShow', $event)"
      @hoverHide="emit('hoverHide')"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import SceneViewportPanel from './SceneViewportPanel.vue';
import { useModelEditorState } from '../composables/useModelEditorState';

const props = defineProps({
  projectId: { type: String, default: '' },
  mode: { type: String, default: 'view' },
  structureData: { type: Object, default: undefined },
  modelConfig: { type: Object, default: undefined },
  annotations: { type: Object, default: undefined },
  componentGroups: { type: Object, default: undefined },
  expandedGroupId: { type: String, default: undefined },
  getConnectionStyle: { type: Function, default: undefined },
  multiSelectedIds: { type: Object, default: undefined },
  isReadOnly: { type: Boolean, default: undefined }
});

const emit = defineEmits([
  'selectComponent',
  'selectConnection',
  'dragEnded',
  'historyStateChange',
  'historyRestore',
  'toggleMultiSelect',
  'boxSelectionApplied',
  'hoverShow',
  'hoverHide',
  'doubleClickComponent',
  'doubleClickEmpty'
]);

const viewportPanel = ref(null);
const resolvedProjectId = computed(() => props.projectId || '');
const resolvedIsReadOnly = computed(() => props.isReadOnly ?? props.mode === 'view');
const shouldHydrateInternalState = computed(() => props.structureData === undefined);

const internalState = useModelEditorState({
  projectId: resolvedProjectId,
  isReadOnly: resolvedIsReadOnly
});

const resolvedStructureData = computed(() => (
  shouldHydrateInternalState.value ? internalState.structureData.value : props.structureData
));
const resolvedModelConfig = computed(() => (
  shouldHydrateInternalState.value ? internalState.modelConfig.value : (props.modelConfig || {})
));
const resolvedAnnotations = computed(() => (
  shouldHydrateInternalState.value ? internalState.annotations.value : (props.annotations || {})
));
const resolvedComponentGroups = computed(() => (
  shouldHydrateInternalState.value ? internalState.componentGroups.value : (props.componentGroups || {})
));
const resolvedExpandedGroupId = computed(() => (
  props.expandedGroupId !== undefined
    ? props.expandedGroupId
    : internalState.expandedGroupId.value
));
const resolvedGetConnectionStyle = computed(() => (
  props.getConnectionStyle || internalState.getConnectionStyle
));
const resolvedMultiSelectedIds = computed(() => (
  props.multiSelectedIds || internalState.multiSelectedIds.value
));
const showLoadingState = computed(() => !resolvedStructureData.value?.components);

const focusCameraOn = (id) => {
  if (viewportPanel.value?.focusCameraOn) {
    viewportPanel.value.focusCameraOn(id);
  }
};

const applyComponentMoves = (moves) => {
  if (viewportPanel.value?.applyComponentMoves) {
    viewportPanel.value.applyComponentMoves(moves);
  }
};

const serializeSceneDocument = (viewMode) => {
  if (viewportPanel.value?.serializeSceneDocument) {
    return viewportPanel.value.serializeSceneDocument(viewMode);
  }

  return null;
};

const loadSceneDocument = async (document) => {
  if (viewportPanel.value?.loadSceneDocument) {
    await viewportPanel.value.loadSceneDocument(document);
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
.model-scene-asset {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #0b1016;
}

.asset-overlay {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  background: rgba(11, 16, 22, 0.95);
  color: #8fb7dc;
  z-index: 50;
  padding: 16px 24px;
  border-radius: 8px;
  border: 1px solid rgba(143, 183, 220, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

.asset-overlay-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.asset-overlay-subtitle {
  margin-top: 6px;
  font-size: 11px;
  color: #6f8498;
}
</style>
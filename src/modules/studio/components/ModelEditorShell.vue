<template>
  <WorkbenchShell
    title="Model Editor"
    subtitle="Experimental Kernel"
    :left-width="360"
    :right-width="400"
    :bottom-height="172"
    :min-bottom-height="118"
    :max-bottom-height="360"
    :embedded="embedded"
    :show-header="false"
  >
    <template #actions>
      <div class="actions">
        <button class="action-btn" @click="closeEditor">Exit Editor</button>
      </div>
    </template>

    <template #left>
      <SceneTreePanel
        :components="structureData.components || []"
        :component-groups="componentGroups"
        :selected-id="selectedId"
        :selected-connection-id="selectedConnectionId"
        :expanded-group-id="expandedGroupId"
        :multi-selected-ids="multiSelectedIds"
        :is-selected-group="isSelectedGroup"
        :selected-group-id="selectedGroupId"
        :is-read-only="isReadOnly"
        :note="localNote"
        :config="localConfig"
        :binding-state="bindingPanelState"
        :connection-style="localConnectionStyle"
        @select-item="handleTreeSelect"
        @focus-item="handleTreeFocus"
        @toggle-group="handleTreeToggleGroup"
        @close-selection="clearComponentSelection"
        @toggle-group-view="toggleGroupView"
        @dissolve-group="handleDissolveGroup"
        @update:note="localNote = $event"
        @update:config="localConfig = $event"
        @save-selection="saveComponentChanges"
        @reset-selection="resetComponentChanges"
        @request-upload="triggerFileUpload"
        @close-connection="clearConnectionSelection"
        @update:connection-style="localConnectionStyle = $event"
        @save-connection="saveConnectionVisuals"
        @sync-all-connections="syncAllConnectionVisuals"
      />
    </template>

    <template #main>
      <div class="editor-main">
        <div class="stage-toolbar">
          <div class="stage-toolbar-group">
            <button class="stage-btn" :class="{ active: stageViewMode === '3d' }" @click="stageViewMode = '3d'">3D</button>
            <button class="stage-btn" :class="{ active: stageViewMode === '2d' }" @click="stageViewMode = '2d'">2D</button>
          </div>
          <div v-if="show2DTwin" class="stage-toolbar-group">
            <button class="stage-btn" :class="{ active: connectionRouteMode === 'orthogonal' }" @click="connectionRouteMode = 'orthogonal'">Auto Route</button>
            <button class="stage-btn" :class="{ active: connectionRouteMode === 'bezier' }" @click="connectionRouteMode = 'bezier'">Bezier</button>
          </div>
        </div>

        <div class="editor-stage-grid" :class="`mode-${stageViewMode}`">
          <div v-if="show3DViewport" class="stage-surface stage-surface-3d">
            <div class="stage-surface-title">3D Scene</div>
            <ModelSceneAsset
              v-if="structureData && structureData.components"
              ref="viewportPanel"
              :projectId="projectId"
              :structureData="structureData"
              :modelConfig="editorModelConfig"
              :annotations="annotations"
              :getConnectionStyle="getEditorConnectionStyle"
              :componentGroups="componentGroups"
              :expandedGroupId="expandedGroupId"
              :multiSelectedIds="multiSelectedIds"
              :isReadOnly="isReadOnly"
              @selectComponent="handleSelectComponent"
              @selectConnection="handleSelectConnection"
              @doubleClickComponent="handleDoubleClick"
              @doubleClickEmpty="handleDoubleClickEmpty"
              @dragEnded="handleDrag"
              @historyStateChange="handleHistoryChange"
              @historyRestore="handleHistoryChange"
              @boxSelectionApplied="handleBoxSelectionApplied"
              @toggleMultiSelect="handleToggleMultiSelect"
              @hoverShow="handleHoverShow"
              @hoverHide="handleHoverHide"
            />
          </div>

          <div v-if="show2DTwin" class="stage-surface stage-surface-2d">
            <div class="stage-surface-title">2D Topology</div>
            <TopologyTwinPanel
              :structureData="structureData"
              :selected-component-id="selectedId"
              :selected-connection-id="selectedConnectionId"
              :component-groups="componentGroups"
              :multi-selected-ids="multiSelectedIds"
              :expanded-group-id="expandedGroupId"
              :annotations="annotations"
              :get-connection-style="getEditorConnectionStyle"
              :route-mode="connectionRouteMode"
              :snap-to-grid="snapToGridEnabled"
              :show-controls="false"
              :is-read-only="isReadOnly"
              @select-component="handleSelectComponent"
              @select-connection="handleSelectConnection"
              @move-component="handleTwinMove"
              @move-components="handleTwinBatchMove"
              @toggle-multi-select="handleToggleMultiSelect"
              @toggle-group="handleTreeToggleGroup"
              @update:route-mode="connectionRouteMode = $event"
              @update:snap-to-grid="snapToGridEnabled = $event"
            />
          </div>
        </div>

        <div v-if="hoverInfo.visible" class="hover-tooltip" :style="{ top: hoverInfo.y + 'px', left: hoverInfo.x + 'px' }">
          <div class="tooltip-header">
            <span class="tooltip-title">{{ hoverInfo.id.toUpperCase() }}</span>
          </div>
          <div v-if="hoverInfo.note" class="tooltip-note">
            <div class="note-label">Annotation:</div>
            <div class="note-content">{{ hoverInfo.note }}</div>
          </div>
          <div v-else class="tooltip-note">
            <div class="note-content" style="color: #666; font-style: italic;">No annotations</div>
          </div>
        </div>
      </div>
    </template>

    <template #right>
      <div class="right-sidebar-stack right-sidebar-stack-library">
        <AssetLibraryPanel
          :models="assetCatalog"
          :recommended-models="recommendedAssetCatalog"
          :selected-asset-url="currentAssetUrl"
          :selected-component-label="selectedComponentLabel"
          :selected-component-category="selectedComponentCategory"
          :selected-connection-id="selectedConnectionId"
          :can-apply-asset="canApplyLibraryAsset"
          :is-read-only="isReadOnly"
          :is-selected-group="isSelectedGroup"
          :selected-group-id="selectedGroupId"
          :expanded-group-id="expandedGroupId"
          :config="localConfig"
          :binding-state="bindingPanelState"
          :connection-style="localConnectionStyle"
          @select-asset="handleLibraryAssetSelect"
          @request-upload="triggerFileUpload"
          @close-selection="clearComponentSelection"
          @toggle-group-view="toggleGroupView"
          @dissolve-group="handleDissolveGroup"
          @update:config="localConfig = $event"
          @save-selection="saveComponentChanges"
          @reset-selection="resetComponentChanges"
          @close-connection="clearConnectionSelection"
          @update:connection-style="localConnectionStyle = $event"
          @save-connection="saveConnectionVisuals"
          @sync-all-connections="syncAllConnectionVisuals"
        />
        <input type="file" ref="fileInputRef" accept=".glb,.gltf" class="hidden-file-input" @change="onFileSelected" />
      </div>
    </template>

    <template #bottom>
      <div class="layout-bottom-panel">
        <section class="layout-toolbox" aria-label="Layout operations">
          <div class="layout-toolbox-header">
            <div>
              <div class="layout-toolbox-title">Layout Operations</div>
              <div class="layout-toolbox-subtitle">{{ layoutPlaneHint }}</div>
            </div>
            <div class="layout-mode-chip">{{ isLayoutPersisting ? 'SAVING' : stageViewMode.toUpperCase() }}</div>
          </div>

          <template v-if="multiSelectedIds.size > 1">
            <div class="layout-tool-grid">
              <div class="layout-tool-section wide">
                <div class="layout-section-label">Align on layout plane</div>
                <div class="layout-axis-grid">
                  <div class="layout-axis-group">
                    <span class="axis-label">X axis</span>
                    <div class="layout-tool-row">
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedMinX">Min X</button>
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedCenterX">Center X</button>
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedMaxX">Max X</button>
                    </div>
                  </div>
                  <div class="layout-axis-group">
                    <span class="axis-label">Y axis</span>
                    <div class="layout-tool-row">
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedMinY">Min Y</button>
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedCenterY">Center Y</button>
                      <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="alignSelectedMaxY">Max Y</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="layout-tool-section">
                <div class="layout-section-label">Spacing and grid</div>
                <div class="layout-tool-row compact">
                  <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="distributeSelectedX">Distribute X</button>
                  <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="distributeSelectedY">Distribute Y</button>
                  <button class="layout-tool-btn" :disabled="isLayoutPersisting || isReadOnly" @click.stop="snapSelectedToGrid">Snap Grid</button>
                </div>
              </div>

              <div class="layout-tool-section group-section">
                <div class="layout-section-label">Group management</div>
                <div class="layout-tool-row compact">
                  <button class="layout-tool-btn action-primary" :disabled="isLayoutPersisting || isReadOnly" @click.stop="handleMergeGroup">Merge Group</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="isSingleGroupSelected">
            <div class="layout-tool-section single-group-tools">
              <div>
                <div class="layout-section-label">Group management</div>
                <div class="layout-selection-status">{{ layoutSelectionStatus }}</div>
              </div>
              <button class="layout-tool-btn action-danger" :disabled="isLayoutPersisting || isReadOnly" @click.stop="handleDissolveGroup">Dissolve Group</button>
            </div>
          </template>

          <div v-else class="layout-selection-empty">
            <span>No layout selection</span>
            <span class="layout-selection-muted">{{ layoutSelectionStatus }}</span>
          </div>
        </section>

        <SnapshotPanel
          v-model="selectedSnapshotId"
          class="layout-snapshot-panel"
          :history-stack-length="historyStack.length"
          :history-cursor="historyCursor"
          :is-read-only="isReadOnly"
          :is-busy="isLayoutPersisting"
          :snapshots="layoutSnapshots"
          @undo="undoLayout"
          @redo="redoLayout"
          @save="saveLayoutSnapshot"
          @restore="restoreLayoutSnapshot"
          @delete="deleteLayoutSnapshot"
        />
      </div>
    </template>
  </WorkbenchShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { projectApi } from '../../../api/project';
import AssetLibraryPanel from './AssetLibraryPanel.vue';
import SceneTreePanel from './SceneTreePanel.vue';
import SnapshotPanel from './SnapshotPanel.vue';
import TopologyTwinPanel from './TopologyTwinPanel.vue';
import WorkbenchShell from './WorkbenchShell.vue';
import ModelSceneAsset from './ModelSceneAsset.vue';
import { useModelEditorState } from '../composables/useModelEditorState';
import { normalizeSelectionId, resolveGroupKey } from '../../../utils/groupIds';
import { validateUploadFile } from '../../../platform/media/validators/modelAssetValidator';
import { $notify } from '../../../utils/notification';

const props = defineProps({
  projectId: { type: String, default: '' },
  mode: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
  returnRouteName: { type: String, default: 'config' },
  returnQuery: { type: Object, default: () => ({}) }
});

const router = useRouter();
const route = useRoute();

const projectId = computed(() => props.projectId || route.query.projectId || 'model-editor-demo');
const isReadOnly = computed(() => (props.mode || route.query.mode) === 'view');

const viewportPanel = ref(null);
const fileInputRef = ref(null);
const stageViewMode = ref('3d');
const connectionRouteMode = ref('orthogonal');
const snapToGridEnabled = ref(true);
const isLayoutPersisting = ref(false);

const {
  CONNECTION_STYLES_KEY,
  MAX_SNAPSHOTS,
  applySceneDocumentSnapshot,
  annotations,
  assetCatalog,
  bindingPanelState,
  canApplyLibraryAsset,
  componentGroups,
  createSceneDocumentSnapshot,
  createSnapshotPayload,
  currentAssetUrl,
  expandedGroupId,
  getConnectionStyle,
  getSafeId,
  historyCursor,
  historyStack,
  hoverInfo,
  isSelectedGroup,
  layoutSnapshots,
  libraryModels,
  loadSelectedEditorData,
  localConfig,
  localConnectionStyle,
  localNote,
  modelConfig,
  multiSelectedIds,
  originalConfig,
  originalNote,
  persistLayoutSnapshots,
  pushHistoryState,
  recommendedAssetCatalog,
  setHistoryViewMode,
  selectedComponentLabel,
  selectedComponentCategory,
  selectedConnectionId,
  selectedGroupId,
  selectedId,
  selectedSnapshotId,
  structureData
} = useModelEditorState({ projectId, isReadOnly });

const show3DViewport = computed(() => stageViewMode.value === '3d');
const show2DTwin = computed(() => stageViewMode.value === '2d');
const isSingleGroupSelected = computed(() => {
  if (!multiSelectedIds.value || multiSelectedIds.value.size !== 1) return false;
  return Array.from(multiSelectedIds.value)[0].toUpperCase().startsWith('GROUP_');
});

const getConnectionStyleKeys = (connection, fallbackId = '') => {
  const keys = new Set();
  const addKey = (value) => {
    const key = String(value || '').trim();
    if (!key) return;
    keys.add(key);
    keys.add(key.toLowerCase());
  };

  addKey(fallbackId);
  addKey(connection?.id);
  const from = connection?.from || connection?.source || connection?.start;
  const to = connection?.to || connection?.target || connection?.end;
  if (from && to) {
    addKey(`${String(from).toLowerCase()}_${String(to).toLowerCase()}`);
  }

  return Array.from(keys);
};

const findConnectionByStyleId = (id) => {
  const targetId = String(id || '').trim().toLowerCase();
  if (!targetId) return null;
  return (structureData.value.connections || []).find((connection) => (
    getConnectionStyleKeys(connection).some((key) => key.toLowerCase() === targetId)
  )) || null;
};

const getEditorConnectionStyle = (id) => {
  const selectedKeys = getConnectionStyleKeys(findConnectionByStyleId(selectedConnectionId.value), selectedConnectionId.value);
  const targetKeys = getConnectionStyleKeys(findConnectionByStyleId(id), id);
  const isEditingSelectedConnection = selectedKeys.some((key) => targetKeys.includes(key));
  if (isEditingSelectedConnection && localConnectionStyle.value && Object.keys(localConnectionStyle.value).length) {
    return { ...getConnectionStyle(id), ...localConnectionStyle.value };
  }
  return getConnectionStyle(id);
};

const editorModelConfig = computed(() => {
  if (!selectedConnectionId.value || !localConnectionStyle.value || !Object.keys(localConnectionStyle.value).length) {
    return modelConfig.value;
  }

  const previewConfig = { ...modelConfig.value };
  previewConfig[CONNECTION_STYLES_KEY] = { ...(previewConfig[CONNECTION_STYLES_KEY] || {}) };
  getConnectionStyleKeys(findConnectionByStyleId(selectedConnectionId.value), selectedConnectionId.value).forEach((key) => {
    previewConfig[CONNECTION_STYLES_KEY][key] = {
      ...getConnectionStyle(key),
      ...localConnectionStyle.value
    };
  });
  return previewConfig;
});
const layoutPlaneHint = computed(() => (
  stageViewMode.value === '3d'
    ? '3D layout edits use X/Y. Z height is locked by the scene.'
    : '2D topology layout edits use the same X/Y positions.'
));
const layoutSelectionStatus = computed(() => {
  const selectionCount = multiSelectedIds.value?.size || 0;
  if (selectionCount > 1) return `${selectionCount} selected`;
  if (isSingleGroupSelected.value) return '1 group selected';
  if (selectionCount === 1) return '1 component selected';
  return 'Awaiting multi-selection or group';
});

const closeEditor = () => {
  const query = Object.keys(props.returnQuery || {}).length
    ? { ...props.returnQuery }
    : (projectId.value ? { projectId: projectId.value } : {});

  router.push({ name: props.returnRouteName || 'config', query });
};

const resolveSelectedGroupKey = (rawId) => resolveGroupKey(rawId, componentGroups.value);
const normalizeWorkbenchSelectionId = (rawId) => normalizeSelectionId(rawId, componentGroups.value);

const mutateLocalPositionAndSave = async (id, x, y) => {
  const comp = structureData.value.components.find(c => c.id === id);
  if (comp) {
    comp.position.x = x;
    comp.position.y = y;
    try {
      await projectApi.savePosition(projectId.value, { id, x, y });
    } catch (e) { console.error('Position save failed', e); }
  }
};

const clearComponentSelection = () => {
  selectedId.value = null;
  hoverInfo.value.visible = false;
};

const clearConnectionSelection = () => {
  selectedConnectionId.value = null;
  hoverInfo.value.visible = false;
};

const handleLibraryAssetSelect = (url) => {
  if (isReadOnly.value || !canApplyLibraryAsset.value) return;
  localConfig.value = {
    ...localConfig.value,
    url
  };
};

const handleSelectComponent = (id) => {
  const normalizedId = normalizeWorkbenchSelectionId(id);
  selectedId.value = normalizedId;
  selectedConnectionId.value = null;
  hoverInfo.value.visible = false;
  if (normalizedId) {
    multiSelectedIds.value = new Set([normalizedId]);
  } else {
    multiSelectedIds.value = new Set();
  }
};

const handleSelectConnection = (id) => {
  selectedConnectionId.value = id;
  selectedId.value = null;
  multiSelectedIds.value = new Set();
  hoverInfo.value.visible = false;
  if (id) {
    localConnectionStyle.value = { ...getConnectionStyle(id) };
    if (localConnectionStyle.value.width === undefined) localConnectionStyle.value.width = 4.0;
  }
};

const handleTwinMove = async (payload) => {
  if (!payload?.id || isReadOnly.value) return;
  await mutateLocalPositionAndSave(payload.id, payload.x, payload.y);
  structureData.value.components = [...(structureData.value.components || [])];
  pushHistoryState(structureData.value.components);
};

const handleTwinBatchMove = async (moves) => {
  if (!Array.isArray(moves) || !moves.length || isReadOnly.value) return;
  await Promise.all(moves.map((move) => mutateLocalPositionAndSave(move.id, move.x, move.y)));
  structureData.value.components = [...(structureData.value.components || [])];
  pushHistoryState(structureData.value.components);
};

const handleTreeSelect = (id) => {
  if (!id) return;
  handleSelectComponent(id);
};

const handleTreeFocus = (id) => {
  if (!id || !viewportPanel.value?.focusCameraOn) return;
  viewportPanel.value.focusCameraOn(id);
};

const handleTreeToggleGroup = (id) => {
  if (!id) return;
  const resolvedGroupKey = resolveSelectedGroupKey(id) || getSafeId(id);
  handleSelectComponent(resolvedGroupKey);
  expandedGroupId.value = expandedGroupId.value === resolvedGroupKey ? null : resolvedGroupKey;
};

const triggerFileUpload = () => {
  if (fileInputRef.value) fileInputRef.value.click();
};

const onFileSelected = async (event) => {
  const file = event.target.files[0];
  if (!file || isReadOnly.value || !selectedId.value) return;

  const validation = validateUploadFile(file);
  if (!validation.isValid) {
    $notify({ title: 'INVALID ASSET', message: validation.errors[0], type: 'error' });
    event.target.value = '';
    return;
  }

  if (validation.warnings.length) {
    $notify({ title: 'ASSET CHECK', message: validation.warnings[0], type: 'warning' });
  }

  try {
    const safeId = selectedId.value.toLowerCase();
    const res = await projectApi.uploadComponentModel(projectId.value, safeId, file);
    if (res && res.url) {
      localConfig.value.url = res.url;
      localConfig.value.type = 'custom';
      await saveComponentChanges();
      $notify({ title: 'ASSET UPLOADED', message: `${file.name} is ready for binding.`, type: 'success' });
    }
  } catch (e) { console.error('Upload failed', e); }
  event.target.value = '';
};

const saveComponentChanges = async () => {
  if (!selectedId.value || isReadOnly.value) return;
  const safeId = getSafeId(selectedId.value);

  try {
    modelConfig.value[safeId] = { ...localConfig.value };
    if (localNote.value.trim()) annotations.value[safeId] = localNote.value;
    else delete annotations.value[safeId];

    await projectApi.saveComponentVisuals(projectId.value, { id: safeId, visual: { ...localConfig.value } });
    await projectApi.saveAnnotations(projectId.value, annotations.value);

    originalConfig.value = JSON.parse(JSON.stringify(localConfig.value));
    originalNote.value = localNote.value;
  } catch (e) {
    console.error('Save component changes failed', e);
  }
};

const saveConnectionVisuals = async () => {
  if (!selectedConnectionId.value || isReadOnly.value) return;
  const cid = selectedConnectionId.value;

  const mergedConfig = { ...modelConfig.value };
  if (!mergedConfig[CONNECTION_STYLES_KEY]) mergedConfig[CONNECTION_STYLES_KEY] = {};
  const connectionKeys = getConnectionStyleKeys(findConnectionByStyleId(cid), cid);
  connectionKeys.forEach((key) => {
    mergedConfig[CONNECTION_STYLES_KEY][key] = { ...localConnectionStyle.value };
  });

  modelConfig.value = mergedConfig;

  try {
    await projectApi.saveVisualConfig(projectId.value, mergedConfig);
  } catch (e) {}
};

const syncAllConnectionVisuals = async () => {
  if (!selectedConnectionId.value || isReadOnly.value) return;
  const confirmed = window.confirm('Apply current connection style to all lines?');
  if (!confirmed) return;

  const mergedConfig = { ...modelConfig.value };
  const nextStyles = { ...(mergedConfig[CONNECTION_STYLES_KEY] || {}) };

  (structureData.value.connections || []).forEach(connection => {
    getConnectionStyleKeys(connection).forEach((connectionId) => {
      nextStyles[connectionId] = { ...localConnectionStyle.value };
    });
  });

  mergedConfig[CONNECTION_STYLES_KEY] = nextStyles;
  modelConfig.value = mergedConfig;

  try {
    await projectApi.saveVisualConfig(projectId.value, mergedConfig);
  } catch (e) {
    console.error('Sync connection visuals failed', e);
  }
};

const handleDoubleClick = (id) => {
  const resolvedGroupKey = resolveSelectedGroupKey(id);
  if (resolvedGroupKey) {
    selectedId.value = resolvedGroupKey;
    multiSelectedIds.value = new Set([resolvedGroupKey]);
    selectedConnectionId.value = null;
    if (expandedGroupId.value === resolvedGroupKey) expandedGroupId.value = null;
    else expandedGroupId.value = resolvedGroupKey;
  } else if (id && viewportPanel.value) {
    viewportPanel.value.focusCameraOn(id);
  }
};

const handleDoubleClickEmpty = () => {
  if (expandedGroupId.value) {
    expandedGroupId.value = null;
  }
};

const toggleGroupView = () => {
  if (!isSelectedGroup.value) return;
  const resolvedGroupKey = selectedGroupId.value;
  if (!resolvedGroupKey) return;
  expandedGroupId.value = expandedGroupId.value === resolvedGroupKey ? null : resolvedGroupKey;
};

const handleHoverShow = (payload) => {
  const safeId = payload.id.toLowerCase();
  hoverInfo.value = {
    visible: true,
    x: payload.clientX + 15,
    y: payload.clientY + 15,
    id: payload.id,
    note: annotations.value[safeId] || ''
  };
};

const handleHoverHide = () => {
  hoverInfo.value.visible = false;
};

const handleBoxSelectionApplied = (set) => {
  const normalizedSet = new Set();
  if (set) {
    set.forEach(id => {
      const normalizedId = normalizeWorkbenchSelectionId(id);
      if (normalizedId) normalizedSet.add(normalizedId);
    });
  }
  multiSelectedIds.value = normalizedSet;
  selectedConnectionId.value = null;
  selectedId.value = normalizedSet.size === 1 ? Array.from(normalizedSet)[0] : null;
  hoverInfo.value.visible = false;
};

const handleToggleMultiSelect = (id) => {
  const newSet = new Set(multiSelectedIds.value);
  const normalizedId = normalizeWorkbenchSelectionId(id);
  if (!normalizedId) return;
  if (newSet.has(normalizedId)) {
    newSet.delete(normalizedId);
  } else {
    newSet.add(normalizedId);
  }
  multiSelectedIds.value = newSet;
  selectedConnectionId.value = null;
  selectedId.value = newSet.size === 1 ? Array.from(newSet)[0] : null;
  hoverInfo.value.visible = false;
};

const getSelectedComponents = () => {
  return (structureData.value.components || []).filter(c => multiSelectedIds.value.has(c.id.toLowerCase()));
};

const runPersistedLayoutOperation = async (operation) => {
  if (isLayoutPersisting.value) return;
  isLayoutPersisting.value = true;
  try {
    await operation();
  } finally {
    isLayoutPersisting.value = false;
  }
};

const performAlignment = async (calcFn) => {
  await runPersistedLayoutOperation(async () => {
    if (isReadOnly.value) return;
    const comps = getSelectedComponents();
    if (comps.length < 2) return;
    const moves = comps.map(c => ({ id: c.id, x: c.position.x, y: c.position.y }));
    calcFn(moves);
    if (viewportPanel.value && viewportPanel.value.applyComponentMoves) {
      viewportPanel.value.applyComponentMoves(moves);
    }
    await Promise.all(moves.map(m => mutateLocalPositionAndSave(m.id, m.x, m.y)));
    mutatePositionsAndRefresh();
  });
};

const alignSelectedCenterX = () => performAlignment(moves => {
  const avgX = moves.reduce((s, m) => s + m.x, 0) / moves.length;
  moves.forEach(m => m.x = avgX);
});

const alignSelectedCenterY = () => performAlignment(moves => {
  const avgY = moves.reduce((s, m) => s + m.y, 0) / moves.length;
  moves.forEach(m => m.y = avgY);
});

const alignSelectedMinX = () => performAlignment(moves => {
  const minX = Math.min(...moves.map(m => m.x));
  moves.forEach(m => m.x = minX);
});

const alignSelectedMaxX = () => performAlignment(moves => {
  const maxX = Math.max(...moves.map(m => m.x));
  moves.forEach(m => m.x = maxX);
});

const alignSelectedMinY = () => performAlignment(moves => {
  const minY = Math.min(...moves.map(m => m.y));
  moves.forEach(m => m.y = minY);
});

const alignSelectedMaxY = () => performAlignment(moves => {
  const maxY = Math.max(...moves.map(m => m.y));
  moves.forEach(m => m.y = maxY);
});

const distributeSelectedX = () => performAlignment(moves => {
  if (moves.length < 3) return;
  moves.sort((a, b) => a.x - b.x);
  const minX = moves[0].x;
  const maxX = moves[moves.length - 1].x;
  const step = (maxX - minX) / (moves.length - 1);
  moves.forEach((m, i) => m.x = minX + step * i);
});

const distributeSelectedY = () => performAlignment(moves => {
  if (moves.length < 3) return;
  moves.sort((a, b) => a.y - b.y);
  const minY = moves[0].y;
  const maxY = moves[moves.length - 1].y;
  const step = (maxY - minY) / (moves.length - 1);
  moves.forEach((m, i) => m.y = minY + step * i);
});

const snapSelectedToGrid = () => performAlignment(moves => {
  const GRID_SNAP = 10;
  moves.forEach(m => {
    m.x = Math.round(m.x / GRID_SNAP) * GRID_SNAP;
    m.y = Math.round(m.y / GRID_SNAP) * GRID_SNAP;
  });
});

const handleMergeGroup = async () => {
  if (isReadOnly.value || multiSelectedIds.value.size < 2) return;
  const groupName = prompt('Enter name for the new group:', `System Group ${Math.floor(Math.random() * 100)}`);
  if (groupName) {
    const allChildren = new Set();
    const groupsToDelete = new Set();

    multiSelectedIds.value.forEach(rawId => {
      const foundGroupKey = resolveSelectedGroupKey(rawId);

      if (foundGroupKey) {
        const existingGroup = componentGroups.value[foundGroupKey];
        if (existingGroup?.children) {
          existingGroup.children.forEach(child => allChildren.add(String(child).toLowerCase()));
          groupsToDelete.add(foundGroupKey);
        }
        return;
      }

      allChildren.add(String(rawId).toLowerCase());
    });

    const groupId = `GROUP_${Date.now()}`;
    const childrenArray = Array.from(allChildren);
    const newGroups = { ...componentGroups.value };
    newGroups[groupId] = {
      id: groupId,
      name: groupName,
      children: childrenArray,
      expanded: false
    };

    groupsToDelete.forEach(groupIdToDelete => {
      delete newGroups[groupIdToDelete];
      if (expandedGroupId.value === groupIdToDelete) {
        expandedGroupId.value = null;
      }
    });

    componentGroups.value = newGroups;

    try {
      await projectApi.saveGroups(projectId.value, componentGroups.value);
      multiSelectedIds.value.clear();
    } catch (e) {
      console.error('Save groups failed', e);
    }
  }
};

const handleDissolveGroup = async () => {
  if (isReadOnly.value || multiSelectedIds.value.size !== 1) return;
  const selectedGroup = Array.from(multiSelectedIds.value)[0];
  if (!selectedGroup.toUpperCase().startsWith('GROUP_')) return;

  const resolvedGroupKey = resolveSelectedGroupKey(selectedGroup);
  if (!resolvedGroupKey) return;

  if (confirm('Are you sure you want to dissolve this group?')) {
    const newGroups = { ...componentGroups.value };
    delete newGroups[resolvedGroupKey];
    componentGroups.value = newGroups;

    if (expandedGroupId.value === resolvedGroupKey) {
      expandedGroupId.value = null;
    }

    try {
      await projectApi.saveGroups(projectId.value, componentGroups.value);
      multiSelectedIds.value.clear();
      if (String(selectedId.value || '').toLowerCase() === resolvedGroupKey.toLowerCase()) {
        selectedId.value = null;
      }
    } catch (e) {
      console.error('Save groups failed', e);
    }
  }
};

const resetComponentChanges = () => {
  localConfig.value = JSON.parse(JSON.stringify(originalConfig.value));
  localNote.value = originalNote.value;
};

const mutatePositionsAndRefresh = () => {
  const newComponents = [...structureData.value.components];
  structureData.value.components = newComponents;
  pushHistoryState(newComponents);
};

const handleDrag = async (payload) => {
  if (isReadOnly.value) return;
  await mutateLocalPositionAndSave(payload.id, payload.finalX, payload.finalY);
  pushHistoryState(structureData.value.components);
};

const handleHistoryChange = async (components) => {
  if (isReadOnly.value || !Array.isArray(components)) return;
  for (let c of components) {
    await mutateLocalPositionAndSave(c.id, c.x, c.y);
  }
  pushHistoryState(structureData.value.components);
};

const undoLayout = async () => {
  await runPersistedLayoutOperation(async () => {
    if (historyCursor.value > 0) {
      historyCursor.value -= 1;
      await applyHistoryState(historyStack.value[historyCursor.value]);
    }
  });
};

const redoLayout = async () => {
  await runPersistedLayoutOperation(async () => {
    if (historyCursor.value < historyStack.value.length - 1) {
      historyCursor.value += 1;
      await applyHistoryState(historyStack.value[historyCursor.value]);
    }
  });
};

const persistSceneDocument = async (document) => {
  if (!document || !projectId.value) {
    return;
  }

  const components = document.topology?.components || [];

  await Promise.all([
    projectApi.saveGroups(projectId.value, document.visual?.componentGroups || {}),
    projectApi.saveVisualConfig(projectId.value, document.visual?.modelConfig || {}),
    projectApi.saveAnnotations(projectId.value, document.visual?.annotations || {}),
    ...components.map(component => projectApi.savePosition(projectId.value, {
      id: component.id,
      x: component.position?.x ?? 0,
      y: component.position?.y ?? 0
    }))
  ]);
};

const saveLayoutSnapshot = () => {
  const name = window.prompt('Snapshot name', '');
  const payload = createSceneDocumentSnapshot(name || undefined, stageViewMode.value)
    || createSnapshotPayload(name || undefined);
  if (!payload) return;

  const viewportDocument = viewportPanel.value?.serializeSceneDocument?.(stageViewMode.value);
  if (viewportDocument) {
    payload.sceneDocument = viewportDocument;
  }

  layoutSnapshots.value.unshift(payload);
  if (layoutSnapshots.value.length > MAX_SNAPSHOTS) {
    layoutSnapshots.value.pop();
  }
  selectedSnapshotId.value = payload.id;
  persistLayoutSnapshots();
};

const restoreLayoutSnapshot = async () => {
  await runPersistedLayoutOperation(async () => {
    if (!selectedSnapshotId.value || isReadOnly.value) return;
    const snapshot = layoutSnapshots.value.find(item => item.id === selectedSnapshotId.value);
    if (!snapshot) return;
    pushHistoryState(structureData.value.components);

    if (snapshot.sceneDocument) {
      const restoredDocument = applySceneDocumentSnapshot(snapshot);
      stageViewMode.value = restoredDocument.metadata?.viewMode || stageViewMode.value;
      await persistSceneDocument(restoredDocument);
      return;
    }

    await applyHistoryState(snapshot.components);
  });
};

const deleteLayoutSnapshot = () => {
  if (!selectedSnapshotId.value || isReadOnly.value) return;
  layoutSnapshots.value = layoutSnapshots.value.filter(item => item.id !== selectedSnapshotId.value);
  selectedSnapshotId.value = layoutSnapshots.value[0]?.id || '';
  persistLayoutSnapshots();
};

const applyHistoryState = async (snap) => {
  if (!snap) return;

  if (snap.sceneDocument || snap.topology) {
    const restoredDocument = applySceneDocumentSnapshot(snap);
    stageViewMode.value = restoredDocument.metadata?.viewMode || stageViewMode.value;
    await viewportPanel.value?.loadSceneDocument?.(restoredDocument);
    await persistSceneDocument(restoredDocument);
    return;
  }

  snap.forEach(c => {
    const target = structureData.value.components.find(x => x.id.toLowerCase() === String(c.id).toLowerCase());
    if (target) {
      target.position.x = c.x;
      target.position.y = c.y;
    }
  });
  structureData.value.components = [...structureData.value.components];

  for (let c of snap) {
    await projectApi.savePosition(projectId.value, { id: c.id, x: c.x, y: c.y });
  }
};

watch(stageViewMode, (nextMode) => {
  setHistoryViewMode(nextMode);
}, { immediate: true });

const toggleMultiSelect = (id) => {
  const newSet = new Set(multiSelectedIds.value);
  if (newSet.has(id)) newSet.delete(id);
  else newSet.add(id);
  multiSelectedIds.value = newSet;
};

const getComponentPosition = (id) => {
  if (!structureData.value || !structureData.value.components) return 'Unknown';
  const comp = structureData.value.components.find(c => c.id === id);
  if (!comp || !comp.position) return 'Unknown';
  return `[${comp.position.x.toFixed(2)}, ${comp.position.y.toFixed(2)}]`;
};

watch(
  [selectedId, componentGroups, modelConfig, annotations],
  loadSelectedEditorData,
  { immediate: true, deep: false }
);

watch(selectedId, (newSelectedId) => {
  const resolvedGroupKey = resolveSelectedGroupKey(newSelectedId);
  if (!resolvedGroupKey) {
    return;
  }

  if (expandedGroupId.value !== resolvedGroupKey) {
    expandedGroupId.value = resolvedGroupKey;
  }
});
</script>

<style scoped>
.action-btn {
  background: #2b3a4a;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.action-btn:hover {
  background: #3a4a5a;
}

.right-sidebar-stack {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.right-sidebar-stack-library {
  background: linear-gradient(180deg, rgba(13, 20, 28, 0.98), rgba(7, 12, 18, 0.96));
}

.editor-sidebar {
  border-right: 1px solid #2a3645;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.right-sidebar {
  border-right: none;
  border-left: 1px solid #2a3645;
}

.placeholder-text {
  padding: 20px;
  font-size: 13px;
  color: #556a80;
  text-align: center;
}

.layout-bottom-panel {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr);
  gap: 12px;
  padding: 12px;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(12, 18, 25, 0.98), rgba(7, 11, 16, 0.96));
}

.layout-toolbox,
:deep(.layout-snapshot-panel.snapshot-panel) {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  background: rgba(4, 8, 12, 0.42);
  box-sizing: border-box;
}

.layout-toolbox {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.layout-toolbox-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.layout-toolbox-title {
  color: #00d2ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.layout-toolbox-subtitle {
  margin-top: 4px;
  color: #8da2bb;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.35;
}

.layout-mode-chip {
  flex: 0 0 auto;
  border: 1px solid rgba(0, 210, 255, 0.32);
  border-radius: 999px;
  color: #9cecff;
  background: rgba(0, 210, 255, 0.08);
  padding: 4px 9px;
  font-size: 10px;
  font-weight: 800;
}

.layout-tool-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 1.35fr) minmax(190px, 0.8fr) minmax(150px, 0.55fr);
  gap: 8px;
}

.layout-tool-section {
  min-width: 0;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  background: rgba(0,0,0,0.18);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.layout-section-label {
  color: #6f8298;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
}

.layout-axis-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-axis-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.axis-label {
  color: #9fb1c3;
  font-size: 10px;
  font-weight: 700;
}

.layout-tool-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.layout-tool-row.compact {
  align-content: flex-start;
}

.layout-tool-btn {
  background: rgba(0,0,0,0.38);
  border: 1px solid #2a3645;
  color: #c0d0e0;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.layout-tool-btn:hover:not(:disabled) {
  background: #2a3645;
  color: #fff;
}

.layout-tool-btn.action-primary {
  background: rgba(0, 210, 255, 0.15);
  border-color: rgba(0, 210, 255, 0.5);
  color: #00d2ff;
  font-weight: bold;
}

.layout-tool-btn.action-primary:hover:not(:disabled) {
  background: rgba(0, 210, 255, 0.3);
}

.layout-tool-btn.action-danger {
  background: rgba(255, 82, 82, 0.15);
  border-color: rgba(255, 82, 82, 0.5);
  color: #ff6b6b;
  font-weight: bold;
}

.layout-tool-btn.action-danger:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.3);
}

.single-group-tools {
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.layout-selection-status {
  margin-top: 5px;
  color: #dbe8f5;
  font-size: 12px;
  font-weight: 700;
}

.layout-selection-empty {
  flex: 1;
  min-height: 0;
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #8da2bb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 12px;
}

.layout-selection-muted {
  color: #4f657c;
  font-size: 11px;
}

:deep(.layout-snapshot-panel.snapshot-panel) {
  padding: 10px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(4, 8, 12, 0.42);
}

@media (max-width: 1180px) {
  .layout-bottom-panel {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .layout-tool-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .layout-axis-grid {
    grid-template-columns: 1fr;
  }
}

.group-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.hover-tooltip { position: fixed; background: rgba(14, 21, 30, 0.95); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 12px; min-width: 180px; pointer-events: none; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
.tooltip-header { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px; }
.tooltip-title { font-weight: bold; color: #00d2ff; font-size: 13px; font-family: monospace; }
.tooltip-note { font-size: 11px; margin-top: 5px; }
.note-label { color: #8da2bb; font-weight: bold; margin-bottom: 3px; }
.note-content { color: #eee; line-height: 1.4; word-break: break-word; }

.editor-main {
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.editor-stage-grid {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 12px;
  padding: 12px;
}

.editor-stage-grid.mode-3d,
.editor-stage-grid.mode-2d {
  grid-template-columns: 1fr;
}

.editor-stage-grid.mode-split {
  grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.95fr);
}

.stage-surface {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 18px;
  background: rgba(10, 16, 22, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.stage-surface-title {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d9e6ef;
  background: rgba(7, 12, 18, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}

.stage-toolbar {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 70;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: calc(100% - 32px);
  pointer-events: none;
}

.stage-toolbar-group {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px;
  border-radius: 12px;
  background: rgba(5, 10, 15, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.stage-btn {
  border: 1px solid transparent;
  background: transparent;
  color: #9fb3c5;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.stage-btn:hover,
.stage-btn.active {
  color: #eef7ff;
  border-color: rgba(53, 200, 255, 0.3);
  background: rgba(25, 40, 54, 0.94);
}

@media (max-width: 1480px) {
  .editor-stage-grid.mode-split {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(320px, 0.88fr);
  }
}

@media (max-width: 920px) {
  .stage-toolbar {
    left: 16px;
    right: 16px;
    justify-content: flex-start;
  }

  .editor-stage-grid {
    padding-top: 78px;
  }
}

.panel-title {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px 15px;
  font-size: 12px;
  font-weight: bold;
  color: #8da2bb;
  text-transform: uppercase;
  border-bottom: 1px solid #1f2a36;
  background: #141b24;
}

.hidden-file-input {
  display: none;
}
</style>
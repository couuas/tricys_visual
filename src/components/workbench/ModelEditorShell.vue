<template>
    <WorkbenchShell
        title="Model Editor"
        subtitle="Experimental Kernel"
        :left-width="360"
        :right-width="400"
        :bottom-height="88"
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
                <!-- Grouping & Alignment Toolbar -->
                <div class="selection-toolbar" v-if="multiSelectedIds && (multiSelectedIds.size > 1 || (multiSelectedIds.size === 1 && Array.from(multiSelectedIds)[0].toUpperCase().startsWith('GROUP_')))">
                    <div class="toolbar-title" v-if="multiSelectedIds.size > 1">ALIGN & DISTRIBUTE ({{ multiSelectedIds.size }} Selected)</div>
                    <div class="toolbar-title" v-else>GROUP ACTIONS</div>
                    
                    <div class="toolbar-row" v-if="multiSelectedIds.size > 1">
                        <button class="toolbar-btn" @click.stop="alignSelectedCenterX">Center X</button>
                        <button class="toolbar-btn" @click.stop="alignSelectedCenterY">Center Z</button>
                        <button class="toolbar-btn" @click.stop="alignSelectedMinX">Left</button>
                        <button class="toolbar-btn" @click.stop="alignSelectedMaxX">Right</button>
                        <button class="toolbar-btn" @click.stop="alignSelectedMinY">Top</button>
                        <button class="toolbar-btn" @click.stop="alignSelectedMaxY">Bottom</button>
                    </div>
                    <div class="toolbar-row" v-if="multiSelectedIds.size > 1">
                        <button class="toolbar-btn" @click.stop="distributeSelectedX">Distribute X</button>
                        <button class="toolbar-btn" @click.stop="distributeSelectedY">Distribute Z</button>
                        <button class="toolbar-btn" @click.stop="snapSelectedToGrid">Snap Grid</button>
                    </div>

                    <div class="toolbar-divider" v-if="multiSelectedIds.size > 1"></div>
                    
                    <div class="toolbar-row">
                        <button class="toolbar-btn action-primary" v-if="multiSelectedIds.size > 1" @click.stop="handleMergeGroup">Merge Group</button>
                        <button class="toolbar-btn action-danger" v-if="multiSelectedIds.size === 1 && Array.from(multiSelectedIds)[0].toUpperCase().startsWith('GROUP_')" @click.stop="handleDissolveGroup">Dissolve Group</button>
                    </div>
                </div>

                <div class="stage-toolbar">
                    <div class="stage-toolbar-group">
                        <button class="stage-btn" :class="{ active: stageViewMode === '3d' }" @click="stageViewMode = '3d'">3D</button>
                        <button class="stage-btn" :class="{ active: stageViewMode === '2d' }" @click="stageViewMode = '2d'">2D</button>
                        <button class="stage-btn" :class="{ active: stageViewMode === 'split' }" @click="stageViewMode = 'split'">Split</button>
                    </div>
                    <div v-if="show2DTwin" class="stage-toolbar-group">
                        <button class="stage-btn" :class="{ active: connectionRouteMode === 'orthogonal' }" @click="connectionRouteMode = 'orthogonal'">Auto Route</button>
                        <button class="stage-btn" :class="{ active: connectionRouteMode === 'bezier' }" @click="connectionRouteMode = 'bezier'">Bezier</button>
                        <button class="stage-btn" :class="{ active: snapToGridEnabled }" @click="snapToGridEnabled = !snapToGridEnabled">Snap {{ snapToGridEnabled ? 'On' : 'Off' }}</button>
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
                            :modelConfig="modelConfig"
                            :annotations="annotations"
                            :getConnectionStyle="getConnectionStyle"
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
                            :get-connection-style="getConnectionStyle"
                            :route-mode="connectionRouteMode"
                            :snap-to-grid="snapToGridEnabled"
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
                <!-- Hover Tooltip -->
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
            <SnapshotPanel
                v-model="selectedSnapshotId"
                :history-stack-length="historyStack.length"
                :history-cursor="historyCursor"
                :is-read-only="isReadOnly"
                :snapshots="layoutSnapshots"
                @undo="undoLayout"
                @redo="redoLayout"
                @save="saveLayoutSnapshot"
                @restore="restoreLayoutSnapshot"
                @delete="deleteLayoutSnapshot"
            />
        </template>
    </WorkbenchShell>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { projectApi } from '../../api/project';
import AssetLibraryPanel from './AssetLibraryPanel.vue';
import ModelSceneAsset from './ModelSceneAsset.vue';
import SceneTreePanel from './SceneTreePanel.vue';
import SnapshotPanel from './SnapshotPanel.vue';
import TopologyTwinPanel from './TopologyTwinPanel.vue';
import WorkbenchShell from './WorkbenchShell.vue';
import { useModelEditorState } from '../../composables/useModelEditorState';
import { normalizeSelectionId, resolveGroupKey } from '../../utils/groupIds';
import { validateUploadFile } from '../../platform/media/validators/modelAssetValidator';
import { $notify } from '../../utils/notification';

const props = defineProps({
    projectId: { type: String, default: '' },
    mode: { type: String, default: '' },
    embedded: { type: Boolean, default: false },
    returnRouteName: { type: String, default: 'config' },
    returnQuery: { type: Object, default: () => ({}) }
});

const router = useRouter();
const route = useRoute();

// Localized portable state boundary (Replacing global useSimulation)
const projectId = computed(() => props.projectId || route.query.projectId || 'model-editor-demo');
const isReadOnly = computed(() => (props.mode || route.query.mode) === 'view');

const viewportPanel = ref(null);
const fileInputRef = ref(null);
const stageViewMode = ref('split');
const connectionRouteMode = ref('orthogonal');
const snapToGridEnabled = ref(true);

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

const show3DViewport = computed(() => stageViewMode.value === '3d' || stageViewMode.value === 'split');
const show2DTwin = computed(() => stageViewMode.value === '2d' || stageViewMode.value === 'split');

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
        // Single selection becomes the only element in multiSelectedIds
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
    } catch(e) { console.error("Upload failed", e); }
    // Reset input
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
    } catch(e) {
        console.error('Save component changes failed', e);
    }
};

const saveConnectionVisuals = async () => {
    if (!selectedConnectionId.value || isReadOnly.value) return;
    const cid = selectedConnectionId.value;
    
    const mergedConfig = { ...modelConfig.value };
    if (!mergedConfig[CONNECTION_STYLES_KEY]) mergedConfig[CONNECTION_STYLES_KEY] = {};
    mergedConfig[CONNECTION_STYLES_KEY][cid] = { ...localConnectionStyle.value };
    
    // Mutate reactive ref
    modelConfig.value = mergedConfig;
    
    try {
        await projectApi.saveVisualConfig(projectId.value, mergedConfig);
    } catch(e) {}
};

const syncAllConnectionVisuals = async () => {
    if (!selectedConnectionId.value || isReadOnly.value) return;
    const confirmed = window.confirm('Apply current connection style to all lines?');
    if (!confirmed) return;

    const mergedConfig = { ...modelConfig.value };
    const nextStyles = { ...(mergedConfig[CONNECTION_STYLES_KEY] || {}) };

    (structureData.value.connections || []).forEach(connection => {
        const connectionId = `${String(connection.from).toLowerCase()}_${String(connection.to).toLowerCase()}`;
        nextStyles[connectionId] = { ...localConnectionStyle.value };
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
    // Update ref to trigger reactivity
    multiSelectedIds.value = newSet;
    selectedConnectionId.value = null;
    selectedId.value = newSet.size === 1 ? Array.from(newSet)[0] : null;
    hoverInfo.value.visible = false;
};

// --- Alignment & Grouping Logic ---
const getSelectedComponents = () => {
    // [Fix ID sensitivity] Engine uses lowercase in sets, Original is mixed case
    return (structureData.value.components || []).filter(c => multiSelectedIds.value.has(c.id.toLowerCase()));
};

const performAlignment = async (calcFn) => {
    if (isReadOnly.value) return;
    const comps = getSelectedComponents();
    if (comps.length < 2) return;
    const moves = comps.map(c => ({ id: c.id, x: c.position.x, y: c.position.y }));
    calcFn(moves);
    // Apply natively to bypass heavy rebuild
    if (viewportPanel.value && viewportPanel.value.applyComponentMoves) {
        viewportPanel.value.applyComponentMoves(moves);
    }
    // Bulk save and update state
    await Promise.all(moves.map(m => mutateLocalPositionAndSave(m.id, m.x, m.y)));
    mutatePositionsAndRefresh();
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
    const GRID_SNAP = 10; // Default snap size mapped to 2D
    moves.forEach(m => {
        m.x = Math.round(m.x / GRID_SNAP) * GRID_SNAP;
        m.y = Math.round(m.y / GRID_SNAP) * GRID_SNAP;
    });
});


const handleMergeGroup = async () => {
    if (isReadOnly.value || multiSelectedIds.value.size < 2) return;
    const groupName = prompt("Enter name for the new group:", `System Group ${Math.floor(Math.random() * 100)}`);
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
    
    if (confirm("Are you sure you want to dissolve this group?")) {
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
// ---------------------------------

const handleDrag = async (payload) => {
    if(isReadOnly.value) return;
    await mutateLocalPositionAndSave(payload.id, payload.finalX, payload.finalY);
    pushHistoryState(structureData.value.components);
};

const handleHistoryChange = async (components) => {
    // Comes from SceneViewportPanel.vue applyState
    if (isReadOnly.value || !Array.isArray(components)) return;
    for (let c of components) {
        await mutateLocalPositionAndSave(c.id, c.x, c.y);
    }
    pushHistoryState(structureData.value.components);
};

const undoLayout = () => {
    if (historyCursor.value > 0) {
        historyCursor.value -= 1;
        applyHistoryState(historyStack.value[historyCursor.value]);
    }
};

const redoLayout = () => {
    if (historyCursor.value < historyStack.value.length - 1) {
        historyCursor.value += 1;
        applyHistoryState(historyStack.value[historyCursor.value]);
    }
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
    // Trigger reactivity
    structureData.value.components = [...structureData.value.components];
    
    // Save backwards
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

.selection-toolbar { 
    position: absolute; 
    top: 15px; 
    left: 50%; 
    transform: translateX(-50%); 
    background: rgba(5, 10, 15, 0.85); 
    border: 1px solid rgba(0, 210, 255, 0.35); 
    border-radius: 8px; 
    padding: 10px 14px; 
    z-index: 60; 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    backdrop-filter: blur(8px); 
    box-shadow: 0 8px 30px rgba(0,0,0,0.5); 
}
.selection-toolbar .toolbar-title { font-size: 11px; font-weight: bold; color: #00d2ff; text-align: center; letter-spacing: 1px; }
.selection-toolbar .toolbar-row { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.selection-toolbar .toolbar-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 2px 0; }
.selection-toolbar .toolbar-btn { background: rgba(0,0,0,0.4); border: 1px solid #2a3645; color: #c0d0e0; padding: 6px 14px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.selection-toolbar .toolbar-btn:hover { background: #2a3645; color: #fff; }
.selection-toolbar .action-primary { background: rgba(0, 210, 255, 0.15); border-color: rgba(0, 210, 255, 0.5); color: #00d2ff; font-weight: bold; }
.selection-toolbar .action-primary:hover { background: rgba(0, 210, 255, 0.3); }
.selection-toolbar .action-danger { background: rgba(255, 82, 82, 0.15); border-color: rgba(255, 82, 82, 0.5); color: #ff5252; font-weight: bold; }
.selection-toolbar .action-danger:hover { background: rgba(255, 82, 82, 0.3); }

.group-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
}

/* Hover Tooltip */
.hover-tooltip { position: fixed; background: rgba(14, 21, 30, 0.95); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 12px; min-width: 180px; pointer-events: none; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
.tooltip-header { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 8px; }
.tooltip-title { font-weight: bold; color: #00d2ff; font-size: 13px; font-family: monospace; }
.tooltip-note { font-size: 11px; margin-top: 5px; }
.note-label { color: #8da2bb; font-weight: bold; margin-bottom: 3px; }
.note-content { color: #eee; line-height: 1.4; word-break: break-word; }

.editor-main {
    position: relative;
    height: 100%;
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
        padding-top: 68px;
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

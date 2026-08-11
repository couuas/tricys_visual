import { computed, ref, watch } from 'vue';
import { cloneSceneDocument, createSceneDocument, normalizeSceneDocument } from '../../../platform/protocols/sceneDocument';

export const MAX_WORKBENCH_SNAPSHOTS = 20;

export function useWorkbenchStore({ projectId, structureData, modelConfig, annotations, componentGroups, getSafeId }) {
    const multiSelectedIds = ref(new Set());
    const visibleIds = ref(new Set());
    const selectedId = ref(null);
    const selectedConnectionId = ref(null);

    const localConfig = ref({ type: 'default', scale: 1.0, url: '' });
    const localNote = ref('');
    const localConnectionStyle = ref({});

    const originalConfig = ref({});
    const originalNote = ref('');

    const hoverInfo = ref({ visible: false, x: 0, y: 0, id: '', note: '' });
    const expandedGroupId = ref(null);
    const historyStack = ref([]);
    const historyCursor = ref(-1);
    const historyViewMode = ref('3d');
    const layoutSnapshots = ref([]);
    const selectedSnapshotId = ref('');
    const currentAssetUrl = computed(() => localConfig.value?.url || '');

    const loadSelectedEditorData = () => {
        if (!selectedId.value) {
            return;
        }

        const safeId = getSafeId(selectedId.value);

        localConfig.value = modelConfig.value[safeId]
            ? { ...modelConfig.value[safeId] }
            : { type: 'default', scale: 1.0, url: '' };
        originalConfig.value = JSON.parse(JSON.stringify(localConfig.value));

        localNote.value = annotations.value[safeId] || annotations.value[String(safeId).toLowerCase()] || '';
        originalNote.value = localNote.value;
    };

    const getSnapshotKey = () => `tricys_layout_snapshots_${projectId.value || 'default'}`;

    const loadLayoutSnapshots = () => {
        const raw = localStorage.getItem(getSnapshotKey());
        let list = [];
        try {
            list = raw ? JSON.parse(raw) : [];
        } catch {
            list = [];
        }
        layoutSnapshots.value = Array.isArray(list) ? list : [];
        selectedSnapshotId.value = layoutSnapshots.value[0]?.id || '';
    };

    const persistLayoutSnapshots = () => {
        localStorage.setItem(getSnapshotKey(), JSON.stringify(layoutSnapshots.value));
    };

    const createSnapshotPayload = (name) => {
        if (!structureData.value?.components?.length) {
            return null;
        }
        return {
            id: crypto?.randomUUID ? crypto.randomUUID() : `snap_${Date.now()}`,
            name: name || `Snapshot ${new Date().toLocaleString()}`,
            components: structureData.value.components.map(component => ({
                id: component.id,
                x: component.position.x,
                y: component.position.y
            }))
        };
    };

    const setHistoryViewMode = (viewMode) => {
        historyViewMode.value = viewMode || '3d';
    };

    const createHistoryEntry = (document) => {
        const nextDocument = document?.topology
            ? cloneSceneDocument(normalizeSceneDocument(document))
            : createSceneDocument({
                projectId: projectId.value,
                structureData: structureData.value,
                modelConfig: modelConfig.value,
                annotations: annotations.value,
                componentGroups: componentGroups.value,
                expandedGroupId: expandedGroupId.value,
                visibleIds: Array.from(visibleIds.value),
                viewMode: historyViewMode.value
            });

        return {
            id: crypto?.randomUUID ? crypto.randomUUID() : `hist_${Date.now()}`,
            sceneDocument: nextDocument
        };
    };

    const pushHistoryState = (state) => {
        const hasLegacyComponents = Array.isArray(state) && state.length;
        const hasSceneDocument = !!state?.topology || !!state?.sceneDocument;

        if (!hasLegacyComponents && !hasSceneDocument && !structureData.value?.components?.length) {
            return;
        }

        const snap = hasSceneDocument
            ? createHistoryEntry(state.sceneDocument || state)
            : createHistoryEntry();

        if (historyCursor.value < historyStack.value.length - 1) {
            historyStack.value = historyStack.value.slice(0, historyCursor.value + 1);
        }
        historyStack.value.push(snap);
        if (historyStack.value.length > 50) historyStack.value.shift();
        historyCursor.value = historyStack.value.length - 1;
    };

    watch(
        () => projectId.value,
        () => {
            historyStack.value = [];
            historyCursor.value = -1;
            visibleIds.value.clear();
            loadLayoutSnapshots();
        },
        { immediate: true }
    );

    watch(
        () => structureData.value?.components,
        (components) => {
            if (!Array.isArray(components) || !components.length) {
                return;
            }

            if (!historyStack.value.length) {
                pushHistoryState(components);
            }
            
            if (visibleIds.value.size === 0) {
                 const newVisible = new Set();
                 if (modelConfig.value && modelConfig.value.visibleIds !== undefined) {
                     if (Array.isArray(modelConfig.value.visibleIds)) {
                         modelConfig.value.visibleIds.forEach(id => newVisible.add(getSafeId(id)));
                     }
                 } else {
                     components.forEach(c => {
                         if (c.has_layout) {
                             newVisible.add(getSafeId(c.id));
                         }
                     });
                 }
                 visibleIds.value = newVisible;
            }
        },
        { immediate: true }
    );

    watch(
        [selectedId, componentGroups, modelConfig, annotations],
        loadSelectedEditorData,
        { immediate: true, deep: false }
    );

    return {
        MAX_WORKBENCH_SNAPSHOTS,
        createHistoryEntry,
        createSnapshotPayload,
        currentAssetUrl,
        expandedGroupId,
        historyCursor,
        historyStack,
        hoverInfo,
        layoutSnapshots,
        loadLayoutSnapshots,
        loadSelectedEditorData,
        localConfig,
        localConnectionStyle,
        localNote,
        modelConfig,
        multiSelectedIds,
        visibleIds,
        originalConfig,
        originalNote,
        persistLayoutSnapshots,
        pushHistoryState,
        selectedConnectionId,
        selectedId,
        selectedSnapshotId,
        setHistoryViewMode
    };
}
import { computed, watch } from 'vue';
import { cloneSceneDocument, createSceneDocument, normalizeSceneDocument } from '../platform/protocols/sceneDocument';
import { useMediaLibraryStore } from '../stores/mediaLibrary.store';
import { useProjectDocumentStore } from '../stores/projectDocument.store';
import { useWorkbenchStore } from '../stores/workbench.store';

export function useModelEditorState({ projectId, isReadOnly }) {
    const {
        CONNECTION_STYLES_KEY,
        annotations,
        componentGroups,
        getConnectionStyle,
        modelConfig,
        structureData
    } = useProjectDocumentStore({ projectId, isReadOnly });

    const getSafeId = (rawId) => String(rawId || '').trim().toUpperCase().startsWith('GROUP_')
        ? String(rawId || '').trim().toUpperCase()
        : String(rawId || '').trim().toLowerCase();

    const {
        MAX_WORKBENCH_SNAPSHOTS,
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
        multiSelectedIds,
        originalConfig,
        originalNote,
        persistLayoutSnapshots,
        pushHistoryState,
        selectedConnectionId,
        selectedId,
        selectedSnapshotId,
        setHistoryViewMode
    } = useWorkbenchStore({
        projectId,
        structureData,
        modelConfig,
        annotations,
        componentGroups,
        getSafeId
    });

    const {
        assetCatalog,
        bindingPanelState,
        canApplyLibraryAsset,
        isSelectedGroup,
        libraryModels,
        recommendedAssetCatalog,
        selectedComponentCategory,
        selectedComponentLabel,
        selectedGroupId
    } = useMediaLibraryStore({
        projectId,
        isReadOnly,
        structureData,
        modelConfig,
        componentGroups,
        selectedId,
        selectedConnectionId,
        currentAssetUrl
    });

    const createSceneDocumentSnapshot = (name, viewMode = '3d') => {
        const baseSnapshot = createSnapshotPayload(name);
        if (!baseSnapshot) {
            return null;
        }

        return {
            ...baseSnapshot,
            sceneDocument: createSceneDocument({
                projectId: projectId.value,
                structureData: structureData.value,
                modelConfig: modelConfig.value,
                annotations: annotations.value,
                componentGroups: componentGroups.value,
                expandedGroupId: expandedGroupId.value,
                viewMode
            })
        };
    };

    const applySceneDocumentSnapshot = (snapshotOrDocument) => {
        const normalizedDocument = cloneSceneDocument(
            normalizeSceneDocument(snapshotOrDocument?.sceneDocument || snapshotOrDocument)
        );

        structureData.value = normalizedDocument.topology;
        modelConfig.value = normalizedDocument.visual.modelConfig || {};
        annotations.value = normalizedDocument.visual.annotations || {};
        componentGroups.value = normalizedDocument.visual.componentGroups || {};
        expandedGroupId.value = normalizedDocument.visual.expandedGroupId || null;

        return normalizedDocument;
    };

    return {
        CONNECTION_STYLES_KEY,
        MAX_SNAPSHOTS: MAX_WORKBENCH_SNAPSHOTS,
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
        loadLayoutSnapshots,
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
    };
}
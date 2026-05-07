import { computed, ref, watch } from 'vue';
import { useSceneEditorBridge } from '../../../platform/scene/bridges/SceneEditorBridge';
import { resolveBackendBase } from '../../../utils/runtimeUrls';

export function useMediaLibraryStore({
    projectId,
    isReadOnly,
    structureData,
    modelConfig,
    componentGroups,
    selectedId,
    selectedConnectionId,
    currentAssetUrl
}) {
    const libraryModels = ref([]);
    const isHydratingLibrary = ref(false);
    const lastHydratedProjectId = ref('');

    const resolvedProjectId = computed(() => String(projectId?.value || ''));
    const resolvedIsReadOnly = computed(() => !!isReadOnly?.value);

    const hydrateLibraryModels = async () => {
        if (!resolvedProjectId.value || resolvedIsReadOnly.value) {
            libraryModels.value = [];
            lastHydratedProjectId.value = resolvedProjectId.value;
            return;
        }

        isHydratingLibrary.value = true;
        try {
            const backendUrl = resolveBackendBase();
            const response = await fetch(`${backendUrl}/api/v1/library/models`);
            libraryModels.value = response.ok ? await response.json() : [];
            lastHydratedProjectId.value = resolvedProjectId.value;
        } catch {
            libraryModels.value = [];
        } finally {
            isHydratingLibrary.value = false;
        }
    };

    watch(
        [resolvedProjectId, resolvedIsReadOnly],
        async ([nextProjectId, nextReadOnly], [prevProjectId, prevReadOnly]) => {
            if (!nextProjectId) {
                await hydrateLibraryModels();
                return;
            }

            if (nextProjectId !== prevProjectId || nextReadOnly !== prevReadOnly || nextProjectId !== lastHydratedProjectId.value) {
                await hydrateLibraryModels();
            }
        },
        { immediate: true }
    );

    const bridge = useSceneEditorBridge({
        structureData,
        modelConfig,
        componentGroups,
        libraryModels,
        selectedId,
        selectedConnectionId,
        currentAssetUrl
    });

    return {
        ...bridge,
        hydrateLibraryModels,
        isHydratingLibrary,
        libraryModels
    };
}
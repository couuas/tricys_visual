import { computed, ref, watch } from 'vue';
import { projectApi } from '../api/project';

const CONNECTION_STYLES_KEY = '__connection_styles__';
const defaultConnectionStyle = { color: '#FFD700', type: 'flow', speed: 1.0, opacity: 0.9, width: 4.0 };

export function useProjectDocumentStore({ projectId, isReadOnly }) {
    const structureData = ref({ components: [], connections: [] });
    const modelConfig = ref({});
    const annotations = ref({});
    const componentGroups = ref({});
    const isHydrating = ref(false);
    const lastHydratedProjectId = ref('');

    const resolvedProjectId = computed(() => String(projectId?.value || ''));
    const resolvedIsReadOnly = computed(() => !!isReadOnly?.value);

    const hydrateProjectDocument = async () => {
        if (!resolvedProjectId.value) {
            structureData.value = { components: [], connections: [] };
            modelConfig.value = {};
            annotations.value = {};
            componentGroups.value = {};
            lastHydratedProjectId.value = '';
            return;
        }

        isHydrating.value = true;

        try {
            const project = await projectApi.getProject(resolvedProjectId.value);
            structureData.value = project.structure || { components: [], connections: [] };
            modelConfig.value = project.visual_config || {};

            try {
                annotations.value = await projectApi.getAnnotations(resolvedProjectId.value) || {};
            } catch {
                annotations.value = {};
            }

            try {
                componentGroups.value = await projectApi.getGroups(resolvedProjectId.value) || {};
            } catch {
                componentGroups.value = {};
            }

            lastHydratedProjectId.value = resolvedProjectId.value;
        } catch (error) {
            console.error('Failed to hydrate project document store:', error);
        } finally {
            isHydrating.value = false;
        }
    };

    const getConnectionStyle = (id) => {
        const styles = modelConfig.value?.[CONNECTION_STYLES_KEY] || {};
        return styles[id] || { ...defaultConnectionStyle };
    };

    watch(
        [resolvedProjectId, resolvedIsReadOnly],
        async ([nextProjectId, nextReadOnly], [prevProjectId, prevReadOnly]) => {
            if (!nextProjectId) {
                await hydrateProjectDocument();
                return;
            }

            if (nextProjectId !== prevProjectId || nextReadOnly !== prevReadOnly || nextProjectId !== lastHydratedProjectId.value) {
                await hydrateProjectDocument();
            }
        },
        { immediate: true }
    );

    return {
        CONNECTION_STYLES_KEY,
        annotations,
        componentGroups,
        defaultConnectionStyle,
        getConnectionStyle,
        hydrateProjectDocument,
        isHydrating,
        modelConfig,
        structureData
    };
}
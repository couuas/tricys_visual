import { computed } from 'vue';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';

export function useAnalysisWorkspace() {
  const { loadProjectWorkspace, componentParams, structureData, currentProject } = useProjectWorkspace();

  const modelMetadata = computed(() => ({
    packagePath: currentProject.value?.package_path || '',
    modelName: currentProject.value?.model_name || currentProject.value?.name || 'example_model.Cycle',
  }));

  return {
    loadData: loadProjectWorkspace,
    componentParams,
    structureData,
    modelMetadata,
  };
}
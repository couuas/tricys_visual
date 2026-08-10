import { computed } from 'vue';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';

export function useAnalysisWorkspace() {
  const { loadProjectWorkspace, componentParams, structureData, currentProject } = useProjectWorkspace();

  const modelMetadata = computed(() => {
    let modelName = currentProject.value?.simulation_config?.model_name;
    if (!modelName || modelName === 'Model') {
      modelName = 'example_model.Cycle';
    }
    return {
      packagePath: currentProject.value?.package_path || '',
      modelName,
    };
  });

  return {
    loadData: loadProjectWorkspace,
    componentParams,
    structureData,
    modelMetadata,
  };
}
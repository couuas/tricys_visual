import { ref } from 'vue';
import { libraryApi } from '../../../api/library';

const libraryModels = ref([]);

export function useSimulationLibraryModels() {
  const fetchLibraryModels = async () => {
    try {
      const models = await libraryApi.getModels();
      libraryModels.value = Array.isArray(models) ? models : [];
    } catch (error) {
      libraryModels.value = [];
      console.error('Failed to fetch library models:', error);
    }
  };

  return {
    fetchLibraryModels,
    libraryModels
  };
}
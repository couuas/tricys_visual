import { useAnalysisWorkbenchStore } from '../../../modules/analysis/stores/analysisWorkbench.store';
import { useSimulationSceneStore } from '../../../modules/simulation/stores/simulationScene.store';
import { useSimulationSessionStore } from '../../../modules/simulation/stores/simulationSession.store';
import { useProjectWorkspace } from '../../project/composables/useProjectWorkspace';

export function useWorkspaceSession() {
  const {
    currentProjectId,
    modelConfig,
    resetProjectWorkspace,
    structureData
  } = useProjectWorkspace();

  const {
    clearResults: clearSimulationResults,
    resetSimulationSession
  } = useSimulationSessionStore();

  const { resetSceneInteractionState } = useSimulationSceneStore({
    currentProjectId,
    modelConfig,
    structureData
  });

  const { resetAnalysisWorkbench } = useAnalysisWorkbenchStore();

  const resetSession = async () => {
    resetSimulationSession();
    resetProjectWorkspace();
    resetSceneInteractionState();
    resetAnalysisWorkbench();
  };

  const clearResults = async () => {
    clearSimulationResults();
  };

  return {
    clearResults,
    resetSession
  };
}
import { ref } from 'vue';

const analysisTasks = ref([]);
const currentAnalysisTask = ref(null);
const showAnalysisPanel = ref(false);
const isDashboardMode = ref(false);

const toggleDashboardMode = () => {
    isDashboardMode.value = !isDashboardMode.value;
};

const openAnalysisDashboard = (task) => {
    currentAnalysisTask.value = task;
    showAnalysisPanel.value = false;
};

const closeAnalysisDashboard = () => {
    currentAnalysisTask.value = null;
    showAnalysisPanel.value = true;
};

const resetAnalysisWorkbench = () => {
    analysisTasks.value = [];
    currentAnalysisTask.value = null;
    showAnalysisPanel.value = false;
    isDashboardMode.value = false;
};

export function useAnalysisWorkbenchStore() {
    return {
        analysisTasks,
        closeAnalysisDashboard,
        currentAnalysisTask,
        isDashboardMode,
        openAnalysisDashboard,
        resetAnalysisWorkbench,
        showAnalysisPanel,
        toggleDashboardMode
    };
}
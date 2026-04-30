import { reactive, ref } from 'vue';

const simulationData = ref(null);
const hasSimulationData = ref(false);
const currentTime = ref(0);
const showLabels = ref(true);
const userPrefersDashboard = ref(true);
const showDashboard = ref(true);
const filterSchema = ref([]);
const alertRules = ref({});
const activeAlert = ref(null);
const ignoredComponents = reactive(new Set());
const lastSimConfig = ref(null);

const normalizeFilterSchema = (rules) => {
    if (!Array.isArray(rules)) return [];
    return rules
        .map((rule) => {
            const columns = Array.isArray(rule?.columns)
                ? rule.columns.filter((column) => typeof column === 'string' && column.trim())
                : [];
            const normalized = { columns };
            if (rule?.min !== undefined && rule?.min !== null && rule.min !== '') {
                normalized.min = Number(rule.min);
            }
            if (rule?.max !== undefined && rule?.max !== null && rule.max !== '') {
                normalized.max = Number(rule.max);
            }
            return normalized;
        })
        .filter((rule) => rule.columns.length > 0 && (rule.min !== undefined || rule.max !== undefined));
};

const updateDashboardVisibility = () => {
    if (!hasSimulationData.value) {
        showDashboard.value = false;
        return;
    }

    const width = window.innerWidth;
    showDashboard.value = width >= 800 ? userPrefersDashboard.value : false;
};

const toggleDashboardPref = (value) => {
    userPrefersDashboard.value = value;
    showDashboard.value = value;
};

const clearResults = () => {
    hasSimulationData.value = false;
    simulationData.value = null;
    currentTime.value = 0;
    showLabels.value = true;
    lastSimConfig.value = null;
    activeAlert.value = null;
    ignoredComponents.clear();
    updateDashboardVisibility();
};

const resetSimulationSession = () => {
    currentTime.value = 0;
    simulationData.value = null;
    hasSimulationData.value = false;
    showLabels.value = true;
    lastSimConfig.value = null;
    filterSchema.value = [];
    activeAlert.value = null;
    ignoredComponents.clear();
    alertRules.value = {};
    updateDashboardVisibility();
};

export function useSimulationSessionStore() {
    return {
        activeAlert,
        alertRules,
        clearResults,
        currentTime,
        filterSchema,
        hasSimulationData,
        ignoredComponents,
        lastSimConfig,
        normalizeFilterSchema,
        resetSimulationSession,
        showDashboard,
        showLabels,
        simulationData,
        toggleDashboardPref,
        updateDashboardVisibility,
        userPrefersDashboard
    };
}
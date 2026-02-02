import apiClient from './client';

export const analysisApi = {
    // List tasks
    getTasks: async (projectId = null) => {
        const params = projectId ? { project_id: projectId } : {};
        // apiClient interceptor returns response.data
        return await apiClient.get('/analysis/tasks', { params });
    },

    // Get Templates
    getTemplates: async () => {
        return await apiClient.get('/analysis/templates');
    },

    // Submit new task
    // config structure depends on what backend expects (AnalysisService wrapper)
    submitTask: async (projectId, name, config, templateId = null) => {
        const payload = {
            project_id: projectId,
            name: name,
            config: config,
            template_id: templateId
        };
        return await apiClient.post('/analysis/submit', payload);
    },

    // Get single task
    getTask: async (taskId) => {
        return await apiClient.get(`/analysis/tasks/${taskId}`);
    },

    // Delete task
    deleteTask: async (taskId) => {
        return await apiClient.delete(`/analysis/tasks/${taskId}`);
    },

    // Get Report Content (Markdown)
    getReport: async (taskId) => {
        const data = await apiClient.get(`/analysis/tasks/${taskId}/report`);
        return data.content;
    },

    // Placeholder for getting raw result data if endpoint exists
    getResults: async (taskId) => {
        // Not fully implemented in backend yet, but usually we fetch result files
        // For now return null or implement if backend supports
        return null;
    }
};

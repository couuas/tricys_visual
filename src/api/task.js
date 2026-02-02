import apiClient from './client';

export const taskApi = {
  // Create a new task (Start simulation)
  createTask(taskData) {
    return apiClient.post('/tasks', taskData);
  },

  // List tasks
  listTasks(status = null, limit = 20, offset = 0) {
    const params = { limit, offset };
    if (status) params.status = status;
    return apiClient.get('/tasks', { params });
  },

  // Get specific task
  getTask(taskId) {
    return apiClient.get(`/tasks/${taskId}`);
  },

  // Stop task
  stopTask(taskId) {
    return apiClient.post(`/tasks/${taskId}/stop`);
  },

  // Delete task
  deleteTask(taskId, cleanup = false) {
    return apiClient.delete(`/tasks/${taskId}`, { params: { cleanup_files: cleanup } });
  },

  // Get logs
  getLogs(taskId) {
    return apiClient.get(`/tasks/${taskId}/logs`);
  },

  // Get Summary Stats (Global)
  getSummary() {
    return apiClient.get('/tasks/stats/summary');
  },

  // --- Result Specific ---

  // Get Task Result Summary
  getResultSummary(taskId) {
    return apiClient.get(`/tasks/${taskId}/result_summary`);
  },

  // Get Task Files
  getFiles(taskId) {
    return apiClient.get(`/tasks/${taskId}/files`);
  },

  // Download Task File
  downloadFile(taskId, path) {
    return apiClient.get(`/tasks/${taskId}/files/download`, {
      params: { path },
      responseType: 'blob' // Important for binary files
    });
  },

  // Query Results
  queryResults(taskId, queryPayload) {
    return apiClient.post(`/tasks/${taskId}/results/query`, queryPayload);
  }
};

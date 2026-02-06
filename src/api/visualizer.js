import apiClient from './client';

export const visualizerApi = {
  getMetadata: async (taskId) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/metadata`);
  },
  getJobs: async (taskId, params) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/jobs`, { params });
  },
  getSeries: async (taskId, params) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/series`, { params });
  },
  getMetrics: async (taskId, params) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/metrics`, { params });
  },
  getConfig: async (taskId) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/config`);
  },
  getLog: async (taskId) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/log`);
  },
  exportData: async (taskId, payload) => {
    return await apiClient.post(`/tasks/${taskId}/visualizer/export`, payload);
  },
  getFileContent: async (taskId, params) => {
    return await apiClient.get(`/tasks/${taskId}/files/content`, { params });
  },
  openHdf5: async (taskId, payload) => {
    return await apiClient.post(`/tasks/${taskId}/visualizer/hdf5/open`, payload);
  },
  getHdf5Status: async (taskId) => {
    return await apiClient.get(`/tasks/${taskId}/visualizer/hdf5/status`);
  },
  stopHdf5: async (taskId) => {
    return await apiClient.post(`/tasks/${taskId}/visualizer/hdf5/stop`);
  },
  getActiveProcesses: async () => {
    return await apiClient.get('/tasks/visualizer/hdf5/processes');
  },
  getStats: async () => {
    return await apiClient.get('/tasks/visualizer/stats');
  }
};

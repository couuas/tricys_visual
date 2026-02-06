import apiClient from './client';

export const projectApi = {
  // List projects
  listProjects(skip = 0, limit = 100) {
    const params = { skip, limit };
    return apiClient.get('/project/', { params });
  },

  listPublicProjects(skip = 0, limit = 100) {
    return apiClient.get('/project/public', { params: { skip, limit } });
  },

  // Create project (Upload .mo file)
  createProject(file) {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post('/project/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Get project details
  getProject(projectId) {
    return apiClient.get(`/project/${projectId}`);
  },

  deleteProject(projectId) {
    return apiClient.delete(`/project/${projectId}`);
  },

  // --- Parameters ---
  getParameters(projectId) {
    return apiClient.get(`/project/${projectId}/parameters`);
  },

  getDefaults(projectId) {
    return apiClient.get(`/project/${projectId}/defaults`);
  },

  saveParameters(projectId, params) {
    return apiClient.post(`/project/${projectId}/parameters`, params);
  },

  // --- Run Configuration ---
  getRunConfig(projectId) {
    return apiClient.get(`/project/${projectId}/run_config`);
  },

  saveRunConfig(projectId, config) {
    return apiClient.post(`/project/${projectId}/run_config`, config);
  },

  // --- UI State ---
  saveGroups(projectId, groups) {
    return apiClient.post(`/project/${projectId}/groups`, groups);
  },

  getGroups(projectId) {
    return apiClient.get(`/project/${projectId}/groups`);
  },

  savePosition(projectId, updateData) {
    return apiClient.post(`/project/${projectId}/update_position`, updateData);
  },

  saveComponentVisuals(projectId, updateData) {
    return apiClient.post(`/project/${projectId}/component_visuals`, updateData);
  },

  getVisualConfig(projectId) {
    return apiClient.get(`/project/${projectId}/visual_config`);
  },

  saveVisualConfig(projectId, config) {
    return apiClient.post(`/project/${projectId}/visual_config`, config);
  },

  getSidebarConfig(projectId) {
    return apiClient.get(`/project/${projectId}/sidebar_config`);
  },

  saveSidebarConfig(projectId, config) {
    return apiClient.post(`/project/${projectId}/sidebar_config`, config);
  },

  getAnnotations(projectId) {
    return apiClient.get(`/project/${projectId}/annotations`);
  },

  saveAnnotations(projectId, notes) {
    return apiClient.post(`/project/${projectId}/annotations`, notes);
  },

  getAlerts(projectId) {
    return apiClient.get(`/project/${projectId}/alerts`);
  },

  saveAlerts(projectId, alerts) {
    return apiClient.post(`/project/${projectId}/alerts`, alerts);
  },

  // --- Component Assets (Source/Layouts) ---
  getComponentSource(projectId, componentId) {
    return apiClient.get(`/project/${projectId}/components/${componentId}/source`);
  },

  getLayout(projectId, componentId) {
    return apiClient.get(`/project/${projectId}/components/${componentId}/layout`);
  },

  saveLayout(projectId, componentId, layoutData) {
    return apiClient.post(`/project/${projectId}/components/${componentId}/layout`, layoutData);
  },

  uploadMedia(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/project/${projectId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadComponentModel(projectId, componentId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/project/${projectId}/components/${componentId}/model`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Export project as ZIP blob
  exportProject(projectId) {
    return apiClient.get('/project/export', {
      params: { project_id: projectId },
      responseType: 'blob' // Important for file download
    });
  },

  // Import project from ZIP file
  importProject(file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/project/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Create a demo project from server-side assets
  createDemo() {
    return apiClient.post('/project/demo');
  },

  // Fork/Clone a project
  forkProject(projectId) {
    return apiClient.post(`/project/${projectId}/fork`);
  }
};

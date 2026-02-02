import apiClient from './client';

export const libraryApi = {
  // Get list of library models
  getModels() {
    return apiClient.get('/library/models');
  },

  // Upload a new model
  uploadModel(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    // apiClient automatically handles the Authorization header via interceptor
    return apiClient.post('/library/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

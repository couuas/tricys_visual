import apiClient from './client';

export const configurationApi = {
  previewFoc(payload) {
    return apiClient.post('/foc/preview', payload);
  }
};

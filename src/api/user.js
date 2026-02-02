import apiClient from './client';

export const userApi = {
  // Get list of users
  listUsers(skip = 0, limit = 100) {
    return apiClient.get('/user/', { params: { skip, limit } });
  },

  // Get current user profile
  getCurrentUser() {
    return apiClient.get('/user/me');
  },

  // Get user by ID
  getUser(userId) {
    return apiClient.get(`/user/${userId}`);
  }
};

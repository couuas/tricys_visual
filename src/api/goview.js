import axios from 'axios';
import { triggerAuthExpired } from '../utils/authEvents';
import { resolveApiV2Base } from '../utils/runtimeUrls';

const goviewClient = axios.create({
  baseURL: resolveApiV2Base(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach token for GoView (header name: token)
// Also include Authorization for compatibility.
// Token is stored by tricys_visual auth flow.
goviewClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tricys_auth_token');
    if (token) {
      config.headers['token'] = token;
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

goviewClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && data.code === 886) {
      triggerAuthExpired('token overdue');
      return Promise.reject(new Error('token overdue'));
    }
    return data;
  },
  (error) => {
    console.error('GoView API Error:', error.response || error.message);
    return Promise.reject(error);
  }
);

export const goviewApi = {
  createProject(payload) {
    return goviewClient.post('/project/create', payload);
  },
  getProjectData(id) {
    return goviewClient.get('/project/getData', { params: { id } });
  },
  publishProject(payload) {
    return goviewClient.put('/project/publish', payload);
  },
  deleteProject(id) {
    return goviewClient.delete('/project/delete', { params: { id } });
  }
};

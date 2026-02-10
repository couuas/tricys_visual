import axios from 'axios';
import { triggerAuthExpired } from '../utils/authEvents';

const resolveGoviewBase = () => {
  const v2 = import.meta.env.VITE_API_V2_URL;
  if (v2) return v2;
  const v1 = import.meta.env.VITE_API_URL;
  if (v1) return v1.replace(/\/api\/v1\/?$/, '/api/v2/goview');
  return 'http://localhost:8000/api/v2/goview';
};

const goviewClient = axios.create({
  baseURL: resolveGoviewBase(),
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
  }
};

import { userApi } from '../../../api/user';
import { authApi } from '../../../api/auth';
import { currentUser, isAuthenticated, setCurrentUser, clearAuth } from './authState';

export function useAuth() {
  const initAuth = async () => {
    const token = localStorage.getItem('tricys_auth_token');
    if (token) {
      try {
        const user = await userApi.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          return true;
        }
      } catch (error) {
        console.warn('Auth restoration failed', error);
        clearAuth();
      }
    }
    return false;
  };

  const login = async (username, password) => {
    try {
      const res = await authApi.login(username, password);
      if (res.access_token) {
        localStorage.setItem('tricys_auth_token', res.access_token);
        const user = await userApi.getCurrentUser();
        setCurrentUser(user);
        return { success: true, user };
      }

      return { success: false, message: 'No access token received' };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Invalid credentials' };
    }
  };

  const register = async (userData) => {
    try {
      const res = await authApi.register(userData);

      if (res.status === 'success') {
        if (userData.username && userData.password) {
          return await login(userData.username, userData.password);
        }
        return { success: true, user: { username: userData.username } };
      }

      return { success: false, message: 'Unknown error' };
    } catch (error) {
      let message = 'Registration failed';
      if (error.response && error.response.data && error.response.data.detail) {
        message = error.response.data.detail;
      }
      return { success: false, message };
    }
  };

  const logout = () => {
    clearAuth();
  };

  return {
    currentUser,
    isAuthenticated,
    initAuth,
    login,
    register,
    logout
  };
}
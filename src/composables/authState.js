import { ref, computed } from 'vue';

const currentUser = ref(null);
const isAuthenticated = computed(() => !!currentUser.value);

const setCurrentUser = (user) => {
  currentUser.value = user || null;
};

const clearStoredAuth = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('tricys_')) {
      localStorage.removeItem(key);
    }
  });
};

const clearAuth = () => {
  setCurrentUser(null);
  clearStoredAuth();
};

export {
  currentUser,
  isAuthenticated,
  setCurrentUser,
  clearAuth
};

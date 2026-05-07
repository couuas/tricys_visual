import { $notify } from '../../utils/notification';
import { useAuth } from '../../shared/auth/composables/useAuth';

const PUBLIC_PAGES = ['user', 'home', 'help'];
const PROJECT_PAGES = ['config', 'analysis', 'monitor', 'component-detail', 'pages', 'goview', 'visualizer', 'model-editor'];

export function registerAuthExpiredHandler(router) {
  window.addEventListener('tricys-auth-expired', (event) => {
    const reason = event?.detail?.reason || 'expired';
    $notify({
      title: 'SESSION EXPIRED',
      message: reason === 'token overdue'
        ? 'Your session has expired. Please log in again.'
        : 'Authentication required. Please log in again.',
      type: 'warning'
    });

    if (router.currentRoute.value?.name !== 'user') {
      router.replace({ name: 'user' });
    }
  });
}

export function registerRouterGuards(router) {
  router.beforeEach(async (to, from, next) => {
    const { isAuthenticated, initAuth, currentUser } = useAuth();

    if (!isAuthenticated.value) {
      await initAuth();
    }

    const authRequired = !PUBLIC_PAGES.includes(to.name);

    if (authRequired && !isAuthenticated.value) {
      if (to.name !== 'user') {
        $notify({ title: 'AUTH REQUIRED', message: 'Please login to access the system.', type: 'info' });
      }
      next({ name: 'user' });
      return;
    }

    if (to.name === 'admin') {
      const isAdmin = currentUser.value && (currentUser.value.is_superuser === true || currentUser.value.is_superuser === 1);
      if (!isAdmin) {
        $notify({ title: 'ACCESS DENIED', message: 'Admin privileges required.', type: 'error' });
        next({ name: 'home' });
        return;
      }
    }

    if (PROJECT_PAGES.includes(to.name)) {
      if (!to.query.projectId) {
        const cached = localStorage.getItem('tricys_last_pid');
        if (cached) {
          next({ ...to, query: { ...to.query, projectId: cached } });
          return;
        }

        $notify({ title: 'NO PROJECT SELECTED', message: 'Please select a project to proceed.', type: 'warn' });
        next({ name: 'projects' });
        return;
      }
    }

    next();
  });
}
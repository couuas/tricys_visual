import { createRouter, createWebHistory } from 'vue-router';
// import HomeView from '../views/HomeView.vue'; // Lazy load everything to ensure useAuth works
import { $notify } from '../utils/notification';
// import VisView from '../views/VisView.vue'; // Renamed to ConfigView, using dynamic import
import ComponentDetailView from '../views/ComponentDetailView.vue';

import { useAuth } from '../composables/useAuth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Workbench Layout Wrapper
    {
      path: '/',
      component: () => import('../layouts/WorkbenchLayout.vue'),
      children: [
        {
          path: '', // Home as default child
          name: 'home',
          component: () => import('../views/UserView.vue')
        },
        {
          path: 'config',
          name: 'config',
          component: () => import('../views/ConfigView.vue'),
          props: { mode: 'normal' }
        },
        {
          path: 'monitor',
          name: 'monitor',
          component: () => import('../views/MonitorView.vue')
        },
        {
          path: 'analysis',
          name: 'analysis',
          component: () => import('../views/AgentView.vue')
        },
        {
          path: 'demo',
          name: 'demo',
          component: () => import('../views/ConfigView.vue'),
          props: { mode: 'demo' }
        },
        {
          path: 'user',
          name: 'user',
          component: () => import('../views/UserView.vue')
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('../views/ProjectsView.vue')
        },
        {
          path: 'help',
          name: 'help',
          component: () => import('../views/HelpView.vue')
        },
        {
          path: 'component/:id',
          name: 'component-detail',
          component: ComponentDetailView,
          props: true,
          meta: { requiresAuth: true }
        },

        {
          path: 'pages',
          name: 'pages',
          component: () => import('../views/ProjectPagesView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: 'goview',
          name: 'goview',
          component: () => import('../views/GoviewView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: 'visualizer',
          name: 'visualizer',
          component: () => import('../views/Hdf5VisualizerView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: 'model-editor',
          name: 'model-editor',
          component: () => import('../views/ModelEditorView.vue'),
          meta: { requiresAuth: true }
        }
      ]
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue')
    },
    // Legacy Redirects
    { path: '/vis', redirect: '/monitor' },
  ]
});

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

// Guard: Check Authentication
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, initAuth, currentUser } = useAuth();

  // Attempt to restore session if not authenticated
  if (!isAuthenticated.value) {
    await initAuth();
  }

  // Public pages
  const publicPages = ['user', 'home', 'help'];
  const authRequired = !publicPages.includes(to.name);

  if (authRequired && !isAuthenticated.value) {
    if (to.name !== 'user') $notify({ title: 'AUTH REQUIRED', message: 'Please login to access the system.', type: 'info' });
    next({ name: 'user' });
  } else {
    // Admin Guard
    console.log("[RouterGuard] Accessing:", to.name);
    console.log("[RouterGuard] Current User:", currentUser.value);
    if (to.name === 'admin') {
      // Support both true and 1 (SQLite)
      const isAdmin = currentUser.value && (currentUser.value.is_superuser === true || currentUser.value.is_superuser === 1);
      console.log("[RouterGuard] Diagnostic - Is Admin?", isAdmin, "Raw value:", currentUser.value?.is_superuser);
      if (!isAdmin) {
        $notify({ title: 'ACCESS DENIED', message: 'Admin privileges required.', type: 'error' });
        next({ name: 'home' });
        return;
      }
    }

    // Project Context Guard
    const projectPages = ['config', 'analysis', 'monitor', 'component-detail', 'pages', 'goview', 'visualizer', 'model-editor'];

    // Demo mode exception: 'config' route is used for demo but with separate name/path logic? 
    // Actually 'demo' route has name='demo'. 'config' route has name='config'. 
    // So excluding 'demo' by name is sufficient.

    if (projectPages.includes(to.name)) {
      if (!to.query.projectId) {
        // Check if we can rescue from localStorage (e.g. reload on page)
        const cached = localStorage.getItem('tricys_last_pid');
        if (cached) {
          // Redirect with correct query
          next({ ...to, query: { ...to.query, projectId: cached } });
        } else {
          // Strict block
          $notify({ title: 'NO PROJECT SELECTED', message: 'Please select a project to proceed.', type: 'warn' });
          next({ name: 'projects' });
        }
      } else {
        next();
      }
    } else {
      next();
    }
  }
});

export default router;
<template>
  <div class="app-sidebar">
    <!-- Top Actions (Home/Logo substitute if needed, but we have Header) -->
    <!-- We can put a 'Return to Home' button here explicitly -->
    <!-- Top Actions -->
    <div class="sidebar-group top">
      
      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'config' || currentRouteName === 'demo' }"
        @click="navigateTo('config')"
        title="Configuration"
      >
        <span class="icon">⚙</span>
        <span class="label-mini">CFG</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'monitor' }"
        @click="navigateTo('monitor')"
        title="Monitor"
      >
        <span class="icon">⚡</span>
        <span class="label-mini">MON</span>
      </div>





      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'visualizer' }"
        @click="navigateTo('visualizer')"
        title="HDF5 Visualizer"
      >
        <span class="icon">🧭</span>
        <span class="label-mini">VIS</span>
      </div>
    </div>

    

    <!-- Bottom Actions -->
    <div class="sidebar-group bottom">
      <div 
        v-if="currentUser?.is_superuser"
        class="sidebar-item admin-side-item"
        :class="{ active: currentRouteName === 'admin' }"
        @click="$router.push('/admin')"
        title="Admin Panel"
      >
        <span class="icon">🛡️</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'user' }"
        @click="$router.push('/user')"
        title="User Profile"
      >
        <span class="icon">👤</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'help' }"
        @click="$router.push('/help')"
        title="Help / Documentation"
      >
        <span class="icon">?</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { currentUser } = useAuth();
const currentRouteName = computed(() => route.name);

const navigateTo = (name) => {
  const pid = route.query.projectId || localStorage.getItem('tricys_last_pid');
  router.push({ name, query: { projectId: pid } });
};
</script>

<style scoped>
.app-sidebar {
  width: 60px;
  height: 100%;
  box-sizing: border-box;
  background: #0b0e14;
  border-right: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  z-index: 1000;
  flex-shrink: 0;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.sidebar-item {
  width: 44px;
  height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ccc;
}

.sidebar-item.active {
  background: rgba(0, 210, 255, 0.1);
  color: #00d2ff;
  border-left: 3px solid #00d2ff; /* Workbench style active indicator */
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.icon {
  font-size: 20px;
  line-height: 1;
}

.label-mini {
  font-size: 8px;
  margin-top: 3px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.admin-side-item { margin-top: 5px; border: 1px solid rgba(255, 0, 85, 0.2); }
.admin-side-item .icon { color: #ff0055; filter: drop-shadow(0 0 5px rgba(255, 0, 85, 0.5)); }
.admin-side-item:hover { background: rgba(255, 0, 85, 0.1); border-color: #ff0055; }

.divider {
  width: 30px;
  height: 1px;
  background: #30363d;
  margin: 5px 0;
}
</style>

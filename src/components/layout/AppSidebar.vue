<template>
  <div class="app-sidebar" :class="{ 'is-expanded': isExpanded }">
    <!-- Top Actions -->
    <div class="sidebar-group top">
      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'config' || currentRouteName === 'demo' }"
        @click="navigateTo('config')"
        title="Configuration"
      >
        <span class="icon">⚙</span>
        <span class="label-mini" v-show="!isExpanded">CFG</span>
        <span class="label-full" v-show="isExpanded">Configuration</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'monitor' }"
        @click="navigateTo('monitor')"
        title="Monitor"
      >
        <span class="icon">⚡</span>
        <span class="label-mini" v-show="!isExpanded">MON</span>
        <span class="label-full" v-show="isExpanded">Monitor</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'goview' }"
        @click="navigateTo('goview')"
        title="GoView"
      >
        <span class="icon">📊</span>
        <span class="label-mini" v-show="!isExpanded">GOV</span>
        <span class="label-full" v-show="isExpanded">GoView</span>
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
        <span class="label-full" v-show="isExpanded">Admin Panel</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'user' }"
        @click="$router.push('/user')"
        title="User Profile"
      >
        <span class="icon">👤</span>
        <span class="label-full" v-show="isExpanded">User Profile</span>
      </div>

      <div 
        class="sidebar-item" 
        :class="{ active: currentRouteName === 'help' }"
        @click="$router.push('/help')"
        title="Help / Documentation"
      >
        <span class="icon">?</span>
        <span class="label-full" v-show="isExpanded">Help</span>
      </div>

      <!-- Toggle Button -->
      <div class="sidebar-toggle" @click="toggleSidebar" :title="isExpanded ? 'Collapse' : 'Expand'">
        <svg v-if="isExpanded" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { currentUser } = useAuth();
const currentRouteName = computed(() => route.name);

const isExpanded = ref(false);
const toggleSidebar = () => {
  isExpanded.value = !isExpanded.value;
};

const navigateTo = (name) => {
  const pid = route.query.projectId || localStorage.getItem('tricys_last_pid');
  router.push({ name, query: { projectId: pid } });
};
</script>

<style scoped>
.app-sidebar {
  width: 68px;
  height: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(9, 13, 19, 0.97) 0%, rgba(5, 8, 12, 0.98) 100%);
  border-right: 1px solid var(--shell-border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0 12px;
  z-index: 1000;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset -1px 0 0 rgba(255,255,255,0.02), 14px 0 32px rgba(0,0,0,0.18);
  font-family: var(--shell-nav-font);
}

.app-sidebar.is-expanded {
  width: 220px;
  align-items: stretch;
  padding: 14px 10px 12px;
}

.sidebar-toggle {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 42px;
  width: 100%;
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 10px;
}

.sidebar-toggle:hover {
  color: var(--shell-accent);
  background: rgba(255,255,255,0.04);
}

.app-sidebar.is-expanded .sidebar-toggle {
  justify-content: flex-end;
  padding-right: 12px;
}

.sidebar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.app-sidebar.is-expanded .sidebar-group {
  align-items: stretch;
}

.sidebar-item {
  width: 48px;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--shell-text-muted);
  cursor: pointer;
  border-radius: 14px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
  box-sizing: border-box;
}

.app-sidebar.is-expanded .sidebar-item {
  width: 100%;
  flex-direction: row;
  justify-content: flex-start;
  min-height: 48px;
  padding: 0 14px;
}

.sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--shell-text);
  border-color: rgba(159, 177, 195, 0.12);
  transform: translateX(1px);
}

.sidebar-item.active {
  background: linear-gradient(90deg, rgba(0, 210, 255, 0.18) 0%, rgba(0, 210, 255, 0.08) 100%);
  color: var(--shell-accent);
  border-color: rgba(0, 210, 255, 0.26);
  box-shadow: inset 2px 0 0 var(--shell-accent), 0 0 18px rgba(0, 210, 255, 0.08);
}

.icon {
  font-size: 18px;
  line-height: 1;
  display: flex;
  justify-content: center;
}

.app-sidebar.is-expanded .icon {
  width: 22px;
  margin-right: 12px;
  flex-shrink: 0;
}

.label-mini {
  font-size: var(--shell-font-xs);
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.label-full {
  font-size: var(--shell-font-md);
  font-weight: 600;
  letter-spacing: 0.4px;
  white-space: nowrap;
}

.admin-side-item { margin-top: 8px; border-color: rgba(255, 0, 85, 0.2); }
.admin-side-item .icon { color: #ff0055; filter: drop-shadow(0 0 5px rgba(255, 0, 85, 0.5)); }
.admin-side-item:hover { background: rgba(255, 0, 85, 0.1); border-color: #ff0055; }
.app-sidebar.is-expanded .admin-side-item .label-full { color: #ff0055; }

.divider {
  width: 30px;
  height: 1px;
  background: #30363d;
  margin: 5px 0;
}

@media (max-width: 900px) {
  .app-sidebar {
    width: 62px;
  }

  .app-sidebar.is-expanded {
    width: 200px;
  }

  .sidebar-item {
    width: 44px;
    min-height: 48px;
  }
}
</style>

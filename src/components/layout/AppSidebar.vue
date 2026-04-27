<template>
  <div class="app-sidebar" :class="{ 'is-expanded': isExpanded }">
    <div class="sidebar-main">
      <div class="sidebar-group top">
        <template v-if="!isExpanded">
          <template v-for="(group, groupIndex) in navGroups" :key="group.key">
            <div
              v-for="item in group.items"
              :key="item.name"
              class="sidebar-item"
              :class="{ active: isItemActive(item) }"
              @click="navigateTo(item.name)"
              :title="item.label"
            >
              <span class="icon">{{ item.icon }}</span>
              <span class="label-mini">{{ item.shortLabel }}</span>
            </div>

            <div
              v-if="groupIndex < navGroups.length - 1"
              class="compact-divider"
              :title="`${group.label} / ${navGroups[groupIndex + 1].label}`"
            ></div>
          </template>
        </template>

        <template v-else>
          <div
            v-for="group in navGroups"
            :key="group.key"
            class="sidebar-section"
            :class="{ open: openGroups[group.key], 'has-active-child': isGroupCollapsedActive(group) }"
          >
            <button
              class="sidebar-section-toggle"
              :class="{ active: isGroupCollapsedActive(group) }"
              type="button"
              @click="toggleGroup(group.key)"
              :aria-expanded="String(openGroups[group.key])"
            >
              <span class="sidebar-section-title-wrap">
                <span class="sidebar-section-icon">{{ group.icon }}</span>
                <span class="sidebar-section-title">{{ group.label }}</span>
              </span>
              <span class="sidebar-section-caret">{{ openGroups[group.key] ? '▾' : '▸' }}</span>
            </button>

            <div v-show="openGroups[group.key]" class="sidebar-section-body">
              <div
                v-for="item in group.items"
                :key="item.name"
                class="sidebar-item"
                :class="{ active: isItemActive(item) }"
                @click="navigateTo(item.name)"
                :title="item.label"
              >
                <span class="icon">{{ item.icon }}</span>
                <span class="label-full">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="sidebar-group bottom">
        <div
          v-if="currentUser?.is_superuser"
          class="sidebar-item admin-side-item"
          :class="{ active: currentRouteName === 'admin' }"
          @click="router.push('/admin')"
          title="Admin Panel"
        >
          <span class="icon">🛡️</span>
          <span class="label-full" v-show="isExpanded">Admin Panel</span>
        </div>

        <div
          class="sidebar-item"
          :class="{ active: currentRouteName === 'projects' }"
          @click="router.push('/projects')"
          title="Projects"
        >
          <span class="icon">🗂</span>
          <span class="label-full" v-show="isExpanded">Projects</span>
        </div>

        <div
          class="sidebar-item"
          :class="{ active: currentRouteName === 'user' || currentRouteName === 'home' }"
          @click="router.push({ name: 'user' })"
          title="User Profile"
        >
          <span class="icon">👤</span>
          <span class="label-full" v-show="isExpanded">User Profile</span>
        </div>

        <div
          class="sidebar-item"
          :class="{ active: currentRouteName === 'help' }"
          @click="router.push('/help')"
          title="Help / Documentation"
        >
          <span class="icon">?</span>
          <span class="label-full" v-show="isExpanded">Help</span>
        </div>

        <div class="sidebar-toggle" @click="toggleSidebar" :title="isExpanded ? 'Collapse' : 'Expand'">
          <svg v-if="isExpanded" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { currentUser } = useAuth();
const currentRouteName = computed(() => route.name);

const isExpanded = ref(true);
const navGroups = [
  {
    key: 'workspace',
    label: 'WorkSpace',
    icon: '◫',
    items: [
      { name: 'config', label: 'Simulation', shortLabel: 'SIM', icon: '⚙', activeNames: ['config', 'demo'] },
      { name: 'analysis', label: 'Agent', shortLabel: 'AGT', icon: '🧠', activeNames: ['analysis'] },
      { name: 'monitor', label: 'Monitor', shortLabel: 'MON', icon: '⚡', activeNames: ['monitor'] },
    ],
  },
  {
    key: 'dataspace',
    label: 'Exhibition',
    icon: '◧',
    items: [
      { name: 'pages', label: 'Project Pages', shortLabel: 'PGS', icon: '📊', activeNames: ['pages', 'goview'] },
    ],
  },
];

const openGroups = reactive({
  workspace: true,
  dataspace: true,
});

const toggleSidebar = () => {
  isExpanded.value = !isExpanded.value;
};

const isItemActive = (item) => item.activeNames.includes(currentRouteName.value);

const isGroupActive = (group) => group.items.some((item) => isItemActive(item));

const isGroupCollapsedActive = (group) => !openGroups[group.key] && isGroupActive(group);

const toggleGroup = (groupKey) => {
  openGroups[groupKey] = !openGroups[groupKey];
};

watch(
  currentRouteName,
  (name) => {
    const activeGroup = navGroups.find((group) => group.items.some((item) => item.activeNames.includes(name)));
    if (activeGroup) {
      openGroups[activeGroup.key] = true;
    }
  },
  { immediate: true },
);

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
  overflow: hidden;
}

.app-sidebar.is-expanded {
  width: 220px;
  align-items: stretch;
  padding: 14px 10px 12px;
}

.sidebar-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
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
  box-sizing: border-box;
}

.sidebar-group.top {
  flex: 1;
  justify-content: flex-start;
  min-height: 0;
}

.sidebar-group.bottom {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.app-sidebar.is-expanded .sidebar-group {
  align-items: stretch;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 6px;
  box-sizing: border-box;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.sidebar-section.open {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.06);
}

.sidebar-section.has-active-child {
  background: linear-gradient(180deg, rgba(0, 210, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
  border-color: rgba(0, 210, 255, 0.16);
  box-shadow: 0 0 0 1px rgba(0, 210, 255, 0.06) inset;
}

.sidebar-section-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: var(--shell-text-secondary);
  cursor: pointer;
  border-radius: 12px;
  font: inherit;
  transition: background 0.2s ease, color 0.2s ease;
}

.sidebar-section-toggle:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--shell-text);
}

.sidebar-section-toggle.active {
  background: linear-gradient(90deg, rgba(0, 210, 255, 0.16) 0%, rgba(0, 210, 255, 0.06) 100%);
  color: var(--shell-accent);
  box-shadow: inset 2px 0 0 var(--shell-accent);
}

.sidebar-section-toggle.active .sidebar-section-icon,
.sidebar-section-toggle.active .sidebar-section-caret {
  color: var(--shell-accent);
}

.sidebar-section-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.sidebar-section-icon {
  width: 18px;
  color: var(--shell-accent);
  text-align: center;
  flex-shrink: 0;
}

.sidebar-section-title {
  font-size: var(--shell-font-sm);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sidebar-section-caret {
  color: var(--shell-text-muted);
  font-size: 14px;
  line-height: 1;
}

.sidebar-section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-divider {
  width: 28px;
  height: 1px;
  margin: 2px auto;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(125, 145, 164, 0.5) 50%, rgba(255, 255, 255, 0) 100%);
  opacity: 0.9;
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

.admin-side-item {
  margin-top: 8px;
  border-color: rgba(255, 0, 85, 0.2);
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

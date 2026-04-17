<template>
  <header class="top-bar">
    <!-- Left: Brand -->
    <div class="brand-area">
      <div class="logo-type">
        TRICYS<span class="highlight">VIS</span>
        <span class="platform-name">Visualization of TRitium Integrated CYcle Simulation</span>
      </div>
    </div>

     <!-- Right: Global Status (User/Project) -->
    <div class="status-area">
       <div class="status-group user-group">
         <div class="icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </div>
         <div class="info-content">
            <span class="label">USER</span>
            <span class="value" :class="{ muted: isUserMissing }">{{ userLabel }}</span>
         </div>
       </div>

       <div class="divider" v-if="currentUser"></div>

       <div class="status-group project-group" v-if="currentUser">
         <div class="icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2-2z"></path></svg>
         </div>
         <div class="info-content">
            <span class="label">PROJECT</span>
            <span class="value highlight-text" :class="{ muted: isProjectMissing }">{{ projectLabel }}</span>
         </div>
       </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { useSimulation } from '../../composables/useSimulation';

const { currentUser } = useAuth();
const { currentProject } = useSimulation();
const route = useRoute();

const isUserMissing = computed(() => !currentUser.value);
const isProjectMissing = computed(() => !currentProject.value);

const userLabel = computed(() => {
  if (!currentUser.value) return 'SIGNED OUT';
  return currentUser.value.username || 'UNKNOWN';
});

const projectLabel = computed(() => {
  if (!currentProject.value) return 'NO PROJECT';
  return currentProject.value.name || 'UNTITLED';
});
</script>

<style scoped>
.top-bar {
  height: 64px; flex-shrink: 0;
  background: linear-gradient(180deg, rgba(11, 16, 23, 0.98) 0%, rgba(8, 12, 18, 0.94) 100%);
  border-bottom: 1px solid var(--shell-border-strong);
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 10px 0 10px;
  z-index: 500;
  font-family: var(--shell-nav-font);
  box-sizing: border-box;
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
}

.brand-area { display: flex; align-items: center; gap: 14px; min-width: 0; }
.logo-mark { 
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  font-size: 20px; 
  color: var(--shell-accent); 
  text-shadow: 0 0 12px rgba(0, 210, 255, 0.45);
  background: radial-gradient(circle at 30% 30%, rgba(0, 210, 255, 0.18), rgba(0, 210, 255, 0.04));
  border: 1px solid rgba(0, 210, 255, 0.2);
  border-radius: 10px;
  animation: blink 3s infinite; 
}
.logo-type {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--shell-text);
  letter-spacing: 1.4px;
}
.highlight { color: var(--shell-accent); } 
.platform-name { 
  font-size: var(--shell-font-xs);
  color: var(--shell-text-muted);
  border-left: 1px solid rgba(159, 177, 195, 0.2);
  padding-left: 12px;
  margin-left: 2px;
  letter-spacing: 0.9px;
  font-family: var(--shell-ui-font);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-area { display: flex; align-items: center; gap: 0; height: 100%; }

.status-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 9px;
  min-height: 34px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
}

.user-group {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(159, 177, 195, 0.14);
}

.project-group {
  background: rgba(0, 210, 255, 0.08);
  border-color: rgba(0, 210, 255, 0.26);
  box-shadow: inset 0 0 0 1px rgba(0, 210, 255, 0.04), 0 0 10px rgba(0, 210, 255, 0.06);
}

.status-group:hover {
  transform: translateY(-1px);
}

.user-group:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.project-group:hover {
  background: rgba(0, 210, 255, 0.15);
  border-color: rgba(0, 210, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 210, 255, 0.2);
}

.icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.user-group .icon-box { color: var(--shell-text-secondary); }
.project-group .icon-box { 
  color: var(--shell-accent); 
  filter: drop-shadow(0 0 2px rgba(0, 210, 255, 0.5));
}

.info-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.05;
}

.label {
  font-size: 10px;
  color: var(--shell-text-secondary);
  letter-spacing: 0.9px;
  font-weight: 700;
  text-transform: uppercase;
}

.value {
  font-size: 13px;
  color: var(--shell-text);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.value.muted { color: var(--shell-text-muted); font-weight: 500; }
.value.highlight-text { color: var(--shell-text); text-shadow: 0 0 5px rgba(0, 210, 255, 0.35); }

.divider {
  width: 1px;
  height: 24px;
  background: rgba(159, 177, 195, 0.16);
  margin: 0 8px;
}

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

@media (max-width: 900px) {
  .top-bar { padding: 0 18px; }
  .platform-name { display: none; }
  .logo-type { font-size: 16px; }
  .value { font-size: 12px; }
  .status-group { padding: 5px 10px; min-height: 32px; }
}

@media (max-width: 700px) {
  .top-bar {
    flex-wrap: wrap;
    height: auto;
    min-height: 64px;
    gap: 10px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .brand-area,
  .status-area {
    width: 100%;
  }

  .status-area {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px;
  }

  .divider {
    display: none;
  }
}
</style>

<template>
  <header class="top-bar">
    <!-- Left: Brand -->
    <div class="brand-area">
      <div class="logo-mark">⚛</div>
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
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

.top-bar {
  height: 60px; flex-shrink: 0;
  background: rgba(5, 7, 10, 0.95);
  border-bottom: 1px solid #1a202c;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 24px;
  z-index: 500;
  font-family: 'Share Tech Mono', monospace;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
}

.brand-area { display: flex; align-items: center; gap: 12px; }
.logo-mark { 
  font-size: 20px; 
  color: #00d2ff; 
  text-shadow: 0 0 12px rgba(0, 210, 255, 0.6); 
  animation: blink 3s infinite; 
}
.logo-type { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 1.5px; }
.highlight { color: #00d2ff; } 
.platform-name { 
  font-size: 11px; color: #64748b; 
  border-left: 1px solid #334155; padding-left: 12px; margin-left: 12px; 
  letter-spacing: 0.5px; 
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-transform: uppercase;
}

.status-area { display: flex; align-items: center; gap: 0; height: 100%; }

.status-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  border-radius: 4px;
  height: 38px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
}

.user-group {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.project-group {
  background: rgba(0, 210, 255, 0.1);
  border-color: rgba(0, 210, 255, 0.3);
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.1);
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
}

.user-group .icon-box { color: #94a3b8; }
.project-group .icon-box { 
  color: #00d2ff; 
  filter: drop-shadow(0 0 2px rgba(0, 210, 255, 0.5));
}

.info-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.1;
}

.label {
  font-size: 10px;
  color: #94a3b8;
  letter-spacing: 1px;
  font-weight: 700;
  text-transform: uppercase;
}

.value {
  font-size: 14px;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.value.muted { color: #64748b; font-weight: 500; }
.value.highlight-text { color: #fff; text-shadow: 0 0 5px rgba(0, 210, 255, 0.5); }

.divider {
  width: 1px;
  height: 24px;
  background: #1e293b;
  margin: 0 8px;
}

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

@media (max-width: 900px) {
  .platform-name { display: none; }
}
</style>

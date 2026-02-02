<template>
  <header class="top-bar">
    <!-- Left: Brand -->
    <div class="brand-area">
      <div class="logo-mark">☢</div>
      <div class="logo-type">
        TRICYS<span class="highlight">VIS</span>
        <span class="platform-name">Visualization of Tritium Fuel Cycle Simulation</span>
      </div>
    </div>

    <!-- Right: Global Status (Time & User) -->
    <div class="status-area">
       <div class="status-item timer">
          {{ currentTime }} UTC
       </div>
       <div class="separator"></div>
       <div class="status-item user" v-if="currentUser">
          OFFICER: <span :class="{ 'role-flag': currentUser.is_superuser }">{{ currentUser.username }}</span>
       </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useAuth } from '../composables/useAuth';

const { currentUser } = useAuth();
const currentTime = ref('');
let timer = null;

const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toISOString().replace('T', ' ').substring(0, 19);
};

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

.top-bar {
  height: 60px; flex-shrink: 0;
  background: rgba(0, 10, 20, 0.95);
  border-bottom: 1px solid #004455;
  box-shadow: 0 5px 20px rgba(0, 255, 255, 0.05);
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 30px;
  z-index: 500;
  font-family: 'Share Tech Mono', monospace;
  box-sizing: border-box;
}

.brand-area { display: flex; align-items: center; gap: 15px; }
.logo-mark { font-size: 24px; color: #00ffff; text-shadow: 0 0 10px #00ffff; animation: blink 2s infinite; }
.logo-type { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 2px; }
.highlight { color: #00ffff; } 
.platform-name { 
  font-size: 12px; color: #0088aa; 
  border-left: 2px solid #004455; padding-left: 15px; margin-left: 15px; 
  letter-spacing: 1px; 
}

.status-area { display: flex; align-items: center; gap: 20px; font-size: 12px; color: #0088aa; }
.separator { width: 1px; height: 15px; background: #004455; }
.timer { color: #00ffff; }
.user { color: #fff; font-weight: bold; }

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 0, 85, 0.4); } 50% { box-shadow: 0 0 15px rgba(255, 0, 85, 0.8); } }

.role-flag { background: #ff0055; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 2px; margin-right: 10px; font-weight: bold; }
.admin-link-btn { background: #ff0055; border: none; color: #fff; padding: 8px 15px; font-weight: bold; font-family: 'Share Tech Mono', monospace; cursor: pointer; border-radius: 4px; font-size: 11px; letter-spacing: 1px; transition: 0.2s; animation: glow 2s infinite; }
.admin-link-btn:hover { background: #fff; color: #ff0055; transform: scale(1.05); }

@media (max-width: 900px) {
  .platform-name { display: none; }
}
</style>

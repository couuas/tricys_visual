<template>
  <NotificationSystem /> <router-view></router-view>
</template>
<script setup>
import NotificationSystem from './shared/ui/components/NotificationSystem.vue';
import { watch } from 'vue';
import { useAuth } from './shared/auth/composables/useAuth';
import { useWorkspaceSession } from './shared/session/composables/useWorkspaceSession';

const { currentUser } = useAuth();
const { resetSession } = useWorkspaceSession();

// Clear simulation session on logout
watch(currentUser, (newVal) => {
  if (!newVal) {
    resetSession();
  }
});
</script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

:root {
  --tricys-shell-bg: radial-gradient(circle at top, rgba(16, 28, 42, 0.92) 0%, #05070a 45%, #020304 100%);
  --tricys-panel-bg: rgba(8, 12, 18, 0.92);
  --tricys-panel-bg-strong: rgba(10, 14, 20, 0.98);
  --tricys-panel-border: rgba(120, 144, 156, 0.18);
  --tricys-panel-border-strong: rgba(0, 210, 255, 0.24);
  --tricys-text-primary: #e5eef7;
  --tricys-text-secondary: #9fb1c3;
  --tricys-text-muted: #6c7b8c;
  --tricys-accent: #00d2ff;
  --tricys-accent-soft: rgba(0, 210, 255, 0.12);
  --tricys-nav-font: 'Share Tech Mono', monospace;
  --tricys-ui-font: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  --tricys-font-size-xs: 11px;
  --tricys-font-size-sm: 12px;
  --tricys-font-size-md: 14px;
  --tricys-font-size-lg: 16px;
}

html, body, #app {
  height: 100%;
}

body {
  margin: 0;
  background: #000;
  color: var(--tricys-text-primary);
  font-family: var(--tricys-ui-font);
  overflow: hidden;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
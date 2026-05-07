<template>
  <div class="workbench-layout">
    <AppHeader />
    <div class="layout-body">
      <AppSidebar />
      <div class="content-area">
        <div class="router-view-container">
          <router-view v-slot="{ Component }">
            <transition name="fade-page" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppSidebar from '../navigation/AppSidebar.vue';
import AppHeader from '../navigation/AppHeader.vue';
</script>

<style scoped>
.workbench-layout {
  --shell-bg: var(--tricys-shell-bg);
  --shell-panel-bg: var(--tricys-panel-bg);
  --shell-panel-bg-strong: var(--tricys-panel-bg-strong);
  --shell-border: var(--tricys-panel-border);
  --shell-border-strong: var(--tricys-panel-border-strong);
  --shell-text: var(--tricys-text-primary);
  --shell-text-secondary: var(--tricys-text-secondary);
  --shell-text-muted: var(--tricys-text-muted);
  --shell-accent: var(--tricys-accent);
  --shell-accent-soft: var(--tricys-accent-soft);
  --shell-nav-font: var(--tricys-nav-font);
  --shell-ui-font: var(--tricys-ui-font);
  --shell-font-xs: var(--tricys-font-size-xs);
  --shell-font-sm: var(--tricys-font-size-sm);
  --shell-font-md: var(--tricys-font-size-md);
  --shell-font-lg: var(--tricys-font-size-lg);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--shell-bg);
}

.layout-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.content-area {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0) 12%);
}

.router-view-container {
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.router-view-container :deep(> *) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.router-view-container :deep(> * > *) {
  min-height: 0;
}

.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.2s ease;
}

.fade-page-enter-from,
.fade-page-leave-to {
  opacity: 0;
}
</style>
<template>
  <NotificationSystem /> <router-view></router-view>
</template>
<script setup>
import NotificationSystem from './components/common/NotificationSystem.vue';
import { watch } from 'vue';
import { useAuth } from './composables/useAuth';
import { useSimulation } from './composables/useSimulation';

const { currentUser } = useAuth();
const { resetSession } = useSimulation();

// Clear simulation session on logout
watch(currentUser, (newVal) => {
  if (!newVal) {
    resetSession();
  }
});
</script>
<style>
body { margin: 0; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; }
</style>
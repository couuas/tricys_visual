<template>
  <NotificationSystem /> <router-view></router-view>
</template>
<script setup>
import NotificationSystem from './components/NotificationSystem.vue'; // [NEW] Import
</script>
<style>
body { margin: 0; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; }
</style>
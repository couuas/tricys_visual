<template>
  <div class="help-view">
    <div class="empty-state">
      <div class="icon">📚</div>
      <h2>Help Documentation</h2>
      
    </div>
  </div>
</template>

<script setup>
// Placeholder view
</script>

<style scoped>
.help-view { 
  width: 100%; 
  height: 100%; 
  background: #05070a; 
  color: #fff; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
}

.empty-state {
  text-align: center;
  color: #8b949e;
}

.icon {
  font-size: 48px;
  margin-bottom: 20px;
}

h2 {
  font-size: 24px;
  color: #fff;
  margin-bottom: 10px;
}

p {
  font-size: 16px;
}
</style>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')" @dblclick.stop>
    <AnalysisConfigPanel
      :model-metadata="modelMetadata"
      :show-close="true"
      @close="emit('close')"
      @analysis-started="emit('analysis-started', $event)"
    />
  </div>
</template>

<script setup>
import AnalysisConfigPanel from './AnalysisConfigPanel.vue';

defineProps({
  visible: Boolean,
  modelMetadata: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close', 'analysis-started']);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 9999 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
</style>
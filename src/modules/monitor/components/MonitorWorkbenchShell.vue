<template>
  <section class="monitor-workbench-shell">
    <div class="monitor-workbench-main">
      <slot name="main" />
    </div>

    <template v-if="rightVisible">
      <div
        class="monitor-workbench-resizer"
        :class="{ active: resizeState.active }"
        @mousedown="startResize"
      >
        <div class="monitor-workbench-handle"></div>
      </div>

      <aside class="monitor-workbench-right" :style="rightStyle">
        <slot name="right" />
      </aside>
    </template>
  </section>
</template>

<script setup>
import { computed, onUnmounted, reactive, watch } from 'vue';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const props = defineProps({
  rightVisible: { type: Boolean, default: false },
  rightWidth: { type: Number, default: 360 },
  minRightWidth: { type: Number, default: 300 },
  maxRightWidth: { type: Number, default: 520 }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const rightWidthState = useSessionLayoutValue(
  'tricys:layout:monitor:rightWidth',
  props.rightWidth,
  (value) => clamp(value, props.minRightWidth, props.maxRightWidth)
);
const resizeState = reactive({
  active: false,
  startX: 0,
  startWidth: props.rightWidth
});

const rightStyle = computed(() => ({
  width: `${rightWidthState.value}px`,
  flexBasis: `${rightWidthState.value}px`
}));

const startResize = (event) => {
  resizeState.active = true;
  resizeState.startX = event.clientX;
  resizeState.startWidth = rightWidthState.value;
  document.body.classList.add('monitor-workbench-resizing');
  window.addEventListener('mousemove', handleResize);
  window.addEventListener('mouseup', stopResize);
};

const handleResize = (event) => {
  if (!resizeState.active) return;
  const delta = resizeState.startX - event.clientX;
  rightWidthState.value = clamp(
    resizeState.startWidth + delta,
    props.minRightWidth,
    props.maxRightWidth
  );
  window.dispatchEvent(new Event('resize'));
};

const stopResize = () => {
  if (!resizeState.active) return;
  resizeState.active = false;
  document.body.classList.remove('monitor-workbench-resizing');
  window.removeEventListener('mousemove', handleResize);
  window.removeEventListener('mouseup', stopResize);
};

watch(
  () => props.rightWidth,
  (width) => {
    rightWidthState.value = clamp(width, props.minRightWidth, props.maxRightWidth);
  }
);

onUnmounted(stopResize);
</script>

<style scoped>
.monitor-workbench-shell {
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #05070a;
}

.monitor-workbench-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.monitor-workbench-right {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background: #090c12;
}

.monitor-workbench-resizer {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #05070a;
  border-left: 1px solid rgba(255, 255, 255, 0.04);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.monitor-workbench-resizer:hover,
.monitor-workbench-resizer.active {
  background: rgba(0, 210, 255, 0.08);
  border-color: rgba(0, 210, 255, 0.2);
}

.monitor-workbench-handle {
  width: 2px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

:global(.monitor-workbench-resizing) {
  cursor: col-resize;
  user-select: none;
}

@media (max-width: 1180px) {
  .monitor-workbench-shell {
    flex-direction: column;
  }

  .monitor-workbench-resizer {
    display: none;
  }

  .monitor-workbench-right {
    width: 100% !important;
    flex-basis: 360px !important;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
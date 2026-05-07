<template>
  <section class="projects-workbench-shell">
    <aside class="projects-workbench-left" :style="leftStyle">
      <slot name="left" />
    </aside>

    <div
      class="projects-workbench-resizer"
      :class="{ active: resizeState.active }"
      @mousedown="startResize"
    >
      <div class="projects-workbench-handle"></div>
    </div>

    <main class="projects-workbench-main">
      <slot name="main" />
    </main>

    <div
      v-if="rightVisible"
      class="projects-workbench-resizer right"
      :class="{ active: resizeState.active && resizeState.edge === 'right' }"
      @mousedown="startResize($event, 'right')"
    >
      <div class="projects-workbench-handle"></div>
    </div>

    <aside v-if="rightVisible" class="projects-workbench-right" :style="rightStyle">
      <slot name="right" />
    </aside>
  </section>
</template>

<script setup>
import { computed, onUnmounted, reactive, watch } from 'vue';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const props = defineProps({
  leftWidth: { type: Number, default: 380 },
  minLeftWidth: { type: Number, default: 300 },
  maxLeftWidth: { type: Number, default: 560 },
  rightVisible: { type: Boolean, default: true },
  rightWidth: { type: Number, default: 340 },
  minRightWidth: { type: Number, default: 280 },
  maxRightWidth: { type: Number, default: 460 }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const leftWidthState = useSessionLayoutValue(
  'tricys:layout:projects:leftWidth',
  props.leftWidth,
  (value) => clamp(value, props.minLeftWidth, props.maxLeftWidth)
);
const rightWidthState = useSessionLayoutValue(
  'tricys:layout:projects:rightWidth',
  props.rightWidth,
  (value) => clamp(value, props.minRightWidth, props.maxRightWidth)
);
const resizeState = reactive({
  active: false,
  edge: 'left',
  startX: 0,
  startWidth: props.leftWidth
});

const leftStyle = computed(() => ({
  width: `${leftWidthState.value}px`,
  flexBasis: `${leftWidthState.value}px`
}));

const rightStyle = computed(() => ({
  width: `${rightWidthState.value}px`,
  flexBasis: `${rightWidthState.value}px`
}));

const startResize = (event, edge = 'left') => {
  resizeState.active = true;
  resizeState.edge = edge;
  resizeState.startX = event.clientX;
  resizeState.startWidth = edge === 'left' ? leftWidthState.value : rightWidthState.value;
  document.body.classList.add('projects-workbench-resizing');
  window.addEventListener('mousemove', handleResize);
  window.addEventListener('mouseup', stopResize);
};

const handleResize = (event) => {
  if (!resizeState.active) return;
  if (resizeState.edge === 'left') {
    const delta = event.clientX - resizeState.startX;
    leftWidthState.value = clamp(
      resizeState.startWidth + delta,
      props.minLeftWidth,
      props.maxLeftWidth
    );
  } else {
    const delta = resizeState.startX - event.clientX;
    rightWidthState.value = clamp(
      resizeState.startWidth + delta,
      props.minRightWidth,
      props.maxRightWidth
    );
  }
  window.dispatchEvent(new Event('resize'));
};

const stopResize = () => {
  if (!resizeState.active) return;
  resizeState.active = false;
  document.body.classList.remove('projects-workbench-resizing');
  window.removeEventListener('mousemove', handleResize);
  window.removeEventListener('mouseup', stopResize);
};

watch(
  () => props.leftWidth,
  (width) => {
    leftWidthState.value = clamp(width, props.minLeftWidth, props.maxLeftWidth);
  }
);

watch(
  () => props.rightWidth,
  (width) => {
    rightWidthState.value = clamp(width, props.minRightWidth, props.maxRightWidth);
  }
);

onUnmounted(stopResize);
</script>

<style scoped>
.projects-workbench-shell {
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.projects-workbench-left,
.projects-workbench-main,
.projects-workbench-right {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.projects-workbench-left {
  flex: 0 0 auto;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.2), transparent);
}

.projects-workbench-main {
  flex: 1 1 auto;
  background: #0b0e14;
}

.projects-workbench-right {
  flex: 0 0 auto;
  background: #090c12;
}

.projects-workbench-resizer {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d1117;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.projects-workbench-resizer:hover,
.projects-workbench-resizer.active {
  background: rgba(0, 210, 255, 0.08);
  border-color: rgba(0, 210, 255, 0.2);
}

.projects-workbench-handle {
  width: 2px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

:global(.projects-workbench-resizing) {
  cursor: col-resize;
  user-select: none;
}

@media (max-width: 1180px) {
  .projects-workbench-shell {
    flex-direction: column;
    overflow-y: auto;
  }

  .projects-workbench-left {
    width: 100% !important;
    flex-basis: auto !important;
    flex-shrink: 0;
  }

  .projects-workbench-right {
    width: 100% !important;
    flex-basis: auto !important;
    flex-shrink: 0;
  }

  .projects-workbench-resizer {
    display: none;
  }
}
</style>
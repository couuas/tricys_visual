<template>
  <section class="account-workbench-shell">
    <main class="account-workbench-main">
      <slot name="main" />
    </main>

    <div
      class="account-workbench-resizer"
      :class="{ active: resizeState.active }"
      @mousedown="startResize"
    >
      <div class="account-workbench-handle"></div>
    </div>

    <aside class="account-workbench-right" :style="rightStyle">
      <slot name="right" />
    </aside>
  </section>
</template>

<script setup>
import { computed, onUnmounted, reactive, watch } from 'vue';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const props = defineProps({
  rightWidth: { type: Number, default: 390 },
  minRightWidth: { type: Number, default: 320 },
  maxRightWidth: { type: Number, default: 520 }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const rightWidthState = useSessionLayoutValue(
  'tricys:layout:account:rightWidth',
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
  document.body.classList.add('account-workbench-resizing');
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
  document.body.classList.remove('account-workbench-resizing');
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
.account-workbench-shell {
  width: 100%;
  height: 100%;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #243041;
  border-radius: 18px;
  background: rgba(9, 13, 19, 0.88);
}

.account-workbench-main,
.account-workbench-right {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.account-workbench-main {
  flex: 1 1 auto;
}

.account-workbench-right {
  flex: 0 0 auto;
  background: rgba(5, 7, 10, 0.28);
}

.account-workbench-resizer {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 7, 10, 0.75);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.account-workbench-resizer:hover,
.account-workbench-resizer.active {
  background: rgba(0, 210, 255, 0.08);
  border-color: rgba(0, 210, 255, 0.2);
}

.account-workbench-handle {
  width: 2px;
  height: 42px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

:global(.account-workbench-resizing) {
  cursor: col-resize;
  user-select: none;
}

@media (max-width: 900px) {
  .account-workbench-shell {
    flex-direction: column;
    overflow-y: auto;
  }

  .account-workbench-resizer {
    display: none;
  }

  .account-workbench-right {
    width: 100% !important;
    flex-basis: auto !important;
    flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
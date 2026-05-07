<template>
  <div class="simulation-workbench" :class="{ resizing: resizeState.active }">
    <section class="simulation-workbench-main">
      <div class="simulation-workbench-center">
        <slot name="main" />
      </div>

      <template v-if="rightVisible">
        <div
          class="simulation-resizer simulation-resizer-right"
          :class="{ disabled: rightCollapsed }"
          @mousedown="startResize('right', $event)"
        ></div>

        <aside class="simulation-workbench-right" :class="{ collapsed: rightCollapsed }" :style="rightStyle">
          <button
            type="button"
            class="workbench-toggle right-toggle"
            :title="rightCollapsed ? 'Expand right panel' : 'Collapse right panel'"
            @click="toggleRight"
          >
            {{ rightCollapsed ? '‹' : '›' }}
          </button>
          <slot name="right" />
        </aside>
      </template>
    </section>

    <template v-if="$slots.bottom">
      <div
        class="simulation-resizer simulation-resizer-bottom"
        :class="{ compact: !bottomExpanded }"
        @mousedown="startResize('bottom', $event)"
      ></div>

      <section class="simulation-workbench-bottom" :class="{ compact: !bottomExpanded }" :style="bottomStyle">
        <slot name="bottom" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const COLLAPSED_RIGHT_WIDTH = 36;

const props = defineProps({
  rightVisible: { type: Boolean, default: false },
  rightWidth: { type: Number, default: 320 },
  minRightWidth: { type: Number, default: 260 },
  maxRightWidth: { type: Number, default: 620 },
  bottomExpanded: { type: Boolean, default: false },
  bottomHeight: { type: Number, default: 300 },
  compactBottomHeight: { type: Number, default: 76 },
  minBottomHeight: { type: Number, default: 160 },
  maxBottomHeight: { type: Number, default: 520 }
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const rightWidthState = useSessionLayoutValue(
  'tricys:layout:simulation:rightWidth',
  props.rightWidth,
  (value) => clamp(value, props.minRightWidth, props.maxRightWidth)
);
const bottomHeightState = useSessionLayoutValue(
  'tricys:layout:simulation:bottomHeight',
  props.bottomHeight,
  (value) => clamp(value, props.minBottomHeight, props.maxBottomHeight)
);
const rightCollapsed = ref(false);
const resizeState = reactive({
  active: false,
  side: '',
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0
});

watch(() => props.rightWidth, (width) => {
  rightWidthState.value = width;
});

watch(() => props.bottomHeight, (height) => {
  bottomHeightState.value = height;
});

watch(() => props.rightVisible, (visible) => {
  if (!visible) {
    rightCollapsed.value = false;
  }
});

const activeRightWidth = computed(() => rightCollapsed.value ? COLLAPSED_RIGHT_WIDTH : rightWidthState.value);
const activeBottomHeight = computed(() => props.bottomExpanded ? bottomHeightState.value : props.compactBottomHeight);

const rightStyle = computed(() => ({
  width: `${activeRightWidth.value}px`,
  flexBasis: `${activeRightWidth.value}px`
}));

const bottomStyle = computed(() => ({
  height: `${activeBottomHeight.value}px`,
  flexBasis: `${activeBottomHeight.value}px`
}));

const toggleRight = () => {
  rightCollapsed.value = !rightCollapsed.value;
};

const stopResize = () => {
  if (!resizeState.active) return;
  resizeState.active = false;
  resizeState.side = '';
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', handleResize);
  window.removeEventListener('mouseup', stopResize);
};

const handleResize = (event) => {
  if (!resizeState.active) return;

  if (resizeState.side === 'right') {
    const nextWidth = resizeState.startWidth + resizeState.startX - event.clientX;
    rightWidthState.value = clamp(nextWidth, props.minRightWidth, props.maxRightWidth);
    return;
  }

  const nextHeight = resizeState.startHeight + resizeState.startY - event.clientY;
  bottomHeightState.value = clamp(nextHeight, props.minBottomHeight, props.maxBottomHeight);
};

const startResize = (side, event) => {
  if (side === 'right' && rightCollapsed.value) return;

  event.preventDefault();
  resizeState.active = true;
  resizeState.side = side;
  resizeState.startX = event.clientX;
  resizeState.startY = event.clientY;
  resizeState.startWidth = rightWidthState.value;
  resizeState.startHeight = bottomHeightState.value;
  document.body.style.cursor = side === 'bottom' ? 'row-resize' : 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', handleResize);
  window.addEventListener('mouseup', stopResize);
};

onBeforeUnmount(() => {
  stopResize();
});
</script>

<style scoped>
.simulation-workbench {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 10px;
  box-sizing: border-box;
  background: #05070a;
}

.simulation-workbench.resizing,
.simulation-workbench.resizing * {
  user-select: none;
}

.simulation-workbench-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.simulation-workbench-center {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
}

.simulation-workbench-right {
  position: relative;
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #2a3645;
  background: rgba(7, 12, 18, 0.96);
  transition: width 0.18s ease, flex-basis 0.18s ease;
}

.simulation-workbench-right.collapsed :deep(> :not(.workbench-toggle)) {
  opacity: 0;
  pointer-events: none;
}

.workbench-toggle {
  position: absolute;
  top: 10px;
  z-index: 20;
  width: 24px;
  height: 28px;
  border: 1px solid rgba(120, 145, 170, 0.22);
  border-radius: 6px;
  background: rgba(8, 13, 18, 0.92);
  color: #9db1c6;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.workbench-toggle:hover {
  border-color: rgba(0, 210, 255, 0.35);
  color: #8ae9ff;
}

.right-toggle {
  left: 6px;
}

.simulation-workbench-bottom {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid #2a3645;
  background: rgba(10, 16, 22, 0.96);
  transition: height 0.18s ease, flex-basis 0.18s ease;
}

.simulation-workbench-bottom.compact {
  min-height: 64px;
}

.simulation-resizer {
  flex: 0 0 auto;
  position: relative;
  z-index: 15;
  background: rgba(8, 12, 18, 0.94);
}

.simulation-resizer-right {
  width: 6px;
  cursor: col-resize;
}

.simulation-resizer-right::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 42px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(116, 139, 160, 0.48);
}

.simulation-resizer-bottom {
  height: 6px;
  cursor: row-resize;
}

.simulation-resizer-bottom::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 2px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(116, 139, 160, 0.48);
}

.simulation-resizer:hover,
.simulation-resizer:active {
  background: rgba(0, 210, 255, 0.12);
}

.simulation-resizer:hover::before,
.simulation-resizer:active::before {
  background: #00d2ff;
}

.simulation-resizer.disabled {
  cursor: default;
}

.simulation-resizer.disabled::before {
  opacity: 0.24;
}
</style>
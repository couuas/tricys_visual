<template>
    <div class="workbench-shell" :class="{ embedded: embedded }">
        <header v-if="showHeader" class="workbench-header">
            <div class="workbench-title-wrap">
                <div class="workbench-title">{{ title }}</div>
                <div v-if="subtitle" class="workbench-subtitle">{{ subtitle }}</div>
            </div>
            <div class="workbench-actions">
                <slot name="actions" />
            </div>
        </header>

        <div class="workbench-body" :class="{ resizing: resizeState.active, 'resizing-bottom': resizeState.active && resizeState.side === 'bottom' }">
            <aside class="workbench-sidebar workbench-sidebar-left" :class="{ collapsed: leftCollapsed }" :style="leftStyle">
                <button
                    type="button"
                    class="sidebar-toggle sidebar-toggle-left"
                    :title="leftCollapsed ? 'Expand left panel' : 'Collapse left panel'"
                    @click="toggleLeft"
                >
                    {{ leftCollapsed ? '›' : '‹' }}
                </button>
                <slot name="left" />
            </aside>

            <div
                class="workbench-resizer workbench-resizer-left"
                :class="{ disabled: leftCollapsed }"
                @mousedown="startResize('left', $event)"
            ></div>

            <section class="workbench-center">
                <div class="workbench-main-stage">
                    <slot name="main" />
                </div>
                <div
                    v-if="$slots.bottom"
                    class="workbench-bottom-resizer"
                    @mousedown="startResize('bottom', $event)"
                ></div>
                <div v-if="$slots.bottom" class="workbench-bottom-panel" :style="bottomStyle">
                    <slot name="bottom" />
                </div>
            </section>

            <div
                class="workbench-resizer workbench-resizer-right"
                :class="{ disabled: rightCollapsed }"
                @mousedown="startResize('right', $event)"
            ></div>

            <aside class="workbench-sidebar workbench-sidebar-right" :class="{ collapsed: rightCollapsed }" :style="rightStyle">
                <button
                    type="button"
                    class="sidebar-toggle sidebar-toggle-right"
                    :title="rightCollapsed ? 'Expand right panel' : 'Collapse right panel'"
                    @click="toggleRight"
                >
                    {{ rightCollapsed ? '‹' : '›' }}
                </button>
                <slot name="right" />
            </aside>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useSessionLayoutValue } from '../../../shared/ui/composables/useSessionLayoutValue';

const COLLAPSED_WIDTH = 36;

const props = defineProps({
    title: { type: String, default: 'Workbench' },
    subtitle: { type: String, default: '' },
    leftWidth: { type: Number, default: 280 },
    rightWidth: { type: Number, default: 320 },
    minLeftWidth: { type: Number, default: 220 },
    maxLeftWidth: { type: Number, default: 560 },
    minRightWidth: { type: Number, default: 260 },
    maxRightWidth: { type: Number, default: 640 },
    bottomHeight: { type: Number, default: 92 },
    minBottomHeight: { type: Number, default: 96 },
    maxBottomHeight: { type: Number, default: 360 },
    embedded: { type: Boolean, default: false },
    showHeader: { type: Boolean, default: true }
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const leftWidthState = useSessionLayoutValue(
    'tricys:layout:studio:leftWidth',
    props.leftWidth,
    (value) => clamp(value, props.minLeftWidth, props.maxLeftWidth)
);
const rightWidthState = useSessionLayoutValue(
    'tricys:layout:studio:rightWidth',
    props.rightWidth,
    (value) => clamp(value, props.minRightWidth, props.maxRightWidth)
);
const bottomHeightState = useSessionLayoutValue(
    'tricys:layout:studio:bottomHeight',
    props.bottomHeight,
    (value) => clamp(value, props.minBottomHeight, props.maxBottomHeight)
);
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const resizeState = reactive({
    active: false,
    side: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0
});

watch(() => props.leftWidth, (width) => {
    leftWidthState.value = width;
});

watch(() => props.rightWidth, (width) => {
    rightWidthState.value = width;
});

watch(() => props.bottomHeight, (height) => {
    bottomHeightState.value = height;
});

const leftStyle = computed(() => ({
    width: `${leftCollapsed.value ? COLLAPSED_WIDTH : leftWidthState.value}px`,
    flexBasis: `${leftCollapsed.value ? COLLAPSED_WIDTH : leftWidthState.value}px`
}));

const rightStyle = computed(() => ({
    width: `${rightCollapsed.value ? COLLAPSED_WIDTH : rightWidthState.value}px`,
    flexBasis: `${rightCollapsed.value ? COLLAPSED_WIDTH : rightWidthState.value}px`
}));

const bottomStyle = computed(() => ({
    height: `${bottomHeightState.value}px`,
    minHeight: `${props.minBottomHeight}px`,
    flexBasis: `${bottomHeightState.value}px`
}));

const toggleLeft = () => {
    leftCollapsed.value = !leftCollapsed.value;
};

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

    if (resizeState.side === 'left') {
        const nextWidth = resizeState.startWidth + event.clientX - resizeState.startX;
        leftWidthState.value = clamp(nextWidth, props.minLeftWidth, props.maxLeftWidth);
        return;
    }

    if (resizeState.side === 'right') {
        const nextWidth = resizeState.startWidth + resizeState.startX - event.clientX;
        rightWidthState.value = clamp(nextWidth, props.minRightWidth, props.maxRightWidth);
        return;
    }

    const nextHeight = resizeState.startHeight + resizeState.startY - event.clientY;
    bottomHeightState.value = clamp(nextHeight, props.minBottomHeight, props.maxBottomHeight);
};

const startResize = (side, event) => {
    if ((side === 'left' && leftCollapsed.value) || (side === 'right' && rightCollapsed.value)) {
        return;
    }

    event.preventDefault();
    resizeState.active = true;
    resizeState.side = side;
    resizeState.startX = event.clientX;
    resizeState.startY = event.clientY;
    resizeState.startWidth = side === 'left' ? leftWidthState.value : rightWidthState.value;
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
.workbench-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0;
    min-height: 0;
    background: #0f151b;
    color: #e0e5eb;
    overflow: hidden;
}

.workbench-shell.embedded {
    width: 100%;
    height: 100%;
    min-height: 0;
    border-radius: 4px;
}

.workbench-header {
    height: 48px;
    background: #1a222c;
    border-bottom: 1px solid #2a3645;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    gap: 16px;
}

.workbench-title-wrap {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.workbench-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
}

.workbench-subtitle {
    font-size: 12px;
    color: #ffaa00;
}

.workbench-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.workbench-body {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    overflow: hidden;
}

.workbench-body.resizing,
.workbench-body.resizing * {
    cursor: col-resize !important;
    user-select: none;
}

.workbench-body.resizing-bottom,
.workbench-body.resizing-bottom * {
    cursor: row-resize !important;
}

.workbench-sidebar {
    position: relative;
    flex: 0 0 auto;
    background: #141b24;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    transition: width 0.18s ease, flex-basis 0.18s ease;
}

.workbench-sidebar-left {
    border-right: 1px solid #2a3645;
}

.workbench-sidebar-right {
    border-left: 1px solid #2a3645;
}

.workbench-sidebar.collapsed :deep(> :not(.sidebar-toggle)) {
    opacity: 0;
    pointer-events: none;
}

.sidebar-toggle {
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

.sidebar-toggle:hover {
    border-color: rgba(0, 210, 255, 0.35);
    color: #8ae9ff;
}

.sidebar-toggle-left {
    right: 6px;
}

.sidebar-toggle-right {
    left: 6px;
}

.workbench-resizer {
    flex: 0 0 var(--workbench-resizer-width, 6px);
    width: var(--workbench-resizer-width, 6px);
    position: relative;
    z-index: 15;
    cursor: col-resize;
    background: rgba(8, 12, 18, 0.94);
}

.workbench-resizer::before {
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

.workbench-resizer:hover,
.workbench-resizer:active {
    background: rgba(0, 210, 255, 0.12);
}

.workbench-resizer:hover::before,
.workbench-resizer:active::before {
    background: #00d2ff;
}

.workbench-resizer.disabled {
    cursor: default;
}

.workbench-resizer.disabled::before {
    height: 18px;
    opacity: 0.24;
}

.workbench-center {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.workbench-main-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.workbench-bottom-resizer {
    flex: 0 0 6px;
    height: 6px;
    position: relative;
    z-index: 15;
    cursor: row-resize;
    background: rgba(8, 12, 18, 0.94);
}

.workbench-bottom-resizer::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 54px;
    height: 2px;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(116, 139, 160, 0.48);
}

.workbench-bottom-resizer:hover,
.workbench-bottom-resizer:active {
    background: rgba(0, 210, 255, 0.12);
}

.workbench-bottom-resizer:hover::before,
.workbench-bottom-resizer:active::before {
    background: #00d2ff;
}

.workbench-bottom-panel {
    border-top: 1px solid #2a3645;
    background: rgba(10, 16, 22, 0.96);
    backdrop-filter: blur(10px);
    flex: 0 0 auto;
    min-width: 0;
    overflow: hidden;
}
</style>
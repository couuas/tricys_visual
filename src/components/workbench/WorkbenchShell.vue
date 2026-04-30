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

        <div class="workbench-body">
            <aside class="workbench-sidebar workbench-sidebar-left" :style="leftStyle">
                <slot name="left" />
            </aside>

            <section class="workbench-center">
                <div class="workbench-main-stage">
                    <slot name="main" />
                </div>
                <div v-if="$slots.bottom" class="workbench-bottom-panel" :style="bottomStyle">
                    <slot name="bottom" />
                </div>
            </section>

            <aside class="workbench-sidebar workbench-sidebar-right" :style="rightStyle">
                <slot name="right" />
            </aside>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    title: { type: String, default: 'Workbench' },
    subtitle: { type: String, default: '' },
    leftWidth: { type: Number, default: 280 },
    rightWidth: { type: Number, default: 320 },
    bottomHeight: { type: Number, default: 92 },
    embedded: { type: Boolean, default: false },
    showHeader: { type: Boolean, default: true }
});

const leftStyle = computed(() => ({ width: `${props.leftWidth}px` }));
const rightStyle = computed(() => ({ width: `${props.rightWidth}px` }));
const bottomStyle = computed(() => ({ minHeight: `${props.bottomHeight}px` }));
</script>

<style scoped>
.workbench-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
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
    display: flex;
    overflow: hidden;
}

.workbench-sidebar {
    background: #141b24;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.workbench-sidebar-left {
    border-right: 1px solid #2a3645;
}

.workbench-sidebar-right {
    border-left: 1px solid #2a3645;
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

.workbench-bottom-panel {
    border-top: 1px solid #2a3645;
    background: rgba(10, 16, 22, 0.96);
    backdrop-filter: blur(10px);
}

@media (max-width: 1200px) {
    .workbench-sidebar-left {
        width: 240px !important;
    }

    .workbench-sidebar-right {
        width: 280px !important;
    }
}
</style>
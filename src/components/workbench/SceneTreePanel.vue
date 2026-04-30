<template>
    <div class="scene-tree-panel">
        <div class="panel-title">Scene Tree</div>

        <div class="tree-summary">
            <span>{{ normalizedComponents.length }} nodes</span>
            <span>{{ groupEntries.length }} groups</span>
        </div>

        <div class="tree-body">
            <div class="tree-root">
                <div class="tree-node tree-node-root active">
                    <div class="tree-node-line">
                        <span class="tree-caret tree-caret-static">▾</span>
                        <span class="tree-node-icon tree-node-icon-root" aria-hidden="true">
                            <svg viewBox="0 0 24 24" class="model-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
                                <path d="M12 3v8m0 10v-10m7-4-7 4-7-4" />
                            </svg>
                        </span>
                        <span class="tree-node-label">TRICYS MODEL</span>
                        <span class="tree-node-meta">{{ rootNodeCount }} nodes</span>
                    </div>
                </div>

                <div class="tree-branch">
                    <div v-for="group in groupEntries" :key="group.id" class="tree-group">
                        <div class="tree-node tree-node-group" :class="{ active: isGroupActive(group.id) }">
                            <button
                                type="button"
                                class="tree-node-line tree-node-button"
                                @click="$emit('toggleGroup', group.id)"
                                @dblclick="$emit('selectItem', group.id)"
                            >
                                <span class="tree-caret">{{ expandedGroupId === group.id ? '▾' : '▸' }}</span>
                                <span class="tree-node-icon tree-node-icon-group" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" class="model-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M9 4.5 14 7v7l-5 2.5L4 14V7l5-2.5Z" />
                                        <path d="M15 9.5 20 12v7l-5 2.5L10 19v-7l5-2.5Z" />
                                    </svg>
                                </span>
                                <span class="tree-node-label">{{ group.name || group.id }}</span>
                                <span class="tree-node-meta">{{ group.children.length }}</span>
                            </button>
                        </div>

                        <div v-if="expandedGroupId === group.id" class="tree-branch tree-branch-children">
                            <button
                                v-for="child in group.children"
                                :key="child.id"
                                type="button"
                                class="tree-node tree-node-leaf tree-node-button"
                                :class="{ active: isItemActive(child.id) }"
                                @click="$emit('selectItem', child.id)"
                                @dblclick="$emit('focusItem', child.id)"
                            >
                                <span class="tree-node-line">
                                    <span class="tree-caret tree-caret-static"></span>
                                    <span class="tree-node-icon tree-node-icon-leaf" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" class="model-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
                                            <path d="M12 3v8m0 10v-10m7-4-7 4-7-4" />
                                        </svg>
                                    </span>
                                    <span class="tree-node-label">{{ child.label }}</span>
                                    <span class="tree-node-meta">{{ child.type }}</span>
                                </span>
                            </button>
                        </div>
                    </div>

                    <button
                        v-for="item in ungroupedComponents"
                        :key="item.id"
                        type="button"
                        class="tree-node tree-node-leaf tree-node-button"
                        :class="{ active: isItemActive(item.id) }"
                        @click="$emit('selectItem', item.id)"
                        @dblclick="$emit('focusItem', item.id)"
                    >
                        <span class="tree-node-line">
                            <span class="tree-caret tree-caret-static"></span>
                            <span class="tree-node-icon tree-node-icon-leaf" aria-hidden="true">
                                <svg viewBox="0 0 24 24" class="model-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
                                    <path d="M12 3v8m0 10v-10m7-4-7 4-7-4" />
                                </svg>
                            </span>
                            <span class="tree-node-label">{{ item.label }}</span>
                            <span class="tree-node-meta">{{ item.type }}</span>
                        </span>
                    </button>
                </div>
            </div>

            <div v-if="normalizedComponents.length === 0" class="empty-state">No scene components</div>
        </div>

    </div>
</template>

<script setup>
import { computed } from 'vue';
import { normalizeComponentId, normalizeSelectionId, resolveGroupKey } from '../../utils/groupIds';

defineEmits(['selectItem', 'focusItem', 'toggleGroup']);

const props = defineProps({
    components: { type: [Array, Object], default: () => [] },
    componentGroups: { type: Object, default: () => ({}) },
    selectedId: { type: String, default: null },
    expandedGroupId: { type: String, default: null },
    multiSelectedIds: { type: [Object, Array], default: () => new Set() }
});

const getComponentRawId = (component) => component?.id || component?.name || component?.label || '';

const multiSelectedIdSet = computed(() => {
    if (props.multiSelectedIds instanceof Set) {
        return new Set(Array.from(props.multiSelectedIds).map(id => normalizeSelectionId(id, props.componentGroups || {})).filter(Boolean));
    }
    if (Array.isArray(props.multiSelectedIds)) {
        return new Set(props.multiSelectedIds.map(id => normalizeSelectionId(id, props.componentGroups || {})).filter(Boolean));
    }
    return new Set();
});

const normalizedComponents = computed(() => {
    const source = Array.isArray(props.components)
        ? props.components
        : props.components && typeof props.components === 'object'
            ? Object.values(props.components)
            : [];

    return source
        .filter(component => component && typeof component === 'object')
        .sort((left, right) => String(left?.label || left?.name || left?.id || '').localeCompare(String(right?.label || right?.name || right?.id || '')));
});

const componentLookup = computed(() => {
    const lookup = new Map();
    normalizedComponents.value.forEach(component => {
        lookup.set(normalizeComponentId(getComponentRawId(component)), component);
    });
    return lookup;
});

const formatComponentEntry = (component) => ({
    id: normalizeComponentId(getComponentRawId(component)),
    label: component?.label || component?.name || component?.id || 'Unnamed Component',
    type: component?.type || component?.category || 'component'
});

const createFallbackComponentEntry = (componentId) => ({
    id: normalizeComponentId(componentId),
    label: String(componentId || 'Unnamed Component'),
    type: 'component'
});

const groupEntries = computed(() => {
    return Object.values(props.componentGroups || {}).map(group => {
        const children = Array.isArray(group?.children)
            ? group.children
                .map(childId => {
                    const component = componentLookup.value.get(normalizeComponentId(childId));
                    return component ? formatComponentEntry(component) : createFallbackComponentEntry(childId);
                })
            : [];

        return {
            id: resolveGroupKey(group?.id || group?.name || '', props.componentGroups || {}),
            name: group?.name || group?.id || 'Unnamed Group',
            children
        };
    });
});

const groupedComponentIds = computed(() => {
    const ids = new Set();
    groupEntries.value.forEach(group => {
        group.children.forEach(child => ids.add(normalizeComponentId(child.id)));
    });
    return ids;
});

const ungroupedComponents = computed(() => {
    return normalizedComponents.value
    .filter(component => !groupedComponentIds.value.has(normalizeComponentId(getComponentRawId(component))))
        .map(formatComponentEntry);
});

const rootNodeCount = computed(() => normalizedComponents.value.length);

const isItemActive = (id) => {
    const safeId = normalizeComponentId(id);
    const selectedId = normalizeSelectionId(props.selectedId, props.componentGroups || {});
    return selectedId === safeId || multiSelectedIdSet.value.has(safeId);
};

const isGroupActive = (id) => {
    const resolvedGroupId = resolveGroupKey(id, props.componentGroups || {});
    const selectedId = normalizeSelectionId(props.selectedId, props.componentGroups || {});
    return selectedId === resolvedGroupId || multiSelectedIdSet.value.has(resolvedGroupId) || props.expandedGroupId === resolvedGroupId;
};
</script>

<style scoped>
.scene-tree-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.panel-title {
    padding: 12px 15px;
    font-size: 12px;
    font-weight: bold;
    color: #8da2bb;
    text-transform: uppercase;
    border-bottom: 1px solid #1f2a36;
}

.tree-summary {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #1f2a36;
    font-size: 11px;
    color: #6d8299;
}

.tree-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.tree-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tree-root,
.tree-branch {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tree-branch {
    position: relative;
    padding-left: 18px;
}

.tree-branch::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 6px;
    left: 7px;
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
}

.tree-branch-children {
    margin-left: 14px;
}

.tree-node {
    width: 100%;
    min-width: 0;
}

.tree-node-button {
    width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    color: inherit;
    cursor: pointer;
}

.tree-node-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    text-align: left;
    background: transparent;
    border-radius: 6px;
    padding: 4px 8px;
    color: #d9e4ef;
    transition: border-color 0.2s, background 0.2s;
}

.tree-node-line:hover {
    background: rgba(0, 210, 255, 0.08);
}

.tree-node.active > .tree-node-line,
.tree-node-button.active .tree-node-line,
.tree-node-button.active {
    background: rgba(0, 210, 255, 0.12);
}

.tree-caret {
    width: 12px;
    text-align: center;
    color: #8ae9ff;
    flex: 0 0 12px;
}

.tree-caret-static {
    color: transparent;
}

.tree-node-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    color: #85d7ff;
}

.tree-node-icon-group {
    color: #4fd2c2;
}

.tree-node-icon-root {
    color: #f3c969;
}

.model-icon {
    width: 16px;
    height: 16px;
}

.tree-node-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tree-node-meta {
    flex: 0 0 auto;
    font-size: 10px;
    text-transform: uppercase;
    color: #6d8299;
}

.tree-node-root > .tree-node-line {
    font-weight: 700;
    letter-spacing: 0.4px;
}

.tree-node-group > .tree-node-line,
.tree-node-group .tree-node-line {
    font-weight: 600;
}

.empty-state {
    padding: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #6d8299;
    font-size: 11px;
    text-align: center;
}
</style>
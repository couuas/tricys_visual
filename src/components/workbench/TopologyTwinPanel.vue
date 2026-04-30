<template>
    <div class="topology-shell">
        <div class="topology-canvas">
            <div class="topology-header">
                <div>
                    <div class="topology-title">2D Twin</div>
                    <div class="topology-subtitle">Selection, grouping, and layout stay synced with the 3D scene.</div>
                </div>
                <div class="topology-controls">
                    <button class="control-btn" type="button" :class="{ active: routeMode === 'orthogonal' }" @click="emit('update:routeMode', 'orthogonal')">Auto Route</button>
                    <button class="control-btn" type="button" :class="{ active: routeMode === 'bezier' }" @click="emit('update:routeMode', 'bezier')">Bezier</button>
                    <button class="control-btn" type="button" :class="{ active: snapToGrid }" @click="emit('update:snapToGrid', !snapToGrid)">Snap {{ snapToGrid ? 'On' : 'Off' }}</button>
                    <button class="control-btn fit-btn" type="button" @click="fitAllToCanvas">Fit</button>
                </div>
            </div>

            <svg
                v-if="layoutNodes.length > 0"
                ref="svgRef"
                viewBox="0 0 1000 760"
                class="topology-svg"
                :class="{ panning: panState.active }"
                role="img"
                aria-label="Topology twin projection"
                @pointerdown="startCanvasPan"
                @wheel.prevent="handleWheel"
                @dblclick="fitAllToCanvas"
            >
                <defs>
                    <pattern id="workbench-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(130, 146, 166, 0.08)" stroke-width="1" />
                    </pattern>
                    <linearGradient id="workbench-flow" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="rgba(39, 184, 255, 0.18)" />
                        <stop offset="100%" stop-color="rgba(39, 184, 255, 0.72)" />
                    </linearGradient>
                </defs>

                <g :transform="viewportTransform">
                    <rect width="1000" height="760" rx="28" fill="url(#workbench-grid)" />

                    <g class="group-layer">
                        <g
                            v-for="group in groupEntries"
                            :key="group.id"
                            class="group-frame-group"
                            :class="{ selected: isGroupActive(group.id), expanded: expandedGroupId === group.id, dragging: groupDragState.groupId === group.id }"
                            @pointerdown="startGroupDrag(group, $event)"
                            @click.stop="handleGroupClick(group, $event)"
                            @dblclick.stop="handleGroupDoubleClick(group)"
                        >
                            <rect
                                :x="group.bounds.x"
                                :y="group.bounds.y"
                                :width="group.bounds.width"
                                :height="group.bounds.height"
                                :rx="22"
                                class="group-frame"
                            />
                            <rect
                                :x="group.bounds.x + 14"
                                :y="group.bounds.y + 12"
                                :width="Math.max(108, group.name.length * 8 + 42)"
                                height="24"
                                rx="12"
                                class="group-pill"
                            />
                            <text :x="group.bounds.x + 28" :y="group.bounds.y + 28" class="group-label">{{ group.name }}</text>
                            <text :x="group.bounds.x + group.bounds.width - 22" :y="group.bounds.y + 28" text-anchor="end" class="group-count">{{ group.children.length }}</text>
                        </g>
                    </g>

                    <g class="link-layer">
                        <g v-for="connection in normalizedConnections" :key="connection.id" class="connection-group">
                            <path
                                :d="buildConnectionPath(connection)"
                                class="connection-line"
                                :class="{ highlighted: isConnectionHighlighted(connection), selected: connection.id === selectedConnectionId }"
                                :style="getConnectionVisualStyle(connection)"
                                @click.stop="handleConnectionClick(connection.id)"
                            />
                            <polygon
                                :points="connectionArrowPoints"
                                class="connection-arrow"
                                :class="{ highlighted: isConnectionHighlighted(connection), selected: connection.id === selectedConnectionId }"
                                :style="getConnectionArrowStyle(connection)"
                                :transform="buildConnectionArrowTransform(connection)"
                            />
                        </g>
                    </g>

                    <g class="node-layer">
                        <g
                            v-for="node in layoutNodes"
                            :key="node.id"
                            class="node-group"
                            :class="[node.category, { selected: isNodeActive(node), dragging: dragState.nodeId === node.id }]"
                            @pointerdown="startNodeDrag(node, $event)"
                            @click="handleNodeClick(node, $event)"
                        >
                            <rect
                                :x="node.x - 68"
                                :y="node.y - 34"
                                width="136"
                                height="68"
                                rx="18"
                                class="node-card"
                            />
                            <rect
                                :x="node.x - 56"
                                :y="node.y - 22"
                                width="112"
                                height="12"
                                rx="6"
                                class="node-cap"
                            />
                            <circle
                                v-if="hasNodeAnnotation(node)"
                                :cx="node.x + 48"
                                :cy="node.y - 18"
                                r="5"
                                class="node-note-dot"
                            />
                            <text :x="node.x" :y="node.y + 6" text-anchor="middle" class="node-label">{{ node.displayLabel }}</text>
                            <text :x="node.x" :y="node.y + 24" text-anchor="middle" class="node-type">{{ node.typeLabel }}</text>
                        </g>
                    </g>
                </g>
            </svg>

            <div v-else class="topology-empty">No topology nodes available.</div>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { normalizeComponentId, normalizeSelectionId, resolveGroupKey } from '../../utils/groupIds';
import {
    TWIN_CANVAS_HEIGHT,
    TWIN_CANVAS_WIDTH,
    TWIN_NODE_HALF_HEIGHT,
    TWIN_NODE_HALF_WIDTH,
    buildTopologyTwinConnectionArrowTransform,
    buildTopologyTwinConnectionPath,
    projectTopologyTwinConnections,
    projectTopologyTwinNodes,
    projectTwinCanvasToWorld
} from '../../platform/adapters/topology/topologyTwin';

const FIT_PADDING = 84;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.9;
const DRAG_BOUNDARY_PADDING = 260;
const SNAP_SIZE = 20;

const props = defineProps({
    structureData: {
        type: Object,
        default: () => ({ components: [], connections: [] })
    },
    selectedComponentId: {
        type: String,
        default: null
    },
    selectedConnectionId: {
        type: String,
        default: null
    },
    componentGroups: {
        type: Object,
        default: () => ({})
    },
    multiSelectedIds: {
        type: [Object, Array],
        default: () => new Set()
    },
    expandedGroupId: {
        type: String,
        default: null
    },
    annotations: {
        type: Object,
        default: () => ({})
    },
    getConnectionStyle: {
        type: Function,
        default: () => ({})
    },
    routeMode: {
        type: String,
        default: 'orthogonal'
    },
    snapToGrid: {
        type: Boolean,
        default: true
    },
    isReadOnly: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'select-component',
    'select-connection',
    'move-component',
    'move-components',
    'toggle-multi-select',
    'toggle-group',
    'update:routeMode',
    'update:snapToGrid'
]);

const svgRef = ref(null);
const nodeOverrides = reactive({});
const viewport = reactive({ scale: 1, x: 0, y: 0 });
const dragState = reactive({ nodeId: null, offsetX: 0, offsetY: 0, moved: false });
const groupDragState = reactive({ groupId: null, startPointerX: 0, startPointerY: 0, moved: false, startPositions: [] });
const panState = reactive({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
const suppressClickNodeId = ref(null);
const suppressClickGroupId = ref(null);
const normalizedSelectedComponentId = computed(() => normalizeSelectionId(props.selectedComponentId, props.componentGroups || {}));

const rawComponents = computed(() => Array.isArray(props.structureData?.components) ? props.structureData.components : []);
const rawConnections = computed(() => Array.isArray(props.structureData?.connections) ? props.structureData.connections : []);
const annotationMap = computed(() => props.annotations || {});
const multiSelectedIdSet = computed(() => {
    if (props.multiSelectedIds instanceof Set) {
        return new Set(Array.from(props.multiSelectedIds).map(id => normalizeSelectionId(id, props.componentGroups || {})).filter(Boolean));
    }
    if (Array.isArray(props.multiSelectedIds)) {
        return new Set(props.multiSelectedIds.map(id => normalizeSelectionId(id, props.componentGroups || {})).filter(Boolean));
    }
    return new Set();
});

const baseLayoutNodes = computed(() => projectTopologyTwinNodes(rawComponents.value));
const layoutNodes = computed(() => baseLayoutNodes.value.map((node) => {
    const override = nodeOverrides[node.id];
    return override ? { ...node, x: override.x, y: override.y } : node;
}));

const nodeMap = computed(() => {
    const map = new Map();
    layoutNodes.value.forEach((node) => map.set(node.id, node));
    return map;
});

const groupEntries = computed(() => {
    return Object.values(props.componentGroups || {}).map((group) => {
        const resolvedId = resolveGroupKey(group?.id || group?.name || '', props.componentGroups || {});
        const children = Array.isArray(group?.children)
            ? group.children
                .map(childId => nodeMap.value.get(normalizeComponentId(childId)))
                .filter(Boolean)
            : [];

        if (!children.length) {
            return null;
        }

        const paddingX = 34;
        const paddingY = 42;
        const minX = Math.min(...children.map(node => node.x - TWIN_NODE_HALF_WIDTH)) - paddingX;
        const maxX = Math.max(...children.map(node => node.x + TWIN_NODE_HALF_WIDTH)) + paddingX;
        const minY = Math.min(...children.map(node => node.y - TWIN_NODE_HALF_HEIGHT)) - paddingY;
        const maxY = Math.max(...children.map(node => node.y + TWIN_NODE_HALF_HEIGHT)) + 28;

        return {
            id: resolvedId,
            name: group?.name || resolvedId,
            children,
            childIds: new Set(children.map(node => node.id)),
            bounds: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            }
        };
    }).filter(Boolean);
});

const groupLookup = computed(() => {
    const lookup = new Map();
    groupEntries.value.forEach(group => lookup.set(group.id, group));
    return lookup;
});

const normalizedConnections = computed(() => projectTopologyTwinConnections(rawConnections.value, nodeMap.value));
const viewportTransform = computed(() => `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
const structureSignature = computed(() => rawComponents.value
    .map((component, index) => normalizeComponentId(component.id || component.name || `node-${index}`))
    .join('|'));

const dragBounds = computed(() => {
    const source = layoutNodes.value.length > 0 ? layoutNodes.value : baseLayoutNodes.value;
    if (!source.length) {
        return {
            minX: -TWIN_CANVAS_WIDTH,
            maxX: TWIN_CANVAS_WIDTH * 2,
            minY: -TWIN_CANVAS_HEIGHT,
            maxY: TWIN_CANVAS_HEIGHT * 2
        };
    }

    return {
        minX: Math.min(...source.map((node) => node.x - TWIN_NODE_HALF_WIDTH)) - DRAG_BOUNDARY_PADDING,
        maxX: Math.max(...source.map((node) => node.x + TWIN_NODE_HALF_WIDTH)) + DRAG_BOUNDARY_PADDING,
        minY: Math.min(...source.map((node) => node.y - TWIN_NODE_HALF_HEIGHT)) - DRAG_BOUNDARY_PADDING,
        maxY: Math.max(...source.map((node) => node.y + TWIN_NODE_HALF_HEIGHT)) + DRAG_BOUNDARY_PADDING
    };
});

watch(structureSignature, () => {
    Object.keys(nodeOverrides).forEach((key) => delete nodeOverrides[key]);
    fitAllToCanvas();
}, { immediate: true });

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function screenToCanvas(clientX, clientY) {
    const svgElement = svgRef.value;
    if (!svgElement) return { x: 0, y: 0 };
    const rect = svgElement.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * TWIN_CANVAS_WIDTH;
    const svgY = ((clientY - rect.top) / rect.height) * TWIN_CANVAS_HEIGHT;
    return {
        x: (svgX - viewport.x) / viewport.scale,
        y: (svgY - viewport.y) / viewport.scale
    };
}

function setViewport(scale, centerX = TWIN_CANVAS_WIDTH / 2, centerY = TWIN_CANVAS_HEIGHT / 2) {
    const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE);
    viewport.x = centerX - ((centerX - viewport.x) / viewport.scale) * nextScale;
    viewport.y = centerY - ((centerY - viewport.y) / viewport.scale) * nextScale;
    viewport.scale = nextScale;
}

function fitAllToCanvas() {
    if (!layoutNodes.value.length) {
        viewport.scale = 1;
        viewport.x = 0;
        viewport.y = 0;
        return;
    }

    const minX = Math.min(...layoutNodes.value.map((node) => node.x - TWIN_NODE_HALF_WIDTH));
    const maxX = Math.max(...layoutNodes.value.map((node) => node.x + TWIN_NODE_HALF_WIDTH));
    const minY = Math.min(...layoutNodes.value.map((node) => node.y - TWIN_NODE_HALF_HEIGHT));
    const maxY = Math.max(...layoutNodes.value.map((node) => node.y + TWIN_NODE_HALF_HEIGHT));
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    const scaleX = (TWIN_CANVAS_WIDTH - FIT_PADDING * 2) / contentWidth;
    const scaleY = (TWIN_CANVAS_HEIGHT - FIT_PADDING * 2) / contentHeight;
    const nextScale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, 1.35);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    viewport.scale = nextScale;
    viewport.x = TWIN_CANVAS_WIDTH / 2 - centerX * nextScale;
    viewport.y = TWIN_CANVAS_HEIGHT / 2 - centerY * nextScale;
}

function handleWheel(event) {
    const svgElement = svgRef.value;
    if (!svgElement) return;
    const rect = svgElement.getBoundingClientRect();
    const focusX = ((event.clientX - rect.left) / rect.width) * TWIN_CANVAS_WIDTH;
    const focusY = ((event.clientY - rect.top) / rect.height) * TWIN_CANVAS_HEIGHT;
    const multiplier = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setViewport(viewport.scale * multiplier, focusX, focusY);
}

function startCanvasPan(event) {
    if (event.button !== 0 || dragState.nodeId || groupDragState.groupId) return;
    if (event.target?.closest?.('.node-group') || event.target?.closest?.('.group-frame-group')) return;
    panState.active = true;
    panState.startX = event.clientX;
    panState.startY = event.clientY;
    panState.originX = viewport.x;
    panState.originY = viewport.y;
    window.addEventListener('pointermove', handleCanvasPan);
    window.addEventListener('pointerup', stopCanvasPan);
}

function handleCanvasPan(event) {
    if (!panState.active) return;
    const svgElement = svgRef.value;
    if (!svgElement) return;
    const rect = svgElement.getBoundingClientRect();
    const deltaX = ((event.clientX - panState.startX) / rect.width) * TWIN_CANVAS_WIDTH;
    const deltaY = ((event.clientY - panState.startY) / rect.height) * TWIN_CANVAS_HEIGHT;
    viewport.x = panState.originX + deltaX;
    viewport.y = panState.originY + deltaY;
}

function stopCanvasPan() {
    panState.active = false;
    window.removeEventListener('pointermove', handleCanvasPan);
    window.removeEventListener('pointerup', stopCanvasPan);
}

function startGroupDrag(group, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopCanvasPan();

    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
    }

    emit('select-component', group.id);
    if (props.isReadOnly) return;

    const pointer = screenToCanvas(event.clientX, event.clientY);
    groupDragState.groupId = group.id;
    groupDragState.startPointerX = pointer.x;
    groupDragState.startPointerY = pointer.y;
    groupDragState.moved = false;
    groupDragState.startPositions = group.children.map((child) => ({
        id: child.id,
        originalId: child.originalId,
        x: child.x,
        y: child.y
    }));

    window.addEventListener('pointermove', handleGroupDrag);
    window.addEventListener('pointerup', stopGroupDrag);
}

function startNodeDrag(node, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopCanvasPan();
    if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
        emit('select-component', node.originalId);
    }
    if (props.isReadOnly) return;

    const pointer = screenToCanvas(event.clientX, event.clientY);
    dragState.nodeId = node.id;
    dragState.offsetX = pointer.x - node.x;
    dragState.offsetY = pointer.y - node.y;
    dragState.moved = false;
    window.addEventListener('pointermove', handleNodeDrag);
    window.addEventListener('pointerup', stopNodeDrag);
}

function handleNodeDrag(event) {
    if (!dragState.nodeId) return;
    const pointer = screenToCanvas(event.clientX, event.clientY);
    let nextX = clamp(pointer.x - dragState.offsetX, dragBounds.value.minX, dragBounds.value.maxX);
    let nextY = clamp(pointer.y - dragState.offsetY, dragBounds.value.minY, dragBounds.value.maxY);

    if (props.snapToGrid) {
        nextX = Math.round(nextX / SNAP_SIZE) * SNAP_SIZE;
        nextY = Math.round(nextY / SNAP_SIZE) * SNAP_SIZE;
    }

    nodeOverrides[dragState.nodeId] = { x: nextX, y: nextY };
    dragState.moved = true;
}

function handleGroupDrag(event) {
    if (!groupDragState.groupId) return;
    const pointer = screenToCanvas(event.clientX, event.clientY);
    const deltaX = pointer.x - groupDragState.startPointerX;
    const deltaY = pointer.y - groupDragState.startPointerY;

    groupDragState.startPositions.forEach((item) => {
        let nextX = clamp(item.x + deltaX, dragBounds.value.minX, dragBounds.value.maxX);
        let nextY = clamp(item.y + deltaY, dragBounds.value.minY, dragBounds.value.maxY);

        if (props.snapToGrid) {
            nextX = Math.round(nextX / SNAP_SIZE) * SNAP_SIZE;
            nextY = Math.round(nextY / SNAP_SIZE) * SNAP_SIZE;
        }

        nodeOverrides[item.id] = { x: nextX, y: nextY };
    });

    groupDragState.moved = Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
}

function stopNodeDrag() {
    const draggedNodeId = dragState.nodeId;
    if (draggedNodeId && dragState.moved) {
        const draggedNode = layoutNodes.value.find((node) => node.id === draggedNodeId);
        const override = nodeOverrides[draggedNodeId];
        if (draggedNode && override) {
            suppressClickNodeId.value = draggedNodeId;
            emit('move-component', {
                id: draggedNode.originalId,
                ...projectTwinCanvasToWorld(override.x, override.y)
            });
        }
    }

    dragState.nodeId = null;
    dragState.offsetX = 0;
    dragState.offsetY = 0;
    dragState.moved = false;
    window.removeEventListener('pointermove', handleNodeDrag);
    window.removeEventListener('pointerup', stopNodeDrag);
}

function stopGroupDrag() {
    if (groupDragState.groupId && groupDragState.moved) {
        suppressClickGroupId.value = groupDragState.groupId;
        const moves = groupDragState.startPositions.map((item) => {
            const override = nodeOverrides[item.id] || { x: item.x, y: item.y };
            return {
                id: item.originalId,
                ...projectTwinCanvasToWorld(override.x, override.y)
            };
        });
        emit('move-components', moves);
    }

    groupDragState.groupId = null;
    groupDragState.startPointerX = 0;
    groupDragState.startPointerY = 0;
    groupDragState.moved = false;
    groupDragState.startPositions = [];
    window.removeEventListener('pointermove', handleGroupDrag);
    window.removeEventListener('pointerup', stopGroupDrag);
}

function handleNodeClick(node, event) {
    if (suppressClickNodeId.value === node.id) {
        suppressClickNodeId.value = null;
        event.stopPropagation();
        return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        emit('toggle-multi-select', node.originalId);
        return;
    }
    emit('select-component', node.originalId);
}

function handleGroupClick(group, event) {
    if (suppressClickGroupId.value === group.id) {
        suppressClickGroupId.value = null;
        event.stopPropagation();
        return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
        emit('toggle-multi-select', group.id);
        return;
    }
    emit('select-component', group.id);
}

function handleGroupDoubleClick(group) {
    emit('toggle-group', group.id);
}

function handleConnectionClick(connectionId) {
    emit('select-connection', connectionId);
}

function getNodeAnnotation(node) {
    if (!node?.id) return '';
    return annotationMap.value[node.id] || annotationMap.value[String(node.id).toLowerCase()] || '';
}

function hasNodeAnnotation(node) {
    return !!String(getNodeAnnotation(node) || '').trim();
}

function isGroupActive(groupId) {
    return normalizedSelectedComponentId.value === groupId || multiSelectedIdSet.value.has(groupId) || props.expandedGroupId === groupId;
}

function isNodeActive(node) {
    if (!node?.id) return false;
    if (normalizedSelectedComponentId.value === node.id || multiSelectedIdSet.value.has(node.id)) {
        return true;
    }

    const selectedGroup = groupLookup.value.get(normalizedSelectedComponentId.value);
    if (selectedGroup?.childIds.has(node.id)) {
        return true;
    }

    const selectedGroupIds = Array.from(multiSelectedIdSet.value).filter(id => groupLookup.value.has(id));
    return selectedGroupIds.some(groupId => groupLookup.value.get(groupId)?.childIds.has(node.id));
}

function buildConnectionPath(connection) {
    return buildTopologyTwinConnectionPath(connection, props.routeMode);
}

function buildConnectionArrowTransform(connection) {
    return buildTopologyTwinConnectionArrowTransform(connection, props.routeMode);
}

function isConnectionHighlighted(connection) {
    if (!normalizedSelectedComponentId.value) return false;
    if (connection.from.id === normalizedSelectedComponentId.value || connection.to.id === normalizedSelectedComponentId.value) {
        return true;
    }

    const selectedGroup = groupLookup.value.get(normalizedSelectedComponentId.value);
    if (selectedGroup) {
        return selectedGroup.childIds.has(connection.from.id) || selectedGroup.childIds.has(connection.to.id);
    }

    return false;
}

function getConnectionSemanticStyle(connection) {
    const resolved = props.getConnectionStyle?.(connection.id) || {};
    const width = Number(resolved.width ?? 4);
    const opacity = Number(resolved.opacity ?? 0.8);
    const color = resolved.color || '#27b8ff';
    const type = resolved.type || 'flow';

    return {
        width,
        opacity,
        color,
        type
    };
}

function getConnectionVisualStyle(connection) {
    const semantic = getConnectionSemanticStyle(connection);
    const dashArray = semantic.type === 'dashed' ? '10 8' : undefined;
    return {
        stroke: semantic.color,
        strokeWidth: isConnectionHighlighted(connection) || connection.id === props.selectedConnectionId ? semantic.width + 0.8 : semantic.width,
        opacity: isConnectionHighlighted(connection) || connection.id === props.selectedConnectionId ? Math.min(1, semantic.opacity + 0.18) : semantic.opacity,
        strokeDasharray: dashArray
    };
}

function getConnectionArrowStyle(connection) {
    const semantic = getConnectionSemanticStyle(connection);
    return {
        fill: semantic.color,
        opacity: isConnectionHighlighted(connection) || connection.id === props.selectedConnectionId ? Math.min(1, semantic.opacity + 0.16) : semantic.opacity
    };
}

onBeforeUnmount(() => {
    window.removeEventListener('pointermove', handleCanvasPan);
    window.removeEventListener('pointerup', stopCanvasPan);
    window.removeEventListener('pointermove', handleNodeDrag);
    window.removeEventListener('pointerup', stopNodeDrag);
    window.removeEventListener('pointermove', handleGroupDrag);
    window.removeEventListener('pointerup', stopGroupDrag);
});

const connectionArrowPoints = '-9,-6 9,0 -9,6 -4.5,0';
</script>

<style scoped>
.topology-shell {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.topology-canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: 20px;
    overflow: hidden;
    background: radial-gradient(circle at top, rgba(40, 52, 70, 0.25), rgba(6, 10, 14, 0.96));
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.topology-header {
    position: absolute;
    top: 14px;
    left: 14px;
    right: 14px;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    pointer-events: none;
}

.topology-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #35c8ff;
}

.topology-subtitle {
    margin-top: 4px;
    font-size: 11px;
    color: #8fa0ae;
}

.topology-controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    pointer-events: auto;
}

.control-btn {
    min-width: 38px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(9, 14, 20, 0.88);
    color: #d9e6ef;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(10px);
}

.control-btn:hover,
.control-btn.active {
    border-color: rgba(53, 200, 255, 0.28);
    background: rgba(18, 26, 34, 0.96);
}

.fit-btn {
    min-width: 52px;
}

.topology-svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
}

.topology-svg.panning {
    cursor: grabbing;
}

.topology-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6f8191;
    font-size: 13px;
}

.connection-line {
    fill: none;
    stroke: url(#workbench-flow);
    stroke-width: 3;
    opacity: 0.52;
    cursor: pointer;
}

.connection-arrow {
    fill: rgba(39, 184, 255, 0.58);
    opacity: 0.95;
    pointer-events: none;
}

.connection-line.highlighted,
.connection-line.selected {
    opacity: 1;
    stroke-width: 4;
}

.connection-arrow.highlighted,
.connection-arrow.selected {
    fill: rgba(53, 200, 255, 0.96);
}

.node-group {
    cursor: pointer;
}

.group-frame-group {
    cursor: pointer;
}

.group-frame-group.dragging {
    cursor: grabbing;
}

.group-frame {
    fill: rgba(71, 96, 120, 0.08);
    stroke: rgba(130, 164, 196, 0.34);
    stroke-width: 1.5;
    stroke-dasharray: 8 6;
}

.group-pill {
    fill: rgba(11, 18, 24, 0.9);
    stroke: rgba(130, 164, 196, 0.24);
    stroke-width: 1;
}

.group-label {
    fill: #d9e6ef;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
}

.group-count {
    fill: #89a0b6;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
    user-select: none;
}

.group-frame-group.selected .group-frame,
.group-frame-group.expanded .group-frame {
    fill: rgba(53, 200, 255, 0.08);
    stroke: rgba(53, 200, 255, 0.66);
}

.node-group.dragging {
    cursor: grabbing;
}

.node-card {
    fill: rgba(18, 25, 32, 0.92);
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1.5;
    transition: fill 0.18s ease, stroke 0.18s ease, transform 0.18s ease;
}

.node-cap {
    fill: rgba(255, 255, 255, 0.05);
}

.node-note-dot {
    fill: #ffd166;
    stroke: rgba(15, 18, 24, 0.92);
    stroke-width: 1.5;
}

.node-label {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    fill: #ecf4fa;
    pointer-events: none;
    user-select: none;
}

.node-type {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    fill: #8fa0ae;
    pointer-events: none;
    user-select: none;
}

.node-group.core .node-card {
    stroke: rgba(53, 200, 255, 0.42);
}

.node-group.process .node-card {
    stroke: rgba(255, 145, 82, 0.36);
}

.node-group.storage .node-card {
    stroke: rgba(122, 229, 130, 0.36);
}

.node-group.utility .node-card {
    stroke: rgba(179, 156, 255, 0.34);
}

.node-group:hover .node-card,
.node-group.selected .node-card {
    fill: rgba(26, 36, 46, 0.96);
    stroke-width: 2.4;
}

.node-group.dragging .node-card {
    fill: rgba(32, 44, 56, 0.98);
    stroke-width: 2.8;
}

.node-group.selected .node-label {
    fill: #35c8ff;
}

@media (max-width: 1100px) {
    .topology-header {
        flex-direction: column;
    }

    .topology-controls {
        justify-content: flex-start;
    }
}
</style>
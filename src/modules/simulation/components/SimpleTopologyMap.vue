<template>
  <div class="topology-shell">
    <div class="topology-canvas">
      <div class="topology-controls">
        <button class="control-btn" type="button" @click="zoomBy(1.15)">+</button>
        <button class="control-btn" type="button" @click="zoomBy(1 / 1.15)">-</button>
        <button class="control-btn fit-btn" type="button" @click="fitAllToCanvas">Fit</button>
      </div>

      <svg
        ref="svgRef"
        viewBox="0 0 1000 760"
        class="topology-svg"
        :class="{ panning: panState.active }"
        role="img"
        aria-label="Simplified topology map"
        @pointerdown="startCanvasPan"
        @wheel.prevent="handleWheel"
        @dblclick="fitAllToCanvas"
      >
        <defs>
          <pattern id="agent-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(130, 146, 166, 0.08)" stroke-width="1" />
          </pattern>
          <linearGradient id="agent-flow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(39, 184, 255, 0.18)" />
            <stop offset="100%" stop-color="rgba(39, 184, 255, 0.72)" />
          </linearGradient>
        </defs>

        <g :transform="viewportTransform">
          <rect width="1000" height="760" rx="28" fill="url(#agent-grid)" />

          <g class="link-layer">
            <g v-for="connection in normalizedConnections" :key="connection.id" class="connection-group">
              <path
                :d="buildConnectionPath(connection)"
                class="connection-line"
                :class="{ highlighted: isConnectionHighlighted(connection) }"
              />
              <polygon
                :points="connectionArrowPoints"
                class="connection-arrow"
                :class="{ highlighted: isConnectionHighlighted(connection) }"
                :transform="buildConnectionArrowTransform(connection)"
              />
            </g>
          </g>

          <g class="node-layer">
            <g
              v-for="node in layoutNodes"
              :key="node.id"
              class="node-group"
              :class="[node.category, { selected: node.id === selectedComponentId, dragging: dragState.nodeId === node.id }]"
              @pointerdown="startNodeDrag(node, $event)"
              @click="handleNodeClick(node.id, $event)"
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
              <text :x="node.x" :y="node.y + 6" text-anchor="middle" class="node-label">{{ node.displayLabel }}</text>
              <text :x="node.x" :y="node.y + 24" text-anchor="middle" class="node-type">{{ node.typeLabel }}</text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 760;
const NODE_HALF_WIDTH = 68;
const NODE_HALF_HEIGHT = 34;
const FIT_PADDING = 84;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.9;
const SCENE_LAYOUT_SPREAD = 2.8;
const SCENE_ORIGIN_X = CANVAS_WIDTH / 2;
const SCENE_ORIGIN_Y = CANVAS_HEIGHT / 2;
const DRAG_BOUNDARY_PADDING = 260;

const props = defineProps({
  structureData: {
    type: Object,
    default: () => ({ components: [], connections: [] }),
  },
  selectedComponentId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['select-component']);
const { saveComponentPosition, isReadOnly } = useProjectWorkspace();

const svgRef = ref(null);
const nodeOverrides = reactive({});
const viewport = reactive({
  scale: 1,
  x: 0,
  y: 0,
});
const dragState = reactive({
  nodeId: null,
  offsetX: 0,
  offsetY: 0,
  moved: false,
});
const panState = reactive({
  active: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
});
const suppressClickNodeId = ref(null);

const rawComponents = computed(() => Array.isArray(props.structureData?.components) ? props.structureData.components : []);
const rawConnections = computed(() => Array.isArray(props.structureData?.connections) ? props.structureData.connections : []);

function normalizeId(value) {
  return String(value || '').toLowerCase();
}

function getCategory(id) {
  const normalized = normalizeId(id);
  if (['plasma', 'blanket', 'fw', 'div'].includes(normalized)) return 'core';
  if (normalized.includes('iss') || normalized === 'sds' || normalized === 'tes') return 'storage';
  if (normalized.includes('tep') || normalized.includes('pump') || normalized.includes('cps') || normalized.includes('wds')) return 'process';
  return 'utility';
}

function getDisplayLabel(id) {
  return String(id || '').replaceAll('_', ' ').toUpperCase();
}

function getTypeLabel(component) {
  return component?.type || component?.class || 'Module';
}

const baseLayoutNodes = computed(() => {
  const components = rawComponents.value;
  if (components.length === 0) return [];

  const explicitNodes = components.map((component, index) => {
    const posX = component?.position?.x ?? component?.x ?? null;
    const posY = component?.position?.y ?? component?.y ?? null;
    return {
      id: normalizeId(component.id || component.name || `node-${index}`),
      originalId: component.id || component.name || `node-${index}`,
      category: getCategory(component.id || component.name),
      displayLabel: getDisplayLabel(component.id || component.name || `node-${index}`),
      typeLabel: getTypeLabel(component),
      sourceX: typeof posX === 'number' ? posX : null,
      sourceY: typeof posY === 'number' ? posY : null,
      index,
    };
  });

  const withPositions = explicitNodes.filter((node) => node.sourceX !== null && node.sourceY !== null);
  if (withPositions.length === explicitNodes.length) {
    return explicitNodes.map((node) => ({
      ...node,
      x: SCENE_ORIGIN_X + node.sourceX * SCENE_LAYOUT_SPREAD,
      y: SCENE_ORIGIN_Y - node.sourceY * SCENE_LAYOUT_SPREAD,
    }));
  }

  const columns = Math.max(2, Math.ceil(Math.sqrt(explicitNodes.length)));
  return explicitNodes.map((node) => {
    const column = node.index % columns;
    const row = Math.floor(node.index / columns);
    return {
      ...node,
      x: 150 + column * (720 / Math.max(columns - 1, 1)),
      y: 140 + row * 132,
    };
  });
});

const layoutNodes = computed(() => baseLayoutNodes.value.map((node) => {
  const override = nodeOverrides[node.id];
  if (!override) return node;
  return {
    ...node,
    x: override.x,
    y: override.y,
  };
}));

const nodeMap = computed(() => {
  const map = new Map();
  layoutNodes.value.forEach((node) => map.set(node.id, node));
  return map;
});

const normalizedConnections = computed(() => rawConnections.value
  .map((connection, index) => {
    const fromId = normalizeId(connection.from || connection.source || connection.start);
    const toId = normalizeId(connection.to || connection.target || connection.end);
    if (!nodeMap.value.has(fromId) || !nodeMap.value.has(toId)) return null;
    return {
      id: connection.id || `${fromId}-${toId}-${index}`,
      from: nodeMap.value.get(fromId),
      to: nodeMap.value.get(toId),
    };
  })
  .filter(Boolean));

const dragBounds = computed(() => {
  const source = layoutNodes.value.length > 0 ? layoutNodes.value : baseLayoutNodes.value;
  if (source.length === 0) {
    return {
      minX: -CANVAS_WIDTH,
      maxX: CANVAS_WIDTH * 2,
      minY: -CANVAS_HEIGHT,
      maxY: CANVAS_HEIGHT * 2,
    };
  }

  return {
    minX: Math.min(...source.map((node) => node.x - NODE_HALF_WIDTH)) - DRAG_BOUNDARY_PADDING,
    maxX: Math.max(...source.map((node) => node.x + NODE_HALF_WIDTH)) + DRAG_BOUNDARY_PADDING,
    minY: Math.min(...source.map((node) => node.y - NODE_HALF_HEIGHT)) - DRAG_BOUNDARY_PADDING,
    maxY: Math.max(...source.map((node) => node.y + NODE_HALF_HEIGHT)) + DRAG_BOUNDARY_PADDING,
  };
});

function buildConnectionPath(connection) {
  const startX = connection.from.x;
  const startY = connection.from.y;
  const endX = connection.to.x;
  const endY = connection.to.y;
  const deltaX = Math.abs(endX - startX);
  const curve = Math.max(70, deltaX * 0.45);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

const connectionArrowPoints = '-9,-6 9,0 -9,6 -4.5,0';

function getConnectionCurve(connection) {
  const startX = connection.from.x;
  const startY = connection.from.y;
  const endX = connection.to.x;
  const endY = connection.to.y;
  const deltaX = Math.abs(endX - startX);
  const curve = Math.max(70, deltaX * 0.45);

  return {
    p0: { x: startX, y: startY },
    p1: { x: startX + curve, y: startY },
    p2: { x: endX - curve, y: endY },
    p3: { x: endX, y: endY },
  };
}

function cubicBezierPoint(curve, t) {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * curve.p0.x + 3 * inverse ** 2 * t * curve.p1.x + 3 * inverse * t ** 2 * curve.p2.x + t ** 3 * curve.p3.x,
    y: inverse ** 3 * curve.p0.y + 3 * inverse ** 2 * t * curve.p1.y + 3 * inverse * t ** 2 * curve.p2.y + t ** 3 * curve.p3.y,
  };
}

function cubicBezierAngle(curve, t) {
  const inverse = 1 - t;
  const dx =
    3 * inverse ** 2 * (curve.p1.x - curve.p0.x) +
    6 * inverse * t * (curve.p2.x - curve.p1.x) +
    3 * t ** 2 * (curve.p3.x - curve.p2.x);
  const dy =
    3 * inverse ** 2 * (curve.p1.y - curve.p0.y) +
    6 * inverse * t * (curve.p2.y - curve.p1.y) +
    3 * t ** 2 * (curve.p3.y - curve.p2.y);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function buildConnectionArrowTransform(connection) {
  const curve = getConnectionCurve(connection);
  const point = cubicBezierPoint(curve, 0.5);
  const angle = cubicBezierAngle(curve, 0.5);
  return `translate(${point.x} ${point.y}) rotate(${angle})`;
}

function isConnectionHighlighted(connection) {
  if (!props.selectedComponentId) return false;
  const selected = normalizeId(props.selectedComponentId);
  return connection.from.id === selected || connection.to.id === selected;
}

const viewportTransform = computed(() => `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`);
const structureSignature = computed(() => rawComponents.value
  .map((component, index) => normalizeId(component.id || component.name || `node-${index}`))
  .join('|'));

watch(structureSignature, () => {
  Object.keys(nodeOverrides).forEach((key) => {
    delete nodeOverrides[key];
  });
  fitAllToCanvas();
}, { immediate: true });

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function screenToCanvas(clientX, clientY) {
  const svgElement = svgRef.value;
  if (!svgElement) return { x: 0, y: 0 };
  const rect = svgElement.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const svgY = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  return {
    x: (svgX - viewport.x) / viewport.scale,
    y: (svgY - viewport.y) / viewport.scale,
  };
}

function setViewport(scale, centerX = CANVAS_WIDTH / 2, centerY = CANVAS_HEIGHT / 2) {
  const nextScale = clamp(scale, MIN_SCALE, MAX_SCALE);
  viewport.x = centerX - ((centerX - viewport.x) / viewport.scale) * nextScale;
  viewport.y = centerY - ((centerY - viewport.y) / viewport.scale) * nextScale;
  viewport.scale = nextScale;
}

function zoomBy(multiplier) {
  setViewport(viewport.scale * multiplier);
}

function fitAllToCanvas() {
  if (layoutNodes.value.length === 0) {
    viewport.scale = 1;
    viewport.x = 0;
    viewport.y = 0;
    return;
  }

  const minX = Math.min(...layoutNodes.value.map((node) => node.x - NODE_HALF_WIDTH));
  const maxX = Math.max(...layoutNodes.value.map((node) => node.x + NODE_HALF_WIDTH));
  const minY = Math.min(...layoutNodes.value.map((node) => node.y - NODE_HALF_HEIGHT));
  const maxY = Math.max(...layoutNodes.value.map((node) => node.y + NODE_HALF_HEIGHT));
  const contentWidth = Math.max(maxX - minX, 1);
  const contentHeight = Math.max(maxY - minY, 1);
  const scaleX = (CANVAS_WIDTH - FIT_PADDING * 2) / contentWidth;
  const scaleY = (CANVAS_HEIGHT - FIT_PADDING * 2) / contentHeight;
  const nextScale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, 1.35);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  viewport.scale = nextScale;
  viewport.x = CANVAS_WIDTH / 2 - centerX * nextScale;
  viewport.y = CANVAS_HEIGHT / 2 - centerY * nextScale;
}

function handleWheel(event) {
  const svgElement = svgRef.value;
  if (!svgElement) return;
  const rect = svgElement.getBoundingClientRect();
  const focusX = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const focusY = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  const multiplier = event.deltaY < 0 ? 1.08 : 1 / 1.08;
  setViewport(viewport.scale * multiplier, focusX, focusY);
}

function startCanvasPan(event) {
  if (event.button !== 0 || dragState.nodeId) return;
  if (event.target?.closest?.('.node-group')) return;
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
  const deltaX = ((event.clientX - panState.startX) / rect.width) * CANVAS_WIDTH;
  const deltaY = ((event.clientY - panState.startY) / rect.height) * CANVAS_HEIGHT;
  viewport.x = panState.originX + deltaX;
  viewport.y = panState.originY + deltaY;
}

function stopCanvasPan() {
  panState.active = false;
  window.removeEventListener('pointermove', handleCanvasPan);
  window.removeEventListener('pointerup', stopCanvasPan);
}

function startNodeDrag(node, event) {
  if (event.button !== 0) return;
  event.stopPropagation();
  stopCanvasPan();
  emit('select-component', node.id);
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
  const nextX = clamp(pointer.x - dragState.offsetX, dragBounds.value.minX, dragBounds.value.maxX);
  const nextY = clamp(pointer.y - dragState.offsetY, dragBounds.value.minY, dragBounds.value.maxY);
  nodeOverrides[dragState.nodeId] = { x: nextX, y: nextY };
  dragState.moved = true;
}

async function persistNodePosition(nodeId) {
  const override = nodeOverrides[nodeId];
  if (!override || isReadOnly.value) return;
  const nextX = Number(((override.x - SCENE_ORIGIN_X) / SCENE_LAYOUT_SPREAD).toFixed(6));
  const nextY = Number((-(override.y - SCENE_ORIGIN_Y) / SCENE_LAYOUT_SPREAD).toFixed(6));
  await saveComponentPosition(nodeId, nextX, nextY);
  delete nodeOverrides[nodeId];
}

function stopNodeDrag() {
  const draggedNodeId = dragState.nodeId;
  if (draggedNodeId && dragState.moved) {
    suppressClickNodeId.value = draggedNodeId;
    void persistNodePosition(draggedNodeId);
  }
  dragState.nodeId = null;
  dragState.offsetX = 0;
  dragState.offsetY = 0;
  dragState.moved = false;
  window.removeEventListener('pointermove', handleNodeDrag);
  window.removeEventListener('pointerup', stopNodeDrag);
}

function handleNodeClick(nodeId, event) {
  if (suppressClickNodeId.value === nodeId) {
    suppressClickNodeId.value = null;
    event.stopPropagation();
    return;
  }
  emit('select-component', nodeId);
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleCanvasPan);
  window.removeEventListener('pointerup', stopCanvasPan);
  window.removeEventListener('pointermove', handleNodeDrag);
  window.removeEventListener('pointerup', stopNodeDrag);
});
</script>

<style scoped>
.topology-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.topology-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 26px;
  overflow: hidden;
  background: radial-gradient(circle at top, rgba(40, 52, 70, 0.25), rgba(6, 10, 14, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.topology-controls {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: flex;
  gap: 8px;
}

.control-btn {
  min-width: 38px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(9, 14, 20, 0.88);
  color: #d9e6ef;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
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
}

.topology-svg.panning {
  cursor: grabbing;
}

.connection-line {
  fill: none;
  stroke: url(#agent-flow);
  stroke-width: 3;
  opacity: 0.5;
}

.connection-arrow {
  fill: rgba(39, 184, 255, 0.58);
  opacity: 0.95;
  pointer-events: none;
}

.connection-line.highlighted {
  opacity: 1;
  stroke-width: 4;
}

.connection-arrow.highlighted {
  fill: rgba(53, 200, 255, 0.96);
}

.node-group {
  cursor: pointer;
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

.node-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  fill: #ecf4fa;
}

.node-type {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  fill: #8fa0ae;
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

@media (max-width: 640px) {
  .topology-controls {
    top: 10px;
    right: 10px;
    gap: 6px;
  }

  .control-btn {
    min-width: 34px;
    height: 34px;
    padding: 0 10px;
    border-radius: 10px;
  }
}
</style>
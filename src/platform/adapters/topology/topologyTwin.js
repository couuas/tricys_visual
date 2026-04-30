import { normalizeComponentId } from '../../../utils/groupIds';

export const TWIN_CANVAS_WIDTH = 1000;
export const TWIN_CANVAS_HEIGHT = 760;
export const TWIN_NODE_HALF_WIDTH = 68;
export const TWIN_NODE_HALF_HEIGHT = 34;
export const TWIN_LAYOUT_SPREAD = 2.8;
export const TWIN_ORIGIN_X = TWIN_CANVAS_WIDTH / 2;
export const TWIN_ORIGIN_Y = TWIN_CANVAS_HEIGHT / 2;

const NODE_COLUMNS_MIN = 2;

const getCategory = (id) => {
    const normalized = normalizeComponentId(id);
    if (['plasma', 'blanket', 'fw', 'div'].includes(normalized)) return 'core';
    if (normalized.includes('iss') || normalized === 'sds' || normalized === 'tes') return 'storage';
    if (normalized.includes('tep') || normalized.includes('pump') || normalized.includes('cps') || normalized.includes('wds')) return 'process';
    return 'utility';
};

const getDisplayLabel = (id) => {
    return String(id || '').replaceAll('_', ' ').toUpperCase();
};

const getTypeLabel = (component) => {
    return component?.type || component?.class || 'Module';
};

export const projectWorldToTwinCanvas = (x, y) => ({
    x: TWIN_ORIGIN_X + x * TWIN_LAYOUT_SPREAD,
    y: TWIN_ORIGIN_Y - y * TWIN_LAYOUT_SPREAD
});

export const projectTwinCanvasToWorld = (x, y) => ({
    x: Number(((x - TWIN_ORIGIN_X) / TWIN_LAYOUT_SPREAD).toFixed(6)),
    y: Number((-(y - TWIN_ORIGIN_Y) / TWIN_LAYOUT_SPREAD).toFixed(6))
});

export const projectTopologyTwinNodes = (components = []) => {
    const source = Array.isArray(components) ? components : [];
    if (!source.length) return [];

    const explicitNodes = source.map((component, index) => {
        const posX = component?.position?.x ?? component?.x ?? null;
        const posY = component?.position?.y ?? component?.y ?? null;
        const originalId = component.id || component.name || `node-${index}`;
        return {
            id: normalizeComponentId(originalId),
            originalId,
            category: getCategory(originalId),
            displayLabel: getDisplayLabel(originalId),
            typeLabel: getTypeLabel(component),
            sourceX: typeof posX === 'number' ? posX : null,
            sourceY: typeof posY === 'number' ? posY : null,
            index
        };
    });

    const allExplicit = explicitNodes.every((node) => node.sourceX !== null && node.sourceY !== null);
    if (allExplicit) {
        return explicitNodes.map((node) => ({
            ...node,
            ...projectWorldToTwinCanvas(node.sourceX, node.sourceY)
        }));
    }

    const columns = Math.max(NODE_COLUMNS_MIN, Math.ceil(Math.sqrt(explicitNodes.length)));
    return explicitNodes.map((node) => {
        const column = node.index % columns;
        const row = Math.floor(node.index / columns);
        return {
            ...node,
            x: 150 + column * (720 / Math.max(columns - 1, 1)),
            y: 140 + row * 132
        };
    });
};

export const buildTopologyTwinConnectionId = (connection, index = 0) => {
    const fromId = normalizeComponentId(connection?.from || connection?.source || connection?.start);
    const toId = normalizeComponentId(connection?.to || connection?.target || connection?.end);
    if (!fromId || !toId) {
        return connection?.id || `connection-${index}`;
    }
    return `${fromId}_${toId}`;
};

export const projectTopologyTwinConnections = (connections = [], nodeMap = new Map()) => {
    const source = Array.isArray(connections) ? connections : [];
    return source.map((connection, index) => {
        const fromId = normalizeComponentId(connection?.from || connection?.source || connection?.start);
        const toId = normalizeComponentId(connection?.to || connection?.target || connection?.end);
        if (!nodeMap.has(fromId) || !nodeMap.has(toId)) {
            return null;
        }

        return {
            id: buildTopologyTwinConnectionId(connection, index),
            rawId: connection?.id || '',
            from: nodeMap.get(fromId),
            to: nodeMap.get(toId)
        };
    }).filter(Boolean);
};

const buildBezierCurve = (connection) => {
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
        p3: { x: endX, y: endY }
    };
};

const cubicBezierPoint = (curve, t) => {
    const inverse = 1 - t;
    return {
        x: inverse ** 3 * curve.p0.x + 3 * inverse ** 2 * t * curve.p1.x + 3 * inverse * t ** 2 * curve.p2.x + t ** 3 * curve.p3.x,
        y: inverse ** 3 * curve.p0.y + 3 * inverse ** 2 * t * curve.p1.y + 3 * inverse * t ** 2 * curve.p2.y + t ** 3 * curve.p3.y
    };
};

const cubicBezierAngle = (curve, t) => {
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
};

const buildOrthogonalRoutePoints = (connection) => {
    const startX = connection.from.x;
    const startY = connection.from.y;
    const endX = connection.to.x;
    const endY = connection.to.y;
    const direction = Math.sign(endX - startX) || 1;
    const centerX = startX + (endX - startX) / 2;
    const laneOffset = Math.max(56, Math.min(120, Math.abs(endX - startX) * 0.28));

    if (Math.abs(endX - startX) < 120) {
        return [
            { x: startX, y: startY },
            { x: centerX, y: startY },
            { x: centerX, y: endY },
            { x: endX, y: endY }
        ];
    }

    return [
        { x: startX, y: startY },
        { x: startX + laneOffset * direction, y: startY },
        { x: startX + laneOffset * direction, y: endY },
        { x: endX, y: endY }
    ];
};

export const buildTopologyTwinConnectionPath = (connection, routeMode = 'orthogonal') => {
    if (routeMode === 'bezier') {
        const curve = buildBezierCurve(connection);
        return `M ${curve.p0.x} ${curve.p0.y} C ${curve.p1.x} ${curve.p1.y}, ${curve.p2.x} ${curve.p2.y}, ${curve.p3.x} ${curve.p3.y}`;
    }

    const points = buildOrthogonalRoutePoints(connection);
    return `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')}`;
};

export const buildTopologyTwinConnectionArrowTransform = (connection, routeMode = 'orthogonal') => {
    if (routeMode === 'bezier') {
        const curve = buildBezierCurve(connection);
        const point = cubicBezierPoint(curve, 0.5);
        const angle = cubicBezierAngle(curve, 0.5);
        return `translate(${point.x} ${point.y}) rotate(${angle})`;
    }

    const points = buildOrthogonalRoutePoints(connection);
    const anchor = points[points.length - 1];
    const prev = points[points.length - 2] || anchor;
    const angle = Math.atan2(anchor.y - prev.y, anchor.x - prev.x) * 180 / Math.PI;
    const point = {
        x: prev.x + (anchor.x - prev.x) * 0.5,
        y: prev.y + (anchor.y - prev.y) * 0.5
    };
    return `translate(${point.x} ${point.y}) rotate(${angle})`;
};
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { SceneBootstrap } from './core/SceneBootstrap.js';
import { AssetLoadingService } from './assets/AssetLoadingService.js';
import { SelectionAndDragService } from './interaction/SelectionAndDragService.js';
import { LayoutHistoryService } from './layout/LayoutHistoryService.js';
import { cloneSceneDocument, normalizeSceneDocument } from '../protocols/sceneDocument.js';

// --- Texture & Geometry Helpers ---
const createFlowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    const streakHeight = 10;
    const lanes = [22, 32, 42];
    lanes.forEach((y) => {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.12)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
        grad.addColorStop(0.75, 'rgba(255,255,255,0.12)');
        grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - streakHeight / 2, canvas.width, streakHeight);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.repeat.set(1, 1); 
    return texture;
};

const createDashTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 32, 64); 
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return texture;
};

const createRibbonGeometry = (curve, width, segments = 64) => {
    const points = curve.getPoints(segments);
    const positions = []; const uvs = []; const indices = [];
    let totalLen = 0; const lens = [0];
    for (let i = 1; i < points.length; i++) {
        totalLen += points[i].distanceTo(points[i - 1]);
        lens.push(totalLen);
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const t = i < points.length - 1 ? points[i + 1].clone().sub(p) : p.clone().sub(points[i - 1]);
        t.normalize();
        const n = new THREE.Vector3().crossVectors(up, t).normalize();
        const half = width / 2;
        const left = p.clone().addScaledVector(n, -half);
        const right = p.clone().addScaledVector(n, half);
        positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
        const u = totalLen > 0 ? lens[i] / totalLen : 0;
        uvs.push(u, 0, u, 1);
    }
    for (let i = 0; i < points.length - 1; i++) {
        const a = i * 2; const b = i * 2 + 1; const c = i * 2 + 2; const d = i * 2 + 3;
        indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
};

export class TopologySceneEngine {
    constructor(config = {}) {
        this.config = {
            LAYOUT_SPREAD: 2.8,
            TANK_HEIGHT: 36,
            USE_RIBBON_CONNECTIONS: true,
            CONNECTION_Y: 2,
            isReadOnly: false,
            multiSelectedIds: new Set(),
            isGroup: (id) => false, // Callback to check if group
            BACKEND_URL: '', // [NEW] Used for resolving custom loader endpoints
            getConnectionStyle: (id) => ({ width: 4.0, type: 'flow', color: 0x00d2ff, speed: 0.04, opacity: 0.8 }),
            ...config
        };

        this.container = null;
        this.bootstrap = null;
        this.assetLoader = null;
        this.interaction = null;
        this.layoutHistory = null;
        
        // Scene Graph state
        this.componentGroupsMap = {};
        this.labelContainersMap = {};
        this.connectionRegistry = [];
        this.currentRenderVersion = 0;
        this.currentDocument = null;
        this.currentView = '3d';

        // Event callbacks
        this.eventListeners = new Map();
    }

    on(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
        return () => {
            const arr = this.eventListeners.get(event);
            const idx = arr.indexOf(handler);
            if (idx > -1) arr.splice(idx, 1);
        };
    }

    emit(event, payload) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(cb => cb(payload));
        }
    }

    // Property accessors for internal services
    get scene() { return this.bootstrap ? this.bootstrap.scene : null; }
    get camera() { return this.bootstrap ? this.bootstrap.camera : null; }
    get renderer() { return this.bootstrap ? this.bootstrap.renderer : null; }
    get controls() { return this.bootstrap ? this.bootstrap.controls : null; }

    async mount(container, historyCallbacks) {
        this.container = container;
        
        // 1. Bootstrap Phase
        this.bootstrap = new SceneBootstrap(container);
        
        // 2. Loaders Phase
        this.assetLoader = new AssetLoadingService(this.bootstrap.renderer);
        this.assetLoader.onProgressUpdate = (map) => this.emit('loadProgress', map);

        // 3. Layout History Phase
        this.layoutHistory = new LayoutHistoryService(
            historyCallbacks.getProjectId,
            historyCallbacks.applyState,
            historyCallbacks.getState
        );
        this.layoutHistory.onStateChange = (state) => this.emit('historyStateChange', state);

        // 4. Interaction Phase
        this.interaction = new SelectionAndDragService(this);
        this.interaction.onEvent = (type, payload) => {
            if (type === 'componentMoved') {
                this.updateConnectedLines(payload);
            }
            this.emit(type, payload);
        };
        
        // Basic Update loop
        this.bootstrap.addRenderCallback(() => this.updateLoop());
        
        return Promise.resolve();
    }

    unmount() {
        if (this.interaction) this.interaction.dispose();
        if (this.bootstrap) this.bootstrap.dispose();
        
        this.container = null;
        this.componentGroupsMap = {};
        this.labelContainersMap = {};
        this.connectionRegistry = [];
        this.eventListeners.clear();
    }

    setMode(mode) {
        this.config.isReadOnly = (mode === 'readonly');
    }

    setView(view) {
        this.currentView = view || '3d';
        if (this.currentDocument) {
            this.currentDocument.metadata.viewMode = this.currentView;
        }
    }

    getSelection() {
        return Array.from(this.config.multiSelectedIds || []);
    }

    async loadDocument(document) {
        const normalized = normalizeSceneDocument(document);
        this.currentDocument = cloneSceneDocument(normalized);
        this.currentView = normalized.metadata.viewMode || '3d';
        this.rebuildScene(
            normalized.topology,
            normalized.visual.modelConfig,
            normalized.visual.annotations,
            normalized.visual.componentGroups,
            normalized.visual.expandedGroupId
        );
        return Promise.resolve();
    }

    serialize() {
        return cloneSceneDocument(this.currentDocument || {});
    }

    execute(command = {}) {
        switch (command.type) {
            case 'focus-component':
                this.focusOnComponent(command.id || command.payload?.id);
                return true;
            case 'apply-component-moves':
                this.applyComponentMoves(command.moves || command.payload?.moves || []);
                return true;
            case 'set-selection':
                this.updateConfig({ multiSelectedIds: new Set(command.ids || command.payload?.ids || []) });
                this.updateSelectionVisuals();
                return true;
            case 'clear-selection':
                this.updateConfig({ multiSelectedIds: new Set() });
                this.updateSelectionVisuals();
                return true;
            case 'set-mode':
                this.setMode(command.mode || command.payload?.mode);
                return true;
            case 'set-view':
                this.setView(command.view || command.payload?.view);
                return true;
            default:
                return false;
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    updateLoop() {
        // Handle visual effects (like flowing connections if implemented)
        this.connectionRegistry.forEach(c => {
            if (c.mesh && c.mesh.material && c.mesh.material.map) {
                if (c.mesh.userData.type === 'dashed') {
                    c.mesh.material.map.offset.x -= (c.mesh.userData.speed || 0.015);
                } else if (!c.mesh.userData.type || c.mesh.userData.type === 'flow') {
                    c.mesh.material.map.offset.x -= (c.mesh.userData.speed || 0.04);
                }
            }
        });
    }

    // SCENE GRAPH MANAGEMENT

    clearScene() {
        if (!this.scene) return;
        this.currentRenderVersion++;
        
        for (let i = this.scene.children.length - 1; i >= 0; i--) {
            const child = this.scene.children[i];
            if (child.userData.isSystemObj || (child.name && child.name.startsWith("CONN_"))) {
                child.traverse(c => {
                    if (c.isCSS2DObject && c.element && c.element.parentNode) {
                        c.element.parentNode.removeChild(c.element);
                    }
                });
                this.assetLoader.deepDispose(child);
            }
        }

        this.componentGroupsMap = {};
        this.labelContainersMap = {};
        this.connectionRegistry = [];
    }

    buildSingleComponentVisual(c, modelConfig, annotations, myVersion) {
        const x = c.position.x * this.config.LAYOUT_SPREAD;
        const z = -c.position.y * this.config.LAYOUT_SPREAD;
        const sid = c.id.toLowerCase();
        
        const g = new THREE.Group(); 
        g.position.set(x, this.config.TANK_HEIGHT/2, z); 
        g.name = sid;
        g.userData = { isSystemObj: true };

        const cfg = modelConfig[sid];
        if (cfg && cfg.type === 'custom') {
            const url = this.config.BACKEND_URL ? `${this.config.BACKEND_URL}${cfg.url}` : cfg.url;
            g.userData.customConfig = { url: url, scale: cfg.scale, id: sid };
            this.assetLoader.ensureLoadingPlaceholder(g);
            this.assetLoader.requestCustomLoad(g, sid, url, cfg.scale, myVersion);
        } else {
            this.assetLoader.createDefaultCylinder(g, sid);
        }

        if (!g.userData.lowDetailMesh) {
            const low = this.assetLoader.createLoadingPlaceholder(false);
            g.userData.lowDetailMesh = low;
            g.add(low);
        }

        const div = document.createElement('div'); div.className = 'label-card';
        const nameDiv = document.createElement('div'); nameDiv.className = 'label-title'; nameDiv.textContent = c.id;
        div.appendChild(nameDiv);
        const l = new CSS2DObject(div); l.position.set(0, this.config.TANK_HEIGHT + 5, 0);
        this.labelContainersMap[sid] = div;
        g.add(l);

        if (this.config.multiSelectedIds.has(sid)) {
            const highlight = new THREE.Mesh(
                new THREE.BoxGeometry(35, 45, 35), 
                new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true, transparent: true, opacity: 0.25 })
            );
            highlight.userData.isHighlight = true;
            g.add(highlight);
        }

        this.componentGroupsMap[sid] = g; 
        this.scene.add(g);
    }

    createGroupVisuals(groupData, allComponents, myVersion, modelConfig) {
        const childrenComps = allComponents.filter(c => groupData.children.includes(c.id.toLowerCase()));
        if (childrenComps.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        childrenComps.forEach(c => {
            const x = c.position.x * this.config.LAYOUT_SPREAD;
            const z = -c.position.y * this.config.LAYOUT_SPREAD;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        });

        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const width = Math.max(40, (maxX - minX) + 40);
        const depth = Math.max(40, (maxZ - minZ) + 40);
        
        const g = new THREE.Group();
        g.position.set(centerX, this.config.TANK_HEIGHT/2, centerZ);
        g.name = groupData.id;
        
        g.userData = { 
            isGroup: true, 
            isSystemObj: true,
            groupId: groupData.id,
            dimensions: { width, depth } 
        };

        const expanded = this.config.expandedGroupId === groupData.id;

        if (expanded) {
            const geometry = new THREE.BoxGeometry(width, this.config.TANK_HEIGHT * 1.5, depth);
            const frame = new THREE.Mesh(
                geometry, 
                new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true, opacity: 0.3, transparent: true })
            );
            g.add(frame);

            const div = document.createElement('div'); 
            div.className = 'label-card group-label';
            div.innerHTML = `<div class="label-title group" style="border:1px dashed #6fbfe0; background:none;">Inside: ${groupData.name}</div>`;
            const l = new CSS2DObject(div); 
            l.position.set(0, this.config.TANK_HEIGHT * 0.8, 0);
            g.add(l);
            this.labelContainersMap[groupData.id] = div;
        } else {
            const cfg = modelConfig[groupData.id];
            
            if (cfg && cfg.type === 'custom') {
                const url = this.config.BACKEND_URL ? `${this.config.BACKEND_URL}${cfg.url}` : cfg.url;
                g.userData.customConfig = { url: url, scale: cfg.scale, id: groupData.id };
                this.assetLoader.ensureLoadingPlaceholder(g);
                this.assetLoader.requestCustomLoad(g, groupData.id, url, cfg.scale, myVersion);
            } else {
                const geometry = new THREE.BoxGeometry(width, this.config.TANK_HEIGHT * 1.2, depth);
                const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0x2c3e50, transparent: true, opacity: 0.9 }));
                g.add(mesh);
            }

            const div = document.createElement('div'); 
            div.className = 'label-card group-label';
            div.innerHTML = `<div class="label-title group">${groupData.name}</div>`;
            const l = new CSS2DObject(div); 
            l.position.set(0, this.config.TANK_HEIGHT/2 + 15, 0);
            g.add(l);
            this.labelContainersMap[groupData.id] = div;
        }

        if (!g.userData.lowDetailMesh) {
            const low = this.assetLoader.createLoadingPlaceholder(true, width, depth);
            g.userData.lowDetailMesh = low;
            g.add(low);
        }

        this.componentGroupsMap[groupData.id] = g;
        this.scene.add(g);
    }

    focusOnComponent(id) {
        if (!id || !this.controls || !this.camera) return;
        const group = this.componentGroupsMap[id.toLowerCase()];
        if (!group) return;

        const box = new THREE.Box3().setFromObject(group);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 50;
        
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
        
        const targetCamPos = new THREE.Vector3(center.x, center.y + cameraDistance * 0.8, center.z + cameraDistance * 1.5);
        
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        let alpha = 0;
        const animateFocus = () => {
            alpha += 0.05;
            if (alpha >= 1) {
                this.camera.position.copy(targetCamPos);
                this.controls.target.copy(center);
                this.controls.update();
                return;
            }
            const easeAlpha = 1 - Math.pow(1 - alpha, 3);
            this.camera.position.lerpVectors(startPos, targetCamPos, easeAlpha);
            this.controls.target.lerpVectors(startTarget, center, easeAlpha);
            this.controls.update();
            requestAnimationFrame(animateFocus);
        };
        animateFocus();
    }

    // Simplified connection update logic, matching the original ThreeScene lines behavior
    updateConnectedLines(movingNodeName) {
        this.connectionRegistry.forEach(conn => {
            if (conn.sg.name === movingNodeName || conn.eg.name === movingNodeName) {
                const sp = conn.sg.position.clone(); sp.y = this.config.CONNECTION_Y;
                const ep = conn.eg.position.clone(); ep.y = this.config.CONNECTION_Y;
                const m1 = sp.clone().lerp(ep, 0.33); m1.y = this.config.CONNECTION_Y;
                const m2 = sp.clone().lerp(ep, 0.66); m2.y = this.config.CONNECTION_Y;
                conn.curve.points = [sp, m1, m2, ep];
                
                const currentWidth = conn.mesh.userData.currentWidth || 4.0;
                conn.mesh.geometry.dispose();

                if (conn.mesh.userData.renderType === 'ribbon') {
                    const ribbonWidth = Math.max(2.4, currentWidth * 1.8);
                    conn.mesh.geometry = createRibbonGeometry(conn.curve, ribbonWidth, 64);
                } else {
                    const radius = Math.max(0.3, currentWidth / 2.5);
                    conn.mesh.geometry = new THREE.TubeGeometry(conn.curve, 64, radius, 8, false);
                }

                if (conn.mesh.userData.hitMesh) {
                    const hitRadius = Math.max(0.6, (currentWidth / 2.5) * 2.2);
                    conn.mesh.userData.hitMesh.geometry.dispose();
                    conn.mesh.userData.hitMesh.geometry = new THREE.TubeGeometry(conn.curve, 64, hitRadius, 8, false);
                }

                if (conn.mesh.material.map) {
                    const dist = sp.distanceTo(ep);
                    if (conn.mesh.userData.type === 'dashed') {
                        conn.mesh.material.map.repeat.set(dist / 4, 1);
                    } else {
                        conn.mesh.material.map.repeat.set(dist / 28, Math.max(0.6, 10 / Math.max(2, currentWidth)));
                    }
                }
            }
        });
    }

    applyComponentMoves(moves) {
        if (!moves || !Array.isArray(moves)) return;
        moves.forEach(m => {
            const id = m.id.toLowerCase();
            const g = this.componentGroupsMap[id];
            if (g) {
                g.position.x = m.x * this.config.LAYOUT_SPREAD;
                g.position.z = -m.y * this.config.LAYOUT_SPREAD;
                g.updateMatrixWorld();
                this.updateConnectedLines(g.name);
            }
        });
    }

    buildConnections(connections) {
        if (!connections) return;
        connections.forEach(c => {
            const realFrom = c.from.toLowerCase();
            const realTo = c.to.toLowerCase();
            const renderFrom = this.getRenderParentId(realFrom);
            const renderTo = this.getRenderParentId(realTo);

            if (renderFrom === renderTo) {
                if (this.isGroup(renderFrom) && this.config.expandedGroupId !== renderFrom) return;
            }

            const sg = this.componentGroupsMap[renderFrom];
            const eg = this.componentGroupsMap[renderTo];
            
            if (sg && eg) {
                const connID = `${realFrom}_${realTo}`;
                const style = this.config.getConnectionStyle(connID);
                const width = style.width !== undefined ? style.width : 4.0;
                
                const sp = sg.position.clone(); sp.y = this.config.CONNECTION_Y;
                const ep = eg.position.clone(); ep.y = this.config.CONNECTION_Y;
                
                const m1 = sp.clone().lerp(ep, 0.33); m1.y = this.config.CONNECTION_Y;
                const m2 = sp.clone().lerp(ep, 0.66); m2.y = this.config.CONNECTION_Y;
                const curve = new THREE.CatmullRomCurve3([sp, m1, m2, ep]);

                const ribbonWidth = Math.max(2.4, width * 1.8);
                const geometry = this.config.USE_RIBBON_CONNECTIONS
                    ? createRibbonGeometry(curve, ribbonWidth, 64)
                    : new THREE.TubeGeometry(curve, 64, Math.max(0.3, width / 2.5), 8, false);
                
                let texture = null;
                if (style.type === 'solid') {
                    texture = null; 
                } else if (style.type === 'dashed') {
                    texture = createDashTexture();
                    texture.repeat.set(sp.distanceTo(ep) / 4, 1);
                } else {
                    texture = createFlowTexture();
                    texture.repeat.set(sp.distanceTo(ep) / 28, Math.max(0.6, 10 / Math.max(2, width)));
                }
                
                const mat = new THREE.MeshBasicMaterial({
                    map: texture, 
                    color: style.color, 
                    transparent: true, 
                    opacity: style.opacity,
                    blending: THREE.AdditiveBlending, 
                    side: THREE.DoubleSide, 
                    depthWrite: false
                });
                
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.name = `CONN_${connID}`;
                mesh.userData = { 
                    isConnection: true, id: connID, texture: texture, 
                    speed: style.speed, currentWidth: width, type: style.type,
                    baseOpacity: style.opacity, renderType: this.config.USE_RIBBON_CONNECTIONS ? 'ribbon' : 'tube'
                };

                const hitRadius = Math.max(0.6, (width / 2.5) * 2.2);
                const hitGeometry = new THREE.TubeGeometry(curve, 64, hitRadius, 8, false);
                const hitMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
                const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
                hitMesh.name = `CONN_${connID}`;
                hitMesh.userData = { isConnection: true, id: connID, isHitArea: true };
                mesh.userData.hitMesh = hitMesh;
                
                this.scene.add(mesh);
                this.scene.add(hitMesh);
                this.connectionRegistry.push({ mesh, curve, sp, ep, sg, eg, realFrom, realTo });
            }
        });
    }

    updateSelectionVisuals() {
        Object.keys(this.componentGroupsMap).forEach(sid => {
            const g = this.componentGroupsMap[sid];
            let highlightMesh = null;
            g.children.forEach(c => {
                if (c.userData && c.userData.isHighlight) highlightMesh = c;
            });
            
            const isSelected = this.config.multiSelectedIds.has(sid);
            
            if (isSelected && !highlightMesh) {
                const w = g.userData.dimensions ? g.userData.dimensions.width + 4 : 35;
                const d = g.userData.dimensions ? g.userData.dimensions.depth + 4 : 35;
                const h = g.userData.dimensions ? this.config.TANK_HEIGHT * 1.2 + 4 : 45;
                const highlight = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, d), 
                    new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true, transparent: true, opacity: 0.25 })
                );
                highlight.userData.isHighlight = true;
                g.add(highlight);
            } else if (!isSelected && highlightMesh) {
                g.remove(highlightMesh);
                if (highlightMesh.geometry) highlightMesh.geometry.dispose();
                if (highlightMesh.material) highlightMesh.material.dispose();
            }
        });
    }

    getRenderParentId(componentId) {
        const safeCompId = componentId ? componentId.toLowerCase() : '';
        for (const [gId, group] of Object.entries(this.config.componentGroups)) {
            if (group.children.includes(safeCompId)) {
                if (this.config.expandedGroupId === gId) return safeCompId;
                return gId;
            }
        }
        return safeCompId;
    }

    isGroup(id) {
        return id && id.toLowerCase().startsWith('group_');
    }

    // Used by UI to force-rebuild logic when properties change (like ThreeScene's `rebuildVisuals()`)
    rebuildScene(structureData, modelConfig, annotations, componentGroups = {}, expandedGroupId = null) {
        this.config.componentGroups = componentGroups;
        this.config.expandedGroupId = expandedGroupId;
        this.currentDocument = cloneSceneDocument({
            metadata: {
                ...(this.currentDocument?.metadata || {}),
                viewMode: this.currentView
            },
            topology: structureData,
            visual: {
                modelConfig,
                annotations,
                componentGroups,
                expandedGroupId
            }
        });
        
        this.clearScene();
        if(!structureData || !structureData.components) return;
        
        const myVersion = this.currentRenderVersion;
        const nodesToRender = new Set();
        
        structureData.components.forEach(c => {
             const renderId = this.getRenderParentId(c.id);
             nodesToRender.add(renderId);
        });

        nodesToRender.forEach(renderId => {
             if (this.isGroup(renderId)) {
                 const groupData = this.config.componentGroups[renderId];
                 if (groupData) this.createGroupVisuals(groupData, structureData.components, myVersion, modelConfig);
             } else {
                 const compData = structureData.components.find(c => c.id.toLowerCase() === renderId.toLowerCase());
                 if (compData) {
                     this.buildSingleComponentVisual(compData, modelConfig, annotations, myVersion);
                 }
             }
        });

        this.buildConnections(structureData.connections);
        this.updateSelectionVisuals();
    }
}

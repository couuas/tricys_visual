<template>
  <div 
    class="three-container" 
    ref="threeContainer"
    :class="{ 'hide-labels': !showLabels, 'hide-values': !showValues }"
  >
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-text">LOADING SCENE</div>
      <div class="loading-sub">Building Digital Twin...</div>
    </div>
    
    <div v-if="hoverInfo.visible" class="hover-tooltip" :style="{ top: hoverInfo.y + 'px', left: hoverInfo.x + 'px' }">
      <div class="tooltip-header">
        <span class="tooltip-title">{{ hoverInfo.id.toUpperCase() }}</span>
        <span class="tooltip-type">{{ hoverInfo.type }}</span>
      </div>

      <div v-if="hoverInfo.alertRule" class="alert-row">
        <span class="alert-icon">⚠️</span>
        <span class="alert-text">{{ hoverInfo.alertRule }}</span>
      </div>
      <div v-if="hoverInfo.params && hoverInfo.params.length > 0" class="params-section">
         <div v-for="p in hoverInfo.params" :key="p.name" class="tooltip-row" :class="{ 'param-modified': isParamChanged(p) }">
            <span class="param-label">{{ p.shortName }}</span>
            <div class="param-value-group">
                <span class="value">{{ formatParamValue(p.value) }}</span>
                <span v-if="isParamChanged(p)" class="default-val">Default: {{ formatParamValue(p.defaultValue) }}</span>
            </div>
         </div>
      </div>
      <div v-if="hoverInfo.note" class="tooltip-note">
        <div class="note-label">Annotation:</div>
        <div class="note-content">{{ hoverInfo.note }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSimulation } from '../composables/useSimulation';
import { useRouter } from 'vue-router';

const emit = defineEmits(['selectComponent', 'groupContext']);
const router = useRouter();

const { 
  simulationData, currentTime, isPlaying, stepTime, 
  modelConfig, annotations, loadModelConfig, loadAnnotations,
  saveComponentPosition, getCurrentDataSlice, loadData,
  componentParams, showLabels, showValues, alertRules,
  selectedConnectionId, connectionStyles, getConnectionStyle, defaultConnectionStyle,
  multiSelectedIds, toggleMultiSelect, componentGroups, expandedGroupId, getRenderParentId, isGroup, structureData,
  isExpanded, setExpandedGroup, isReadOnly
} = useSimulation();

const threeContainer = ref(null);
const isLoading = ref(true);

let scene, camera, renderer, labelRenderer, controls;
let reqId;

// [关键修复] 渲染版本号，用于解决异步竞态导致的重影
let currentRenderVersion = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const planeIntersect = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const isDragging = ref(false);
const draggedObject = ref(null);
const dragStartPos = new THREE.Vector2();
const rightClickStartPos = new THREE.Vector2();

let hoverTimer = null;
const HOVER_DELAY = 400;

const fluidMeshesMap = {}; 
const customMeshesMap = {};
const valueLabelsMap = {};
const componentGroupsMap = {}; 
let connectionRegistry = []; 

const LAYOUT_SPREAD = 2.8; 
const VISUAL_MAX_INVENTORY = 3500; 
const TANK_HEIGHT = 36;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

const hoverInfo = reactive({ visible: false, x: 0, y: 0, id: '', type: '', value: 0, note: '', params: [], alertRule: null });

const deepDispose = (object) => {
  if (!object) return;
  object.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
          for (const key of Object.keys(m)) {
            if (m[key] && m[key].isTexture) m[key].dispose();
          }
          m.dispose();
        });
      }
    }
  });
  if (object.parent) object.parent.remove(object);
};

const groupMaterial = new THREE.MeshPhysicalMaterial({ color: 0x00d2ff, metalness: 0.2, roughness: 0.1, transmission: 0.4, opacity: 0.4, transparent: true, side: THREE.DoubleSide, depthWrite: false });
const groupHighlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, transparent: true, opacity: 0.3 });

const formatParamValue = (val) => { if (Array.isArray(val)) return `[${val.map(v => Number.isInteger(v)?v:v.toFixed(2)).join(', ')}]`; if (typeof val === 'number') return Number.isInteger(val) ? val : val.toFixed(4); return val; };

const isParamChanged = (p) => {
    if (p.value === undefined || p.defaultValue === undefined) return false;
    // Simple comparison, considering both might be numbers or strings
    return String(p.value) !== String(p.defaultValue);
};

const initThree = () => {
  if (!threeContainer.value || renderer) return;
  const w = threeContainer.value.clientWidth;
  const h = threeContainer.value.clientHeight;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.0012);
  const grid = new THREE.GridHelper(1000, 50, 0x222233, 0x0d0d1a);
  scene.add(grid); // Grid is permanent
  
  camera = new THREE.PerspectiveCamera(55, w / h, 1, 8000);
  camera.position.set(0, 450, 600);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.useLegacyLights = false; 
  renderer.toneMapping = THREE.ACESFilmicToneMapping; 
  renderer.toneMappingExposure = 1.2; 
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeContainer.value.appendChild(renderer.domElement);
  
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none'; 
  threeContainer.value.appendChild(labelRenderer.domElement);
  
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  
  // Lights are permanent
  const ambient = new THREE.AmbientLight(0xffffff, 2.5); 
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
  dirLight.position.set(200, 400, 200);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xb0c4de, 1.8);
  fillLight.position.set(-200, 200, -200);
  scene.add(fillLight);
  const blueLight = new THREE.PointLight(0x0088ff, 2, 1000);
  blueLight.position.set(0, 200, 0);
  scene.add(blueLight);
  
  dragPlane.setComponents(0, -1, 0, TANK_HEIGHT / 2);
  
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);
};

// ... (Textures helper functions remain same) ...
const createFlowTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 180, 0);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 20, 180, 24); 
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(180, 10); ctx.lineTo(240, 32); ctx.lineTo(180, 54); ctx.closePath();
  ctx.fill();
  ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 15;
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1); 
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
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

const createDefaultCylinder = (g, id) => {
  const tG = new THREE.CylinderGeometry(14, 14, TANK_HEIGHT, 32);
  const tM = new THREE.MeshPhysicalMaterial({ color: 0x888899, metalness: 0.1, roughness: 0.1, transmission: 0.95, thickness: 2.0, opacity: 0.2, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const t = new THREE.Mesh(tG, tM); t.name = "tank_shell"; g.add(t);
  const fG = new THREE.CylinderGeometry(12.5, 12.5, TANK_HEIGHT, 32); fG.translate(0, TANK_HEIGHT/2, 0); 
  const fM = new THREE.MeshPhongMaterial({ color: 0x00ccff, emissive: 0x002244, opacity: 0.85, transparent: true, side: THREE.DoubleSide });
  const f = new THREE.Mesh(fG, fM); f.position.y = -TANK_HEIGHT/2; f.scale.set(1, 0.5, 1); f.name = "tank_fluid";
  g.add(f); fluidMeshesMap[id] = f;
};

// [关键修复] 引入 version 参数防止旧的回调写入新场景
const loadCustomModel = (url, configScale, group, compID, version) => {
  const loader = new GLTFLoader();
  // Removed ?t= to allow caching
  const safeUrl = url; 
  loader.load(safeUrl, (gltf) => {
    // 竞态保护：如果版本号已过期，丢弃结果
    if (version !== currentRenderVersion) {
        deepDispose(gltf.scene);
        return;
    }

    const m = gltf.scene; m.name = "custom_model";
    const b = new THREE.Box3().setFromObject(m);
    const s = new THREE.Vector3(); b.getSize(s);
    
    // Improved Scaling: Use Max Dimension
    const maxDim = Math.max(s.x, s.y, s.z) || 1;
    const targetSize = TANK_HEIGHT; 
    const fs = (targetSize / maxDim) * (configScale || 1.0);
    
    m.scale.set(fs, fs, fs);
    const nb = new THREE.Box3().setFromObject(m); const c = new THREE.Vector3(); nb.getCenter(c);
    // Align bottom to y=0 relative to container, then adjust for center
    // Actually original logic centered it. Let's keep it centered relative to group 0,0,0
    m.position.sub(c); // Center at 0,0,0
    
    m.traverse((ch) => {
      if (ch.isMesh) {
        if (ch.material.isMeshStandardMaterial || ch.material.isMeshPhysicalMaterial) {
             ch.material.metalness = 0.2; ch.material.roughness = Math.max(ch.material.roughness, 0.5); 
        }
        ch.material.side = THREE.DoubleSide; ch.castShadow = true; ch.receiveShadow = true;
        if (ch.material.map) ch.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    group.add(m); customMeshesMap[compID] = m;
  }, undefined, (e) => { 
      if (version !== currentRenderVersion) return;
      console.warn(`Failed ${url}`, e); 
      createDefaultCylinder(group, compID); 
  });
};

const reloadComponent = (id) => {
    if (!id) return; 
    
    const sid = isGroup(id) ? id : id.toLowerCase(); 
    const g = componentGroupsMap[sid]; 
    if (!g) return; 
    
    // Clear children first
    for (let i = g.children.length - 1; i >= 0; i--) {
        const c = g.children[i];
        if (c.isMesh || c.isGroup || ['custom_model', 'tank_shell', 'tank_fluid'].includes(c.name)) {
            deepDispose(c);
        }
    }
    delete fluidMeshesMap[sid]; 
    delete customMeshesMap[sid];
    
    const cfg = modelConfig.value[sid];
    
    // 使用当前版本号
    if (g.userData.isGroup) {
        if (cfg && cfg.type === 'custom') {
            loadCustomModel(`${BACKEND_URL}${cfg.url}`, cfg.scale, g, sid, currentRenderVersion);
        } else {
            const dims = g.userData.dimensions || { width: 50, depth: 50 };
            const geometry = new THREE.BoxGeometry(dims.width, TANK_HEIGHT * 1.2, dims.depth);
            const mesh = new THREE.Mesh(geometry, groupMaterial);
            g.add(mesh);
        }
    } else {
        if (cfg && cfg.type === 'custom') {
            loadCustomModel(`${BACKEND_URL}${cfg.url}`, cfg.scale, g, sid, currentRenderVersion);
        } else {
            createDefaultCylinder(g, sid);
        }
    }
    
    if (multiSelectedIds.value.has(sid) || selectedConnectionId.value === sid) {
        const boxSize = g.userData.isGroup ? 
            { x: (g.userData.dimensions?.width || 50) + 4, z: (g.userData.dimensions?.depth || 50) + 4 } : 
            { x: 35, z: 35 };
            
        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(boxSize.x, TANK_HEIGHT * 1.2 + 2, boxSize.z), 
            groupHighlightMaterial
        );
        g.add(highlight);
    }
};

const createSingleComponentVisual = (c, version) => {
    const x = c.position.x * LAYOUT_SPREAD;
    const z = -c.position.y * LAYOUT_SPREAD;
    const sid = c.id.toLowerCase();
    
    const g = new THREE.Group(); 
    g.position.set(x, TANK_HEIGHT/2, z); 
    g.name = sid;
    // [关键修复] 标记为系统组件，便于后续清理
    g.userData = { isSystemObj: true };

    const cfg = modelConfig.value[sid];
    if (cfg && cfg.type === 'custom') loadCustomModel(`${BACKEND_URL}${cfg.url}`, cfg.scale, g, sid, version);
    else createDefaultCylinder(g, sid);

    const div = document.createElement('div'); div.className = 'label-container';
    const nameDiv = document.createElement('div'); nameDiv.className = 'label-name'; nameDiv.textContent = c.id;
    const valDiv = document.createElement('div'); valDiv.className = 'label-value'; valDiv.textContent = '---';
    div.appendChild(nameDiv); div.appendChild(valDiv);
    const l = new CSS2DObject(div); l.position.set(0, TANK_HEIGHT + 5, 0);
    valueLabelsMap[sid] = valDiv; 
    g.add(l);

    if (multiSelectedIds.value.has(sid)) {
        const highlight = new THREE.Mesh(new THREE.BoxGeometry(35, 45, 35), groupHighlightMaterial);
        g.add(highlight);
    }

    componentGroupsMap[sid] = g; 
    scene.add(g);
};

const createGroupVisuals = (groupData, allComponents, version) => {
    // [关键修复] 强制使用小写对比，解决找不到子组件导致聚合不显示的问题
    const childrenComps = allComponents.filter(c => groupData.children.includes(c.id.toLowerCase()));
    
    // 如果没有找到子组件（理论上不应发生，但作为防御），不渲染
    if (childrenComps.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    childrenComps.forEach(c => {
        const x = c.position.x * LAYOUT_SPREAD;
        const z = -c.position.y * LAYOUT_SPREAD;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    });

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const width = Math.max(40, (maxX - minX) + 40);
    const depth = Math.max(40, (maxZ - minZ) + 40);
    
    const g = new THREE.Group();
    g.position.set(centerX, TANK_HEIGHT/2, centerZ);
    g.name = groupData.id;
    
    // [关键修复] 标记
    g.userData = { 
        isGroup: true, 
        isSystemObj: true, // 标记为系统对象
        groupId: groupData.id,
        dimensions: { width, depth } 
    };

    const expanded = isExpanded(groupData.id);

    if (expanded) {
        const geometry = new THREE.BoxGeometry(width, TANK_HEIGHT * 1.5, depth);
        const frame = new THREE.Mesh(
            geometry, 
            new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true, opacity: 0.3, transparent: true })
        );
        g.add(frame);

        const div = document.createElement('div'); 
        div.className = 'label-container group-label';
        div.innerHTML = `<div class="label-name group" style="border:1px dashed #00d2ff; background:none;">Inside: ${groupData.name}</div>`;
        const l = new CSS2DObject(div); 
        l.position.set(0, TANK_HEIGHT * 0.8, 0);
        g.add(l);

    } else {
        const cfg = modelConfig.value[groupData.id];
        
        if (cfg && cfg.type === 'custom') {
            loadCustomModel(`${BACKEND_URL}${cfg.url}`, cfg.scale, g, groupData.id, version);
        } else {
            const geometry = new THREE.BoxGeometry(width, TANK_HEIGHT * 1.2, depth);
            const mesh = new THREE.Mesh(geometry, groupMaterial);
            g.add(mesh);
        }

        const div = document.createElement('div'); 
        div.className = 'label-container group-label';
        div.innerHTML = `<div class="label-name group">${groupData.name}</div>`;
        const l = new CSS2DObject(div); 
        l.position.set(0, TANK_HEIGHT/2 + 15, 0);
        g.add(l);

        if (multiSelectedIds.value.has(groupData.id)) {
             const highlight = new THREE.Mesh(new THREE.BoxGeometry(width + 4, TANK_HEIGHT * 1.2 + 4, depth + 4), groupHighlightMaterial);
             g.add(highlight);
        }
    }

    componentGroupsMap[groupData.id] = g;
    scene.add(g);
};

const buildScene = async (d) => {
  if (!d || !d.components) return;
  isLoading.value = true;
  
  // [关键修复] 版本号自增，废弃旧的异步回调
  const myVersion = ++currentRenderVersion;
  
  if (Object.keys(modelConfig.value).length === 0) await loadModelConfig();
  await loadAnnotations();

  // [关键修复] 基于 Scene 遍历进行暴力清理，而不仅仅依赖 Map
  // 倒序遍历删除，防止索引错乱
  for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      // 删除所有标记为系统组件的对象，或者连线对象
      if (child.userData.isSystemObj || (child.name && child.name.startsWith("CONN_"))) {
          // 清理 HTML Label 特殊处理
          child.traverse(c => {
              if (c.isCSS2DObject && c.element && c.element.parentNode) {
                  c.element.parentNode.removeChild(c.element);
              }
          });
          
          deepDispose(child);
      }
  }

  // 重置映射表
  for (const key in fluidMeshesMap) delete fluidMeshesMap[key];
  for (const key in customMeshesMap) delete customMeshesMap[key];
  for (const key in valueLabelsMap) delete valueLabelsMap[key];
  for (const key in componentGroupsMap) delete componentGroupsMap[key];
  connectionRegistry = [];

  const nodesToRender = new Set();
  
  // [关键] ID 归一化
  d.components.forEach(c => {
      // 不论后端给的是 "Plasma" 还是 "plasma"，这里都归一化为小写去查找归属
      const renderId = getRenderParentId(c.id);
      nodesToRender.add(renderId);
  });

  nodesToRender.forEach(renderId => {
      // 这里的 renderId 已经被 getRenderParentId 转为小写了
      if (isGroup(renderId)) {
          const groupData = componentGroups.value[renderId];
          if (groupData) createGroupVisuals(groupData, d.components, myVersion);
      } else {
          // 在原始列表中查找时，也要忽略大小写
          const compData = d.components.find(c => c.id.toLowerCase() === renderId.toLowerCase());
          if (compData) createSingleComponentVisual(compData, myVersion);
      }
  });
  
  buildConnections(d.connections);
  isLoading.value = false;
};

const buildConnections = (connections) => {
    if (!connections) return;
    connections.forEach(c => {
        const realFrom = c.from.toLowerCase();
        const realTo = c.to.toLowerCase();
        const renderFrom = getRenderParentId(realFrom);
        const renderTo = getRenderParentId(realTo);

        if (renderFrom === renderTo) {
            if (isGroup(renderFrom) && expandedGroupId.value !== renderFrom) return;
        }

        const sg = componentGroupsMap[renderFrom];
        const eg = componentGroupsMap[renderTo];
        
        if (sg && eg) {
            const connID = `${realFrom}_${realTo}`;
            const style = getConnectionStyle(connID);
            const width = style.width !== undefined ? style.width : 4.0;
            
            const sp = sg.position.clone(); sp.y = 5;
            const ep = eg.position.clone(); ep.y = 5;
            
            const m1 = sp.clone().lerp(ep, 0.33); m1.y += 5;
            const m2 = sp.clone().lerp(ep, 0.66); m2.y += 5;
            const curve = new THREE.CatmullRomCurve3([sp, m1, m2, ep]);

            const radius = Math.max(0.3, width / 2.5);
            const geometry = new THREE.TubeGeometry(curve, 64, radius, 8, false);
            
            // [修复] 严格区分 solid, dashed 和 flow
            let texture = null;
            if (style.type === 'solid') {
                texture = null; // 实线不使用纹理
            } else if (style.type === 'dashed') {
                texture = createDashTexture();
                texture.repeat.set(sp.distanceTo(ep) / 4, 1);
            } else {
                // 默认为 flow
                texture = createFlowTexture();
                texture.repeat.set(sp.distanceTo(ep) / 20, 1);
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
                speed: style.speed, currentWidth: width, type: style.type 
            };
            
            scene.add(mesh);
            connectionRegistry.push({ mesh, curve, sp, ep, sg, eg, realFrom, realTo });
        }
    });
};

// ... (Rest of event handlers remain similar but standard) ...

const updateConnectedLines = (movingNodeName) => {
    connectionRegistry.forEach(conn => {
        if (conn.sg.name === movingNodeName || conn.eg.name === movingNodeName) {
            const sp = conn.sg.position.clone(); sp.y = 5;
            const ep = conn.eg.position.clone(); ep.y = 5;
            const m1 = sp.clone().lerp(ep, 0.33); m1.y += 5;
            const m2 = sp.clone().lerp(ep, 0.66); m2.y += 5;
            conn.curve.points = [sp, m1, m2, ep];
            
            const currentWidth = conn.mesh.userData.currentWidth || 4.0;
            const radius = Math.max(0.3, currentWidth / 2.5);
            conn.mesh.geometry.dispose();
            conn.mesh.geometry = new THREE.TubeGeometry(conn.curve, 64, radius, 8, false);
            
            if (conn.mesh.material.map) {
                const repeatFactor = conn.mesh.userData.type === 'dashed' ? 4 : 20;
                conn.mesh.material.map.repeat.set(sp.distanceTo(ep) / repeatFactor, 1);
            }
        }
    });
};

const getIntersectedComponent = (clientX, clientY) => {
    if (!threeContainer.value || !camera) return null;
    const rect = threeContainer.value.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        while (obj.parent && obj.parent !== scene) {
            if (componentGroupsMap[obj.name]) return { id: obj.name, object: obj.parent };
            obj = obj.parent;
        }
        if (componentGroupsMap[obj.name]) return { id: obj.name, object: obj };
    }
    return null;
};

const getIntersectedConnection = (clientX, clientY) => {
    if (!threeContainer.value || !camera) return null;
    const rect = threeContainer.value.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (obj.name && obj.name.startsWith("CONN_")) return obj;
    }
    return null;
};

const onContextMenu = (event) => {
    event.preventDefault(); 
    
    // [新增逻辑] 检查是否是拖拽导致的右键释放
    const dist = rightClickStartPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    if (dist > 5) {
        return;
    }

    const resComp = getIntersectedComponent(event.clientX, event.clientY);
    if (resComp) {
        if (event.shiftKey) {
             toggleMultiSelect(resComp.id);
             rebuildVisuals(); 
        } else {
             emit('selectComponent', resComp.id); 
             selectedConnectionId.value = null; 
        }

        return;
    }
    const resConn = getIntersectedConnection(event.clientX, event.clientY);
    if (resConn) {
        selectedConnectionId.value = resConn.userData.id;
        emit('selectComponent', null);
        return;
    }
    emit('selectComponent', null);
    selectedConnectionId.value = null;
};

const onPointerDown = (event) => {
    if (event.button === 2) {
        rightClickStartPos.set(event.clientX, event.clientY);
    }

    if (event.button !== 0) return; 
    const res = getIntersectedComponent(event.clientX, event.clientY);
    if (res) {
        if (event.shiftKey) {
             toggleMultiSelect(res.id);
             rebuildVisuals();
             return;
        }
        
        if (isReadOnly.value) {
            // Read Only mode: Left click does nothing (allows OrbitControls to work).
            // Right click is used for inspecting/opening editor.
            return;
        }

        isDragging.value = true;
        controls.enabled = false;
        draggedObject.value = res.object;
        dragStartPos.set(event.clientX, event.clientY);
        const normal = new THREE.Vector3(0, 1, 0); 
        dragPlane.setFromNormalAndCoplanarPoint(normal, res.object.position);
        const rect = threeContainer.value.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            dragOffset.subVectors(res.object.position, planeIntersect);
        }
    }
};

const onPointerMove = (event) => {
    if (isDragging.value && draggedObject.value) {
        const rect = threeContainer.value.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
            const newPos = planeIntersect.add(dragOffset);
            draggedObject.value.position.set(newPos.x, TANK_HEIGHT/2, newPos.z);
            draggedObject.value.updateMatrixWorld();
            updateConnectedLines(draggedObject.value.name);
        }
        return;
    }

    hoverInfo.visible = false;
    if (hoverTimer) clearTimeout(hoverTimer);
    if (event.target.closest('.ui-panel') || event.target.closest('.editor-panel')) return;

    hoverTimer = setTimeout(() => {
        const res = getIntersectedComponent(event.clientX, event.clientY);
        if (res) {
            const id = res.id;
            if (isGroup(id)) {
                hoverInfo.visible = true;
                hoverInfo.x = event.clientX + 15; hoverInfo.y = event.clientY + 15;
                hoverInfo.id = id;
                hoverInfo.type = "Component Group";
                hoverInfo.value = "---"; 
                hoverInfo.note = "Double click to view inside";
                hoverInfo.params = [];
                hoverInfo.alertRule = null;
            } else {
                const d = getCurrentDataSlice();
                const cfg = modelConfig.value[id];
                hoverInfo.visible = true;
                hoverInfo.x = event.clientX + 15; hoverInfo.y = event.clientY + 15;
                hoverInfo.id = id;
                hoverInfo.value = d[id] !== undefined ? d[id].toFixed(1) : '---';
                hoverInfo.type = (cfg && cfg.type === 'custom') ? 'Custom Model' : 'Default Tank';
                hoverInfo.note = annotations.value[id] || '';
                
                // [Modified] Filter and map all parameters for this component
                const prefix = id.toLowerCase() + '.';
                // Use safe logic if componentParams is array
                if (Array.isArray(componentParams.value)) {
                    hoverInfo.params = componentParams.value
                        .filter(p => p.name.toLowerCase().startsWith(prefix))
                        .map(p => ({
                            name: p.name,
                            shortName: p.name.substring(prefix.length), // Remove prefix
                            value: p.value,
                            defaultValue: p.defaultValue
                        }));
                } else {
                    hoverInfo.params = [];
                }

                const rule = alertRules.value[id];
                if (rule && rule.enabled) hoverInfo.alertRule = `Inventory ${rule.operator} ${rule.threshold}`; else hoverInfo.alertRule = null;
            }
            threeContainer.value.style.cursor = 'pointer';
        } else {
            hoverInfo.visible = false;
            threeContainer.value.style.cursor = 'default';
        }
    }, HOVER_DELAY);
};

const onPointerUp = async (event) => {
    if (isDragging.value && draggedObject.value) {
        isDragging.value = false;
        controls.enabled = true;
        threeContainer.value.style.cursor = 'default';
        if (!isGroup(draggedObject.value.name)) {
             const finalX = draggedObject.value.position.x / LAYOUT_SPREAD;
             const finalY = -draggedObject.value.position.z / LAYOUT_SPREAD;
             await saveComponentPosition(draggedObject.value.name, finalX, finalY);
        }
        draggedObject.value = null;
        return;
    }
};

const onDoubleClick = (event) => {
    const result = getIntersectedComponent(event.clientX, event.clientY);
    if (result) {
        const id = result.id;
        if (isGroup(id)) {
            if (isExpanded(id)) setExpandedGroup(null);
            else setExpandedGroup(id);
        } else {
             router.push({ name: 'component-detail', params: { id: id } });
        }
    } else {
        if (expandedGroupId.value) setExpandedGroup(null);
    }
};

const rebuildVisuals = () => {
    if (structureData.value) buildScene(structureData.value);
};

const updateMeshGeometry = (mesh, width) => {
    const entry = connectionRegistry.find(r => r.mesh === mesh);
    if (!entry || mesh.userData.currentWidth === width) return;
    const radius = Math.max(0.3, width / 2.5);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(entry.curve, 64, radius, 8, false);
    mesh.userData.currentWidth = width;
};

const applyStyleToMesh = (mesh, style) => {
    if (!mesh || !mesh.material) return;
    mesh.material.color.set(style.color);
    mesh.material.opacity = style.opacity;
    const newWidth = style.width !== undefined ? style.width : 4.0;
    updateMeshGeometry(mesh, newWidth);
    let newTexture = null;
    if (style.type === 'solid') newTexture = null;
    else if (style.type === 'dashed') newTexture = mesh.userData.type !== 'dashed' ? createDashTexture() : mesh.material.map;
    else newTexture = mesh.userData.type !== 'flow' ? createFlowTexture() : mesh.material.map;
    if (newTexture) {
         const entry = connectionRegistry.find(r => r.mesh === mesh);
         if (entry) {
             const repeatFactor = style.type === 'dashed' ? 4 : 20;
             newTexture.repeat.set(entry.sp.distanceTo(entry.ep) / repeatFactor, 1);
         }
    }
    mesh.material.map = newTexture;
    mesh.userData.texture = newTexture;
    mesh.userData.type = style.type;
    mesh.material.needsUpdate = true;
    mesh.userData.speed = style.speed;
};

watch(connectionStyles, (newStyles) => {
    scene.children.forEach(child => {
        if (child.name.startsWith("CONN_")) {
            const id = child.userData.id;
            const style = newStyles['ALL'] ? { ...defaultConnectionStyle, ...newStyles['ALL'] } : (newStyles[id] || defaultConnectionStyle);
            applyStyleToMesh(child, style);
        }
    });
}, { deep: true });

// [关键修复] 监听数据变化时重建场景
watch(() => [componentGroups.value, expandedGroupId.value, multiSelectedIds.value], () => {
    rebuildVisuals();
}, { deep: true });

const updateVisuals = () => {
  const d = getCurrentDataSlice();
  for (const safeID in valueLabelsMap) {
    const val = d[safeID];
    const hasData = (val !== undefined);
    let ratio = 0;
    if (hasData) ratio = Math.max(0.0, Math.min(1.0, val / VISUAL_MAX_INVENTORY));
    const fluid = fluidMeshesMap[safeID];
    if (fluid) {
      fluid.scale.y = hasData ? Math.max(0.02, ratio) : 0.5;
      fluid.material.color.setHSL(hasData ? ratio * 0.6 : 0.55, 0.9, 0.5);
      if(!hasData) fluid.material.color.setHex(0x00ccff);
    }
    const c = customMeshesMap[safeID];
    if (c) {
      c.traverse(ch => {
        if (ch.isMesh && ch.material && ch.material.emissive) {
          if(hasData) {
             if (ch.userData.origEmissive) {
                 ch.material.emissive.copy(ch.userData.origEmissive);
                 ch.material.emissiveIntensity = ch.userData.origEmissiveIntensity;
             } else {
                 ch.material.emissive.setHex(0x000000);
                 ch.material.emissiveIntensity = 0;
             }
          }
        }
      });
    }
    const label = valueLabelsMap[safeID];
    if (label) label.textContent = hasData ? val.toFixed(1) : '';
  }
};

const animate = () => {
  reqId = requestAnimationFrame(animate);
  if (isPlaying.value) stepTime(0.1);
  scene.children.forEach(child => {
      if (child.name.startsWith("CONN_") && child.material.map) {
          const speed = child.userData.speed !== undefined ? child.userData.speed : 1.0;
          if (speed > 0) child.material.map.offset.x -= 0.002 * speed;
      }
  });
  updateVisuals();
  if (controls) controls.update();
  if (renderer) { renderer.render(scene, camera); labelRenderer.render(scene, camera); }
};

const onResize = () => {
  if (!threeContainer.value || !renderer || !camera) return;
  const w = threeContainer.value.clientWidth;
  const h = threeContainer.value.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); labelRenderer.setSize(w, h);
};

let resizeObserver;
onMounted(async () => {
  initThree();
  resizeObserver = new ResizeObserver(() => onResize());
  resizeObserver.observe(threeContainer.value);
  window.addEventListener('dblclick', onDoubleClick);
  const structData = await loadData();
  if (structData) { await buildScene(structData); animate(); } else { isLoading.value = false; }
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('dblclick', onDoubleClick);
  if (reqId) cancelAnimationFrame(reqId);
  if (renderer) renderer.dispose();
  const canvas = renderer.domElement;
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('contextmenu', onContextMenu);
  connectionRegistry.length = 0;
});

defineExpose({ reloadComponent });
</script>

<style scoped>
/* [Changed 100vh to 100% to fit parent container] */
.three-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; background: radial-gradient(circle at center, #11111a 0%, #000000 100%); overflow: hidden; z-index: 0; }
.hide-labels :deep(.label-name) { display: none !important; }
.hide-values :deep(.label-value) { display: none !important; }
.loading-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; z-index: 1000; }
.loading-text { color: #00d2ff; font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #00d2ff; }
.loading-sub { color: #888; font-size: 14px; margin-top: 5px; }
.hover-tooltip { position: fixed; z-index: 9999; background: rgba(10, 15, 20, 0.95); border: 1px solid rgba(0, 210, 255, 0.5); border-radius: 8px; padding: 12px; pointer-events: none; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6); min-width: 200px; max-width: 380px; backdrop-filter: blur(8px); transform: translate(10px, 10px); }
.tooltip-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 6px; margin-bottom: 8px; }
.tooltip-title { color: #00d2ff; font-weight: bold; font-size: 14px; }
.tooltip-type { color: #666; font-size: 10px; text-transform: uppercase; }
/* Tooltip Refined Layout */
.tooltip-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-size: 12px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; }
.tooltip-row:last-child { border-bottom: none; margin-bottom: 0; }

.param-label { color: #aaa; margin-right: 12px; font-family: sans-serif; }
.param-value-group { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
.param-value-group .value { color: #eee; font-family: "Consolas", monospace; font-weight: bold; }

.param-modified .param-label { color: #fff; text-shadow: 0 0 5px rgba(255, 234, 0, 0.3); }
.param-modified .value { color: #ffea00; }

.default-val { font-size: 10px; color: #666; font-family: "Consolas", monospace; margin-top: 1px; }

.alert-row { display: flex; align-items: center; gap: 6px; color: #ff5252; font-weight: bold; font-size: 11px; margin-top: 5px; background: rgba(255, 82, 82, 0.1); padding: 4px; border-radius: 4px; }
.alert-icon { font-size: 14px; }

.params-section { margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); }
:deep(.label-container) { text-align: center; text-shadow: 0 0 5px #000; transform: translateY(-100%); pointer-events: none; transition: opacity 0.3s; }
:deep(.label-name) { font-size: 12px; color: #ccc; font-weight: bold; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; }
:deep(.label-value) { font-family: "Consolas", monospace; font-size: 14px; color: #00ffff; font-weight: bold; }
:deep(.label-name.group) { background: rgba(0, 210, 255, 0.8); color: #000; border: 1px solid #fff; box-shadow: 0 0 10px #00d2ff; font-size: 14px; }
</style>
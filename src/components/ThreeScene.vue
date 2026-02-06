<template>
  <div 
    class="three-container" 
    ref="threeContainer"
    :class="{ 'hide-labels': !showLabels, 'hide-values': !showValues }"
  >
        <div v-if="Object.keys(modelProgressMap).length > 0" class="load-progress">
            <div class="load-progress-title">MODEL LOADING</div>
            <div class="load-progress-list">
                <div v-for="(item, id) in modelProgressMap" :key="id" class="load-progress-item">
                    <div class="load-progress-label">{{ id.toUpperCase() }}</div>
                    <div class="load-progress-bar">
                        <div class="load-progress-fill" :style="{ width: item.percent + '%' }"></div>
                    </div>
                    <div class="load-progress-row">
                        <div class="load-progress-text">
                            <span v-if="item.status === 'error'">ERROR</span>
                            <span v-else-if="item.status === 'timeout'">TIMEOUT</span>
                            <span v-else>{{ item.percent }}%</span>
                        </div>
                        <button v-if="item.status === 'error' || item.status === 'timeout'" class="retry-btn" @click.stop="retryModelLoad(id)">Retry</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="layout-toolbar">
            <button class="toolbar-btn" :disabled="!canUndo" @click.stop="undoLayout">Undo</button>
            <button class="toolbar-btn" :disabled="!canRedo" @click.stop="redoLayout">Redo</button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" @click.stop="saveLayoutSnapshot">Save Snapshot</button>
            <select class="toolbar-select" v-model="selectedSnapshotId" :disabled="layoutSnapshots.length === 0">
                <option v-if="layoutSnapshots.length === 0" value="">No snapshots</option>
                <option v-for="s in layoutSnapshots" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <button class="toolbar-btn" :disabled="!selectedSnapshotId" @click.stop="restoreLayoutSnapshot">Restore</button>
            <button class="toolbar-btn" :disabled="!selectedSnapshotId" @click.stop="deleteLayoutSnapshot">Delete</button>
        </div>

        <div v-if="isBoxSelecting" class="select-rect" :style="{ left: selectionRect.x + 'px', top: selectionRect.y + 'px', width: selectionRect.w + 'px', height: selectionRect.h + 'px' }"></div>

        <div v-if="multiSelectedIds.size > 1" class="selection-toolbar">
            <div class="toolbar-title">ALIGN / DISTRIBUTE</div>
            <div class="toolbar-row">
                <button class="toolbar-btn" @click.stop="alignSelectedCenterX">Center X</button>
                <button class="toolbar-btn" @click.stop="alignSelectedCenterZ">Center Z</button>
                <button class="toolbar-btn" @click.stop="alignSelectedMinX">Left</button>
                <button class="toolbar-btn" @click.stop="alignSelectedMaxX">Right</button>
                <button class="toolbar-btn" @click.stop="alignSelectedMinZ">Top</button>
                <button class="toolbar-btn" @click.stop="alignSelectedMaxZ">Bottom</button>
            </div>
            <div class="toolbar-row">
                <button class="toolbar-btn" @click.stop="distributeSelectedX">Distribute X</button>
                <button class="toolbar-btn" @click.stop="distributeSelectedZ">Distribute Z</button>
                <button class="toolbar-btn" @click.stop="snapSelectedToGrid">Snap Grid</button>
            </div>
        </div>
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
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
    isExpanded, setExpandedGroup, isReadOnly, currentProjectId
} = useSimulation();

const threeContainer = ref(null);
const isLoading = ref(true);

let scene, camera, renderer, labelRenderer, controls;
let reqId;
let gltfLoader;
let dracoLoader;
let ktx2Loader;
const gltfCache = new Map();
const pendingCustomLoads = [];
let activeCustomLoads = 0;
let lastCustomLoadCheck = 0;

// [关键修复] 渲染版本号，用于解决异步竞态导致的重影
let currentRenderVersion = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const planeIntersect = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const dragStartWorld = new THREE.Vector3();
const isDragging = ref(false);
const draggedObject = ref(null);
const dragStartPos = new THREE.Vector2();
const rightClickStartPos = new THREE.Vector2();
const selectionStart = new THREE.Vector2();
const selectionEnd = new THREE.Vector2();
const isBoxSelecting = ref(false);
const selectionRect = reactive({ x: 0, y: 0, w: 0, h: 0 });
const hasSnapshot = ref(false);
const layoutSnapshots = ref([]);
const selectedSnapshotId = ref('');
const undoStack = ref([]);
const redoStack = ref([]);
const canUndo = ref(false);
const canRedo = ref(false);
const MAX_UNDO = 50;
const MAX_SNAPSHOTS = 20;
const dragUndoState = ref(null);
const dragMoved = ref(false);
const modelProgressMap = reactive({});
const progressTimers = new Map();
const progressTimeouts = new Map();
const lastModelConfig = ref({});

let hoverTimer = null;
const HOVER_DELAY = 400;

const fluidMeshesMap = {}; 
const customMeshesMap = {};
const valueLabelsMap = {};
const labelContainersMap = {};
const componentGroupsMap = {}; 
let connectionRegistry = []; 

const LAYOUT_SPREAD = 2.8; 
const VISUAL_MAX_INVENTORY = 3500; 
const TANK_HEIGHT = 36;
const CONNECTION_FADE_START = 1200;
const CONNECTION_FADE_END = 2000;
const CONNECTION_Y = 2;
const USE_RIBBON_CONNECTIONS = true;
const FLOW_REPEAT_X = 28;
const FLOW_THICKNESS_SCALE = 10;
const LABEL_FADE_START = 900;
const LABEL_FADE_END = 1400;
const LOD_ENTER_DISTANCE = 1100;
const LOD_EXIT_DISTANCE = 950;
const GRID_SNAP = 10;
const CUSTOM_LOAD_DISTANCE = 900;
const MAX_CONCURRENT_CUSTOM_LOADS = 2;
const LOAD_TIMEOUT_MS = 20000;
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

const groupMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5166, metalness: 0.35, roughness: 0.65, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
const groupHighlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true, transparent: true, opacity: 0.25 });

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
    scene.background = new THREE.Color(0x0b1016);
    scene.fog = new THREE.FogExp2(0x0b1016, 0.0009);
    const grid = new THREE.GridHelper(1200, 60, 0x223040, 0x141c24);
  scene.add(grid); // Grid is permanent
  
  camera = new THREE.PerspectiveCamera(55, w / h, 1, 8000);
  camera.position.set(0, 450, 600);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.useLegacyLights = false; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.0; 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeContainer.value.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.7).texture;
    pmrem.dispose();

    if (!gltfLoader) {
        dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.181.2/examples/jsm/libs/basis/');
        ktx2Loader.detectSupport(renderer);
        gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);
        gltfLoader.setKTX2Loader(ktx2Loader);
        gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    }
  
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
    const ambient = new THREE.AmbientLight(0xd6dde6, 1.8); 
  scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xe8eef5, 2.2);
  dirLight.position.set(200, 400, 200);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8fb1d1, 1.2);
  fillLight.position.set(-200, 200, -200);
  scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x7bb7ff, 0.9);
    rimLight.position.set(0, 300, -300);
    scene.add(rimLight);
  
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

        ctx.globalCompositeOperation = 'source-over';
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
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
    texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

const createRibbonGeometry = (curve, width, segments = 64) => {
    const points = curve.getPoints(segments);
    const positions = [];
    const uvs = [];
    const indices = [];
    let totalLen = 0;
    const lens = [0];
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
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
};

const setFlowRepeat = (texture, length, width) => {
    if (!texture) return;
    const repeatX = length / FLOW_REPEAT_X;
    const repeatY = Math.max(0.6, FLOW_THICKNESS_SCALE / Math.max(2, width));
    texture.repeat.set(repeatX, repeatY);
};

const createDefaultCylinder = (g, id) => {
    const shellG = new THREE.CapsuleGeometry(12, TANK_HEIGHT - 10, 8, 16);
    const shellM = new THREE.MeshStandardMaterial({
        color: 0x98a2ad,
        metalness: 0.4,
        roughness: 0.6,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });
    const shell = new THREE.Mesh(shellG, shellM);
    shell.name = "tank_shell";
    shell.castShadow = true;
    shell.receiveShadow = true;
    g.add(shell);

    const coreG = new THREE.CylinderGeometry(6, 6, TANK_HEIGHT - 12, 12);
    const coreM = new THREE.MeshStandardMaterial({ color: 0x2b3947, metalness: 0.2, roughness: 0.8 });
    const core = new THREE.Mesh(coreG, coreM);
    core.name = "tank_core";
    core.castShadow = true;
    core.receiveShadow = true;
    g.add(core);
};


const createLowDetailMesh = (isGroupObj, width = 35, depth = 35) => {
    const geometry = isGroupObj
        ? new THREE.BoxGeometry(Math.max(20, width * 0.6), TANK_HEIGHT * 0.4, Math.max(20, depth * 0.6))
        : new THREE.IcosahedronGeometry(10, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0x2a3b4f, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isLOD = true;
    mesh.visible = false;
    return mesh;
};

const createLoadingPlaceholder = (isGroupObj, width = 35, depth = 35) => {
    const geometry = isGroupObj
        ? new THREE.BoxGeometry(Math.max(20, width * 0.7), TANK_HEIGHT * 0.6, Math.max(20, depth * 0.7))
        : new THREE.DodecahedronGeometry(12, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0x1f2b3a, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isPlaceholder = true;
    return mesh;
};

const ensureLoadingPlaceholder = (group) => {
    if (!group) return null;
    if (group.userData.loadingPlaceholder) return group.userData.loadingPlaceholder;
    const isGroupObj = !!group.userData?.isGroup;
    const dims = group.userData?.dimensions || { width: 50, depth: 50 };
    const placeholder = createLoadingPlaceholder(isGroupObj, dims.width, dims.depth);
    group.userData.loadingPlaceholder = placeholder;
    group.add(placeholder);
    return placeholder;
};

const loadGLTFScene = (url, onProgress) => {
    if (gltfCache.has(url)) return gltfCache.get(url);
    const promise = new Promise((resolve, reject) => {
        if (!gltfLoader) {
            reject(new Error('GLTF loader not initialized'));
            return;
        }
        gltfLoader.load(
            url,
            (gltf) => resolve(gltf),
            (evt) => {
                if (!onProgress) return;
                if (evt && evt.total) {
                    const percent = Math.round((evt.loaded / evt.total) * 100);
                    onProgress(percent);
                }
            },
            reject
        );
    });
    gltfCache.set(url, promise);
    return promise;
};

const setModelProgress = (id, percent, status = 'loading', message = '') => {
    if (!id) return;
    modelProgressMap[id] = { percent, status, message };
    if (progressTimers.has(id)) {
        clearTimeout(progressTimers.get(id));
        progressTimers.delete(id);
    }
    if (status === 'done') {
        const t = setTimeout(() => {
            delete modelProgressMap[id];
            progressTimers.delete(id);
        }, 3000);
        progressTimers.set(id, t);
    }
};

const enqueueCustomLoad = (job) => {
    pendingCustomLoads.push(job);
    processCustomLoadQueue();
};

const processCustomLoadQueue = () => {
    while (activeCustomLoads < MAX_CONCURRENT_CUSTOM_LOADS && pendingCustomLoads.length > 0) {
        const job = pendingCustomLoads.shift();
        if (!job || job.group.userData.customLoaded || job.group.userData.customLoading) continue;
        activeCustomLoads += 1;
        loadCustomModel(job.url, job.scale, job.group, job.compID, job.version)
            .finally(() => {
                activeCustomLoads = Math.max(0, activeCustomLoads - 1);
                processCustomLoadQueue();
            });
    }
};

const requestCustomLoad = (group, compID, url, scale, version) => {
    if (!group || !url) return;
    if (group.userData.customLoaded || group.userData.customLoading) return;
    enqueueCustomLoad({ group, compID, url, scale, version });
};

const setGroupLOD = (group, useLow) => {
    if (!group) return;
    group.children.forEach(child => {
        if (child.userData && child.userData.isLOD) {
            child.visible = useLow;
            return;
        }
        if (child.userData && child.userData.isHighlight) {
            child.visible = true;
            return;
        }
        if (child.isMesh) child.visible = !useLow;
    });
};

// [关键修复] 引入 version 参数防止旧的回调写入新场景
const loadCustomModel = (url, configScale, group, compID, version) => {
    const safeUrl = url;
    const placeholder = ensureLoadingPlaceholder(group);

    group.userData.customLoading = true;
    setModelProgress(compID, 0, 'loading');

    if (progressTimeouts.has(compID)) {
        clearTimeout(progressTimeouts.get(compID));
        progressTimeouts.delete(compID);
    }
    const timeoutId = setTimeout(() => {
        if (group.userData.customLoaded || !group.userData.customLoading) return;
        group.userData.customLoading = false;
        setModelProgress(compID, 0, 'timeout', 'Load timeout');
    }, LOAD_TIMEOUT_MS);
    progressTimeouts.set(compID, timeoutId);

    return loadGLTFScene(safeUrl, (p) => {
        setModelProgress(compID, Math.max(0, Math.min(100, p)), 'loading');
    }).then((gltf) => {
        if (version !== currentRenderVersion) {
            if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
            if (placeholder) deepDispose(placeholder);
            return;
        }

        const m = gltf.scene.clone(true);
        m.name = "custom_model";
        const b = new THREE.Box3().setFromObject(m);
        const s = new THREE.Vector3(); b.getSize(s);

        const maxDim = Math.max(s.x, s.y, s.z) || 1;
        const targetSize = TANK_HEIGHT; 
        const fs = (targetSize / maxDim) * (configScale || 1.0);

        m.scale.set(fs, fs, fs);
        const nb = new THREE.Box3().setFromObject(m); const c = new THREE.Vector3(); nb.getCenter(c);
        m.position.sub(c);

        m.traverse((ch) => {
            if (ch.isMesh) {
                   if (ch.material.isMeshStandardMaterial || ch.material.isMeshPhysicalMaterial) {
                       ch.material.metalness = Math.max(ch.material.metalness ?? 0.3, 0.3);
                       ch.material.roughness = Math.max(ch.material.roughness ?? 0.55, 0.55);
                }
                ch.material.side = THREE.DoubleSide; ch.castShadow = true; ch.receiveShadow = true;
                if (ch.material.map) ch.material.map.colorSpace = THREE.SRGBColorSpace;
            }
        });

        if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
        if (placeholder) deepDispose(placeholder);
        if (group.userData.loadingPlaceholder === placeholder) delete group.userData.loadingPlaceholder;
        group.add(m); customMeshesMap[compID] = m;
        group.userData.customLoaded = true;
        group.userData.customLoading = false;
        setModelProgress(compID, 100, 'done');
        if (progressTimeouts.has(compID)) {
            clearTimeout(progressTimeouts.get(compID));
            progressTimeouts.delete(compID);
        }
    }).catch((e) => {
            if (version !== currentRenderVersion) return;
            console.warn(`Failed ${url}`, e); 
            if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
            if (placeholder) deepDispose(placeholder);
            if (group.userData.loadingPlaceholder === placeholder) delete group.userData.loadingPlaceholder;
            createDefaultCylinder(group, compID); 
            group.userData.customLoading = false;
            setModelProgress(compID, 0, 'error', 'Load failed');
            if (progressTimeouts.has(compID)) {
                clearTimeout(progressTimeouts.get(compID));
                progressTimeouts.delete(compID);
            }
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
            g.userData.customConfig = { url: `${BACKEND_URL}${cfg.url}`, scale: cfg.scale, id: sid };
            ensureLoadingPlaceholder(g);
            g.userData.customLoaded = false;
            g.userData.customLoading = false;
            requestCustomLoad(g, sid, `${BACKEND_URL}${cfg.url}`, cfg.scale, currentRenderVersion);
        } else {
            const dims = g.userData.dimensions || { width: 50, depth: 50 };
            const geometry = new THREE.BoxGeometry(dims.width, TANK_HEIGHT * 1.2, dims.depth);
            const mesh = new THREE.Mesh(geometry, groupMaterial);
            g.add(mesh);
        }
    } else {
        if (cfg && cfg.type === 'custom') {
            g.userData.customConfig = { url: `${BACKEND_URL}${cfg.url}`, scale: cfg.scale, id: sid };
            ensureLoadingPlaceholder(g);
            g.userData.customLoaded = false;
            g.userData.customLoading = false;
            requestCustomLoad(g, sid, `${BACKEND_URL}${cfg.url}`, cfg.scale, currentRenderVersion);
        } else {
            createDefaultCylinder(g, sid);
        }
    }

    if (!g.userData.lowDetailMesh) {
        const dims = g.userData.dimensions || { width: 50, depth: 50 };
        const low = createLowDetailMesh(!!g.userData.isGroup, dims.width, dims.depth);
        g.userData.lowDetailMesh = low;
        g.add(low);
    }
    
    if (multiSelectedIds.value.has(sid) || selectedConnectionId.value === sid) {
        const boxSize = g.userData.isGroup ? 
            { x: (g.userData.dimensions?.width || 50) + 4, z: (g.userData.dimensions?.depth || 50) + 4 } : 
            { x: 35, z: 35 };
            
        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(boxSize.x, TANK_HEIGHT * 1.2 + 2, boxSize.z), 
            groupHighlightMaterial
        );
        highlight.userData.isHighlight = true;
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
    if (cfg && cfg.type === 'custom') {
        g.userData.customConfig = { url: `${BACKEND_URL}${cfg.url}`, scale: cfg.scale, id: sid };
        ensureLoadingPlaceholder(g);
    } else createDefaultCylinder(g, sid);

    if (!g.userData.lowDetailMesh) {
        const low = createLowDetailMesh(false);
        g.userData.lowDetailMesh = low;
        g.add(low);
    }

    const div = document.createElement('div'); div.className = 'label-card';
    const nameDiv = document.createElement('div'); nameDiv.className = 'label-title'; nameDiv.textContent = c.id;
    const valDiv = document.createElement('div'); valDiv.className = 'label-metric'; valDiv.textContent = '---';
    div.appendChild(nameDiv); div.appendChild(valDiv);
    const l = new CSS2DObject(div); l.position.set(0, TANK_HEIGHT + 5, 0);
    valueLabelsMap[sid] = valDiv; 
    labelContainersMap[sid] = div;
    g.add(l);

    if (multiSelectedIds.value.has(sid)) {
        const highlight = new THREE.Mesh(new THREE.BoxGeometry(35, 45, 35), groupHighlightMaterial);
        highlight.userData.isHighlight = true;
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
        div.className = 'label-card group-label';
        div.innerHTML = `<div class="label-title group" style="border:1px dashed #6fbfe0; background:none;">Inside: ${groupData.name}</div>`;
        const l = new CSS2DObject(div); 
        l.position.set(0, TANK_HEIGHT * 0.8, 0);
        g.add(l);
        labelContainersMap[groupData.id] = div;

    } else {
        const cfg = modelConfig.value[groupData.id];
        
            if (cfg && cfg.type === 'custom') {
                g.userData.customConfig = { url: `${BACKEND_URL}${cfg.url}`, scale: cfg.scale, id: groupData.id };
                ensureLoadingPlaceholder(g);
            } else {
            const geometry = new THREE.BoxGeometry(width, TANK_HEIGHT * 1.2, depth);
            const mesh = new THREE.Mesh(geometry, groupMaterial);
            g.add(mesh);
        }

        const div = document.createElement('div'); 
        div.className = 'label-card group-label';
        div.innerHTML = `<div class="label-title group">${groupData.name}</div>`;
        const l = new CSS2DObject(div); 
        l.position.set(0, TANK_HEIGHT/2 + 15, 0);
        g.add(l);
        labelContainersMap[groupData.id] = div;

        if (multiSelectedIds.value.has(groupData.id)) {
             const highlight = new THREE.Mesh(new THREE.BoxGeometry(width + 4, TANK_HEIGHT * 1.2 + 4, depth + 4), groupHighlightMaterial);
             highlight.userData.isHighlight = true;
             g.add(highlight);
        }
    }

    if (!g.userData.lowDetailMesh) {
        const low = createLowDetailMesh(true, width, depth);
        g.userData.lowDetailMesh = low;
        g.add(low);
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
    for (const key in labelContainersMap) delete labelContainersMap[key];
  for (const key in componentGroupsMap) delete componentGroupsMap[key];
    for (const key in modelProgressMap) delete modelProgressMap[key];
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
    pendingCustomLoads.length = 0;
    activeCustomLoads = 0;
    lastCustomLoadCheck = 0;
    resolvePendingCustomLoads(true);
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
            
            const sp = sg.position.clone(); sp.y = CONNECTION_Y;
            const ep = eg.position.clone(); ep.y = CONNECTION_Y;
            
            const m1 = sp.clone().lerp(ep, 0.33); m1.y = CONNECTION_Y;
            const m2 = sp.clone().lerp(ep, 0.66); m2.y = CONNECTION_Y;
            const curve = new THREE.CatmullRomCurve3([sp, m1, m2, ep]);

            const ribbonWidth = Math.max(2.4, width * 1.8);
            const geometry = USE_RIBBON_CONNECTIONS
                ? createRibbonGeometry(curve, ribbonWidth, 64)
                : new THREE.TubeGeometry(curve, 64, Math.max(0.3, width / 2.5), 8, false);
            
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
                setFlowRepeat(texture, sp.distanceTo(ep), width);
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
                baseOpacity: style.opacity, renderType: USE_RIBBON_CONNECTIONS ? 'ribbon' : 'tube'
            };

            const hitRadius = Math.max(0.6, (width / 2.5) * 2.2);
            const hitGeometry = new THREE.TubeGeometry(curve, 64, hitRadius, 8, false);
            const hitMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.0,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
            hitMesh.name = `CONN_${connID}`;
            hitMesh.userData = { isConnection: true, id: connID, isHitArea: true };
            mesh.userData.hitMesh = hitMesh;
            
            scene.add(mesh);
            scene.add(hitMesh);
            connectionRegistry.push({ mesh, curve, sp, ep, sg, eg, realFrom, realTo });
        }
    });
};

// ... (Rest of event handlers remain similar but standard) ...

const updateConnectedLines = (movingNodeName) => {
    connectionRegistry.forEach(conn => {
        if (conn.sg.name === movingNodeName || conn.eg.name === movingNodeName) {
            const sp = conn.sg.position.clone(); sp.y = CONNECTION_Y;
            const ep = conn.eg.position.clone(); ep.y = CONNECTION_Y;
            const m1 = sp.clone().lerp(ep, 0.33); m1.y = CONNECTION_Y;
            const m2 = sp.clone().lerp(ep, 0.66); m2.y = CONNECTION_Y;
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

            const hitMesh = conn.mesh.userData.hitMesh;
            if (hitMesh) {
                const hitRadius = Math.max(0.6, (currentWidth / 2.5) * 2.2);
                hitMesh.geometry.dispose();
                hitMesh.geometry = new THREE.TubeGeometry(conn.curve, 64, hitRadius, 8, false);
            }
            
            if (conn.mesh.material.map) {
                const repeatFactor = conn.mesh.userData.type === 'dashed' ? 4 : 20;
                if (conn.mesh.userData.type === 'dashed') {
                    conn.mesh.material.map.repeat.set(sp.distanceTo(ep) / repeatFactor, 1);
                } else {
                    const currentWidth = conn.mesh.userData.currentWidth || 4.0;
                    setFlowRepeat(conn.mesh.material.map, sp.distanceTo(ep), currentWidth);
                }
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

const updateSelectionRect = () => {
    if (!threeContainer.value) return;
    const rect = threeContainer.value.getBoundingClientRect();
    const x1 = selectionStart.x - rect.left;
    const y1 = selectionStart.y - rect.top;
    const x2 = selectionEnd.x - rect.left;
    const y2 = selectionEnd.y - rect.top;
    selectionRect.x = Math.min(x1, x2);
    selectionRect.y = Math.min(y1, y2);
    selectionRect.w = Math.abs(x2 - x1);
    selectionRect.h = Math.abs(y2 - y1);
};

const applyBoxSelection = (mode = 'set') => {
    if (!threeContainer.value || !camera) return;
    const rect = threeContainer.value.getBoundingClientRect();
    const left = selectionRect.x;
    const right = selectionRect.x + selectionRect.w;
    const top = selectionRect.y;
    const bottom = selectionRect.y + selectionRect.h;

    const selected = mode === 'add' || mode === 'remove' ? new Set(multiSelectedIds.value) : new Set();
    Object.keys(componentGroupsMap).forEach((id) => {
        const group = componentGroupsMap[id];
        if (!group) return;
        const projected = group.position.clone().project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * rect.width;
        const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
        if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
            if (mode === 'remove') selected.delete(id);
            else selected.add(id);
        }
    });
    multiSelectedIds.value = selected;
    rebuildVisuals();
};

const getMovableSelection = () => {
    return Array.from(multiSelectedIds.value)
        .filter(id => !isGroup(id))
        .map(id => componentGroupsMap[id])
        .filter(Boolean);
};

const persistMovedSelection = async (groups) => {
    for (const g of groups) {
        const id = g.name;
        const finalX = g.position.x / LAYOUT_SPREAD;
        const finalY = -g.position.z / LAYOUT_SPREAD;
        await saveComponentPosition(id, finalX, finalY);
    }
};

const alignSelectedX = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const avgX = groups.reduce((s, g) => s + g.position.x, 0) / groups.length;
    groups.forEach(g => { g.position.x = avgX; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedZ = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const avgZ = groups.reduce((s, g) => s + g.position.z, 0) / groups.length;
    groups.forEach(g => { g.position.z = avgZ; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedMinX = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const minX = Math.min(...groups.map(g => g.position.x));
    groups.forEach(g => { g.position.x = minX; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedMaxX = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const maxX = Math.max(...groups.map(g => g.position.x));
    groups.forEach(g => { g.position.x = maxX; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedMinZ = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const minZ = Math.min(...groups.map(g => g.position.z));
    groups.forEach(g => { g.position.z = minZ; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedMaxZ = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 2) return;
    pushUndoState();
    const maxZ = Math.max(...groups.map(g => g.position.z));
    groups.forEach(g => { g.position.z = maxZ; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const alignSelectedCenterX = async () => {
    await alignSelectedX();
};

const alignSelectedCenterZ = async () => {
    await alignSelectedZ();
};

const distributeSelectedX = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 3) return;
    pushUndoState();
    const sorted = [...groups].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const step = (maxX - minX) / (sorted.length - 1);
    sorted.forEach((g, i) => { g.position.x = minX + step * i; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const distributeSelectedZ = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 3) return;
    pushUndoState();
    const sorted = [...groups].sort((a, b) => a.position.z - b.position.z);
    const minZ = sorted[0].position.z;
    const maxZ = sorted[sorted.length - 1].position.z;
    const step = (maxZ - minZ) / (sorted.length - 1);
    sorted.forEach((g, i) => { g.position.z = minZ + step * i; g.updateMatrixWorld(); updateConnectedLines(g.name); });
    await persistMovedSelection(groups);
};

const snapSelectedToGrid = async () => {
    if (isReadOnly.value) return;
    const groups = getMovableSelection();
    if (groups.length < 1) return;
    pushUndoState();
    groups.forEach(g => {
        g.position.x = Math.round(g.position.x / GRID_SNAP) * GRID_SNAP;
        g.position.z = Math.round(g.position.z / GRID_SNAP) * GRID_SNAP;
        g.updateMatrixWorld();
        updateConnectedLines(g.name);
    });
    await persistMovedSelection(groups);
};

const retryModelLoad = (id) => {
    if (!id) return;
    const key = String(id).toLowerCase();
    const group = componentGroupsMap[key];
    if (!group || !group.userData.customConfig) return;
    group.userData.customLoaded = false;
    group.userData.customLoading = false;
    const cfg = group.userData.customConfig;
    setModelProgress(id, 0, 'loading');
    requestCustomLoad(group, cfg.id, cfg.url, cfg.scale, currentRenderVersion);
};

const getSnapshotKey = () => `tricys_layout_snapshots_${currentProjectId.value || 'default'}`;

const getLayoutState = () => {
    if (!structureData.value || !structureData.value.components) return null;
    return {
        ts: Date.now(),
        projectId: currentProjectId.value || null,
        components: structureData.value.components.map(c => ({
            id: c.id,
            x: c.position.x,
            y: c.position.y
        }))
    };
};

const applyLayoutState = async (state, persist = true) => {
    if (!state || !state.components || !structureData.value || !structureData.value.components) return;
    state.components.forEach(c => {
        const target = structureData.value.components.find(x => x.id.toLowerCase() === String(c.id).toLowerCase());
        if (target) {
            target.position.x = c.x;
            target.position.y = c.y;
        }
        const g = componentGroupsMap[String(c.id).toLowerCase()];
        if (g && !isGroup(g.name)) {
            g.position.set(c.x * LAYOUT_SPREAD, TANK_HEIGHT / 2, -c.y * LAYOUT_SPREAD);
            g.updateMatrixWorld();
            updateConnectedLines(g.name);
        }
    });
    rebuildVisuals();
    if (persist) {
        for (const c of state.components) {
            await saveComponentPosition(c.id, c.x, c.y);
        }
    }
};

const pushUndoState = () => {
    const state = getLayoutState();
    if (!state) return;
    undoStack.value.push(state);
    if (undoStack.value.length > MAX_UNDO) undoStack.value.shift();
    redoStack.value = [];
    canUndo.value = undoStack.value.length > 0;
    canRedo.value = redoStack.value.length > 0;
};

const undoLayout = async () => {
    if (!undoStack.value.length) return;
    const current = getLayoutState();
    const prev = undoStack.value.pop();
    if (current) redoStack.value.push(current);
    await applyLayoutState(prev, true);
    canUndo.value = undoStack.value.length > 0;
    canRedo.value = redoStack.value.length > 0;
};

const redoLayout = async () => {
    if (!redoStack.value.length) return;
    const current = getLayoutState();
    const next = redoStack.value.pop();
    if (current) undoStack.value.push(current);
    await applyLayoutState(next, true);
    canUndo.value = undoStack.value.length > 0;
    canRedo.value = redoStack.value.length > 0;
};

const loadSnapshotsFromStorage = () => {
    const raw = localStorage.getItem(getSnapshotKey());
    let list = [];
    try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
    if (!Array.isArray(list)) list = [];
    layoutSnapshots.value = list;
    selectedSnapshotId.value = list.length ? list[0].id : '';
    hasSnapshot.value = list.length > 0;
};

const saveSnapshotsToStorage = () => {
    localStorage.setItem(getSnapshotKey(), JSON.stringify(layoutSnapshots.value));
    hasSnapshot.value = layoutSnapshots.value.length > 0;
};

const createSnapshotPayload = (name) => {
    const base = getLayoutState();
    if (!base) return null;
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
        ...base,
        id,
        name: name || `Snapshot ${new Date().toLocaleString()}`
    };
};

const saveLayoutSnapshot = () => {
    if (!structureData.value || !structureData.value.components) return;
    const name = window.prompt('Snapshot name', '');
    const payload = createSnapshotPayload(name || undefined);
    if (!payload) return;
    layoutSnapshots.value.unshift(payload);
    if (layoutSnapshots.value.length > MAX_SNAPSHOTS) layoutSnapshots.value.pop();
    selectedSnapshotId.value = payload.id;
    saveSnapshotsToStorage();
};

const restoreLayoutSnapshot = async () => {
    if (!selectedSnapshotId.value) return;
    const snapshot = layoutSnapshots.value.find(s => s.id === selectedSnapshotId.value);
    if (!snapshot) return;
    pushUndoState();
    await applyLayoutState(snapshot, true);
};

const deleteLayoutSnapshot = () => {
    if (!selectedSnapshotId.value) return;
    layoutSnapshots.value = layoutSnapshots.value.filter(s => s.id !== selectedSnapshotId.value);
    selectedSnapshotId.value = layoutSnapshots.value.length ? layoutSnapshots.value[0].id : '';
    saveSnapshotsToStorage();
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
    if (event.shiftKey && !res) {
        isBoxSelecting.value = true;
        controls.enabled = false;
        hoverInfo.visible = false;
        selectionStart.set(event.clientX, event.clientY);
        selectionEnd.set(event.clientX, event.clientY);
        updateSelectionRect();
        return;
    }
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

        dragUndoState.value = getLayoutState();
        dragMoved.value = false;
        isDragging.value = true;
        controls.enabled = false;
        draggedObject.value = res.object;
        dragStartWorld.copy(res.object.position);
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
    if (isBoxSelecting.value) {
        selectionEnd.set(event.clientX, event.clientY);
        updateSelectionRect();
        return;
    }
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
            dragMoved.value = true;
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
    if (isBoxSelecting.value) {
        isBoxSelecting.value = false;
        controls.enabled = true;
        const small = selectionRect.w < 4 || selectionRect.h < 4;
        if (!small) {
            const mode = event.altKey ? 'remove' : (event.ctrlKey || event.metaKey ? 'add' : 'set');
            applyBoxSelection(mode);
        }
        return;
    }
    if (isDragging.value && draggedObject.value) {
        isDragging.value = false;
        controls.enabled = true;
        threeContainer.value.style.cursor = 'default';
        if (dragUndoState.value && dragMoved.value) {
            undoStack.value.push(dragUndoState.value);
            if (undoStack.value.length > MAX_UNDO) undoStack.value.shift();
            redoStack.value = [];
            canUndo.value = undoStack.value.length > 0;
            canRedo.value = redoStack.value.length > 0;
        }
        if (isGroup(draggedObject.value.name)) {
             const deltaX = (draggedObject.value.position.x - dragStartWorld.x) / LAYOUT_SPREAD;
             const deltaY = -(draggedObject.value.position.z - dragStartWorld.z) / LAYOUT_SPREAD;
             const groupId = draggedObject.value.name;
             const groupData = componentGroups.value[groupId];
             if (groupData && Array.isArray(groupData.children)) {
                 for (const childId of groupData.children) {
                     const target = structureData.value?.components?.find(c => c.id.toLowerCase() === String(childId).toLowerCase());
                     if (target) {
                         const newX = target.position.x + deltaX;
                         const newY = target.position.y + deltaY;
                         target.position.x = newX;
                         target.position.y = newY;
                         const childGroup = componentGroupsMap[String(childId).toLowerCase()];
                         if (childGroup && !isGroup(childGroup.name)) {
                             childGroup.position.set(newX * LAYOUT_SPREAD, TANK_HEIGHT / 2, -newY * LAYOUT_SPREAD);
                             childGroup.updateMatrixWorld();
                             updateConnectedLines(childGroup.name);
                         }
                         await saveComponentPosition(childId, newX, newY);
                     }
                 }
             }
        } else {
             const finalX = draggedObject.value.position.x / LAYOUT_SPREAD;
             const finalY = -draggedObject.value.position.z / LAYOUT_SPREAD;
             await saveComponentPosition(draggedObject.value.name, finalX, finalY);
        }
        draggedObject.value = null;
        dragUndoState.value = null;
        dragMoved.value = false;
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
    mesh.geometry.dispose();
    if (mesh.userData.renderType === 'ribbon') {
        const ribbonWidth = Math.max(2.4, width * 1.8);
        mesh.geometry = createRibbonGeometry(entry.curve, ribbonWidth, 64);
    } else {
        const radius = Math.max(0.3, width / 2.5);
        mesh.geometry = new THREE.TubeGeometry(entry.curve, 64, radius, 8, false);
    }
    mesh.userData.currentWidth = width;
};

const applyStyleToMesh = (mesh, style) => {
    if (!mesh || !mesh.material) return;
    if (mesh.userData && mesh.userData.isHitArea) return;
    mesh.material.color.set(style.color);
    mesh.material.opacity = style.opacity;
    const newWidth = style.width !== undefined ? style.width : 4.0;
    updateMeshGeometry(mesh, newWidth);

    const hitMesh = mesh.userData.hitMesh;
    if (hitMesh) {
        const entry = connectionRegistry.find(r => r.mesh === mesh);
        const hitRadius = Math.max(0.6, (newWidth / 2.5) * 2.2);
        if (entry) {
            hitMesh.geometry.dispose();
            hitMesh.geometry = new THREE.TubeGeometry(entry.curve, 64, hitRadius, 8, false);
        }
    }
    let newTexture = null;
    if (style.type === 'solid') newTexture = null;
    else if (style.type === 'dashed') newTexture = mesh.userData.type !== 'dashed' ? createDashTexture() : mesh.material.map;
    else newTexture = mesh.userData.type !== 'flow' ? createFlowTexture() : mesh.material.map;
    if (newTexture) {
         const entry = connectionRegistry.find(r => r.mesh === mesh);
         if (entry) {
             const repeatFactor = style.type === 'dashed' ? 4 : 20;
             if (style.type === 'dashed') {
                 newTexture.repeat.set(entry.sp.distanceTo(entry.ep) / repeatFactor, 1);
             } else {
                 const newWidth = style.width !== undefined ? style.width : 4.0;
                 setFlowRepeat(newTexture, entry.sp.distanceTo(entry.ep), newWidth);
             }
         }
    }
    mesh.material.map = newTexture;
    mesh.userData.texture = newTexture;
    mesh.userData.type = style.type;
    mesh.material.needsUpdate = true;
    mesh.userData.speed = style.speed;
    mesh.userData.baseOpacity = style.opacity;
    mesh.userData.baseColor = style.color;

    const speed = style.speed !== undefined ? style.speed : 1.0;
    const baseColor = new THREE.Color(mesh.userData.baseColor);
    const hsl = {}; baseColor.getHSL(hsl);
    const t = Math.min(Math.max(speed, 0), 3) / 3;
    const light = Math.min(1.0, hsl.l + 0.25 * t);
    const sat = Math.min(1.0, hsl.s + 0.1 * t);
    mesh.material.color.setHSL(hsl.h, sat, light);
};

watch(connectionStyles, (newStyles) => {
    const hasAll = newStyles && newStyles['ALL'];
    scene.children.forEach(child => {
        if (child.name.startsWith("CONN_")) {
            if (child.userData && child.userData.isHitArea) return;
            const id = child.userData.id;
            if (hasAll) {
                const style = { ...defaultConnectionStyle, ...newStyles['ALL'] };
                applyStyleToMesh(child, style);
                return;
            }
            if (newStyles && newStyles[id]) {
                const style = { ...defaultConnectionStyle, ...newStyles[id] };
                applyStyleToMesh(child, style);
            }
        }
    });
}, { deep: true });

watch(modelConfig, (newVal) => {
    const prev = lastModelConfig.value || {};
    const next = newVal || {};
    const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
    ids.forEach((id) => {
        const p = prev[id] || {};
        const n = next[id] || {};
        const scaleChanged = p.scale !== n.scale;
        const urlChanged = p.url !== n.url;
        const typeChanged = p.type !== n.type;
        if (scaleChanged || urlChanged || typeChanged) {
            reloadComponent(id);
        }
    });
    lastModelConfig.value = JSON.parse(JSON.stringify(next));
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

const updateLabelVisibility = () => {
    if (!camera) return;
    Object.keys(componentGroupsMap).forEach((id) => {
        const group = componentGroupsMap[id];
        const labelEl = labelContainersMap[id];
        if (!group || !labelEl) return;
        const dist = camera.position.distanceTo(group.position);
        if (dist > LABEL_FADE_END) {
            if (labelEl.style.display !== 'none') labelEl.style.display = 'none';
            return;
        }
        if (labelEl.style.display === 'none') labelEl.style.display = '';
        let fade = 1.0;
        if (dist > LABEL_FADE_START) {
            const t = (dist - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START);
            fade = Math.max(0.1, 1.0 - t);
        }
        labelEl.style.opacity = String(fade);
    });
};

const updateLOD = () => {
    if (!camera) return;
    Object.keys(componentGroupsMap).forEach((id) => {
        const group = componentGroupsMap[id];
        if (!group) return;
        const dist = camera.position.distanceTo(group.position);
        const isLow = group.userData.isLowLOD || false;
        const shouldLow = isLow ? dist > LOD_EXIT_DISTANCE : dist > LOD_ENTER_DISTANCE;
        if (shouldLow !== isLow) {
            group.userData.isLowLOD = shouldLow;
            setGroupLOD(group, shouldLow);
        }
    });
};

const resolvePendingCustomLoads = (force = false) => {
    if (!camera) return;
    Object.keys(componentGroupsMap).forEach((id) => {
        const group = componentGroupsMap[id];
        if (!group || !group.userData.customConfig) return;
        if (group.userData.customLoaded || group.userData.customLoading) return;
        const dist = camera.position.distanceTo(group.position);
        if (force || dist < CUSTOM_LOAD_DISTANCE) {
            const cfg = group.userData.customConfig;
            requestCustomLoad(group, cfg.id, cfg.url, cfg.scale, currentRenderVersion);
        }
    });
};

const animate = () => {
  reqId = requestAnimationFrame(animate);
  if (isPlaying.value) stepTime(0.1);
    connectionRegistry.forEach(conn => {
            const mesh = conn.mesh;
            if (mesh && mesh.material && mesh.material.map) {
                    const speed = mesh.userData.speed !== undefined ? mesh.userData.speed : 1.0;
                      if (speed > 0) mesh.material.map.offset.x -= 0.001 * speed;
            }
      if (mesh && mesh.material) {
          const mid = conn.sp.clone().lerp(conn.ep, 0.5);
          const dist = camera.position.distanceTo(mid);
          if (dist > CONNECTION_FADE_END) {
              mesh.visible = false;
                  if (mesh.userData.hitMesh) mesh.userData.hitMesh.visible = false;
          } else {
              mesh.visible = true;
                  if (mesh.userData.hitMesh) mesh.userData.hitMesh.visible = true;
              const baseOpacity = mesh.userData.baseOpacity ?? mesh.material.opacity ?? 1.0;
              let fade = 1.0;
              if (dist > CONNECTION_FADE_START) {
                  const t = (dist - CONNECTION_FADE_START) / (CONNECTION_FADE_END - CONNECTION_FADE_START);
                  fade = Math.max(0.0, 1.0 - t);
              }
              mesh.material.opacity = baseOpacity * fade;
          }
      }
    });
  updateVisuals();
    updateLabelVisibility();
    updateLOD();
    const now = performance.now();
    if (now - lastCustomLoadCheck > 500) {
        lastCustomLoadCheck = now;
        resolvePendingCustomLoads(false);
    }
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
        loadSnapshotsFromStorage();
  const structData = await loadData();
    if (structData) { await buildScene(structData); animate(); } else { isLoading.value = false; }
    undoStack.value = [];
    redoStack.value = [];
    canUndo.value = false;
    canRedo.value = false;
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('dblclick', onDoubleClick);
  if (reqId) cancelAnimationFrame(reqId);
  if (renderer) renderer.dispose();
    if (ktx2Loader) ktx2Loader.dispose();
    if (dracoLoader) dracoLoader.dispose();
    if (labelRenderer && labelRenderer.domElement && labelRenderer.domElement.parentNode) {
            labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
    }
  const canvas = renderer.domElement;
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('contextmenu', onContextMenu);
  connectionRegistry.length = 0;
});

watch(() => currentProjectId.value, () => {
    loadSnapshotsFromStorage();
    undoStack.value = [];
    redoStack.value = [];
    canUndo.value = false;
    canRedo.value = false;
});

defineExpose({ reloadComponent });
</script>

<style scoped>
/* [Changed 100vh to 100% to fit parent container] */
.three-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; background: radial-gradient(circle at center, #11111a 0%, #000000 100%); overflow: hidden; z-index: 0; }
.hide-labels :deep(.label-title) { display: none !important; }
.hide-values :deep(.label-metric) { display: none !important; }
.loading-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; z-index: 1000; }
.loading-text { color: #00d2ff; font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #00d2ff; }
.loading-sub { color: #888; font-size: 14px; margin-top: 5px; }
.hover-tooltip { position: fixed; z-index: 9999; background: rgba(10, 15, 20, 0.95); border: 1px solid rgba(0, 210, 255, 0.5); border-radius: 8px; padding: 12px; pointer-events: none; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6); min-width: 200px; max-width: 380px; backdrop-filter: blur(8px); transform: translate(10px, 10px); }
.select-rect { position: absolute; border: 1px dashed rgba(0, 210, 255, 0.8); background: rgba(0, 210, 255, 0.08); z-index: 50; pointer-events: none; }
.selection-toolbar { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: rgba(5, 10, 15, 0.8); border: 1px solid rgba(0, 210, 255, 0.35); border-radius: 8px; padding: 8px 10px; z-index: 60; display: flex; flex-direction: column; gap: 6px; backdrop-filter: blur(6px); }
.layout-toolbar { position: absolute; top: 10px; right: 10px; z-index: 60; display: flex; gap: 6px; background: rgba(5, 10, 15, 0.6); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 6px; backdrop-filter: blur(6px); }
.toolbar-divider { width: 1px; background: rgba(255,255,255,0.15); margin: 0 4px; }
.toolbar-select { background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #e0f7ff; font-size: 11px; border-radius: 4px; padding: 3px 6px; max-width: 160px; }
.toolbar-select:disabled { opacity: 0.4; }
.toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.load-progress { position: absolute; bottom: 12px; right: 12px; z-index: 60; width: 260px; background: rgba(5, 10, 15, 0.8); border: 1px solid rgba(0, 210, 255, 0.35); border-radius: 8px; padding: 8px 10px; backdrop-filter: blur(6px); }
.load-progress-title { font-size: 10px; color: #6fbfe0; letter-spacing: 1px; text-align: center; }
.load-progress-list { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.load-progress-item { display: grid; grid-template-columns: 1fr; gap: 4px; }
.load-progress-label { font-size: 10px; color: #bfefff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.load-progress-bar { margin: 6px 0; width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.load-progress-fill { height: 100%; background: linear-gradient(90deg, #00d2ff, #7fe3ff); width: 0%; transition: width 0.2s ease; }
.load-progress-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.load-progress-text { font-size: 11px; color: #d6f6ff; text-align: right; }
.retry-btn { background: rgba(255, 82, 82, 0.15); border: 1px solid rgba(255, 82, 82, 0.5); color: #ffbdbd; font-size: 10px; padding: 2px 6px; border-radius: 4px; cursor: pointer; }
.retry-btn:hover { background: rgba(255, 82, 82, 0.3); }
.toolbar-title { font-size: 10px; color: #6fbfe0; text-align: center; letter-spacing: 1px; }
.toolbar-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.toolbar-btn { background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #e0f7ff; padding: 4px 8px; font-size: 11px; border-radius: 4px; cursor: pointer; }
.toolbar-btn:hover { border-color: #00d2ff; box-shadow: 0 0 8px rgba(0, 210, 255, 0.25); }
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
:deep(.label-card) { text-align: center; text-shadow: none; transform: translateY(-100%); pointer-events: none; transition: opacity 0.3s; background: rgba(10, 15, 20, 0.9); border: 1px solid rgba(120, 170, 210, 0.35); border-radius: 6px; padding: 6px 8px; min-width: 90px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
:deep(.label-title) { font-size: 11px; color: #cfe6f7; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 2px; text-align: center; }
:deep(.label-metric) { font-family: "Consolas", monospace; font-size: 13px; color: #8fe1ff; font-weight: 700; text-align: center; }
:deep(.label-title.group) { background: rgba(35, 55, 75, 0.8); color: #cfe6f7; border: 1px solid rgba(120, 170, 210, 0.4); border-radius: 4px; padding: 2px 6px; display: inline-block; }
</style>
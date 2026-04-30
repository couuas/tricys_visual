import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const TANK_HEIGHT = 36;
const MAX_CONCURRENT_CUSTOM_LOADS = 2;
const LOAD_TIMEOUT_MS = 20000;

export class AssetLoadingService {
    constructor(renderer) {
        this.renderer = renderer;
        this.gltfLoader = null;
        this.dracoLoader = null;
        this.ktx2Loader = null;

        this.gltfCache = new Map();
        this.pendingCustomLoads = [];
        this.activeCustomLoads = 0;
        
        this.modelProgressMap = {};
        this.progressTimers = new Map();
        this.progressTimeouts = new Map();

        // Used by UI to react to changes
        this.onProgressUpdate = null;

        this.initLoaders();
    }

    initLoaders() {
        if (!this.gltfLoader && this.renderer) {
            this.dracoLoader = new DRACOLoader();
            this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
            this.ktx2Loader = new KTX2Loader();
            this.ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.181.2/examples/jsm/libs/basis/');
            this.ktx2Loader.detectSupport(this.renderer);
            this.gltfLoader = new GLTFLoader();
            this.gltfLoader.setDRACOLoader(this.dracoLoader);
            this.gltfLoader.setKTX2Loader(this.ktx2Loader);
            this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
        }
    }

    setModelProgress(id, percent, status = 'loading', message = '') {
        if (!id) return;
        this.modelProgressMap[id] = { percent, status, message };
        if (this.progressTimers.has(id)) {
            clearTimeout(this.progressTimers.get(id));
            this.progressTimers.delete(id);
        }
        if (status === 'done') {
            const t = setTimeout(() => {
                delete this.modelProgressMap[id];
                this.progressTimers.delete(id);
                if (this.onProgressUpdate) this.onProgressUpdate(this.modelProgressMap);
            }, 3000);
            this.progressTimers.set(id, t);
        }
        if (this.onProgressUpdate) this.onProgressUpdate(this.modelProgressMap);
    }

    loadGLTFScene(url, onProgress) {
        if (this.gltfCache.has(url)) return this.gltfCache.get(url);
        const promise = new Promise((resolve, reject) => {
            if (!this.gltfLoader) {
                reject(new Error('GLTF loader not initialized'));
                return;
            }
            this.gltfLoader.load(
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
        this.gltfCache.set(url, promise);
        return promise;
    }

    enqueueCustomLoad(job) {
        this.pendingCustomLoads.push(job);
        this.processCustomLoadQueue();
    }

    processCustomLoadQueue() {
        while (this.activeCustomLoads < MAX_CONCURRENT_CUSTOM_LOADS && this.pendingCustomLoads.length > 0) {
            const job = this.pendingCustomLoads.shift();
            if (!job || job.group.userData.customLoaded || job.group.userData.customLoading) continue;
            this.activeCustomLoads += 1;
            this.loadCustomModel(job.url, job.scale, job.group, job.compID, job.version)
                .finally(() => {
                    this.activeCustomLoads = Math.max(0, this.activeCustomLoads - 1);
                    this.processCustomLoadQueue();
                });
        }
    }

    requestCustomLoad(group, compID, url, scale, version) {
        if (!group || !url) return;
        if (group.userData.customLoaded || group.userData.customLoading) return;
        this.enqueueCustomLoad({ group, compID, url, scale, version });
    }

    createLoadingPlaceholder(isGroupObj, width = 35, depth = 35) {
        const geometry = isGroupObj
            ? new THREE.BoxGeometry(Math.max(20, width * 0.7), TANK_HEIGHT * 0.6, Math.max(20, depth * 0.7))
            : new THREE.DodecahedronGeometry(12, 0);
        const material = new THREE.MeshBasicMaterial({ color: 0x1f2b3a, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isPlaceholder = true;
        return mesh;
    }

    ensureLoadingPlaceholder(group) {
        if (!group) return null;
        if (group.userData.loadingPlaceholder) return group.userData.loadingPlaceholder;
        const isGroupObj = !!group.userData?.isGroup;
        const dims = group.userData?.dimensions || { width: 50, depth: 50 };
        const placeholder = this.createLoadingPlaceholder(isGroupObj, dims.width, dims.depth);
        group.userData.loadingPlaceholder = placeholder;
        group.add(placeholder);
        return placeholder;
    }

    createDefaultCylinder(g, id) {
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
    }
    
    deepDispose(object) {
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
    }

    loadCustomModel(url, configScale, group, compID, version, currentRenderVersion) {
        const safeUrl = url;
        const placeholder = this.ensureLoadingPlaceholder(group);

        group.userData.customLoading = true;
        this.setModelProgress(compID, 0, 'loading');

        if (this.progressTimeouts.has(compID)) {
            clearTimeout(this.progressTimeouts.get(compID));
            this.progressTimeouts.delete(compID);
        }
        
        const timeoutId = setTimeout(() => {
            if (group.userData.customLoaded || !group.userData.customLoading) return;
            group.userData.customLoading = false;
            this.setModelProgress(compID, 0, 'timeout', 'Load timeout');
        }, LOAD_TIMEOUT_MS);
        this.progressTimeouts.set(compID, timeoutId);

        return this.loadGLTFScene(safeUrl, (p) => {
            this.setModelProgress(compID, Math.max(0, Math.min(100, p)), 'loading');
        }).then((gltf) => {
            if (version !== undefined && currentRenderVersion !== undefined && version !== currentRenderVersion) {
                if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
                if (placeholder) this.deepDispose(placeholder);
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
            const nb = new THREE.Box3().setFromObject(m); 
            const c = new THREE.Vector3(); nb.getCenter(c);
            m.position.sub(c);

            m.traverse((ch) => {
                if (ch.isMesh) {
                    if (ch.material.isMeshStandardMaterial || ch.material.isMeshPhysicalMaterial) {
                        ch.material.metalness = Math.max(ch.material.metalness ?? 0.3, 0.3);
                        ch.material.roughness = Math.max(ch.material.roughness ?? 0.55, 0.55);
                    }
                    ch.material.side = THREE.DoubleSide; 
                    ch.castShadow = true; 
                    ch.receiveShadow = true;
                    if (ch.material.map) ch.material.map.colorSpace = THREE.SRGBColorSpace;
                }
            });

            if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
            if (placeholder) this.deepDispose(placeholder);
            if (group.userData.loadingPlaceholder === placeholder) delete group.userData.loadingPlaceholder;
            
            group.add(m); 
            
            group.userData.customLoaded = true;
            group.userData.customLoading = false;
            this.setModelProgress(compID, 100, 'done');
            
            if (this.progressTimeouts.has(compID)) {
                clearTimeout(this.progressTimeouts.get(compID));
                this.progressTimeouts.delete(compID);
            }
            
            return m; // Return the loaded mesh for caller assignment if needed
        }).catch((e) => {
            if (version !== undefined && currentRenderVersion !== undefined && version !== currentRenderVersion) return;
            console.warn(`Failed ${url}`, e); 
            if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
            if (placeholder) this.deepDispose(placeholder);
            if (group.userData.loadingPlaceholder === placeholder) delete group.userData.loadingPlaceholder;
            
            this.createDefaultCylinder(group, compID); 
            group.userData.customLoading = false;
            this.setModelProgress(compID, 0, 'error', 'Load failed');
            if (this.progressTimeouts.has(compID)) {
                clearTimeout(this.progressTimeouts.get(compID));
                this.progressTimeouts.delete(compID);
            }
        });
    }
}

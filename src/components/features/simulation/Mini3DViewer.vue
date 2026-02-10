<template>
  <div ref="container" class="mini-viewer"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const props = defineProps(['modelUrl']);
const container = ref(null);

let scene, camera, renderer, controls, reqId;

// Dynamic Backend URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '');

// Race condition handling
let loadRequestId = 0;

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

const init = () => {
  if (!container.value) return;
  const w = container.value.clientWidth;
  const h = container.value.clientHeight;

  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0); 
  
  renderer.useLegacyLights = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  container.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true; 
  controls.autoRotateSpeed = 2.0;

  // Lights
  const amb = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(amb);
  
  const dir = new THREE.DirectionalLight(0xffffff, 3.0);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0xb0c4de, 1.5);
  fill.position.set(-5, 0, -5);
  scene.add(fill);

  loadModel();
  animate();
};

const loadModel = () => {
  if (!props.modelUrl) return;
  
  // Cleanup previous model
  if (scene) {
      const oldModel = scene.getObjectByName('preview_model');
      if (oldModel) deepDispose(oldModel);
  }

  const loader = new GLTFLoader();
  
  let url = props.modelUrl;
  if (!url.startsWith('http')) {
      url = `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const myId = ++loadRequestId;

  loader.load(url, (gltf) => {
    if (myId !== loadRequestId) {
        deepDispose(gltf.scene);
        return;
    }

    const model = gltf.scene;
    model.name = 'preview_model';
    
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / (maxDim || 1); 
    model.scale.set(scale, scale, scale);
    model.position.sub(center.multiplyScalar(scale)); 

    model.traverse(child => {
      if (child.isMesh) {
         child.material.side = THREE.DoubleSide; 
      }
    });

    scene.add(model);
  });
};

const animate = () => {
  reqId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
};

const ro = new ResizeObserver(() => {
  if (container.value && renderer && camera) {
    const w = container.value.clientWidth;
    const h = container.value.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
});

onMounted(() => {
  init();
  ro.observe(container.value);
});

onUnmounted(() => {
  ro.disconnect();
  cancelAnimationFrame(reqId);
  
  // Deep cleanup
  if (scene) {
      deepDispose(scene);
      scene = null;
  }
  
  if (renderer) {
      renderer.dispose();
      renderer = null;
  }
  if (controls) controls.dispose();
});

watch(() => props.modelUrl, () => {
    loadModel();
});
</script>

<style scoped>
.mini-viewer { width: 100%; height: 100%; overflow: hidden; }
</style>

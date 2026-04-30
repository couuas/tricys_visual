import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneBootstrap {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.labelRenderer = null;
        this.controls = null;
        this.reqId = null;

        this.onRenderCallbacks = new Set();
        
        this.init();
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b1016);
        this.scene.fog = new THREE.FogExp2(0x0b1016, 0.0009);
        
        const grid = new THREE.GridHelper(1200, 60, 0x223040, 0x141c24);
        this.scene.add(grid);

        // 2. Camera setup
        this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 1, 8000);
        this.camera.position.set(0, 450, 600);

        // 3. WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.useLegacyLights = false; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
        this.renderer.toneMappingExposure = 1.0; 
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Environment
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.7).texture;
        pmrem.dispose();

        // 4. Label Renderer
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(this.width, this.height);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none'; 
        this.container.appendChild(this.labelRenderer.domElement);

        // 5. Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.controls.enablePan = true;
        this.controls.screenSpacePanning = true;

        // 6. Lights
        const ambient = new THREE.AmbientLight(0xd6dde6, 1.8); 
        this.scene.add(ambient);
        
        const dirLight = new THREE.DirectionalLight(0xe8eef5, 2.2);
        dirLight.position.set(200, 400, 200);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
        
        const fillLight = new THREE.DirectionalLight(0x8fb1d1, 1.2);
        fillLight.position.set(-200, 200, -200);
        this.scene.add(fillLight);
        
        const rimLight = new THREE.DirectionalLight(0x7bb7ff, 0.9);
        rimLight.position.set(0, 300, -300);
        this.scene.add(rimLight);

        // Handle resize properly
        this.resizeObserver = new ResizeObserver(this.onWindowResize.bind(this));
        this.resizeObserver.observe(this.container);

        this.startLoop();
    }

    startLoop() {
        const loop = () => {
            this.reqId = requestAnimationFrame(loop);
            this.controls.update();

            // Run registered callbacks
            this.onRenderCallbacks.forEach(cb => cb());

            this.renderer.render(this.scene, this.camera);
            this.labelRenderer.render(this.scene, this.camera);
        };
        this.reqId = requestAnimationFrame(loop);
    }

    addRenderCallback(cb) {
        this.onRenderCallbacks.add(cb);
    }

    removeRenderCallback(cb) {
        this.onRenderCallbacks.delete(cb);
    }

    onWindowResize() {
        if (!this.container) return;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        if (this.camera) {
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
        }
        if (this.renderer) {
            this.renderer.setSize(this.width, this.height);
        }
        if (this.labelRenderer) {
            this.labelRenderer.setSize(this.width, this.height);
        }
    }

    dispose() {
        if (this.reqId) cancelAnimationFrame(this.reqId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        if (this.labelRenderer) {
            this.container.removeChild(this.labelRenderer.domElement);
        }
        if (this.controls) this.controls.dispose();
        this.onRenderCallbacks.clear();
    }
}

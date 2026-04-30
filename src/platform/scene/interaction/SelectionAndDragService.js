import * as THREE from 'three';

export class SelectionAndDragService {
    constructor(engine) {
        this.engine = engine; // Reference to TopologySceneEngine
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.dragPlane = new THREE.Plane();
        this.planeIntersect = new THREE.Vector3();
        this.dragOffset = new THREE.Vector3();
        this.dragStartWorld = new THREE.Vector3();
        
        this.isDragging = false;
        this.draggedObject = null;
        this.dragStartPos = new THREE.Vector2();
        this.rightClickStartPos = new THREE.Vector2();
        
        this.selectionStart = new THREE.Vector2();
        this.selectionEnd = new THREE.Vector2();
        this.isBoxSelecting = false;
        this.selectionRect = { x: 0, y: 0, w: 0, h: 0 };
        
        this.dragUndoState = null;
        this.dragMoved = false;
        this.readonlyPointerDown = null;
        this.readonlyClickTimer = null;
        this.READONLY_CLICK_DELAY = 220;

        this.hoverTimer = null;
        this.HOVER_DELAY = 400;
        
        // Expose an event callback for UI updates
        this.onEvent = null;

        this.attachEvents();
    }

    attachEvents() {
        const canvas = this.engine.bootstrap.renderer.domElement;
        this._downHandler = this.onPointerDown.bind(this);
        this._moveHandler = this.onPointerMove.bind(this);
        this._upHandler = this.onPointerUp.bind(this);
        this._contextHandler = this.onContextMenu.bind(this);
        this._dblClickHandler = this.onDoubleClick.bind(this);

        canvas.addEventListener('pointerdown', this._downHandler);
        canvas.addEventListener('pointermove', this._moveHandler);
        canvas.addEventListener('pointerup', this._upHandler);
        canvas.addEventListener('contextmenu', this._contextHandler);
        canvas.addEventListener('dblclick', this._dblClickHandler);
    }

    dispose() {
        if (!this.engine.bootstrap || !this.engine.bootstrap.renderer) return;
        const canvas = this.engine.bootstrap.renderer.domElement;
        if (this.readonlyClickTimer) {
            clearTimeout(this.readonlyClickTimer);
            this.readonlyClickTimer = null;
        }
        canvas.removeEventListener('pointerdown', this._downHandler);
        canvas.removeEventListener('pointermove', this._moveHandler);
        canvas.removeEventListener('pointerup', this._upHandler);
        canvas.removeEventListener('contextmenu', this._contextHandler);
        canvas.removeEventListener('dblclick', this._dblClickHandler);
    }

    getIntersectedComponent(clientX, clientY) {
        const { camera, container, scene, componentGroupsMap } = this.engine;
        if (!container || !camera) return null;
        
        const rect = container.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        const intersects = this.raycaster.intersectObjects(scene.children, true);
        
        for (let i = 0; i < intersects.length; i++) {
            let obj = intersects[i].object;
            while (obj.parent && obj.parent !== scene) {
                if (componentGroupsMap[obj.name]) return { id: obj.name, object: obj.parent };
                obj = obj.parent;
            }
            if (componentGroupsMap[obj.name]) return { id: obj.name, object: obj };
        }
        return null;
    }

    getIntersectedConnection(clientX, clientY) {
        const { camera, container, scene } = this.engine;
        if (!container || !camera) return null;

        const rect = container.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        const intersects = this.raycaster.intersectObjects(scene.children);
        
        for (let i = 0; i < intersects.length; i++) {
            const obj = intersects[i].object;
            if (obj.name && obj.name.startsWith("CONN_")) return obj;
        }
        return null;
    }

    updateSelectionRect() {
        const { container } = this.engine;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x1 = this.selectionStart.x - rect.left;
        const y1 = this.selectionStart.y - rect.top;
        const x2 = this.selectionEnd.x - rect.left;
        const y2 = this.selectionEnd.y - rect.top;
        this.selectionRect.x = Math.min(x1, x2);
        this.selectionRect.y = Math.min(y1, y2);
        this.selectionRect.w = Math.abs(x2 - x1);
        this.selectionRect.h = Math.abs(y2 - y1);
        this.emit('selectionRectUpdated', this.selectionRect);
    }

    applyBoxSelection(mode = 'set') {
        const { camera, container, componentGroupsMap } = this.engine;
        if (!container || !camera) return;
        const rect = container.getBoundingClientRect();
        const left = this.selectionRect.x;
        const right = this.selectionRect.x + this.selectionRect.w;
        const top = this.selectionRect.y;
        const bottom = this.selectionRect.y + this.selectionRect.h;

        const currentSelected = this.engine.config.multiSelectedIds || new Set();
        const selected = mode === 'add' || mode === 'remove' ? new Set(currentSelected) : new Set();
        
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
        
        this.emit('boxSelectionApplied', selected);
    }

    onPointerDown(event) {
        const { controls, container, camera, config } = this.engine;
        
        if (event.button === 2) {
            this.rightClickStartPos.set(event.clientX, event.clientY);
        }

        if (event.button !== 0) return; 
        const res = this.getIntersectedComponent(event.clientX, event.clientY);
        
        if (event.shiftKey && !res) {
            this.isBoxSelecting = true;
            if (controls) controls.enabled = false;
            this.emit('hoverHide');
            this.selectionStart.set(event.clientX, event.clientY);
            this.selectionEnd.set(event.clientX, event.clientY);
            this.updateSelectionRect();
            this.emit('boxSelectionStarted');
            return;
        }

        if (config.isReadOnly) {
            this.readonlyPointerDown = {
                id: res ? res.id : null,
                clientX: event.clientX,
                clientY: event.clientY
            };
        }

        if (res) {
            if (event.shiftKey) {
                this.emit('toggleMultiSelect', res.id);
                return;
            }
            
            if (config.isReadOnly) {
                return;
            }

            this.dragUndoState = this.engine.layoutHistory.getState ? this.engine.layoutHistory.getState() : null;
            this.dragMoved = false;
            this.isDragging = true;
            if (controls) controls.enabled = false;
            
            this.draggedObject = res.object;
            this.dragStartWorld.copy(res.object.position);
            this.dragStartPos.set(event.clientX, event.clientY);
            
            const normal = new THREE.Vector3(0, 1, 0); 
            this.dragPlane.setFromNormalAndCoplanarPoint(normal, res.object.position);
            
            const rect = container.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, camera);
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                this.dragOffset.subVectors(res.object.position, this.planeIntersect);
            }
        }
    }

    onPointerMove(event) {
        const { camera, container, config } = this.engine;
        
        if (this.isBoxSelecting) {
            this.selectionEnd.set(event.clientX, event.clientY);
            this.updateSelectionRect();
            return;
        }
        
        if (this.isDragging && this.draggedObject) {
            const rect = container.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, camera);
            
            if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
                const newPos = this.planeIntersect.add(this.dragOffset);
                this.draggedObject.position.set(newPos.x, config.TANK_HEIGHT / 2, newPos.z);
                this.draggedObject.updateMatrixWorld();
                
                this.emit('componentMoved', this.draggedObject.name);
                this.dragMoved = true;
            }
            return;
        }

        this.emit('hoverHide');
        if (this.hoverTimer) clearTimeout(this.hoverTimer);
        
        // We shouldn't depend on DOM classes completely, but this maintains parity
        if (event.target.closest('.ui-panel') || event.target.closest('.editor-panel')) return;

        this.hoverTimer = setTimeout(() => {
            const res = this.getIntersectedComponent(event.clientX, event.clientY);
            if (res) {
                container.style.cursor = 'pointer';
                this.emit('hoverShow', { id: res.id, clientX: event.clientX, clientY: event.clientY });
            } else {
                container.style.cursor = 'default';
            }
        }, this.HOVER_DELAY);
    }

    async onPointerUp(event) {
        const { controls, container, config } = this.engine;

        if (config.isReadOnly && this.readonlyPointerDown && event.button === 0) {
            const deltaX = event.clientX - this.readonlyPointerDown.clientX;
            const deltaY = event.clientY - this.readonlyPointerDown.clientY;
            const isClick = Math.hypot(deltaX, deltaY) < 5;
            const clickedId = this.readonlyPointerDown.id;
            this.readonlyPointerDown = null;

            if (isClick) {
                if (this.readonlyClickTimer) {
                    clearTimeout(this.readonlyClickTimer);
                }
                this.readonlyClickTimer = setTimeout(() => {
                    this.emit('selectComponent', clickedId || null);
                    this.readonlyClickTimer = null;
                }, this.READONLY_CLICK_DELAY);
            }
        } else if (event.button === 0) {
            this.readonlyPointerDown = null;
        }

        if (this.isBoxSelecting) {
            this.isBoxSelecting = false;
            if (controls) controls.enabled = true;
            this.emit('boxSelectionEnded');
            
            const small = this.selectionRect.w < 4 || this.selectionRect.h < 4;
            if (!small) {
                const mode = event.altKey ? 'remove' : (event.ctrlKey || event.metaKey ? 'add' : 'set');
                this.applyBoxSelection(mode);
            }
            return;
        }
        
        if (this.isDragging && this.draggedObject) {
            this.isDragging = false;
            if (controls) controls.enabled = true;
            container.style.cursor = 'default';
            
            if (this.dragUndoState && this.dragMoved) {
                if (this.engine.layoutHistory.undoStack) {
                    this.engine.layoutHistory.pushUndoState(this.dragUndoState);
                }
            }
            
            const id = this.draggedObject.name;
            const deltaX = (this.draggedObject.position.x - this.dragStartWorld.x) / config.LAYOUT_SPREAD;
            const deltaY = -(this.draggedObject.position.z - this.dragStartWorld.z) / config.LAYOUT_SPREAD;
            const finalX = this.draggedObject.position.x / config.LAYOUT_SPREAD;
            const finalY = -this.draggedObject.position.z / config.LAYOUT_SPREAD;
            
            this.emit('dragEnded', {
                id,
                deltaX,
                deltaY,
                finalX,
                finalY,
                isGroupObj: config.isGroup && config.isGroup(id)
            });

            this.draggedObject = null;
            this.dragUndoState = null;
            this.dragMoved = false;
            return;
        }
    }

    onContextMenu(event) {
        event.preventDefault(); 
        
        const dist = this.rightClickStartPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        if (dist > 5) return;

        const resComp = this.getIntersectedComponent(event.clientX, event.clientY);
        if (resComp) {
            if (event.shiftKey) {
                 this.emit('toggleMultiSelect', resComp.id);
            } else {
                 this.emit('selectComponent', resComp.id);
            }
            return;
        }
        
        const resConn = this.getIntersectedConnection(event.clientX, event.clientY);
        if (resConn) {
            this.emit('selectConnection', resConn.userData.id);
            return;
        }
        
        this.emit('selectComponent', null);
    }
    
    onDoubleClick(event) {
        if (this.readonlyClickTimer) {
            clearTimeout(this.readonlyClickTimer);
            this.readonlyClickTimer = null;
        }
        const result = this.getIntersectedComponent(event.clientX, event.clientY);
        if (result) {
            this.emit('doubleClickComponent', result.id);
        } else {
            this.emit('doubleClickEmpty');
        }
    }

    emit(type, payload) {
        if (this.onEvent) this.onEvent(type, payload);
    }
}

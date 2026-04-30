export const MAX_UNDO = 50;
export const MAX_SNAPSHOTS = 20;

export class LayoutHistoryService {
    constructor(projectIdCallback, applyStateCallback, getStateCallback) {
        // Since the engine is decoupled from Vue, it needs callbacks to read/write project state
        this.getProjectId = projectIdCallback;
        this.applyState = applyStateCallback;
        this.getState = getStateCallback;

        this.undoStack = [];
        this.redoStack = [];
        this.layoutSnapshots = [];
        this.selectedSnapshotId = '';

        this.onStateChange = null; // Callback for UI to react to canUndo/canRedo/snapshots

        this.loadSnapshotsFromStorage();
    }

    notifyState() {
        if (this.onStateChange) {
            this.onStateChange({
                canUndo: this.undoStack.length > 0,
                canRedo: this.redoStack.length > 0,
                snapshots: this.layoutSnapshots,
                selectedSnapshotId: this.selectedSnapshotId,
                hasSnapshot: this.layoutSnapshots.length > 0
            });
        }
    }

    pushUndoState() {
        const state = this.getState();
        if (!state) return;
        this.undoStack.push(state);
        if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
        this.redoStack = [];
        this.notifyState();
    }

    async undoLayout() {
        if (!this.undoStack.length) return;
        const current = this.getState();
        const prev = this.undoStack.pop();
        if (current) this.redoStack.push(current);
        await this.applyState(prev, true);
        this.notifyState();
    }

    async redoLayout() {
        if (!this.redoStack.length) return;
        const current = this.getState();
        const next = this.redoStack.pop();
        if (current) this.undoStack.push(current);
        await this.applyState(next, true);
        this.notifyState();
    }

    getSnapshotKey() {
        const pid = this.getProjectId() || 'default';
        return `tricys_layout_snapshots_${pid}`;
    }

    loadSnapshotsFromStorage() {
        const raw = localStorage.getItem(this.getSnapshotKey());
        let list = [];
        try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
        if (!Array.isArray(list)) list = [];
        this.layoutSnapshots = list;
        this.selectedSnapshotId = list.length ? list[0].id : '';
        this.notifyState();
    }

    saveSnapshotsToStorage() {
        localStorage.setItem(this.getSnapshotKey(), JSON.stringify(this.layoutSnapshots));
        this.notifyState();
    }

    createSnapshotPayload(name) {
        const base = this.getState();
        if (!base) return null;
        const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
            ...base,
            id,
            name: name || `Snapshot ${new Date().toLocaleString()}`
        };
    }

    saveLayoutSnapshot(name) {
        const payload = this.createSnapshotPayload(name);
        if (!payload) return;
        this.layoutSnapshots.unshift(payload);
        if (this.layoutSnapshots.length > MAX_SNAPSHOTS) this.layoutSnapshots.pop();
        this.selectedSnapshotId = payload.id;
        this.saveSnapshotsToStorage();
    }

    async restoreLayoutSnapshot(snapshotId) {
        if (!snapshotId) return;
        const snapshot = this.layoutSnapshots.find(s => s.id === snapshotId);
        if (!snapshot) return;
        this.pushUndoState();
        await this.applyState(snapshot, true);
    }

    deleteLayoutSnapshot(snapshotId) {
        if (!snapshotId) return;
        this.layoutSnapshots = this.layoutSnapshots.filter(s => s.id !== snapshotId);
        this.selectedSnapshotId = this.layoutSnapshots.length ? this.layoutSnapshots[0].id : '';
        this.saveSnapshotsToStorage();
    }
}

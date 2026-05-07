<template>
    <div class="snapshot-panel">
        <div class="snapshot-panel-header">
            <div class="snapshot-title">Layout Snapshots</div>
            <div v-show="historyStackLength > 0" class="history-controls">
                <button class="history-btn" :disabled="historyCursor <= 0 || isReadOnly || isBusy" @click="$emit('undo')" title="Undo">↶</button>
                <span class="history-status">{{ historyCursor }} / {{ Math.max(historyStackLength - 1, 0) }}</span>
                <button class="history-btn" :disabled="historyCursor >= historyStackLength - 1 || isReadOnly || isBusy" @click="$emit('redo')" title="Redo">↷</button>
            </div>
        </div>

        <div class="snapshot-panel-body">
            <div class="snapshot-actions">
                <button class="history-btn" :disabled="isReadOnly || isBusy" @click="$emit('save')">Save</button>
                <button class="history-btn" :disabled="!modelValue || isReadOnly || isBusy" @click="$emit('restore')">Restore</button>
                <button class="history-btn" :disabled="!modelValue || isReadOnly || isBusy" @click="$emit('delete')">Delete</button>
            </div>

            <select
                :value="modelValue"
                class="snapshot-select"
                :disabled="snapshots.length === 0 || isBusy"
                @change="$emit('update:modelValue', $event.target.value)"
            >
                <option value="">{{ snapshots.length === 0 ? 'No snapshots' : 'Select snapshot' }}</option>
                <option v-for="snapshot in snapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshot.name }}</option>
            </select>
        </div>
    </div>
</template>

<script setup>
defineEmits(['undo', 'redo', 'save', 'restore', 'delete', 'update:modelValue']);

defineProps({
    historyStackLength: { type: Number, default: 0 },
    historyCursor: { type: Number, default: -1 },
    isReadOnly: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    snapshots: { type: Array, default: () => [] },
    modelValue: { type: String, default: '' }
});
</script>

<style scoped>
.snapshot-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid #1f2a36;
    background: rgba(10, 16, 22, 0.92);
}

.snapshot-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.snapshot-title {
    font-size: 11px;
    font-weight: bold;
    color: #8da2bb;
    text-transform: uppercase;
}

.snapshot-panel-body {
    display: flex;
    gap: 10px;
    align-items: center;
}

.snapshot-actions {
    display: flex;
    gap: 8px;
}

.history-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.history-btn {
    background: transparent;
    color: #00d2ff;
    border: 1px solid rgba(0, 210, 255, 0.3);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
}

.history-btn:hover:not(:disabled) {
    background: rgba(0, 210, 255, 0.1);
}

.history-btn:disabled {
    color: #445566;
    border-color: #223344;
    cursor: not-allowed;
}

.history-status {
    font-size: 11px;
    color: #8da2bb;
    font-family: monospace;
}

.snapshot-select {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #eee;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.snapshot-select:focus {
    outline: none;
    border-color: #00d2ff;
}
</style>
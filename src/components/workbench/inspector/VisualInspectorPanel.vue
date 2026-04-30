<template>
    <div class="inspector-card">
        <div class="inspector-header">
            <span>Component: {{ selectedId.toUpperCase() }}</span>
            <button class="close-btn" @click="$emit('close')" title="Hide Panel">×</button>
        </div>

        <div v-if="isSelectedGroup" class="group-actions">
            <button class="btn secondary" @click="$emit('toggleGroupView')" :disabled="isReadOnly">
                {{ expandedGroupId === selectedGroupId ? 'Collapse Group' : 'View Inside' }}
            </button>
            <button class="btn secondary" @click="$emit('dissolveGroup')" :disabled="isReadOnly">Dissolve Group</button>
        </div>

        <div class="form-group">
            <label>Description</label>
            <textarea
                :value="note"
                rows="2"
                :disabled="isReadOnly"
                class="inspector-input"
                @input="$emit('update:note', $event.target.value)"
            />
        </div>

        <div class="form-group">
            <label>Scale: {{ normalizedScale.toFixed(1) }}</label>
            <input
                type="range"
                min="0.1"
                max="50.0"
                step="0.1"
                :value="normalizedScale"
                :disabled="isReadOnly"
                class="inspector-input-range"
                @input="onScaleInput"
            />
        </div>

        <div class="form-group">
            <label>3D Library Asset</label>
            <select
                :value="config.url || ''"
                :disabled="isReadOnly"
                class="inspector-input asset-select"
                @change="onAssetChange"
            >
                <option value="">Use Default Geometry</option>
                <option v-for="model in models" :key="model.url" :value="model.url">{{ model.name }}</option>
            </select>
            <button
                class="btn flat upload-btn"
                @click="$emit('requestUpload')"
                :disabled="isReadOnly"
            >
                <span class="icon">↑</span> Upload Custom .glb
            </button>
        </div>

        <div class="inspector-actions">
            <button class="btn primary" @click="$emit('save')" :disabled="isReadOnly">Apply Changes</button>
            <button class="btn secondary" @click="$emit('reset')" :disabled="isReadOnly">Reset</button>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const emit = defineEmits([
    'close',
    'toggleGroupView',
    'dissolveGroup',
    'update:note',
    'update:config',
    'save',
    'reset',
    'requestUpload'
]);

const props = defineProps({
    selectedId: { type: String, required: true },
    isSelectedGroup: { type: Boolean, default: false },
    expandedGroupId: { type: String, default: null },
    selectedGroupId: { type: String, default: '' },
    isReadOnly: { type: Boolean, default: false },
    note: { type: String, default: '' },
    config: { type: Object, default: () => ({}) },
    models: { type: Array, default: () => [] }
});

const normalizedScale = computed(() => Number(props.config?.scale ?? 1));

const onScaleInput = (event) => {
    emit('update:config', {
        ...props.config,
        scale: Number(event.target.value)
    });
};

const onAssetChange = (event) => {
    const url = event.target.value;
    emit('update:config', {
        ...props.config,
        url,
        type: url ? 'custom' : 'default'
    });
};
</script>

<style scoped>
.inspector-card {
    padding: 15px;
    font-size: 13px;
}

.inspector-header {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: bold;
    color: #00d2ff;
    background: rgba(0, 0, 0, 0.2);
    padding: 10px;
    margin: -10px -10px 15px -10px;
    border-bottom: 1px solid rgba(0, 210, 255, 0.2);
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 22px;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
}

.group-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    font-size: 11px;
    color: #888;
    margin-bottom: 6px;
    font-weight: bold;
}

.inspector-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #eee;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
}

.inspector-input:focus {
    outline: none;
    border-color: #00d2ff;
}

.asset-select {
    margin-bottom: 5px;
}

.inspector-input-range {
    width: 100%;
    cursor: pointer;
    accent-color: #00d2ff;
}

.inspector-actions {
    display: flex;
    gap: 10px;
    margin-top: 15px;
}

.btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: 0.2s;
    font-size: 13px;
}

.btn.primary {
    background: linear-gradient(135deg, #0066ff, #00d2ff);
    color: #fff;
}

.btn.secondary,
.btn.flat {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
}

.upload-btn {
    width: 100%;
    border: 1px dashed rgba(255, 255, 255, 0.2);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
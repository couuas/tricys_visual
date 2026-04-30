<template>
    <div class="inspector-card">
        <div class="inspector-header">
            <span>Connection Settings</span>
            <button class="close-btn" @click="$emit('close')" title="Hide Panel">×</button>
        </div>

        <div class="form-group">
            <label>Color</label>
            <div class="color-row">
                <input
                    type="color"
                    :value="style.color || '#ffd700'"
                    :disabled="isReadOnly"
                    class="color-input"
                    @input="updateStyle('color', $event.target.value)"
                />
                <input
                    type="text"
                    :value="style.color || '#ffd700'"
                    :disabled="isReadOnly"
                    class="inspector-input mono"
                    @input="updateStyle('color', $event.target.value)"
                />
            </div>
        </div>

        <div class="form-group">
            <label>Line Width: {{ normalizedWidth.toFixed(1) }}</label>
            <input
                type="range"
                min="1.0"
                max="20.0"
                step="0.5"
                :value="normalizedWidth"
                :disabled="isReadOnly"
                class="inspector-input-range"
                @input="updateNumericStyle('width', $event.target.value)"
            />
        </div>

        <div class="form-group">
            <label>Opacity: {{ normalizedOpacity.toFixed(1) }}</label>
            <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                :value="normalizedOpacity"
                :disabled="isReadOnly"
                class="inspector-input-range"
                @input="updateNumericStyle('opacity', $event.target.value)"
            />
        </div>

        <div class="form-group" v-if="style.type !== 'solid'">
            <label>Flow Speed: {{ normalizedSpeed.toFixed(1) }}x</label>
            <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                :value="normalizedSpeed"
                :disabled="isReadOnly"
                class="inspector-input-range"
                @input="updateNumericStyle('speed', $event.target.value)"
            />
        </div>

        <div class="inspector-actions">
            <button class="btn primary" @click="$emit('save')" :disabled="isReadOnly">Apply Changes</button>
            <button class="btn secondary" @click="$emit('syncAll')" :disabled="isReadOnly">Sync All</button>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const emit = defineEmits(['close', 'update:style', 'save', 'syncAll']);

const props = defineProps({
    style: { type: Object, default: () => ({}) },
    isReadOnly: { type: Boolean, default: false }
});

const normalizedWidth = computed(() => Number(props.style?.width ?? 4));
const normalizedOpacity = computed(() => Number(props.style?.opacity ?? 0.9));
const normalizedSpeed = computed(() => Number(props.style?.speed ?? 1));

const updateStyle = (key, value) => {
    emit('update:style', {
        ...props.style,
        [key]: value
    });
};

const updateNumericStyle = (key, value) => {
    updateStyle(key, Number(value));
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

.color-row {
    display: flex;
    gap: 8px;
}

.color-input {
    cursor: pointer;
    height: 30px;
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

.mono {
    flex: 1;
    font-family: monospace;
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

.btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
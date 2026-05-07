<template>
    <div class="asset-library-panel">
        <div class="panel-title">Asset Library</div>

        <div class="asset-library-toolbar">
            <input
                v-model="searchTerm"
                type="text"
                class="library-search"
                placeholder="Search assets"
            />
            <button class="upload-btn" :disabled="isReadOnly" @click="$emit('requestUpload')">Upload</button>
        </div>

        <div class="asset-filter-row">
            <button
                v-for="filter in categoryFilters"
                :key="filter.value"
                class="filter-chip"
                :class="{ active: activeCategory === filter.value }"
                @click="activeCategory = filter.value"
            >
                <span>{{ filter.label }}</span>
                <span class="filter-count">{{ filter.count }}</span>
            </button>
        </div>

        <div class="asset-library-status">
            <span v-if="selectedComponentLabel">Target: {{ selectedComponentLabel }}</span>
            <span v-else-if="selectedConnectionId">Target: Connection {{ selectedConnectionId }}</span>
            <span v-else>Select a component to apply</span>
            <span v-if="selectedComponentCategory" class="status-chip">{{ selectedComponentCategory }}</span>
        </div>

        <div v-if="selectedConnectionId || selectedComponentLabel" class="selection-merge-panel">
            <div class="selection-merge-header">
                <div>
                    <div class="selection-merge-title">{{ selectedConnectionId ? `Connection ${selectedConnectionId}` : selectedComponentLabel }}</div>
                    <div v-if="selectedConnectionId" class="selection-merge-subtitle">Connection visual settings</div>
                    <div v-else-if="selectedComponentCategory" class="selection-merge-subtitle">{{ selectedComponentCategory }} binding controls</div>
                </div>
                <button class="selection-merge-close" @click="selectedConnectionId ? emit('closeConnection') : emit('closeSelection')">×</button>
            </div>

            <div v-if="selectedConnectionId" class="selection-merge-grid">
                <label class="selection-field">
                    <span>Color</span>
                    <input type="color" :value="connectionStyle.color || '#ffd700'" :disabled="isReadOnly" class="selection-color-input" @input="updateConnectionStyle('color', $event.target.value)" />
                </label>
                <label class="selection-field">
                    <span>Width {{ normalizedConnectionWidth.toFixed(1) }}</span>
                    <input type="range" min="1" max="20" step="0.5" :value="normalizedConnectionWidth" :disabled="isReadOnly" class="selection-range-input" @input="updateNumericConnectionStyle('width', $event.target.value)" />
                </label>
                <label class="selection-field">
                    <span>Opacity {{ normalizedConnectionOpacity.toFixed(1) }}</span>
                    <input type="range" min="0.1" max="1" step="0.1" :value="normalizedConnectionOpacity" :disabled="isReadOnly" class="selection-range-input" @input="updateNumericConnectionStyle('opacity', $event.target.value)" />
                </label>
                <label v-if="connectionStyle.type !== 'solid'" class="selection-field">
                    <span>Flow {{ normalizedConnectionSpeed.toFixed(1) }}x</span>
                    <input type="range" min="0.1" max="5" step="0.1" :value="normalizedConnectionSpeed" :disabled="isReadOnly" class="selection-range-input" @input="updateNumericConnectionStyle('speed', $event.target.value)" />
                </label>
            </div>

            <template v-else>
                <div v-if="isSelectedGroup" class="selection-action-row">
                    <button class="selection-btn secondary" :disabled="isReadOnly" @click="emit('toggleGroupView')">
                        {{ expandedGroupId === selectedGroupId ? 'Collapse Group' : 'View Inside' }}
                    </button>
                    <button class="selection-btn secondary" :disabled="isReadOnly" @click="emit('dissolveGroup')">Dissolve</button>
                </div>

                <label class="selection-field">
                    <span>Scale {{ normalizedScale.toFixed(1) }}</span>
                    <input type="range" min="0.1" max="50" step="0.1" :value="normalizedScale" :disabled="isReadOnly" class="selection-range-input" @input="onScaleInput" />
                </label>

                <div class="selection-binding-summary">
                    <div class="selection-binding-title">Current Binding</div>
                    <div class="selection-binding-name">{{ bindingState.currentAsset?.name || 'Default Geometry' }}</div>
                    <div class="selection-binding-url">{{ bindingState.currentAsset?.url || 'Using built-in primitive' }}</div>
                </div>

                <div v-if="bindingState.recommendations?.length" class="selection-quick-recommendations">
                    <div class="selection-binding-title">Quick Recommendations</div>
                    <div class="selection-chip-list">
                        <button
                            v-for="asset in bindingState.recommendations.slice(0, 3)"
                            :key="`quick-${asset.id}`"
                            class="selection-chip"
                            :disabled="isReadOnly || !canApplyAsset"
                            @click="$emit('selectAsset', asset.url)"
                        >
                            {{ asset.name }}
                        </button>
                    </div>
                </div>
            </template>

            <div class="selection-action-row">
                <button v-if="selectedConnectionId" class="selection-btn primary" :disabled="isReadOnly" @click="emit('saveConnection')">Apply</button>
                <button v-if="selectedConnectionId" class="selection-btn secondary" :disabled="isReadOnly" @click="emit('syncAllConnections')">Sync All</button>
                <button v-if="!selectedConnectionId" class="selection-btn primary" :disabled="isReadOnly" @click="emit('saveSelection')">Apply</button>
                <button v-if="!selectedConnectionId" class="selection-btn secondary" :disabled="isReadOnly" @click="emit('resetSelection')">Reset</button>
                <button v-if="!selectedConnectionId" class="selection-btn tertiary" :disabled="isReadOnly" @click="emit('requestUpload')">Upload</button>
            </div>
        </div>

        <div class="asset-preview" v-if="previewAsset">
            <div class="asset-preview-hero" :style="previewHeroStyle">
                <div class="asset-preview-mark">{{ previewAsset.preview?.label || '3D' }}</div>
                <div class="asset-preview-copy">
                    <div class="asset-preview-title">{{ previewAsset.preview?.title || previewAsset.name }}</div>
                    <div class="asset-preview-subtitle">{{ previewAsset.preview?.subtitle }}</div>
                </div>
                <span class="asset-validation-pill" :class="previewAsset.validation?.status">
                    {{ validationLabel(previewAsset.validation?.status) }}
                </span>
            </div>

            <div class="asset-preview-grid">
                <div class="preview-field">
                    <span class="preview-label">Format</span>
                    <span class="preview-value">{{ previewAsset.formatLabel }}</span>
                </div>
                <div class="preview-field">
                    <span class="preview-label">Source</span>
                    <span class="preview-value">{{ previewAsset.sourceType }}</span>
                </div>
                <div class="preview-field">
                    <span class="preview-label">Category</span>
                    <span class="preview-value">{{ previewAsset.category }}</span>
                </div>
                <div class="preview-field">
                    <span class="preview-label">Size</span>
                    <span class="preview-value">{{ previewAsset.sizeLabel || 'Unknown' }}</span>
                </div>
            </div>

            <div class="asset-preview-url">{{ previewAsset.url || 'No asset URL' }}</div>

            <div v-if="previewMessages.length" class="preview-messages">
                <div
                    v-for="message in previewMessages"
                    :key="message.text"
                    class="preview-message"
                    :class="message.type"
                >
                    {{ message.text }}
                </div>
            </div>

            <div v-if="previewAsset.tags?.length" class="preview-tags">
                <span v-for="tag in previewAsset.tags" :key="tag" class="preview-tag">{{ tag }}</span>
            </div>
        </div>

        <div class="asset-list">
            <button
                class="asset-card"
                :class="{ active: selectedAssetUrl === '' }"
                :disabled="isReadOnly || !canApplyAsset"
                @click="$emit('selectAsset', '')"
            >
                <span class="asset-name">Default Geometry</span>
                <span class="asset-meta">Built-in primitive</span>
            </button>

            <div v-if="filteredRecommendedModels.length > 0" class="asset-section-label">Recommended</div>

            <button
                v-for="asset in filteredRecommendedModels"
                :key="`recommended-${asset.id}`"
                class="asset-card recommended"
                :class="{ active: selectedAssetUrl === asset.url }"
                :disabled="isReadOnly || !canApplyAsset"
                @click="$emit('selectAsset', asset.url)"
            >
                <div class="asset-card-topline">
                    <span class="asset-name">{{ asset.name || asset.url }}</span>
                    <div class="asset-card-badges">
                        <span class="asset-badge">{{ asset.category }}</span>
                        <span class="asset-status-badge" :class="asset.validation?.status">{{ validationLabel(asset.validation?.status) }}</span>
                    </div>
                </div>
                <span class="asset-meta">{{ asset.url }}</span>
                <span class="asset-submeta">{{ asset.formatLabel }} · {{ asset.sourceType }}<template v-if="asset.sizeLabel"> · {{ asset.sizeLabel }}</template></span>
            </button>

            <div v-if="filteredModels.length > 0" class="asset-section-label">All Assets</div>

            <button
                v-for="asset in filteredModels"
                :key="asset.id"
                class="asset-card"
                :class="{ active: selectedAssetUrl === asset.url }"
                :disabled="isReadOnly || !canApplyAsset"
                @click="$emit('selectAsset', asset.url)"
            >
                <div class="asset-card-topline">
                    <span class="asset-name">{{ asset.name || asset.url }}</span>
                    <div class="asset-card-badges">
                        <span class="asset-badge muted">{{ asset.category }}</span>
                        <span class="asset-status-badge" :class="asset.validation?.status">{{ validationLabel(asset.validation?.status) }}</span>
                    </div>
                </div>
                <span class="asset-meta">{{ asset.url }}</span>
                <span class="asset-submeta">{{ asset.formatLabel }} · {{ asset.sourceType }}<template v-if="asset.sizeLabel"> · {{ asset.sizeLabel }}</template></span>
            </button>
        </div>

        <div v-if="filteredRecommendedModels.length === 0 && filteredModels.length === 0" class="empty-state">No matching assets</div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const emit = defineEmits([
    'selectAsset',
    'requestUpload',
    'closeSelection',
    'toggleGroupView',
    'dissolveGroup',
    'update:config',
    'saveSelection',
    'resetSelection',
    'closeConnection',
    'update:connectionStyle',
    'saveConnection',
    'syncAllConnections'
]);

const props = defineProps({
    models: { type: Array, default: () => [] },
    recommendedModels: { type: Array, default: () => [] },
    selectedAssetUrl: { type: String, default: '' },
    selectedComponentLabel: { type: String, default: '' },
    selectedComponentCategory: { type: String, default: '' },
    canApplyAsset: { type: Boolean, default: false },
    isReadOnly: { type: Boolean, default: false },
    selectedConnectionId: { type: String, default: '' },
    isSelectedGroup: { type: Boolean, default: false },
    selectedGroupId: { type: String, default: '' },
    expandedGroupId: { type: String, default: null },
    config: { type: Object, default: () => ({}) },
    bindingState: {
        type: Object,
        default: () => ({
            currentAsset: null,
            recommendations: []
        })
    },
    connectionStyle: { type: Object, default: () => ({}) }
});

const searchTerm = ref('');
const activeCategory = ref('all');
const normalizedScale = computed(() => Number(props.config?.scale ?? 1));
const normalizedConnectionWidth = computed(() => Number(props.connectionStyle?.width ?? 4));
const normalizedConnectionOpacity = computed(() => Number(props.connectionStyle?.opacity ?? 0.9));
const normalizedConnectionSpeed = computed(() => Number(props.connectionStyle?.speed ?? 1));

const normalizedSearch = computed(() => searchTerm.value.trim().toLowerCase());

const matchesSearch = (model) => {
    if (!normalizedSearch.value) {
        return true;
    }
    const haystacks = [
        String(model?.name || ''),
        String(model?.url || ''),
        String(model?.category || ''),
        ...(Array.isArray(model?.tags) ? model.tags : [])
    ].map(value => value.toLowerCase());
    return haystacks.some(value => value.includes(normalizedSearch.value));
};

const matchesCategory = (model) => {
    if (activeCategory.value === 'all') return true;
    if (activeCategory.value === 'recommended') return props.recommendedModels.some(item => item.id === model.id);
    if (activeCategory.value === 'valid') return model.validation?.status === 'valid';
    if (activeCategory.value === 'attention') return model.validation?.status !== 'valid';
    return model.category === activeCategory.value;
};

const matchesFilters = (model) => matchesSearch(model) && matchesCategory(model);

const allModels = computed(() => props.models || []);
const allCategories = computed(() => Array.from(new Set(allModels.value.map(model => model.category).filter(Boolean))));

const categoryFilters = computed(() => {
    const recommendedIds = new Set((props.recommendedModels || []).map(model => model.id));
    const filters = [
        { value: 'all', label: 'All', count: allModels.value.length },
        { value: 'recommended', label: 'Recommended', count: allModels.value.filter(model => recommendedIds.has(model.id)).length },
        { value: 'valid', label: 'Ready', count: allModels.value.filter(model => model.validation?.status === 'valid').length },
        { value: 'attention', label: 'Needs Check', count: allModels.value.filter(model => model.validation?.status !== 'valid').length }
    ];

    allCategories.value.forEach((category) => {
        filters.push({
            value: category,
            label: category,
            count: allModels.value.filter(model => model.category === category).length
        });
    });

    return filters.filter((filter, index, array) => array.findIndex(item => item.value === filter.value) === index && filter.count > 0);
});

const filteredRecommendedModels = computed(() => props.recommendedModels.filter(matchesFilters));

const filteredModels = computed(() => {
    const recommendedIds = new Set(filteredRecommendedModels.value.map(model => model.id));
    return props.models.filter(model => !recommendedIds.has(model.id) && matchesFilters(model));
});

const previewAsset = computed(() => {
    if (props.selectedAssetUrl === '') {
        return {
            id: '__default__',
            name: 'Default Geometry',
            url: '',
            category: props.selectedComponentCategory || 'utility',
            formatLabel: 'Primitive',
            sourceType: 'builtin',
            sizeLabel: '',
            tags: ['default', 'builtin'],
            validation: { status: 'valid', errors: [], warnings: [] },
            preview: {
                label: 'DF',
                title: 'Default Geometry',
                subtitle: 'Fallback primitive / built-in'
            }
        };
    }

    return allModels.value.find(model => model.url === props.selectedAssetUrl)
        || filteredRecommendedModels.value[0]
        || filteredModels.value[0]
        || allModels.value[0]
        || null;
});

const previewHeroStyle = computed(() => ({
    '--asset-preview-accent': previewAsset.value?.preview?.accentColor || '#8da2bb'
}));

const previewMessages = computed(() => {
    const asset = previewAsset.value;
    if (!asset) return [];

    return [
        ...(asset.validation?.errors || []).map(text => ({ type: 'error', text })),
        ...(asset.validation?.warnings || []).map(text => ({ type: 'warning', text })),
        ...((!asset.validation?.errors?.length && !asset.validation?.warnings?.length)
            ? [{ type: 'success', text: asset.isPreviewable ? 'Asset is ready for binding and preview.' : 'Asset record is valid.' }]
            : [])
    ];
});

const validationLabel = (status) => {
    if (status === 'invalid') return 'Invalid';
    if (status === 'warning') return 'Check';
    return 'Ready';
};

const onScaleInput = (event) => {
    emit('update:config', {
        ...props.config,
        scale: Number(event.target.value)
    });
};

const updateConnectionStyle = (key, value) => {
    emit('update:connectionStyle', {
        ...props.connectionStyle,
        [key]: value
    });
};

const updateNumericConnectionStyle = (key, value) => {
    updateConnectionStyle(key, Number(value));
};
</script>

<style scoped>
.asset-library-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.panel-title {
    padding: 12px 15px;
    font-size: 12px;
    font-weight: bold;
    color: #8da2bb;
    text-transform: uppercase;
    border-bottom: 1px solid #1f2a36;
}

.asset-library-toolbar {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid #1f2a36;
}

.asset-filter-row {
    display: flex;
    gap: 8px;
    padding: 0 12px 12px;
    border-bottom: 1px solid #1f2a36;
    overflow-x: auto;
}

.filter-chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #9db1c6;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 11px;
    text-transform: uppercase;
    cursor: pointer;
}

.filter-chip.active {
    color: #8ae9ff;
    border-color: rgba(0, 210, 255, 0.28);
    background: rgba(0, 210, 255, 0.12);
}

.filter-count {
    color: #6d8299;
}

.library-search {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #e0e5eb;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
}

.library-search:focus {
    outline: none;
    border-color: rgba(0, 210, 255, 0.45);
}

.upload-btn {
    flex: 0 0 auto;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.28);
    color: #8ae9ff;
    border-radius: 6px;
    padding: 0 12px;
    cursor: pointer;
}

.upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.asset-library-status {
    padding: 0 12px 12px;
    font-size: 11px;
    color: #6d8299;
    border-bottom: 1px solid #1f2a36;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.status-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.24);
    color: #8ae9ff;
    text-transform: uppercase;
}

.selection-merge-panel {
    padding: 12px;
    border-bottom: 1px solid #1f2a36;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(11, 16, 22, 0.65);
}

.selection-merge-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}

.selection-merge-title {
    font-size: 13px;
    font-weight: 700;
    color: #dfeaf3;
    word-break: break-all;
}

.selection-merge-subtitle {
    margin-top: 4px;
    font-size: 10px;
    text-transform: uppercase;
    color: #6d8299;
}

.selection-merge-close {
    border: none;
    background: transparent;
    color: #7e90a4;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}

.selection-merge-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
}

.selection-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.selection-field > span {
    font-size: 10px;
    text-transform: uppercase;
    color: #6d8299;
    font-weight: 700;
}

.selection-range-input {
    width: 100%;
    cursor: pointer;
    accent-color: #00d2ff;
}

.selection-color-input {
    width: 100%;
    height: 32px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: transparent;
}

.selection-binding-summary {
    padding: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.selection-binding-title {
    font-size: 10px;
    text-transform: uppercase;
    color: #6d8299;
    font-weight: 700;
}

.selection-binding-name {
    font-size: 12px;
    color: #d9e4ef;
    font-weight: 600;
}

.selection-binding-url {
    font-size: 11px;
    color: #7e90a4;
    word-break: break-all;
}

.selection-quick-recommendations {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.selection-chip-list {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.selection-chip {
    border: 1px solid rgba(0, 210, 255, 0.24);
    background: rgba(0, 210, 255, 0.08);
    color: #8ae9ff;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 10px;
    cursor: pointer;
}

.selection-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.selection-action-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.selection-btn {
    flex: 1 1 0;
    min-width: 88px;
    border: none;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
}

.selection-btn.primary {
    background: linear-gradient(135deg, #0066ff, #00d2ff);
    color: #fff;
}

.selection-btn.secondary,
.selection-btn.tertiary {
    background: rgba(255, 255, 255, 0.08);
    color: #d0dcea;
}

.selection-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.asset-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.asset-preview {
    padding: 12px;
    border-bottom: 1px solid #1f2a36;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.asset-preview-hero {
    position: relative;
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
        radial-gradient(circle at top left, color-mix(in srgb, var(--asset-preview-accent) 18%, transparent), transparent 55%),
        rgba(255, 255, 255, 0.03);
}

.asset-preview-mark {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: color-mix(in srgb, var(--asset-preview-accent) 18%, #0f1720);
    color: #f2f7fb;
}

.asset-preview-title {
    font-size: 13px;
    font-weight: 700;
    color: #e7eff6;
}

.asset-preview-subtitle {
    margin-top: 4px;
    font-size: 11px;
    color: #88a1b8;
    text-transform: capitalize;
}

.asset-validation-pill {
    align-self: start;
    font-size: 10px;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid transparent;
}

.asset-validation-pill.valid,
.asset-status-badge.valid {
    color: #9ff2c4;
    background: rgba(69, 184, 110, 0.12);
    border-color: rgba(69, 184, 110, 0.24);
}

.asset-validation-pill.warning,
.asset-status-badge.warning {
    color: #ffd48a;
    background: rgba(255, 191, 71, 0.12);
    border-color: rgba(255, 191, 71, 0.24);
}

.asset-validation-pill.invalid,
.asset-status-badge.invalid {
    color: #ff9e9e;
    background: rgba(255, 98, 98, 0.12);
    border-color: rgba(255, 98, 98, 0.24);
}

.asset-preview-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.preview-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.preview-label {
    font-size: 10px;
    text-transform: uppercase;
    color: #6d8299;
}

.preview-value {
    font-size: 12px;
    color: #dce7f0;
}

.asset-preview-url {
    font-size: 11px;
    color: #88a1b8;
    word-break: break-all;
}

.preview-messages {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.preview-message {
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 11px;
    border: 1px solid transparent;
}

.preview-message.success {
    color: #a8f0c8;
    background: rgba(69, 184, 110, 0.12);
    border-color: rgba(69, 184, 110, 0.22);
}

.preview-message.warning {
    color: #ffd48a;
    background: rgba(255, 191, 71, 0.12);
    border-color: rgba(255, 191, 71, 0.22);
}

.preview-message.error {
    color: #ffb1b1;
    background: rgba(255, 98, 98, 0.12);
    border-color: rgba(255, 98, 98, 0.22);
}

.preview-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.preview-tag {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 10px;
    background: rgba(255, 255, 255, 0.05);
    color: #9db1c6;
}

.asset-section-label {
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #6d8299;
}

.asset-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    text-align: left;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 10px 12px;
    color: #dce7f0;
    cursor: pointer;
}

.asset-card:hover:not(:disabled) {
    border-color: rgba(0, 210, 255, 0.22);
    background: rgba(0, 210, 255, 0.07);
}

.asset-card.active {
    border-color: rgba(0, 210, 255, 0.35);
    background: rgba(0, 210, 255, 0.11);
}

.asset-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.asset-card-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}

.asset-card-badges {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.asset-name {
    font-size: 12px;
    font-weight: 700;
    color: #e7eff6;
    word-break: break-word;
}

.asset-meta,
.asset-submeta {
    font-size: 11px;
    color: #88a1b8;
    word-break: break-all;
}

.asset-badge,
.asset-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 7px;
    border-radius: 999px;
    font-size: 10px;
    text-transform: uppercase;
    background: rgba(0, 210, 255, 0.12);
    color: #8ae9ff;
    border: 1px solid rgba(0, 210, 255, 0.18);
}

.asset-badge.muted {
    background: rgba(255, 255, 255, 0.05);
    color: #9db1c6;
    border-color: rgba(255, 255, 255, 0.08);
}

.empty-state {
    margin: 12px;
    padding: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #6d8299;
    font-size: 11px;
    text-align: center;
}
</style>
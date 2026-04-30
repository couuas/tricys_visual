<template>
    <div class="binding-card">
        <div class="binding-header">
            <span>Binding</span>
            <span v-if="state.selectedComponentCategory" class="binding-chip">{{ state.selectedComponentCategory }}</span>
        </div>

        <div v-if="!state.canBind" class="binding-empty">Select a component to inspect asset binding.</div>

        <template v-else>
            <div class="binding-section">
                <div class="binding-section-title">Target</div>
                <div class="binding-target-name">{{ state.selectedComponentName || state.selectedComponentId }}</div>
                <div class="binding-target-id">{{ state.selectedComponentId }}</div>
            </div>

            <div class="binding-section">
                <div class="binding-section-title">Current Binding</div>
                <div v-if="state.currentAsset" class="binding-current">
                    <div class="binding-current-name">{{ state.currentAsset.name }}</div>
                    <div class="binding-current-url">{{ state.currentAsset.url }}</div>
                </div>
                <div v-else class="binding-empty-inline">Using default geometry</div>
            </div>

            <div class="binding-section">
                <div class="binding-section-title">Recommended Assets</div>
                <div v-if="state.recommendations.length === 0" class="binding-empty-inline">No recommendation candidates</div>
                <button
                    v-for="asset in state.recommendations"
                    :key="asset.id"
                    type="button"
                    class="binding-candidate"
                    @click="$emit('applyRecommendation', asset.url)"
                >
                    <div class="binding-candidate-topline">
                        <span class="binding-candidate-name">{{ asset.name }}</span>
                        <span class="binding-chip muted">{{ asset.category }}</span>
                    </div>
                    <div class="binding-candidate-url">{{ asset.url }}</div>
                    <div class="binding-reasons">{{ asset.reasons.join(' · ') }}</div>
                </button>
            </div>
        </template>
    </div>
</template>

<script setup>
defineEmits(['applyRecommendation']);

defineProps({
    state: {
        type: Object,
        default: () => ({
            selectedComponentId: '',
            selectedComponentName: '',
            selectedComponentCategory: '',
            currentAsset: null,
            recommendations: [],
            hasExplicitBinding: false,
            canBind: false
        })
    }
});
</script>

<style scoped>
.binding-card {
    padding: 14px 15px 16px;
    border-top: 1px solid #1f2a36;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.binding-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #8da2bb;
}

.binding-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.binding-section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: #6d8299;
}

.binding-target-name,
.binding-current-name,
.binding-candidate-name {
    font-size: 12px;
    font-weight: 600;
    color: #d9e4ef;
}

.binding-target-id,
.binding-current-url,
.binding-candidate-url,
.binding-reasons {
    font-size: 11px;
    color: #7e90a4;
    word-break: break-all;
}

.binding-current {
    padding: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.binding-candidate {
    width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: inherit;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
}

.binding-candidate:hover {
    border-color: rgba(0, 210, 255, 0.32);
    background: rgba(0, 210, 255, 0.08);
}

.binding-candidate-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.binding-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(0, 210, 255, 0.12);
    border: 1px solid rgba(0, 210, 255, 0.24);
    color: #8ae9ff;
    text-transform: uppercase;
    font-size: 10px;
}

.binding-chip.muted {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
    color: #9cb3c9;
}

.binding-empty,
.binding-empty-inline {
    font-size: 11px;
    color: #6d8299;
}
</style>

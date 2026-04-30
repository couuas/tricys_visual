<template>
    <ModelEditorShell
        :project-id="projectId"
        :mode="mode"
        :return-route-name="returnRouteName"
        :return-query="returnQuery"
    />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ModelEditorShell from '../components/workbench/ModelEditorShell.vue';

const route = useRoute();

const projectId = computed(() => String(route.query.projectId || 'model-editor-demo'));
const mode = computed(() => route.query.mode === 'view' ? 'view' : 'edit');

const returnRouteName = computed(() => {
    const source = String(route.query.from || 'config').toLowerCase();
    if (['config', 'monitor', 'visualizer'].includes(source)) {
        return source;
    }
    return 'config';
});

const returnQuery = computed(() => (
    projectId.value
        ? { projectId: projectId.value }
        : {}
));
</script>
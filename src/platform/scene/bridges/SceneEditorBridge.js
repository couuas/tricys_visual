import { computed } from 'vue';
import {
    buildAssetRecommendations,
    buildBindingRecommendationReasons,
    inferComponentCategory
} from '../../adapters/topology/assetRecommendations';
import { buildAssetCatalog } from '../../../platform/media/registry/mediaRegistry';
import { getSafeEntityId, isGroupId, resolveGroupKey } from '../../../utils/groupIds';

export function useSceneEditorBridge({
    structureData,
    modelConfig,
    componentGroups,
    libraryModels,
    selectedId,
    selectedConnectionId,
    currentAssetUrl
}) {
    const getSafeId = (rawId) => getSafeEntityId(rawId);

    const isSelectedGroup = computed(() => !!resolveGroupKey(selectedId.value, componentGroups.value) || isGroupId(selectedId.value));
    const selectedGroupId = computed(() => resolveGroupKey(selectedId.value, componentGroups.value));
    const selectedComponentLabel = computed(() => selectedId.value ? String(selectedId.value).toUpperCase() : '');
    const canApplyLibraryAsset = computed(() => !!selectedId.value && !isSelectedGroup.value && !selectedConnectionId.value);

    const selectedComponent = computed(() => {
        if (!selectedId.value) {
            return null;
        }

        return (structureData.value.components || []).find(component => getSafeId(component.id || component.name) === getSafeId(selectedId.value)) || null;
    });

    const selectedComponentCategory = computed(() => inferComponentCategory(selectedComponent.value));
    const assetCatalog = computed(() => buildAssetCatalog(libraryModels.value || []));

    const selectedBindingAsset = computed(() => {
        const selectedUrl = currentAssetUrl.value;
        if (!selectedUrl) {
            return null;
        }

        return assetCatalog.value.find(asset => asset.url === selectedUrl) || {
            id: selectedUrl,
            name: selectedUrl,
            url: selectedUrl,
            category: selectedComponentCategory.value || 'custom'
        };
    });

    const recommendedAssetCatalog = computed(() => {
        return buildAssetRecommendations({
            component: selectedComponent.value,
            componentCategory: selectedComponentCategory.value,
            assetCatalog: assetCatalog.value
        });
    });

    const bindingRecommendations = computed(() => {
        return buildBindingRecommendationReasons({
            component: selectedComponent.value,
            componentCategory: selectedComponentCategory.value,
            recommendations: recommendedAssetCatalog.value
        });
    });

    const bindingPanelState = computed(() => ({
        selectedComponentId: selectedComponent.value?.id || selectedId.value || '',
        selectedComponentName: selectedComponent.value?.label || selectedComponent.value?.name || selectedComponent.value?.id || '',
        selectedComponentCategory: selectedComponentCategory.value,
        currentAsset: selectedBindingAsset.value,
        recommendations: bindingRecommendations.value,
        hasExplicitBinding: !!currentAssetUrl.value,
        canBind: !!selectedId.value && !isSelectedGroup.value && !selectedConnectionId.value
    }));

    const connectionStyles = computed(() => modelConfig.value?.__connection_styles__ || {});

    return {
        assetCatalog,
        bindingPanelState,
        canApplyLibraryAsset,
        connectionStyles,
        getSafeId,
        isSelectedGroup,
        recommendedAssetCatalog,
        selectedComponent,
        selectedComponentCategory,
        selectedComponentLabel,
        selectedGroupId
    };
}
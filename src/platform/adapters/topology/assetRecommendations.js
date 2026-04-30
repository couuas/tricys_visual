import { inferAssetCategory, normalizeTextTokens } from '../../media/registry/mediaRegistry';

export const buildAssetRecommendations = ({ component, componentCategory, assetCatalog }) => {
    if (!component) {
        return [];
    }

    const componentTokens = new Set(normalizeTextTokens(
        component?.id,
        component?.name,
        component?.type,
        component?.class
    ));

    return (assetCatalog || [])
        .map(asset => {
            const overlapScore = (asset.searchTokens || []).reduce(
                (score, token) => score + (componentTokens.has(token) ? 2 : 0),
                0
            );
            const categoryScore = asset.category === componentCategory ? 1 : 0;
            return {
                ...asset,
                recommendationScore: overlapScore + categoryScore
            };
        })
        .filter(asset => asset.recommendationScore > 0)
        .sort((left, right) => right.recommendationScore - left.recommendationScore || left.name.localeCompare(right.name))
        .slice(0, 6);
};

export const buildBindingRecommendationReasons = ({ component, componentCategory, recommendations }) => {
    const componentTokens = normalizeTextTokens(
        component?.id,
        component?.name,
        component?.type,
        component?.class
    );

    return (recommendations || []).map(asset => {
        const reasons = [];
        if (asset.category === componentCategory) {
            reasons.push(`Category match: ${asset.category}`);
        }

        const matchedTokens = (asset.searchTokens || []).filter(token => componentTokens.includes(token)).slice(0, 3);
        if (matchedTokens.length > 0) {
            reasons.push(`Matched tokens: ${matchedTokens.join(', ')}`);
        }

        return {
            ...asset,
            reasons: reasons.length > 0 ? reasons : ['Fallback recommendation']
        };
    });
};

export const inferComponentCategory = (component) => {
    return inferAssetCategory(component?.id, component?.name, component?.type, component?.class);
};

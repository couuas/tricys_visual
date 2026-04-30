import {
    formatFileSize,
    inferAssetExtension,
    validateAssetRecord
} from '../validators/modelAssetValidator';

export const normalizeTextTokens = (...values) => values
    .flatMap(value => String(value || '').toLowerCase().split(/[^a-z0-9]+/g))
    .map(token => token.trim())
    .filter(Boolean);

export const inferAssetCategory = (...values) => {
    const normalized = normalizeTextTokens(...values).join(' ');
    if (['plasma', 'blanket', 'fw', 'div'].some(token => normalized.includes(token))) return 'core';
    if (['iss', 'sds', 'tes', 'tank', 'storage'].some(token => normalized.includes(token))) return 'storage';
    if (['tep', 'pump', 'cps', 'wds', 'compressor', 'process'].some(token => normalized.includes(token))) return 'process';
    return 'utility';
};

const categoryAccentMap = {
    core: '#ffbf47',
    storage: '#66d0ff',
    process: '#8df0b8',
    utility: '#a7b6c8'
};

export const buildAssetPreviewDescriptor = (asset) => {
    const format = asset?.formatLabel || 'Unknown';
    const name = String(asset?.name || 'Unnamed asset');
    const previewLabel = name.slice(0, 2).toUpperCase();

    return {
        title: name,
        subtitle: `${asset?.category || 'utility'} / ${format}`,
        label: previewLabel,
        accentColor: categoryAccentMap[asset?.category] || '#8da2bb'
    };
};

export const buildAssetCatalog = (models = []) => {
    return (models || []).map((model, index) => {
        const name = String(model?.name || model?.label || model?.url || `asset-${index}`);
        const url = String(model?.url || '');
        const category = inferAssetCategory(name, url);
        const validation = validateAssetRecord({ ...model, name, url });
        const extension = validation.extension || inferAssetExtension(url || name);
        const searchTokens = normalizeTextTokens(name, url, model?.category, ...(Array.isArray(model?.tags) ? model.tags : []));
        const sizeLabel = model?.size ? formatFileSize(model.size) : '';

        const asset = {
            ...model,
            id: model?.id || url || `asset-${index}`,
            name,
            url,
            category,
            extension,
            formatLabel: extension ? extension.toUpperCase() : 'Unknown',
            sourceType: validation.sourceType,
            validation,
            isPreviewable: validation.isValid && ['glb', 'gltf'].includes(extension),
            sizeLabel,
            tags: Array.from(new Set([
                category,
                validation.status,
                extension,
                validation.sourceType,
                ...searchTokens
            ].filter(Boolean))).slice(0, 12),
            searchTokens
        };

        return {
            ...asset,
            preview: buildAssetPreviewDescriptor(asset)
        };
    });
};

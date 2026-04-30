const SUPPORTED_MODEL_EXTENSIONS = ['glb', 'gltf'];

export const formatFileSize = (sizeInBytes) => {
    const size = Number(sizeInBytes || 0);
    if (!size) return '0 B';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const inferAssetExtension = (value) => {
    const normalized = String(value || '').trim().toLowerCase().split('?')[0].split('#')[0];
    const match = normalized.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : '';
};

export const inferAssetSourceType = (url) => {
    const normalized = String(url || '').trim().toLowerCase();
    if (!normalized) return 'missing';
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) return 'remote';
    if (normalized.startsWith('/')) return 'server';
    return 'workspace';
};

export const validateAssetRecord = (asset) => {
    const errors = [];
    const warnings = [];
    const extension = inferAssetExtension(asset?.url || asset?.name || '');

    if (!String(asset?.name || '').trim()) {
        warnings.push('Asset name is missing.');
    }

    if (!String(asset?.url || '').trim()) {
        errors.push('Asset URL is missing.');
    }

    if (!extension) {
        warnings.push('Asset format could not be inferred from the URL.');
    } else if (!SUPPORTED_MODEL_EXTENSIONS.includes(extension)) {
        errors.push(`Unsupported model format .${extension}. Use .glb or .gltf.`);
    }

    const status = errors.length ? 'invalid' : (warnings.length ? 'warning' : 'valid');

    return {
        isValid: errors.length === 0,
        status,
        errors,
        warnings,
        extension,
        sourceType: inferAssetSourceType(asset?.url)
    };
};

export const validateUploadFile = (file) => {
    const errors = [];
    const warnings = [];
    const extension = inferAssetExtension(file?.name || '');

    if (!file) {
        errors.push('No file selected.');
    }

    if (file && !extension) {
        errors.push('File extension is missing. Upload a .glb or .gltf file.');
    }

    if (file && extension && !SUPPORTED_MODEL_EXTENSIONS.includes(extension)) {
        errors.push(`Unsupported model format .${extension}. Upload a .glb or .gltf file.`);
    }

    if (file && Number(file.size || 0) <= 0) {
        errors.push('The selected file is empty.');
    }

    if (file && Number(file.size || 0) > 50 * 1024 * 1024) {
        warnings.push(`Large asset detected (${formatFileSize(file.size)}). Upload may take longer.`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        extension,
        sizeLabel: formatFileSize(file?.size)
    };
};

export { SUPPORTED_MODEL_EXTENSIONS };
import { computed } from 'vue';
import { useProjectWorkspace } from '../../../shared/project/composables/useProjectWorkspace';

const isParamDifferent = (leftValue, rightValue) => {
  if (leftValue === undefined && rightValue === undefined) return false;
  const leftText = String(leftValue);
  const rightText = String(rightValue);
  const leftNumber = parseFloat(leftText);
  const rightNumber = parseFloat(rightText);
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) > 1e-9;
  }
  return leftText !== rightText;
};

const normalizeParamValueForComparison = (value) => {
  if (Array.isArray(value)) return `{${value.join(', ')}}`;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return `{${trimmed.slice(1, -1)}}`;
    }
    return trimmed;
  }
  return value;
};

export function useSimulationParameters() {
  const { componentParams, defaultParams } = useProjectWorkspace();

  const modifiedParams = computed(() => {
    const diffs = {};
    if (!componentParams.value || !Array.isArray(componentParams.value)) return diffs;

    const defaultsMap = new Map();
    if (Array.isArray(defaultParams.value)) {
      defaultParams.value.forEach((param) => defaultsMap.set(param.name, param.defaultValue));
    }

    componentParams.value.forEach((param) => {
      const name = param.name;
      const parts = name.split('.');
      const compId = parts.length > 1 ? parts[0] : 'global';
      const paramKey = parts.length > 1 ? parts.slice(1).join('.') : name;

      const defaultValue = normalizeParamValueForComparison(defaultsMap.get(name));
      const currentValue = normalizeParamValueForComparison(param.value);

      if (isParamDifferent(currentValue, defaultValue)) {
        if (!diffs[compId]) diffs[compId] = {};
        diffs[compId][paramKey] = param.value;
      }
    });

    return diffs;
  });

  return {
    modifiedParams
  };
}
import { ref, watch } from 'vue';

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const readStoredNumber = (key) => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  let rawValue = null;
  try {
    rawValue = storage.getItem(key);
  } catch {
    return null;
  }
  if (rawValue === null) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const writeStoredNumber = (key, value) => {
  const storage = getSessionStorage();
  if (!storage || !Number.isFinite(value)) {
    return;
  }

  try {
    storage.setItem(key, String(value));
  } catch {
    // Ignore storage failures; layout still works for the active component state.
  }
};

export function useSessionLayoutValue(key, defaultValue, normalize = (value) => value) {
  const storedValue = readStoredNumber(key);
  const value = ref(normalize(storedValue ?? defaultValue));

  watch(value, (nextValue) => {
    writeStoredNumber(key, normalize(Number(nextValue)));
  });

  return value;
}
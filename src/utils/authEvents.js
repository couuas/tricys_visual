import { clearAuth } from '../composables/authState';

let authExpiredInProgress = false;

export const triggerAuthExpired = (reason = 'expired') => {
  if (authExpiredInProgress) {
    return;
  }

  authExpiredInProgress = true;
  clearAuth();
  window.dispatchEvent(
    new CustomEvent('tricys-auth-expired', { detail: { reason } })
  );

  setTimeout(() => {
    authExpiredInProgress = false;
  }, 1000);
};

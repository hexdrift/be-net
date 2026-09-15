import { useSyncExternalStore } from 'react';

const preference = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const subscribe = callback => {
  preference?.addEventListener('change', callback);
  return () => preference?.removeEventListener('change', callback);
};
const snapshot = () => preference?.matches || false;

export default function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

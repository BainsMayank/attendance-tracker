const listeners = new Set<() => void>();
export const subscribeFiles = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const invalidateFiles = () => { for (const listener of listeners) listener(); };

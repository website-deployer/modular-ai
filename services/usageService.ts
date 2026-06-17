import { useEffect, useReducer } from 'react';

// Client-side mirror of the server's daily free-usage limit.
//
// The server (api/_usage.ts) is the authoritative enforcement layer; this store
// holds the latest known status so the UI can render a usage badge and trigger
// the upgrade modal instantly. Status is refreshed from response headers after
// every AI call and from /api/usage on load.

const UID_KEY = 'modularai_uid';

export interface UsageState {
    used: number;
    limit: number;
    remaining: number;
    reachedLimit: boolean;
    loaded: boolean;
}

let state: UsageState = { used: 0, limit: 15, remaining: 15, reachedLimit: false, loaded: false };
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(l => l());

export const getUsageState = (): UsageState => state;

export const setUsageState = (patch: Partial<UsageState>): void => {
    state = { ...state, ...patch, loaded: true };
    emit();
};

export const subscribeUsage = (l: () => void): (() => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

/** Stable anonymous id for this browser, used to key the daily limit. */
export const getUserId = (): string => {
    try {
        let id = localStorage.getItem(UID_KEY);
        if (!id) {
            id = (crypto?.randomUUID?.() || `u_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
            localStorage.setItem(UID_KEY, id);
        }
        return id;
    } catch {
        return 'anonymous';
    }
};

/** Fetch the latest usage from the server. */
export const refreshUsage = async (): Promise<void> => {
    try {
        const res = await fetch('/api/usage', { headers: { 'x-user-id': getUserId() } });
        if (res.ok) {
            const data = await res.json();
            setUsageState(data);
        }
    } catch {
        /* offline / no backend — keep current state */
    }
};

/** Signal that the limit was hit, so listeners (App) can open the limit modal. */
export const triggerUpgrade = (): void => {
    setUsageState({ reachedLimit: true, remaining: 0 });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('usage-limit-reached'));
    }
};

/** React hook for subscribing to usage state. */
export const useUsage = (): UsageState => {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => subscribeUsage(force), []);
    return getUsageState();
};

// Daily free-usage limiting.
//
// Each anonymous user gets a number of free AI generations per day (DAILY_FREE_LIMIT,
// default 15). Past that they must upgrade to a paid plan. Usage is keyed by an
// anonymous client id (sent in the `x-user-id` header) and the UTC day.
//
// Storage strategy:
//   - If Supabase is configured, counts persist in the `usage_counters` table
//     (survives across serverless invocations — the real enforcement layer).
//   - Otherwise we fall back to an in-memory map (best-effort, per warm instance)
//     so the feature still works in local/dev without a database.

import { createClient } from '@supabase/supabase-js';

export const DAILY_LIMIT = parseInt(process.env.DAILY_FREE_LIMIT || '15', 10);

const memory: Record<string, { day: string; count: number }> = {};
const memoryPro = new Set<string>();

const today = () => new Date().toISOString().slice(0, 10);

const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) return null;
    try {
        return createClient(url, key);
    } catch {
        return null;
    }
};

export interface UsageStatus {
    used: number;
    limit: number;
    remaining: number;
    reachedLimit: boolean;
    isPro: boolean;
}

const toStatus = (used: number, isPro = false): UsageStatus => isPro
    ? { used, limit: DAILY_LIMIT, remaining: 999999, reachedLimit: false, isPro: true }
    : {
        used,
        limit: DAILY_LIMIT,
        remaining: Math.max(0, DAILY_LIMIT - used),
        reachedLimit: used >= DAILY_LIMIT,
        isPro: false,
    };

/** Whether a user has an active paid (Pro) plan. */
export const isPro = async (userId: string): Promise<boolean> => {
    if (memoryPro.has(userId)) return true;
    const sb = getSupabase();
    if (!sb) return false;
    try {
        const { data } = await sb
            .from('pro_users')
            .select('active')
            .eq('user_id', userId)
            .maybeSingle();
        return !!data?.active;
    } catch {
        return false;
    }
};

/** Mark a user as Pro (called after a successful Stripe checkout). */
export const setPro = async (userId: string, stripeCustomerId?: string | null): Promise<void> => {
    // In-memory fallback so Pro works even before the Supabase table exists.
    memoryPro.add(userId);
    const sb = getSupabase();
    if (!sb) return;
    try {
        await sb.from('pro_users').upsert(
            { user_id: userId, active: true, stripe_customer_id: stripeCustomerId || null, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        );
    } catch (e) {
        console.error('setPro persist failed (using in-memory Pro):', e);
    }
};

/** Resolve a stable identifier for the caller. */
export const getUserId = (req: any): string => {
    const header = req.headers?.['x-user-id'];
    if (header && typeof header === 'string' && header.length > 0) return header;
    const fwd = (req.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim();
    return fwd || 'anonymous';
};

/** Read current usage without consuming any quota. */
export const getUsage = async (userId: string): Promise<UsageStatus> => {
    const day = today();
    if (await isPro(userId)) {
        const sb = getSupabase();
        let used = 0;
        if (sb) {
            try {
                const { data } = await sb.from('usage_counters').select('count').eq('user_id', userId).eq('day', day).maybeSingle();
                used = data?.count || 0;
            } catch { /* ignore */ }
        }
        return toStatus(used, true);
    }
    const sb = getSupabase();
    if (sb) {
        try {
            const { data } = await sb
                .from('usage_counters')
                .select('count')
                .eq('user_id', userId)
                .eq('day', day)
                .maybeSingle();
            return toStatus(data?.count || 0);
        } catch {
            /* fall through to memory */
        }
    }
    const rec = memory[userId];
    return toStatus(rec && rec.day === day ? rec.count : 0);
};

/**
 * Attempt to consume one unit of quota.
 * Returns { allowed: false } (without incrementing) when the user is already at
 * their limit, otherwise increments and returns the updated status.
 */
export const consume = async (userId: string): Promise<{ allowed: boolean; status: UsageStatus }> => {
    const day = today();

    // Pro users bypass the daily limit entirely.
    if (await isPro(userId)) {
        return { allowed: true, status: toStatus(0, true) };
    }

    const sb = getSupabase();

    if (sb) {
        try {
            const { data } = await sb
                .from('usage_counters')
                .select('count')
                .eq('user_id', userId)
                .eq('day', day)
                .maybeSingle();
            const used = data?.count || 0;
            if (used >= DAILY_LIMIT) {
                return { allowed: false, status: toStatus(used) };
            }
            await sb
                .from('usage_counters')
                .upsert({ user_id: userId, day, count: used + 1 }, { onConflict: 'user_id,day' });
            return { allowed: true, status: toStatus(used + 1) };
        } catch {
            /* fall through to memory */
        }
    }

    const rec = memory[userId] && memory[userId].day === day ? memory[userId] : { day, count: 0 };
    if (rec.count >= DAILY_LIMIT) {
        memory[userId] = rec;
        return { allowed: false, status: toStatus(rec.count) };
    }
    rec.count += 1;
    memory[userId] = rec;
    return { allowed: true, status: toStatus(rec.count) };
};

/**
 * Express/Vercel helper: enforce the limit at the top of a handler.
 * Returns the usage status if allowed, or null if it already sent a 429 response.
 */
export const enforceLimit = async (req: any, res: any): Promise<UsageStatus | null> => {
    const userId = getUserId(req);
    const { allowed, status } = await consume(userId);
    res.setHeader('x-usage-used', String(status.used));
    res.setHeader('x-usage-limit', String(status.limit));
    res.setHeader('x-usage-remaining', String(status.remaining));
    res.setHeader('x-usage-pro', status.isPro ? '1' : '0');
    if (!allowed) {
        res.status(429).json({ error: 'LIMIT_REACHED', usage: status });
        return null;
    }
    return status;
};

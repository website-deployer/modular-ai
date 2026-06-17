import React, { useState } from 'react';
import { useUsage, startCheckout } from '../services/usageService';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRO_FEATURES = [
    'Unlimited AI notes, analysis & transcription',
    'Priority access across all AI providers',
    'Longer documents & recordings',
    'Cloud sync across devices',
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    const usage = useUsage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);
        try {
            await startCheckout();
            // On success the browser is redirected to Stripe; no further code runs.
        } catch (e: any) {
            setError(e?.message || 'Could not start checkout. Please try again.');
            setLoading(false);
        }
    };

    // Already Pro — show a confirmation instead of the paywall.
    if (usage.isPro) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
                <div className="bg-white dark:bg-[#18181b] rounded-3xl border border-[var(--theme-color)]/30 shadow-2xl max-w-sm w-full overflow-hidden p-8 text-center" onClick={e => e.stopPropagation()}>
                    <div className="w-14 h-14 rounded-2xl bg-[var(--theme-color)] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--theme-color)]/30">
                        <span className="material-symbols-outlined text-black text-3xl">verified</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white font-display">You're on Pro 🎉</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Unlimited AI access is unlocked. Thank you for upgrading!</p>
                    <button onClick={onClose} className="w-full mt-6 h-11 rounded-2xl bg-[var(--theme-color)] text-black font-black uppercase tracking-wider text-sm hover:brightness-110 transition-all">Done</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-[#18181b] rounded-3xl border border-[var(--theme-color)]/30 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header banner */}
                <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-[var(--theme-color)]/15 to-transparent">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-[var(--theme-color)]/20 rounded-full blur-3xl"></div>
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--theme-color)] flex items-center justify-center mb-4 shadow-lg shadow-[var(--theme-color)]/30">
                            <span className="material-symbols-outlined text-black text-3xl">bolt</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white font-display tracking-tight">You've hit today's free limit</h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                            You've used <b className="text-[var(--theme-color)]">{usage.used} of {usage.limit}</b> free AI actions today. Upgrade to Pro for unlimited access, or come back tomorrow when your free quota resets.
                        </p>
                    </div>
                </div>

                {/* Plan card */}
                <div className="px-8 py-6">
                    <div className="rounded-2xl border border-black/5 dark:border-white/10 p-5 bg-neutral-50 dark:bg-white/5">
                        <div className="flex items-baseline justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-slate-900 dark:text-white font-display">Modular AI Pro</span>
                                <span className="px-2 py-0.5 rounded-full bg-[var(--theme-color)]/15 text-[var(--theme-color)] text-[10px] font-black uppercase tracking-wider">Popular</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-slate-900 dark:text-white">$8</span>
                                <span className="text-xs text-neutral-500">/mo</span>
                            </div>
                        </div>
                        <ul className="space-y-2.5">
                            {PRO_FEATURES.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-neutral-300">
                                    <span className="material-symbols-outlined text-[var(--theme-color)] text-lg shrink-0">check_circle</span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {error && (
                        <p className="mt-4 text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">{error}</p>
                    )}

                    <button
                        onClick={handleUpgrade}
                        disabled={loading}
                        className="w-full mt-5 h-12 rounded-2xl bg-[var(--theme-color)] text-black font-black uppercase tracking-wider text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                Redirecting to checkout…
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl">rocket_launch</span>
                                Upgrade to Pro
                            </>
                        )}
                    </button>
                    <p className="mt-2 text-center text-[10px] text-neutral-400">Secure checkout via Stripe · Test mode</p>
                    <button
                        onClick={onClose}
                        className="w-full mt-2 h-10 rounded-2xl text-sm font-bold text-slate-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;

import React from 'react';
import { useUsage } from '../services/usageService';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Shown when the user has used up their free daily AI actions. Billing isn't wired
// up yet, so this is an informational notice — the quota resets the next day.
const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
    const usage = useUsage();
    if (!isOpen) return null;

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
                            You've used <b className="text-[var(--theme-color)]">{usage.used} of {usage.limit}</b> free AI actions today. Your quota resets tomorrow — come back then to keep generating notes and analysis.
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-6">
                    <div className="rounded-2xl border border-black/5 dark:border-white/10 p-5 bg-neutral-50 dark:bg-white/5 flex items-start gap-3">
                        <span className="material-symbols-outlined text-[var(--theme-color)] text-xl shrink-0">schedule</span>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Daily free quota</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                                {usage.limit} AI actions per day. Recording, document analysis, notes and Global Analysis all draw from this pool. It refreshes every 24 hours.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-5 h-12 rounded-2xl bg-[var(--theme-color)] text-black font-black uppercase tracking-wider text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[var(--theme-color)]/20 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-xl">check</span>
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;

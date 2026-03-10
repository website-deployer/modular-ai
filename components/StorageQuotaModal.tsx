import React from 'react';

interface StorageQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearOldNotes: () => void;
  onClearAllNotes: () => void;
}

const StorageQuotaModal: React.FC<StorageQuotaModalProps> = ({ isOpen, onClose, onClearOldNotes, onClearAllNotes }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-red-500/20 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-500 text-2xl">database_off</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">Storage Limit Reached</h3>
              <p className="text-xs text-red-500 font-medium">Action Required</p>
            </div>
          </div>
          
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
            Your browser's storage for this application is full. To continue saving new notes and recordings, you need to free up some space.
          </p>

          <div className="space-y-3">
            <button 
              onClick={onClearOldNotes}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors group text-left"
            >
              <div>
                <span className="block text-sm font-bold text-slate-900 dark:text-white mb-0.5">Clear Old Notes</span>
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">Delete notes not accessed in 30 days</span>
              </div>
              <span className="material-symbols-outlined text-neutral-400 group-hover:text-[var(--theme-color)] transition-colors">auto_delete</span>
            </button>

            <button 
              onClick={onClearAllNotes}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors group text-left"
            >
              <div>
                <span className="block text-sm font-bold text-red-600 dark:text-red-400 mb-0.5">Clear All Data</span>
                <span className="block text-xs text-red-500/70 dark:text-red-400/70">Delete all notes and start fresh</span>
              </div>
              <span className="material-symbols-outlined text-red-400 group-hover:text-red-500 transition-colors">delete_forever</span>
            </button>
          </div>
        </div>

        <div className="bg-neutral-50 dark:bg-white/5 px-6 py-4 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageQuotaModal;

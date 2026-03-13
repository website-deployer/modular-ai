import React, { useRef, useMemo, useState } from 'react';
import { Note, View } from '../types';
import { generateNoteFromTranscript, processDocument } from '../services/aiService';
import * as mammoth from 'mammoth';

interface LibraryViewProps {
    notes: Note[];
    onOpenNote: (note: Note) => void;
    onNavigate: (view: View) => void;
    onImport: (note: Note) => void;
    onDeleteNote: (noteId: string) => void;
    filterView?: View;
    compactMode?: boolean;
}

const LibraryView: React.FC<LibraryViewProps> = ({ notes = [], onOpenNote, onNavigate, onImport, onDeleteNote, filterView, compactMode = false }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'analyzing' | 'success' | 'error'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    const filteredNotes = useMemo(() => {
        if (!notes || !Array.isArray(notes)) return [];
        let result = notes;

        if (filterView === View.BOOKMARKS) {
            result = result.filter(n => n.isBookmarked);
        } else if (filterView === View.HISTORY) {
            result = [...result].sort((a, b) => {
                if (!a.lastAccessed) return 1;
                if (!b.lastAccessed) return -1;
                return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(n =>
                n.title.toLowerCase().includes(query) ||
                (n.transcript && n.transcript.toLowerCase().includes(query)) ||
                (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
            );
        }

        return result;
    }, [notes, filterView, searchQuery]);

    const getPageTitle = () => {
        if (filterView === View.BOOKMARKS) return "Bookmarked Notes";
        if (filterView === View.HISTORY) return "Recently Viewed";
        return "Knowledge Vault";
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        setUploadStatus('idle');
        setUploadProgress(0);

        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size limit (20MB for inline data)
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
        if (file.size > MAX_FILE_SIZE) {
            setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). The limit is 20MB.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploadStatus('reading');

        try {
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isText = file.type === 'text/plain' || file.name.endsWith('.md');
            const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            const isAudio = file.type.startsWith('audio/');

            // Helper to read file as base64 with progress
            const readFileAsBase64 = (f: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const percent = Math.round((event.loaded / event.total) * 100);
                            setUploadProgress(percent);
                        }
                    };

                    reader.onload = () => {
                        const result = reader.result as string;
                        const base64Data = result.split(',')[1];
                        resolve(base64Data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(f);
                });
            };

            let newNote: Note | null = null;

            if (isPdf) {
                const base64Data = await readFileAsBase64(file);
                setUploadStatus('analyzing');
                const processingResult = await processDocument(base64Data, 'application/pdf', file.name);

                newNote = {
                    id: Date.now().toString(),
                    title: processingResult.title,
                    date: new Date().toLocaleDateString(),
                    content: processingResult.content,
                    transcript: processingResult.transcript,
                    type: 'PDF',
                    tags: ['Imported', 'PDF'],
                    sourceData: {
                        mimeType: 'application/pdf',
                        data: base64Data
                    }
                };
            } else if (isImage) {
                const base64Data = await readFileAsBase64(file);
                setUploadStatus('analyzing');
                const processingResult = await processDocument(base64Data, file.type, file.name);

                newNote = {
                    id: Date.now().toString(),
                    title: processingResult.title,
                    date: new Date().toLocaleDateString(),
                    content: `<img src="data:${file.type};base64,${base64Data}" style="max-width:100%; border-radius: 8px; margin-bottom: 1em;" />` + processingResult.content,
                    transcript: processingResult.transcript,
                    type: 'PDF', // Treat as visual doc
                    tags: ['Imported', 'Image'],
                    sourceData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                };
            } else if (isAudio) {
                const base64Data = await readFileAsBase64(file);
                setUploadStatus('analyzing');
                const processingResult = await processDocument(base64Data, file.type, file.name);

                newNote = {
                    id: Date.now().toString(),
                    title: processingResult.title,
                    date: new Date().toLocaleDateString(),
                    content: processingResult.content,
                    transcript: processingResult.transcript,
                    type: 'AUDIO',
                    tags: ['Imported', 'Audio'],
                    sourceData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                };
            } else if (isText) {
                const text = await file.text();
                setUploadStatus('analyzing');
                const content = await generateNoteFromTranscript(text.substring(0, 20000), file.name);

                newNote = {
                    id: Date.now().toString(),
                    title: file.name,
                    date: new Date().toLocaleDateString(),
                    content: content,
                    transcript: text,
                    type: 'TEXT',
                    tags: ['Imported', 'Text'],
                };
            } else if (isDocx) {
                const arrayBuffer = await file.arrayBuffer();
                setUploadStatus('analyzing');
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;
                const content = await generateNoteFromTranscript(text.substring(0, 20000), file.name);

                newNote = {
                    id: Date.now().toString(),
                    title: file.name,
                    date: new Date().toLocaleDateString(),
                    content: content,
                    transcript: text,
                    type: 'TEXT',
                    tags: ['Imported', 'Word Doc'],
                };
            } else {
                setUploadError("Unsupported file type. Please use PDF, Word, Images, or Text files.");
                setUploadStatus('error');
                return;
            }

            if (newNote) {
                setUploadStatus('success');
                // Small delay to show success state
                setTimeout(() => {
                    onImport(newNote!);
                    setUploadStatus('idle');
                }, 1000);
            }

        } catch (err) {
            console.error("Import failed", err);
            setUploadError("Failed to process document. The file might be corrupted or unreadable.");
            setUploadStatus('error');
        } finally {
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b]">
            {uploadStatus !== 'idle' && uploadStatus !== 'error' && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-[#18181b] p-8 rounded-2xl border border-[var(--theme-color)]/30 flex flex-col items-center shadow-2xl max-w-sm w-full text-center">
                        {uploadStatus === 'reading' && (
                            <>
                                <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[var(--theme-color)] animate-spin mb-4"></div>
                                <h3 className="text-white font-bold text-lg font-display">Reading File...</h3>
                                <p className="text-neutral-400 text-sm mt-2 mb-4">Preparing your document for analysis.</p>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--theme-color)] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                                <p className="text-[var(--theme-color)] text-xs font-mono mt-2">{uploadProgress}%</p>
                            </>
                        )}

                        {uploadStatus === 'analyzing' && (
                            <>
                                <div className="relative mb-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-[var(--theme-color)]/30 animate-pulse"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-2xl animate-bounce">auto_awesome</span>
                                    </div>
                                </div>
                                <h3 className="text-white font-bold text-lg font-display">Analyzing Content...</h3>
                                <p className="text-neutral-400 text-sm mt-2">Gemini is extracting insights and generating a study guide.</p>
                            </>
                        )}

                        {uploadStatus === 'success' && (
                            <>
                                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                                    <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
                                </div>
                                <h3 className="text-white font-bold text-lg font-display">Import Complete!</h3>
                                <p className="text-neutral-400 text-sm mt-2">Opening your new note...</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            <header className="shrink-0 h-16 md:h-20 border-b border-black/5 dark:border-white/10 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-[#09090b]/90 backdrop-blur-md z-10 sticky top-0">
                <div className="flex flex-col min-w-0 mr-2">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none mb-1 font-display truncate">{getPageTitle()}</h1>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium font-body truncate hidden sm:block">
                        {filterView === View.HISTORY ? 'Your recent activity' : 'Manage your imported sources and lecture history'}
                    </span>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0">
                    <div className="relative hidden md:block">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500 text-[20px]">search</span>
                        <input
                            className="h-10 w-64 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-color)]/50 transition-colors"
                            placeholder="Search sessions..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => onNavigate(View.RECORDER)}
                        className="h-10 px-4 rounded-full bg-[var(--theme-color)] text-black text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-colors shadow-lg shadow-[var(--theme-color)]/20"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span className="hidden sm:inline">New Session</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                <div className="max-w-7xl mx-auto flex flex-col gap-10">

                    {/* Delete Confirmation Modal */}
                    {noteToDelete && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setNoteToDelete(null); }}>
                            <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-red-500">warning</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">Delete Session</h3>
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">This action cannot be undone. Are you sure you want to permanently delete this session?</p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setNoteToDelete(null); }}
                                        className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteNote(noteToDelete);
                                            setNoteToDelete(null);
                                        }}
                                        className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Visual Error Notification */}
                    {uploadError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 px-6 py-4 rounded-2xl flex items-center gap-3 backdrop-blur-sm shadow-lg animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-lg">error_outline</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Upload Failed</h4>
                                <p className="text-xs opacity-80 mt-0.5">{uploadError}</p>
                            </div>
                            <button onClick={() => setUploadError(null)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-lg">close</span>
                            </button>
                        </div>
                    )}

                    {/* Only show Drop Zone on main library view */}
                    {!filterView && !searchQuery && (
                        <section className="relative group" onClick={(e) => {
                            // Prevent double-trigger if clicking directly on the input (which shouldn't happen due to layout, but good safety)
                            // or if the event bubbles up from children in a way that triggers the input twice.
                            // Actually, the issue is likely that clicking the container triggers the input, 
                            // but the input is ALSO inside the container, so clicking the input triggers the container's onClick, 
                            // which triggers the input AGAIN.
                            if ((e.target as HTMLElement).tagName === 'INPUT') return;
                            fileInputRef.current?.click();
                        }}>
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-color)]/5 via-[var(--theme-color)]/10 to-[var(--theme-color)]/5 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                            <div className={`relative min-h-[16rem] h-auto py-8 px-4 border-2 border-dashed rounded-3xl bg-white/50 dark:bg-[#18181b]/50 flex flex-col items-center justify-center gap-4 transition-all hover:bg-white/80 dark:hover:bg-[#18181b]/80 cursor-pointer overflow-hidden backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(var(--theme-rgb),0.15)] ${uploadError ? 'border-red-500/30' : 'border-black/5 dark:border-[var(--theme-color)]/30 hover:border-[var(--theme-color)]/60'}`}>
                                <div className={`h-20 w-20 rounded-full bg-white dark:bg-[#09090b] border border-black/5 dark:border-white/10 flex items-center justify-center shadow-2xl shadow-black/10 dark:shadow-black z-10 group-hover:scale-110 transition-transform duration-300 shrink-0 ${uploadError ? 'text-red-400' : 'text-[var(--theme-color)]'}`}>
                                    <span className={`material-symbols-outlined text-4xl ${!uploadError && 'animate-pulse'}`}>{uploadError ? 'cloud_off' : 'cloud_upload'}</span>
                                </div>
                                <div className="text-center z-10 space-y-1 max-w-md">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Import Slides or Docs</h2>
                                    <p className="text-neutral-500 dark:text-neutral-400 text-sm font-body">Support for PDF Presentations, Word Documents, Images, and Text (Max 20MB)</p>
                                </div>
                                <div className="flex gap-2 mt-2 z-10 flex-wrap justify-center">
                                    <span className="px-3 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400 font-mono">.PDF</span>
                                    <span className="px-3 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400 font-mono">.DOCX</span>
                                    <span className="px-3 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400 font-mono">.TXT</span>
                                    <span className="px-3 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400 font-mono">.JPG</span>
                                    <span className="px-3 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-neutral-500 dark:text-neutral-400 font-mono">.MP3</span>
                                </div>
                                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,.mp3,.wav,.m4a" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                            </div>
                        </section>
                    )}

                    {/* Cards Grid */}
                    <section>
                        {!filterView && (
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-display">
                                    <span className="material-symbols-outlined text-[var(--theme-color)]">grid_view</span>
                                    {searchQuery ? `Search Results for "${searchQuery}"` : 'All Sessions'}
                                </h2>
                            </div>
                        )}

                        {filteredNotes.length === 0 ? (
                            <div className="text-center py-20 text-neutral-500 dark:text-neutral-500">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_off</span>
                                <p>No notes found in this view.</p>
                            </div>
                        ) : (
                            <div className={`grid grid-cols-1 ${compactMode ? 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'}`}>
                                {filteredNotes.map((card) => (
                                    <div key={card.id} onClick={() => onOpenNote(card)} className={`group bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden hover:border-[var(--theme-color)]/30 hover:shadow-lg hover:shadow-[var(--theme-color)]/5 transition-all duration-300 flex flex-col cursor-pointer relative ${compactMode ? 'h-[240px]' : 'h-[320px]'}`}>

                                        {card.isBookmarked && (
                                            <div className="absolute top-0 left-4 z-20">
                                                <span className="material-symbols-outlined text-[var(--theme-color)] drop-shadow-lg" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>
                                            </div>
                                        )}

                                        <div className={`relative flex flex-col justify-end overflow-hidden ${compactMode ? 'h-24' : 'h-40'} ${card.type === 'AUDIO' ? 'bg-gradient-to-br from-neutral-800 to-black' : card.type === 'PDF' ? 'bg-neutral-200 dark:bg-neutral-800' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                                            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white flex items-center gap-1 border border-white/10">
                                                <span className="material-symbols-outlined text-[14px] text-[var(--theme-color)]">
                                                    {card.type === 'AUDIO' ? 'graphic_eq' : card.type === 'PDF' ? 'picture_as_pdf' : 'description'}
                                                </span>
                                                {!compactMode && card.type}
                                            </div>

                                            {card.type === 'AUDIO' && (
                                                <div className="flex items-end justify-between gap-1 h-16 w-full opacity-60 group-hover:opacity-100 transition-opacity px-6">
                                                    {[40, 70, 100, 60, 30, 50, 80, 50, 20, 40].map((h, i) => (
                                                        <div key={i} className="w-1.5 bg-[var(--theme-color)] rounded-t-sm opacity-80" style={{ height: `${h}%` }}></div>
                                                    ))}
                                                </div>
                                            )}
                                            {(card.type === 'PDF' || card.type === 'TEXT') && (
                                                <div className="absolute inset-4 bg-white/20 dark:bg-neutral-700/50 rounded shadow-lg flex flex-col p-2 gap-2 opacity-80 backdrop-blur-sm">
                                                    <div className="w-1/2 h-2 bg-black/10 dark:bg-neutral-500 rounded-full"></div>
                                                    <div className="w-3/4 h-2 bg-black/10 dark:bg-neutral-600 rounded-full"></div>
                                                    {!compactMode && (
                                                        <div className="flex gap-2 mt-2">
                                                            <div className="w-1/2 h-10 bg-black/5 dark:bg-neutral-600 rounded"></div>
                                                            <div className="w-1/2 h-10 bg-black/5 dark:bg-neutral-600 rounded"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Visual preview for images */}
                                            {card.sourceData?.mimeType.startsWith('image/') && (
                                                <div className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-100 transition-opacity" style={{ backgroundImage: `url(data:${card.sourceData.mimeType};base64,${card.sourceData.data})` }}></div>
                                            )}
                                        </div>

                                        <div className={`flex flex-col flex-1 ${compactMode ? 'p-3' : 'p-5'}`}>
                                            <div className="mb-2">
                                                <h3 className={`text-slate-900 dark:text-white font-bold leading-tight group-hover:text-[var(--theme-color)] transition-colors font-display line-clamp-2 ${compactMode ? 'text-sm' : 'text-lg'}`}>{card.title}</h3>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1 font-body">{card.date}</p>
                                            </div>
                                            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3 mt-auto">
                                                <div className="flex -space-x-2">
                                                    {(card.tags || []).map(tag => (
                                                        <span key={tag} className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[10px] text-neutral-500 dark:text-neutral-400 border border-black/5 dark:border-white/5 mr-1">{tag}</span>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setNoteToDelete(card.id);
                                                        }}
                                                        className="text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 relative z-10"
                                                        title="Delete Session"
                                                    >
                                                        <span className="material-symbols-outlined text-lg pointer-events-none">delete</span>
                                                    </button>
                                                    {!compactMode && <button className="text-neutral-400 dark:text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors p-1"><span className="material-symbols-outlined text-lg pointer-events-none">arrow_forward</span></button>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
};

export default LibraryView;
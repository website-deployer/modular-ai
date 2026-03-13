import React, { useState, useEffect, useRef } from 'react';
import { generateGlobalAnalysis, getAnalysisSessions, loadAnalysisSession, saveAnalysisSession, deleteAnalysisSession, generateTitle } from '../services/aiService';
import { Note, ChatMessage } from '../types';

interface AnalysisViewProps {
    notes: Note[];
    contextualAttachments?: string[];
    setContextualAttachments?: React.Dispatch<React.SetStateAction<string[]>>;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ notes, contextualAttachments = [], setContextualAttachments }) => {
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial load: fetch sessions and set initial message
    useEffect(() => {
        fetchSessions();
        handleNewSession();
    }, []);

    const fetchSessions = async () => {
        try {
            const data = await getAnalysisSessions();
            setSessions(data);
        } catch (err) {
            console.error("Failed to fetch sessions", err);
        }
    };

    const handleNewSession = () => {
        setCurrentSessionId(null);
        setMessages([
            {
                id: 'init',
                role: 'model',
                text: "Hello! I've indexed all your notes. Ask me anything about your knowledge base or start a new analysis.",
                timestamp: new Date()
            }
        ]);
    };

    const handleLoadSession = async (id: string) => {
        try {
            setLoading(true);
            const data = await loadAnalysisSession(id);
            setCurrentSessionId(data.id);
            setMessages(data.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            })));
        } catch (err) {
            console.error("Failed to load session", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this session?")) return;
        try {
            await deleteAnalysisSession(id);
            if (currentSessionId === id) handleNewSession();
            fetchSessions();
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!query.trim() && contextualAttachments.length === 0) return;

        let finalQuery = query;
        let originalQuery = query;
        
        if (contextualAttachments.length > 0) {
            const attachmentsBlock = contextualAttachments.map(text => `> ${text}`).join('\n>\n');
            finalQuery = `${attachmentsBlock}\n\n${query}`.trim();
        }

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: finalQuery, timestamp: new Date() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setQuery("");
        
        if (setContextualAttachments) {
            setContextualAttachments([]);
        }

        setLoading(true);

        try {
            const responseText = await generateGlobalAnalysis(
                notes,
                finalQuery,
                messages.map(m => ({ role: m.role, text: m.text }))
            );

            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: new Date() };
            const finalMessages = [...newMessages, aiMsg];
            setMessages(finalMessages);

            // Auto-save session
            let title = currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title : null;
            if (!title) {
                title = await generateTitle(originalQuery || "Analysis Session");
            }

            const saved = await saveAnalysisSession({
                id: currentSessionId || undefined,
                title: title,
                messages: finalMessages
            });
            
            if (!currentSessionId) setCurrentSessionId(saved.id);
            fetchSessions();
        } catch (err) {
            console.error("Analysis failed", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full overflow-hidden bg-[#f4f4f5] dark:bg-[#09090b] flex-1">
            {/* Sessions Sidebar */}
            <div className={`border-r border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/[0.02] backdrop-blur-xl transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-0 opacity-0 lg:w-0'}`}>
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between shrink-0 h-14">
                    <h2 className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Analysis History</h2>
                    <button onClick={handleNewSession} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-[var(--theme-color)] transition-colors" title="New Session">
                        <span className="material-symbols-outlined text-base font-bold">add</span>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {sessions.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => handleLoadSession(s.id)}
                            className={`group p-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === s.id 
                                ? 'bg-[var(--theme-color)]/10 border-[var(--theme-color)]/30' 
                                : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-xs font-semibold truncate ${currentSessionId === s.id ? 'text-[var(--theme-color)]' : 'text-slate-700 dark:text-neutral-200'}`}>{s.title}</h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(s.updated_at).toLocaleDateString()}</p>
                                </div>
                                <button onClick={(e) => handleDeleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-8 text-center mt-10">
                            <span className="material-symbols-outlined text-4xl text-slate-200 dark:text-neutral-800">history</span>
                            <p className="text-[11px] text-slate-400 mt-2 italic">Nothing saved yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                {/* Header */}
                <div className="h-14 border-b border-black/5 dark:border-white/10 flex items-center px-6 bg-white/50 dark:bg-black/50 backdrop-blur-md shrink-0 justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500">
                            <span className="material-symbols-outlined font-light">{sidebarOpen ? 'menu_open' : 'menu'}</span>
                        </button>
                        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden md:block"></div>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Global Analysis</h1>
                            <p className="text-[10px] text-slate-400 font-medium">Synced with Supabase</p>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${msg.role === 'model'
                                    ? 'bg-white dark:bg-white/10 border-black/5 dark:border-white/10'
                                    : 'bg-[var(--theme-color)] border-transparent'
                                }`}>
                                {msg.role === 'model' ?
                                    <span className="material-symbols-outlined text-base text-[var(--theme-color)]">analytics</span> :
                                    <span className="text-black text-xs font-bold">You</span>
                                }
                            </div>
                            <div className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'model'
                                            ? 'bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-700 dark:text-neutral-300'
                                            : 'bg-[var(--theme-color)] text-black font-medium'
                                        } ${msg.role === 'model' ? 'rounded-tl-none' : 'rounded-tr-none'}`}
                                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>').replace(/> (.*)/g, '<blockquote class="border-l-4 border-black/10 dark:border-white/10 pl-4 py-1 my-2 italic">$1</blockquote>') }}
                                />
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base text-[var(--theme-color)] animate-pulse">analytics</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-3">
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                                <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-xl shrink-0">
                    <div className="max-w-4xl mx-auto flex flex-col gap-4">
                        {/* Attachments */}
                        {contextualAttachments && contextualAttachments.length > 0 && (
                            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                {contextualAttachments.map((text, idx) => (
                                    <div key={idx} className="bg-white dark:bg-white/5 border-l-2 border-[var(--theme-color)] rounded-r-lg px-4 py-2.5 flex items-start gap-3 shadow-sm group/att transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                                        <span className="material-symbols-outlined text-[16px] text-[var(--theme-color)] mt-0.5 shrink-0">format_quote</span>
                                        <p className="text-xs text-slate-600 dark:text-neutral-300 flex-1 line-clamp-2 leading-relaxed italic" title={text}>"{text}"</p>
                                        <button 
                                            onClick={() => setContextualAttachments && setContextualAttachments(prev => prev.filter((_, i) => i !== idx))}
                                            className="shrink-0 opacity-0 group-hover/att:opacity-100 hover:bg-red-500/10 text-red-500 rounded-full p-1 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative group shadow-2xl rounded-2xl">
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-color)]/20 to-[var(--theme-color)]/5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                            <input
                                className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl pl-6 pr-14 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]/50 transition-all shadow-inner"
                                placeholder="Search across all notes..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={handleSend}
                                disabled={loading}
                                className="absolute right-3 top-2 bottom-2 px-4 bg-[var(--theme-color)] rounded-xl text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--theme-color)]/20 disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-xl font-bold">arrow_upward</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
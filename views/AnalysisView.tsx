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
        setQuery("");
        if (setContextualAttachments) setContextualAttachments([]);
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
            setQuery("");
            if (setContextualAttachments) setContextualAttachments([]);
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

    const renderMessageContent = (text: string) => {
        // More resilient Regex: Handles missing characters, extra spaces, or varied brackets
        const flashcardRegex = /<{1,3}FLASHCARD:?\s*(.*?)\s*>{1,3}/g;
        const quizSetRegex = /<{1,3}QUIZ_SET:?\s*(.*?)\s*>{1,3}/g;
        const quizRegex = /<{1,3}QUIZ:?\s*(.*?)\s*>{1,3}/g;
        const timelineRegex = /<{1,3}TIMELINE:?\s*(.*?)\s*>{1,3}/g;
        const actionItemRegex = /<{1,3}ACTION_ITEM:?\s*(.*?)\s*>{1,3}/g;
        const takeawayRegex = /<{1,3}TAKEAWAY:?\s*(.*?)\s*>{1,3}/g;
        const comparisonRegex = /<{1,3}COMPARISON:?\s*(.*?)\s*>{1,3}/g;
        const statRegex = /<{1,3}STAT:?\s*(.*?)\s*>{1,3}/g;

        // Special case for when the AI JUST returns a raw JSON array or object without a prefix
        const rawJsonRegex = /^\[\s*\{\s*"question":.*\}\s*\]$/gs;

        const widgets: React.ReactNode[] = [];
        let cleanText = text;

        const processWidget = (regex: RegExp, type: string) => {
            let match;
            while ((match = regex.exec(text)) !== null) {
                try {
                    let jsonStr = match[1].trim();
                    // Basic cleanup if the AI returned a trailing comma or similar
                    if (jsonStr.endsWith(',')) jsonStr = jsonStr.slice(0, -1);
                    
                    const data = JSON.parse(jsonStr);
                    widgets.push(
                        <div key={`${type}-${widgets.length}`} className="my-6">
                            {(type === 'QUIZ_SET' || (type === 'QUIZ' && Array.isArray(data))) && (
                                <div className="bg-white dark:bg-zinc-900 border border-[var(--theme-color)]/20 rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto overflow-hidden relative border-t-4 border-t-[var(--theme-color)]">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{data.title || "Interactive Assessment"}</h4>
                                            <p className="text-xs text-slate-400 mt-2 font-medium uppercase tracking-widest italic opacity-60 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-color)] animate-pulse"></span>
                                                {Array.isArray(data.questions) ? data.questions.length : (Array.isArray(data) ? data.length : 1)} Concepts Covered
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-[var(--theme-color)]/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[var(--theme-color)] text-2xl">school</span>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        {(data.questions || (Array.isArray(data) ? data : [])).map((q: any, qi: number) => (
                                            <div key={qi} className="group/q border-b border-black/5 dark:border-white/5 last:border-0 pb-8 last:pb-0">
                                                <div className="flex gap-4 mb-4">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-400 shrink-0">0{qi + 1}</span>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">{q.question}</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-10">
                                                    {q.options.map((opt: string, i: number) => (
                                                        <button key={i} className="group/opt text-left px-4 py-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 hover:border-[var(--theme-color)]/50 hover:bg-[var(--theme-color)]/5 transition-all outline-none">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-6 h-6 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover/opt:border-[var(--theme-color)] group-hover/opt:text-[var(--theme-color)]">{String.fromCharCode(65 + i)}</span>
                                                                <span className="text-xs text-slate-600 dark:text-neutral-400 font-medium">{opt}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-10 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500 font-medium">Click an option to check your knowledge.</span>
                                        <button className="bg-[var(--theme-color)] text-black px-6 py-2 rounded-xl font-black text-[11px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[var(--theme-color)]/20">Submit Answers</button>
                                    </div>
                                </div>
                            )}
                            {type === 'FLASHCARD' && (
                                <div className="bg-white dark:bg-zinc-900 border-t-4 border-[var(--theme-color)] rounded-2xl p-6 shadow-xl relative overflow-hidden group/card max-w-sm mx-auto cursor-pointer transition-transform hover:scale-[1.02]">
                                    <div className="absolute top-0 right-0 p-2 bg-[var(--theme-color)]/10 rounded-bl-xl text-[10px] font-bold text-[var(--theme-color)] uppercase tracking-tighter">Flashcard</div>
                                    <h4 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Concept</h4>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white mb-4">{data.front}</p>
                                    <div className="h-[1px] w-12 bg-[var(--theme-color)] mb-4"></div>
                                    <p className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed italic">{data.back}</p>
                                </div>
                            )}
                            {type === 'TIMELINE' && (
                                <div className="flex gap-4 items-start max-w-md bg-white dark:bg-zinc-900/40 p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                                    <div className="flex flex-col items-center gap-1 mt-1">
                                        <div className="w-3 h-3 rounded-full bg-[var(--theme-color)] shadow-[0_0_10px_var(--theme-color)]"></div>
                                        <div className="w-[1px] h-12 bg-gradient-to-b from-[var(--theme-color)] to-transparent"></div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-[var(--theme-color)] tracking-tighter">{data.date}</span>
                                        <p className="text-xs text-slate-700 dark:text-neutral-300 font-medium mt-1 leading-relaxed">{data.description}</p>
                                    </div>
                                </div>
                            )}
                            {type === 'COMPARISON' && (
                                <div className="bg-white dark:bg-zinc-900/50 border-t-4 border-[var(--theme-color)] rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto border-x border-b border-black/5 dark:border-white/5">
                                    <div className="bg-slate-50 dark:bg-white/5 px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-neutral-400">{data.title || "Side-by-Side Comparison"}</h4>
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-lg">compare_arrows</span>
                                    </div>
                                    <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-white/10">
                                        <div className="p-6">
                                            <h5 className="text-sm font-bold text-[var(--theme-color)] mb-4 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-color)]"></span>
                                                {data.left.name}
                                            </h5>
                                            <ul className="space-y-3">
                                                {data.left.points.map((p: string, i: number) => (
                                                    <li key={i} className="text-[11px] text-slate-600 dark:text-neutral-400 flex gap-2 leading-relaxed">
                                                        <span className="text-[var(--theme-color)] shrink-0 opacity-50">✦</span> {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-6">
                                            <h5 className="text-sm font-bold text-sky-400 mb-4 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                                                {data.right.name}
                                            </h5>
                                            <ul className="space-y-3">
                                                {data.right.points.map((p: string, i: number) => (
                                                    <li key={i} className="text-[11px] text-slate-600 dark:text-neutral-400 flex gap-2 leading-relaxed">
                                                        <span className="text-sky-400 shrink-0 opacity-50">✦</span> {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {type === 'STAT' && (
                                <div className="inline-flex flex-col bg-[var(--theme-color)] text-black p-5 rounded-2xl shadow-xl shadow-[var(--theme-color)]/20 min-w-[160px] relative overflow-hidden group">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                                    <span className="text-[10px] uppercase font-black tracking-widest opacity-60 z-10">{data.label}</span>
                                    <span className="text-4xl font-black my-1 tracking-tighter z-10">{data.value}</span>
                                    {data.detail && <span className="text-[9px] font-bold opacity-70 tracking-tight z-10">{data.detail}</span>}
                                </div>
                            )}
                            {type === 'ACTION_ITEM' && (
                                <div className="flex items-center gap-4 bg-white dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/10 shadow-sm hover:border-[var(--theme-color)]/50 transition-all group max-w-md">
                                    <button className="w-6 h-6 rounded-lg border-2 border-[var(--theme-color)]/50 flex items-center justify-center group-hover:bg-[var(--theme-color)] group-hover:border-transparent transition-all">
                                        <span className="material-symbols-outlined text-[16px] text-[var(--theme-color)] group-hover:text-black opacity-0 group-hover:opacity-100 transition-all">check</span>
                                    </button>
                                    <div className="flex-1">
                                        <p className="text-[13px] text-slate-700 dark:text-neutral-200 font-bold leading-tight">{data.task}</p>
                                        {data.assignee && <span className="text-[9px] text-[var(--theme-color)] uppercase font-black tracking-widest mt-1 block opacity-70">Assignee: {data.assignee}</span>}
                                    </div>
                                </div>
                            )}
                            {type === 'TAKEAWAY' && (
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-transparent border border-black/5 dark:border-white/5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-lg">lightbulb</span>
                                        <h4 className="text-[11px] font-bold uppercase tracking-tight text-slate-800 dark:text-white">{data.title}</h4>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">{data.description}</p>
                                </div>
                            )}
                        </div>
                    );
                } catch (e) {
                    console.error("Failed to parse widget", match[1]);
                }
            }
            cleanText = cleanText.replace(regex, "");
        };

        processWidget(flashcardRegex, 'FLASHCARD');
        processWidget(quizSetRegex, 'QUIZ_SET');
        processWidget(quizRegex, 'QUIZ');
        processWidget(timelineRegex, 'TIMELINE');
        processWidget(actionItemRegex, 'ACTION_ITEM');
        processWidget(takeawayRegex, 'TAKEAWAY');
        processWidget(comparisonRegex, 'COMPARISON');
        processWidget(statRegex, 'STAT');

        // Raw JSON discovery fallback (if no widgets were found but text looks like JSON)
        if (widgets.length === 0 && (cleanText.trim().startsWith('[') || cleanText.trim().startsWith('{'))) {
            try {
                const data = JSON.parse(cleanText.trim());
                if (Array.isArray(data) || data.questions) {
                    // It's a quiz!
                    widgets.push(
                        <div key="quiz-fallback" className="my-6">
                            <div className="bg-white dark:bg-zinc-900 border-t-4 border-[var(--theme-color)] rounded-3xl p-8 shadow-2xl max-w-2xl mx-auto overflow-hidden relative">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h4 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{data.title || "Interactive Assessment"}</h4>
                                        <p className="text-xs text-slate-400 mt-2 font-medium uppercase tracking-widest italic opacity-60 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-color)] animate-pulse"></span>
                                            {Array.isArray(data.questions) ? data.questions.length : (Array.isArray(data) ? data.length : 1)} Concepts Covered
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--theme-color)]/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[var(--theme-color)] text-2xl">school</span>
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    {(data.questions || (Array.isArray(data) ? data : [])).map((q: any, qi: number) => (
                                        <div key={qi} className="group/q border-b border-black/5 dark:border-white/5 last:border-0 pb-8 last:pb-0">
                                            <div className="flex gap-4 mb-4">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-400 shrink-0">0{qi + 1}</span>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">{q.question}</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-10">
                                                {q.options.map((opt: string, i: number) => (
                                                    <button key={i} className="group/opt text-left px-4 py-3 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 hover:border-[var(--theme-color)]/50 hover:bg-[var(--theme-color)]/5 transition-all outline-none">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-6 h-6 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover/opt:border-[var(--theme-color)] group-hover/opt:text-[var(--theme-color)]">{String.fromCharCode(65 + i)}</span>
                                                            <span className="text-xs text-slate-600 dark:text-neutral-400 font-medium">{opt}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-10 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-500 font-medium">Click an option to check your knowledge.</span>
                                    <button className="bg-[var(--theme-color)] text-black px-6 py-2 rounded-xl font-black text-[11px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[var(--theme-color)]/20">Submit Answers</button>
                                </div>
                            </div>
                        </div>
                    );
                    cleanText = ""; // Clear text since it was just the JSON
                }
            } catch (e) {
                // Not valid JSON or not a quiz, ignore
            }
        }

        // Robust Ad-hoc Markdown Rendering
        const htmlContent = cleanText
            // Tables (Basic support for | Col | Col | format)
            .replace(/\|(.+)\|/gim, (match) => {
                const cols = match.split('|').filter(c => c.trim().length > 0);
                if (cols.length === 0) return match;
                return `<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-black/5 dark:divide-white/10 border border-black/5 dark:border-white/10 rounded-xl overflow-hidden text-[11px]">
                    <tr class="bg-black/5 dark:bg-white/5">
                        ${cols.map(c => `<th class="px-3 py-2 text-left font-bold text-slate-800 dark:text-white uppercase tracking-tighter">${c.trim()}</th>`).join('')}
                    </tr>
                </table></div>`;
            })
            // Headers
            .replace(/^#{3} (.*$)/gim, '<h3 class="text-lg font-bold text-slate-800 dark:text-white mt-6 mb-2">$1</h3>')
            .replace(/^#{2} (.*$)/gim, '<h2 class="text-xl font-bold text-slate-800 dark:text-white mt-8 mb-4 border-b border-black/5 pb-2">$1</h2>')
            .replace(/^#{1} (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-6">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<b class="font-bold text-slate-900 dark:text-white">$1</b>')
            // Italics
            .replace(/\*(.*?)\*/g, '<i class="italic opacity-80">$1</i>')
            // Blockquotes
            .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-[var(--theme-color)]/40 bg-black/5 dark:bg-white/5 px-4 py-2 my-4 rounded-r-lg italic text-slate-600 dark:text-neutral-400">$1</blockquote>')
            // Lists (Simple)
            .replace(/^\s*[-*] (.*$)/gim, '<li class="ml-4 list-disc text-slate-600 dark:text-neutral-400 mb-1">$1</li>')
            // Paragraphs and breaks
            .replace(/\n/g, '<br/>');

        return (
            <div className="space-y-2">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                {widgets.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-black/5 dark:border-white/5 space-y-4">
                        {widgets}
                    </div>
                )}
            </div>
        );
    };

    const suggestions = [
        { label: 'Generate Quiz', icon: 'quiz', query: 'Generate a comprehensive quiz set based on my notes.' },
        { label: 'Show Timeline', icon: 'event_repeat', query: 'Show a timeline of key events and dates mentioned in my library.' },
        { label: 'Compare Concepts', icon: 'compare_arrows', query: 'Compare the primary concepts discussed in my recent notes.' },
        { label: 'Key Takeaways', icon: 'lightbulb', query: 'Summarize the most important takeaways from all my notes.' }
    ];

    // Derive currentSession for rendering purposes
    const currentSession = currentSessionId 
        ? sessions.find(s => s.id === currentSessionId) 
        : { id: 'new', title: 'New Session', messages: messages, updated_at: new Date().toISOString() };


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
                                >
                                    {renderMessageContent(msg.text)}
                                </div>
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
                    <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {/* Suggestions Row */}
                    {messages.length <= 1 && (
                        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setQuery(s.query);
                                        // Auto-trigger if clicking a suggestion
                                        setTimeout(handleSend, 100);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-[var(--theme-color)]/50 hover:bg-[var(--theme-color)]/5 transition-all group shadow-sm active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--theme-color)] text-lg transition-colors">{s.icon}</span>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

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
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-color)]/20 to-[var(--theme-color)]/5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                            <input
                                className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl pl-6 pr-14 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--theme-color)]/50 transition-all shadow-inner relative z-10"
                                placeholder="Search across all notes..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button
                                onClick={handleSend}
                                disabled={loading}
                                className="absolute right-3 top-2 bottom-2 px-4 bg-[var(--theme-color)] rounded-xl text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--theme-color)]/20 disabled:opacity-50 z-20"
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
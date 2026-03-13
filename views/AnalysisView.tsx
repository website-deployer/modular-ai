import React, { useState } from 'react';
import { Note, ChatMessage } from '../types';
import { generateGlobalAnalysis } from '../services/aiService';

interface AnalysisViewProps {
    notes: Note[];
    contextualAttachments?: string[];
    setContextualAttachments?: React.Dispatch<React.SetStateAction<string[]>>;
}

interface FlashcardData {
    front: string;
    back: string;
}

// Flashcard Deck Component
const FlashcardDeck: React.FC<{ cards: FlashcardData[] }> = ({ cards }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);

    if (!cards || cards.length === 0) return null;

    const currentCard = cards[currentIndex];

    const nextCard = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    }

    const prevCard = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }

    return (
        <div className="my-6 select-none bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--theme-color)]">style</span>
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Flashcards ({currentIndex + 1}/{cards.length})</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={prevCard} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"><span className="material-symbols-outlined text-base">arrow_back</span></button>
                    <button onClick={nextCard} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"><span className="material-symbols-outlined text-base">arrow_forward</span></button>
                </div>
            </div>

            {/* Card Container */}
            <div
                onClick={() => setFlipped(!flipped)}
                className="w-full h-64 perspective-1000 cursor-pointer group relative"
            >
                <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${flipped ? 'rotate-y-180' : ''}`}>
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-white dark:bg-[#27272a] border border-black/10 dark:border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm group-hover:shadow-md transition-shadow">
                        <span className="text-[10px] uppercase tracking-widest text-[var(--theme-color)] font-bold mb-4 border border-[var(--theme-color)] px-2 py-0.5 rounded-full">Front</span>
                        <p className="text-xl font-bold text-slate-800 dark:text-white font-display leading-tight">{currentCard.front}</p>
                        <span className="text-xs text-neutral-400 mt-auto pt-4 flex items-center gap-1 opacity-50"><span className="material-symbols-outlined text-xs">touch_app</span> Tap to flip</span>
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[var(--theme-color)] rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-md text-black border border-[var(--theme-color)]">
                        <span className="text-[10px] uppercase tracking-widest text-black/60 font-bold mb-4 border border-black/20 px-2 py-0.5 rounded-full">Back</span>
                        <p className="text-lg font-medium leading-relaxed font-display">{currentCard.back}</p>
                    </div>
                </div>
            </div>
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </div>
    );
}

interface QuizData {
    question: string;
    options: string[];
    answer: string;
}

interface TimelineData {
    date: string;
    description: string;
}

interface ActionItemData {
    task: string;
    assignee?: string;
}

interface TakeawayData {
    title: string;
    description: string;
}

// Single Quiz Question Widget
const QuizItem: React.FC<{ data: QuizData; index: number }> = ({ data, index }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const isCorrect = selected === data.answer;

    return (
        <div className="border-b border-black/5 dark:border-white/5 last:border-0 py-6 first:pt-0">
            <div className="flex gap-3 mb-4">
                <span className="w-6 h-6 rounded-full bg-[var(--theme-color)] text-black text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white pt-0.5">{data.question}</h3>
            </div>
            <div className="space-y-2 pl-9">
                {data.options.map((opt, idx) => (
                    <button
                        key={idx}
                        disabled={submitted}
                        onClick={() => setSelected(opt)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all border ${submitted && opt === data.answer
                                ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300'
                                : submitted && selected === opt && opt !== data.answer
                                    ? 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300'
                                    : selected === opt
                                        ? 'bg-[rgba(var(--theme-rgb),0.2)] border-[var(--theme-color)] text-slate-900 dark:text-white'
                                        : 'bg-black/5 dark:bg-white/5 border-transparent hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-neutral-300'
                            }`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
            {!submitted && selected && (
                <div className="pl-9 mt-3">
                    <button
                        onClick={() => setSubmitted(true)}
                        className="py-1.5 px-4 bg-[var(--theme-color)] text-black font-bold rounded-lg hover:brightness-110 transition-colors text-xs uppercase tracking-wider"
                    >
                        Check
                    </button>
                </div>
            )}
            {submitted && (
                <div className={`mt-3 pl-9 text-sm font-bold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {isCorrect ? 'Correct! Well done.' : `Incorrect. The answer is ${data.answer}`}
                </div>
            )}
        </div>
    );
}

const QuizGroup: React.FC<{ quizzes: QuizData[] }> = ({ quizzes }) => {
    if (!quizzes || quizzes.length === 0) return null;
    return (
        <div className="bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 rounded-xl p-6 my-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-black/5 dark:border-white/5 pb-4">
                <span className="material-symbols-outlined text-[var(--theme-color)]">quiz</span>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Knowledge Check</span>
            </div>
            <div>
                {quizzes.map((q, i) => <QuizItem key={i} data={q} index={i} />)}
            </div>
        </div>
    )
}

const TimelineWidget: React.FC<{ events: TimelineData[] }> = ({ events }) => {
    if (!events || events.length === 0) return null;
    return (
        <div className="bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 rounded-xl p-6 my-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-black/5 dark:border-white/5 pb-4">
                <span className="material-symbols-outlined text-[var(--theme-color)]">timeline</span>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Timeline</span>
            </div>
            <div className="relative border-l-2 border-black/10 dark:border-white/10 ml-3 space-y-8">
                {events.map((event, i) => (
                    <div key={i} className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-[var(--theme-color)] rounded-full -left-[7px] top-1.5 ring-4 ring-white dark:ring-[#18181b]"></div>
                        <div className="text-xs font-bold text-[var(--theme-color)] mb-1 uppercase tracking-wider">{event.date}</div>
                        <div className="text-sm text-slate-700 dark:text-neutral-300">{event.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ActionItemsWidget: React.FC<{ items: ActionItemData[] }> = ({ items }) => {
    const [completed, setCompleted] = useState<Set<number>>(new Set());

    if (!items || items.length === 0) return null;

    const toggle = (index: number) => {
        const next = new Set(completed);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setCompleted(next);
    };

    return (
        <div className="bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 rounded-xl p-6 my-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-black/5 dark:border-white/5 pb-4">
                <span className="material-symbols-outlined text-[var(--theme-color)]">task_alt</span>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Action Items</span>
            </div>
            <div className="space-y-3">
                {items.map((item, i) => {
                    const isDone = completed.has(i);
                    return (
                        <div
                            key={i}
                            onClick={() => toggle(i)}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isDone
                                    ? 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'
                                    : 'bg-white dark:bg-[#18181b] border-black/10 dark:border-white/10 hover:border-[var(--theme-color)]/50 shadow-sm'
                                }`}
                        >
                            <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone
                                    ? 'bg-[var(--theme-color)] border-[var(--theme-color)]'
                                    : 'border-black/20 dark:border-white/20'
                                }`}>
                                {isDone && <span className="material-symbols-outlined text-black text-[14px] font-bold">check</span>}
                            </div>
                            <div>
                                <div className={`text-sm font-medium transition-all ${isDone ? 'text-neutral-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                    {item.task}
                                </div>
                                {item.assignee && (
                                    <div className={`text-xs mt-1 ${isDone ? 'text-neutral-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
                                        Assignee: {item.assignee}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TakeawaysWidget: React.FC<{ takeaways: TakeawayData[] }> = ({ takeaways }) => {
    if (!takeaways || takeaways.length === 0) return null;
    return (
        <div className="bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 rounded-xl p-6 my-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-black/5 dark:border-white/5 pb-4">
                <span className="material-symbols-outlined text-[var(--theme-color)]">lightbulb</span>
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Key Takeaways</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {takeaways.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 dark:to-transparent border border-black/5 dark:border-white/5">
                        <div className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[var(--theme-color)]/20 text-[var(--theme-color)] flex items-center justify-center text-xs">{i + 1}</span>
                            {item.title}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-neutral-400 leading-relaxed">{item.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AnalysisView: React.FC<AnalysisViewProps> = ({ notes, contextualAttachments = [], setContextualAttachments }) => {
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'init',
            role: 'model',
            text: `I've analyzed your ${notes.length} notes. I'm ready to help you synthesize this information.`,
            timestamp: new Date()
        }
    ]);
    const [loading, setLoading] = useState(false);

    // Advanced renderer to handle text and special widgets grouped together
    const renderMessageContent = (text: string) => {
        const flashcards: FlashcardData[] = [];
        const quizzes: QuizData[] = [];
        const timelines: TimelineData[] = [];
        const actionItems: ActionItemData[] = [];
        const takeaways: TakeawayData[] = [];

        // Extract Flashcards
        let cleanText = text.replace(/<<<FLASHCARD:(.*?)>>>/g, (match, json) => {
            try { flashcards.push(JSON.parse(json)); } catch (e) { }
            return "";
        });

        // Extract Quizzes
        cleanText = cleanText.replace(/<<<QUIZ:(.*?)>>>/g, (match, json) => {
            try { quizzes.push(JSON.parse(json)); } catch (e) { }
            return "";
        });

        // Extract Timeline
        cleanText = cleanText.replace(/<<<TIMELINE:(.*?)>>>/g, (match, json) => {
            try { timelines.push(JSON.parse(json)); } catch (e) { }
            return "";
        });

        // Extract Action Items
        cleanText = cleanText.replace(/<<<ACTION_ITEM:(.*?)>>>/g, (match, json) => {
            try { actionItems.push(JSON.parse(json)); } catch (e) { }
            return "";
        });

        // Extract Takeaways
        cleanText = cleanText.replace(/<<<TAKEAWAY:(.*?)>>>/g, (match, json) => {
            try { takeaways.push(JSON.parse(json)); } catch (e) { }
            return "";
        });

        // Simple markdown replacements for the remaining text
        let html = cleanText.replace(/\n/g, '<br/>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--theme-color)]">$1</strong>');
        html = html.replace(/`(.*?)`/g, '<code class="bg-black/20 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-xs border border-white/5">$1</code>');

        // Remove excessive newlines that might be left over from removals
        html = html.replace(/(<br\/>){3,}/g, '<br/><br/>');

        return (
            <div>
                {cleanText.trim() && (
                    <div
                        className="whitespace-pre-wrap mb-4"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                )}
                {flashcards.length > 0 && <FlashcardDeck cards={flashcards} />}
                {quizzes.length > 0 && <QuizGroup quizzes={quizzes} />}
                {timelines.length > 0 && <TimelineWidget events={timelines} />}
                {actionItems.length > 0 && <ActionItemsWidget items={actionItems} />}
                {takeaways.length > 0 && <TakeawaysWidget takeaways={takeaways} />}
            </div>
        );
    };

    const handleSend = async () => {
        if (!query.trim() && contextualAttachments.length === 0) return;

        let finalQuery = query;
        
        // Prepend attachments if any exist
        if (contextualAttachments.length > 0) {
            const attachmentsBlock = contextualAttachments.map(text => `> ${text}`).join('\n>\n');
            finalQuery = `${attachmentsBlock}\n\n${query}`.trim();
        }

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: finalQuery, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setQuery("");
        
        // Clear global attachments
        if (setContextualAttachments) {
            setContextualAttachments([]);
        }

        setLoading(true);

        const responseText = await generateGlobalAnalysis(
            notes,
            finalQuery,
            messages.map(m => ({ role: m.role, text: m.text }))
        );

        setLoading(false);
        setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: new Date()
        }]);
    };

    const handleClearSession = () => {
        setMessages([
            {
                id: 'init',
                role: 'model',
                text: `I've analyzed your ${notes.length} notes. I'm ready to help you synthesize this information.`,
                timestamp: new Date()
            }
        ]);
    };

    return (
        <main className="flex-1 flex flex-col min-w-0 relative bg-[#f4f4f5] dark:bg-[#09090b]">
            <header className="shrink-0 h-16 md:h-20 border-b border-black/5 dark:border-white/10 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-[#09090b]/90 backdrop-blur-md z-10 sticky top-0">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none mb-1 font-display">Global Analysis</h1>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium font-body">Deep Learning active across {notes.length} knowledge nodes</span>
                </div>
                <button
                    onClick={handleClearSession}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors text-sm font-bold"
                >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                    Clear Session
                </button>
            </header>

            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 md:p-6 overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-4 pb-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'model' ? 'bg-white dark:bg-[#27272a] border border-black/5 dark:border-white/10' : 'bg-neutral-200 dark:bg-white'}`}>
                                {msg.role === 'model' ?
                                    <span className="material-symbols-outlined text-xl text-[var(--theme-color)]">psychology_alt</span> :
                                    <span className="text-black text-sm font-bold">You</span>
                                }
                            </div>
                            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                <span className={`text-xs font-bold text-neutral-500 ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                                    {msg.role === 'model' ? 'Neural Network' : 'User'}
                                </span>
                                <div
                                    className={`p-5 rounded-2xl text-base leading-relaxed shadow-sm ${msg.role === 'model'
                                            ? 'bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/10 text-slate-700 dark:text-neutral-300'
                                            : 'bg-[var(--theme-color)] text-black font-medium shadow-[var(--theme-color)]/10'
                                        }`}
                                >
                                    {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-white dark:bg-[#27272a] flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10">
                                <span className="material-symbols-outlined text-xl text-[var(--theme-color)] animate-pulse">psychology_alt</span>
                            </div>
                            <div className="flex items-center gap-2 mt-3 p-4 bg-white dark:bg-[#18181b] rounded-2xl rounded-tl-none border border-black/5 dark:border-white/5">
                                <span className="text-sm text-neutral-500 font-mono">Synthesizing connections...</span>
                                <div className="flex gap-1.5 items-center ml-2">
                                    <span className="w-1 h-3 bg-[var(--theme-color)] animate-[pulse_1s_ease-in-out_infinite]"></span>
                                    <span className="w-1 h-5 bg-[var(--theme-color)] animate-[pulse_1s_ease-in-out_0.2s_infinite]"></span>
                                    <span className="w-1 h-2 bg-[var(--theme-color)] animate-[pulse_1s_ease-in-out_0.4s_infinite]"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="h-4"></div>
                </div>

                {/* Input Area */}
                <div className="mt-4 relative z-20 flex flex-col gap-2">
                    {contextualAttachments && contextualAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                            {contextualAttachments.map((text, idx) => (
                                <div key={idx} className="bg-[var(--theme-color)]/20 border border-[var(--theme-color)] text-slate-800 dark:text-neutral-200 text-xs px-3 py-2 rounded-lg flex items-start gap-2 max-w-full shadow-sm">
                                    <span className="material-symbols-outlined text-[14px] text-[var(--theme-color)] mt-0.5 shrink-0">format_quote</span>
                                    <div className="truncate flex-1 max-w-[300px]" title={text}>{text}</div>
                                    <button 
                                        onClick={() => setContextualAttachments && setContextualAttachments(prev => prev.filter((_, i) => i !== idx))}
                                        className="shrink-0 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-1 transition-colors"
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
                            className="w-full bg-white dark:bg-[#09090b] border border-black/10 dark:border-white/10 rounded-2xl px-6 py-5 pr-14 text-lg text-slate-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-[var(--theme-color)] focus:ring-0 transition-all shadow-inner font-body relative z-10"
                            placeholder="Ask for summaries, quizzes, or connections..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            className="absolute right-3 top-3 p-2 bg-[var(--theme-color)] rounded-xl text-black hover:brightness-110 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--theme-color)]/20 z-20"
                        >
                            <span className="material-symbols-outlined text-2xl">arrow_upward</span>
                        </button>
                    </div>
                    <div className="flex justify-center mt-3 gap-2 md:gap-3 flex-wrap">
                        <button onClick={() => setQuery("Create flashcards for my recent notes")} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">style</span> Flashcards</button>
                        <button onClick={() => setQuery("Make a quiz based on my notes")} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">quiz</span> Quiz Me</button>
                        <button onClick={() => setQuery("Extract the key takeaways from all documents")} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">lightbulb</span> Key Takeaways</button>
                        <button onClick={() => setQuery("Create a timeline of events from my notes")} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">timeline</span> Timeline</button>
                        <button onClick={() => setQuery("List all action items and tasks")} className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">task_alt</span> Action Items</button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AnalysisView;
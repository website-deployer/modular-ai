import React, { useState, useEffect, useRef } from 'react';
import { generateChatResponse } from '../services/aiService';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
    context: string;
}

// Simple markdown parser for bold, italic, lists, code
const renderMarkdown = (text: string) => {
    // Escape HTML first (rudimentary)
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--theme-color)]">$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Inline Code
    html = html.replace(/`(.*?)`/g, '<code class="bg-black/20 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-xs border border-white/5">$1</code>');

    // Unordered lists (rudimentary: must be at start of line or following newline)
    // Note: This simple regex won't handle nested lists perfectly but works for simple AI outputs
    if (html.includes('\n- ') || html.includes('\n* ')) {
        const lines = html.split('\n');
        let inList = false;
        let newLines = [];

        for (let line of lines) {
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                if (!inList) {
                    newLines.push('<ul class="list-disc pl-4 space-y-1 my-2">');
                    inList = true;
                }
                newLines.push(`<li>${line.trim().substring(2)}</li>`);
            } else {
                if (inList) {
                    newLines.push('</ul>');
                    inList = false;
                }
                newLines.push(line);
            }
        }
        if (inList) newLines.push('</ul>');
        html = newLines.join('\n');
    }

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '<br/><br/>');

    return { __html: html };
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ context }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Reset chat when context (note) changes
    useEffect(() => {
        setMessages([
            {
                id: 'init',
                role: 'model',
                text: "I've analyzed this session. I can help you clarify concepts, summarize key points, or find specific details.",
                timestamp: new Date()
            }
        ]);
    }, [context]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        const responseText = await generateChatResponse(
            messages.map(m => ({ role: m.role, text: m.text })),
            context,
            input
        );

        setLoading(false);
        setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: new Date()
        }]);
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#f4f4f5] dark:bg-[#09090b]">
            {/* Messages Area - Scrollable */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'model' ? 'bg-white/5 border border-black/5 dark:border-white/10' : 'bg-neutral-200 dark:bg-white'}`}>
                            {msg.role === 'model' ?
                                <span className="material-symbols-outlined text-xs text-[var(--theme-color)]">smart_toy</span> :
                                <span className="text-black text-[10px] font-bold">You</span>
                            }
                        </div>
                        <div className={`flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%]`}>
                            <span className={`text-[10px] font-bold text-neutral-500 dark:text-neutral-400 ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                                {msg.role === 'model' ? 'AI Assistant' : 'You'}
                            </span>
                            <div
                                className={`p-3 rounded-xl text-xs leading-relaxed shadow-sm ${msg.role === 'model'
                                        ? 'bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-700 dark:text-neutral-300'
                                        : 'bg-[var(--theme-color)] text-black font-medium shadow-[var(--theme-color)]/10'
                                    } ${msg.role === 'model' ? 'rounded-bl-none' : 'rounded-br-none'}`}
                                dangerouslySetInnerHTML={msg.role === 'model' ? renderMarkdown(msg.text) : { __html: msg.text }}
                            />
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10">
                            <span className="material-symbols-outlined text-xs text-[var(--theme-color)]">smart_toy</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce"></span>
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                            <span className="w-1 h-1 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area - Fixed at Bottom */}
            <div className="p-3 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                <div className="relative group">
                    <input
                        className="w-full bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2.5 pr-10 text-xs text-slate-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--theme-color)]/50 focus:ring-1 focus:ring-[var(--theme-color)]/50 transition-all shadow-inner font-body"
                        placeholder="Ask about the content..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-1.5 top-1.5 p-1 bg-[var(--theme-color)] rounded-md text-black hover:brightness-110 transition-colors shadow-lg shadow-[var(--theme-color)]/20"
                    >
                        <span className="material-symbols-outlined text-[16px] font-bold">arrow_upward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;
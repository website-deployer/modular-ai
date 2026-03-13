import React, { useState, useEffect, useRef } from 'react';
import { View, Note } from '../types';
import AudioVisualizer from '../components/AudioVisualizer';
import { connectToLiveAPI, floatTo16BitPCM, base64EncodeAudio, generateNoteFromTranscript, generateTitle, downsampleTo16k } from '../services/aiService';

interface RecorderViewProps {
    onSaveSession: (note: Note) => void;
    onCancel: () => void;
    autoGenerateTitles: boolean;
}

interface MarkdownBlockProps {
    text: string;
}

const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ text }) => {
    // Basic safety check for empty text to avoid crashes or weird spacing
    if (!text) return null;

    const lines = text.split('\n');
    return (
        <div className="space-y-2 font-body text-neutral-300">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <br key={i} />;

                // Headers
                if (trimmed.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2 font-display tracking-tight">{trimmed.substring(2)}</h1>;
                if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-[var(--theme-color)] mt-3 mb-1 font-display">{trimmed.substring(3)}</h2>;
                if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-white mt-2 mb-1">{trimmed.substring(4)}</h3>;

                // Lists
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex gap-2 ml-4">
                            <span className="text-[var(--theme-color)] font-bold mt-1.5">•</span>
                            <p className="leading-relaxed" dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed.substring(2)) }}></p>
                        </div>
                    )
                }

                // Blockquotes
                if (trimmed.startsWith('> ')) {
                    return <blockquote key={i} className="border-l-4 border-[var(--theme-color)] pl-4 italic text-neutral-400 my-2">{trimmed.substring(2)}</blockquote>
                }

                // Standard Paragraph
                return <p key={i} className="leading-relaxed min-h-[1.5em]" dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmed) }}></p>;
            })}
        </div>
    )
};

const parseInlineStyles = (text: string) => {
    // Bold
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-neutral-400">$1</em>');
    // Code
    html = html.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-[var(--theme-color)] font-mono text-sm border border-white/5">$1</code>');
    return html;
}

const RecorderView: React.FC<RecorderViewProps> = ({ onSaveSession, onCancel, autoGenerateTitles }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [duration, setDuration] = useState(0);

    // Content State
    const [fullTranscript, setFullTranscript] = useState("");
    const [pinnedItems, setPinnedItems] = useState<{ time: string, text: string }[]>([]);
    const [streamingText, setStreamingText] = useState("");
    const [modelThoughts, setModelThoughts] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Refs for audio handling & State Tracking
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isRecordingRef = useRef(false);

    useEffect(() => {
        let interval: any;
        if (isRecording) {
            interval = setInterval(() => setDuration(d => d + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const cleanupAudio = () => {
        isRecordingRef.current = false; // Stop processor immediately
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        analyserRef.current = null;
    };

    const startRecording = async () => {
        setErrorMessage(null);
        try {
            if (!process.env.API_KEY) {
                throw new Error("API Key is missing. Please check your environment configuration.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            streamRef.current = stream;

            // 1. Setup Audio Context
            // Note: Browser might ignore sampleRate param and give hardware rate (e.g. 48000)
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const contextSampleRate = audioContextRef.current.sampleRate;
            console.log(`Audio Context Sample Rate: ${contextSampleRate}Hz`);

            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);

            // Setup Analyser
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            sourceRef.current.connect(analyser);
            analyserRef.current = analyser;

            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            // 2. Connect to API
            const sessionPromise = connectToLiveAPI({
                onOpen: () => {
                    console.log("Connected to Gemini Live");
                    setIsRecording(true);
                    isRecordingRef.current = true; // Sync ref for processor
                },
                onMessage: (userText, modelText, audioData) => {
                    if (userText) {
                        setFullTranscript(prev => prev + userText);
                        setStreamingText(prev => prev + userText);
                    }
                    if (modelText) {
                        setModelThoughts(prev => prev + modelText);
                    }
                },
                onClose: () => {
                    console.log("Session closed");
                    setIsRecording(false);
                    isRecordingRef.current = false;
                },
                onError: (err) => {
                    console.error("Gemini Live Error Detected in View:", err);
                    setErrorMessage(err.message || "Connection error. Please try again.");
                    setIsRecording(false);
                    isRecordingRef.current = false;
                    cleanupAudio();
                }
            });

            sessionRef.current = sessionPromise;

            // 3. Audio Processing Loop
            processorRef.current.onaudioprocess = (e) => {
                // Check ref instead of state to avoid stale closure
                if (!isRecordingRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // CRITICAL: Downsample to 16000Hz if the context is running higher (e.g. 48k or 44.1k)
                // The API explicitly expects 16kHz for the simple mimeType 'audio/pcm;rate=16000'
                const downsampledData = downsampleTo16k(inputData, contextSampleRate);

                const pcm16 = floatTo16BitPCM(downsampledData);
                const base64Audio = base64EncodeAudio(pcm16);

                // Only send if session is ready
                if (sessionRef.current) {
                    sessionRef.current.then((session: any) => {
                        try {
                            session.sendRealtimeInput({
                                media: {
                                    mimeType: 'audio/pcm;rate=16000',
                                    data: base64Audio
                                }
                            });
                        } catch (sendErr) {
                            console.warn("Failed to send audio frame:", sendErr);
                        }
                    }).catch((err: any) => {
                        // Suppress unhandled promise rejections from the loop if session failed
                    });
                }
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);

        } catch (err: any) {
            console.error("Failed to start recording:", err);
            setErrorMessage(err.message || "Microphone access denied or Network Error.");
            cleanupAudio();
        }
    };

    const stopRecording = async () => {
        cleanupAudio();
        setIsRecording(false);

        if (!fullTranscript) {
            setErrorMessage("No audio was recorded or transcribed.");
            return;
        }

        // Generate Note
        setIsProcessing(true);

        let title = `Live Session ${new Date().toLocaleDateString()}`;
        if (autoGenerateTitles && fullTranscript.length > 20) {
            title = await generateTitle(fullTranscript);
        }

        // Append pinned items to content
        let finalContent = fullTranscript;
        if (pinnedItems.length > 0) {
            finalContent += "\n\n<h2>📌 Pinned Insights</h2>\n<ul>" +
                pinnedItems.map(p => `<li><strong>${p.time}:</strong> ${p.text}</li>`).join('') +
                "</ul>";
        }

        const generatedContent = await generateNoteFromTranscript(finalContent, title);

        const newNote: Note = {
            id: Date.now().toString(),
            title: title,
            date: new Date().toLocaleString(),
            duration: formatTime(duration),
            content: generatedContent,
            transcript: fullTranscript || "No transcript available.",
            type: 'AUDIO',
            tags: ['Live Recording']
        };

        setIsProcessing(false);
        onSaveSession(newNote);
    };

    const handlePin = () => {
        const snippet = streamingText.slice(-150) || "User marked this timestamp.";
        const cleanSnippet = snippet.replace(/\n/g, ' ').trim() + "...";

        setPinnedItems(prev => [...prev, {
            time: formatTime(duration),
            text: cleanSnippet
        }]);
    };

    if (isProcessing) {
        return (
            <main className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-[#050505]">
                {/* Fixed Overlay Blocker */}
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
                    <div className="w-12 h-12 border-4 border-[var(--theme-color)] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h2 className="text-xl font-bold font-display">Synthesizing Notes...</h2>
                    <p className="text-neutral-400">Gemini is structuring your session.</p>
                </div>
                {/* Fallback empty view behind blocker so layout doesn't completely break visually */}
            </main>
        )
    }

    return (
        <main className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-[#050505]">
            <header className="shrink-0 h-16 md:h-20 border-b border-black/5 dark:border-white/10 flex items-center justify-between px-3 md:px-8 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-md z-10 sticky top-0 gap-2">
                <div className="flex flex-col gap-0.5 hidden sm:flex">
                    <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-white/60 uppercase tracking-wider border border-black/5 dark:border-white/5">Workspace</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-600"></span>
                        <span className="text-xs text-[var(--theme-color)] uppercase font-bold tracking-wider">Active Record</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Live Session</h1>
                </div>

                <div className="flex items-center justify-center flex-1 sm:flex-none sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-[#111] px-4 md:px-5 py-1.5 md:py-2.5 rounded-full border border-black/5 dark:border-white/10 shadow-xl">
                        <div className={`w-2 h-2 rounded-full bg-[var(--theme-color)] ${isRecording ? 'animate-pulse shadow-[0_0_8px_var(--theme-color)]' : ''}`}></div>
                        <span className="font-mono text-sm md:text-lg font-medium tracking-widest text-slate-900 dark:text-white">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isRecording ? (
                        <button onClick={startRecording} className="h-9 px-4 rounded-full bg-[var(--theme-color)] hover:brightness-110 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_15px_-3px_rgba(var(--theme-rgb),0.3)] hover:shadow-[0_0_20px_-3px_rgba(var(--theme-rgb),0.5)]">
                            <span className="material-symbols-outlined text-[18px]">mic</span>
                            <span className="hidden md:inline">Start</span>
                        </button>
                    ) : (
                        <button onClick={stopRecording} className="h-9 px-4 rounded-full bg-black/5 dark:bg-white/5 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 hover:border-green-500/20 border border-black/10 dark:border-white/10 text-neutral-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                            <span className="hidden md:inline">Finish</span>
                        </button>
                    )}
                    <button onClick={onCancel} className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 border border-black/10 dark:border-white/10 flex items-center justify-center text-neutral-500 dark:text-neutral-400 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            </header>

            {errorMessage && (
                <div className="bg-red-500/20 border-b border-red-500/20 p-2 text-center text-red-200 text-sm font-bold flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {errorMessage}
                </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: Live Document Stream */}
                <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5 relative">
                    <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-white dark:from-[#050505] to-transparent pointer-events-none z-10"></div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 bg-white dark:bg-[#050505] relative custom-scrollbar scroll-smooth flex flex-col">
                        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                            {streamingText === "" ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-30 mt-20 text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-6xl mb-4">mic_none</span>
                                    <p className="text-xl font-display">Ready to transcribe</p>
                                    <p className="text-sm text-center max-w-xs mt-2">Speak clearly. I will transcribe your words here.</p>
                                    {isRecording && (
                                        <div className="mt-8 flex items-center gap-2 text-[var(--theme-color)] animate-pulse">
                                            <span className="material-symbols-outlined">hearing</span>
                                            <span className="text-sm font-bold">Listening...</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <MarkdownBlock text={streamingText} />
                                </div>
                            )}
                            {isRecording && streamingText !== "" && (
                                <div className="mt-4 flex items-center gap-1 opacity-50 pl-1">
                                    <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
                                    <span className="w-1.5 h-1.5 bg-[var(--theme-color)] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                                </div>
                            )}
                        </div>

                        {/* Model Thoughts Area */}
                        {modelThoughts && (
                            <div className="max-w-3xl mx-auto w-full mt-8 p-4 md:p-6 bg-neutral-50 dark:bg-[#111] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3 text-[var(--theme-color)]">
                                    <span className="material-symbols-outlined text-lg">psychology</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">AI Thoughts</span>
                                </div>
                                <div className="text-sm text-slate-700 dark:text-neutral-300">
                                    <MarkdownBlock text={modelThoughts} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-32 bg-white dark:bg-[#050505] border-t border-black/5 dark:border-white/5 flex items-center px-4 md:px-8 relative z-20">
                        <AudioVisualizer isActive={isRecording} analyser={analyserRef.current} />
                    </div>
                </div>

                {/* Right: Pinned Insights */}
                <div className="w-full lg:w-80 bg-neutral-50 dark:bg-[#0a0a0a] border-l border-black/5 dark:border-white/5 flex-col hidden lg:flex">
                    <div className="h-12 flex items-center px-4 border-b border-black/5 dark:border-white/5 bg-neutral-100 dark:bg-[#111]">
                        <span className="material-symbols-outlined text-neutral-500 text-sm mr-2">push_pin</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Pinned Insights</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {pinnedItems.length === 0 ? (
                            <div className="text-center mt-10 opacity-30">
                                <p className="text-xs text-slate-900 dark:text-white">Tap "Pin Moment" to save key highlights.</p>
                            </div>
                        ) : (
                            pinnedItems.map((item, idx) => (
                                <div key={idx} className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/5 p-3 rounded-lg text-sm group hover:border-[var(--theme-color)]/30 transition-colors animate-in fade-in slide-in-from-right-4 duration-300 shadow-sm dark:shadow-none">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[var(--theme-color)] text-xs font-mono">{item.time}</span>
                                        <button className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-slate-900 dark:hover:text-white transition-opacity"><span className="material-symbols-outlined text-sm">edit</span></button>
                                    </div>
                                    <p className="text-slate-700 dark:text-neutral-300 line-clamp-3 leading-relaxed">{item.text}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-black/5 dark:border-white/5 bg-neutral-100 dark:bg-[#111]">
                        <button
                            onClick={handlePin}
                            disabled={!isRecording}
                            className="w-full h-10 bg-white dark:bg-white/5 hover:bg-[var(--theme-color)] hover:text-black text-slate-900 dark:text-white border border-black/10 dark:border-white/10 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_15px_-3px_rgba(var(--theme-rgb),0.3)]"
                        >
                            <span className="material-symbols-outlined text-lg">push_pin</span>
                            Pin Moment
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default RecorderView;
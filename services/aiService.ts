import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Note } from '../types';

// Fallback logic shifted to backend proxy (/api/).
// We only initialize Gemini here exclusively for Live Audio WebSockets,
// which must connect natively via wss:// from the client to the Gemini Live Service.
const getGeminiClient = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// 1. Chat with Context
export const generateChatResponse = async (
    history: { role: string; text: string }[],
    context: string,
    userMessage: string
): Promise<string> => {
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history, context, userMessage })
        });

        if (!res.ok) throw new Error("Backend chat failure");
        const data = await res.json();
        return data.content;
    } catch (error) {
        console.error("Chat Error:", error);
        return "Sorry, I encountered an error connecting to the AI.";
    }
};

// 2. Process Document (PDF/Image) to create Note
export const processDocument = async (base64Data: string, mimeType: string, fileName: string): Promise<{ title: string, content: string, transcript: string }> => {
    try {
        const res = await fetch('/api/document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data, mimeType, fileName })
        });

        if (!res.ok) throw new Error("Backend document processing failure");
        return await res.json();
    } catch (error) {
        console.error("Document Processing Error:", error);
        return {
            title: fileName,
            content: "<h1>Error Processing Document</h1><p>The AI could not read this file.</p>",
            transcript: ""
        };
    }
};

// 3. Generate Structured Notes from Transcript (Text-only fallback)
export const generateNoteFromTranscript = async (transcript: string, title?: string): Promise<string> => {
    try {
        const res = await fetch('/api/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'note', transcript })
        });

        if (!res.ok) throw new Error("Backend note failure");
        const data = await res.json();
        return data.content;
    } catch (error) {
        console.error("Note Generation Error:", error);
        return "<h1>Error Generating Notes</h1><p>Please try again later.</p>";
    }
}

// 3.5 Generate Title Only
export const generateTitle = async (transcript: string): Promise<string> => {
    try {
        const res = await fetch('/api/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'title', transcript })
        });

        if (!res.ok) throw new Error("Backend title failure");
        const data = await res.json();
        return data.content;
    } catch {
        return "New Session";
    }
};

// 4. Global Corpus Analysis (Multi-Format Support)
export const generateGlobalAnalysis = async (notes: Note[], query: string, history: { role: string; text: string }[]): Promise<string> => {
    try {
        // Optimization: Strip large binary data (sourceData) and keep only essential context
        // This prevents 413 (Payload Too Large) errors on Vercel's 4.5MB limit
        const optimizedNotes = notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            transcript: n.transcript
        }));

        // Safety truncation: If total characters exceed ~4M (approx 4MB), 
        // we truncate individual note contents proportionally to stay under the limit.
        let totalLen = JSON.stringify(optimizedNotes).length + JSON.stringify(history).length + query.length;
        const LIMIT = 4000000; // 4M characters

        let finalNotes = optimizedNotes;
        if (totalLen > LIMIT) {
            console.warn(`Payload size (${totalLen}) exceeds safety limit. Truncating context.`);
            // Sort by title/id to keep it stable, then truncate content/transcript if needed
            finalNotes = optimizedNotes.map(n => ({
                ...n,
                content: n.content.slice(0, 50000), // Cap individual notes at 50k chars
                transcript: n.transcript.slice(0, 50000)
            }));
        }

        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: finalNotes, query, history })
        });

        if (res.status === 413) {
            throw new Error("The combined size of your notes is too large for the analyzer. Try deleting some unused recordings or long files.");
        }

        if (!res.ok) throw new Error("Backend analysis failure");
        const data = await res.json();
        return data.content;
    } catch (error: any) {
        console.error("Analysis Error:", error);
        return error.message || "I am currently unable to access the global knowledge base.";
    }
};

// 4.5 Analysis Session Management
export const getAnalysisSessions = async (): Promise<any[]> => {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error("Failed to load sessions");
    return await res.json();
};

export const loadAnalysisSession = async (id: string): Promise<any> => {
    const res = await fetch('/api/sessions', {
        method: 'PUT', // Using PUT for fetching by ID in this implementation
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error("Failed to load session content");
    return await res.json();
};

export const saveAnalysisSession = async (session: { id?: string, title: string, messages: any[] }): Promise<any> => {
    const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
    });
    if (!res.ok) throw new Error("Failed to save session");
    return await res.json();
};

export const deleteAnalysisSession = async (id: string): Promise<void> => {
    const res = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error("Failed to delete session");
};


// 5. Audio Helpers
export const downsampleTo16k = (buffer: Float32Array, inputSampleRate: number): Float32Array => {
    if (inputSampleRate === 16000) return buffer;
    const sampleRateRatio = inputSampleRate / 16000;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0, offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
};

export const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
};

export const base64EncodeAudio = (int16Array: Int16Array): string => {
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

// 6. Live API Connection (Keeping Gemini natively for audio sockets)
export interface LiveConnectionConfig {
    onOpen: () => void;
    onMessage: (userText: string | null, modelText: string | null, audioData: string | null) => void;
    onClose: () => void;
    onError: (error: Error) => void;
}

export const connectToLiveAPI = async (config: LiveConnectionConfig) => {
    try {
        const ai = getGeminiClient();
        const model = "gemini-1.5-flash";

        const session = await ai.live.connect({
            model,
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                inputAudioTranscription: {},
                systemInstruction: "You are a passive listener and transcriber. Your only task is to capture the user's speech accurately. Do not reply. Do not speak. Do not answer questions. Stay silent and listen.",
            },
            callbacks: {
                onopen: () => config.onOpen(),
                onmessage: (msg: LiveServerMessage) => {
                    let userText = "", modelText = "";
                    if (msg.serverContent?.inputTranscription?.text) userText += msg.serverContent.inputTranscription.text;
                    if (msg.serverContent?.modelTurn?.parts?.[0]?.text) modelText += msg.serverContent.modelTurn.parts[0].text;
                    config.onMessage(userText || null, modelText || null, null);
                },
                onclose: () => config.onClose(),
                onerror: (err: any) => config.onError(new Error(err instanceof Error ? err.message : "Live API Error Detail: " + err)),
            }
        });
        return session;
    } catch (err) {
        console.error("Setup Connection Error:", err);
        throw err;
    }
};

import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { history, context, userMessage } = req.body;

        const systemInstruction = `You are a helpful teaching assistant and research aide. 
You have access to the following source material (transcript or document):
---
${context ? context.slice(0, 50000) : ''} ... (truncated if too long)
---
Answer the user's questions based strictly on this context. Be concise, academic, and helpful.`;

        const totalChars = (context || "").length + (userMessage || "").length + (history || []).reduce((acc: number, h: any) => acc + h.text.length, 0);
        const useGroq = totalChars < 30000;

        if (useGroq) {
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                const messages: any[] = [
                    { role: 'system', content: systemInstruction },
                    ...(history || []).map((h: any) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
                    { role: 'user', content: userMessage }
                ];

                const response = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: messages,
                });

                return res.status(200).json({ content: response.choices[0]?.message?.content || "I couldn't generate a response." });
            } catch (error: any) {
                console.warn("Groq chat failed (possibly rate limit), falling back to Gemini:", error.message);
            }
        }

        // Gemini Fallback
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const chat = await ai.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: systemInstruction,
            }
        });

        const promptWithContext = (history || []).map((h: any) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.text}`).join('\n') + `\n\nUser: ${userMessage}`;
        const response = await chat.sendMessage({ message: promptWithContext });

        return res.status(200).json({ content: response.text || "I couldn't generate a response." });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

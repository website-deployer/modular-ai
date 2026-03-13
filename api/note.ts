import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, transcript } = req.body;

        if (action === "title") {
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                const response = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: `Based on this text, generate a short, descriptive title (max 6 words). Text: ${(transcript || "").slice(0, 1000)}` }]
                });
                return res.status(200).json({ content: response.choices[0]?.message?.content?.trim() || "New Session" });
            } catch {
                return res.status(200).json({ content: "New Session" });
            }
        }

        if (action === "note") {
            const prompt = `
            You are an expert note-taker. Transform the following raw text/transcript into a high-quality, structured study guide.
            
            CRITICAL INSTRUCTIONS:
            1. **Do NOT just copy the text.** You must summarize and organize it.
            2. **Structure**: Start with a brief <b>Executive Summary</b>. Use <h2> headers, <ul> lists.
            3. **HIGHLIGHTS**: Wrap ALL key terms, important concepts, definitions, names, and notable phrases in <b> bold tags. This is extremely important — by wrapping key terms in <b> tags they will be visually highlighted in the user's chosen accent color. Be generous with highlights.
            4. **Format**: Use strictly HTML. Do NOT use Markdown. Do NOT use inline styles.
            5. Use <blockquote> for important quotes or takeaways.
            
            Raw Text:
            ${(transcript || "").slice(0, 100000)}
            `;

            if ((transcript || "").length < 30000) {
                try {
                    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                    const response = await groq.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "user", content: prompt }]
                    });
                    return res.status(200).json({ content: response.choices[0]?.message?.content || "Could not generate notes." });
                } catch (error: any) {
                    console.warn("Groq note generation failed, falling back to Gemini:", error.message);
                }
            }

            // Gemini Fallback
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt
            });
            return res.status(200).json({ content: response.text || "Could not generate notes." });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error: any) {
        console.error("Note API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

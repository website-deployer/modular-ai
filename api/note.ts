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
            
            YOU MUST follow this EXACT HTML template structure. Do not deviate:

            <blockquote><b>Executive Summary</b>: [2-3 sentence overview of the entire content]</blockquote>

            <h2>🔑 Key Concepts</h2>
            <ul>
            <li><b>[Term 1]</b> — [Brief definition or explanation]</li>
            <li><b>[Term 2]</b> — [Brief definition or explanation]</li>
            [... more as needed]
            </ul>

            <h2>📝 Detailed Notes</h2>
            [Structured paragraphs with <b>bold highlights</b> on important phrases. Use <h3> sub-headers if multiple topics exist. Be thorough but concise.]

            <h2>✅ Action Items</h2>
            <ul>
            <li>[ ] [Actionable task derived from the content]</li>
            [... more as needed, or write "No action items identified." if none]
            </ul>

            <h2>⚡ Quick Review</h2>
            <ul>
            <li>[One-line bullet summary point 1]</li>
            <li>[One-line bullet summary point 2]</li>
            [... 3-6 key takeaways]
            </ul>

            RULES:
            - Do NOT just copy the raw text. Summarize and restructure it.
            - Wrap ALL key terms, names, definitions in <b class="theme-highlight"> bold tags. Be generous.
            - Use strictly HTML. Do NOT use Markdown. Do NOT use inline styles.
            - Keep the section headers exactly as shown (with the emoji).
            
            Raw Text:
            ${(transcript || "").slice(0, 100000)}
            `;

            if ((transcript || "").length < 50000) {
                try {
                    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                    const response = await groq.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 3000,
                        temperature: 0.5
                    });
                    return res.status(200).json({ content: response.choices[0]?.message?.content || "Could not generate notes." });
                } catch (error: any) {
                    console.warn("Groq note generation failed, falling back to Gemini:", error.message);
                }
            }

            // Gemini Fallback
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-1.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    maxOutputTokens: 4000,
                    temperature: 0.5
                }
            });
            return res.status(200).json({ content: response.text || "Could not generate notes." });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error: any) {
        console.error("Note API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

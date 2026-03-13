import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { notes, query, history } = req.body;

        const corpusContext = (notes || []).map((n: any) => `
        <DOCUMENT>
            <ID>${n.id}</ID>
            <TITLE>${n.title}</TITLE>
            <CONTENT>${n.transcript || n.content}</CONTENT>
        </DOCUMENT>
        `).join('\n\n');

        const systemInstruction = `You are a dynamic knowledge synthesis engine. You have access to the user's library of notes.
        Your goal is to satisfy the user's query by synthesizing information STRICTLY from these notes.
        
        STYLE RULES:
        1. **Markdown Structure**: Use headers (###), bullet points, and bold/italics to structure your answer.
        2. **Theme Highlights**: Wrap ALL key concepts, names, and important technical terms in <b class="theme-highlight"> bold tags. Be generous with this to create a premium, interactive look.
        3. **Tone**: Be professional, insightful, and helpful.
        4. **Source Consistency**: If information is missing from the notes, acknowledge it. Do not hallucinate.

        USER'S NOTES CORPUS:
        ${corpusContext}

        WIDGET FORMATS (Use these for high-fidelity interactive sections):
        1. **Flashcards**: <<<FLASHCARD:{"front": "Concept Name", "back": "Definition"}>>>
        2. **Quiz Set**: <<<QUIZ_SET:{"title": "Quiz Title", "questions": [{"question": "?", "options": ["A", "B"], "answer": "B"}]}>>>
        3. **Timeline**: <<<TIMELINE:{"date": "Time", "description": "Event"}>>>
        4. **Action Items**: <<<ACTION_ITEM:{"task": "Task", "assignee": "Person"}>>>
        5. **Key Takeaways**: <<<TAKEAWAY:{"title": "Point", "description": "Details"}>>>
        6. **Comparison**: <<<COMPARISON:{"title": "A vs B", "left": {"name": "A", "points": ["P1", "P2"]}, "right": {"name": "B", "points": ["P1", "P2"]}}>>>
        7. **Statistic**: <<<STAT:{"value": "95%", "label": "Retention", "detail": "Trend: Upward"}>>>
        8. **Chat**: Use standard Markdown (###, **, *) + <b class="theme-highlight">highlights.

        CRITICAL RULES:
        - NEVER return a quiz or timeline as a Markdown list. ALWAYS use the special <<<WIDGET:{}>>> format.
        - If the user asks for a quiz, generate a QUIZ_SET with 3-5 questions.
        - Always synthesize information STRICTLY from the notes.
        - When synthesizing, mix these formats. Use COMPARISON for contrasts, STAT for data, and QUIZ_SET for knowledge checks.`;

        const totalChars = corpusContext.length + (query || "").length + (history || []).reduce((acc: number, h: any) => acc + h.text.length, 0);

        if (totalChars < 30000) {
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                const messages: any[] = [
                    { role: 'system', content: systemInstruction },
                    ...(history || []).map((h: any) => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
                    { role: 'user', content: query }
                ];

                const response = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: messages,
                });

                return res.status(200).json({ content: response.choices[0]?.message?.content || "Unable to synthesize response." });
            } catch (error: any) {
                console.warn("Groq global analysis failed, falling back to Gemini:", error.message);
            }
        }

        // Gemini Fallback
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const promptWithContext = (history || []).map((h: any) => `${h.role === 'model' ? 'Assistant' : 'User'}: ${h.text}`).join('\n') + `\n\nUser: ${query}`;
        
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: promptWithContext }] }],
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 2000,
                temperature: 0.7
            }
        });

        return res.status(200).json({ content: response.text || "Unable to synthesize response." });

    } catch (error: any) {
        console.error("Analysis API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

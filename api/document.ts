import { GoogleGenAI, Type } from "@google/genai";

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
        const { base64Data, mimeType, fileName } = req.body;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const modelId = "gemini-2.5-flash";

        const prompt = `
        Analyze the provided document (slides or text) and create a structured study guide.
        
        CRITICAL INSTRUCTIONS:
        1. **Title**: Generate a concise, descriptive title.
        2. **Content**: Create a detailed, structured HTML summary. 
        3. **Transcript**: Extract the raw text for searchability. Limit to most important text if very long.

        Output format (JSON): { "title": "Title Here", "content": "HTML Here", "transcript": "Raw Text Here" }
        `;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING },
                        transcript: { type: Type.STRING }
                    },
                    required: ["title", "content", "transcript"]
                }
            }
        });

        let text = response.text;
        if (!text) throw new Error("No response from AI");

        // Simple JSON extractor
        let result;
        try {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                result = JSON.parse(text.substring(firstBrace, lastBrace + 1));
            } else {
                result = JSON.parse(text);
            }
        } catch (e) {
            // Very rugged fallback for invalid JSON strings escaping
            const titleMatch = text.match(/"title"\s*:\s*"((?:\\"|[^"])*)(?:"|$)/);
            const contentMatch = text.match(/"content"\s*:\s*"((?:\\"|[^"])*)(?:"|$)/);
            const transcriptMatch = text.match(/"transcript"\s*:\s*"((?:\\"|[^"])*)(?:"|$)/);
            result = {
                title: titleMatch ? titleMatch[1] : fileName,
                content: contentMatch ? contentMatch[1] : "<p>Could not summarize content.</p>",
                transcript: transcriptMatch ? transcriptMatch[1] : ""
            };
        }

        return res.status(200).json({
            title: result.title || fileName,
            content: result.content || "<p>Could not summarize content.</p>",
            transcript: result.transcript || "No transcript extracted."
        });

    } catch (error: any) {
        console.error("Document API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

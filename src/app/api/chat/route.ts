import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini (handling empty case for graceful degradation)
const apiKey = process.env.AI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { messages, documentData } = await req.json();

    if (!apiKey) {
      return NextResponse.json({
        response: "Mocked AI Response: Please set the AI_API_KEY environment variable in your Vercel Dashboard to enable full Claude/Gemini intelligence. Based on the SSOT Data, your requested project metrics show $1,200,000 claim value.",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const promptContext = `You are a Senior JES BIM Operations AI Assistant.\nData Context (from Notion DB):\n${JSON.stringify(documentData)}\n\nAnswer the user query completely professionally based ONLY on the context above. If they mention Billing Model=Resourcing or LumpSum, refer to their specific databases.`;
    
    // Extract the last message from user
    const lastUserMessage = messages[messages.length - 1].content;
    const finalPrompt = `${promptContext}\n\nUser Query: ${lastUserMessage}`;

    const result = await model.generateContent(finalPrompt);
    const text = result.response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error("Chat AI Error:", error);
    return NextResponse.json({ error: "Failed to process chat query" }, { status: 500 });
  }
}

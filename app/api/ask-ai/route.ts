import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

function cleanAnswer(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function buildPrompt(question: string): string {
  return `Answer this question in only 1 or 2 short sentences.

Use simple language suitable for a student.
Do not use Markdown, bold text, headings, bullet points, asterisks, or special formatting.

Question: ${question}`;
}

async function askGemini(question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: buildPrompt(question),
    config: {
      maxOutputTokens: 100,
      temperature: 0.3,
    },
  });

  const answer = response.text?.trim();

  if (!answer) {
    throw new Error("Gemini returned an empty answer.");
  }

  return cleanAnswer(answer);
}

async function askOpenAI(question: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({
    apiKey,
  });

  const response = await openai.responses.create({
    model: "gpt-6-luna",
    input: buildPrompt(question),
    max_output_tokens: 100,
  });

  const answer = response.output_text?.trim();

  if (!answer) {
    throw new Error("OpenAI returned an empty answer.");
  }

  return cleanAnswer(answer);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body?.question;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        {
          error: "Question is required.",
        },
        {
          status: 400,
        }
      );
    }

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return NextResponse.json(
        {
          error: "Question is required.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 1. Try Gemini first
    // --------------------------------------------------
    try {
      const answer = await askGemini(trimmedQuestion);

      return NextResponse.json({
        answer,
        provider: "Gemini",
      });
    } catch (geminiError) {
      console.error("Gemini failed:", geminiError);
    }

    // --------------------------------------------------
    // 2. Gemini failed → try OpenAI
    // --------------------------------------------------
    try {
      const answer = await askOpenAI(trimmedQuestion);

      return NextResponse.json({
        answer,
        provider: "OpenAI",
      });
    } catch (openAIError) {
      console.error("OpenAI failed:", openAIError);
    }

    // --------------------------------------------------
    // 3. Both AI providers failed
    // --------------------------------------------------
    return NextResponse.json(
      {
        error:
          "Both AI services are currently unavailable. Please try again shortly.",
      },
      {
        status: 503,
      }
    );
  } catch (error) {
    console.error("Ask AI route error:", error);

    return NextResponse.json(
      {
        error: "Unable to process the AI request.",
      },
      {
        status: 500,
      }
    );
  }
}
/**
 * Rolloy Creative OS - Prompt Translation API
 *
 * POST /api/translate-prompt
 * Translates English prompts to natural, fluent Chinese
 * for user readability while preserving technical terms
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Use gemini-2.5-flash for faster translation
const TRANSLATION_MODEL = 'gemini-2.5-flash';

// ============================================================================
// Types
// ============================================================================

interface TranslatePromptRequest {
  prompt: string;
}

interface TranslatePromptResponse {
  translatedPrompt: string;
  metadata: {
    model: string;
    timestamp: string;
  };
}

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// ============================================================================
// System Prompt for Translation
// ============================================================================

const TRANSLATION_SYSTEM_PROMPT = `You are an expert translator specializing in AI image generation prompts. Your task is to translate English prompts into natural, fluent Chinese.

CRITICAL RULES:
1. Translate to natural, flowing Chinese - NOT mechanical word-by-word translation
2. Preserve professional terms and product names in English:
   - "Rolloy Compact Master" - keep in English
   - Technical photography terms (e.g., "f/2.8", "ISO 100", "85mm lens") - keep in English
   - Brand names and proper nouns - keep in English
3. Maintain the meaning and intent of the original prompt
4. Use proper Chinese grammar and sentence structure
5. Keep the translation concise and readable
6. Preserve the tone and style of the original (descriptive, professional, etc.)

OUTPUT FORMAT:
Return ONLY the Chinese translation. No explanations, no headers, no additional text.`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: TranslatePromptRequest = await request.json();
    const { prompt } = body;

    // Validate request
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing or invalid prompt',
            details: 'A non-empty prompt string is required',
          },
        },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'GEMINI_API_KEY is not configured',
          },
        },
        { status: 500 }
      );
    }

    // Build the translation prompt
    const userPrompt = `Translate the following English image generation prompt to natural Chinese:

"""
${prompt}
"""

Please provide the Chinese translation:`;

    console.log('Translating prompt, length:', prompt.length);

    // Call Gemini API with fast model
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: TRANSLATION_MODEL,
      systemInstruction: TRANSLATION_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const translatedPrompt = response.text().trim();

    if (!translatedPrompt) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'GENERATION_ERROR',
            message: 'Failed to translate prompt',
            details: 'Gemini returned empty response',
          },
        },
        { status: 500 }
      );
    }

    const responseData: TranslatePromptResponse = {
      translatedPrompt,
      metadata: {
        model: TRANSLATION_MODEL,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json<APIResponse<TranslatePromptResponse>>(
      {
        success: true,
        data: responseData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/translate-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to translate prompt',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Rolloy Creative OS - Prompt Refinement API
 *
 * POST /api/refine-prompt
 * Refines an existing prompt based on user's adjustment instructions
 * while preserving the original scene, product, and other settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview';

// ============================================================================
// Types
// ============================================================================

interface RefinePromptRequest {
  originalPrompt: string;
  refinementInstruction: string;
  productState: 'FOLDED' | 'UNFOLDED';
}

interface RefinePromptResponse {
  refinedPrompt: string;
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
// System Prompt for Refinement
// ============================================================================

const REFINEMENT_SYSTEM_PROMPT = `You are an expert prompt editor for AI image generation. Your task is to modify an existing image prompt based on user instructions while preserving all other elements.

CRITICAL RULES:
1. ONLY modify the specific aspect mentioned in the user's instruction
2. PRESERVE all other elements exactly as they are (scene, environment, lighting, camera specs, product description, quality statements)
3. Maintain the same prompt structure and length (150-200 words)
4. Keep all product-related statements unchanged, especially:
   - "The 'Rolloy Compact Master' rollator shown must be rendered exactly as it appears in the provided product reference image, with absolutely no edits or changes to its design, color, or components."
   - Quality statement at the end
5. Ensure the modified prompt flows naturally as a single paragraph
6. If the instruction is in Chinese, understand it but output the refined prompt in English

OUTPUT FORMAT:
Return ONLY the refined prompt as a single flowing paragraph. No explanations, no headers, no additional text.`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: RefinePromptRequest = await request.json();
    const { originalPrompt, refinementInstruction, productState } = body;

    // Validate request
    if (!originalPrompt || !refinementInstruction) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields',
            details: 'Both originalPrompt and refinementInstruction are required',
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

    // Build the refinement prompt
    const userPrompt = `Original Prompt:
"""
${originalPrompt}
"""

User's Refinement Instruction:
"""
${refinementInstruction}
"""

Product State: ${productState} (${productState === 'FOLDED' ? 'compact, portable, folded for storage/transport - ONLY 66cm/26 inches tall, knee-height' : 'in-use, fully open and functional - waist-height'})

Please modify the original prompt according to the user's instruction while keeping everything else unchanged. Output only the refined prompt:`;

    console.log('Refining prompt with instruction:', refinementInstruction);

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: REFINEMENT_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const refinedPrompt = response.text().trim();

    if (!refinedPrompt) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'GENERATION_ERROR',
            message: 'Failed to generate refined prompt',
            details: 'Gemini returned empty response',
          },
        },
        { status: 500 }
      );
    }

    const responseData: RefinePromptResponse = {
      refinedPrompt,
      metadata: {
        model: TEXT_MODEL,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json<APIResponse<RefinePromptResponse>>(
      {
        success: true,
        data: responseData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/refine-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to refine prompt',
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

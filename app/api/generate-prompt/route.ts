/**
 * Rolloy Creative OS - Prompt Generation API
 *
 * POST /api/generate-prompt
 * Generates the image prompt without generating images
 * Used for the preview step before image generation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePrompt,
  determineProductState,
  getReferenceImageUrl,
  ABCDSelection,
} from '@/lib/services/gemini-service';

// ============================================================================
// Types
// ============================================================================

interface GeneratePromptRequest {
  selection: ABCDSelection;
  forceProductState?: 'FOLDED' | 'UNFOLDED'; // Override auto-detected state
}

interface GeneratePromptResponse {
  prompt: string;
  productState: string;
  referenceImageUrl: string;
  creativeName: string;
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
// Helper: Generate creative naming
// ============================================================================

function generateCreativeName(selection: ABCDSelection): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${date}_${selection.A1}_${selection.A2}_${selection.B}_${selection.C}_${selection.D}`;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePromptRequest = await request.json();
    const { selection, forceProductState } = body;

    // Validate selection
    if (!selection || !selection.A1 || !selection.A2 || !selection.B || !selection.C || !selection.D) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_SELECTION',
            message: 'Invalid ABCD selection',
            details: 'All fields (A1, A2, B, C, D) are required',
          },
        },
        { status: 400 }
      );
    }

    // Determine product state (use forced state if provided, otherwise auto-detect)
    const productState = forceProductState || determineProductState(selection.B);
    const referenceImageUrl = getReferenceImageUrl(productState);
    const creativeName = generateCreativeName(selection);

    console.log('Generating prompt for:', creativeName);
    console.log('Product State:', productState);

    // Generate prompt using Gemini
    const promptResult = await generatePrompt({
      selection,
      productState,
    });

    const response: GeneratePromptResponse = {
      prompt: promptResult.prompt,
      productState,
      referenceImageUrl,
      creativeName,
      metadata: {
        model: promptResult.metadata.model,
        timestamp: promptResult.metadata.timestamp,
      },
    };

    return NextResponse.json<APIResponse<GeneratePromptResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/generate-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate prompt',
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

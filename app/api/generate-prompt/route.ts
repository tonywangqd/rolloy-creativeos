/**
 * Rolloy Creative OS - Prompt Generation API
 *
 * POST /api/generate-prompt
 * Generates the image prompt without generating images
 * Used for the preview step before image generation
 *
 * IMPORTANT: This API now fetches AI Visual Prompt contexts from the database
 * to generate rich, contextual prompts. The product state is also determined
 * from the database when available.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePrompt,
  determineProductState,
  getReferenceImageUrl,
  ABCDSelection,
} from '@/lib/services/gemini-service';
import {
  fetchABCDContexts,
  getProductStateFromContext,
} from '@/lib/services/abcd-context-service';

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

    // CRITICAL: Fetch AI Visual Prompt contexts from database
    console.log('Fetching ABCD contexts from database...');
    const contexts = await fetchABCDContexts(selection);

    // Determine product state:
    // 1. Use forceProductState if provided (from frontend when user explicitly switches)
    // 2. Otherwise use database product_state from action context
    // 3. Fallback to keyword-based detection (legacy)
    let productState: 'FOLDED' | 'UNFOLDED';
    if (forceProductState) {
      productState = forceProductState;
      console.log(`Using forced product state: ${productState}`);
    } else {
      productState = getProductStateFromContext(contexts.action, determineProductState);
      console.log(`Product state from database: ${productState} (action: ${selection.B})`);
    }

    const referenceImageUrl = getReferenceImageUrl(productState);
    const creativeName = generateCreativeName(selection);

    console.log('Generating prompt for:', creativeName);
    console.log('Product State:', productState);
    console.log('Database contexts loaded:', {
      sceneCategory: !!contexts.sceneCategory?.ai_visual_prompt,
      sceneDetail: !!contexts.sceneDetail?.ai_visual_prompt,
      action: !!contexts.action?.ai_visual_prompt,
      emotion: !!contexts.emotion?.ai_visual_prompt,
      format: !!contexts.format?.ai_visual_prompt,
    });

    // Generate prompt using Gemini with database contexts
    const promptResult = await generatePrompt({
      selection,
      productState,
      contexts,  // NEW: Pass database contexts for rich prompt generation
    });

    const response: GeneratePromptResponse = {
      prompt: promptResult.prompt,
      productState,
      referenceImageUrl,
      creativeName,
      metadata: {
        model: promptResult.metadata.model,
        timestamp: promptResult.metadata.timestamp,
        // Include context usage info in response
        ...(promptResult.metadata as any).databaseContextUsed !== undefined && {
          databaseContextUsed: (promptResult.metadata as any).databaseContextUsed,
        },
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

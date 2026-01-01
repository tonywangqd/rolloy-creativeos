/**
 * Rolloy Creative OS - Walker Prompt Generation API
 *
 * POST /api/walker/generate-prompt
 * Generates the image prompt for Standard Walker products
 * Specifically designed for two-wheel walkers (NOT rollators)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateWalkerPrompt,
  determineWalkerState,
  getWalkerReferenceImageUrl,
  ABCDSelection,
} from '@/lib/services/walker-gemini-service';
import {
  fetchABCDContexts,
} from '@/lib/services/abcd-context-service';

// ============================================================================
// Types
// ============================================================================

interface GenerateWalkerPromptRequest {
  selection: ABCDSelection;
  forceWalkerState?: 'FOLDED' | 'UNFOLDED'; // Override auto-detected state
}

interface GenerateWalkerPromptResponse {
  prompt: string;
  walkerState: string;
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
// Helper: Generate creative naming for Walker
// ============================================================================

function generateWalkerCreativeName(selection: ABCDSelection): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // Prefix with WALKER to distinguish from rollator creatives
  return `WALKER_${date}_${selection.A1}_${selection.A2}_${selection.B}_${selection.C}_${selection.D}`;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateWalkerPromptRequest = await request.json();
    const { selection, forceWalkerState } = body;

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

    // Fetch AI Visual Prompt contexts from database
    // Note: These contexts are currently shared with rollator, but can be
    // separated into walker-specific contexts in the future
    console.log('[Walker] Fetching ABCD contexts from database...');
    const contexts = await fetchABCDContexts(selection);

    // Determine walker state:
    // 1. Use forceWalkerState if provided
    // 2. Otherwise use keyword-based detection
    // Note: Walker uses FOLDED/UNFOLDED states (same as Rollator for consistency)
    let walkerState: 'FOLDED' | 'UNFOLDED';
    if (forceWalkerState) {
      walkerState = forceWalkerState;
      console.log(`[Walker] Using forced walker state: ${walkerState}`);
    } else {
      walkerState = determineWalkerState(selection.B);
      console.log(`[Walker] Auto-detected walker state: ${walkerState} (action: ${selection.B})`);
    }

    const referenceImageUrl = getWalkerReferenceImageUrl(walkerState);
    const creativeName = generateWalkerCreativeName(selection);

    console.log('[Walker] Generating prompt for:', creativeName);
    console.log('[Walker] Walker State:', walkerState);
    console.log('[Walker] Database contexts loaded:', {
      sceneCategory: !!contexts.sceneCategory?.ai_visual_prompt,
      sceneDetail: !!contexts.sceneDetail?.ai_visual_prompt,
      action: !!contexts.action?.ai_visual_prompt,
      emotion: !!contexts.emotion?.ai_visual_prompt,
      format: !!contexts.format?.ai_visual_prompt,
    });

    // Generate walker-specific prompt using Gemini
    const promptResult = await generateWalkerPrompt({
      selection,
      walkerState,
      contexts,
    });

    const response: GenerateWalkerPromptResponse = {
      prompt: promptResult.prompt,
      walkerState,
      referenceImageUrl,
      creativeName,
      metadata: {
        model: promptResult.metadata.model,
        timestamp: promptResult.metadata.timestamp,
      },
    };

    return NextResponse.json<APIResponse<GenerateWalkerPromptResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Walker] Error in /api/walker/generate-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate walker prompt',
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

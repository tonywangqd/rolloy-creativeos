/**
 * Rolloy Creative OS - Image Generation API
 *
 * POST /api/generate
 * Orchestrates the complete creative generation workflow:
 * 1. Validate ABCD selection
 * 2. Generate creative naming
 * 3. Determine product state (FOLDED/UNFOLDED)
 * 4. Generate images using Gemini (both prompt and image generation)
 * 5. Return generated images
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateImages,
  generateImagesBatch,
  determineProductState,
  getReferenceImageUrl,
  ABCDSelection,
} from '@/lib/services/gemini-service';

// ============================================================================
// Request/Response Types
// ============================================================================

interface GenerateRequest {
  selection: ABCDSelection;
  numImages?: number;
}

interface GenerateResponse {
  creativeName: string;
  productState: string;
  referenceImageUrl: string;
  prompt: string;
  generatedImages: string[];
  metadata: {
    totalGenerated: number;
    totalFailed: number;
    generationTime: number;
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
  metadata?: {
    timestamp: string;
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
  const startTime = Date.now();

  try {
    // Parse request body
    const body: GenerateRequest = await request.json();
    const { selection, numImages = 4 } = body;

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

    // Generate creative name
    const creativeName = generateCreativeName(selection);
    const productState = determineProductState(selection.B);
    const referenceImageUrl = getReferenceImageUrl(productState);

    console.log('Creative Name:', creativeName);
    console.log('Product State:', productState);
    console.log('Reference Image:', referenceImageUrl);

    // Generate images using Gemini
    console.log(`Generating ${numImages} images with Gemini...`);

    let result;
    if (numImages <= 4) {
      result = await generateImages(selection, numImages);
    } else {
      result = await generateImagesBatch(selection, numImages, (progress) => {
        console.log(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`);
      });
    }

    const generationTime = Date.now() - startTime;

    console.log(`Generated ${result.imageUrls.length} images in ${generationTime}ms`);

    if (!result.success) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'Failed to generate images',
            details: result.error,
          },
        },
        { status: 500 }
      );
    }

    // Return success response
    const response: GenerateResponse = {
      creativeName,
      productState,
      referenceImageUrl,
      prompt: result.prompt,
      generatedImages: result.imageUrls,
      metadata: {
        totalGenerated: result.imageUrls.length,
        totalFailed: numImages - result.imageUrls.length,
        generationTime,
      },
    };

    return NextResponse.json<APIResponse<GenerateResponse>>(
      {
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/generate:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate creative',
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
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ============================================================================
// GET Handler - Test endpoint
// ============================================================================

export async function GET() {
  return NextResponse.json<APIResponse>(
    {
      success: true,
      data: {
        message: 'Rolloy Creative OS - Image Generation API',
        version: '2.0',
        models: {
          text: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp',
          image: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp',
        },
        endpoints: {
          'POST /api/generate': 'Generate images from ABCD selection',
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: 200 }
  );
}

/**
 * Rolloy Creative OS - Single Image Generation API
 *
 * POST /api/generate-single
 * Generates a single image based on prompt and reference image
 * Used for sequential generation (one at a time)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

// ============================================================================
// Types
// ============================================================================

interface GenerateSingleRequest {
  prompt: string;
  referenceImageUrl: string;
  imageIndex: number;
  totalImages: number;
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
// Helper: Fetch image as base64
// ============================================================================

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSingleRequest = await request.json();
    const { prompt, referenceImageUrl, imageIndex, totalImages } = body;

    // Validate request
    if (!prompt || !referenceImageUrl) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing prompt or reference image URL',
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
            message: 'Gemini API key not configured',
          },
        },
        { status: 500 }
      );
    }

    console.log(`Generating image ${imageIndex + 1}/${totalImages}...`);

    // Fetch reference image
    const referenceImageBase64 = await fetchImageAsBase64(referenceImageUrl);
    const mimeType = referenceImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

    // Create image prompt with variation
    const imagePrompt = `Create an advertising photograph based on this reference product image.

${prompt}

IMPORTANT INSTRUCTIONS:
- Keep the walker/rollator product EXACTLY as shown in the reference image
- Transform ONLY the background, environment, and add human elements
- This is variation ${imageIndex + 1} of ${totalImages} - make it unique
- Maintain photorealistic quality
- Professional advertising photography style
- Create a distinct scene different from other variations`;

    // Generate image
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: referenceImageBase64
        }
      },
      { text: imagePrompt }
    ]);

    const response = await result.response;

    // Check for image in response
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ('inlineData' in part && part.inlineData?.data) {
          const imageDataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;

          return NextResponse.json<APIResponse>(
            {
              success: true,
              data: {
                imageUrl: imageDataUrl,
                imageIndex,
              },
            },
            { status: 200 }
          );
        }
      }
    }

    // If no image in response
    const textResponse = response.text?.() || '';
    console.log('Gemini returned text instead of image:', textResponse.substring(0, 200));

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'NO_IMAGE_GENERATED',
          message: 'Gemini did not return an image',
          details: textResponse.substring(0, 200),
        },
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error in /api/generate-single:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate image',
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

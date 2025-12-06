/**
 * Rolloy Creative OS - Single Image Generation API
 *
 * POST /api/generate-single
 * Generates a single image based on prompt and reference image
 * Used for sequential generation (one at a time)
 * Auto-saves generated images to Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STORAGE_BUCKET = 'creative-assets';

// ============================================================================
// Types
// ============================================================================

interface GenerateSingleRequest {
  prompt: string;
  referenceImageUrl: string;
  imageIndex: number;
  totalImages: number;
  creativeName: string; // For storage path
  sessionId?: string; // For updating database record
  aspectRatio?: string; // "1:1", "2:3", "3:2", etc.
  resolution?: string; // "1K", "2K", "4K"
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
// Helper: Upload image to Supabase Storage
// ============================================================================

async function uploadToStorage(
  base64Data: string,
  mimeType: string,
  creativeName: string,
  imageIndex: number
): Promise<{ publicUrl: string; storagePath: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase not configured, skipping storage upload');
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Create storage path: creativeName/01.png, 02.png, etc.
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${String(imageIndex + 1).padStart(2, '0')}.${extension}`;
    const storagePath = `generated/${creativeName}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Storage upload error:', error.message);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    console.log(`Image ${imageIndex + 1} saved to: ${storagePath}`);

    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: data.path,
    };
  } catch (error) {
    console.error('Failed to upload to storage:', error);
    return null;
  }
}

// ============================================================================
// Helper: Update database record with storage URL
// ============================================================================

async function updateImageRecord(
  sessionId: string,
  imageIndex: number,
  storageUrl: string,
  storagePath: string
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Update the image record by session_id and image_index
    const { error } = await supabase
      .from('generated_images_v2')
      .update({
        status: 'success',
        storage_url: storageUrl,
        storage_path: storagePath,
        generated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('image_index', imageIndex + 1); // image_index is 1-based in DB

    if (error) {
      console.error('Failed to update image record:', error.message);
      return false;
    }

    console.log(`Updated DB record for session ${sessionId}, image ${imageIndex + 1}`);
    return true;
  } catch (error) {
    console.error('Failed to update image record:', error);
    return false;
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSingleRequest = await request.json();
    const {
      prompt,
      referenceImageUrl,
      imageIndex,
      totalImages,
      creativeName,
      sessionId,
      aspectRatio = "1:1",
      resolution = "1K"
    } = body;

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

    if (!creativeName) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing creativeName for storage',
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

    // Initialize Gemini with image configuration
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Configure model with image output settings
    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      generationConfig: {
        // @ts-ignore - imageConfig is supported but not in types yet
        responseModalities: ['IMAGE'],
        // @ts-ignore
        imageConfig: {
          imageSize: resolution, // "1K", "2K", or "4K"
        },
      },
    });

    // Create image prompt with variation
    const imagePrompt = `Create an advertising photograph based on this reference product image.

${prompt}

IMPORTANT INSTRUCTIONS:
- Keep the walker/rollator product EXACTLY as shown in the reference image
- Transform ONLY the background, environment, and add human elements
- This is variation ${imageIndex + 1} of ${totalImages} - make it unique
- Maintain photorealistic quality
- Professional advertising photography style
- Create a distinct scene different from other variations
- Output aspect ratio: ${aspectRatio}`;

    console.log(`Generating ${resolution} image with aspect ratio ${aspectRatio}...`);

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
          const mimeType = part.inlineData.mimeType || 'image/png';
          const base64Data = part.inlineData.data;
          const imageDataUrl = `data:${mimeType};base64,${base64Data}`;

          // Auto-save to Supabase Storage
          const storageResult = await uploadToStorage(
            base64Data,
            mimeType,
            creativeName,
            imageIndex
          );

          // Update database record if sessionId provided
          if (sessionId && storageResult) {
            await updateImageRecord(
              sessionId,
              imageIndex,
              storageResult.publicUrl,
              storageResult.storagePath
            );
          }

          return NextResponse.json<APIResponse>(
            {
              success: true,
              data: {
                imageUrl: imageDataUrl,
                imageIndex,
                storageUrl: storageResult?.publicUrl || null,
                storagePath: storageResult?.storagePath || null,
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

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
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

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
  promptVersionId?: string; // For linking image to prompt version
  aspectRatio?: string; // "1:1", "2:3", "3:2", etc.
  resolution?: string; // "1K", "2K", "4K"
  productState?: "FOLDED" | "UNFOLDED"; // Product state for scale reference
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
  storagePath: string,
  aspectRatio: string,
  resolution: string,
  promptVersionId?: string
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Build upsert data - include all fields needed for insert
    const upsertData: Record<string, unknown> = {
      session_id: sessionId,
      image_index: imageIndex + 1, // image_index is 1-based in DB
      status: 'success',
      storage_url: storageUrl,
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
      aspect_ratio: aspectRatio,
      resolution: resolution,
      mime_type: 'image/png',
      provider: 'gemini',
      retry_count: 0,
    };

    // Link to prompt version if provided
    if (promptVersionId) {
      upsertData.prompt_version_id = promptVersionId;
    }

    // UPSERT: Update if exists, INSERT if not
    // This fixes the issue where V2+ image records didn't exist
    const { error } = await supabase
      .from('generated_images_v2')
      .upsert(upsertData, {
        onConflict: 'session_id,image_index',
        ignoreDuplicates: false, // Update on conflict
      });

    if (error) {
      console.error(`[updateImageRecord] FAILED for image ${imageIndex + 1}:`, error.message);
      return false;
    }

    console.log(`[updateImageRecord] SUCCESS: session=${sessionId}, image=${imageIndex + 1}, versionId=${promptVersionId || 'none'}`);
    return true;
  } catch (error) {
    console.error('[updateImageRecord] EXCEPTION:', error);
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
      promptVersionId,
      aspectRatio = "1:1",
      resolution = "1K",
      productState = "UNFOLDED"
    } = body;

    console.log(`[generate-single] Request: imageIndex=${imageIndex}, sessionId=${sessionId}, promptVersionId=${promptVersionId || 'none'}`);

    // Build scale instruction based on product state
    // Using specific measurements instead of subjective size words for better AI interpretation
    const scaleInstruction = productState === "FOLDED"
      ? `MANDATORY SCALE CONSTRAINT:
Product Dimensions (FOLDED): Height 66cm (26 inches), Width 35cm (14 inches), Depth 27cm (10.5 inches).
Size Reference: Equivalent to a 22-inch suitcase. Similar to standard airline carry-on luggage.
Human Reference: When a person is present, the folded walker should reach approximately knee level. The walker can be easily carried with one hand like a suitcase or pulled like luggage.
DO NOT generate an oversized product.`
      : `MANDATORY SCALE CONSTRAINT:
Product Dimensions (UNFOLDED): Handle height 90cm (35 inches), Width (left-right) 62cm (24 inches), Depth (front-back) 75cm (30 inches).
Size Reference: Handle height similar to a standard kitchen counter or office desk.
Human Reference: For a 175cm (5'9") adult, the handles are at wrist height when standing upright with arms relaxed at sides. The walker frame should not exceed the user's waist/hip level.
DO NOT generate an oversized product.`;

    // Negative constraints to prevent oversized generation
    const scaleNegativePrompt = productState === "FOLDED"
      ? `AVOID: oversized product, walker taller than knee height, walker larger than 22-inch suitcase, unrealistic proportions, giant equipment.`
      : `AVOID: oversized walker, handles above wrist level, walker frame above waist level, unrealistic proportions, giant equipment.`;

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
    const imagePrompt = `Create a commercial advertising photograph based on this reference product image.

${prompt}

${scaleInstruction}

${scaleNegativePrompt}

CRITICAL INSTRUCTIONS:
1. PRODUCT PRESERVATION: The red 'Rolloy Compact Master' rollator must be rendered EXACTLY as shown in the reference image - same design, color, and components. No modifications.
2. SCALE ACCURACY: Maintain realistic proportions - the product size relative to humans must match real-world scale. Follow the MANDATORY SCALE CONSTRAINT above strictly.
3. VARIATION: This is variation ${imageIndex + 1} of ${totalImages} - create a unique scene with different camera angle, lighting, or composition.
4. ASPECT RATIO: Output in ${aspectRatio} format.
5. QUALITY: Commercial photography style, Photorealistic, Ultra high definition (UHD), professional lighting.`;

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

          // Always update database record if sessionId provided
          if (sessionId) {
            console.log(`Updating DB record: session=${sessionId}, index=${imageIndex}, ratio=${aspectRatio}, res=${resolution}, versionId=${promptVersionId || 'none'}`);
            const dbUpdated = await updateImageRecord(
              sessionId,
              imageIndex,
              storageResult?.publicUrl || '',
              storageResult?.storagePath || '',
              aspectRatio,
              resolution,
              promptVersionId
            );
            console.log(`DB update result: ${dbUpdated ? 'SUCCESS' : 'FAILED'}`);
          } else {
            console.log('WARNING: No sessionId provided, skipping DB update');
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

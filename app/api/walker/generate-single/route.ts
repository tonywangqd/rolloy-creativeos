/**
 * Rolloy Creative OS - Walker Single Image Generation API
 *
 * POST /api/walker/generate-single
 * Generates a single image for Standard Walker products
 * Uses Walker-specific scale instructions and product characteristics
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

interface GenerateWalkerSingleRequest {
  prompt: string;
  referenceImageUrl: string;
  imageIndex: number;
  totalImages: number;
  creativeName: string;
  sessionId?: string;
  promptVersionId?: string;
  aspectRatio?: string;
  resolution?: string;
  walkerState?: 'IN_USE' | 'STORED';
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
    console.warn('[Walker] Supabase not configured, skipping storage upload');
    return null;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${String(imageIndex + 1).padStart(2, '0')}.${extension}`;
    const storagePath = `generated/${creativeName}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('[Walker] Storage upload error:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    console.log(`[Walker] Image ${imageIndex + 1} saved to: ${storagePath}`);

    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: data.path,
    };
  } catch (error) {
    console.error('[Walker] Failed to upload to storage:', error);
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
    console.error('[Walker] Missing Supabase config');
    return false;
  }

  const dbImageIndex = imageIndex + 1;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const updateData: Record<string, unknown> = {
      status: 'success',
      storage_url: storageUrl,
      storage_path: storagePath,
      generated_at: new Date().toISOString(),
      aspect_ratio: aspectRatio,
      resolution: resolution,
    };

    if (promptVersionId) {
      updateData.prompt_version_id = promptVersionId;
    }

    console.log(`[Walker] Attempting UPDATE for session=${sessionId}, image=${dbImageIndex}`);

    const { data: updateResult, error: updateError } = await supabase
      .from('generated_images_v2')
      .update(updateData)
      .eq('session_id', sessionId)
      .eq('image_index', dbImageIndex)
      .select('id');

    if (updateError) {
      console.error(`[Walker] UPDATE error:`, updateError.message);
    }

    if (updateResult && updateResult.length > 0) {
      console.log(`[Walker] UPDATE SUCCESS: session=${sessionId}, image=${dbImageIndex}`);
      return true;
    }

    console.log(`[Walker] No existing record found, attempting INSERT for image=${dbImageIndex}`);

    const insertData: Record<string, unknown> = {
      session_id: sessionId,
      image_index: dbImageIndex,
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

    if (promptVersionId) {
      insertData.prompt_version_id = promptVersionId;
    }

    const { error: insertError } = await supabase
      .from('generated_images_v2')
      .insert(insertData);

    if (insertError) {
      console.error(`[Walker] INSERT FAILED:`, insertError.message);
      return false;
    }

    console.log(`[Walker] INSERT SUCCESS: session=${sessionId}, image=${dbImageIndex}`);
    return true;
  } catch (error) {
    console.error('[Walker] EXCEPTION:', error);
    return false;
  }
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateWalkerSingleRequest = await request.json();
    const {
      prompt,
      referenceImageUrl,
      imageIndex,
      totalImages,
      creativeName,
      sessionId,
      promptVersionId,
      aspectRatio = '1:1',
      resolution = '1K',
      walkerState = 'IN_USE',
    } = body;

    console.log(`[Walker] Request: imageIndex=${imageIndex}, sessionId=${sessionId}, walkerState=${walkerState}`);

    // Walker-specific scale instructions based on state
    // Standard Walker dimensions are different from Rollator
    const scaleInstruction =
      walkerState === 'STORED'
        ? `MANDATORY SCALE CONSTRAINT:
Product Dimensions (STORED/FOLDED): Height 85cm (33 inches), Width 60cm (24 inches), Depth 8cm (3 inches) when folded flat.
Size Reference: Folds flat like a large tablet or a folding chair. Can be stored behind a door or in a closet.
Human Reference: When folded and held by a person, it reaches from hip to mid-chest level. Easy to carry with one hand.
DO NOT generate an oversized product.`
        : `MANDATORY SCALE CONSTRAINT:
Product Dimensions (IN USE): Handle height 80-95cm (32-37 inches) adjustable, Width 60-65cm (24-26 inches), Depth 45-50cm (18-20 inches).
Size Reference: Handle height similar to waist to lower chest level. User stands INSIDE the frame, not behind it.
Human Reference: For a 170cm (5'7") adult, the handles are at hip to waist height. The frame opening is wide enough for the user to stand within. The two front wheels are small (12cm/5 inches diameter).
CRITICAL: This is a STANDARD WALKER (two front wheels + rear rubber tips), NOT a rollator. The user lifts it and places it forward.
DO NOT generate an oversized product.`;

    const scaleNegativePrompt =
      walkerState === 'STORED'
        ? `AVOID: oversized walker, walker larger than person's torso when folded, unrealistic proportions, giant equipment.`
        : `AVOID: oversized walker, handles above chest level, frame wider than user's arm span, unrealistic proportions, confusing with rollator (4 wheels), adding seats or brakes.`;

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

    console.log(`[Walker] Generating image ${imageIndex + 1}/${totalImages}...`);

    // Fetch reference image
    const referenceImageBase64 = await fetchImageAsBase64(referenceImageUrl);
    const mimeType = referenceImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      generationConfig: {
        // @ts-ignore - imageConfig is supported but not in types yet
        responseModalities: ['IMAGE'],
        // @ts-ignore
        imageConfig: {
          imageSize: resolution,
        },
      },
    });

    // Walker-specific image prompt
    const imagePrompt = `Create a commercial advertising photograph based on this reference product image.

${prompt}

${scaleInstruction}

${scaleNegativePrompt}

CRITICAL INSTRUCTIONS:
1. PRODUCT PRESERVATION: The standard walker must be rendered EXACTLY as shown in the reference image - aluminum frame, two front swivel wheels, rear rubber tips. No modifications.
2. SCALE ACCURACY: Maintain realistic proportions. The user stands INSIDE the walker frame (not behind it like a rollator).
3. **MANDATORY COMPOSITION - ADVERTISING SAFE ZONE** (STRICTLY ENFORCED):
   - **TOP 30% MUST BE EMPTY OF SUBJECTS**: The top 30% of the frame MUST contain ONLY background elements (walls, ceiling, windows). NEVER place ANY part of the human subject's head in this zone.
   - **FRAME THE SUBJECT LOW**: Position the entire human figure in the LOWER portion of the frame. The top of the subject's head should be at approximately 35-40% from the top.
   - **DO NOT**: Cut off the top of the head, place hair touching the top edge.
   - **DO**: Show ceiling, walls, or environmental context above the subject's head.
4. WALKER CHARACTERISTICS: This is a STANDARD WALKER (NOT a rollator):
   - Two front swivel wheels + two rear rubber tips
   - NO seat, NO brakes, NO basket
   - User performs lift-and-place gait (lifts walker, places forward, steps)
   - Simple aluminum frame design
5. VARIATION: This is variation ${imageIndex + 1} of ${totalImages} - create a unique scene with different camera angle, lighting, or composition while respecting the safe zone.
6. ASPECT RATIO: Output in ${aspectRatio} format.
7. QUALITY: Commercial photography style, Photorealistic, Ultra high definition (UHD), professional lighting.`;

    console.log(`[Walker] Generating ${resolution} image with aspect ratio ${aspectRatio}...`);

    // Generate image
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: referenceImageBase64,
        },
      },
      { text: imagePrompt },
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
          const storageResult = await uploadToStorage(base64Data, mimeType, creativeName, imageIndex);

          // Update database record if sessionId provided
          if (sessionId) {
            console.log(`[Walker] Updating DB record: session=${sessionId}, index=${imageIndex}`);
            const dbUpdated = await updateImageRecord(
              sessionId,
              imageIndex,
              storageResult?.publicUrl || '',
              storageResult?.storagePath || '',
              aspectRatio,
              resolution,
              promptVersionId
            );
            console.log(`[Walker] DB update result: ${dbUpdated ? 'SUCCESS' : 'FAILED'}`);
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
    console.log('[Walker] Gemini returned text instead of image:', textResponse.substring(0, 200));

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
    console.error('[Walker] Error in /api/walker/generate-single:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate walker image',
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

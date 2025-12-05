/**
 * Rolloy Creative OS - Image Generation API
 *
 * POST /api/generate
 * Orchestrates the complete creative generation workflow:
 * 1. Validate ABCD selection
 * 2. Generate creative naming
 * 3. Determine product state (FOLDED/UNFOLDED)
 * 4. Generate Gemini prompt
 * 5. Generate images via Flux API
 * 6. Upload to Supabase Storage
 * 7. Save metadata to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { APIResponse, ABCDSelection } from '@/lib/types';
import { validateABCDSelection, getProductState, getBaseImageUrl } from '@/lib/constants/abcd-matrix';
import { generateCreativeNaming, generateBatchImagePaths } from '@/lib/services/naming-service';
import { generatePrompt } from '@/lib/services/gemini-service';
import { generateImages, validateGenerationRequest } from '@/lib/services/flux-service';
import { uploadImagesFromUrlsInBatch } from '@/lib/supabase/client';
import { supabase } from '@/lib/supabase/client';

// ============================================================================
// Request/Response Types
// ============================================================================

interface GenerateRequest {
  selection: ABCDSelection;
  numImages?: number;
  additionalContext?: string;
  seed?: number;
}

interface GenerateResponse {
  creativeId: string;
  creativeName: string;
  productState: string;
  geminiPrompt: string;
  generatedImages: Array<{
    url: string;
    index: number;
    storagePath: string;
  }>;
  metadata: {
    totalGenerated: number;
    totalFailed: number;
    generationTime: number;
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: GenerateRequest = await request.json();
    const { selection, numImages = 20, additionalContext, seed } = body;

    // Validate ABCD selection
    const validation = validateABCDSelection(selection);
    if (!validation.valid) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_SELECTION',
            message: 'Invalid ABCD selection',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    // Generate creative naming
    const naming = generateCreativeNaming(selection);
    const productState = getProductState(selection.B);
    const baseImageUrl = getBaseImageUrl(productState);

    console.log('Generated naming:', naming);

    // Generate prompt using Gemini
    console.log('Generating prompt with Gemini...');
    const promptResponse = await generatePrompt({
      selection,
      productState,
      baseImageUrl,
      additionalContext,
    });

    console.log('Generated prompt:', promptResponse.prompt);

    // Validate generation request
    const genValidation = validateGenerationRequest({
      prompt: promptResponse.prompt,
      baseImageUrl,
      numImages,
      seed,
    });

    if (!genValidation.valid) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_GENERATION_REQUEST',
            message: 'Invalid generation parameters',
            details: genValidation.errors,
          },
        },
        { status: 400 }
      );
    }

    // Generate images using Flux
    console.log(`Generating ${numImages} images with Flux...`);
    const fluxResponse = await generateImages({
      prompt: promptResponse.prompt,
      baseImageUrl,
      numImages,
      seed,
      strength: 0.75,
    });

    console.log(
      `Generated ${fluxResponse.metadata.totalGenerated} images, ${fluxResponse.metadata.failed} failed`
    );

    // Upload images to Supabase Storage
    console.log('Uploading images to Supabase Storage...');
    const uploadTasks = fluxResponse.images.map((img) => ({
      imageUrl: img.url,
      storagePath: generateBatchImagePaths(naming)[img.index - 1],
    }));

    const uploadResults = await uploadImagesFromUrlsInBatch(uploadTasks);

    const successfulUploads = uploadResults.filter((r) => r.success);
    const failedUploads = uploadResults.filter((r) => !r.success);

    console.log(
      `Uploaded ${successfulUploads.length} images, ${failedUploads.length} failed`
    );

    // Prepare image URLs for database
    const imageUrls = successfulUploads.map((r) => r.publicUrl!);

    // Save to database
    console.log('Saving to database...');
    const { data: creativeRecord, error: dbError } = await supabase
      .from('creative_records')
      .insert({
        creative_name: naming.fullName,
        a1_tag: selection.A1,
        a2_tag: selection.A2,
        b_tag: selection.B,
        c_tag: selection.C,
        d_tag: selection.D,
        product_state: productState,
        gemini_prompt: promptResponse.prompt,
        base_image_url: baseImageUrl,
        generated_images: imageUrls,
        status: failedUploads.length === 0 ? 'completed' : 'completed',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save to database: ${dbError.message}`);
    }

    const generationTime = Date.now() - startTime;

    // Return success response
    const response: GenerateResponse = {
      creativeId: creativeRecord.id,
      creativeName: naming.fullName,
      productState,
      geminiPrompt: promptResponse.prompt,
      generatedImages: successfulUploads.map((r, idx) => ({
        url: r.publicUrl!,
        index: idx + 1,
        storagePath: r.storagePath!,
      })),
      metadata: {
        totalGenerated: successfulUploads.length,
        totalFailed: failedUploads.length + fluxResponse.metadata.failed,
        generationTime,
      },
    };

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: fluxResponse.metadata.requestId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/generate:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = getErrorCode(error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: errorCode,
          message: 'Failed to generate creative',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'GeminiAPIError') return 'GEMINI_ERROR';
    if (error.name === 'FluxAPIError') return 'FLUX_ERROR';
    if (error.name === 'StorageError') return 'STORAGE_ERROR';
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
  }
  return 'INTERNAL_ERROR';
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

// ============================================================================
// GET Handler - Get generation status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creativeId = searchParams.get('id');

    if (!creativeId) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Creative ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Fetch creative record from database
    const { data, error } = await supabase
      .from('creative_records')
      .select('*')
      .eq('id', creativeId)
      .single();

    if (error || !data) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Creative not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          id: data.id,
          creativeName: data.creative_name,
          status: data.status,
          productState: data.product_state,
          generatedImages: data.generated_images,
          geminiPrompt: data.gemini_prompt,
          abcdTags: {
            A1: data.a1_tag,
            A2: data.a2_tag,
            B: data.b_tag,
            C: data.c_tag,
            D: data.d_tag,
          },
          createdAt: data.created_at,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/generate:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch creative',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

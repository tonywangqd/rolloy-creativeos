/**
 * Rolloy Creative OS - Session Versions API
 * GET /api/sessions/{id}/versions - List all versions for a session
 * POST /api/sessions/{id}/versions - Create a new version
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listPromptVersions,
  createPromptVersion,
  getActiveVersion,
} from '@/lib/services/prompt-version-service';
import type {
  CreatePromptVersionRequest,
  ListPromptVersionsResponse,
  CreatePromptVersionResponse,
} from '@/lib/types/prompt-version';
import type { APIResponse } from '@/lib/types';

// ============================================================================
// GET - List Versions
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Fetch all versions for this session (full data including prompt)
    const versions = await listPromptVersions(sessionId);

    // Get active version ID
    const activeVersion = await getActiveVersion(sessionId);

    const response: ListPromptVersionsResponse = {
      versions: versions.map((v) => ({
        id: v.id,
        session_id: sessionId,
        version_number: v.version_number,
        prompt: v.prompt, // Include full prompt for cross-device sync
        prompt_chinese: v.prompt_chinese, // Include Chinese translation
        video_prompt: v.video_prompt, // Include video prompt
        product_state: v.product_state,
        reference_image_url: v.reference_image_url,
        created_from: v.created_from,
        is_active: v.is_active,
        created_at: v.created_at,
      })),
      active_version_id: activeVersion?.id,
    };

    return NextResponse.json<APIResponse<ListPromptVersionsResponse>>(
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
    console.error('Error in GET /api/sessions/[id]/versions:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list prompt versions',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Version
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const body = await request.json();

    // Validate required fields
    const {
      prompt,
      product_state,
      reference_image_url,
      created_from,
    } = body;

    if (!prompt || !product_state || !reference_image_url || !created_from) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields: prompt, product_state, reference_image_url, created_from',
          },
        },
        { status: 400 }
      );
    }

    // Validate product_state
    if (product_state !== 'FOLDED' && product_state !== 'UNFOLDED') {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid product_state: must be FOLDED or UNFOLDED',
          },
        },
        { status: 400 }
      );
    }

    // Validate created_from
    if (
      created_from !== 'initial' &&
      created_from !== 'refinement' &&
      created_from !== 'product_state_change'
    ) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid created_from: must be initial, refinement, or product_state_change',
          },
        },
        { status: 400 }
      );
    }

    // Create version
    const requestData: CreatePromptVersionRequest = {
      session_id: sessionId,
      prompt: body.prompt,
      prompt_chinese: body.prompt_chinese,
      product_state: body.product_state,
      reference_image_url: body.reference_image_url,
      created_from: body.created_from,
      refinement_instruction: body.refinement_instruction,
    };

    const result = await createPromptVersion(requestData);

    const response: CreatePromptVersionResponse = {
      version: result.version,
      version_number: result.version_number,
    };

    return NextResponse.json<APIResponse<CreatePromptVersionResponse>>(
      {
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/sessions/[id]/versions:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create prompt version',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

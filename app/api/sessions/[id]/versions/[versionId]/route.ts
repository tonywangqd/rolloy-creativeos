/**
 * Rolloy Creative OS - Version Detail API
 * PATCH /api/sessions/{id}/versions/{versionId} - Update version (e.g., Chinese translation, video prompt)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import type { APIResponse } from '@/lib/types';

// ============================================================================
// PATCH - Update Version (Chinese translation, video prompt)
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const sessionId = params.id;
    const versionId = params.versionId;
    const body = await request.json();

    const { prompt_chinese, video_prompt } = body;

    // At least one field must be provided
    if (prompt_chinese === undefined && video_prompt === undefined) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'At least one of prompt_chinese or video_prompt must be provided',
          },
        },
        { status: 400 }
      );
    }

    // Verify version belongs to session
    const { data: version, error: verifyError } = await supabase
      .from('prompt_versions')
      .select('id')
      .eq('id', versionId)
      .eq('session_id', sessionId)
      .single();

    if (verifyError || !version) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VERSION_NOT_FOUND',
            message: 'Version not found or does not belong to this session',
          },
        },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, string> = {};
    if (prompt_chinese !== undefined) {
      updateData.prompt_chinese = prompt_chinese;
    }
    if (video_prompt !== undefined) {
      updateData.video_prompt = video_prompt;
    }

    // Update the version
    const { data: updatedVersion, error: updateError } = await supabase
      .from('prompt_versions')
      .update(updateData)
      .eq('id', versionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update version: ${updateError.message}`);
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: { version: updatedVersion },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/sessions/[id]/versions/[versionId]:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update version',
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
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

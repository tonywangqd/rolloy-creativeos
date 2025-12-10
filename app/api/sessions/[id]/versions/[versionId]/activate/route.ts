/**
 * Rolloy Creative OS - Activate Version API
 * POST /api/sessions/{id}/versions/{versionId}/activate - Switch to a specific version
 */

import { NextRequest, NextResponse } from 'next/server';
import { activateVersion } from '@/lib/services/prompt-version-service';
import type { ActivateVersionResponse } from '@/lib/types/prompt-version';
import type { APIResponse } from '@/lib/types';

// ============================================================================
// POST - Activate Version
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const sessionId = params.id;
    const versionId = params.versionId;

    // Activate the version
    const result = await activateVersion(sessionId, versionId);

    const response: ActivateVersionResponse = {
      version: result.version,
      previous_version_id: result.previous_version_id,
    };

    return NextResponse.json<APIResponse<ActivateVersionResponse>>(
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
    console.error('Error in POST /api/sessions/[id]/versions/[versionId]/activate:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (errorMessage.includes('not found')) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VERSION_NOT_FOUND',
            message: 'Prompt version not found',
            details: errorMessage,
          },
        },
        { status: 404 }
      );
    }

    if (errorMessage.includes('does not belong')) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VERSION_OWNERSHIP_ERROR',
            message: 'Version does not belong to the specified session',
            details: errorMessage,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to activate version',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

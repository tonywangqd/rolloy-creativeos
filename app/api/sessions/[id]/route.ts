/**
 * Rolloy Creative OS - Session Detail API
 * GET /api/sessions/[id] - Get session detail
 * PATCH /api/sessions/[id] - Update session
 * DELETE /api/sessions/[id] - Delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionDetail,
  updateSession,
  deleteSession,
} from '@/lib/services/session-service';
import { SessionNotFoundError } from '@/lib/types/session';
import type { UpdateSessionRequest } from '@/lib/types/session';
import type { APIResponse } from '@/lib/types';

// ============================================================================
// GET - Get Session Detail
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Session ID is required',
          },
        },
        { status: 400 }
      );
    }

    const sessionDetail = await getSessionDetail(sessionId);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: sessionDetail,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in GET /api/sessions/[id]:', error);

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session detail',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Session
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const body: UpdateSessionRequest = await request.json();

    if (!sessionId) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Session ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['draft', 'in_progress', 'paused', 'completed', 'cancelled', 'failed'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const updatedSession = await updateSession(sessionId, body);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: updatedSession,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in PATCH /api/sessions/[id]:', error);

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: error.message,
          },
        },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update session',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete Session
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Session ID is required',
          },
        },
        { status: 400 }
      );
    }

    await deleteSession(sessionId);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: { deleted: true, session_id: sessionId },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in DELETE /api/sessions/[id]:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete session',
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
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

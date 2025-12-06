/**
 * Rolloy Creative OS - Sessions API
 * POST /api/sessions - Create new session
 * GET /api/sessions - List all sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  listSessions,
} from '@/lib/services/session-service';
import type {
  CreateSessionRequest,
  ListSessionsQuery,
  SessionStatus,
} from '@/lib/types/session';
import type { APIResponse } from '@/lib/types';

// ============================================================================
// POST - Create Session
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();

    // Validate required fields
    const {
      creative_name,
      abcd_selection,
      prompt,
      product_state,
      reference_image_url,
    } = body;

    if (!creative_name || !abcd_selection || !prompt || !product_state) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields: creative_name, abcd_selection, prompt, product_state',
          },
        },
        { status: 400 }
      );
    }

    // Validate ABCD selection structure
    if (!abcd_selection.A1 || !abcd_selection.A2 || !abcd_selection.B || !abcd_selection.C || !abcd_selection.D) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid abcd_selection: must include A1, A2, B, C, D',
          },
        },
        { status: 400 }
      );
    }

    // Validate product state
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

    // Create session
    const result = await createSession(body);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error in POST /api/sessions:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create session',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List Sessions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query: ListSessionsQuery = {
      status: searchParams.get('status') as SessionStatus | undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      sort_by: (searchParams.get('sort_by') as 'created_at' | 'updated_at' | 'started_at') || 'created_at',
      sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
      search: searchParams.get('search') || undefined,
    };

    // Validate limit
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Limit must be between 1 and 100',
          },
        },
        { status: 400 }
      );
    }

    // Fetch sessions
    const result = await listSessions(query);

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in GET /api/sessions:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list sessions',
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

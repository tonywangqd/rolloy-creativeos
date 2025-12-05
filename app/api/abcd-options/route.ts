/**
 * Rolloy Creative OS - ABCD Options API
 *
 * GET /api/abcd-options
 * Returns ABCD matrix options for frontend selection
 *
 * Query parameters:
 * - category: Filter by category (A1, A2, B, C, D)
 * - a1: Filter A2 options based on A1 selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { ABCD_MATRIX, getOptionsByCategory, getRecommendedA2Options } from '@/lib/constants/abcd-matrix';
import { APIResponse } from '@/lib/types';

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const a1Filter = searchParams.get('a1');

    // If category is specified, return only that category
    if (category) {
      const validCategories = ['A1', 'A2', 'B', 'C', 'D'];
      if (!validCategories.includes(category)) {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'INVALID_CATEGORY',
              message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            },
          },
          { status: 400 }
        );
      }

      // Handle A2 filtering based on A1
      if (category === 'A2' && a1Filter) {
        const options = getRecommendedA2Options(a1Filter);
        return NextResponse.json<APIResponse>(
          {
            success: true,
            data: {
              category: 'A2',
              options,
              filteredBy: a1Filter,
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }

      const options = getOptionsByCategory(category as any);
      return NextResponse.json<APIResponse>(
        {
          success: true,
          data: {
            category,
            options,
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    // Return full ABCD matrix
    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          matrix: ABCD_MATRIX,
          summary: {
            a1Count: ABCD_MATRIX.A.A1.length,
            a2Count: ABCD_MATRIX.A.A2.length,
            bCount: ABCD_MATRIX.B.length,
            cCount: ABCD_MATRIX.C.length,
            dCount: ABCD_MATRIX.D.length,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/abcd-options:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch ABCD options',
          details: error instanceof Error ? error.message : 'Unknown error',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

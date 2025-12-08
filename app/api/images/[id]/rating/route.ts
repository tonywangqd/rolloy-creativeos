/**
 * Rolloy Creative OS - Image Rating API
 *
 * PATCH /api/images/[id]/rating
 * Updates the rating for a specific image
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { rating } = await request.json();

    // Validate rating
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_RATING',
            message: 'Rating must be a number between 0 and 5',
          },
        },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Supabase not configured',
          },
        },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Update rating in database
    const { error } = await supabase
      .from('generated_images_v2')
      .update({ rating })
      .eq('id', id);

    if (error) {
      console.error('Failed to update rating:', error.message);
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: { id, rating },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/images/[id]/rating:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

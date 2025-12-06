/**
 * Rolloy Creative OS - ABCD Data Management API
 *
 * GET /api/abcd
 * Returns all ABCD options from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { APIResponse } from '@/lib/types';
import { ABCDOptions, ABCD_TABLES } from '@/lib/types/abcd';

// ============================================================================
// GET Handler - Fetch All ABCD Options
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Fetch all data in parallel
    const [
      sceneCategoriesResult,
      sceneDetailsResult,
      actionsResult,
      emotionsResult,
      formatsResult,
    ] = await Promise.all([
      supabase
        .from(ABCD_TABLES.SCENE_CATEGORIES)
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from(ABCD_TABLES.SCENE_DETAILS)
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from(ABCD_TABLES.ACTIONS)
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from(ABCD_TABLES.EMOTIONS)
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from(ABCD_TABLES.FORMATS)
        .select('*')
        .order('sort_order', { ascending: true }),
    ]);

    // Check for errors
    if (sceneCategoriesResult.error) {
      throw new Error(`Failed to fetch scene categories: ${sceneCategoriesResult.error.message}`);
    }
    if (sceneDetailsResult.error) {
      throw new Error(`Failed to fetch scene details: ${sceneDetailsResult.error.message}`);
    }
    if (actionsResult.error) {
      throw new Error(`Failed to fetch actions: ${actionsResult.error.message}`);
    }
    if (emotionsResult.error) {
      throw new Error(`Failed to fetch emotions: ${emotionsResult.error.message}`);
    }
    if (formatsResult.error) {
      throw new Error(`Failed to fetch formats: ${formatsResult.error.message}`);
    }

    // Construct response
    const abcdOptions: ABCDOptions = {
      sceneCategories: sceneCategoriesResult.data || [],
      sceneDetails: sceneDetailsResult.data || [],
      actions: actionsResult.data || [],
      emotions: emotionsResult.data || [],
      formats: formatsResult.data || [],
    };

    return NextResponse.json<APIResponse<ABCDOptions>>(
      {
        success: true,
        data: abcdOptions,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/abcd:', error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
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

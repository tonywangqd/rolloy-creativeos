/**
 * Rolloy Creative OS - ABCD Dimension API
 *
 * Dynamic route for managing individual ABCD dimensions
 *
 * GET    /api/abcd/[dimension] - Get all items in dimension
 * POST   /api/abcd/[dimension] - Create new item
 * PUT    /api/abcd/[dimension] - Update item
 * DELETE /api/abcd/[dimension] - Delete item
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { APIResponse } from '@/lib/types';
import {
  ABCDDimension,
  ABCD_TABLES,
  CreateABCDRequest,
  UpdateABCDRequest,
  DeleteABCDRequest,
  SceneCategory,
  SceneDetail,
  Action,
  Emotion,
  Format,
} from '@/lib/types/abcd';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get table name from dimension
 */
function getTableName(dimension: ABCDDimension): string {
  switch (dimension) {
    case 'scene-category':
      return ABCD_TABLES.SCENE_CATEGORIES;
    case 'scene-detail':
      return ABCD_TABLES.SCENE_DETAILS;
    case 'action':
      return ABCD_TABLES.ACTIONS;
    case 'emotion':
      return ABCD_TABLES.EMOTIONS;
    case 'format':
      return ABCD_TABLES.FORMATS;
    default:
      throw new Error(`Invalid dimension: ${dimension}`);
  }
}

/**
 * Validate dimension parameter
 */
function isValidDimension(dimension: string): dimension is ABCDDimension {
  return ['scene-category', 'scene-detail', 'action', 'emotion', 'format'].includes(dimension);
}

/**
 * Validate required fields for create/update
 */
function validateFields(dimension: ABCDDimension, data: any, isUpdate = false): string | null {
  const requiredFields = ['code', 'name_zh', 'ai_visual_prompt', 'sort_order'];

  // For scene-detail, category_id is required
  if (dimension === 'scene-detail') {
    requiredFields.push('category_id');
  }

  // For updates, only check provided fields
  if (isUpdate) {
    return null;
  }

  // For creates, all required fields must be present
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  return null;
}

// ============================================================================
// GET Handler - Get all items in dimension
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { dimension: string } }
) {
  try {
    const { dimension } = params;

    if (!isValidDimension(dimension)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_DIMENSION',
            message: `Invalid dimension: ${dimension}. Must be one of: scene-category, scene-detail, action, emotion, format`,
          },
        },
        { status: 400 }
      );
    }

    const tableName = getTableName(dimension);

    // Fetch all records
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          dimension,
          items: data || [],
          count: data?.length || 0,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in GET /api/abcd/${params.dimension}:`, error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch dimension data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Create new item
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { dimension: string } }
) {
  try {
    const { dimension } = params;

    if (!isValidDimension(dimension)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_DIMENSION',
            message: `Invalid dimension: ${dimension}`,
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const validationError = validateFields(dimension, body);
    if (validationError) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError,
          },
        },
        { status: 400 }
      );
    }

    const tableName = getTableName(dimension);

    // Check for duplicate code
    const { data: existingData } = await supabase
      .from(tableName)
      .select('id')
      .eq('code', body.code)
      .single();

    if (existingData) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'DUPLICATE_CODE',
            message: `An item with code "${body.code}" already exists`,
          },
        },
        { status: 409 }
      );
    }

    // Insert new record
    const { data, error } = await supabase
      .from(tableName)
      .insert(body)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          dimension,
          item: data,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`Error in POST /api/abcd/${params.dimension}:`, error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create item',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT Handler - Update item
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { dimension: string } }
) {
  try {
    const { dimension } = params;

    if (!isValidDimension(dimension)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_DIMENSION',
            message: `Invalid dimension: ${dimension}`,
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // ID is required for updates
    if (!body.id) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: id',
          },
        },
        { status: 400 }
      );
    }

    const tableName = getTableName(dimension);
    const { id, ...updateData } = body;

    // Add updated_at timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Check if code is being updated and if it's a duplicate
    if (updateData.code) {
      const { data: existingData } = await supabase
        .from(tableName)
        .select('id')
        .eq('code', updateData.code)
        .neq('id', id)
        .single();

      if (existingData) {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'DUPLICATE_CODE',
              message: `An item with code "${updateData.code}" already exists`,
            },
          },
          { status: 409 }
        );
      }
    }

    // Update record
    const { data, error } = await supabase
      .from(tableName)
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Item with id "${id}" not found`,
            },
          },
          { status: 404 }
        );
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          dimension,
          item: data,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in PUT /api/abcd/${params.dimension}:`, error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update item',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Delete item
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { dimension: string } }
) {
  try {
    const { dimension } = params;

    if (!isValidDimension(dimension)) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_DIMENSION',
            message: `Invalid dimension: ${dimension}`,
          },
        },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required parameter: id',
          },
        },
        { status: 400 }
      );
    }

    const tableName = getTableName(dimension);

    // For scene-category, check if there are dependent scene-details
    if (dimension === 'scene-category') {
      const { data: dependentDetails } = await supabase
        .from(ABCD_TABLES.SCENE_DETAILS)
        .select('id')
        .eq('category_id', id);

      if (dependentDetails && dependentDetails.length > 0) {
        return NextResponse.json<APIResponse>(
          {
            success: false,
            error: {
              code: 'CONSTRAINT_VIOLATION',
              message: `Cannot delete scene category with ${dependentDetails.length} dependent scene details`,
            },
          },
          { status: 409 }
        );
      }
    }

    // Delete record
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json<APIResponse>(
      {
        success: true,
        data: {
          dimension,
          id,
          deleted: true,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error in DELETE /api/abcd/${params.dimension}:`, error);

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete item',
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

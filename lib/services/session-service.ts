/**
 * Rolloy Creative OS - Session Service
 * Business logic for managing generation sessions
 */

import { createClient } from '@supabase/supabase-js';
import {
  SessionNotFoundError,
} from '@/lib/types/session';
import type {
  GenerationSession,
  GeneratedImage,
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionRequest,
  ListSessionsQuery,
  ListSessionsResponse,
  SessionSummary,
  SessionDetail,
  SessionStatus,
} from '@/lib/types/session';

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Initialize Supabase client
function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration is missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================================================
// Session CRUD Operations
// ============================================================================

/**
 * Create a new generation session
 */
export async function createSession(
  request: CreateSessionRequest
): Promise<CreateSessionResponse> {
  const supabase = getSupabaseClient();

  const {
    creative_name,
    description,
    abcd_selection,
    prompt,
    product_type = 'rollator', // Default for backward compatibility
    product_state,
    reference_image_url,
    total_images = 20,
    strength = 0.75,
    seed,
  } = request;

  // Step 1: Create session record
  const { data: session, error: sessionError } = await supabase
    .from('generation_sessions')
    .insert({
      creative_name,
      description,
      abcd_selection,
      prompt,
      product_type,
      product_state,
      reference_image_url,
      total_images,
      strength,
      seed,
      status: 'draft',
      generated_count: 0,
      failed_count: 0,
      retry_count: 0,
    })
    .select()
    .single();

  if (sessionError || !session) {
    throw new Error(`Failed to create session: ${sessionError?.message || 'Unknown error'}`);
  }

  // Step 2: Create image placeholder records
  const imageRecords = Array.from({ length: total_images }, (_, i) => ({
    session_id: session.id,
    image_index: i + 1,
    status: 'pending',
    mime_type: 'image/png',
    provider: 'gemini',
    retry_count: 0,
  }));

  const { data: images, error: imagesError } = await supabase
    .from('generated_images_v2')
    .insert(imageRecords)
    .select();

  if (imagesError || !images) {
    // Rollback: delete session if image creation failed
    await supabase.from('generation_sessions').delete().eq('id', session.id);
    throw new Error(`Failed to create image records: ${imagesError?.message || 'Unknown error'}`);
  }

  return {
    session: session as GenerationSession,
    images: images as GeneratedImage[],
  };
}

/**
 * Get session by ID (with summary data)
 */
export async function getSession(sessionId: string): Promise<SessionSummary> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('v_session_summary')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    throw new SessionNotFoundError(sessionId);
  }

  return data as SessionSummary;
}

/**
 * Get session detail (with all images)
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const supabase = getSupabaseClient();

  // Get session summary
  const session = await getSession(sessionId);

  // Get all images
  const { data: images, error: imagesError } = await supabase
    .from('generated_images_v2')
    .select('*')
    .eq('session_id', sessionId)
    .order('image_index', { ascending: true });

  if (imagesError) {
    throw new Error(`Failed to fetch images: ${imagesError.message}`);
  }

  return {
    ...session,
    images: (images || []) as GeneratedImage[],
  };
}

/**
 * List sessions with filtering and pagination
 */
export async function listSessions(
  query: ListSessionsQuery = {}
): Promise<ListSessionsResponse> {
  const supabase = getSupabaseClient();

  const {
    product_type,
    status,
    limit = 50,
    offset = 0,
    sort_by = 'created_at',
    sort_order = 'desc',
    search,
  } = query;

  let queryBuilder = supabase.from('v_session_summary').select('*', { count: 'exact' });

  // Apply filters
  if (product_type) {
    queryBuilder = queryBuilder.eq('product_type', product_type);
  }

  if (status) {
    queryBuilder = queryBuilder.eq('status', status);
  }

  if (search) {
    queryBuilder = queryBuilder.ilike('creative_name', `%${search}%`);
  }

  // Apply sorting
  queryBuilder = queryBuilder.order(sort_by, { ascending: sort_order === 'asc' });

  // Apply pagination
  queryBuilder = queryBuilder.range(offset, offset + limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw new Error(`Failed to list sessions: ${error.message}`);
  }

  return {
    sessions: (data || []) as SessionSummary[],
    total: count || 0,
    limit,
    offset,
  };
}

/**
 * Update session status or metadata
 */
export async function updateSession(
  sessionId: string,
  updates: UpdateSessionRequest
): Promise<GenerationSession> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('generation_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update session: ${error?.message || 'Unknown error'}`);
  }

  return data as GenerationSession;
}

/**
 * Delete session with images from storage
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Step 1: Get all images with storage paths
  const { data: images, error: fetchError } = await supabase
    .from('generated_images_v2')
    .select('storage_path')
    .eq('session_id', sessionId)
    .not('storage_path', 'is', null);

  if (fetchError) {
    console.error('Failed to fetch images for deletion:', fetchError.message);
  }

  // Step 2: Delete images from Supabase Storage
  if (images && images.length > 0) {
    const storagePaths = images
      .map((img: { storage_path: string | null }) => img.storage_path)
      .filter((path): path is string => path !== null);

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('creative-assets')
        .remove(storagePaths);

      if (storageError) {
        console.error('Failed to delete images from storage:', storageError.message);
        // Continue with deletion even if storage cleanup fails
      } else {
        console.log(`Deleted ${storagePaths.length} images from storage`);
      }
    }
  }

  // Step 3: Delete session (cascade deletes image records)
  const { error } = await supabase
    .from('generation_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

// ============================================================================
// Session State Management
// ============================================================================

/**
 * Start generation for a session
 */
export async function startGeneration(sessionId: string): Promise<GenerationSession> {
  return updateSession(sessionId, { status: 'in_progress' });
}

/**
 * Pause generation for a session
 */
export async function pauseGeneration(sessionId: string): Promise<GenerationSession> {
  return updateSession(sessionId, { status: 'paused' });
}

/**
 * Resume generation for a paused session
 */
export async function resumeGeneration(sessionId: string): Promise<GenerationSession> {
  return updateSession(sessionId, { status: 'in_progress' });
}

/**
 * Cancel generation for a session
 */
export async function cancelGeneration(sessionId: string): Promise<GenerationSession> {
  const supabase = getSupabaseClient();

  // Cancel all pending/generating images
  await supabase
    .from('generated_images_v2')
    .update({ status: 'cancelled' })
    .eq('session_id', sessionId)
    .in('status', ['pending', 'generating']);

  // Update session status
  return updateSession(sessionId, { status: 'cancelled' });
}

/**
 * Mark session as completed
 */
export async function completeSession(sessionId: string): Promise<GenerationSession> {
  return updateSession(sessionId, { status: 'completed' });
}

// ============================================================================
// Image Operations
// ============================================================================

/**
 * Get next pending image for generation
 */
export async function getNextPendingImage(
  sessionId: string
): Promise<GeneratedImage | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('generated_images_v2')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .order('image_index', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    // No pending images found
    return null;
  }

  return data as GeneratedImage;
}

/**
 * Update image status and metadata
 */
export async function updateImage(
  imageId: string,
  updates: Partial<GeneratedImage>
): Promise<GeneratedImage> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('generated_images_v2')
    .update(updates)
    .eq('id', imageId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update image: ${error?.message || 'Unknown error'}`);
  }

  return data as GeneratedImage;
}

/**
 * Mark image as generating
 */
export async function markImageAsGenerating(imageId: string): Promise<GeneratedImage> {
  return updateImage(imageId, { status: 'generating' });
}

/**
 * Mark image as success
 */
export async function markImageAsSuccess(
  imageId: string,
  storageUrl: string,
  storagePath: string,
  metadata?: Partial<GeneratedImage>
): Promise<GeneratedImage> {
  return updateImage(imageId, {
    status: 'success',
    storage_url: storageUrl,
    storage_path: storagePath,
    generated_at: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Mark image as failed
 */
export async function markImageAsFailed(
  imageId: string,
  errorMessage: string
): Promise<GeneratedImage> {
  const supabase = getSupabaseClient();

  // Get current retry count
  const { data: currentImage } = await supabase
    .from('generated_images_v2')
    .select('retry_count')
    .eq('id', imageId)
    .single();

  const retryCount = (currentImage?.retry_count || 0) + 1;

  return updateImage(imageId, {
    status: 'failed',
    error_message: errorMessage,
    retry_count: retryCount,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get session statistics
 */
export async function getSessionStatistics() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('v_session_summary')
    .select('status, id');

  if (error) {
    throw new Error(`Failed to get statistics: ${error.message}`);
  }

  const stats = {
    total: data?.length || 0,
    draft: 0,
    in_progress: 0,
    paused: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
  };

  data?.forEach((session: { status: SessionStatus }) => {
    stats[session.status] = (stats[session.status] || 0) + 1;
  });

  return stats;
}

/**
 * Check if session can be resumed
 */
export async function canResumeSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  return (
    session.status === 'paused' ||
    (session.status === 'in_progress' && session.generated_count < session.total_images)
  );
}

/**
 * Get session progress percentage
 */
export async function getSessionProgress(sessionId: string): Promise<number> {
  const session = await getSession(sessionId);
  if (session.total_images === 0) return 0;
  return Math.round((session.generated_count / session.total_images) * 100);
}

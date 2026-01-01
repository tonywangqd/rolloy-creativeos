/**
 * Rolloy Creative OS - Generation Session Types
 * TypeScript types for conversation-based generation history
 * Supports both Rollator (4-wheel) and Walker (2-wheel) products
 */

// ============================================================================
// Product Types
// ============================================================================

/**
 * Product Type - Distinguishes between different product lines
 */
export type ProductType = 'rollator' | 'walker';

/**
 * Product State - Both Rollator and Walker use the same states
 * - FOLDED: 收折状态 (folded for storage/transport)
 * - UNFOLDED: 展开使用状态 (unfolded for active use)
 */
export type ProductState = 'FOLDED' | 'UNFOLDED';

/**
 * Valid states per product type - both products use FOLDED/UNFOLDED
 */
export const VALID_PRODUCT_STATES: Record<ProductType, ProductState[]> = {
  rollator: ['FOLDED', 'UNFOLDED'],
  walker: ['FOLDED', 'UNFOLDED'],
};

/**
 * Helper to validate product state for a given product type
 */
export function isValidProductState(productType: ProductType, state: string): state is ProductState {
  return VALID_PRODUCT_STATES[productType]?.includes(state as ProductState) ?? false;
}

// ============================================================================
// Enums
// ============================================================================

export type SessionStatus =
  | 'draft'           // Session created, not started
  | 'in_progress'     // Generation in progress
  | 'paused'          // User paused generation
  | 'completed'       // All images generated
  | 'cancelled'       // User cancelled
  | 'failed';         // Generation failed

export type ImageGenerationStatus =
  | 'pending'         // Queued for generation
  | 'generating'      // Currently being generated
  | 'success'         // Successfully generated
  | 'failed'          // Generation failed
  | 'cancelled';      // Cancelled by user

// ============================================================================
// Database Models
// ============================================================================

/**
 * Generation Session - Main conversation/session record
 */
export interface GenerationSession {
  id: string;

  // Session Metadata
  creative_name: string;
  description?: string;

  // ABCD Configuration
  abcd_selection: {
    A1: string;
    A2: string;
    B: string;
    C: string;
    D: string;
  };

  // Product Configuration
  product_type: ProductType;  // 'rollator' or 'walker'
  product_state: ProductState; // Both products: FOLDED/UNFOLDED

  // Generation Parameters
  prompt: string;
  reference_image_url: string;

  // Session Status & Progress
  status: SessionStatus;
  total_images: number;
  generated_count: number;
  failed_count: number;

  // Generation Settings
  strength: number;
  seed?: number;

  // Error Tracking
  error_message?: string;
  retry_count: number;

  // Ownership & Timestamps
  created_by?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
}

/**
 * Generated Image - Individual image record
 */
export interface GeneratedImage {
  id: string;

  // Session Relationship
  session_id: string;

  // Image Index (1-based: 1, 2, 3, ..., 20)
  image_index: number;

  // Storage URLs
  storage_url?: string;
  storage_path?: string;

  // Image Metadata
  file_size?: number;
  width?: number;
  height?: number;
  mime_type: string;
  aspect_ratio?: string;  // "1:1", "16:9", "9:16", etc.
  resolution?: string;    // "1K", "2K", "4K"

  // Generation Status
  status: ImageGenerationStatus;
  error_message?: string;
  retry_count: number;

  // Generation Details
  actual_prompt?: string;
  generation_params?: {
    strength?: number;
    seed?: number;
    model?: string;
    [key: string]: any;
  };
  generation_duration_ms?: number;

  // AI Provider Info
  provider: string;
  model_version?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  generated_at?: string;
}

// ============================================================================
// View Models (for API responses)
// ============================================================================

/**
 * Session Summary - Enriched session data with calculated fields
 */
export interface SessionSummary extends GenerationSession {
  // Calculated fields
  progress_percentage: number;

  // Image counts by status
  pending_count: number;
  generating_count: number;
  success_count: number;
  failed_count_actual: number;

  // Latest image
  latest_image_url?: string;

  // Duration
  duration_seconds?: number;
}

/**
 * Session Detail - Full session with images
 */
export interface SessionDetail extends SessionSummary {
  images: GeneratedImage[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Create Session Request
 */
export interface CreateSessionRequest {
  creative_name: string;
  description?: string;
  abcd_selection: {
    A1: string;
    A2: string;
    B: string;
    C: string;
    D: string;
  };
  prompt: string;
  product_type?: ProductType;  // Default: 'rollator' (backward compatible)
  product_state: ProductState; // Both products: FOLDED/UNFOLDED
  reference_image_url: string;
  total_images?: number;      // Default: 20
  strength?: number;          // Default: 0.75
  seed?: number;
}

/**
 * Create Session Response
 */
export interface CreateSessionResponse {
  session: GenerationSession;
  images: GeneratedImage[];
}

/**
 * Update Session Request
 */
export interface UpdateSessionRequest {
  status?: SessionStatus;
  description?: string;
  error_message?: string;
}

/**
 * List Sessions Query Parameters
 */
export interface ListSessionsQuery {
  product_type?: ProductType; // Filter by product type (rollator/walker)
  status?: SessionStatus;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'started_at';
  sort_order?: 'asc' | 'desc';
  search?: string;          // Search by creative_name
}

/**
 * List Sessions Response
 */
export interface ListSessionsResponse {
  sessions: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Generation Flow Types
// ============================================================================

/**
 * Start Generation Request
 */
export interface StartGenerationRequest {
  session_id: string;
}

/**
 * Generate Next Image Request (internal)
 */
export interface GenerateNextImageRequest {
  session_id: string;
  image_id: string;
  image_index: number;
}

/**
 * Image Generation Result (internal)
 */
export interface ImageGenerationResult {
  success: boolean;
  image_id: string;
  image_index: number;
  storage_url?: string;
  storage_path?: string;
  error_message?: string;
  generation_duration_ms?: number;
}

/**
 * Session Progress Event (for real-time updates)
 */
export interface SessionProgressEvent {
  session_id: string;
  status: SessionStatus;
  generated_count: number;
  failed_count: number;
  progress_percentage: number;
  latest_image_url?: string;
  current_image_index?: number;
}

// ============================================================================
// Service Layer Types
// ============================================================================

/**
 * Session Service Options
 */
export interface SessionServiceOptions {
  auto_create_images?: boolean;    // Auto-create image records on session creation
  max_retries?: number;             // Max retry attempts per image
  retry_delay_ms?: number;          // Delay between retries
}

/**
 * Image Generation Options
 */
export interface ImageGenerationOptions {
  strength?: number;
  seed?: number;
  provider?: string;
  model_version?: string;
  timeout_ms?: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class SessionError extends Error {
  constructor(
    message: string,
    public code: string,
    public session_id?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export class SessionNotFoundError extends SessionError {
  constructor(session_id: string) {
    super(`Session not found: ${session_id}`, 'SESSION_NOT_FOUND', session_id);
    this.name = 'SessionNotFoundError';
  }
}

export class InvalidSessionStateError extends SessionError {
  constructor(session_id: string, current_status: string, expected_status: string) {
    super(
      `Invalid session state: expected ${expected_status}, got ${current_status}`,
      'INVALID_SESSION_STATE',
      session_id,
      { current_status, expected_status }
    );
    this.name = 'InvalidSessionStateError';
  }
}

export class ImageGenerationError extends SessionError {
  constructor(
    message: string,
    public session_id: string,
    public image_index: number,
    public details?: any
  ) {
    super(message, 'IMAGE_GENERATION_ERROR', session_id, details);
    this.name = 'ImageGenerationError';
  }
}

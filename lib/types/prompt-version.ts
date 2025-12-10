/**
 * Rolloy Creative OS - Prompt Version Management Types
 * TypeScript types for prompt versioning system
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Prompt Version - Immutable snapshot of a prompt
 */
export interface PromptVersion {
  id: string;
  session_id: string;

  // Version Info
  version_number: number;  // 1, 2, 3, ...

  // Prompt Content
  prompt: string;
  prompt_chinese?: string;

  // Generation Parameters (snapshot at this version)
  product_state: 'FOLDED' | 'UNFOLDED';
  reference_image_url: string;

  // Metadata
  created_from: 'initial' | 'refinement' | 'product_state_change';
  refinement_instruction?: string;  // If created via refinement, store user's instruction

  // Status
  is_active: boolean;  // Only one version can be active per session

  // Timestamps
  created_at: string;
}

/**
 * Prompt Version Summary (for UI dropdown)
 */
export interface PromptVersionSummary {
  id: string;
  version_number: number;
  prompt_preview: string;  // First 30-40 chars
  created_at: string;
  is_active: boolean;
  image_count: number;  // Number of images generated with this version
  product_state: 'FOLDED' | 'UNFOLDED';
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Create Prompt Version Request
 */
export interface CreatePromptVersionRequest {
  session_id: string;
  prompt: string;
  prompt_chinese?: string;
  product_state: 'FOLDED' | 'UNFOLDED';
  reference_image_url: string;
  created_from: 'initial' | 'refinement' | 'product_state_change';
  refinement_instruction?: string;
}

/**
 * Create Prompt Version Response
 */
export interface CreatePromptVersionResponse {
  version: PromptVersion;
  version_number: number;
}

/**
 * List Prompt Versions Response
 */
export interface ListPromptVersionsResponse {
  versions: PromptVersion[];
  active_version_id?: string;
}

/**
 * Activate Version Request
 */
export interface ActivateVersionRequest {
  session_id: string;
  version_id: string;
}

/**
 * Activate Version Response
 */
export interface ActivateVersionResponse {
  version: PromptVersion;
  previous_version_id?: string;
}

/**
 * Get Version Detail Response
 */
export interface GetVersionDetailResponse {
  version: PromptVersion;
  images: Array<{
    id: string;
    image_index: number;
    storage_url: string;
    status: string;
    rating: number;
    created_at: string;
  }>;
  image_count: number;
}

// ============================================================================
// Extended Session Types
// ============================================================================

import type { SessionDetail } from './session';

/**
 * Session Detail with Versions
 */
export interface SessionDetailWithVersions extends SessionDetail {
  prompt_versions: PromptVersion[];
  active_version?: PromptVersion;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Version Selector State
 */
export interface VersionSelectorState {
  versions: PromptVersionSummary[];
  activeVersionId: string | null;
  isLoading: boolean;
  error?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class PromptVersionError extends Error {
  constructor(
    message: string,
    public code: string,
    public session_id?: string,
    public version_id?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PromptVersionError';
  }
}

export class VersionNotFoundError extends PromptVersionError {
  constructor(version_id: string) {
    super(
      `Prompt version not found: ${version_id}`,
      'VERSION_NOT_FOUND',
      undefined,
      version_id
    );
    this.name = 'VersionNotFoundError';
  }
}

export class ActiveVersionConflictError extends PromptVersionError {
  constructor(session_id: string, message: string) {
    super(message, 'ACTIVE_VERSION_CONFLICT', session_id);
    this.name = 'ActiveVersionConflictError';
  }
}

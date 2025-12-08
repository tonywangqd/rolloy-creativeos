/**
 * Rolloy Creative OS - ABCD Data Management Types
 *
 * TypeScript interfaces for ABCD dimension data stored in Supabase
 */

// ============================================================================
// Scene Category (A1)
// ============================================================================

export interface SceneCategory {
  id: string;
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Scene Detail (A2)
// ============================================================================

export interface SceneDetail {
  id: string;
  code: string;
  name_zh: string;
  category_id: string;
  ai_visual_prompt: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Action (B)
// ============================================================================

export interface Action {
  id: string;
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  product_state: 'FOLDED' | 'UNFOLDED';  // Determines which reference image to use
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Emotion (C)
// ============================================================================

export interface Emotion {
  id: string;
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Format (D)
// ============================================================================

export interface Format {
  id: string;
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Combined Options Response
// ============================================================================

export interface ABCDOptions {
  sceneCategories: SceneCategory[];
  sceneDetails: SceneDetail[];
  actions: Action[];
  emotions: Emotion[];
  formats: Format[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export type ABCDDimension = 'scene-category' | 'scene-detail' | 'action' | 'emotion' | 'format';

export interface CreateSceneCategoryRequest {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
}

export interface CreateSceneDetailRequest {
  code: string;
  name_zh: string;
  category_id: string;
  ai_visual_prompt: string;
  sort_order: number;
}

export interface CreateActionRequest {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
}

export interface CreateEmotionRequest {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
}

export interface CreateFormatRequest {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  sort_order: number;
}

export type CreateABCDRequest =
  | CreateSceneCategoryRequest
  | CreateSceneDetailRequest
  | CreateActionRequest
  | CreateEmotionRequest
  | CreateFormatRequest;

export interface UpdateSceneCategoryRequest extends Partial<CreateSceneCategoryRequest> {
  id: string;
}

export interface UpdateSceneDetailRequest extends Partial<CreateSceneDetailRequest> {
  id: string;
}

export interface UpdateActionRequest extends Partial<CreateActionRequest> {
  id: string;
}

export interface UpdateEmotionRequest extends Partial<CreateEmotionRequest> {
  id: string;
}

export interface UpdateFormatRequest extends Partial<CreateFormatRequest> {
  id: string;
}

export type UpdateABCDRequest =
  | UpdateSceneCategoryRequest
  | UpdateSceneDetailRequest
  | UpdateActionRequest
  | UpdateEmotionRequest
  | UpdateFormatRequest;

export interface DeleteABCDRequest {
  id: string;
}

// ============================================================================
// Database Table Names
// ============================================================================

export const ABCD_TABLES = {
  SCENE_CATEGORIES: 'a_scene_category',
  SCENE_DETAILS: 'a_scene_detail',
  ACTIONS: 'b_action',
  EMOTIONS: 'c_emotion',
  FORMATS: 'd_format',
} as const;

// ============================================================================
// Type Helpers
// ============================================================================

export type ABCDEntity = SceneCategory | SceneDetail | Action | Emotion | Format;

export function isSceneCategory(entity: ABCDEntity): entity is SceneCategory {
  return 'category_id' in entity === false && 'code' in entity;
}

export function isSceneDetail(entity: ABCDEntity): entity is SceneDetail {
  return 'category_id' in entity;
}

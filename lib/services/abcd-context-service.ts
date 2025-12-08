/**
 * Rolloy Creative OS - ABCD Context Service
 *
 * Fetches AI Visual Prompt contexts from the database for all ABCD dimensions.
 * This service ensures that prompt generation uses the rich contextual data
 * stored in the database rather than generic code-based prompts.
 */

import { supabase } from '@/lib/supabase/client';
import { ABCD_TABLES } from '@/lib/types/abcd';

// ============================================================================
// Types
// ============================================================================

export interface SceneCategoryContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
}

export interface SceneDetailContext {
  code: string;
  name_zh: string;
  category_id: string;
  ai_visual_prompt: string;
}

export interface ActionContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  product_state: 'FOLDED' | 'UNFOLDED' | null;
}

export interface EmotionContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
}

export interface FormatContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
}

export interface ABCDContexts {
  sceneCategory: SceneCategoryContext | null;
  sceneDetail: SceneDetailContext | null;
  action: ActionContext | null;
  emotion: EmotionContext | null;
  format: FormatContext | null;
}

export interface ABCDSelection {
  A1: string;  // Scene Category code
  A2: string;  // Scene Detail code
  B: string;   // Action code
  C: string;   // Emotion code
  D: string;   // Format code
}

// ============================================================================
// Individual Context Fetchers
// ============================================================================

/**
 * Fetch Scene Category context from database
 */
export async function fetchSceneCategoryContext(code: string): Promise<SceneCategoryContext | null> {
  try {
    const { data, error } = await supabase
      .from(ABCD_TABLES.SCENE_CATEGORIES)
      .select('code, name_zh, ai_visual_prompt')
      .eq('code', code)
      .single();

    if (error) {
      console.warn(`Failed to fetch scene category context for ${code}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching scene category context for ${code}:`, error);
    return null;
  }
}

/**
 * Fetch Scene Detail context from database
 */
export async function fetchSceneDetailContext(code: string): Promise<SceneDetailContext | null> {
  try {
    const { data, error } = await supabase
      .from(ABCD_TABLES.SCENE_DETAILS)
      .select('code, name_zh, category_id, ai_visual_prompt')
      .eq('code', code)
      .single();

    if (error) {
      console.warn(`Failed to fetch scene detail context for ${code}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching scene detail context for ${code}:`, error);
    return null;
  }
}

/**
 * Fetch Action context from database (includes product_state)
 */
export async function fetchActionContext(code: string): Promise<ActionContext | null> {
  try {
    const { data, error } = await supabase
      .from(ABCD_TABLES.ACTIONS)
      .select('code, name_zh, ai_visual_prompt, product_state')
      .eq('code', code)
      .single();

    if (error) {
      console.warn(`Failed to fetch action context for ${code}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching action context for ${code}:`, error);
    return null;
  }
}

/**
 * Fetch Emotion context from database
 */
export async function fetchEmotionContext(code: string): Promise<EmotionContext | null> {
  try {
    const { data, error } = await supabase
      .from(ABCD_TABLES.EMOTIONS)
      .select('code, name_zh, ai_visual_prompt')
      .eq('code', code)
      .single();

    if (error) {
      console.warn(`Failed to fetch emotion context for ${code}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching emotion context for ${code}:`, error);
    return null;
  }
}

/**
 * Fetch Format context from database
 */
export async function fetchFormatContext(code: string): Promise<FormatContext | null> {
  try {
    const { data, error } = await supabase
      .from(ABCD_TABLES.FORMATS)
      .select('code, name_zh, ai_visual_prompt')
      .eq('code', code)
      .single();

    if (error) {
      console.warn(`Failed to fetch format context for ${code}:`, error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching format context for ${code}:`, error);
    return null;
  }
}

// ============================================================================
// Main Context Fetcher
// ============================================================================

/**
 * Fetch all ABCD contexts in parallel
 *
 * @param selection - The ABCD selection with codes
 * @returns ABCDContexts with all visual prompts from database
 */
export async function fetchABCDContexts(selection: ABCDSelection): Promise<ABCDContexts> {
  const startTime = Date.now();

  try {
    // Fetch all contexts in parallel for performance
    const [sceneCategory, sceneDetail, action, emotion, format] = await Promise.all([
      fetchSceneCategoryContext(selection.A1),
      fetchSceneDetailContext(selection.A2),
      fetchActionContext(selection.B),
      fetchEmotionContext(selection.C),
      fetchFormatContext(selection.D),
    ]);

    const latency = Date.now() - startTime;

    // Log success with details
    const contextsLoaded = {
      sceneCategory: !!sceneCategory?.ai_visual_prompt,
      sceneDetail: !!sceneDetail?.ai_visual_prompt,
      action: !!action?.ai_visual_prompt,
      emotion: !!emotion?.ai_visual_prompt,
      format: !!format?.ai_visual_prompt,
    };

    const loadedCount = Object.values(contextsLoaded).filter(Boolean).length;

    console.log('ABCD contexts loaded', {
      selection,
      contextsLoaded,
      loadedCount: `${loadedCount}/5`,
      productState: action?.product_state || 'N/A',
      latencyMs: latency,
    });

    if (loadedCount < 5) {
      console.warn(`Only ${loadedCount}/5 ABCD contexts loaded from database`);
    }

    return {
      sceneCategory,
      sceneDetail,
      action,
      emotion,
      format,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error('Failed to fetch ABCD contexts', {
      selection,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: latency,
    });

    // Return empty contexts on complete failure
    return {
      sceneCategory: null,
      sceneDetail: null,
      action: null,
      emotion: null,
      format: null,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get product state from action context with fallback
 */
export function getProductStateFromContext(
  actionContext: ActionContext | null,
  fallbackFn?: (code: string) => 'FOLDED' | 'UNFOLDED'
): 'FOLDED' | 'UNFOLDED' {
  if (actionContext?.product_state) {
    return actionContext.product_state;
  }

  // Log warning if we had to use fallback
  if (actionContext) {
    console.warn(`Action "${actionContext.code}" has no product_state in database, using fallback`);
  }

  // If fallback function provided, use it with the code
  if (fallbackFn && actionContext?.code) {
    return fallbackFn(actionContext.code);
  }

  // Default fallback
  return 'UNFOLDED';
}

/**
 * Check if all contexts are loaded
 */
export function areAllContextsLoaded(contexts: ABCDContexts): boolean {
  return !!(
    contexts.sceneCategory?.ai_visual_prompt &&
    contexts.sceneDetail?.ai_visual_prompt &&
    contexts.action?.ai_visual_prompt &&
    contexts.emotion?.ai_visual_prompt &&
    contexts.format?.ai_visual_prompt
  );
}

/**
 * Get loaded context count
 */
export function getLoadedContextCount(contexts: ABCDContexts): number {
  let count = 0;
  if (contexts.sceneCategory?.ai_visual_prompt) count++;
  if (contexts.sceneDetail?.ai_visual_prompt) count++;
  if (contexts.action?.ai_visual_prompt) count++;
  if (contexts.emotion?.ai_visual_prompt) count++;
  if (contexts.format?.ai_visual_prompt) count++;
  return count;
}

/**
 * Rolloy Creative OS - Prompt Version Service
 * Business logic for managing prompt versions
 */

import { supabase } from '@/lib/supabase/client';
import type {
  PromptVersion,
  PromptVersionSummary,
  CreatePromptVersionRequest,
  VersionNotFoundError,
  ActiveVersionConflictError,
} from '@/lib/types/prompt-version';
import type { GeneratedImage } from '@/lib/types/session';

// ============================================================================
// Create Version
// ============================================================================

/**
 * Create a new prompt version
 * Automatically increments version number and sets as active
 */
export async function createPromptVersion(
  data: CreatePromptVersionRequest
): Promise<{ version: PromptVersion; version_number: number }> {
  try {
    // 1. Get current max version number for this session
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('prompt_versions')
      .select('version_number')
      .eq('session_id', data.session_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxVersionError) {
      throw new Error(`Failed to get max version: ${maxVersionError.message}`);
    }

    const nextVersionNumber = (maxVersionData?.version_number || 0) + 1;

    // 2. Deactivate all existing versions (transaction will be handled by trigger)
    // Note: This is handled by the database trigger, but we do it explicitly for clarity
    const { error: deactivateError } = await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('session_id', data.session_id);

    if (deactivateError) {
      throw new Error(`Failed to deactivate versions: ${deactivateError.message}`);
    }

    // 3. Create new version (is_active = true)
    const { data: newVersion, error: insertError } = await supabase
      .from('prompt_versions')
      .insert({
        session_id: data.session_id,
        version_number: nextVersionNumber,
        prompt: data.prompt,
        prompt_chinese: data.prompt_chinese,
        product_state: data.product_state,
        reference_image_url: data.reference_image_url,
        created_from: data.created_from,
        refinement_instruction: data.refinement_instruction,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create version: ${insertError.message}`);
    }

    return {
      version: newVersion,
      version_number: nextVersionNumber,
    };
  } catch (error) {
    console.error('Error in createPromptVersion:', error);
    throw error;
  }
}

// ============================================================================
// List Versions
// ============================================================================

/**
 * List all versions for a session (ordered by version_number)
 */
export async function listPromptVersions(
  sessionId: string
): Promise<PromptVersion[]> {
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('session_id', sessionId)
      .order('version_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to list versions: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in listPromptVersions:', error);
    throw error;
  }
}

/**
 * List versions with summary info (for UI dropdown)
 */
export async function listPromptVersionsSummary(
  sessionId: string
): Promise<PromptVersionSummary[]> {
  try {
    const { data, error } = await supabase
      .from('v_prompt_version_summary')
      .select('*')
      .eq('session_id', sessionId)
      .order('version_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to list version summaries: ${error.message}`);
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      version_number: v.version_number,
      prompt_preview: v.prompt_preview,
      created_at: v.created_at,
      is_active: v.is_active,
      image_count: v.image_count,
      product_state: v.product_state,
    }));
  } catch (error) {
    console.error('Error in listPromptVersionsSummary:', error);
    throw error;
  }
}

// ============================================================================
// Get Version
// ============================================================================

/**
 * Get a specific version by ID
 */
export async function getPromptVersion(
  versionId: string
): Promise<PromptVersion> {
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Version not found: ${versionId}`);
      }
      throw new Error(`Failed to get version: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getPromptVersion:', error);
    throw error;
  }
}

/**
 * Get the active version for a session
 */
export async function getActiveVersion(
  sessionId: string
): Promise<PromptVersion | null> {
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get active version: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getActiveVersion:', error);
    throw error;
  }
}

// ============================================================================
// Activate Version
// ============================================================================

/**
 * Activate a specific version (deactivate all others)
 */
export async function activateVersion(
  sessionId: string,
  versionId: string
): Promise<{ version: PromptVersion; previous_version_id?: string }> {
  try {
    // 1. Get current active version (for return value)
    const previousActive = await getActiveVersion(sessionId);

    // 2. Verify target version exists and belongs to session
    const targetVersion = await getPromptVersion(versionId);

    if (targetVersion.session_id !== sessionId) {
      throw new Error(
        `Version ${versionId} does not belong to session ${sessionId}`
      );
    }

    // 3. Deactivate all versions in session
    const { error: deactivateError } = await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('session_id', sessionId);

    if (deactivateError) {
      throw new Error(`Failed to deactivate versions: ${deactivateError.message}`);
    }

    // 4. Activate target version
    const { data: activatedVersion, error: activateError } = await supabase
      .from('prompt_versions')
      .update({ is_active: true })
      .eq('id', versionId)
      .select()
      .single();

    if (activateError) {
      throw new Error(`Failed to activate version: ${activateError.message}`);
    }

    return {
      version: activatedVersion,
      previous_version_id: previousActive?.id,
    };
  } catch (error) {
    console.error('Error in activateVersion:', error);
    throw error;
  }
}

// ============================================================================
// Get Version Images
// ============================================================================

/**
 * Get all images generated with a specific version
 */
export async function getVersionImages(
  versionId: string
): Promise<GeneratedImage[]> {
  try {
    const { data, error } = await supabase
      .from('generated_images_v2')
      .select('*')
      .eq('prompt_version_id', versionId)
      .order('image_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to get version images: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getVersionImages:', error);
    throw error;
  }
}

/**
 * Get version detail with images
 */
export async function getVersionDetail(versionId: string): Promise<{
  version: PromptVersion;
  images: GeneratedImage[];
  image_count: number;
}> {
  try {
    const version = await getPromptVersion(versionId);
    const images = await getVersionImages(versionId);

    return {
      version,
      images,
      image_count: images.length,
    };
  } catch (error) {
    console.error('Error in getVersionDetail:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a version belongs to a session
 */
export async function verifyVersionOwnership(
  sessionId: string,
  versionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('prompt_versions')
      .select('id')
      .eq('id', versionId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('Error in verifyVersionOwnership:', error);
    return false;
  }
}

/**
 * Get version count for a session
 */
export async function getVersionCount(sessionId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('prompt_versions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to get version count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getVersionCount:', error);
    throw error;
  }
}

/**
 * Delete a specific version (admin only - not exposed to users)
 * WARNING: This will orphan images. Use with caution.
 */
export async function deletePromptVersion(versionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('prompt_versions')
      .delete()
      .eq('id', versionId);

    if (error) {
      throw new Error(`Failed to delete version: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in deletePromptVersion:', error);
    throw error;
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get version statistics for a session
 */
export async function getSessionVersionStats(sessionId: string): Promise<{
  total_versions: number;
  active_version_number: number | null;
  latest_version_number: number;
  total_images: number;
  images_by_version: Record<number, number>;
}> {
  try {
    const versions = await listPromptVersions(sessionId);
    const activeVersion = versions.find((v) => v.is_active);

    // Get image counts per version
    const { data: imageCounts, error: imageCountError } = await supabase
      .from('generated_images_v2')
      .select('prompt_version_id')
      .in(
        'prompt_version_id',
        versions.map((v) => v.id)
      );

    if (imageCountError) {
      throw new Error(`Failed to get image counts: ${imageCountError.message}`);
    }

    // Build images_by_version map
    const imagesByVersion: Record<number, number> = {};
    versions.forEach((v) => {
      const count = (imageCounts || []).filter(
        (img) => img.prompt_version_id === v.id
      ).length;
      imagesByVersion[v.version_number] = count;
    });

    return {
      total_versions: versions.length,
      active_version_number: activeVersion?.version_number || null,
      latest_version_number: Math.max(...versions.map((v) => v.version_number), 0),
      total_images: imageCounts?.length || 0,
      images_by_version: imagesByVersion,
    };
  } catch (error) {
    console.error('Error in getSessionVersionStats:', error);
    throw error;
  }
}

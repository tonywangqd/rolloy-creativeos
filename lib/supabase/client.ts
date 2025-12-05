/**
 * Rolloy Creative OS - Supabase Client Configuration
 *
 * Provides configured Supabase clients for both client-side and server-side operations
 */

import { createClient } from '@supabase/supabase-js';
import { StorageError } from '@/lib/types';

// ============================================================================
// Environment Variables Validation
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please check .env.local file.'
  );
}

// ============================================================================
// Client Instances
// ============================================================================

/**
 * Public Supabase Client (Client-side & Server-side)
 * Uses anon key with RLS enabled
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Admin Supabase Client (Server-side only)
 * Uses service role key, bypasses RLS
 * NEVER expose this client to the frontend
 */
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// ============================================================================
// Storage Utilities
// ============================================================================

const STORAGE_BUCKET = 'creative-assets';

/**
 * Upload image to Supabase Storage
 * @param file - File blob or buffer
 * @param path - Storage path (e.g., "20250129_Outdoor_Backyard_Sit_Mom-Baby_JOY/01.png")
 * @param contentType - MIME type (default: 'image/png')
 */
export async function uploadImage(
  file: Blob | Buffer | File,
  path: string,
  contentType: string = 'image/png'
): Promise<{ publicUrl: string; storagePath: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      throw new StorageError(`Failed to upload image: ${error.message}`, error);
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      publicUrl: publicUrlData.publicUrl,
      storagePath: data.path,
    };
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Unexpected error during image upload', error);
  }
}

/**
 * Upload image from URL
 * Downloads the image and uploads it to Supabase Storage
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  storagePath: string
): Promise<{ publicUrl: string; storagePath: string }> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/png';

    return await uploadImage(blob, storagePath, contentType);
  } catch (error) {
    throw new StorageError('Failed to upload image from URL', error);
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (error) {
      throw new StorageError(`Failed to delete image: ${error.message}`, error);
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Unexpected error during image deletion', error);
  }
}

/**
 * List images in a folder
 */
export async function listImages(folderPath: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folderPath);

    if (error) {
      throw new StorageError(`Failed to list images: ${error.message}`, error);
    }

    return data?.map(file => `${folderPath}/${file.name}`) || [];
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Unexpected error during image listing', error);
  }
}

/**
 * Get public URL for an image
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Create signed URL (private access)
 * @param path - Storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function createSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new StorageError(`Failed to create signed URL: ${error.message}`, error);
    }

    return data.signedUrl;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError('Unexpected error during signed URL creation', error);
  }
}

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

/**
 * Check if storage bucket exists, create if not
 * (For initial setup)
 */
export async function ensureBucketExists(): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      throw listError;
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(
        STORAGE_BUCKET,
        {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        }
      );

      if (createError) {
        throw createError;
      }

      console.log(`Created storage bucket: ${STORAGE_BUCKET}`);
    }
  } catch (error) {
    throw new StorageError('Failed to ensure bucket exists', error);
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Upload multiple images in parallel
 * @param uploads - Array of { file, path } objects
 * @returns Array of results with success/failure status
 */
export async function uploadImagesInBatch(
  uploads: Array<{ file: Blob | Buffer | File; path: string }>
): Promise<
  Array<{
    success: boolean;
    path: string;
    publicUrl?: string;
    error?: string;
  }>
> {
  const uploadPromises = uploads.map(async ({ file, path }) => {
    try {
      const result = await uploadImage(file, path);
      return {
        success: true,
        path,
        publicUrl: result.publicUrl,
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  return Promise.all(uploadPromises);
}

/**
 * Upload multiple images from URLs in parallel
 */
export async function uploadImagesFromUrlsInBatch(
  uploads: Array<{ imageUrl: string; storagePath: string }>
): Promise<
  Array<{
    success: boolean;
    storagePath: string;
    publicUrl?: string;
    error?: string;
  }>
> {
  const uploadPromises = uploads.map(async ({ imageUrl, storagePath }) => {
    try {
      const result = await uploadImageFromUrl(imageUrl, storagePath);
      return {
        success: true,
        storagePath,
        publicUrl: result.publicUrl,
      };
    } catch (error) {
      return {
        success: false,
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  return Promise.all(uploadPromises);
}

// ============================================================================
// Type Helpers
// ============================================================================

export type SupabaseClient = typeof supabase;
export type SupabaseAdminClient = typeof supabaseAdmin;

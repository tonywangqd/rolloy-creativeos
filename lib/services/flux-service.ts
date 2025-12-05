/**
 * Rolloy Creative OS - Flux API Service
 *
 * Handles image generation via Nano Banana/Flux API
 * Mode: Image-to-Image with strength 0.75
 * Batch generation: 20 images with retry logic
 */

import {
  FluxGenerationRequest,
  FluxGenerationResponse,
  FluxImage,
  FluxAPIError,
} from '@/lib/types';

// ============================================================================
// Configuration
// ============================================================================

const FLUX_API_KEY = process.env.FLUX_API_KEY;
const FLUX_API_ENDPOINT =
  process.env.FLUX_API_ENDPOINT || 'https://api.nanobanana.ai/v1/generate';

const DEFAULT_STRENGTH = 0.75;
const DEFAULT_NUM_IMAGES = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 120000; // 2 minutes per request

if (!FLUX_API_KEY) {
  throw new Error('FLUX_API_KEY is not set in environment variables');
}

// ============================================================================
// API Client
// ============================================================================

interface FluxAPIRequest {
  prompt: string;
  image_url: string;
  strength: number;
  num_outputs?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

interface FluxAPIResponse {
  images: Array<{
    url: string;
    seed?: number;
  }>;
  request_id: string;
  status: string;
}

/**
 * Make a single API request to Flux
 */
async function makeFluxRequest(
  request: FluxAPIRequest,
  timeout: number = TIMEOUT_MS
): Promise<FluxAPIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(FLUX_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FLUX_API_KEY}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new FluxAPIError(
        `Flux API request failed: ${response.status} ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          errorData,
        }
      );
    }

    const data: FluxAPIResponse = await response.json();

    if (!data.images || data.images.length === 0) {
      throw new FluxAPIError('No images returned from Flux API', data);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof FluxAPIError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FluxAPIError('Request timeout', { timeout });
    }

    throw new FluxAPIError(
      `Failed to make Flux request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}

/**
 * Make API request with retry logic
 */
async function makeFluxRequestWithRetry(
  request: FluxAPIRequest,
  retries: number = MAX_RETRIES
): Promise<FluxAPIResponse> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await makeFluxRequest(request);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < retries) {
        console.warn(
          `Flux API request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${RETRY_DELAY_MS}ms...`,
          lastError.message
        );
        await sleep(RETRY_DELAY_MS * (attempt + 1)); // Exponential backoff
      }
    }
  }

  throw new FluxAPIError(
    `Failed after ${retries + 1} attempts: ${lastError?.message}`,
    lastError
  );
}

// ============================================================================
// Main Generation Functions
// ============================================================================

/**
 * Generate images using Flux API
 * @param request - Generation request parameters
 * @returns Response with generated images
 */
export async function generateImages(
  request: FluxGenerationRequest
): Promise<FluxGenerationResponse> {
  const {
    prompt,
    baseImageUrl,
    strength = DEFAULT_STRENGTH,
    numImages = DEFAULT_NUM_IMAGES,
    seed,
  } = request;

  try {
    // Validate inputs
    if (!prompt || prompt.trim().length === 0) {
      throw new FluxAPIError('Prompt cannot be empty');
    }

    if (!baseImageUrl || !isValidUrl(baseImageUrl)) {
      throw new FluxAPIError('Invalid base image URL');
    }

    if (strength < 0 || strength > 1) {
      throw new FluxAPIError('Strength must be between 0 and 1');
    }

    const apiRequest: FluxAPIRequest = {
      prompt: prompt.trim(),
      image_url: baseImageUrl,
      strength,
      num_outputs: 1, // Generate one at a time for better control
      seed,
      guidance_scale: 7.5,
      num_inference_steps: 50,
    };

    // Generate images in batches
    const batchSize = 5; // 5 parallel requests at a time
    const totalBatches = Math.ceil(numImages / batchSize);
    const allImages: FluxImage[] = [];
    let failedCount = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchPromises: Promise<FluxAPIResponse>[] = [];
      const currentBatchSize = Math.min(
        batchSize,
        numImages - batchIndex * batchSize
      );

      // Create batch of requests
      for (let i = 0; i < currentBatchSize; i++) {
        const imageIndex = batchIndex * batchSize + i;
        const requestWithSeed = seed
          ? { ...apiRequest, seed: seed + imageIndex }
          : apiRequest;

        batchPromises.push(makeFluxRequestWithRetry(requestWithSeed));
      }

      // Execute batch in parallel
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      batchResults.forEach((result, i) => {
        const imageIndex = batchIndex * batchSize + i;

        if (result.status === 'fulfilled') {
          const apiResponse = result.value;
          apiResponse.images.forEach(img => {
            allImages.push({
              url: img.url,
              index: imageIndex + 1,
              seed: img.seed,
            });
          });
        } else {
          failedCount++;
          console.error(
            `Failed to generate image ${imageIndex + 1}:`,
            result.reason
          );
        }
      });
    }

    if (allImages.length === 0) {
      throw new FluxAPIError('All image generation requests failed');
    }

    return {
      images: allImages,
      metadata: {
        requestId: `flux_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        model: 'flux-dev',
        totalGenerated: allImages.length,
        failed: failedCount,
      },
    };
  } catch (error) {
    if (error instanceof FluxAPIError) {
      throw error;
    }

    throw new FluxAPIError(
      `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}

/**
 * Generate a single test image (for quick validation)
 */
export async function generateTestImage(
  prompt: string,
  baseImageUrl: string,
  strength: number = DEFAULT_STRENGTH
): Promise<FluxImage> {
  try {
    const response = await generateImages({
      prompt,
      baseImageUrl,
      strength,
      numImages: 1,
    });

    if (response.images.length === 0) {
      throw new FluxAPIError('No image generated');
    }

    return response.images[0];
  } catch (error) {
    throw new FluxAPIError('Test image generation failed', error);
  }
}

/**
 * Regenerate specific failed images
 * @param request - Original generation request
 * @param failedIndices - Array of failed image indices (1-based)
 */
export async function regenerateFailedImages(
  request: FluxGenerationRequest,
  failedIndices: number[]
): Promise<FluxImage[]> {
  const regeneratedImages: FluxImage[] = [];

  for (const index of failedIndices) {
    try {
      const apiRequest: FluxAPIRequest = {
        prompt: request.prompt,
        image_url: request.baseImageUrl,
        strength: request.strength || DEFAULT_STRENGTH,
        num_outputs: 1,
        seed: request.seed ? request.seed + index - 1 : undefined,
      };

      const response = await makeFluxRequestWithRetry(apiRequest);

      response.images.forEach(img => {
        regeneratedImages.push({
          url: img.url,
          index,
          seed: img.seed,
        });
      });
    } catch (error) {
      console.error(`Failed to regenerate image ${index}:`, error);
    }
  }

  return regeneratedImages;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate estimated generation time
 */
export function estimateGenerationTime(numImages: number): number {
  const avgTimePerImage = 10; // seconds
  const parallelBatchSize = 5;
  const batches = Math.ceil(numImages / parallelBatchSize);
  return batches * avgTimePerImage;
}

/**
 * Get generation progress
 */
export function calculateProgress(
  completed: number,
  total: number
): { percentage: number; remaining: number } {
  const percentage = Math.round((completed / total) * 100);
  const remaining = total - completed;

  return { percentage, remaining };
}

/**
 * Validate generation request
 */
export function validateGenerationRequest(
  request: FluxGenerationRequest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.prompt || request.prompt.trim().length === 0) {
    errors.push('Prompt is required');
  }

  if (request.prompt && request.prompt.length > 2000) {
    errors.push('Prompt is too long (max 2000 characters)');
  }

  if (!request.baseImageUrl || !isValidUrl(request.baseImageUrl)) {
    errors.push('Valid base image URL is required');
  }

  if (
    request.strength !== undefined &&
    (request.strength < 0 || request.strength > 1)
  ) {
    errors.push('Strength must be between 0 and 1');
  }

  if (request.numImages !== undefined && (request.numImages < 1 || request.numImages > 100)) {
    errors.push('Number of images must be between 1 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format API error for user display
 */
export function formatFluxError(error: FluxAPIError): string {
  if (error.details?.status === 401) {
    return 'API authentication failed. Please check your API key.';
  }

  if (error.details?.status === 429) {
    return 'Rate limit exceeded. Please try again later.';
  }

  if (error.details?.status >= 500) {
    return 'Flux API server error. Please try again later.';
  }

  if (error.message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  return error.message;
}

// ============================================================================
// Monitoring and Analytics
// ============================================================================

export interface GenerationStats {
  totalRequests: number;
  successfulImages: number;
  failedImages: number;
  averageGenerationTime: number;
  totalCost: number; // In USD
}

/**
 * Calculate generation cost
 * (Adjust pricing based on your Flux API plan)
 */
export function calculateGenerationCost(numImages: number): number {
  const costPerImage = 0.05; // $0.05 per image (example)
  return numImages * costPerImage;
}

/**
 * Log generation metrics
 */
export function logGenerationMetrics(response: FluxGenerationResponse): void {
  console.log('Generation Metrics:', {
    requestId: response.metadata.requestId,
    timestamp: response.metadata.timestamp,
    totalGenerated: response.metadata.totalGenerated,
    failed: response.metadata.failed,
    successRate: `${((response.metadata.totalGenerated / (response.metadata.totalGenerated + response.metadata.failed)) * 100).toFixed(2)}%`,
  });
}

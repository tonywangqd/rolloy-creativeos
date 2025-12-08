/**
 * Rolloy Creative OS - Gemini AI Service
 *
 * Handles both text generation (prompts) and image generation using Google Gemini API
 * Uses gemini-3-pro-preview for text and gemini-3-pro-image-preview for images
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/config/prompts';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';

// Reference images
const UNFOLDED_IMAGE_URL = process.env.NEXT_PUBLIC_UNFOLDED_IMAGE_URL || '';
const FOLDED_IMAGE_URL = process.env.NEXT_PUBLIC_FOLDED_IMAGE_URL || '';

// Config file path for system prompt
const CONFIG_FILE = path.join(process.cwd(), 'config', 'system-prompt.json');

// Get the current system prompt (from config file or default)
async function getSystemPrompt(): Promise<string> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    return config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  } catch {
    // File doesn't exist or error reading, use default
    return DEFAULT_SYSTEM_PROMPT;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ABCDSelection {
  A1: string;  // Scene Category
  A2: string;  // Scene Detail
  B: string;   // Action
  C: string;   // Driver/Characters
  D: string;   // Emotion/Format
}

export type ProductState = 'UNFOLDED' | 'FOLDED';

export interface GenerationResult {
  success: boolean;
  imageUrls: string[];
  prompt: string;
  productState: ProductState;
  referenceImageUrl: string;
  error?: string;
}

export interface PromptResult {
  prompt: string;
  productState: ProductState;
  referenceImageUrl: string;
}

export interface GeminiPromptRequest {
  selection: ABCDSelection;
  productState: ProductState;
  additionalContext?: string;
}

export interface GeminiPromptResponse {
  prompt: string;
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
  };
}

// Custom error class
export class GeminiAPIError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

// ============================================================================
// State Router - Determines product state based on Action (B)
// ============================================================================

const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold'];

export function determineProductState(action: string): ProductState {
  const normalizedAction = action.toLowerCase();

  if (UNFOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'UNFOLDED';
  }

  if (FOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'FOLDED';
  }

  // Default to UNFOLDED for unknown actions
  return 'UNFOLDED';
}

export function getReferenceImageUrl(state: ProductState): string {
  return state === 'UNFOLDED' ? UNFOLDED_IMAGE_URL : FOLDED_IMAGE_URL;
}

// ============================================================================
// System Prompt Template
// ============================================================================

// Note: SYSTEM_PROMPT is now loaded dynamically from config file
// See getSystemPrompt() function above

// ============================================================================
// Prompt Generation Functions
// ============================================================================

function buildContextString(selection: ABCDSelection, productState: ProductState): string {
  return `
Environment: ${selection.A1} setting, specifically ${selection.A2}
Action: ${selection.B}
Characters: ${selection.C}
Emotion/Mood: ${selection.D}
Product State: ${productState} (${productState === 'FOLDED' ? 'compact, portable, folded for storage/transport' : 'in-use, fully open and functional'})
`.trim();
}

function buildUserPrompt(selection: ABCDSelection, productState: ProductState): string {
  const context = buildContextString(selection, productState);

  // Scale and action guidance based on product state
  const stateGuidance = productState === 'FOLDED'
    ? `FOLDED WALKER GUIDANCE:
- The folded walker is COMPACT - only 66cm (26 inches) tall, about knee-height
- Show it being: lifted with ONE hand, placed in car trunk, carried easily, standing upright in a shipping box
- It should appear SMALL relative to the human - similar to a small carry-on suitcase
- Example actions: lifting from ground, placing in trunk, unboxing, carrying to car`
    : `UNFOLDED WALKER GUIDANCE:
- The walker reaches waist-height of a standing senior
- Senior's hands rest comfortably on the handles at hip level
- Example actions: walking with support, sitting on the seat, strolling in park, resting on seat`;

  return `Generate a DETAILED commercial advertising image prompt (150-200 words) for this scenario:

${context}

${stateGuidance}

REQUIRED PROMPT ELEMENTS (follow this structure):
1. SHOT TYPE: Start with camera angle and shot type (e.g., "A dynamic, eye-level medium shot of...")
2. SUBJECT: Describe the person in detail:
   - "realistic, older American [man/woman]"
   - Hair: specific style and color (e.g., "stylish, short silver hair", "soft, chin-length gray hair")
   - Expression: genuine emotion (e.g., "pleasant, capable expression", "joyful and genuinely surprised smile")
3. CLOTHING: Specific outfit with colors and materials (e.g., "clean, white linen button-down shirt and classic beige khaki pants")
4. ACTION: What the person is doing with the red 'Rolloy Compact Master' rollator
5. ENVIRONMENT: Detailed scene with:
   - Location (living room, park, driveway, etc.)
   - Background elements (furniture, plants, architecture)
   - Floor/ground materials
6. PRODUCT STATEMENT: Include exactly: "The 'Rolloy Compact Master' rollator shown must be rendered exactly as it appears in the provided product reference image, with absolutely no edits or changes to its design, color, or components."
7. CAMERA: Specific lens (e.g., "Captured with a 50mm prime lens")
8. LIGHTING: Time of day and light quality (e.g., "soft morning sunlight streams in from a large window")
9. QUALITY STATEMENT: End with: "The image must be in a commercial photography style. It must be Photorealistic, Ultra high definition (UHD), super clear, and feature professional, bright, and clean commercial lighting."

IMPORTANT: The product is a RED rollator. Always call it "red 'Rolloy Compact Master' rollator".

Generate the detailed prompt now as a single flowing paragraph:`;
}

/**
 * Generate prompt using Gemini API (text model)
 */
export async function generatePrompt(request: GeminiPromptRequest): Promise<GeminiPromptResponse> {
  if (!GEMINI_API_KEY) {
    throw new GeminiAPIError('GEMINI_API_KEY is not configured');
  }

  try {
    // Load system prompt from config (or use default)
    const systemPrompt = await getSystemPrompt();

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: systemPrompt,
    });

    const userPrompt = buildUserPrompt(request.selection, request.productState);
    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const prompt = response.text().trim();

    if (!prompt) {
      throw new GeminiAPIError('Gemini returned empty prompt');
    }

    return {
      prompt,
      metadata: {
        model: TEXT_MODEL,
        timestamp: new Date().toISOString(),
        tokensUsed: response.usageMetadata?.totalTokenCount,
      },
    };
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new GeminiAPIError(`Failed to generate prompt: ${errorMessage}`, error);
  }
}

// ============================================================================
// Image Generation using Gemini
// ============================================================================

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return base64;
}

/**
 * Generate a single image using Gemini's image model
 */
async function generateSingleImage(
  genAI: GoogleGenerativeAI,
  prompt: string,
  referenceImageBase64: string,
  mimeType: string,
  variationIndex: number
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

    const imagePrompt = `Create an advertising photograph based on this reference product image.

${prompt}

IMPORTANT INSTRUCTIONS:
- Keep the walker/rollator product EXACTLY as shown in the reference image
- Transform ONLY the background, environment, and add human elements
- This is variation ${variationIndex + 1}
- Maintain photorealistic quality
- Professional advertising photography style`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: referenceImageBase64
        }
      },
      { text: imagePrompt }
    ]);

    const response = await result.response;

    // Check if response contains image data
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ('inlineData' in part && part.inlineData?.data) {
          // Return as data URL
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }

    // Log if we got text instead of image
    const text = response.text?.();
    if (text) {
      console.log(`Gemini returned text instead of image (${variationIndex + 1}):`, text.substring(0, 200));
    }

    return null;
  } catch (error) {
    console.error(`Image generation error (${variationIndex + 1}):`, error);
    return null;
  }
}

/**
 * Generate multiple images using Gemini
 */
export async function generateImages(
  selection: ABCDSelection,
  numberOfImages: number = 4
): Promise<GenerationResult> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      imageUrls: [],
      prompt: '',
      productState: 'UNFOLDED',
      referenceImageUrl: UNFOLDED_IMAGE_URL,
      error: 'GEMINI_API_KEY is not configured'
    };
  }

  try {
    // Step 1: Determine product state and get reference image
    const productState = determineProductState(selection.B);
    const referenceImageUrl = getReferenceImageUrl(productState);

    // Step 2: Generate the prompt
    const promptResult = await generatePrompt({
      selection,
      productState
    });
    const prompt = promptResult.prompt;

    // Step 3: Fetch reference image as base64
    const referenceImageBase64 = await fetchImageAsBase64(referenceImageUrl);
    const mimeType = referenceImageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Step 4: Generate images
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const imageUrls: string[] = [];

    // Generate images in batches to avoid rate limiting
    const batchSize = 2;
    const batches = Math.ceil(numberOfImages / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, numberOfImages);

      const batchPromises = [];
      for (let i = startIdx; i < endIdx; i++) {
        batchPromises.push(
          generateSingleImage(genAI, prompt, referenceImageBase64, mimeType, i)
        );
      }

      const batchResults = await Promise.all(batchPromises);
      imageUrls.push(...batchResults.filter((url): url is string => url !== null));

      // Add delay between batches
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return {
      success: imageUrls.length > 0,
      imageUrls,
      prompt,
      productState,
      referenceImageUrl,
      error: imageUrls.length < numberOfImages
        ? `Only ${imageUrls.length}/${numberOfImages} images generated successfully`
        : undefined
    };

  } catch (error) {
    console.error('Image generation failed:', error);
    return {
      success: false,
      imageUrls: [],
      prompt: '',
      productState: 'UNFOLDED',
      referenceImageUrl: UNFOLDED_IMAGE_URL,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Batch Generation with Progress
// ============================================================================

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
}

export type ProgressCallback = (progress: BatchProgress) => void;

/**
 * Generate a large batch of images with progress tracking
 */
export async function generateImagesBatch(
  selection: ABCDSelection,
  numberOfImages: number = 20,
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  const progress: BatchProgress = {
    total: numberOfImages,
    completed: 0,
    failed: 0,
    percentage: 0
  };

  const updateProgress = () => {
    progress.percentage = Math.round((progress.completed + progress.failed) / progress.total * 100);
    onProgress?.(progress);
  };

  // Generate in smaller chunks
  const chunkSize = 4;
  const chunks = Math.ceil(numberOfImages / chunkSize);
  const allImageUrls: string[] = [];
  let finalPrompt = '';
  let finalState: ProductState = 'UNFOLDED';
  let finalRefUrl = UNFOLDED_IMAGE_URL;

  for (let i = 0; i < chunks; i++) {
    const remaining = numberOfImages - i * chunkSize;
    const currentChunkSize = Math.min(chunkSize, remaining);

    const result = await generateImages(selection, currentChunkSize);

    if (result.success) {
      allImageUrls.push(...result.imageUrls);
      progress.completed += result.imageUrls.length;
      progress.failed += currentChunkSize - result.imageUrls.length;
      finalPrompt = result.prompt;
      finalState = result.productState;
      finalRefUrl = result.referenceImageUrl;
    } else {
      progress.failed += currentChunkSize;
    }

    updateProgress();

    // Delay between chunks
    if (i < chunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return {
    success: allImageUrls.length > 0,
    imageUrls: allImageUrls,
    prompt: finalPrompt,
    productState: finalState,
    referenceImageUrl: finalRefUrl,
    error: progress.failed > 0 ? `${progress.failed} images failed to generate` : undefined
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export function getConfiguredModels(): { textModel: string; imageModel: string } {
  return {
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL
  };
}

/**
 * Validate prompt quality
 */
export function validatePromptQuality(prompt: string): {
  valid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 30) {
    issues.push('Prompt too short');
    score -= 20;
  }
  if (wordCount > 200) {
    issues.push('Prompt too long');
    score -= 10;
  }

  const geometryKeywords = ['dimensions', 'wheels', 'frame', 'mechanism'];
  if (geometryKeywords.some(k => prompt.toLowerCase().includes(k))) {
    issues.push('Contains product geometry');
    score -= 30;
  }

  const lightingKeywords = ['light', 'shadow', 'golden', 'soft', 'glow'];
  if (!lightingKeywords.some(k => prompt.toLowerCase().includes(k))) {
    issues.push('Missing lighting description');
    score -= 20;
  }

  return { valid: issues.length === 0, issues, score: Math.max(0, score) };
}

/**
 * Estimate token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

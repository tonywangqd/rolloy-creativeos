/**
 * Rolloy Creative OS - Walker Gemini AI Service
 *
 * Handles both text generation (prompts) and image generation using Google Gemini API
 * Specifically designed for Standard Walker (two-wheel walker) products
 *
 * Key differences from Rollator service:
 * - Walker uses FOLDED/UNFOLDED states (same as Rollator for consistency)
 * - Different size and scale constraints
 * - Different movement patterns (lift-and-place gait)
 * - No seat, no brakes
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { WALKER_DEFAULT_SYSTEM_PROMPT } from '@/lib/config/walker-prompts';
import type { ABCDContexts } from '@/lib/services/abcd-context-service';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';

// Walker-specific reference images (using same naming convention as Rollator)
const WALKER_UNFOLDED_IMAGE_URL = process.env.NEXT_PUBLIC_WALKER_UNFOLDED_IMAGE_URL || process.env.NEXT_PUBLIC_WALKER_IN_USE_IMAGE_URL || '';
const WALKER_FOLDED_IMAGE_URL = process.env.NEXT_PUBLIC_WALKER_FOLDED_IMAGE_URL || process.env.NEXT_PUBLIC_WALKER_STORED_IMAGE_URL || '';

// Config file path for walker system prompt
const WALKER_CONFIG_FILE = path.join(process.cwd(), 'config', 'walker-system-prompt.json');

// Get the current walker system prompt (from config file or default)
async function getWalkerSystemPrompt(): Promise<string> {
  try {
    const data = await fs.readFile(WALKER_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    return config.systemPrompt || WALKER_DEFAULT_SYSTEM_PROMPT;
  } catch {
    // File doesn't exist or error reading, use default
    return WALKER_DEFAULT_SYSTEM_PROMPT;
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

// Walker uses FOLDED/UNFOLDED states (same as Rollator for consistency)
export type WalkerState = 'FOLDED' | 'UNFOLDED';

export interface WalkerGenerationResult {
  success: boolean;
  imageUrls: string[];
  prompt: string;
  walkerState: WalkerState;
  referenceImageUrl: string;
  error?: string;
}

export interface WalkerPromptResult {
  prompt: string;
  walkerState: WalkerState;
  referenceImageUrl: string;
}

export interface WalkerPromptRequest {
  selection: ABCDSelection;
  walkerState: WalkerState;
  additionalContext?: string;
  contexts?: ABCDContexts;
}

export interface WalkerPromptResponse {
  prompt: string;
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
  };
}

// Custom error class
export class WalkerGeminiAPIError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'WalkerGeminiAPIError';
  }
}

// ============================================================================
// State Router - Determines walker state based on Action (B)
// ============================================================================

// UNFOLDED actions - walker is in active use, user stands inside the frame
const UNFOLDED_ACTIONS = [
  'walk', 'walking', 'step', 'stepping', 'stand', 'standing',
  'move', 'moving', 'support', 'supporting', 'exercise', 'exercising',
  'therapy', 'rehabilitation', 'rehab', 'practice', 'practicing',
  'balance', 'balancing', 'hold', 'holding', 'grip', 'gripping',
  'use', 'using', 'sit', 'turn', 'rest'
];

// FOLDED actions - walker is folded for storage/transport
const FOLDED_ACTIONS = [
  'store', 'stored', 'carry', 'carrying', 'fold', 'folded',
  'transport', 'transporting', 'pack', 'packed', 'beside',
  'lean', 'leaning', 'place', 'placed', 'corner', 'lift', 'trunk'
];

export function determineWalkerState(action: string): WalkerState {
  const normalizedAction = action.toLowerCase();

  if (FOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'FOLDED';
  }

  // Default to UNFOLDED for most actions (active use)
  return 'UNFOLDED';
}

export function getWalkerReferenceImageUrl(state: WalkerState): string {
  return state === 'UNFOLDED' ? WALKER_UNFOLDED_IMAGE_URL : WALKER_FOLDED_IMAGE_URL;
}

// ============================================================================
// Prompt Generation Functions
// ============================================================================

/**
 * Build context string for Walker using AI Visual Prompts from database
 * Falls back to codes if contexts not available
 */
function buildWalkerContextString(
  selection: ABCDSelection,
  walkerState: WalkerState,
  contexts?: ABCDContexts
): string {
  // If we have database contexts, use the rich AI Visual Prompts
  if (contexts) {
    const sceneCategoryPrompt = contexts.sceneCategory?.ai_visual_prompt || `${selection.A1} setting`;
    const sceneDetailPrompt = contexts.sceneDetail?.ai_visual_prompt || `${selection.A2} environment`;
    const actionPrompt = contexts.action?.ai_visual_prompt || `${selection.B} action`;
    const emotionPrompt = contexts.emotion?.ai_visual_prompt || `${selection.C} emotion`;
    const formatPrompt = contexts.format?.ai_visual_prompt || `${selection.D} format`;

    return `
SCENE CATEGORY (Atmosphere & Vibe):
${sceneCategoryPrompt}

SCENE DETAIL (Specific Visual Elements):
${sceneDetailPrompt}

ACTION & WALKER STATE (Movement Pattern):
${actionPrompt}

EMOTIONAL DRIVER/BARRIER (User Motivation):
${emotionPrompt}

IMAGE FORMAT (Composition & Structure):
${formatPrompt}

Walker State: ${walkerState} (${walkerState === 'FOLDED' ? 'folded flat, stored or being carried' : 'in active use, user standing within the frame'})
`.trim();
  }

  // Fallback to legacy code-only context
  console.warn('Using legacy context string - no database contexts provided');
  return `
Environment: ${selection.A1} setting, specifically ${selection.A2}
Action: ${selection.B}
Characters: ${selection.C}
Emotion/Mood: ${selection.D}
Walker State: ${walkerState} (${walkerState === 'FOLDED' ? 'folded flat, stored or being carried' : 'in active use, user standing within the frame'})
`.trim();
}

function buildWalkerUserPrompt(
  selection: ABCDSelection,
  walkerState: WalkerState,
  contexts?: ABCDContexts
): string {
  const context = buildWalkerContextString(selection, walkerState, contexts);

  // Scale and action guidance based on walker state
  const stateGuidance = walkerState === 'FOLDED'
    ? `FOLDED WALKER GUIDANCE:
- The walker is folded flat - approximately 8cm (3 inches) depth when collapsed
- Maintains same height (80-95cm) and width (60-65cm) when folded
- Can be leaned against a wall, stored in a closet, or placed in a car trunk
- Lightweight aluminum frame - easily carried with one hand
- Shows the convenience of compact storage
- Example scenes: walker leaning against wall, stored in closet corner, being placed in car trunk, carried by caregiver`
    : `UNFOLDED WALKER GUIDANCE (CRITICAL POSITIONING):
- The standard walker frame reaches waist to chest height (80-95cm / 32-37 inches)
- Frame width approximately 60-65cm (24-26 inches) - user stands INSIDE the frame
- Frame depth approximately 45-50cm (18-20 inches) front to back
- User's hands grip the handles at hip to waist level with arms slightly bent
- Two front swivel wheels (approximately 12cm / 5 inches diameter)
- Two rear rubber tips for stability - NO wheels on rear legs
- MOVEMENT PATTERN: User lifts the entire walker, places it forward, then steps into the frame
- This is "lift-and-place" gait - different from rolling a rollator
- The user should appear stable and supported, not struggling
- Aluminum frame with silver/grey metallic finish
- NO seat, NO brakes, NO basket (this is NOT a rollator)
- Example actions: carefully stepping forward with walker support, standing supported within frame, practicing walking in rehabilitation, balancing exercises`;

  // Log context usage for debugging
  const usingDatabaseContexts = !!(contexts?.sceneCategory?.ai_visual_prompt);
  console.log(`Building walker user prompt (database contexts: ${usingDatabaseContexts})`);

  return `Generate a DETAILED commercial advertising image prompt (150-200 words) for this STANDARD WALKER scenario:

${context}

${stateGuidance}

REQUIRED PROMPT ELEMENTS (follow this structure):
1. SHOT TYPE: Start with camera angle and shot type (e.g., "A supportive, eye-level medium shot of...")
2. SUBJECT: Describe the person in detail:
   - ETHNICITY: MUST be American Caucasian (white American) - this is our target customer
   - Age MUST be around 70 years old (e.g., "a 70-year-old Caucasian American woman", "a 70-year-old white American man")
   - The person should look genuinely elderly with natural signs of aging (wrinkles, age spots)
   - Hair: Natural hair for 70-year-old - salt-and-pepper, grey with hints of original color, silver-grey, or natural white
   - Expression: focused but comfortable (e.g., "determined yet relaxed expression", "concentrated but content")
3. CLOTHING: CASUAL, EVERYDAY attire - NOT formal or business wear:
   - GOOD: comfortable cardigan, cozy sweater, casual flannel shirt, soft blouse, fleece jacket
   - AVOID: suits, blazers, formal shirts, ties, business attire
4. ACTION: What the person is doing with the standard walker:
   - IMPORTANT: Standard walker uses LIFT-AND-PLACE movement - user lifts walker, places it forward, then steps
   - User stands INSIDE the walker frame, not behind it
   - Show proper hand grip on handles
5. ENVIRONMENT: Detailed scene with:
   - Location (living room, hallway, rehabilitation center, etc.)
   - Background elements (furniture, medical equipment if appropriate)
   - Floor materials (hardwood, tile, linoleum - should be flat and smooth for safety)
6. PRODUCT STATEMENT: Include exactly: "The standard walker shown must be rendered exactly as it appears in the provided product reference image, with absolutely no edits or changes to its design, color, or components. It features two front wheels, rear rubber tips, and an aluminum frame."
7. CAMERA: Specific lens (e.g., "Captured with a 50mm prime lens")
8. LIGHTING: Time of day and light quality (e.g., "bright, even indoor lighting", "soft natural light from windows")
9. QUALITY STATEMENT: End with: "The image must be in a commercial photography style. It must be Photorealistic, Ultra high definition (UHD), super clear, and feature professional, bright, and clean commercial lighting."

IMPORTANT: This is a STANDARD WALKER (two front wheels, rear rubber tips), NOT a rollator. It has NO seat, NO brakes, NO basket.

Generate the detailed prompt now as a single flowing paragraph:`;
}

/**
 * Generate prompt using Gemini API (text model) for Walker
 */
export async function generateWalkerPrompt(request: WalkerPromptRequest): Promise<WalkerPromptResponse> {
  if (!GEMINI_API_KEY) {
    throw new WalkerGeminiAPIError('GEMINI_API_KEY is not configured');
  }

  try {
    // Load walker system prompt from config (or use default)
    const systemPrompt = await getWalkerSystemPrompt();

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: systemPrompt,
    });

    // Build user prompt with database contexts if available
    const userPrompt = buildWalkerUserPrompt(
      request.selection,
      request.walkerState,
      request.contexts
    );

    // Log context usage
    const databaseContextUsed = !!(request.contexts?.sceneCategory?.ai_visual_prompt);
    console.log(`Generating walker prompt (database contexts: ${databaseContextUsed}, state: ${request.walkerState})`);

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const prompt = response.text().trim();

    if (!prompt) {
      throw new WalkerGeminiAPIError('Gemini returned empty prompt');
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
    if (error instanceof WalkerGeminiAPIError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new WalkerGeminiAPIError(`Failed to generate walker prompt: ${errorMessage}`, error);
  }
}

// ============================================================================
// Image Generation using Gemini for Walker
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
 * Generate a single walker image using Gemini's image model
 */
async function generateSingleWalkerImage(
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
- Keep the standard walker product EXACTLY as shown in the reference image
- This is a STANDARD WALKER with two front wheels and rear rubber tips - NOT a rollator
- Transform ONLY the background, environment, and add human elements
- The walker has NO seat, NO brakes, NO basket
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
      console.log(`Gemini returned text instead of walker image (${variationIndex + 1}):`, text.substring(0, 200));
    }

    return null;
  } catch (error) {
    console.error(`Walker image generation error (${variationIndex + 1}):`, error);
    return null;
  }
}

/**
 * Generate multiple walker images using Gemini
 */
export async function generateWalkerImages(
  selection: ABCDSelection,
  numberOfImages: number = 4
): Promise<WalkerGenerationResult> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      imageUrls: [],
      prompt: '',
      walkerState: 'UNFOLDED',
      referenceImageUrl: WALKER_UNFOLDED_IMAGE_URL,
      error: 'GEMINI_API_KEY is not configured'
    };
  }

  try {
    // Step 1: Determine walker state and get reference image
    const walkerState = determineWalkerState(selection.B);
    const referenceImageUrl = getWalkerReferenceImageUrl(walkerState);

    // Step 2: Generate the prompt
    const promptResult = await generateWalkerPrompt({
      selection,
      walkerState
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
          generateSingleWalkerImage(genAI, prompt, referenceImageBase64, mimeType, i)
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
      walkerState,
      referenceImageUrl,
      error: imageUrls.length < numberOfImages
        ? `Only ${imageUrls.length}/${numberOfImages} walker images generated successfully`
        : undefined
    };

  } catch (error) {
    console.error('Walker image generation failed:', error);
    return {
      success: false,
      imageUrls: [],
      prompt: '',
      walkerState: 'UNFOLDED',
      referenceImageUrl: WALKER_UNFOLDED_IMAGE_URL,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Batch Generation with Progress for Walker
// ============================================================================

export interface WalkerBatchProgress {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
}

export type WalkerProgressCallback = (progress: WalkerBatchProgress) => void;

/**
 * Generate a large batch of walker images with progress tracking
 */
export async function generateWalkerImagesBatch(
  selection: ABCDSelection,
  numberOfImages: number = 20,
  onProgress?: WalkerProgressCallback
): Promise<WalkerGenerationResult> {
  const progress: WalkerBatchProgress = {
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
  let finalState: WalkerState = 'UNFOLDED';
  let finalRefUrl = WALKER_UNFOLDED_IMAGE_URL;

  for (let i = 0; i < chunks; i++) {
    const remaining = numberOfImages - i * chunkSize;
    const currentChunkSize = Math.min(chunkSize, remaining);

    const result = await generateWalkerImages(selection, currentChunkSize);

    if (result.success) {
      allImageUrls.push(...result.imageUrls);
      progress.completed += result.imageUrls.length;
      progress.failed += currentChunkSize - result.imageUrls.length;
      finalPrompt = result.prompt;
      finalState = result.walkerState;
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
    walkerState: finalState,
    referenceImageUrl: finalRefUrl,
    error: progress.failed > 0 ? `${progress.failed} walker images failed to generate` : undefined
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function isWalkerGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export function getWalkerConfiguredModels(): { textModel: string; imageModel: string } {
  return {
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL
  };
}

/**
 * Validate walker prompt quality
 */
export function validateWalkerPromptQuality(prompt: string): {
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

  // Check for rollator-specific terms (should NOT be in walker prompts)
  const rollatorTerms = ['rollator', 'seat', 'brakes', 'basket', 'Rolloy', 'Compact Master'];
  if (rollatorTerms.some(term => prompt.toLowerCase().includes(term.toLowerCase()))) {
    issues.push('Contains rollator-specific terminology (walker should not have seat/brakes/basket)');
    score -= 40;
  }

  // Check for walker-specific terms (SHOULD be present)
  const walkerTerms = ['walker', 'rubber tips', 'front wheels', 'aluminum frame'];
  const hasWalkerTerms = walkerTerms.some(term => prompt.toLowerCase().includes(term.toLowerCase()));
  if (!hasWalkerTerms) {
    issues.push('Missing walker-specific description');
    score -= 20;
  }

  const lightingKeywords = ['light', 'shadow', 'golden', 'soft', 'glow', 'bright'];
  if (!lightingKeywords.some(k => prompt.toLowerCase().includes(k))) {
    issues.push('Missing lighting description');
    score -= 20;
  }

  return { valid: issues.length === 0, issues, score: Math.max(0, score) };
}

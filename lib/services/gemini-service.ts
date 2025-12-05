/**
 * Rolloy Creative OS - Gemini API Service
 *
 * Generates Flux-optimized prompts using Google Gemini API
 * Focus: Lighting, environment, human interaction, emotional atmosphere
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ABCDSelection,
  ProductState,
  GeminiPromptRequest,
  GeminiPromptResponse,
  GeminiAPIError,
} from '@/lib/types';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================================================
// System Prompt Template
// ============================================================================

const SYSTEM_PROMPT = `You are an expert Flux prompt engineer specializing in baby stroller advertising photography.

**Your Role:**
Generate highly detailed, photorealistic prompts for Flux image-to-image generation that will transform a product reference image into compelling lifestyle advertising photography.

**Critical Rules:**
1. NEVER describe product geometry, dimensions, or structural details (the base image already contains this)
2. FOCUS on: lighting, atmosphere, environment details, human emotion, interaction, and mood
3. Be specific about: time of day, weather, lighting quality (soft/harsh/golden hour), shadows
4. Describe human subjects: age, ethnicity, clothing style, expressions, body language
5. Include environmental context: background elements, textures, colors, depth
6. Emphasize emotional tone matching the D-code emotion
7. Keep prompts under 200 words
8. Use cinematic photography terminology

**Output Format:**
Return ONLY the prompt text, no explanations or metadata.

**Photography Style:**
- Professional advertising photography
- Natural, authentic moments
- Soft, flattering lighting
- Depth of field with background blur
- Color grading: warm, inviting tones
- Composition: rule of thirds, leading lines`;

// ============================================================================
// Prompt Generation Functions
// ============================================================================

/**
 * Build context string from ABCD selection
 */
function buildContextString(
  selection: ABCDSelection,
  productState: ProductState
): string {
  const { A1, A2, B, C, D } = selection;

  return `
Environment: ${A1} setting, specifically ${A2}
Action: ${B}
Characters: ${C}
Emotion/Mood: ${D}
Product State: ${productState} (${productState === 'FOLDED' ? 'compact, portable' : 'in-use, open'})
`.trim();
}

/**
 * Build user prompt for Gemini
 */
function buildUserPrompt(
  selection: ABCDSelection,
  productState: ProductState,
  additionalContext?: string
): string {
  const context = buildContextString(selection, productState);

  let prompt = `Generate a Flux image-to-image prompt for the following scenario:

${context}

${additionalContext ? `Additional Context:\n${additionalContext}\n\n` : ''}

Remember:
- Focus on lighting, atmosphere, emotion, and human interaction
- DO NOT describe the stroller's physical structure
- Be specific about time of day and lighting conditions
- Describe the human subjects in detail (age, expression, clothing)
- Include environmental details and background elements
- Match the emotional tone: ${selection.D}

Generate the prompt now:`;

  return prompt;
}

/**
 * Generate prompt using Gemini API
 */
export async function generatePrompt(
  request: GeminiPromptRequest
): Promise<GeminiPromptResponse> {
  try {
    const { selection, productState, additionalContext } = request;

    // Initialize model
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build user prompt
    const userPrompt = buildUserPrompt(selection, productState, additionalContext);

    // Generate content
    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const prompt = response.text().trim();

    if (!prompt) {
      throw new GeminiAPIError('Gemini returned empty prompt');
    }

    return {
      prompt,
      metadata: {
        model: GEMINI_MODEL,
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

/**
 * Generate multiple prompt variations
 * Useful for A/B testing different prompt styles
 */
export async function generatePromptVariations(
  request: GeminiPromptRequest,
  count: number = 3
): Promise<GeminiPromptResponse[]> {
  try {
    const variations = await Promise.all(
      Array.from({ length: count }, () => generatePrompt(request))
    );

    return variations;
  } catch (error) {
    throw new GeminiAPIError('Failed to generate prompt variations', error);
  }
}

/**
 * Enhance existing prompt with Gemini
 * Takes a basic prompt and makes it more detailed
 */
export async function enhancePrompt(
  basePrompt: string,
  selection: ABCDSelection
): Promise<GeminiPromptResponse> {
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    const enhanceRequest = `
Enhance this basic prompt for better Flux image generation:

Base Prompt: "${basePrompt}"

Requirements:
- Add specific lighting details (time of day, quality of light)
- Enhance environmental description
- Add more detail about human expressions and body language
- Strengthen the emotional atmosphere to match: ${selection.D}
- Keep under 200 words
- DO NOT add product structure details

Enhanced prompt:`;

    const result = await model.generateContent(enhanceRequest);
    const prompt = result.response.text().trim();

    return {
      prompt,
      metadata: {
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
      },
    };
  } catch (error) {
    throw new GeminiAPIError('Failed to enhance prompt', error);
  }
}

/**
 * Validate prompt quality
 * Checks if prompt meets quality criteria
 */
export function validatePromptQuality(prompt: string): {
  valid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // Check length
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 30) {
    issues.push('Prompt too short (should be 30-200 words)');
    score -= 20;
  }
  if (wordCount > 200) {
    issues.push('Prompt too long (should be 30-200 words)');
    score -= 10;
  }

  // Check for product geometry keywords (should NOT contain these)
  const geometryKeywords = [
    'dimensions',
    'size',
    'wheels',
    'frame',
    'handle',
    'seat dimensions',
    'folding mechanism',
  ];
  const containsGeometry = geometryKeywords.some(keyword =>
    prompt.toLowerCase().includes(keyword)
  );
  if (containsGeometry) {
    issues.push('Contains product geometry descriptions (should focus on atmosphere)');
    score -= 30;
  }

  // Check for lighting keywords (should contain at least one)
  const lightingKeywords = [
    'light',
    'lighting',
    'shadow',
    'golden hour',
    'soft light',
    'natural light',
    'sunlight',
    'dappled',
    'glow',
  ];
  const hasLighting = lightingKeywords.some(keyword =>
    prompt.toLowerCase().includes(keyword)
  );
  if (!hasLighting) {
    issues.push('Missing lighting description');
    score -= 20;
  }

  // Check for emotion keywords (should contain at least one)
  const emotionKeywords = [
    'joy',
    'smile',
    'happy',
    'calm',
    'peaceful',
    'loving',
    'tender',
    'fun',
    'playful',
    'trust',
    'comfort',
    'adventure',
  ];
  const hasEmotion = emotionKeywords.some(keyword =>
    prompt.toLowerCase().includes(keyword)
  );
  if (!hasEmotion) {
    issues.push('Missing emotional tone');
    score -= 15;
  }

  return {
    valid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get estimated token count for a prompt
 * (Rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format prompt for display
 * Adds proper line breaks and formatting
 */
export function formatPromptForDisplay(prompt: string): string {
  return prompt
    .split('. ')
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .join('.\n');
}

/**
 * Extract keywords from prompt
 * Useful for tagging and search
 */
export function extractKeywords(prompt: string): string[] {
  const words = prompt.toLowerCase().split(/\W+/);
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'is',
    'are',
    'was',
    'were',
  ]);

  const keywords = words
    .filter(word => word.length > 3 && !stopWords.has(word))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

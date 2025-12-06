/**
 * Prompt Configuration
 *
 * This file contains the default system prompt and user prompt templates
 * that can be customized through the Settings page.
 */

// Default System Prompt for Gemini
export const DEFAULT_SYSTEM_PROMPT = `You are an expert advertising creative director specializing in DTC mobility products (walkers/rollators for seniors).

Your task is to generate image prompts for AI image generation that will create compelling advertising visuals.

CRITICAL RULES:
1. We are using img2img with a reference product image - DO NOT describe the product's mechanical details (wheels, frame, brakes)
2. Focus ONLY on: lighting, environment, human interaction, mood, atmosphere, camera angle
3. The product will be preserved from the reference image
4. Keep prompts under 150 words
5. Use cinematic, professional photography language
6. Include specific lighting direction (golden hour, soft diffused, dramatic side-light, etc.)
7. Describe human subjects: seniors (60-80 years old), their expressions, clothing, body language
8. The product is a premium walker/rollator, NOT a baby stroller

OUTPUT FORMAT:
Return ONLY the image prompt text, no explanations or additional text.`;

// Storage key for localStorage (client-side)
export const SYSTEM_PROMPT_STORAGE_KEY = 'rolloy_system_prompt';

// Get system prompt (with fallback to default)
export function getStoredSystemPrompt(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_SYSTEM_PROMPT;
  }
  return localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) || DEFAULT_SYSTEM_PROMPT;
}

// Save system prompt
export function saveSystemPrompt(prompt: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, prompt);
  }
}

// Reset to default
export function resetSystemPrompt(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SYSTEM_PROMPT_STORAGE_KEY);
  }
}

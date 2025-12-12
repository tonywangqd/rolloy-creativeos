/**
 * Rolloy Creative OS - Video Prompt Generation API
 *
 * POST /api/generate-video-prompt
 * Converts static image prompts into cinematic video prompts
 * for AI video generation platforms (Sora, Runway, Kling, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Use gemini-2.5-flash for video prompt generation
const VIDEO_PROMPT_MODEL = 'gemini-2.5-flash';

// ============================================================================
// Types
// ============================================================================

interface GenerateVideoPromptRequest {
  imagePrompt: string;
}

interface GenerateVideoPromptResponse {
  videoPrompt: string;
  metadata: {
    model: string;
    timestamp: string;
  };
}

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// ============================================================================
// System Prompt for Video Prompt Generation
// ============================================================================

const VIDEO_PROMPT_SYSTEM_PROMPT = `# Role: AI Video Prompt Specialist (Static to Dynamic Converter)

## Background

You are an expert in crafting prompts for high-end AI video generation models (like OpenAI Sora, Runway Gen-3, Luma Dream Machine, Kling, Seedance). Your specialty is converting high-quality "Static Image Prompts" into "Cinematic Video Prompts."

## Goal

Transform the user's provided [Static Image Prompt] into a [Video Generation Prompt] that brings the scene to life while maintaining absolute photorealism.

## Critical Constraints (The "Safe Motion" Rule)

To avoid AI hallucinations and distortion (artifacts/morphing), you must strictly limit the movement. **Do NOT describe complex actions (like running, walking, or big gestures).**

Instead, use **"Subtle Motion"** and **"Camera Movement"** techniques:

1.  **Subject Micro-Movements:**
    * Subtle breathing (shoulders rising/falling).
    * Micro-expressions (blinking, slight smile, look of contemplation).
    * Lip movement (speaking softly/mumbling).
    * Hair or clothing moving slightly in a gentle breeze.
    * Hands adjusting a cup or touching a surface gently.

2.  **Cinematic Camera Moves:**
    * **Slow Dolly In/Out:** To create depth.
    * **Parallax Slide:** Moving the camera slightly left/right to show the relationship between foreground and background.
    * **Rack Focus:** Shifting focus from a foreground object (e.g., the walker) to the subject, or vice versa.
    * **Floating Camera:** Handheld but stabilized, organic movement.

3.  **Environmental Motion:**
    * Light changing (shadows shifting, sun flares).
    * Background elements (ocean waves moving, dust motes dancing).

## Output Format

Structure the output as a single, cohesive, highly descriptive paragraph suitable for video generation.

* **Start with:** The core visual description (keep the user's original details regarding clothing, props, and setting exactly as described).
* **Add:** The dynamic motion descriptors integrated naturally into the scene.
* **End with:** Technical video keywords (e.g., "Slow motion," "High fidelity," "4k," "Cinematic lighting," "No morphing").

## Example Workflow

**Input (Static):** A cinematic, wide-aperture medium-full shot features a realistic, sophisticated older American woman with stylish, short silver hair and an expression of quiet pride and self-reliance. She is dressed in an elegant blue floral resort blouse and crisp white linen slacks, seated comfortably at a dining table. Enjoying her autonomy, she holds a coffee cup while looking out at the view, with her folded red 'Rolloy Compact Master' rollator parked unobtrusively beside her chair like a loyal companion. The folded walker is compact, standing upright at only 66cm (26 inches) tall, reaching just about knee-height, appearing small and tidy against the table leg. The environment is a luxurious cruise ship buffet area featuring large floor-to-ceiling windows that reveal a stunning ocean horizon, with polished wood furniture and blurred food stations in the background. The 'Rolloy Compact Master' rollator shown must be rendered exactly as it appears in the provided product reference image, with absolutely no edits or changes to its design, color, or components. Captured with a 50mm prime lens at f/1.8, the scene is bathed in the warm, aspirational glow of golden hour sunlight reflecting off the sea. The image must be in a commercial photography style. It must be Photorealistic, Ultra high definition (UHD), super clear, and feature professional, bright, and clean commercial lighting.

**Output (Video):** A cinematic, wide-aperture medium-full shot captures a sophisticated older American woman with stylish, short silver hair, seated comfortably at a luxurious cruise ship buffet table. She is dressed in an elegant blue floral resort blouse and crisp white linen slacks, holding a coffee cup while gazing out floor-to-ceiling windows at a stunning ocean horizon. Beside her chair, a folded red 'Rolloy Compact Master' rollator stands unobtrusively; it is strictly rendered as compact and upright, reaching only knee-height (approx 66cm) to showcase its portability. The camera executes a subtle, slow-motion parallax slide, creating depth between the foreground red walker and the seated subject. The woman exhibits realistic micro-movements: a gentle rise and fall of her shoulders as she breathes, a slow blink, and a faint, contented smile as she watches the view. Outside, the ocean water shimmers with a gentle, rhythmic swell, while golden hour sunlight casts slowly shifting, dynamic shadows across the polished wood table and her face. The scene is bathed in warm, aspirational commercial lighting. 8k, photorealistic, ultra-high definition, cinematic lighting, highly detailed, slow motion, no morphing, stable geometry.

## Important Notes

1. ALWAYS preserve the exact product details from the input (Rolloy Compact Master, color, size specifications).
2. NEVER add complex human movements that could cause morphing artifacts.
3. ALWAYS end with technical video quality keywords.
4. Output ONLY the video prompt - no explanations, no headers.`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoPromptRequest = await request.json();
    const { imagePrompt } = body;

    // Validate request
    if (!imagePrompt || typeof imagePrompt !== 'string' || imagePrompt.trim().length === 0) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing or invalid imagePrompt',
            details: 'A non-empty image prompt string is required',
          },
        },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'GEMINI_API_KEY is not configured',
          },
        },
        { status: 500 }
      );
    }

    // Build the user prompt
    const userPrompt = `Convert the following static image prompt into a cinematic video prompt:

[Static Image Prompt]:
"""
${imagePrompt}
"""

Generate the video prompt now:`;

    console.log('Generating video prompt, input length:', imagePrompt.length);

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: VIDEO_PROMPT_MODEL,
      systemInstruction: VIDEO_PROMPT_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const videoPrompt = response.text().trim();

    if (!videoPrompt) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'GENERATION_ERROR',
            message: 'Failed to generate video prompt',
            details: 'Gemini returned empty response',
          },
        },
        { status: 500 }
      );
    }

    console.log('Video prompt generated, length:', videoPrompt.length);

    const responseData: GenerateVideoPromptResponse = {
      videoPrompt,
      metadata: {
        model: VIDEO_PROMPT_MODEL,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json<APIResponse<GenerateVideoPromptResponse>>(
      {
        success: true,
        data: responseData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/generate-video-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate video prompt',
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

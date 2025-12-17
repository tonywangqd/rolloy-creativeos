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
// Use gemini-3-pro-image-preview for video prompt generation
const VIDEO_PROMPT_MODEL = 'gemini-3-pro-image-preview';

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

Transform the user's provided [Static Image Prompt] into a [Video Generation Prompt] that brings the scene to life with **natural, lifelike human motion** while maintaining photorealism. The subject should feel alive and engaged, not frozen like a statue.

## Motion Guidelines

### AVOID (High Morphing Risk):
- Walking, running, or any locomotion
- Standing up or sitting down
- Large arm swings or dramatic gestures
- Full-body turns or spins
- Jumping or any athletic movements

### ENCOURAGED - Simple Active Movements (Low Morphing Risk):
**Choose 2-3 contextually appropriate actions from these categories:**

1. **Head & Gaze Movements:**
   * Turning head to look at something/someone
   * Looking up or down naturally
   * Nodding gently in thought or agreement
   * Tilting head slightly with curiosity

2. **Hand & Arm Actions (Context-Specific):**
   * Lifting a cup/glass to take a sip, then setting it down
   * Turning pages of a book or magazine
   * Picking up and checking a phone briefly
   * Gesturing naturally while speaking
   * Adjusting glasses or touching face thoughtfully
   * Waving gently to someone
   * Pointing at something in the distance

3. **Upper Body Expression:**
   * Leaning forward with interest
   * Settling back comfortably in chair
   * Shrugging shoulders lightly
   * Reaching for a nearby object

4. **Facial Animation:**
   * Speaking or conversing naturally
   * Genuine smiling or laughing softly
   * Expressions of wonder, contentment, or mild surprise
   * Natural blinking patterns

5. **Subtle Background Movements:**
   * Breathing (visible shoulder/chest movement)
   * Hair or clothing responding to breeze
   * Fingers tapping or fidgeting naturally

### Cinematic Camera Techniques:
* **Gentle Dolly In/Out:** To create depth and intimacy
* **Parallax Slide:** Subtle left/right movement revealing spatial relationships
* **Rack Focus:** Shifting focus between product and subject
* **Floating Camera:** Organic, stabilized handheld feel

### Environmental Motion:
* Dynamic lighting (shadows moving, light rays shifting)
* Background activity (waves, leaves, people walking distantly)
* Atmospheric elements (steam rising, dust motes, fabric rippling)

## Output Format

Structure the output as a single, cohesive, highly descriptive paragraph suitable for video generation.

* **Start with:** The core visual description (preserve exact clothing, props, and setting details from input).
* **Add:** 2-3 natural human actions appropriate to the scene context, integrated smoothly.
* **Include:** Camera movement and environmental motion.
* **End with:** Technical keywords. **IMPORTANT: Do NOT use "slow motion" - keep natural, real-time speed.**

## Example Workflow

**Input (Static):** A cinematic, wide-aperture medium-full shot features a realistic, sophisticated older American woman with stylish, short silver hair and an expression of quiet pride and self-reliance. She is dressed in an elegant blue floral resort blouse and crisp white linen slacks, seated comfortably at a dining table. Enjoying her autonomy, she holds a coffee cup while looking out at the view, with her folded red 'Rolloy Compact Master' rollator parked unobtrusively beside her chair like a loyal companion. The folded walker is compact, standing upright at only 66cm (26 inches) tall, reaching just about knee-height, appearing small and tidy against the table leg. The environment is a luxurious cruise ship buffet area featuring large floor-to-ceiling windows that reveal a stunning ocean horizon, with polished wood furniture and blurred food stations in the background. The 'Rolloy Compact Master' rollator shown must be rendered exactly as it appears in the provided product reference image, with absolutely no edits or changes to its design, color, or components. Captured with a 50mm prime lens at f/1.8, the scene is bathed in the warm, aspirational glow of golden hour sunlight reflecting off the sea. The image must be in a commercial photography style. It must be Photorealistic, Ultra high definition (UHD), super clear, and feature professional, bright, and clean commercial lighting.

**Output (Video):** A cinematic, wide-aperture medium-full shot captures a sophisticated older American woman with stylish, short silver hair, seated comfortably at a luxurious cruise ship buffet table. She is dressed in an elegant blue floral resort blouse and crisp white linen slacks. Beside her chair, a folded red 'Rolloy Compact Master' rollator stands unobtrusively, rendered as compact and upright at knee-height (approx 66cm) to showcase its portability. The woman lifts her coffee cup to her lips and takes a gentle sip, then lowers it while turning her head to gaze out the floor-to-ceiling windows at the stunning ocean horizon. A warm, contented smile spreads across her face as she watches the view, her eyes crinkling with quiet satisfaction. She glances down briefly at a magazine on the table, then looks back up at the sea. The camera executes a subtle parallax slide, revealing the depth between the foreground red walker and the seated subject. Outside, the ocean water shimmers with rhythmic swells, while golden hour sunlight casts warm, shifting rays across the polished wood table and illuminates her silver hair. Her blouse ripples gently in the soft breeze from an unseen vent. The scene is bathed in aspirational commercial lighting. 8k, photorealistic, ultra-high definition, cinematic lighting, highly detailed, natural motion, lifelike movement, no morphing, stable geometry.

## Important Notes

1. ALWAYS preserve exact product details from the input (Rolloy Compact Master, color, size specifications).
2. ALWAYS include 2-3 natural human actions appropriate to the scene - the subject must feel ALIVE.
3. NEVER add locomotion or large body movements that cause morphing.
4. ALWAYS end with technical video quality keywords.
5. Output ONLY the video prompt - no explanations, no headers.`;

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

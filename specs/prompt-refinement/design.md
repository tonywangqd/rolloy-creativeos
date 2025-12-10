# Prompt Refinement Feature - Technical Design

## Overview

基于用户需求，设计一个Prompt微调功能，允许用户在已生成Prompt后，通过输入自然语言的调整意图，让AI对Prompt进行局部修改，同时保持原有ABCD选择、产品状态等配置不变。

## System Architecture

### 1. Schema Design

由于微调是短期会话内的操作，不需要持久化存储微调历史，因此**不需要新增数据表**。微调后的Prompt直接更新到现有的Session记录中。

### 2. API Endpoint Design

#### 2.1 New Endpoint: `/api/refine-prompt`

**Purpose:** 接收用户的微调意图，调用Gemini对现有Prompt进行局部调整

**Method:** `POST`

**Request Schema:**
```typescript
interface RefinePromptRequest {
  // Original context (for Gemini to understand)
  originalPrompt: string;           // Current prompt text
  selection: ABCDSelection;         // ABCD selection (for context)
  productState: 'FOLDED' | 'UNFOLDED';

  // Refinement input
  refinementInstruction: string;    // User's natural language instruction

  // Optional: Session tracking
  sessionId?: string;               // For updating session if needed
}
```

**Response Schema:**
```typescript
interface RefinePromptResponse {
  success: boolean;
  data?: {
    refinedPrompt: string;          // The new refined prompt
    changes: string;                 // AI's explanation of what changed
    metadata: {
      model: string;
      timestamp: string;
      tokensUsed?: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}
```

**Error Codes:**
- `INVALID_REQUEST`: Missing required fields
- `EMPTY_INSTRUCTION`: Refinement instruction is empty
- `GEMINI_API_ERROR`: Gemini API call failed
- `INTERNAL_ERROR`: Unexpected server error

### 3. Gemini Service Extension

#### 3.1 New Function: `refinePrompt()`

**Location:** `/lib/services/gemini-service.ts`

**Function Signature:**
```typescript
export interface PromptRefinementRequest {
  originalPrompt: string;
  refinementInstruction: string;
  selection: ABCDSelection;
  productState: ProductState;
  contexts?: ABCDContexts;  // Optional: for context awareness
}

export interface PromptRefinementResponse {
  refinedPrompt: string;
  changes: string;  // AI's summary of what changed
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
  };
}

export async function refinePrompt(
  request: PromptRefinementRequest
): Promise<PromptRefinementResponse>
```

**System Prompt for Refinement:**
```typescript
const REFINEMENT_SYSTEM_PROMPT = `You are an expert prompt refinement assistant for advertising photography.

Your task is to MODIFY an existing image prompt based on user's refinement instructions, while preserving:
1. The overall structure and style of the original prompt
2. Critical product information (the red 'Rolloy Compact Master' rollator)
3. Product state (FOLDED or UNFOLDED) unless explicitly changed
4. Required technical statements (product rendering statement, quality statement)
5. Professional advertising photography tone

INSTRUCTIONS:
- Only modify the parts that user specifically wants to change
- If user says "make woman younger", ONLY change age-related descriptions
- If user says "change location to park", ONLY change environment/location
- Maintain the 150-200 word length
- Keep the same structural flow (shot type → subject → clothing → action → environment → camera → lighting → quality)
- NEVER remove the product rendering statement or quality statement

OUTPUT:
Return TWO sections separated by "---CHANGES---":
1. The refined prompt (complete, ready to use)
2. A brief summary of what was changed (1-2 sentences)

Example Output:
A dynamic, eye-level medium shot... [complete refined prompt here]

---CHANGES---
Changed subject from woman in 70s to woman in 50s, updated hair description from "silver" to "auburn with subtle highlights".
`;
```

**User Prompt Template:**
```typescript
function buildRefinementUserPrompt(
  originalPrompt: string,
  refinementInstruction: string,
  productState: ProductState,
  selection: ABCDSelection
): string {
  return `ORIGINAL PROMPT:
${originalPrompt}

PRODUCT STATE: ${productState}
ABCD CONTEXT: ${selection.A1} / ${selection.A2} / ${selection.B} / ${selection.C} / ${selection.D}

USER REFINEMENT INSTRUCTION:
${refinementInstruction}

Please refine the prompt according to the user's instruction, keeping everything else intact.`;
}
```

### 4. Frontend UI Design

#### 4.1 UI Location

在**生成阶段（step === "generate"）** 的Prompt面板中添加微调功能，位置在Prompt文本框下方。

#### 4.2 Component Structure

```typescript
// Add to page.tsx state
const [refinementInput, setRefinementInput] = useState("");
const [isRefining, setIsRefining] = useState(false);
```

#### 4.3 UI Layout (in Prompt Panel)

在 `/app/page.tsx` 的 `isPromptPanelOpen` 区域，添加以下UI（位于Textarea下方）：

```tsx
{/* Refinement Section - NEW */}
<div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border/50">
  <label className="text-sm font-medium flex items-center gap-2">
    <Sparkles className="h-4 w-4" />
    Refine Prompt with AI
  </label>
  <div className="flex gap-2">
    <Textarea
      value={refinementInput}
      onChange={(e) => setRefinementInput(e.target.value)}
      placeholder="例如: 让这个woman是她自己在做美甲 / 把场景改成公园 / 让人物更年轻..."
      rows={2}
      className="flex-1 text-sm"
      disabled={isRefining}
    />
    <Button
      onClick={handleRefinePrompt}
      disabled={isRefining || !refinementInput.trim() || !editedPrompt}
      className="self-end"
    >
      {isRefining ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Refining...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Refine
        </>
      )}
    </Button>
  </div>
  {/* Show AI's change summary after refinement */}
  {lastRefinementChanges && (
    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
      <strong>AI Modified:</strong> {lastRefinementChanges}
    </div>
  )}
</div>
```

#### 4.4 Frontend Handler Function

```typescript
// Add to page.tsx
const [lastRefinementChanges, setLastRefinementChanges] = useState("");

const handleRefinePrompt = async () => {
  if (!refinementInput.trim() || !editedPrompt) return;

  setIsRefining(true);
  setError("");

  try {
    const response = await fetch("/api/refine-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPrompt: editedPrompt,
        selection: {
          A1: selection.sceneCategory,
          A2: selection.sceneDetail,
          B: selection.action,
          C: selection.driver,
          D: selection.format,
        },
        productState,
        refinementInstruction: refinementInput,
        sessionId: currentSessionId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setEditedPrompt(data.data.refinedPrompt);
      setLastRefinementChanges(data.data.changes);
      setRefinementInput(""); // Clear input after success

      // Optional: Auto-update session with refined prompt
      if (currentSessionId) {
        await fetch(`/api/sessions/${currentSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: data.data.refinedPrompt }),
        });
      }
    } else {
      setError(data.error?.message || "Failed to refine prompt");
    }
  } catch (err) {
    setError("Network error. Please try again.");
    console.error(err);
  } finally {
    setIsRefining(false);
  }
};
```

### 5. Implementation Files

#### 5.1 New API Route

**File:** `/app/api/refine-prompt/route.ts`

```typescript
/**
 * Rolloy Creative OS - Prompt Refinement API
 *
 * POST /api/refine-prompt
 * Refines an existing prompt based on user's natural language instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  refinePrompt,
  ABCDSelection,
  ProductState,
} from '@/lib/services/gemini-service';
import {
  fetchABCDContexts,
} from '@/lib/services/abcd-context-service';

// ============================================================================
// Types
// ============================================================================

interface RefinePromptRequest {
  originalPrompt: string;
  refinementInstruction: string;
  selection: ABCDSelection;
  productState: ProductState;
  sessionId?: string;
}

interface RefinePromptResponse {
  refinedPrompt: string;
  changes: string;
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
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
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: RefinePromptRequest = await request.json();
    const {
      originalPrompt,
      refinementInstruction,
      selection,
      productState,
      sessionId
    } = body;

    // Validate inputs
    if (!originalPrompt || !refinementInstruction || !selection || !productState) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields',
            details: 'originalPrompt, refinementInstruction, selection, and productState are required',
          },
        },
        { status: 400 }
      );
    }

    if (!refinementInstruction.trim()) {
      return NextResponse.json<APIResponse>(
        {
          success: false,
          error: {
            code: 'EMPTY_INSTRUCTION',
            message: 'Refinement instruction cannot be empty',
          },
        },
        { status: 400 }
      );
    }

    // Fetch contexts for better refinement (optional but recommended)
    console.log('Fetching ABCD contexts for refinement...');
    const contexts = await fetchABCDContexts(selection);

    console.log('Refining prompt with instruction:', refinementInstruction);

    // Call Gemini to refine the prompt
    const result = await refinePrompt({
      originalPrompt,
      refinementInstruction,
      selection,
      productState,
      contexts,
    });

    const response: RefinePromptResponse = {
      refinedPrompt: result.refinedPrompt,
      changes: result.changes,
      metadata: result.metadata,
    };

    return NextResponse.json<APIResponse<RefinePromptResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/refine-prompt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json<APIResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to refine prompt',
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
```

#### 5.2 Gemini Service Extension

**File:** `/lib/services/gemini-service.ts` (add new function)

```typescript
// Add these types and function to the existing file

// ============================================================================
// Prompt Refinement Types & Functions
// ============================================================================

export interface PromptRefinementRequest {
  originalPrompt: string;
  refinementInstruction: string;
  selection: ABCDSelection;
  productState: ProductState;
  contexts?: ABCDContexts;
}

export interface PromptRefinementResponse {
  refinedPrompt: string;
  changes: string;
  metadata: {
    model: string;
    timestamp: string;
    tokensUsed?: number;
  };
}

const REFINEMENT_SYSTEM_PROMPT = `You are an expert prompt refinement assistant for advertising photography.

Your task is to MODIFY an existing image prompt based on user's refinement instructions, while preserving:
1. The overall structure and style of the original prompt
2. Critical product information (the red 'Rolloy Compact Master' rollator)
3. Product state (FOLDED or UNFOLDED) unless explicitly changed
4. Required technical statements (product rendering statement, quality statement)
5. Professional advertising photography tone

CRITICAL RULES:
- Only modify the parts that user specifically wants to change
- If user says "make woman younger", ONLY change age-related descriptions
- If user says "change location to park", ONLY change environment/location descriptions
- If user says "她自己在做美甲" (doing nails herself), remove salon chair and manicurist, add nail polish and mirror
- Maintain the 150-200 word length
- Keep the same structural flow (shot type → subject → clothing → action → environment → camera → lighting → quality)
- NEVER remove the product rendering statement or quality statement
- Preserve all details not mentioned in the refinement instruction

OUTPUT FORMAT:
Return TWO sections separated by "---CHANGES---":
1. The complete refined prompt (ready to use as-is)
2. A brief summary of what was changed (1-2 sentences)

Example:
A dynamic, eye-level medium shot focuses on a realistic, older American woman in her 50s...

---CHANGES---
Changed subject from woman in 70s to woman in 50s, updated hair description from "silver" to "auburn with subtle highlights".`;

function buildRefinementUserPrompt(
  originalPrompt: string,
  refinementInstruction: string,
  productState: ProductState,
  selection: ABCDSelection
): string {
  return `ORIGINAL PROMPT:
${originalPrompt}

PRODUCT STATE: ${productState} (must be preserved unless user explicitly requests change)
ABCD CONTEXT: ${selection.A1} / ${selection.A2} / ${selection.B} / ${selection.C} / ${selection.D}

USER REFINEMENT INSTRUCTION:
"${refinementInstruction}"

Please refine the prompt according to the user's instruction, keeping everything else intact. Return the complete refined prompt followed by ---CHANGES--- and a summary of changes.`;
}

/**
 * Refine an existing prompt based on user's natural language instructions
 *
 * @param request - The refinement request with original prompt and user's instruction
 * @returns Refined prompt with change summary
 */
export async function refinePrompt(
  request: PromptRefinementRequest
): Promise<PromptRefinementResponse> {
  if (!GEMINI_API_KEY) {
    throw new GeminiAPIError('GEMINI_API_KEY is not configured');
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: TEXT_MODEL,
      systemInstruction: REFINEMENT_SYSTEM_PROMPT,
    });

    const userPrompt = buildRefinementUserPrompt(
      request.originalPrompt,
      request.refinementInstruction,
      request.productState,
      request.selection
    );

    console.log(`Refining prompt (state: ${request.productState})`);
    console.log(`Instruction: ${request.refinementInstruction}`);

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const fullResponse = response.text().trim();

    if (!fullResponse) {
      throw new GeminiAPIError('Gemini returned empty response');
    }

    // Parse the response to extract prompt and changes
    const parts = fullResponse.split('---CHANGES---');
    const refinedPrompt = parts[0]?.trim() || fullResponse;
    const changes = parts[1]?.trim() || 'Prompt refined based on user instruction';

    return {
      refinedPrompt,
      changes,
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
    throw new GeminiAPIError(`Failed to refine prompt: ${errorMessage}`, error);
  }
}
```

### 6. Data Flow Diagram

```
User Input (Refinement Instruction)
           ↓
[Frontend] page.tsx handleRefinePrompt()
           ↓
[API] POST /api/refine-prompt
           ↓
[Service] gemini-service.refinePrompt()
           ↓
[Gemini API] Text Model with Refinement System Prompt
           ↓
[Response] {refinedPrompt, changes, metadata}
           ↓
[Frontend] Update editedPrompt + Show changes
           ↓
[Optional] Update Session in Database
```

### 7. Security & RLS Policies

不需要新的RLS策略，因为：
1. 微调操作使用现有Session的权限
2. 只有Session owner可以微调（通过 `currentSessionId` 传递）
3. API层不直接写入数据库，只返回refined prompt

### 8. Interface Definitions

```typescript
// /lib/types/prompt.ts (NEW FILE)

export interface PromptRefinementRequest {
  originalPrompt: string;
  refinementInstruction: string;
  selection: {
    A1: string;
    A2: string;
    B: string;
    C: string;
    D: string;
  };
  productState: 'FOLDED' | 'UNFOLDED';
  sessionId?: string;
}

export interface PromptRefinementResponse {
  success: boolean;
  data?: {
    refinedPrompt: string;
    changes: string;
    metadata: {
      model: string;
      timestamp: string;
      tokensUsed?: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}
```

### 9. Testing Strategy

#### 9.1 Unit Tests

```typescript
// /tests/services/gemini-service.test.ts
describe('refinePrompt', () => {
  test('should refine prompt with age change', async () => {
    const result = await refinePrompt({
      originalPrompt: 'A woman in her 70s...',
      refinementInstruction: 'Make woman younger, in her 50s',
      selection: mockSelection,
      productState: 'UNFOLDED',
    });

    expect(result.refinedPrompt).toContain('50s');
    expect(result.refinedPrompt).not.toContain('70s');
    expect(result.changes).toContain('age');
  });

  test('should preserve product state', async () => {
    const result = await refinePrompt({
      originalPrompt: 'UNFOLDED walker...',
      refinementInstruction: 'Change location to park',
      selection: mockSelection,
      productState: 'UNFOLDED',
    });

    expect(result.refinedPrompt).toContain('UNFOLDED');
  });
});
```

#### 9.2 Integration Tests

1. Test `/api/refine-prompt` endpoint with valid requests
2. Test error handling (empty instruction, invalid inputs)
3. Test session update after refinement

#### 9.3 Manual Testing Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Change age | "让这个woman更年轻，50岁左右" | Age changes from 70s to 50s, hair might change from silver to auburn |
| Change activity | "她自己在做美甲，不是在salon" | Remove salon chair, add nail polish and mirror |
| Change location | "把场景改成公园" | Replace living room with outdoor park setting |
| Preserve state | "把人物改成男性" | Gender changes but product state remains UNFOLDED |

### 10. Performance Considerations

1. **API Response Time:** Estimated 2-4 seconds for Gemini refinement
2. **Token Usage:** ~500-800 tokens per refinement (original prompt + instruction + response)
3. **Rate Limiting:** Use existing Gemini API rate limits (no additional limits needed)
4. **Caching:** No caching needed (each refinement is unique)

### 11. Future Enhancements (Out of Scope)

1. **Refinement History:** Store refinement history in database for undo/redo
2. **Suggested Refinements:** Show common refinement templates (e.g., "Make younger", "Change location")
3. **Multi-step Refinement:** Allow multiple refinements in sequence with history
4. **Batch Refinement:** Apply same refinement to multiple images in session

### 12. Implementation Checklist

- [ ] Create `/app/api/refine-prompt/route.ts`
- [ ] Add `refinePrompt()` to `/lib/services/gemini-service.ts`
- [ ] Add refinement UI to `/app/page.tsx` (in Prompt panel)
- [ ] Create `/lib/types/prompt.ts` for type definitions
- [ ] Add state management (`refinementInput`, `isRefining`, `lastRefinementChanges`)
- [ ] Implement `handleRefinePrompt()` handler
- [ ] Test with various refinement scenarios
- [ ] Update documentation

## Summary

This design provides a clean, non-invasive way to refine prompts using natural language instructions. The solution:

1. Maintains consistency with existing architecture (Vercel + Supabase stack)
2. Uses Server Actions pattern (API routes)
3. Leverages Gemini's text model for intelligent refinement
4. Preserves ABCD context and product state
5. Provides clear user feedback (changes summary)
6. Requires no database schema changes
7. Follows the existing code style and patterns

The refinement feature integrates seamlessly into the existing "generate" step without disrupting the current workflow.

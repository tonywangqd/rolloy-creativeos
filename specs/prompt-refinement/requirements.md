# Prompt Refinement Feature - Product Requirements

**Feature Owner:** Product Director
**Document Version:** 1.0
**Date:** 2025-12-10
**Status:** Draft

---

## 1. CONTEXT & BUSINESS GOALS

### 1.1 Problem Statement

Users currently follow a rigid workflow:
1. Select ABCD dimensions (Scene, Action, Driver, Format)
2. System generates a complete prompt
3. User can only edit the prompt manually in the textarea

**Core Problem:** After initial prompt generation, users cannot leverage AI to make incremental adjustments while preserving the original context. Manual editing is time-consuming and risks breaking the prompt structure.

### 1.2 Business Value

**Primary Value:** Reduce iteration time by 60-80% through conversational prompt refinement
- Users can request specific changes without re-selecting ABCD or regenerating from scratch
- Maintains prompt quality and structure consistency
- Lowers barrier to experimentation, increasing session engagement

**Success Metrics:**
- Average time from initial prompt to final accepted prompt: Target < 3 minutes (baseline: 8-12 minutes)
- Number of prompt iterations per session: Increase from 1.2 to 3.5
- Prompt acceptance rate: Increase from 65% to 85%

### 1.3 User Impact

**Primary Users:** Creative Directors, Marketing Managers
**Frequency:** Every creative session (100% of workflows)
**Pain Severity:** High - currently blocks rapid iteration

---

## 2. USER STORIES

### Story 2.1: Incremental Character Adjustment
```
AS A Marketing Manager
I WANT TO request "Make the woman doing her own nails instead"
SO THAT I can adjust the character action without losing scene context

GIVEN I have a generated prompt with scene, character, and product
WHEN I enter "I want the woman doing her own nails" in the refinement input
THEN The system should:
  - Preserve scene environment (e.g., "living room with hardwood floor")
  - Preserve product description (e.g., "red Rolloy Compact Master rollator nearby")
  - Update ONLY the character's action to "sitting with portable nail kit, applying nail polish"
  - Maintain prompt structure (shot description, lighting, etc.)
```

### Story 2.2: Lighting Adjustment
```
AS A Creative Director
I WANT TO request "Change lighting to golden hour sunset"
SO THAT I can test different mood variations

GIVEN I have an indoor scene with "soft morning sunlight"
WHEN I request "Change to golden hour lighting"
THEN The system should:
  - Replace lighting description with "warm, golden-hour sunlight streaming through windows"
  - Adjust color temperature references if present
  - Preserve all other elements
```

### Story 2.3: Background Element Addition
```
AS A User
I WANT TO request "Add potted plants in the background"
SO THAT I can enhance environmental richness

GIVEN I have a prompt with a defined scene
WHEN I request "Add more greenery - potted plants"
THEN The system should:
  - Insert plants into the environment description
  - Maintain spatial coherence (e.g., "...near the window, beside the sofa")
  - NOT alter the primary subject or product
```

### Story 2.4: Style Refinement
```
AS A User
I WANT TO request "Make it feel more premium and luxurious"
SO THAT I can adjust brand positioning

GIVEN I have a standard prompt
WHEN I request "More premium aesthetic"
THEN The system should:
  - Enhance material descriptions (e.g., "linen" → "crisp, high-thread-count linen")
  - Adjust environmental details (e.g., "clean furniture" → "designer furniture with chrome accents")
  - Preserve core scene logic
```

---

## 3. FUNCTIONAL REQUIREMENTS

### FR-1: Conversational Refinement Interface

**Location:** Below the editable prompt textarea on the "Prompt Review" step

**UI Components:**
- **Refinement Input Field** (Textarea, 2 rows)
  - Placeholder: "Describe your changes (e.g., 'Make the lighting warmer', 'Add plants in background')"
  - Character limit: 200
- **"Refine Prompt" Button** (Primary CTA)
  - Disabled states: When input empty OR AI processing
  - Loading state: Shows spinner + "Refining..."
- **Refinement History Panel** (Collapsible)
  - Shows last 3 refinement requests as timeline
  - Format: "[Timestamp] User: {request} → AI: Updated {affected_elements}"

**Interaction Flow:**
```
[Existing Prompt Textarea - Editable]
                ↓
[Refinement Input: "Make the woman younger, mid-30s"]
[Refine Prompt Button]
                ↓
[AI Processing: 2-5 seconds]
                ↓
[Prompt Textarea Updates with New Version]
[Refinement History: "+ Changed character age to mid-30s"]
```

### FR-2: Context-Aware AI Processing

**Input Context (sent to AI):**
1. Current Prompt Text (full)
2. Original ABCD Selection (read-only context)
3. Product State (FOLDED/UNFOLDED)
4. Refinement Request (user input)
5. System Prompt Rules (from prompts.ts)

**AI Processing Requirements:**
- **Model:** Same as prompt generation (gemini-2.0-flash-exp)
- **System Instruction Template:**
```
You are refining an existing image generation prompt.

CRITICAL RULES:
1. Preserve the 9-part prompt structure (Shot, Subject, Clothing, Action, Environment, Product Statement, Camera, Lighting, Quality Statement)
2. Update ONLY the aspects mentioned in the refinement request
3. Keep product description EXACTLY as-is (never alter "red 'Rolloy Compact Master' rollator" references)
4. Maintain photorealistic commercial photography style
5. Return ONLY the refined prompt as a single paragraph

CURRENT PROMPT:
{current_prompt}

ORIGINAL ABCD CONTEXT:
- Scene: {A1} - {A2}
- Action: {B}
- Driver: {C}
- Format: {D}
- Product State: {productState}

USER REFINEMENT REQUEST:
{user_request}

Generate the refined prompt:
```

**Output:**
- Updated prompt text (150-200 words, same structure)
- Metadata: `{ refined_sections: string[], timestamp: string }`

### FR-3: Prompt Versioning (Local State)

**Version Tracking:**
- Each refinement creates a new version in local state
- Store last 5 versions in memory (not database)
- Version structure:
```typescript
interface PromptVersion {
  version: number;          // 1, 2, 3...
  prompt: string;
  refinementRequest?: string;  // null for version 1 (original)
  timestamp: string;
  affectedSections: string[];  // e.g., ["lighting", "background"]
}
```

**Undo Capability:**
- "Undo Last Change" button (appears after first refinement)
- Reverts to previous version
- Re-enables redo for that version

### FR-4: Validation & Error Handling

**Input Validation:**
- Refinement request min length: 5 characters
- Max length: 200 characters
- Block requests containing product geometry keywords: "dimensions", "wheels", "frame size", "mechanism"

**Error States:**
| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| API Timeout (>10s) | "Refinement taking too long. Please try a simpler request." | Allow retry with same input |
| Invalid Request | "Please be more specific. Example: 'Change lighting to sunset'" | Show examples |
| Prompt Structure Broken | "AI returned invalid format. Reverting to previous version." | Auto-rollback |
| Rate Limit | "Too many requests. Please wait 30 seconds." | Disable button with countdown |

---

## 4. DATA REQUIREMENTS

### 4.1 API Endpoint Specification

**New Endpoint:** `POST /api/refine-prompt`

**Request Schema:**
```typescript
{
  currentPrompt: string;           // Full prompt text
  refinementRequest: string;       // User's refinement instruction
  abcdContext: {                   // Original selection
    A1: string;
    A2: string;
    B: string;
    C: string;
    D: string;
  };
  productState: "FOLDED" | "UNFOLDED";
  sessionId?: string;              // Optional for analytics
}
```

**Response Schema:**
```typescript
{
  success: boolean;
  data?: {
    refinedPrompt: string;
    affectedSections: string[];    // e.g., ["lighting", "character_expression"]
    metadata: {
      model: string;
      timestamp: string;
      tokensUsed: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}
```

### 4.2 Database Changes

**NO DATABASE CHANGES REQUIRED**

Rationale: Refinement is a ephemeral, session-local operation. Only the FINAL accepted prompt is saved to the session record (existing behavior).

**Optional Enhancement (v2.0):**
If we want analytics on refinement patterns:
```sql
CREATE TABLE prompt_refinements (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES generation_sessions(id),
  original_prompt TEXT NOT NULL,
  refinement_request TEXT NOT NULL,
  refined_prompt TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. BUSINESS RULES MATRIX

### Rule BR-1: Product Integrity Protection
| Condition | Rule | System Behavior |
|-----------|------|-----------------|
| Refinement mentions "walker", "rollator", "product" | BLOCK geometric changes | Reject requests like "make the walker bigger" or "change product color" |
| Refinement is about product placement | ALLOW positional changes | Accept "move the walker to the left" but keep exact product description |

### Rule BR-2: Context Preservation
| Element | Mutability | Override Logic |
|---------|-----------|----------------|
| ABCD Selection | Immutable | Never change A1/A2/B/C/D codes in context |
| Product State | Mutable | If refinement implies state change (e.g., "show folded walker"), warn user to use Product State selector |
| Reference Image | Immutable | Always locked to product state |

### Rule BR-3: Prompt Structure Enforcement
| Section | Required? | AI Instruction |
|---------|-----------|----------------|
| Shot Description | Yes | Must start with camera angle/type |
| Product Statement | Yes | NEVER omit or alter exact wording |
| Quality Statement | Yes | NEVER omit or alter exact wording |
| Other Sections | Yes | Can be modified per user request but structure preserved |

---

## 6. ACCEPTANCE CRITERIA (Gherkin)

### Scenario 6.1: Basic Refinement Flow
```gherkin
GIVEN I am on the Prompt Review step
  AND I have a generated prompt displayed
WHEN I enter "Make the person younger, around 35" in the refinement input
  AND I click "Refine Prompt"
THEN I should see a loading indicator for 2-5 seconds
  AND The prompt textarea should update with the refined version
  AND The character description should change to reflect "35-year-old" or "mid-30s"
  AND All other sections (lighting, environment, product) remain unchanged
  AND A refinement history entry appears: "Changed character age"
```

### Scenario 6.2: Product Protection
```gherkin
GIVEN I have a generated prompt
WHEN I enter "Make the walker twice as big" in the refinement input
  AND I click "Refine Prompt"
THEN I should see an error message: "Cannot modify product dimensions. Try describing scene changes instead."
  AND The prompt should NOT be sent to the AI
  AND The original prompt remains unchanged
```

### Scenario 6.3: Multiple Sequential Refinements
```gherkin
GIVEN I have refined my prompt once (lighting change)
WHEN I make a second refinement (background change)
  AND I make a third refinement (character expression)
THEN Each refinement should build on the previous version
  AND Refinement history should show all 3 changes in chronological order
  AND I can undo to any previous version
```

### Scenario 6.4: Error Recovery
```gherkin
GIVEN I submit a refinement request
  AND The API times out after 10 seconds
WHEN The error state is triggered
THEN I should see: "Request timeout. Please try again."
  AND The "Refine Prompt" button re-enables after 3 seconds
  AND My original prompt is still intact
  AND I can retry immediately
```

---

## 7. NON-FUNCTIONAL REQUIREMENTS

### NFR-1: Performance
- Refinement API response time: < 5 seconds (p95)
- UI should not freeze during processing (use loading states)
- Prompt versioning kept in memory (no localStorage to avoid size issues)

### NFR-2: Usability
- Refinement input autofocuses after initial prompt generation
- Provide 3-5 example refinement requests in placeholder/tooltip
- Visual diff indicator showing which sections changed (optional enhancement)

### NFR-3: Reliability
- If AI returns malformed prompt, auto-revert to previous version
- Log all refinement requests for debugging (server-side only)
- Rate limit: 10 refinements per minute per session

---

## 8. OUT OF SCOPE (v1.0)

The following are explicitly NOT included in this release:

1. **Multi-Turn Conversation:** Each refinement is independent (no "continue the conversation" memory)
2. **Prompt Branching:** Cannot create parallel versions from same base prompt
3. **Refinement Templates:** No pre-built refinement shortcuts ("Make it premium", "Add warmth")
4. **Database Persistence:** Refinement history not saved to database
5. **Collaborative Refinement:** No multi-user refinement on same prompt
6. **Natural Language Queries:** No "Show me all prompts with sunset lighting" search

---

## 9. DEPENDENCIES & INTEGRATION POINTS

### 9.1 Upstream Dependencies
- **Gemini API Service** (`/lib/services/gemini-service.ts`)
  - Requires new function: `refinePrompt(params: RefinePromptRequest): Promise<RefinePromptResponse>`
  - Uses same model as prompt generation (gemini-2.0-flash-exp)

### 9.2 UI Integration Points
- **File:** `/app/page.tsx` (HomePage component)
  - Add refinement UI below `editedPrompt` textarea in "prompt" step
  - State management: `promptVersions: PromptVersion[]`, `currentVersionIndex: number`
- **File:** `/lib/config/prompts.ts`
  - Add `REFINEMENT_SYSTEM_PROMPT` constant for AI instructions

### 9.3 API Integration
- **New API Route:** `/app/api/refine-prompt/route.ts`
- **Calls:** `gemini-service.refinePrompt()`
- **No Supabase interaction** (v1.0 design decision)

---

## 10. TECHNICAL CONSTRAINTS

### 10.1 Model Limitations
- Gemini may occasionally ignore "only change X" instructions → Validation layer needed
- Context window: Must fit current prompt (200 words) + system instruction (~500 words) + ABCD context (50 words) → Total ~750 words = 1000 tokens (well within limits)

### 10.2 UI Constraints
- Refinement input must not obscure the main prompt textarea
- Mobile view: Collapsible refinement panel to save space

### 10.3 Cost Implications
- Each refinement = 1 Gemini API call (~1000 tokens)
- Estimated cost: $0.0001 per refinement (negligible)
- If 1000 users make 5 refinements/day = 5000 calls/day = ~$0.50/day

---

## 11. ROLLOUT STRATEGY

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Internal team tests 50+ refinement scenarios
- Collect edge cases where AI breaks structure

### Phase 2: Beta Users (Week 2)
- Release to 10 power users
- Instrument analytics: refinement frequency, error rate, acceptance rate
- Gather qualitative feedback on UI placement

### Phase 3: General Availability (Week 3)
- Full production release
- Monitor API latency and error rates
- Iterate on example prompts based on user behavior

---

## 12. SUCCESS CRITERIA

This feature is successful if, after 2 weeks in production:

1. **Adoption:** 70%+ of sessions use refinement at least once
2. **Quality:** Prompt acceptance rate increases from 65% to 80%+
3. **Efficiency:** Average time-to-final-prompt decreases by 50%+
4. **Reliability:** Refinement API success rate > 95%
5. **User Satisfaction:** Post-session survey NPS > 8/10

---

## 13. OPEN QUESTIONS

These require Product/Engineering alignment before implementation:

1. **Q:** Should refinement history persist across page refreshes?
   **Recommendation:** No (v1.0) - Adds complexity, low user value. Revisit in v2.0.

2. **Q:** Should we allow refinement in the "generate" step (after images created)?
   **Recommendation:** Yes - Users may want to refine after seeing results. Same UI, updates prompt for next batch.

3. **Q:** Max refinements per prompt before forcing regeneration?
   **Recommendation:** 5 refinements. After that, prompt likely too far from original ABCD intent.

4. **Q:** Should refinement be available when prompt manually edited?
   **Recommendation:** Yes - Treat manual edits as version 1, refinement as version 2+.

---

## APPENDIX A: Example Refinement Scenarios

### Example 1: Lighting Change
**Original Prompt (excerpt):**
"...soft morning sunlight streams in from a large window to the left..."

**Refinement Request:**
"Change to golden hour sunset lighting"

**Expected Output:**
"...warm, golden-hour sunlight filters through a large window to the left, casting long shadows..."

### Example 2: Character Adjustment
**Original Prompt (excerpt):**
"...realistic, older American woman in her early 70s with stylish, short silver hair and a pleasant expression..."

**Refinement Request:**
"Make her doing her own nails"

**Expected Output:**
"...realistic, older American woman in her early 70s with stylish, short silver hair, sitting comfortably and applying nail polish with a portable nail kit..."

### Example 3: Background Enhancement
**Original Prompt (excerpt):**
"...spacious, modern living room with clean hardwood flooring and a neutral-toned sofa in the background..."

**Refinement Request:**
"Add green plants for a homey feel"

**Expected Output:**
"...spacious, modern living room with clean hardwood flooring, a neutral-toned sofa in the background, and lush potted plants on a side table and near the window..."

---

**END OF REQUIREMENTS DOCUMENT**

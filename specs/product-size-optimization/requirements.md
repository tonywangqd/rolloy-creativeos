# Product Size Constraint Optimization - Product Requirements

**Feature Owner:** Product Director
**Document Version:** 1.0
**Date:** 2025-12-10
**Status:** Draft

---

## 1. CONTEXT & BUSINESS GOALS

### 1.1 Problem Statement

**Current Issue:** Despite explicit size constraints in prompts (e.g., "26-inch knee-height", "66cm tall", "compact"), AI image generation models consistently render the folded walker as too large relative to humans and environments.

**Root Cause Analysis:**
1. **Ambiguous Measurements:** "26 inches" is absolute, but AI lacks spatial reasoning to translate this into relative scale
2. **Conflicting Visual Priors:** AI models are trained on thousands of walker images in "unfolded" state, creating a bias toward standard walker size
3. **Weak Anchoring:** Current prompts use measurements without strong visual comparisons
4. **Context Overload:** Product statement is buried in 200-word prompt, reducing emphasis

**Evidence of Failure:**
- Generated images show folded walker reaching hip/waist height (should be knee height)
- Walker appears too large to fit in car trunk scenes
- One-handed carrying looks physically implausible due to perceived size

### 1.2 Business Impact

**Current State:**
- 40% of folded-walker images rejected by users for incorrect scale
- Average 3.5 regenerations needed to get acceptable folded size
- Creative Directors manually photoshop products, negating AI value

**Desired State:**
- 90%+ of folded-walker images show correct scale on first generation
- Users accept images without manual post-processing
- Consistent brand communication of product's compact portability

**Business Value:**
- **Efficiency:** Reduce regenerations by 70% → Save $200/month in API costs
- **Quality:** Increase asset approval rate from 60% to 90%+
- **Brand Accuracy:** Ensure marketing materials correctly convey key product benefit (compact size)

### 1.3 Success Criteria

This optimization is successful if:
1. **Visual Accuracy:** 90% of folded images show walker at knee height or below
2. **User Acceptance:** First-image acceptance rate for folded state increases from 35% to 80%+
3. **Regeneration Rate:** Average regenerations per folded image decreases from 3.5 to 1.2
4. **Qualitative Test:** 10/10 test users correctly identify product as "compact" when shown generated images

---

## 2. RESEARCH & ANALYSIS

### 2.1 Current Size Descriptions (Baseline)

**Existing Prompt Fragments:**

**From `lib/config/prompts.ts` (System Prompt):**
```
CRITICAL SIZE & SCALE RULES:
- FOLDED STATE: The folded walker is COMPACT - only 66cm (26 inches) tall,
  about knee-height. It stands upright inside a shipping box with handgrips at
  box top level. It can be lifted with ONE hand. It fits standing upright in a
  car trunk.
```

**From `lib/services/gemini-service.ts` (User Prompt):**
```
FOLDED WALKER GUIDANCE:
- The folded walker is COMPACT - only 66cm (26 inches) tall, about knee-height
- Show it being: lifted with ONE hand, placed in car trunk, carried easily,
  standing upright in a shipping box
- It should appear SMALL relative to the human - similar to a small carry-on suitcase
```

**Problem Analysis:**
- ✅ Measurements provided (66cm, 26 inches)
- ✅ Relative comparison (knee-height)
- ⚠️ Weak: "similar to a small carry-on suitcase" is vague (suitcases vary 18-22 inches)
- ❌ Missing: Multi-point anchoring (compare to multiple familiar objects)
- ❌ Missing: Explicit negative constraints ("NOT waist-height", "NOT reaching hips")
- ❌ Missing: Visual weight/handling cues beyond "ONE hand"

### 2.2 AI Model Behavior Research

**Gemini Image Model Characteristics:**
- Prioritizes text at BEGINNING of prompts (recency bias)
- Responds well to comparative language ("smaller than X", "between A and B")
- Understands "NOT X" constraints but needs repetition
- Better at relative scale than absolute measurements

**Successful Patterns from Other Domains:**
- E-commerce product photography: "product held in palm" establishes scale
- Architectural visualization: "human figure for scale reference"
- Medical imaging: "ruler/coin for size calibration"

### 2.3 Competitive Analysis

**How other AI image tools handle product scale:**
- **Midjourney:** Users add "[object] for scale" tags (e.g., "banana for scale")
- **DALL-E 3:** Responds well to "tiny", "compact", "pocket-sized" emotional descriptors
- **Stable Diffusion:** Best results with negative prompts: "NOT large, NOT oversized"

---

## 3. SOLUTION STRATEGY

### 3.1 Multi-Layered Constraint Approach

We will apply 5 complementary strategies to reinforce size perception:

#### Layer 1: Enhanced Comparative Anchoring
Replace single comparison with multiple familiar objects of known size:
- ✅ "knee-height" (primary)
- ✅ "comparable to a small rolling carry-on suitcase (20 inches tall)"
- ✅ "similar in height to a standard kitchen chair seat"
- ✅ "about the size of a large shoebox standing upright"

#### Layer 2: Negative Constraints (What It's NOT)
Explicitly state what the product should NOT look like:
- ❌ "NOT reaching the person's waist"
- ❌ "NOT as tall as a standard unfolded walker"
- ❌ "NOT requiring two hands to grip comfortably"

#### Layer 3: Contextual Action Cues
Emphasize actions that imply small size:
- "Lifted effortlessly with one hand, fingers wrapped around the handlebar grip"
- "Tucked easily beside the person in a car seat"
- "Placed inside a cardboard shipping box barely larger than itself"

#### Layer 4: Proportional Framing
Add explicit human-to-product ratio statements:
- "The walker reaches only to the person's mid-thigh when standing beside them"
- "When held, the top of the folded walker aligns with the person's hip, not shoulder"

#### Layer 5: Prompt Structure Repositioning
Move size constraints from middle of prompt to:
1. **Front:** Mention in shot description ("A medium shot of a senior easily lifting a COMPACT, knee-height...")
2. **Product Statement:** Embed in mandatory product statement
3. **End:** Repeat in action description

### 3.2 Revised Size Constraint Template

**New System Prompt Section (replaces existing CRITICAL SIZE & SCALE RULES):**
```
CRITICAL SIZE & SCALE RULES - FOLDED STATE:

The folded 'Rolloy Compact Master' rollator is EXTREMELY COMPACT:

ABSOLUTE MEASUREMENTS:
- Height: 66cm (26 inches) - strictly knee-height on an average adult
- Think: tall as a 20-inch rolling carry-on suitcase standing upright
- Reference point: Identical height to a standard kitchen chair seat

RELATIVE SCALE (multiple anchors):
- Reaches person's mid-thigh when standing beside it (NOT waist, NOT hip)
- When held, top of walker aligns with holder's hip level (NOT shoulder)
- Comparable to a large boot box or small microwave in volume

PHYSICAL INTERACTION CUES:
- ONE hand can lift and carry it comfortably (fingers wrap fully around handle)
- Person can tuck it under their arm like a large book
- Fits standing UPRIGHT in a standard car trunk with room to spare
- Sits inside a shipping box with only 2-3 inches clearance on each side

NEGATIVE CONSTRAINTS (what it is NOT):
- NOT reaching the person's waist
- NOT as tall as an unfolded walker (which is waist-height)
- NOT requiring two-handed carrying grip
- NOT bulky or cumbersome-looking

VISUAL WEIGHT:
- Appears lightweight, as if made of hollow aluminum (not heavy steel)
- Person's posture should show easy handling, not strain

CRITICAL: Prioritize making it look SMALLER than expected, not larger.
When in doubt, render it closer to knee-height than hip-height.
```

**New User Prompt Guidance (replaces FOLDED WALKER GUIDANCE):**
```
FOLDED STATE VISUAL REQUIREMENTS:

MANDATORY SIZE PRESENTATION:
1. SHOT COMPOSITION: Frame the shot to emphasize the walker's compact scale
   - Include clear reference: person's full legs visible to show knee-height comparison
   - If holding: show person's relaxed posture (one arm, not straining)

2. PRODUCT SCALE: The folded red 'Rolloy Compact Master' rollator measures exactly
   66cm (26 inches) tall - reaching only to the person's mid-thigh/knee area:
   - When standing beside person: top of walker = person's knee height
   - When held: person grips it with one hand, walker top at hip level
   - Visual similarity: size of a 20-inch carry-on suitcase or kitchen chair

3. SCALE ANCHORS (include at least 2):
   - Person's legs fully visible (walker clearly below waist)
   - Nearby objects for comparison (doorway, car trunk opening, chair, table)
   - One-handed grip with fingers visibly wrapped around handle

4. ACTION COHERENCE: Person's body language must convey "this is light and small":
   - Relaxed shoulder posture when carrying
   - Casual one-handed hold (not two-handed wrestling)
   - Easy placement in spaces (trunk, corner, beside furniture)

NEGATIVE PROMPTING (CRITICAL):
- The walker is NOT waist-height
- The walker is NOT the same size as an unfolded walker
- The person is NOT struggling or using both hands to manage it
- The walker does NOT dominate the frame

EXAMPLE SCENARIOS:
- Lifting from ground: Person bends slightly, lifts with one hand, walker clears ground by knee-height
- Car trunk: Walker stands upright in trunk, plenty of space around it, person places it easily
- Beside person: Walker leans against person's leg, top at knee level
- Unboxing: Walker in box on table, box approximately 30"×12"×10", walker fits with minimal padding
```

---

## 4. IMPLEMENTATION REQUIREMENTS

### 4.1 Code Changes Required

#### Change 4.1.1: Update System Prompt
**File:** `/lib/config/prompts.ts`
**Line:** 30-32 (CRITICAL SIZE & SCALE RULES section)

**Action:** Replace entire section with revised template from Section 3.2 above

#### Change 4.1.2: Update User Prompt Builder
**File:** `/lib/services/gemini-service.ts`
**Function:** `buildUserPrompt()`
**Line:** 191-199 (FOLDED WALKER GUIDANCE section)

**Action:** Replace with new FOLDED STATE VISUAL REQUIREMENTS from Section 3.2

#### Change 4.1.3: Enhance Product Statement
**File:** `/lib/services/gemini-service.ts`
**Function:** `buildUserPrompt()`
**Line:** 223 (Product Statement instruction)

**Current:**
```
6. PRODUCT STATEMENT: Include exactly: "The 'Rolloy Compact Master' rollator shown
must be rendered exactly as it appears in the provided product reference image, with
absolutely no edits or changes to its design, color, or components."
```

**Revised (for FOLDED state only):**
```
6. PRODUCT STATEMENT FOR FOLDED STATE: Include exactly: "The 'Rolloy Compact Master'
rollator shown is in its FOLDED, compact state - measuring 66cm (26 inches) tall,
approximately knee-height on an adult. It must be rendered exactly as it appears in
the provided product reference image, maintaining its COMPACT proportions with the
walker reaching only to the person's knee/mid-thigh level, NOT their waist. No edits
to design, color, or components."
```

### 4.2 Configuration Changes

**Environment Variables:** None required

**Database Changes:** None required

**Asset Changes:**
- Verify reference images clearly show folded walker at correct scale
- Consider adding a "scale reference" image with human for scale (optional v2.0 enhancement)

---

## 5. DATA REQUIREMENTS

### 5.1 Metrics to Track

**Before/After Comparison (2-week A/B test):**

| Metric | Baseline (Current) | Target (Optimized) |
|--------|-------------------|-------------------|
| Folded Image Acceptance Rate | 35% | 80%+ |
| Average Regenerations (Folded) | 3.5 | 1.2 |
| User-Reported "Too Large" Issues | 40% of folded sessions | < 10% |
| First-Image Success Rate | 15% | 70%+ |
| Average Time to Accepted Image | 8 minutes | 3 minutes |

**Analytics Events to Log:**
```typescript
// When image generated
{
  event: 'image_generated',
  productState: 'FOLDED' | 'UNFOLDED',
  promptVersion: 'baseline' | 'optimized',
  imageIndex: number,
  timestamp: string
}

// When user accepts/rejects
{
  event: 'image_action',
  action: 'accept' | 'regenerate' | 'delete',
  productState: 'FOLDED' | 'UNFOLDED',
  promptVersion: 'baseline' | 'optimized',
  reason?: 'scale_incorrect' | 'lighting_bad' | 'other'
}
```

### 5.2 No Database Schema Changes

This optimization only affects prompt text templates. No data model changes required.

---

## 6. BUSINESS RULES MATRIX

### Rule BR-1: State-Specific Size Logic
| Product State | Size Constraint Application | Measurement Emphasis |
|--------------|---------------------------|---------------------|
| FOLDED | STRICT - Apply all 5 layers | Knee-height (26 inches) |
| UNFOLDED | MODERATE - Standard walker scale | Waist-height (standard walker) |

### Rule BR-2: Constraint Priority Order
| Priority | Constraint Type | Weight in Prompt | Position |
|----------|----------------|------------------|----------|
| 1 | Comparative Anchors (knee-height, carry-on) | HIGH | Beginning + Middle + End |
| 2 | Negative Constraints (NOT waist) | HIGH | Middle + End |
| 3 | Action Cues (one-handed lift) | MEDIUM | Middle |
| 4 | Absolute Measurements (66cm) | MEDIUM | Beginning |
| 5 | Visual Weight (lightweight) | LOW | End |

### Rule BR-3: Multi-Modal Reinforcement
| Scene Type | Required Anchors | Optional Anchors |
|------------|------------------|------------------|
| Person holding walker | Person's legs visible (knee reference), One-handed grip | Relaxed posture |
| Walker in car trunk | Trunk opening dimensions, Extra space visible | Other items for scale |
| Walker beside person | Full-body person shot, Walker at knee level | Floor/ground visible |
| Unboxing scene | Box dimensions, Walker inside box with clearance | Person's hands for scale |

---

## 7. ACCEPTANCE CRITERIA (Gherkin)

### Scenario 7.1: Folded Walker Lifting Scene
```gherkin
GIVEN The user selects ABCD with Action = "lift" (FOLDED state)
  AND System generates prompt using optimized size constraints
WHEN AI generates the image
THEN The folded walker's top should be at or below the person's knee height
  AND The person should be holding it with ONE hand
  AND The person's posture should appear relaxed (not straining)
  AND The walker should visually appear "lightweight" and "compact"
  AND If other objects are present, walker should be proportionally smaller
```

### Scenario 7.2: Car Trunk Placement Scene
```gherkin
GIVEN The user selects ABCD with Action = "car-trunk" (FOLDED state)
  AND System generates prompt with trunk space emphasis
WHEN AI generates the image
THEN The walker should stand UPRIGHT in the trunk
  AND There should be visible empty space around the walker (not cramped)
  AND The walker should NOT fill the entire trunk height
  AND The trunk opening should provide scale reference
  AND Walker should appear smaller than a typical grocery bag
```

### Scenario 7.3: Size Comparison with Unfolded State
```gherkin
GIVEN User generates an UNFOLDED walker image (waist-height)
  AND User then generates a FOLDED walker image (knee-height)
WHEN Comparing both images side-by-side
THEN The folded walker should be visually ~50% the height of the unfolded walker
  AND The folded walker should clearly appear more "compact" and "portable"
  AND Both should use consistent human scale for comparison
```

### Scenario 7.4: Negative Constraint Validation
```gherkin
GIVEN System generates 10 folded walker images using optimized prompts
WHEN Evaluating for constraint violations
THEN 0/10 images should show walker at waist height
  AND 0/10 images should show person using both hands to hold walker
  AND 0/10 images should show walker appearing "bulky" or "oversized"
  AND At least 9/10 images should show walker at knee height or below
```

---

## 8. A/B TESTING PLAN

### 8.1 Test Design

**Hypothesis:**
> Multi-layered size constraints with comparative anchoring and negative prompting will increase folded-walker scale accuracy by 50%+ compared to baseline.

**Test Groups:**
- **Control (A):** Current prompt templates (baseline)
- **Variant (B):** Optimized prompt templates (Section 3.2)

**Split:** 50/50 by session (session-level assignment)

**Duration:** 2 weeks (target 200 folded-state image generations)

### 8.2 Evaluation Methodology

**Automated Metrics:**
- Acceptance rate (user clicks "select" vs "regenerate")
- Regeneration frequency per image
- Time to final accepted image

**Manual Evaluation (weekly):**
- Product team reviews 20 random images from each group
- Scoring rubric:
  - ✅ **Correct:** Walker at knee height, proportionally accurate
  - ⚠️ **Borderline:** Walker slightly too large but acceptable
  - ❌ **Incorrect:** Walker at hip/waist height, clearly oversized

**User Survey (post-session):**
After accepting a folded-walker image:
> "Does this image accurately represent a compact, portable product?"
> - Yes, it looks compact and easy to handle (target: 90%+)
> - Somewhat, but could be smaller (acceptable: < 10%)
> - No, it looks too large (failure: < 5%)

### 8.3 Success Criteria

**Primary Success Metric:**
- Variant B acceptance rate ≥ 80% (vs Control A ≤ 40%)
- Improvement: +40 percentage points or more

**Secondary Success Metrics:**
- Regeneration rate decrease: ≥ 50% reduction
- Manual evaluation correct rate: ≥ 90% for Variant B
- User survey "Yes" rate: ≥ 85%

**Rollout Decision:**
- If primary + 2/3 secondary metrics met → Ship to 100%
- If primary met but secondary mixed → Iterate for 1 more week
- If primary not met → Investigate failure modes, redesign

---

## 9. NON-FUNCTIONAL REQUIREMENTS

### NFR-1: Performance
- Prompt generation time should NOT increase (size optimization is text-only)
- Image generation time may vary by model (not controllable) but should be monitored

### NFR-2: Maintainability
- Size constraint templates should be configurable constants (not hardcoded)
- Consider extracting to separate config file if >100 lines
- Document constraint rationale in code comments

### NFR-3: Compatibility
- Must work with both Gemini and Flux image models (if applicable)
- Should not break unfolded-state prompt generation
- Backward compatible with existing session prompts

---

## 10. ROLLBACK PLAN

### Trigger Conditions for Rollback
1. Acceptance rate DECREASES compared to baseline (unexpected regression)
2. Image generation API errors spike (prompt too long, invalid format)
3. User complaints about "images look wrong" increase by 50%+

### Rollback Procedure
1. Revert `lib/config/prompts.ts` and `lib/services/gemini-service.ts` to previous version
2. Deploy hotfix within 30 minutes
3. Monitor acceptance rate for 24 hours to confirm recovery
4. Conduct post-mortem to identify failure cause

### Partial Rollback Option
If only specific constraint layers cause issues:
- Keep Layers 1 + 2 (Comparative Anchoring + Negative Constraints)
- Remove Layers 3-5 (Action Cues, Proportional Framing, Repositioning)
- Re-test with reduced constraint set

---

## 11. FUTURE ENHANCEMENTS (v2.0+)

### Enhancement 1: Dynamic Scale Reference Images
Instead of static reference images, generate composite images showing:
- Human figure silhouette for scale
- Measurement overlay (grid lines, ruler)
- Side-by-side folded vs unfolded comparison

### Enhancement 2: Multi-Product Scale System
Generalize the constraint framework for other products:
- Template: `{product_name} | {state} | {key_measurements} | {comparative_anchors}`
- Reusable across product lines (e.g., compact strollers, foldable bikes)

### Enhancement 3: AI-Powered Scale Validation
Post-generation analysis:
- Computer vision model estimates walker height in pixels
- Compares to human height in same image
- Auto-flags images where ratio is incorrect (>30% off)
- Triggers auto-regeneration with enhanced constraints

### Enhancement 4: User-Adjustable Scale Emphasis
UI slider: "Emphasize Compact Size" (Low/Medium/High)
- High: Uses all 5 constraint layers + repetition
- Medium: Current optimized approach
- Low: Baseline approach (for scenes where size less critical)

---

## 12. OPEN QUESTIONS

These require Engineering/AI team input:

1. **Q:** Does Gemini have a "negative prompt" feature like Stable Diffusion?
   **Recommendation:** Test if `[NO waist-height]` syntax improves results.

2. **Q:** Can we analyze existing successful images to extract common patterns?
   **Recommendation:** Use CV model to measure walker height ratios in high-rated images.

3. **Q:** Should we create a separate reference image showing walker WITH human for scale?
   **Recommendation:** Test this in v1.5 - may provide stronger anchor than product-only image.

4. **Q:** How does Flux model handle size constraints differently from Gemini?
   **Recommendation:** Run parallel tests if Flux integration is active.

---

## 13. APPENDIX: Visual Examples

### Example A: Current Baseline (Incorrect)
```
[Image shows person holding walker]
Issue: Walker reaches person's waist
Scale ratio: Walker height ~40% of person height (should be 25%)
Assessment: ❌ TOO LARGE
```

### Example B: Target Optimized (Correct)
```
[Image shows person holding walker]
Correct: Walker reaches person's mid-thigh/knee
Scale ratio: Walker height ~25% of person height ✓
Action: Person holds with one hand, relaxed posture ✓
Assessment: ✅ ACCURATE SCALE
```

### Example C: Comparative Anchors Visualization
```
Objects of similar size (all ~26 inches tall):
- ✅ 20" rolling carry-on suitcase (standing)
- ✅ Standard kitchen chair seat height
- ✅ Large shoebox (standing upright)
- ✅ Small microwave oven
- ✅ Toddler (2-3 years old) standing height
```

---

## 14. DEFINITION OF DONE

This feature is considered complete when:

- [ ] Updated prompt templates deployed to production
- [ ] A/B test running for 2 weeks (200+ folded images generated)
- [ ] Primary success metric achieved (≥80% acceptance rate)
- [ ] Manual evaluation shows ≥90% correct scale in Variant B
- [ ] User survey NPS ≥8/10 for "compact appearance"
- [ ] Zero critical bugs related to prompt formatting
- [ ] Documentation updated (README, technical specs)
- [ ] Rollout decision made and communicated

---

**END OF REQUIREMENTS DOCUMENT**

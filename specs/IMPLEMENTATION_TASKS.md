# Implementation Task Assignment - Creative Workspace Enhancements

**Date:** 2025-12-10
**Document Owner:** Product Director
**Project Context:** Two parallel enhancements to the Creative Workspace

---

## PROJECT OVERVIEW

We are implementing two features to improve the Creative Workspace user experience:

1. **Prompt Refinement Feature** - Allow users to iteratively refine generated prompts through conversational AI
2. **Product Size Optimization** - Fix AI-generated images showing folded walker at incorrect scale

---

## FEATURE 1: PROMPT REFINEMENT

### Specification Document
**Location:** `/Users/tony/rolloy-creativeos/specs/prompt-refinement/requirements.md`

### Agent Task Breakdown

#### Task 1.1: Backend API Implementation
**Owner:** Backend Engineer Agent
**Priority:** P0 (Blocking)
**Estimated Effort:** 4 hours

**Deliverables:**
1. Create new API route: `/app/api/refine-prompt/route.ts`
   - Request schema validation
   - Error handling
   - Rate limiting (10 requests/minute)
2. Add `refinePrompt()` function to `/lib/services/gemini-service.ts`
   - System instruction template for refinement
   - Context preservation logic
   - Product integrity validation (block geometry changes)
3. Unit tests for refinement logic
4. API documentation in OpenAPI format

**Acceptance Criteria:**
- [ ] API returns refined prompt in <5 seconds (p95)
- [ ] Validates product protection rules (rejects "make walker bigger")
- [ ] Maintains 9-part prompt structure
- [ ] Error rate <5% under normal load
- [ ] All tests passing

**Dependencies:**
- Access to Gemini API (existing)
- System prompt template (provided in spec)

---

#### Task 1.2: Frontend UI Components
**Owner:** Frontend Engineer Agent
**Priority:** P0 (Blocking)
**Estimated Effort:** 5 hours

**Deliverables:**
1. Refinement UI component in `/app/page.tsx`
   - Textarea input (200 char limit)
   - "Refine Prompt" button with loading states
   - Refinement history panel (collapsible, last 3 entries)
2. State management for prompt versioning
   - `promptVersions: PromptVersion[]`
   - `currentVersionIndex: number`
   - Undo functionality
3. Integration with existing prompt preview step
4. Mobile-responsive layout
5. Error state handling UI

**Acceptance Criteria:**
- [ ] Refinement input appears below prompt textarea on "prompt" step
- [ ] Loading spinner displays during API call
- [ ] Prompt updates reactively after refinement
- [ ] Undo button reverts to previous version
- [ ] Error messages display with recovery actions
- [ ] Mobile view: collapsible panel to save space

**Dependencies:**
- Task 1.1 (API endpoint ready)

**UI Placement Reference:**
```
[Step 2: Review Prompt]
+----------------------------------+
| Generated Prompt                 |
| [Editable Textarea - 8 rows]    |
+----------------------------------+
| 🔧 Refine Your Prompt            |
| [Input: "Describe changes..."]   |
| [Refine Prompt Button]           |
+----------------------------------+
| 📜 History (3)                   |
| • Changed lighting to sunset     |
| • Added background plants        |
+----------------------------------+
```

---

#### Task 1.3: Integration & Testing
**Owner:** QA/Testing Agent
**Priority:** P1
**Estimated Effort:** 3 hours

**Deliverables:**
1. End-to-end test suite for refinement workflow
2. Manual test scenarios (20 refinement requests)
3. Edge case testing (malformed prompts, API timeouts)
4. Performance benchmarking (API latency, UI responsiveness)
5. Accessibility audit (keyboard navigation, screen reader)

**Test Scenarios:**
- [ ] Basic refinement: "Change lighting to golden hour" → lighting section updated
- [ ] Character adjustment: "Make the woman younger" → age description changed
- [ ] Product protection: "Make walker bigger" → error displayed
- [ ] Multiple refinements: 3 sequential changes → all applied correctly
- [ ] Undo/redo: Navigate through 5 versions
- [ ] Error recovery: API timeout → graceful fallback
- [ ] Rate limit: 11 requests in 1 minute → throttle message

**Dependencies:**
- Tasks 1.1 + 1.2 completed

---

### Feature 1 Rollout Plan

**Week 1:**
- Mon-Tue: Tasks 1.1 + 1.2 in parallel
- Wed: Task 1.3 testing
- Thu: Internal team dogfooding
- Fri: Bug fixes, polish

**Week 2:**
- Mon: Deploy to staging
- Tue-Thu: Beta testing with 10 power users
- Fri: Production deployment (if success metrics met)

---

## FEATURE 2: PRODUCT SIZE OPTIMIZATION

### Specification Document
**Location:** `/Users/tony/rolloy-creativeos/specs/product-size-optimization/requirements.md`

### Agent Task Breakdown

#### Task 2.1: Prompt Template Optimization
**Owner:** AI Prompt Engineer Agent (or Backend Engineer)
**Priority:** P0 (Blocking)
**Estimated Effort:** 3 hours

**Deliverables:**
1. Update `/lib/config/prompts.ts`
   - Replace `CRITICAL SIZE & SCALE RULES` section
   - Add multi-layered constraint template (5 layers)
   - Include negative constraints
2. Update `/lib/services/gemini-service.ts`
   - Revise `buildUserPrompt()` function
   - Separate FOLDED vs UNFOLDED guidance
   - Enhance product statement for folded state
3. Extract size constraint templates to separate constants
4. Document constraint rationale in code comments

**Acceptance Criteria:**
- [ ] System prompt includes all 5 constraint layers
- [ ] User prompt emphasizes size at beginning, middle, end
- [ ] Negative constraints present ("NOT waist-height")
- [ ] Comparative anchors use 3+ familiar objects
- [ ] Code maintainability: templates as constants

**Template Sections to Update:**
```typescript
// lib/config/prompts.ts (line 30-32)
CRITICAL SIZE & SCALE RULES - FOLDED STATE:
- Absolute measurements (66cm, 26 inches)
- Comparative anchors (carry-on suitcase, kitchen chair)
- Negative constraints (NOT waist-height)
- Physical interaction cues (one-handed lift)
- Visual weight (lightweight aluminum)

// lib/services/gemini-service.ts (line 191-199)
FOLDED STATE VISUAL REQUIREMENTS:
- Shot composition guidance
- Product scale specifics
- Scale anchors (2+ required)
- Action coherence
- Negative prompting
- Example scenarios
```

**Dependencies:**
- None (template-only changes)

---

#### Task 2.2: A/B Testing Infrastructure
**Owner:** Data/Analytics Engineer Agent
**Priority:** P1
**Estimated Effort:** 4 hours

**Deliverables:**
1. Session-level A/B assignment logic
   - 50/50 split by session ID
   - Store variant in session metadata
2. Analytics event instrumentation
   - `image_generated` event (with promptVersion tag)
   - `image_action` event (accept/regenerate/delete)
   - Reason codes for rejection
3. Dashboard for real-time monitoring
   - Acceptance rate by variant
   - Regeneration frequency
   - User feedback scores
4. Automated report generation (weekly)

**Acceptance Criteria:**
- [ ] Session assignment deterministic (same session = same variant)
- [ ] 50/50 split maintained across 200+ sessions
- [ ] All events tracked in analytics database
- [ ] Dashboard shows live metrics (refresh every 5 min)
- [ ] Automated email report sent every Friday

**Data Schema:**
```typescript
// Session metadata (existing table extension)
{
  size_optimization_variant: 'control' | 'optimized',
  assigned_at: timestamp
}

// Analytics events (new)
{
  event_type: 'image_generated' | 'image_action',
  session_id: UUID,
  product_state: 'FOLDED' | 'UNFOLDED',
  prompt_version: 'baseline' | 'optimized',
  action?: 'accept' | 'regenerate' | 'delete',
  rejection_reason?: string,
  timestamp: timestamp
}
```

**Dependencies:**
- Task 2.1 (need optimized templates to A/B test)

---

#### Task 2.3: Manual Evaluation Framework
**Owner:** Product Manager Agent (or Human PM)
**Priority:** P2
**Estimated Effort:** 2 hours setup + ongoing

**Deliverables:**
1. Evaluation rubric document
   - ✅ Correct: Walker at knee height
   - ⚠️ Borderline: Slightly too large but acceptable
   - ❌ Incorrect: Walker at waist/hip height
2. Random sampling script (20 images/week from each variant)
3. Evaluation form (Google Form or internal tool)
4. Weekly evaluation sessions (product team)
5. Results aggregation and reporting

**Acceptance Criteria:**
- [ ] Rubric clearly defines "correct" vs "incorrect" scale
- [ ] Sampling script generates unbiased sample
- [ ] 2 evaluators per image (inter-rater reliability)
- [ ] Results tracked in spreadsheet/database
- [ ] Report generated weekly with pass/fail rate

**Dependencies:**
- Task 2.2 (need A/B test running to generate images)

---

#### Task 2.4: User Survey Integration
**Owner:** Frontend Engineer Agent
**Priority:** P2
**Estimated Effort:** 2 hours

**Deliverables:**
1. Post-image-acceptance survey modal
   - Trigger: After user accepts a folded-walker image
   - Question: "Does this image accurately represent a compact, portable product?"
   - Options: Yes / Somewhat / No
2. Survey response storage
3. Analytics integration
4. Optional: Free-text feedback field

**Acceptance Criteria:**
- [ ] Survey appears immediately after acceptance (folded state only)
- [ ] Non-blocking (user can dismiss)
- [ ] Response stored with session/image ID
- [ ] Analytics dashboard shows survey results by variant
- [ ] <5% survey abandonment rate

**Dependencies:**
- Task 2.2 (analytics infrastructure)

---

### Feature 2 Rollout Plan

**Week 1:**
- Mon: Task 2.1 (template updates)
- Tue-Wed: Task 2.2 (A/B infrastructure)
- Thu: Tasks 2.3 + 2.4 in parallel
- Fri: Integration testing

**Week 2:**
- Mon: Deploy A/B test to production (50/50 split)
- Tue-Fri: Collect data (target: 100 images per variant)

**Week 3:**
- Mon: Manual evaluation session (40 images)
- Tue: Analyze metrics and survey results
- Wed: Decision meeting (ship optimized to 100% or iterate)
- Thu: Rollout or rollback
- Fri: Retrospective

---

## CROSS-FUNCTIONAL DEPENDENCIES

### Shared Resources
- **Gemini API:** Both features use the same API (prompt generation)
  - Risk: Rate limiting if both features deployed simultaneously
  - Mitigation: Stagger deployments by 1 week

### Team Coordination
- **Product Director:** Approve specifications, final rollout decisions
- **Backend Engineer:** Implement APIs for both features
- **Frontend Engineer:** UI for both features
- **QA Engineer:** E2E testing for both features
- **Data Engineer:** A/B testing infrastructure (Feature 2 only)

### Timeline Conflicts
- **Recommendation:** Prioritize Feature 1 (Prompt Refinement) first
  - Reason: Unblocks user workflow improvements immediately
  - Feature 2 requires 2-week A/B test (longer validation cycle)

---

## RISK ASSESSMENT

### Feature 1 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| AI returns broken prompt structure | Medium | High | Auto-rollback validation |
| Users over-refine (5+ iterations) | Medium | Low | Guidance: "Consider regenerating after 3 refinements" |
| API latency >10s | Low | Medium | Timeout handling, retry logic |
| Product protection bypassed | Low | High | Multi-layer validation (frontend + backend) |

### Feature 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Optimized prompts don't improve scale | Medium | High | A/B test before full rollout |
| Regression in unfolded state | Low | Medium | Monitor unfolded metrics in parallel |
| Template too long (token limit) | Low | Low | Current ~750 words = 1000 tokens (safe) |
| User confusion from A/B test | Low | Medium | Hide variant assignment (transparent to users) |

---

## SUCCESS METRICS SUMMARY

### Feature 1: Prompt Refinement
**Target (after 2 weeks in production):**
- Adoption: 70%+ of sessions use refinement
- Efficiency: 50% reduction in time-to-final-prompt
- Acceptance: 80%+ prompt acceptance rate
- Reliability: 95%+ API success rate

### Feature 2: Product Size Optimization
**Target (after 2-week A/B test):**
- Acceptance: 80%+ first-image acceptance (folded)
- Regenerations: 65% reduction (from 3.5 to 1.2 per image)
- Manual evaluation: 90%+ correct scale rating
- User survey: 85%+ "Yes, it looks compact"

---

## COMMUNICATION PLAN

### Stakeholder Updates

**Weekly Sync (Fridays 3pm):**
- Product Director presents progress
- Engineering agents report blockers
- QA shares test results
- Data team reviews metrics

**Milestone Announcements:**
- Feature 1 Beta Launch (Slack #creative-workspace)
- Feature 2 A/B Test Start (Email to pilot users)
- Final Rollout Decisions (All-hands meeting)

### Documentation Updates
- [ ] Update `/README.md` with new features
- [ ] Add refinement guide to user documentation
- [ ] Create video tutorial for prompt refinement
- [ ] Document A/B test methodology in `/docs/`

---

## APPENDIX: Agent Handoff Checklist

Before passing tasks to implementation agents, ensure:

- [ ] **Specifications Reviewed:** Both requirement docs approved by PM
- [ ] **Dependencies Mapped:** All external dependencies identified
- [ ] **Access Granted:** Agents have credentials for Gemini API, Supabase
- [ ] **Environment Ready:** Staging environment available for testing
- [ ] **Success Criteria Clear:** Agents understand acceptance criteria
- [ ] **Communication Channels:** Slack channel created for async updates

---

**END OF IMPLEMENTATION TASK ASSIGNMENT**

**Next Steps:**
1. Product Director approves this task breakdown
2. Assign agents to specific tasks
3. Kick off implementation (recommended start: Feature 1 first)
4. Weekly progress reviews

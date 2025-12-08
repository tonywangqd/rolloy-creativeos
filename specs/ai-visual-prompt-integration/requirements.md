# PRD: AI Visual Prompt Context Integration

**Document Version:** 1.0
**Created:** 2025-12-08
**Status:** Draft
**Priority:** P0 (Critical Business Issue)

---

## 1. CONTEXT & PROBLEM STATEMENT

### 1.1 Business Context
Rolloy Creative OS is an AI-powered image generation system that creates advertising visuals for mobility products. The system uses an ABCD framework where users select specific codes across five dimensions to generate contextually rich advertising images.

### 1.2 Critical Problem
The system currently does NOT utilize the rich AI Visual Prompt Context stored in the database when generating image prompts. This results in:

- **Poor Quality Images:** Generic, inconsistent visuals that lack contextual depth
- **Wasted Database Investment:** 100+ carefully crafted visual prompt contexts sitting unused
- **Inconsistent Product State Logic:** Hardcoded keyword matching instead of database-driven product state determination
- **Business Logic Fragility:** Changes to action definitions require code deployment instead of database updates

### 1.3 Current Broken Flow

```
User Selection → API receives codes only → Hardcoded keyword matching → Generic prompt generation → Gemini AI → Poor quality images
```

**Example of Current Broken Request:**
```json
{
  "A1": "01-Home",
  "A2": "01-Bedroom",
  "B": "04-Beside",
  "C": "01-Independence",
  "D": "I01-Lifestyle"
}
```

**What Happens:**
1. API receives only the codes (e.g., "04-Beside")
2. Hardcoded function `determineProductState()` matches keywords like "beside" to return "FOLDED"
3. Generic prompt template built from codes: "Environment: 01-Home setting, specifically 01-Bedroom, Action: 04-Beside"
4. Gemini generates prompt WITHOUT the rich context: "State: FOLDED (mostly). User is standing or sitting on a regular chair/ground, engaged in the scene activity. The walker is folded and parked unobtrusively next to them, like a loyal companion."

### 1.4 Expected Flow

```
User Selection → API fetches full ai_visual_prompt for each dimension → Rich context prompt generation → Gemini AI → High quality images
```

**What SHOULD Happen:**
1. API receives the same codes
2. API queries database:
   - `SELECT ai_visual_prompt, product_state FROM b_action WHERE code = '04-Beside'`
   - Returns: "State: FOLDED (mostly). User is standing or sitting on a regular chair/ground, engaged in the [A-Scene] activity..."
   - Returns: product_state = "FOLDED"
3. API queries all other dimensions for their visual contexts
4. Comprehensive prompt built: 150-200 word detailed scenario with all 5 visual contexts
5. Gemini generates prompt with full contextual richness

---

## 2. GOALS & SUCCESS METRICS

### 2.1 Primary Goal
Enable the system to fetch and utilize ai_visual_prompt from the database for all ABCD dimensions during prompt generation.

### 2.2 Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Database Context Utilization | 0% (not fetched) | 100% (all 5 dimensions) | API logs showing database queries |
| Prompt Word Count | 50-80 words | 150-200 words | Prompt analysis |
| Product State Accuracy | ~70% (keyword-based) | 100% (database-driven) | Manual validation of 100 test cases |
| Business Logic Deployment Frequency | 1-2x/week (code changes) | 0 (database updates only) | Deployment logs |
| Image Generation Quality Score | Baseline (establish) | +30% improvement | User rating average |

### 2.3 Non-Goals
- This PRD does NOT cover image generation algorithm changes
- This PRD does NOT cover frontend ABCD selection UX changes
- This PRD does NOT cover database schema changes (schema already exists)
- This PRD does NOT cover multi-language support for prompts

---

## 3. USER STORY

### 3.1 Primary User Story

**As a** Marketing Content Creator
**I want to** generate advertising images with rich contextual details that accurately reflect the emotional drivers, product states, and environmental nuances
**So that** the generated images are immediately usable for campaigns without manual post-editing or regeneration

### 3.2 Acceptance Criteria (Gherkin)

```gherkin
Feature: AI Visual Prompt Context Integration

  Background:
    Given the database contains ai_visual_prompt for all ABCD dimensions
    And the b_action table includes product_state column
    And a user has selected valid ABCD codes

  Scenario: Generate prompt with full database context
    Given the user selects:
      | Dimension | Code           |
      | A1        | 01-Home        |
      | A2        | 01-Bedroom     |
      | B         | 04-Beside      |
      | C         | 01-Independence|
      | D         | I01-Lifestyle  |
    When the system calls POST /api/generate-prompt
    Then the API MUST query the database for ai_visual_prompt for all 5 codes
    And the API MUST fetch product_state from b_action for code "04-Beside"
    And the returned prompt MUST include text from all 5 ai_visual_prompt fields
    And the returned productState MUST equal "FOLDED"
    And the prompt length MUST be 150-200 words
    And the response metadata MUST indicate "database_context_used: true"

  Scenario: Product state determined from database, not hardcoded keywords
    Given the b_action table has:
      | code       | product_state | ai_visual_prompt                              |
      | 04-Beside  | FOLDED        | State: FOLDED (mostly). User is standing...   |
      | 01-Walk    | UNFOLDED      | State: UNFOLDED. User is walking through...   |
    When the user selects B = "04-Beside"
    Then the system MUST read product_state from database
    And the system MUST NOT use hardcoded keyword matching
    And the system MUST return "FOLDED" as productState
    And the reference image URL MUST be FOLDED_IMAGE_URL

  Scenario: Handle missing ai_visual_prompt gracefully
    Given a code "99-TestCode" exists but has empty ai_visual_prompt
    When the system attempts to fetch context
    Then the system MUST log a warning
    And the system MUST fallback to code-only context
    And the system MUST NOT crash

  Scenario: Database query failure fallback
    Given the database connection fails
    When the system attempts to fetch ai_visual_prompt
    Then the system MUST fallback to hardcoded legacy logic
    And the system MUST log an error
    And the system MUST return success with degraded prompt quality
    And the error message MUST indicate "Using fallback prompt generation"

  Scenario: Verify all 5 dimensions are included in prompt
    Given the user selects all ABCD codes
    When the prompt is generated
    Then the prompt MUST contain substring from A1 ai_visual_prompt
    And the prompt MUST contain substring from A2 ai_visual_prompt
    And the prompt MUST contain substring from B ai_visual_prompt
    And the prompt MUST contain substring from C ai_visual_prompt
    And the prompt MUST contain substring from D ai_visual_prompt
```

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 API Layer Changes

#### 4.1.1 POST /api/generate-prompt
**Current Behavior:**
- Receives ABCD selection object (codes only)
- Calls `determineProductState(selection.B)` with keyword matching
- Builds generic prompt from codes

**Required Behavior:**
- Receives ABCD selection object (codes only)
- Fetches full ABCD context from database via new service function
- Passes enriched context to prompt generation
- Returns metadata indicating database context was used

**Request Payload (unchanged):**
```typescript
{
  "selection": {
    "A1": "01-Home",
    "A2": "01-Bedroom",
    "B": "04-Beside",
    "C": "01-Independence",
    "D": "I01-Lifestyle"
  },
  "forceProductState": "FOLDED" // Optional override
}
```

**Response Payload (enhanced):**
```typescript
{
  "success": true,
  "data": {
    "prompt": "A dynamic, eye-level medium shot of...", // 150-200 words
    "productState": "FOLDED",
    "referenceImageUrl": "https://...",
    "creativeName": "20251208_01-Home_01-Bedroom_04-Beside_01-Independence_I01-Lifestyle",
    "metadata": {
      "model": "gemini-2.0-flash-exp",
      "timestamp": "2025-12-08T10:30:00Z",
      "databaseContextUsed": true,  // NEW
      "contextsLoaded": {            // NEW
        "sceneCategory": true,
        "sceneDetail": true,
        "action": true,
        "emotion": true,
        "format": true
      }
    }
  }
}
```

#### 4.1.2 POST /api/generate
**Current Behavior:**
- Receives ABCD selection
- Calls `generateImages()` which internally generates prompt
- Returns images + prompt

**Required Behavior:**
- Same flow but ensure underlying `generatePrompt()` uses database context
- No API contract change needed
- Internal service layer must use new context fetching

---

### 4.2 Service Layer Changes

#### 4.2.1 New Service: abcd-context-service.ts
**Purpose:** Centralized service to fetch ai_visual_prompt from Supabase

**Required Functions:**

```typescript
// Fetch all ABCD contexts for a given selection
export interface ABCDContexts {
  sceneCategory: SceneCategoryContext;
  sceneDetail: SceneDetailContext;
  action: ActionContext;
  emotion: EmotionContext;
  format: FormatContext;
}

export interface SceneCategoryContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
}

export interface ActionContext {
  code: string;
  name_zh: string;
  ai_visual_prompt: string;
  product_state: 'FOLDED' | 'UNFOLDED';  // NEW: from database
}

// Main function
export async function fetchABCDContexts(
  selection: ABCDSelection
): Promise<ABCDContexts>;

// Individual dimension fetchers (for modularity)
export async function fetchSceneCategoryContext(code: string): Promise<SceneCategoryContext>;
export async function fetchSceneDetailContext(code: string): Promise<SceneDetailContext>;
export async function fetchActionContext(code: string): Promise<ActionContext>;
export async function fetchEmotionContext(code: string): Promise<EmotionContext>;
export async function fetchFormatContext(code: string): Promise<FormatContext>;
```

**Database Queries:**
```sql
-- Query 1: Scene Category
SELECT code, name_zh, ai_visual_prompt
FROM a_scene_category
WHERE code = $1;

-- Query 2: Scene Detail
SELECT code, name_zh, category_id, ai_visual_prompt
FROM a_scene_detail
WHERE code = $2;

-- Query 3: Action (includes product_state)
SELECT code, name_zh, ai_visual_prompt, product_state
FROM b_action
WHERE code = $3;

-- Query 4: Emotion
SELECT code, name_zh, ai_visual_prompt
FROM c_emotion
WHERE code = $4;

-- Query 5: Format
SELECT code, name_zh, ai_visual_prompt
FROM d_format
WHERE code = $5;
```

**Error Handling:**
- If database query fails: Log error, return fallback empty context
- If code not found: Log warning, return fallback empty context
- If ai_visual_prompt is empty: Log warning, use code as fallback
- If product_state is NULL for action: Log warning, use legacy `determineProductState()` as fallback

#### 4.2.2 Modified Service: gemini-service.ts

**Current Function:**
```typescript
function buildUserPrompt(selection: ABCDSelection, productState: ProductState): string {
  const context = buildContextString(selection, productState);
  // Uses only codes like "01-Home", "04-Beside"
}
```

**Required Changes:**
```typescript
// NEW signature with contexts
function buildUserPrompt(
  selection: ABCDSelection,
  productState: ProductState,
  contexts: ABCDContexts  // NEW parameter
): string {
  const context = buildEnrichedContextString(selection, productState, contexts);
  // Uses full ai_visual_prompt texts
}

// NEW function
function buildEnrichedContextString(
  selection: ABCDSelection,
  productState: ProductState,
  contexts: ABCDContexts
): string {
  return `
SCENE CATEGORY: ${contexts.sceneCategory.ai_visual_prompt}

SCENE DETAIL: ${contexts.sceneDetail.ai_visual_prompt}

ACTION & PRODUCT STATE: ${contexts.action.ai_visual_prompt}

EMOTIONAL DRIVER/BARRIER: ${contexts.emotion.ai_visual_prompt}

IMAGE FORMAT: ${contexts.format.ai_visual_prompt}

Product State: ${productState} (${productState === 'FOLDED' ? 'compact, portable, folded for storage/transport' : 'in-use, fully open and functional'})
`.trim();
}
```

**Modified Function:**
```typescript
// DEPRECATED: Remove or mark as legacy fallback
export function determineProductState(action: string): ProductState {
  // This should now only be used as fallback when database is unavailable
}

// NEW: Product state from database
export function getProductStateFromContext(actionContext: ActionContext): ProductState {
  return actionContext.product_state || 'UNFOLDED';  // Default fallback
}
```

**Modified Public API:**
```typescript
// Current signature
export async function generatePrompt(request: GeminiPromptRequest): Promise<GeminiPromptResponse>;

// NEW signature (backward compatible via overload)
export async function generatePrompt(
  request: GeminiPromptRequest,
  contexts?: ABCDContexts  // NEW optional parameter
): Promise<GeminiPromptResponse>;
```

**Implementation Logic:**
```typescript
export async function generatePrompt(
  request: GeminiPromptRequest,
  contexts?: ABCDContexts
): Promise<GeminiPromptResponse> {
  // If contexts not provided, fetch them (backward compatibility)
  const abcdContexts = contexts || await fetchABCDContexts(request.selection);

  // Use database product_state if available
  const databaseProductState = abcdContexts.action.product_state;
  const productState = request.productState || databaseProductState || determineProductState(request.selection.B);

  // Build enriched prompt
  const userPrompt = buildUserPrompt(request.selection, productState, abcdContexts);

  // ... rest of generation logic
}
```

---

### 4.3 Business Logic Changes

#### 4.3.1 Product State Determination

**Current Logic (DEPRECATED):**
```typescript
// lib/services/gemini-service.ts lines 96-112
const UNFOLDED_ACTIONS = ['walk', 'sit', 'turn', 'stand', 'rest', 'using', 'stroll', 'push', 'roll'];
const FOLDED_ACTIONS = ['lift', 'pack', 'carry', 'trunk', 'car-trunk', 'store', 'transport', 'fold', 'beside', 'place', 'lean', 'hold'];

export function determineProductState(action: string): ProductState {
  const normalizedAction = action.toLowerCase();
  if (UNFOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'UNFOLDED';
  }
  if (FOLDED_ACTIONS.some(a => normalizedAction.includes(a))) {
    return 'FOLDED';
  }
  return 'UNFOLDED';
}
```

**New Logic (DATABASE-DRIVEN):**
```typescript
// Fetch from database
const actionContext = await fetchActionContext(selection.B);
const productState = actionContext.product_state || 'UNFOLDED';

// Reference image selection
const referenceImageUrl = getReferenceImageUrl(productState);
```

**Migration Path:**
1. Phase 1 (This PRD): Use database product_state as primary, hardcoded as fallback
2. Phase 2 (Future): Ensure ALL actions have product_state in database, remove hardcoded arrays
3. Phase 3 (Future): Delete `determineProductState()` function entirely

---

### 4.4 Data Model Changes

**No schema changes required.** The database schema is already correct:

```sql
-- b_action table already has product_state column
CREATE TABLE b_action (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_zh TEXT NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    product_state TEXT CHECK (product_state IN ('FOLDED', 'UNFOLDED')),  -- Already exists
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Required Data Migration:**
The seed data file (`20251206_abcd_seed_data.sql`) needs to be updated to include `product_state` for all actions:

```sql
-- Example update needed
INSERT INTO b_action (code, name_zh, ai_visual_prompt, product_state, sort_order)
VALUES
  ('01-Walk', '行走模式', 'State: UNFOLDED. User is walking...', 'UNFOLDED', 1),
  ('04-Beside', '旁置陪伴', 'State: FOLDED (mostly). User is standing...', 'FOLDED', 4),
  ...
ON CONFLICT (code) DO UPDATE SET
  product_state = EXCLUDED.product_state;  -- NEW
```

---

## 5. TECHNICAL REQUIREMENTS

### 5.1 Performance Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Database context fetch latency | < 200ms for all 5 queries | Maintain overall API response time < 3s |
| Parallel query execution | All 5 dimensions fetched concurrently | Minimize sequential delays |
| Prompt generation time | < 2s (unchanged) | Gemini API call is the bottleneck, not context fetching |
| API response time | < 5s total (unchanged) | User experience requirement |

### 5.2 Database Query Optimization

**Indexing (already exists):**
```sql
-- These indexes already exist in migration
CREATE INDEX IF NOT EXISTS idx_a_scene_category_code ON a_scene_category(code);
CREATE INDEX IF NOT EXISTS idx_a_scene_detail_code ON a_scene_detail(code);
CREATE INDEX IF NOT EXISTS idx_b_action_code ON b_action(code);
CREATE INDEX IF NOT EXISTS idx_c_emotion_code ON c_emotion(code);
CREATE INDEX IF NOT EXISTS idx_d_format_code ON d_format(code);
```

**Query Batching:**
Use Supabase batch query or Promise.all() for parallel fetching:

```typescript
const [sceneCategory, sceneDetail, action, emotion, format] = await Promise.all([
  fetchSceneCategoryContext(selection.A1),
  fetchSceneDetailContext(selection.A2),
  fetchActionContext(selection.B),
  fetchEmotionContext(selection.C),
  fetchFormatContext(selection.D),
]);
```

### 5.3 Caching Strategy

**Phase 1 (This PRD):** No caching - fetch fresh from database every time
- Rationale: ABCD data changes frequently during early content development
- Complexity: Low
- Latency impact: Acceptable (200ms)

**Phase 2 (Future Optimization):** Implement Redis cache
- Cache key: `abcd:context:{dimension}:{code}`
- TTL: 1 hour
- Invalidation: On ABCD data update via admin UI

### 5.4 Error Handling Matrix

| Error Scenario | Handling Strategy | User Impact |
|----------------|------------------|-------------|
| Database connection timeout | Fallback to hardcoded legacy logic | Degraded prompt quality, log error |
| Code not found in database | Use code value as fallback | Minimal impact, log warning |
| Empty ai_visual_prompt | Use code value as fallback | Minimal impact, log warning |
| Partial context fetch failure (e.g., 4/5 succeed) | Use successful contexts, fallback for failed | Degraded prompt quality, log warning |
| Complete context fetch failure (0/5 succeed) | Full fallback to legacy logic | Degraded prompt quality, log error |
| product_state is NULL | Use legacy `determineProductState()` | Potential state inaccuracy, log warning |

### 5.5 Logging Requirements

**New Log Events:**
```typescript
// Success case
logger.info('ABCD contexts loaded', {
  selection: { A1, A2, B, C, D },
  contextsLoaded: { sceneCategory: true, sceneDetail: true, ... },
  productState: 'FOLDED',
  promptLength: 187,
  latency: '145ms'
});

// Fallback case
logger.warn('Failed to fetch action context, using fallback', {
  code: '04-Beside',
  error: 'Database timeout',
  fallbackState: 'FOLDED'
});

// Error case
logger.error('Complete context fetch failure', {
  selection: { A1, A2, B, C, D },
  error: 'Supabase connection refused',
  fallbackMode: 'legacy'
});
```

---

## 6. BUSINESS RULES MATRIX

### 6.1 Product State Determination Logic

| Action Code | Action Name | Database product_state | Legacy Keyword Match | Final State | Reference Image |
|-------------|-------------|----------------------|-------------------|-------------|----------------|
| 01-Walk | 行走模式 | UNFOLDED | walk | UNFOLDED | UNFOLDED_IMAGE_URL |
| 02-Navigate | 操控模式 | UNFOLDED | N/A | UNFOLDED | UNFOLDED_IMAGE_URL |
| 03-Engage | 坐姿互动 | UNFOLDED | sit | UNFOLDED | UNFOLDED_IMAGE_URL |
| 04-Beside | 旁置陪伴 | FOLDED | beside | FOLDED | FOLDED_IMAGE_URL |
| 05-Transition | 收纳搬运 | FOLDED | lift, pack, carry | FOLDED | FOLDED_IMAGE_URL |
| 06-Detail | 细节特写 | UNFOLDED | N/A | UNFOLDED | UNFOLDED_IMAGE_URL |

### 6.2 Context Inclusion Rules

| Dimension | Table | Column | Required in Prompt | Fallback if Missing |
|-----------|-------|--------|-------------------|-------------------|
| A1 - Scene Category | a_scene_category | ai_visual_prompt | YES | Use code value (e.g., "01-Home setting") |
| A2 - Scene Detail | a_scene_detail | ai_visual_prompt | YES | Use code value (e.g., "01-Bedroom") |
| B - Action | b_action | ai_visual_prompt | YES | Use code value (e.g., "04-Beside action") |
| B - Product State | b_action | product_state | YES | Use legacy keyword matching |
| C - Emotion | c_emotion | ai_visual_prompt | YES | Use code value |
| D - Format | d_format | ai_visual_prompt | YES | Use code value |

### 6.3 Prompt Structure Rules

**Current Prompt Structure (DEPRECATED):**
```
Environment: {A1} setting, specifically {A2}
Action: {B}
Characters: {C}
Emotion/Mood: {D}
Product State: {productState} (description)
```

**New Prompt Structure (REQUIRED):**
```
SCENE CATEGORY CONTEXT:
{sceneCategory.ai_visual_prompt}

SCENE DETAIL CONTEXT:
{sceneDetail.ai_visual_prompt}

ACTION & PRODUCT STATE:
{action.ai_visual_prompt}
(Product State: {productState})

EMOTIONAL DRIVER/BARRIER:
{emotion.ai_visual_prompt}

IMAGE FORMAT SPECIFICATION:
{format.ai_visual_prompt}

[Rest of system prompt guidance for shot type, subject, clothing, etc.]
```

---

## 7. IMPLEMENTATION PLAN

### 7.1 Development Phases

**Phase 1: Foundation (Week 1)**
- Create `lib/services/abcd-context-service.ts`
- Implement database query functions
- Add unit tests for context fetching
- Update `lib/types/abcd.ts` with new context interfaces

**Phase 2: Service Integration (Week 1-2)**
- Modify `gemini-service.ts` to accept contexts parameter
- Implement `buildEnrichedContextString()`
- Add fallback logic for backward compatibility
- Update `generatePrompt()` function signature

**Phase 3: API Updates (Week 2)**
- Modify `/api/generate-prompt/route.ts` to fetch contexts
- Modify `/api/generate/route.ts` to use new flow
- Add metadata fields to responses
- Update API documentation

**Phase 4: Data Migration (Week 2)**
- Update seed data SQL to include `product_state` for all actions
- Run migration on staging database
- Validate data integrity
- Deploy to production database

**Phase 5: Testing & Validation (Week 3)**
- End-to-end testing with 50 test cases
- Compare legacy vs. new prompt quality
- Performance testing (latency, concurrent requests)
- Error scenario testing (database failures)

**Phase 6: Deployment (Week 3)**
- Deploy to staging environment
- A/B test: 10% traffic to new flow
- Monitor logs for errors
- Full rollout if metrics pass

### 7.2 Rollback Plan

**Rollback Trigger Conditions:**
- API latency increases by > 50%
- Error rate > 5%
- Image generation success rate drops by > 10%

**Rollback Steps:**
1. Revert API route handlers to previous version
2. Keep new service layer code but disable via feature flag
3. Database changes remain (backward compatible)
4. Investigate issues in non-production environment

### 7.3 Testing Strategy

**Unit Tests:**
- `abcd-context-service.test.ts`: Test all fetch functions
- `gemini-service.test.ts`: Test enriched prompt building
- Mock Supabase responses for deterministic tests

**Integration Tests:**
- End-to-end test: POST /api/generate-prompt with database
- Test all error scenarios (network failure, missing codes, etc.)
- Validate prompt length and structure

**Performance Tests:**
- Load test: 100 concurrent requests
- Measure database query latency
- Measure total API response time

**Acceptance Tests:**
- Manual test: Generate 20 images with new flow
- Compare with 20 images from legacy flow
- User rating comparison (quality score)

---

## 8. RISKS & MITIGATIONS

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Database query latency increases API response time | Medium | Medium | Implement parallel queries, add caching in Phase 2 |
| Supabase connection failures cause API downtime | Low | High | Implement robust fallback to legacy logic |
| ai_visual_prompt data is incomplete or low quality | Medium | Medium | Data validation script before deployment |
| Product state values missing from database | Medium | Medium | Keep legacy keyword matching as fallback |
| Prompt length exceeds Gemini token limits | Low | High | Add prompt length validation and truncation logic |

### 8.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| New prompts generate worse images than legacy | Medium | High | A/B testing before full rollout |
| Content team needs frequent prompt updates | High | Low | This is actually a benefit - database updates are easier than code deploys |
| Training required for content team to update prompts | Low | Low | Document database structure, provide admin UI (existing) |

### 8.3 Data Quality Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| ai_visual_prompt contains typos or formatting errors | Medium | Medium | Pre-deployment data audit |
| Inconsistent prompt style across dimensions | Medium | Medium | Define prompt writing standards document |
| Duplicate or conflicting contexts | Low | Medium | Add database constraints for uniqueness |

---

## 9. MONITORING & SUCCESS VALIDATION

### 9.1 Key Performance Indicators (KPIs)

**Week 1 Post-Deployment:**
- API error rate < 1%
- Average prompt length: 150-200 words (target: 175 words)
- Database context fetch success rate > 95%
- API response time < 5 seconds (p95)

**Week 2-4 Post-Deployment:**
- Image generation success rate (no change from baseline)
- User rating average: +30% improvement
- Number of image regeneration requests: -20%
- Code deployment frequency for prompt changes: 0

### 9.2 Monitoring Dashboard

**Metrics to Track:**
```
1. Context Fetch Metrics
   - contexts_fetched_total (counter)
   - contexts_fetch_latency_ms (histogram)
   - contexts_fetch_errors_total (counter by dimension)

2. Prompt Generation Metrics
   - prompts_generated_total (counter)
   - prompt_length_words (histogram)
   - database_context_used_ratio (gauge)

3. Product State Metrics
   - product_state_from_database_total (counter)
   - product_state_from_fallback_total (counter)
   - product_state_accuracy (gauge, manual validation)

4. API Performance
   - api_response_time_ms (histogram)
   - api_error_rate (gauge)
```

### 9.3 Alerting Rules

**Critical Alerts:**
- API error rate > 5% for 5 minutes → Page on-call engineer
- Database context fetch failure rate > 10% for 5 minutes → Page on-call engineer
- API p95 latency > 10 seconds for 5 minutes → Alert engineering team

**Warning Alerts:**
- Database context fetch latency > 500ms for 10 minutes → Alert engineering team
- Fallback to legacy logic > 20% of requests for 10 minutes → Alert engineering team
- Prompt length < 100 words or > 250 words for 10% of requests → Alert content team

---

## 10. DEPENDENCIES & ASSUMPTIONS

### 10.1 Dependencies

**Technical:**
- Supabase database is available and performant
- Database schema migration `20251206_abcd_data_management.sql` is deployed
- Seed data includes complete ai_visual_prompt for all codes
- Existing Gemini API integration remains functional

**Team:**
- Content team provides high-quality ai_visual_prompt texts
- Engineering team bandwidth for 3-week development cycle
- QA team bandwidth for testing

### 10.2 Assumptions

**Technical Assumptions:**
- Database query latency will be < 200ms per dimension
- Supabase connection pool can handle concurrent queries
- Gemini API token limits will accommodate 150-200 word prompts
- No breaking changes to Gemini API during development

**Business Assumptions:**
- Current hardcoded keyword matching is < 100% accurate
- Rich contextual prompts will improve image quality
- Content team will maintain prompt quality in database
- Users will perceive image quality improvement

**Data Assumptions:**
- All ABCD codes in use have corresponding database records
- ai_visual_prompt texts are 50-300 characters per dimension
- product_state values are correct for all actions
- Prompt structure follows documented standards

---

## 11. OPEN QUESTIONS

### 11.1 Technical Questions
1. Should we implement request-level caching (in-memory) before database caching?
2. What is the acceptable fallback rate before we alert?
3. Should we batch database queries into a single stored procedure call?

### 11.2 Product Questions
1. Should we expose the ai_visual_prompt texts to users in the UI for transparency?
2. Should users be able to override or customize the prompts per session?
3. Should we version control prompt changes for auditing?

### 11.3 Content Questions
1. Who is responsible for maintaining ai_visual_prompt quality?
2. What is the review process for prompt changes?
3. Should we support A/B testing different prompts for the same code?

---

## 12. APPENDIX

### 12.1 Database Schema Reference

```sql
-- Table: a_scene_category
CREATE TABLE a_scene_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_zh TEXT NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: b_action
CREATE TABLE b_action (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_zh TEXT NOT NULL,
    ai_visual_prompt TEXT NOT NULL,
    product_state TEXT CHECK (product_state IN ('FOLDED', 'UNFOLDED')),
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Similar structure for: a_scene_detail, c_emotion, d_format
```

### 12.2 Example Enriched Prompt

**Input Selection:**
```json
{
  "A1": "01-Home",
  "A2": "01-Bedroom",
  "B": "04-Beside",
  "C": "01-Independence",
  "D": "I01-Lifestyle"
}
```

**Generated Enriched Prompt (Target):**
```
SCENE CATEGORY CONTEXT:
This category encompasses both private residences and professional nursing facilities. It represents the senior's primary living environment. CRITICAL INSTRUCTION: You MUST refer to the specific 'A-Scene Detail' input to determine the setting style. If Detail is 01-04, render a cozy, personal, warm private home.

SCENE DETAIL CONTEXT:
[Private Home] A cozy bedroom with a bed, nightstand, and soft morning light. Tight spaces between furniture. Personal photos on the dresser. Warm, lived-in atmosphere.

ACTION & PRODUCT STATE:
State: FOLDED (mostly). User is standing or sitting on a regular chair/ground, engaged in the [A-Scene] activity. The walker is folded and parked unobtrusively next to them, like a loyal companion.
(Product State: FOLDED)

EMOTIONAL DRIVER/BARRIER:
Driver: Autonomy. Senior performing a task alone, with an expression of self-reliance and quiet pride. They look empowered, not lonely. Emphasis on choice and freedom.

IMAGE FORMAT SPECIFICATION:
Cinematic lifestyle shot, wide aperture (f/1.8), focus on the senior's emotion and the environment, golden hour lighting, aspirational vibe.

Generate a DETAILED commercial advertising image prompt (150-200 words) for this scenario:

[System prompt continues with shot type, subject, clothing, camera specs, etc.]
```

### 12.3 File Paths Reference

**Files to Create:**
- `/Users/tony/rolloy-creativeos/lib/services/abcd-context-service.ts`

**Files to Modify:**
- `/Users/tony/rolloy-creativeos/lib/services/gemini-service.ts`
- `/Users/tony/rolloy-creativeos/app/api/generate-prompt/route.ts`
- `/Users/tony/rolloy-creativeos/app/api/generate/route.ts`
- `/Users/tony/rolloy-creativeos/lib/types/abcd.ts`

**Files to Review (No Changes):**
- `/Users/tony/rolloy-creativeos/supabase/migrations/20251206_abcd_data_management.sql`
- `/Users/tony/rolloy-creativeos/supabase/migrations/20251206_abcd_seed_data.sql`

---

## DOCUMENT APPROVAL

**Product Director:** [Signature Required]
**Engineering Lead:** [Signature Required]
**Content Lead:** [Signature Required]

**Date:** 2025-12-08

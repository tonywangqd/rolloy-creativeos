# Data Persistence Test Plan
**Rolloy Creative OS v3.35.4**

**Test Engineer:** Claude Opus 4.5
**Created:** 2025-12-12T13:50:19+08:00
**Last Updated:** 2025-12-12T13:50:19+08:00

---

## 1. Test Scope

### In Scope
- Chinese translation persistence (prompt_chinese)
- Video prompt persistence (video_prompt)
- Image storage and retrieval (storage_url)
- Version management (V1/V2/V3/V4)
- Cross-device synchronization
- Data recovery after page refresh
- Race condition handling

### Out of Scope
- Image generation quality
- UI/UX testing
- Performance benchmarking (separate test plan)
- Security penetration testing (separate audit)

---

## 2. Test Environment Setup

### Prerequisites
```bash
# 1. Verify environment variables
cat .env.local | grep -E "SUPABASE|GEMINI"

# Required variables:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# GEMINI_API_KEY

# 2. Verify database migrations
# Check Supabase Dashboard → Database → Migrations
# Required migrations:
# - 20251210_prompt_versions.sql
# - 20251212_add_video_prompt.sql

# 3. Start development server
npm run dev
```

### Test Data
```sql
-- Create test session (run in Supabase SQL Editor)
INSERT INTO generation_sessions (
  creative_name,
  abcd_selection,
  prompt,
  product_state,
  reference_image_url,
  total_images,
  status
) VALUES (
  'QA_Test_Session_001',
  '{"A1": "Outdoor", "A2": "Park", "B": "Walking", "C": "Elderly", "D": "Photo"}',
  'A red Rolloy walker in a park with elderly person walking',
  'UNFOLDED',
  'https://example.com/walker.jpg',
  4,
  'draft'
) RETURNING id;

-- Save the returned ID for testing
```

---

## 3. Manual Test Cases

### TC-001: New Session - Chinese Translation Persistence

**Priority:** Critical
**Test Type:** Functional
**Estimated Time:** 5 minutes

**Preconditions:**
- Fresh browser session
- No existing sessions in localStorage

**Steps:**
1. Open http://localhost:3000
2. Complete ABCD selection:
   - Scene Category: Outdoor
   - Scene Detail: Park
   - Action: Walking with walker
   - Driver: Elderly person
   - Format: Photo
3. Click "Preview Prompt"
4. Wait for English prompt to appear
5. Observe Chinese translation area (right panel)
6. Wait 3-5 seconds for translation to complete
7. Note the Chinese text
8. Open browser DevTools → Application → Local Storage
9. Verify "rolloy_prompt_versions" contains Chinese text
10. Refresh the page (F5)
11. Verify Chinese text is still displayed

**Expected Results:**
- ✅ Chinese translation appears within 5 seconds
- ✅ Chinese text is stored in localStorage
- ✅ Chinese text persists after page refresh
- ✅ No console errors

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence (Screenshot):**
- [ ] Chinese text visible
- [ ] localStorage data
- [ ] After refresh

---

### TC-002: New Session - Video Prompt Persistence

**Priority:** Critical
**Test Type:** Functional
**Estimated Time:** 5 minutes

**Preconditions:**
- Session from TC-001 exists
- On "Prompt Preview" step

**Steps:**
1. Continue from TC-001 (or create new session)
2. Scroll down to prompt area
3. Locate "Video Prompt" section (orange gradient box)
4. Note the placeholder text "Click 'Video Prompt' button to generate"
5. Scroll to bottom of page
6. Click "Generate 4 Images" button (to create session in cloud)
7. Wait for images to start generating (at least 1 image)
8. Scroll back to prompt panel
9. Click "Video Prompt" button (orange button)
10. Wait for video prompt to generate (5-10 seconds)
11. Note the generated video prompt text
12. Open browser DevTools → Network tab
13. Find PATCH request to `/api/sessions/[id]/versions/[versionId]`
14. Verify request body contains `video_prompt` field
15. Refresh page
16. Verify video prompt text is restored

**Expected Results:**
- ✅ Video prompt generated successfully
- ✅ PATCH request sent to cloud with video_prompt
- ✅ Video prompt persists after refresh
- ✅ No console errors

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence:**
- [ ] Video prompt text
- [ ] Network request payload
- [ ] After refresh

---

### TC-003: Multi-Version - Chinese Translation for Each Version

**Priority:** Critical
**Test Type:** Functional
**Estimated Time:** 10 minutes

**Preconditions:**
- Session from TC-002 exists with V1

**Steps:**
1. Continue from TC-002
2. Note current Chinese translation (V1 Chinese)
3. Locate "AI Prompt Refinement" section (purple gradient box)
4. Enter refinement instruction: "Make the elderly person younger, around 40 years old"
5. Click "Refine" button (purple)
6. Wait for V2 prompt to generate
7. Verify version selector shows "V1 V2" (amber buttons)
8. Verify "Current: V2" label is displayed
9. Wait for Chinese translation of V2 to appear
10. Note V2 Chinese text (should be different from V1)
11. Click "V1" button in version selector
12. Verify English prompt changes to V1
13. Verify Chinese text changes to V1 Chinese
14. Click "V2" button
15. Verify English and Chinese change back to V2
16. Refresh page
17. Verify both V1 and V2 exist in version selector
18. Verify switching between versions restores correct Chinese

**Expected Results:**
- ✅ V2 created successfully
- ✅ V2 has its own Chinese translation (different from V1)
- ✅ Version selector allows switching
- ✅ Chinese translation switches correctly
- ✅ Both versions persist after refresh
- ✅ No console errors

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence:**
- [ ] V1 Chinese text: _______________________
- [ ] V2 Chinese text: _______________________
- [ ] Version selector screenshot
- [ ] After refresh

---

### TC-004: Image-Version Linking

**Priority:** Critical
**Test Type:** Functional
**Estimated Time:** 15 minutes

**Preconditions:**
- Session from TC-003 exists with V1 and V2

**Steps:**
1. Continue from TC-003
2. Ensure V1 is active (click V1 button)
3. Click "Generate 4 More" images
4. Wait for 4 images to complete
5. Verify each image has "V1" badge in bottom-right corner
6. Click V2 button to switch to V2
7. Click "Generate 4 More" images
8. Wait for 4 images to complete
9. Verify these new images have "V2" badge
10. Refresh page
11. Scroll through all images
12. Count V1-badged images (should be 8: 4 from TC-002 + 4 from step 3)
13. Count V2-badged images (should be 4 from step 7)
14. Open Supabase Dashboard → Table Editor → generated_images_v2
15. Filter by session_id (copy from URL)
16. Verify first 8 images have prompt_version_id matching V1
17. Verify last 4 images have prompt_version_id matching V2

**Expected Results:**
- ✅ Images show correct version badge
- ✅ Version badges persist after refresh
- ✅ Database has correct prompt_version_id foreign key
- ✅ Image count matches expectations (12 total)

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________
- [ ] V1 images: ___ (expected 8)
- [ ] V2 images: ___ (expected 4)

**Evidence:**
- [ ] Image gallery screenshot with badges
- [ ] Database screenshot showing prompt_version_id

---

### TC-005: Cross-Device Sync

**Priority:** Critical
**Test Type:** Integration
**Estimated Time:** 10 minutes

**Preconditions:**
- Session from TC-004 exists
- Two devices/browsers available (or use Incognito mode)

**Steps:**
1. On Device 1: Note current session ID from URL
2. On Device 1: Verify session has:
   - V1 with Chinese translation
   - V2 with Chinese translation
   - V1 with video prompt (if generated)
   - 12 images (8 V1, 4 V2)
3. On Device 2: Open http://localhost:3000
4. On Device 2: Wait for sessions list to load
5. On Device 2: Click on the test session (QA_Test_Session_001)
6. On Device 2: Wait for session to load
7. On Device 2: Verify version selector shows V1 and V2
8. On Device 2: Verify current version is V2 (active version)
9. On Device 2: Verify English prompt matches Device 1
10. On Device 2: Verify Chinese translation is displayed
11. On Device 2: Verify Video Prompt is displayed (if exists)
12. On Device 2: Scroll through image gallery
13. On Device 2: Verify all 12 images are displayed
14. On Device 2: Verify version badges (V1/V2) match Device 1
15. On Device 2: Switch to V1 in version selector
16. On Device 2: Verify Chinese translation for V1 appears
17. On Device 2: Click "Generate 4 More" for V1
18. On Device 1: Refresh page after images complete
19. On Device 1: Verify new V1 images appear (total 12 V1 images now)

**Expected Results:**
- ✅ All data syncs across devices
- ✅ Chinese translations restored on Device 2
- ✅ Video prompts restored on Device 2
- ✅ Images displayed correctly with version badges
- ✅ New images generated on Device 2 sync to Device 1

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence:**
- [ ] Device 1 screenshot
- [ ] Device 2 screenshot (after sync)
- [ ] Image count on both devices

---

### TC-006: Race Condition - Fast Refinement

**Priority:** High
**Test Type:** Edge Case
**Estimated Time:** 5 minutes

**Preconditions:**
- New session (or reset existing)

**Steps:**
1. Create new session with ABCD selection
2. Click "Preview Prompt"
3. IMMEDIATELY (before Chinese translation completes):
   - Enter refinement: "Add sunset lighting"
   - Click "Refine" button
4. Wait for V2 prompt to generate
5. Note if V1 Chinese translation appears (should be empty or loading)
6. Wait 5 seconds for V2 Chinese to appear
7. Refresh page
8. Click V1 button
9. Verify V1 Chinese translation (should exist now, synced later)
10. Click V2 button
11. Verify V2 Chinese translation exists

**Expected Results:**
- ✅ No errors/crashes when refining before translation completes
- ✅ V1 Chinese may be empty initially (acceptable)
- ✅ V2 Chinese appears within 5 seconds
- ✅ V1 Chinese eventually syncs (check after refresh)
- ✅ No console errors (warnings are acceptable)

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence:**
- [ ] Console screenshot (check for errors)
- [ ] V1 Chinese status: _______________________
- [ ] V2 Chinese status: _______________________

---

### TC-007: Empty State Handling

**Priority:** Medium
**Test Type:** Edge Case
**Estimated Time:** 5 minutes

**Preconditions:**
- Access to Supabase Dashboard

**Steps:**
1. In Supabase Dashboard → Table Editor → prompt_versions
2. Find a test version
3. Set prompt_chinese = NULL
4. Set video_prompt = NULL
5. Save changes
6. In app, reload the session
7. Verify English prompt still displays
8. Verify Chinese translation area shows placeholder text
9. Verify Video Prompt area shows placeholder text
10. Generate new Chinese translation (wait for it)
11. Generate video prompt
12. Verify both fields update in database

**Expected Results:**
- ✅ App handles NULL fields gracefully
- ✅ Placeholder text shown for empty fields
- ✅ No crashes or console errors
- ✅ New translations update database correctly

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________

**Evidence:**
- [ ] Screenshot with NULL fields
- [ ] Database before/after

---

### TC-008: Large Dataset (Stress Test)

**Priority:** Low
**Test Type:** Performance
**Estimated Time:** 30 minutes

**Preconditions:**
- Session with multiple versions (V1-V5 recommended)

**Steps:**
1. Create session with V1
2. Generate 4 images for V1
3. Refine to create V2, generate 4 images
4. Refine to create V3, generate 4 images
5. Refine to create V4, generate 4 images
6. Refine to create V5, generate 4 images
7. Total: 5 versions, 20 images
8. Refresh page
9. Measure page load time
10. Verify all versions appear in selector
11. Test switching between versions
12. Scroll through all 20 images
13. Check browser memory usage (DevTools → Memory)
14. Verify no memory leaks

**Expected Results:**
- ✅ Page loads within 3 seconds
- ✅ All 5 versions displayed
- ✅ Version switching smooth (<500ms)
- ✅ Image gallery renders correctly
- ✅ Memory usage reasonable (<500MB)
- ✅ No performance degradation

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe): _______________________
- [ ] Load time: ___ seconds
- [ ] Memory usage: ___ MB

**Evidence:**
- [ ] Performance timeline screenshot
- [ ] Memory snapshot

---

## 4. Automated Test Cases (Future Implementation)

### Unit Tests

```typescript
// __tests__/services/prompt-version-service.test.ts

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createPromptVersion,
  listPromptVersions,
  getActiveVersion,
} from '@/lib/services/prompt-version-service';

describe('PromptVersionService', () => {
  let testSessionId: string;

  beforeAll(async () => {
    // Create test session
    const session = await createTestSession();
    testSessionId = session.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await deleteTestSession(testSessionId);
  });

  test('TC-AUTO-001: createPromptVersion should increment version_number', async () => {
    // Create V1
    const v1 = await createPromptVersion({
      session_id: testSessionId,
      prompt: 'Test prompt V1',
      prompt_chinese: '测试提示 V1',
      video_prompt: 'Video prompt V1',
      product_state: 'UNFOLDED',
      reference_image_url: 'https://example.com/image.jpg',
      created_from: 'initial',
    });

    expect(v1.version_number).toBe(1);

    // Create V2
    const v2 = await createPromptVersion({
      session_id: testSessionId,
      prompt: 'Test prompt V2',
      prompt_chinese: '测试提示 V2',
      video_prompt: 'Video prompt V2',
      product_state: 'UNFOLDED',
      reference_image_url: 'https://example.com/image.jpg',
      created_from: 'refinement',
      refinement_instruction: 'Make it better',
    });

    expect(v2.version_number).toBe(2);
  });

  test('TC-AUTO-002: only one version should be active per session', async () => {
    const activeVersions = await listPromptVersions(testSessionId);
    const activeCount = activeVersions.filter(v => v.is_active).length;

    expect(activeCount).toBe(1);
  });

  test('TC-AUTO-003: listPromptVersions should return Chinese and Video prompts', async () => {
    const versions = await listPromptVersions(testSessionId);

    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0]).toHaveProperty('prompt_chinese');
    expect(versions[0]).toHaveProperty('video_prompt');
  });

  test('TC-AUTO-004: getActiveVersion should return correct version', async () => {
    const activeVersion = await getActiveVersion(testSessionId);

    expect(activeVersion).not.toBeNull();
    expect(activeVersion?.is_active).toBe(true);
  });

  test('TC-AUTO-005: Chinese translation should persist', async () => {
    const v1 = await createPromptVersion({
      session_id: testSessionId,
      prompt: 'English prompt',
      prompt_chinese: '中文提示',
      product_state: 'UNFOLDED',
      reference_image_url: 'https://example.com/image.jpg',
      created_from: 'initial',
    });

    const retrieved = await getPromptVersion(v1.version.id);
    expect(retrieved.prompt_chinese).toBe('中文提示');
  });

  test('TC-AUTO-006: Video prompt should persist', async () => {
    const v1 = await createPromptVersion({
      session_id: testSessionId,
      prompt: 'Image prompt',
      video_prompt: 'Video prompt for Sora',
      product_state: 'UNFOLDED',
      reference_image_url: 'https://example.com/image.jpg',
      created_from: 'initial',
    });

    const retrieved = await getPromptVersion(v1.version.id);
    expect(retrieved.video_prompt).toBe('Video prompt for Sora');
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/data-persistence.test.ts

import { describe, test, expect } from '@jest/globals';

describe('Data Persistence Integration', () => {
  test('TC-INT-001: End-to-end session creation and reload', async () => {
    // 1. Create session
    const session = await createSession({
      creative_name: 'Integration Test',
      prompt: 'Test prompt',
      // ... other fields
    });

    // 2. Create V1 with Chinese
    const v1 = await createPromptVersion({
      session_id: session.id,
      prompt: 'Test prompt',
      prompt_chinese: '测试提示',
      // ... other fields
    });

    // 3. Generate images
    await generateImages(session.id, v1.version.id, 4);

    // 4. Reload session (simulate page refresh)
    const reloaded = await loadSession(session.id);

    // 5. Verify data
    expect(reloaded.prompt_versions).toHaveLength(1);
    expect(reloaded.prompt_versions[0].prompt_chinese).toBe('测试提示');
    expect(reloaded.images).toHaveLength(4);
    expect(reloaded.images[0].prompt_version_id).toBe(v1.version.id);
  });

  test('TC-INT-002: Multi-version workflow', async () => {
    // Create session with V1
    const session = await createSessionWithVersion();

    // Refine to V2
    const v2 = await refinePrompt(session.id, 'Make it better');

    // Generate images for V2
    await generateImages(session.id, v2.id, 4);

    // Reload and verify
    const reloaded = await loadSession(session.id);
    expect(reloaded.prompt_versions).toHaveLength(2);
    expect(reloaded.images.filter(img => img.prompt_version_id === v2.id)).toHaveLength(4);
  });

  test('TC-INT-003: Cross-device sync simulation', async () => {
    // Device 1: Create and modify
    const sessionId = await createSessionOnDevice1();
    await updateChineseTranslation(sessionId, 'V1', '中文翻译');

    // Device 2: Load session
    const loadedSession = await loadSessionOnDevice2(sessionId);

    // Verify sync
    expect(loadedSession.prompt_versions[0].prompt_chinese).toBe('中文翻译');
  });
});
```

---

## 5. Database Validation Queries

### Query 1: Verify All Sessions Have Versions
```sql
-- Should return 0 rows (all sessions should have at least one version)
SELECT
  gs.id,
  gs.creative_name,
  gs.created_at
FROM generation_sessions gs
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_versions pv WHERE pv.session_id = gs.id
);
```

**Expected:** 0 rows
**Actual:** _______

### Query 2: Verify Only One Active Version Per Session
```sql
-- Should return 0 rows (each session should have exactly 1 active version)
SELECT
  session_id,
  COUNT(*) as active_count
FROM prompt_versions
WHERE is_active = true
GROUP BY session_id
HAVING COUNT(*) != 1;
```

**Expected:** 0 rows
**Actual:** _______

### Query 3: Verify Images Linked to Versions
```sql
-- Should return 0 rows (all images should have prompt_version_id)
SELECT
  id,
  session_id,
  image_index,
  created_at
FROM generated_images_v2
WHERE prompt_version_id IS NULL
  AND created_at > '2025-12-10'  -- After version feature was deployed
ORDER BY created_at DESC;
```

**Expected:** 0 rows (for new images)
**Actual:** _______

### Query 4: Check Chinese Translation Coverage
```sql
-- Show percentage of versions with Chinese translation
SELECT
  COUNT(*) as total_versions,
  COUNT(prompt_chinese) as versions_with_chinese,
  ROUND(COUNT(prompt_chinese) * 100.0 / COUNT(*), 2) as coverage_percentage
FROM prompt_versions;
```

**Expected:** >80% coverage
**Actual:** _______

### Query 5: Check Video Prompt Coverage
```sql
-- Show percentage of versions with video prompt
SELECT
  COUNT(*) as total_versions,
  COUNT(video_prompt) as versions_with_video,
  ROUND(COUNT(video_prompt) * 100.0 / COUNT(*), 2) as coverage_percentage
FROM prompt_versions;
```

**Expected:** Variable (depends on user usage)
**Actual:** _______

---

## 6. API Testing (Postman/cURL)

### Test 1: GET Versions
```bash
# Get all versions for a session
SESSION_ID="<your-session-id>"

curl -X GET "http://localhost:3000/api/sessions/${SESSION_ID}/versions" \
  -H "Content-Type: application/json"

# Expected Response:
# {
#   "success": true,
#   "data": {
#     "versions": [
#       {
#         "id": "uuid",
#         "version_number": 1,
#         "prompt": "...",
#         "prompt_chinese": "...",
#         "video_prompt": "...",
#         ...
#       }
#     ],
#     "active_version_id": "uuid"
#   }
# }
```

**Result:** [ ] Pass [ ] Fail

### Test 2: POST Create Version
```bash
# Create new version with Chinese and Video
SESSION_ID="<your-session-id>"

curl -X POST "http://localhost:3000/api/sessions/${SESSION_ID}/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test prompt",
    "prompt_chinese": "测试提示",
    "video_prompt": "Test video prompt",
    "product_state": "UNFOLDED",
    "reference_image_url": "https://example.com/image.jpg",
    "created_from": "refinement",
    "refinement_instruction": "Test refinement"
  }'

# Expected Response:
# {
#   "success": true,
#   "data": {
#     "version": { ... },
#     "version_number": 2
#   }
# }
```

**Result:** [ ] Pass [ ] Fail

### Test 3: PATCH Update Chinese
```bash
# Update Chinese translation
SESSION_ID="<your-session-id>"
VERSION_ID="<version-uuid>"

curl -X PATCH "http://localhost:3000/api/sessions/${SESSION_ID}/versions/${VERSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_chinese": "更新的中文翻译"
  }'

# Expected Response:
# {
#   "success": true,
#   "data": {
#     "version": { "prompt_chinese": "更新的中文翻译", ... }
#   }
# }
```

**Result:** [ ] Pass [ ] Fail

### Test 4: PATCH Update Video Prompt
```bash
# Update video prompt
SESSION_ID="<your-session-id>"
VERSION_ID="<version-uuid>"

curl -X PATCH "http://localhost:3000/api/sessions/${SESSION_ID}/versions/${VERSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "video_prompt": "Updated video prompt for Runway ML"
  }'

# Expected Response:
# {
#   "success": true,
#   "data": {
#     "version": { "video_prompt": "Updated video prompt for Runway ML", ... }
#   }
# }
```

**Result:** [ ] Pass [ ] Fail

---

## 7. Browser DevTools Validation

### LocalStorage Check
```javascript
// Run in browser console
// Check stored versions
const versions = localStorage.getItem('rolloy_prompt_versions');
console.log('Versions:', JSON.parse(versions));

// Check session data
const sessionData = localStorage.getItem('rolloy_session_data');
console.log('Session:', JSON.parse(sessionData));

// Check images
const images = localStorage.getItem('rolloy_generated_images');
console.log('Images:', JSON.parse(images));
```

**Expected:**
- `versions` should contain array with `chinesePrompt`, `videoPrompt` fields
- `sessionData` should contain `currentVersionNumber`
- `images` should contain array with `promptVersion` field

**Actual:** _______

### Network Monitoring
```
1. Open DevTools → Network tab
2. Filter: XHR
3. Perform a refinement (create V2)
4. Look for requests:
   - POST /api/sessions/{id}/versions (create V2)
   - POST /api/translate-prompt (get Chinese)
   - PATCH /api/sessions/{id}/versions/{versionId} (update Chinese)
5. Click "Video Prompt" button
6. Look for requests:
   - POST /api/generate-video-prompt
   - PATCH /api/sessions/{id}/versions/{versionId} (update video)
```

**Expected Sequence:**
1. POST /api/sessions/{id}/versions → 201 Created
2. POST /api/translate-prompt → 200 OK
3. PATCH /api/sessions/{id}/versions/{versionId} → 200 OK (Chinese)
4. POST /api/generate-video-prompt → 200 OK
5. PATCH /api/sessions/{id}/versions/{versionId} → 200 OK (Video)

**Actual:** _______

---

## 8. Performance Benchmarks

### Metric 1: Page Load Time
- **Target:** <3 seconds for session with 20 images
- **Measurement:** DevTools → Performance → Record page load
- **Actual:** _______

### Metric 2: Version Switch Time
- **Target:** <500ms to switch between versions
- **Measurement:** Time between click and UI update
- **Actual:** _______

### Metric 3: Chinese Translation Time
- **Target:** <5 seconds
- **Measurement:** From prompt generation to Chinese display
- **Actual:** _______

### Metric 4: Video Prompt Generation Time
- **Target:** <10 seconds
- **Measurement:** From button click to video prompt display
- **Actual:** _______

### Metric 5: Cloud Sync Retry Time
- **Target:** <5 retries (5 seconds total)
- **Measurement:** Check console logs for retry count
- **Actual:** _______

---

## 9. Regression Test Checklist

After any code changes to the data persistence system, run this quick checklist:

### Quick Smoke Test (5 minutes)
- [ ] Create new session
- [ ] Generate prompt (V1)
- [ ] Wait for Chinese translation
- [ ] Generate 4 images
- [ ] Click "Video Prompt"
- [ ] Refresh page
- [ ] Verify all data restored

### Full Regression (30 minutes)
- [ ] Run TC-001 through TC-007
- [ ] Run database validation queries
- [ ] Check for console errors
- [ ] Verify cross-device sync

---

## 10. Bug Report Template

If a test fails, use this template to report the bug:

```markdown
# BUG-XXX: [Short Description]

**Severity:** Critical / High / Medium / Low
**Component:** Data Persistence / API / Frontend / Database
**Test Case:** TC-XXX

## Description
Clear description of the issue.

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Browser: Chrome 120
- OS: macOS 14.0
- App Version: 3.35.4
- Node: 20.x
- Database Migration: 20251212

## Evidence
- Screenshot: [attach]
- Console logs: [paste]
- Network request: [paste]
- Database query result: [paste]

## Impact
How does this affect users?

## Suggested Fix
(Optional) How to fix this issue.
```

---

## 11. Sign-Off

### Test Execution Summary

**Execution Date:** _______________________
**Tester Name:** _______________________
**Environment:** Production / Staging / Development

**Results:**
- Total Test Cases: 8 manual + 6 automated (planned)
- Passed: ___
- Failed: ___
- Blocked: ___
- Not Executed: ___

**Critical Issues Found:** ___
**Recommendations:**
_______________________
_______________________

**Sign-Off:**
- [ ] All critical tests passed
- [ ] No critical bugs found
- [ ] Data persistence verified
- [ ] Cross-device sync verified
- [ ] Ready for deployment

**Tester Signature:** _______________________
**Date:** _______________________

---

**End of Test Plan**
